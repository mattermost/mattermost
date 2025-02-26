// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"context"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

type SearchUserStore struct {
	store.UserStore
	rootStore *SearchStore
}

func (s *SearchUserStore) deleteUserIndex(rctx request.CTX, user *model.User) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteUser(user); err != nil {
					rctx.Logger().Error("Encountered error deleting user", mlog.String("user_id", user.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				rctx.Logger().Debug("Removed user from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("user_id", user.Id))
			})
		}
	}
}

func (s *SearchUserStore) Search(rctx request.CTX, teamId, term string, options *model.UserSearchOptions) ([]*model.User, error) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsSearchEnabled() {
			listOfAllowedChannels, nErr := s.getListOfAllowedChannels(teamId, "", options.ViewRestrictions)
			if nErr != nil {
				rctx.Logger().Warn("Encountered error on Search.", mlog.String("search_engine", engine.GetName()), mlog.Err(nErr))
				continue
			}

			if listOfAllowedChannels != nil && len(listOfAllowedChannels) == 0 {
				return []*model.User{}, nil
			}

			sanitizedTerm := sanitizeSearchTerm(term)

			usersIds, err := engine.SearchUsersInTeam(teamId, listOfAllowedChannels, sanitizedTerm, options)
			if err != nil {
				rctx.Logger().Warn("Encountered error on Search", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}

			users, nErr := s.UserStore.GetProfileByIds(context.Background(), usersIds, nil, false)
			if nErr != nil {
				rctx.Logger().Warn("Encountered error on Search", mlog.String("search_engine", engine.GetName()), mlog.Err(nErr))
				continue
			}

			rctx.Logger().Debug("Using the first available search engine", mlog.String("search_engine", engine.GetName()))
			return users, nil
		}
	}

	rctx.Logger().Debug("Using database search because no other search engine is available")

	return s.UserStore.Search(rctx, teamId, term, options)
}

func (s *SearchUserStore) Update(rctx request.CTX, user *model.User, trustedUpdateData bool) (*model.UserUpdate, error) {
	userUpdate, err := s.UserStore.Update(rctx, user, trustedUpdateData)

	if err == nil {
		s.rootStore.indexUser(rctx, userUpdate.New)
	}
	return userUpdate, err
}

func (s *SearchUserStore) Save(rctx request.CTX, user *model.User) (*model.User, error) {
	nuser, err := s.UserStore.Save(rctx, user)

	if err == nil {
		s.rootStore.indexUser(rctx, nuser)
	}
	return nuser, err
}

func (s *SearchUserStore) PermanentDelete(rctx request.CTX, userId string) error {
	user, userErr := s.UserStore.Get(context.Background(), userId)
	if userErr != nil {
		rctx.Logger().Warn("Encountered error deleting user", mlog.String("user_id", userId), mlog.Err(userErr))
	}
	err := s.UserStore.PermanentDelete(rctx, userId)
	if err == nil && userErr == nil {
		s.deleteUserIndex(rctx, user)
	}
	return err
}

func (s *SearchUserStore) autocompleteUsersInChannelByEngine(engine searchengine.SearchEngineInterface, teamId, channelId, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, error) {
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

	uchan := make(chan store.StoreResult[[]*model.User], 1)
	go func() {
		users, nErr := s.UserStore.GetProfileByIds(context.Background(), uchanIds, nil, false)
		uchan <- store.StoreResult[[]*model.User]{Data: users, NErr: nErr}
		close(uchan)
	}()

	nuchan := make(chan store.StoreResult[[]*model.User], 1)
	go func() {
		users, nErr := s.UserStore.GetProfileByIds(context.Background(), nuchanIds, nil, false)
		nuchan <- store.StoreResult[[]*model.User]{Data: users, NErr: nErr}
		close(nuchan)
	}()

	autocomplete := &model.UserAutocompleteInChannel{}

	result := <-uchan
	if result.NErr != nil {
		return nil, errors.Wrap(result.NErr, "failed to get user profiles by ids")
	}
	autocomplete.InChannel = result.Data

	result = <-nuchan
	if result.NErr != nil {
		return nil, errors.Wrap(result.NErr, "failed to get user profiles by ids")
	}
	autocomplete.OutOfChannel = result.Data

	return autocomplete, nil
}

// getListOfAllowedChannels return the list of allowed channels to search user based on the
//
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
func (s *SearchUserStore) getListOfAllowedChannels(teamId, channelId string, viewRestrictions *model.ViewUsersRestrictions) ([]string, error) {
	var listOfAllowedChannels []string
	if viewRestrictions == nil && teamId == "" {
		// nil return without error means all channels are allowed
		return nil, nil
	}

	if teamId != "" && (viewRestrictions == nil || strings.Contains(strings.Join(viewRestrictions.Teams, "."), teamId)) {
		channels, err := s.rootStore.Channel().GetTeamChannels(teamId)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get team channels")
		}
		for _, channel := range channels {
			listOfAllowedChannels = append(listOfAllowedChannels, channel.Id)
		}

		if channelId != "" {
			ch, err := s.rootStore.Channel().Get(channelId, true)
			if err != nil {
				return nil, errors.Wrapf(err, "failed to get channel with id: %s", channelId)
			}
			// Check if DM/GM channel, and add to the list.
			// This is because GetTeamChannels does not return DM/GM channels.
			// And since the channelId is passed from the API layer, it is already
			// auth checked to confirm that the user has permission.
			if ch.IsGroupOrDirect() {
				listOfAllowedChannels = append(listOfAllowedChannels, channelId)
			}
		}
		return listOfAllowedChannels, nil
	}

	if len(viewRestrictions.Channels) > 0 {
		channels, err := s.rootStore.Channel().GetChannelsByIds(viewRestrictions.Channels, false)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get channels by ids")
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

func (s *SearchUserStore) AutocompleteUsersInChannel(rctx request.CTX, teamId, channelId, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, error) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsAutocompletionEnabled() {
			listOfAllowedChannels, nErr := s.getListOfAllowedChannels(teamId, channelId, options.ViewRestrictions)
			if nErr != nil {
				rctx.Logger().Warn("Encountered error on AutocompleteUsersInChannel.", mlog.String("search_engine", engine.GetName()), mlog.Err(nErr))
				continue
			}
			if listOfAllowedChannels != nil && len(listOfAllowedChannels) == 0 {
				return &model.UserAutocompleteInChannel{}, nil
			}
			options.ListOfAllowedChannels = listOfAllowedChannels

			autocomplete, nErr := s.autocompleteUsersInChannelByEngine(engine, teamId, channelId, term, options)
			if nErr != nil {
				rctx.Logger().Warn("Encountered error on AutocompleteUsersInChannel.", mlog.String("search_engine", engine.GetName()), mlog.Err(nErr))
				continue
			}
			rctx.Logger().Debug("Using the first available search engine", mlog.String("search_engine", engine.GetName()))
			return autocomplete, nil
		}
	}

	rctx.Logger().Debug("Using database search because no other search engine is available")
	return s.UserStore.AutocompleteUsersInChannel(rctx, teamId, channelId, term, options)
}
