// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequiresAccessControlFailsClosed(t *testing.T) {
	th := Setup(t)
	rctx := th.Context

	// Use an unregistered group — this means any call to
	// requiresAccessControl will fail to look up the group.
	// The service must return an error rather than silently bypassing
	// access control.
	unregisteredGroupID := model.NewId()

	t.Run("CreatePropertyField returns error when group lookup fails", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    unregisteredGroupID,
			Name:       "test-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		}
		_, err := th.service.CreatePropertyField(rctx, field)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
	})

	t.Run("GetPropertyField returns error when group lookup fails", func(t *testing.T) {
		_, err := th.service.GetPropertyField(rctx, unregisteredGroupID, model.NewId())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
	})

	t.Run("GetPropertyFields returns error when group lookup fails", func(t *testing.T) {
		_, err := th.service.GetPropertyFields(rctx, unregisteredGroupID, []string{model.NewId()})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
	})

	t.Run("UpdatePropertyField returns error when group lookup fails", func(t *testing.T) {
		field := &model.PropertyField{
			ID:         model.NewId(),
			GroupID:    unregisteredGroupID,
			Name:       "test-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		}
		_, err := th.service.UpdatePropertyField(rctx, unregisteredGroupID, field)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
	})

	t.Run("DeletePropertyField returns error when group lookup fails", func(t *testing.T) {
		err := th.service.DeletePropertyField(rctx, unregisteredGroupID, model.NewId())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
	})

	t.Run("SearchPropertyFields returns error when group lookup fails", func(t *testing.T) {
		_, err := th.service.SearchPropertyFields(rctx, unregisteredGroupID, model.PropertyFieldSearchOpts{})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
	})
}

func TestCountActivePropertyFieldsForGroup(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context

	t.Run("should return count of active property fields for a group", func(t *testing.T) {
		groupID := model.NewId()

		// Create some property fields
		for range 5 {
			th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:    groupID,
				TargetType: "user",
				Type:       model.PropertyFieldTypeText,
				Name:       "Property " + model.NewId(),
			})
		}

		count, err := th.service.CountActivePropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(5), count)
	})

	t.Run("should return 0 for empty group", func(t *testing.T) {
		groupID := model.NewId()

		count, err := th.service.CountActivePropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})

	t.Run("should not count deleted fields", func(t *testing.T) {
		groupID := model.NewId()

		// Create 3 fields
		for range 3 {
			th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:    groupID,
				TargetType: "user",
				Type:       model.PropertyFieldTypeText,
				Name:       "Active " + model.NewId(),
			})
		}

		// Create and delete 2 fields
		for range 2 {
			field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:    groupID,
				TargetType: "user",
				Type:       model.PropertyFieldTypeText,
				Name:       "Deleted " + model.NewId(),
			})
			err := th.dbStore.PropertyField().Delete(groupID, field.ID)
			require.NoError(t, err)
		}

		count, err := th.service.CountActivePropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(3), count)
	})
}

func TestCountAllPropertyFieldsForGroup(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context

	t.Run("should return count of all property fields including deleted", func(t *testing.T) {
		groupID := model.NewId()

		// Create 5 active fields
		for range 5 {
			th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:    groupID,
				TargetType: "user",
				Type:       model.PropertyFieldTypeText,
				Name:       "Active " + model.NewId(),
			})
		}

		// Create and delete 3 fields
		for range 3 {
			field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:    groupID,
				TargetType: "user",
				Type:       model.PropertyFieldTypeText,
				Name:       "Deleted " + model.NewId(),
			})
			err := th.dbStore.PropertyField().Delete(groupID, field.ID)
			require.NoError(t, err)
		}

		count, err := th.service.CountAllPropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(8), count)
	})

	t.Run("should return 0 for empty group", func(t *testing.T) {
		groupID := model.NewId()

		count, err := th.service.CountAllPropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})

	t.Run("should return higher count than active fields when there are deleted fields", func(t *testing.T) {
		groupID := model.NewId()

		// Create 5 active fields
		for range 5 {
			th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:    groupID,
				TargetType: "user",
				Type:       model.PropertyFieldTypeText,
				Name:       "Active " + model.NewId(),
			})
		}

		// Create and delete 3 fields
		for range 3 {
			field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:    groupID,
				TargetType: "user",
				Type:       model.PropertyFieldTypeText,
				Name:       "Deleted " + model.NewId(),
			})
			err := th.dbStore.PropertyField().Delete(groupID, field.ID)
			require.NoError(t, err)
		}

		activeCount, err := th.service.CountActivePropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)

		allCount, err := th.service.CountAllPropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)

		assert.Equal(t, int64(5), activeCount)
		assert.Equal(t, int64(8), allCount)
		assert.True(t, allCount > activeCount)
	})
}
