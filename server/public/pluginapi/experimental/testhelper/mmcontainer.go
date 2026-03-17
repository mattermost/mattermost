// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package testhelper

import (
	"context"
	"fmt"
	"io"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/network"
	"github.com/testcontainers/testcontainers-go/wait"
)

const (
	defaultMMImage = "mattermost/mattermost-enterprise-edition:latest"

	pgUser     = "mmuser"
	pgPassword = "mostest"
	pgDBName   = "mattermost_test"

	adminEmail    = "admin@example.com"
	adminUsername = "admin"
	adminPassword = "Password1!"
)

// mmContainers holds references to the running test containers.
type mmContainers struct {
	pgContainer   *postgres.PostgresContainer
	mmContainer   testcontainers.Container
	dockerNetwork *testcontainers.DockerNetwork
	serverURL     string
}

var (
	sharedContainers *mmContainers
	containersOnce   sync.Once
	containersErr    error
)

func getMMImage() string {
	if img := os.Getenv("MM_TEST_IMAGE"); img != "" {
		return img
	}
	return defaultMMImage
}

// ensureContainers starts Postgres and Mattermost containers once per test binary invocation.
// Subsequent calls return the cached containers. If Docker is unavailable, returns an error
// that callers should use with t.Skip().
func ensureContainers(t *testing.T) (*mmContainers, error) {
	t.Helper()

	containersOnce.Do(func() {
		ctx := context.Background()

		// Create a Docker network so Mattermost can reach Postgres by hostname.
		nw, err := network.New(ctx)
		if err != nil {
			containersErr = fmt.Errorf("docker not available or failed to create network: %w", err)
			return
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
			containersErr = fmt.Errorf("failed to start Postgres container: %w", err)
			return
		}

		dsn := fmt.Sprintf("postgres://%s:%s@postgres:5432/%s?sslmode=disable",
			pgUser, pgPassword, pgDBName)

		// Start Mattermost.
		mmC, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
			ContainerRequest: testcontainers.ContainerRequest{
				Image:        getMMImage(),
				ExposedPorts: []string{"8065/tcp"},
				Env: map[string]string{
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
				},
				Networks: []string{nw.Name},
				WaitingFor: wait.ForHTTP("/api/v4/system/ping").
					WithPort("8065/tcp").
					WithStartupTimeout(120 * time.Second),
			},
			Started: true,
		})
		if err != nil {
			_ = pgC.Terminate(ctx)
			containersErr = fmt.Errorf("failed to start Mattermost container: %w", err)
			return
		}

		host, err := mmC.Host(ctx)
		if err != nil {
			_ = mmC.Terminate(ctx)
			_ = pgC.Terminate(ctx)
			containersErr = fmt.Errorf("failed to get container host: %w", err)
			return
		}

		port, err := mmC.MappedPort(ctx, "8065/tcp")
		if err != nil {
			_ = mmC.Terminate(ctx)
			_ = pgC.Terminate(ctx)
			containersErr = fmt.Errorf("failed to get mapped port: %w", err)
			return
		}

		serverURL := fmt.Sprintf("http://%s:%s", host, port.Port())

		// Create the initial admin user via mmctl inside the container.
		// The --local flag uses the Unix socket, bypassing auth (necessary when no users exist).
		if err := execInContainer(ctx, mmC,
			"mmctl", "--local", "user", "create",
			"--email", adminEmail,
			"--username", adminUsername,
			"--password", adminPassword,
			"--system-admin",
			"--email-verified",
		); err != nil {
			_ = mmC.Terminate(ctx)
			_ = pgC.Terminate(ctx)
			containersErr = fmt.Errorf("failed to create admin user: %w", err)
			return
		}

		sharedContainers = &mmContainers{
			pgContainer:   pgC,
			mmContainer:   mmC,
			dockerNetwork: nw,
			serverURL:     serverURL,
		}
	})

	if containersErr != nil {
		return nil, containersErr
	}

	// Container cleanup is handled by the testcontainers-go Ryuk reaper, which
	// automatically removes containers when the test process exits. We do NOT
	// use t.Cleanup here because these containers are shared across all tests
	// via sync.Once — terminating them after the first test would break the rest.

	return sharedContainers, nil
}

// resetDatabase truncates all data tables (preserving migrations) by running
// `mattermost db reset --confirm`, then restarts the Mattermost container so the
// server re-runs doAppMigrations() on startup — which re-creates all default roles
// and permissions. Finally, it re-creates the admin user.
func resetDatabase(ctx context.Context, c *mmContainers) error {
	if err := execInContainer(ctx, c.mmContainer,
		"mattermost", "db", "reset", "--confirm",
	); err != nil {
		return fmt.Errorf("database reset failed: %w", err)
	}

	// Restart the container so the server re-initializes default roles/permissions.
	// The Roles and Systems tables were truncated, so doAppMigrations() will detect
	// missing completion markers and re-run all permission migrations.
	stopTimeout := 10 * time.Second
	if err := c.mmContainer.Stop(ctx, &stopTimeout); err != nil {
		return fmt.Errorf("failed to stop container after reset: %w", err)
	}
	// Start re-runs the container's wait strategy, so the server is ready when it returns.
	if err := c.mmContainer.Start(ctx); err != nil {
		return fmt.Errorf("failed to start container after reset: %w", err)
	}

	// Docker may reassign the host port after stop/start, so refresh the server URL.
	host, err := c.mmContainer.Host(ctx)
	if err != nil {
		return fmt.Errorf("failed to get host after restart: %w", err)
	}
	port, err := c.mmContainer.MappedPort(ctx, "8065/tcp")
	if err != nil {
		return fmt.Errorf("failed to get mapped port after restart: %w", err)
	}
	c.serverURL = fmt.Sprintf("http://%s:%s", host, port.Port())

	// Re-create the admin user since the Users table was truncated.
	if err := execInContainer(ctx, c.mmContainer,
		"mmctl", "--local", "user", "create",
		"--email", adminEmail,
		"--username", adminUsername,
		"--password", adminPassword,
		"--system-admin",
		"--email-verified",
	); err != nil {
		return fmt.Errorf("failed to re-create admin user after reset: %w", err)
	}

	return nil
}

// execInContainer runs a command inside a container and returns an error if it fails.
func execInContainer(ctx context.Context, c testcontainers.Container, cmd ...string) error {
	exitCode, reader, err := c.Exec(ctx, cmd)
	if err != nil {
		return fmt.Errorf("exec %v: %w", cmd, err)
	}
	if exitCode != 0 {
		output, _ := io.ReadAll(reader)
		return fmt.Errorf("command %v exited %d: %s", cmd, exitCode, string(output))
	}
	return nil
}
