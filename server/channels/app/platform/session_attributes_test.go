// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestStaleSessionAttributes(t *testing.T) {
	const now = int64(100_000)

	t.Run("waits for the earliest TTL still ahead", func(t *testing.T) {
		prompted := map[string]int64{}
		stale, next := staleSessionAttributes(map[string]model.SessionAttributeDeadline{
			"ip_address": {StaleAt: now + 5000, ExpiresAt: now + 65_000},
			"ssid":       {StaleAt: now + 2000, ExpiresAt: now + 62_000},
		}, prompted, now)
		assert.Empty(t, stale)
		assert.Equal(t, now+2000, next)
		assert.Empty(t, prompted)
	})

	t.Run("prompts each attribute once per lapse of its TTL", func(t *testing.T) {
		prompted := map[string]int64{}
		deadlines := map[string]model.SessionAttributeDeadline{
			"ssid":         {StaleAt: now - 1000, ExpiresAt: now + 59_000},
			"ip_address":   {StaleAt: now, ExpiresAt: now + 60_000},
			"mdm_enrolled": {StaleAt: now - 2000, ExpiresAt: now + 58_000},
			"os_version":   {StaleAt: now + 3000, ExpiresAt: now + 63_000},
		}

		stale, next := staleSessionAttributes(deadlines, prompted, now)
		assert.Equal(t, []string{"ip_address", "mdm_enrolled", "ssid"}, stale)
		assert.Equal(t, now+3000, next)

		stale, _ = staleSessionAttributes(deadlines, prompted, now+5000)
		assert.Equal(t, []string{"os_version"}, stale, "a client that did not refresh is not prompted again for the same lapse")

		deadlines["ip_address"] = model.SessionAttributeDeadline{StaleAt: now + 8000, ExpiresAt: now + 68_000}
		stale, _ = staleSessionAttributes(deadlines, prompted, now+10_000)
		assert.Equal(t, []string{"ip_address"}, stale, "a refreshed attribute is prompted again when its new TTL runs out")
	})

	t.Run("prompts an attribute already past its grace period, since a refresh restores it", func(t *testing.T) {
		stale, _ := staleSessionAttributes(map[string]model.SessionAttributeDeadline{
			"ip_address": {StaleAt: now - 120_000, ExpiresAt: now - 60_000},
		}, map[string]int64{}, now)
		assert.Equal(t, []string{"ip_address"}, stale)
	})
}

func TestNewSessionAttributesRecord(t *testing.T) {
	const now = int64(100_000)

	ipAddress := model.SessionAttributeDeadline{RefreshedAt: now - 40_000, StaleAt: now - 10_000, ExpiresAt: now + 50_000}
	ssid := model.SessionAttributeDeadline{RefreshedAt: now - 35_000, StaleAt: now - 5000, ExpiresAt: now + 20_000}
	record := newSessionAttributesRecord(map[string]model.SessionAttributeDeadline{
		"ip_address":  ipAddress,
		"ssid":        ssid,
		"vpn_active":  {StaleAt: now - 90_000, ExpiresAt: now - 30_000},
		"os_version":  {StaleAt: now - 70_000, ExpiresAt: now},
		"hardware_id": {StaleAt: now - 600_000, ExpiresAt: now - 300_000},
	}, "1234", now)

	assert.Equal(t, &model.SessionAttributesRecord{
		Epoch:      "1234",
		RecordedAt: now,
		ExpireAt:   now + 20_000,
		Live:       map[string]model.SessionAttributeDeadline{"ip_address": ipAddress, "ssid": ssid},
		Lapsed:     []string{"hardware_id", "os_version", "vpn_active"},
	}, record)

	assert.Equal(t, &model.SessionAttributesRecord{Epoch: "0", RecordedAt: now},
		newSessionAttributesRecord(nil, "0", now))
}

