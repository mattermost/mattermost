// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"runtime/debug"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

var (
	ErrRemoteIDMismatch  = errors.New("remoteID mismatch")
	ErrChannelIDMismatch = errors.New("channelID mismatch")
	ErrUserDMPermission  = errors.New("users cannot DM each other")
	ErrChannelNotShared  = errors.New("channel is no longer shared")
)

func (scs *Service) onReceiveSyncMessage(msg model.RemoteClusterMsg, rc *model.RemoteCluster, response *remotecluster.Response) error {
	if msg.Topic != TopicSync && msg.Topic != TopicChannelMembership && msg.Topic != TopicGlobalUserSync {
		return fmt.Errorf("wrong topic, expected sync-related topic, got `%s`", msg.Topic)
	}
	if len(msg.Payload) == 0 {
		return errors.New("empty sync message")
	}

	if scs.server.Log().IsLevelEnabled(mlog.LvlSharedChannelServiceMessagesInbound) {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceMessagesInbound, "inbound message",
			mlog.String("remote", rc.DisplayName),
			mlog.String("msg", msg.Payload),
		)
	}

	var sm model.SyncMsg
	if err := json.Unmarshal(msg.Payload, &sm); err != nil {
		return fmt.Errorf("invalid sync message: %w", err)
	}
	return scs.processSyncMessage(request.EmptyContext(scs.server.Log()), &sm, rc, response)
}

func (scs *Service) processGlobalUserSync(c request.CTX, syncMsg *model.SyncMsg, rc *model.RemoteCluster, response *remotecluster.Response) error {
	syncResp := model.SyncResponse{
		UserErrors: make([]string, 0),
		UsersSyncd: make([]string, 0),
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Processing global user sync",
		mlog.String("remote", rc.Name),
		mlog.Int("user_count", len(syncMsg.Users)),
	)

	// Process all users in the sync message
	for _, user := range syncMsg.Users {
		if userSaved, err := scs.upsertSyncUser(c, user, nil, rc); err != nil {
			syncResp.UserErrors = append(syncResp.UserErrors, user.Id)
		} else {
			syncResp.UsersSyncd = append(syncResp.UsersSyncd, userSaved.Id)
			if syncResp.UsersLastUpdateAt < user.UpdateAt {
				syncResp.UsersLastUpdateAt = user.UpdateAt
			}
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Global user upserted via sync",
				mlog.String("remote", rc.Name),
				mlog.String("user_id", user.Id),
			)
		}
	}

	return response.SetPayload(syncResp)
}

