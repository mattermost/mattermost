// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type SectionErrors map[NodeSection]error

type NodeDiagnostics struct {
	Diagnostics *SupportPacketDiagnostics
	Errors      SectionErrors
}

// HealthCollectRequest asks every node for its diagnostics for one health check run.
type HealthCollectRequest struct {
	RunID       string `json:"run_id"`
	RequesterID string `json:"requester_id"` // the evaluating node's cluster ID
}

// HealthCollectReply is one node's answer. Diagnostics holds the node's diagnostics.yaml
// bytes, so SupportPacketDiagnostics keeps one serialization (it has yaml tags only).
// Errors carries SectionErrors as strings, since error values do not serialize; a section
// that collected cleanly maps to "".
type HealthCollectReply struct {
	RunID       string                 `json:"run_id"`
	NodeID      string                 `json:"node_id"`
	Diagnostics []byte                 `json:"diagnostics"`
	Errors      map[NodeSection]string `json:"errors"`
}
