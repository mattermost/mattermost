// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/store/localcachelayer"
)

const (
	// A batch is sent after the delay, or as soon as it holds maxIDs IDs.
	accessDecisionBroadcastDelay  = 50 * time.Millisecond
	accessDecisionBroadcastMaxIDs = 1000

	accessDecisionMetricsInterval = 10 * time.Second
	accessDecisionSweepInterval   = 5 * time.Minute
)

// accessDecisionInvalidation is the ClusterEventInvalidateAccessDecisions payload.
type accessDecisionInvalidation struct {
	Global        bool        `json:"g,omitempty"`
	Users         []string    `json:"u,omitempty"`
	Sessions      []string    `json:"s,omitempty"`
	Resources     []string    `json:"r,omitempty"`
	UserResources [][2]string `json:"ur,omitempty"`
}

func (inv *accessDecisionInvalidation) empty() bool {
	return !inv.Global && len(inv.Users) == 0 && len(inv.Sessions) == 0 && len(inv.Resources) == 0 && len(inv.UserResources) == 0
}

var (
	_ platform.AccessDecisionInvalidator       = (*Channels)(nil)
	_ localcachelayer.MembershipChangeListener = (*Channels)(nil)
)

// accessDecisionsTracked is false while the PDP can't answer (ABAC off or no Enterprise Advanced
// license); invalidations are skipped then, and the config and license listeners reset the cache
// when it comes back.
func (ch *Channels) accessDecisionsTracked() bool {
	if ch.accessDecisions == nil || ch.AccessControl == nil {
		return false
	}
	cfg := ch.cfgSvc.Config()
	return cfg.AccessControlSettings.EnableAttributeBasedAccessControl != nil &&
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl &&
		model.MinimumEnterpriseAdvancedLicense(ch.srv.License())
}

// invalidateAccessDecisions applies inv locally and, with broadcast, queues it for the cluster.
func (ch *Channels) invalidateAccessDecisions(inv accessDecisionInvalidation, broadcast bool) {
	if inv.empty() || !ch.accessDecisionsTracked() {
		return
	}
	ch.applyAccessDecisionInvalidation(&inv)
	if broadcast && ch.accessDecisionBroadcaster != nil {
		ch.accessDecisionBroadcaster.enqueue(&inv)
	}
}

func (ch *Channels) applyAccessDecisionInvalidation(inv *accessDecisionInvalidation) {
	c := ch.accessDecisions
	if c == nil {
		return
	}

	n := 0
	if inv.Global {
		c.invalidateAll()
		n++
	}
	for _, id := range inv.Users {
		c.invalidateUser(id)
		n++
	}
	for _, id := range inv.Sessions {
		c.invalidateSession(id)
		n++
	}
	for _, id := range inv.Resources {
		c.invalidateResource(id)
		n++
	}
	for _, pair := range inv.UserResources {
		c.invalidateUserResource(pair[0], pair[1])
		n++
	}

	if metrics := ch.srv.GetMetrics(); metrics != nil {
		for range n {
			metrics.IncrementMemCacheInvalidationCounter(accessDecisionCacheName)
		}
	}
}

// clusterInvalidateAccessDecisionsHandler applies a peer's invalidation without re-sending it.
func (ch *Channels) clusterInvalidateAccessDecisionsHandler(msg *model.ClusterMessage) {
	var inv accessDecisionInvalidation
	if err := json.Unmarshal(msg.Data, &inv); err != nil {
		ch.srv.Log().Warn("Failed to decode access decision invalidation; invalidating every decision", mlog.Err(err))
		inv = accessDecisionInvalidation{Global: true}
	}
	ch.applyAccessDecisionInvalidation(&inv)
}

// InvalidateAccessDecisionsForUser implements platform.AccessDecisionInvalidator.
func (ch *Channels) InvalidateAccessDecisionsForUser(userID string) {
	ch.invalidateAccessDecisions(accessDecisionInvalidation{Users: []string{userID}}, true)
}

// InvalidateAccessDecisionsForSession implements platform.AccessDecisionInvalidator.
func (ch *Channels) InvalidateAccessDecisionsForSession(sessionID string) {
	ch.invalidateAccessDecisions(accessDecisionInvalidation{Sessions: []string{sessionID}}, true)
}

// InvalidateAllAccessDecisions implements platform.AccessDecisionInvalidator.
func (ch *Channels) InvalidateAllAccessDecisions(broadcast bool) {
	ch.invalidateAccessDecisions(accessDecisionInvalidation{Global: true}, broadcast)
}

