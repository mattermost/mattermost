// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

// syncMsg represents a change in content (post add/edit/delete, reaction add/remove, users).
// It is sent to remote clusters as the payload of a `RemoteClusterMsg`.
type syncMsg struct {
	ChannelId   string            `json:"channel_id"`
	PostId      string            `json:"post_id"`
	Post        *model.Post       `json:"post"`
	Users       []*model.User     `json:"users"`
	Reactions   []*model.Reaction `json:"reactions"`
	Attachments []*model.FileInfo `json:"-"`
}

func (sm syncMsg) ToJSON() ([]byte, error) {
	b, err := json.Marshal(sm)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (sm syncMsg) String() string {
	json, err := sm.ToJSON()
	if err != nil {
		return ""
	}
	return string(json)
}

type userCache map[string]struct{}

func (u userCache) Has(id string) bool {
	_, ok := u[id]
	return ok
}

func (u userCache) Add(id string) {
	u[id] = struct{}{}
}

// postsToSyncMessages takes a slice of posts and converts to a `RemoteClusterMsg` which can be
// sent to a remote cluster.
func (scs *Service) postsToSyncMessages(posts []*model.Post, channelID string, rc *model.RemoteCluster, nextSyncAt int64) ([]syncMsg, error) {
	syncMessages := make([]syncMsg, 0, len(posts))

	var teamID string
	uCache := make(userCache)

	for _, p := range posts {
		if p.IsSystemMessage() { // don't sync system messages
			continue
		}

		// lookup team id once
		if teamID == "" {
			sc, err := scs.server.GetStore().SharedChannel().Get(p.ChannelId)
			if err != nil {
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Could not get shared channel for post",
					mlog.String("post_id", p.Id),
					mlog.Err(err),
				)
				continue
			}
			teamID = sc.TeamId
		}

		// any reactions originating from the remote cluster are filtered out
		reactions, err := scs.server.GetStore().Reaction().GetForPostSince(p.Id, nextSyncAt, rc.RemoteId, true)
		if err != nil {
			return nil, err
		}

		postSync := p

		// Don't resend an existing post where only the reactions changed.
		// Posts we must send:
		//   - new posts (EditAt == 0)
		//   - edited posts (EditAt >= nextSyncAt)
		//   - deleted posts (DeleteAt > 0)
		if p.EditAt > 0 && p.EditAt < nextSyncAt && p.DeleteAt == 0 {
			postSync = nil
		}

		// Don't send a deleted post if it is just the original copy from an edit.
		if p.DeleteAt > 0 && p.OriginalId != "" {
			postSync = nil
		}

		// don't sync a post back to the remote it came from.
		if p.RemoteId != nil && *p.RemoteId == rc.RemoteId {
			postSync = nil
		}

		var attachments []*model.FileInfo
		if postSync != nil {
			// parse out all permalinks in the message.
			postSync.Message = scs.processPermalinkToRemote(postSync)

			// get any file attachments
			attachments, err = scs.postToAttachments(postSync, rc)
			if err != nil {
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Could not fetch attachments for post",
					mlog.String("post_id", postSync.Id),
					mlog.Err(err),
				)
			}
		}

		// any users originating from the remote cluster are filtered out
		users := scs.usersForPost(postSync, reactions, channelID, teamID, rc, uCache)

		// if everything was filtered out then don't send an empty message.
		if postSync == nil && len(reactions) == 0 && len(users) == 0 {
			continue
		}

		sm := syncMsg{
			ChannelId:   p.ChannelId,
			PostId:      p.Id,
			Post:        postSync,
			Users:       users,
			Reactions:   reactions,
			Attachments: attachments,
		}
		syncMessages = append(syncMessages, sm)
	}
	return syncMessages, nil
}

