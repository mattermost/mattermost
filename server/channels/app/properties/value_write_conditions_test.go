// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// recordingHook records, in each pre-hook, what the test says the check read.
type recordingHook struct {
	BasePropertyHook
	record func(c *valueWriteConditions)
}

func (h *recordingHook) run(rctx request.CTX) {
	if c := valueWriteConditionsFrom(rctx); h.record != nil && c != nil {
		h.record(c)
	}
}

func (h *recordingHook) PreCreatePropertyValue(rctx request.CTX, v *model.PropertyValue) (*model.PropertyValue, error) {
	h.run(rctx)
	return v, nil
}

func (h *recordingHook) PreUpdatePropertyValue(rctx request.CTX, _ string, v *model.PropertyValue) (*model.PropertyValue, error) {
	h.run(rctx)
	return v, nil
}

func (h *recordingHook) PreUpsertPropertyValue(rctx request.CTX, v *model.PropertyValue) (*model.PropertyValue, error) {
	h.run(rctx)
	return v, nil
}

func (h *recordingHook) PreUpsertPropertyValues(rctx request.CTX, vs []*model.PropertyValue) ([]*model.PropertyValue, error) {
	h.run(rctx)
	return vs, nil
}

func (h *recordingHook) PreDeletePropertyValuesForTarget(rctx request.CTX, _, _, _ string) error {
	h.run(rctx)
	return nil
}

func requireWriteConflict(t *testing.T, err error) {
	t.Helper()
	var appErr *model.AppError
	require.True(t, errors.As(err, &appErr), "got %v", err)
	assert.Equal(t, "app.property_value.write_conflict.app_error", appErr.Id)
	assert.Equal(t, http.StatusConflict, appErr.StatusCode)
}

