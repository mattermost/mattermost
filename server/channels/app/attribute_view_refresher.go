// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"slices"
	"sync"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// The attribute materialized views (UserAttributeView, ChannelAttributeView) back the bulk
// attribute searches: policy searches and simulations, and the membership sync. Single-subject
// reads use the live views and never wait for a refresh.
//
// Each node marks the views its own writes make stale and refreshes them in the background once
// the writes go quiet. Any number of nodes may try to refresh the same view: the store's
// RefreshAttributesIfStale coordinates them through the database (an advisory lock per view and
// the last refresh's start in database time), so nothing here depends on a cluster leader or on
// cluster messages. Marks live only in memory: a node that restarts between a write and its
// refresh leaves the views stale until the next write of that type or the next membership sync.
const (
	// A view is refreshed once no write has marked it for attributeViewRefreshQuiet, or
	// attributeViewRefreshMaxWait after its first unrefreshed mark, whichever comes first.
	attributeViewRefreshQuiet   = 2 * time.Second
	attributeViewRefreshMaxWait = 10 * time.Second

	// attributeViewRefreshMinGap is the least time between two background refreshes of one view
	// across the cluster. The store stretches it to the last refresh's duration.
	attributeViewRefreshMinGap = 10 * time.Second

	// A failed refresh is retried after attributeViewRefreshBackoffInitial, doubling up to
	// attributeViewRefreshBackoffCap, until one succeeds.
	attributeViewRefreshBackoffInitial = 10 * time.Second
	attributeViewRefreshBackoffCap     = 5 * time.Minute

	// attributeViewRefreshBusyRetry is how soon a refresh that found the view's lock held, by a
	// refresh running elsewhere, is retried.
	attributeViewRefreshBusyRetry = 2 * time.Second

	// While a view has marks not yet refreshed, the staleness gauge is updated at least this often.
	attributeViewStalenessInterval = 5 * time.Second

	// The membership sync refreshes both views before it runs. When another session holds a
	// view's lock it retries after attributeViewSyncBackoffInitial, doubling, up to
	// attributeViewSyncRetries times (about 4 minutes), then runs on the view as it is.
	attributeViewSyncBackoffInitial = time.Second
	attributeViewSyncRetries        = 8
)

// attributeViewObjectTypes are the object types that have an attribute materialized view.
var attributeViewObjectTypes = []string{model.PropertyFieldObjectTypeUser, model.PropertyFieldObjectTypeChannel}

// attributeViewRefreshStore is the part of the store the refresher uses.
type attributeViewRefreshStore interface {
	GetAttributeRefreshToken(rctx request.CTX) (time.Time, error)
	RefreshAttributesIfStale(rctx request.CTX, objectType string, token time.Time, minGap time.Duration) (store.AttributeViewRefreshResult, error)
}

// attributeViewRefreshMetrics is the part of the metrics interface the refresher reports to.
type attributeViewRefreshMetrics interface {
	IncrementAttributeViewRefresh(view, result string)
	SetAttributeViewStaleness(view string, seconds float64)
}

const attributeViewSyncGaveUpLog = "Attribute views are being refreshed elsewhere; the membership sync runs on them as they are"

// attributeViewRefreshFailed is the refresh counter's result for an error, next to the store's
// outcomes.
const attributeViewRefreshFailed = "failed"

type refresherClock interface {
	Now() time.Time
}

type systemClock struct{}

func (systemClock) Now() time.Time { return time.Now() }

// attributeViewTimings are the refresher's delays, overridable in tests.
type attributeViewTimings struct {
	quiet, maxWait, minGap     time.Duration
	backoffInitial, backoffCap time.Duration
	busyRetry, staleness       time.Duration
	syncBackoffInitial         time.Duration
	syncRetries                int
}

var defaultAttributeViewTimings = attributeViewTimings{
	quiet:              attributeViewRefreshQuiet,
	maxWait:            attributeViewRefreshMaxWait,
	minGap:             attributeViewRefreshMinGap,
	backoffInitial:     attributeViewRefreshBackoffInitial,
	backoffCap:         attributeViewRefreshBackoffCap,
	busyRetry:          attributeViewRefreshBusyRetry,
	staleness:          attributeViewStalenessInterval,
	syncBackoffInitial: attributeViewSyncBackoffInitial,
	syncRetries:        attributeViewSyncRetries,
}

// attributeViewState is one view's marks and pending refresh on this node.
type attributeViewState struct {
	// firstMark and lastMark bound the marks not yet handed to a refresh; zero when there are none.
	firstMark time.Time
	lastMark  time.Time

	// token is set while a refresh is pending: everything marked before it was taken is in any
	// refresh that starts at or after it. tokenFirstMark is the oldest mark it covers.
	token          time.Time
	tokenFirstMark time.Time

	// retryAt holds off the next try after busy, gap or a failure; backoff is the current
	// failure delay.
	retryAt time.Time
	backoff time.Duration
}

