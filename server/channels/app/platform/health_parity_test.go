// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/packet"
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

type parityCase struct {
	name string
	// haOnly runs the case against the HA fixture only.
	haOnly bool
	// reply edits what the nodes replied before the live snapshot is built from the replies.
	reply func(replies map[string]*model.NodeDiagnostics)
	// mutate injects the condition into the live snapshot.
	mutate func(live *healthcheck.Snapshot)
	// editPacket edits the packet files before they are read back.
	editPacket func(t *testing.T, files []model.FileData)
	// latestRelease serves mmctl's latest-release fetch. It defaults to the release the live
	// collection fetched.
	latestRelease http.HandlerFunc
	// allow lists the codes live and offline may evaluate differently, each with the reason.
	allow map[string]string
	// knownGap is the ticket that will make live and offline agree. Until it lands the case is
	// skipped when they don't.
	knownGap string
}

// Live and offline evaluations of the same server agree: a live snapshot, written the way the
// server writes a Support Packet and read back the way mmctl reads it, evaluates the same, also
// when collection failed.
func TestHealthLiveOfflineParityRoundTrip(t *testing.T) {
	mainHelper.Parallel(t)

	running, latest := parityVersions(t)
	cases := []parityCase{
		{name: "every section collected"},
		// In the HA fixture app-2 is the leader, and app-1 runs the check.
		{
			name:   "a follower failed during packet generation",
			haOnly: true,
			reply: func(replies map[string]*model.NodeDiagnostics) {
				delete(replies, "app-3.example.com")
			},
			knownGap: "MM-72006",
		},
		{
			name:   "the leader failed during packet generation",
			haOnly: true,
			reply: func(replies map[string]*model.NodeDiagnostics) {
				delete(replies, "app-2.example.com")
			},
			knownGap: "MM-72006",
		},
		{
			name: "security fix alerts are off",
			mutate: func(live *healthcheck.Snapshot) {
				live.Config.ServiceSettings.EnableSecurityFixAlert = model.NewPointer(false)
				live.Version.Latest = ""
			},
			allow: map[string]string{
				"VERSION_BEHIND":     "mmctl fetches the latest release even when the server has EnableSecurityFixAlert off",
				"VERSION_BEHIND_ONE": "mmctl fetches the latest release even when the server has EnableSecurityFixAlert off",
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
		{
			name:   "a packet from an older server, without the fields added since",
			haOnly: true,
			editPacket: func(t *testing.T, files []model.FileData) {
				stripDiagnosticsFields(t, files, "  expires_at: ", "  is_leader: ")
			},
			allow: map[string]string{
				"LICENSE_EXPIRED":     "older packets don't record license.expires_at",
				"LICENSE_EXPIRING":    "older packets don't record license.expires_at",
				"SEATS_LIMIT_REACHED": "older packets don't record license.expires_at, which the grace period is counted from",
			},
		},
		{
			name: "nodes report CPU limits and load",
			reply: func(replies map[string]*model.NodeDiagnostics) {
				for _, reply := range replies {
					reply.Diagnostics.Server.GoMaxProcs = model.NewPointer(8)
					reply.Diagnostics.Server.ContainerCPULimit = 2
					reply.Diagnostics.Server.LoadAverage15m = model.NewPointer(1.5)
				}
			},
		},
	}
	for _, section := range model.AllNodeSections() {
		cases = append(cases, parityCase{
			name: fmt.Sprintf("section %s failed", section),
			reply: func(replies map[string]*model.NodeDiagnostics) {
				for _, reply := range replies {
					reply.Errors[section] = errors.New("collection failed")
				}
			},
			knownGap: "MM-71665",
		})
	}

	evaluated := map[string]bool{}
	allowedDiffered := map[string]map[string]bool{}
	var runs, ran int
	for _, fixture := range []string{"standalone", "ha"} {
		for _, tc := range cases {
			if tc.haOnly && fixture != "ha" {
				continue
			}
			runs++
			t.Run(fixture+"/"+tc.name, func(t *testing.T) {
				ran++
				live := parityLiveSnapshot(t, fixture, running, latest, tc.reply)
				if tc.mutate != nil {
					tc.mutate(live)
				}
				latestRelease := tc.latestRelease
				if latestRelease == nil {
					latestRelease = func(w http.ResponseWriter, _ *http.Request) {
						_, _ = fmt.Fprintf(w, `{"id": 1, "tag_name": "v%s"}`, latest)
					}
				}
				offline := parityRoundTrip(t, live, latestRelease, tc.editPacket)

				engine := healthcheck.NewEngine(healthcheck.EngineOpts{
					Registry: healthcheck.Builtin(),
					Now:      func() time.Time { return live.CollectedAt },
				})
				liveEvaluations := engine.Evaluate(live)
				var differences []string
				for code, descriptions := range parityDifferences(liveEvaluations, engine.Evaluate(offline)) {
					if _, ok := tc.allow[code]; ok {
						if allowedDiffered[tc.name] == nil {
							allowedDiffered[tc.name] = map[string]bool{}
						}
						allowedDiffered[tc.name][code] = true
						continue
					}
					differences = append(differences, descriptions...)
				}
				slices.Sort(differences)
				if tc.knownGap != "" && len(differences) > 0 {
					t.Skipf("%s: live and offline differ in %s", tc.knownGap, strings.Join(differences, "; "))
				}
				assert.Empty(t, differences)

				for _, evaluation := range liveEvaluations {
					if evaluation.Result.State != healthcheck.StateUnknown {
						evaluated[evaluation.Code] = true
					}
				}
			})
		}
	}

	// The checks below need every case; -run may have selected only some.
	if ran < runs {
		return
	}
	for _, tc := range cases {
		for code := range tc.allow {
			assert.True(t, allowedDiffered[tc.name][code], "%q allows %s to differ, but it evaluates the same; remove it from allow", tc.name, code)
		}
	}
	for _, rule := range healthcheck.Builtin().Rules() {
		assert.True(t, evaluated[rule.Code], "no case evaluates %s to firing or resolved, so it is never compared", rule.Code)
	}
}

// parityLiveSnapshot builds the snapshot a live collection of the fixture cluster would build: the
// nodes through healthNodes, as CollectHealthNodes does, and every workspace section collected.
// Every node runs version running, the first by hostname runs the check, and the latest-release
// fetch returned latest. Replies are keyed by hostname.
func parityLiveSnapshot(t *testing.T, fixture, running, latest string, reply func(replies map[string]*model.NodeDiagnostics)) *healthcheck.Snapshot {
	t.Helper()

	collected := readParityFixture(t, fixture)

	var infos []*model.ClusterInfo
	replies := map[string]*model.NodeDiagnostics{}
	nodes := collected.Nodes()
	for _, node := range nodes {
		diag, ok := node.Diag()
		require.True(t, ok)
		diag.Server.Version = running
	}
	if len(nodes) == 1 {
		replies[""] = nodes[0].Diagnostics
	} else {
		for _, node := range nodes {
			diag, _ := node.Diag()
			replies[node.Hostname] = node.Diagnostics
			infos = append(infos, &model.ClusterInfo{
				Id:            node.Hostname,
				Hostname:      node.Hostname,
				Version:       diag.Server.Version + ".12345",
				SchemaVersion: model.SafeDereference(diag.Database.SchemaVersion),
				IPAddress:     "10.0.0.1",
			})
		}
	}
	if reply != nil {
		reply(replies)
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
// lays out a packet, reads it back as mmctl does and fills the latest release as mmctl does.
func parityRoundTrip(t *testing.T, live *healthcheck.Snapshot, latestRelease http.HandlerFunc, editPacket func(*testing.T, []model.FileData)) *healthcheck.Snapshot {
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
		// A node that failed to generate its files leaves no directory.
		diag, ok := node.Diag()
		if !ok {
			continue
		}
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

	if editPacket != nil {
		editPacket(t, files)
	}

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
	packet.FillLatestVersion(context.Background(), p.Snapshot, release.URL)

	return p.Snapshot
}

// parityDifferences describes each result live and offline disagree on, by code.
func parityDifferences(live, offline []healthcheck.Evaluation) map[string][]string {
	type key struct{ code, subject, scope string }
	index := func(evaluations []healthcheck.Evaluation) map[key]healthcheck.Result {
		results := map[key]healthcheck.Result{}
		for _, evaluation := range evaluations {
			results[key{evaluation.Code, evaluation.Result.Subject, evaluation.Result.Scope}] = evaluation.Result
		}
		return results
	}
	liveResults, offlineResults := index(live), index(offline)

	keys := slices.Collect(maps.Keys(liveResults))
	for k := range offlineResults {
		if _, ok := liveResults[k]; !ok {
			keys = append(keys, k)
		}
	}

	describe := func(result healthcheck.Result, ok bool) string {
		if !ok {
			return "missing"
		}
		return fmt.Sprintf("%s (%s)", result.State, result.MessageID)
	}

	differences := map[string][]string{}
	for _, k := range keys {
		liveResult, liveOK := liveResults[k]
		offlineResult, offlineOK := offlineResults[k]
		if liveOK && offlineOK && assert.ObjectsAreEqual(liveResult, offlineResult) {
			continue
		}
		name := k.code
		if k.scope != "" {
			name += " on " + k.scope
		}
		if k.subject != "" {
			name += " for " + k.subject
		}
		differences[k.code] = append(differences[k.code], fmt.Sprintf("%s is %s live, %s offline", name, describe(liveResult, liveOK), describe(offlineResult, offlineOK)))
	}
	return differences
}

// stripDiagnosticsFields makes every diagnostics.yaml look like one from an older server: version 1,
// without the lines starting with prefixes. Each prefix must be found in at least one file.
func stripDiagnosticsFields(t *testing.T, files []model.FileData, prefixes ...string) {
	t.Helper()

	stripped := map[string]bool{}
	for i, file := range files {
		if path.Base(file.Filename) != model.SupportPacketDiagnosticsFileName {
			continue
		}
		lines := strings.SplitAfter(string(file.Body), "\n")
		require.Equal(t, fmt.Sprintf("version: %d\n", model.CurrentSupportPacketVersion), lines[0])
		lines[0] = "version: 1\n"
		lines = slices.DeleteFunc(lines, func(line string) bool {
			for _, prefix := range prefixes {
				if strings.HasPrefix(line, prefix) {
					stripped[prefix] = true
					return true
				}
			}
			return false
		})
		files[i].Body = []byte(strings.Join(lines, ""))
	}
	for _, prefix := range prefixes {
		require.True(t, stripped[prefix], "no diagnostics.yaml has a line starting with %q", prefix)
	}
}
