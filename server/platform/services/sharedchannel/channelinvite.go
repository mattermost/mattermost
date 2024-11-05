// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

// channelInviteMsg represents an invitation for a remote cluster to start sharing a channel.
type channelInviteMsg struct {
	ChannelId            string            `json:"channel_id"`
	TeamId               string            `json:"team_id"` // Deprecated: this field is no longer used. It's only kept for backwards compatibility.
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

	// if the remote is not currently online, we store the invite to
	// send it when the connection is restored
	if !rc.IsOnline() {
		if len(options) > 0 {
			// pending invites with options are currently not supported
			scs.sendEphemeralPost(channel.Id, userId, fmt.Sprintf("Error sending channel invite for %s: %s", rc.DisplayName, model.ErrOfflineRemote))
			return model.ErrOfflineRemote
		}

		scr := &model.SharedChannelRemote{
			ChannelId:         sc.ChannelId,
			CreatorId:         userId,
			RemoteId:          rc.RemoteId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: false,
		}
		if _, err = scs.server.GetStore().SharedChannel().SaveRemote(scr); err != nil {
			scs.sendEphemeralPost(channel.Id, userId, fmt.Sprintf("Error saving channel invite for %s: %v", rc.DisplayName, err))
			return err
		}

		return nil
	}

	invite := channelInviteMsg{
		ChannelId:   channel.Id,
		ReadOnly:    sc.ReadOnly,
		Name:        channel.Name,
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

	// onInvite is called after invite is sent, whether to a remote cluster or plugin.
	onInvite := func(_ model.RemoteClusterMsg, rc *model.RemoteCluster, resp *remotecluster.Response, err error) {
		if err != nil || !resp.IsSuccess() {
			scs.sendEphemeralPost(channel.Id, userId, fmt.Sprintf("Error sending channel invite for %s: %s", rc.DisplayName, combineErrors(err, resp.Err)))
			return
		}

		existingScr, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(sc.ChannelId, rc.RemoteId)
		var errNotFound *store.ErrNotFound
		if err != nil && !errors.As(err, &errNotFound) {
			scs.sendEphemeralPost(channel.Id, userId, fmt.Sprintf("Error sending channel invite for %s: %s", rc.DisplayName, err))
			return
		}

		curTime := model.GetMillis()
		if existingScr != nil {
			if existingScr.DeleteAt == 0 && existingScr.IsInviteConfirmed {
				// the shared channel remote exists and is not
				// deleted, nothing to do here
				return
			}

			// the shared channel remote was deleted in the past or
			// pending confirmation, so with the new invite we restore
			// it
			existingScr.DeleteAt = 0
			existingScr.UpdateAt = curTime
			existingScr.LastPostCreateAt = curTime
			existingScr.LastPostUpdateAt = curTime
			existingScr.IsInviteConfirmed = true
			if _, sErr := scs.server.GetStore().SharedChannel().UpdateRemote(existingScr); sErr != nil {
				scs.sendEphemeralPost(channel.Id, userId, fmt.Sprintf("Error confirming channel invite for %s: %v", rc.DisplayName, sErr))
				return
			}
		} else {
			// the shared channel remote doesn't exists, so we create it
			scr := &model.SharedChannelRemote{
				ChannelId:         sc.ChannelId,
				CreatorId:         userId,
				RemoteId:          rc.RemoteId,
				IsInviteAccepted:  true,
				IsInviteConfirmed: true,
				LastPostCreateAt:  curTime,
				LastPostUpdateAt:  curTime,
			}
			if _, err = scs.server.GetStore().SharedChannel().SaveRemote(scr); err != nil {
				scs.sendEphemeralPost(channel.Id, userId, fmt.Sprintf("Error confirming channel invite for %s: %v", rc.DisplayName, err))
				return
			}
		}

		scs.NotifyChannelChanged(sc.ChannelId)
		scs.sendEphemeralPost(channel.Id, userId, fmt.Sprintf("`%s` has been added to channel.", rc.DisplayName))
	}

	if rc.IsPlugin() {
		// for now plugins are considered fully invited automatically
		// TODO: MM-57537 create plugin hook that passes invitation to plugins if BitflagOptionAutoInvited is not set
		onInvite(msg, rc, &remotecluster.Response{Status: remotecluster.ResponseStatusOK}, nil)
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), remotecluster.SendTimeout)
	defer cancel()

	return rcs.SendMsg(ctx, msg, rc, onInvite)
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

	// check if channel already exists
	existingScr, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(invite.ChannelId, rc.RemoteId)
	var errNotFound *store.ErrNotFound
	if err != nil && !errors.As(err, &errNotFound) {
		return fmt.Errorf("cannot get deleted shared channel remote (channel_id=%s): %w", invite.ChannelId, err)
	}

	if existingScr != nil && existingScr.DeleteAt == 0 {
		// the channel is already shared, nothing to do
		return nil
	}

	var channel *model.Channel
	var created bool
	if existingScr == nil {
		var err error
		_, err = scs.server.GetStore().Channel().Get(invite.ChannelId, true)
		if err == nil {
			// the channel already exists on this server and was not
			// previously shared, so we reject the invite
			return fmt.Errorf("cannot create new shared channel (channel_id=%s): %w", invite.ChannelId, model.ErrChannelAlreadyExists)
		}

		// create new local channel to sync with the remote channel
		if channel, created, err = scs.handleChannelCreation(invite, rc); err != nil {
			return err
		}

		// sanity check to ensure the channel returned has the expected id. Otherwise sync will not work as expected and will fail
		// silently.
		if invite.ChannelId != channel.Id {
			// as of this writing, this scenario should only be possible if the invite included a DM channel invitation with a
			// combination of two user ids (one remote, one local) that already have a DM on this server. Very unlikely unless
			// the remote is compromised AND has knowledge of the local user id.
			// Another possibility would be an actual user ID collision between two servers, where the likelihood is
			// infinitesimally small
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Channel invite failed - channel created/fetched with wrong id",
				mlog.String("remote", rc.DisplayName),
				mlog.String("channel_id", invite.ChannelId),
				mlog.String("channel_type", invite.Type),
				mlog.String("channel_name", invite.Name),
				mlog.String("team_id", invite.TeamId),
				mlog.Array("dm_partics", invite.DirectParticipantIDs),
			)
			return fmt.Errorf("cannot create shared channel (DM channel_id=%s): %w", invite.ChannelId, model.ErrChannelAlreadyExists)
		}

		// mark the newly created channel read-only if requested in the invite
		if invite.ReadOnly {
			if err := scs.makeChannelReadOnly(channel); err != nil {
				return fmt.Errorf("cannot make channel readonly `%s`: %w", invite.ChannelId, err)
			}
		}
	} else {
		var err error
		channel, err = scs.server.GetStore().Channel().Get(invite.ChannelId, true)
		if err != nil {
			return fmt.Errorf("cannot get channel (channel_id=%s) to restore a shared channel remote: %w", invite.ChannelId, err)
		}
	}

	sharedChannel := &model.SharedChannel{
		ChannelId:        channel.Id,
		TeamId:           channel.TeamId,
		Home:             false,
		ReadOnly:         existingScr == nil && invite.ReadOnly, // only set read only flag for new shares
		ShareName:        channel.Name,
		ShareDisplayName: channel.DisplayName,
		SharePurpose:     channel.Purpose,
		ShareHeader:      channel.Header,
		CreatorId:        rc.CreatorId,
		RemoteId:         rc.RemoteId,
		Type:             channel.Type,
	}

	if _, err := scs.server.GetStore().SharedChannel().Save(sharedChannel); err != nil {
		// delete the newly created channel since we could not create a SharedChannel record for it
		if created {
			scs.app.PermanentDeleteChannel(request.EmptyContext(scs.server.Log()), channel)
		}
		return fmt.Errorf("cannot create shared channel (channel_id=%s): %w", invite.ChannelId, err)
	}

	curTime := model.GetMillis()
	if existingScr != nil {
		existingScr.DeleteAt = 0
		existingScr.UpdateAt = curTime
		existingScr.LastPostCreateAt = curTime
		existingScr.LastPostUpdateAt = curTime
		if _, err := scs.server.GetStore().SharedChannel().UpdateRemote(existingScr); err != nil {
			return fmt.Errorf("cannot restore deleted shared channel remote (channel_id=%s): %w", invite.ChannelId, err)
		}
	} else {
		scr := &model.SharedChannelRemote{
			Id:                model.NewId(),
			ChannelId:         channel.Id,
			CreatorId:         channel.CreatorId,
			IsInviteAccepted:  true,
			IsInviteConfirmed: true,
			RemoteId:          rc.RemoteId,
			LastPostCreateAt:  model.GetMillis(),
			LastPostUpdateAt:  model.GetMillis(),
		}

		if _, err := scs.server.GetStore().SharedChannel().SaveRemote(scr); err != nil {
			// delete the newly created channel since we could not create a SharedChannelRemote record for it,
			// and delete the newly created SharedChannel record as well.
			if created {
				scs.app.PermanentDeleteChannel(request.EmptyContext(scs.server.Log()), channel)
			}
			scs.server.GetStore().SharedChannel().Delete(sharedChannel.ChannelId)
			return fmt.Errorf("cannot create shared channel remote (channel_id=%s): %w", invite.ChannelId, err)
		}
	}
	return nil
}

