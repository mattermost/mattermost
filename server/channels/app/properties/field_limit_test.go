// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFieldLimitHook(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup("test_field_limit")
	require.NoError(t, err)

	hook := NewFieldLimitHook(th.service)
	hook.AddGroupLimit(group.ID, &FieldLimitConfig{
		PerObjectType: map[string]int64{
			"user": 3,
		},
		GlobalLimit: 5,
	})
	th.service.AddHook(hook)

	makeField := func(objectType string) *model.PropertyField {
		return &model.PropertyField{
			GroupID:    group.ID,
			Name:       "field_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			ObjectType: objectType,
		}
	}

	t.Run("allows fields up to per-object-type limit", func(t *testing.T) {
		for range 3 {
			_, createErr := th.service.CreatePropertyField(th.Context, makeField("user"))
			require.NoError(t, createErr)
		}
	})

	t.Run("rejects field at per-object-type limit", func(t *testing.T) {
		_, createErr := th.service.CreatePropertyField(th.Context, makeField("user"))
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "limit_reached")
	})

	t.Run("allows fields for different object type", func(t *testing.T) {
		_, createErr := th.service.CreatePropertyField(th.Context, makeField("post"))
		require.NoError(t, createErr)
	})

	t.Run("rejects at global limit", func(t *testing.T) {
		// We have 3 user + 1 post = 4 fields. One more should succeed.
		_, createErr := th.service.CreatePropertyField(th.Context, makeField("post"))
		require.NoError(t, createErr)

		// Now at 5, should hit global limit
		_, createErr = th.service.CreatePropertyField(th.Context, makeField("post"))
		require.Error(t, createErr)
		assert.Contains(t, createErr.Error(), "group_limit_reached")
	})

	t.Run("skips limit check for unregistered groups", func(t *testing.T) {
		otherGroup, groupErr := th.service.RegisterPropertyGroup("test_no_limits")
		require.NoError(t, groupErr)

		for range 10 {
			field := &model.PropertyField{
				GroupID:    otherGroup.ID,
				Name:       "field_" + model.NewId(),
				Type:       model.PropertyFieldTypeText,
				TargetType: "system",
				ObjectType: "user",
			}
			_, createErr := th.service.CreatePropertyField(th.Context, field)
			require.NoError(t, createErr)
		}
	})
}