func (scs *Service) processSyncMessage(c request.CTX, syncMsg *model.SyncMsg, rc *model.RemoteCluster, response *remotecluster.Response) error {
	var targetChannel *model.Channel
	var team *model.Team

	var err error
	syncResp := model.SyncResponse{
		UserErrors:            make([]string, 0),
		UsersSyncd:            make([]string, 0),
		PostErrors:            make([]string, 0),
		ReactionErrors:        make([]string, 0),
		AcknowledgementErrors: make([]string, 0),
	}

	// Check if feature flag is enabled for membership changes
	membershipSyncEnabled := scs.server.Config().FeatureFlags.EnableSharedChannelsMemberSync
	hasMembershipChanges := len(syncMsg.MembershipChanges) > 0

	// If this message only contains membership changes and feature is disabled, skip it
	if hasMembershipChanges && !membershipSyncEnabled && len(syncMsg.Users) == 0 && len(syncMsg.Posts) == 0 && len(syncMsg.Reactions) == 0 {
		return nil
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Sync msg received",
		mlog.String("remote", rc.Name),
		mlog.String("channel_id", syncMsg.ChannelId),
		mlog.Int("user_count", len(syncMsg.Users)),
		mlog.Int("post_count", len(syncMsg.Posts)),
		mlog.Int("reaction_count", len(syncMsg.Reactions)),
		mlog.Int("acknowledgement_count", len(syncMsg.Acknowledgements)),
		mlog.Int("status_count", len(syncMsg.Statuses)),
		mlog.Int("membership_change_count", len(syncMsg.MembershipChanges)),
	)

	// Check if this is a global user sync message (no channel ID and only users)
	if syncMsg.ChannelId == "" {
		if len(syncMsg.Posts) != 0 ||
			len(syncMsg.Reactions) != 0 ||
			len(syncMsg.Statuses) != 0 {
			return fmt.Errorf("global user sync message should not contain posts, reactions or statuses")
		}

		if len(syncMsg.Users) == 0 {
			return nil
		}
		// Check if feature flag is enabled
		if !scs.isGlobalUserSyncEnabled() {
			return nil
		}
		return scs.processGlobalUserSync(c, syncMsg, rc, response)
	}

	// For regular sync messages, we need a specific channel
	if targetChannel, err = scs.server.GetStore().Channel().Get(syncMsg.ChannelId, true); err != nil {
		// if the channel doesn't exist then none of these sync items are going to work.
		return fmt.Errorf("channel not found processing sync message: %w", err)
	}

	// make sure target channel is shared with the remote
	exists, err := scs.server.GetStore().SharedChannel().HasRemote(targetChannel.Id, rc.RemoteId)
	if err != nil {
		return fmt.Errorf("cannot check channel share state for sync message: %w", err)
	}
	if !exists {
		return fmt.Errorf("cannot process sync message; %w: %s",
			ErrChannelNotShared, syncMsg.ChannelId)
	}

	// add/update users before posts
	for _, user := range syncMsg.Users {
		// Debug: Log each user being synced from remote
		scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()),
			fmt.Sprintf("RECV_SYNC_MSG_USER: Processing user from sync message - UserID: %s, Username: %s, From Remote: %s",
				user.Id, user.Username, rc.RemoteId))

		if userSaved, err := scs.upsertSyncUser(c, user, targetChannel, rc); err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error upserting sync user",
				mlog.String("remote", rc.Name),
				mlog.String("channel_id", syncMsg.ChannelId),
				mlog.String("user_id", user.Id),
				mlog.Err(err))

			// Debug: Log sync failure
			scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()),
				fmt.Sprintf("RECV_SYNC_MSG_USER: FAILED to sync user - UserID: %s, Username: %s, Error: %v",
					user.Id, user.Username, err))
		} else {
			syncResp.UsersSyncd = append(syncResp.UsersSyncd, userSaved.Id)
			if syncResp.UsersLastUpdateAt < user.UpdateAt {
				syncResp.UsersLastUpdateAt = user.UpdateAt
			}
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "User upserted via sync",
				mlog.String("remote", rc.Name),
				mlog.String("channel_id", syncMsg.ChannelId),
				mlog.String("user_id", user.Id),
			)

			// Debug: Log successful sync
			scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()),
				fmt.Sprintf("RECV_SYNC_MSG_USER: SUCCESS syncing user - UserID: %s, Username: %s, Saved as: %s",
					user.Id, user.Username, userSaved.Username))
		}
	}

	for _, post := range syncMsg.Posts {
		if syncMsg.ChannelId != post.ChannelId {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "ChannelId mismatch",
				mlog.String("remote", rc.Name),
				mlog.String("sm.ChannelId", syncMsg.ChannelId),
				mlog.String("sm.Post.ChannelId", post.ChannelId),
				mlog.String("PostId", post.Id),
			)
			syncResp.PostErrors = append(syncResp.PostErrors, post.Id)
			continue
		}

		if (targetChannel.Type != model.ChannelTypeDirect && targetChannel.Type != model.ChannelTypeGroup) && team == nil {
			var err2 error
			team, err2 = scs.server.GetStore().Channel().GetTeamForChannel(syncMsg.ChannelId)
			if err2 != nil {
				scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error getting Team for Channel",
					mlog.String("ChannelId", post.ChannelId),
					mlog.String("PostId", post.Id),
					mlog.String("remote", rc.Name),
					mlog.Err(err2),
				)
				syncResp.PostErrors = append(syncResp.PostErrors, post.Id)
				continue
			}
		}

		// process perma-links for remote
		if team != nil {
			post.Message = scs.processPermalinkFromRemote(post, team)
		}

		// Debug: Log post sync with mention information
		if strings.Contains(post.Message, "@") {
			debugMsg := fmt.Sprintf("RECV_Processing post sync with mentions - Remote: %s, Post ID: %s, Message preview: %.100s",
				rc.Name, post.Id, post.Message)
			scs.app.PostDebugToTownSquare(c, debugMsg)
		}

		// add/update post
		rpost, err := scs.upsertSyncPost(post, targetChannel, rc)
		if err != nil {
			syncResp.PostErrors = append(syncResp.PostErrors, post.Id)
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error upserting sync post",
				mlog.String("post_id", post.Id),
				mlog.String("channel_id", post.ChannelId),
				mlog.String("remote", rc.Name),
				mlog.Err(err),
			)
		} else if syncResp.PostsLastUpdateAt < rpost.UpdateAt {
			syncResp.PostsLastUpdateAt = rpost.UpdateAt
		}
	}

	// add/remove reactions
	for _, reaction := range syncMsg.Reactions {
		if _, err := scs.upsertSyncReaction(reaction, targetChannel, rc); err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error upserting sync reaction",
				mlog.String("remote", rc.Name),
				mlog.String("user_id", reaction.UserId),
				mlog.String("post_id", reaction.PostId),
				mlog.String("emoji", reaction.EmojiName),
				mlog.Int("delete_at", reaction.DeleteAt),
				mlog.Err(err),
			)
		} else {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Reaction upserted via sync",
				mlog.String("remote", rc.Name),
				mlog.String("user_id", reaction.UserId),
				mlog.String("post_id", reaction.PostId),
				mlog.String("emoji", reaction.EmojiName),
				mlog.Int("delete_at", reaction.DeleteAt),
			)

			if syncResp.ReactionsLastUpdateAt < reaction.UpdateAt {
				syncResp.ReactionsLastUpdateAt = reaction.UpdateAt
			}
		}
	}

	// add/remove acknowledgements
	for _, acknowledgement := range syncMsg.Acknowledgements {
		if _, err := scs.upsertSyncAcknowledgement(acknowledgement, targetChannel, rc); err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error upserting sync acknowledgement",
				mlog.String("remote", rc.Name),
				mlog.String("user_id", acknowledgement.UserId),
				mlog.String("post_id", acknowledgement.PostId),
				mlog.Int("acknowledged_at", acknowledgement.AcknowledgedAt),
				mlog.Err(err),
			)
			syncResp.AcknowledgementErrors = append(syncResp.AcknowledgementErrors, acknowledgement.PostId)
		} else {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Acknowledgement upserted via sync",
				mlog.String("remote", rc.Name),
				mlog.String("user_id", acknowledgement.UserId),
				mlog.String("post_id", acknowledgement.PostId),
				mlog.Int("acknowledged_at", acknowledgement.AcknowledgedAt),
			)

			if syncResp.AcknowledgementsLastUpdateAt < acknowledgement.AcknowledgedAt {
				syncResp.AcknowledgementsLastUpdateAt = acknowledgement.AcknowledgedAt
			}
		}
	}

	for _, status := range syncMsg.Statuses {
		scs.app.SaveAndBroadcastStatus(status)
	}

	// Process membership changes after users have been synced
	if hasMembershipChanges && membershipSyncEnabled {
		if err := scs.onReceiveMembershipChanges(syncMsg, rc, response); err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error processing membership changes",
				mlog.String("remote", rc.Name),
				mlog.String("channel_id", syncMsg.ChannelId),
				mlog.Int("change_count", len(syncMsg.MembershipChanges)),
				mlog.Err(err),
			)
			// Don't fail the entire sync if membership changes fail
		}
	}

	response.SetPayload(syncResp)

	return nil
}

