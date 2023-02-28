// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/v6/channels/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/services/remotecluster"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

// channelInviteMsg represents an invitation for a remote cluster to start sharing a channel.
type channelInviteMsg struct {
	ChannelId            string            `json:"channel_id"`
	TeamId               string            `json:"team_id"`
	ReadOnly             bool              `json:"read_only"`
	Name                 string            `json:"name"`
	DisplayName          string            `json:"display_name"`
	Header               string            `json:"header"`
	Purpose              string            `json:"purpose"`
	Type                 model.ChannelType `json:"type"`
	DirectParticipantIDs []string          `json:"direct_participant_ids"`
}

type InviteOption func(msg *channelInviteMsg)

func WithDirectParticipantID(participantID string) InviteOption {
	return func(msg *channelInviteMsg) {
		msg.DirectParticipantIDs = append(msg.DirectParticipantIDs, participantID)
	}
}

// SendChannelInvite asynchronously sends a channel invite to a remote cluster. The remote cluster is
// expected to create a new channel with the same channel id, and respond with status OK.
// If an error occurs on the remote cluster then an ephemeral message is posted to in the channel for userId.
func (scs *Service) SendChannelInvite(channel *model.Channel, userId string, rc *model.RemoteCluster, options ...InviteOption) error {
	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil {
		return fmt.Errorf("cannot invite remote cluster for channel id %s; Remote Cluster Service not enabled", channel.Id)
	}

	sc, err := scs.server.GetStore().SharedChannel().Get(channel.Id)
	if err != nil {
		return err
	}

	invite := channelInviteMsg{
		ChannelId:   channel.Id,
		TeamId:      rc.RemoteTeamId,
		ReadOnly:    sc.ReadOnly,
		Name:        sc.ShareName,
		DisplayName: sc.ShareDisplayName,
		Header:      sc.ShareHeader,
		Purpose:     sc.SharePurpose,
		Type:        channel.Type,
	}

	for _, option := range options {
		option(&invite)
	}

	json, err := json.Marshal(invite)
	if err != nil {
		return err
	}

	msg := model.NewRemoteClusterMsg(TopicChannelInvite, json)

	ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
	defer cancel()

	return rcs.SendMsg(ctx, msg, rc, func(msg model.RemoteClusterMsg, rc *model.RemoteCluster, resp *remotecluster.Response, err error) {
		if err != nil || !resp.IsSuccess() {
			scs.sendEphemeralPost(channel.Id, userId, fmt.Sprintf("Error sending channel invite for %s: %s", rc.DisplayName, combineErrors(err, resp.Err)))
			return
		}

		scr := &model.SharedChannelRemote{
			ChannelId:         sc.ChannelId,
			CreatorId:         userId,
			RemoteId:          rc.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
		}
		if _, err = scs.server.GetStore().SharedChannel().SaveRemote(scr); err != nil {
			scs.sendEphemeralPost(channel.Id, userId, fmt.Sprintf("Error confirming channel invite for %s: %v", rc.DisplayName, err))
			return
		}
		scs.NotifyChannelChanged(sc.ChannelId)
		scs.sendEphemeralPost(channel.Id, userId, fmt.Sprintf("`%s` has been added to channel.", rc.DisplayName))
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

func (scs *Service) onReceiveChannelInvite(msg model.RemoteClusterMsg, rc *model.RemoteCluster, _ *remotecluster.Response) error {
	if len(msg.Payload) == 0 {
		return nil
	}

	var invite channelInviteMsg

	if err := json.Unmarshal(msg.Payload, &invite); err != nil {
		return fmt.Errorf("invalid channel invite: %w", err)
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Channel invite received",
		mlog.String("remote", rc.DisplayName),
		mlog.String("channel_id", invite.ChannelId),
		mlog.String("channel_name", invite.Name),
		mlog.String("team_id", invite.TeamId),
	)

	// create channel if it doesn't exist; the channel may already exist, such as if it was shared then unshared at some point.
	channel, err := scs.server.GetStore().Channel().Get(invite.ChannelId, true)
	if err != nil {
		if channel, err = scs.handleChannelCreation(invite, rc); err != nil {
			return err
		}
	}

	if invite.ReadOnly {
		if err := scs.makeChannelReadOnly(channel); err != nil {
			return fmt.Errorf("cannot make channel readonly `%s`: %w", invite.ChannelId, err)
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
		RemoteId:         rc.RemoteId,
		Type:             channel.Type,
	}

	if _, err := scs.server.GetStore().SharedChannel().Save(sharedChannel); err != nil {
		scs.app.PermanentDeleteChannel(request.EmptyContext(scs.server.Log()), channel)
		return fmt.Errorf("cannot create shared channel (channel_id=%s): %w", invite.ChannelId, err)
	}

	sharedChannelRemote := &model.SharedChannelRemote{
		Id:                model.NewId(),
		ChannelId:         channel.Id,
		CreatorId:         channel.CreatorId,
		IsInviteAccepted:  true,
		IsInviteConfirmed: true,
		RemoteId:          rc.RemoteId,
	}

	if _, err := scs.server.GetStore().SharedChannel().SaveRemote(sharedChannelRemote); err != nil {
		scs.app.PermanentDeleteChannel(request.EmptyContext(scs.server.Log()), channel)
		scs.server.GetStore().SharedChannel().Delete(sharedChannel.ChannelId)
		return fmt.Errorf("cannot create shared channel remote (channel_id=%s): %w", invite.ChannelId, err)
	}
	return nil
}

func (scs *Service) handleChannelCreation(invite channelInviteMsg, rc *model.RemoteCluster) (*model.Channel, error) {
	if invite.Type == model.ChannelTypeDirect {
		return scs.createDirectChannel(invite)
	}

	channelNew := &model.Channel{
		Id:          invite.ChannelId,
		TeamId:      invite.TeamId,
		Type:        invite.Type,
		DisplayName: invite.DisplayName,
		Name:        invite.Name,
		Header:      invite.Header,
		Purpose:     invite.Purpose,
		CreatorId:   rc.CreatorId,
		Shared:      model.NewBool(true),
	}

	// check user perms?
	channel, appErr := scs.app.CreateChannelWithUser(request.EmptyContext(scs.server.Log()), channelNew, rc.CreatorId)
	if appErr != nil {
		return nil, fmt.Errorf("cannot create channel `%s`: %w", invite.ChannelId, appErr)
	}

	return channel, nil
}

func (scs *Service) createDirectChannel(invite channelInviteMsg) (*model.Channel, error) {
	if len(invite.DirectParticipantIDs) != 2 {
		return nil, fmt.Errorf("cannot create direct channel `%s` insufficient participant count `%d`", invite.ChannelId, len(invite.DirectParticipantIDs))
	}

	channel, err := scs.app.GetOrCreateDirectChannel(request.EmptyContext(scs.server.Log()), invite.DirectParticipantIDs[0], invite.DirectParticipantIDs[1], model.WithID(invite.ChannelId))
	if err != nil {
		return nil, fmt.Errorf("cannot create direct channel `%s`: %w", invite.ChannelId, err)
	}

	return channel, nil
}
