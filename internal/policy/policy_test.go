package policy_test

import (
	"testing"

	"local-agent-orchestrator/internal/models"
	"local-agent-orchestrator/internal/policy"
)

func TestIsProtectedPath(t *testing.T) {
	cases := []struct {
		path    string
		blocked bool
	}{
		{".env", true},
		{".env.production", true},
		{"config/server.key", true},
		{"cert.pem", true},
		{"deploy.p12", true},
		{"backup.pfx", true},
		{"secrets.yaml", true},
		{"credentials.json", true},
		{"main.go", false},
		{"internal/api/server.go", false},
		{"README.md", false},
	}
	for _, c := range cases {
		got := policy.IsProtectedPath(c.path)
		if got != c.blocked {
			t.Errorf("IsProtectedPath(%q) = %v, want %v", c.path, got, c.blocked)
		}
	}
}

func TestIsLockfile(t *testing.T) {
	lockfiles := []string{"go.sum", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock", "Pipfile.lock"}
	for _, f := range lockfiles {
		if !policy.IsLockfile(f) {
			t.Errorf("IsLockfile(%q) = false, want true", f)
		}
	}
	notLockfiles := []string{"go.mod", "package.json", "Cargo.toml", "main.go"}
	for _, f := range notLockfiles {
		if policy.IsLockfile(f) {
			t.Errorf("IsLockfile(%q) = true, want false", f)
		}
	}
}

func TestRequiresApproval(t *testing.T) {
	blocked := []string{
		"npm install react",
		"npm i lodash",
		"go get github.com/foo/bar",
		"pip install requests",
		"yarn add typescript",
		"pnpm add vite",
		"cargo add serde",
	}
	for _, cmd := range blocked {
		if !policy.RequiresApproval(cmd) {
			t.Errorf("RequiresApproval(%q) = false, want true", cmd)
		}
	}
	allowed := []string{
		"go build ./...",
		"npm run build",
		"git status",
		"go test ./...",
	}
	for _, cmd := range allowed {
		if policy.RequiresApproval(cmd) {
			t.Errorf("RequiresApproval(%q) = true, want false", cmd)
		}
	}
}

func TestClassifyFiles_Minor(t *testing.T) {
	files := []string{"internal/api/server.go", "web/src/App.tsx"}
	result := policy.ClassifyFiles(files, nil)
	if result.Kind != policy.DiffMinor {
		t.Errorf("expected minor, got %s", result.Kind)
	}
	if len(result.Triggers) != 0 {
		t.Errorf("expected no triggers, got %v", result.Triggers)
	}
}

func TestClassifyFiles_ProtectedFile(t *testing.T) {
	files := []string{"internal/api/server.go", ".env"}
	result := policy.ClassifyFiles(files, nil)
	if result.Kind != policy.DiffBlocked {
		t.Errorf("expected blocked, got %s", result.Kind)
	}
	if len(result.Triggers) == 0 {
		t.Error("expected triggers for protected file")
	}
}

func TestClassifyFiles_LockfileIsMajor(t *testing.T) {
	files := []string{"go.sum"}
	result := policy.ClassifyFiles(files, nil)
	if result.Kind != policy.DiffMajor {
		t.Errorf("expected major for lockfile, got %s", result.Kind)
	}
}

func TestClassifyFiles_TaskFlaggedMajor(t *testing.T) {
	task := &models.Task{MajorChange: true}
	files := []string{"internal/api/server.go"}
	result := policy.ClassifyFiles(files, task)
	if result.Kind != policy.DiffMajor {
		t.Errorf("expected major from task flag, got %s", result.Kind)
	}
}

func TestClassifyFiles_AuthKeywordIsMajor(t *testing.T) {
	files := []string{"internal/auth/middleware.go"}
	result := policy.ClassifyFiles(files, nil)
	if result.Kind != policy.DiffMajor {
		t.Errorf("expected major for auth path, got %s", result.Kind)
	}
}
