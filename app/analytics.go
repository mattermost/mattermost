// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"sync"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	DayMilliseconds   = 24 * 60 * 60 * 1000
	MonthMilliseconds = 31 * DayMilliseconds
)

func (a *App) GetAnalytics(name string, teamID string) (model.AnalyticsRows, *model.AppError) {
	skipIntensiveQueries := false
	var systemUserCount int64
	systemUserCount, err := a.Srv().Store.User().Count(model.UserCountOptions{})
	if err != nil {
		return nil, model.NewAppError("GetAnalytics", "app.user.get_total_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if systemUserCount > int64(*a.Config().AnalyticsSettings.MaxUsersForStatistics) {
		mlog.Debug("More than limit users are on the system, intensive queries skipped", mlog.Int("limit", *a.Config().AnalyticsSettings.MaxUsersForStatistics))
		skipIntensiveQueries = true
	}

	if name == "standard" {
		var rows model.AnalyticsRows = make([]*model.AnalyticsRow, 11)
		rows[0] = &model.AnalyticsRow{Name: "channel_open_count", Value: 0}
		rows[1] = &model.AnalyticsRow{Name: "channel_private_count", Value: 0}
		rows[2] = &model.AnalyticsRow{Name: "post_count", Value: 0}
		rows[3] = &model.AnalyticsRow{Name: "unique_user_count", Value: 0}
		rows[4] = &model.AnalyticsRow{Name: "team_count", Value: 0}
		rows[5] = &model.AnalyticsRow{Name: "total_websocket_connections", Value: 0}
		rows[6] = &model.AnalyticsRow{Name: "total_master_db_connections", Value: 0}
		rows[7] = &model.AnalyticsRow{Name: "total_read_db_connections", Value: 0}
		rows[8] = &model.AnalyticsRow{Name: "daily_active_users", Value: 0}
		rows[9] = &model.AnalyticsRow{Name: "monthly_active_users", Value: 0}
		rows[10] = &model.AnalyticsRow{Name: "inactive_user_count", Value: 0}

		var wg sync.WaitGroup
		var openChannelsCount int64
		var openChannelsCountErr error
		wg.Add(1)
		go func() {
			defer wg.Done()
			openChannelsCount, openChannelsCountErr = a.Srv().Store.Channel().AnalyticsTypeCount(teamID, model.CHANNEL_OPEN)
		}()

		var privateChannelsCount int64
		var privateChannelsCountErr error
		wg.Add(1)
		go func() {
			defer wg.Done()
			privateChannelsCount, privateChannelsCountErr = a.Srv().Store.Channel().AnalyticsTypeCount(teamID, model.CHANNEL_PRIVATE)
		}()

		var usersCount int64
		var usersCountErr error
		var inactiveUsersCount int64
		var inactiveUsersCountErr error
		if teamID == "" {
			wg.Add(1)
			go func() {
				defer wg.Done()
				inactiveUsersCount, inactiveUsersCountErr = a.Srv().Store.User().AnalyticsGetInactiveUsersCount()
			}()
		} else {
			wg.Add(1)
			go func() {
				defer wg.Done()
				usersCount, usersCountErr = a.Srv().Store.User().Count(model.UserCountOptions{TeamId: teamID})
			}()
		}

		var postsCount int64
		var postsCountErr error
		if !skipIntensiveQueries {
			wg.Add(1)
			go func() {
				defer wg.Done()
				postsCount, postsCountErr = a.Srv().Store.Post().AnalyticsPostCount(teamID, false, false)
			}()
		}

		var teamsCount int64
		var teamsCountErr error
		wg.Add(1)
		go func() {
			defer wg.Done()
			teamsCount, teamsCountErr = a.Srv().Store.Team().AnalyticsTeamCount(false)
		}()

		var dailyActiveUsersCount int64
		var dailyActiveUsersCountErr error
		wg.Add(1)
		go func() {
			defer wg.Done()
			dailyActiveUsersCount, dailyActiveUsersCountErr = a.Srv().Store.User().AnalyticsActiveCount(DayMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
		}()

		var monthlyActiveUsersCount int64
		var monthlyActiveUsersCountErr error
		wg.Add(1)
		go func() {
			defer wg.Done()
			monthlyActiveUsersCount, monthlyActiveUsersCountErr = a.Srv().Store.User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
		}()

		wg.Wait()

		if openChannelsCountErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.channel.analytics_type_count.app_error", nil, openChannelsCountErr.Error(), http.StatusInternalServerError)
		}
		rows[0].Value = float64(openChannelsCount)

		if privateChannelsCountErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.channel.analytics_type_count.app_error", nil, privateChannelsCountErr.Error(), http.StatusInternalServerError)
		}
		rows[1].Value = float64(privateChannelsCount)

		if skipIntensiveQueries {
			rows[2].Value = -1
		} else {
			if postsCountErr != nil {
				return nil, model.NewAppError("GetAnalytics", "app.post.analytics_posts_count.app_error", nil, postsCountErr.Error(), http.StatusInternalServerError)
			}
			rows[2].Value = float64(postsCount)
		}

		if teamID == "" {
			rows[3].Value = float64(systemUserCount)
			if inactiveUsersCountErr != nil {
				return nil, model.NewAppError("GetAnalytics", "app.user.analytics_get_inactive_users_count.app_error", nil, inactiveUsersCountErr.Error(), http.StatusInternalServerError)
			}
			rows[10].Value = float64(inactiveUsersCount)
		} else {
			rows[10].Value = -1
			if usersCountErr != nil {
				return nil, model.NewAppError("GetAnalytics", "app.user.get_total_users_count.app_error", nil, usersCountErr.Error(), http.StatusInternalServerError)
			}
			rows[3].Value = float64(usersCount)
		}

		if teamsCountErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.team.analytics_team_count.app_error", nil, teamsCountErr.Error(), http.StatusInternalServerError)
		}
		rows[4].Value = float64(teamsCount)

		// If in HA mode then aggregate all the stats
		if a.Cluster() != nil && *a.Config().ClusterSettings.Enable {
			stats, err2 := a.Cluster().GetClusterStats()
			if err2 != nil {
				return nil, err2
			}

			totalSockets := a.TotalWebsocketConnections()
			totalMasterDb := a.Srv().Store.TotalMasterDbConnections()
			totalReadDb := a.Srv().Store.TotalReadDbConnections()

			for _, stat := range stats {
				totalSockets = totalSockets + stat.TotalWebsocketConnections
				totalMasterDb = totalMasterDb + stat.TotalMasterDbConnections
				totalReadDb = totalReadDb + stat.TotalReadDbConnections
			}

			rows[5].Value = float64(totalSockets)
			rows[6].Value = float64(totalMasterDb)
			rows[7].Value = float64(totalReadDb)

		} else {
			rows[5].Value = float64(a.TotalWebsocketConnections())
			rows[6].Value = float64(a.Srv().Store.TotalMasterDbConnections())
			rows[7].Value = float64(a.Srv().Store.TotalReadDbConnections())
		}

		if dailyActiveUsersCountErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.user.analytics_daily_active_users.app_error", nil, dailyActiveUsersCountErr.Error(), http.StatusInternalServerError)
		}
		rows[8].Value = float64(dailyActiveUsersCount)

		if monthlyActiveUsersCountErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.user.analytics_daily_active_users.app_error", nil, monthlyActiveUsersCountErr.Error(), http.StatusInternalServerError)
		}
		rows[9].Value = float64(monthlyActiveUsersCount)

		return rows, nil
	} else if name == "bot_post_counts_day" {
		if skipIntensiveQueries {
			rows := model.AnalyticsRows{&model.AnalyticsRow{Name: "", Value: -1}}
			return rows, nil
		}
		analyticsRows, nErr := a.Srv().Store.Post().AnalyticsPostCountsByDay(&model.AnalyticsPostCountsOptions{
			TeamId:        teamID,
			BotsOnly:      true,
			YesterdayOnly: false,
		})
		if nErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.post.analytics_posts_count_by_day.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}

		return analyticsRows, nil
	} else if name == "post_counts_day" {
		if skipIntensiveQueries {
			rows := model.AnalyticsRows{&model.AnalyticsRow{Name: "", Value: -1}}
			return rows, nil
		}
		analyticsRows, nErr := a.Srv().Store.Post().AnalyticsPostCountsByDay(&model.AnalyticsPostCountsOptions{
			TeamId:        teamID,
			BotsOnly:      false,
			YesterdayOnly: false,
		})
		if nErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.post.analytics_posts_count_by_day.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}

		return analyticsRows, nil
	} else if name == "user_counts_with_posts_day" {
		if skipIntensiveQueries {
			rows := model.AnalyticsRows{&model.AnalyticsRow{Name: "", Value: -1}}
			return rows, nil
		}

		analyticsRows, nErr := a.Srv().Store.Post().AnalyticsUserCountsWithPostsByDay(teamID)
		if nErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.post.analytics_user_counts_posts_by_day.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}

		return analyticsRows, nil
	} else if name == "extra_counts" {
		var rows model.AnalyticsRows = make([]*model.AnalyticsRow, 6)
		rows[0] = &model.AnalyticsRow{Name: "file_post_count", Value: 0}
		rows[1] = &model.AnalyticsRow{Name: "hashtag_post_count", Value: 0}
		rows[2] = &model.AnalyticsRow{Name: "incoming_webhook_count", Value: 0}
		rows[3] = &model.AnalyticsRow{Name: "outgoing_webhook_count", Value: 0}
		rows[4] = &model.AnalyticsRow{Name: "command_count", Value: 0}
		rows[5] = &model.AnalyticsRow{Name: "session_count", Value: 0}

		var wg sync.WaitGroup

		var incomingWebhookCount int64
		var incomingWebhookCountErr error
		wg.Add(1)
		go func() {
			defer wg.Done()
			incomingWebhookCount, incomingWebhookCountErr = a.Srv().Store.Webhook().AnalyticsIncomingCount(teamID)
		}()

		var outgoingWebhookCount int64
		var outgoingWebhookCountErr error
		wg.Add(1)
		go func() {
			defer wg.Done()
			outgoingWebhookCount, outgoingWebhookCountErr = a.Srv().Store.Webhook().AnalyticsOutgoingCount(teamID)
		}()

		var commandsCount int64
		var commandsCountErr error
		wg.Add(1)
		go func() {
			defer wg.Done()
			commandsCount, commandsCountErr = a.Srv().Store.Command().AnalyticsCommandCount(teamID)
		}()

		var sessionsCount int64
		var sessionsCountErr error
		wg.Add(1)
		go func() {
			defer wg.Done()
			sessionsCount, sessionsCountErr = a.Srv().Store.Session().AnalyticsSessionCount()
		}()

		var filesCount int64
		var filesCountErr error
		var hashtagsCount int64
		var hashtagsCountErr error
		if !skipIntensiveQueries {
			wg.Add(1)
			go func() {
				defer wg.Done()
				filesCount, filesCountErr = a.Srv().Store.Post().AnalyticsPostCount(teamID, true, false)
			}()

			wg.Add(1)
			go func() {
				defer wg.Done()
				hashtagsCount, hashtagsCountErr = a.Srv().Store.Post().AnalyticsPostCount(teamID, false, true)
			}()
		}

		wg.Wait()

		if skipIntensiveQueries {
			rows[0].Value = -1
			rows[1].Value = -1
		} else {
			if filesCountErr != nil {
				return nil, model.NewAppError("GetAnalytics", "app.post.analytics_posts_count.app_error", nil, filesCountErr.Error(), http.StatusInternalServerError)
			}
			rows[0].Value = float64(filesCount)

			if hashtagsCountErr != nil {
				return nil, model.NewAppError("GetAnalytics", "app.post.analytics_posts_count.app_error", nil, hashtagsCountErr.Error(), http.StatusInternalServerError)
			}
			rows[1].Value = float64(hashtagsCount)
		}

		if incomingWebhookCountErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.webhooks.analytics_incoming_count.app_error", nil, incomingWebhookCountErr.Error(), http.StatusInternalServerError)
		}
		rows[2].Value = float64(incomingWebhookCount)

		if outgoingWebhookCountErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.webhooks.analytics_outgoing_count.app_error", nil, outgoingWebhookCountErr.Error(), http.StatusInternalServerError)
		}
		rows[3].Value = float64(outgoingWebhookCount)

		if commandsCountErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.analytics.getanalytics.internal_error", nil, commandsCountErr.Error(), http.StatusInternalServerError)
		}
		rows[4].Value = float64(commandsCount)

		if sessionsCountErr != nil {
			return nil, model.NewAppError("GetAnalytics", "app.session.analytics_session_count.app_error", nil, sessionsCountErr.Error(), http.StatusInternalServerError)
		}
		rows[5].Value = float64(sessionsCount)

		return rows, nil
	}

	return nil, nil
}

func (a *App) GetRecentlyActiveUsersForTeam(teamID string) (map[string]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetRecentlyActiveUsersForTeam(teamID, 0, 100, nil)
	if err != nil {
		return nil, model.NewAppError("GetRecentlyActiveUsersForTeam", "app.user.get_recently_active_users.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	userMap := make(map[string]*model.User)

	for _, user := range users {
		userMap[user.Id] = user
	}

	return userMap, nil
}

func (a *App) GetRecentlyActiveUsersForTeamPage(teamID string, page, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetRecentlyActiveUsersForTeam(teamID, page*perPage, perPage, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetRecentlyActiveUsersForTeamPage", "app.user.get_recently_active_users.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetNewUsersForTeamPage(teamID string, page, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetNewUsersForTeam(teamID, page*perPage, perPage, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetNewUsersForTeamPage", "app.user.get_new_users.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}
