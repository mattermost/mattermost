// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// postDebugMessage posts a debug message to Town Square for MM-64695 investigation
func (scs *Service) postDebugMessage(channelID, message string) {
	// Try to find Town Square channel
	var townSquareChannel *model.Channel

	// First try to get by default channel name
	if defaultChannel, err := scs.server.GetStore().Channel().GetByName("", "town-square", false); err == nil {
		townSquareChannel = defaultChannel
	} else {
		// Fallback: find first team's Town Square
		if teams, teamErr := scs.server.GetStore().Team().GetAll(); teamErr == nil && len(teams) > 0 {
			if tsChannel, tsErr := scs.server.GetStore().Channel().GetByName(teams[0].Id, "town-square", false); tsErr == nil {
				townSquareChannel = tsChannel
			}
		}
	}

	if townSquareChannel == nil {
		return // Can't find Town Square, skip debug message
	}

	// Create debug post
	debugMessage := fmt.Sprintf("[MM-64695:SharedChannel:%s] %s", channelID, message)
	post := &model.Post{
		ChannelId: townSquareChannel.Id,
		Message:   debugMessage,
		Type:      model.PostTypeSystemGeneric,
		UserId:    "system", // Use system user
	}

	// Try to post the debug message
	if _, err := scs.server.GetStore().Post().Save(request.EmptyContext(scs.server.Log()), post); err != nil {
		// Log warning if debug post fails, but don't fail the operation
		scs.server.Log().Warn("Failed to post debug message", mlog.Err(err), mlog.String("message", debugMessage))
	}
}

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

