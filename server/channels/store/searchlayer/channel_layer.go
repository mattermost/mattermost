// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"context"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/store"
	"github.com/mattermost/mattermost-server/v6/server/platform/services/searchengine"
	"github.com/mattermost/mattermost-server/v6/server/platform/shared/mlog"
)

type SearchChannelStore struct {
	store.ChannelStore
	rootStore *SearchStore
}

func (c *SearchChannelStore) deleteChannelIndex(channel *model.Channel) {
	if channel.Type == model.ChannelTypeOpen {
		for _, engine := range c.rootStore.searchEngine.GetActiveEngines() {
			if engine.IsIndexingEnabled() {
				runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
					if err := engineCopy.DeleteChannel(channel); err != nil {
						mlog.Warn("Encountered error deleting channel", mlog.String("channel_id", channel.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
						return
					}
					mlog.Debug("Removed channel from index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("channel_id", channel.Id))
				})
			}
		}
	}
}

func (c *SearchChannelStore) indexChannel(channel *model.Channel) {
	var userIDs, teamMemberIDs []string
	var err error
	if channel.Type == model.ChannelTypePrivate {
		userIDs, err = c.GetAllChannelMembersById(channel.Id)
		if err != nil {
			mlog.Warn("Encountered error while indexing channel", mlog.String("channel_id", channel.Id), mlog.Err(err))
			return
		}
	}

	teamMemberIDs, err = c.GetTeamMembersForChannel(channel.Id)
	if err != nil {
		mlog.Warn("Encountered error while indexing channel", mlog.String("channel_id", channel.Id), mlog.Err(err))
		return
	}

	for _, engine := range c.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.IndexChannel(channel, userIDs, teamMemberIDs); err != nil {
					mlog.Warn("Encountered error indexing channel", mlog.String("channel_id", channel.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				mlog.Debug("Indexed channel in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("channel_id", channel.Id))
			})
		}
	}
}

func (c *SearchChannelStore) Save(channel *model.Channel, maxChannels int64) (*model.Channel, error) {
	newChannel, err := c.ChannelStore.Save(channel, maxChannels)
	if err == nil {
		c.indexChannel(newChannel)
	}
	return newChannel, err
}

func (c *SearchChannelStore) Update(channel *model.Channel) (*model.Channel, error) {
	updatedChannel, err := c.ChannelStore.Update(channel)
	if err == nil {
		c.indexChannel(updatedChannel)
	}
	return updatedChannel, err
}

func (c *SearchChannelStore) UpdateMember(cm *model.ChannelMember) (*model.ChannelMember, error) {
	member, err := c.ChannelStore.UpdateMember(cm)
	if err == nil {
		c.rootStore.indexUserFromID(cm.UserId)
		channel, channelErr := c.ChannelStore.Get(member.ChannelId, true)
		if channelErr != nil {
			mlog.Warn("Encountered error indexing user in channel", mlog.String("channel_id", member.ChannelId), mlog.Err(channelErr))
		} else {
			c.indexChannel(channel)
			c.rootStore.indexUserFromID(channel.CreatorId)
		}
	}
	return member, err
}

func (c *SearchChannelStore) SaveMember(cm *model.ChannelMember) (*model.ChannelMember, error) {
	member, err := c.ChannelStore.SaveMember(cm)
	if err == nil {
		c.rootStore.indexUserFromID(cm.UserId)
		channel, channelErr := c.ChannelStore.Get(member.ChannelId, true)
		if channelErr != nil {
			mlog.Warn("Encountered error indexing user in channel", mlog.String("channel_id", member.ChannelId), mlog.Err(channelErr))
		} else {
			c.indexChannel(channel)
			c.rootStore.indexUserFromID(channel.CreatorId)
		}
	}
	return member, err
}

func (c *SearchChannelStore) RemoveMember(channelID, userIdToRemove string) error {
	err := c.ChannelStore.RemoveMember(channelID, userIdToRemove)
	if err == nil {
		c.rootStore.indexUserFromID(userIdToRemove)
	}

	channel, err := c.ChannelStore.Get(channelID, true)
	if err == nil {
		c.indexChannel(channel)
	}

	return err
}

func (c *SearchChannelStore) RemoveMembers(channelID string, userIds []string) error {
	if err := c.ChannelStore.RemoveMembers(channelID, userIds); err != nil {
		return err
	}

	channel, err := c.ChannelStore.Get(channelID, true)
	if err == nil {
		c.indexChannel(channel)
	}

	for _, uid := range userIds {
		c.rootStore.indexUserFromID(uid)
	}
	return nil
}

func (c *SearchChannelStore) CreateDirectChannel(user *model.User, otherUser *model.User, channelOptions ...model.ChannelOption) (*model.Channel, error) {
	channel, err := c.ChannelStore.CreateDirectChannel(user, otherUser, channelOptions...)
	if err == nil {
		c.rootStore.indexUserFromID(user.Id)
		c.rootStore.indexUserFromID(otherUser.Id)
		c.indexChannel(channel)
	}
	return channel, err
}

func (c *SearchChannelStore) SaveDirectChannel(directchannel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) (*model.Channel, error) {
	channel, err := c.ChannelStore.SaveDirectChannel(directchannel, member1, member2)
	if err == nil {
		c.rootStore.indexUserFromID(member1.UserId)
		c.rootStore.indexUserFromID(member2.UserId)
		c.indexChannel(channel)
	}
	return channel, err
}

func (c *SearchChannelStore) Autocomplete(userID, term string, includeDeleted, isGuest bool) (model.ChannelListWithTeamData, error) {
	var channelList model.ChannelListWithTeamData
	var err error

	allFailed := true
	for _, engine := range c.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsAutocompletionEnabled() {
			channelList, err = c.searchAutocompleteChannelsAllTeams(engine, userID, term, includeDeleted, isGuest)
			if err != nil {
				mlog.Warn("Encountered error on AutocompleteChannels through SearchEngine. Falling back to default autocompletion.", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}
			allFailed = false
			mlog.Debug("Using the first available search engine", mlog.String("search_engine", engine.GetName()))
			break
		}
	}

	if allFailed {
		mlog.Debug("Using database search because no other search engine is available")
		channelList, err = c.ChannelStore.Autocomplete(userID, term, includeDeleted, isGuest)
		if err != nil {
			return nil, errors.Wrap(err, "Failed to autocomplete channels in team")
		}
	}

	if err != nil {
		return channelList, err
	}

	return channelList, nil
}

func (c *SearchChannelStore) AutocompleteInTeam(teamID, userID, term string, includeDeleted, isGuest bool) (model.ChannelList, error) {
	var channelList model.ChannelList
	var err error

	allFailed := true
	for _, engine := range c.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsAutocompletionEnabled() {
			channelList, err = c.searchAutocompleteChannels(engine, teamID, userID, term, includeDeleted, isGuest)
			if err != nil {
				mlog.Warn("Encountered error on AutocompleteChannels through SearchEngine. Falling back to default autocompletion.", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}
			allFailed = false
			mlog.Debug("Using the first available search engine", mlog.String("search_engine", engine.GetName()))
			break
		}
	}

	if allFailed {
		mlog.Debug("Using database search because no other search engine is available")
		channelList, err = c.ChannelStore.AutocompleteInTeam(teamID, userID, term, includeDeleted, isGuest)
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

func (c *SearchChannelStore) PermanentDeleteMembersByUser(userId string) error {
	channels, errGetChannels := c.ChannelStore.GetChannelsByUser(userId, false, 0, -1, "")
	if errGetChannels != nil {
		mlog.Warn("Encountered error indexing channel after removing user", mlog.String("user_id", userId), mlog.Err(errGetChannels))
	}

	err := c.ChannelStore.PermanentDeleteMembersByUser(userId)
	if err == nil {
		c.rootStore.indexUserFromID(userId)
		if errGetChannels == nil {
			for _, ch := range channels {
				c.indexChannel(ch)
			}
		}
	}

	return err
}

func (c *SearchChannelStore) RemoveAllDeactivatedMembers(channelId string) error {
	profiles, errProfiles := c.rootStore.User().GetAllProfilesInChannel(context.Background(), channelId, true)
	if errProfiles != nil {
		mlog.Warn("Encountered error indexing users for channel", mlog.String("channel_id", channelId), mlog.Err(errProfiles))
	}

	err := c.ChannelStore.RemoveAllDeactivatedMembers(channelId)
	if err == nil && errProfiles == nil {
		for _, user := range profiles {
			if user.DeleteAt != 0 {
				c.rootStore.indexUser(user)
			}
		}
	}
	return err
}

func (c *SearchChannelStore) PermanentDeleteMembersByChannel(channelId string) error {
	profiles, errProfiles := c.rootStore.User().GetAllProfilesInChannel(context.Background(), channelId, true)
	if errProfiles != nil {
		mlog.Warn("Encountered error indexing users for channel", mlog.String("channel_id", channelId), mlog.Err(errProfiles))
	}

	err := c.ChannelStore.PermanentDeleteMembersByChannel(channelId)
	if err == nil && errProfiles == nil {
		for _, user := range profiles {
			c.rootStore.indexUser(user)
		}
	}
	return err
}

func (c *SearchChannelStore) PermanentDelete(channelId string) error {
	channel, channelErr := c.ChannelStore.Get(channelId, true)
	if channelErr != nil {
		mlog.Warn("Encountered error deleting channel", mlog.String("channel_id", channelId), mlog.Err(channelErr))
	}
	err := c.ChannelStore.PermanentDelete(channelId)
	if err == nil && channelErr == nil {
		c.deleteChannelIndex(channel)
	}
	return err
}
