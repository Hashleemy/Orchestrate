package main

import (
	"log"

	"local-agent-orchestrator/internal/api"
)

func main() {
	server, err := api.NewServer()
	if err != nil {
		log.Fatalf("failed to initialize server: %v", err)
	}

	log.Println("starting orchestrator on http://127.0.0.1:8080")
	if err := server.Start(); err != nil {
		log.Fatalf("server stopped with error: %v", err)
	}
}
