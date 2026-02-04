// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStatusLogConstants(t *testing.T) {
	t.Run("StatusLogType constants should be defined", func(t *testing.T) {
		assert.Equal(t, "status_change", StatusLogTypeStatusChange)
		assert.Equal(t, "activity", StatusLogTypeActivity)
	})

	t.Run("StatusLogDevice constants should be defined", func(t *testing.T) {
		assert.Equal(t, "web", StatusLogDeviceWeb)
		assert.Equal(t, "desktop", StatusLogDeviceDesktop)
		assert.Equal(t, "mobile", StatusLogDeviceMobile)
		assert.Equal(t, "api", StatusLogDeviceAPI)
		assert.Equal(t, "unknown", StatusLogDeviceUnknown)
	})

	t.Run("StatusLogReason constants should be defined", func(t *testing.T) {
		assert.Equal(t, "window_focus", StatusLogReasonWindowFocus)
		assert.Equal(t, "heartbeat", StatusLogReasonHeartbeat)
		assert.Equal(t, "inactivity", StatusLogReasonInactivity)
		assert.Equal(t, "manual", StatusLogReasonManual)
		assert.Equal(t, "offline_prevented", StatusLogReasonOfflinePrevented)
		assert.Equal(t, "disconnect", StatusLogReasonDisconnect)
		assert.Equal(t, "connect", StatusLogReasonConnect)
		assert.Equal(t, "dnd_inactivity", StatusLogReasonDNDExpired)
		assert.Equal(t, "dnd_restored", StatusLogReasonDNDRestored)
	})

	t.Run("StatusLogTrigger constants should be defined", func(t *testing.T) {
		assert.Equal(t, "Window Active", StatusLogTriggerWindowActive)
		assert.Equal(t, "Window Inactive", StatusLogTriggerWindowInactive)
		assert.Equal(t, "Heartbeat", StatusLogTriggerHeartbeat)
		assert.Equal(t, "Channel View", StatusLogTriggerChannelView)
		assert.Equal(t, "WebSocket Message", StatusLogTriggerWebSocket)
		assert.Equal(t, "Set Activity", StatusLogTriggerSetActivity)
		assert.Equal(t, "Active Channel", StatusLogTriggerActiveChannel)
		assert.Equal(t, "Mark Unread", StatusLogTriggerMarkUnread)
		assert.Equal(t, "Send Message", StatusLogTriggerSendMessage)
		assert.Equal(t, "Fetch History", StatusLogTriggerFetchHistory)
	})
}

func TestStatusLogStruct(t *testing.T) {
	t.Run("should create StatusLog with all fields", func(t *testing.T) {
		log := &StatusLog{
			Id:             NewId(),
			CreateAt:       GetMillis(),
			UserID:         NewId(),
			Username:       "testuser",
			OldStatus:      StatusAway,
			NewStatus:      StatusOnline,
			Reason:         StatusLogReasonWindowFocus,
			WindowActive:   true,
			ChannelID:      NewId(),
			Device:         StatusLogDeviceDesktop,
			LogType:        StatusLogTypeStatusChange,
			Trigger:        StatusLogTriggerWindowActive,
			Manual:         false,
			Source:         "TestFunction",
			LastActivityAt: GetMillis(),
		}

		assert.NotEmpty(t, log.Id)
		assert.Greater(t, log.CreateAt, int64(0))
		assert.NotEmpty(t, log.UserID)
		assert.Equal(t, "testuser", log.Username)
		assert.Equal(t, StatusAway, log.OldStatus)
		assert.Equal(t, StatusOnline, log.NewStatus)
		assert.Equal(t, StatusLogReasonWindowFocus, log.Reason)
		assert.True(t, log.WindowActive)
		assert.NotEmpty(t, log.ChannelID)
		assert.Equal(t, StatusLogDeviceDesktop, log.Device)
		assert.Equal(t, StatusLogTypeStatusChange, log.LogType)
		assert.Equal(t, StatusLogTriggerWindowActive, log.Trigger)
		assert.False(t, log.Manual)
		assert.Equal(t, "TestFunction", log.Source)
		assert.Greater(t, log.LastActivityAt, int64(0))
	})
}

func TestStatusLogGetOptions(t *testing.T) {
	t.Run("should create StatusLogGetOptions with all fields", func(t *testing.T) {
		opts := StatusLogGetOptions{
			UserID:   NewId(),
			Username: "testuser",
			LogType:  StatusLogTypeStatusChange,
			Status:   StatusOnline,
			Since:    GetMillis() - 3600000,
			Until:    GetMillis(),
			Search:   "window",
			Page:     0,
			PerPage:  50,
		}

		assert.NotEmpty(t, opts.UserID)
		assert.Equal(t, "testuser", opts.Username)
		assert.Equal(t, StatusLogTypeStatusChange, opts.LogType)
		assert.Equal(t, StatusOnline, opts.Status)
		assert.Greater(t, opts.Since, int64(0))
		assert.Greater(t, opts.Until, opts.Since)
		assert.Equal(t, "window", opts.Search)
		assert.Equal(t, 0, opts.Page)
		assert.Equal(t, 50, opts.PerPage)
	})

	t.Run("should work with empty/default options", func(t *testing.T) {
		opts := StatusLogGetOptions{}

		assert.Empty(t, opts.UserID)
		assert.Empty(t, opts.Username)
		assert.Empty(t, opts.LogType)
		assert.Empty(t, opts.Status)
		assert.Equal(t, int64(0), opts.Since)
		assert.Equal(t, int64(0), opts.Until)
		assert.Empty(t, opts.Search)
		assert.Equal(t, 0, opts.Page)
		assert.Equal(t, 0, opts.PerPage)
	})
}