// ChannelMembershipsChanged implements localcachelayer.MembershipChangeListener.
func (ch *Channels) ChannelMembershipsChanged(channelID string, userIDs []string) {
	pairs := make([][2]string, 0, len(userIDs))
	for _, userID := range userIDs {
		pairs = append(pairs, [2]string{userID, channelID})
	}
	ch.invalidateAccessDecisions(accessDecisionInvalidation{UserResources: pairs}, true)
}

// AllChannelMembershipsChanged implements localcachelayer.MembershipChangeListener.
func (ch *Channels) AllChannelMembershipsChanged() {
	ch.invalidateAccessDecisions(accessDecisionInvalidation{Global: true}, true)
}

// InvalidateAccessDecisionsForPolicyChange drops every decision on this node only. The access
// control service calls it on every node wherever it invalidates its compiled policies.
func (a *App) InvalidateAccessDecisionsForPolicyChange() {
	a.ch.invalidateAccessDecisions(accessDecisionInvalidation{Global: true}, false)
}

func (a *App) invalidateAccessDecisionsForUsers(userIDs []string) {
	a.ch.invalidateAccessDecisions(accessDecisionInvalidation{Users: userIDs}, true)
}

func (a *App) invalidateAccessDecisionsForResources(resourceIDs []string) {
	a.ch.invalidateAccessDecisions(accessDecisionInvalidation{Resources: resourceIDs}, true)
}

func (a *App) invalidateAccessDecisionsForSession(sessionID string) {
	a.ch.invalidateAccessDecisions(accessDecisionInvalidation{Sessions: []string{sessionID}}, true)
}

// invalidateAccessDecisionsForSessionAttributeFields drops every decision when a session
// attribute field changes, since its TTL and grace period decide which values a subject carries.
func (a *App) invalidateAccessDecisionsForSessionAttributeFields(groupID string) {
	group, err := a.Srv().propertyService.Group(model.SessionAttributesPropertyGroupName)
	if err != nil || group == nil || group.ID != groupID {
		return
	}
	a.invalidateAllAccessDecisions()
}

func (a *App) invalidateAllAccessDecisions() {
	a.ch.invalidateAccessDecisions(accessDecisionInvalidation{Global: true}, true)
}

// accessDecisionConfigInputs is the config that decisions depend on.
type accessDecisionConfigInputs struct {
	abacEnabled                  bool
	permissionPolicies           bool
	channelPermissionPolicies    bool
	channelPermissionActions     bool
	sessionAttributes            bool
	resourceAttributesInPolicies bool
	teamMembershipAccessControl  bool
}

func accessDecisionInputsFor(cfg *model.Config) accessDecisionConfigInputs {
	if cfg == nil {
		return accessDecisionConfigInputs{}
	}
	in := accessDecisionConfigInputs{
		abacEnabled: cfg.AccessControlSettings.EnableAttributeBasedAccessControl != nil && *cfg.AccessControlSettings.EnableAttributeBasedAccessControl,
	}
	if ff := cfg.FeatureFlags; ff != nil {
		in.permissionPolicies = ff.PermissionPolicies
		in.channelPermissionPolicies = ff.ChannelPermissionPolicies
		in.channelPermissionActions = ff.ChannelPermissionActions
		in.sessionAttributes = ff.SessionAttributes
		in.resourceAttributesInPolicies = ff.ResourceAttributesInPolicies
		in.teamMembershipAccessControl = ff.TeamMembershipAccessControl
	}
	return in
}

// invalidateAccessDecisionsOnConfigChange runs on every node, so it applies locally only.
func (ch *Channels) invalidateAccessDecisionsOnConfigChange(prevCfg, cfg *model.Config) {
	if accessDecisionInputsFor(prevCfg) == accessDecisionInputsFor(cfg) {
		return
	}
	if ch.accessDecisions != nil {
		ch.accessDecisions.invalidateAll()
	}
}

// invalidateAccessDecisionsOnLicenseChange runs on every node, so it applies locally only.
func (ch *Channels) invalidateAccessDecisionsOnLicenseChange(_, _ *model.License) {
	if ch.accessDecisions != nil {
		ch.accessDecisions.invalidateAll()
	}
}

