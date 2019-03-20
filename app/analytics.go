// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

const (
	DAY_MILLISECONDS   = 24 * 60 * 60 * 1000
	MONTH_MILLISECONDS = 31 * DAY_MILLISECONDS
)

func (a *App) GetAnalytics(name string, teamId string) (model.AnalyticsRows, *model.AppError) {
	skipIntensiveQueries := false
	var systemUserCount int64
	r := <-a.Srv.Store.User().Count(model.UserCountOptions{})
	if r.Err != nil {
		return nil, r.Err
	}

	systemUserCount = r.Data.(int64)
	if systemUserCount > int64(*a.Config().AnalyticsSettings.MaxUsersForStatistics) {
		mlog.Debug(fmt.Sprintf("More than %v users on the system, intensive queries skipped", *a.Config().AnalyticsSettings.MaxUsersForStatistics))
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

		openChan := a.Srv.Store.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_OPEN)
		privateChan := a.Srv.Store.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_PRIVATE)
		teamChan := a.Srv.Store.Team().AnalyticsTeamCount()

		var userChan store.StoreChannel
		var userInactiveChan store.StoreChannel
		if teamId == "" {
			userInactiveChan = a.Srv.Store.User().AnalyticsGetInactiveUsersCount()
		} else {
			userChan = a.Srv.Store.User().Count(model.UserCountOptions{
				TeamId: teamId,
			})
		}

		var postChan store.StoreChannel
		if !skipIntensiveQueries {
			postChan = a.Srv.Store.Post().AnalyticsPostCount(teamId, false, false)
		}

		dailyActiveChan := a.Srv.Store.User().AnalyticsActiveCount(DAY_MILLISECONDS)
		monthlyActiveChan := a.Srv.Store.User().AnalyticsActiveCount(MONTH_MILLISECONDS)

		r := <-openChan
		if r.Err != nil {
			return nil, r.Err
		}
		rows[0].Value = float64(r.Data.(int64))

		r = <-privateChan
		if r.Err != nil {
			return nil, r.Err
		}
		rows[1].Value = float64(r.Data.(int64))

		if postChan == nil {
			rows[2].Value = -1
		} else {
			r = <-postChan
			if r.Err != nil {
				return nil, r.Err
			}
			rows[2].Value = float64(r.Data.(int64))
		}

		if userChan == nil {
			rows[3].Value = float64(systemUserCount)
		} else {
			r = <-userChan
			if r.Err != nil {
				return nil, r.Err
			}
			rows[3].Value = float64(r.Data.(int64))
		}

		if userInactiveChan == nil {
			rows[10].Value = -1
		} else {
			r = <-userInactiveChan
			if r.Err != nil {
				return nil, r.Err
			}
			rows[10].Value = float64(r.Data.(int64))
		}

		r = <-teamChan
		if r.Err != nil {
			return nil, r.Err
		}
		rows[4].Value = float64(r.Data.(int64))

		// If in HA mode then aggregrate all the stats
		if a.Cluster != nil && *a.Config().ClusterSettings.Enable {
			stats, err := a.Cluster.GetClusterStats()
			if err != nil {
				return nil, err
			}

			totalSockets := a.TotalWebsocketConnections()
			totalMasterDb := a.Srv.Store.TotalMasterDbConnections()
			totalReadDb := a.Srv.Store.TotalReadDbConnections()

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
			rows[6].Value = float64(a.Srv.Store.TotalMasterDbConnections())
			rows[7].Value = float64(a.Srv.Store.TotalReadDbConnections())
		}

		r = <-dailyActiveChan
		if r.Err != nil {
			return nil, r.Err
		}
		rows[8].Value = float64(r.Data.(int64))

		r = <-monthlyActiveChan
		if r.Err != nil {
			return nil, r.Err
		}
		rows[9].Value = float64(r.Data.(int64))

		return rows, nil
	} else if name == "post_counts_day" {
		if skipIntensiveQueries {
			rows := model.AnalyticsRows{&model.AnalyticsRow{Name: "", Value: -1}}
			return rows, nil
		}

		r := <-a.Srv.Store.Post().AnalyticsPostCountsByDay(teamId)
		if r.Err != nil {
			return nil, r.Err
		}
		return r.Data.(model.AnalyticsRows), nil
	} else if name == "user_counts_with_posts_day" {
		if skipIntensiveQueries {
			rows := model.AnalyticsRows{&model.AnalyticsRow{Name: "", Value: -1}}
			return rows, nil
		}

		r := <-a.Srv.Store.Post().AnalyticsUserCountsWithPostsByDay(teamId)
		if r.Err != nil {
			return nil, r.Err
		}
		return r.Data.(model.AnalyticsRows), nil
	} else if name == "extra_counts" {
		var rows model.AnalyticsRows = make([]*model.AnalyticsRow, 6)
		rows[0] = &model.AnalyticsRow{Name: "file_post_count", Value: 0}
		rows[1] = &model.AnalyticsRow{Name: "hashtag_post_count", Value: 0}
		rows[2] = &model.AnalyticsRow{Name: "incoming_webhook_count", Value: 0}
		rows[3] = &model.AnalyticsRow{Name: "outgoing_webhook_count", Value: 0}
		rows[4] = &model.AnalyticsRow{Name: "command_count", Value: 0}
		rows[5] = &model.AnalyticsRow{Name: "session_count", Value: 0}

		iHookChan := a.Srv.Store.Webhook().AnalyticsIncomingCount(teamId)
		oHookChan := a.Srv.Store.Webhook().AnalyticsOutgoingCount(teamId)
		commandChan := a.Srv.Store.Command().AnalyticsCommandCount(teamId)
		sessionChan := a.Srv.Store.Session().AnalyticsSessionCount()

		var fileChan store.StoreChannel
		var hashtagChan store.StoreChannel
		if !skipIntensiveQueries {
			fileChan = a.Srv.Store.Post().AnalyticsPostCount(teamId, true, false)
			hashtagChan = a.Srv.Store.Post().AnalyticsPostCount(teamId, false, true)
		}

		if fileChan == nil {
			rows[0].Value = -1
		} else {
			r := <-fileChan
			if r.Err != nil {
				return nil, r.Err
			}
			rows[0].Value = float64(r.Data.(int64))
		}

		if hashtagChan == nil {
			rows[1].Value = -1
		} else {
			r := <-hashtagChan
			if r.Err != nil {
				return nil, r.Err
			}
			rows[1].Value = float64(r.Data.(int64))
		}

		r := <-iHookChan
		if r.Err != nil {
			return nil, r.Err
		}
		rows[2].Value = float64(r.Data.(int64))

		r = <-oHookChan
		if r.Err != nil {
			return nil, r.Err
		}
		rows[3].Value = float64(r.Data.(int64))

		r = <-commandChan
		if r.Err != nil {
			return nil, r.Err
		}
		rows[4].Value = float64(r.Data.(int64))

		r = <-sessionChan
		if r.Err != nil {
			return nil, r.Err
		}
		rows[5].Value = float64(r.Data.(int64))

		return rows, nil
	}

	return nil, nil
}

func (a *App) GetRecentlyActiveUsersForTeam(teamId string) (map[string]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetRecentlyActiveUsersForTeam(teamId, 0, 100, nil)
	if result.Err != nil {
		return nil, result.Err
	}

	users := result.Data.([]*model.User)
	userMap := make(map[string]*model.User)

	for _, user := range users {
		userMap[user.Id] = user
	}

	return userMap, nil
}

func (a *App) GetRecentlyActiveUsersForTeamPage(teamId string, page, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	var users []*model.User
	result := <-a.Srv.Store.User().GetRecentlyActiveUsersForTeam(teamId, page*perPage, perPage, viewRestrictions)
	if result.Err != nil {
		return nil, result.Err
	}
	users = result.Data.([]*model.User)

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetNewUsersForTeamPage(teamId string, page, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	var users []*model.User
	result := <-a.Srv.Store.User().GetNewUsersForTeam(teamId, page*perPage, perPage, viewRestrictions)
	if result.Err != nil {
		return nil, result.Err
	}
	users = result.Data.([]*model.User)

	return a.sanitizeProfiles(users, asAdmin), nil
}