func (scs *Service) upsertSyncUser(c request.CTX, user *model.User, channel *model.Channel, rc *model.RemoteCluster) (*model.User, error) {
	var err error

	// Check if user already exists by ID
	euser, err := scs.server.GetStore().User().Get(context.Background(), user.Id)
	if err != nil {
		if _, ok := err.(errNotFound); !ok {
			return nil, fmt.Errorf("error checking sync user: %w", err)
		}
	}

	// Check for username collision - a different user with same username
	userByUsername, err := scs.server.GetStore().User().GetByUsername(user.Username)
	var usernameCollision bool
	if err == nil && userByUsername != nil && userByUsername.Id != user.Id {
		usernameCollision = true
		scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()),
			fmt.Sprintf("RECV_UPSERT_SYNC_USER: USERNAME COLLISION DETECTED! Remote user %s (ID: %s) has same username as existing user %s (ID: %s, RemoteId: %s)",
				user.Username, user.Id, userByUsername.Username, userByUsername.Id, userByUsername.GetRemoteID()))
	}

	// Debug: Log user sync attempt
	scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()),
		fmt.Sprintf("RECV_UPSERT_SYNC_USER: Attempting sync - UserID: %s, Username: %s, From Remote: %s, User exists by ID: %v, Username collision: %v",
			user.Id, user.Username, rc.RemoteId, euser != nil, usernameCollision))

	if euser != nil {
		scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()),
			fmt.Sprintf("RECV_UPSERT_SYNC_USER: Existing user - UserID: %s, Username: %s, Current RemoteId: '%s', Incoming RemoteId: '%s', Remote cluster: '%s'",
				euser.Id, euser.Username, euser.GetRemoteID(), user.GetRemoteID(), rc.RemoteId))

		// Check for potential ID collision between local and remote users
		if euser.GetRemoteID() == "" {
			scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()),
				fmt.Sprintf("RECV_UPSERT_SYNC_USER: LOCAL USER COLLISION - Local user %s (ID: %s) has same ID as incoming remote user from %s",
					euser.Username, euser.Id, rc.RemoteId))
		}
	}

	var userSaved *model.User
	if euser == nil {
		// new user.  Make sure the remoteID is correct and insert the record
		user.RemoteId = model.NewPointer(rc.RemoteId)
		scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()),
			fmt.Sprintf("RECV_UPSERT_SYNC_USER: Creating new user - UserID: %s, Username: %s, Setting RemoteId: %s",
				user.Id, user.Username, rc.RemoteId))
		if userSaved, err = scs.insertSyncUser(c, user, channel, rc); err != nil {
			return nil, err
		}
	} else {
		// existing user. Make sure user belongs to the remote that issued the update
		if euser.GetRemoteID() != rc.RemoteId {
			// Special debug for local users being overwritten
			if euser.GetRemoteID() == "" {
				scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()),
					fmt.Sprintf("RECV_UPSERT_SYNC_USER: CRITICAL - Attempt to overwrite LOCAL user! UserID: %s, Username: %s, From Remote: %s",
						euser.Id, euser.Username, rc.RemoteId))
			}

			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "RemoteID mismatch sync'ing user",
				mlog.String("remote", rc.Name),
				mlog.String("user_id", user.Id),
				mlog.String("existing_user_remote_id", euser.GetRemoteID()),
				mlog.String("update_user_remote_id", user.GetRemoteID()),
			)
			return nil, fmt.Errorf("error updating user: %w", ErrRemoteIDMismatch)
		}
		// save the updated username and email in props
		user.SetProp(model.UserPropsKeyRemoteUsername, user.Username)
		user.SetProp(model.UserPropsKeyRemoteEmail, user.Email)

		patch := &model.UserPatch{
			Username:  &user.Username,
			Nickname:  &user.Nickname,
			FirstName: &user.FirstName,
			LastName:  &user.LastName,
			Props:     user.Props,
			Position:  &user.Position,
			Locale:    &user.Locale,
			Timezone:  user.Timezone,
		}
		if userSaved, err = scs.updateSyncUser(c, patch, euser, channel, rc); err != nil {
			return nil, err
		}
	}

	// Add user to team and channel. We do this here regardless of whether the user was
	// just created or patched since there are three steps to adding a user
	// (insert rec, add to team, add to channel) and any one could fail.
	// Instead of undoing what succeeded on any failure we simply do all steps each
	// time. AddUserToChannel & AddUserToTeamByTeamId do not error if user was already
	// added and exit quickly.  Not needed for DMs where teamId is empty.
	if channel != nil && channel.TeamId != "" {
		// add user to team
		if err := scs.app.AddUserToTeamByTeamId(request.EmptyContext(scs.server.Log()), channel.TeamId, userSaved); err != nil {
			return nil, fmt.Errorf("error adding sync user to Team: %w", err)
		}
		// add user to channel
		if _, err := scs.app.AddUserToChannel(c, userSaved, channel, false); err != nil {
			return nil, fmt.Errorf("error adding sync user to ChannelMembers: %w", err)
		}
	}

	// Debug: Log final user state after sync
	scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()),
		fmt.Sprintf("RECV_UPSERT_SYNC_USER: FINAL STATE - UserID: %s, Username: %s, RemoteId: %s, From Remote: %s",
			userSaved.Id, userSaved.Username, userSaved.GetRemoteID(), rc.RemoteId))

	return userSaved, nil
}