// initAccessDecisionCache builds the cache from the startup config and registers its listeners.
func (ch *Channels) initAccessDecisionCache() {
	cfg := ch.cfgSvc.Config().AccessControlSettings
	size := model.AccessControlDecisionCacheSizeDefault
	if cfg.DecisionCacheSize != nil {
		size = *cfg.DecisionCacheSize
	}
	maxAge := model.AccessControlDecisionCacheMaxAgeSecondsDefault
	if cfg.DecisionCacheMaxAgeSeconds != nil {
		maxAge = *cfg.DecisionCacheMaxAgeSeconds
	}

	ch.accessDecisions = newAccessDecisionCache(size, time.Duration(maxAge)*time.Second)
	ch.accessDecisionBroadcaster = newAccessDecisionBroadcaster(ch.sendAccessDecisionInvalidation)

	ch.AddConfigListener(ch.invalidateAccessDecisionsOnConfigChange)
	ch.srv.platform.AddLicenseListener(ch.invalidateAccessDecisionsOnLicenseChange)

	if l, ok := ch.srv.Store().(interface {
		SetMembershipChangeListener(localcachelayer.MembershipChangeListener)
	}); ok {
		l.SetMembershipChangeListener(ch)
	}
}

func (ch *Channels) sendAccessDecisionInvalidation(inv *accessDecisionInvalidation) {
	cluster := ch.srv.platform.Cluster()
	if cluster == nil {
		return
	}
	data, err := json.Marshal(inv)
	if err != nil {
		ch.srv.Log().Warn("Failed to encode access decision invalidation", mlog.Err(err))
		return
	}
	cluster.SendClusterMessage(&model.ClusterMessage{
		Event:    model.ClusterEventInvalidateAccessDecisions,
		SendType: model.ClusterSendReliable,
		Data:     data,
	})
}

// startAccessDecisionMaintenance flushes metrics and sweeps old versions until stopped.
func (ch *Channels) startAccessDecisionMaintenance() {
	if ch.accessDecisions == nil || ch.accessDecisionStop != nil {
		return
	}
	stop := make(chan struct{})
	done := make(chan struct{})
	ch.accessDecisionStop = stop
	ch.accessDecisionDone = done

	go func() {
		defer close(done)
		metricsTicker := time.NewTicker(accessDecisionMetricsInterval)
		defer metricsTicker.Stop()
		sweepTicker := time.NewTicker(accessDecisionSweepInterval)
		defer sweepTicker.Stop()

		var last accessDecisionStats
		for {
			select {
			case <-stop:
				return
			case <-metricsTicker.C:
				last = ch.flushAccessDecisionMetrics(last)
			case <-sweepTicker.C:
				ch.accessDecisions.sweep()
			}
		}
	}()
}

func (ch *Channels) stopAccessDecisionMaintenance() {
	if ch.accessDecisionStop == nil {
		return
	}
	close(ch.accessDecisionStop)
	<-ch.accessDecisionDone
	ch.accessDecisionStop = nil
	ch.accessDecisionDone = nil
	if ch.accessDecisionBroadcaster != nil {
		ch.accessDecisionBroadcaster.flush()
	}
}

func (ch *Channels) flushAccessDecisionMetrics(last accessDecisionStats) accessDecisionStats {
	current := ch.accessDecisions.stats()
	if metrics := ch.srv.GetMetrics(); metrics != nil {
		if d := current.hits - last.hits; d > 0 {
			metrics.AddMemCacheHitCounter(accessDecisionCacheName, float64(d))
		}
		if d := current.misses - last.misses; d > 0 {
			metrics.AddMemCacheMissCounter(accessDecisionCacheName, float64(d))
		}
	}
	return current
}

// accessDecisionBroadcaster coalesces invalidations into batched cluster messages.
type accessDecisionBroadcaster struct {
	mu            sync.Mutex
	global        bool
	users         map[string]struct{}
	sessions      map[string]struct{}
	resources     map[string]struct{}
	userResources map[[2]string]struct{}
	ids           int
	timer         *time.Timer

	delay  time.Duration
	maxIDs int
	send   func(*accessDecisionInvalidation)
}

func newAccessDecisionBroadcaster(send func(*accessDecisionInvalidation)) *accessDecisionBroadcaster {
	b := &accessDecisionBroadcaster{
		delay:  accessDecisionBroadcastDelay,
		maxIDs: accessDecisionBroadcastMaxIDs,
		send:   send,
	}
	b.reset()
	return b
}

func (b *accessDecisionBroadcaster) reset() {
	b.global = false
	b.users = map[string]struct{}{}
	b.sessions = map[string]struct{}{}
	b.resources = map[string]struct{}{}
	b.userResources = map[[2]string]struct{}{}
	b.ids = 0
}

