// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBoundsHookFlag(t *testing.T) {
	th := Setup(t)
	rctx := RequestContextWithCallerID(th.Context, model.NewId())

	group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV3)

	boundsEnabled := false
	th.service.AddHook(NewBoundsHook(th.service, func() bool { return boundsEnabled }, nil))

	const disabledErrID = "app.property_field.bounds_disabled.app_error"
	raiseOnly := model.PropertyBoundsRule{Operator: model.PropertyBoundsOperatorAtOrAbove, Reference: model.PropertyBoundsReferenceSelf}
	lowerOnly := model.PropertyBoundsRule{Operator: model.PropertyBoundsOperatorAtOrBelow, Reference: model.PropertyBoundsReferenceSelf}

	newFieldIn := func(groupID string, fieldType model.PropertyFieldType, mutate func(f *model.PropertyField)) *model.PropertyField {
		f := &model.PropertyField{
			GroupID:     groupID,
			Name:        "field_" + model.NewId(),
			Type:        fieldType,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
			ObjectType:  model.PropertyFieldObjectTypeUser,
			Permissions: openPermissions(),
		}
		mutate(f)
		return f
	}
	newField := func(fieldType model.PropertyFieldType, mutate func(f *model.PropertyField)) *model.PropertyField {
		return newFieldIn(group.ID, fieldType, mutate)
	}
	requireAppError := func(t *testing.T, err error, id string) {
		t.Helper()
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, id, appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	}
	// create stores a field with the flag on, then restores it to off.
	create := func(t *testing.T, field *model.PropertyField) *model.PropertyField {
		t.Helper()
		boundsEnabled = true
		defer func() { boundsEnabled = false }()
		created, createErr := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, createErr)
		return created
	}
	// stored reads the field back, since a create's return has its own attrs.
	stored := func(t *testing.T, id string) *model.PropertyField {
		t.Helper()
		f, getErr := th.service.fieldStore.Get(th.Context, group.ID, id)
		require.NoError(t, getErr)
		return f
	}

	t.Run("off: a new rule or write_once is refused, mutable is fine", func(t *testing.T) {
		_, createErr := th.service.CreatePropertyField(rctx, newField(model.PropertyFieldTypeRank, func(f *model.PropertyField) {
			f.Bounds = model.PropertyBounds{raiseOnly}
		}))
		requireAppError(t, createErr, disabledErrID)

		_, createErr = th.service.CreatePropertyField(rctx, newField(model.PropertyFieldTypeText, func(f *model.PropertyField) {
			f.Mutability = model.PropertyFieldMutabilityWriteOnce
		}))
		requireAppError(t, createErr, disabledErrID)

		_, createErr = th.service.CreatePropertyField(rctx, newField(model.PropertyFieldTypeText, func(f *model.PropertyField) {
			f.Mutability = model.PropertyFieldMutabilityMutable
		}))
		require.NoError(t, createErr)
	})

	t.Run("on: rules and write_once can be created", func(t *testing.T) {
		boundsEnabled = true
		defer func() { boundsEnabled = false }()

		_, createErr := th.service.CreatePropertyField(rctx, newField(model.PropertyFieldTypeRank, func(f *model.PropertyField) {
			f.Bounds = model.PropertyBounds{raiseOnly}
		}))
		require.NoError(t, createErr)
		_, createErr = th.service.CreatePropertyField(rctx, newField(model.PropertyFieldTypeText, func(f *model.PropertyField) {
			f.Mutability = model.PropertyFieldMutabilityWriteOnce
		}))
		require.NoError(t, createErr)
	})

	t.Run("off: a field that already has rules keeps working, but gains none", func(t *testing.T) {
		ruled := create(t, newField(model.PropertyFieldTypeRank, func(f *model.PropertyField) {
			f.Bounds = model.PropertyBounds{raiseOnly}
		}))

		adding := stored(t, ruled.ID)
		adding.Bounds = model.PropertyBounds{raiseOnly, lowerOnly}
		_, _, updateErr := th.service.UpdatePropertyField(rctx, group.ID, adding)
		requireAppError(t, updateErr, disabledErrID)

		echo := stored(t, ruled.ID)
		echo.Bounds = model.PropertyBounds{raiseOnly}
		_, _, updateErr = th.service.UpdatePropertyField(rctx, group.ID, echo)
		require.NoError(t, updateErr)

		unstated := stored(t, ruled.ID)
		unstated.Name = "renamed_" + model.NewId()
		unstated.Bounds, unstated.Mutability = nil, ""
		_, _, updateErr = th.service.UpdatePropertyField(rctx, group.ID, unstated)
		require.NoError(t, updateErr)
		assert.True(t, model.PropertyBoundsEqual(model.PropertyBounds{raiseOnly}, stored(t, ruled.ID).Bounds))

		removing := stored(t, ruled.ID)
		removing.Bounds = model.PropertyBounds{}
		_, _, updateErr = th.service.UpdatePropertyField(rctx, group.ID, removing)
		require.NoError(t, updateErr)
		assert.Empty(t, stored(t, ruled.ID).Bounds)
	})

	t.Run("off: reordering two rules is an echo", func(t *testing.T) {
		two := create(t, newField(model.PropertyFieldTypeRank, func(f *model.PropertyField) {
			f.Bounds = model.PropertyBounds{raiseOnly, lowerOnly}
		}))

		reordered := stored(t, two.ID)
		reordered.Bounds = model.PropertyBounds{lowerOnly, raiseOnly}
		_, _, updateErr := th.service.UpdatePropertyField(rctx, group.ID, reordered)
		require.NoError(t, updateErr)
	})

	t.Run("off: write_once can be lifted but not added to a mutable field", func(t *testing.T) {
		locked := create(t, newField(model.PropertyFieldTypeText, func(f *model.PropertyField) {
			f.Mutability = model.PropertyFieldMutabilityWriteOnce
		}))

		echo := stored(t, locked.ID)
		echo.Name = "renamed_" + model.NewId()
		_, _, updateErr := th.service.UpdatePropertyField(rctx, group.ID, echo)
		require.NoError(t, updateErr)

		lifted := stored(t, locked.ID)
		lifted.Mutability = model.PropertyFieldMutabilityMutable
		_, _, updateErr = th.service.UpdatePropertyField(rctx, group.ID, lifted)
		require.NoError(t, updateErr)

		relock := stored(t, locked.ID)
		relock.Mutability = model.PropertyFieldMutabilityWriteOnce
		_, _, updateErr = th.service.UpdatePropertyField(rctx, group.ID, relock)
		requireAppError(t, updateErr, disabledErrID)
	})

	t.Run("a nil provider is off", func(t *testing.T) {
		hook := NewBoundsHook(th.service, nil, nil)
		err := hook.validateBoundsChange(&model.PropertyField{Bounds: model.PropertyBounds{raiseOnly}}, nil)
		requireAppError(t, err, disabledErrID)
	})

	t.Run("set_on_create is refused whatever the flag says", func(t *testing.T) {
		for _, enabled := range []bool{false, true} {
			boundsEnabled = enabled
			_, createErr := th.service.CreatePropertyField(rctx, newField(model.PropertyFieldTypeText, func(f *model.PropertyField) {
				f.ObjectType = model.PropertyFieldObjectTypeChannel
				f.Mutability = model.PropertyFieldMutabilitySetOnCreate
			}))
			requireAppError(t, createErr, "app.property_field.set_on_create_unsupported.app_error")
		}
		boundsEnabled = false
	})

	t.Run("a v2 group's field passes the hook untouched", func(t *testing.T) {
		v2 := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		hook := NewBoundsHook(th.service, func() bool { return false }, nil)
		field := newFieldIn(v2.ID, model.PropertyFieldTypeRank, func(f *model.PropertyField) {
			f.Bounds = model.PropertyBounds{raiseOnly}
			f.Mutability = model.PropertyFieldMutabilitySetOnCreate
		})

		got, err := hook.PreCreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.Same(t, field, got)
	})

	t.Run("a group that does not resolve fails the hook, never passes it", func(t *testing.T) {
		hook := NewBoundsHook(th.service, func() bool { return true }, nil)
		field := newFieldIn(model.NewId(), model.PropertyFieldTypeRank, func(f *model.PropertyField) {})

		got, err := hook.PreCreatePropertyField(rctx, field)
		require.Error(t, err)
		assert.Nil(t, got)
	})

	t.Run("off: a batch with one field gaining a rule is refused whole", func(t *testing.T) {
		renamed := create(t, newField(model.PropertyFieldTypeText, func(f *model.PropertyField) {}))
		ruled := create(t, newField(model.PropertyFieldTypeRank, func(f *model.PropertyField) {}))
		originalName := renamed.Name

		renamed = stored(t, renamed.ID)
		renamed.Name = "renamed_" + model.NewId()
		ruled = stored(t, ruled.ID)
		ruled.Bounds = model.PropertyBounds{raiseOnly}

		_, _, _, err := th.service.UpdatePropertyFields(rctx, group.ID, []*model.PropertyField{renamed, ruled})
		requireAppError(t, err, disabledErrID)
		assert.Contains(t, err.Error(), ruled.ID)

		assert.Equal(t, originalName, stored(t, renamed.ID).Name)
		assert.Empty(t, stored(t, ruled.ID).Bounds)
	})

	t.Run("an update naming a field the group does not hold surfaces the lookup error", func(t *testing.T) {
		hook := NewBoundsHook(th.service, func() bool { return true }, nil)
		ghost := newField(model.PropertyFieldTypeText, func(f *model.PropertyField) { f.ID = model.NewId() })

		_, err := hook.PreUpdatePropertyField(rctx, group.ID, ghost)
		require.Error(t, err)

		_, err = hook.PreUpdatePropertyFields(rctx, group.ID, []*model.PropertyField{ghost})
		require.Error(t, err)

		got, err := hook.PreUpdatePropertyFields(rctx, group.ID, nil)
		require.NoError(t, err)
		assert.Empty(t, got)
	})
}
