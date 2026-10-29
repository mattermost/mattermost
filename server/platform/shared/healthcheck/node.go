// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"errors"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

var (
	// ErrNodeNoReply marks a node whose diagnostics were not collected in time.
	ErrNodeNoReply = errors.New("the node did not reply in time")
	// ErrNodeOlderVersion marks a node that did not reply and runs an older version than the
	// evaluating node, which may not know how to answer. Rules read such a node as unknown,
	// not down, so a rolling upgrade does not look like an outage.
	ErrNodeOlderVersion = errors.New("the node runs an older version and may not support collection")
)

type NodeSnapshot struct {
	Hostname    string
	IsLeader    bool
	ClusterInfo *model.ClusterInfo
	Diagnostics *model.NodeDiagnostics
	// CollectErr is set when the node's diagnostics could not be collected, in which case
	// Diagnostics is nil. It is ErrNodeNoReply or ErrNodeOlderVersion.
	CollectErr error
}

// SelectLeader marks the node whose own diagnostics report it as leader, the same rule for
// live and offline snapshots. If no node does, it marks fallback and reported is false.
func SelectLeader(nodes []*NodeSnapshot, fallback *NodeSnapshot) (leader *NodeSnapshot, reported bool) {
	leader = fallback
	for _, node := range nodes {
		if diag, ok := node.Diag(); ok && diag.Cluster.IsLeader {
			leader = node
			reported = true
			break
		}
	}

	leader.IsLeader = true
	return leader, reported
}

func (n *NodeSnapshot) Diag() (*model.SupportPacketDiagnostics, bool) {
	if n == nil || n.Diagnostics == nil || n.Diagnostics.Diagnostics == nil {
		return nil, false
	}

	return n.Diagnostics.Diagnostics, true
}

// NodeVersion prefers cluster info so a live snapshot, where a node that did not reply has no
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