func (b *accessDecisionBroadcaster) enqueue(inv *accessDecisionInvalidation) {
	b.mu.Lock()
	if inv.Global {
		b.global = true
	}
	add := func(set map[string]struct{}, ids []string) {
		for _, id := range ids {
			if _, ok := set[id]; !ok {
				set[id] = struct{}{}
				b.ids++
			}
		}
	}
	add(b.users, inv.Users)
	add(b.sessions, inv.Sessions)
	add(b.resources, inv.Resources)
	for _, pair := range inv.UserResources {
		if _, ok := b.userResources[pair]; !ok {
			b.userResources[pair] = struct{}{}
			b.ids++
		}
	}

	if b.ids >= b.maxIDs {
		batch := b.takeLocked()
		b.mu.Unlock()
		b.send(batch)
		return
	}
	if b.timer == nil {
		b.timer = time.AfterFunc(b.delay, b.flush)
	}
	b.mu.Unlock()
}

func (b *accessDecisionBroadcaster) flush() {
	b.mu.Lock()
	batch := b.takeLocked()
	b.mu.Unlock()
	if batch != nil {
		b.send(batch)
	}
}

func (b *accessDecisionBroadcaster) takeLocked() *accessDecisionInvalidation {
	if b.timer != nil {
		b.timer.Stop()
		b.timer = nil
	}
	if !b.global && b.ids == 0 {
		return nil
	}

	// Global covers every ID.
	batch := &accessDecisionInvalidation{Global: b.global}
	if !b.global {
		for id := range b.users {
			batch.Users = append(batch.Users, id)
		}
		for id := range b.sessions {
			batch.Sessions = append(batch.Sessions, id)
		}
		for id := range b.resources {
			batch.Resources = append(batch.Resources, id)
		}
		for pair := range b.userResources {
			batch.UserResources = append(batch.UserResources, pair)
		}
	}
	b.reset()
	return batch
}

// evaluateAccessCached returns the PDP decision, from the cache when current. build runs only on a
// miss. Errors aren't cached. A zero ref bypasses the cache. Callers keep RBAC, bypasses and
// governance checks outside.
func (a *App) evaluateAccessCached(rctx request.CTX, ref accessSubjectRef, resource model.Resource, action string, build func() (model.Subject, *model.AppError)) (model.AccessDecision, *model.AppError) {
	c := a.ch.accessDecisions
	var lookup accessDecisionLookup
	cacheable := false
	if c != nil && ref.kind != 0 {
		lookup, cacheable = c.prepare(ref.kind, ref.subjectID, ref.userID, resource.Type, resource.ID, action)
	}
	if cacheable {
		if decision, hit := c.get(&lookup); hit {
			return model.AccessDecision{Decision: decision}, nil
		}
	}

	// cache missed, evaluate, store and return
	subject, appErr := build()
	if appErr != nil {
		return model.AccessDecision{}, appErr
	}
	decision, appErr := a.ch.AccessControl.AccessEvaluation(rctx, model.AccessRequest{
		Subject:  subject,
		Resource: resource,
		Action:   action,
	})
	if appErr != nil {
		return model.AccessDecision{}, appErr
	}

	if cacheable {
		c.put(&lookup, decision.Decision)
	}
	return decision, nil
}

// accessSubjectRef names the subject a cached decision belongs to.
type accessSubjectRef struct {
	kind      accessSubjectKind
	subjectID string
	userID    string
}

// accessSubjectRefFor picks the subject channelAccessBaseSubject builds: the session when
// userID is its user and it has an ID, otherwise the user's stored roles. A stand-in session
// without an ID (background jobs such as recaps) has no roles of its own, so it is evaluated,
// and cached, as the user.
func accessSubjectRefFor(rctx request.CTX, userID string) accessSubjectRef {
	if session := rctx.Session(); session.UserId == userID && session.Id != "" {
		return accessSubjectRef{kind: accessSubjectSession, subjectID: session.Id, userID: userID}
	}
	return accessSubjectRef{kind: accessSubjectUser, subjectID: userID, userID: userID}
}

// channelAccessCacheRef returns ref for the channel actions the cache holds, and a zero ref
// (bypass) otherwise. Only read access, the hottest check, is cached so far.
func channelAccessCacheRef(ref accessSubjectRef, action string) accessSubjectRef {
	if action != model.AccessControlPolicyActionChannelReadAccess {
		return accessSubjectRef{}
	}
	return ref
}

// peekAccessDecision returns a current cached decision without evaluating on a miss, and
// without counting one: the caller evaluates later and that miss is counted then.
func (a *App) peekAccessDecision(ref accessSubjectRef, resourceType, resourceID, action string) (allowed bool, hit bool) {
	c := a.ch.accessDecisions
	if c == nil || ref.kind == 0 {
		return false, false
	}
	lookup, cacheable := c.prepare(ref.kind, ref.subjectID, ref.userID, resourceType, resourceID, action)
	if !cacheable {
		return false, false
	}
	return c.peek(&lookup)
}
