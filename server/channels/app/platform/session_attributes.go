// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"slices"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	// sessionAttributesRecheckInterval bounds how long a connection goes without looking at
	// its session's attributes. Half the minimum TTL means an attribute refreshed in the
	// meantime is seen before its TTL can run out.
	sessionAttributesRecheckInterval = model.SessionAttributeMinDurationSeconds * time.Second / 2

	// sessionAttributesFollowUpInterval is how soon a connection looks again after prompting
	// its client, to pick up the deadlines of the attributes the client resends.
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

	var checkedAt int64
	for {
		select {
		case <-wc.endWritePump:
			return
		case <-timer.C:
		}

		now := model.GetMillis()
		stale, nextStaleAt := wc.staleSessionAttributes(checkedAt, now)
		checkedAt = now

		wait := sessionAttributesRecheckInterval
		if len(stale) > 0 {
			wc.sendSessionAttributesExpired(stale)
			wait = sessionAttributesFollowUpInterval
		}
		if nextStaleAt != 0 {
			wait = min(wait, time.Duration(nextStaleAt-now)*time.Millisecond)
		}
		timer.Reset(wait)
	}
}

// staleSessionAttributes returns the session's attributes whose TTL ran out after since,
// and the earliest TTL deadline still ahead of now, or 0 if there is none.
func (wc *WebConn) staleSessionAttributes(since, now int64) (stale []string, nextStaleAt int64) {
	deadlines := wc.sessionAttributeDeadlines()
	for name, deadline := range deadlines {
		switch {
		case deadline.StaleAt > now:
			if nextStaleAt == 0 || deadline.StaleAt < nextStaleAt {
				nextStaleAt = deadline.StaleAt
			}
		case deadline.StaleAt > since:
			stale = append(stale, name)
		}
	}
	slices.Sort(stale)
	return stale, nextStaleAt
}

func (wc *WebConn) sessionAttributeDeadlines() map[string]model.SessionAttributeDeadline {
	if !wc.Platform.SessionAttributesEnabled() {
		return nil
	}
	session := wc.GetSession()
	if session == nil {
		return nil
	}
	deadlines, appErr := wc.Suite.GetSessionAttributeDeadlines(wc.getRCtx(), session.Id)
	if appErr != nil {
		wc.Platform.Log().Warn("Failed to get session attribute deadlines",
			mlog.String("user_id", wc.UserId),
			mlog.String("connection_id", wc.GetConnectionID()),
			mlog.Err(appErr))
	}
	return deadlines
}

func (wc *WebConn) sendSessionAttributesExpired(attributes []string) {
	hub := wc.Platform.GetHubForUserId(wc.UserId)
	if hub == nil {
		return
	}
	evt := model.NewWebSocketEvent(model.WebsocketEventSessionAttributesExpired, "", "", wc.UserId, nil, "")
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
	if session == nil {
		return
	}

	now := model.GetMillis()
	deadlines, appErr := wc.Suite.GetSessionAttributeDeadlines(wc.getRCtx(), session.Id)
	epoch, err := wc.Platform.Store.SessionAttribute().GetEpoch(session.Id)
	if appErr != nil || err != nil {
		// Without a record nothing vouches for the queued events; refuse to replay them.
		wc.sessionAttributesExpireAt = now
		return
	}

	var expireAt int64
	for _, deadline := range deadlines {
		if deadline.ExpiresAt > now && (expireAt == 0 || deadline.ExpiresAt < expireAt) {
			expireAt = deadline.ExpiresAt
		}
	}
	wc.sessionAttributesEpoch = epoch
	wc.sessionAttributesExpireAt = expireAt
}

// sessionAttributesChangedSince reports whether the session's attributes are no longer the
// ones recorded when the connection in res went inactive: a value changed, as when a laptop
// moves to another network, or one expired while nothing refreshed it. Its queued events
// were evaluated against the old attributes and must not be replayed.
func (ps *PlatformService) sessionAttributesChangedSince(sessionID string, res *CheckConnResult) bool {
	if res.SessionAttributesExpireAt == 0 {
		return false
	}
	if model.GetMillis() >= res.SessionAttributesExpireAt {
		return true
	}
	epoch, err := ps.Store.SessionAttribute().GetEpoch(sessionID)
	return err != nil || epoch != res.SessionAttributesEpoch
}
