// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/pkg/errors"
)

func (p *HelpersImpl) EnsureChannel(channel *model.Channel) (retChannelId string, retErr error) {
	// Must provide a channel with a name and teadId
	if channel == nil || len(channel.Name) < 1 || len(channel.TeamId) < 1 {
		return "", errors.New("passed a bad channel, nil or no name or no team id")
	}

	// If we fail for any reason, this could be a race between creation of channel and
	// retrieval from another EnsureChannel. Just try the basic retrieve existing again.
	defer func() {
		if retChannelId == "" || retErr != nil {
			var err error
			var channelIdBytes []byte

			err = utils.ProgressiveRetry(func() error {
				channelIdBytes, err = p.API.KVGet(CHANNEL_KEY)
				if err != nil {
					return err
				}
				return nil
			})

			if err == nil && channelIdBytes != nil {
				retChannelId = string(channelIdBytes)
				retErr = nil
			}
		}
	}()

	// Fetch channel ID from key value store
	channelIdBytes, kvGetErr := p.API.KVGet(CHANNEL_KEY)
	if kvGetErr != nil {
		// Failed to retrive the value of channel
		return "", errors.Wrap(kvGetErr, "failed to get channel ID")
	}

	var existingChannel *model.Channel
	var channelGetErr *model.AppError

	// If channel ID exists, get existing channel by ID else get it by Name
	if channelIdBytes != nil {
		existingChannel, channelGetErr = p.API.GetChannel(string(channelIdBytes))
		if channelGetErr != nil {
			return "", errors.Wrap(channelGetErr, "failed to get channel by ID")
		}
	} else {
		existingChannel, channelGetErr = p.API.GetChannelByName(channel.TeamId, channel.Name, false)
		if channelGetErr != nil {
			return "", errors.Wrap(channelGetErr, "failed to get channel by name")
		}
	}

	// If channel exists, update the metadata
	if existingChannel != nil {
		return updateChannel(p, existingChannel, channel)
	}

	// Create a new channel
	createdChannel, createChannelErr := p.API.CreateChannel(channel)
	if createChannelErr != nil {
		return "", errors.Wrap(createChannelErr, "failed to create channel")
	}

	// Set the new channel id in key value store
	if kvSetErr := p.API.KVSet(CHANNEL_KEY, []byte(createdChannel.Id)); kvSetErr != nil {
		p.API.LogWarn("Failed to set created channel id.", "channelid", createdChannel.Id, "err", kvSetErr)
	}

	return createdChannel.Id, nil
}

func updateChannel(p *HelpersImpl, existing *model.Channel, new *model.Channel) (string, error) {
	// Update metadata of the channel
	if updateErr := updateChannelMeta(existing, new); updateErr != nil {
		return "", errors.Wrap(updateErr, "Failed to update the metadata of existing channel")
	}

	// Send the updates to API
	updatedChannel, channelUpdateErr := p.API.UpdateChannel(existing)
	if channelUpdateErr != nil {
		return "", errors.Wrap(channelUpdateErr, "Failed to update the existing channel")
	}

	// Channel exists!
	return updatedChannel.Id, nil
}

func updateChannelMeta(existing *model.Channel, new *model.Channel) error {
	// Check if channels are of different types
	if existing.Type != new.Type {
		return errors.New("Channel type cannot be updated")
	}

	// Update metadata of channel
	existing.Name = new.Name
	existing.DisplayName = new.DisplayName
	existing.Purpose = new.Purpose
	existing.Header = new.Header

	return nil
}
