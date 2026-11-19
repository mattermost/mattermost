// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"slices"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/packet"
)

// Not parallel: it clears the latest-version cache that TestGetLatestVersion also uses.
func TestBuildHealthSnapshotStandaloneLeaderDiagnostics(t *testing.T) {
	th := Setup(t)

	err := th.App.clearLatestVersionCache()
	require.NoError(t, err)

	snapshot, buildErr := th.App.buildHealthSnapshotWithLatestVersionURL(th.Context, latestVersionServer(t).URL)
	require.NoError(t, buildErr)
	require.NotNil(t, snapshot)

	nodes := snapshot.Nodes()
	require.Len(t, nodes, 1)
	require.True(t, nodes[0].IsLeader)
	require.Nil(t, nodes[0].ClusterInfo)
	require.NotNil(t, nodes[0].Diagnostics)
	require.NotNil(t, nodes[0].Diagnostics.Diagnostics)
	for _, section := range model.AllNodeSections() {
		assert.True(t, nodes[0].Has(section), "section %q", section)
	}

	hostname, err := os.Hostname()
	require.NoError(t, err)
	assert.Equal(t, hostname, nodes[0].Hostname)
}

// threeNodeCluster reports this node as id-2 of three. The other two do not reply; deadline
// records the deadline of the context the collection was given.
type threeNodeCluster struct {
	captureClusterMock
	deadline time.Time
}

func (c *threeNodeCluster) CollectHealthDiagnostics(rctx request.CTX) map[string]*model.NodeDiagnostics {
	c.deadline, _ = rctx.Context().Deadline()
	return nil
}

func (c *threeNodeCluster) GetClusterId() string { return "id-2" }

func (c *threeNodeCluster) GetClusterInfos() ([]*model.ClusterInfo, error) {
	return []*model.ClusterInfo{
		{Id: "id-1", Hostname: "node-1"},
		{Id: "id-2", Hostname: "node-2"},
		{Id: "id-3", Hostname: "node-3"},
	}, nil
}

// Not parallel: it clears the latest-version cache that TestGetLatestVersion also uses.
func TestBuildHealthSnapshotMarksNodesThatDidNotReply(t *testing.T) {
	cluster := &threeNodeCluster{}
	th := SetupWithClusterMock(t, cluster)

	err := th.App.clearLatestVersionCache()
	require.NoError(t, err)

	start := time.Now()
	snapshot, buildErr := th.App.buildHealthSnapshotWithLatestVersionURL(th.Context, latestVersionServer(t).URL)
	require.NoError(t, buildErr)
	require.NotNil(t, snapshot)

	// The collection is bounded even though th.Context has no deadline.
	assert.WithinRange(t, cluster.deadline, start.Add(healthCollectTimeout), time.Now().Add(healthCollectTimeout))

	nodes := snapshot.Nodes()
	require.Len(t, nodes, 3)

	assert.Nil(t, nodes[0].Diagnostics)
	assert.ErrorIs(t, nodes[0].CollectErr, healthcheck.ErrNodeNoReply)

	require.NotNil(t, nodes[1].Diagnostics)
	require.NotNil(t, nodes[1].Diagnostics.Diagnostics.Cluster.NumberOfNodes)
	assert.Equal(t, 3, *nodes[1].Diagnostics.Diagnostics.Cluster.NumberOfNodes)
	assert.NoError(t, nodes[1].CollectErr)

	assert.Nil(t, nodes[2].Diagnostics)
	assert.ErrorIs(t, nodes[2].CollectErr, healthcheck.ErrNodeNoReply)

	// No node reports itself as leader, so the local node stands in.
	leader, ok := snapshot.Leader()
	require.True(t, ok)
	assert.Equal(t, "id-2", leader.ClusterInfo.Id)
}

