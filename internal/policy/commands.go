package policy

import "strings"

var installPrefixes = []string{
	"npm install",
	"npm i",
	"pnpm add",
	"yarn add",
	"go get",
	"pip install",
	"cargo add",
	"winget install",
	"choco install",
}

func RequiresApproval(command string) bool {
	normalized := strings.TrimSpace(strings.ToLower(command))
	for _, prefix := range installPrefixes {
		if strings.HasPrefix(normalized, prefix) {
			return true
		}
	}
	return false
}
