// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package signalbus

import (
	"cmp"
	"maps"
	"slices"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// SetSubscriptions validates subs and swaps them in whole for the plugin's current set. An empty
// set removes the plugin's queue. Deliveries already queued for removed subscriptions are dropped
// when dequeued.
func (b *Bus) SetSubscriptions(pluginID string, subs []model.SignalSubscription, opts model.SubscriptionOptions) error {
	if !b.isEnabled() {
		return model.ErrSignalBusDisabled
	}
	if !b.hooks.Implements(pluginID, plugin.OnSignalID) {
		return model.ErrSubscriberHookMissing
	}
	if opts.QueueSize < 0 || opts.Workers < 0 {
		return model.ErrSignalSubscriptionInvalid.Wrapf("queue size and workers must not be negative")
	}
	if err := model.ValidateSignalSubscriptions(subs); err != nil {
		return err
	}

	normalized := make([]*model.SignalSubscription, 0, len(subs))
	for _, sub := range subs {
		n, err := b.normalizeSubscription(sub)
		if err != nil {
			return err
		}
		normalized = append(normalized, n)
	}

	b.subs.set(pluginID, normalized, func(prev *queue) *queue {
		return newQueue(pluginID, b.queueSize, prev, b.deliver)
	})
	return nil
}

// normalizeSubscription copies sub and checks its filters against the declared fields when the
// pattern names a registered signal. Filters on other patterns are checked when matching.
func (b *Bus) normalizeSubscription(sub model.SignalSubscription) (*model.SignalSubscription, error) {
	pattern, err := model.ParseSignalPattern(sub.Signal)
	if err != nil {
		return nil, model.ErrSignalSubscriptionInvalid.Wrapf("subscription %q: %v", sub.ID, err)
	}

	var declared map[string]model.SignalValueType
	if pattern.Kind == model.SignalPatternExact {
		if signal, ok := b.registry.signal(pattern.Publisher, pattern.Name); ok {
			declared = make(map[string]model.SignalValueType, len(signal.Fields))
			for _, field := range signal.Fields {
				declared[field.Key] = field.Type
			}
		}
	}

	filters := make(map[string]model.SignalValue, len(sub.Filters))
	for key, value := range sub.Filters {
		fieldType := value.Type
		if declared != nil {
			var ok bool
			if fieldType, ok = declared[key]; !ok {
				return nil, model.ErrSignalSubscriptionInvalid.Wrapf("subscription %q filters on undeclared field %q", sub.ID, key)
			}
		}
		if err := value.Validate(fieldType, model.SignalTextMaxRunes, false); err != nil {
			return nil, model.ErrSignalSubscriptionInvalid.Wrapf("subscription %q filter %q: %v", sub.ID, key, err)
		}
		filters[key] = value
	}
	sub.Filters = filters

	return &sub, nil
}

type subscriber struct {
	byID  map[string]*model.SignalSubscription
	queue *queue
}

type subRef struct {
	pluginID string
	sub      *model.SignalSubscription
}

// subscriptionIndex is rebuilt whole on every change, so matching never sees a partial update.
type subscriptionIndex struct {
	exact     map[string][]subRef // publisher/name
	group     map[string][]subRef // publisher/group
	publisher map[string][]subRef // publisher
	all       []subRef
}

type subscriptionSet struct {
	mu          sync.RWMutex
	subscribers map[string]*subscriber
	// retired holds each plugin's last closed queue, whose worker may still be mid-delivery. The
	// plugin's next queue waits for it.
	retired map[string]*queue
	index   subscriptionIndex
}

func newSubscriptionSet() *subscriptionSet {
	s := &subscriptionSet{subscribers: map[string]*subscriber{}, retired: map[string]*queue{}}
	s.rebuildIndex()
	return s
}

// retire closes the plugin's queue and removes it. The caller must hold the write lock.
func (s *subscriptionSet) retire(pluginID string) {
	existing := s.subscribers[pluginID]
	if existing == nil {
		return
	}
	existing.queue.close()
	s.retired[pluginID] = existing.queue
	delete(s.subscribers, pluginID)
	s.rebuildIndex()
}

func (s *subscriptionSet) set(pluginID string, subs []*model.SignalSubscription, newQueue func(prev *queue) *queue) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(subs) == 0 {
		s.retire(pluginID)
		return
	}
	existing := s.subscribers[pluginID]

	byID := make(map[string]*model.SignalSubscription, len(subs))
	for _, sub := range subs {
		byID[sub.ID] = sub
	}
	if existing == nil {
		prev := s.retired[pluginID]
		delete(s.retired, pluginID)
		existing = &subscriber{queue: newQueue(prev)}
		s.subscribers[pluginID] = existing
	}
	existing.byID = byID
	s.rebuildIndex()
}

func (s *subscriptionSet) drop(pluginID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.retire(pluginID)
}

