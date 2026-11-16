// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	systemSettingOverridesPushQuietPeriod = time.Second
	systemSettingOverridesPushMaxDelay    = 10 * time.Second
)

type systemSettingOverridesPushTarget struct {
	allSessions bool
	sessionIDs  map[string]struct{}
	// force pushes even when no policy targets the session's role chain, so a
	// role change that moves a user out of a targeted role clears its overrides.
	force bool
}

type systemSettingOverridesPushBatch struct {
	everyone bool
	users    map[string]*systemSettingOverridesPushTarget
}

// systemSettingOverridesPusher coalesces override pushes triggered by attribute
// and role changes. A batch is flushed once no change has been queued for the
// quiet period, or once the max delay since the first queued change elapses,
// so bulk writers such as LDAP sync pay for one attribute view refresh per
// batch rather than one per user.
type systemSettingOverridesPusher struct {
	quietPeriod time.Duration
	maxDelay    time.Duration
	flush       func(batch systemSettingOverridesPushBatch)

	mut           sync.Mutex
	pending       systemSettingOverridesPushBatch
	timer         *time.Timer
	firstQueuedAt time.Time
	stopped       bool

	// flushMut serializes flushes so concurrent batches do not race each other
	// on the attribute view refresh.
	flushMut sync.Mutex
}

func newSystemSettingOverridesPusher(flush func(batch systemSettingOverridesPushBatch)) *systemSettingOverridesPusher {
	return &systemSettingOverridesPusher{
		quietPeriod: systemSettingOverridesPushQuietPeriod,
		maxDelay:    systemSettingOverridesPushMaxDelay,
		flush:       flush,
	}
}

func (p *systemSettingOverridesPusher) queueUser(userID, sessionID string, force bool) {
	if userID == "" {
		return
	}

	p.mut.Lock()
	defer p.mut.Unlock()
	if p.stopped {
		return
	}

	if p.pending.users == nil {
		p.pending.users = make(map[string]*systemSettingOverridesPushTarget)
	}
	target, ok := p.pending.users[userID]
	if !ok {
		target = &systemSettingOverridesPushTarget{}
		p.pending.users[userID] = target
	}
	target.force = target.force || force
	if sessionID == "" {
		target.allSessions = true
		target.sessionIDs = nil
	} else if !target.allSessions {
		if target.sessionIDs == nil {
			target.sessionIDs = make(map[string]struct{})
		}
		target.sessionIDs[sessionID] = struct{}{}
	}

	p.scheduleLocked()
}

func (p *systemSettingOverridesPusher) queueEveryone() {
	p.mut.Lock()
	defer p.mut.Unlock()
	if p.stopped {
		return
	}

	p.pending.everyone = true
	p.scheduleLocked()
}

func (p *systemSettingOverridesPusher) scheduleLocked() {
	now := time.Now()
	if p.timer == nil {
		p.firstQueuedAt = now
		p.timer = time.AfterFunc(p.quietPeriod, p.fire)
		return
	}

	delay := p.quietPeriod
	if remaining := p.maxDelay - now.Sub(p.firstQueuedAt); remaining < delay {
		delay = max(remaining, 0)
	}
	p.timer.Reset(delay)
}

func (p *systemSettingOverridesPusher) take() (systemSettingOverridesPushBatch, bool) {
	p.mut.Lock()
	defer p.mut.Unlock()

	if p.timer != nil {
		p.timer.Stop()
		p.timer = nil
	}
	batch := p.pending
	p.pending = systemSettingOverridesPushBatch{}
	return batch, batch.everyone || len(batch.users) > 0
}

func (p *systemSettingOverridesPusher) fire() {
	batch, ok := p.take()
	if !ok {
		return
	}

	p.flushMut.Lock()
	defer p.flushMut.Unlock()
	if p.isStopped() {
		return
	}
	p.flush(batch)
}

func (p *systemSettingOverridesPusher) isStopped() bool {
	p.mut.Lock()
	defer p.mut.Unlock()
	return p.stopped
}

