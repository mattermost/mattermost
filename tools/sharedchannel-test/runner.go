package main

import (
	"context"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// TestResult tracks the outcome of a single test case.
type TestResult struct {
	Name   string
	Passed bool
	Detail string
}

// TestRunner orchestrates the full integration test sequence.
type TestRunner struct {
	cfg      Config
	logger   *mlog.Logger
	mgr      *ServerManager
	clientA  *model.Client4
	clientB  *model.Client4
	teamA    *model.Team
	teamB    *model.Team
	remoteID string // single remote cluster connection, reused for all tests
	suffix   string // random suffix for unique names across repeated runs
	results  []TestResult
}

func NewTestRunner(cfg Config, logger *mlog.Logger) *TestRunner {
	return &TestRunner{
		cfg:    cfg,
		logger: logger,
		suffix: model.NewId()[:6],
	}
}

func (tr *TestRunner) pass(name string) {
	tr.results = append(tr.results, TestResult{Name: name, Passed: true})
	tr.logger.Info("PASS", mlog.String("test", name))
}

func (tr *TestRunner) fail(name, detail string) {
	tr.results = append(tr.results, TestResult{Name: name, Passed: false, Detail: detail})
	tr.logger.Error("FAIL", mlog.String("test", name), mlog.String("detail", detail))
}

// Run executes the full test suite.
func (tr *TestRunner) Run(ctx context.Context) error {
	// Lifecycle management
	if tr.cfg.Manage {
		tr.mgr = NewServerManager(tr.cfg, tr.logger)
		defer tr.mgr.Teardown()
		if err := tr.mgr.Setup(ctx); err != nil {
			return fmt.Errorf("server setup: %w", err)
		}
	}

	// Provision
	if err := tr.provision(ctx); err != nil {
		return fmt.Errorf("provision: %w", err)
	}

	// Run test suites
	if err := tr.runMembershipTests(ctx); err != nil {
		tr.logger.Error("Membership tests had errors", mlog.Err(err))
	}
	if err := tr.runPostTests(ctx); err != nil {
		tr.logger.Error("Post tests had errors", mlog.Err(err))
	}
	if err := tr.runReactionTests(ctx); err != nil {
		tr.logger.Error("Reaction tests had errors", mlog.Err(err))
	}

	// Report
	return tr.report()
}

func (tr *TestRunner) provision(ctx context.Context) error {
	var err error

	// Create admin users and login
	tr.logger.Info("Provisioning admin users...")
	tr.clientA, err = ProvisionAdmin(ctx, tr.cfg.ServerAURL, "mattermost_test",
		tr.cfg.AdminUser, "admin-a@test.local", tr.cfg.AdminPass)
	if err != nil {
		return fmt.Errorf("provision server A: %w", err)
	}

	tr.clientB, err = ProvisionAdmin(ctx, tr.cfg.ServerBURL, "mattermost_node_test",
		tr.cfg.AdminUser, "admin-b@test.local", tr.cfg.AdminPass)
	if err != nil {
		return fmt.Errorf("provision server B: %w", err)
	}

	// Upload license
	tr.logger.Info("Uploading license...")
	if err := UploadLicense(ctx, tr.clientA, tr.cfg.LicensePath); err != nil {
		return fmt.Errorf("license server A: %w", err)
	}
	if err := UploadLicense(ctx, tr.clientB, tr.cfg.LicensePath); err != nil {
		return fmt.Errorf("license server B: %w", err)
	}

	// Wait for remote cluster service to become available after license upload
	if err := tr.waitFor(ctx, 30*time.Second, func() bool {
		_, _, err := tr.clientA.GetRemoteClusters(ctx, 0, 1, model.RemoteClusterQueryFilter{})
		return err == nil
	}); err != nil {
		return fmt.Errorf("remote cluster service not ready on server A: %w", err)
	}

	// Create teams
	tr.logger.Info("Creating teams...")
	tr.teamA, _, err = tr.clientA.CreateTeam(ctx, &model.Team{
		Name:        "team-a-" + tr.suffix,
		DisplayName: "Team A",
		Type:        model.TeamOpen,
	})
	if err != nil {
		return fmt.Errorf("create team A: %w", err)
	}

	tr.teamB, _, err = tr.clientB.CreateTeam(ctx, &model.Team{
		Name:        "team-b-" + tr.suffix,
		DisplayName: "Team B",
		Type:        model.TeamOpen,
	})
	if err != nil {
		return fmt.Errorf("create team B: %w", err)
	}

	// Create a single remote cluster connection for all tests
	tr.logger.Info("Setting up remote cluster connection...")
	invitePassword := "TestInvite123!"
	invite, _, err := tr.clientA.CreateRemoteCluster(ctx, &model.RemoteClusterWithPassword{
		RemoteCluster: &model.RemoteCluster{
			Name:          "server-b-" + tr.suffix,
			DisplayName:   "Server B",
			DefaultTeamId: tr.teamA.Id,
		},
		Password: invitePassword,
	})
	if err != nil {
		return fmt.Errorf("create remote cluster: %w", err)
	}
	tr.remoteID = invite.RemoteCluster.RemoteId

	_, _, err = tr.clientB.RemoteClusterAcceptInvite(ctx, &model.RemoteClusterAcceptInvite{
		Name:          "server-a-" + tr.suffix,
		DisplayName:   "Server A",
		DefaultTeamId: tr.teamB.Id,
		Invite:        invite.Invite,
		Password:      invitePassword,
	})
	if err != nil {
		return fmt.Errorf("accept invite: %w", err)
	}

	if err := tr.waitForRemoteOnline(ctx, tr.remoteID); err != nil {
		return fmt.Errorf("remote cluster not online: %w", err)
	}
	tr.logger.Info("Remote cluster connection established")

	return nil
}

// setupSharedChannel creates a channel on Server A, shares it with Server B via
// the pre-established remote cluster, and returns both channel IDs.
func (tr *TestRunner) setupSharedChannel(ctx context.Context, channelName string) (channelA, channelB string, err error) {
	uniqueName := channelName + "-" + tr.suffix
	ch, _, err := tr.clientA.CreateChannel(ctx, &model.Channel{
		TeamId:      tr.teamA.Id,
		Name:        uniqueName,
		DisplayName: "Shared: " + channelName,
		Type:        model.ChannelTypeOpen,
	})
	if err != nil {
		return "", "", fmt.Errorf("create channel: %w", err)
	}
	channelA = ch.Id

	// Share the channel through the existing remote
	_, err = tr.clientA.InviteRemoteClusterToChannel(ctx, tr.remoteID, channelA)
	if err != nil {
		return "", "", fmt.Errorf("share channel: %w", err)
	}

	// Wait for channel to appear on B
	tr.logger.Info("Waiting for channel to sync to Server B...", mlog.String("channel", channelName))
	if err := tr.waitFor(ctx, 30*time.Second, func() bool {
		channels, _, err := tr.clientB.GetAllSharedChannels(ctx, tr.teamB.Id, 0, 100)
		if err != nil {
			return false
		}
		for _, sc := range channels {
			if sc.ShareName == uniqueName {
				channelB = sc.ChannelId
				return true
			}
		}
		return false
	}); err != nil {
		return "", "", fmt.Errorf("channel did not appear on server B: %w", err)
	}

	return channelA, channelB, nil
}

func (tr *TestRunner) waitForRemoteOnline(ctx context.Context, remoteID string) error {
	return tr.waitFor(ctx, 30*time.Second, func() bool {
		rc, _, err := tr.clientA.GetRemoteCluster(ctx, remoteID)
		if err != nil {
			return false
		}
		return rc.LastPingAt > 0
	})
}

func (tr *TestRunner) waitFor(ctx context.Context, timeout time.Duration, condition func() bool) error {
	deadline := time.After(timeout)
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline:
			return fmt.Errorf("timed out after %s", timeout)
		case <-ticker.C:
			if condition() {
				return nil
			}
		}
	}
}

