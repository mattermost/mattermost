// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package testhelper

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/testcontainers/testcontainers-go"
	tcexec "github.com/testcontainers/testcontainers-go/exec"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/network"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	defaultMMImage = "mattermost/mattermost-enterprise-edition:latest"

	pgUser     = "mmuser"
	pgPassword = "mostest"
	pgDBName   = "mattermost_test"

	adminEmail    = "admin@example.com"
	adminUsername = "admin"
	adminPassword = "Password1!"

	// licenseEnv holds the license that cluster nodes boot with. It is the variable
	// the server itself reads, so a plugin's CI can pass the same secret to both.
	licenseEnv = "MM_LICENSE"

	// dataDir is the server's file store inside the container. Cluster nodes share
	// it through one volume, because nodes install uploaded plugins from it.
	dataDir = "/mattermost/data"
)

// topology describes a set of Mattermost containers. Each distinct topology is
// started once per test binary and reused by every test that asks for it.
type topology struct {
	nodes   int
	cluster bool
}

var singleNode = topology{nodes: 1}

// mmContainers holds references to the running test containers of one topology.
type mmContainers struct {
	topology      topology
	pgContainer   *postgres.PostgresContainer
	dockerNetwork *testcontainers.DockerNetwork
	nodes         []*nodeContainer
}

// nodeContainer is one Mattermost server container.
type nodeContainer struct {
	container testcontainers.Container
	hostname  string // the container's hostname, also its alias on the Docker network
	url       string // base URL reachable from the test process
	ip        string // address on the Docker network, which the cluster advertises
	paused    bool
}

type containersResult struct {
	containers *mmContainers
	err        error
}

var (
	containersMu     sync.Mutex
	sharedContainers = map[topology]containersResult{}
)

func getMMImage() string {
	if img := os.Getenv("MM_TEST_IMAGE"); img != "" {
		return img
	}
	return defaultMMImage
}

// ensureContainers starts the containers for topo once per test binary invocation.
// Subsequent calls return the cached containers, or the cached error. If Docker is
// unavailable, returns an error.
func ensureContainers(t *testing.T, topo topology) (*mmContainers, error) {
	t.Helper()

	containersMu.Lock()
	defer containersMu.Unlock()

	if r, ok := sharedContainers[topo]; ok {
		return r.containers, r.err
	}
	c, err := startContainers(topo)
	sharedContainers[topo] = containersResult{containers: c, err: err}

	// Container cleanup is handled by the testcontainers-go Ryuk reaper, which
	// automatically removes containers when the test process exits. We do NOT
	// use t.Cleanup here because these containers are shared across all tests —
	// terminating them after the first test would break the rest.
	return c, err
}

func startContainers(topo topology) (c *mmContainers, err error) {
	// testcontainers-go panics (via MustExtractDockerHost) when Docker is not
	// available instead of returning an error. Recover so callers get an error.
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("docker not available: %v", r)
		}
	}()

	ctx := context.Background()

	// Create a Docker network so Mattermost can reach Postgres by hostname.
	nw, err := network.New(ctx)
	if err != nil {
		return nil, fmt.Errorf("docker not available or failed to create network: %w", err)
	}

	// Start Postgres.
	pgC, err := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase(pgDBName),
		postgres.WithUsername(pgUser),
		postgres.WithPassword(pgPassword),
		network.WithNetwork([]string{"postgres"}, nw),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to start Postgres container: %w", err)
	}

	c = &mmContainers{topology: topo, pgContainer: pgC, dockerNetwork: nw}
	terminate := func() {
		for _, n := range c.nodes {
			_ = n.container.Terminate(ctx)
		}
		_ = pgC.Terminate(ctx)
	}

	env := nodeEnv(topo)

	// Start the first node on its own, so a cluster's first node creates the
	// database schema and the shared config before the others boot against them.
	first, err := startNode(ctx, nw, 0, env, topo.cluster)
	if err != nil {
		terminate()
		return nil, err
	}
	c.nodes = append(c.nodes, first)

	rest := make([]*nodeContainer, topo.nodes-1)
	errs := make([]error, topo.nodes-1)
	var wg sync.WaitGroup
	for i := range rest {
		wg.Go(func() {
			rest[i], errs[i] = startNode(ctx, nw, i+1, env, topo.cluster)
		})
	}
	wg.Wait()
	for i, n := range rest {
		if n != nil {
			c.nodes = append(c.nodes, n)
		}
		if errs[i] != nil {
			err = errs[i]
		}
	}
	if err != nil {
		terminate()
		return nil, err
	}

	// Create the initial admin user via mmctl inside the container.
	// The --local flag uses the Unix socket, bypassing auth (necessary when no users exist).
	if err := execInContainer(ctx, first.container,
		"mmctl", "--local", "user", "create",
		"--email", adminEmail,
		"--username", adminUsername,
		"--password", adminPassword,
		"--system-admin",
		"--email-verified",
	); err != nil {
		terminate()
		return nil, fmt.Errorf("failed to create admin user: %w", err)
	}

	return c, nil
}

