// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

type NodeSnapshot struct {
	Hostname    string
	IsLeader    bool
	ClusterInfo *model.ClusterInfo
	Diagnostics *model.NodeDiagnostics
}

func (n *NodeSnapshot) Diag() (*model.SupportPacketDiagnostics, bool) {
	if n == nil || n.Diagnostics == nil || n.Diagnostics.Diagnostics == nil {
		return nil, false
	}

	return n.Diagnostics.Diagnostics, true
}

// NodeVersion prefers cluster info so a live snapshot, where only the leader carries
// diagnostics, reads every node's version from the same source. Gossip appends the build
// number, which packets lack, so it is dropped to keep live and offline results equal.
func (n *NodeSnapshot) NodeVersion() (string, bool) {
	if n != nil && n.ClusterInfo != nil && n.ClusterInfo.Version != "" {
		return releaseVersion(n.ClusterInfo.Version), true
	}
	if diag, ok := n.Diag(); ok && diag.Server.Version != "" && n.sectionOK(model.SectionServerSoftware) {
		return diag.Server.Version, true
	}

	return "", false
}

// releaseVersion cuts a gossip version like 11.1.0.12345 down to 11.1.0. Build numbers can
// contain dots, so it keeps the first three parts rather than trimming the last one.
func releaseVersion(gossip string) string {
	parts := strings.SplitN(gossip, ".", 4)
	if len(parts) < 4 {
		return gossip
	}

	return strings.Join(parts[:3], ".")
}

func (n *NodeSnapshot) SchemaVersion() (string, bool) {
	if n != nil && n.ClusterInfo != nil && n.ClusterInfo.SchemaVersion != "" {
		return n.ClusterInfo.SchemaVersion, true
	}
	if diag, ok := n.Diag(); ok && model.SafeDereference(diag.Database.SchemaVersion) != "" && n.sectionOK(model.SectionDatabaseIdentity) {
		return *diag.Database.SchemaVersion, true
	}

	return "", false
}

// An absent section entry counts as clean; only a recorded error makes its data unusable.
func (n *NodeSnapshot) sectionOK(section model.NodeSection) bool {
	_, err := n.SectionErr(section)
	return err == nil
}

func (n *NodeSnapshot) Has(section model.NodeSection) bool {
	ok, err := n.SectionErr(section)
	return ok && err == nil
}

func (n *NodeSnapshot) SectionErr(section model.NodeSection) (bool, error) {
	if n == nil || n.Diagnostics == nil || n.Diagnostics.Errors == nil {
		return false, nil
	}

	err, ok := n.Diagnostics.Errors[section]
	return ok, err
}
