// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

// searchChannelsForUser returns the channels a search by userID may cover. For
// a scoped search these are the scope's channels in place of the user's
// memberships; the engines only read their IDs.
func (s *SearchStore) searchChannelsForUser(paramsList []*model.SearchParams, userID, teamID string) (model.ChannelList, error) {
	if scoped := paramsList[0].ScopedChannels; scoped != nil {
		ids, err := s.Store.Channel().GetChannelIDsInSessionScope(teamID, scoped, false)
		if err != nil {
			return nil, errors.Wrap(err, "error getting scoped channels")
		}
		channels := make(model.ChannelList, 0, len(ids))
		for _, id := range ids {
			channels = append(channels, &model.Channel{Id: id})
		}
		return channels, nil
	}

	// We only allow the user to search in channels they are a member of.
	channels, err := s.Store.Channel().GetChannels(teamID, userID, &model.ChannelSearchOpts{
		IncludeDeleted: paramsList[0].IncludeDeletedChannels,
		LastDeleteAt:   0,
	})
	if err != nil {
		return nil, errors.Wrap(err, "error getting channel for user")
	}
	return channels, nil
}