// handleChannelCreation creates a new channel to represent the remote channel in the invitation.
// For DMs there is a chance the channel already exists (shared, unshared, shared again) and the boolean
// determines if the channel was newly created (true=new)
func (scs *Service) handleChannelCreation(invite channelInviteMsg, rc *model.RemoteCluster) (*model.Channel, bool, error) {
	if invite.Type == model.ChannelTypeDirect {
		return scs.createDirectChannel(invite, rc)
	}

	teamId := rc.DefaultTeamId
	// if the remote doesn't have a teamId associated and until the
	// acceptance of an invite includes selecting a team, we use the
	// first team of the list
	if teamId == "" {
		teams, err := scs.server.GetStore().Team().GetAllPage(0, 1, nil)
		if err != nil {
			return nil, false, fmt.Errorf("cannot get team to create the channel `%s`: %w", invite.ChannelId, err)
		}
		teamId = teams[0].Id
	}

	channelNew := &model.Channel{
		Id:          invite.ChannelId,
		TeamId:      teamId,
		Type:        invite.Type,
		DisplayName: invite.DisplayName,
		Name:        invite.Name,
		Header:      invite.Header,
		Purpose:     invite.Purpose,
		CreatorId:   rc.CreatorId,
		Shared:      model.NewPointer(true),
	}

	// check user perms?
	channel, appErr := scs.app.CreateChannelWithUser(request.EmptyContext(scs.server.Log()), channelNew, rc.CreatorId)
	if appErr != nil {
		return nil, false, fmt.Errorf("cannot create channel `%s`: %w", invite.ChannelId, appErr)
	}

	return channel, true, nil
}