// usersForPost provides a list of Users associated with the post that need to be synchronized.
// The user cache ensures the same user is not synchronized redundantly if they appear in multiple
// posts for this sync batch.
func (scs *Service) usersForPost(post *model.Post, reactions []*model.Reaction, channelID string, teamID string, rc *model.RemoteCluster, uCache userCache) []*model.User {
	userIds := make([]string, 0)
	var mentionMap model.UserMentionMap

	if post != nil && !uCache.Has(post.UserId) {
		userIds = append(userIds, post.UserId)
		uCache.Add(post.UserId)
	}

	for _, r := range reactions {
		if !uCache.Has(r.UserId) {
			userIds = append(userIds, r.UserId)
			uCache.Add(r.UserId)
		}
	}

	// get mentions and userids for each mention
	if post != nil {
		mentionMap = scs.app.MentionsToTeamMembers(post.Message, teamID)
		for mention, id := range mentionMap {
			if !uCache.Has(id) {
				userIds = append(userIds, id)
				uCache.Add(id)
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceDebug, "Found mention",
					mlog.String("mention", mention),
					mlog.String("user_id", id),
				)
			}
		}
	}

	users := make([]*model.User, 0)

	for _, id := range userIds {
		user, err := scs.server.GetStore().User().Get(context.Background(), id)
		if err == nil {
			if sync, err2 := scs.shouldUserSync(user, channelID, rc); err2 != nil {
				scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Could not find user for post",
					mlog.String("user_id", id),
					mlog.Err(err2),
				)
				continue
			} else if sync {
				users = append(users, sanitizeUserForSync(user))
			}
			// if this was a mention then put the real username in place of the username+remotename, but only
			// when sending to the remote that the user belongs to.
			if user.RemoteId != nil && *user.RemoteId == rc.RemoteId {
				fixMention(post, mentionMap, user)
			}
		} else {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error checking if user should sync",
				mlog.String("user_id", id),
				mlog.Err(err),
			)
		}
	}
	return users
}

// fixMention replaces any mentions in a post for the user with the user's real username.
func fixMention(post *model.Post, mentionMap model.UserMentionMap, user *model.User) {
	if post == nil || len(mentionMap) == 0 {
		return
	}

	realUsername, ok := user.GetProp(KeyRemoteUsername)
	if !ok {
		return
	}

	// there may be more than one mention for each user so we have to walk the whole map.
	for mention, id := range mentionMap {
		if id == user.Id && strings.Contains(mention, ":") {
			post.Message = strings.ReplaceAll(post.Message, "@"+mention, "@"+realUsername)
		}
	}
}

func sanitizeUserForSync(user *model.User) *model.User {
	user.Password = model.NewId()
	user.AuthData = nil
	user.AuthService = ""
	user.Roles = "system_user"
	user.AllowMarketing = false
	user.NotifyProps = model.StringMap{}
	user.LastPasswordUpdate = 0
	user.LastPictureUpdate = 0
	user.FailedAttempts = 0
	user.MfaActive = false
	user.MfaSecret = ""

	return user
}

// shouldUserSync determines if a user needs to be synchronized.
// User should be synchronized if it has no entry in the SharedChannelUsers table for the specified channel,
// or there is an entry but the LastSyncAt is less than user.UpdateAt
func (scs *Service) shouldUserSync(user *model.User, channelID string, rc *model.RemoteCluster) (bool, error) {
	// don't sync users with the remote they originated from.
	if user.RemoteId != nil && *user.RemoteId == rc.RemoteId {
		return false, nil
	}

	scu, err := scs.server.GetStore().SharedChannel().GetUser(user.Id, channelID, rc.RemoteId)
	if err != nil {
		if _, ok := err.(errNotFound); !ok {
			return false, err
		}

		// user not in the SharedChannelUsers table, so we must add them.
		scu = &model.SharedChannelUser{
			UserId:    user.Id,
			RemoteId:  rc.RemoteId,
			ChannelId: channelID,
		}
		if _, err = scs.server.GetStore().SharedChannel().SaveUser(scu); err != nil {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error adding user to shared channel users",
				mlog.String("remote_id", rc.RemoteId),
				mlog.String("user_id", user.Id),
				mlog.String("channel_id", user.Id),
				mlog.Err(err),
			)
		}
	} else if scu.LastSyncAt >= user.UpdateAt {
		return false, nil
	}
	return true, nil
}
