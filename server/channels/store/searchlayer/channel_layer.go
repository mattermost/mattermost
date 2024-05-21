// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"context"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

type SearchChannelStore struct {
	store.ChannelStore
	rootStore *SearchStore
}

func (c *SearchChannelStore) deleteChannelIndex(rctx request.CTX, channel *model.Channel) {
	if channel.Type == model.ChannelTypeOpen {
		for _, engine := range c.rootStore.searchEngine.GetActiveEngines() {
			if engine.IsIndexingEnabled() {
				runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
					if err := engineCopy.DeleteChannel(channel); err != nil {
						rctx.Logger().Warn("Encountered error deleting channel", mlog.String("channel_id", channel.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
						return
					}
					rctx.Logger().Debug("Removed channel from index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("channel_id", channel.Id))
				})
			}
		}
	}
}

func (c *SearchChannelStore) indexChannel(rctx request.CTX, channel *model.Channel) {
	var userIDs, teamMemberIDs []string
	var err error
	if channel.Type == model.ChannelTypePrivate {
		userIDs, err = c.GetAllChannelMemberIdsByChannelId(channel.Id)
		if err != nil {
			rctx.Logger().Warn("Encountered error while indexing channel", mlog.String("channel_id", channel.Id), mlog.Err(err))
			return
		}
	}

	teamMemberIDs, err = c.GetTeamMembersForChannel(channel.Id)
	if err != nil {
		rctx.Logger().Warn("Encountered error while indexing channel", mlog.String("channel_id", channel.Id), mlog.Err(err))
		return
	}

	for _, engine := range c.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.IndexChannel(rctx, channel, userIDs, teamMemberIDs); err != nil {
					rctx.Logger().Warn("Encountered error indexing channel", mlog.String("channel_id", channel.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				rctx.Logger().Debug("Indexed channel in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("channel_id", channel.Id))
			})
		}
	}
}

func (c *SearchChannelStore) Save(rctx request.CTX, channel *model.Channel, maxChannels int64) (*model.Channel, error) {
	newChannel, err := c.ChannelStore.Save(rctx, channel, maxChannels)
	if err == nil {
		c.indexChannel(rctx, newChannel)
	}
	return newChannel, err
}

func (c *SearchChannelStore) Update(rctx request.CTX, channel *model.Channel) (*model.Channel, error) {
	updatedChannel, err := c.ChannelStore.Update(rctx, channel)
	if err == nil {
		c.indexChannel(rctx, updatedChannel)
	}
	return updatedChannel, err
}

func (c *SearchChannelStore) UpdateMember(rctx request.CTX, cm *model.ChannelMember) (*model.ChannelMember, error) {
	member, err := c.ChannelStore.UpdateMember(rctx, cm)
	if err == nil {
		c.rootStore.indexUserFromID(rctx, cm.UserId)
		channel, channelErr := c.ChannelStore.Get(member.ChannelId, true)
		if channelErr != nil {
			rctx.Logger().Warn("Encountered error indexing user in channel", mlog.String("channel_id", member.ChannelId), mlog.Err(channelErr))
		} else {
			c.indexChannel(rctx, channel)
			c.rootStore.indexUserFromID(rctx, channel.CreatorId)
		}
	}
	return member, err
}

func (c *SearchChannelStore) SaveMember(rctx request.CTX, cm *model.ChannelMember) (*model.ChannelMember, error) {
	member, err := c.ChannelStore.SaveMember(rctx, cm)
	if err == nil {
		c.rootStore.indexUserFromID(rctx, cm.UserId)
		channel, channelErr := c.ChannelStore.Get(member.ChannelId, true)
		if channelErr != nil {
			rctx.Logger().Warn("Encountered error indexing user in channel", mlog.String("channel_id", member.ChannelId), mlog.Err(channelErr))
		} else {
			c.indexChannel(rctx, channel)
			c.rootStore.indexUserFromID(rctx, channel.CreatorId)
		}
	}
	return member, err
}

func (c *SearchChannelStore) RemoveMember(rctx request.CTX, channelID, userIdToRemove string) error {
	err := c.ChannelStore.RemoveMember(rctx, channelID, userIdToRemove)
	if err == nil {
		c.rootStore.indexUserFromID(rctx, userIdToRemove)
	}

	channel, err := c.ChannelStore.Get(channelID, true)
	if err == nil {
		c.indexChannel(rctx, channel)
	}

	return err
}

func (c *SearchChannelStore) RemoveMembers(rctx request.CTX, channelID string, userIds []string) error {
	if err := c.ChannelStore.RemoveMembers(rctx, channelID, userIds); err != nil {
		return err
	}

	channel, err := c.ChannelStore.Get(channelID, true)
	if err == nil {
		c.indexChannel(rctx, channel)
	}

	for _, uid := range userIds {
		c.rootStore.indexUserFromID(rctx, uid)
	}
	return nil
}

func (c *SearchChannelStore) CreateDirectChannel(rctx request.CTX, user *model.User, otherUser *model.User, channelOptions ...model.ChannelOption) (*model.Channel, error) {
	channel, err := c.ChannelStore.CreateDirectChannel(rctx, user, otherUser, channelOptions...)
	if err == nil {
		c.rootStore.indexUserFromID(rctx, user.Id)
		c.rootStore.indexUserFromID(rctx, otherUser.Id)
		c.indexChannel(rctx, channel)
	}
	return channel, err
}

func (c *SearchChannelStore) SaveDirectChannel(rctx request.CTX, directchannel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) (*model.Channel, error) {
	channel, err := c.ChannelStore.SaveDirectChannel(rctx, directchannel, member1, member2)
	if err == nil {
		c.rootStore.indexUserFromID(rctx, member1.UserId)
		c.rootStore.indexUserFromID(rctx, member2.UserId)
		c.indexChannel(rctx, channel)
	}
	return channel, err
}

func (c *SearchChannelStore) Autocomplete(rctx request.CTX, userID, term string, includeDeleted, isGuest bool) (model.ChannelListWithTeamData, error) {
	var channelList model.ChannelListWithTeamData
	var err error

	allFailed := true
	for _, engine := range c.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsAutocompletionEnabled() {
			channelList, err = c.searchAutocompleteChannelsAllTeams(engine, userID, term, includeDeleted, isGuest)
			if err != nil {
				rctx.Logger().Warn("Encountered error on AutocompleteChannels through SearchEngine. Falling back to default autocompletion.", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}
			allFailed = false
			rctx.Logger().Debug("Using the first available search engine", mlog.String("search_engine", engine.GetName()))
			break
		}
	}

	if allFailed {
		rctx.Logger().Debug("Using database search because no other search engine is available")
		channelList, err = c.ChannelStore.Autocomplete(rctx, userID, term, includeDeleted, isGuest)
		if err != nil {
			return nil, errors.Wrap(err, "Failed to autocomplete channels in team")
		}
	}

	if err != nil {
		return channelList, err
	}

	return channelList, nil
}

func (c *SearchChannelStore) AutocompleteInTeam(rctx request.CTX, teamID, userID, term string, includeDeleted, isGuest bool) (model.ChannelList, error) {
	var channelList model.ChannelList
	var err error

	allFailed := true
	for _, engine := range c.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsAutocompletionEnabled() {
			channelList, err = c.searchAutocompleteChannels(engine, teamID, userID, term, includeDeleted, isGuest)
			if err != nil {
				rctx.Logger().Warn("Encountered error on AutocompleteChannels through SearchEngine. Falling back to default autocompletion.", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}
			allFailed = false
			rctx.Logger().Debug("Using the first available search engine", mlog.String("search_engine", engine.GetName()))
			break
		}
	}

	if allFailed {
		rctx.Logger().Debug("Using database search because no other search engine is available")
		channelList, err = c.ChannelStore.AutocompleteInTeam(rctx, teamID, userID, term, includeDeleted, isGuest)
		if err != nil {
			return nil, errors.Wrap(err, "Failed to autocomplete channels in team")
		}
	}

	if err != nil {
		return channelList, err
	}

	return channelList, nil
}

func (c *SearchChannelStore) searchAutocompleteChannels(engine searchengine.SearchEngineInterface, teamId, userID, term string, includeDeleted, isGuest bool) (model.ChannelList, error) {
	channelIds, err := engine.SearchChannels(teamId, userID, term, isGuest)
	if err != nil {
		return nil, err
	}

	channelList := model.ChannelList{}
	var nErr error
	if len(channelIds) > 0 {
		channelList, nErr = c.ChannelStore.GetChannelsByIds(channelIds, includeDeleted)
		if nErr != nil {
			return nil, errors.Wrap(nErr, "Failed to get channels by ids")
		}
	}

	return channelList, nil
}

func (c *SearchChannelStore) searchAutocompleteChannelsAllTeams(engine searchengine.SearchEngineInterface, userID, term string, includeDeleted, isGuest bool) (model.ChannelListWithTeamData, error) {
	channelIds, err := engine.SearchChannels("", userID, term, isGuest)
	if err != nil {
		return nil, err
	}

	channelList := model.ChannelListWithTeamData{}
	var nErr error
	if len(channelIds) > 0 {
		channelList, nErr = c.ChannelStore.GetChannelsWithTeamDataByIds(channelIds, includeDeleted)
		if nErr != nil {
			return nil, errors.Wrap(nErr, "Failed to get channels by ids")
		}
	}

	return channelList, nil
}

func (c *SearchChannelStore) PermanentDeleteMembersByUser(rctx request.CTX, userId string) error {
	channels, errGetChannels := c.ChannelStore.GetChannelsByUser(userId, false, 0, -1, "")
	if errGetChannels != nil {
		rctx.Logger().Warn("Encountered error indexing channel after removing user", mlog.String("user_id", userId), mlog.Err(errGetChannels))
	}

	err := c.ChannelStore.PermanentDeleteMembersByUser(rctx, userId)
	if err == nil {
		c.rootStore.indexUserFromID(rctx, userId)
		if errGetChannels == nil {
			for _, ch := range channels {
				c.indexChannel(rctx, ch)
			}
		}
	}

	return err
}

func (c *SearchChannelStore) RemoveAllDeactivatedMembers(rctx request.CTX, channelId string) error {
	profiles, errProfiles := c.rootStore.User().GetAllProfilesInChannel(context.Background(), channelId, true)
	if errProfiles != nil {
		rctx.Logger().Warn("Encountered error indexing users for channel", mlog.String("channel_id", channelId), mlog.Err(errProfiles))
	}

	err := c.ChannelStore.RemoveAllDeactivatedMembers(rctx, channelId)
	if err == nil && errProfiles == nil {
		for _, user := range profiles {
			if user.DeleteAt != 0 {
				c.rootStore.indexUser(rctx, user)
			}
		}
	}
	return err
}

func (c *SearchChannelStore) PermanentDeleteMembersByChannel(rctx request.CTX, channelId string) error {
	profiles, errProfiles := c.rootStore.User().GetAllProfilesInChannel(context.Background(), channelId, true)
	if errProfiles != nil {
		rctx.Logger().Warn("Encountered error indexing users for channel", mlog.String("channel_id", channelId), mlog.Err(errProfiles))
	}

	err := c.ChannelStore.PermanentDeleteMembersByChannel(rctx, channelId)
	if err == nil && errProfiles == nil {
		for _, user := range profiles {
			c.rootStore.indexUser(rctx, user)
		}
	}
	return err
}

func (c *SearchChannelStore) PermanentDelete(rctx request.CTX, channelId string) error {
	channel, channelErr := c.ChannelStore.Get(channelId, true)
	if channelErr != nil {
		rctx.Logger().Warn("Encountered error deleting channel", mlog.String("channel_id", channelId), mlog.Err(channelErr))
	}
	err := c.ChannelStore.PermanentDelete(rctx, channelId)
	if err == nil && channelErr == nil {
		c.deleteChannelIndex(rctx, channel)
	}
	return err
}
