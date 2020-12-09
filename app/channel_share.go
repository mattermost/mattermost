// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func (a *App) checkChannelNotShared(channelId string) error {
	// check that channel exists.
	if _, err := a.GetChannel(channelId); err != nil {
		return fmt.Errorf("cannot share this channel: %w", err)
	}

	// Check channel is not already shared.
	if _, err := a.GetSharedChannel(channelId); err == nil {
		var errNotFound *store.ErrNotFound
		if errors.As(err, &errNotFound) {
			return errors.New("channel is already shared.")
		}
		return fmt.Errorf("cannot find channel: %w", err)
	}
	return nil
}

func (a *App) checkChannelIsShared(channelId string) error {
	if _, err := a.GetSharedChannel(channelId); err != nil {
		var errNotFound *store.ErrNotFound
		if errors.As(err, &errNotFound) {
			return errors.New("channel is not shared.")
		}
		return fmt.Errorf("cannot find channel: %w", err)
	}
	return nil
}

// SharedChannels

func (a *App) SaveSharedChannel(sc *model.SharedChannel) (*model.SharedChannel, error) {
	if err := a.checkChannelNotShared(sc.ChannelId); err != nil {
		return nil, err
	}
	return a.Srv().Store.Channel().SaveSharedChannel(sc)
}

func (a *App) GetSharedChannel(channelId string) (*model.SharedChannel, error) {
	return a.Srv().Store.Channel().GetSharedChannel(channelId)
}

func (a *App) GetSharedChannels(page int, perPage int, opts store.SharedChannelFilterOpts) ([]*model.SharedChannel, error) {
	return a.Srv().Store.Channel().GetSharedChannels(page*perPage, perPage, opts)
}

func (a *App) GetSharedChannelsCount(opts store.SharedChannelFilterOpts) (int64, error) {
	return a.Srv().Store.Channel().GetSharedChannelsCount(opts)
}

func (a *App) UpdateSharedChannel(sc *model.SharedChannel) (*model.SharedChannel, error) {
	return a.Srv().Store.Channel().UpdateSharedChannel(sc)
}

func (a *App) DeleteSharedChannel(channelId string) (bool, error) {
	return a.Srv().Store.Channel().DeleteSharedChannel(channelId)
}

// SharedChannelRemotes

func (a *App) SaveSharedChannelRemote(remote *model.SharedChannelRemote) (*model.SharedChannelRemote, error) {
	if err := a.checkChannelIsShared(remote.ChannelId); err != nil {
		return nil, err
	}
	return a.Srv().Store.Channel().SaveSharedChannelRemote(remote)
}

func (a *App) GetSharedChannelRemote(remoteId string) (*model.SharedChannelRemote, error) {
	return a.Srv().Store.Channel().GetSharedChannelRemote(remoteId)
}

func (a *App) GetSharedChannelRemotes(channelId string) ([]*model.SharedChannelRemote, error) {
	return a.Srv().Store.Channel().GetSharedChannelRemotes(channelId)
}

func (a *App) DeleteSharedChannelRemote(remoteId string) (bool, error) {
	return a.Srv().Store.Channel().DeleteSharedChannelRemote(remoteId)
}

func (a *App) GetSharedChannelRemotesStatus(channelId string) ([]*model.SharedChannelRemoteStatus, error) {
	if err := a.checkChannelIsShared(channelId); err != nil {
		return nil, err
	}
	return a.Srv().Store.Channel().GetSharedChannelRemotesStatus(channelId)
}