// createTestUser creates a user on Server A, adds them to the team, and returns their ID.
func (tr *TestRunner) createTestUser(ctx context.Context, username string) (string, error) {
	uniqueName := username + "-" + tr.suffix
	user, _, err := tr.clientA.CreateUser(ctx, &model.User{
		Username: uniqueName,
		Email:    uniqueName + "@test.local",
		Password: "TestPass123!",
	})
	if err != nil {
		return "", fmt.Errorf("create user %s: %w", username, err)
	}

	_, _, err = tr.clientA.AddTeamMember(ctx, tr.teamA.Id, user.Id)
	if err != nil {
		return "", fmt.Errorf("add user %s to team: %w", username, err)
	}

	return user.Id, nil
}

// verifyMemberOnB checks whether a user (by username prefix) is a member of a channel on Server B.
func (tr *TestRunner) verifyMemberOnB(ctx context.Context, channelB, usernamePrefix string) bool {
	users, _, err := tr.clientB.GetUsersInChannel(ctx, channelB, 0, 200, "")
	if err != nil {
		return false
	}
	for _, u := range users {
		if len(u.Username) >= len(usernamePrefix) && u.Username[:len(usernamePrefix)] == usernamePrefix {
			return true
		}
	}
	return false
}

// report prints the final summary. Errors go to stderr so that a clean
// stderr signals success in CI/scripted environments. Returns non-nil
// on any failure so the process exits with a non-zero code.
func (tr *TestRunner) report() error {
	passed, failed := 0, 0
	for _, r := range tr.results {
		if r.Passed {
			passed++
		} else {
			failed++
		}
	}

	tr.logger.Info("=========================================")
	tr.logger.Info(fmt.Sprintf("Results: %d passed, %d failed", passed, failed))
	tr.logger.Info("=========================================")

	if failed > 0 {
		for _, r := range tr.results {
			if !r.Passed {
				tr.logger.Error("FAIL", mlog.String("test", r.Name), mlog.String("detail", r.Detail))
			}
		}
		return fmt.Errorf("%d test(s) failed", failed)
	}
	return nil
}