func (scs *Service) insertSyncUser(rctx request.CTX, user *model.User, _ *model.Channel, rc *model.RemoteCluster) (*model.User, error) {
	var err error
	var userSaved *model.User
	var suffix string

	// ensure the new user is created with system_user role and random password.
	user = sanitizeUserForSync(user)

	// save the original username and email in props
	user.SetProp(model.UserPropsKeyRemoteUsername, user.Username)
	user.SetProp(model.UserPropsKeyRemoteEmail, user.Email)

	// Apply a suffix to the username until it is unique. Collisions will be quite
	// rare since we are joining a username that is unique at a remote site with a unique
	// name for that site. However we need to truncate the combined name to 64 chars and
	// that might introduce a collision.
	for i := 1; i <= MaxUpsertRetries; i++ {
		if i > 1 {
			suffix = strconv.FormatInt(int64(i), 10)
		}

		user.Username = mungUsername(user.Username, rc.Name, suffix, model.UserNameMaxLength)
		user.Email = model.NewId()

		if userSaved, err = scs.server.GetStore().User().Save(rctx, user); err != nil {
			field, ok := isConflictError(err)
			if !ok {
				break
			}
			if field == "email" || field == "username" {
				// username or email collision; try again with different suffix
				scs.server.Log().Log(mlog.LvlSharedChannelServiceWarn, "Collision inserting sync user",
					mlog.String("field", field),
					mlog.String("username", user.Username),
					mlog.String("email", user.Email),
					mlog.Int("attempt", i),
					mlog.Err(err),
				)
			}
		} else {
			scs.app.NotifySharedChannelUserUpdate(userSaved)
			return userSaved, nil
		}
	}
	return nil, fmt.Errorf("error inserting sync user %s: %w", user.Id, err)
}