func TestValueWriteConditions(t *testing.T) {
	th := Setup(t)
	hook := &recordingHook{}
	th.service.AddHook(hook)
	rctx := th.Context

	groupID := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV3).ID
	newField := func() *model.PropertyField {
		return th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "f " + model.NewId(),
		})
	}
	value := func(f *model.PropertyField, targetID, v string) *model.PropertyValue {
		raw, err := json.Marshal(v)
		require.NoError(t, err)
		return &model.PropertyValue{GroupID: groupID, FieldID: f.ID, TargetID: targetID, TargetType: model.PropertyValueTargetTypeUser, Value: raw}
	}
	// seed writes straight to the store, past the hooks.
	seed := func(f *model.PropertyField, targetID, v string) *model.PropertyValue {
		created, err := th.dbStore.PropertyValue().Create(value(f, targetID, v))
		require.NoError(t, err)
		return created
	}
	withValue := func(row *model.PropertyValue, v string) *model.PropertyValue {
		raw, err := json.Marshal(v)
		require.NoError(t, err)
		cp := *row
		cp.Value = raw
		return &cp
	}
	stored := func(f *model.PropertyField, targetID string) string {
		vals, err := th.dbStore.PropertyValue().SearchPropertyValues(rctx, model.PropertyValueSearchOpts{GroupID: groupID, FieldID: f.ID, TargetIDs: []string{targetID}, PerPage: 10})
		require.NoError(t, err)
		if len(vals) == 0 {
			return ""
		}
		var s string
		require.NoError(t, json.Unmarshal(vals[0].Value, &s))
		return s
	}
	recording := func(fn func(c *valueWriteConditions)) {
		hook.record = fn
		t.Cleanup(func() { hook.record = nil })
	}

	t.Run("upsert with a matching read writes", func(t *testing.T) {
		f, target := newField(), model.NewId()
		a := seed(f, target, "a")
		recording(func(c *valueWriteConditions) { c.expectStored(f.ID, target, a) })

		_, err := th.service.UpsertPropertyValue(rctx, value(f, target, "b"))
		require.NoError(t, err)
		assert.Equal(t, "b", stored(f, target))
	})

	t.Run("upsert with a stale read is refused and leaves the row", func(t *testing.T) {
		f, target := newField(), model.NewId()
		a := seed(f, target, "a")
		_, err := th.dbStore.PropertyValue().Upsert([]*model.PropertyValue{value(f, target, "c")})
		require.NoError(t, err)
		recording(func(c *valueWriteConditions) { c.expectStored(f.ID, target, a) })

		_, err = th.service.UpsertPropertyValue(rctx, value(f, target, "b"))
		requireWriteConflict(t, err)
		assert.Equal(t, "c", stored(f, target))
	})

	t.Run("upsert that read no row is refused when a live row exists", func(t *testing.T) {
		f, target := newField(), model.NewId()
		seed(f, target, "a")
		recording(func(c *valueWriteConditions) { c.expectStored(f.ID, target, nil) })

		_, err := th.service.UpsertPropertyValue(rctx, value(f, target, "b"))
		requireWriteConflict(t, err)
		assert.Equal(t, "a", stored(f, target))
	})

	t.Run("a stale read on one value of a batch refuses the whole batch", func(t *testing.T) {
		f1, f2, target := newField(), newField(), model.NewId()
		seed(f1, target, "a1")
		stale := seed(f2, target, "a2")
		_, err := th.dbStore.PropertyValue().Upsert([]*model.PropertyValue{value(f2, target, "c2")})
		require.NoError(t, err)
		recording(func(c *valueWriteConditions) { c.expectStored(f2.ID, target, stale) })

		_, err = th.service.UpsertPropertyValues(rctx, []*model.PropertyValue{value(f1, target, "b1"), value(f2, target, "b2")})
		requireWriteConflict(t, err)
		assert.Equal(t, "a1", stored(f1, target))
		assert.Equal(t, "c2", stored(f2, target))
	})

	t.Run("a hook that records nothing leaves the upsert unconditional", func(t *testing.T) {
		f, target := newField(), model.NewId()
		seed(f, target, "a")
		recording(nil)

		_, err := th.service.UpsertPropertyValue(rctx, value(f, target, "b"))
		require.NoError(t, err)
		assert.Equal(t, "b", stored(f, target))
	})

	t.Run("update with a matching read writes, with a stale one is refused", func(t *testing.T) {
		f, target := newField(), model.NewId()
		a := seed(f, target, "a")
		recording(func(c *valueWriteConditions) { c.expectStored(f.ID, target, a) })

		upd := withValue(a, "b")
		_, err := th.service.UpdatePropertyValue(rctx, groupID, upd)
		require.NoError(t, err)
		assert.Equal(t, "b", stored(f, target))

		// The row now holds "b", but the hook still says it read "a".
		upd = withValue(a, "d")
		_, err = th.service.UpdatePropertyValue(rctx, groupID, upd)
		requireWriteConflict(t, err)
		assert.Equal(t, "b", stored(f, target))
	})

	t.Run("create over a live row is a conflict, not a 500", func(t *testing.T) {
		f, target := newField(), model.NewId()
		seed(f, target, "a")
		recording(nil)

		_, err := th.service.CreatePropertyValue(rctx, value(f, target, "b"))
		requireWriteConflict(t, err)
		assert.Equal(t, "a", stored(f, target))
	})

	t.Run("a delete for a target leaves the fields the hook keeps", func(t *testing.T) {
		a, b, target := newField(), newField(), model.NewId()
		seed(a, target, "a")
		seed(b, target, "b")
		recording(func(c *valueWriteConditions) { c.keepField(b.ID) })

		require.NoError(t, th.service.DeletePropertyValuesForTarget(rctx, groupID, model.PropertyValueTargetTypeUser, target))
		assert.Equal(t, "", stored(a, target))
		assert.Equal(t, "b", stored(b, target))
	})

	t.Run("no record exists outside a write method", func(t *testing.T) {
		assert.Nil(t, valueWriteConditionsFrom(th.Context))
	})
}
