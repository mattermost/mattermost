// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMetricsRouter(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	cfg := &model.Config{}
	cfg.SetDefaults()

	metrics := &platformMetrics{
		cfgFn:  func() *model.Config { return cfg },
		logger: logger,
	}

	err := metrics.initMetricsRouter()
	require.NoError(t, err)

	server := httptest.NewServer(metrics.router)
	t.Cleanup(server.Close)
	client := server.Client()

	for name, tc := range map[string]struct {
		path                 string
		method               string
		ExpectedBodyContains string
		ExpectedCode         int
	}{
		"root":                        {path: "", ExpectedBodyContains: "<div><a href=\"/debug/pprof/\">Profiling Root</a></div>"},
		"root with slash":             {path: "/", ExpectedBodyContains: "<div><a href=\"/debug/pprof/\">Profiling Root</a></div>"},
		"debug redirect":              {path: "/debug", ExpectedBodyContains: "<div><a href=\"/debug/pprof/\">Profiling Root</a></div>"},
		"debug redirect with slash":   {path: "/debug/", ExpectedBodyContains: "<div><a href=\"/debug/pprof/\">Profiling Root</a></div>"},
		"pprof index page":            {path: "/debug/pprof", ExpectedBodyContains: "<p>Set debug=1 as a query parameter to export in legacy text format</p>"},
		"pprof index page with slash": {path: "/debug/pprof/", ExpectedBodyContains: "<p>Set debug=1 as a query parameter to export in legacy text format</p>"},
		"pprof allocs":                {path: "/debug/pprof/allocs"},
		"pprof block":                 {path: "/debug/pprof/block"},
		"pprof cmdline":               {path: "/debug/pprof/cmdline"},
		"pprof goroutine":             {path: "/debug/pprof/goroutine"},
		"pprof heap":                  {path: "/debug/pprof/heap"},
		"pprof mutex":                 {path: "/debug/pprof/mutex"},
		"pprof profile":               {path: "/debug/pprof/profile?seconds=1"},
		"pprof symbol":                {path: "/debug/pprof/symbol"},
		"pprof threadcreate":          {path: "/debug/pprof/threadcreate"},
		"pprof trace":                 {path: "/debug/pprof/trace"},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			method := http.MethodGet
			if tc.method != "" {
				method = tc.method
			}
			url := server.URL + tc.path

			req, err := http.NewRequest(method, url, nil)
			require.NoError(t, err, name)

			resp, err := client.Do(req)
			require.NoError(t, err, name)
			t.Cleanup(func() {
				err := resp.Body.Close()
				assert.NoError(t, err)
			})

			expectedCode := 200
			if tc.ExpectedCode != 0 {
				expectedCode = tc.ExpectedCode
			}
			assert.Equal(t, expectedCode, resp.StatusCode)

			if tc.ExpectedBodyContains != "" {
				b, err := io.ReadAll(resp.Body)
				require.NoError(t, err, name)
				assert.Contains(t, string(b), tc.ExpectedBodyContains)
			}
		})
	}
}
