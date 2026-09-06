// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestDefaultPropertyFieldPermissionLevel(t *testing.T) {
	t.Parallel()

	t.Run("template defaults to sysadmin", func(t *testing.T) {
		f := &model.PropertyField{ObjectType: model.PropertyFieldObjectTypeTemplate}
		assert.Equal(t, model.PermissionLevelSysadmin, DefaultPropertyFieldPermissionLevel(f))
	})

	t.Run("system defaults to sysadmin", func(t *testing.T) {
		f := &model.PropertyField{ObjectType: model.PropertyFieldObjectTypeSystem}
		assert.Equal(t, model.PermissionLevelSysadmin, DefaultPropertyFieldPermissionLevel(f))
	})

	t.Run("user defaults to member", func(t *testing.T) {
		f := &model.PropertyField{ObjectType: model.PropertyFieldObjectTypeUser}
		assert.Equal(t, model.PermissionLevelMember, DefaultPropertyFieldPermissionLevel(f))
	})

	t.Run("channel defaults to member", func(t *testing.T) {
		f := &model.PropertyField{ObjectType: model.PropertyFieldObjectTypeChannel}
		assert.Equal(t, model.PermissionLevelMember, DefaultPropertyFieldPermissionLevel(f))
	})

	t.Run("post defaults to member", func(t *testing.T) {
		f := &model.PropertyField{ObjectType: model.PropertyFieldObjectTypePost}
		assert.Equal(t, model.PermissionLevelMember, DefaultPropertyFieldPermissionLevel(f))
	})
}

func TestCanonicalizeSystemObjectField(t *testing.T) {
	t.Parallel()

	t.Run("system object: forces TargetType=system, empty TargetID, all permissions sysadmin", func(t *testing.T) {
		member := model.PermissionLevelMember
		f := &model.PropertyField{
			ObjectType:        model.PropertyFieldObjectTypeSystem,
			TargetType:        "channel",
			TargetID:          "ch1",
			PermissionField:   &member,
			PermissionValues:  &member,
			PermissionOptions: &member,
		}
		CanonicalizeSystemObjectField(f)
		assert.Equal(t, string(model.PropertyFieldTargetLevelSystem), f.TargetType)
		assert.Empty(t, f.TargetID)
		assert.NotNil(t, f.PermissionField)
		assert.Equal(t, model.PermissionLevelSysadmin, *f.PermissionField)
		assert.NotNil(t, f.PermissionValues)
		assert.Equal(t, model.PermissionLevelSysadmin, *f.PermissionValues)
		assert.NotNil(t, f.PermissionOptions)
		assert.Equal(t, model.PermissionLevelSysadmin, *f.PermissionOptions)
	})

	t.Run("non-system object: untouched", func(t *testing.T) {
		member := model.PermissionLevelMember
		f := &model.PropertyField{
			ObjectType:        model.PropertyFieldObjectTypeUser,
			TargetType:        "channel",
			TargetID:          "ch1",
			PermissionField:   &member,
			PermissionValues:  &member,
			PermissionOptions: &member,
		}
		CanonicalizeSystemObjectField(f)
		assert.Equal(t, "channel", f.TargetType)
		assert.Equal(t, "ch1", f.TargetID)
		assert.Equal(t, model.PermissionLevelMember, *f.PermissionField)
		assert.Equal(t, model.PermissionLevelMember, *f.PermissionValues)
		assert.Equal(t, model.PermissionLevelMember, *f.PermissionOptions)
	})

	t.Run("idempotent", func(t *testing.T) {
		f := &model.PropertyField{
			ObjectType: model.PropertyFieldObjectTypeSystem,
			TargetType: "channel",
			TargetID:   "ch1",
		}
		CanonicalizeSystemObjectField(f)
		first := *f
		CanonicalizeSystemObjectField(f)
		assert.Equal(t, first.TargetType, f.TargetType)
		assert.Equal(t, first.TargetID, f.TargetID)
	})

	t.Run("nil field: no panic", func(t *testing.T) {
		assert.NotPanics(t, func() {
			CanonicalizeSystemObjectField(nil)
		})
	})

	t.Run("creator is normalized to sysadmin, not rejected", func(t *testing.T) {
		// System-object fields have no creator, so PropertyField.IsValid
		// rejects PermissionLevelCreator on them. But canonicalization runs
		// before validation on every write path (the API handler and
		// App.CreatePropertyField), so a system field submitted with creator is
		// silently pinned to sysadmin and never reaches the rejection. This
		// test pins that precedence: if canonicalization ever moves after
		// validation, the IsValid call below starts failing.
		creator := model.PermissionLevelCreator
		f := &model.PropertyField{
			ID:                model.NewId(),
			GroupID:           model.NewId(),
			Name:              "system field",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeSystem,
			TargetType:        "channel",
			TargetID:          "ch1",
			PermissionField:   &creator,
			PermissionValues:  &creator,
			PermissionOptions: &creator,
			CreateAt:          model.GetMillis(),
			UpdateAt:          model.GetMillis(),
		}

		CanonicalizeSystemObjectField(f)

		assert.Equal(t, model.PermissionLevelSysadmin, *f.PermissionField)
		assert.Equal(t, model.PermissionLevelSysadmin, *f.PermissionValues)
		assert.Equal(t, model.PermissionLevelSysadmin, *f.PermissionOptions)
		assert.NoError(t, f.IsValid())
	})
}
