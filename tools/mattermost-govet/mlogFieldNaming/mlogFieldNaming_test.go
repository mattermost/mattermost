// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlogFieldNaming

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/tools/go/analysis/analysistest"
)

func TestAll(t *testing.T) {
	analysistest.RunWithSuggestedFixes(t, analysistest.TestData(), Analyzer, "a")
}

// TestFixtureCoversEveryConstructor keeps the fixture in step with
// keyedFieldConstructors, so that dropping a constructor cannot silently go
// unnoticed just because nothing exercises it.
func TestFixtureCoversEveryConstructor(t *testing.T) {
	src, err := os.ReadFile(filepath.Join("testdata", "src", "a", "a.go"))
	if err != nil {
		t.Fatalf("reading fixture: %v", err)
	}

	lines := strings.Split(string(src), "\n")
	for name := range keyedFieldConstructors {
		covered := false
		for _, line := range lines {
			if strings.Contains(line, "mlog."+name+`("`) && strings.Contains(line, "// want") {
				covered = true
				break
			}
		}

		if !covered {
			t.Errorf("no diagnostic case for mlog.%s in testdata/src/a/a.go; add one so removing %q from keyedFieldConstructors fails a test", name, name)
		}
	}
}

func TestToSnakeCase(t *testing.T) {
	for _, tc := range []struct {
		key    string
		want   string
		wantOK bool
	}{
		{"user_id", "user_id", true},
		{"userId", "user_id", true},
		{"UserId", "user_id", true},
		{"userID", "user_id", true},
		{"ClusterDiscoveryID", "cluster_discovery_id", true},
		{"requestURL", "request_url", true},
		{"requestURLPath", "request_url_path", true},
		{"userIDs", "user_ids", true},
		{"channelIDs", "channel_ids", true},
		{"IDs", "ids", true},
		{"userIDsFoo", "user_ids_foo", true},
		{"userIDs.foo", "user_ids_foo", true},
		{"Diff", "diff", true},
		{"RecvAt", "recv_at", true},
		{"sharedChannelRemoteId", "shared_channel_remote_id", true},
		{"channel name", "channel_name", true},
		{"Possibilities searched", "possibilities_searched", true},
		{"features.users", "features_users", true},
		{"sm.Post.ChannelId", "sm_post_channel_id", true},
		{"user-id", "user_id", true},
		{"_user_id", "user_id", true},
		{"user__id", "user_id", true},
		{"sha256", "sha256", true},
		{"channelId2", "channel_id2", true},
		{"2fa", "", false},
		{"", "", false},
		{"___", "", false},
	} {
		t.Run(tc.key, func(t *testing.T) {
			got, ok := toSnakeCase(tc.key)
			if ok != tc.wantOK {
				t.Fatalf("toSnakeCase(%q) ok = %v, want %v", tc.key, ok, tc.wantOK)
			}
			if ok && got != tc.want {
				t.Fatalf("toSnakeCase(%q) = %q, want %q", tc.key, got, tc.want)
			}
		})
	}
}
