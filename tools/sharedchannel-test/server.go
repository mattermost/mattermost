package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// ServerManager handles building, starting, and stopping Mattermost server instances.
type ServerManager struct {
	cfg    Config
	logger *mlog.Logger
	procA  *exec.Cmd
	procB  *exec.Cmd
	binary string
}

func NewServerManager(cfg Config, logger *mlog.Logger) *ServerManager {
	return &ServerManager{cfg: cfg, logger: logger}
}

// Setup builds the server binary, resets databases, and starts both instances.
func (sm *ServerManager) Setup(ctx context.Context) error {
	if err := sm.build(ctx); err != nil {
		return fmt.Errorf("build: %w", err)
	}
	if err := sm.resetDatabases(ctx); err != nil {
		return fmt.Errorf("reset databases: %w", err)
	}
	if err := sm.startServers(ctx); err != nil {
		return fmt.Errorf("start servers: %w", err)
	}
	return nil
}

// Teardown stops both server processes.
func (sm *ServerManager) Teardown() {
	sm.logger.Info("Stopping servers...")
	stopProc(sm.procA)
	stopProc(sm.procB)
}

// stopProc sends SIGINT and waits up to 10 seconds for graceful shutdown,
// then sends SIGKILL if the process is still running.
func stopProc(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}

	_ = cmd.Process.Signal(os.Interrupt)

	done := make(chan struct{})
	go func() {
		_ = cmd.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(10 * time.Second):
		_ = cmd.Process.Kill()
		<-done
	}
}

func (sm *ServerManager) build(ctx context.Context) error {
	sm.logger.Info("Building server binary with enterprise...")
	sm.binary = filepath.Join(sm.cfg.ServerDir, "bin", "mattermost")

	cmd := exec.CommandContext(ctx, "go", "build",
		"-tags", "enterprise",
		"-ldflags", `-X "github.com/mattermost/mattermost/server/public/model.BuildEnterpriseReady=true"`,
		"-o", sm.binary,
		"./cmd/mattermost",
	)
	cmd.Dir = sm.cfg.ServerDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("go build: %w", err)
	}
	sm.logger.Info("Binary built", mlog.String("path", sm.binary))
	return nil
}

func (sm *ServerManager) resetDatabases(ctx context.Context) error {
	sm.logger.Info("Resetting databases...")
	for _, db := range []string{"mattermost_test", "mattermost_node_test"} {
		for _, sql := range []string{
			fmt.Sprintf("DROP DATABASE IF EXISTS %s", db),
			fmt.Sprintf("CREATE DATABASE %s", db),
		} {
			cmd := exec.CommandContext(ctx, "docker", "exec",
				"-e", "PGPASSWORD=mostest",
				"mattermost-postgres",
				"psql", "-U", "mmuser", "-d", "postgres", "-c", sql,
			)
			if out, err := cmd.CombinedOutput(); err != nil {
				return fmt.Errorf("psql %q: %w\n%s", sql, err, out)
			}
		}
	}
	return nil
}

// commonEnv returns the environment variables shared by both server instances.
func (sm *ServerManager) commonEnv() []string {
	return []string{
		"MM_CONNECTEDWORKSPACESSETTINGS_ENABLESHAREDCHANNELS=true",
		"MM_CONNECTEDWORKSPACESSETTINGS_ENABLEREMOTECLUSTERSERVICE=true",
		"MM_FEATUREFLAGS_ENABLESHAREDCHANNELSMEMBERSYNC=true",
		"MM_SERVICESETTINGS_ENABLELOCALMODE=false",
		"MM_TEAMSETTINGS_ENABLEOPENSERVER=true",
		"MM_LOGSETTINGS_CONSOLELEVEL=ERROR",
		"MM_LOGSETTINGS_FILELEVEL=INFO",
		"MM_SQLSETTINGS_DRIVERNAME=postgres",
		// Both servers run on one host; the test does not exercise metrics. Disable it
		// so they don't collide on the metrics port (:8067) when the loaded config.json
		// happens to have metrics enabled.
		"MM_METRICSSETTINGS_ENABLE=false",
	}
}

func (sm *ServerManager) logsDir() string {
	return filepath.Join(sm.cfg.ServerDir, "logs")
}

// launchServerB starts (or restarts) the Server B process. When truncate is true the
// stdout log is reset (fresh tool run, matching Server A); when false it is opened in
// append mode so an in-run restart preserves the pre-restart output.
func (sm *ServerManager) launchServerB(logsDir string, truncate bool) error {
	sm.procB = exec.Command(sm.binary, "server")
	sm.procB.Dir = sm.cfg.ServerDir
	sm.procB.Env = append(os.Environ(), sm.commonEnv()...)
	sm.procB.Env = append(sm.procB.Env,
		"MM_SERVICESETTINGS_SITEURL="+sm.cfg.ServerBURL,
		"MM_SERVICESETTINGS_LISTENADDRESS=:9066",
		"MM_SQLSETTINGS_DATASOURCE=postgres://mmuser:mostest@localhost/mattermost_node_test?sslmode=disable&connect_timeout=10&binary_parameters=yes",
		"MM_LOGSETTINGS_FILELOCATION="+filepath.Join(logsDir, "server_b.log"),
	)
	flags := os.O_CREATE | os.O_WRONLY | os.O_APPEND
	if truncate {
		flags = os.O_CREATE | os.O_WRONLY | os.O_TRUNC
	}
	outB, err := os.OpenFile(filepath.Join(logsDir, "server_b_stdout.log"), flags, 0o644)
	if err != nil {
		return fmt.Errorf("create server B log file: %w", err)
	}
	sm.procB.Stdout = outB
	sm.procB.Stderr = outB
	if err := sm.procB.Start(); err != nil {
		return fmt.Errorf("start server B: %w", err)
	}
	return nil
}

