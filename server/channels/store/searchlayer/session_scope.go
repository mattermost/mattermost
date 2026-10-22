// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"sync"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

// openTeamChannelsTTL bounds how stale the cached open-team public channel list
// can be: local channel and team writes clear it, but writes on other cluster
// nodes and new access policies do not. Results are re-checked against the
// session scope after the search, so staleness can hide a channel but never
// expose one.
const openTeamChannelsTTL = time.Minute

type openTeamChannelsEntry struct {
	channels  model.ChannelList
	expiresAt time.Time
}

type openTeamChannelsCache struct {
	mu      sync.Mutex
	entries map[string]openTeamChannelsEntry
}

// scopedSearchChannels returns the channels a scoped search covers, in place of
// the user's memberships: the scope's listed channels plus, if granted, every
// public channel on an open team.
func (s *SearchStore) scopedSearchChannels(teamID string, resources *model.SessionScopeResources) (model.ChannelList, error) {
	channels := model.ChannelList{}
	seen := map[string]bool{}
	add := func(list model.ChannelList) {
		for _, channel := range list {
			if !seen[channel.Id] {
				seen[channel.Id] = true
				channels = append(channels, channel)
			}
		}
	}

	if resources.OpenTeamPublicChannels {
		openTeamChannels, err := s.openTeamPublicChannels(teamID)
		if err != nil {
			return nil, err
		}
		add(openTeamChannels)
	}

	if len(resources.ChannelIDs) > 0 {
		listed, err := s.Store.Channel().GetChannelsInSessionScope(teamID, &model.SessionScopeResources{ChannelIDs: resources.ChannelIDs})
		if err != nil {
			return nil, errors.Wrap(err, "error getting scoped channels")
		}
		add(listed)
	}

	return channels, nil
}

func (s *SearchStore) invalidateOpenTeamChannels() {
	s.openTeamChannels.mu.Lock()
	defer s.openTeamChannels.mu.Unlock()
	s.openTeamChannels.entries = nil
}

func (s *SearchStore) openTeamPublicChannels(teamID string) (model.ChannelList, error) {
	s.openTeamChannels.mu.Lock()
	defer s.openTeamChannels.mu.Unlock()

	if entry, ok := s.openTeamChannels.entries[teamID]; ok && time.Now().Before(entry.expiresAt) {
		return entry.channels, nil
	}

	channels, err := s.Store.Channel().GetChannelsInSessionScope(teamID, &model.SessionScopeResources{OpenTeamPublicChannels: true})
	if err != nil {
		return nil, errors.Wrap(err, "error getting open team public channels")
	}

	if s.openTeamChannels.entries == nil {
		s.openTeamChannels.entries = map[string]openTeamChannelsEntry{}
	}
	s.openTeamChannels.entries[teamID] = openTeamChannelsEntry{channels: channels, expiresAt: time.Now().Add(openTeamChannelsTTL)}
	return channels, nil
}

// searchChannelsForUser returns the channels a search by userID may cover.
func (s *SearchStore) searchChannelsForUser(paramsList []*model.SearchParams, userID, teamID string) (model.ChannelList, error) {
	if scoped := paramsList[0].ScopedChannels; scoped != nil {
		return s.scopedSearchChannels(teamID, scoped)
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
