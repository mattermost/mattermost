// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/url"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func (a *App) initElasticsearchChannelIndexCheck() {
	// the logic of when to perform the check has been derived from platform/searchengine.StartSearchEngine()
	// Wherever we're starting the engine, we're checking the index mapping here.

	a.elasticsearchChannelIndexCheckWithRetry()

	a.AddConfigListener(func(oldConfig, newConfig *model.Config) {
		if a.SearchEngine().ElasticsearchEngine == nil {
			return
		}

		oldESConfig := oldConfig.ElasticsearchSettings
		newESConfig := newConfig.ElasticsearchSettings

		// if indexing is turned on, check.
		if !*oldESConfig.EnableIndexing && *newESConfig.EnableIndexing {
			a.elasticsearchChannelIndexCheckWithRetry()
		} else if *newESConfig.EnableIndexing && (*oldESConfig.Password != *newESConfig.Password || *oldESConfig.Username != *newESConfig.Username || *oldESConfig.ConnectionURL != *newESConfig.ConnectionURL || *oldESConfig.Sniff != *newESConfig.Sniff) {
			// ES client reconnects if credentials or address changes
			a.elasticsearchChannelIndexCheckWithRetry()
		}
	})

	a.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		if a.SearchEngine() == nil {
			return
		}

		// if a license was added, and it has ES enabled-
		if oldLicense == nil && newLicense != nil {
			if a.SearchEngine().ElasticsearchEngine != nil {
				a.elasticsearchChannelIndexCheckWithRetry()
			}
		}
	})
}

func (a *App) elasticsearchChannelIndexCheckWithRetry() {
	// this is being done async to not block license application and config
	// processes as the listeners for those are called synchronously.
	go func() {
		// using progressive retry because ES client may take some time to connect and be ready.
		_ = utils.LongProgressiveRetry(func() error {
			if !*a.Config().ElasticsearchSettings.EnableIndexing {
				a.Log().Debug("elasticsearchChannelIndexCheckWithRetry: skipping because elasticsearch indexing is disabled")
				return nil
			}

			elastic := a.SearchEngine().ElasticsearchEngine
			if elastic == nil {
				a.Log().Debug("elasticsearchChannelIndexCheckWithRetry: skipping because elastic engine is nil")
				return errors.New("retry")
			}

			if !elastic.IsActive() {
				a.Log().Debug("elasticsearchChannelIndexCheckWithRetry: skipping because elastic.IsActive is false")
				return errors.New("retry")
			}

			a.elasticsearchChannelIndexCheck()
			return nil
		})
	}()
}

func (a *App) elasticsearchChannelIndexCheck() {
	if needNotify := a.elasticChannelsIndexNeedNotifyAdmins(); !needNotify {
		return
	}

	// notify all system admins
	systemBot, appErr := a.GetSystemBot(request.EmptyContext(a.Log()))
	if appErr != nil {
		a.Log().Error("elasticsearchChannelIndexCheck: couldn't get system bot", mlog.Err(appErr))
		return
	}

	sysAdmins, appErr := a.getAllSystemAdmins()
	if appErr != nil {
		a.Log().Error("elasticsearchChannelIndexCheck: error occurred fetching all system admins", mlog.Err(appErr))
	}

	elasticsearchSettingsSectionLink, err := url.JoinPath(*a.Config().ServiceSettings.SiteURL, "admin_console/environment/elasticsearch")
	if err != nil {
		a.Log().Error("elasticsearchChannelIndexCheck: error occurred constructing Elasticsearch system console section path")
		return
	}

	// TODO include a link to changelog
	postMessage := i18n.T("app.channel.elasticsearch_channel_index.notify_admin.message", map[string]interface{}{"ElasticsearchSection": elasticsearchSettingsSectionLink})

	for _, sysAdmin := range sysAdmins {
		var channel *model.Channel
		channel, appErr = a.GetOrCreateDirectChannel(request.EmptyContext(a.Log()), sysAdmin.Id, systemBot.UserId)
		if appErr != nil {
			a.Log().Error("elasticsearchChannelIndexCheck: error occurred ensuring DM channel between system bot and sys admin", mlog.Err(appErr))
			continue
		}

		post := &model.Post{
			Message:   postMessage,
			UserId:    systemBot.UserId,
			ChannelId: channel.Id,
		}
		_, appErr = a.CreatePost(request.EmptyContext(a.Log()), post, channel, true, false)
		if appErr != nil {
			a.Log().Error("elasticsearchChannelIndexCheck: error occurred creating post", mlog.Err(appErr))
			continue
		}
	}
}

func (a *App) elasticChannelsIndexNeedNotifyAdmins() bool {
	elastic := a.SearchEngine().ElasticsearchEngine
	if elastic == nil {
		a.Log().Debug("elasticChannelsIndexNeedNotifyAdmins: skipping because elastic engine is nil")
		return false
	}

	if elastic.IsChannelsIndexVerified() {
		a.Log().Debug("elasticChannelsIndexNeedNotifyAdmins: skipping because channels index is verified")
		return false
	}

	return true
}
