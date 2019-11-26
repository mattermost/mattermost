// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package searchlayer

import (
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SearchChannelStore struct {
	store.ChannelStore
	rootStore *SearchStore
}

func (c *SearchChannelStore) Save(channel *model.Channel, maxChannels int64) (*model.Channel, *model.AppError) {
	newChannel, err := c.ChannelStore.Save(channel, maxChannels)
	if err != nil && c.rootStore.searchEngine.GetActiveEngine().IsIndexingEnabled() {
		if newChannel.Type == model.CHANNEL_OPEN {
			go (func() {
				if err := c.rootStore.searchEngine.GetActiveEngine().IndexChannel(newChannel); err != nil {
					mlog.Error("Encountered error indexing channel", mlog.String("channel_id", newChannel.Id), mlog.Err(err))
				}
			})()
		}
	}
	return newChannel, err
}

func (c *SearchChannelStore) Update(channel *model.Channel) (*model.Channel, *model.AppError) {
	updatedChannel, err := c.ChannelStore.Update(channel)
	if err != nil && c.rootStore.searchEngine.GetActiveEngine().IsIndexingEnabled() {
		if updatedChannel.Type == model.CHANNEL_OPEN {
			go (func() {
				if err := c.rootStore.searchEngine.GetActiveEngine().IndexChannel(updatedChannel); err != nil {
					mlog.Error("Encountered error indexing channel", mlog.String("channel_id", updatedChannel.Id), mlog.Err(err))
				}
			})()
		}
	}
	return updatedChannel, err
}

func (c *SearchChannelStore) SaveMember(cm *model.ChannelMember) (*model.ChannelMember, *model.AppError) {
	member, err := c.ChannelStore.SaveMember(cm)
	if err != nil && c.rootStore.searchEngine.GetActiveEngine().IsIndexingEnabled() {
		go (func() {
			channel, channelErr := c.ChannelStore.Get(member.ChannelId, true)
			if channelErr != nil {
				mlog.Error("Encountered error indexing user in channel", mlog.String("channel_id", member.ChannelId), mlog.Err(err))
				return
			}
			c.rootStore.indexUserFromID(channel.CreatorId)
		})()
	}
	return member, err
}

func (c *SearchChannelStore) RemoveMember(channelId, userIdToRemove string) *model.AppError {
	err := c.ChannelStore.RemoveMember(channelId, userIdToRemove)
	if err == nil && c.rootStore.searchEngine.GetActiveEngine().IsIndexingEnabled() {
		c.rootStore.indexUserFromID(userIdToRemove)
	}
	return err
}

func (c *SearchChannelStore) CreateDirectChannel(user *model.User, otherUser *model.User) (*model.Channel, *model.AppError) {
	channel, err := c.ChannelStore.CreateDirectChannel(user, otherUser)
	if err == nil && c.rootStore.searchEngine.GetActiveEngine().IsIndexingEnabled() {
		c.rootStore.indexUserFromID(user.Id)
		c.rootStore.indexUserFromID(otherUser.Id)
	}
	return channel, err
}

func (c *SearchChannelStore) AutocompleteInTeam(teamId string, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	var channelList *model.ChannelList
	var err *model.AppError

	if c.rootStore.searchEngine.GetActiveEngine().IsAutocompletionEnabled() {
		channelList, err = c.esAutocompleteChannels(teamId, term, includeDeleted)
		if err != nil {
			mlog.Error("Encountered error on AutocompleteChannels through SearchEngine. Falling back to default autocompletion.", mlog.Err(err))
		}
	}

	if !c.rootStore.searchEngine.GetActiveEngine().IsAutocompletionEnabled() || err != nil {
		channelList, err = c.ChannelStore.AutocompleteInTeam(teamId, term, includeDeleted)
		if err != nil {
			return nil, err
		}
	}
	return channelList, err
}

func (c *SearchChannelStore) esAutocompleteChannels(teamId, term string, includeDeleted bool) (*model.ChannelList, *model.AppError) {
	channelIds, err := c.rootStore.searchEngine.GetActiveEngine().SearchChannels(teamId, term)
	if err != nil {
		return nil, err
	}

	channelList := model.ChannelList{}
	if len(channelIds) > 0 {
		channels, err := c.ChannelStore.GetChannelsByIds(channelIds)
		if err != nil {
			return nil, err
		}
		for _, ch := range channels {
			if ch.DeleteAt > 0 && !includeDeleted {
				continue
			}
			channelList = append(channelList, ch)
		}
	}

	return &channelList, nil
}

func (c *SearchChannelStore) PermanentDeleteMembersByChannel(channelId string) *model.AppError {
	err := c.ChannelStore.PermanentDeleteMembersByChannel(channelId)

	if c.rootStore.searchEngine.GetActiveEngine().IsIndexingEnabled() && err == nil {
		go (func() {
			profiles, err := c.rootStore.User().GetAllProfilesInChannel(channelId, false)
			if err != nil {
				mlog.Error("Encountered error indexing users for channel", mlog.String("channel_id", channelId), mlog.Err(err))
				return
			}
			for _, user := range profiles {
				c.rootStore.indexUser(user)
			}
		})()
	}
	return err
}

func (c *SearchChannelStore) PermanentDelete(channelId string) *model.AppError {
	channel, channelErr := c.ChannelStore.Get(channelId, true)
	if channelErr != nil {
		mlog.Error("Encountered error deleting channel", mlog.String("channel_id", channelId), mlog.Err(channelErr))
	}
	err := c.ChannelStore.PermanentDelete(channelId)
	if c.rootStore.searchEngine.GetActiveEngine().IsIndexingEnabled() && err == nil && channelErr == nil {
		if channel.Type == model.CHANNEL_OPEN {
			go (func() {
				if err := c.rootStore.searchEngine.GetActiveEngine().DeleteChannel(channel); err != nil {
					mlog.Error("Encountered error deleting channel", mlog.String("channel_id", channel.Id), mlog.Err(err))
				}
			})()
		}
	}
	return err
}
