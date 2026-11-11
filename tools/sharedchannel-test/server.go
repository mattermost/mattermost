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

const maxNodesPerSide = 9

// serverNode is one Mattermost process. In HA mode it runs in a container whose
// hostname is label, which the cluster also uses as the node's name.
type serverNode struct {
	label      string
	url        string
	listenPort int
	logBase    string
	clusterIP  string
	gossipPort int
	proc       *exec.Cmd
}

// serverSide is one of the two connected workspaces: a single server, or an HA
// cluster of nodes sharing one database behind a round-robin proxy.
type serverSide struct {
	name    string
	siteURL string
	dbName  string
	nodes   []*serverNode
	proxy   *roundRobinProxy
}

// ServerManager handles building, starting, and stopping Mattermost server instances.
type ServerManager struct {
	cfg       Config
	logger    *mlog.Logger
	binary    string
	serverDir string
	license   string
	sideA     *serverSide
	sideB     *serverSide
	// pluginDir holds a separate plugin and client plugin directory for each
	// server, so test plugins stay out of ServerDir and the servers don't share one.
	pluginDir string
}

func NewServerManager(cfg Config, logger *mlog.Logger) *ServerManager {
	return &ServerManager{
		cfg:    cfg,
		logger: logger,
		sideA:  newServerSide("A", cfg.ServerAURL, "mattermost_test", 9065, 1, cfg.Nodes),
		sideB:  newServerSide("B", cfg.ServerBURL, "mattermost_node_test", 9066, 2, cfg.Nodes),
	}
}

func newServerSide(name, siteURL, dbName string, singlePort, index, nodes int) *serverSide {
	lower := strings.ToLower(name)
	side := &serverSide{name: name, siteURL: siteURL, dbName: dbName}
	if nodes <= 1 {
		side.nodes = []*serverNode{{
			label:      "Server " + name,
			url:        siteURL,
			listenPort: singlePort,
			logBase:    "server_" + lower,
		}}
		return side
	}

	for i := 1; i <= nodes; i++ {
		port := 9060 + index*10 + i
		side.nodes = append(side.nodes, &serverNode{
			label:      fmt.Sprintf("sctest-%s%d", lower, i),
			url:        fmt.Sprintf("http://localhost:%d", port),
			listenPort: port,
			logBase:    fmt.Sprintf("server_%s%d", lower, i),
			clusterIP:  fmt.Sprintf("127.0.%d.%d", index, i),
			gossipPort: 8160 + index*10 + i,
		})
	}
	return side
}

func (sm *ServerManager) ha() bool {
	return sm.cfg.Nodes > 1
}

func (sm *ServerManager) sides() []*serverSide {
	return []*serverSide{sm.sideA, sm.sideB}
}

func (sm *ServerManager) NodesA() []*serverNode {
	return sm.sideA.nodes
}

func (sm *ServerManager) NodesB() []*serverNode {
	return sm.sideB.nodes
}

// Setup builds the server binary, resets databases, and starts both instances.
func (sm *ServerManager) Setup(ctx context.Context) error {
	var err error
	if sm.serverDir, err = filepath.Abs(sm.cfg.ServerDir); err != nil {
		return fmt.Errorf("resolve server dir: %w", err)
	}
	if sm.ha() {
		license, err := os.ReadFile(sm.cfg.LicensePath)
		if err != nil {
			return fmt.Errorf("read license file: %w", err)
		}
		sm.license = string(license)
	}

	if err := sm.build(ctx); err != nil {
		return fmt.Errorf("build: %w", err)
	}
	if err := sm.resetDatabases(ctx); err != nil {
		return fmt.Errorf("reset databases: %w", err)
	}
	if err := sm.makePluginDirs(); err != nil {
		return fmt.Errorf("plugin directories: %w", err)
	}
	if err := sm.startServers(ctx); err != nil {
		return fmt.Errorf("start servers: %w", err)
	}
	return nil
}

// Teardown stops every server process and proxy.
func (sm *ServerManager) Teardown() {
	sm.logger.Info("Stopping servers...")
	for _, side := range sm.sides() {
		for _, n := range side.nodes {
			sm.stopNode(side, n, false)
		}
		if side.proxy != nil {
			side.proxy.Close()
			side.proxy = nil
		}
	}
	if sm.pluginDir != "" {
		_ = os.RemoveAll(sm.pluginDir)
	}
}

