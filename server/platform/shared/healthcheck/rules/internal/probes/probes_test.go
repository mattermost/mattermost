// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package probes

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
)

func TestEval(t *testing.T) {
	t.Parallel()

	type outcome struct{ status, err string }
	pass := outcome{status: model.StatusOk}
	fail := func(err string) outcome { return outcome{status: model.StatusFail, err: err} }
	missing := outcome{status: model.StatusDisabled}

	eval := func(outcomes map[string]outcome) healthcheck.Result {
		var nodes []*healthcheck.NodeSnapshot
		for _, hostname := range []string{"app-3", "app-2", "app-1"} {
			if _, ok := outcomes[hostname]; ok {
				nodes = append(nodes, &healthcheck.NodeSnapshot{Hostname: hostname})
			}
		}
		read := func(n *healthcheck.NodeSnapshot) (string, string) {
			o := outcomes[n.Hostname]
			return o.status, o.err
		}
		return Eval(healthcheck.NewSnapshot(nodes), read, "msg", "msg.partial")
	}

	testCases := []struct {
		name     string
		outcomes map[string]outcome
		want     healthcheck.Result
	}{
		{
			name:     "every node fails with the same error",
			outcomes: map[string]outcome{"app-1": fail("refused"), "app-2": fail("refused"), "app-3": fail("refused")},
			want:     healthcheck.Firing("msg").WithDetail("nodes", "app-1, app-2, app-3").WithDetail("error", "refused"),
		},
		{
			name:     "every node fails with different errors",
			outcomes: map[string]outcome{"app-1": fail("refused"), "app-2": fail("timeout"), "app-3": fail("refused")},
			want:     healthcheck.Firing("msg").WithDetail("nodes", "app-1, app-2, app-3").WithDetail("error", "app-1: refused; app-2: timeout; app-3: refused"),
		},
		{
			name:     "one node of three fails",
			outcomes: map[string]outcome{"app-1": pass, "app-2": fail("timeout"), "app-3": pass},
			want:     healthcheck.Firing("msg.partial").WithDetail("nodes", "app-2").WithDetail("error", "timeout"),
		},
		{
			name:     "a node without a result is left out of the count",
			outcomes: map[string]outcome{"app-1": missing, "app-2": fail("timeout"), "app-3": fail("timeout")},
			want:     healthcheck.Firing("msg").WithDetail("nodes", "app-2, app-3").WithDetail("error", "timeout"),
		},
		{
			name:     "every node passes",
			outcomes: map[string]outcome{"app-1": pass, "app-2": pass, "app-3": missing},
			want:     healthcheck.Resolved(),
		},
		{
			name:     "no node has a result",
			outcomes: map[string]outcome{"app-1": missing, "app-2": missing},
			want:     healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable),
		},
		{
			name: "no nodes",
			want: healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tc.want, eval(tc.outcomes))
		})
	}
}
