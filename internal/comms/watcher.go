package comms

import (
	"time"
)

// Watcher polls the comms directory and sends new messages to a channel.
type Watcher struct {
	commsDir string
	interval time.Duration
	seen     map[string]bool
	out      chan Message
	stop     chan struct{}
}

func NewWatcher(commsDir string, interval time.Duration) *Watcher {
	return &Watcher{
		commsDir: commsDir,
		interval: interval,
		seen:     make(map[string]bool),
		out:      make(chan Message, 64),
		stop:     make(chan struct{}),
	}
}

func (w *Watcher) C() <-chan Message {
	return w.out
}

func (w *Watcher) Start() {
	go func() {
		ticker := time.NewTicker(w.interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				w.poll()
			case <-w.stop:
				return
			}
		}
	}()
}

func (w *Watcher) Stop() {
	close(w.stop)
}

func (w *Watcher) poll() {
	msgs, err := ReadAll(w.commsDir)
	if err != nil {
		return
	}
	for _, m := range msgs {
		key := m.From + m.Timestamp.String()
		if !w.seen[key] {
			w.seen[key] = true
			w.out <- m
		}
	}
}