func (scs *Service) updateSyncUser(rctx request.CTX, patch *model.UserPatch, user *model.User, _ *model.Channel, rc *model.RemoteCluster) (*model.User, error) {
	var err error
	var update *model.UserUpdate
	var suffix string

	// preserve existing real username/email since Patch will over-write them;
	// the real username/email in props can be updated if they don't contain colons,
	// meaning the update is coming from the user's origin server (not munged).
	realUsername, _ := user.GetProp(model.UserPropsKeyRemoteUsername)
	realEmail, _ := user.GetProp(model.UserPropsKeyRemoteEmail)

	if patch.Username != nil && !strings.Contains(*patch.Username, ":") {
		realUsername = *patch.Username
	}
	if patch.Email != nil && !strings.Contains(*patch.Email, ":") {
		realEmail = *patch.Email
	}

	user.Patch(patch)
	user = sanitizeUserForSync(user)
	user.SetProp(model.UserPropsKeyRemoteUsername, realUsername)
	user.SetProp(model.UserPropsKeyRemoteEmail, realEmail)

	// Apply a suffix to the username until it is unique.
	for i := 1; i <= MaxUpsertRetries; i++ {
		if i > 1 {
			suffix = strconv.FormatInt(int64(i), 10)
		}
		user.Username = mungUsername(user.Username, rc.Name, suffix, model.UserNameMaxLength)
		user.Email = model.NewId()

		if update, err = scs.server.GetStore().User().Update(rctx, user, false); err != nil {
			field, ok := isConflictError(err)
			if !ok {
				break
			}
			if field == "email" || field == "username" {
				// username or email collision; try again with different suffix
				scs.server.Log().Log(mlog.LvlSharedChannelServiceWarn, "Collision updating sync user",
					mlog.String("field", field),
					mlog.String("username", user.Username),
					mlog.String("email", user.Email),
					mlog.Int("attempt", i),
					mlog.Err(err),
				)
			}
		} else {
			scs.platform.InvalidateCacheForUser(update.New.Id)
			scs.app.NotifySharedChannelUserUpdate(update.New)
			return update.New, nil
		}
	}
	return nil, fmt.Errorf("error updating sync user %s: %w", user.Id, err)
}

func (scs *Service) upsertSyncPost(post *model.Post, targetChannel *model.Channel, rc *model.RemoteCluster) (*model.Post, error) {
	var appErr *model.AppError

	post.RemoteId = model.NewPointer(rc.RemoteId)
	rctx := request.EmptyContext(scs.server.Log())
	rpost, err := scs.server.GetStore().Post().GetSingle(rctx, post.Id, true)
	if err != nil {
		if _, ok := err.(errNotFound); !ok {
			return nil, fmt.Errorf("error checking sync post: %w", err)
		}
	}

	// ensure the post is in the target channel. This ensures the post can only be associated with a channel
	// that is shared with the remote.
	if post.ChannelId != targetChannel.Id || (rpost != nil && rpost.ChannelId != targetChannel.Id) {
		return nil, fmt.Errorf("post sync failed: %w", ErrChannelIDMismatch)
	}

	if rpost == nil {
		// post doesn't exist; check that user belongs to remote and create post.
		// user is not checked for edit/delete because admins can perform those actions
		user, err := scs.server.GetStore().User().Get(context.TODO(), post.UserId)
		if err != nil {
			return nil, fmt.Errorf("error fetching user for post sync: %w", err)
		}
		if user.GetRemoteID() != rc.RemoteId {
			return nil, fmt.Errorf("post sync failed: %w", ErrRemoteIDMismatch)
		}

		// Debug: Log received post content with scenario detection
		scenario := "SCENARIO1" // Default to Scenario 1 (local user mention with cluster suffix)
		if !strings.Contains(post.Message, ":") && strings.Contains(post.Message, "@") {
			scenario = "SCENARIO2" // Remote user mention transformed to local (no colon)
		}
		scs.app.PostDebugToTownSquare(rctx,
			fmt.Sprintf("RECV_%s_SYNC: Received post from %s - Message: %s", scenario, rc.Name, post.Message))

		// Transform mentions for proper display on the receiving cluster
		scs.app.PostDebugToTownSquare(rctx, fmt.Sprintf("CALLING transformMentionsOnReceive for post: %s", post.Message))
		scs.transformMentionsOnReceive(rctx, post, targetChannel, rc)

		rpost, appErr = scs.app.CreatePost(rctx, post, targetChannel, model.CreatePostFlags{TriggerWebhooks: true, SetOnline: true})
		if appErr == nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Created sync post",
				mlog.String("post_id", post.Id),
				mlog.String("channel_id", post.ChannelId),
			)

			// Debug: Log successful post creation
			scs.app.PostDebugToTownSquare(rctx,
				fmt.Sprintf("RECV_%s_SYNC: Successfully created post - PostId: %s", scenario, post.Id))
			mlog.String("channel_id", post.ChannelId)
		}
	} else if post.DeleteAt > 0 {
		// delete post
		rpost, appErr = scs.app.DeletePost(rctx, post.Id, post.UserId)
		if appErr == nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Deleted sync post",
				mlog.String("post_id", post.Id),
				mlog.String("channel_id", post.ChannelId),
			)
		}
	} else if post.EditAt > rpost.EditAt || post.Message != rpost.Message {
		// Transform mentions for proper display on the receiving cluster
		scs.transformMentionsOnReceive(rctx, post, targetChannel, rc)

		// update post
		rpost, appErr = scs.app.UpdatePost(request.EmptyContext(scs.server.Log()), post, nil)
		if appErr == nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Updated sync post",
				mlog.String("post_id", post.Id),
				mlog.String("channel_id", post.ChannelId),
			)
		}
	} else if post.EditAt > rpost.EditAt || post.Message != rpost.Message || post.UpdateAt > rpost.UpdateAt || post.Metadata != nil {
		var priority *model.PostPriority
		var acknowledgements []*model.PostAcknowledgement

		if post.Metadata != nil {
			// Save the received priority
			if post.Metadata.Priority != nil {
				priority = post.Metadata.Priority
			}

			// Save the received acknowledgements
			if post.Metadata.Acknowledgements != nil {
				acknowledgements = post.Metadata.Acknowledgements
			}
		}

		// First update the basic post
		rpost, appErr = scs.app.UpdatePost(rctx, post, nil)
		if appErr != nil {
			rerr := errors.New(appErr.Error())
			return nil, rerr
		}

		// Handle priority metadata separately if needed
		if priority != nil {
			rpost = scs.syncRemotePriorityMetadata(rctx, post, priority, rpost)
		}

		// Handle acknowledgements metadata separately if needed
		if acknowledgements != nil {
			rpost = scs.syncRemoteAcknowledgementsMetadata(rctx, post, acknowledgements, rpost)
		}
	} else {
		// nothing to update
		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Update to sync post ignored",
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
		)
	}

	var rerr error
	if appErr != nil {
		rerr = errors.New(appErr.Error())
	}
	return rpost, rerr
}

