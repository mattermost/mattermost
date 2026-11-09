// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"
	"slices"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

const (
	// sessionAttributesRecheckInterval bounds how long a connection goes without looking at
	// its session's attributes. Half the minimum TTL means an attribute refreshed in the
	// meantime is seen before its TTL can run out.
	sessionAttributesRecheckInterval = model.SessionAttributeMinDurationSeconds * time.Second / 2

	// sessionAttributesFollowUpInterval is how soon a connection looks again after prompting
	// its client, to pick up the deadlines of the attributes the client resends, or after
	// failing to read them.
	sessionAttributesFollowUpInterval = 5 * time.Second
)

// SessionAttributesEnabled reports whether session attributes are collected and evaluated.
func (ps *PlatformService) SessionAttributesEnabled() bool {
	if !ps.Config().FeatureFlags.SessionAttributes {
		return false
	}
	return model.MinimumEnterpriseAdvancedLicense(ps.License())
}

// promptSessionAttributesRefresh runs for the life of the connection. Session attributes
// are refreshed only by HTTP requests, so the attributes of an idle client would lapse and
// the broadcast hooks would evaluate its events without them. Each time one of them passes
// its TTL, the client is told to resend them while the grace period still covers them.
func (wc *WebConn) promptSessionAttributesRefresh() {
	timer := time.NewTimer(0)
	defer timer.Stop()

	prompted := make(map[string]int64)
	for {
		select {
		case <-wc.endWritePump:
			return
		case <-timer.C:
		}
		timer.Reset(wc.checkSessionAttributes(prompted))
	}
}

// checkSessionAttributes prompts the client for the attributes whose TTL has run out and
// returns how long to wait before checking again.
func (wc *WebConn) checkSessionAttributes(prompted map[string]int64) time.Duration {
	if !wc.Platform.SessionAttributesEnabled() {
		return sessionAttributesRecheckInterval
	}
	// Challenge-authenticated connections have an empty session until the challenge
	// arrives, and invalidating the session cache clears it until the next event reloads it.
	session := wc.GetSession()
	if session == nil || session.Id == "" {
		return sessionAttributesFollowUpInterval
	}
	deadlines, appErr := wc.Suite.GetSessionAttributeDeadlines(wc.getRCtx(), session.Id)
	if appErr != nil {
		wc.Platform.Log().Warn("Failed to get session attribute deadlines",
			mlog.String("user_id", session.UserId),
			mlog.String("connection_id", wc.GetConnectionID()),
			mlog.Err(appErr))
		return sessionAttributesFollowUpInterval
	}

	now := model.GetMillis()
	stale, nextStaleAt := staleSessionAttributes(deadlines, prompted, now)

	wait := sessionAttributesRecheckInterval
	if len(stale) > 0 {
		wc.sendSessionAttributesExpired(session.UserId, stale)
		wait = sessionAttributesFollowUpInterval
	}
	if nextStaleAt != 0 {
		wait = min(wait, time.Duration(nextStaleAt-now)*time.Millisecond)
	}
	return wait
}

// staleSessionAttributes returns the attributes whose TTL ran out since their last refresh
// and that have not been prompted for since, recording them in prompted, along with the
// earliest TTL deadline still ahead of now, or 0 if there is none.
func staleSessionAttributes(deadlines map[string]model.SessionAttributeDeadline, prompted map[string]int64, now int64) (stale []string, nextStaleAt int64) {
	for name, deadline := range deadlines {
		switch {
		case deadline.StaleAt > now:
			if nextStaleAt == 0 || deadline.StaleAt < nextStaleAt {
				nextStaleAt = deadline.StaleAt
			}
		case prompted[name] != deadline.StaleAt:
			prompted[name] = deadline.StaleAt
			stale = append(stale, name)
		}
	}
	slices.Sort(stale)
	return stale, nextStaleAt
}

func (wc *WebConn) sendSessionAttributesExpired(userID string, attributes []string) {
	hub := wc.Platform.GetHubForUserId(userID)
	if hub == nil {
		return
	}
	evt := model.NewWebSocketEvent(model.WebsocketEventSessionAttributesExpired, "", "", userID, nil, "")
	evt.Add("attributes", attributes)
	hub.SendMessage(wc, evt)
}

// recordSessionAttributes notes the session attributes in effect as the connection goes
// inactive. Every event queued for it from then on is evaluated against them, so a resume
// is only safe while they still hold.
func (wc *WebConn) recordSessionAttributes() {
	if !wc.Platform.SessionAttributesEnabled() {
		return
	}
	session := wc.GetSession()
	if session == nil || session.Id == "" {
		return
	}

	now := model.GetMillis()
	deadlines, appErr := wc.Suite.GetSessionAttributeDeadlines(wc.getRCtx(), session.Id)
	epoch, err := wc.Platform.Store.SessionAttribute().GetEpoch(session.Id)
	if appErr != nil || err != nil {
		// Without a record nothing vouches for the queued events; refuse to replay them.
		wc.sessionAttributes = &model.SessionAttributesRecord{RecordedAt: now, ExpireAt: now}
		return
	}
	wc.sessionAttributes = newSessionAttributesRecord(deadlines, epoch, now)
}

func newSessionAttributesRecord(deadlines map[string]model.SessionAttributeDeadline, epoch string, now int64) *model.SessionAttributesRecord {
	record := &model.SessionAttributesRecord{Epoch: epoch, RecordedAt: now}
	for name, deadline := range deadlines {
		if deadline.ExpiresAt <= now {
			record.Lapsed = append(record.Lapsed, name)
		} else if record.ExpireAt == 0 || deadline.ExpiresAt < record.ExpireAt {
			record.ExpireAt = deadline.ExpiresAt
		}
	}
	slices.Sort(record.Lapsed)
	return record
}

// sessionAttributesChangedSince reports whether the session's attributes are no longer the
// ones recorded when a connection went inactive: a value changed or appeared, as when a
// laptop moves to another network, a live attribute expired, or a lapsed one was refreshed.
// The connection's queued events were evaluated against the old attributes and must not
// be replayed.
func (ps *PlatformService) sessionAttributesChangedSince(sessionID string, record *model.SessionAttributesRecord) bool {
	if record == nil {
		return false
	}
	if record.ExpireAt != 0 && model.GetMillis() >= record.ExpireAt {
		return true
	}
	epoch, err := ps.Store.SessionAttribute().GetEpoch(sessionID)
	if err != nil || epoch != record.Epoch {
		return true
	}
	if len(record.Lapsed) == 0 {
		return false
	}

	_, timestamps, err := ps.Store.SessionAttribute().Get(sessionID)
	if err != nil {
		return !errors.Is(err, cache.ErrKeyNotFound)
	}
	for _, name := range record.Lapsed {
		if timestamps[name] > record.RecordedAt {
			return true
		}
	}
	return false
}