func (s *subscriptionSet) dropAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, existing := range s.subscribers {
		existing.queue.close()
	}
	s.subscribers = map[string]*subscriber{}
	s.retired = map[string]*queue{}
	s.rebuildIndex()
}

// rebuildIndex must be called with the write lock held.
func (s *subscriptionSet) rebuildIndex() {
	index := subscriptionIndex{
		exact:     map[string][]subRef{},
		group:     map[string][]subRef{},
		publisher: map[string][]subRef{},
	}
	for pluginID, existing := range s.subscribers {
		for _, sub := range existing.byID {
			ref := subRef{pluginID: pluginID, sub: sub}
			// Patterns were validated by SetSubscriptions.
			pattern, _ := model.ParseSignalPattern(sub.Signal)
			switch pattern.Kind {
			case model.SignalPatternExact:
				key := pattern.Publisher + "/" + pattern.Name
				index.exact[key] = append(index.exact[key], ref)
			case model.SignalPatternGroup:
				key := pattern.Publisher + "/" + pattern.Group
				index.group[key] = append(index.group[key], ref)
			case model.SignalPatternPublisher:
				index.publisher[pattern.Publisher] = append(index.publisher[pattern.Publisher], ref)
			case model.SignalPatternAll:
				index.all = append(index.all, ref)
			}
		}
	}
	s.index = index
}

type subscriberMatch struct {
	pluginID string
	queue    *queue
	matched  []*model.SignalSubscription
}

// match returns one entry per subscriber with every subscription the envelope matches.
func (s *subscriptionSet) match(env *signalEnvelope) []subscriberMatch {
	s.mu.RLock()
	defer s.mu.RUnlock()

	candidates := slices.Concat(
		s.index.exact[env.fullName()],
		s.index.publisher[env.PublisherID],
		s.index.all,
	)
	if env.Group != "" {
		candidates = append(candidates, s.index.group[env.PublisherID+"/"+env.Group]...)
	}

	byPlugin := map[string]*subscriberMatch{}
	for _, ref := range candidates {
		if !subscriptionMatches(ref, env) {
			continue
		}
		m := byPlugin[ref.pluginID]
		if m == nil {
			m = &subscriberMatch{pluginID: ref.pluginID, queue: s.subscribers[ref.pluginID].queue}
			byPlugin[ref.pluginID] = m
		}
		m.matched = append(m.matched, ref.sub)
	}

	matches := make([]subscriberMatch, 0, len(byPlugin))
	for _, pluginID := range slices.Sorted(maps.Keys(byPlugin)) {
		m := byPlugin[pluginID]
		slices.SortFunc(m.matched, func(a, b *model.SignalSubscription) int {
			return cmp.Compare(a.ID, b.ID)
		})
		matches = append(matches, *m)
	}
	return matches
}

func subscriptionMatches(ref subRef, env *signalEnvelope) bool {
	if ref.pluginID == env.PublisherID && !ref.sub.IncludeOwn {
		return false
	}
	if !env.isVisibleTo(ref.pluginID) {
		return false
	}
	for key, want := range ref.sub.Filters {
		got, ok := env.Payload[key]
		if !ok || !got.Equal(want) {
			return false
		}
	}
	return true
}

// current returns the IDs of the matched subscriptions the plugin still holds unchanged.
func (s *subscriptionSet) current(pluginID string, matched []*model.SignalSubscription) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	existing := s.subscribers[pluginID]
	if existing == nil {
		return nil
	}
	var ids []string
	for _, sub := range matched {
		if cur, ok := existing.byID[sub.ID]; ok && cur.Equal(sub) {
			ids = append(ids, sub.ID)
		}
	}
	return ids
}

// dispatch is the transport consumer: it matches the envelope and queues one delivery per
// subscriber without blocking.
func (b *Bus) dispatch(env *signalEnvelope) {
	for _, m := range b.subs.match(env) {
		ids := make([]string, len(m.matched))
		for i, sub := range m.matched {
			ids[i] = sub.ID
		}
		d := &model.SignalDelivery{
			ID:              env.ID + ":" + m.pluginID,
			EnvelopeID:      env.ID,
			Signal:          env.fullName(),
			PublisherID:     env.PublisherID,
			Version:         env.Version,
			Payload:         env.Payload,
			SubscriptionIDs: ids,
			TraceID:         env.TraceID,
			Hop:             env.Hop,
			OriginUserID:    env.OriginUserID,
			Cause:           env.Cause,
			EmittedAt:       env.EmittedAt,
		}
		if !m.queue.enqueue(&queuedDelivery{delivery: d, matched: m.matched}) {
			b.logger.Warn("Dropped signal delivery because the subscriber queue is full",
				mlog.String("subscriber", m.pluginID),
				mlog.String("signal", d.Signal),
				mlog.String("delivery_id", d.ID),
			)
		}
	}
}
