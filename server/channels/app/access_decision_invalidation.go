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
	// A batch is sent after the delay, or as soon as it holds maxIDs IDs. The originating node
	// invalidates at once; until a batch arrives, other nodes keep serving the decisions it
	// invalidates. That window is the delay plus cluster transport, and is expected: no design
	// spanning nodes makes a change visible everywhere at the same instant.
	accessDecisionBroadcastDelay  = 50 * time.Millisecond
	accessDecisionBroadcastMaxIDs = 1000

	accessDecisionMetricsInterval = 10 * time.Second
	accessDecisionSweepInterval   = 5 * time.Minute

	accessDecisionCacheEnabledLog       = "ABAC decision cache is enabled"
	accessDecisionCacheDisabledLog      = "ABAC decision cache is disabled by AccessControlSettings.EnableDecisionCache; every access check asks the policy decision point"
	accessDecisionCacheSwitchChangedLog = "AccessControlSettings.EnableDecisionCache changed; the new value takes effect after a restart"
)

// accessDecisionInvalidation is the ClusterEventInvalidateAccessDecisions payload.
type accessDecisionInvalidation struct {
	Global        bool        `json:"g,omitempty"`
	Users         []string    `json:"u,omitempty"`
	Sessions      []string    `json:"s,omitempty"`
	Resources     []string    `json:"r,omitempty"`
	UserResources [][2]string `json:"ur,omitempty"`
	// PurgeRoles tells peers to drop every cached channel member role, as the originating store
	// did. Without it a peer drops only the roles of UserResources.
	PurgeRoles bool `json:"pr,omitempty"`
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
// when it comes back. It doesn't depend on this node's cache: with EnableDecisionCache off, peers
// may still cache decisions, and the roles and subjects they evict travel with the invalidation.
func (ch *Channels) accessDecisionsTracked() bool {
	if ch.AccessControl == nil {
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
	if c == nil || inv.empty() {
		return
	}

	if inv.Global {
		c.invalidateAll()
	}
	for _, id := range inv.Users {
		c.invalidateUser(id)
	}
	for _, id := range inv.Sessions {
		c.invalidateSession(id)
	}
	for _, id := range inv.Resources {
		c.invalidateResource(id)
	}
	for _, pair := range inv.UserResources {
		c.invalidateUserResource(pair[0], pair[1])
	}

	if metrics := ch.srv.GetMetrics(); metrics != nil {
		metrics.IncrementMemCacheInvalidationCounter(accessDecisionCacheName)
	}
}

// clusterInvalidateAccessDecisionsHandler applies a peer's invalidation without re-sending it.
func (ch *Channels) clusterInvalidateAccessDecisionsHandler(msg *model.ClusterMessage) {
	var inv accessDecisionInvalidation
	if err := json.Unmarshal(msg.Data, &inv); err != nil {
		ch.srv.Log().Warn("Failed to decode access decision invalidation; invalidating every decision", mlog.Err(err))
		inv = accessDecisionInvalidation{Global: true, PurgeRoles: true}
	}
	ch.evictMembershipRoles(&inv)
	ch.evictUserAttributes(&inv)
	ch.applyAccessDecisionInvalidation(&inv)
}

// evictUserAttributes drops this node's cached subjects of the users a peer invalidated, before
// their decisions are. The peer's own subject eviction is a separate best-effort message, so it
// can arrive after this one; the next check would then rebuild the decision from the old
// attributes and cache it under the new versions. A user or global invalidation sent for any
// other reason costs one extra subject read per affected user.
func (ch *Channels) evictUserAttributes(inv *accessDecisionInvalidation) {
	if !inv.Global && len(inv.Users) == 0 {
		return
	}
	subjects, ok := ch.srv.Store().(interface {
		RemoveUserAttributesLocal([]string)
		PurgeUserAttributesLocal()
	})
	if !ok {
		return
	}
	if inv.Global {
		subjects.PurgeUserAttributesLocal()
		return
	}
	subjects.RemoveUserAttributesLocal(inv.Users)
}

// evictMembershipRoles drops this node's cached channel member roles that a peer's membership
// change made stale, before the decisions are invalidated. The peer's own role eviction is
// best-effort, so a missed one would otherwise let the old role be cached under the new versions.
func (ch *Channels) evictMembershipRoles(inv *accessDecisionInvalidation) {
	if !inv.PurgeRoles && len(inv.UserResources) == 0 {
		return
	}
	roles, ok := ch.srv.Store().(interface {
		RemoveChannelMemberRolesLocal([]localcachelayer.UserChannel)
		PurgeChannelMemberRolesLocal()
	})
	if !ok {
		return
	}
	if inv.PurgeRoles {
		roles.PurgeChannelMemberRolesLocal()
		return
	}
	roles.RemoveChannelMemberRolesLocal(inv.UserResources)
}

// InvalidateAccessDecisionsForUser implements platform.AccessDecisionInvalidator.
func (ch *Channels) InvalidateAccessDecisionsForUser(userID string) {
	ch.invalidateAccessDecisions(accessDecisionInvalidation{Users: []string{userID}}, true)
}

// InvalidateAccessDecisionsForSession implements platform.AccessDecisionInvalidator.
func (ch *Channels) InvalidateAccessDecisionsForSession(sessionID string, broadcast bool) {
	ch.invalidateAccessDecisions(accessDecisionInvalidation{Sessions: []string{sessionID}}, broadcast)
}

// InvalidateAllAccessDecisions implements platform.AccessDecisionInvalidator.
func (ch *Channels) InvalidateAllAccessDecisions(broadcast bool) {
	ch.invalidateAccessDecisions(accessDecisionInvalidation{Global: true}, broadcast)
}

// ChannelMembershipsChanged implements localcachelayer.MembershipChangeListener.
func (ch *Channels) ChannelMembershipsChanged(memberships []localcachelayer.UserChannel) {
	ch.invalidateAccessDecisions(accessDecisionInvalidation{UserResources: memberships}, true)
}

// UserChannelMembershipsChanged implements localcachelayer.MembershipChangeListener.
func (ch *Channels) UserChannelMembershipsChanged(userID string) {
	ch.invalidateAccessDecisions(accessDecisionInvalidation{Users: []string{userID}, PurgeRoles: true}, true)
}

// ChannelMembersChanged implements localcachelayer.MembershipChangeListener.
func (ch *Channels) ChannelMembersChanged(channelID string) {
	ch.invalidateAccessDecisions(accessDecisionInvalidation{Resources: []string{channelID}, PurgeRoles: true}, true)
}

// AllChannelMembershipsChanged implements localcachelayer.MembershipChangeListener.
func (ch *Channels) AllChannelMembershipsChanged() {
	ch.invalidateAccessDecisions(accessDecisionInvalidation{Global: true, PurgeRoles: true}, true)
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

func accessDecisionCacheSettings(cfg *model.Config) (size int, maxAge time.Duration) {
	size = model.AccessControlDecisionCacheSizeDefault
	maxAgeSeconds := model.AccessControlDecisionCacheMaxAgeSecondsDefault
	if cfg != nil {
		if cfg.AccessControlSettings.DecisionCacheSize != nil {
			size = *cfg.AccessControlSettings.DecisionCacheSize
		}
		if cfg.AccessControlSettings.DecisionCacheMaxAgeSeconds != nil {
			maxAgeSeconds = *cfg.AccessControlSettings.DecisionCacheMaxAgeSeconds
		}
	}
	return size, time.Duration(maxAgeSeconds) * time.Second
}

// applyAccessDecisionCacheSettings runs on every node, so it applies locally only.
func (ch *Channels) applyAccessDecisionCacheSettings(prevCfg, cfg *model.Config) {
	if ch.accessDecisions == nil {
		return
	}
	prevSize, prevMaxAge := accessDecisionCacheSettings(prevCfg)
	size, maxAge := accessDecisionCacheSettings(cfg)
	if size != prevSize {
		ch.accessDecisions.resize(size)
	}
	if maxAge != prevMaxAge {
		ch.accessDecisions.setMaxAge(maxAge)
	}
}

// accessDecisionCacheEnabled reads AccessControlSettings.EnableDecisionCache, which defaults to on.
func accessDecisionCacheEnabled(cfg *model.Config) bool {
	if cfg == nil || cfg.AccessControlSettings.EnableDecisionCache == nil {
		return true
	}
	return *cfg.AccessControlSettings.EnableDecisionCache
}

// initAccessDecisionCache builds the cache from the startup config and registers its listeners.
// With EnableDecisionCache off the cache isn't allocated, so every check asks the PDP, but
// invalidations are still sent to peers, which may run with it on. The setting is read only
// here: a change takes effect after a restart.
func (ch *Channels) initAccessDecisionCache() {
	cfg := ch.cfgSvc.Config()
	enabled := accessDecisionCacheEnabled(cfg)
	if enabled {
		size, maxAge := accessDecisionCacheSettings(cfg)
		ch.accessDecisions = newAccessDecisionCache(size, maxAge)
	}
	ch.accessDecisionBroadcaster = newAccessDecisionBroadcaster(ch.sendAccessDecisionInvalidation)
	if enabled {
		ch.srv.Log().Info(accessDecisionCacheEnabledLog)
	} else {
		ch.srv.Log().Info(accessDecisionCacheDisabledLog)
	}
	ch.reportAccessDecisionCacheEnabled()

	ch.AddConfigListener(ch.invalidateAccessDecisionsOnConfigChange)
	ch.AddConfigListener(ch.applyAccessDecisionCacheSettings)
	ch.AddConfigListener(ch.onAccessDecisionCacheSwitchChange)
	ch.srv.platform.AddLicenseListener(ch.invalidateAccessDecisionsOnLicenseChange)

	if l, ok := ch.srv.Store().(interface {
		SetMembershipChangeListener(localcachelayer.MembershipChangeListener)
	}); ok {
		l.SetMembershipChangeListener(ch)
	}
}

// reportAccessDecisionCacheEnabled sets the gauge to whether this node allocated the cache.
func (ch *Channels) reportAccessDecisionCacheEnabled() {
	if metrics := ch.srv.GetMetrics(); metrics != nil {
		metrics.SetAccessControlDecisionCacheEnabled(ch.accessDecisions != nil)
	}
}

// onAccessDecisionCacheSwitchChange logs that a changed EnableDecisionCache waits for a restart.
// It also reports the gauge again, since metrics can be turned on after startup.
func (ch *Channels) onAccessDecisionCacheSwitchChange(prevCfg, cfg *model.Config) {
	ch.reportAccessDecisionCacheEnabled()
	if enabled := accessDecisionCacheEnabled(cfg); enabled != accessDecisionCacheEnabled(prevCfg) {
		ch.srv.Log().Info(accessDecisionCacheSwitchChangedLog,
			mlog.Bool("enabled", enabled),
			mlog.Bool("running_enabled", ch.accessDecisions != nil),
		)
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
	if ch.accessDecisionStop != nil {
		close(ch.accessDecisionStop)
		<-ch.accessDecisionDone
		ch.accessDecisionStop = nil
		ch.accessDecisionDone = nil
	}
	// Flushed with the cache off too: the broadcaster runs either way.
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
	purgeRoles    bool
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
	b.purgeRoles = false
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
	if inv.PurgeRoles {
		b.purgeRoles = true
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

	// Global covers every ID, so the roles of any memberships queued with it are purged instead.
	batch := &accessDecisionInvalidation{Global: b.global, PurgeRoles: b.purgeRoles || (b.global && len(b.userResources) > 0)}
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

// cacheableAccessActions are the actions whose decisions the cache holds. Each is evaluated
// against a channel with a subject that every invalidation source covers. Any other action,
// including membership and plugin actions, bypasses the cache: a new action is uncached until
// its inputs are checked against the invalidation sources and it is added here.
var cacheableAccessActions = map[string]struct{}{
	model.AccessControlPolicyActionChannelReadAccess:       {},
	model.AccessControlPolicyActionChannelWriteAccess:      {},
	model.AccessControlPolicyActionChannelManagementAccess: {},
	model.AccessControlPolicyActionUploadFileAttachment:    {},
	model.AccessControlPolicyActionDownloadFileAttachment:  {},
	model.AccessControlPolicyActionCreateBurnOnReadPost:    {},
}

func accessActionCacheable(action string) bool {
	_, ok := cacheableAccessActions[action]
	return ok
}

// evaluateAccessCached returns the PDP decision, from the cache when current. build runs only on a
// miss. Errors aren't cached. A zero ref, or an action not in cacheableAccessActions, bypasses the
// cache. Callers keep RBAC, bypasses and governance checks outside.
func (a *App) evaluateAccessCached(rctx request.CTX, ref accessSubjectRef, resource model.Resource, action string, build func() (model.Subject, error)) (model.AccessDecision, error) {
	c := a.ch.accessDecisions
	var lookup accessDecisionLookup
	cacheable := false
	if c != nil && ref.kind != 0 && accessActionCacheable(action) {
		lookup, cacheable = c.prepare(ref.kind, ref.subjectID, ref.userID, resource.Type, resource.ID, action)
	}
	if cacheable {
		if decision, hit := c.get(&lookup); hit {
			return model.AccessDecision{Decision: decision}, nil
		}
	}

	// cache missed, evaluate, store and return
	subject, err := build()
	if err != nil {
		return model.AccessDecision{}, err
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
		deadline, readsSession := sessionAttributeDependence(&subject, &decision)
		c.put(&lookup, decision.Decision, deadline, readsSession)
	}
	return decision, nil
}

func sessionAttributeDependence(subject *model.Subject, decision *model.AccessDecision) (deadline int64, readsSession bool) {
	if decision.SessionAttributeRefsReported && len(decision.SessionAttributeRefs) == 0 {
		return 0, false
	}
	if len(subject.SessionExpiresAt) == 0 {
		return 0, true
	}

	var earliest int64
	consider := func(ms int64) {
		if earliest == 0 || ms < earliest {
			earliest = ms
		}
	}
	if decision.SessionAttributeRefsReported {
		for _, name := range decision.SessionAttributeRefs {
			if ms, ok := subject.SessionExpiresAt[name]; ok {
				consider(ms)
			}
		}
	} else {
		// The evaluator didn't say what it read, so assume every attribute.
		for _, ms := range subject.SessionExpiresAt {
			consider(ms)
		}
	}
	if earliest == 0 {
		return 0, true
	}
	return earliest * int64(time.Millisecond), true
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

// peekAccessDecision returns a current cached decision without evaluating on a miss, and
// without counting one: the caller evaluates later and that miss is counted then.
func (a *App) peekAccessDecision(ref accessSubjectRef, resourceType, resourceID, action string) (allowed bool, hit bool) {
	c := a.ch.accessDecisions
	if c == nil || ref.kind == 0 || !accessActionCacheable(action) {
		return false, false
	}
	lookup, cacheable := c.prepare(ref.kind, ref.subjectID, ref.userID, resourceType, resourceID, action)
	if !cacheable {
		return false, false
	}
	return c.peek(&lookup)
}
