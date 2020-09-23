// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SearchChannelStore struct {
	store.ChannelStore
	rootStore *SearchStore
}

func (c *SearchChannelStore) deleteChannelIndex(channel *model.Channel) {
	if channel.Type == model.CHANNEL_OPEN {
		for _, engine := range c.rootStore.searchEngine.GetActiveEngines() {
			if engine.IsIndexingEnabled() {
				runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
					if err := engineCopy.DeleteChannel(channel); err != nil {
						mlog.Error("Encountered error deleting channel", mlog.String("channel_id", channel.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					}
					mlog.Debug("Removed channel from index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("channel_id", channel.Id))
				})
			}
		}
	}
}

func (c *SearchChannelStore) indexChannel(channel *model.Channel) {
	if channel.Type == model.CHANNEL_OPEN {
		for _, engine := range c.rootStore.searchEngine.GetActiveEngines() {
			if engine.IsIndexingEnabled() {
				runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
					if err := engineCopy.IndexChannel(channel); err != nil {
						mlog.Error("Encountered error indexing channel", mlog.String("channel_id", channel.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					}
					mlog.Debug("Indexed channel in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("channel_id", channel.Id))
				})
			}
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
			mlog.Error("Encountered error indexing user in channel", mlog.String("channel_id", member.ChannelId), mlog.Err(channelErr))
		} else {
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
			mlog.Error("Encountered error indexing user in channel", mlog.String("channel_id", member.ChannelId), mlog.Err(channelErr))
		} else {
			c.rootStore.indexUserFromID(channel.CreatorId)
		}
	}
	return member, err
}

func (c *SearchChannelStore) RemoveMember(channelId, userIdToRemove string) error {
	err := c.ChannelStore.RemoveMember(channelId, userIdToRemove)
	if err == nil {
		c.rootStore.indexUserFromID(userIdToRemove)
	}
	return err
}

func (c *SearchChannelStore) RemoveMembers(channelId string, userIds []string) error {
	if err := c.ChannelStore.RemoveMembers(channelId, userIds); err != nil {
		return err
	}

	for _, uid := range userIds {
		c.rootStore.indexUserFromID(uid)
	}
	return nil
}

func (c *SearchChannelStore) CreateDirectChannel(user *model.User, otherUser *model.User) (*model.Channel, error) {
	channel, err := c.ChannelStore.CreateDirectChannel(user, otherUser)
	if err == nil {
		c.rootStore.indexUserFromID(user.Id)
		c.rootStore.indexUserFromID(otherUser.Id)
	}
	return channel, err
}

func (c *SearchChannelStore) SaveDirectChannel(directchannel *model.Channel, member1 *model.ChannelMember, member2 *model.ChannelMember) (*model.Channel, error) {
	channel, err := c.ChannelStore.SaveDirectChannel(directchannel, member1, member2)
	if err != nil {
		c.rootStore.indexUserFromID(member1.UserId)
		c.rootStore.indexUserFromID(member2.UserId)
	}
	return channel, err
}

func (c *SearchChannelStore) AutocompleteInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	var channelList *model.ChannelList
	var err *model.AppError

	allFailed := true
	for _, engine := range c.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsAutocompletionEnabled() {
			channelList, err = c.searchAutocompleteChannels(engine, teamId, term, includeDeleted)
			if err != nil {
				mlog.Error("Encountered error on AutocompleteChannels through SearchEngine. Falling back to default autocompletion.", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}
			allFailed = false
			mlog.Debug("Using the first available search engine", mlog.String("search_engine", engine.GetName()))
			break
		}
	}

	if allFailed {
		mlog.Debug("Using database search because no other search engine is available")
		channelList, err = c.ChannelStore.AutocompleteInTeam(teamId, term, includeDeleted)
		if err != nil {
			return nil, err
		}
	}
	return channelList, err
}

func (c *SearchChannelStore) searchAutocompleteChannels(engine searchengine.SearchEngineInterface, teamId, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	channelIds, err := engine.SearchChannels(teamId, term)
	if err != nil {
		return nil, err
	}

	channelList := model.ChannelList{}
	if len(channelIds) > 0 {
		channels, err := c.ChannelStore.GetChannelsByIds(channelIds, includeDeleted)
		if err != nil {
			return nil, model.NewAppError("searchAutocompleteChannels", "app.channel.get_channels_by_ids.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		for _, ch := range channels {
			channelList = append(channelList, ch)
		}
	}

	return &channelList, nil
}

func (c *SearchChannelStore) PermanentDeleteMembersByUser(userId string) error {
	err := c.ChannelStore.PermanentDeleteMembersByUser(userId)
	if err == nil {
		c.rootStore.indexUserFromID(userId)
	}
	return err
}

func (c *SearchChannelStore) RemoveAllDeactivatedMembers(channelId string) *model.AppError {
	profiles, errProfiles := c.rootStore.User().GetAllProfilesInChannel(channelId, true)
	if errProfiles != nil {
		mlog.Error("Encountered error indexing users for channel", mlog.String("channel_id", channelId), mlog.Err(errProfiles))
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
	profiles, errProfiles := c.rootStore.User().GetAllProfilesInChannel(channelId, true)
	if errProfiles != nil {
		mlog.Error("Encountered error indexing users for channel", mlog.String("channel_id", channelId), mlog.Err(errProfiles))
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
		mlog.Error("Encountered error deleting channel", mlog.String("channel_id", channelId), mlog.Err(channelErr))
	}
	err := c.ChannelStore.PermanentDelete(channelId)
	if err == nil && channelErr == nil {
		c.deleteChannelIndex(channel)
	}
	return err
}