func (sm *ServerManager) makePluginDirs() error {
	dir, err := os.MkdirTemp("", "sharedchannel-test-plugins-")
	if err != nil {
		return err
	}
	sm.pluginDir = dir
	for _, server := range []string{"a", "b"} {
		for _, sub := range []string{"plugins", "client"} {
			if err := os.MkdirAll(filepath.Join(dir, server, sub), 0o755); err != nil {
				return err
			}
		}
	}
	return nil
}

// pluginEnv points one server ("a" or "b") at its own plugin directories.
func (sm *ServerManager) pluginEnv(server string) []string {
	return []string{
		"MM_PLUGINSETTINGS_DIRECTORY=" + filepath.Join(sm.pluginDir, server, "plugins"),
		"MM_PLUGINSETTINGS_CLIENTDIRECTORY=" + filepath.Join(sm.pluginDir, server, "client"),
	}
}

// stopProc sends SIGINT and waits up to 10 seconds for graceful shutdown,
// then sends SIGKILL if the process is still running.
func stopProc(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	_ = cmd.Process.Signal(os.Interrupt)
	waitOrKill(cmd, 10*time.Second)
}

func waitOrKill(cmd *exec.Cmd, timeout time.Duration) {
	done := make(chan struct{})
	go func() {
		_ = cmd.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(timeout):
		_ = cmd.Process.Kill()
		<-done
	}
}

func (sm *ServerManager) build(ctx context.Context) error {
	sm.logger.Info("Building server binary with enterprise...")
	sm.binary = filepath.Join(sm.serverDir, "bin", "mattermost")

	cmd := exec.CommandContext(ctx, "go", "build",
		"-tags", "enterprise",
		"-ldflags", `-X "github.com/mattermost/mattermost/server/public/model.BuildEnterpriseReady=true"`,
		"-o", sm.binary,
		"./cmd/mattermost",
	)
	cmd.Dir = sm.serverDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if sm.ha() {
		// HA nodes run in a minimal container image, so the binary can't link the host's libc.
		cmd.Env = append(os.Environ(), "CGO_ENABLED=0")
	}

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("go build: %w", err)
	}
	sm.logger.Info("Binary built", mlog.String("path", sm.binary))
	return nil
}

