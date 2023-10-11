// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	DiscoveryServiceWritePing = 60 * time.Second
)

type ClusterDiscoveryService struct {
	model.ClusterDiscovery
	platform *PlatformService
	stop     chan bool
}

func (cds *ClusterDiscoveryService) Start() {
	err := cds.platform.Store.ClusterDiscovery().Cleanup()
	if err != nil {
		mlog.Warn("ClusterDiscoveryService failed to cleanup the outdated cluster discovery information", mlog.Err(err))
	}

	exists, err := cds.platform.Store.ClusterDiscovery().Exists(&cds.ClusterDiscovery)
	if err != nil {
		mlog.Warn("ClusterDiscoveryService failed to check if row exists", mlog.String("ClusterDiscoveryID", cds.ClusterDiscovery.Id), mlog.Err(err))
	} else if exists {
		if _, err := cds.platform.Store.ClusterDiscovery().Delete(&cds.ClusterDiscovery); err != nil {
			mlog.Warn("ClusterDiscoveryService failed to start clean", mlog.String("ClusterDiscoveryID", cds.ClusterDiscovery.Id), mlog.Err(err))
		}
	}

	if err := cds.platform.Store.ClusterDiscovery().Save(&cds.ClusterDiscovery); err != nil {
		mlog.Error("ClusterDiscoveryService failed to save", mlog.String("ClusterDiscoveryID", cds.ClusterDiscovery.Id), mlog.Err(err))
		return
	}

	go func() {
		mlog.Debug("ClusterDiscoveryService ping writer started", mlog.String("ClusterDiscoveryID", cds.ClusterDiscovery.Id))
		ticker := time.NewTicker(DiscoveryServiceWritePing)
		defer func() {
			ticker.Stop()
			if _, err := cds.platform.Store.ClusterDiscovery().Delete(&cds.ClusterDiscovery); err != nil {
				mlog.Warn("ClusterDiscoveryService failed to cleanup", mlog.String("ClusterDiscoveryID", cds.ClusterDiscovery.Id), mlog.Err(err))
			}
			mlog.Debug("ClusterDiscoveryService ping writer stopped", mlog.String("ClusterDiscoveryID", cds.ClusterDiscovery.Id))
		}()

		for {
			select {
			case <-ticker.C:
				if err := cds.platform.Store.ClusterDiscovery().SetLastPingAt(&cds.ClusterDiscovery); err != nil {
					mlog.Error("ClusterDiscoveryService failed to write ping", mlog.String("ClusterDiscoveryID", cds.ClusterDiscovery.Id), mlog.Err(err))
				}
			case <-cds.stop:
				return
			}
		}
	}()
}

func (cds *ClusterDiscoveryService) Stop() {
	cds.stop <- true
}

func (ps *PlatformService) GetClusterId() string {
	if ps.Cluster() == nil {
		return ""
	}

	return ps.Cluster().GetClusterId()
}