func (s *attributeViewState) clean() bool {
	return s.firstMark.IsZero() && s.token.IsZero()
}

// oldestMark is the oldest mark not yet in a refresh, or zero when the view is clean.
func (s *attributeViewState) oldestMark() time.Time {
	if !s.token.IsZero() {
		return s.tokenFirstMark
	}
	return s.firstMark
}

type attributeViewRefresher struct {
	store   func() attributeViewRefreshStore
	metrics func() attributeViewRefreshMetrics
	enabled func() bool
	clock   refresherClock
	logger  mlog.LoggerIFace

	mu      sync.Mutex
	timings attributeViewTimings
	views   map[string]*attributeViewState

	wake chan struct{}
	stop chan struct{}
	done chan struct{}
}

func newAttributeViewRefresher(
	storeFn func() attributeViewRefreshStore,
	metricsFn func() attributeViewRefreshMetrics,
	enabled func() bool,
	clock refresherClock,
	logger mlog.LoggerIFace,
) *attributeViewRefresher {
	r := &attributeViewRefresher{
		store:   storeFn,
		metrics: metricsFn,
		enabled: enabled,
		clock:   clock,
		logger:  logger,
		timings: defaultAttributeViewTimings,
		views:   make(map[string]*attributeViewState, len(attributeViewObjectTypes)),
		wake:    make(chan struct{}, 1),
	}
	for _, objectType := range attributeViewObjectTypes {
		r.views[objectType] = &attributeViewState{}
	}
	return r
}

func (r *attributeViewRefresher) setTimings(t attributeViewTimings) {
	r.mu.Lock()
	r.timings = t
	r.mu.Unlock()
	r.signal()
}

func (r *attributeViewRefresher) getTimings() attributeViewTimings {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.timings
}

// mark records that a write made the given object types' views stale. It is cheap and never
// blocks: the loop refreshes. Marks are dropped while ABAC is off; types without a view are
// ignored.
func (r *attributeViewRefresher) mark(objectTypes ...string) {
	if r == nil || !r.enabled() {
		return
	}
	now := r.clock.Now()
	marked := false
	r.mu.Lock()
	for _, objectType := range objectTypes {
		state, ok := r.views[objectType]
		if !ok {
			continue
		}
		if state.firstMark.IsZero() {
			state.firstMark = now
		}
		state.lastMark = now
		marked = true
	}
	r.mu.Unlock()
	if marked {
		r.signal()
	}
}

func (r *attributeViewRefresher) markAll() {
	r.mark(attributeViewObjectTypes...)
}

func (r *attributeViewRefresher) signal() {
	select {
	case r.wake <- struct{}{}:
	default:
	}
}

// start runs the refresh loop until stopAndWait. Nothing is refreshed at startup: only marks
// trigger a refresh.
func (r *attributeViewRefresher) start() {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.stop != nil {
		return
	}
	r.stop = make(chan struct{})
	r.done = make(chan struct{})
	go r.loop(r.stop, r.done)
}

// stopAndWait stops the loop. A refresh in flight can't be cancelled (the store's transactions
// don't take a context), so this waits for it to finish; no new refresh starts.
func (r *attributeViewRefresher) stopAndWait() {
	if r == nil {
		return
	}
	r.mu.Lock()
	stop, done := r.stop, r.done
	r.stop, r.done = nil, nil
	r.mu.Unlock()
	if stop == nil {
		return
	}
	close(stop)
	<-done
}

func (r *attributeViewRefresher) loop(stop <-chan struct{}, done chan<- struct{}) {
	defer close(done)
	timer := time.NewTimer(time.Hour)
	defer timer.Stop()
	for {
		next := r.step(stop)
		wait := time.Hour
		if !next.IsZero() {
			wait = max(next.Sub(r.clock.Now()), time.Millisecond)
		}
		timer.Reset(wait)
		select {
		case <-stop:
			return
		case <-r.wake:
		case <-timer.C:
		}
	}
}

// step refreshes every view that is due and returns when the next one will be, or zero when
// every view is clean. It starts no refresh once stop is closed.
func (r *attributeViewRefresher) step(stop <-chan struct{}) time.Time {
	if !r.enabled() {
		r.reset()
		return time.Time{}
	}

	var next time.Time
	for _, objectType := range attributeViewObjectTypes {
		select {
		case <-stop:
			return time.Time{}
		default:
		}
		if due := r.stepView(objectType); !due.IsZero() && (next.IsZero() || due.Before(next)) {
			next = due
		}
	}

	if r.reportStaleness() {
		if gauge := r.clock.Now().Add(r.getTimings().staleness); next.IsZero() || gauge.Before(next) {
			next = gauge
		}
	}
	return next
}

