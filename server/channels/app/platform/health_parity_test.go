// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/packet"
	"github.com/mattermost/mattermost/server/v8/platform/shared/releases"
)

// parityVersions returns a supported regular release for the fixture servers to run and a latest
// release two minors past the newest line in the table, so the version rules read the latest
// release whatever today's date.
func parityVersions(t *testing.T) (running, latest string) {
	t.Helper()

	table := model.ReleaseLifecycles()
	i := slices.IndexFunc(table, func(l model.ReleaseLifecycle) bool { return !l.ESR && time.Now().Before(l.EOLDate) })
	require.NotEqual(t, -1, i, "model.ReleaseLifecycles has no supported regular release")
	major, minor, _ := model.SplitVersion(table[0].MajorMinor)
	return table[i].MajorMinor + ".0", fmt.Sprintf("%d.%d.0", major, minor+2)
}

// A live snapshot and the Support Packet written from it evaluate the same, however the live
// check got, or didn't get, the latest release. The snapshot is built from the packet fixtures;
// TestHealthSnapshotLiveOfflineParity and the mmctl e2e test cover real collection.
// It is scaffolding for the collection-failure cases MM-71665 and MM-72006 will add.
func TestHealthLiveOfflineParityRoundTrip(t *testing.T) {
	mainHelper.Parallel(t)

	running, latest := parityVersions(t)
	serveLatest := func(w http.ResponseWriter, _ *http.Request) {
		_, _ = fmt.Fprintf(w, `{"id": 1, "tag_name": "v%s"}`, latest)
	}

	cases := []struct {
		name string
		// mutate injects the condition into the live snapshot.
		mutate func(live *healthcheck.Snapshot)
		// latestRelease serves the fetch mmctl runs for the packet.
		latestRelease http.HandlerFunc
		// allow lists the codes live and offline may evaluate differently, each with the reason.
		allow map[string]string
	}{
		{name: "every section collected", latestRelease: serveLatest},
		{
			name: "security fix alerts are off",
			mutate: func(live *healthcheck.Snapshot) {
				live.Config.ServiceSettings.EnableSecurityFixAlert = model.NewPointer(false)
				live.Version.Latest = ""
			},
			latestRelease: serveLatest,
			allow: map[string]string{
				"VERSION_BEHIND":     "mmctl fetches the latest release whatever the packet's EnableSecurityFixAlert says",
				"VERSION_BEHIND_ONE": "mmctl fetches the latest release whatever the packet's EnableSecurityFixAlert says",
			},
		},
		{
			name: "the latest-release fetch failed",
			mutate: func(live *healthcheck.Snapshot) {
				live.Version.Latest = ""
				live.Sections[model.SectionVersion] = errors.New("unexpected status code 502")
			},
			latestRelease: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusBadGateway)
			},
		},
	}

	for _, fixture := range []string{"standalone", "ha"} {
		for _, tc := range cases {
			t.Run(fixture+"/"+tc.name, func(t *testing.T) {
				live := parityLiveSnapshot(t, fixture, running, latest)
				if tc.mutate != nil {
					tc.mutate(live)
				}
				offline := parityRoundTrip(t, live, tc.latestRelease)

				engine := healthcheck.NewEngine(healthcheck.EngineOpts{
					Registry: healthcheck.Builtin(),
					Now:      func() time.Time { return live.CollectedAt },
				})
				differing := map[string]bool{}
				for _, difference := range parityDifferences(engine.Evaluate(live), engine.Evaluate(offline)) {
					differing[difference.code] = true
					_, allowed := tc.allow[difference.code]
					assert.True(t, allowed, difference.String())
				}
				for code := range tc.allow {
					assert.True(t, differing[code], "%s is allowed to differ, but evaluates the same; remove it from allow", code)
				}
			})
		}
	}
}

// parityLiveSnapshot builds the snapshot a live check of the fixture cluster would build: the
// nodes through healthNodes, as CollectHealthNodes does, and every workspace section collected.
// Every node runs version running, the first by hostname runs the check, and the latest-release
// fetch returned latest.
func parityLiveSnapshot(t *testing.T, fixture, running, latest string) *healthcheck.Snapshot {
	t.Helper()

	collected := readParityFixture(t, fixture)

	var infos []*model.ClusterInfo
	replies := map[string]*model.NodeDiagnostics{}
	nodes := collected.Nodes()
	for _, node := range nodes {
		diag, ok := node.Diag()
		require.True(t, ok)
		diag.Server.Version = running
		if len(nodes) == 1 {
			replies[""] = node.Diagnostics
			continue
		}
		replies[node.Hostname] = node.Diagnostics
		infos = append(infos, &model.ClusterInfo{
			Id:            node.Hostname,
			Hostname:      node.Hostname,
			Version:       running + ".12345",
			SchemaVersion: model.SafeDereference(diag.Database.SchemaVersion),
			IPAddress:     "10.0.0.1",
		})
	}
	localID := ""
	if len(infos) > 0 {
		localID = infos[0].Id
	}

	live := healthcheck.NewSnapshot(healthNodes(infos, localID, replies))
	live.CollectedAt = collected.CollectedAt
	live.Config = collected.Config
	live.Stats = collected.Stats
	live.Jobs = collected.Jobs
	live.Plugins = collected.Plugins
	live.Version.Current = running
	live.Version.Latest = latest
	live.Sections = map[model.WorkspaceSection]error{}
	for _, section := range model.AllWorkspaceSections() {
		live.Sections[section] = nil
	}
	return live
}

