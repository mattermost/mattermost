// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/remotecluster"
)

// channelInviteMsg represents an invitation for a remote cluster to start sharing a channel.
type channelInviteMsg struct {
	ChannelId   string `json:"channel_id"`
	TeamId      string `json:"team_id"`
	ReadOnly    bool   `json:"read_only"`
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Header      string `json:"header"`
	Purpose     string `json:"purpose"`
}

// SendChannelInvite asynchronously sends a channel invite to a remote cluster. The remote cluster is
// expected to create a new channel with the same channel id, and respond with status OK.
// If an error occurs on the remote cluster then an ephemeral message is posted to in the channel for userId.
func (scs *Service) SendChannelInvite(channelId string, userId string, rc *model.RemoteCluster) error {

	sc, err := scs.server.GetStore().SharedChannel().Get(channelId)
	if err != nil {
		return err
	}

	invite := channelInviteMsg{
		ChannelId:   sc.ChannelId,
		TeamId:      rc.RemoteTeamId,
		ReadOnly:    sc.ReadOnly,
		Name:        sc.ShareName,
		DisplayName: sc.ShareDisplayName,
		Header:      sc.ShareHeader,
		Purpose:     sc.SharePurpose,
	}

	json, err := json.Marshal(invite)
	if err != nil {
		return err
	}

	msg := model.NewRemoteClusterMsg(TopicChannelInvite, json)

	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		return fmt.Errorf("cannot invite remote cluster for channel id %s; Remote Cluster Service not enabled", channelId)
	}

	ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
	defer cancel()

	return rcs.SendMsg(ctx, msg, rc, func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp remotecluster.Response, err error) {
		if err != nil || !resp.IsSuccess() {
			ephemeral := &model.Post{
				ChannelId: channelId,
				Message:   fmt.Sprintf("Error sending channel invite for %s: %v, %v", rc.DisplayName, err, resp.Error()),
				CreateAt:  model.GetMillis(),
			}
			scs.app.SendEphemeralPost(userId, ephemeral)
			return
		}

		scr, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(channelId, rc.RemoteId)
		if err != nil {
			return
		}
		scr.IsInviteAccepted = true
		scr.IsInviteConfirmed = true

		if _, err = scs.server.GetStore().SharedChannel().UpdateRemote(scr); err != nil {
			ephemeral := &model.Post{
				ChannelId: channelId,
				Message:   fmt.Sprintf("Error confirming channel invite for %s: %v, %v", rc.DisplayName, err, resp.Error()),
				CreateAt:  model.GetMillis(),
			}
			scs.app.SendEphemeralPost(userId, ephemeral)
		}
	})
}

func (scs *Service) OnReceiveChannelInvite(msg model.RemoteClusterMsg, rc *model.RemoteCluster, response remotecluster.Response) error {
	if msg.Topic != TopicChannelInvite {
		return nil
	}

	if len(msg.Payload) == 0 {
		return nil
	}

	var invite channelInviteMsg

	if err := json.Unmarshal(msg.Payload, &invite); err != nil {
		response[remotecluster.ResponseStatusKey] = remotecluster.ResponseStatusFail
		response[remotecluster.ResponseErrorKey] = fmt.Sprintf("Invalid channel invite: %v", err)
		return err
	}

	scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Channel invite received",
		mlog.String("remote", rc.DisplayName),
		mlog.String("channel_id", invite.ChannelId),
		mlog.String("channel_name", invite.Name),
	)

	channel := &model.Channel{
		Id:          invite.ChannelId,
		TeamId:      invite.TeamId,
		Type:        model.CHANNEL_PRIVATE,
		DisplayName: invite.DisplayName,
		Name:        invite.Name,
		Header:      invite.Header,
		Purpose:     invite.Purpose,
		CreatorId:   rc.CreatorId,
		Shared:      model.NewBool(true),
	}

	// check user perms?

	savedChannel, err := scs.app.CreateChannelWithUser(channel, rc.CreatorId)
	if err != nil {
		return err
	}

	sharedChannel := &model.SharedChannel{
		ChannelId:        savedChannel.Id,
		TeamId:           savedChannel.TeamId,
		Home:             false,
		ReadOnly:         invite.ReadOnly,
		ShareName:        savedChannel.Name,
		ShareDisplayName: savedChannel.DisplayName,
		SharePurpose:     savedChannel.Purpose,
		ShareHeader:      savedChannel.Header,
		CreatorId:        rc.CreatorId,
	}

	if _, err := scs.server.GetStore().SharedChannel().Save(sharedChannel); err != nil {
		scs.app.DeleteChannel(savedChannel, savedChannel.CreatorId)
		return err
	}

	sharedChannelRemote := &model.SharedChannelRemote{
		Id:                model.NewId(),
		ChannelId:         savedChannel.Id,
		Description:       invite.DisplayName,
		CreatorId:         savedChannel.CreatorId,
		IsInviteAccepted:  true,
		IsInviteConfirmed: true,
		RemoteClusterId:   rc.RemoteId,
	}

	if _, err := scs.server.GetStore().SharedChannel().SaveRemote(sharedChannelRemote); err != nil {
		scs.app.DeleteChannel(savedChannel, savedChannel.CreatorId)
		scs.server.GetStore().SharedChannel().Delete(sharedChannel.ChannelId)
		return err
	}
	return nil
}
