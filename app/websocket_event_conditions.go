// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

// websocketSendCondition returns whether a websocket event should be sent.
type websocketSendCondition func(*WebConn, *model.WebSocketEvent) bool

func wsConditionAuth(wc *WebConn, _ *model.WebSocketEvent) bool {
	return wc.IsAuthenticated()
}

func wsConditionSubject(wc *WebConn, evt *model.WebSocketEvent) bool {
	if subjectID := evt.GetBroadcast().SubjectID; subjectID != "" {
		if !wc.IsSubscribed(subjectID) {
			return false
		}
	}
	return true
}

func wsConditionSanitizedData(wc *WebConn, evt *model.WebSocketEvent) bool {
	var hasReadPrivateDataPermission *bool
	if evt.GetBroadcast().ContainsSanitizedData {
		hasReadPrivateDataPermission = model.NewBool(wc.App.RolesGrantPermission(wc.GetSession().GetUserRoles(), model.PermissionManageSystem.Id))

		if *hasReadPrivateDataPermission {
			return false
		}
	}
	return true
}

func wsConditionSensitiveData(wc *WebConn, evt *model.WebSocketEvent) bool {
	if evt.GetBroadcast().ContainsSensitiveData {
		hasReadPrivateDataPermission := model.NewBool(wc.App.RolesGrantPermission(wc.GetSession().GetUserRoles(), model.PermissionManageSystem.Id))
		if !*hasReadPrivateDataPermission {
			return false
		}
	}
	return true
}

func wsConditionTargetUser(wc *WebConn, evt *model.WebSocketEvent) bool {
	if evt.GetBroadcast().UserId != "" {
		return wc.UserId == evt.GetBroadcast().UserId
	}
	return true
}

func wsConditionOmittedUsers(wc *WebConn, evt *model.WebSocketEvent) bool {
	if len(evt.GetBroadcast().OmitUsers) > 0 {
		if _, ok := evt.GetBroadcast().OmitUsers[wc.UserId]; ok {
			return false
		}
	}
	return true
}

func wsConditionChannel(wc *WebConn, evt *model.WebSocketEvent) bool {
	if evt.GetBroadcast().ChannelId != "" {
		if model.GetMillis()-wc.lastAllChannelMembersTime > webConnMemberCacheTime {
			wc.allChannelMembers = nil
			wc.lastAllChannelMembersTime = 0
		}

		if wc.allChannelMembers == nil {
			result, err := wc.App.Srv().Store.Channel().GetAllChannelMembersForUser(wc.UserId, false, false)
			if err != nil {
				mlog.Error("webhub.shouldSendEvent.", mlog.Err(err))
				return false
			}
			wc.allChannelMembers = result
			wc.lastAllChannelMembersTime = model.GetMillis()
		}

		if _, ok := wc.allChannelMembers[evt.GetBroadcast().ChannelId]; ok {
			return true
		}
		return false
	}
	return true
}

func wsConditionTeam(wc *WebConn, evt *model.WebSocketEvent) bool {
	if evt.GetBroadcast().TeamId != "" {
		return wc.isMemberOfTeam(evt.GetBroadcast().TeamId)
	}
	return true
}

func wsConditionGuest(wc *WebConn, evt *model.WebSocketEvent) bool {
	if wc.GetSession().Props[model.SessionPropIsGuest] == "true" {
		return wc.shouldSendEventToGuest(evt)
	}
	return true
}