// syncRemotePriorityMetadata handles syncing priority metadata from a remote post.
// It completely replaces existing priority settings with the ones from the remote post,
// regardless of update type.
func (scs *Service) syncRemotePriorityMetadata(rctx request.CTX, post *model.Post, priority *model.PostPriority, rpost *model.Post) *model.Post {
	// First, create a new priority object with proper post and channel IDs
	newPriority := &model.PostPriority{
		PostId:    post.Id,
		ChannelId: post.ChannelId,
	}

	// Copy the priority values from the remote post
	if priority.Priority != nil {
		newPriority.Priority = priority.Priority
	}

	if priority.RequestedAck != nil {
		newPriority.RequestedAck = priority.RequestedAck
	}

	if priority.PersistentNotifications != nil {
		newPriority.PersistentNotifications = priority.PersistentNotifications
	}

	// Save the new priority - this will replace any existing priority for the post
	savedPriority, priorityErr := scs.server.GetStore().PostPriority().Save(newPriority)
	if priorityErr != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error saving post priority from remote",
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
			mlog.Err(priorityErr),
		)
	} else {
		// If the priority is successfully saved, ensure it's in the returned post
		if rpost.Metadata == nil {
			rpost.Metadata = &model.PostMetadata{}
		}
		// Use the saved priority from the database operation
		rpost.Metadata.Priority = savedPriority
	}

	return rpost
}

// syncRemoteAcknowledgementsMetadata handles syncing acknowledgements metadata from a remote post.
// It replaces all existing acknowledgements with the ones from the remote post.
func (scs *Service) syncRemoteAcknowledgementsMetadata(rctx request.CTX, post *model.Post, acknowledgements []*model.PostAcknowledgement, rpost *model.Post) *model.Post {
	// When syncing from remote, we completely replace the existing acknowledgements
	// with the ones received from the remote, regardless of update type

	// Get existing acknowledgements and delete them using batch operation
	existingAcks, appErrGet := scs.app.GetAcknowledgementsForPost(post.Id)
	if appErrGet != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error getting existing acknowledgements for remote sync",
			mlog.String("post_id", post.Id),
			mlog.Err(appErrGet),
		)
	} else if len(existingAcks) > 0 {
		// Use batch delete for better performance
		if nErr := scs.server.GetStore().PostAcknowledgement().BatchDelete(existingAcks); nErr != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error batch deleting acknowledgements for remote sync",
				mlog.String("post_id", post.Id),
				mlog.Int("count", len(existingAcks)),
				mlog.Err(nErr),
			)
		}
	}

	// Extract all user IDs from acknowledgements for batch processing
	userIDs := make([]string, 0, len(acknowledgements))
	for _, ack := range acknowledgements {
		userIDs = append(userIDs, ack.UserId)
	}

	// Use batch operation to save all acknowledgements at once
	var savedAcks []*model.PostAcknowledgement

	if len(userIDs) > 0 {
		var appErrAck *model.AppError
		savedAcks, appErrAck = scs.app.SaveAcknowledgementsForPost(rctx, post.Id, userIDs)
		if appErrAck != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error syncing remote post acknowledgements",
				mlog.String("post_id", post.Id),
				mlog.Int("count", len(userIDs)),
				mlog.Err(appErrAck),
			)
			// Fall back to original acknowledgements if batch save fails
			savedAcks = acknowledgements
		}
	}

	// Update acknowledgements in the returned post
	if rpost.Metadata == nil {
		rpost.Metadata = &model.PostMetadata{}
	}
	rpost.Metadata.Acknowledgements = savedAcks

	return rpost
}

