// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// healthCollectTimeout bounds a run whose context has no deadline. It must cover the probes'
// own timeouts: OAuth and push are 10 s each, the pg_stat queries 10 s each, plus SMTP, LDAP,
// Elasticsearch and S3.
const healthCollectTimeout = 3 * time.Minute

// CollectHealthNodes collects every connected node's diagnostics for a health check run and
// returns the snapshot's nodes. Without a cluster it returns the local node only.
//
// The other nodes are asked through ClusterInterface.CollectHealthDiagnostics, which waits for
// every connected node until the context's deadline, or healthCollectTimeout if the context has
// none. Nodes that have not replied by then are marked with healthcheck.ErrNodeNoReply.
// Cancelling the context aborts the run with an error.
func (ps *PlatformService) CollectHealthNodes(rctx request.CTX) ([]*healthcheck.NodeSnapshot, error) {
	if _, ok := rctx.Context().Deadline(); !ok {
		ctx, cancel := context.WithTimeout(rctx.Context(), healthCollectTimeout)
		defer cancel()
		rctx = rctx.WithContext(ctx)
	}

	var (
		localID string
		infos   []*model.ClusterInfo
		err     error
	)
	if cluster := ps.Cluster(); cluster != nil {
		localID = cluster.GetClusterId()
		if infos, err = cluster.GetClusterInfos(); err != nil {
			return nil, fmt.Errorf("failed to get cluster infos: %w", err)
		}
	}

	collected, err := ps.collectNodeDiagnostics(rctx, localID)
	if err != nil {
		return nil, err
	}

	return healthNodes(infos, localID, collected), nil
}

// collectNodeDiagnostics collects the other nodes' diagnostics through the cluster and this
// node's own meanwhile. The result is keyed by cluster ID; a node that did not reply has no entry.
func (ps *PlatformService) collectNodeDiagnostics(rctx request.CTX, localID string) (map[string]*model.NodeDiagnostics, error) {
	var (
		remote map[string]*model.NodeDiagnostics
		wg     sync.WaitGroup
	)
	if cluster := ps.Cluster(); cluster != nil {
		wg.Go(func() { remote = cluster.CollectHealthDiagnostics(rctx) })
	}

	// Failures are already recorded per section in the envelope.
	local, _ := ps.GetSupportPacketDiagnostics(rctx)
	wg.Wait()

	// Past the deadline the nodes that replied are kept; a cancelled run is abandoned.
	if err := rctx.Context().Err(); errors.Is(err, context.Canceled) {
		return nil, err
	}

	collected := make(map[string]*model.NodeDiagnostics, len(remote)+1)
	for id, diagnostics := range remote {
		if diagnostics != nil {
			collected[id] = diagnostics
		}
	}
	collected[localID] = local

	return collected, nil
}

// healthNodes builds the snapshot's nodes from the cluster infos and the diagnostics collected
// in this run, keyed by cluster ID. If the leader did not reply, the local node stands in.
func healthNodes(infos []*model.ClusterInfo, localID string, collected map[string]*model.NodeDiagnostics) []*healthcheck.NodeSnapshot {
	if len(infos) == 0 {
		infos = []*model.ClusterInfo{nil}
	}

	nodes := make([]*healthcheck.NodeSnapshot, 0, len(infos))
	var local *healthcheck.NodeSnapshot
	for _, info := range infos {
		node := &healthcheck.NodeSnapshot{ClusterInfo: info}
		id := localID
		if info != nil {
			node.Hostname = info.Hostname
			id = info.Id
		}

		if diagnostics, ok := collected[id]; ok {
			node.Diagnostics = diagnostics
		} else {
			node.CollectErr = healthcheck.ErrNodeNoReply
		}

		// A standalone node has no cluster hostname; the packet reader takes it from diagnostics too.
		if diag, ok := node.Diag(); ok && node.Hostname == "" {
			node.Hostname = model.SafeDereference(diag.Server.Hostname)
		}
		if id == localID {
			local = node
		}

		nodes = append(nodes, node)
	}

	healthcheck.SelectLeader(nodes, cmp.Or(local, nodes[0]))
	return nodes
}
