// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

// validateMattermostDirectory checks if the directory looks like a Mattermost installation
func validateMattermostDirectory(mmDir string) error {
	configDir := filepath.Join(mmDir, "config")
	logsDir := filepath.Join(mmDir, "logs")

	configStat, configErr := os.Stat(configDir)
	logsStat, logsErr := os.Stat(logsDir)

	if configErr != nil || !configStat.IsDir() || logsErr != nil || !logsStat.IsDir() {
		return fmt.Errorf("directory does not appear to be a Mattermost installation: missing config/ and logs/ subdirectories in %s", mmDir)
	}

	return nil
}

// collectMattermostFiles collects config and log files
// Returns count of files collected and error (error only on sanitization failure)
func collectMattermostFiles(mmDir string, tempDir string, obfuscate bool) (int, error) {
	count := 0

	// Collect config.json
	configPath := filepath.Join(mmDir, "config", "config.json")
	configBytes, err := os.ReadFile(configPath)
	if err != nil {
		printer.PrintError(fmt.Sprintf("Warning: Could not read config.json: %v", err))
	} else {
		if obfuscate {
			sanitizedBytes, err := sanitizeConfigJSON(configBytes)
			if err != nil {
				return 0, fmt.Errorf("failed to sanitize config.json: %w", err)
			}
			configBytes = sanitizedBytes
		}

		destPath := filepath.Join(tempDir, "config.json")
		if err := os.WriteFile(destPath, configBytes, 0600); err != nil {
			printer.PrintError(fmt.Sprintf("Warning: Could not write config.json: %v", err))
		} else {
			count++
			if obfuscate {
				printer.Print("Collected config.json (sanitized)")
			} else {
				printer.Print("Collected config.json (no sanitization)")
			}
		}
	}

	// Collect log files
	logsDir := filepath.Join(mmDir, "logs")
	logsDest := filepath.Join(tempDir, "logs")
	if err := os.MkdirAll(logsDest, 0700); err != nil {
		printer.PrintError(fmt.Sprintf("Warning: Could not create logs directory: %v", err))
	} else {
		logCount := 0
		err := filepath.Walk(logsDir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil // Continue on errors
			}
			if info.IsDir() {
				return nil
			}
			// Skip symlinks to prevent arbitrary file reads
			if info.Mode()&os.ModeSymlink != 0 {
				return nil
			}
			if strings.HasSuffix(info.Name(), ".log") {
				relPath, err := filepath.Rel(logsDir, path)
				if err != nil {
					relPath = info.Name()
				}
				destPath := filepath.Join(logsDest, relPath)
				if err := os.MkdirAll(filepath.Dir(destPath), 0700); err != nil {
					printer.PrintError(fmt.Sprintf("Warning: Could not create directory for log file %s: %v", relPath, err))
					return nil
				}
				if err := copyFile(path, destPath); err != nil {
					printer.PrintError(fmt.Sprintf("Warning: Could not copy log file %s: %v", relPath, err))
					return nil
				}
				logCount++
			}
			return nil
		})
		if err != nil {
			printer.PrintError(fmt.Sprintf("Warning: Error walking logs directory: %v", err))
		}
		if logCount > 0 {
			printer.Print(fmt.Sprintf("Collected %d log files", logCount))
			count += logCount
		}
	}

	return count, nil
}

// extractPortFromConfig extracts the port number from config.json ListenAddress
func extractPortFromConfig(configPath string) string {
	content, err := os.ReadFile(configPath)
	if err != nil {
		return "8065" // Default port
	}

	var config struct {
		ServiceSettings struct {
			ListenAddress string
		}
	}
	if err := json.Unmarshal(content, &config); err != nil {
		return "8065"
	}

	addr := strings.TrimSpace(config.ServiceSettings.ListenAddress)
	if addr == "" {
		return "8065"
	}

	// Check for Unix socket
	if strings.HasPrefix(addr, "/") || strings.Contains(addr, ".sock") {
		return "" // Empty string indicates Unix socket
	}

	// Handle IPv6 bracket format: [::1]:8065 or [2001:db8::1]:8065
	if strings.HasPrefix(addr, "[") {
		closeBracketIdx := strings.Index(addr, "]")
		if closeBracketIdx != -1 && closeBracketIdx < len(addr)-1 && addr[closeBracketIdx+1] == ':' {
			port := addr[closeBracketIdx+2:]
			if port != "" && !strings.Contains(port, ":") {
				return port
			}
		}
		return "8065"
	}

	// Handle :port format (most common)
	if strings.HasPrefix(addr, ":") {
		port := strings.TrimPrefix(addr, ":")
		// Check if it's a numeric port (not a service name like :http)
		if port != "" && port[0] >= '0' && port[0] <= '9' {
			return port
		}
		return "8065"
	}

	// Handle IPv4 with port: 0.0.0.0:8065
	// Multiple colons without brackets means bare IPv6 (no port) — use default
	if strings.Count(addr, ":") == 1 {
		lastColon := strings.LastIndex(addr, ":")
		if lastColon < len(addr)-1 {
			port := addr[lastColon+1:]
			if port != "" && port[0] >= '0' && port[0] <= '9' {
				return port
			}
		}
	}

	return "8065"
}

