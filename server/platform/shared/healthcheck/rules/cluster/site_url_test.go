// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func siteURLSnapshot(url string) *healthcheck.Snapshot {
	cfg := &model.Config{}
	cfg.ServiceSettings.SiteURL = new(url)

	return &healthcheck.Snapshot{
		Config:   &model.SupportPacketConfig{Config: cfg},
		Sections: map[model.WorkspaceSection]error{model.SectionConfig: nil},
	}
}

type siteURLWant struct {
	state     healthcheck.State
	messageID string
	url       string
}

func TestSiteURLRules(t *testing.T) {
	t.Parallel()

	resolved := siteURLWant{state: healthcheck.StateResolved}
	unknown := siteURLWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
	rules := []healthcheck.Rule{siteURLEmpty, siteURLHTTP}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]siteURLWant
	}{
		{
			name:     "config section absent",
			snapshot: &healthcheck.Snapshot{},
			want:     map[string]siteURLWant{"SITE_URL_EMPTY": unknown, "SITE_URL_HTTP": unknown},
		},
		{
			name:     "empty",
			snapshot: siteURLSnapshot(""),
			want: map[string]siteURLWant{
				"SITE_URL_EMPTY": {state: healthcheck.StateFiring, messageID: "health.rule.site_url_empty.message"},
				"SITE_URL_HTTP":  resolved,
			},
		},
		{
			name:     "http",
			snapshot: siteURLSnapshot("http://mattermost.example.com"),
			want: map[string]siteURLWant{
				"SITE_URL_EMPTY": resolved,
				"SITE_URL_HTTP":  {state: healthcheck.StateFiring, messageID: "health.rule.site_url_http.message", url: "http://mattermost.example.com"},
			},
		},
		{
			name:     "https",
			snapshot: siteURLSnapshot("https://mattermost.example.com"),
			want:     map[string]siteURLWant{"SITE_URL_EMPTY": resolved, "SITE_URL_HTTP": resolved},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			for _, rule := range rules {
				results := rule.Eval(tc.snapshot)
				require.Len(t, results, 1, rule.Code)

				want := tc.want[rule.Code]
				assert.Equal(t, want.state, results[0].State, rule.Code)
				assert.Equal(t, want.messageID, results[0].MessageID, rule.Code)
				assert.Equal(t, want.url, results[0].Details["url"], rule.Code)
			}
		})
	}
}