// Not parallel: it clears the latest-version cache that TestGetLatestVersion also uses.
func TestBuildHealthSnapshotSectionFailureIsolationWithPartialStats(t *testing.T) {
	th := Setup(t)

	err := th.App.clearLatestVersionCache()
	require.NoError(t, err)

	storeMock := mocks.Store{}
	channelStore := &mocks.ChannelStore{}
	channelStore.On("AnalyticsTypeCount", "", model.ChannelTypeOpen).Return(int64(2), nil)
	channelStore.On("AnalyticsTypeCount", "", model.ChannelTypePrivate).Return(int64(0), errors.New("private query failed"))

	originalStore := th.App.Srv().Store()
	t.Cleanup(func() {
		th.App.Srv().SetStore(originalStore)
	})

	storeMock.On("User").Return(originalStore.User())
	storeMock.On("Post").Return(originalStore.Post())
	storeMock.On("Channel").Return(channelStore)
	storeMock.On("Team").Return(originalStore.Team())
	storeMock.On("Command").Return(originalStore.Command())
	storeMock.On("Webhook").Return(originalStore.Webhook())
	storeMock.On("Job").Return(originalStore.Job())
	storeMock.On("GetDBSchemaVersion").Return(originalStore.GetDBSchemaVersion())
	storeMock.On("GetDbVersion", false).Return(originalStore.GetDbVersion(false))
	storeMock.On("TotalMasterDbConnections").Return(originalStore.TotalMasterDbConnections())
	storeMock.On("TotalReadDbConnections").Return(originalStore.TotalReadDbConnections())
	storeMock.On("TotalSearchDbConnections").Return(originalStore.TotalSearchDbConnections())
	storeMock.On("GetDiagnostics", mock.Anything).Return(originalStore.GetDiagnostics(th.Context))
	storeMock.On("ClearCaches")
	storeMock.On("Close").Return(nil)

	th.App.Srv().SetStore(&storeMock)

	snapshot, buildErr := th.App.buildHealthSnapshotWithLatestVersionURL(th.Context, latestVersionServer(t).URL)
	require.NoError(t, buildErr)
	require.NotNil(t, snapshot)

	ok, sectionErr := snapshot.SectionErr(model.SectionStats)
	require.True(t, ok)
	require.ErrorContains(t, sectionErr, "failed to get channel count")

	require.NotNil(t, snapshot.Stats)
	assert.Nil(t, snapshot.Stats.Channels)
	assert.NotNil(t, snapshot.Stats.Posts)

	require.NotNil(t, snapshot.Config)
	require.NotNil(t, snapshot.Jobs)
	require.NotNil(t, snapshot.Plugins)
	ok, sectionErr = snapshot.SectionErr(model.SectionConfig)
	require.True(t, ok)
	require.NoError(t, sectionErr)
	ok, sectionErr = snapshot.SectionErr(model.SectionJobs)
	require.True(t, ok)
	require.NoError(t, sectionErr)
	ok, sectionErr = snapshot.SectionErr(model.SectionPlugins)
	require.True(t, ok)
	require.NoError(t, sectionErr)
}

// Not parallel: it clears the latest-version cache that TestGetLatestVersion also uses.
func TestBuildHealthSnapshotLatestVersionTimeout(t *testing.T) {
	th := Setup(t)

	err := th.App.clearLatestVersionCache()
	require.NoError(t, err)

	stalled := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	t.Cleanup(stalled.Close)

	ctx, cancel := context.WithTimeout(th.Context.Context(), 150*time.Millisecond)
	t.Cleanup(cancel)

	start := time.Now()
	snapshot, buildErr := th.App.buildHealthSnapshotWithLatestVersionURL(th.Context.WithContext(ctx), stalled.URL)
	elapsed := time.Since(start)

	require.NoError(t, buildErr)
	require.NotNil(t, snapshot)
	assert.Less(t, elapsed, 2*time.Second)
	assert.Empty(t, snapshot.Version.Latest)

	ok, sectionErr := snapshot.SectionErr(model.SectionVersion)
	require.True(t, ok)
	require.Error(t, sectionErr)
}

// Not parallel: it clears the latest-version cache that TestGetLatestVersion also uses.
func TestBuildHealthSnapshotLatestVersionDropsTagPrefix(t *testing.T) {
	th := Setup(t)

	err := th.App.clearLatestVersionCache()
	require.NoError(t, err)

	body, err := json.Marshal(&model.GithubReleaseInfo{Id: 1, TagName: "v11.11.1", Name: "v11.11.1", Url: "https://github.com/mattermost/mattermost/releases/tag/v11.11.1"})
	require.NoError(t, err)
	release := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, writeErr := w.Write(body)
		assert.NoError(t, writeErr)
	}))
	t.Cleanup(release.Close)

	snapshot, err := th.App.buildHealthSnapshotWithLatestVersionURL(th.Context, release.URL)
	require.NoError(t, err)
	assert.Equal(t, "11.11.1", snapshot.Version.Latest)
}

