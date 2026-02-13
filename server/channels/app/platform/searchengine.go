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

		startingES := ps.SearchEngine.ElasticsearchEngine != nil && !model.SafeDereference(oldConfig.ElasticsearchSettings.EnableIndexing) && model.SafeDereference(newConfig.ElasticsearchSettings.EnableIndexing)
		stoppingES := ps.SearchEngine.ElasticsearchEngine != nil && model.SafeDereference(oldConfig.ElasticsearchSettings.EnableIndexing) && !model.SafeDereference(newConfig.ElasticsearchSettings.EnableIndexing)
		connectionChanged := ps.SearchEngine.ElasticsearchEngine != nil &&
			(model.SafeDereference(oldConfig.ElasticsearchSettings.ConnectionURL) != model.SafeDereference(newConfig.ElasticsearchSettings.ConnectionURL) ||
				model.SafeDereference(oldConfig.ElasticsearchSettings.Username) != model.SafeDereference(newConfig.ElasticsearchSettings.Username) ||
				model.SafeDereference(oldConfig.ElasticsearchSettings.Password) != model.SafeDereference(newConfig.ElasticsearchSettings.Password) ||
				model.SafeDereference(oldConfig.ElasticsearchSettings.Sniff) != model.SafeDereference(newConfig.ElasticsearchSettings.Sniff))
		startingBackfill := !model.SafeDereference(oldConfig.ElasticsearchSettings.EnableSearchPublicChannelsWithoutMembership) &&
			model.SafeDereference(newConfig.ElasticsearchSettings.EnableSearchPublicChannelsWithoutMembership)

		if startingES {
			ps.Go(func() {
				if err := ps.SearchEngine.ElasticsearchEngine.Start(); err != nil {
					ps.Log().Error(err.Error())
					return
				}
				// If backfill was also enabled in this same config save, run it now that ES is started.
				if startingBackfill {
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
				if model.SafeDereference(oldConfig.ElasticsearchSettings.EnableIndexing) {
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
