// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/v5/model"
)

// msgCache caches the work of converting a change in the Posts table to a remote cluster message.
// Maps Post id to syncMsg.
type msgCache map[string]syncMsg

// syncMsg represents a change in content (post add/edit/delete, reaction add/remove, users).
// It is sent to remote clusters as the payload of a `RemoteClusterMsg`.
type syncMsg struct {
	Post      *model.Post       `json:"post"`
	Users     []*model.User     `json:"users"`
	Reactions []*model.Reaction `json:"reactions"`
}

// postsToMsg takes a slice of posts and converts to a `RemoteClusterMsg` which can be
// sent to a remote cluster
func (scs *Service) postsToMsg(posts []*model.Post, cache msgCache, rc *model.RemoteCluster) (model.RemoteClusterMsg, error) {
	syncMessages := make([]syncMsg, 0, len(posts))

	for _, p := range posts {
		if sm, ok := cache[p.Id]; ok {
			syncMessages = append(syncMessages, sm)
			continue
		}

		reactions, err := scs.server.GetStore().Reaction().GetForPost(p.Id, true)
		if err != nil {
			return model.RemoteClusterMsg{}, err
		}

		users, err := scs.usersForPost(p, rc)
		if err != nil {
			return model.RemoteClusterMsg{}, err
		}

		sm := syncMsg{
			Post:      p,
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
func (scs *Service) usersForPost(post *model.Post, rc *model.RemoteCluster) ([]*model.User, error) {
	users := make([]*model.User, 0)
	creator, err := scs.server.GetStore().User().Get(post.UserId)
	if err == nil {
		if sync, err := scs.shouldUserSync(creator, rc); err != nil {
			return nil, err
		} else if sync {
			creator = sanitizeUserForSync(creator)
			users = append(users, creator)
		}
	}

	// TODO: extract @mentions?

	return users, nil
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
	scu, err := scs.server.GetStore().SharedChannel().GetUser(user.Id, rc.RemoteId)
	if err != nil {
		if _, ok := err.(errNotFound); !ok {
			return false, nil
		}
	} else if scu.LastSyncAt >= user.UpdateAt {
		return false, nil
	}
	return true, nil
}
