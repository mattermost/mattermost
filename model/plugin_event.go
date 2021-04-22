// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	PluginEventSendTypeReliable   = CLUSTER_SEND_RELIABLE
	PluginEventSendTypeBestEffort = CLUSTER_SEND_BEST_EFFORT
)

// PluginEvent is used to allow intra-cluster plugin communication.
type PluginEvent struct {
	// Id is the unique identifier for the event.
	Id string
	// Data is the event payload.
	Data []byte
}

// PluginEventSendOptions defines some properties that apply when sending
// plugin events across a cluster.
type PluginEventSendOptions struct {
	// SendType defines the type of communication channel used to send the event.
	SendType string
}
