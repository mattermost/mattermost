// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SearchUserStore struct {
	store.UserStore
	rootStore *SearchStore
}

func (s *SearchUserStore) deleteUserIndex(user *model.User) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteUser(user); err != nil {
					mlog.Error("Encountered error deleting user", mlog.String("user_id", user.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				mlog.Debug("Removed user from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("user_id", user.Id))
			})
		}
	}
}

func (s *SearchUserStore) Search(teamId, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsSearchEnabled() {
			listOfAllowedChannels, err := s.getListOfAllowedChannelsForTeam(teamId, options.ViewRestrictions)
			if err != nil {
				mlog.Error("Encountered error on Search.", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}
			if len(listOfAllowedChannels) == 0 {
				return []*model.User{}, nil
			}

			usersIds, err := engine.SearchUsersInTeam(teamId, listOfAllowedChannels, term, options)
			if err != nil {
				mlog.Error("Encountered error on Search", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}

			users, err := s.UserStore.GetProfileByIds(usersIds, nil, false)
			if err != nil {
				mlog.Error("Encountered error on Search", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}

			mlog.Debug("Using the first available search engine", mlog.String("search_engine", engine.GetName()))
			return users, nil
		}
	}
	mlog.Debug("Using database search because no other search engine is available")

	return s.UserStore.Search(teamId, term, options)
}

func (s *SearchUserStore) Update(user *model.User, trustedUpdateData bool) (*model.UserUpdate, *model.AppError) {
	userUpdate, err := s.UserStore.Update(user, trustedUpdateData)

	if err == nil {
		s.rootStore.indexUser(userUpdate.New)
	}
	return userUpdate, err
}

func (s *SearchUserStore) Save(user *model.User) (*model.User, *model.AppError) {
	nuser, err := s.UserStore.Save(user)

	if err == nil {
		s.rootStore.indexUser(nuser)
	}
	return nuser, err
}

func (s *SearchUserStore) PermanentDelete(userId string) *model.AppError {
	user, userErr := s.UserStore.Get(userId)
	if userErr != nil {
		mlog.Error("Encountered error deleting user", mlog.String("user_id", userId), mlog.Err(userErr))
	}
	err := s.UserStore.PermanentDelete(userId)
	if err == nil && userErr == nil {
		s.deleteUserIndex(user)
	}
	return err
}

func (s *SearchUserStore) autocompleteUsersInChannelByEngine(engine searchengine.SearchEngineInterface, teamId, channelId, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, *model.AppError) {
	var err *model.AppError
	uchanIds := []string{}
	nuchanIds := []string{}
	if options.ListOfAllowedChannels != nil && !strings.Contains(strings.Join(options.ListOfAllowedChannels, "."), channelId) {
		nuchanIds, err = engine.SearchUsersInTeam(teamId, options.ListOfAllowedChannels, term, options)
	} else {
		uchanIds, nuchanIds, err = engine.SearchUsersInChannel(teamId, channelId, options.ListOfAllowedChannels, term, options)
	}
	if err != nil {
		return nil, err
	}

	uchan := make(chan store.StoreResult, 1)
	go func() {
		users, err := s.UserStore.GetProfileByIds(uchanIds, nil, false)
		uchan <- store.StoreResult{Data: users, Err: err}
		close(uchan)
	}()

	nuchan := make(chan store.StoreResult, 1)
	go func() {
		users, err := s.UserStore.GetProfileByIds(nuchanIds, nil, false)
		nuchan <- store.StoreResult{Data: users, Err: err}
		close(nuchan)
	}()

	autocomplete := &model.UserAutocompleteInChannel{}

	result := <-uchan
	if result.Err != nil {
		return nil, result.Err
	}
	inUsers := result.Data.([]*model.User)
	autocomplete.InChannel = inUsers

	result = <-nuchan
	if result.Err != nil {
		return nil, result.Err
	}
	outUsers := result.Data.([]*model.User)
	autocomplete.OutOfChannel = outUsers

	return autocomplete, nil
}

func (s *SearchUserStore) getListOfAllowedChannelsForTeam(teamId string, viewRestrictions *model.ViewUsersRestrictions) ([]string, *model.AppError) {
	if len(teamId) == 0 {
		return nil, model.NewAppError("SearchUserStore", "store.search_user_store.empty_team_id", nil, "", http.StatusInternalServerError)
	}

	var listOfAllowedChannels []string
	if viewRestrictions == nil || strings.Contains(strings.Join(viewRestrictions.Teams, "."), teamId) {
		channels, err := s.rootStore.Channel().GetTeamChannels(teamId)
		if err != nil {
			return nil, err
		}
		channelIds := []string{}
		for _, channel := range *channels {
			channelIds = append(channelIds, channel.Id)
		}

		return channelIds, nil
	}

	if len(viewRestrictions.Channels) == 0 {
		return []string{}, nil
	}

	channels, err := s.rootStore.Channel().GetChannelsByIds(viewRestrictions.Channels, false)

	if err != nil {
		return nil, err
	}
	for _, c := range channels {
		if c.TeamId == teamId {
			listOfAllowedChannels = append(listOfAllowedChannels, c.Id)
		}
	}

	return listOfAllowedChannels, nil
}

func (s *SearchUserStore) AutocompleteUsersInChannel(teamId, channelId, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, *model.AppError) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsAutocompletionEnabled() {
			listOfAllowedChannels, err := s.getListOfAllowedChannelsForTeam(teamId, options.ViewRestrictions)
			if err != nil {
				mlog.Error("Encountered error on AutocompleteUsersInChannel.", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}
			if len(listOfAllowedChannels) == 0 {
				return &model.UserAutocompleteInChannel{}, nil
			}
			options.ListOfAllowedChannels = listOfAllowedChannels
			autocomplete, err := s.autocompleteUsersInChannelByEngine(engine, teamId, channelId, term, options)
			if err != nil {
				mlog.Error("Encountered error on AutocompleteUsersInChannel.", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}
			mlog.Debug("Using the first available search engine", mlog.String("search_engine", engine.GetName()))
			return autocomplete, err
		}
	}

	mlog.Debug("Using database search because no other search engine is available")
	return s.UserStore.AutocompleteUsersInChannel(teamId, channelId, term, options)
}
