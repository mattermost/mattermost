// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package testhelper

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

// TestHelper provides a configured Mattermost server with the plugin deployed,
// along with convenience methods for creating test data.
type TestHelper struct {
	t *testing.T

	// ServerURL is the base URL of the running Mattermost server (e.g. http://localhost:12345).
	ServerURL string

	// AdminClient is an authenticated API client with system admin privileges.
	AdminClient *model.Client4

	// AdminUser is the system admin user.
	AdminUser *model.User

	// Client is an authenticated API client for a regular test user.
	Client *model.Client4

	// User is a regular user created for this test, already a member of Team.
	User *model.User

	// Team is a team created for this test.
	Team *model.Team

	// Channel is an open channel created in Team for this test.
	Channel *model.Channel
}

// Static plugin metadata, cached via sync.Once (never changes between tests).
var (
	pluginID       string
	pluginBundle   string
	pluginMetaOnce sync.Once
	pluginMetaErr  error
)

// PluginID returns the plugin ID read from plugin.json.
// Only valid after Setup() has been called at least once.
func PluginID() string {
	return pluginID
}

func ensurePluginMeta() error {
	pluginMetaOnce.Do(func() {
		repoRoot, err := findRepoRoot()
		if err != nil {
			pluginMetaErr = fmt.Errorf("find repo root: %w", err)
			return
		}
		pluginID, err = getPluginID(repoRoot)
		if err != nil {
			pluginMetaErr = fmt.Errorf("get plugin ID: %w", err)
			return
		}
		matches, err := filepath.Glob(filepath.Join(repoRoot, "dist", "*.tar.gz"))
		if err != nil || len(matches) == 0 {
			pluginMetaErr = fmt.Errorf("no plugin bundle found in dist/ — ensure 'make dist' ran before tests")
			return
		}
		if len(matches) > 1 {
			pluginMetaErr = fmt.Errorf("multiple plugin bundles found in dist/ — remove old bundles and keep only one: %v", matches)
			return
		}
		pluginBundle = matches[0]
	})
	return pluginMetaErr
}

// Setup starts containers (once per test binary), resets the database, deploys the plugin,
// and creates fresh test data (team, user, channel). Each test gets a completely clean
// database — no state leaks between tests.
//
// If Docker is not available the test fails. Set SKIP_DOCKER_TESTS to skip instead.
func Setup(t *testing.T) *TestHelper {
	t.Helper()

	if os.Getenv("SKIP_DOCKER_TESTS") != "" {
		t.Skip("Skipping integration test (SKIP_DOCKER_TESTS is set)")
	}

	c, err := ensureContainers(t)
	require.NoError(t, err, "Docker is required for integration tests")

	require.NoError(t, ensurePluginMeta(), "failed to resolve plugin metadata")

	ctx := t.Context()

	// Reset database for full test isolation. This truncates all data tables
	// (preserving migrations), restarts the container so the server re-creates
	// default roles/permissions, and re-creates the admin user.
	err = resetDatabase(ctx, c)
	require.NoError(t, err, "failed to reset database")

	th := &TestHelper{
		t:         t,
		ServerURL: c.serverURL,
	}

	// Login as admin (freshly re-created by resetDatabase).
	th.AdminClient = model.NewAPIv4Client(c.serverURL)
	_, _, err = th.AdminClient.Login(ctx, adminUsername, adminPassword)
	require.NoError(t, err, "failed to login as admin")

	th.AdminUser, _, err = th.AdminClient.GetMe(ctx, "")
	require.NoError(t, err, "failed to get admin user")

	// Deploy plugin. After DB reset plugin state is cleared, so we re-deploy every time.
	err = deployPlugin(ctx, th.AdminClient)
	require.NoError(t, err, "failed to deploy plugin")

	// Create fresh test data.
	th.Team = th.createTeam(ctx)
	th.User, th.Client = th.createUserAndClient(ctx)
	th.Channel = th.CreateChannel(model.ChannelTypeOpen)

	// Add the default user to the default channel so they can post immediately.
	_, _, err = th.AdminClient.AddChannelMember(ctx, th.Channel.Id, th.User.Id)
	require.NoError(t, err, "failed to add user to channel")

	return th
}

