// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func TestNodeNotResponding(t *testing.T) {
	t.Parallel()

	noReply := &healthcheck.NodeSnapshot{Hostname: "app-2.example.com", CollectErr: healthcheck.ErrNodeNoReply}
	older := &healthcheck.NodeSnapshot{Hostname: "app-3.example.com", CollectErr: healthcheck.ErrNodeOlderVersion}
	replied := diagNode("app-4.example.com", false, nil)
	nodes := []*healthcheck.NodeSnapshot{leaderNode(nil), noReply, older, replied}
	unlicensed := leaderNode(func(diag *model.SupportPacketDiagnostics) { diag.License = model.SupportPacketLicense{} })

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		node     *healthcheck.NodeSnapshot
		want     want
	}{
		{
			name:     "did not reply",
			snapshot: configSnapshot(haEnabled, nodes...),
			node:     noReply,
			want:     firing("health.rule.node_not_responding.message", map[string]string{"unreachable_node": "app-2.example.com"}),
		},
		{
			name:     "older version",
			snapshot: configSnapshot(haEnabled, nodes...),
			node:     older,
			want:     want{state: healthcheck.StateUnknown, messageID: "health.rule.node_not_responding.message.older_version"},
		},
		{name: "replied", snapshot: configSnapshot(haEnabled, nodes...), node: replied, want: resolved},
		{name: "HA off", snapshot: configSnapshot(nil, nodes...), node: noReply, want: resolved},
		{name: "unlicensed", snapshot: configSnapshot(haEnabled, unlicensed, noReply), node: noReply, want: resolved},
		{name: "config absent", snapshot: healthcheck.NewSnapshot(nodes), node: noReply, want: configUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, nodeNotResponding.EvalNode(tc.snapshot, tc.node))
		})
	}
}
