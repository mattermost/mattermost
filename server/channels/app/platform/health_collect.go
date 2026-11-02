// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
// The run waits for every connected node until the context's deadline, or healthCollectTimeout
// if the context has none. Nodes that have not replied by then are marked with
// healthcheck.ErrNodeNoReply. Cancelling the context aborts the run with an error.
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

	collected, err := ps.collectNodeDiagnostics(rctx, localID, infos)
	if err != nil {
		return nil, err
	}

	return healthNodes(infos, localID, collected), nil
}

// collectNodeDiagnostics broadcasts a collect request, collects this node's diagnostics
// meanwhile, and waits until every connected node has replied or the context's deadline
// passes. The result is keyed by cluster ID; a node that did not reply has no entry.
func (ps *PlatformService) collectNodeDiagnostics(rctx request.CTX, localID string, infos []*model.ClusterInfo) (map[string]*model.NodeDiagnostics, error) {
	// A node registered in the database but not connected never gets the broadcast, so it
	// is not waited for.
	pending := map[string]bool{}
	for _, info := range infos {
		if info != nil && info.IPAddress != "" && info.Id != localID {
			pending[info.Id] = true
		}
	}

	var replies chan *model.HealthCollectReply
	if len(pending) > 0 {
		runID := model.NewId()
		replies = make(chan *model.HealthCollectReply, len(pending))
		ps.healthCollectMut.Lock()
		if ps.healthCollectRuns == nil {
			ps.healthCollectRuns = map[string]*healthCollectRun{}
		}
		ps.healthCollectRuns[runID] = &healthCollectRun{waiting: maps.Clone(pending), replies: replies}
		ps.healthCollectMut.Unlock()
		defer func() {
			ps.healthCollectMut.Lock()
			delete(ps.healthCollectRuns, runID)
			ps.healthCollectMut.Unlock()
		}()

		data, err := json.Marshal(model.HealthCollectRequest{RunID: runID, RequesterID: localID})
		if err != nil {
			return nil, fmt.Errorf("failed to encode health collect request: %w", err)
		}
		ps.Cluster().SendClusterMessage(&model.ClusterMessage{
			Event:    model.ClusterEventHealthCollect,
			SendType: model.ClusterSendReliable,
			Data:     data,
		})
	}

	// Failures are already recorded per section in the envelope.
	local, _ := ps.GetSupportPacketDiagnostics(rctx)
	collected := map[string]*model.NodeDiagnostics{localID: local}

	for len(pending) > 0 {
		select {
		case reply := <-replies:
			delete(pending, reply.NodeID)

			diagnostics, err := decodeHealthCollectReply(reply)
			if err != nil {
				rctx.Logger().Warn("Failed to decode health collect reply", mlog.String("node_id", reply.NodeID), mlog.Err(err))
				continue
			}
			collected[reply.NodeID] = diagnostics
		case <-rctx.Context().Done():
			err := rctx.Context().Err()
			if !errors.Is(err, context.DeadlineExceeded) {
				return nil, err
			}
			rctx.Logger().Warn("Nodes did not reply to the health collect request in time", mlog.Any("node_ids", pending))
			return collected, nil
		}
	}

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

// handleHealthCollect runs on every node: it collects this node's diagnostics and replies to
// the requester.
func (ps *PlatformService) handleHealthCollect(msg *model.ClusterMessage) {
	var req model.HealthCollectRequest
	if err := json.Unmarshal(msg.Data, &req); err != nil {
		ps.logger.Warn("Failed to decode health collect request", mlog.Err(err))
		return
	}

	// Collecting runs the external probes and can take minutes, so it must not block the
	// cluster's message handling.
	ps.Go(func() {
		diagnostics, _ := ps.GetSupportPacketDiagnostics(request.EmptyContext(ps.logger).WithContext(ps.GoContext()))

		data, err := encodeHealthCollectReply(req.RunID, ps.Cluster().GetClusterId(), diagnostics)
		if err != nil {
			ps.logger.Error("Failed to encode health collect reply", mlog.String("run_id", req.RunID), mlog.Err(err))
			return
		}

		err = ps.Cluster().SendClusterMessageToNode(req.RequesterID, &model.ClusterMessage{
			Event:    model.ClusterEventHealthCollectReply,
			SendType: model.ClusterSendReliable,
			Data:     data,
		})
		if err != nil {
			ps.logger.Warn("Failed to send health collect reply", mlog.String("run_id", req.RunID), mlog.String("requester_id", req.RequesterID), mlog.Err(err))
		}
	})
}

// healthCollectRun is a collect request waiting for replies.
type healthCollectRun struct {
	waiting map[string]bool // nodes that have not replied yet
	replies chan *model.HealthCollectReply
}

// handleHealthCollectReply routes a reply to the run waiting for it. A reply for an unknown or
// finished run, or from a node the run is not waiting for, is dropped.
func (ps *PlatformService) handleHealthCollectReply(msg *model.ClusterMessage) {
	var reply model.HealthCollectReply
	if err := json.Unmarshal(msg.Data, &reply); err != nil {
		ps.logger.Warn("Failed to decode health collect reply", mlog.Err(err))
		return
	}

	ps.healthCollectMut.Lock()
	defer ps.healthCollectMut.Unlock()
	run, ok := ps.healthCollectRuns[reply.RunID]
	if !ok || !run.waiting[reply.NodeID] {
		ps.logger.Debug("Dropping unexpected health collect reply", mlog.String("run_id", reply.RunID), mlog.String("node_id", reply.NodeID))
		return
	}

	// The buffer holds one reply per waited-for node, so this never blocks.
	delete(run.waiting, reply.NodeID)
	run.replies <- &reply
}

// encodeHealthCollectReply returns the JSON of a HealthCollectReply.
func encodeHealthCollectReply(runID, nodeID string, diagnostics *model.NodeDiagnostics) ([]byte, error) {
	errs := make(map[model.NodeSection]string, len(diagnostics.Errors))
	for section, sectionErr := range diagnostics.Errors {
		errs[section] = ""
		if sectionErr != nil {
			errs[section] = sectionErr.Error()
		}
	}

	return json.Marshal(model.HealthCollectReply{RunID: runID, NodeID: nodeID, Diagnostics: diagnostics.Diagnostics, Errors: errs})
}

func decodeHealthCollectReply(reply *model.HealthCollectReply) (*model.NodeDiagnostics, error) {
	if reply.Diagnostics == nil {
		return nil, errors.New("the reply has no diagnostics")
	}

	errs := make(model.SectionErrors, len(reply.Errors))
	for section, sectionErr := range reply.Errors {
		errs[section] = nil
		if sectionErr != "" {
			errs[section] = errors.New(sectionErr)
		}
	}

	return &model.NodeDiagnostics{Diagnostics: reply.Diagnostics, Errors: errs}, nil
}
