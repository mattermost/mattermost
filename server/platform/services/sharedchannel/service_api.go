// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// ShareChannel marks a local channel as shared. If the channel is already shared this method has
// no effect and returns without error.
// TeamId, type, displayname, purpose, and header are fetched from the channel if not provided.
func (scs *Service) ShareChannel(sc *model.SharedChannel) (*model.SharedChannel, error) {
	channel, err := scs.server.GetStore().Channel().Get(sc.ChannelId, true)
	if err != nil {
		return nil, fmt.Errorf("cannot fetch channel while sharing channel %s: %w", sc.ChannelId, err)
	}

	if !scs.server.Config().FeatureFlags.EnableSharedChannelsDMs && (channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup) {
		return nil, errors.New("cannot share a direct or group channel")
	}

	// check if channel is already shared
	scExisting, err := scs.server.GetStore().SharedChannel().Get(sc.ChannelId)
	if err == nil {
		// already shared, nothing to do
		return scExisting, nil
	}
	if !isNotFoundError(err) {
		return nil, fmt.Errorf("cannot check if channel %s is shared: %w", sc.ChannelId, err)
	}

	if sc.TeamId == "" {
		sc.TeamId = channel.TeamId
	}
	if sc.Type == "" {
		sc.Type = channel.Type
	}
	if sc.ShareName == "" {
		sc.ShareName = channel.Name
	}
	if sc.ShareDisplayName == "" {
		sc.ShareDisplayName = channel.DisplayName
	}
	if sc.SharePurpose == "" {
		sc.SharePurpose = channel.Purpose
	}
	if sc.ShareHeader == "" {
		sc.ShareHeader = channel.Header
	}
	if sc.CreatorId == "" {
		sc.CreatorId = channel.CreatorId
	}

	// stores the SharedChannel and sets the share flag on the channel.
	scNew, err := scs.server.GetStore().SharedChannel().Save(sc)
	if err != nil {
		return nil, err
	}
	// to avoid fetching the channel again, we manually set the shared
	// flag before notifying the clients
	channel.Shared = model.NewPointer(true)

	scs.notifyClientsForSharedChannelConverted(channel)
	return scNew, nil
}

// UpdateSharedChannel updates the shared channel details such as displayname, purpose, or header
func (scs *Service) UpdateSharedChannel(sc *model.SharedChannel) (*model.SharedChannel, error) {
	channel, err := scs.server.GetStore().Channel().Get(sc.ChannelId, true)
	if err != nil {
		return nil, err
	}

	scUpdated, err := scs.server.GetStore().SharedChannel().Update(sc)
	if err != nil {
		return nil, err
	}

	scs.notifyClientsForSharedChannelUpdate(channel)
	return scUpdated, nil
}

// UnshareChannel unshared the channel by deleting the SharedChannels record and unsets the Channel `shared` flag.
// Returns true if a shared channel existed and was deleted.
func (scs *Service) UnshareChannel(channelID string) (bool, error) {
	channel, err := scs.server.GetStore().Channel().Get(channelID, true)
	if err != nil {
		return false, err
	}

	// deletes the ShareChannel, unsets the share flag on the channel, deletes all records in SharedChannelRemotes for the channel.
	deleted, err := scs.server.GetStore().SharedChannel().Delete(channelID)
	if err != nil {
		return false, err
	}
	// to avoid fetching the channel again, we manually set the shared
	// flag before notifying the clients
	channel.Shared = model.NewPointer(false)

	scs.notifyClientsForSharedChannelConverted(channel)
	return deleted, nil
}