// stop discards pending pushes and waits for an in-progress flush to finish.
func (p *systemSettingOverridesPusher) stop() {
	p.mut.Lock()
	p.stopped = true
	if p.timer != nil {
		p.timer.Stop()
		p.timer = nil
	}
	p.pending = systemSettingOverridesPushBatch{}
	p.mut.Unlock()

	p.flushMut.Lock()
	defer p.flushMut.Unlock()
}

// systemSettingPolicyPushActive reports whether any system_setting policy can
// produce overrides on this server, so callers can skip queueing pushes
// entirely when the feature is off or no policy exists.
func (a *App) systemSettingPolicyPushActive(rctx request.CTX) bool {
	if a.Srv().Channels().AccessControl == nil ||
		!systemSettingPoliciesEnabled(a.Config()) ||
		!model.MinimumEnterpriseAdvancedLicense(a.License()) {
		return false
	}

	policies, err := a.Srv().Channels().systemSettingPoliciesCache.Get(rctx, a.Srv().Store().AccessControlPolicy())
	if err != nil {
		rctx.Logger().Warn("Failed to load system setting policies for override push", mlog.Err(err))
		return false
	}
	return len(policies) > 0
}

// queueClientConfigOverridesPush schedules a push of re-evaluated client
// config overrides to the user's sessions. An empty sessionID targets every
// session of the user.
func (a *App) queueClientConfigOverridesPush(rctx request.CTX, userID, sessionID string, force bool) {
	pusher := a.Srv().Channels().systemSettingOverridesPusher
	if pusher == nil || !a.systemSettingPolicyPushActive(rctx) {
		return
	}
	pusher.queueUser(userID, sessionID, force)
}

// queueClientConfigOverridesPushForEveryone schedules a re-evaluation for every
// connected session, for changes such as attribute field mutations that may
// affect any user.
func (a *App) queueClientConfigOverridesPushForEveryone(rctx request.CTX) {
	pusher := a.Srv().Channels().systemSettingOverridesPusher
	if pusher == nil || !a.systemSettingPolicyPushActive(rctx) {
		return
	}
	pusher.queueEveryone()
}

func (a *App) flushClientConfigOverridesPush(batch systemSettingOverridesPushBatch) {
	rctx := request.EmptyContext(a.Log())
	if !a.systemSettingPolicyPushActive(rctx) {
		return
	}

	if batch.everyone {
		// Refresh here so the hub goroutines evaluating per connection on this
		// node do not each find the attribute view stale.
		a.refreshAttributeViewIfStale(rctx)
		a.publishSystemSettingPolicyUpdate(rctx)
		return
	}

	for userID, target := range batch.users {
		a.pushClientConfigOverridesForUser(rctx, userID, target)
	}
}

// pushClientConfigOverridesForUser evaluates overrides on this node for each
// targeted session of the user and publishes a single user-scoped event. Each
// connection picks the entry for its own session in
// systemSettingOverridesBySessionBroadcastHook, so other nodes never evaluate
// against attribute data they may not have caught up on yet.
func (a *App) pushClientConfigOverridesForUser(rctx request.CTX, userID string, target *systemSettingOverridesPushTarget) {
	sessions, appErr := a.GetSessions(rctx, userID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to load sessions for client config override push", mlog.String("user_id", userID), mlog.Err(appErr))
		return
	}

	overridesBySession := make(map[string]map[string]string, len(sessions))
	for _, session := range sessions {
		if session.IsExpired() {
			continue
		}
		if !target.allSessions {
			if _, ok := target.sessionIDs[session.Id]; !ok {
				continue
			}
		}

		overrides, hasCandidate, evalErr := a.evaluateClientConfigOverrides(rctx.WithSession(session))
		if evalErr != nil {
			rctx.Logger().Warn("Failed to evaluate client config overrides for push",
				mlog.String("user_id", userID),
				mlog.String("session_id", session.Id),
				mlog.Err(evalErr),
			)
			continue
		}
		if !hasCandidate && !target.force {
			continue
		}
		overridesBySession[session.Id] = overrides
	}

	if len(overridesBySession) == 0 {
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventSystemSettingPolicyUpdated, "", "", userID, nil, "")
	useSystemSettingOverridesBySessionHook(message, overridesBySession)
	a.Publish(message)
}
