// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

const (
	DISCOVERY_SERVICE_WRITE_PING = 60 * time.Second
)

type ClusterDiscoveryService struct {
	model.ClusterDiscovery
	app  *App
	stop chan bool
}

func (a *App) NewClusterDiscoveryService() *ClusterDiscoveryService {
	ds := &ClusterDiscoveryService{
		ClusterDiscovery: model.ClusterDiscovery{},
		app:              a,
		stop:             make(chan bool),
	}

	return ds
}

func (me *ClusterDiscoveryService) Start() {
	err := me.app.Srv.Store.ClusterDiscovery().Cleanup()
	if err != nil {
		mlog.Error(fmt.Sprintf("ClusterDiscoveryService failed to cleanup the outdated cluster discovery information err=%v", err))
	}

	exists, err := me.app.Srv.Store.ClusterDiscovery().Exists(&me.ClusterDiscovery)
	if err != nil {
		mlog.Error(fmt.Sprintf("ClusterDiscoveryService failed to check if row exists for %v with err=%v", me.ClusterDiscovery.ToJson(), err))
	} else {
		if exists {
			if _, err := me.app.Srv.Store.ClusterDiscovery().Delete(&me.ClusterDiscovery); err != nil {
				mlog.Error(fmt.Sprintf("ClusterDiscoveryService failed to start clean for %v with err=%v", me.ClusterDiscovery.ToJson(), err))
			}
		}
	}

	if err := me.app.Srv.Store.ClusterDiscovery().Save(&me.ClusterDiscovery); err != nil {
		mlog.Error(fmt.Sprintf("ClusterDiscoveryService failed to save for %v with err=%v", me.ClusterDiscovery.ToJson(), err))
		return
	}

	go func() {
		mlog.Debug(fmt.Sprintf("ClusterDiscoveryService ping writer started for %v", me.ClusterDiscovery.ToJson()))
		ticker := time.NewTicker(DISCOVERY_SERVICE_WRITE_PING)
		defer func() {
			ticker.Stop()
			if _, err := me.app.Srv.Store.ClusterDiscovery().Delete(&me.ClusterDiscovery); err != nil {
				mlog.Error(fmt.Sprintf("ClusterDiscoveryService failed to cleanup for %v with err=%v", me.ClusterDiscovery.ToJson(), err))
			}
			mlog.Debug(fmt.Sprintf("ClusterDiscoveryService ping writer stopped for %v", me.ClusterDiscovery.ToJson()))
		}()

		for {
			select {
			case <-ticker.C:
				if err := me.app.Srv.Store.ClusterDiscovery().SetLastPingAt(&me.ClusterDiscovery); err != nil {
					mlog.Error(fmt.Sprintf("ClusterDiscoveryService failed to write ping for %v with err=%v", me.ClusterDiscovery.ToJson(), err))
				}
			case <-me.stop:
				return
			}
		}
	}()
}

func (me *ClusterDiscoveryService) Stop() {
	me.stop <- true
}

func (a *App) IsLeader() bool {
	if a.License() != nil && *a.Config().ClusterSettings.Enable && a.Cluster != nil {
		return a.Cluster.IsLeader()
	}
	return true
}

func (a *App) GetClusterId() string {
	if a.Cluster == nil {
		return ""
	}

	return a.Cluster.GetClusterId()
}
