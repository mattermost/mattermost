// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package eventbus

import (
	"cmp"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"slices"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
)

type pluginEntry struct {
	groups  map[string]model.EventGroup
	events  map[string]model.EventDescriptor
	actions map[string]model.ActionDescriptor
}

type registry struct {
	mu      sync.RWMutex
	plugins map[string]*pluginEntry
}

func newRegistry() *registry {
	return &registry{plugins: map[string]*pluginEntry{}}
}

// entry returns the plugin's entry, creating it. The caller must hold the write lock.
func (r *registry) entry(pluginID string) *pluginEntry {
	e := r.plugins[pluginID]
	if e == nil {
		e = &pluginEntry{
			groups:  map[string]model.EventGroup{},
			events:  map[string]model.EventDescriptor{},
			actions: map[string]model.ActionDescriptor{},
		}
		r.plugins[pluginID] = e
	}
	return e
}

// hasGroup reports whether the plugin registered the group. The caller must hold a lock.
func (r *registry) hasGroup(pluginID, group string) bool {
	e := r.plugins[pluginID]
	if e == nil {
		return false
	}
	_, ok := e.groups[group]
	return ok
}

func (r *registry) registerGroup(pluginID string, group model.EventGroup) error {
	if err := group.IsValid(); err != nil {
		return err
	}
	group.PublisherID = pluginID

	r.mu.Lock()
	defer r.mu.Unlock()
	r.entry(pluginID).groups[group.Name] = group
	return nil
}

func (r *registry) registerEvent(pluginID string, event model.EventDescriptor) error {
	event = cloneEvent(event)
	if err := event.Validate(); err != nil {
		return err
	}
	event.PublisherID = pluginID

	r.mu.Lock()
	defer r.mu.Unlock()
	if event.Group != "" && !r.hasGroup(pluginID, event.Group) {
		return model.ErrEventGroupNotRegistered.Wrapf("event %q names group %q", event.Name, event.Group)
	}
	r.entry(pluginID).events[event.Name] = event
	return nil
}

func (r *registry) registerAction(pluginID string, action model.ActionDescriptor) error {
	action = cloneAction(action)
	if err := action.Validate(); err != nil {
		return err
	}
	action.PublisherID = pluginID

	r.mu.Lock()
	defer r.mu.Unlock()
	if action.Group != "" && !r.hasGroup(pluginID, action.Group) {
		return model.ErrEventGroupNotRegistered.Wrapf("action %q names group %q", action.Type, action.Group)
	}
	r.entry(pluginID).actions[action.Type] = action
	return nil
}

// event returns the descriptor. Its slices are shared and must not be modified.
func (r *registry) event(pluginID, name string) (model.EventDescriptor, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	e := r.plugins[pluginID]
	if e == nil {
		return model.EventDescriptor{}, false
	}
	event, ok := e.events[name]
	return event, ok
}

// action returns the descriptor. Its slices are shared and must not be modified.
func (r *registry) action(pluginID, actionType string) (model.ActionDescriptor, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	e := r.plugins[pluginID]
	if e == nil {
		return model.ActionDescriptor{}, false
	}
	action, ok := e.actions[actionType]
	return action, ok
}

func (r *registry) drop(pluginID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.plugins, pluginID)
}

// catalog returns copies of every entry, sorted by publisher, then group, then name, with a
// SHA-256 hash over their canonical JSON.
func (r *registry) catalog() (*model.EventCatalog, error) {
	c := &model.EventCatalog{
		Groups:  []model.EventGroup{},
		Events:  []model.EventDescriptor{},
		Actions: []model.ActionDescriptor{},
	}

	r.mu.RLock()
	for _, e := range r.plugins {
		for _, group := range e.groups {
			c.Groups = append(c.Groups, group)
		}
		for _, event := range e.events {
			c.Events = append(c.Events, cloneEvent(event))
		}
		for _, action := range e.actions {
			c.Actions = append(c.Actions, cloneAction(action))
		}
	}
	r.mu.RUnlock()

	slices.SortFunc(c.Groups, func(a, b model.EventGroup) int {
		return cmp.Or(cmp.Compare(a.PublisherID, b.PublisherID), cmp.Compare(a.Name, b.Name))
	})
	slices.SortFunc(c.Events, func(a, b model.EventDescriptor) int {
		return cmp.Or(cmp.Compare(a.PublisherID, b.PublisherID), cmp.Compare(a.Group, b.Group), cmp.Compare(a.Name, b.Name))
	})
	slices.SortFunc(c.Actions, func(a, b model.ActionDescriptor) int {
		return cmp.Or(cmp.Compare(a.PublisherID, b.PublisherID), cmp.Compare(a.Group, b.Group), cmp.Compare(a.Type, b.Type))
	})

	canonical, err := json.Marshal(struct {
		Groups  []model.EventGroup       `json:"groups"`
		Events  []model.EventDescriptor  `json:"events"`
		Actions []model.ActionDescriptor `json:"actions"`
	}{c.Groups, c.Events, c.Actions})
	if err != nil {
		return nil, fmt.Errorf("failed to encode the event catalog: %w", err)
	}
	sum := sha256.Sum256(canonical)
	c.Hash = hex.EncodeToString(sum[:])

	return c, nil
}

func cloneEvent(event model.EventDescriptor) model.EventDescriptor {
	event.Fields = slices.Clone(event.Fields)
	event.AllowedSubscribers = slices.Clone(event.AllowedSubscribers)
	return event
}

func cloneAction(action model.ActionDescriptor) model.ActionDescriptor {
	action.Fields = slices.Clone(action.Fields)
	action.Results = slices.Clone(action.Results)
	action.Emits = slices.Clone(action.Emits)
	action.AllowedCallers = slices.Clone(action.AllowedCallers)
	return action
}