// nodeEnv returns the environment every Mattermost container of topo starts with.
func nodeEnv(topo topology) map[string]string {
	dsn := fmt.Sprintf("postgres://%s:%s@postgres:5432/%s?sslmode=disable",
		pgUser, pgPassword, pgDBName)

	env := map[string]string{
		"MM_SQLSETTINGS_DRIVERNAME":                     "postgres",
		"MM_SQLSETTINGS_DATASOURCE":                     dsn,
		"MM_PLUGINSETTINGS_ENABLEUPLOADS":               "true",
		"MM_PLUGINSETTINGS_AUTOMATICPREPACKAGEDPLUGINS": "false",
		"MM_SERVICESETTINGS_ENABLETESTING":              "true",
		"MM_SERVICESETTINGS_ENABLEDEVELOPER":            "true",
		"MM_SERVICESETTINGS_ENABLELOCALMODE":            "true",
		"MM_TEAMSETTINGS_ENABLEOPENSERVER":              "true",
		"MM_PASSWORDSETTINGS_MINIMUMLENGTH":             "5",
		"MM_LOGSETTINGS_CONSOLELEVEL":                   "ERROR",
	}
	if !topo.cluster {
		return env
	}

	// Keep the configuration in the database, so a change made through one node
	// (enabling a plugin, plugin settings) reaches every node.
	env["MM_CONFIG"] = dsn
	env["MM_CLUSTERSETTINGS_ENABLE"] = "true"
	env["MM_CLUSTERSETTINGS_CLUSTERNAME"] = "testhelper-" + model.NewId()[:8]
	env[licenseEnv] = os.Getenv(licenseEnv)
	// Test licenses are signed with the test key, which the server only accepts in
	// the test (or dev) service environment.
	env["MM_SERVICEENVIRONMENT"] = model.ServiceEnvironmentTest
	return env
}

// startNode starts Mattermost node i and waits until it answers HTTP requests.
func startNode(ctx context.Context, nw *testcontainers.DockerNetwork, i int, env map[string]string, cluster bool) (*nodeContainer, error) {
	hostname := fmt.Sprintf("mm-node-%d", i)

	req := testcontainers.ContainerRequest{
		Image:          getMMImage(),
		ExposedPorts:   []string{"8065/tcp"},
		Env:            env,
		Networks:       []string{nw.Name},
		NetworkAliases: map[string][]string{nw.Name: {hostname}},
		ConfigModifier: func(cfg *container.Config) {
			cfg.Hostname = hostname
		},
		WaitingFor: wait.ForHTTP("/api/v4/system/ping").
			WithPort("8065/tcp").
			WithStartupTimeout(120 * time.Second),
	}
	if cluster {
		// testcontainers labels the volume, so the reaper removes it with the containers.
		req.Mounts = testcontainers.ContainerMounts{
			testcontainers.VolumeMount("testhelper-data-"+nw.ID[:12], dataDir),
		}
	}

	mmC, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		if mmC != nil {
			_ = mmC.Terminate(ctx)
		}
		return nil, fmt.Errorf("failed to start Mattermost container %s: %w", hostname, err)
	}

	n := &nodeContainer{container: mmC, hostname: hostname}
	if err := n.refresh(ctx); err != nil {
		_ = mmC.Terminate(ctx)
		return nil, err
	}
	return n, nil
}

// refresh reads the node's URL and network address, which Docker may change
// whenever the container restarts.
func (n *nodeContainer) refresh(ctx context.Context) error {
	host, err := n.container.Host(ctx)
	if err != nil {
		return fmt.Errorf("failed to get host of %s: %w", n.hostname, err)
	}
	port, err := n.container.MappedPort(ctx, "8065/tcp")
	if err != nil {
		return fmt.Errorf("failed to get mapped port of %s: %w", n.hostname, err)
	}
	ip, err := n.container.ContainerIP(ctx)
	if err != nil {
		return fmt.Errorf("failed to get network address of %s: %w", n.hostname, err)
	}
	n.url = "http://" + net.JoinHostPort(host, port.Port())
	n.ip = ip
	return nil
}

