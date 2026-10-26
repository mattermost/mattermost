// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"maps"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/mattermost/logr/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

func TestGetLatestVersion(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	version := &model.GithubReleaseInfo{
		Id:          57117096,
		TagName:     "v6.3.0",
		Name:        "v6.3.0",
		CreatedAt:   "2022-01-13T14:19:44Z",
		PublishedAt: "2022-01-14T13:45:09Z",
		Body:        "Mattermost Platform Release v6.3.0",
		Url:         "https://github.com/mattermost/mattermost-server/releases/tag/v6.3.0",
	}

	validJSON, jsonErr := json.Marshal(version)
	require.NoError(t, jsonErr)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := w.Write(validJSON)
		require.NoError(t, err)
	}))
	defer ts.Close()

	t.Run("get latest mm version happy path", func(t *testing.T) {
		_, err := th.App.GetLatestVersion(th.Context, ts.URL)
		require.Nil(t, err)
	})

	t.Run("get latest mm version from cache", func(t *testing.T) {
		err := th.App.clearLatestVersionCache()
		require.NoError(t, err)
		originalResult, appErr := th.App.GetLatestVersion(th.Context, ts.URL)
		require.Nil(t, appErr)

		// Call same function but mock the GET request to return a different result.
		// We are hoping the function will use the cache instead of making the GET request
		v := &model.GithubReleaseInfo{
			Id:          57117096,
			TagName:     "v6.3.1",
			Name:        "v6.3.1",
			CreatedAt:   "2022-01-13T14:19:44Z",
			PublishedAt: "2022-01-14T13:45:09Z",
			Body:        "Mattermost Platform Release v6.3.0",
			Url:         "https://github.com/mattermost/mattermost-server/releases/tag/v6.3.0",
		}

		updatedJSON, jsonErr := json.Marshal(v)
		require.NoError(t, jsonErr)

		updatedServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, err := w.Write(updatedJSON)
			require.NoError(t, err)
		}))
		defer updatedServer.Close()

		cachedResult, appErr := th.App.GetLatestVersion(th.Context, updatedServer.URL)
		require.Nil(t, appErr)

		require.Equal(t, originalResult.TagName, cachedResult.TagName, "did not get cached result")
	})

	t.Run("get latest mm version error from external", func(t *testing.T) {
		err := th.App.clearLatestVersionCache()
		require.NoError(t, err)

		errorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			_, err := w.Write([]byte(`
				{
					"message": "internal server error"
				}
			`))
			require.NoError(t, err)
		}))
		defer errorServer.Close()

		_, appErr := th.App.GetLatestVersion(th.Context, errorServer.URL)
		require.NotNil(t, appErr)
	})
}

type queryLogsCluster struct {
	testlib.FakeClusterInterface
	info           *model.ClusterInfo
	remoteLogs     map[string]einterfaces.NodeLogs
	queryLogsErr   *model.AppError
	queryLogsCalls int
	lastFilter     *model.LogFilter
}

func (c *queryLogsCluster) GetMyClusterInfo() *model.ClusterInfo { return c.info }

func (c *queryLogsCluster) QueryLogs(rctx request.CTX, page, perPage int, logFilter *model.LogFilter) (map[string]einterfaces.NodeLogs, *model.AppError) {
	c.queryLogsCalls++
	c.lastFilter = logFilter
	if c.queryLogsErr != nil {
		return nil, c.queryLogsErr
	}
	return c.remoteLogs, nil
}