func TestSessionAttributesChangedSince(t *testing.T) {
	th := Setup(t)
	store := th.Service.Store.SessionAttribute()

	refresh := func(t *testing.T, sessionID string, attrs map[string]any, at int64) {
		t.Helper()
		require.NoError(t, store.Refresh(sessionID, attrs, at))
	}
	recordFor := func(t *testing.T, sessionID string, recordedAt, expireAt int64, lapsed ...string) *model.SessionAttributesRecord {
		t.Helper()
		epoch, err := store.GetEpoch(sessionID)
		require.NoError(t, err)
		return &model.SessionAttributesRecord{Epoch: epoch, RecordedAt: recordedAt, ExpireAt: expireAt, Lapsed: lapsed}
	}
	// recordWithLive records ip_address, refreshed at refreshedAt, as live with a lifetime
	// (TTL plus grace period) of 60s.
	recordWithLive := func(t *testing.T, sessionID string, recordedAt, refreshedAt int64) *model.SessionAttributesRecord {
		t.Helper()
		deadline := model.SessionAttributeDeadline{RefreshedAt: refreshedAt, StaleAt: refreshedAt + 30_000, ExpiresAt: refreshedAt + 60_000}
		record := recordFor(t, sessionID, recordedAt, deadline.ExpiresAt)
		record.Live = map[string]model.SessionAttributeDeadline{"ip_address": deadline}
		return record
	}

	t.Run("allows a resume without a record", func(t *testing.T) {
		assert.False(t, th.Service.sessionAttributesChangedSince(model.NewId(), nil))
	})

	t.Run("allows a resume for a session that never had attributes", func(t *testing.T) {
		sessionID := model.NewId()
		record := newSessionAttributesRecord(nil, "0", model.GetMillis())
		assert.False(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("allows a resume while the recorded attributes hold", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-1000)
		record := recordFor(t, sessionID, now, now+60_000)

		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now+500)
		assert.False(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("refuses a resume once a recorded attribute expired", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-1000)
		record := recordFor(t, sessionID, now-1000, now-1)

		assert.True(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("refuses a resume once a live attribute expired without a refresh", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-61_000)
		record := recordWithLive(t, sessionID, now-50_000, now-61_000)

		assert.True(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("allows a resume past the recorded expiry when the attribute was refreshed before it", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-61_000)
		record := recordWithLive(t, sessionID, now-50_000, now-61_000)

		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-5000)
		assert.False(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("refuses a resume when the attribute was refreshed only after it expired", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-70_000)
		record := recordWithLive(t, sessionID, now-60_000, now-70_000)

		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-5000)
		assert.True(t, th.Service.sessionAttributesChangedSince(sessionID, record), "events queued between expiry and refresh were evaluated without it")
	})

	t.Run("refuses a resume when the refreshed attribute has expired again", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-130_000)
		record := recordWithLive(t, sessionID, now-125_000, now-130_000)

		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-80_000)
		assert.True(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("refuses a resume once an attribute changed value within the millisecond of the previous change", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now)
		record := recordFor(t, sessionID, now, now+60_000)

		refresh(t, sessionID, map[string]any{"ip_address": "203.0.113.9"}, now)
		assert.True(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("refuses a resume once a lapsed attribute was refreshed within the millisecond of the record", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-200_000)
		record := recordFor(t, sessionID, now, 0, "ip_address")

		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now)
		assert.True(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("refuses a resume once an attribute changed value", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-1000)
		record := recordFor(t, sessionID, now, now+60_000)

		refresh(t, sessionID, map[string]any{"ip_address": "203.0.113.9"}, now+500)
		assert.True(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("refuses a resume once an attribute appeared", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-1000)
		record := recordFor(t, sessionID, now, now+60_000)

		refresh(t, sessionID, map[string]any{"vpn_active": "true"}, now+500)
		assert.True(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("refuses a resume once an attribute lapsed at the time was refreshed", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3", "ssid": "office"}, now-200_000)
		record := recordFor(t, sessionID, now, 0, "ip_address", "ssid")

		refresh(t, sessionID, map[string]any{"ssid": "office"}, now+500)
		assert.True(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("refuses a resume once a lapsed attribute was refreshed while another stayed live", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3", "ssid": "office"}, now-200_000)
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-1000)
		record := recordFor(t, sessionID, now, now+60_000, "ssid")

		refresh(t, sessionID, map[string]any{"ssid": "office"}, now+500)
		assert.True(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})

	t.Run("allows a resume while the lapsed attributes stay lapsed", func(t *testing.T) {
		sessionID := model.NewId()
		now := model.GetMillis()
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3", "ssid": "office"}, now-200_000)
		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now-1000)
		record := recordFor(t, sessionID, now, now+60_000, "ssid")

		refresh(t, sessionID, map[string]any{"ip_address": "10.1.2.3"}, now+500)
		assert.False(t, th.Service.sessionAttributesChangedSince(sessionID, record))
	})
}

func TestSessionAttributesRecordCarriedAcrossNodes(t *testing.T) {
	mainHelper.Parallel(t)

	s := httptest.NewServer(dummyWebsocketHandler(t))
	defer s.Close()

	record := &model.SessionAttributesRecord{Epoch: "1234", RecordedAt: 1000, ExpireAt: 61_000, Lapsed: []string{"ssid"}}

	t.Run("the node holding the connection hands out its record", func(t *testing.T) {
		th := Setup(t)
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "").SetSequence(4)
		wc := registerResumableWebConn(t, th, s.Listener.Addr(), model.NewId(), event)
		wc.sessionAttributes = record
		wc.Close()

		queues, err := th.Service.GetWSQueues(wc.UserId, wc.GetConnectionID(), 5)
		require.NoError(t, err)
		require.NotNil(t, queues)

		data, err := json.Marshal(queues)
		require.NoError(t, err)
		var received model.WSQueues
		require.NoError(t, json.Unmarshal(data, &received))
		assert.Equal(t, record, received.SessionAttributes)
	})

	t.Run("the node resuming the connection keeps the remote record", func(t *testing.T) {
		cluster := &wsQueuesCluster{queues: map[string]*model.WSQueues{
			"node1": {ActiveQ: []model.ActiveQueueItem{}, SessionAttributes: record},
		}}
		th := SetupWithCluster(t, cluster)

		res, reason, _ := th.Service.CheckWebConn(model.NewId(), model.NewId(), 5)
		require.NotNil(t, res, reason)
		assert.Equal(t, record, res.SessionAttributes)
	})
}
