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

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/remotecluster"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

func (scs *Service) onReceiveSyncMessage(msg model.RemoteClusterMsg, rc *model.RemoteCluster, response *remotecluster.Response) error {
	if msg.Topic != TopicSync {
		return fmt.Errorf("wrong topic, expected `%s`, got `%s`", TopicSync, msg.Topic)
	}

	if len(msg.Payload) == 0 {
		return errors.New("empty sync message")
	}

	if scs.server.GetLogger().IsLevelEnabled(mlog.LvlSharedChannelServiceMessagesInbound) {
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceMessagesInbound, "inbound message",
			mlog.String("remote", rc.DisplayName),
			mlog.String("msg", string(msg.Payload)),
		)
	}

	var syncMessages []syncMsg

	if err := json.Unmarshal(msg.Payload, &syncMessages); err != nil {
		return fmt.Errorf("invalid sync message: %w", err)
	}

	scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Batch of sync messages received",
		mlog.String("remote", rc.DisplayName),
		mlog.Int("sync_msg_count", len(syncMessages)),
	)

	return scs.processSyncMessages(syncMessages, rc, response)
}

func (scs *Service) processSyncMessages(syncMessages []syncMsg, rc *model.RemoteCluster, response *remotecluster.Response) error {
	var channel *model.Channel
	var team *model.Team

	postErrors := make([]string, 0)
	usersSyncd := make([]string, 0)
	var lastSyncAt int64
	var err error

	for _, sm := range syncMessages {
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Sync msg received",
			mlog.String("post_id", sm.PostId),
			mlog.String("channel_id", sm.ChannelId),
			mlog.Int("reaction_count", len(sm.Reactions)),
			mlog.Int("user_count", len(sm.Users)),
			mlog.Bool("has_post", sm.Post != nil),
		)

		if channel == nil {
			if channel, err = scs.server.GetStore().Channel().Get(sm.ChannelId, true); err != nil {
				// if the channel doesn't exist then none of these sync messages are going to work.
				return fmt.Errorf("channel not found processing sync messages: %w", err)
			}
		}

		// add/update users before posts
		for _, user := range sm.Users {
			if userSaved, err := scs.upsertSyncUser(user, channel, rc); err != nil {
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error upserting sync user",
					mlog.String("post_id", sm.PostId),
					mlog.String("channel_id", sm.ChannelId),
					mlog.String("user_id", user.Id),
					mlog.Err(err))
			} else {
				usersSyncd = append(usersSyncd, userSaved.Id)
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "User upserted via sync",
					mlog.String("post_id", sm.PostId),
					mlog.String("channel_id", sm.ChannelId),
					mlog.String("user_id", user.Id),
				)
			}
		}

		if sm.Post != nil {
			if sm.ChannelId != sm.Post.ChannelId {
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "ChannelId mismatch",
					mlog.String("sm.ChannelId", sm.ChannelId),
					mlog.String("sm.Post.ChannelId", sm.Post.ChannelId),
					mlog.String("PostId", sm.Post.Id),
				)
				postErrors = append(postErrors, sm.Post.Id)
				continue
			}

			if channel.Type != model.CHANNEL_DIRECT && team == nil {
				var err2 error
				team, err2 = scs.server.GetStore().Channel().GetTeamForChannel(sm.ChannelId)
				if err2 != nil {
					scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error getting Team for Channel",
						mlog.String("ChannelId", sm.Post.ChannelId),
						mlog.String("PostId", sm.Post.Id),
						mlog.Err(err2),
					)
					postErrors = append(postErrors, sm.Post.Id)
					continue
				}
			}

			// process perma-links for remote
			if team != nil {
				sm.Post.Message = scs.processPermalinkFromRemote(sm.Post, team)
			}

			// add/update post
			rpost, err := scs.upsertSyncPost(sm.Post, channel, rc)
			if err != nil {
				postErrors = append(postErrors, sm.Post.Id)
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error upserting sync post",
					mlog.String("post_id", sm.Post.Id),
					mlog.String("channel_id", sm.Post.ChannelId),
					mlog.Err(err),
				)
			} else if lastSyncAt < rpost.UpdateAt {
				lastSyncAt = rpost.UpdateAt
			}
		}

		// add/remove reactions
		for _, reaction := range sm.Reactions {
			if _, err := scs.upsertSyncReaction(reaction, rc); err != nil {
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error upserting sync reaction",
					mlog.String("user_id", reaction.UserId),
					mlog.String("post_id", reaction.PostId),
					mlog.String("emoji", reaction.EmojiName),
					mlog.Int64("delete_at", reaction.DeleteAt),
					mlog.Err(err),
				)
			} else {
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Reaction upserted via sync",
					mlog.String("user_id", reaction.UserId),
					mlog.String("post_id", reaction.PostId),
					mlog.String("emoji", reaction.EmojiName),
					mlog.Int64("delete_at", reaction.DeleteAt),
				)

				if lastSyncAt < reaction.UpdateAt {
					lastSyncAt = reaction.UpdateAt
				}
			}
		}
	}

	syncResp := SyncResponse{
		LastSyncAt: lastSyncAt, // might be zero
		PostErrors: postErrors, // might be empty
		UsersSyncd: usersSyncd, // might be empty
	}

	response.SetPayload(syncResp)

	return nil
}

