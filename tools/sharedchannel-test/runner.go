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

// nodeClient talks to one cluster node directly, bypassing the proxy.
type nodeClient struct {
	name   string
	client *model.Client4
}

// TestRunner orchestrates the full integration test sequence.
type TestRunner struct {
	cfg      Config
	logger   *mlog.Logger
	mgr      *ServerManager
	clientA  *model.Client4
	clientB  *model.Client4
	nodesA   []nodeClient // HA mode only
	nodesB   []nodeClient // HA mode only
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
	if err := tr.runHATests(ctx); err != nil {
		tr.logger.Error("HA tests had errors", mlog.Err(err))
	}
	if err := tr.runOfflineRecoveryTests(ctx); err != nil {
		tr.logger.Error("Offline recovery tests had errors", mlog.Err(err))
	}
	if err := tr.runCatchUpTests(ctx); err != nil {
		tr.logger.Error("Outage catch-up tests had errors", mlog.Err(err))
	}
	if err := tr.runCursorRewindTests(ctx); err != nil {
		tr.logger.Error("Cursor rewind tests had errors", mlog.Err(err))
	}

	// Report
	return tr.report()
}

func (tr *TestRunner) ha() bool {
	return tr.mgr != nil && tr.mgr.ha()
}

func (tr *TestRunner) provision(ctx context.Context) error {
	var err error

	adminURLA, adminURLB := tr.cfg.ServerAURL, tr.cfg.ServerBURL
	if tr.ha() {
		// The admin role is granted straight in the DB, which no node's user cache hears
		// about, so every provisioning step runs on the same node.
		adminURLA, adminURLB = tr.mgr.NodesA()[0].url, tr.mgr.NodesB()[0].url
	}

	// Create admin users and login
	tr.logger.Info("Provisioning admin users...")
	tr.clientA, err = ProvisionAdmin(ctx, adminURLA, "mattermost_test",
		tr.cfg.AdminUser, "admin-a@test.local", tr.cfg.AdminPass)
	if err != nil {
		return fmt.Errorf("provision server A: %w", err)
	}

	tr.clientB, err = ProvisionAdmin(ctx, adminURLB, "mattermost_node_test",
		tr.cfg.AdminUser, "admin-b@test.local", tr.cfg.AdminPass)
	if err != nil {
		return fmt.Errorf("provision server B: %w", err)
	}

	if tr.ha() {
		// No license upload: HA nodes got it at boot through MM_LICENSE.
		tr.nodesA = nodeClients(tr.mgr.NodesA(), tr.clientA.AuthToken)
		tr.nodesB = nodeClients(tr.mgr.NodesB(), tr.clientB.AuthToken)
		tr.clientA = clientWithToken(tr.cfg.ServerAURL, tr.clientA.AuthToken)
		tr.clientB = clientWithToken(tr.cfg.ServerBURL, tr.clientB.AuthToken)
	} else {
		tr.logger.Info("Uploading license...")
		if err := UploadLicense(ctx, tr.clientA, tr.cfg.LicensePath); err != nil {
			return fmt.Errorf("license server A: %w", err)
		}
		if err := UploadLicense(ctx, tr.clientB, tr.cfg.LicensePath); err != nil {
			return fmt.Errorf("license server B: %w", err)
		}
	}

	// Wait for remote cluster service to become available after license upload
	if err := tr.waitFor(ctx, 30*time.Second, func() bool {
		_, _, err := tr.clientA.GetRemoteClusters(ctx, 0, 1, model.RemoteClusterQueryFilter{})
		return err == nil
	}); err != nil {
		return fmt.Errorf("remote cluster service not ready on server A: %w", err)
	}

	if tr.ha() {
		for _, side := range []struct {
			name  string
			nodes []nodeClient
		}{{"A", tr.nodesA}, {"B", tr.nodesB}} {
			leader, err := tr.waitForCluster(ctx, side.nodes)
			if err != nil {
				return fmt.Errorf("server %s cluster: %w", side.name, err)
			}
			tr.logger.Info("Cluster formed", mlog.String("server", side.name), mlog.String("leader", leader))
		}
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
	invitePassword := model.NewTestPassword()
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
	channelA, err = tr.createChannelOnA(ctx, channelName)
	if err != nil {
		return "", "", err
	}
	channelB, err = tr.shareChannelWithB(ctx, channelName, channelA)
	if err != nil {
		return "", "", err
	}
	return channelA, channelB, nil
}

// createChannelOnA creates an open channel on Server A without sharing it.
func (tr *TestRunner) createChannelOnA(ctx context.Context, channelName string) (string, error) {
	ch, _, err := tr.clientA.CreateChannel(ctx, &model.Channel{
		TeamId:      tr.teamA.Id,
		Name:        channelName + "-" + tr.suffix,
		DisplayName: "Shared: " + channelName,
		Type:        model.ChannelTypeOpen,
	})
	if err != nil {
		return "", fmt.Errorf("create channel: %w", err)
	}
	return ch.Id, nil
}

// shareChannelWithB shares a channel created by createChannelOnA through the
// pre-established remote cluster and returns its ID on Server B.
func (tr *TestRunner) shareChannelWithB(ctx context.Context, channelName, channelA string) (channelB string, err error) {
	uniqueName := channelName + "-" + tr.suffix

	// Share the channel through the existing remote
	_, err = tr.clientA.InviteRemoteClusterToChannel(ctx, tr.remoteID, channelA)
	if err != nil {
		return "", fmt.Errorf("share channel: %w", err)
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
		return "", fmt.Errorf("channel did not appear on server B: %w", err)
	}

	return channelB, nil
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

func nodeClients(nodes []*serverNode, token string) []nodeClient {
	clients := make([]nodeClient, 0, len(nodes))
	for _, n := range nodes {
		clients = append(clients, nodeClient{name: n.label, client: clientWithToken(n.url, token)})
	}
	return clients
}

func clientWithToken(url, token string) *model.Client4 {
	client := model.NewAPIv4Client(url)
	client.SetToken(token)
	return client
}

// waitForCluster waits until every node in nodes sees exactly those nodes as cluster
// members, then returns the leader's node name.
func (tr *TestRunner) waitForCluster(ctx context.Context, nodes []nodeClient) (string, error) {
	var leader string
	err := tr.waitFor(ctx, 90*time.Second, func() bool {
		leader = ""
		for _, n := range nodes {
			infos, _, err := n.client.GetClusterStatus(ctx)
			if err != nil {
				return false
			}
			nodeLeader, connected := clusterLeader(infos)
			if connected != len(nodes) || (leader != "" && nodeLeader != leader) {
				return false
			}
			leader = nodeLeader
		}
		return true
	})
	if err != nil {
		return "", fmt.Errorf("%d-node cluster did not form (the license must include the Cluster feature): %w", len(nodes), err)
	}
	return leader, nil
}

// clusterLeader mirrors the server's election: the connected node with the lowest
// cluster ID leads.
func clusterLeader(infos []*model.ClusterInfo) (leader string, connected int) {
	var leaderID string
	for _, info := range infos {
		// Nodes that are only registered in the DB, not in the memberlist, have no config hash.
		if info.ConfigHash == "" {
			continue
		}
		connected++
		if leaderID == "" || info.Id < leaderID {
			leaderID, leader = info.Id, info.Hostname
		}
	}
	return leader, connected
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
		Password: model.NewTestPassword(),
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
