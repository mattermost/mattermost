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
		name        string
		version     string
		wantVersion string
		wantMajor   int
		wantErrID   string
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
			name:      "ES 7 is too old",
			version:   "7.17.0",
			wantErrID: "ent.elasticsearch.min_version.app_error",
		},
		{
			name:      "ES 10 is too new",
			version:   "10.0.0",
			wantErrID: "ent.elasticsearch.max_version.app_error",
		},
		{
			name:      "invalid version string",
			version:   "invalid",
			wantErrID: "ent.elasticsearch.start.parse_server_version.app_error",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			client := newTestClient(t, infoHandler(tc.version))
			version, major, appErr := checkVersion(context.Background(), client)
			if tc.wantErrID != "" {
				require.NotNil(t, appErr)
				assert.Equal(t, tc.wantErrID, appErr.Id)
			} else {
				require.Nil(t, appErr)
				assert.Equal(t, tc.wantVersion, version)
				assert.Equal(t, tc.wantMajor, major)
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

	_, _, appErr := checkVersion(context.Background(), client)
	require.NotNil(t, appErr)
	assert.Equal(t, "ent.elasticsearch.start.get_server_version.app_error", appErr.Id)
}
