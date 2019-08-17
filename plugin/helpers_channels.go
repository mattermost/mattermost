// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/pkg/errors"
)

func (p *HelpersImpl) EnsureChannel(channel *model.Channel) (retChanId string, retErr error) {
	// Must provide a channel with a name and teadId
	if channel == nil || len(channel.Name) < 1 || len(channel.TeamId) < 1 {
		return "", errors.New("passed a bad channel, nil or no name or no team id")
	}

	// If we fail for any reason, this could be a race between creation of channel and
	// retrieval from another EnsureChannel. Just try the basic retrieve existing again.
	defer func() {
		if retChanId == "" || retErr != nil {
			var err error
			var chanIdBytes []byte

			err = utils.ProgressiveRetry(func() error {
				chanIdBytes, err = p.API.KVGet(CHANNEL_KEY)
				if err != nil {
					return err
				}
				return nil
			})

			if err == nil && chanIdBytes != nil {
				retChanId = string(chanIdBytes)
				retErr = nil
			}
		}
	}()

	// Fetch channel ID from key value store
	chanIdBytes, kvGetErr := p.API.KVGet(CHANNEL_KEY)
	if kvGetErr != nil {
		// Failed to retrive the value of channel
		return "", errors.Wrap(kvGetErr, "failed to get channel")
	}

	// Check if Channel ID exists
	if chanIdBytes != nil {
		chanId := string(chanIdBytes)
		return chanId, nil
	}

	// Check if channel already exists (ignore deleted channels)
	if existingChannel, chanGetErr := p.API.GetChannelByName(channel.TeamId, channel.Name, false); chanGetErr != nil && existingChannel != nil {
		// Update metadata of the channel
		if updateErr := updateChannelMeta(existingChannel, channel); updateErr != nil {
			return "", errors.Wrap(updateErr, "Failed to update the metadata of existing channel")
		}

		// Send the updates to API
		updatedChannel, chanUpdateErr := p.API.UpdateChannel(existingChannel)
		if chanUpdateErr != nil {
			return "", errors.Wrap(chanUpdateErr, "Failed to update the existing channel")
		}

		// Channel exists!
		return updatedChannel.Id, nil
	}

	// Create a new channel
	createdChannel, createChanErr := p.API.CreateChannel(channel)
	if createChanErr != nil {
		return "", errors.Wrap(createChanErr, "failed to create channel")
	}

	// Set the new channel id in key value store
	if kvSetErr := p.API.KVSet(CHANNEL_KEY, []byte(createdChannel.Id)); kvSetErr != nil {
		p.API.LogWarn("Failed to set created channel id.", "channelid", createdChannel.Id, "err", kvSetErr)
	}

	return createdChannel.Id, nil
}

func updateChannelMeta(existing *model.Channel, new *model.Channel) error {
	// Check if channels are of different types
	if existing.Type != new.Type {
		return errors.New("Channel type cannot be updated")
	}

	// Update metadata of channel if present
	if new.Name != "" {
		existing.Name = new.Name
	}
	if new.DisplayName != "" {
		existing.DisplayName = new.DisplayName
	}
	if new.Purpose != "" {
		existing.Purpose = new.Purpose
	}
	if new.Header != "" {
		existing.Header = new.Header
	}

	return nil
}