func (scs *Service) upsertSyncUser(user *model.User, channel *model.Channel, rc *model.RemoteCluster) (*model.User, error) {
	var err error
	if user.RemoteId == nil || *user.RemoteId == "" {
		user.RemoteId = model.NewString(rc.RemoteId)
	}

	// Check if user already exists
	euser, err := scs.server.GetStore().User().Get(context.Background(), user.Id)
	if err != nil {
		if _, ok := err.(errNotFound); !ok {
			return nil, fmt.Errorf("error checking sync user: %w", err)
		}
	}

	var userSaved *model.User
	if euser == nil {
		if userSaved, err = scs.insertSyncUser(user, channel, rc); err != nil {
			return nil, err
		}
	} else {
		patch := &model.UserPatch{
			Username:  &user.Username,
			Nickname:  &user.Nickname,
			FirstName: &user.FirstName,
			LastName:  &user.LastName,
			Email:     &user.Email,
			Props:     user.Props,
			Position:  &user.Position,
			Locale:    &user.Locale,
			Timezone:  user.Timezone,
			RemoteId:  user.RemoteId,
		}
		if userSaved, err = scs.updateSyncUser(patch, euser, channel, rc); err != nil {
			return nil, err
		}
	}

	// Add user to team. We do this here regardless of whether the user was
	// just created or patched since there are three steps to adding a user
	// (insert rec, add to team, add to channel) and any one could fail.
	// Instead of undoing what succeeded on any failure we simply do all steps each
	// time. AddUserToChannel & AddUserToTeamByTeamId do not error if user was already
	// added and exit quickly.
	if err := scs.app.AddUserToTeamByTeamId(channel.TeamId, userSaved); err != nil {
		return nil, fmt.Errorf("error adding sync user to Team: %w", err)
	}

	// add user to channel
	if _, err := scs.app.AddUserToChannel(userSaved, channel, false); err != nil {
		return nil, fmt.Errorf("error adding sync user to ChannelMembers: %w", err)
	}
	return userSaved, nil
}

