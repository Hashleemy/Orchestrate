package uiembed

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed all:dist
var dist embed.FS

// Handler returns an http.Handler that serves the embedded React build.
// Falls back to index.html for client-side routing.
func Handler() http.Handler {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		panic("uiembed: failed to sub dist: " + err.Error())
	}
	return &spaHandler{fs: http.FS(sub)}
}

type spaHandler struct {
	fs http.FileSystem
}

func (s *spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f, err := s.fs.Open(r.URL.Path)
	if err != nil {
		// not found → serve index.html for SPA routing
		f, err = s.fs.Open("/index.html")
		if err != nil {
			http.Error(w, "index.html not found", http.StatusNotFound)
			return
		}
		r.URL.Path = "/index.html"
	}
	f.Close()
	http.FileServer(s.fs).ServeHTTP(w, r)
}
