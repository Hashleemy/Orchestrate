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
	_, err := s.fs.Open(r.URL.Path)
	if err != nil {
		// Unknown path → serve "/" so http.FileServer picks up index.html.
		// Setting the path to "/index.html" would trigger http.FileServer's
		// built-in redirect of *.../index.html → ./, so we use "/" instead.
		r.URL.Path = "/"
	}
	http.FileServer(s.fs).ServeHTTP(w, r)
}
