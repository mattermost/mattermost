// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

// msgCache caches the work of converting a change in the Posts table to a remote cluster message.
// Maps Post id to syncMsg.
type msgCache map[string]syncMsg

// syncMsg represents a change in content (post add/edit/delete, reaction add/remove, users).
// It is sent to remote clusters as the payload of a `RemoteClusterMsg`.
type syncMsg struct {
	ChannelId string            `json:"channel_id"`
	PostId    string            `json:"post_id"`
	Post      *model.Post       `json:"post"`
	Users     []*model.User     `json:"users"`
	Reactions []*model.Reaction `json:"reactions"`
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

// postsToMsg takes a slice of posts and converts to a `RemoteClusterMsg` which can be
// sent to a remote cluster
func (scs *Service) postsToMsg(posts []*model.Post, cache msgCache, rc *model.RemoteCluster, lastSyncAt int64) (model.RemoteClusterMsg, error) {
	syncMessages := make([]syncMsg, 0, len(posts))

	for _, p := range posts {
		if p.IsSystemMessage() { // don't sync system messages
			continue
		}

		if sm, ok := cache[p.Id]; ok {
			syncMessages = append(syncMessages, sm)
			continue
		}

		reactions, err := scs.server.GetStore().Reaction().GetForPostSince(p.Id, lastSyncAt, true, true)
		if err != nil {
			return model.RemoteClusterMsg{}, err
		}

		users := scs.usersForPost(p, reactions, rc)

		// TODO:  don't include the post if only the reactions changed. Unfortunately there is no way to reliably know the
		//        difference between an existing (synchronized) post with new reaction, and a brand new post (un-synchronized)
		//        with a reaction.
		postSync := p
		//if p.EditAt < p.UpdateAt && p.CreateAt < p.UpdateAt && p.DeleteAt == 0 {
		//	postSync = nil
		//}

		sm := syncMsg{
			ChannelId: p.ChannelId,
			PostId:    p.Id,
			Post:      postSync,
			Users:     users,
			Reactions: reactions,
		}
		syncMessages = append(syncMessages, sm)
		cache[p.Id] = sm
	}

	json, err := json.Marshal(syncMessages)
	if err != nil {
		return model.RemoteClusterMsg{}, err
	}

	msg := model.NewRemoteClusterMsg(TopicSync, json)
	return msg, nil
}

// usersForPost provides a list of Users associated with the post that need to be synchronized.
func (scs *Service) usersForPost(post *model.Post, reactions []*model.Reaction, rc *model.RemoteCluster) []*model.User {
	userIds := make(map[string]struct{}) // avoid duplicates

	for _, r := range reactions {
		userIds[r.UserId] = struct{}{}
	}
	userIds[post.UserId] = struct{}{}

	users := make([]*model.User, 0)

	for id := range userIds {
		user, err := scs.server.GetStore().User().Get(id)
		if err == nil {
			if sync, err := scs.shouldUserSync(user, rc); err != nil {
				continue
			} else if sync {
				user = sanitizeUserForSync(user)
				users = append(users, user)
			}
		}
	}

	// TODO: extract @mentions?

	return users
}

func sanitizeUserForSync(user *model.User) *model.User {
	user.Password = model.NewId()
	user.AuthData = nil
	user.AuthService = ""
	user.Roles = "system_user"
	user.AllowMarketing = false
	user.Props = model.StringMap{}
	user.NotifyProps = model.StringMap{}
	user.LastPasswordUpdate = 0
	user.LastPictureUpdate = 0
	user.FailedAttempts = 0
	user.MfaActive = false
	user.MfaSecret = ""

	return user
}

// shouldUserSync determines if a user needs to be synchronized.
// User should be synchronized if it has no entry in the SharedChannelUsers table,
// or there is an entry but the LastSyncAt is less than user.UpdateAt
func (scs *Service) shouldUserSync(user *model.User, rc *model.RemoteCluster) (bool, error) {
	// don't sync users with the remote they originated from.
	if user.RemoteId != nil && *user.RemoteId == rc.RemoteId {
		return false, nil
	}

	scu, err := scs.server.GetStore().SharedChannel().GetUser(user.Id, rc.RemoteId)
	if err != nil {
		if _, ok := err.(errNotFound); !ok {
			return false, nil
		}

		// user not in the SharedChannelUsers table, so we must add them.
		scu := &model.SharedChannelUser{
			UserId:          user.Id,
			RemoteClusterId: rc.RemoteId,
		}
		if _, err := scs.server.GetStore().SharedChannel().SaveUser(scu); err != nil {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceError, "Error adding user to shared channel users",
				mlog.String("remote_id", rc.RemoteId),
				mlog.String("user_id", user.Id))
		}
	} else if scu.LastSyncAt < user.UpdateAt {
		return false, nil
	}
	return true, nil
}
