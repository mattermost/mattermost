// sharedchannel-test is an integration test tool that validates shared channel
// synchronization between two real Mattermost server instances.
//
// It can either manage the server lifecycle itself (build, start, stop) or
// connect to already-running instances.
//
// Usage:
//
//	go run . --license /path/to/license.mattermost-license
//	go run . --server-a http://already:9065 --server-b http://running:9066 --manage=false
//	go run . --license /path/to/license.mattermost-license --nodes 3
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"runtime"
	"syscall"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type Config struct {
	ServerAURL  string
	ServerBURL  string
	LicensePath string
	ServerDir   string
	Manage      bool
	AdminUser   string
	AdminPass   string
	Nodes       int
	NodeImage   string
}

func main() {
	cfg := Config{}

	flag.StringVar(&cfg.ServerAURL, "server-a", "http://localhost:9065", "Server A URL")
	flag.StringVar(&cfg.ServerBURL, "server-b", "http://localhost:9066", "Server B URL")
	flag.StringVar(&cfg.LicensePath, "license", "", "Path to enterprise license file (required)")
	flag.StringVar(&cfg.ServerDir, "server-dir", "", "Path to server directory (for managed mode)")
	flag.BoolVar(&cfg.Manage, "manage", true, "Manage server lifecycle (build/start/stop)")
	flag.StringVar(&cfg.AdminUser, "admin-user", "admin", "Admin username to create")
	flag.StringVar(&cfg.AdminPass, "admin-pass", "Admin1234567890", "Admin password")
	flag.IntVar(&cfg.Nodes, "nodes", 1, "Nodes per server; above 1 runs each server as an HA cluster of Docker containers (managed mode, Linux only)")
	flag.StringVar(&cfg.NodeImage, "node-image", "alpine:latest", "Container image for HA nodes (the server binary is mounted into it)")
	flag.Parse()

	if cfg.LicensePath == "" {
		fmt.Fprintln(os.Stderr, "error: --license is required")
		flag.Usage()
		os.Exit(1)
	}
	if err := validateHAConfig(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	logger, err := newLogger()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error creating logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Flush()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		logger.Info("Received signal, shutting down...")
		cancel()
	}()

	runner := NewTestRunner(cfg, logger)
	if err := runner.Run(ctx); err != nil {
		logger.Error("Test run failed", mlog.Err(err))
		logger.Flush()
		os.Exit(1)
	}
}

func validateHAConfig(cfg Config) error {
	if cfg.Nodes < 1 || cfg.Nodes > maxNodesPerSide {
		return fmt.Errorf("--nodes must be between 1 and %d", maxNodesPerSide)
	}
	if cfg.Nodes == 1 {
		return nil
	}
	if !cfg.Manage {
		return fmt.Errorf("--nodes > 1 requires managed mode")
	}
	if runtime.GOOS != "linux" {
		return fmt.Errorf("--nodes > 1 requires Linux (Docker host networking and the 127.0.0.0/8 loopback range)")
	}
	return nil
}

// newLogger creates an mlog.Logger with two console targets:
//   - stdout: info, warn, and debug (progress messages, PASS results)
//   - stderr: error, fatal, panic (FAIL results, fatal errors)
//
// Both use the plain formatter with color enabled so level names
// are visually distinct (cyan=info, yellow=warn, red=error).
func newLogger() (*mlog.Logger, error) {
	logger, err := mlog.NewLogger()
	if err != nil {
		return nil, err
	}

	formatOpts := json.RawMessage(`{"enable_color": true, "enable_caller": false}`)

	logCfg := mlog.LoggerConfiguration{
		"stdout": mlog.TargetCfg{
			Type:          "console",
			Format:        "plain",
			Levels:        []mlog.Level{mlog.LvlInfo, mlog.LvlWarn, mlog.LvlDebug},
			Options:       json.RawMessage(`{"out": "stdout"}`),
			FormatOptions: formatOpts,
			MaxQueueSize:  1000,
		},
		"stderr": mlog.TargetCfg{
			Type:          "console",
			Format:        "plain",
			Levels:        []mlog.Level{mlog.LvlError, mlog.LvlFatal, mlog.LvlPanic},
			Options:       json.RawMessage(`{"out": "stderr"}`),
			FormatOptions: formatOpts,
			MaxQueueSize:  1000,
		},
	}

	if err := logger.ConfigureTargets(logCfg, nil); err != nil {
		return nil, fmt.Errorf("configure log targets: %w", err)
	}

	return logger, nil
}
