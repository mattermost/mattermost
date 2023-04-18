// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/remotecluster"

	"github.com/mattermost/mattermost-server/server/v8/model"
)

func (a *App) AddRemoteCluster(rc *model.RemoteCluster) (*model.RemoteCluster, *model.AppError) {
	rc, err := a.Srv().Store().RemoteCluster().Save(rc)
	if err != nil {
		if sqlstore.IsUniqueConstraintError(errors.Cause(err), []string{sqlstore.RemoteClusterSiteURLUniqueIndex}) {
			return nil, model.NewAppError("AddRemoteCluster", "api.remote_cluster.save_not_unique.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		return nil, model.NewAppError("AddRemoteCluster", "api.remote_cluster.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return rc, nil
}

func (a *App) UpdateRemoteCluster(rc *model.RemoteCluster) (*model.RemoteCluster, *model.AppError) {
	rc, err := a.Srv().Store().RemoteCluster().Update(rc)
	if err != nil {
		if sqlstore.IsUniqueConstraintError(errors.Cause(err), []string{sqlstore.RemoteClusterSiteURLUniqueIndex}) {
			return nil, model.NewAppError("UpdateRemoteCluster", "api.remote_cluster.update_not_unique.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		return nil, model.NewAppError("UpdateRemoteCluster", "api.remote_cluster.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return rc, nil
}

func (a *App) DeleteRemoteCluster(remoteClusterId string) (bool, *model.AppError) {
	deleted, err := a.Srv().Store().RemoteCluster().Delete(remoteClusterId)
	if err != nil {
		return false, model.NewAppError("DeleteRemoteCluster", "api.remote_cluster.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return deleted, nil
}

func (a *App) GetRemoteCluster(remoteClusterId string) (*model.RemoteCluster, *model.AppError) {
	rc, err := a.Srv().Store().RemoteCluster().Get(remoteClusterId)
	if err != nil {
		return nil, model.NewAppError("GetRemoteCluster", "api.remote_cluster.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return rc, nil
}

func (a *App) GetAllRemoteClusters(filter model.RemoteClusterQueryFilter) ([]*model.RemoteCluster, *model.AppError) {
	list, err := a.Srv().Store().RemoteCluster().GetAll(filter)
	if err != nil {
		return nil, model.NewAppError("GetAllRemoteClusters", "api.remote_cluster.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, nil
}

func (a *App) UpdateRemoteClusterTopics(remoteClusterId string, topics string) (*model.RemoteCluster, *model.AppError) {
	rc, err := a.Srv().Store().RemoteCluster().UpdateTopics(remoteClusterId, topics)
	if err != nil {
		return nil, model.NewAppError("UpdateRemoteClusterTopics", "api.remote_cluster.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return rc, nil
}

func (a *App) SetRemoteClusterLastPingAt(remoteClusterId string) *model.AppError {
	err := a.Srv().Store().RemoteCluster().SetLastPingAt(remoteClusterId)
	if err != nil {
		return model.NewAppError("SetRemoteClusterLastPingAt", "api.remote_cluster.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (a *App) GetRemoteClusterService() (remotecluster.RemoteClusterServiceIFace, *model.AppError) {
	service := a.Srv().GetRemoteClusterService()
	if service == nil {
		return nil, model.NewAppError("GetRemoteClusterService", "api.remote_cluster.service_not_enabled.app_error", nil, "", http.StatusNotImplemented)
	}
	return service, nil
}