// Not parallel: it clears the latest-version cache that TestGetLatestVersion also uses.
func TestBuildHealthSnapshotSkipsLatestVersionWithSecurityAlertsOff(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.ServiceSettings.EnableSecurityFixAlert = model.NewPointer(false)
	})

	err := th.App.clearLatestVersionCache()
	require.NoError(t, err)

	var requests atomic.Int32
	release := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
	}))
	t.Cleanup(release.Close)

	snapshot, err := th.App.buildHealthSnapshotWithLatestVersionURL(th.Context, release.URL)
	require.NoError(t, err)
	assert.Zero(t, requests.Load())
	assert.Empty(t, snapshot.Version.Latest)

	ok, sectionErr := snapshot.SectionErr(model.SectionVersion)
	require.True(t, ok)
	assert.NoError(t, sectionErr)

	// The version rules read the setting from the snapshot to report why Latest is empty.
	enabled, ok := snapshot.ConfigBool(func(cfg *model.Config) *bool { return cfg.ServiceSettings.EnableSecurityFixAlert })
	require.True(t, ok)
	assert.False(t, enabled)
}

// parityCluster makes this node, node-1, a follower in a cluster with node-2, the leader.
// node-2 runs this server's own collectors and packet writers, under its own hostname.
type parityCluster struct {
	captureClusterMock
	ps *platform.PlatformService
}

func (c *parityCluster) GetClusterId() string { return "id-1" }

func (c *parityCluster) GetMyClusterInfo() *model.ClusterInfo {
	return &model.ClusterInfo{Id: "id-1", Hostname: "node-1", Version: model.CurrentVersion + ".12345", IPAddress: "10.0.0.1"}
}

func (c *parityCluster) GetClusterInfos() ([]*model.ClusterInfo, error) {
	return []*model.ClusterInfo{
		c.GetMyClusterInfo(),
		{Id: "id-2", Hostname: "node-2", Version: model.CurrentVersion + ".12345", IPAddress: "10.0.0.2"},
	}, nil
}

func (c *parityCluster) leaderDiagnostics(rctx request.CTX) (*model.NodeDiagnostics, error) {
	diagnostics, err := c.ps.GetSupportPacketDiagnostics(rctx)
	if diagnostics != nil {
		diagnostics.Diagnostics.Server.Hostname = model.NewPointer("node-2")
		diagnostics.Diagnostics.Cluster.IsLeader = true
	}
	return diagnostics, err
}

func (c *parityCluster) CollectHealthDiagnostics(rctx request.CTX) map[string]*model.NodeDiagnostics {
	diagnostics, _ := c.leaderDiagnostics(rctx)
	return map[string]*model.NodeDiagnostics{"id-2": diagnostics}
}

func (c *parityCluster) GenerateSupportPacket(rctx request.CTX, options *model.SupportPacketOptions) (map[string][]model.FileData, error) {
	files, err := c.ps.GenerateSupportPacket(rctx, options)
	if err != nil {
		return nil, err
	}
	diagnostics, err := c.leaderDiagnostics(rctx)
	if err != nil {
		return nil, err
	}
	diagnosticsFile, err := platform.YAMLFile(model.SupportPacketDiagnosticsFileName, diagnostics.Diagnostics, nil)
	if err != nil {
		return nil, err
	}

	nodeFiles := make([]model.FileData, 0, len(files))
	for _, file := range files {
		if file.Filename == model.SupportPacketDiagnosticsFileName {
			file = *diagnosticsFile
		}
		nodeFiles = append(nodeFiles, model.FileData{Filename: path.Join("node-2", file.Filename), Body: file.Body})
	}
	return map[string][]model.FileData{"node-2": nodeFiles}, nil
}

// Not parallel: it clears the latest-version cache that TestGetLatestVersion also uses.
func TestHealthSnapshotLiveOfflineParity(t *testing.T) {
	t.Run("standalone", func(t *testing.T) {
		testHealthSnapshotLiveOfflineParity(t, Setup(t), nil)
	})

	t.Run("ha", func(t *testing.T) {
		cluster := &parityCluster{}
		th := SetupWithClusterMock(t, cluster)
		cluster.ps = th.App.Srv().Platform()
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ClusterSettings.Enable = model.NewPointer(true)
		})

		testHealthSnapshotLiveOfflineParity(t, th, []string{"node-1", "node-2"})
	})
}

