// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v5/model"
)

// channelInviteMsg represents an invitation for a remote cluster to start sharing a channel.
type channelInviteMsg struct {
	ChannelId   string `json:"channel_id"`
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Header      string `json:"header"`
	Purpose     string `json:"purpose"`
}

// SendChannelInvite sends a channel invite to a remote cluster. The remote cluster is expected to create
// a new channel with the same channel id, and respond with status OK.
// If an error occurs then an ephemeral message is posted to in the channel for userId.
func (scs *Service) SendChannelInvite(channelId string, userId string, rc *model.RemoteCluster) error {
	return fmt.Errorf("Not immplemented yet")
}