// UnshareChannel unshares the channel by deleting the SharedChannels record and unsets the Channel `shared` flag.
// Returns true if a shared channel existed and was deleted.
func (scs *Service) UnshareChannel(channelID string) (bool, error) {
	scs.postDebugMessage(channelID, "UNSHARE_CHANNEL: Starting unshare channel operation")

	channel, err := scs.server.GetStore().Channel().Get(channelID, true)
	if err != nil {
		scs.postDebugMessage(channelID, fmt.Sprintf("UNSHARE_CHANNEL: Failed to get channel: %s", err.Error()))
		return false, err
	}

	// deletes the ShareChannel, unsets the share flag on the channel, deletes all records in SharedChannelRemotes for the channel.
	scs.postDebugMessage(channelID, "UNSHARE_CHANNEL: Calling SharedChannel.Delete()")
	deleted, err := scs.server.GetStore().SharedChannel().Delete(channelID)
	if err != nil {
		scs.postDebugMessage(channelID, fmt.Sprintf("UNSHARE_CHANNEL: SharedChannel.Delete() failed: %s", err.Error()))
		return false, err
	}
	scs.postDebugMessage(channelID, fmt.Sprintf("UNSHARE_CHANNEL: SharedChannel.Delete() completed (deleted=%t)", deleted))
	// to avoid fetching the channel again, we manually set the shared
	// flag before notifying the clients
	channel.Shared = model.NewPointer(false)

	scs.notifyClientsForSharedChannelConverted(channel)
	scs.postDebugMessage(channelID, fmt.Sprintf("UNSHARE_CHANNEL: Operation completed successfully (deleted=%t)", deleted))
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

// unshareChannelIfNoActiveRemotes checks if there are any remaining
// non-deleted remotes for the channel and unshares the channel if
// there are none. Returns true if the channel was unshared.
func (scs *Service) unshareChannelIfNoActiveRemotes(channelID string) (bool, error) {
	scs.postDebugMessage(channelID, "UNSHARE_IF_NO_REMOTES: Checking for remaining active remotes")

	opts := model.SharedChannelRemoteFilterOpts{ChannelId: channelID}
	remotes, err := scs.server.GetStore().SharedChannel().GetRemotes(0, 1, opts)
	if err != nil {
		scs.postDebugMessage(channelID, fmt.Sprintf("UNSHARE_IF_NO_REMOTES: Failed to get remotes: %s", err.Error()))
		return false, fmt.Errorf("failed to check remaining remotes: %w", err)
	}
	scs.postDebugMessage(channelID, fmt.Sprintf("UNSHARE_IF_NO_REMOTES: Found %d active remotes", len(remotes)))

	// If no remotes remain, unshare the channel
	if len(remotes) == 0 {
		scs.postDebugMessage(channelID, "UNSHARE_IF_NO_REMOTES: No active remotes found, proceeding to unshare channel")
		unshared, err := scs.UnshareChannel(channelID)
		if err != nil {
			scs.postDebugMessage(channelID, fmt.Sprintf("UNSHARE_IF_NO_REMOTES: Auto-unshare failed: %s", err.Error()))
			return false, fmt.Errorf("failed to automatically unshare channel after removing last remote: %w", err)
		}
		scs.postDebugMessage(channelID, fmt.Sprintf("UNSHARE_IF_NO_REMOTES: Auto-unshare completed (unshared=%t)", unshared))
		return unshared, nil
	}

	scs.postDebugMessage(channelID, "UNSHARE_IF_NO_REMOTES: Active remotes still exist, channel remains shared")
	return false, nil
}

func (scs *Service) UninviteRemoteFromChannel(channelID, remoteID string) error {
	scs.postDebugMessage(channelID, fmt.Sprintf("UNINVITE_REMOTE: Starting uninvite process for remote: %s", remoteID))

	scr, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(channelID, remoteID)
	if err != nil || scr.ChannelId != channelID || scr.DeleteAt != 0 {
		scs.postDebugMessage(channelID, fmt.Sprintf("UNINVITE_REMOTE: Remote not found or already deleted (error: %v, deleteAt: %d)", err, scr.DeleteAt))
		return model.NewAppError("UninviteRemoteFromChannel", "api.command_share.channel_remote_id_not_exists",
			map[string]any{"RemoteId": remoteID}, "", http.StatusInternalServerError)
	}

	scs.postDebugMessage(channelID, fmt.Sprintf("UNINVITE_REMOTE: Calling DeleteRemote for remote ID: %s", scr.Id))
	deleted, err := scs.server.GetStore().SharedChannel().DeleteRemote(scr.Id)
	if err != nil || !deleted {
		code := http.StatusInternalServerError
		if err == nil {
			err = errors.New("not found")
			code = http.StatusBadRequest
		}
		scs.postDebugMessage(channelID, fmt.Sprintf("UNINVITE_REMOTE: DeleteRemote failed (deleted=%t, error=%v)", deleted, err))
		return model.NewAppError("UninviteRemoteFromChannel", "api.command_share.could_not_uninvite.error",
			map[string]any{"RemoteId": remoteID, "Error": err.Error()}, "", code)
	}
	scs.postDebugMessage(channelID, "UNINVITE_REMOTE: DeleteRemote completed successfully")

	scs.postDebugMessage(channelID, "UNINVITE_REMOTE: Checking if channel should be unshared")
	_, unshareErr := scs.unshareChannelIfNoActiveRemotes(channelID)
	if unshareErr != nil {
		// We don't want to fail the uninvite operation if the unshare fails
		scs.postDebugMessage(channelID, fmt.Sprintf("UNINVITE_REMOTE: Auto-unshare check failed: %s", unshareErr.Error()))
		scs.server.Log().Error("Error during automatic unshare after uninvite",
			mlog.String("channel_id", channelID),
			mlog.Err(unshareErr),
		)
	} else {
		scs.postDebugMessage(channelID, "UNINVITE_REMOTE: Auto-unshare check completed")
	}

	scs.postDebugMessage(channelID, "UNINVITE_REMOTE: Uninvite operation completed successfully")
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

// updateMembershipSyncCursor updates the LastMembersSyncAt value for the shared channel remote
// This provides centralized and consistent cursor management
func (scs *Service) updateMembershipSyncCursor(channelID string, remoteID string, newTimestamp int64) error {
	// Get the remote record
	scr, err := scs.server.GetStore().SharedChannel().GetRemoteByIds(channelID, remoteID)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to get shared channel remote for cursor update",
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remoteID),
			mlog.Int("timestamp", int(newTimestamp)),
			mlog.Err(err),
		)
		return fmt.Errorf("failed to get shared channel remote for cursor update: %w", err)
	}

	if scr == nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Shared channel remote not found for cursor update",
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remoteID),
		)
		return fmt.Errorf("shared channel remote not found for channel %s and remote %s", channelID, remoteID)
	}

	// Update the cursor - the store will handle ensuring it only moves forward
	err = scs.server.GetStore().SharedChannel().UpdateRemoteMembershipCursor(scr.Id, newTimestamp)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Failed to update membership cursor",
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", remoteID),
			mlog.String("remote_record_id", scr.Id),
			mlog.Int("timestamp", int(newTimestamp)),
			mlog.Err(err),
		)
	}

	return err
}