func readParityFixture(t *testing.T, fixture string) *healthcheck.Snapshot {
	t.Helper()

	dir := filepath.Join(server.GetPackagePath(), "platform", "shared", "healthcheck", "packet", "testdata", fixture)
	var zipped bytes.Buffer
	zw := zip.NewWriter(&zipped)
	require.NoError(t, zw.AddFS(os.DirFS(dir)))
	require.NoError(t, zw.Close())
	p, err := packet.Read(bytes.NewReader(zipped.Bytes()), int64(zipped.Len()))
	require.NoError(t, err)
	return p.Snapshot
}

// parityRoundTrip writes live with the server's packet writers, laid out as GenerateSupportPacket
// lays out a packet, reads it back as mmctl does and fetches the latest release as mmctl does.
func parityRoundTrip(t *testing.T, live *healthcheck.Snapshot, latestRelease http.HandlerFunc) *healthcheck.Snapshot {
	t.Helper()

	var files []model.FileData
	addIn := func(dir string) func(*model.FileData, error) {
		return func(file *model.FileData, err error) {
			require.NoError(t, err)
			require.NotNil(t, file)
			files = append(files, model.FileData{Filename: path.Join(dir, file.Filename), Body: file.Body})
		}
	}

	for _, node := range live.Nodes() {
		diag, ok := node.Diag()
		require.True(t, ok)
		dir := ""
		if node.ClusterInfo != nil {
			dir = node.Hostname
		}
		addIn(dir)(supportPacketDiagnosticsFile(diag, nil))
		addIn(dir)(supportPacketConfigFile(live.Config, nil))
	}

	metadata, err := model.GeneratePacketMetadata(model.SupportPacketType, model.NewId(), nil, nil)
	require.NoError(t, err)
	metadata.GeneratedAt = live.CollectedAt.UnixMilli()
	metadata.ServerVersion = live.Version.Current
	addIn("")(YAMLFile(model.PacketMetadataFileName, metadata, nil))
	addIn("")(YAMLFile(model.SupportPacketStatsFileName, live.Stats, nil))
	addIn("")(YAMLFile(model.SupportPacketJobsFileName, live.Jobs, nil))
	addIn("")(JSONFile(model.SupportPacketPluginsFileName, live.Plugins, nil))

	var zipped bytes.Buffer
	zw := zip.NewWriter(&zipped)
	for _, file := range files {
		w, createErr := zw.Create(file.Filename)
		require.NoError(t, createErr)
		_, err = w.Write(file.Body)
		require.NoError(t, err)
	}
	require.NoError(t, zw.Close())

	p, err := packet.Read(bytes.NewReader(zipped.Bytes()), int64(zipped.Len()))
	require.NoError(t, err)

	release := httptest.NewServer(latestRelease)
	t.Cleanup(release.Close)
	// As in mmctl, a failed fetch leaves Latest empty and the version rules unknown.
	if latest, fetchErr := releases.LatestVersion(context.Background(), release.URL); fetchErr == nil {
		p.Snapshot.Version.Latest = latest
	}

	return p.Snapshot
}

type parityDifference struct {
	code, subject, scope string
	// live and offline are nil when that side has no result.
	live, offline *healthcheck.Result
}

func (d parityDifference) String() string {
	name := d.code
	if d.scope != "" {
		name += " on " + d.scope
	}
	if d.subject != "" {
		name += " for " + d.subject
	}
	describe := func(result *healthcheck.Result) string {
		if result == nil {
			return "missing"
		}
		return fmt.Sprintf("%s (%s)", result.State, result.MessageID)
	}
	return fmt.Sprintf("%s is %s live, %s offline", name, describe(d.live), describe(d.offline))
}

// parityDifferences returns each result live and offline disagree on.
func parityDifferences(live, offline []healthcheck.Evaluation) []parityDifference {
	type key struct{ code, subject, scope string }
	index := func(evaluations []healthcheck.Evaluation) map[key]*healthcheck.Result {
		results := map[key]*healthcheck.Result{}
		for _, evaluation := range evaluations {
			results[key{evaluation.Code, evaluation.Result.Subject, evaluation.Result.Scope}] = &evaluation.Result
		}
		return results
	}
	liveResults, offlineResults := index(live), index(offline)

	var differences []parityDifference
	for k, liveResult := range liveResults {
		if offlineResult := offlineResults[k]; offlineResult == nil || !assert.ObjectsAreEqual(*liveResult, *offlineResult) {
			differences = append(differences, parityDifference{code: k.code, subject: k.subject, scope: k.scope, live: liveResult, offline: offlineResult})
		}
	}
	for k, offlineResult := range offlineResults {
		if liveResults[k] == nil {
			differences = append(differences, parityDifference{code: k.code, subject: k.subject, scope: k.scope, offline: offlineResult})
		}
	}
	return differences
}