func deployPlugin(ctx context.Context, client *model.Client4) error {
	f, err := os.Open(pluginBundle) //nolint:gosec
	if err != nil {
		return fmt.Errorf("open bundle %s: %w", pluginBundle, err)
	}
	defer func() { _ = f.Close() }()

	// Remove any existing plugin (may fail if not installed, that's OK).
	_, _ = client.RemovePlugin(ctx, pluginID)

	_, _, err = client.UploadPlugin(ctx, f)
	if err != nil {
		return fmt.Errorf("upload plugin: %w", err)
	}

	_, err = client.EnablePlugin(ctx, pluginID)
	if err != nil {
		return fmt.Errorf("enable plugin: %w", err)
	}

	// Poll until the plugin reaches Running state.
	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		statuses, _, statusErr := client.GetPluginStatuses(ctx)
		if statusErr == nil {
			for _, s := range statuses {
				if s.PluginId == pluginID && s.State == model.PluginStateRunning {
					return nil
				}
			}
		}
		time.Sleep(500 * time.Millisecond)
	}

	return fmt.Errorf("plugin %s did not reach running state within 30s", pluginID)
}

func findRepoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "plugin.json")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("could not find plugin.json in any parent directory")
		}
		dir = parent
	}
}

func getPluginID(repoRoot string) (string, error) {
	data, err := os.ReadFile(filepath.Join(repoRoot, "plugin.json")) //nolint:gosec
	if err != nil {
		return "", fmt.Errorf("read plugin.json: %w", err)
	}
	var m struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return "", fmt.Errorf("parse plugin.json: %w", err)
	}
	if m.ID == "" {
		return "", fmt.Errorf("plugin ID is empty in plugin.json")
	}
	return m.ID, nil
}

func (th *TestHelper) createTeam(ctx context.Context) *model.Team {
	th.t.Helper()

	team, _, err := th.AdminClient.CreateTeam(ctx, &model.Team{
		Name:        model.NewId(),
		DisplayName: "Test Team",
		Type:        model.TeamOpen,
	})
	require.NoError(th.t, err, "failed to create team")
	return team
}

func (th *TestHelper) createUserAndClient(ctx context.Context) (*model.User, *model.Client4) {
	th.t.Helper()

	user := th.CreateUser()

	client := model.NewAPIv4Client(th.ServerURL)
	_, _, err := client.Login(ctx, user.Username, adminPassword)
	require.NoError(th.t, err, "failed to login as test user")

	return user, client
}

// CreateUser creates a user with a random name, adds them to the test Team, and returns the user.
// The password is "Password1!".
func (th *TestHelper) CreateUser() *model.User {
	th.t.Helper()

	ctx := th.t.Context()
	username := "user-" + model.NewId()[:8]
	user, _, err := th.AdminClient.CreateUser(ctx, &model.User{
		Email:    username + "@example.com",
		Username: username,
		Password: adminPassword,
	})
	require.NoError(th.t, err, "failed to create user")

	_, _, err = th.AdminClient.AddTeamMember(ctx, th.Team.Id, user.Id)
	require.NoError(th.t, err, "failed to add user to team")

	return user
}

// CreateChannel creates a channel in the test Team with the given type (model.ChannelTypeOpen
// or model.ChannelTypePrivate) and returns it.
func (th *TestHelper) CreateChannel(channelType model.ChannelType) *model.Channel {
	th.t.Helper()

	ctx := th.t.Context()
	channel, _, err := th.AdminClient.CreateChannel(ctx, &model.Channel{
		TeamId:      th.Team.Id,
		Name:        model.NewId(),
		DisplayName: "Test Channel",
		Type:        channelType,
	})
	require.NoError(th.t, err, "failed to create channel")
	return channel
}

// PostAs creates a post in the given channel as the given user and returns it.
// The user is automatically added to the channel if not already a member.
func (th *TestHelper) PostAs(user *model.User, channelID, message string) *model.Post {
	th.t.Helper()

	ctx := th.t.Context()

	// Ensure the user is a member of the channel (idempotent if already a member).
	_, _, _ = th.AdminClient.AddChannelMember(ctx, channelID, user.Id)

	client := model.NewAPIv4Client(th.ServerURL)
	_, _, err := client.Login(ctx, user.Username, adminPassword)
	require.NoError(th.t, err, "failed to login as user for posting")

	post, _, err := client.CreatePost(ctx, &model.Post{
		ChannelId: channelID,
		Message:   message,
	})
	require.NoError(th.t, err, "failed to create post")
	return post
}
