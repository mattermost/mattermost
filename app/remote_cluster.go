// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

func (a *App) AddRemoteCluster(rc *model.RemoteCluster) (*model.RemoteCluster, error) {
	return a.Srv().Store.RemoteCluster().Save(rc)
}

func (a *App) DeleteRemoteCluster(remoteClusterId string) (bool, error) {
	return a.Srv().Store.RemoteCluster().Delete(remoteClusterId)
}

func (a *App) GetRemoteCluster(remoteClusterId string) (*model.RemoteCluster, error) {
	return a.Srv().Store.RemoteCluster().Get(remoteClusterId)
}

func (a *App) GetAllRemoteClusters(includeOffline bool) ([]*model.RemoteCluster, error) {
	return a.Srv().Store.RemoteCluster().GetAll(includeOffline)
}

func (a *App) GetAllRemoteClustersNotInChannel(channelId string, includeOffline bool) ([]*model.RemoteCluster, error) {
	return a.Srv().Store.RemoteCluster().GetAllNotInChannel(channelId, includeOffline)
}

func (a *App) SetRemoteClusterLastPingAt(remoteClusterId string) error {
	return a.Srv().Store.RemoteCluster().SetLastPingAt(remoteClusterId)
}
