// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (s LocalCachePropertyFieldStore) Create(field *model.PropertyField) (*model.PropertyField, error) {
	created, err := s.PropertyFieldStore.Create(field)
	if err != nil {
		return nil, err
	}

	s.InvalidateFieldsForGroup(created.GroupID)
	return created, nil
}

func (s LocalCachePropertyFieldStore) Update(groupID string, fields []*model.PropertyField, expectedUpdateAts map[string]int64) ([]*model.PropertyField, error) {
	updated, err := s.PropertyFieldStore.Update(groupID, fields, expectedUpdateAts)
	if err != nil {
		return nil, err
	}

	// The returned slice includes both the requested fields and any linked
	// fields whose derived option list the update changed. Invalidate each
	// distinct group so all affected GetForGroup caches are cleared.
	invalidated := make(map[string]bool, len(updated))
	for _, field := range updated {
		if invalidated[field.GroupID] {
			continue
		}
		invalidated[field.GroupID] = true
		s.InvalidateFieldsForGroup(field.GroupID)
	}
	return updated, nil
}

func (s LocalCachePropertyFieldStore) MutateOptions(groupID, fieldID string, expectedUpdateAt int64, upsert []*model.PropertyFieldOption, add, remove []*model.PropertyOptionEdge) error {
	if err := s.PropertyFieldStore.MutateOptions(groupID, fieldID, expectedUpdateAt, upsert, add, remove); err != nil {
		return err
	}

	s.invalidateForOptionChange(groupID)
	return nil
}

func (s LocalCachePropertyFieldStore) DeleteOptions(groupID, fieldID string, expectedUpdateAt int64, optionIDs []string) error {
	if err := s.PropertyFieldStore.DeleteOptions(groupID, fieldID, expectedUpdateAt, optionIDs); err != nil {
		return err
	}

	s.invalidateForOptionChange(groupID)
	return nil
}

func (s LocalCachePropertyFieldStore) PermanentDeleteOwnedOptions(groupID, fieldID string) error {
	if err := s.PropertyFieldStore.PermanentDeleteOwnedOptions(groupID, fieldID); err != nil {
		return err
	}

	s.invalidateForOptionChange(groupID)
	return nil
}

// invalidateForOptionChange drops the cached fields of the group whose field
// just had its options or their hierarchy changed. Neither kind of change writes
// a column of the field, but both move its UpdateAt -- which is how clients hear
// about them -- so a cached copy would go on reporting that nothing had changed.
//
// One group is enough even though the change is visible through more than one
// field: a field linking to this one serves the template's options as its own, so
// what it reads back changed too, and a link never crosses property groups.
func (s LocalCachePropertyFieldStore) invalidateForOptionChange(groupID string) {
	s.InvalidateFieldsForGroup(groupID)
}

func (s LocalCachePropertyFieldStore) Delete(groupID string, id string) error {
	if err := s.PropertyFieldStore.Delete(groupID, id); err != nil {
		return err
	}

	s.InvalidateFieldsForGroup(groupID)
	return nil
}

type LocalCachePropertyFieldStore struct {
	store.PropertyFieldStore
	rootStore *LocalCacheStore
}

func (s *LocalCachePropertyFieldStore) handleClusterInvalidatePropertyField(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		if err := s.rootStore.propertyFieldCache.Purge(); err != nil {
			s.rootStore.logger.Warn("failed to purge property field cache", mlog.Err(err))
		}
	} else if err := s.rootStore.propertyFieldCache.RemoveMulti([]string{string(msg.Data), propertyFieldVersionKey(string(msg.Data))}); err != nil {
		s.rootStore.logger.Warn("failed to remove property field cache entry", mlog.Err(err))
	}
}

func propertyFieldVersionKey(groupID string) string {
	return groupID + "_version"
}

func (s LocalCachePropertyFieldStore) InvalidateFieldsForGroup(groupID string) {
	s.rootStore.doInvalidateCacheCluster(s.rootStore.propertyFieldCache, groupID, nil)
	// The version goes after the fields, so a version created in between can't be
	// paired with fields that are about to be dropped.
	if err := s.rootStore.propertyFieldCache.Remove(propertyFieldVersionKey(groupID)); err != nil {
		s.rootStore.logger.Warn("failed to remove property field version cache entry", mlog.Err(err))
	}
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter(s.rootStore.propertyFieldCache.Name())
	}
}

func (s *LocalCachePropertyFieldStore) getFieldsForGroupFromCache(groupID string) ([]*model.PropertyField, bool) {
	var fields []*model.PropertyField
	if err := s.rootStore.doStandardReadCache(s.rootStore.propertyFieldCache, groupID, &fields); err == nil {
		return fields, true
	}
	return nil, false
}

func (s LocalCachePropertyFieldStore) GetForGroup(rctx request.CTX, groupID string) ([]*model.PropertyField, error) {
	if fields, ok := s.getFieldsForGroupFromCache(groupID); ok {
		return fields, nil
	}

	fields, err := s.PropertyFieldStore.GetForGroup(rctx, groupID)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.propertyFieldCache, groupID, fields)
	return fields, nil
}

// GetForGroupVersion returns a token that changes whenever the group's cached
// fields are dropped, so callers can keep values derived from GetForGroup until
// it does.
func (s LocalCachePropertyFieldStore) GetForGroupVersion(rctx request.CTX, groupID string) (string, error) {
	var version string
	if err := s.rootStore.doStandardReadCache(s.rootStore.propertyFieldCache, propertyFieldVersionKey(groupID), &version); err == nil {
		return version, nil
	}

	version, err := s.PropertyFieldStore.GetForGroupVersion(rctx, groupID)
	if err != nil {
		return "", err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.propertyFieldCache, propertyFieldVersionKey(groupID), version)
	return version, nil
}
