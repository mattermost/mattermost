// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"cmp"
	"slices"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

type Snapshot struct {
	CollectedAt time.Time

	Config  *model.SupportPacketConfig
	Stats   *model.SupportPacketStats
	Jobs    *model.SupportPacketJobList
	Plugins *model.SupportPacketPluginList

	nodes []*NodeSnapshot

	Version  VersionInfo
	Sections map[model.WorkspaceSection]error
}

type VersionInfo struct {
	Current   string
	Latest    string
	BuildDate time.Time
}

// NewSnapshot returns a snapshot over nodes, sorted by hostname so results do not depend on
// the order the nodes were collected in. The node list is fixed at construction, so Nodes()
// and Leader() are consistent for the snapshot's lifetime.
func NewSnapshot(nodes []*NodeSnapshot) *Snapshot {
	nodes = slices.Clone(nodes)
	slices.SortStableFunc(nodes, func(a, b *NodeSnapshot) int { return cmp.Compare(a.Hostname, b.Hostname) })
	return &Snapshot{nodes: nodes}
}

// Nodes returns a copy of the snapshot's nodes, sorted by hostname.
func (s *Snapshot) Nodes() []*NodeSnapshot {
	if s == nil || len(s.nodes) == 0 {
		return nil
	}

	nodes := make([]*NodeSnapshot, len(s.nodes))
	copy(nodes, s.nodes)
	return nodes
}

// Hostnames returns the hostnames of the nodes that make up the deployment, or nil when the
// snapshot cannot name them all as their findings are scoped:
//   - a node that did not reply may be listed under its cluster discovery hostname, often an IP
//     address, rather than the hostname it reports itself;
//   - a node without a hostname could be any of them;
//   - with clustering on and licensed, a node without cluster info is the local node standing in
//     for a cluster that could not be listed. Without the license the cluster never starts.
func (s *Snapshot) Hostnames() []string {
	clusterEnabled, _ := s.ClusterEnabled()
	clusterLicensed, licenseKnown := s.LicenseAllows(FeatureCluster)
	clustered := clusterEnabled && (clusterLicensed || !licenseKnown)
	nodes := s.Nodes()
	hostnames := make([]string, 0, len(nodes))
	for _, node := range nodes {
		if node == nil {
			continue
		}
		if node.CollectErr != nil || node.Hostname == "" || (clustered && node.ClusterInfo == nil) {
			return nil
		}
		hostnames = append(hostnames, node.Hostname)
	}
	return hostnames
}

func (s *Snapshot) Leader() (*NodeSnapshot, bool) {
	if s == nil {
		return nil, false
	}

	for _, node := range s.nodes {
		if node != nil && node.IsLeader {
			return node, true
		}
	}

	return nil, false
}

func (s *Snapshot) Has(section model.WorkspaceSection) bool {
	ok, err := s.SectionErr(section)
	return ok && err == nil
}

func (s *Snapshot) SectionErr(section model.WorkspaceSection) (bool, error) {
	if s == nil || s.Sections == nil {
		return false, nil
	}

	err, ok := s.Sections[section]
	return ok, err
}
