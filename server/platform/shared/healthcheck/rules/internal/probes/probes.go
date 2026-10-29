// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package probes evaluates the probes of external services that every node runs.
package probes

import (
	"cmp"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// Read returns one node's probe status and error. A status other than model.StatusOk or
// model.StatusFail means the node has no usable result, which leaves it out of the count.
type Read func(n *healthcheck.NodeSnapshot) (status, probeErr string)

// Eval returns one cluster-wide result over every node that reports the probe. It fires with
// messageID when every such node fails and with partialID when only some do. The details name
// the failing nodes and their error, or each node's error when they differ.
func Eval(s *healthcheck.Snapshot, read Read, messageID, partialID string) healthcheck.Result {
	nodes := s.Nodes()
	slices.SortFunc(nodes, func(a, b *healthcheck.NodeSnapshot) int { return cmp.Compare(a.Hostname, b.Hostname) })

	reported := 0
	var hostnames, errs, nodeErrs []string
	for _, node := range nodes {
		status, probeErr := read(node)
		switch status {
		case model.StatusOk:
			reported++
		case model.StatusFail:
			reported++
			hostnames = append(hostnames, node.Hostname)
			errs = append(errs, probeErr)
			nodeErrs = append(nodeErrs, node.Hostname+": "+probeErr)
		}
	}

	switch {
	case reported == 0:
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	case len(hostnames) == 0:
		return healthcheck.Resolved()
	}

	probeErr := errs[0]
	if len(slices.Compact(errs)) > 1 {
		probeErr = strings.Join(nodeErrs, "; ")
	}

	id := messageID
	if len(hostnames) < reported {
		id = partialID
	}

	return healthcheck.Firing(id).
		WithDetail("nodes", strings.Join(hostnames, ", ")).
		WithDetail("error", probeErr)
}
