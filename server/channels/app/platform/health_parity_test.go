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
	// skipped if every difference has the shape gapShape describes; any other difference fails.
	knownGap string
	gapShape func(d parityDifference) bool
}

// unknownLive is the shape of a failed section: live can't evaluate what offline reads from the
// data the failed collector wrote anyway. sameState lists the codes whose results may also differ
// in what they carry while both sides agree on the state.
func unknownLive(sameState ...string) func(d parityDifference) bool {
	return func(d parityDifference) bool {
		if d.live == nil {
			return false
		}
		if d.live.State == healthcheck.StateUnknown {
			return true
		}
		return d.offline != nil && d.live.State == d.offline.State && slices.Contains(sameState, d.code)
	}
}

// missingOffline is the shape of a node that failed during packet generation: offline has nothing
// for it.
func missingOffline(hostname string) func(d parityDifference) bool {
	return func(d parityDifference) bool {
		return d.scope == hostname && d.live != nil && d.offline == nil
	}
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
			gapShape: missingOffline("app-3.example.com"),
		},
		{
			name:   "the leader failed during packet generation",
			haOnly: true,
			reply: func(replies map[string]*model.NodeDiagnostics) {
				delete(replies, "app-2.example.com")
			},
			knownGap: "MM-72006",
			gapShape: missingOffline("app-2.example.com"),
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
	sameStateGaps := map[model.NodeSection][]string{
		model.SectionLicense: {"DB_NO_SEARCH_REPLICA"},
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
			gapShape: unknownLive(sameStateGaps[section]...),
		})
	}
	// Each workspace collector fails the way it can: stats and jobs keep what they collected, and
	// the plugins list is not written at all.
	collectionFailed := errors.New("collection failed")
	cases = append(cases,
		parityCase{
			name: "section stats failed",
			mutate: func(live *healthcheck.Snapshot) {
				live.Stats.Channels = nil
				live.Sections[model.SectionStats] = collectionFailed
			},
			knownGap: "MM-71665",
			gapShape: unknownLive(),
		},
		parityCase{
			name: "section jobs failed",
			mutate: func(live *healthcheck.Snapshot) {
				live.Jobs.DataRetentionJobs = nil
				live.Sections[model.SectionJobs] = collectionFailed
			},
			knownGap: "MM-71665",
			gapShape: unknownLive(),
		},
		parityCase{
			name: "section plugins failed",
			mutate: func(live *healthcheck.Snapshot) {
				live.Plugins = nil
				live.Sections[model.SectionPlugins] = collectionFailed
			},
			knownGap: "MM-71665",
			gapShape: unknownLive(),
		},
	)

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
				var differences, gap, unexpected []string
				for _, d := range parityDifferences(liveEvaluations, engine.Evaluate(offline)) {
					if _, ok := tc.allow[d.code]; ok {
						if allowedDiffered[tc.name] == nil {
							allowedDiffered[tc.name] = map[string]bool{}
						}
						allowedDiffered[tc.name][d.code] = true
						continue
					}
					differences = append(differences, d.String())
					if tc.gapShape != nil && tc.gapShape(d) {
						gap = append(gap, d.String())
					} else {
						unexpected = append(unexpected, d.String())
					}
				}
				if tc.knownGap != "" && len(differences) > 0 && len(unexpected) == 0 {
					t.Skipf("%s: live and offline differ in %s", tc.knownGap, strings.Join(gap, "; "))
				}
				assert.Empty(t, unexpected)

				for _, evaluation := range liveEvaluations {
					if _, allowed := tc.allow[evaluation.Code]; !allowed && evaluation.Result.State != healthcheck.StateUnknown {
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
			if file == nil {
				return
			}
			files = append(files, model.FileData{Filename: path.Join(dir, file.Filename), Body: file.Body})
		}
	}

	for _, node := range live.Nodes() {
		// A node that failed to generate its files leaves only its error, as the cluster writes it.
		diag, ok := node.Diag()
		if !ok {
			files = append(files, model.FileData{Filename: path.Join(node.Hostname, model.SupportPacketErrorFile), Body: []byte("failed to generate the node's Support Packet")})
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
	// A failed fetch is a case of its own; it leaves the version rules unknown, as in mmctl.
	_ = packet.FillLatestVersion(context.Background(), p.Snapshot, release.URL)

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

// parityDifferences returns each result live and offline disagree on, sorted.
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

	keys := slices.Collect(maps.Keys(liveResults))
	for k := range offlineResults {
		if _, ok := liveResults[k]; !ok {
			keys = append(keys, k)
		}
	}

	var differences []parityDifference
	for _, k := range keys {
		liveResult, offlineResult := liveResults[k], offlineResults[k]
		if liveResult != nil && offlineResult != nil && assert.ObjectsAreEqual(*liveResult, *offlineResult) {
			continue
		}
		differences = append(differences, parityDifference{code: k.code, subject: k.subject, scope: k.scope, live: liveResult, offline: offlineResult})
	}
	slices.SortFunc(differences, func(a, b parityDifference) int { return strings.Compare(a.String(), b.String()) })
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
