// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/opensearch-project/opensearch-go/v4"
	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func newTestClient(t *testing.T, handler http.Handler) *opensearchapi.Client {
	t.Helper()
	ts := httptest.NewServer(handler)
	t.Cleanup(ts.Close)

	client, err := opensearchapi.NewClient(opensearchapi.Config{
		Client: opensearch.Config{
			Addresses:  []string{ts.URL},
			MaxRetries: 0,
		},
	})
	require.NoError(t, err)
	return client
}

func infoHandler(version string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"name":"node","cluster_name":"test","cluster_uuid":"abc","version":{"distribution":"opensearch","number":%q,"build_type":"tar","build_hash":"abc","build_date":"2024-01-01","build_snapshot":false,"lucene_version":"9.7.0","minimum_wire_compatibility_version":"7.10.0","minimum_index_compatibility_version":"7.0.0"},"tagline":"The OpenSearch Project: https://opensearch.org/"}`, version)
	}
}

func TestCheckVersion(t *testing.T) {
	tests := []struct {
		name            string
		version         string
		wantVersion     string
		wantMajor       int
		wantErrID       string
		wantUnsupported bool
	}{
		{
			name:        "OpenSearch 2 is supported",
			version:     "2.11.0",
			wantVersion: "2.11.0",
			wantMajor:   2,
		},
		{
			name:        "OpenSearch 3 is supported",
			version:     "3.0.0",
			wantVersion: "3.0.0",
			wantMajor:   3,
		},
		{
			name:            "OpenSearch 4 is too new, but allowed",
			version:         "4.0.0",
			wantVersion:     "4.0.0",
			wantMajor:       4,
			wantUnsupported: true,
		},
		{
			name:      "invalid version string",
			version:   "invalid",
			wantErrID: "ent.elasticsearch.start.parse_server_version.app_error",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			logger := mlog.CreateConsoleTestLogger(t)
			var buf mlog.Buffer
			require.NoError(t, mlog.AddWriterTarget(logger, &buf, true, mlog.LvlError))

			client := newTestClient(t, infoHandler(tc.version))
			version, major, appErr := checkVersion(context.Background(), client, logger)
			require.NoError(t, logger.Flush())

			if tc.wantErrID != "" {
				require.NotNil(t, appErr)
				assert.Equal(t, tc.wantErrID, appErr.Id)
				return
			}

			require.Nil(t, appErr)
			assert.Equal(t, tc.wantVersion, version)
			assert.Equal(t, tc.wantMajor, major)
			if tc.wantUnsupported {
				assert.Contains(t, buf.String(), "Unsupported OpenSearch version")
				assert.Contains(t, buf.String(), fmt.Sprintf(`"version":%q`, tc.wantVersion))
				assert.Contains(t, buf.String(), `"max_version":3`)
			} else {
				assert.Empty(t, buf.String())
			}
		})
	}
}

func TestCheckVersionConnectionError(t *testing.T) {
	ts := httptest.NewServer(http.NotFoundHandler())
	ts.Close() // close immediately to force connection error

	client, err := opensearchapi.NewClient(opensearchapi.Config{
		Client: opensearch.Config{
			Addresses:  []string{ts.URL},
			MaxRetries: 0,
		},
	})
	require.NoError(t, err)

	_, _, appErr := checkVersion(context.Background(), client, mlog.CreateConsoleTestLogger(t))
	require.NotNil(t, appErr)
	assert.Equal(t, "ent.elasticsearch.start.get_server_version.app_error", appErr.Id)
}
