// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (ps *PlatformService) StartSearchEngine() (string, string) {
	if ps.SearchEngine.ElasticsearchEngine != nil && ps.SearchEngine.ElasticsearchEngine.IsActive() {
		ps.Go(func() {
			if err := ps.SearchEngine.ElasticsearchEngine.Start(); err != nil {
				ps.Log().Error(err.Error())
			}
		})
	}

	configListenerId := ps.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
		if ps.SearchEngine == nil {
			return
		}
		ps.SearchEngine.UpdateConfig(newConfig)

		if ps.SearchEngine.ElasticsearchEngine != nil && !*oldConfig.ElasticsearchSettings.EnableIndexing && *newConfig.ElasticsearchSettings.EnableIndexing {
			ps.Go(func() {
				if err := ps.SearchEngine.ElasticsearchEngine.Start(); err != nil {
					mlog.Error(err.Error())
				}
			})
		} else if ps.SearchEngine.ElasticsearchEngine != nil && *oldConfig.ElasticsearchSettings.EnableIndexing && !*newConfig.ElasticsearchSettings.EnableIndexing {
			ps.Go(func() {
				if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
					mlog.Error(err.Error())
				}
			})
		} else if ps.SearchEngine.ElasticsearchEngine != nil && *oldConfig.ElasticsearchSettings.Password != *newConfig.ElasticsearchSettings.Password || *oldConfig.ElasticsearchSettings.Username != *newConfig.ElasticsearchSettings.Username || *oldConfig.ElasticsearchSettings.ConnectionURL != *newConfig.ElasticsearchSettings.ConnectionURL || *oldConfig.ElasticsearchSettings.Sniff != *newConfig.ElasticsearchSettings.Sniff {
			ps.Go(func() {
				if *oldConfig.ElasticsearchSettings.EnableIndexing {
					if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
						mlog.Error(err.Error())
					}
					if err := ps.SearchEngine.ElasticsearchEngine.Start(); err != nil {
						mlog.Error(err.Error())
					}
				}
			})
		}
	})

	licenseListenerId := ps.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		if ps.SearchEngine == nil {
			return
		}
		if oldLicense == nil && newLicense != nil {
			if ps.SearchEngine.ElasticsearchEngine != nil && ps.SearchEngine.ElasticsearchEngine.IsActive() {
				ps.Go(func() {
					if err := ps.SearchEngine.ElasticsearchEngine.Start(); err != nil {
						mlog.Error(err.Error())
					}
				})
			}
		} else if oldLicense != nil && newLicense == nil {
			if ps.SearchEngine.ElasticsearchEngine != nil {
				ps.Go(func() {
					if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
						mlog.Error(err.Error())
					}
				})
			}
		}
	})

	return configListenerId, licenseListenerId
}

func (ps *PlatformService) StopSearchEngine() {
	ps.RemoveConfigListener(ps.searchConfigListenerId)
	ps.RemoveLicenseListener(ps.searchLicenseListenerId)
	if ps.SearchEngine != nil && ps.SearchEngine.ElasticsearchEngine != nil && ps.SearchEngine.ElasticsearchEngine.IsActive() {
		ps.SearchEngine.ElasticsearchEngine.Stop()
	}
	if ps.SearchEngine != nil && ps.SearchEngine.BleveEngine != nil && ps.SearchEngine.BleveEngine.IsActive() {
		ps.SearchEngine.BleveEngine.Stop()
	}
}
