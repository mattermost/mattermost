// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

// channelUnshareMsg represents a notification to a remote cluster to unshare a channel.
type channelUnshareMsg struct {
	ChannelId string `json:"channel_id"`
	RemoteId  string `json:"remote_id"`
}

// SendChannelUnshare asynchronously sends an unshare notification to a remote cluster.
// The remote cluster is expected to remove the channel from its shared channels list.
func (scs *Service) SendChannelUnshare(channelID, userId string, rc *model.RemoteCluster) error {
	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		return fmt.Errorf("cannot send unshare notification; Remote Cluster Service not enabled")
	}

	// Even if the remote is offline, we still attempt to send the notification
	// The onSent callback will handle the failure case
	if !rc.IsOnline() {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Remote is offline, attempting to send unshare notification anyway",
			mlog.String("remote", rc.DisplayName),
			mlog.String("channel_id", channelID),
		)
	}

	unshare := channelUnshareMsg{
		ChannelId: channelID,
		RemoteId:  rc.RemoteId,
	}

	jsonMsg, err := json.Marshal(unshare)
	if err != nil {
		return fmt.Errorf("error marshaling unshare message: %w", err)
	}

	msg := model.NewRemoteClusterMsg(TopicChannelUnshare, jsonMsg)

	// onSent is called after unshare notification is sent
	onSent := func(_ model.RemoteClusterMsg, rc *model.RemoteCluster, resp *remotecluster.Response, err error) {
		if err != nil || !resp.IsSuccess() {
			// Simplified error handling
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error sending channel unshare notification",
				mlog.String("remote", rc.DisplayName),
				mlog.String("channel_id", channelID),
				mlog.Err(err),
			)
			return
		}

		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Channel unshare notification sent successfully",
			mlog.String("remote", rc.DisplayName),
			mlog.String("channel_id", channelID),
		)
	}

	ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
	defer cancel()

	return rcs.SendMsg(ctx, msg, rc, onSent)
}

func (scs *Service) onReceiveChannelUnshare(msg model.RemoteClusterMsg, rc *model.RemoteCluster, _ *remotecluster.Response) error {
	if len(msg.Payload) == 0 {
		return nil
	}

	var unshare channelUnshareMsg
	if err := json.Unmarshal(msg.Payload, &unshare); err != nil {
		return fmt.Errorf("invalid channel unshare message: %w", err)
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Channel unshare notification received",
		mlog.String("remote", rc.DisplayName),
		mlog.String("channel_id", unshare.ChannelId),
	)

	// Check if the channel exists
	rcvChannel, err := scs.server.GetStore().Channel().Get(unshare.ChannelId, true)
	if err != nil {
		// Channel doesn't exist, nothing to do
		return nil
	}

	// Check that this is a shared channel
	sc, err := scs.server.GetStore().SharedChannel().Get(unshare.ChannelId)
	if err != nil {
		// Channel is already not shared, nothing to do
		return nil
	}

	// Verify this is a valid unshare request:
	// 1. This must be a non-home channel (remotes receive unshare notifications)
	// 2. The request must come from the home of the channel
	if sc.Home || sc.RemoteId != rc.RemoteId {
		return fmt.Errorf("invalid unshare request: channel_id=%s, home=%t, remote_id=%s",
			unshare.ChannelId, sc.Home, rc.RemoteId)
	}

	// Unshare the channel locally
	_, err = scs.server.GetStore().SharedChannel().Delete(unshare.ChannelId)
	if err != nil {
		return fmt.Errorf("cannot unshare channel %s: %w", unshare.ChannelId, err)
	}

	// Channel is no longer shared, update flags and notify clients
	rcvChannel.Shared = model.NewPointer(false)
	scs.notifyClientsForSharedChannelConverted(rcvChannel)

	// Post bot message that channel is no longer shared
	post := &model.Post{
		UserId:    rc.CreatorId,
		ChannelId: unshare.ChannelId,
		Message:   UnshareMessage,
		Type:      model.PostTypeSystemGeneric,
	}

	if _, appErr := scs.app.CreatePost(request.EmptyContext(scs.server.Log()), post, rcvChannel, model.CreatePostFlags{}); appErr != nil {
		// Log the error but don't fail the unshare operation
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error creating unshare notification post",
			mlog.String("channel_id", unshare.ChannelId),
			mlog.Err(appErr),
		)
	}

	return nil
}
