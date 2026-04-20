package scheduler

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/parser"
	"local-agent-orchestrator/internal/tasks"
)

// Scheduler periodically evaluates the task dependency graph and promotes
// todo tasks to ready when all their dependencies are done. It writes its
// decisions as events to agent-comms/events/scheduler.jsonl so they appear
// in the dashboard EventFeed without a dedicated API endpoint.
type Scheduler struct {
	tasksFile string
	eventsDir string
	interval  time.Duration
	stop      chan struct{}
	once      sync.Once
}

func New(tasksFile, eventsDir string, interval time.Duration) *Scheduler {
	return &Scheduler{
		tasksFile: tasksFile,
		eventsDir: eventsDir,
		interval:  interval,
		stop:      make(chan struct{}),
	}
}

func (s *Scheduler) Start() {
	go func() {
		t := time.NewTicker(s.interval)
		defer t.Stop()
		for {
			select {
			case <-t.C:
				s.tick()
			case <-s.stop:
				return
			}
		}
	}()
}

func (s *Scheduler) Stop() {
	s.once.Do(func() { close(s.stop) })
}

func (s *Scheduler) tick() {
	data, err := os.ReadFile(s.tasksFile)
	if err != nil {
		if os.IsNotExist(err) {
			return
		}
		log.Printf("scheduler: read %s: %v", s.tasksFile, err)
		return
	}

	list, err := parser.Parse(string(data))
	if err != nil {
		log.Printf("scheduler: parse tasks: %v", err)
		return
	}

	if err := DetectCycle(list.Tasks); err != nil {
		s.emit("", "error", fmt.Sprintf("dependency cycle: %v", err))
		return
	}

	promoted := promoteReady(list.Tasks)
	if len(promoted) == 0 {
		return
	}

	// Reserialize and write back.
	// NOTE: there is a benign race between agent writes and this write.
	// Only todo→ready promotions are applied, so the worst case is a
	// re-promotion that an agent quickly overrides on its next heartbeat.
	updated := tasks.Serialize(list)
	if err := os.WriteFile(s.tasksFile, []byte(updated), 0644); err != nil {
		log.Printf("scheduler: write tasks: %v", err)
		return
	}

	for _, id := range promoted {
		s.emit(id, "task_promoted",
			fmt.Sprintf("%s: todo → ready (all dependencies satisfied)", id))
	}
}

// promoteReady mutates taskSlice in-place and returns the promoted IDs.
func promoteReady(taskSlice []models.Task) []string {
	ids := ReadyIDs(taskSlice)
	if len(ids) == 0 {
		return nil
	}
	set := make(map[string]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	for i := range taskSlice {
		if set[taskSlice[i].ID] {
			taskSlice[i].Status = models.TaskReady
		}
	}
	return ids
}

func (s *Scheduler) emit(taskID, eventType, detail string) {
	if err := os.MkdirAll(s.eventsDir, 0755); err != nil {
		return
	}
	line := fmt.Sprintf(
		"{\"timestamp\":%q,\"agent\":\"scheduler\",\"task_id\":%q,\"type\":%q,\"detail\":%q}\n",
		time.Now().UTC().Format(time.RFC3339),
		taskID,
		eventType,
		detail,
	)
	f, err := os.OpenFile(
		filepath.Join(s.eventsDir, "scheduler.jsonl"),
		os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644,
	)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = f.WriteString(line)
}