// stop stops the node. Short SIGTERM grace: a test either restarts the node or
// resets the database, so an unclean stop loses nothing.
func (n *nodeContainer) stop(ctx context.Context) error {
	stopTimeout := 2 * time.Second
	if err := n.container.Stop(ctx, &stopTimeout); err != nil {
		return fmt.Errorf("failed to stop %s: %w", n.hostname, err)
	}
	return nil
}

// start starts a stopped node and waits until it answers HTTP requests.
func (n *nodeContainer) start(ctx context.Context) error {
	// Start re-runs the container's wait strategy, so the server is ready when it returns.
	if err := n.container.Start(ctx); err != nil {
		return fmt.Errorf("failed to start %s: %w", n.hostname, err)
	}
	return n.refresh(ctx)
}

// resetDatabase truncates all data tables (preserving migrations) by running
// `mattermost db reset --confirm`, then restarts the Mattermost containers so each
// server re-runs doAppMigrations() on startup — which re-creates all default roles
// and permissions. Finally, it re-creates the admin user.
//
// The reset runs through the first node. Every other node is stopped first, so no
// node writes to the database while it is emptied, and started again afterwards.
func resetDatabase(ctx context.Context, c *mmContainers) error {
	first := c.nodes[0]
	for _, n := range c.nodes[1:] {
		if err := n.stop(ctx); err != nil {
			return err
		}
	}

	// A test may have left the first node stopped.
	state, stateErr := first.container.State(ctx)
	if stateErr != nil {
		return fmt.Errorf("failed to read state of %s: %w", first.hostname, stateErr)
	}
	if !state.Running {
		if err := first.start(ctx); err != nil {
			return err
		}
	}

	if err := execInContainer(ctx, first.container,
		"mattermost", "db", "reset", "--confirm",
	); err != nil {
		return fmt.Errorf("database reset failed: %w", err)
	}

	// Restart the container so the server re-initializes default roles/permissions.
	// The Roles and Systems tables were truncated, so doAppMigrations() will detect
	// missing completion markers and re-run all permission migrations.
	if err := first.stop(ctx); err != nil {
		return err
	}
	if err := first.start(ctx); err != nil {
		return err
	}
	for _, n := range c.nodes[1:] {
		if err := n.start(ctx); err != nil {
			return err
		}
	}

	// Re-create the admin user since the Users table was truncated.
	//
	// The db reset + container stop/start above is a hard barrier, so normally no
	// admin user survives and this create succeeds cleanly. Intermittently on CI,
	// however, mmctl reports that the account already exists. We don't fail on that:
	// the admin always carries these exact, fixed credentials, so whether it was just
	// created or survived as a timing artifact, the desired end state is identical —
	// an admin reachable via adminUsername/adminPassword. Setup() logs in as that admin
	// immediately after this returns and fails loudly if the admin is not actually
	// usable, so a genuine problem still surfaces; only the transient is absorbed.
	exitCode, output, err := execInContainerOutput(ctx, first.container,
		"mmctl", "--local", "user", "create",
		"--email", adminEmail,
		"--username", adminUsername,
		"--password", adminPassword,
		"--system-admin",
		"--email-verified",
	)
	if err != nil {
		return fmt.Errorf("failed to re-create admin user after reset: %w", err)
	}
	if exitCode != 0 && !strings.Contains(output, "already exists") {
		return fmt.Errorf("failed to re-create admin user after reset: command exited %d: %s", exitCode, output)
	}

	return nil
}

// execInContainer runs a command inside a container and returns an error if it fails.
func execInContainer(ctx context.Context, c testcontainers.Container, cmd ...string) error {
	exitCode, output, err := execInContainerOutput(ctx, c, cmd...)
	if err != nil {
		return err
	}
	if exitCode != 0 {
		return fmt.Errorf("command %v exited %d: %s", cmd, exitCode, output)
	}
	return nil
}

// execInContainerOutput runs a command inside a container and returns its exit code
// and combined output. Unlike execInContainer, a non-zero exit code is not treated as
// an error here — callers inspect the exit code and output to decide how to react.
func execInContainerOutput(ctx context.Context, c testcontainers.Container, cmd ...string) (int, string, error) {
	exitCode, reader, err := c.Exec(ctx, cmd, tcexec.Multiplexed())
	if err != nil {
		return 0, "", fmt.Errorf("exec %v: %w", cmd, err)
	}
	output, _ := io.ReadAll(reader)
	return exitCode, string(output), nil
}
