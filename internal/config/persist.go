package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Saved is the persisted orchestrator configuration.
type Saved struct {
	RepoPath string `json:"repo_path"`
}

// Load reads the saved config from ~/.orchestrate/config.json.
// Returns an empty Saved (not an error) if the file doesn't exist yet.
func Load() (*Saved, error) {
	f, err := configFile()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(f)
	if err != nil {
		if os.IsNotExist(err) {
			return &Saved{}, nil
		}
		return nil, err
	}
	var s Saved
	if err := json.Unmarshal(data, &s); err != nil {
		return &Saved{}, nil
	}
	return &s, nil
}

// Save writes the config to ~/.orchestrate/config.json, creating the directory if needed.
func Save(s *Saved) error {
	f, err := configFile()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(f), 0755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(s, "", "  ")
	return os.WriteFile(f, data, 0644)
}

func configFile() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".orchestrate", "config.json"), nil
}