func (sm *ServerManager) startServers(ctx context.Context) error {
	commonEnv := sm.commonEnv()

	logsDir := sm.logsDir()
	_ = os.MkdirAll(logsDir, 0o755)

	// Server A
	sm.logger.Info("Starting Server A", mlog.String("url", sm.cfg.ServerAURL))
	sm.procA = exec.Command(sm.binary, "server")
	sm.procA.Dir = sm.cfg.ServerDir
	sm.procA.Env = append(os.Environ(), commonEnv...)
	sm.procA.Env = append(sm.procA.Env,
		"MM_SERVICESETTINGS_SITEURL="+sm.cfg.ServerAURL,
		"MM_SERVICESETTINGS_LISTENADDRESS=:9065",
		"MM_SQLSETTINGS_DATASOURCE=postgres://mmuser:mostest@localhost/mattermost_test?sslmode=disable&connect_timeout=10&binary_parameters=yes",
		"MM_LOGSETTINGS_FILELOCATION="+filepath.Join(logsDir, "server_a.log"),
	)
	outA, err := os.Create(filepath.Join(logsDir, "server_a_stdout.log"))
	if err != nil {
		return fmt.Errorf("create server A log file: %w", err)
	}
	sm.procA.Stdout = outA
	sm.procA.Stderr = outA
	if err := sm.procA.Start(); err != nil {
		return fmt.Errorf("start server A: %w", err)
	}

	// Server B
	sm.logger.Info("Starting Server B", mlog.String("url", sm.cfg.ServerBURL))
	if err := sm.launchServerB(logsDir, true); err != nil {
		stopProc(sm.procA)
		return err
	}

	// Wait for both — stop started servers on failure
	if err := sm.waitForServer(ctx, sm.cfg.ServerAURL, "Server A"); err != nil {
		sm.Teardown()
		return err
	}
	if err := sm.waitForServer(ctx, sm.cfg.ServerBURL, "Server B"); err != nil {
		sm.Teardown()
		return err
	}
	return nil
}

// StopServerB gracefully stops the Server B process (SIGINT, then SIGKILL after a
// timeout). Used by the offline-recovery test to simulate a brief remote outage.
func (sm *ServerManager) StopServerB() {
	sm.logger.Info("Stopping Server B...")
	stopProc(sm.procB)
	sm.procB = nil
}

// StartServerB relaunches the Server B process and waits for it to become ready.
func (sm *ServerManager) StartServerB(ctx context.Context) error {
	sm.logger.Info("Restarting Server B", mlog.String("url", sm.cfg.ServerBURL))
	if err := sm.launchServerB(sm.logsDir(), false); err != nil {
		return err
	}
	return sm.waitForServer(ctx, sm.cfg.ServerBURL, "Server B")
}

func (sm *ServerManager) waitForServer(ctx context.Context, url, name string) error {
	client := model.NewAPIv4Client(url)
	deadline := time.After(2 * time.Minute)
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			return fmt.Errorf("%s did not become ready within 2 minutes", name)
		case <-ticker.C:
			_, _, err := client.GetPingWithServerStatus(ctx)
			if err == nil {
				sm.logger.Info("Server is ready", mlog.String("name", name))
				return nil
			}
		}
	}
}

// ProvisionAdmin creates an admin user on a server, promotes via DB, and returns an authenticated client.
func ProvisionAdmin(ctx context.Context, serverURL, dbName, username, email, password string) (*model.Client4, error) {
	client := model.NewAPIv4Client(serverURL)

	// Create user
	_, _, err := client.CreateUser(ctx, &model.User{
		Username: username,
		Email:    email,
		Password: password,
	})
	if err != nil {
		return nil, fmt.Errorf("create admin user: %w", err)
	}

	// Promote to system_admin via DB using parameterized query via stdin
	// (psql -v variable substitution is not supported with -c)
	cmd := exec.CommandContext(ctx, "docker", "exec",
		"-i",
		"-e", "PGPASSWORD=mostest",
		"mattermost-postgres",
		"psql", "-U", "mmuser", "-d", dbName,
		"-v", "uname="+username,
	)
	cmd.Stdin = strings.NewReader("UPDATE users SET roles='system_admin system_user' WHERE username=:'uname';")
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("promote admin: %w\n%s", err, out)
	}

	// Login
	_, _, err = client.Login(ctx, username, password)
	if err != nil {
		return nil, fmt.Errorf("login: %w", err)
	}

	return client, nil
}

// UploadLicense reads and uploads a license file to a server.
func UploadLicense(ctx context.Context, client *model.Client4, licensePath string) error {
	data, err := os.ReadFile(licensePath)
	if err != nil {
		return fmt.Errorf("read license file: %w", err)
	}
	_, err = client.UploadLicenseFile(ctx, data)
	if err != nil {
		return fmt.Errorf("upload license: %w", err)
	}
	return nil
}
