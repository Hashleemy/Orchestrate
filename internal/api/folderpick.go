package api

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

// pickFolder opens a native OS folder picker and returns the selected path.
// An empty string (with no error) indicates the user cancelled.
func pickFolder() (string, error) {
	switch runtime.GOOS {
	case "windows":
		return pickFolderWindows()
	case "darwin":
		return pickFolderMac()
	default:
		return "", fmt.Errorf("folder picker not supported on %s", runtime.GOOS)
	}
}

func pickFolderWindows() (string, error) {
	// -STA is required: FolderBrowserDialog needs single-threaded apartment.
	const script = `
Add-Type -AssemblyName System.Windows.Forms | Out-Null
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'Select repository folder'
$dlg.ShowNewFolderButton = $false
if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dlg.SelectedPath
}
`
	out, err := exec.Command("powershell", "-NoProfile", "-STA", "-Command", script).Output()
	if err != nil {
		return "", fmt.Errorf("folder dialog failed: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

func pickFolderMac() (string, error) {
	out, err := exec.Command("osascript", "-e",
		`POSIX path of (choose folder with prompt "Select repository folder")`).Output()
	if err != nil {
		// osascript exits non-zero when the user cancels — treat as empty selection.
		return "", nil
	}
	return strings.TrimSpace(string(out)), nil
}
