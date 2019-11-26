// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package searchlayer

import (
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/searchengine"
	"github.com/mattermost/mattermost-server/store"
)

type SearchUserStore struct {
	store.UserStore
	rootStore *SearchStore
}

func (s SearchUserStore) deleteUserIndex(user *model.User) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			engineCopy := engine
			go (func() {
				if err := engineCopy.DeleteUser(user); err != nil {
					mlog.Error("Encountered error deleting user", mlog.String("user_id", user.Id), mlog.Err(err))
				}
			})()
		}
	}
}

func (s SearchUserStore) Search(teamId, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsSearchEnabled() {
			usersIds, err := engine.SearchUsersInTeam(teamId, options.ListOfAllowedChannels, term, options)
			if err != nil {
				continue
			}

			users, err := s.UserStore.GetProfileByIds(usersIds, nil, false)
			if err != nil {
				continue
			}

			return users, nil
		}
	}
	return s.UserStore.Search(teamId, term, options)
}

func (s SearchUserStore) Update(user *model.User, trustedUpdateData bool) (*model.UserUpdate, *model.AppError) {
	userUpdate, err := s.UserStore.Update(user, trustedUpdateData)

	if err == nil {
		s.rootStore.indexUser(userUpdate.New)
	}
	return userUpdate, err
}

func (s SearchUserStore) Save(user *model.User) (*model.User, *model.AppError) {
	nuser, err := s.UserStore.Save(user)

	if err == nil {
		s.rootStore.indexUser(nuser)
	}
	return nuser, err
}

func (s SearchUserStore) PermanentDelete(userId string) *model.AppError {
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

func (s SearchUserStore) autocompleteUsersInChannelByEngine(engine searchengine.SearchEngineInterface, teamId, channelId, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, *model.AppError) {
	var err *model.AppError
	uchanIds := []string{}
	nuchanIds := []string{}
	if !strings.Contains(strings.Join(options.ListOfAllowedChannels, "."), channelId) {
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
	users := result.Data.([]*model.User)
	autocomplete.InChannel = users

	result = <-nuchan
	if result.Err != nil {
		return nil, result.Err
	}
	users = result.Data.([]*model.User)
	autocomplete.OutOfChannel = users

	return autocomplete, nil
}

func (s SearchUserStore) AutocompleteUsersInChannel(teamId, channelId, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, *model.AppError) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsAutocompletionEnabled() {
			autocomplete, err := s.autocompleteUsersInChannelByEngine(engine, teamId, channelId, term, options)
			if err != nil {
				continue
			}
			return autocomplete, err
		}
	}

	return s.UserStore.AutocompleteUsersInChannel(teamId, channelId, term, options)
}
