// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

var SystemCmd = &cobra.Command{
	Use:   "system",
	Short: "System management",
	Long:  `System management commands for interacting with the server state and configuration.`,
}

var SystemGetBusyCmd = &cobra.Command{
	Use:     "getbusy",
	Short:   "Get the current busy state",
	Long:    `Gets the server busy state (high load) and timestamp corresponding to when the server busy flag will be automatically cleared.`,
	Example: `  system getbusy`,
	Args:    cobra.NoArgs,
	RunE:    withClient(getBusyCmdF),
}

var SystemSetBusyCmd = &cobra.Command{
	Use:     "setbusy -s [seconds]",
	Short:   "Set the busy state to true",
	Long:    `Set the busy state to true for the specified number of seconds, which disables non-critical services.`,
	Example: `  system setbusy -s 3600`,
	Args:    cobra.NoArgs,
	RunE:    withClient(setBusyCmdF),
}

var SystemClearBusyCmd = &cobra.Command{
	Use:     "clearbusy",
	Short:   "Clears the busy state",
	Long:    `Clear the busy state, which re-enables non-critical services.`,
	Example: `  system clearbusy`,
	Args:    cobra.NoArgs,
	RunE:    withClient(clearBusyCmdF),
}

var SystemVersionCmd = &cobra.Command{
	Use:     "version",
	Short:   "Prints the remote server version",
	Long:    "Prints the server version of the currently connected Mattermost instance",
	Example: `  system version`,
	Args:    cobra.NoArgs,
	RunE:    withClient(systemVersionCmdF),
}

var SystemStatusCmd = &cobra.Command{
	Use:     "status",
	Short:   "Prints the status of the server",
	Long:    "Prints the server status calculated using several basic server healthchecks",
	Example: `  system status`,
	Args:    cobra.NoArgs,
	RunE:    withClient(systemStatusCmdF),
}

var SystemSupportPacketCmd = &cobra.Command{
	Use:   "supportpacket",
	Short: "Download a Support Packet",
	Long: `Generate and download a Support Packet of the server to share it with Mattermost Support.

By default, this command connects to the Mattermost server via API and generates a support packet.
Use the --offline flag to collect diagnostics directly from the filesystem when the server is unavailable.`,
	Example: `  # Download support packet from running server (API-based)
  system supportpacket

  # Collect diagnostics offline (filesystem-based, no server connection)
  system supportpacket --offline

  # Offline mode with custom Mattermost directory
  system supportpacket --offline --directory /opt/mattermost`,
	Args: cobra.NoArgs,
	RunE: systemSupportPacketWrapperF,
}

func init() {
	SystemSetBusyCmd.Flags().UintP("seconds", "s", 3600, "Number of seconds until server is automatically marked as not busy.")
	_ = SystemSetBusyCmd.MarkFlagRequired("seconds")

	SystemSupportPacketCmd.Flags().StringP("output-file", "o", "", "Define the output file name")
	SystemSupportPacketCmd.Flags().Bool("offline", false, "Collect diagnostics from filesystem without connecting to server")
	SystemSupportPacketCmd.Flags().String("directory", "/opt/mattermost", "Path to Mattermost installation directory (offline mode only)")
	SystemSupportPacketCmd.Flags().Bool("no-obfuscate", false, "Disable obfuscation of sensitive config data (offline mode only)")

	SystemCmd.AddCommand(
		SystemGetBusyCmd,
		SystemSetBusyCmd,
		SystemClearBusyCmd,
		SystemVersionCmd,
		SystemStatusCmd,
		SystemSupportPacketCmd,
	)
	RootCmd.AddCommand(SystemCmd)
}

func getBusyCmdF(c client.Client, cmd *cobra.Command, _ []string) error {
	printer.SetSingle(true)

	sbs, _, err := c.GetServerBusy(context.TODO())
	if err != nil {
		return fmt.Errorf("unable to get busy state: %w", err)
	}
	printer.PrintT("busy:{{.Busy}} expires:{{.Expires_ts}}", sbs)
	return nil
}

func setBusyCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	seconds, err := cmd.Flags().GetUint("seconds")
	if err != nil || seconds == 0 {
		return errors.New("seconds must be a number > 0")
	}

	_, err = c.SetServerBusy(context.TODO(), int(seconds))
	if err != nil {
		return fmt.Errorf("unable to set busy state: %w", err)
	}

	printer.PrintT("Busy state set", map[string]string{"status": "ok"})
	return nil
}

func clearBusyCmdF(c client.Client, cmd *cobra.Command, _ []string) error {
	printer.SetSingle(true)

	_, err := c.ClearServerBusy(context.TODO())
	if err != nil {
		return fmt.Errorf("unable to clear busy state: %w", err)
	}
	printer.PrintT("Busy state cleared", map[string]string{"status": "ok"})
	return nil
}

func systemVersionCmdF(c client.Client, cmd *cobra.Command, _ []string) error {
	printer.SetSingle(true)
	// server version information comes with all responses. We can't
	// use the initial "withClient" connection information as local
	// mode doesn't need to log in, so we use an endpoint that will
	// always return a valid response
	_, resp, err := c.GetPing(context.TODO())
	if err != nil {
		return fmt.Errorf("unable to fetch server version: %w", err)
	}

	printer.PrintT("Server version {{.version}}", map[string]string{"version": resp.ServerVersion})
	return nil
}

