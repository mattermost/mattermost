// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"errors"
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

			if listOfAllowedChannels != nil && len(listOfAllowedChannels) == 0 {
				return []*model.User{}, nil
			}

			sanitizedTerm := sanitizeSearchTerm(term)

			usersIds, err := engine.SearchUsersInTeam(teamId, listOfAllowedChannels, sanitizedTerm, options)
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
	sanitizedTerm := sanitizeSearchTerm(term)
	if channelId != "" && options.ListOfAllowedChannels != nil && !strings.Contains(strings.Join(options.ListOfAllowedChannels, "."), channelId) {
		nuchanIds, err = engine.SearchUsersInTeam(teamId, options.ListOfAllowedChannels, sanitizedTerm, options)
	} else {
		uchanIds, nuchanIds, err = engine.SearchUsersInChannel(teamId, channelId, options.ListOfAllowedChannels, sanitizedTerm, options)
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

// getListOfAllowedChannelsForTeam return the list of allowed channels to search user based on the
//	next scenarios:
//		- If there isn't view restrictions (team or channel) and no team id to filter them, then all
//		  channels are allowed (nil return)
//	   	- If we receive a team Id and either we don't have view restrictions or the provided team id is included in the
//		  list of restricted teams, then we return all the team channels
//		- If we don't receive team id or the provided team id is not in the list of allowed teams to search of and we
//		  don't have channel restrictions then we return an empty result because we cannot get channels
//		- If we receive channels restrictions we get:
//			- If we don't have team id, we get those restricted channels (guest accounts and quick search)
//			- If we have a team id then we only return those restricted channels that belongs to that team
func (s *SearchUserStore) getListOfAllowedChannelsForTeam(teamId string, viewRestrictions *model.ViewUsersRestrictions) ([]string, *model.AppError) {
	var listOfAllowedChannels []string
	if viewRestrictions == nil && teamId == "" {
		// nil return without error means all channels are allowed
		return nil, nil
	}

	if teamId != "" && (viewRestrictions == nil || strings.Contains(strings.Join(viewRestrictions.Teams, "."), teamId)) {
		channels, err := s.rootStore.Channel().GetTeamChannels(teamId)
		if err != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(err, &nfErr):
				return nil, model.NewAppError("getListOfAllowedChannelsForTeam", "app.channel.get_channels.not_found.app_error", nil, nfErr.Error(), http.StatusNotFound)
			default:
				return nil, model.NewAppError("getListOfAllowedChannelsForTeam", "app.channel.get_channels.get.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
		for _, channel := range *channels {
			listOfAllowedChannels = append(listOfAllowedChannels, channel.Id)
		}
		return listOfAllowedChannels, nil
	}

	if len(viewRestrictions.Channels) > 0 {
		channels, err := s.rootStore.Channel().GetChannelsByIds(viewRestrictions.Channels, false)
		if err != nil {
			return nil, model.NewAppError("getListOfAllowedChannelsForTeam", "app.channel.get_channels_by_ids.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		for _, c := range channels {
			if teamId == "" || (teamId != "" && c.TeamId == teamId) {
				listOfAllowedChannels = append(listOfAllowedChannels, c.Id)
			}
		}
		return listOfAllowedChannels, nil
	}

	return []string{}, nil
}

func (s *SearchUserStore) AutocompleteUsersInChannel(teamId, channelId, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, *model.AppError) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsAutocompletionEnabled() {
			listOfAllowedChannels, err := s.getListOfAllowedChannelsForTeam(teamId, options.ViewRestrictions)
			if err != nil {
				mlog.Error("Encountered error on AutocompleteUsersInChannel.", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}
			if listOfAllowedChannels != nil && len(listOfAllowedChannels) == 0 {
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
