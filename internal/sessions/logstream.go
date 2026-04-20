package sessions

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"time"
)

// StreamAgentLog sends existing lines from logPath as SSE events, then polls
// for new content every 500 ms until ctx is cancelled. Falls back gracefully
// when the file doesn't exist yet — it simply waits for it to appear.
//
// Each SSE frame is written as:  data: <raw-json-line>\n\n
// The caller must supply a flush func that flushes the underlying http.Flusher.
func StreamAgentLog(ctx context.Context, logPath string, w io.Writer, flush func()) {
	var offset int64

	// Send all existing lines first.
	if data, err := os.ReadFile(logPath); err == nil {
		offset = int64(len(data))
		for _, line := range bytes.Split(data, []byte("\n")) {
			line = bytes.TrimSpace(line)
			if len(line) == 0 {
				continue
			}
			fmt.Fprintf(w, "data: %s\n\n", line)
			flush()
		}
	}

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			f, err := os.Open(logPath)
			if err != nil {
				continue // file not created yet — keep waiting
			}

			fi, err := f.Stat()
			if err != nil || fi.Size() <= offset {
				f.Close()
				continue
			}

			f.Seek(offset, io.SeekStart) //nolint:errcheck
			chunk, err := io.ReadAll(f)
			f.Close()
			if err != nil || len(chunk) == 0 {
				continue
			}
			offset += int64(len(chunk))

			for _, line := range bytes.Split(chunk, []byte("\n")) {
				line = bytes.TrimSpace(line)
				if len(line) == 0 {
					continue
				}
				fmt.Fprintf(w, "data: %s\n\n", line)
				flush()
			}
		}
	}
}
