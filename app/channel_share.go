// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

// SharedChannels

func (a *App) SaveSharedChannel(sc *model.SharedChannel) (*model.SharedChannel, error) {
	// Check channel is not already shared.
	if _, err := a.GetSharedChannel(sc.ChannelId); err == nil {
		return nil, errors.New("channel is already shared.")
	}

	// check that channel exists.
	if _, errApp := a.GetChannel(sc.ChannelId); errApp != nil {
		return nil, fmt.Errorf("Cannot share this channel: %v", errApp)
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
	// Check channel is shared.
	if _, err := a.GetSharedChannel(remote.ChannelId); err != nil {
		return nil, errors.New("channel is not shared.")
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
	// Check channel is shared.
	if _, err := a.GetSharedChannel(channelId); err != nil {
		return nil, errors.New("channel is not shared.")
	}
	return a.Srv().Store.Channel().GetSharedChannelRemotesStatus(channelId)
}
