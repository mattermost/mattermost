// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

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
func (scs *Service) SendChannelInvite(channelId string, userId string, description string, rc *model.RemoteCluster) error {

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
			scs.sendEphemeralPost(channelId, userId, fmt.Sprintf("Error sending channel invite for %s: %s", rc.DisplayName, combineErrors(err, resp.Error())))
			return
		}

		scr := &model.SharedChannelRemote{
			ChannelId:         sc.ChannelId,
			Token:             model.NewId(),
			Description:       description,
			CreatorId:         userId,
			RemoteClusterId:   rc.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
		}
		if _, err = scs.server.GetStore().SharedChannel().SaveRemote(scr); err != nil {
			scs.sendEphemeralPost(channelId, userId, fmt.Sprintf("Error confirming channel invite for %s: %v", rc.DisplayName, err))
			return
		}
		scs.sendEphemeralPost(channelId, userId, fmt.Sprintf("`%s` has been added to channel.", rc.DisplayName))
	})
}

func combineErrors(err error, serror string) string {
	var sb strings.Builder
	if err != nil {
		sb.WriteString(err.Error())
	}
	if serror != "" {
		if sb.Len() > 0 {
			sb.WriteString("; ")
		}
		sb.WriteString(serror)
	}
	return sb.String()
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
		return fmt.Errorf("invalid channel invite: %v", err)
	}

	scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Channel invite received",
		mlog.String("remote", rc.DisplayName),
		mlog.String("channel_id", invite.ChannelId),
		mlog.String("channel_name", invite.Name),
	)

	// create channel if it doesn't exist; the channel may already exist, such as if it was shared then unshared at some point.
	channel, err := scs.server.GetStore().Channel().Get(invite.ChannelId, true)
	if err != nil {
		channelNew := &model.Channel{
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
		var appErr *model.AppError
		if channel, appErr = scs.app.CreateChannelWithUser(channelNew, rc.CreatorId); appErr != nil {
			return err
		}
	}

	sharedChannel := &model.SharedChannel{
		ChannelId:        channel.Id,
		TeamId:           channel.TeamId,
		Home:             false,
		ReadOnly:         invite.ReadOnly,
		ShareName:        channel.Name,
		ShareDisplayName: channel.DisplayName,
		SharePurpose:     channel.Purpose,
		ShareHeader:      channel.Header,
		CreatorId:        rc.CreatorId,
	}

	if _, err := scs.server.GetStore().SharedChannel().Save(sharedChannel); err != nil {
		scs.app.DeleteChannel(channel, channel.CreatorId)
		return err
	}

	sharedChannelRemote := &model.SharedChannelRemote{
		Id:                model.NewId(),
		ChannelId:         channel.Id,
		Description:       invite.DisplayName,
		CreatorId:         channel.CreatorId,
		IsInviteAccepted:  true,
		IsInviteConfirmed: true,
		RemoteClusterId:   rc.RemoteId,
	}

	if _, err := scs.server.GetStore().SharedChannel().SaveRemote(sharedChannelRemote); err != nil {
		scs.app.DeleteChannel(channel, channel.CreatorId)
		scs.server.GetStore().SharedChannel().Delete(sharedChannel.ChannelId)
		return err
	}
	return nil
}
