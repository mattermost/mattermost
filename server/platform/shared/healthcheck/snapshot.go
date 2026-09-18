// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

type Snapshot struct {
	CollectedAt time.Time

	Config  *model.SupportPacketConfig
	License *model.License
	Stats   *model.SupportPacketStats
	Jobs    *model.SupportPacketJobList
	Plugins *model.SupportPacketPluginList

	nodes []*NodeSnapshot

	Deployment Deployment
	Version    VersionInfo
	Sections   map[model.WorkspaceSection]error
}

type Deployment struct {
	IsCloud        bool
	ClusterEnabled bool
}

type VersionInfo struct {
	Current         string
	Latest          string
	LatestFetchedAt time.Time
	BuildDate       time.Time
}

func (s *Snapshot) Nodes() []*NodeSnapshot {
	if s == nil || len(s.nodes) == 0 {
		return nil
	}

	nodes := make([]*NodeSnapshot, len(s.nodes))
	copy(nodes, s.nodes)
	return nodes
}

func (s *Snapshot) Leader() (*NodeSnapshot, bool) {
	for _, node := range s.Nodes() {
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