func (scs *Service) upsertSyncReaction(reaction *model.Reaction, targetChannel *model.Channel, rc *model.RemoteCluster) (*model.Reaction, error) {
	savedReaction := reaction
	var appErr *model.AppError

	// check that the reaction's post is in the target channel. This ensures the reaction can only be associated with a post
	// that is in a channel shared with the remote.
	rctx := request.EmptyContext(scs.server.Log())
	post, err := scs.server.GetStore().Post().GetSingle(rctx, reaction.PostId, true)
	if err != nil {
		return nil, fmt.Errorf("error fetching post for reaction sync: %w", err)
	}
	if post.ChannelId != targetChannel.Id {
		return nil, fmt.Errorf("reaction sync failed: %w", ErrChannelIDMismatch)
	}

	existingReaction, err := scs.server.GetStore().Reaction().GetSingle(reaction.UserId, reaction.PostId, rc.RemoteId, reaction.EmojiName)
	if err != nil && !isNotFoundError(err) {
		return nil, fmt.Errorf("error fetching reaction for sync: %w", err)
	}

	if existingReaction == nil {
		// reaction does not exist; check that user belongs to remote and create reaction
		// this is not done for delete since deletion can be done by admins on the remote
		user, err := scs.server.GetStore().User().Get(context.TODO(), reaction.UserId)
		if err != nil {
			return nil, fmt.Errorf("error fetching user for reaction sync: %w", err)
		}
		if user.GetRemoteID() != rc.RemoteId {
			return nil, fmt.Errorf("reaction sync failed: %w", ErrRemoteIDMismatch)
		}
		reaction.RemoteId = model.NewPointer(rc.RemoteId)
		savedReaction, appErr = scs.app.SaveReactionForPost(request.EmptyContext(scs.server.Log()), reaction)
	} else {
		// make sure the reaction being deleted is owned by the remote
		if existingReaction.GetRemoteID() != rc.RemoteId {
			return nil, fmt.Errorf("reaction sync failed: %w", ErrRemoteIDMismatch)
		}
		appErr = scs.app.DeleteReactionForPost(request.EmptyContext(scs.server.Log()), reaction)
	}

	var retErr error
	if appErr != nil {
		retErr = errors.New(appErr.Error())
	}
	return savedReaction, retErr
}

// transformMentionsOnReceive transforms mentions in received posts to ensure proper display
// on the receiving cluster. Logic: add sender's cluster suffix to mentions without suffixes,
// remove cluster suffix if it doesn't refer to a known remote cluster (making it local).
func (scs *Service) transformMentionsOnReceive(rctx request.CTX, post *model.Post, targetChannel *model.Channel, rc *model.RemoteCluster) {
	// Add stack trace to understand the call path
	stackTrace := string(debug.Stack())
	scs.app.PostDebugToTownSquare(rctx, fmt.Sprintf("TRANSFORM_MENTIONS CALLED: Message: %s, Remote: %s", post.Message, rc.Name))
	scs.app.PostDebugToTownSquare(rctx, fmt.Sprintf("TRANSFORM_MENTIONS STACK: %s", stackTrace))

	if post.Message == "" || !strings.Contains(post.Message, "@") {
		scs.app.PostDebugToTownSquare(rctx, "TRANSFORM_MENTIONS: No mentions to transform")
		return
	}

	// Use existing atMentionRegexp to find all @mentions
	atMentionRegexp := regexp.MustCompile(`\B@[[:alnum:]][[:alnum:]\.\-_:]*`)

	post.Message = atMentionRegexp.ReplaceAllStringFunc(post.Message, func(match string) string {
		mention := match[1:] // Remove @
		scs.app.PostDebugToTownSquare(rctx, fmt.Sprintf("Processing mention: %s", match))

		if strings.Contains(mention, ":") {
			// Has cluster suffix - check if it refers to a known remote cluster
			parts := strings.SplitN(mention, ":", 2)
			if len(parts) == 2 {
				clusterName := parts[1]
				username := parts[0]

				scs.app.PostDebugToTownSquare(rctx, fmt.Sprintf("  Username: %s, ClusterName: %s", username, clusterName))

				// If this cluster name refers to a known remote, keep the suffix
				isKnown := scs.isKnownRemoteCluster(clusterName)
				scs.app.PostDebugToTownSquare(rctx, fmt.Sprintf("  isKnownRemoteCluster(%s) = %v", clusterName, isKnown))

				if isKnown {
					scs.app.PostDebugToTownSquare(rctx, fmt.Sprintf("  Keeping suffix - known remote cluster: %s", match))
					return match // Keep @user:knownRemote
				}
				newMention := "@" + username
				scs.app.PostDebugToTownSquare(rctx, fmt.Sprintf("  Stripping suffix - unknown cluster: %s -> %s", match, newMention))
				// Unknown cluster name - assume it refers to local user
				return newMention // Strip to @user
			}
			return match
		}
		// No suffix - add sender's cluster name
		newMention := fmt.Sprintf("@%s:%s", mention, rc.Name)
		scs.app.PostDebugToTownSquare(rctx, fmt.Sprintf("  Adding sender cluster suffix: %s -> %s", match, newMention))
		return newMention
	})

	scs.app.PostDebugToTownSquare(rctx, fmt.Sprintf("TRANSFORM_MENTIONS COMPLETE: Final message: %s", post.Message))
}