func (sm *ServerManager) resetDatabases(ctx context.Context) error {
	sm.logger.Info("Resetting databases...")
	for _, side := range sm.sides() {
		for _, sql := range []string{
			fmt.Sprintf("DROP DATABASE IF EXISTS %s", side.dbName),
			fmt.Sprintf("CREATE DATABASE %s", side.dbName),
		} {
			cmd := exec.CommandContext(ctx, "docker", "exec",
				"-e", "PGPASSWORD=mostest_password",
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

// commonEnv returns the environment variables shared by every server instance.
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
		// The cursor rewind test uploads a small unsigned plugin.
		"MM_PLUGINSETTINGS_ENABLE=true",
		"MM_PLUGINSETTINGS_ENABLEUPLOADS=true",
		"MM_PLUGINSETTINGS_REQUIREPLUGINSIGNATURE=false",
		// The catch-up and rewind tests write more posts than one batch holds, so
		// they cover sync continuing across batches.
		"MM_CONNECTEDWORKSPACESSETTINGS_MAXPOSTSPERSYNC=50",
		// Post reads leave out acknowledgements when post priority is off.
		"MM_SERVICESETTINGS_POSTPRIORITY=true",
	}
}

func (sm *ServerManager) nodeEnv(side *serverSide, n *serverNode) []string {
	env := []string{
		"MM_SERVICESETTINGS_SITEURL=" + side.siteURL,
		fmt.Sprintf("MM_SERVICESETTINGS_LISTENADDRESS=:%d", n.listenPort),
		"MM_SQLSETTINGS_DATASOURCE=postgres://mmuser:mostest_password@localhost/" + side.dbName + "?sslmode=disable&connect_timeout=10&binary_parameters=yes",
		"MM_LOGSETTINGS_FILELOCATION=" + filepath.Join(sm.logsDir(), n.logBase+".log"),
	}
	if !sm.ha() {
		return append(env, sm.pluginEnv(strings.ToLower(side.name))...)
	}

	return append(env,
		// The cluster only starts if the license is present at boot.
		"MM_LICENSE="+sm.license,
		"MM_CLUSTERSETTINGS_ENABLE=true",
		"MM_CLUSTERSETTINGS_CLUSTERNAME=sctest-"+strings.ToLower(side.name),
		// Nodes share the host network, and cluster discovery treats nodes with the same
		// hostname as one node, so each node gets its own loopback address.
		"MM_CLUSTERSETTINGS_OVERRIDEHOSTNAME="+n.clusterIP,
		"MM_CLUSTERSETTINGS_BINDADDRESS="+n.clusterIP,
		"MM_CLUSTERSETTINGS_ADVERTISEADDRESS="+n.clusterIP,
		fmt.Sprintf("MM_CLUSTERSETTINGS_GOSSIPPORT=%d", n.gossipPort),
		// Every node runs from the same server directory, so their plugin extraction would collide.
		"MM_PLUGINSETTINGS_ENABLE=false",
	)
}

func (sm *ServerManager) logsDir() string {
	return filepath.Join(sm.serverDir, "logs")
}

// launchNode starts (or restarts) one node. When truncate is true the stdout log is
// reset (fresh tool run); when false it is opened in append mode so an in-run restart
// preserves the pre-restart output.
func (sm *ServerManager) launchNode(side *serverSide, n *serverNode, truncate bool) error {
	env := append(sm.commonEnv(), sm.nodeEnv(side, n)...)

	var cmd *exec.Cmd
	if sm.ha() {
		cmd = sm.containerCmd(n, env)
	} else {
		cmd = exec.Command(sm.binary, "server")
		cmd.Dir = sm.serverDir
		cmd.Env = append(os.Environ(), env...)
	}

	flags := os.O_CREATE | os.O_WRONLY | os.O_APPEND
	if truncate {
		flags = os.O_CREATE | os.O_WRONLY | os.O_TRUNC
	}
	out, err := os.OpenFile(filepath.Join(sm.logsDir(), n.logBase+"_stdout.log"), flags, 0o644)
	if err != nil {
		return fmt.Errorf("create %s log file: %w", n.label, err)
	}
	defer func() { _ = out.Close() }()
	cmd.Stdout = out
	cmd.Stderr = out

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start %s: %w", n.label, err)
	}
	n.proc = cmd
	return nil
}

// containerCmd runs the node in its own container so it gets its own hostname, which
// the cluster uses as the node name. Host networking keeps every port reachable as on
// the host, and the repo root is mounted at the same path so relative paths and the
// server's symlinks (such as client) still resolve.
func (sm *ServerManager) containerCmd(n *serverNode, env []string) *exec.Cmd {
	_ = exec.Command("docker", "rm", "-f", n.label).Run()

	repoRoot := filepath.Dir(sm.serverDir)
	args := []string{
		"run", "--rm",
		"--name", n.label,
		"--hostname", n.label,
		"--network", "host",
		"--user", fmt.Sprintf("%d:%d", os.Getuid(), os.Getgid()),
		"-v", repoRoot + ":" + repoRoot,
		"-w", sm.serverDir,
		"-e", "HOME=/tmp",
	}

	// Pass variables by name only, so values such as MM_LICENSE come from the docker
	// CLI's environment instead of showing up in the process list.
	seen := map[string]bool{}
	for _, kv := range append(os.Environ(), env...) {
		key, _, _ := strings.Cut(kv, "=")
		if strings.HasPrefix(key, "MM_") && !seen[key] {
			seen[key] = true
			args = append(args, "-e", key)
		}
	}
	args = append(args, sm.cfg.NodeImage, sm.binary, "server")

	cmd := exec.Command("docker", args...)
	cmd.Env = append(os.Environ(), env...)
	return cmd
}

// stopNode stops one node. kill sends SIGKILL to simulate a crash; otherwise the
// node gets a graceful shutdown.
func (sm *ServerManager) stopNode(side *serverSide, n *serverNode, kill bool) {
	if side.proxy != nil {
		side.proxy.setUp(n.url, false)
	}
	if n.proc == nil {
		return
	}

	switch {
	case sm.ha() && kill:
		_ = exec.Command("docker", "kill", n.label).Run()
		waitOrKill(n.proc, 30*time.Second)
	case sm.ha():
		_ = exec.Command("docker", "stop", "-t", "10", n.label).Run()
		waitOrKill(n.proc, 30*time.Second)
	case kill:
		_ = n.proc.Process.Kill()
		waitOrKill(n.proc, 10*time.Second)
	default:
		stopProc(n.proc)
	}
	n.proc = nil
}

func (sm *ServerManager) waitForNode(ctx context.Context, side *serverSide, n *serverNode) error {
	if err := sm.waitForServer(ctx, n.url, n.label); err != nil {
		return err
	}
	if side.proxy != nil {
		side.proxy.setUp(n.url, true)
	}
	return nil
}

func (sm *ServerManager) startServers(ctx context.Context) error {
	_ = os.MkdirAll(sm.logsDir(), 0o755)

	if sm.ha() {
		for _, side := range sm.sides() {
			var urls []string
			for _, n := range side.nodes {
				urls = append(urls, n.url)
			}
			proxy, err := startRoundRobinProxy(sm.logger, side.siteURL, urls)
			if err != nil {
				sm.Teardown()
				return fmt.Errorf("start Server %s proxy: %w", side.name, err)
			}
			side.proxy = proxy
			sm.logger.Info("Started proxy", mlog.String("server", side.name), mlog.String("url", side.siteURL))
		}
	}

	// Nodes migrating a fresh database at the same time collide, so the first node of
	// each side finishes migrating before the rest start.
	if err := sm.startNodes(ctx, func(i int) bool { return i == 0 }); err != nil {
		return err
	}
	return sm.startNodes(ctx, func(i int) bool { return i > 0 })
}

// startNodes launches the nodes whose index matches, then waits for them; on failure
// it stops everything started so far.
func (sm *ServerManager) startNodes(ctx context.Context, match func(i int) bool) error {
	for _, side := range sm.sides() {
		for i, n := range side.nodes {
			if !match(i) {
				continue
			}
			sm.logger.Info("Starting "+n.label, mlog.String("url", n.url))
			if err := sm.launchNode(side, n, true); err != nil {
				sm.Teardown()
				return err
			}
		}
	}

	for _, side := range sm.sides() {
		for i, n := range side.nodes {
			if !match(i) {
				continue
			}
			if err := sm.waitForNode(ctx, side, n); err != nil {
				sm.Teardown()
				return err
			}
		}
	}
	return nil
}

// StopServerB gracefully stops every Server B node (SIGINT, then SIGKILL after a
// timeout). Used by the offline-recovery test to simulate a brief remote outage.
func (sm *ServerManager) StopServerB() {
	sm.logger.Info("Stopping Server B...")
	for _, n := range sm.sideB.nodes {
		sm.stopNode(sm.sideB, n, false)
	}
}

// StartServerB relaunches every Server B node and waits for them to become ready.
func (sm *ServerManager) StartServerB(ctx context.Context) error {
	sm.logger.Info("Restarting Server B", mlog.String("url", sm.cfg.ServerBURL))
	for _, n := range sm.sideB.nodes {
		if err := sm.launchNode(sm.sideB, n, false); err != nil {
			return err
		}
	}
	for _, n := range sm.sideB.nodes {
		if err := sm.waitForNode(ctx, sm.sideB, n); err != nil {
			return err
		}
	}
	return nil
}

func (sm *ServerManager) findNode(label string) (*serverSide, *serverNode, error) {
	for _, side := range sm.sides() {
		for _, n := range side.nodes {
			if n.label == label {
				return side, n, nil
			}
		}
	}
	return nil, nil, fmt.Errorf("no node named %q", label)
}

// CrashNode SIGKILLs one node, giving its cluster no chance to hand off work.
func (sm *ServerManager) CrashNode(label string) error {
	side, n, err := sm.findNode(label)
	if err != nil {
		return err
	}
	sm.logger.Info("Crashing node", mlog.String("node", label))
	sm.stopNode(side, n, true)
	return nil
}

func (sm *ServerManager) RestartNode(ctx context.Context, label string) error {
	side, n, err := sm.findNode(label)
	if err != nil {
		return err
	}
	sm.logger.Info("Restarting node", mlog.String("node", label))
	if err := sm.launchNode(side, n, false); err != nil {
		return err
	}
	return sm.waitForNode(ctx, side, n)
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
		"-e", "PGPASSWORD=mostest_password",
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