// testHealthSnapshotLiveOfflineParity checks that the live snapshot and the Support Packet of th's
// server evaluate the same. packetNodes are the node directories the packet must have; nil means
// a standalone packet.
func testHealthSnapshotLiveOfflineParity(t *testing.T, th *TestHelper, packetNodes []string) {
	th.InitBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.SiteURL = model.NewPointer("http://chat.example.com")
		cfg.EmailSettings.SendPushNotifications = model.NewPointer(true)
		cfg.EmailSettings.PushNotificationServer = model.NewPointer("http://push.example.com")
		// The live and packet collections each probe SMTP and could disagree.
		cfg.EmailSettings.SendEmailNotifications = model.NewPointer(false)
		cfg.EmailSettings.EnableSignInWithEmail = model.NewPointer(false)
		cfg.EmailSettings.EnableSignInWithUsername = model.NewPointer(false)
		cfg.SqlSettings.QueryTimeout = model.NewPointer(60)
		cfg.ComplianceSettings.Enable = model.NewPointer(true)
		cfg.ComplianceSettings.Directory = model.NewPointer("")
		cfg.MetricsSettings.Enable = model.NewPointer(true)
	})
	// Without it the permissions collector fails and the packet carries a warning.txt.
	err := th.App.Srv().Store().System().Save(&model.System{Name: model.MigrationKeyAdvancedPermissionsPhase2, Value: "true"})
	require.NoError(t, err)
	t.Cleanup(func() {
		_, deleteErr := th.App.Srv().Store().System().PermanentDeleteByName(model.MigrationKeyAdvancedPermissionsPhase2)
		require.NoError(t, deleteErr)
	})

	license := model.NewTestLicense()
	license.Id = model.NewId()
	license.Customer.Id = model.NewId()
	// Half a day past a whole day count keeps both snapshots, taken moments apart, on the same count.
	license.ExpiresAt = time.Now().Add(10*24*time.Hour + 12*time.Hour).UnixMilli()
	license.IsTrial = true
	license.IsSeatCountEnforced = true
	license.ExtraUsers = model.NewPointer(5)
	license.Features.Users = model.NewPointer(1_000_000)
	require.True(t, th.App.Srv().SetLicense(license))
	t.Cleanup(func() { th.App.Srv().SetLicense(nil) })

	// Half an hour off the hour boundary, so the reported idle hours match although the packet is generated later.
	stale := time.Now().Add(-30*time.Hour - 30*time.Minute).UnixMilli()
	for _, job := range []*model.Job{
		{Id: model.NewId(), Type: model.JobTypeDataRetention, CreateAt: stale - 1000, LastActivityAt: stale - 1000, Status: model.JobStatusError, Data: model.StringMap{"error": "driver: bad connection"}},
		{Id: model.NewId(), Type: model.JobTypeDataRetention, CreateAt: stale, StartAt: stale, LastActivityAt: stale, Status: model.JobStatusInProgress},
	} {
		_, err = th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)
		t.Cleanup(func() {
			_, deleteErr := th.App.Srv().Store().Job().Delete(job.Id)
			require.NoError(t, deleteErr)
		})
	}

	err = th.App.clearLatestVersionCache()
	require.NoError(t, err)

	live, err := th.App.buildHealthSnapshotWithLatestVersionURL(th.Context, latestVersionServer(t).URL)
	require.NoError(t, err)

	var noCPUProfile time.Duration
	files := th.App.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{CPUProfileDuration: &noCPUProfile})
	readPacket := func(t *testing.T, files []model.FileData) *packet.Packet {
		t.Helper()

		var zipped bytes.Buffer
		require.NoError(t, th.App.WriteZipFile(&zipped, files))
		p, readErr := packet.Read(bytes.NewReader(zipped.Bytes()), int64(zipped.Len()))
		require.NoError(t, readErr)
		assert.Empty(t, p.Warnings)
		assert.NoError(t, packet.FillLatestVersion(th.Context.Context(), p.Snapshot, latestVersionServer(t).URL))
		return p
	}
	offline := readPacket(t, files)
	require.NotEmpty(t, live.Version.Latest)

	if packetNodes != nil {
		var hostnames []string
		for _, node := range offline.Snapshot.Nodes() {
			hostnames = append(hostnames, node.Hostname)
		}
		require.Equal(t, packetNodes, hostnames)
		leader, ok := offline.Snapshot.Leader()
		require.True(t, ok)
		liveLeader, ok := live.Leader()
		require.True(t, ok)
		assert.Equal(t, liveLeader.Hostname, leader.Hostname)
	}

	evaluatedAt := time.Now()
	engine := healthcheck.NewEngine(healthcheck.EngineOpts{
		Registry: healthcheck.Builtin(),
		Now:      func() time.Time { return evaluatedAt },
	})
	evaluate := func(t *testing.T, snapshot *healthcheck.Snapshot) []healthcheck.Evaluation {
		t.Helper()

		evaluations := engine.Evaluate(snapshot)
		// Independently sampled values can differ between the live and packet collections.
		for i := range evaluations {
			switch evaluations[i].Code {
			case "NODE_FD_EXHAUSTION", "FILESTORE_DISK_LOW", "FILESTORE_DISK_FULL", "DB_POOL_SATURATED":
				require.NotNil(t, evaluations[i].Result.Value)
				evaluations[i].Result.Value = nil
				evaluations[i].Result.Details = nil
			case "NODE_HOST_MEMORY_LOW", "NODE_CONTAINER_MEMORY_PRESSURE", "NODE_HOST_LOAD_HIGH", "NODE_CPU_THROTTLED":
				// These set a value only when they have the numbers to compare, so none is required.
				evaluations[i].Result.Value = nil
				evaluations[i].Result.Details = nil
			}
		}
		return evaluations
	}
	liveEvaluations := evaluate(t, live)

	require.NotEmpty(t, liveEvaluations)
	assert.Equal(t, liveEvaluations, evaluate(t, offline.Snapshot))

	states := map[string]healthcheck.State{}
	for _, evaluation := range liveEvaluations {
		// Job rules report one subject per job type; any firing subject makes the code firing.
		if states[evaluation.Code] != healthcheck.StateFiring {
			states[evaluation.Code] = evaluation.Result.State
		}
		if evaluation.Code == "LICENSE_EXPIRING" {
			assert.Equal(t, "health.rule.license_expiring.message.trial", evaluation.Result.MessageID)
		}
	}
	for code, want := range map[string]healthcheck.State{
		"COMPLIANCE_NO_DIR":     healthcheck.StateFiring,
		"DB_QUERY_TIMEOUT_HIGH": healthcheck.StateFiring,
		"JOB_FAILED":            healthcheck.StateFiring,
		"JOB_STUCK":             healthcheck.StateFiring,
		"PUSH_BAD_SCHEME":       healthcheck.StateFiring,
		"PUSH_ID_ONLY":          healthcheck.StateFiring,
		"SITE_URL_HTTP":         healthcheck.StateFiring,
		"LICENSE_EXPIRED":       healthcheck.StateResolved,
		"LICENSE_EXPIRING":      healthcheck.StateFiring,
		"SEATS_OVER_DEPLOYED":   healthcheck.StateResolved,
		"SEATS_LIMIT_REACHED":   healthcheck.StateResolved,
		"SEATS_NEAR_CAPACITY":   healthcheck.StateResolved,
	} {
		assert.Equal(t, want, states[code], code)
	}

	t.Run("a packet without the license expiry differs only in the codes that need it", func(t *testing.T) {
		olderFiles := slices.Clone(files)
		stripped := 0
		for i, file := range olderFiles {
			if path.Base(file.Filename) == model.SupportPacketDiagnosticsFileName {
				expiresAt := []byte("  expires_at: " + strconv.FormatInt(license.ExpiresAt, 10) + "\n")
				require.Contains(t, string(file.Body), string(expiresAt))
				olderFiles[i].Body = bytes.Replace(file.Body, expiresAt, nil, 1)
				stripped++
			}
		}
		require.Equal(t, max(len(packetNodes), 1), stripped)

		needsExpiry := []string{"LICENSE_EXPIRED", "LICENSE_EXPIRING", "SEATS_LIMIT_REACHED"}
		older := readPacket(t, olderFiles)
		olderEvaluations := evaluate(t, older.Snapshot)
		require.Len(t, olderEvaluations, len(liveEvaluations))
		for i, evaluation := range olderEvaluations {
			if slices.Contains(needsExpiry, evaluation.Code) {
				assert.Equal(t, healthcheck.StateUnknown, evaluation.Result.State, evaluation.Code)
				assert.Equal(t, healthcheck.ReasonLicenseUnavailable, evaluation.Result.MessageID, evaluation.Code)
			} else {
				assert.Equal(t, liveEvaluations[i], evaluation, evaluation.Code)
			}
		}
	})
}

func latestVersionServer(t *testing.T) *httptest.Server {
	t.Helper()

	release := &model.GithubReleaseInfo{
		Id:          1,
		TagName:     "v11.0.0",
		Name:        "v11.0.0",
		CreatedAt:   "2022-01-13T14:19:44Z",
		PublishedAt: "2022-01-14T13:45:09Z",
		Body:        "Mattermost Platform Release",
		Url:         "https://github.com/mattermost/mattermost-server/releases/tag/v11.0.0",
	}

	body, err := json.Marshal(release)
	require.NoError(t, err)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, writeErr := w.Write(body)
		assert.NoError(t, writeErr)
	}))
	t.Cleanup(server.Close)

	return server
}
