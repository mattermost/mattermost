// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (ps *PlatformService) StartSearchEngine() (string, string) {
	if ps.SearchEngine.ElasticsearchEngine != nil && ps.SearchEngine.ElasticsearchEngine.IsEnabled() {
		ps.Go(func() {
			if err := ps.SearchEngine.ElasticsearchEngine.Start(); err != nil {
				ps.Log().Error(err.Error())
				return
			}
			if model.SafeDereference(ps.Config().ElasticsearchSettings.EnableSearchPublicChannelsWithoutMembership) {
				ps.backfillPostsChannelType(ps.SearchEngine.ElasticsearchEngine)
			}
		})
	}

	configListenerId := ps.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
		if ps.SearchEngine == nil {
			return
		}

		if err := ps.SearchEngine.UpdateConfig(newConfig); err != nil {
			ps.Log().Error("Failed to update search engine config", mlog.Err(err))
		}

		oldESCfg := oldConfig.ElasticsearchSettings
		newESCfg := newConfig.ElasticsearchSettings
		startingES := ps.SearchEngine.ElasticsearchEngine != nil &&
			!model.SafeDereference(oldESCfg.EnableIndexing) &&
			model.SafeDereference(newESCfg.EnableIndexing)
		stoppingES := ps.SearchEngine.ElasticsearchEngine != nil &&
			model.SafeDereference(oldESCfg.EnableIndexing) &&
			!model.SafeDereference(newESCfg.EnableIndexing)
		connectionChanged := ps.SearchEngine.ElasticsearchEngine != nil &&
			(model.SafeDereference(oldESCfg.ConnectionURL) != model.SafeDereference(newESCfg.ConnectionURL) ||
				model.SafeDereference(oldESCfg.Username) != model.SafeDereference(newESCfg.Username) ||
				model.SafeDereference(oldESCfg.Password) != model.SafeDereference(newESCfg.Password) ||
				model.SafeDereference(oldESCfg.Sniff) != model.SafeDereference(newESCfg.Sniff))
		startingBackfill := !model.SafeDereference(oldESCfg.EnableSearchPublicChannelsWithoutMembership) &&
			model.SafeDereference(newESCfg.EnableSearchPublicChannelsWithoutMembership)

		if startingES {
			ps.Go(func() {
				if err := ps.SearchEngine.ElasticsearchEngine.Start(); err != nil {
					ps.Log().Error(err.Error())
					return
				}
				if model.SafeDereference(newESCfg.EnableSearchPublicChannelsWithoutMembership) {
					ps.backfillPostsChannelType(ps.SearchEngine.ElasticsearchEngine)
				}
			})
		} else if stoppingES {
			ps.Go(func() {
				if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
					ps.Log().Error(err.Error())
				}
			})
		} else if connectionChanged {
			ps.Go(func() {
				if model.SafeDereference(oldESCfg.EnableIndexing) {
					if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
						ps.Log().Error(err.Error())
					}
					if err := ps.SearchEngine.ElasticsearchEngine.Start(); err != nil {
						ps.Log().Error(err.Error())
					}
				}
			})
		}

		// Backfill was enabled but ES was already running (not starting fresh).
		if startingBackfill && !startingES {
			ps.Go(func() {
				engine := ps.SearchEngine.ElasticsearchEngine
				if engine == nil || !engine.IsActive() || !engine.IsIndexingEnabled() {
					ps.Log().Warn("Elasticsearch not available for channel_type backfill")
					return
				}
				ps.backfillPostsChannelType(engine)
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
						ps.Log().Error(err.Error())
					}
				})
			}
		} else if oldLicense != nil && newLicense == nil {
			if ps.SearchEngine.ElasticsearchEngine != nil {
				ps.Go(func() {
					if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
						ps.Log().Error(err.Error())
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
		if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
			ps.Log().Error("Failed to stop Elasticsearch engine", mlog.Err(err))
		}
	}
}