// isKnownRemoteCluster checks if the given cluster name refers to a known remote cluster
func (scs *Service) isKnownRemoteCluster(clusterName string) bool {
	// Get all remote clusters known to this server
	remotes, err := scs.server.GetStore().RemoteCluster().GetAll(0, 1000, model.RemoteClusterQueryFilter{})
	if err != nil {
		scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()), fmt.Sprintf("    Error getting remote clusters: %v", err))
		return false
	}

	scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()), fmt.Sprintf("    Checking %d remote clusters for '%s'", len(remotes), clusterName))

	// Check if clusterName matches any remote cluster name
	for _, remote := range remotes {
		scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()), fmt.Sprintf("      Remote: '%s' vs '%s'", remote.Name, clusterName))
		if strings.EqualFold(remote.Name, clusterName) {
			scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()), fmt.Sprintf("    Found matching remote cluster: %s", clusterName))
			return true
		}
	}

	scs.app.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()), fmt.Sprintf("    Cluster name '%s' not found in remotes, assuming local", clusterName))
	return false
}

func (scs *Service) upsertSyncAcknowledgement(acknowledgement *model.PostAcknowledgement, targetChannel *model.Channel, rc *model.RemoteCluster) (*model.PostAcknowledgement, error) {
	savedAcknowledgement := acknowledgement
	var appErr *model.AppError

	// check that the acknowledgement's post is in the target channel. This ensures the acknowledgement can only be associated with a post
	// that is in a channel shared with the remote.
	rctx := request.EmptyContext(scs.server.Log())
	post, err := scs.server.GetStore().Post().GetSingle(rctx, acknowledgement.PostId, true)
	if err != nil {
		return nil, fmt.Errorf("error fetching post for acknowledgement sync: %w", err)
	}
	if post.ChannelId != targetChannel.Id {
		return nil, fmt.Errorf("acknowledgement sync failed: %w", ErrChannelIDMismatch)
	}

	existingAcknowledgement, err := scs.server.GetStore().PostAcknowledgement().GetSingle(acknowledgement.UserId, acknowledgement.PostId, rc.RemoteId)
	if err != nil && !isNotFoundError(err) {
		return nil, fmt.Errorf("error fetching acknowledgement for sync: %w", err)
	}

	if existingAcknowledgement == nil {
		// acknowledgement does not exist; check that user belongs to remote and create acknowledgement
		// this is not done for delete since deletion can be done by admins on the remote
		user, err := scs.server.GetStore().User().Get(context.TODO(), acknowledgement.UserId)
		if err != nil {
			return nil, fmt.Errorf("error fetching user for acknowledgement sync: %w", err)
		}
		if user.GetRemoteID() != rc.RemoteId {
			return nil, fmt.Errorf("acknowledgement sync failed: %w", ErrRemoteIDMismatch)
		}
		acknowledgement.RemoteId = model.NewPointer(rc.RemoteId)
		acknowledgement.ChannelId = targetChannel.Id
		savedAcknowledgement, appErr = scs.app.SaveAcknowledgementForPostWithModel(request.EmptyContext(scs.server.Log()), acknowledgement)
	} else {
		// make sure the acknowledgement being deleted is owned by the remote
		if existingAcknowledgement.GetRemoteID() != rc.RemoteId {
			return nil, fmt.Errorf("acknowledgement sync failed: %w", ErrRemoteIDMismatch)
		}
		if acknowledgement.AcknowledgedAt == 0 {
			// Delete the acknowledgement
			appErr = scs.app.DeleteAcknowledgementForPostWithModel(request.EmptyContext(scs.server.Log()), acknowledgement)
		}
	}

	var retErr error
	if appErr != nil {
		retErr = errors.New(appErr.Error())
	}
	return savedAcknowledgement, retErr
}