// collectSystemDiagnostics collects system files and executes system commands to capture output.
// This is best-effort: individual files/commands that fail are silently skipped.
func collectSystemDiagnostics(tempDir string, configPath string) int {
	count := 0

	// Collect system files
	systemFiles := []struct {
		source string
		dest   string
	}{
		{"/etc/os-release", "os-release"},
		{"/proc/meminfo", "meminfo"},
	}

	for _, file := range systemFiles {
		content, err := os.ReadFile(file.source)
		if err != nil {
			continue // Silently skip if not readable
		}
		destPath := filepath.Join(tempDir, file.dest)
		if err := os.WriteFile(destPath, content, 0600); err == nil {
			count++
		}
	}

	// Extract port from config
	port := extractPortFromConfig(configPath)

	commands := []struct {
		cmd  []string
		file string
		desc string
	}{
		{[]string{"systemctl", "status", "mattermost.service", "--no-pager", "-l", "-n", "100"}, "systemctl.txt", "systemctl status"},
		{[]string{"journalctl", "-u", "mattermost.service", "-n", "1000", "--no-pager"}, "journalctl.txt", "journalctl"},
		{[]string{"top", "-b", "-n", "1"}, "top.txt", "top snapshot"},
		{[]string{"df", "-a", "-h"}, "diskspace.txt", "disk usage"},
	}

	// Add port-specific commands if not Unix socket
	if port != "" {
		commands = append(commands, struct {
			cmd  []string
			file string
			desc string
		}{[]string{"netstat", "-tulnp"}, "portinfo-raw.txt", "network ports"})
	}

	for _, cmdInfo := range commands {
		output, err := runCommand(cmdInfo.cmd[0], cmdInfo.cmd[1:]...)
		if err != nil {
			// Try fallback for netstat
			if cmdInfo.cmd[0] == "netstat" && port != "" {
				output, err = runCommand("ss", "-tulnp")
				if err != nil {
					continue // Skip if both fail
				}
			} else {
				continue // Skip failed commands
			}
		}

		// Filter port info if needed
		if strings.Contains(cmdInfo.file, "portinfo") && port != "" {
			lines := strings.Split(string(output), "\n")
			var filtered []string
			for i, line := range lines {
				if i == 0 || strings.Contains(line, port) {
					filtered = append(filtered, line)
				}
			}
			output = []byte(strings.Join(filtered, "\n"))
			cmdInfo.file = "portinfo.txt"
		}

		destPath := filepath.Join(tempDir, cmdInfo.file)
		if err := os.WriteFile(destPath, output, 0600); err == nil {
			count++
		}
	}

	return count
}

// runCommand executes a command with a 30-second timeout and captures output
func runCommand(cmdName string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, cmdName, args...)
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return output, nil
}

// copyFile streams a file from src to dst without buffering the entire content in memory.
func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}

// createTarGzArchive creates a .tar.gz archive from a source directory
func createTarGzArchive(sourceDir string, outputPath string) error {
	// Create output file
	outFile, err := os.OpenFile(outputPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}

	// Setup error handling for cleanup on failure
	var archiveErr error
	defer func() {
		if archiveErr != nil {
			outFile.Close()
			if err := os.Remove(outputPath); err != nil {
				printer.PrintError(fmt.Sprintf("Security Warning: Failed to clean up partial archive containing potentially sensitive data: %s. Manual deletion required.", outputPath))
			}
		}
	}()

	// Chain gzip and tar writers
	gzipWriter := gzip.NewWriter(outFile)
	tarWriter := tar.NewWriter(gzipWriter)

	// Walk source directory
	archiveErr = filepath.Walk(sourceDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip symlinks
		if info.Mode()&os.ModeSymlink != 0 {
			return nil
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Create tar header
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return fmt.Errorf("failed to create tar header for %s: %w", path, err)
		}

		// Make path relative to source directory
		relPath, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return fmt.Errorf("failed to get relative path for %s: %w", path, err)
		}
		header.Name = relPath

		// Set secure file mode
		header.Mode = 0600

		// Write header
		if err := tarWriter.WriteHeader(header); err != nil {
			return fmt.Errorf("failed to write tar header for %s: %w", relPath, err)
		}

		// Open and copy file content
		file, err := os.Open(path)
		if err != nil {
			return fmt.Errorf("failed to open file %s: %w", path, err)
		}
		defer file.Close()

		if _, err := io.Copy(tarWriter, file); err != nil {
			return fmt.Errorf("failed to write file %s to archive: %w", relPath, err)
		}

		return nil
	})

	if archiveErr != nil {
		return archiveErr
	}

	// Close writers explicitly to ensure all data is flushed
	if err := tarWriter.Close(); err != nil {
		archiveErr = err
		return fmt.Errorf("failed to close tar writer: %w", err)
	}
	if err := gzipWriter.Close(); err != nil {
		archiveErr = err
		return fmt.Errorf("failed to close gzip writer: %w", err)
	}
	if err := outFile.Close(); err != nil {
		archiveErr = err
		return fmt.Errorf("failed to close output file: %w", err)
	}

	return nil
}
