// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// BuildHealthSnapshot assembles a health snapshot from live server state. A failed workspace
// collector is recorded in Snapshot.Sections rather than failing the call; the error return
// is for a snapshot that cannot be built at all.
//
// It must only be called on the cluster leader: the local node is reported as the leader.
func (a *App) BuildHealthSnapshot(rctx request.CTX) (*healthcheck.Snapshot, error) {
	return a.buildHealthSnapshotWithLatestVersionURL(rctx, LatestVersionURL)
}

func (a *App) buildHealthSnapshotWithLatestVersionURL(rctx request.CTX, latestVersionURL string) (*healthcheck.Snapshot, error) {
	nodes, err := clusterNodes(a.Cluster())
	if err != nil {
		return nil, err
	}

	sections := map[model.WorkspaceSection]error{}
	snapshot := healthcheck.NewSnapshot(nodes)
	snapshot.Sections = sections
	snapshot.CollectedAt = time.Now().UTC()

	snapshot.Config, err = a.Srv().Platform().GetSupportPacketConfig(rctx)
	sections[model.SectionConfig] = err

	snapshot.License = a.License()
	if snapshot.License != nil {
		snapshot.Deployment.IsCloud = snapshot.License.IsCloud()
	}

	snapshot.Stats, err = a.getSupportPacketStats(rctx)
	sections[model.SectionStats] = err

	snapshot.Jobs, err = a.getSupportPacketJobList(rctx)
	sections[model.SectionJobs] = err

	snapshot.Plugins, err = a.getPluginsList(rctx)
	sections[model.SectionPlugins] = err

	snapshot.Version.Current = model.CurrentVersion
	// The Makefile stamps BuildDate with `date -u`; dev builds leave the zero time.
	snapshot.Version.BuildDate, _ = time.Parse(time.UnixDate, model.BuildDate)

	release, appErr := a.GetLatestVersion(rctx, latestVersionURL)
	if appErr != nil {
		sections[model.SectionVersion] = appErr
	} else {
		sections[model.SectionVersion] = nil
		snapshot.Version.Latest = release.TagName
	}

	return snapshot, nil
}

func clusterNodes(cluster einterfaces.ClusterInterface) ([]*healthcheck.NodeSnapshot, error) {
	if cluster == nil {
		return []*healthcheck.NodeSnapshot{{IsLeader: true}}, nil
	}

	clusterInfos, err := cluster.GetClusterInfos()
	if err != nil {
		return nil, err
	}
	if len(clusterInfos) == 0 {
		return []*healthcheck.NodeSnapshot{{IsLeader: true}}, nil
	}

	localClusterID := cluster.GetClusterId()
	nodes := make([]*healthcheck.NodeSnapshot, 0, len(clusterInfos))
	for _, clusterInfo := range clusterInfos {
		node := &healthcheck.NodeSnapshot{
			ClusterInfo: clusterInfo,
		}

		if clusterInfo != nil {
			node.Hostname = clusterInfo.Hostname
			node.IsLeader = clusterInfo.Id == localClusterID
		}

		nodes = append(nodes, node)
	}

	return nodes, nil
}