func (scs *Service) insertSyncUser(user *model.User, channel *model.Channel, rc *model.RemoteCluster) (*model.User, error) {
	var err error
	var userSaved *model.User
	var suffix string

	// save the original username and email in props (if not already done by another remote)
	if _, ok := user.GetProp(KeyRemoteUsername); !ok {
		user.SetProp(KeyRemoteUsername, user.Username)
	}
	if _, ok := user.GetProp(KeyRemoteEmail); !ok {
		user.SetProp(KeyRemoteEmail, user.Email)
	}

	// Apply a suffix to the username until it is unique. Collisions will be quite
	// rare since we are joining a username that is unique at a remote site with a unique
	// name for that site. However we need to truncate the combined name to 64 chars and
	// that might introduce a collision.
	for i := 1; i <= MaxUpsertRetries; i++ {
		if i > 1 {
			suffix = strconv.FormatInt(int64(i), 10)
		}

		user.Username = mungUsername(user.Username, rc.Name, suffix, model.USER_NAME_MAX_LENGTH)
		user.Email = mungEmail(rc.Name, model.USER_EMAIL_MAX_LENGTH)

		if userSaved, err = scs.server.GetStore().User().Save(user); err != nil {
			e, ok := err.(errInvalidInput)
			if !ok {
				break
			}
			_, field, value := e.InvalidInputInfo()
			if field == "email" || field == "username" {
				// username or email collision; try again with different suffix
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceWarn, "Collision inserting sync user",
					mlog.String("field", field),
					mlog.Any("value", value),
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

func (scs *Service) updateSyncUser(patch *model.UserPatch, user *model.User, channel *model.Channel, rc *model.RemoteCluster) (*model.User, error) {
	var err error
	var update *model.UserUpdate
	var suffix string

	// preserve existing real username/email since Patch will over-write them;
	// the real username/email in props can be updated if they don't contain colons,
	// meaning the update is coming from the user's origin server (not munged).
	realUsername, _ := user.GetProp(KeyRemoteUsername)
	realEmail, _ := user.GetProp(KeyRemoteEmail)

	if patch.Username != nil && !strings.Contains(*patch.Username, ":") {
		realUsername = *patch.Username
	}
	if patch.Email != nil && !strings.Contains(*patch.Email, ":") {
		realEmail = *patch.Email
	}

	user.Patch(patch)
	user.SetProp(KeyRemoteUsername, realUsername)
	user.SetProp(KeyRemoteEmail, realEmail)

	// Apply a suffix to the username until it is unique.
	for i := 1; i <= MaxUpsertRetries; i++ {
		if i > 1 {
			suffix = strconv.FormatInt(int64(i), 10)
		}
		user.Username = mungUsername(user.Username, rc.Name, suffix, model.USER_NAME_MAX_LENGTH)
		user.Email = mungEmail(rc.Name, model.USER_EMAIL_MAX_LENGTH)

		if update, err = scs.server.GetStore().User().Update(user, false); err != nil {
			e, ok := err.(errInvalidInput)
			if !ok {
				break
			}
			_, field, value := e.InvalidInputInfo()
			if field == "email" || field == "username" {
				// username or email collision; try again with different suffix
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceWarn, "Collision updating sync user",
					mlog.String("field", field),
					mlog.Any("value", value),
					mlog.Int("attempt", i),
					mlog.Err(err),
				)
			}
		} else {
			scs.app.InvalidateCacheForUser(update.New.Id)
			scs.app.NotifySharedChannelUserUpdate(update.New)
			return update.New, nil
		}
	}
	return nil, fmt.Errorf("error updating sync user %s: %w", user.Id, err)
}

func (scs *Service) upsertSyncPost(post *model.Post, channel *model.Channel, rc *model.RemoteCluster) (*model.Post, error) {
	var appErr *model.AppError

	post.RemoteId = model.NewString(rc.RemoteId)

	rpost, err := scs.server.GetStore().Post().GetSingle(post.Id, true)
	if err != nil {
		if _, ok := err.(errNotFound); !ok {
			return nil, fmt.Errorf("error checking sync post: %w", err)
		}
	}

	if rpost == nil {
		// post doesn't exist; create new one
		rpost, appErr = scs.app.CreatePost(post, channel, true, true)
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Created sync post",
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
		)
	} else if post.DeleteAt > 0 {
		// delete post
		rpost, appErr = scs.app.DeletePost(post.Id, post.UserId)
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Deleted sync post",
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
		)
	} else if post.EditAt > rpost.EditAt || post.Message != rpost.Message {
		// update post
		rpost, appErr = scs.app.UpdatePost(post, false)
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Updated sync post",
			mlog.String("post_id", post.Id),
			mlog.String("channel_id", post.ChannelId),
		)
	} else {
		// nothing to update
		scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Update to sync post ignored",
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

func (scs *Service) upsertSyncReaction(reaction *model.Reaction, rc *model.RemoteCluster) (*model.Reaction, error) {
	savedReaction := reaction
	var appErr *model.AppError

	reaction.RemoteId = model.NewString(rc.RemoteId)

	if reaction.DeleteAt == 0 {
		savedReaction, appErr = scs.app.SaveReactionForPost(reaction)
	} else {
		appErr = scs.app.DeleteReactionForPost(reaction)
	}

	var err error
	if appErr != nil {
		err = errors.New(appErr.Error())
	}
	return savedReaction, err
}
