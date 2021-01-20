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
	return a.Srv().Store.SharedChannel().Save(sc)
}

func (a *App) GetSharedChannel(channelId string) (*model.SharedChannel, error) {
	return a.Srv().Store.SharedChannel().Get(channelId)
}

func (a *App) GetSharedChannels(page int, perPage int, opts store.SharedChannelFilterOpts) ([]*model.SharedChannel, error) {
	return a.Srv().Store.SharedChannel().GetAll(page*perPage, perPage, opts)
}

func (a *App) GetSharedChannelsCount(opts store.SharedChannelFilterOpts) (int64, error) {
	return a.Srv().Store.SharedChannel().GetAllCount(opts)
}

func (a *App) UpdateSharedChannel(sc *model.SharedChannel) (*model.SharedChannel, error) {
	return a.Srv().Store.SharedChannel().Update(sc)
}

func (a *App) DeleteSharedChannel(channelId string) (bool, error) {
	return a.Srv().Store.SharedChannel().Delete(channelId)
}

// SharedChannelRemotes

func (a *App) SaveSharedChannelRemote(remote *model.SharedChannelRemote) (*model.SharedChannelRemote, error) {
	if err := a.checkChannelIsShared(remote.ChannelId); err != nil {
		return nil, err
	}
	return a.Srv().Store.SharedChannel().SaveRemote(remote)
}

func (a *App) GetSharedChannelRemote(id string) (*model.SharedChannelRemote, error) {
	return a.Srv().Store.SharedChannel().GetRemote(id)
}

func (a *App) GetSharedChannelRemoteByIds(channelId string, remoteId string) (*model.SharedChannelRemote, error) {
	return a.Srv().Store.SharedChannel().GetRemoteByIds(channelId, remoteId)
}

func (a *App) GetSharedChannelRemotes(channelId string) ([]*model.SharedChannelRemote, error) {
	return a.Srv().Store.SharedChannel().GetRemotes(channelId)
}

// HasRemote returns whether a given channelID is present in the channel remotes or not.
func (a *App) HasRemote(channelID string) (bool, error) {
	return a.Srv().Store.SharedChannel().HasRemote(channelID)
}

func (a *App) UpdateSharedChannelRemoteLastSyncAt(id string, syncTime int64) error {
	return a.Srv().Store.SharedChannel().UpdateRemoteLastSyncAt(id, syncTime)
}

func (a *App) DeleteSharedChannelRemote(id string) (bool, error) {
	return a.Srv().Store.SharedChannel().DeleteRemote(id)
}

func (a *App) GetSharedChannelRemotesStatus(channelId string) ([]*model.SharedChannelRemoteStatus, error) {
	if err := a.checkChannelIsShared(channelId); err != nil {
		return nil, err
	}
	return a.Srv().Store.SharedChannel().GetRemotesStatus(channelId)
}
