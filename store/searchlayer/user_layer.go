// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package searchlayer

import (
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SearchUserStore struct {
	store.UserStore
	rootStore *SearchStore
}

func (s SearchUserStore) Search(teamId, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	if s.rootStore.searchEngine.GetActiveEngine().IsIndexingEnabled() {
		usersIds, err := s.rootStore.searchEngine.GetActiveEngine().SearchUsersInTeam(teamId, options.ListOfAllowedChannels, term, options)
		if err != nil {
			return nil, err
		}

		users, err := s.UserStore.GetProfileByIds(usersIds, nil, false)
		if err != nil {
			return nil, err
		}

		return users, nil
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
	if s.rootStore.searchEngine.GetActiveEngine().IsIndexingEnabled() && err == nil && userErr == nil {
		go (func() {
			if err := s.rootStore.searchEngine.GetActiveEngine().DeleteUser(user); err != nil {
				mlog.Error("Encountered error deleting user", mlog.String("user_id", user.Id), mlog.Err(err))
			}
		})()
	}
	return err
}

func (s SearchUserStore) AutocompleteUsersInChannel(teamId, channelId, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, *model.AppError) {
	var err *model.AppError
	uchanIds := []string{}
	nuchanIds := []string{}
	if !strings.Contains(strings.Join(options.ListOfAllowedChannels, "."), channelId) {
		nuchanIds, err = s.rootStore.searchEngine.GetActiveEngine().SearchUsersInTeam(teamId, options.ListOfAllowedChannels, term, options)
	} else {
		uchanIds, nuchanIds, err = s.rootStore.searchEngine.GetActiveEngine().SearchUsersInChannel(teamId, channelId, options.ListOfAllowedChannels, term, options)
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