func systemStatusCmdF(c client.Client, cmd *cobra.Command, _ []string) error {
	printer.SetSingle(true)

	status, _, err := c.GetPingWithOptions(context.TODO(), model.SystemPingOptions{
		FullStatus:    true,
		RESTSemantics: true,
	})
	if err != nil {
		return fmt.Errorf("unable to fetch server status: %w", err)
	}

	printer.PrintT(`Server status: {{.status}}
Android Latest Version: {{.AndroidLatestVersion}}
Android Minimum Version: {{.AndroidMinVersion}}
Desktop Latest Version: {{.DesktopLatestVersion}}
Desktop Minimum Version: {{.DesktopMinVersion}}
Ios Latest Version: {{.IosLatestVersion}}
Ios Minimum Version: {{.IosMinVersion}}
Database Status: {{.database_status}}
Filestore Status: {{.filestore_status}}`, status)

	// Check health status and return non-zero exit code if any component is unhealthy
	if status["status"] != model.StatusOk {
		return fmt.Errorf("server status is unhealthy: %s", status["status"])
	}
	if dbStatus, ok := status["database_status"]; ok && dbStatus != model.StatusOk {
		return fmt.Errorf("database status is unhealthy: %s", dbStatus)
	}
	if filestoreStatus, ok := status["filestore_status"]; ok && filestoreStatus != model.StatusOk {
		return fmt.Errorf("filestore status is unhealthy: %s", filestoreStatus)
	}

	return nil
}

// systemSupportPacketWrapperF routes to either online (API) or offline (filesystem) mode
func systemSupportPacketWrapperF(cmd *cobra.Command, args []string) error {
	offline, _ := cmd.Flags().GetBool("offline")

	if offline {
		// Offline mode - collect from filesystem
		return systemSupportPacketOfflineCmdF(cmd, args)
	}

	// Online mode - use existing API-based collection
	// We need to wrap this with withClient since it needs a server connection
	return withClient(systemSupportPacketCmdF)(cmd, args)
}

// systemSupportPacketCmdF handles API-based support packet generation (existing behavior)
func systemSupportPacketCmdF(c client.Client, cmd *cobra.Command, _ []string) error {
	printer.SetSingle(true)

	filename, err := cmd.Flags().GetString("output-file")
	if err != nil {
		return err
	}

	printer.Print("Downloading Support Packet")

	data, rFilename, _, err := c.GenerateSupportPacket(context.TODO())
	if err != nil {
		return fmt.Errorf("unable to fetch Support Packet: %w", err)
	}

	if filename == "" {
		filename = rFilename
	}

	file, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create zip file: %w", err)
	}

	_, err = io.Copy(file, data)
	if err != nil {
		return fmt.Errorf("failed to write to zip file: %w", err)
	}

	printer.PrintT("Downloaded Support Packet to {{ .filename }}", map[string]string{"filename": filename})
	return nil
}

// systemSupportPacketOfflineCmdF handles filesystem-based support packet generation (new offline mode)
func systemSupportPacketOfflineCmdF(cmd *cobra.Command, _ []string) error {
	printer.SetSingle(true)

	// Parse flags
	mmDir, _ := cmd.Flags().GetString("directory")
	outputFile, _ := cmd.Flags().GetString("output-file")
	noObfuscate, _ := cmd.Flags().GetBool("no-obfuscate")
	obfuscate := !noObfuscate

	// Validate Mattermost directory
	if err := validateMattermostDirectory(mmDir); err != nil {
		return err
	}

	// Generate output path
	var outputPath string
	if outputFile != "" {
		// User specified output file
		outputPath = outputFile
	} else {
		// Generate default filename: support-packet_YYYYMMDD-HHMMSS.tar.gz
		timestamp := time.Now().UTC().Format("20060102-150405")
		outputPath = filepath.Join(".", fmt.Sprintf("support-packet_%s.tar.gz", timestamp))
	}

	// Create temp directory for collection
	tempDir, err := os.MkdirTemp("", "mmctl-supportpacket-*")
	if err != nil {
		return fmt.Errorf("failed to create temporary directory: %w", err)
	}

	tempDirForErrorMsg := tempDir
	defer func() {
		if err := os.RemoveAll(tempDir); err != nil {
			printer.PrintError(fmt.Sprintf("Warning: Failed to cleanup temporary directory: %s", tempDir))
		}
	}()

	printer.Print("Collecting diagnostics from filesystem...")

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

	if obfuscate {
		printer.Print("Collection complete. Obfuscation applied to config.json.")
	} else {
		printer.Print("Collection complete. No obfuscation applied (--no-obfuscate flag used).")
	}

	// Create archive
	if err := createTarGzArchive(tempDir, outputPath); err != nil {
		printer.PrintError(fmt.Sprintf("Archive creation failed. Collected files are in: %s", tempDirForErrorMsg))
		printer.PrintError("You can manually tar/zip this directory.")
		return fmt.Errorf("failed to create archive: %w", err)
	}

	printer.PrintT("Support packet created successfully: {{.Path}}", map[string]string{"Path": outputPath})
	return nil
}
