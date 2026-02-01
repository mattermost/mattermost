// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"archive/tar"
	"compress/gzip"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/spf13/cobra"
)

var PacketPullCmd = &cobra.Command{
	Use:   "packet-pull",
	Short: "Collect Mattermost diagnostics for offline support troubleshooting",
	Long: `Collect Mattermost configuration, logs, and system diagnostics entirely via filesystem
reads and shell command execution (no API dependency). Creates a timestamped .tar.gz archive.

This command is useful when the Mattermost server is offline or unreachable. It collects:
- config.json (obfuscated by default)
- All log files (unmodified)
- System diagnostics: /etc/os-release, /proc/meminfo
- System command output: systemctl status, journalctl, top, netstat/ss, df

Example:
  mmctl packet-pull
  mmctl packet-pull --directory /opt/mattermost --target /tmp --name diagnostics
  mmctl packet-pull --no-obfuscate`,
	RunE: packetPullCmdF,
}

func init() {
	PacketPullCmd.Flags().String("directory", "/opt/mattermost", "Path to Mattermost installation directory")
	PacketPullCmd.Flags().String("target", ".", "Path to output directory for the archive")
	PacketPullCmd.Flags().String("name", "support-packet", "Base name for the output archive file")
	PacketPullCmd.Flags().Bool("no-obfuscate", false, "Disable obfuscation of sensitive config data")
	RootCmd.AddCommand(PacketPullCmd)
}

