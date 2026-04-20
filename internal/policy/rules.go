package policy

// CheckpointTrigger categorizes why an operation requires a user checkpoint.
type CheckpointTrigger string

const (
	TriggerPackageInstall     CheckpointTrigger = "package_install"
	TriggerLockfileChange     CheckpointTrigger = "lockfile_change"
	TriggerProtectedMerge     CheckpointTrigger = "protected_merge"
	TriggerMajorChange        CheckpointTrigger = "major_change"
	TriggerSensitiveFile      CheckpointTrigger = "sensitive_file"
	TriggerArchitecturalBlock CheckpointTrigger = "architectural_block"
	TriggerMilestone          CheckpointTrigger = "milestone"
)

var lockfilePatterns = []string{
	"go.sum",
	"package-lock.json",
	"yarn.lock",
	"pnpm-lock.yaml",
	"Cargo.lock",
	"Pipfile.lock",
}

func IsLockfile(path string) bool {
	for _, name := range lockfilePatterns {
		if path == name {
			return true
		}
	}
	return false
}