func TestQueryLogs(t *testing.T) {
	mainHelper.Parallel(t)

	nodeNames := func(logs map[string][]string) []string {
		return slices.Collect(maps.Keys(logs))
	}

	t.Run("cluster", func(t *testing.T) {
		cluster := &queryLogsCluster{
			info: &model.ClusterInfo{Hostname: "node-1"},
			remoteLogs: map[string]einterfaces.NodeLogs{
				"node-2": {Lines: []string{`{"msg":"from node-2"}`}},
				"node-3": {Lines: []string{`{"msg":"from node-3"}`}},
			},
		}
		th := SetupWithClusterMock(t, cluster)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ClusterSettings.Enable = true
			*cfg.LogSettings.EnableFile = false
		})

		query := func(t *testing.T, serverNames ...string) map[string][]string {
			t.Helper()
			cluster.queryLogsCalls = 0
			logs, appErr := th.App.QueryLogs(th.Context, 0, 10, &model.LogFilter{ServerNames: serverNames})
			require.Nil(t, appErr)
			return logs
		}

		t.Run("empty filter returns local and all remote nodes", func(t *testing.T) {
			logs := query(t)
			assert.ElementsMatch(t, []string{"node-1", "node-2", "node-3"}, nodeNames(logs))
			assert.Equal(t, []string{`{"msg":"from node-2"}`}, logs["node-2"])
			assert.Equal(t, []string{`{"msg":"from node-3"}`}, logs["node-3"])
		})

		t.Run("local node by hostname skips the cluster query", func(t *testing.T) {
			logs := query(t, "node-1")
			assert.ElementsMatch(t, []string{"node-1"}, nodeNames(logs))
			assert.Equal(t, 0, cluster.queryLogsCalls)
		})

		t.Run("default is an alias for the local node", func(t *testing.T) {
			logs := query(t, "default")
			assert.ElementsMatch(t, []string{"node-1"}, nodeNames(logs))
			assert.Equal(t, 0, cluster.queryLogsCalls)
		})

		t.Run("remote node only excludes local logs", func(t *testing.T) {
			logs := query(t, "node-2")
			assert.ElementsMatch(t, []string{"node-2"}, nodeNames(logs))
			assert.Equal(t, []string{`{"msg":"from node-2"}`}, logs["node-2"])
		})

		t.Run("forwards the filter to the cluster", func(t *testing.T) {
			filter := &model.LogFilter{
				ServerNames: []string{"node-2"},
				LogLevels:   []string{"error"},
				DateFrom:    "2026-01-01 00:00:00.000 +00:00",
				DateTo:      "2026-01-02 00:00:00.000 +00:00",
			}
			_, appErr := th.App.QueryLogs(th.Context, 0, 10, filter)
			require.Nil(t, appErr)
			assert.Equal(t, filter, cluster.lastFilter)
		})

		t.Run("local and remote node", func(t *testing.T) {
			logs := query(t, "node-1", "node-3")
			assert.ElementsMatch(t, []string{"node-1", "node-3"}, nodeNames(logs))
			assert.Equal(t, 1, cluster.queryLogsCalls)
		})

		t.Run("duplicate names", func(t *testing.T) {
			logs := query(t, "node-2", "node-2", "default", "node-1", "unknown")
			assert.ElementsMatch(t, []string{"node-1", "node-2"}, nodeNames(logs))
		})

		t.Run("unknown name returns no entries", func(t *testing.T) {
			logs := query(t, "unknown")
			assert.Empty(t, logs)
			assert.Equal(t, 1, cluster.queryLogsCalls)
		})

		t.Run("missing cluster info falls back to default", func(t *testing.T) {
			cluster.info = nil
			t.Cleanup(func() { cluster.info = &model.ClusterInfo{Hostname: "node-1"} })

			logs := query(t)
			assert.ElementsMatch(t, []string{"default", "node-2", "node-3"}, nodeNames(logs))
		})

		t.Run("failed node is reported as a single error entry", func(t *testing.T) {
			cluster.remoteLogs["node-3"] = einterfaces.NodeLogs{Err: model.NewAppError("GetLogs", "ent.cluster.timeout.error", nil, "simulated failure", http.StatusInternalServerError)}
			t.Cleanup(func() { cluster.remoteLogs["node-3"] = einterfaces.NodeLogs{Lines: []string{`{"msg":"from node-3"}`}} })

			logs := query(t, "node-2", "node-3")
			assert.Equal(t, []string{`{"msg":"from node-2"}`}, logs["node-2"])
			require.Len(t, logs["node-3"], 1)

			var entry model.LogEntry
			require.NoError(t, json.Unmarshal([]byte(logs["node-3"][0]), &entry))
			assert.Equal(t, "error", entry.Level)
			// The webapp's parseTimestamp needs exactly this shape to build an ISO-8601 string.
			assert.Regexp(t, `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} (Z|[+-]\d{2}:\d{2})$`, entry.Timestamp)
			ts, err := time.Parse(logr.DefTimestampFormat, entry.Timestamp)
			require.NoError(t, err)
			assert.WithinDuration(t, time.Now(), ts, time.Minute)

			var fields map[string]string
			require.NoError(t, json.Unmarshal([]byte(logs["node-3"][0]), &fields))
			assert.Equal(t, "Failed to fetch logs from node", fields["msg"])
			assert.Contains(t, fields["error"], "simulated failure")
		})

		t.Run("cluster query error fails the request", func(t *testing.T) {
			cluster.queryLogsErr = model.NewAppError("QueryLogs", "test.cluster_error", nil, "", 500)
			t.Cleanup(func() { cluster.queryLogsErr = nil })

			logs, appErr := th.App.QueryLogs(th.Context, 0, 10, &model.LogFilter{})
			require.NotNil(t, appErr)
			assert.Equal(t, "test.cluster_error", appErr.Id)
			assert.Nil(t, logs)
		})

		t.Run("unlicensed cluster returns only local logs", func(t *testing.T) {
			th.App.Srv().SetLicense(nil)
			t.Cleanup(func() { th.App.Srv().SetLicense(model.NewTestLicense()) })

			logs := query(t)
			assert.ElementsMatch(t, []string{"default"}, nodeNames(logs))
			assert.Equal(t, 0, cluster.queryLogsCalls)

			logs = query(t, "node-2")
			assert.Empty(t, logs)
			assert.Equal(t, 0, cluster.queryLogsCalls)
		})

		t.Run("clustering disabled returns only local logs", func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ClusterSettings.Enable = false })
			t.Cleanup(func() {
				th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ClusterSettings.Enable = true })
			})

			logs := query(t)
			assert.ElementsMatch(t, []string{"default"}, nodeNames(logs))
			assert.Equal(t, 0, cluster.queryLogsCalls)
		})
	})

	t.Run("no cluster", func(t *testing.T) {
		th := Setup(t)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.LogSettings.EnableFile = false })

		logs, appErr := th.App.QueryLogs(th.Context, 0, 10, &model.LogFilter{})
		require.Nil(t, appErr)
		assert.ElementsMatch(t, []string{"default"}, nodeNames(logs))

		logs, appErr = th.App.QueryLogs(th.Context, 0, 10, &model.LogFilter{ServerNames: []string{"node-2"}})
		require.Nil(t, appErr)
		assert.Empty(t, logs)
	})
}