// stepView refreshes one view if it is due, and returns when it is next due (zero when clean).
func (r *attributeViewRefresher) stepView(objectType string) time.Time {
	now := r.clock.Now()

	r.mu.Lock()
	state := r.views[objectType]
	t := r.timings
	if state.clean() {
		r.mu.Unlock()
		return time.Time{}
	}
	if now.Before(state.retryAt) {
		retryAt := state.retryAt
		r.mu.Unlock()
		return retryAt
	}
	if state.token.IsZero() {
		if due := debounceDue(state, t); now.Before(due) {
			r.mu.Unlock()
			return due
		}
	}
	token := state.token
	r.mu.Unlock()

	rctx := request.EmptyContext(r.logger)
	if token.IsZero() {
		// Taken after the writes it covers committed, on the master's clock. The marks move to
		// this refresh; writes from here on debounce on their own.
		var err error
		token, err = r.store().GetAttributeRefreshToken(rctx)
		if err != nil {
			return r.fail(objectType, err)
		}
		r.mu.Lock()
		state.token = token
		state.tokenFirstMark = state.firstMark
		state.firstMark, state.lastMark = time.Time{}, time.Time{}
		r.mu.Unlock()
	}

	result, err := r.store().RefreshAttributesIfStale(rctx, objectType, token, t.minGap)
	if err != nil {
		return r.fail(objectType, err)
	}
	r.recordResult(objectType, string(result.Outcome))

	r.mu.Lock()
	defer r.mu.Unlock()
	switch result.Outcome {
	case store.AttributeViewRefreshRefreshed, store.AttributeViewRefreshCovered:
		r.logger.Debug("Attribute view is up to date",
			mlog.String("object_type", objectType),
			mlog.String("result", string(result.Outcome)),
			mlog.Duration("duration", result.Duration),
		)
		state.token, state.tokenFirstMark = time.Time{}, time.Time{}
		state.retryAt, state.backoff = time.Time{}, 0
		if state.firstMark.IsZero() {
			return time.Time{}
		}
		return debounceDue(state, r.timings)
	case store.AttributeViewRefreshGap:
		r.logger.Debug("Attribute view was refreshed recently, retrying later",
			mlog.String("object_type", objectType),
			mlog.Duration("retry_after", result.RetryAfter),
		)
		state.retryAt = r.clock.Now().Add(max(result.RetryAfter, time.Millisecond))
	default:
		r.logger.Debug("Attribute view refresh is running elsewhere, retrying later",
			mlog.String("object_type", objectType),
			mlog.String("result", string(result.Outcome)),
		)
		state.retryAt = r.clock.Now().Add(r.timings.busyRetry)
	}
	return state.retryAt
}

// debounceDue is when a view with marks but no pending refresh is due. Callers hold r.mu.
func debounceDue(state *attributeViewState, t attributeViewTimings) time.Time {
	quiet := state.lastMark.Add(t.quiet)
	if maxWait := state.firstMark.Add(t.maxWait); maxWait.Before(quiet) {
		return maxWait
	}
	return quiet
}

// fail keeps the view's marks and token, and backs off before the next try.
func (r *attributeViewRefresher) fail(objectType string, err error) time.Time {
	r.logger.Warn("Failed to refresh the attribute view, retrying later",
		mlog.String("object_type", objectType),
		mlog.Err(err),
	)
	r.recordResult(objectType, attributeViewRefreshFailed)

	r.mu.Lock()
	defer r.mu.Unlock()
	state := r.views[objectType]
	if state.backoff == 0 {
		state.backoff = r.timings.backoffInitial
	} else {
		state.backoff = min(state.backoff*2, r.timings.backoffCap)
	}
	state.retryAt = r.clock.Now().Add(state.backoff)
	return state.retryAt
}

func (r *attributeViewRefresher) recordResult(objectType, result string) {
	if m := r.metrics(); m != nil {
		m.IncrementAttributeViewRefresh(objectType, result)
	}
}

// reportStaleness sets each view's staleness gauge, and reports whether any view has marks not
// yet refreshed.
func (r *attributeViewRefresher) reportStaleness() bool {
	now := r.clock.Now()
	m := r.metrics()

	r.mu.Lock()
	defer r.mu.Unlock()
	stale := false
	for _, objectType := range attributeViewObjectTypes {
		seconds := 0.0
		if oldest := r.views[objectType].oldestMark(); !oldest.IsZero() {
			stale = true
			seconds = max(now.Sub(oldest).Seconds(), 0)
		}
		if m != nil {
			m.SetAttributeViewStaleness(objectType, seconds)
		}
	}
	return stale
}

