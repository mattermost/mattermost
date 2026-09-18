// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import "github.com/mattermost/mattermost/server/public/model"

type NodeSnapshot struct {
	Hostname    string
	IsLeader    bool
	ClusterInfo *model.ClusterInfo
	Diagnostics *model.NodeDiagnostics
	Sections    model.SectionErrors
}

func (n *NodeSnapshot) Diag() (*model.SupportPacketDiagnostics, bool) {
	if n == nil || n.Diagnostics == nil || n.Diagnostics.Diagnostics == nil {
		return nil, false
	}

	return n.Diagnostics.Diagnostics, true
}

func (n *NodeSnapshot) NodeVersion() (string, bool) {
	if diag, ok := n.Diag(); ok && diag.Server.Version != "" {
		return diag.Server.Version, true
	}
	if n != nil && n.ClusterInfo != nil && n.ClusterInfo.Version != "" {
		return n.ClusterInfo.Version, true
	}

	return "", false
}

func (n *NodeSnapshot) SchemaVersion() (string, bool) {
	if n != nil && n.ClusterInfo != nil && n.ClusterInfo.SchemaVersion != "" {
		return n.ClusterInfo.SchemaVersion, true
	}
	if diag, ok := n.Diag(); ok && diag.Database.SchemaVersion != "" {
		return diag.Database.SchemaVersion, true
	}

	return "", false
}

func (n *NodeSnapshot) ConfigHash() (string, bool) {
	if n != nil && n.ClusterInfo != nil && n.ClusterInfo.ConfigHash != "" {
		return n.ClusterInfo.ConfigHash, true
	}

	return "", false
}

func (n *NodeSnapshot) Has(section model.NodeSection) bool {
	ok, err := n.SectionErr(section)
	return ok && err == nil
}

func (n *NodeSnapshot) SectionErr(section model.NodeSection) (bool, error) {
	if n == nil || n.Sections == nil {
		return false, nil
	}

	err, ok := n.Sections[section]
	return ok, err
}
