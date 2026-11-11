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
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"regexp"
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
	DBNameA     string
	DBNameB     string
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
	flag.StringVar(&cfg.DBNameA, "db-a", "", "Server A database; dropped and recreated in managed mode (default sharedchannel_test_a when managed, mattermost_test otherwise)")
	flag.StringVar(&cfg.DBNameB, "db-b", "", "Server B database; dropped and recreated in managed mode (default sharedchannel_test_b when managed, mattermost_node_test otherwise)")
	flag.Parse()

	// Managed mode drops and recreates its databases, so its defaults must not be
	// the ones make run-server and make run-node use.
	if cfg.DBNameA == "" {
		cfg.DBNameA = "mattermost_test"
		if cfg.Manage {
			cfg.DBNameA = "sharedchannel_test_a"
		}
	}
	if cfg.DBNameB == "" {
		cfg.DBNameB = "mattermost_node_test"
		if cfg.Manage {
			cfg.DBNameB = "sharedchannel_test_b"
		}
	}

	if err := validateDBNames(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if cfg.LicensePath == "" {
		fmt.Fprintln(os.Stderr, "error: --license is required")
		flag.Usage()
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

// Names are restricted so they are safe inside a quoted SQL identifier and
// need no escaping in a datasource URL.
var dbNamePattern = regexp.MustCompile(`^[a-z_][a-z0-9_]{0,62}$`)

func validateDBNames(cfg Config) error {
	for _, name := range []string{cfg.DBNameA, cfg.DBNameB} {
		if !dbNamePattern.MatchString(name) {
			return fmt.Errorf("invalid database name %q: use lower case letters, digits and underscores, starting with a letter or underscore", name)
		}
		if cfg.Manage && (name == "mattermost_test" || name == "mattermost_node_test") {
			return fmt.Errorf("refusing to use %q in managed mode: it is dropped and recreated, and make run-server/run-node use it", name)
		}
	}
	if cfg.DBNameA == cfg.DBNameB {
		return fmt.Errorf("--db-a and --db-b must differ, both are %q", cfg.DBNameA)
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
