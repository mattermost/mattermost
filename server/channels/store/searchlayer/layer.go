// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"context"
	"sync/atomic"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

type SearchStore struct {
	store.Store
	searchEngine *searchengine.Broker
	user         *SearchUserStore
	team         *SearchTeamStore
	channel      *SearchChannelStore
	post         *SearchPostStore
	fileInfo     *SearchFileInfoStore
	configValue  atomic.Pointer[model.Config]
}

func NewSearchLayer(baseStore store.Store, searchEngine *searchengine.Broker, cfg *model.Config) *SearchStore {
	searchStore := &SearchStore{
		Store:        baseStore,
		searchEngine: searchEngine,
	}
	searchStore.configValue.Store(cfg)
	searchStore.channel = &SearchChannelStore{ChannelStore: baseStore.Channel(), rootStore: searchStore}
	searchStore.post = &SearchPostStore{PostStore: baseStore.Post(), rootStore: searchStore}
	searchStore.team = &SearchTeamStore{TeamStore: baseStore.Team(), rootStore: searchStore}
	searchStore.user = &SearchUserStore{UserStore: baseStore.User(), rootStore: searchStore}
	searchStore.fileInfo = &SearchFileInfoStore{FileInfoStore: baseStore.FileInfo(), rootStore: searchStore}

	return searchStore
}

func (s *SearchStore) UpdateConfig(cfg *model.Config) {
	s.configValue.Store(cfg)
}

func (s *SearchStore) getConfig() *model.Config {
	return s.configValue.Load()
}

func (s *SearchStore) Channel() store.ChannelStore {
	return s.channel
}

func (s *SearchStore) Post() store.PostStore {
	return s.post
}

func (s *SearchStore) FileInfo() store.FileInfoStore {
	return s.fileInfo
}

func (s *SearchStore) Team() store.TeamStore {
	return s.team
}

func (s *SearchStore) User() store.UserStore {
	return s.user
}

func (s *SearchStore) indexUserFromID(userId string) {
	user, err := s.User().Get(context.Background(), userId)
	if err != nil {
		return
	}
	s.indexUser(user)
}

func (s *SearchStore) indexUser(user *model.User) {
	for _, engine := range s.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				userTeams, nErr := s.Team().GetTeamsByUserId(user.Id)
				if nErr != nil {
					mlog.Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(nErr))
					return
				}

				userTeamsIds := []string{}
				for _, team := range userTeams {
					userTeamsIds = append(userTeamsIds, team.Id)
				}

				userChannelMembers, err := s.Channel().GetAllChannelMembersForUser(user.Id, false, true)
				if err != nil {
					mlog.Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}

				userChannelsIds := []string{}
				for channelId := range userChannelMembers {
					userChannelsIds = append(userChannelsIds, channelId)
				}

				if err := engineCopy.IndexUser(user, userTeamsIds, userChannelsIds); err != nil {
					mlog.Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				mlog.Debug("Indexed user in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("user_id", user.Id))
			})
		}
	}
}

// Runs an indexing function synchronously or asynchronously depending on the engine
func runIndexFn(engine searchengine.SearchEngineInterface, indexFn func(searchengine.SearchEngineInterface)) {
	if engine.IsIndexingSync() {
		indexFn(engine)
		if err := engine.RefreshIndexes(); err != nil {
			mlog.Error("Encountered error refresh the indexes", mlog.Err(err))
		}
	} else {
		go (func(engineCopy searchengine.SearchEngineInterface) {
			indexFn(engineCopy)
		})(engine)
	}
}
