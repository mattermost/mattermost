// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	elastic "github.com/elastic/go-elasticsearch/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func newTestClient(t *testing.T, handler http.Handler) *elastic.TypedClient {
	t.Helper()
	ts := httptest.NewServer(handler)
	t.Cleanup(ts.Close)

	client, err := elastic.NewTypedClient(elastic.Config{
		Addresses: []string{ts.URL},
	})
	require.NoError(t, err)
	return client
}

func infoHandler(version string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Elastic-Product", "Elasticsearch")
		fmt.Fprintf(w, `{"cluster_name":"test","version":{"number":%q,"build_flavor":"default","build_hash":"abc","build_date":"2024-01-01","build_snapshot":false,"build_type":"docker","lucene_version":"9.0.0","minimum_wire_compatibility_version":"7.0.0","minimum_index_compatibility_version":"7.0.0"}}`, version)
	}
}

func TestCheckVersion(t *testing.T) {
	tests := []struct {
		name          string
		version       string
		wantVersion   string
		wantMajor     int
		wantLog       string
		wantLogFields []string
	}{
		{
			name:        "ES 8 is supported",
			version:     "8.9.0",
			wantVersion: "8.9.0",
			wantMajor:   8,
		},
		{
			name:        "ES 9 is supported",
			version:     "9.0.0",
			wantVersion: "9.0.0",
			wantMajor:   9,
		},
		{
			name:          "ES 7 is too old, but allowed",
			version:       "7.17.0",
			wantVersion:   "7.17.0",
			wantMajor:     7,
			wantLog:       "Unsupported Elasticsearch version",
			wantLogFields: []string{`"version":"7.17.0"`, `"min_version":8`, `"max_version":9`},
		},
		{
			name:          "ES 10 is too new, but allowed",
			version:       "10.0.0",
			wantVersion:   "10.0.0",
			wantMajor:     10,
			wantLog:       "Unsupported Elasticsearch version",
			wantLogFields: []string{`"version":"10.0.0"`, `"min_version":8`, `"max_version":9`},
		},
		{
			name:          "unparseable version is allowed",
			version:       "invalid",
			wantVersion:   "invalid",
			wantMajor:     0,
			wantLog:       "Failed to parse the Elasticsearch version",
			wantLogFields: []string{`"version":"invalid"`},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			logger := mlog.CreateConsoleTestLogger(t)
			var buf mlog.Buffer
			require.NoError(t, mlog.AddWriterTarget(logger, &buf, true, mlog.LvlError))

			client := newTestClient(t, infoHandler(tc.version))
			version, major := checkVersion(context.Background(), client, logger)
			require.NoError(t, logger.Flush())

			assert.Equal(t, tc.wantVersion, version)
			assert.Equal(t, tc.wantMajor, major)

			if tc.wantLog == "" {
				assert.Empty(t, buf.String())
				return
			}

			assert.Contains(t, buf.String(), tc.wantLog)
			for _, field := range tc.wantLogFields {
				assert.Contains(t, buf.String(), field)
			}
		})
	}
}

func TestCheckVersionConnectionError(t *testing.T) {
	ts := httptest.NewServer(http.NotFoundHandler())
	ts.Close() // close immediately to force connection error

	client, err := elastic.NewTypedClient(elastic.Config{
		Addresses:  []string{ts.URL},
		MaxRetries: 0,
	})
	require.NoError(t, err)

	logger := mlog.CreateConsoleTestLogger(t)
	var buf mlog.Buffer
	require.NoError(t, mlog.AddWriterTarget(logger, &buf, true, mlog.LvlError))

	// An unreachable server is logged, but must not fail the caller.
	version, major := checkVersion(context.Background(), client, logger)
	require.NoError(t, logger.Flush())

	assert.Empty(t, version)
	assert.Zero(t, major)
	assert.Contains(t, buf.String(), "Failed to get the Elasticsearch version")
}
