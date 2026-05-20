// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

// RegisterBuiltinGroups registers a set of property groups at startup
// and populates the cache so that subsequent Group calls are free of
// database round-trips.
func (ps *PropertyService) RegisterBuiltinGroups(groups []*model.PropertyGroup) error {
	for _, group := range groups {
		if _, err := ps.RegisterPropertyGroup(group); err != nil {
			return fmt.Errorf("failed to register builtin property group %q: %w", group.Name, err)
		}
	}
	return nil
}

// Group returns the cached PropertyGroup for a given name. If the
// group is not in the cache (e.g. a plugin-registered group), it
// falls back to a database lookup and caches the result.
func (ps *PropertyService) Group(name string) (*model.PropertyGroup, error) {
	if cached, ok := ps.groupCache.Load(name); ok {
		return cached.(*model.PropertyGroup), nil
	}

	group, err := ps.groupStore.Get(name)
	if err != nil {
		return nil, fmt.Errorf("property group %q not found: %w", name, err)
	}

	ps.groupCache.Store(group.Name, group)
	ps.groupIDCache.Store(group.ID, group)
	return group, nil
}

// GroupByID returns the PropertyGroup for a given ID. It first checks
// the in-memory cache and falls back to a database lookup on cache
// miss, caching the result for subsequent calls.
func (ps *PropertyService) GroupByID(id string) (*model.PropertyGroup, error) {
	if cached, ok := ps.groupIDCache.Load(id); ok {
		return cached.(*model.PropertyGroup), nil
	}

	group, err := ps.groupStore.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("property group with id %q not found: %w", id, err)
	}

	ps.groupCache.Store(group.Name, group)
	ps.groupIDCache.Store(group.ID, group)
	return group, nil
}

func (ps *PropertyService) RegisterPropertyGroup(group *model.PropertyGroup) (*model.PropertyGroup, error) {
	registered, err := ps.groupStore.Register(group)
	if err != nil {
		return nil, err
	}

	ps.groupCache.Store(registered.Name, registered)
	ps.groupIDCache.Store(registered.ID, registered)
	return registered, nil
}

func (ps *PropertyService) GetPropertyGroup(name string) (*model.PropertyGroup, error) {
	return ps.groupStore.Get(name)
}