// createDirectChannel creates a DM channel, or fetches an existing channel, and returns the channel plus a boolean
// indicating if the channel is new.
func (scs *Service) createDirectChannel(invite channelInviteMsg, rc *model.RemoteCluster) (*model.Channel, bool, error) {
	if len(invite.DirectParticipantIDs) != 2 {
		return nil, false, fmt.Errorf("cannot create direct channel `%s` insufficient participant count `%d`", invite.ChannelId, len(invite.DirectParticipantIDs))
	}

	user1, err := scs.server.GetStore().User().Get(context.TODO(), invite.DirectParticipantIDs[0])
	if err != nil {
		return nil, false, fmt.Errorf("cannot create direct channel `%s` cannot fetch user1 (%s): %w", invite.ChannelId, invite.DirectParticipantIDs[0], err)
	}

	user2, err := scs.server.GetStore().User().Get(context.TODO(), invite.DirectParticipantIDs[1])
	if err != nil {
		return nil, false, fmt.Errorf("cannot create direct channel `%s` cannot fetch user2 (%s): %w", invite.ChannelId, invite.DirectParticipantIDs[1], err)
	}

	// determine the remote user
	// - if both are remote then the DM channel does not belong on this server
	// - if neither are remote then the DM channel should not be created via sync message
	// - if only one is remote then we check visibility relative to that user
	userRemote := user1
	userLocal := user2
	if !userRemote.IsRemote() {
		userRemote = user2
		userLocal = user1
	}

	if !userRemote.IsRemote() {
		return nil, false, fmt.Errorf("cannot create direct channel `%s` remote user is not remote (%s)", invite.ChannelId, userRemote.Id)
	}

	if userLocal.IsRemote() {
		return nil, false, fmt.Errorf("cannot create direct channel `%s` local user is not local (%s)", invite.ChannelId, userLocal.Id)
	}

	if userRemote.GetRemoteID() != rc.RemoteId {
		return nil, false, fmt.Errorf("cannot create direct channel `%s`: %w", invite.ChannelId, ErrRemoteIDMismatch)
	}

	// ensure remote user is allowed to DM the local user
	canSee, appErr := scs.app.UserCanSeeOtherUser(request.EmptyContext(scs.server.Log()), userRemote.Id, userLocal.Id)
	if appErr != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "cannot check user visibility for DM creation",
			mlog.String("user_remote", userRemote.Id),
			mlog.String("user_local", userLocal.Id),
			mlog.String("channel_id", invite.ChannelId),
			mlog.Err(appErr),
		)
		return nil, false, fmt.Errorf("cannot check user visibility for DM (%s) creation: %w", invite.ChannelId, appErr)
	}
	if !canSee {
		return nil, false, fmt.Errorf("cannot create direct channel `%s`: %w", invite.ChannelId, ErrUserDMPermission)
	}

	// check if this DM already exists.
	channelName := model.GetDMNameFromIds(userRemote.Id, userLocal.Id)
	channelExists, err := scs.server.GetStore().Channel().GetByName("", channelName, true)
	if err != nil && !isNotFoundError(err) {
		return nil, false, fmt.Errorf("cannot check DM channel exists (%s): %w", channelName, err)
	}
	if channelExists != nil {
		if channelExists.Id == invite.ChannelId {
			return channelExists, false, nil
		}
		return nil, false, fmt.Errorf("cannot create direct channel `%s`: channel exists with wrong id", channelName)
	}

	// create the channel
	channel, appErr := scs.app.GetOrCreateDirectChannel(request.EmptyContext(scs.server.Log()), userRemote.Id, userLocal.Id, model.WithID(invite.ChannelId))
	if appErr != nil {
		return nil, false, fmt.Errorf("cannot create direct channel `%s`: %w", invite.ChannelId, appErr)
	}

	return channel, true, nil
}
