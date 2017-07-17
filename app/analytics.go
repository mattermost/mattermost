// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

const (
	DAY_MILLISECONDS   = 24 * 60 * 60 * 1000
	MONTH_MILLISECONDS = 31 * DAY_MILLISECONDS
)

func GetAnalytics(name string, teamId string) (model.AnalyticsRows, *model.AppError) {
	skipIntensiveQueries := false
	var systemUserCount int64
	if r := <-Srv.Store.User().AnalyticsUniqueUserCount(""); r.Err != nil {
		return nil, r.Err
	} else {
		systemUserCount = r.Data.(int64)
		if systemUserCount > int64(*utils.Cfg.AnalyticsSettings.MaxUsersForStatistics) {
			l4g.Debug("More than %v users on the system, intensive queries skipped", *utils.Cfg.AnalyticsSettings.MaxUsersForStatistics)
			skipIntensiveQueries = true
		}
	}

	if name == "standard" {
		var rows model.AnalyticsRows = make([]*model.AnalyticsRow, 10)
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

		openChan := Srv.Store.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_OPEN)
		privateChan := Srv.Store.Channel().AnalyticsTypeCount(teamId, model.CHANNEL_PRIVATE)
		teamChan := Srv.Store.Team().AnalyticsTeamCount()

		var userChan store.StoreChannel
		if teamId != "" {
			userChan = Srv.Store.User().AnalyticsUniqueUserCount(teamId)
		}

		var postChan store.StoreChannel
		if !skipIntensiveQueries {
			postChan = Srv.Store.Post().AnalyticsPostCount(teamId, false, false)
		}

		dailyActiveChan := Srv.Store.User().AnalyticsActiveCount(DAY_MILLISECONDS)
		monthlyActiveChan := Srv.Store.User().AnalyticsActiveCount(MONTH_MILLISECONDS)

		if r := <-openChan; r.Err != nil {
			return nil, r.Err
		} else {
			rows[0].Value = float64(r.Data.(int64))
		}

		if r := <-privateChan; r.Err != nil {
			return nil, r.Err
		} else {
			rows[1].Value = float64(r.Data.(int64))
		}

		if postChan == nil {
			rows[2].Value = -1
		} else {
			if r := <-postChan; r.Err != nil {
				return nil, r.Err
			} else {
				rows[2].Value = float64(r.Data.(int64))
			}
		}

		if userChan == nil {
			rows[3].Value = float64(systemUserCount)
		} else {
			if r := <-userChan; r.Err != nil {
				return nil, r.Err
			} else {
				rows[3].Value = float64(r.Data.(int64))
			}
		}

		if r := <-teamChan; r.Err != nil {
			return nil, r.Err
		} else {
			rows[4].Value = float64(r.Data.(int64))
		}

		// If in HA mode then aggregrate all the stats
		if einterfaces.GetClusterInterface() != nil && *utils.Cfg.ClusterSettings.Enable {
			stats, err := einterfaces.GetClusterInterface().GetClusterStats()
			if err != nil {
				return nil, err
			}

			totalSockets := TotalWebsocketConnections()
			totalMasterDb := Srv.Store.TotalMasterDbConnections()
			totalReadDb := Srv.Store.TotalReadDbConnections()

			for _, stat := range stats {
				totalSockets = totalSockets + stat.TotalWebsocketConnections
				totalMasterDb = totalMasterDb + stat.TotalMasterDbConnections
				totalReadDb = totalReadDb + stat.TotalReadDbConnections
			}

			rows[5].Value = float64(totalSockets)
			rows[6].Value = float64(totalMasterDb)
			rows[7].Value = float64(totalReadDb)

		} else {
			rows[5].Value = float64(TotalWebsocketConnections())
			rows[6].Value = float64(Srv.Store.TotalMasterDbConnections())
			rows[7].Value = float64(Srv.Store.TotalReadDbConnections())
		}

		if r := <-dailyActiveChan; r.Err != nil {
			return nil, r.Err
		} else {
			rows[8].Value = float64(r.Data.(int64))
		}

		if r := <-monthlyActiveChan; r.Err != nil {
			return nil, r.Err
		} else {
			rows[9].Value = float64(r.Data.(int64))
		}

		return rows, nil
	} else if name == "post_counts_day" {
		if skipIntensiveQueries {
			rows := model.AnalyticsRows{&model.AnalyticsRow{Name: "", Value: -1}}
			return rows, nil
		}

		if r := <-Srv.Store.Post().AnalyticsPostCountsByDay(teamId); r.Err != nil {
			return nil, r.Err
		} else {
			return r.Data.(model.AnalyticsRows), nil
		}
	} else if name == "user_counts_with_posts_day" {
		if skipIntensiveQueries {
			rows := model.AnalyticsRows{&model.AnalyticsRow{Name: "", Value: -1}}
			return rows, nil
		}

		if r := <-Srv.Store.Post().AnalyticsUserCountsWithPostsByDay(teamId); r.Err != nil {
			return nil, r.Err
		} else {
			return r.Data.(model.AnalyticsRows), nil
		}
	} else if name == "extra_counts" {
		var rows model.AnalyticsRows = make([]*model.AnalyticsRow, 6)
		rows[0] = &model.AnalyticsRow{Name: "file_post_count", Value: 0}
		rows[1] = &model.AnalyticsRow{Name: "hashtag_post_count", Value: 0}
		rows[2] = &model.AnalyticsRow{Name: "incoming_webhook_count", Value: 0}
		rows[3] = &model.AnalyticsRow{Name: "outgoing_webhook_count", Value: 0}
		rows[4] = &model.AnalyticsRow{Name: "command_count", Value: 0}
		rows[5] = &model.AnalyticsRow{Name: "session_count", Value: 0}

		iHookChan := Srv.Store.Webhook().AnalyticsIncomingCount(teamId)
		oHookChan := Srv.Store.Webhook().AnalyticsOutgoingCount(teamId)
		commandChan := Srv.Store.Command().AnalyticsCommandCount(teamId)
		sessionChan := Srv.Store.Session().AnalyticsSessionCount()

		var fileChan store.StoreChannel
		var hashtagChan store.StoreChannel
		if !skipIntensiveQueries {
			fileChan = Srv.Store.Post().AnalyticsPostCount(teamId, true, false)
			hashtagChan = Srv.Store.Post().AnalyticsPostCount(teamId, false, true)
		}

		if fileChan == nil {
			rows[0].Value = -1
		} else {
			if r := <-fileChan; r.Err != nil {
				return nil, r.Err
			} else {
				rows[0].Value = float64(r.Data.(int64))
			}
		}

		if hashtagChan == nil {
			rows[1].Value = -1
		} else {
			if r := <-hashtagChan; r.Err != nil {
				return nil, r.Err
			} else {
				rows[1].Value = float64(r.Data.(int64))
			}
		}

		if r := <-iHookChan; r.Err != nil {
			return nil, r.Err
		} else {
			rows[2].Value = float64(r.Data.(int64))
		}

		if r := <-oHookChan; r.Err != nil {
			return nil, r.Err
		} else {
			rows[3].Value = float64(r.Data.(int64))
		}

		if r := <-commandChan; r.Err != nil {
			return nil, r.Err
		} else {
			rows[4].Value = float64(r.Data.(int64))
		}

		if r := <-sessionChan; r.Err != nil {
			return nil, r.Err
		} else {
			rows[5].Value = float64(r.Data.(int64))
		}

		return rows, nil
	}

	return nil, nil
}

func GetRecentlyActiveUsersForTeam(teamId string) (map[string]*model.User, *model.AppError) {
	if result := <-Srv.Store.User().GetRecentlyActiveUsersForTeam(teamId, 0, 100); result.Err != nil {
		return nil, result.Err
	} else {
		users := result.Data.([]*model.User)
		userMap := make(map[string]*model.User)

		for _, user := range users {
			userMap[user.Id] = user
		}

		return userMap, nil
	}
}

func GetRecentlyActiveUsersForTeamPage(teamId string, page, perPage int, asAdmin bool) ([]*model.User, *model.AppError) {
	var users []*model.User
	if result := <-Srv.Store.User().GetRecentlyActiveUsersForTeam(teamId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		users = result.Data.([]*model.User)
	}

	return sanitizeProfiles(users, asAdmin), nil
}

func GetNewUsersForTeamPage(teamId string, page, perPage int, asAdmin bool) ([]*model.User, *model.AppError) {
	var users []*model.User
	if result := <-Srv.Store.User().GetNewUsersForTeam(teamId, page*perPage, perPage); result.Err != nil {
		return nil, result.Err
	} else {
		users = result.Data.([]*model.User)
	}

	return sanitizeProfiles(users, asAdmin), nil
}
