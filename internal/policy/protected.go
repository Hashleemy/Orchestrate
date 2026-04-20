package policy

import "path/filepath"

var protectedPatterns = []string{
	".env",
	".env.*",
	"*.pem",
	"*.key",
	"*.p12",
	"*.pfx",
	"secrets.*",
	"credentials.*",
}

func IsProtectedPath(path string) bool {
	base := filepath.Base(path)
	for _, pattern := range protectedPatterns {
		if matched, _ := filepath.Match(pattern, base); matched {
			return true
		}
	}
	return false
}
