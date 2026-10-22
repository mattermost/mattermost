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

	// One hook holding several group configs, as server.go does for the CPA and post
	// attributes groups. Each block below registers the config it exercises, so a config
	// leaking into another group's checks shows up as a failure here.
	hook := NewFieldLimitHook(th.service)
	th.service.AddHook(hook)

	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_field_limit", Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	hook.AddGroupLimit(group.ID, &FieldLimitConfig{
		PerObjectType: map[string]int64{
			"user": 3,
		},
		GlobalLimit: 5,
	})

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
		otherGroup, groupErr := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_no_limits", Version: model.PropertyGroupVersionV2})
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

	// A per-target cap must count fields per (TargetType, TargetID), not across the whole
	// group. Conflating the two is what made the original group-wide cap proposal unusable:
	// one busy channel would exhaust the allowance for every other channel.
	t.Run("per-target limit", func(t *testing.T) {
		const perTarget = 3

		perTargetGroup, groupErr := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_per_target", Version: model.PropertyGroupVersionV2})
		require.NoError(t, groupErr)
		hook.AddGroupLimit(perTargetGroup.ID, &FieldLimitConfig{PerTarget: perTarget})

		makeTargetField := func(targetType, targetID string) *model.PropertyField {
			return &model.PropertyField{
				GroupID:    perTargetGroup.ID,
				Name:       "field_" + model.NewId(),
				Type:       model.PropertyFieldTypeText,
				TargetType: targetType,
				TargetID:   targetID,
				ObjectType: model.PropertyFieldObjectTypePost,
			}
		}

		channelA := model.NewId()
		channelB := model.NewId()

		var channelAFields []*model.PropertyField

		t.Run("allows fields up to the cap", func(t *testing.T) {
			for range perTarget {
				created, createErr := th.service.CreatePropertyField(th.Context, makeTargetField("channel", channelA))
				require.NoError(t, createErr)
				channelAFields = append(channelAFields, created)
			}
		})

		t.Run("rejects the field past the cap on the same target", func(t *testing.T) {
			_, createErr := th.service.CreatePropertyField(th.Context, makeTargetField("channel", channelA))
			require.Error(t, createErr)
			assert.Contains(t, createErr.Error(), "limit_reached")
			assert.ErrorIs(t, createErr, ErrTargetFieldLimitReached)
		})

		// The point of the whole block: channel A being full must not consume channel B's allowance.
		t.Run("a full target does not consume another target's allowance", func(t *testing.T) {
			for range perTarget {
				_, createErr := th.service.CreatePropertyField(th.Context, makeTargetField("channel", channelB))
				require.NoError(t, createErr)
			}

			_, createErr := th.service.CreatePropertyField(th.Context, makeTargetField("channel", channelB))
			require.Error(t, createErr)
			assert.ErrorIs(t, createErr, ErrTargetFieldLimitReached)
		})

		// System-level fields carry an empty TargetID. An empty string in a count predicate is a
		// plausible place to accidentally match every row, which would make the system target's
		// count include both channels above.
		t.Run("system target is capped independently of any channel", func(t *testing.T) {
			for range perTarget {
				_, createErr := th.service.CreatePropertyField(th.Context, makeTargetField("system", ""))
				require.NoError(t, createErr)
			}

			_, createErr := th.service.CreatePropertyField(th.Context, makeTargetField("system", ""))
			require.Error(t, createErr)
			assert.ErrorIs(t, createErr, ErrTargetFieldLimitReached)
		})

		// The count must exclude soft-deleted rows, or a channel that has churned through its
		// attributes is permanently wedged at the cap.
		t.Run("deleted fields free up allowance", func(t *testing.T) {
			require.Len(t, channelAFields, perTarget)

			_, createErr := th.service.CreatePropertyField(th.Context, makeTargetField("channel", channelA))
			require.Error(t, createErr)
			assert.ErrorIs(t, createErr, ErrTargetFieldLimitReached)

			require.NoError(t, th.service.DeletePropertyField(th.Context, perTargetGroup.ID, channelAFields[0].ID))

			_, createErr = th.service.CreatePropertyField(th.Context, makeTargetField("channel", channelA))
			require.NoError(t, createErr)
		})
	})

	// A group that configures only PerObjectType must be unaffected by the per-target check,
	// so the existing CPA limits keep behaving exactly as before.
	t.Run("group without a per-target limit is unaffected", func(t *testing.T) {
		noTargetGroup, groupErr := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "test_no_per_target", Version: model.PropertyGroupVersionV2})
		require.NoError(t, groupErr)
		hook.AddGroupLimit(noTargetGroup.ID, &FieldLimitConfig{
			PerObjectType: map[string]int64{model.PropertyFieldObjectTypeUser: 20},
		})

		targetID := model.NewId()
		makeUserField := func() *model.PropertyField {
			return &model.PropertyField{
				GroupID:    noTargetGroup.ID,
				Name:       "field_" + model.NewId(),
				Type:       model.PropertyFieldTypeText,
				TargetType: "channel",
				TargetID:   targetID,
				ObjectType: model.PropertyFieldObjectTypeUser,
			}
		}

		// Well past any plausible per-target cap, all on one target: only the object-type
		// limit bites.
		for range 20 {
			_, createErr := th.service.CreatePropertyField(th.Context, makeUserField())
			require.NoError(t, createErr)
		}

		_, createErr := th.service.CreatePropertyField(th.Context, makeUserField())
		require.Error(t, createErr)
		assert.ErrorIs(t, createErr, ErrFieldLimitReached)
		assert.NotErrorIs(t, createErr, ErrTargetFieldLimitReached)
	})
}