// reset drops every mark and pending refresh, while ABAC is off.
func (r *attributeViewRefresher) reset() {
	r.mu.Lock()
	for _, state := range r.views {
		*state = attributeViewState{}
	}
	r.mu.Unlock()
	r.reportStaleness()
}

// refreshForSync refreshes both views for the membership sync, ignoring the minimum gap. A view
// whose lock another session holds is retried with backoff; after the last retry it is left as
// it is with a Warn, and the sync runs on it. It stops early when rctx is cancelled.
func (r *attributeViewRefresher) refreshForSync(rctx request.CTX) error {
	s := r.store()
	t := r.getTimings()

	// One token for both views: every write committed before the sync started.
	token, err := s.GetAttributeRefreshToken(rctx)
	if err != nil {
		return errors.Wrap(err, "failed to read the attribute refresh token")
	}

	pending := slices.Clone(attributeViewObjectTypes)
	backoff := t.syncBackoffInitial
	for attempt := 0; ; attempt++ {
		var busy []string
		for _, objectType := range pending {
			result, rErr := s.RefreshAttributesIfStale(rctx, objectType, token, 0)
			if rErr != nil {
				r.recordResult(objectType, attributeViewRefreshFailed)
				return errors.Wrapf(rErr, "failed to refresh the %s attribute view", objectType)
			}
			r.recordResult(objectType, string(result.Outcome))
			if result.Outcome == store.AttributeViewRefreshBusy {
				busy = append(busy, objectType)
			}
		}
		if len(busy) == 0 {
			return nil
		}
		if attempt >= t.syncRetries {
			rctx.Logger().Warn(attributeViewSyncGaveUpLog,
				mlog.Array("object_types", busy),
				mlog.Int("retries", t.syncRetries),
			)
			return nil
		}
		pending = busy

		timer := time.NewTimer(backoff)
		select {
		case <-rctx.Context().Done():
			timer.Stop()
			return errors.Wrap(rctx.Context().Err(), "stopped waiting to refresh the attribute views")
		case <-timer.C:
		}
		backoff *= 2
	}
}

// attributeViewsEnabled is whether the attribute views are in use: while ABAC is off, nothing
// searches them and the membership sync doesn't run, so marks are dropped.
func attributeViewsEnabled(cfg *model.Config) bool {
	return cfg.AccessControlSettings.EnableAttributeBasedAccessControl != nil &&
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl
}

func (ch *Channels) newAttributeViewRefresher() *attributeViewRefresher {
	return newAttributeViewRefresher(
		func() attributeViewRefreshStore { return ch.srv.Store().Attributes() },
		func() attributeViewRefreshMetrics { return nil },
		func() bool { return attributeViewsEnabled(ch.cfgSvc.Config()) },
		systemClock{},
		ch.srv.Log(),
	)
}

// markAttributeViewsOnABACEnable marks every view stale when ABAC is turned on: writes made while
// it was off were never marked.
func (ch *Channels) markAttributeViewsOnABACEnable(prevCfg, cfg *model.Config) {
	if attributeViewsEnabled(cfg) && !attributeViewsEnabled(prevCfg) {
		ch.attributeViews.markAll()
	}
}

// MarkAttributeViewsDirty records that a write changed what the attribute views of the given
// object types (model.PropertyFieldObjectType*) hold. The views are refreshed in the background
// shortly after; types without a view are ignored.
func (a *App) MarkAttributeViewsDirty(objectTypes ...string) {
	a.ch.attributeViews.mark(objectTypes...)
}

// markAttributeViewsForFields marks the views of the fields' object types, for field and option
// changes, which change what the views hold without touching a property value.
func (a *App) markAttributeViewsForFields(fields ...*model.PropertyField) {
	objectTypes := make([]string, 0, len(fields))
	for _, field := range fields {
		if field != nil {
			objectTypes = append(objectTypes, field.ObjectType)
		}
	}
	a.MarkAttributeViewsDirty(objectTypes...)
}

// RefreshAttributeViewsForSync brings both attribute views up to date for the membership sync:
// every write committed before the call is in them when it returns nil, unless a refresh running
// elsewhere held a view's lock through every retry (about 4 minutes), which is logged and leaves
// that view as it is. It ignores the minimum gap between background refreshes, and returns early
// when rctx is cancelled.
func (a *App) RefreshAttributeViewsForSync(rctx request.CTX) error {
	return a.ch.attributeViews.refreshForSync(rctx)
}