// InviteRemoteToChannel sends an invite to the remote to a shared channel. If `shareIfNotShared` is true
// then the channel is marked as `shared` first if needed.
func (scs *Service) InviteRemoteToChannel(channelID, remoteID, userID string, shareIfNotShared bool) error {
	scStore := scs.server.GetStore().SharedChannel()
	rcStore := scs.server.GetStore().RemoteCluster()

	// check if remote already invited to channel
	hasRemote, err := scStore.HasRemote(channelID, remoteID)
	if err != nil {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.fetch_remote.error",
			map[string]any{"Error": err.Error()}, "", http.StatusInternalServerError)
	}
	if hasRemote {
		// already invited, nothing to do
		return nil
	}

	// set the channel `shared` flag if needed
	if shareIfNotShared {
		sc := &model.SharedChannel{
			ChannelId: channelID,
			CreatorId: userID,
			Home:      true,
			RemoteId:  "", // channel originates locally
		}
		if _, err = scs.ShareChannel(sc); err != nil {
			return model.NewAppError("InviteRemoteToChannel", "api.command_share.share_channel.error",
				map[string]any{"Error": err.Error()}, "", http.StatusBadRequest)
		}
	} else {
		if err = scs.CheckChannelIsShared(channelID); err != nil {
			return model.NewAppError("InviteRemoteToChannel", "api.command_share.channel_not_shared.error",
				map[string]any{"ChannelID": channelID}, "", http.StatusBadRequest)
		}
	}

	rc, err := rcStore.Get(remoteID, false)
	if err != nil {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.remote_id_invalid.error",
			map[string]any{"Error": err.Error()}, "", http.StatusInternalServerError).Wrap(err)
	}

	// don't allow invitation to shared channel originating from remote.
	// (also blocks cyclic invitations)
	if err = scs.CheckCanInviteToSharedChannel(channelID); err != nil {
		if errors.Is(err, model.ErrChannelHomedOnRemote) {
			return model.NewAppError("InviteRemoteToChannel", "api.command_share.channel_invite_not_home.error", nil, "", http.StatusBadRequest)
		}
		scs.server.Log().Debug("InviteRemoteToChannel failed to check if can-invite",
			mlog.String("name", rc.Name),
			mlog.String("channel_id", channelID),
			mlog.Err(err),
		)
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.channel_invite.error",
			map[string]any{"Name": rc.DisplayName, "Error": err.Error()}, "CheckCanInviteToSharedChannel", http.StatusInternalServerError).Wrap(err)
	}

	channel, err := scs.server.GetStore().Channel().Get(channelID, true)
	if err != nil {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.channel_invite.error",
			map[string]any{"Name": rc.DisplayName, "Error": err.Error()}, "", http.StatusInternalServerError).Wrap(err)
	}
	// send channel invite to remote cluster. Will notify clients of channel change.
	if err := scs.SendChannelInvite(channel, userID, rc); err != nil {
		return model.NewAppError("InviteRemoteToChannel", "api.command_share.channel_invite.error",
			map[string]any{"Name": rc.DisplayName, "Error": err.Error()}, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (scs *Service) UninviteRemoteFromChannel(channelID, remoteID string) error {
	scr, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(channelID, remoteID)
	if err != nil || scr.ChannelId != channelID || scr.DeleteAt != 0 {
		return model.NewAppError("UninviteRemoteFromChannel", "api.command_share.channel_remote_id_not_exists",
			map[string]any{"RemoteId": remoteID}, "", http.StatusInternalServerError)
	}

	deleted, err := scs.server.GetStore().SharedChannel().DeleteRemote(scr.Id)
	if err != nil || !deleted {
		code := http.StatusInternalServerError
		if err == nil {
			err = errors.New("not found")
			code = http.StatusBadRequest
		}
		return model.NewAppError("UninviteRemoteFromChannel", "api.command_share.could_not_uninvite.error",
			map[string]any{"RemoteId": remoteID, "Error": err.Error()}, "", code)
	}
	return nil
}

// CheckChannelNotShared returns nil only if the channel is not already shared. Otherwise ErrChannelAlreadyShared is
// returned if the channel is shared, or database error.
func (scs *Service) CheckChannelNotShared(channelID string) error {
	// check that channel exists.
	if _, err := scs.server.GetStore().Channel().Get(channelID, true); err != nil {
		return fmt.Errorf("cannot find channel %s: %w", channelID, err)
	}

	// Check channel is not already shared.
	if _, err := scs.server.GetStore().SharedChannel().Get(channelID); err == nil {
		return model.ErrChannelAlreadyShared
	}

	return nil
}

// CheckChannelIsShared returns nil only if the channel is shared. Otherwise a store.ErrNotFound is returned
// or database error.
func (scs *Service) CheckChannelIsShared(channelID string) error {
	if _, err := scs.server.GetStore().SharedChannel().Get(channelID); err != nil {
		var errNotFound *store.ErrNotFound
		if errors.As(err, &errNotFound) {
			return fmt.Errorf("channel is not shared: %w", errNotFound)
		}
		return fmt.Errorf("cannot check if channel %s is shared: %w", channelID, err)
	}
	return nil
}

// CheckCanInviteToSharedChannel checks if an invitation can be sent for the specified channel.
// - don't allow invitations to a shared channel originating from remote.
// - block cyclic invitations
// - the channel must exist
func (scs *Service) CheckCanInviteToSharedChannel(channelId string) error {
	sc, err := scs.server.GetStore().SharedChannel().Get(channelId)
	if err != nil {
		if isNotFoundError(err) {
			return fmt.Errorf("channel is not shared: %w", err)
		}
		return fmt.Errorf("cannot find channel: %w", err)
	}

	if !sc.Home {
		return model.ErrChannelHomedOnRemote
	}
	return nil
}
