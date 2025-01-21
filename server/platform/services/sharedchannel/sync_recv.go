// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
)

func (scs *Service) onReceiveSyncMessage(msg model.RemoteClusterMsg, rc *model.RemoteCluster, response *remotecluster.Response) error {
	if msg.Topic != TopicSync {
		return fmt.Errorf("wrong topic, expected `%s`, got `%s`", TopicSync, msg.Topic)
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

func (scs *Service) processSyncMessage(c request.CTX, syncMsg *model.SyncMsg, rc *model.RemoteCluster, response *remotecluster.Response) error {
	var targetChannel *model.Channel
	var team *model.Team

	var err error
	syncResp := model.SyncResponse{
		UserErrors:     make([]string, 0),
		UsersSyncd:     make([]string, 0),
		PostErrors:     make([]string, 0),
		ReactionErrors: make([]string, 0),
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Sync msg received",
		mlog.String("remote", rc.Name),
		mlog.String("channel_id", syncMsg.ChannelId),
		mlog.Int("user_count", len(syncMsg.Users)),
		mlog.Int("post_count", len(syncMsg.Posts)),
		mlog.Int("reaction_count", len(syncMsg.Reactions)),
		mlog.Int("status_count", len(syncMsg.Statuses)),
	)

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
		return fmt.Errorf("cannot process sync message; channel not shared with remote: %w", ErrRemoteIDMismatch)
	}

	// add/update users before posts
	for _, user := range syncMsg.Users {
		if userSaved, err := scs.upsertSyncUser(c, user, targetChannel, rc); err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceError, "Error upserting sync user",
				mlog.String("remote", rc.Name),
				mlog.String("channel_id", syncMsg.ChannelId),
				mlog.String("user_id", user.Id),
				mlog.Err(err))
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

		if targetChannel.Type != model.ChannelTypeDirect && team == nil {
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

	for _, status := range syncMsg.Statuses {
		scs.app.SaveAndBroadcastStatus(status)
	}

	response.SetPayload(syncResp)

	return nil
}

func (scs *Service) upsertSyncUser(c request.CTX, user *model.User, channel *model.Channel, rc *model.RemoteCluster) (*model.User, error) {
	var err error

	// Check if user already exists
	euser, err := scs.server.GetStore().User().Get(context.Background(), user.Id)
	if err != nil {
		if _, ok := err.(errNotFound); !ok {
			return nil, fmt.Errorf("error checking sync user: %w", err)
		}
	}

	var userSaved *model.User
	if euser == nil {
		// new user.  Make sure the remoteID is correct and insert the record
		user.RemoteId = model.NewPointer(rc.RemoteId)
		if userSaved, err = scs.insertSyncUser(c, user, channel, rc); err != nil {
			return nil, err
		}
	} else {
		// existing user. Make sure user belongs to the remote that issued the update
		if euser.GetRemoteID() != rc.RemoteId {
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
	if channel.TeamId != "" {
		// add user to team
		if err := scs.app.AddUserToTeamByTeamId(request.EmptyContext(scs.server.Log()), channel.TeamId, userSaved); err != nil {
			return nil, fmt.Errorf("error adding sync user to Team: %w", err)
		}
		// add user to channel
		if _, err := scs.app.AddUserToChannel(c, userSaved, channel, false); err != nil {
			return nil, fmt.Errorf("error adding sync user to ChannelMembers: %w", err)
		}
	}

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

		rpost, appErr = scs.app.CreatePost(rctx, post, targetChannel, model.CreatePostFlags{TriggerWebhooks: true, SetOnline: true})
		if appErr == nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Created sync post",
				mlog.String("post_id", post.Id),
				mlog.String("channel_id", post.ChannelId),
			)
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
		// update post
		rpost, appErr = scs.app.UpdatePost(request.EmptyContext(scs.server.Log()), post, nil)
		if appErr == nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Updated sync post",
				mlog.String("post_id", post.Id),
				mlog.String("channel_id", post.ChannelId),
			)
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