func packetPullCmdF(cmd *cobra.Command, args []string) error {
	// Parse flags
	mmDir, _ := cmd.Flags().GetString("directory")
	targetDir, _ := cmd.Flags().GetString("target")
	name, _ := cmd.Flags().GetString("name")
	noObfuscate, _ := cmd.Flags().GetBool("no-obfuscate")
	obfuscate := !noObfuscate

	// Validate Mattermost directory structure
	if err := validateMattermostDirectory(mmDir); err != nil {
		return err
	}

	// Generate timestamp
	timestamp := time.Now().UTC().Format("20060102-150405")
	baseFilename := fmt.Sprintf("%s_%s.tar.gz", name, timestamp)
	outputPath := filepath.Join(targetDir, baseFilename)

	// Check for filename collision and append random suffix if needed
	if _, err := os.Stat(outputPath); err == nil {
		suffix := make([]byte, 2)
		rand.Read(suffix)
		baseFilename = fmt.Sprintf("%s_%s_%x.tar.gz", name, timestamp, suffix)
		outputPath = filepath.Join(targetDir, baseFilename)
	}

	// Create temp directory
	tempDir, err := os.MkdirTemp("", "mmctl-packet-pull-*")
	if err != nil {
		return fmt.Errorf("failed to create temporary directory: %w", err)
	}

	// Setup cleanup handler
	tempDirForErrorMsg := tempDir
	defer func() {
		if err := os.RemoveAll(tempDir); err != nil {
			printer.PrintError(fmt.Sprintf("Warning: Failed to cleanup temporary directory: %s", tempDir))
		}
	}()

	// Collect Mattermost files
	configPath := filepath.Join(mmDir, "config", "config.json")
	filesCollected, err := collectMattermostFiles(mmDir, tempDir, obfuscate)
	if err != nil {
		return fmt.Errorf("config obfuscation failed - cannot safely archive: %w", err)
	}

	// Collect system diagnostics
	diagCount, _ := collectSystemDiagnostics(tempDir, configPath)
	filesCollected += diagCount

	// Validate we collected something
	if filesCollected == 0 {
		return fmt.Errorf("collection failed completely - no files were collected")
	}

	// Log obfuscation summary if enabled
	if obfuscate {
		printer.Print(fmt.Sprintf("Collection complete. Obfuscation applied to config.json."))
	} else {
		printer.Print("Collection complete. No obfuscation applied (--no-obfuscate flag used).")
	}

	// Create archive
	if err := createTarGzArchive(tempDir, outputPath); err != nil {
		// Preserve temp directory on archive failure
		printer.PrintError(fmt.Sprintf("Archive creation failed. Collected files are in: %s", tempDirForErrorMsg))
		printer.PrintError("You can manually tar/zip this directory.")
		return fmt.Errorf("failed to create archive: %w", err)
	}

	// Success
	printer.PrintT("Support packet created successfully: {{.Path}}", map[string]string{"Path": outputPath})
	return nil
}

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
// Returns count of files collected and error (error only on obfuscation failure)
func collectMattermostFiles(mmDir string, tempDir string, obfuscate bool) (int, error) {
	count := 0
	obfuscatedCount := 0

	// Collect config.json
	configPath := filepath.Join(mmDir, "config", "config.json")
	configBytes, err := os.ReadFile(configPath)
	if err != nil {
		printer.PrintError(fmt.Sprintf("Warning: Could not read config.json: %v", err))
	} else {
		if obfuscate {
			obfuscatedBytes, obfCount, err := obfuscateConfigJSON(configBytes)
			if err != nil {
				return 0, fmt.Errorf("failed to obfuscate config.json: %w", err)
			}
			obfuscatedCount = obfCount
			configBytes = obfuscatedBytes

			if obfuscatedCount == 0 {
				printer.PrintError("Warning: No sensitive fields found in config.json - verify config is complete")
			}
		}

		destPath := filepath.Join(tempDir, "config.json")
		if err := os.WriteFile(destPath, configBytes, 0600); err != nil {
			printer.PrintError(fmt.Sprintf("Warning: Could not write config.json: %v", err))
		} else {
			count++
			if obfuscate {
				printer.Print(fmt.Sprintf("Collected config.json (obfuscated %d sensitive fields)", obfuscatedCount))
			} else {
				printer.Print("Collected config.json (no obfuscation)")
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
			if strings.HasSuffix(info.Name(), ".log") {
				content, err := os.ReadFile(path)
				if err != nil {
					printer.PrintError(fmt.Sprintf("Warning: Could not read log file %s: %v", info.Name(), err))
					return nil
				}
				destPath := filepath.Join(logsDest, info.Name())
				if err := os.WriteFile(destPath, content, 0600); err != nil {
					printer.PrintError(fmt.Sprintf("Warning: Could not write log file %s: %v", info.Name(), err))
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

	// Collect system files
	systemFiles := []struct {
		source string
		dest   string
		name   string
	}{
		{"/etc/os-release", "os-release", "OS release info"},
		{"/proc/meminfo", "meminfo", "Memory info"},
	}

	for _, file := range systemFiles {
		content, err := os.ReadFile(file.source)
		if err != nil {
			// Silently skip if not readable
			continue
		}
		destPath := filepath.Join(tempDir, file.dest)
		if err := os.WriteFile(destPath, content, 0600); err == nil {
			count++
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

	// Handle IPv4 or IPv6 with port: 0.0.0.0:8065 or ::1:8065
	lastColon := strings.LastIndex(addr, ":")
	if lastColon != -1 && lastColon < len(addr)-1 {
		port := addr[lastColon+1:]
		if port != "" && port[0] >= '0' && port[0] <= '9' {
			return port
		}
	}

	return "8065"
}

// collectSystemDiagnostics executes system commands and captures output
func collectSystemDiagnostics(tempDir string, configPath string) (int, error) {
	count := 0

	// Extract port from config
	port := extractPortFromConfig(configPath)

	commands := []struct {
		cmd  []string
		file string
		desc string
	}{
		{[]string{"systemctl", "status", "mattermost.service", "--no-pager", "-l"}, "systemctl.txt", "systemctl status"},
		{[]string{"journalctl", "-xe", "--no-pager"}, "journalctl.txt", "journalctl"},
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
			for _, line := range lines {
				if strings.Contains(line, port) || strings.Contains(line, "Proto") {
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

	return count, nil
}

// runCommand executes a command and captures output
func runCommand(cmdName string, args ...string) ([]byte, error) {
	cmd := exec.Command(cmdName, args...)
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return output, nil
}

// createTarGzArchive creates a .tar.gz archive from a source directory
func createTarGzArchive(sourceDir string, outputPath string) error {
	// Create output file
	outFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}
	defer outFile.Close()

	// Setup error handling for cleanup on failure
	var archiveErr error
	defer func() {
		if archiveErr != nil {
			if err := os.Remove(outputPath); err != nil {
				printer.PrintError(fmt.Sprintf("Security Warning: Failed to clean up partial archive containing potentially sensitive data: %s. Manual deletion required.", outputPath))
			}
		}
	}()

	// Chain gzip and tar writers
	gzipWriter := gzip.NewWriter(outFile)
	defer gzipWriter.Close()

	tarWriter := tar.NewWriter(gzipWriter)
	defer tarWriter.Close()

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

		// Skip files > 100MB
		if info.Size() > 100*1024*1024 {
			printer.PrintError(fmt.Sprintf("Warning: Skipping large file (>100MB): %s", info.Name()))
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
