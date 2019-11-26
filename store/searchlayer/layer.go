// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package searchlayer

import (
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/searchengine"
	"github.com/mattermost/mattermost-server/store"
)

type SearchStore struct {
	store.Store
	searchEngine *searchengine.SearchEngineBroker
	user         *SearchUserStore
	team         *SearchTeamStore
	channel      *SearchChannelStore
	post         *SearchPostStore
}

func NewSearchLayer(baseStore store.Store, searchEngine *searchengine.SearchEngineBroker) SearchStore {
	searchStore := SearchStore{
		Store:        baseStore,
		searchEngine: searchEngine,
	}
	searchStore.channel = &SearchChannelStore{ChannelStore: baseStore.Channel(), rootStore: &searchStore}
	searchStore.post = &SearchPostStore{PostStore: baseStore.Post(), rootStore: &searchStore}
	searchStore.team = &SearchTeamStore{TeamStore: baseStore.Team(), rootStore: &searchStore}
	searchStore.user = &SearchUserStore{UserStore: baseStore.User(), rootStore: &searchStore}

	return searchStore
}

func (s SearchStore) Channel() store.ChannelStore {
	return s.channel
}

func (s SearchStore) Post() store.PostStore {
	return s.post
}

func (s SearchStore) Team() store.TeamStore {
	return s.team
}

func (s SearchStore) User() store.UserStore {
	return s.user
}

func (s SearchStore) indexUserFromID(userId string) {
	user, err := s.User().Get(userId)
	if err != nil {
		return
	}
	s.indexUser(user)
}

func (s SearchStore) indexUser(user *model.User) {
	if s.searchEngine.GetActiveEngine().IsIndexingEnabled() {
		go (func() {
			userTeams, err := s.Team().GetTeamsByUserId(user.Id)
			if err != nil {
				mlog.Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.Err(err))
				return
			}

			userTeamsIds := []string{}
			for _, team := range userTeams {
				userTeamsIds = append(userTeamsIds, team.Id)
			}

			userChannelMembers, err := s.Channel().GetAllChannelMembersForUser(user.Id, false, true)
			if err != nil {
				mlog.Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.Err(err))
				return
			}

			userChannelsIds := []string{}
			for channelId := range userChannelMembers {
				userChannelsIds = append(userChannelsIds, channelId)
			}

			if err := s.searchEngine.GetActiveEngine().IndexUser(user, userTeamsIds, userChannelsIds); err != nil {
				mlog.Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.Err(err))
				return
			}
		})()
	}
}
