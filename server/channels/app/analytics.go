// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"golang.org/x/sync/errgroup"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	DayMilliseconds   = 24 * 60 * 60 * 1000
	MonthMilliseconds = 31 * DayMilliseconds
)

func (a *App) GetAnalytics(rctx request.CTX, name string, teamID string) (model.AnalyticsRows, *model.AppError) {
	return a.getAnalytics(rctx, name, teamID, false)
}

func (a *App) GetAnalyticsForSupportPacket(rctx request.CTX) (model.AnalyticsRows, *model.AppError) {
	return a.getAnalytics(rctx, "standard", "", true)
}

func (a *App) getAnalytics(rctx request.CTX, name string, teamID string, forSupportPacket bool) (model.AnalyticsRows, *model.AppError) {
	systemUserCount, err := a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		return nil, model.NewAppError("GetAnalytics", "app.user.get_total_users_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	skipIntensiveQueries := false
	// When generating a Support Packet, always run intensive queries.
	if !forSupportPacket && systemUserCount > int64(*a.Config().AnalyticsSettings.MaxUsersForStatistics) {
		rctx.Logger().Warn("Number of users in the system is higher than the configured limit. Skipping intensive SQL queries.", mlog.Int("limit", *a.Config().AnalyticsSettings.MaxUsersForStatistics))
		skipIntensiveQueries = true
	}

	switch name {
	case "standard":
		return a.getStandardAnalytics(rctx, teamID, systemUserCount)
	case "bot_post_counts_day":
		return a.getBotPostCountsAnalytics(rctx, teamID)
	case "post_counts_day":
		return a.getPostCountsAnalytics(rctx, teamID)
	case "user_counts_with_posts_day":
		return a.getUserCountsWithPostsAnalytics(rctx, teamID, skipIntensiveQueries)
	case "extra_counts":
		return a.getExtraCountsAnalytics(rctx, teamID)
	default:
		return nil, nil
	}
}

func (a *App) getStandardAnalytics(rctx request.CTX, teamID string, systemUserCount int64) (model.AnalyticsRows, *model.AppError) {
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
	g.SetLimit(2)
	var channelCounts map[model.ChannelType]int64
	g.Go(func() error {
		var err error
		if channelCounts, err = a.Srv().Store().Channel().AnalyticsCountAll(teamID); err != nil {
			return model.NewAppError("GetAnalytics", "app.channel.analytics_type_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	var usersCount int64
	var inactiveUsersCount int64
	if teamID == "" {
		g.Go(func() error {
			var err error
			if inactiveUsersCount, err = a.Srv().Store().User().AnalyticsGetInactiveUsersCount(); err != nil {
				return model.NewAppError("GetAnalytics", "app.user.analytics_get_inactive_users_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			return nil
		})
	} else {
		g.Go(func() error {
			var err error
			if usersCount, err = a.Srv().Store().User().Count(model.UserCountOptions{TeamId: teamID}); err != nil {
				return model.NewAppError("GetAnalytics", "app.user.get_total_users_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			return nil
		})
	}

	var postsCount int64
	g.Go(func() error {
		var err error
		if postsCount, err = a.Srv().Store().Post().AnalyticsPostCountByTeam(teamID); err != nil {
			return model.NewAppError("GetAnalytics", "app.post.analytics_posts_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	var teamsCount int64
	g.Go(func() error {
		var err error
		if teamsCount, err = a.Srv().Store().Team().AnalyticsTeamCount(nil); err != nil {
			return model.NewAppError("GetAnalytics", "app.team.analytics_team_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	var dailyActiveUsersCount int64
	g.Go(func() error {
		var err error
		if dailyActiveUsersCount, err = a.Srv().Store().User().AnalyticsActiveCount(DayMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false}); err != nil {
			return model.NewAppError("GetAnalytics", "app.user.analytics_daily_active_users.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	var monthlyActiveUsersCount int64
	g.Go(func() error {
		var err error
		if monthlyActiveUsersCount, err = a.Srv().Store().User().AnalyticsActiveCount(MonthMilliseconds, model.UserCountOptions{IncludeBotAccounts: false, IncludeDeleted: false}); err != nil {
			return model.NewAppError("GetAnalytics", "app.user.analytics_daily_active_users.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, err.(*model.AppError)
	}

	rows[0].Value = float64(channelCounts[model.ChannelTypeOpen])
	rows[1].Value = float64(channelCounts[model.ChannelTypePrivate])
	rows[2].Value = float64(postsCount)

	if teamID == "" {
		rows[3].Value = float64(systemUserCount)
		rows[10].Value = float64(inactiveUsersCount)
	} else {
		rows[3].Value = float64(usersCount)
		rows[10].Value = -1
	}

	rows[4].Value = float64(teamsCount)

	// If in HA mode then aggregate all the stats
	if a.Cluster() != nil && *a.Config().ClusterSettings.Enable {
		stats, err2 := a.Cluster().GetClusterStats(rctx)
		if err2 != nil {
			return nil, err2
		}

		totalSockets := a.TotalWebsocketConnections()
		totalMasterDb := a.Srv().Store().TotalMasterDbConnections()
		totalReadDb := a.Srv().Store().TotalReadDbConnections()

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
		rows[6].Value = float64(a.Srv().Store().TotalMasterDbConnections())
		rows[7].Value = float64(a.Srv().Store().TotalReadDbConnections())
	}

	rows[8].Value = float64(dailyActiveUsersCount)
	rows[9].Value = float64(monthlyActiveUsersCount)

	return rows, nil
}

func (a *App) getBotPostCountsAnalytics(rctx request.CTX, teamID string) (model.AnalyticsRows, *model.AppError) {
	analyticsRows, nErr := a.Srv().Store().Post().AnalyticsPostCountsByDay(&model.AnalyticsPostCountsOptions{
		TeamId:   teamID,
		BotsOnly: true,
	})
	if nErr != nil {
		return nil, model.NewAppError("GetAnalytics", "app.post.analytics_posts_count_by_day.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return analyticsRows, nil
}

func (a *App) getPostCountsAnalytics(rctx request.CTX, teamID string) (model.AnalyticsRows, *model.AppError) {
	analyticsRows, nErr := a.Srv().Store().Post().AnalyticsPostCountsByDay(&model.AnalyticsPostCountsOptions{
		TeamId:   teamID,
		BotsOnly: false,
	})
	if nErr != nil {
		return nil, model.NewAppError("GetAnalytics", "app.post.analytics_posts_count_by_day.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return analyticsRows, nil
}

func (a *App) getUserCountsWithPostsAnalytics(rctx request.CTX, teamID string, skipIntensiveQueries bool) (model.AnalyticsRows, *model.AppError) {
	if skipIntensiveQueries {
		rows := model.AnalyticsRows{&model.AnalyticsRow{Name: "", Value: -1}}
		return rows, nil
	}

	analyticsRows, nErr := a.Srv().Store().Post().AnalyticsUserCountsWithPostsByDay(teamID)
	if nErr != nil {
		return nil, model.NewAppError("GetAnalytics", "app.post.analytics_user_counts_posts_by_day.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return analyticsRows, nil
}

func (a *App) getExtraCountsAnalytics(rctx request.CTX, teamID string) (model.AnalyticsRows, *model.AppError) {
	var rows model.AnalyticsRows = make([]*model.AnalyticsRow, 6)
	rows[0] = &model.AnalyticsRow{Name: "incoming_webhook_count", Value: 0}
	rows[1] = &model.AnalyticsRow{Name: "outgoing_webhook_count", Value: 0}
	rows[2] = &model.AnalyticsRow{Name: "command_count", Value: 0}
	rows[3] = &model.AnalyticsRow{Name: "session_count", Value: 0}
	rows[4] = &model.AnalyticsRow{Name: "total_file_count", Value: 0}
	rows[5] = &model.AnalyticsRow{Name: "total_file_size", Value: 0}

	var incomingWebhookCount int64
	var g errgroup.Group
	g.SetLimit(2)
	g.Go(func() error {
		var err error
		if incomingWebhookCount, err = a.Srv().Store().Webhook().AnalyticsIncomingCount(teamID, ""); err != nil {
			return model.NewAppError("GetAnalytics", "app.webhooks.analytics_incoming_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	var outgoingWebhookCount int64
	g.Go(func() error {
		var err error
		if outgoingWebhookCount, err = a.Srv().Store().Webhook().AnalyticsOutgoingCount(teamID); err != nil {
			return model.NewAppError("GetAnalytics", "app.webhooks.analytics_outgoing_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	var commandsCount int64
	g.Go(func() error {
		var err error
		if commandsCount, err = a.Srv().Store().Command().AnalyticsCommandCount(teamID); err != nil {
			return model.NewAppError("GetAnalytics", "app.analytics.getanalytics.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	var sessionsCount int64
	g.Go(func() error {
		var err error
		if sessionsCount, err = a.Srv().Store().Session().AnalyticsSessionCount(); err != nil {
			return model.NewAppError("GetAnalytics", "app.session.analytics_session_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	var fileCount int64
	g.Go(func() error {
		var err error
		if fileCount, err = a.Srv().Store().FileInfo().CountAll(); err != nil {
			return model.NewAppError("GetAnalytics", "app.file_info.get_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	var fileSize int64
	g.Go(func() error {
		var err error
		if fileSize, err = a.Srv().Store().FileInfo().GetStorageUsage(false, false); err != nil {
			return model.NewAppError("GetAnalytics", "app.file_info.get_storage_usage.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, err.(*model.AppError)
	}

	rows[0].Value = float64(incomingWebhookCount)
	rows[1].Value = float64(outgoingWebhookCount)
	rows[2].Value = float64(commandsCount)
	rows[3].Value = float64(sessionsCount)
	rows[4].Value = float64(fileCount)
	rows[5].Value = float64(fileSize)

	return rows, nil
}

func (a *App) GetRecentlyActiveUsersForTeam(rctx request.CTX, teamID string) (map[string]*model.User, *model.AppError) {
	users, err := a.Srv().Store().User().GetRecentlyActiveUsersForTeam(teamID, 0, 100, nil)
	if err != nil {
		return nil, model.NewAppError("GetRecentlyActiveUsersForTeam", "app.user.get_recently_active_users.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	userMap := make(map[string]*model.User)

	for _, user := range users {
		userMap[user.Id] = user
	}

	return userMap, nil
}

func (a *App) GetRecentlyActiveUsersForTeamPage(rctx request.CTX, teamID string, page, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store().User().GetRecentlyActiveUsersForTeam(teamID, page*perPage, perPage, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetRecentlyActiveUsersForTeamPage", "app.user.get_recently_active_users.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetNewUsersForTeamPage(rctx request.CTX, teamID string, page, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store().User().GetNewUsersForTeam(teamID, page*perPage, perPage, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetNewUsersForTeamPage", "app.user.get_new_users.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}
