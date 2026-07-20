// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"sync/atomic"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/public/utils"
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

func (s *SearchStore) indexUserFromID(rctx request.CTX, userId string) {
	user, err := s.User().Get(rctx.Context(), userId)
	if err != nil {
		return
	}
	s.indexUser(rctx, user)
}

func (s *SearchStore) indexUser(rctx request.CTX, user *model.User) {
	for _, engine := range s.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				userTeams, nErr := s.Team().GetTeamsByUserId(user.Id)
				if nErr != nil {
					rctx.Logger().Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(nErr))
					return
				}

				userTeamsIds := []string{}
				for _, team := range userTeams {
					userTeamsIds = append(userTeamsIds, team.Id)
				}

				userChannelMembers, err := s.Channel().GetAllChannelMembersForUser(rctx, user.Id, false, true)
				if err != nil {
					rctx.Logger().Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}

				userChannelsIds := []string{}
				for channelId := range userChannelMembers {
					userChannelsIds = append(userChannelsIds, channelId)
				}

				if err := engineCopy.IndexUser(rctx, user, userTeamsIds, userChannelsIds); err != nil {
					rctx.Logger().Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				rctx.Logger().Debug("Indexed user in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("user_id", user.Id))
			})
		}
	}
}

func (s *SearchStore) indexChannelsForTeam(rctx request.CTX, teamID string) {
	const perPage = 100
	var (
		channels []*model.Channel
	)

	channels, err := utils.Pager(func(page int) ([]*model.Channel, error) {
		return s.channel.GetPublicChannelsForTeam(teamID, page*perPage, perPage)
	}, perPage)
	if err != nil {
		rctx.Logger().Warn("Encountered error while retrieving public channels for indexing", mlog.String("team_id", teamID), mlog.Err(err))
		return
	}

	if len(channels) == 0 {
		return
	}

	// Use master context to avoid replica lag issues when reading team members
	masterRctx := store.RequestContextWithMaster(rctx)
	teamMemberIDs, err := s.channel.GetTeamMembersForChannel(masterRctx, channels[0].Id)
	if err != nil {
		rctx.Logger().Warn("Encountered error while retrieving team members for channel", mlog.String("channel_id", channels[0].Id), mlog.Err(err))
		return
	}

	s.channel.bulkIndexChannels(rctx, channels, teamMemberIDs)
}

// Runs an indexing function synchronously or asynchronously depending on the engine
func runIndexFn(rctx request.CTX, engine searchengine.SearchEngineInterface, indexFn func(searchengine.SearchEngineInterface)) {
	if engine.IsIndexingSync() {
		indexFn(engine)
		if err := engine.RefreshIndexes(rctx); err != nil {
			rctx.Logger().Error("Encountered error refresh the indexes", mlog.Err(err))
		}
	} else {
		go (func(engineCopy searchengine.SearchEngineInterface) {
			indexFn(engineCopy)
		})(engine)
	}
}
