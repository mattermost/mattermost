// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"golang.org/x/sync/errgroup"

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

		var g errgroup.Group
		var openChannelsCount int64
		g.Go(func() error {
			var err error
			openChannelsCount, err = a.Srv().Store.Channel().AnalyticsTypeCount(teamID, model.CHANNEL_OPEN)
			return model.NewAppError("GetAnalytics", "app.channel.analytics_type_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		})

		var privateChannelsCount int64
		g.Go(func() error {
			var err error
			privateChannelsCount, err = a.Srv().Store.Channel().AnalyticsTypeCount(teamID, model.CHANNEL_PRIVATE)
			return model.NewAppError("GetAnalytics", "app.channel.analytics_type_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		})

		var usersCount int64
		var inactiveUsersCount int64
		if teamID == "" {
			g.Go(func() error {
				var err error
				inactiveUsersCount, err = a.Srv().Store.User().AnalyticsGetInactiveUsersCount()
				return model.NewAppError("GetAnalytics", "app.user.analytics_get_inactive_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
			})
		} else {
			g.Go(func() error {
				var err error
				usersCount, err = a.Srv().Store.User().Count(model.UserCountOptions{TeamId: teamID})
				return model.NewAppError("GetAnalytics", "app.user.get_total_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
			})
		}

		var postsCount int64
		if !skipIntensiveQueries {
			g.Go(func() error {
				var err error
				postsCount, err = a.Srv().Store.Post().AnalyticsPostCount(teamID, false, false)
				return model.NewAppError("GetAnalytics", "app.post.analytics_posts_count.app_error", nil, err.Error(), http.StatusInternalServerError)
			})
		}

		var teamsCount int64
		g.Go(func() error {
			var err error
			teamsCount, err = a.Srv().Store.Team().AnalyticsTeamCount(false)
			return model.NewAppError("GetAnalytics", "app.team.analytics_team_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		})

		var dailyActiveUsersCount int64
		g.Go(func() error {
			var err error
			dailyActiveUsersCount, err = a.Srv().Store.User().AnalyticsActiveCount(DayMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
			return model.NewAppError("GetAnalytics", "app.user.analytics_daily_active_users.app_error", nil, err.Error(), http.StatusInternalServerError)
		})

		var monthlyActiveUsersCount int64
		g.Go(func() error {
			var err error
			monthlyActiveUsersCount, err = a.Srv().Store.User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false})
			return model.NewAppError("GetAnalytics", "app.user.analytics_daily_active_users.app_error", nil, err.Error(), http.StatusInternalServerError)
		})

		if err := g.Wait(); err != nil {
			return nil, err.(*model.AppError)
		}

		rows[0].Value = float64(openChannelsCount)
		rows[1].Value = float64(privateChannelsCount)

		if skipIntensiveQueries {
			rows[2].Value = -1
		} else {
			rows[2].Value = float64(postsCount)
		}

		if teamID == "" {
			rows[3].Value = float64(systemUserCount)
			rows[10].Value = float64(inactiveUsersCount)
		} else {
			rows[10].Value = -1
			rows[3].Value = float64(usersCount)
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

		rows[8].Value = float64(dailyActiveUsersCount)
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

		var g errgroup.Group

		var incomingWebhookCount int64
		g.Go(func() error {
			var err error
			incomingWebhookCount, err = a.Srv().Store.Webhook().AnalyticsIncomingCount(teamID)
			return model.NewAppError("GetAnalytics", "app.webhooks.analytics_incoming_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		})

		var outgoingWebhookCount int64
		g.Go(func() error {
			var err error
			outgoingWebhookCount, err = a.Srv().Store.Webhook().AnalyticsOutgoingCount(teamID)
			return model.NewAppError("GetAnalytics", "app.webhooks.analytics_outgoing_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		})

		var commandsCount int64
		g.Go(func() error {
			var err error
			commandsCount, err = a.Srv().Store.Command().AnalyticsCommandCount(teamID)
			return model.NewAppError("GetAnalytics", "app.analytics.getanalytics.internal_error", nil, err.Error(), http.StatusInternalServerError)
		})

		var sessionsCount int64
		g.Go(func() error {
			var err error
			sessionsCount, err = a.Srv().Store.Session().AnalyticsSessionCount()
			return model.NewAppError("GetAnalytics", "app.session.analytics_session_count.app_error", nil, err.Error(), http.StatusInternalServerError)
		})

		var filesCount int64
		var hashtagsCount int64
		if !skipIntensiveQueries {
			g.Go(func() error {
				var err error
				filesCount, err = a.Srv().Store.Post().AnalyticsPostCount(teamID, true, false)
				return model.NewAppError("GetAnalytics", "app.post.analytics_posts_count.app_error", nil, err.Error(), http.StatusInternalServerError)
			})

			g.Go(func() error {
				var err error
				hashtagsCount, err = a.Srv().Store.Post().AnalyticsPostCount(teamID, false, true)
				return model.NewAppError("GetAnalytics", "app.post.analytics_posts_count.app_error", nil, err.Error(), http.StatusInternalServerError)
			})
		}

		if err := g.Wait(); err != nil {
			return nil, err.(*model.AppError)
		}

		if skipIntensiveQueries {
			rows[0].Value = -1
			rows[1].Value = -1
		} else {
			rows[0].Value = float64(filesCount)
			rows[1].Value = float64(hashtagsCount)
		}

		rows[2].Value = float64(incomingWebhookCount)
		rows[3].Value = float64(outgoingWebhookCount)
		rows[4].Value = float64(commandsCount)
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
