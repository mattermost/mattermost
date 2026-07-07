// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var errDenied = errors.New("access denied")

type recordingSink struct {
	calls []struct {
		rctx  request.CTX
		event ValueAuditEvent
	}
}

func (r *recordingSink) sink() ValueAuditSink {
	return func(_ request.CTX, e ValueAuditEvent) {
		r.calls = append(r.calls, struct {
			rctx  request.CTX
			event ValueAuditEvent
		}{event: e})
	}
}

func newRegisteredAuditHook(groupID string, sink ValueAuditSink) *PropertyValueAuditHook {
	h := NewPropertyValueAuditHook()
	h.RegisterGroup(groupID, sink)
	return h
}

func registerCPAGroup(tb testing.TB, th *TestHelper) string {
	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: model.AccessControlPropertyGroupName, Version: model.PropertyGroupVersionV2})
	require.NoError(tb, err)
	return group.ID
}

func TestPropertyValueAuditHook_PostCreate(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1", Value: []byte(`"v"`)}
	}

	t.Run("audits a successful create unconditionally", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		v := newValue()
		require.NoError(t, hook.PostCreatePropertyValue(th.Context, v, nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionCreate, rec.calls[0].event.Action)
		assert.True(t, rec.calls[0].event.Success())
		assert.Nil(t, rec.calls[0].event.Prev)
		assert.Equal(t, v, rec.calls[0].event.Current)
	})

	t.Run("audits a failed create", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		require.NoError(t, hook.PostCreatePropertyValue(th.Context, newValue(), errDenied))
		require.Len(t, rec.calls, 1)
		assert.False(t, rec.calls[0].event.Success())
		assert.Equal(t, errDenied, rec.calls[0].event.Err)
	})

	t.Run("audits each value in a batch and ignores unregistered groups", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		other := newValue()
		other.GroupID = "other"
		require.NoError(t, hook.PostCreatePropertyValues(th.Context, []*model.PropertyValue{newValue(), other, newValue()}, nil))
		require.Len(t, rec.calls, 2)
	})
}

func TestPropertyValueAuditHook_PostUpdate(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1", Value: []byte(`"v"`)}
	}

	t.Run("audits a changed value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpdatePropertyValue(th.Context, next, nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionUpdate, rec.calls[0].event.Action)
	})

	t.Run("audits an unchanged value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		require.NoError(t, hook.PostUpdatePropertyValue(th.Context, newValue(), nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionUpdate, rec.calls[0].event.Action)
	})

	t.Run("audits a failed update that intended a change", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpdatePropertyValue(th.Context, next, errDenied))
		require.Len(t, rec.calls, 1)
		assert.False(t, rec.calls[0].event.Success())
	})

	t.Run("audits each value in a batch", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		changed := newValue()
		changed.Value = []byte(`"changed"`)
		values := []*model.PropertyValue{newValue(), changed}
		require.NoError(t, hook.PostUpdatePropertyValues(th.Context, values, nil))
		require.Len(t, rec.calls, 2)
		assert.Equal(t, ValueAuditActionUpdate, rec.calls[0].event.Action)
		assert.Equal(t, ValueAuditActionUpdate, rec.calls[1].event.Action)
	})
}

func TestPropertyValueAuditHook_PostUpsert(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1", Value: []byte(`"v"`)}
	}

	t.Run("audits a new value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, newValue(), nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionUpsert, rec.calls[0].event.Action)
		assert.Equal(t, "f1", rec.calls[0].event.FieldID)
		assert.True(t, rec.calls[0].event.Success())
	})

	t.Run("audits an unchanged value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, newValue(), nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionUpsert, rec.calls[0].event.Action)
	})

	t.Run("audits a changed value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, next, nil))
		require.Len(t, rec.calls, 1)
	})

	t.Run("ignores values in an unregistered group", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		v := newValue()
		v.GroupID = "other"
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, v, nil))
		assert.Empty(t, rec.calls)
	})

	t.Run("audits a failed write", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, next, errDenied))
		require.Len(t, rec.calls, 1)
		assert.False(t, rec.calls[0].event.Success())
		assert.Equal(t, next, rec.calls[0].event.Current)
		assert.Equal(t, errDenied, rec.calls[0].event.Err)
	})

	t.Run("audits a failed write with an unchanged value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, newValue(), errDenied))
		require.Len(t, rec.calls, 1)
		assert.False(t, rec.calls[0].event.Success())
	})
}

func TestPropertyValueAuditHook_PostDelete(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)
	rec := &recordingSink{}
	hook := newRegisteredAuditHook(managed, rec.sink())

	require.NoError(t, hook.PostDeletePropertyValue(th.Context, &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1"}, nil))
	require.NoError(t, hook.PostDeletePropertyValuesForTarget(th.Context, managed, "user", "u1", nil))
	require.NoError(t, hook.PostDeletePropertyValuesForField(th.Context, managed, "f1", nil))

	// A failed delete of an existing value is a legitimate failure → audited.
	require.NoError(t, hook.PostDeletePropertyValue(th.Context, &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u2", FieldID: "f1"}, errDenied))

	// A nil snapshot (value did not exist) is a no-op → not audited.
	require.NoError(t, hook.PostDeletePropertyValue(th.Context, nil, nil))

	// Unregistered group is ignored on every delete variant.
	require.NoError(t, hook.PostDeletePropertyValue(th.Context, &model.PropertyValue{GroupID: "other"}, nil))
	require.NoError(t, hook.PostDeletePropertyValuesForTarget(th.Context, "other", "user", "u1", nil))
	require.NoError(t, hook.PostDeletePropertyValuesForField(th.Context, "other", "f1", nil))

	require.Len(t, rec.calls, 4)
	assert.Equal(t, ValueAuditActionDelete, rec.calls[0].event.Action)
	assert.True(t, rec.calls[0].event.Success())
	assert.Equal(t, ValueAuditActionDeleteForTarget, rec.calls[1].event.Action)
	assert.Equal(t, ValueAuditActionDeleteForField, rec.calls[2].event.Action)
	assert.Equal(t, ValueAuditActionDelete, rec.calls[3].event.Action)
	assert.False(t, rec.calls[3].event.Success())
}

// TestPropertyValueAuditHook_ServiceUpsert exercises the full service path:
// every write, including an identical re-upsert, is audited.
func TestPropertyValueAuditHook_ServiceUpsert(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)
	rec := &recordingSink{}
	valueAuditHook := NewPropertyValueAuditHook()
	valueAuditHook.RegisterGroup(managed, rec.sink())
	th.service.AddHook(valueAuditHook)

	field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:    managed,
		Name:       "attr_" + model.NewId()[:8],
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	})

	rctx := RequestContextWithCallerID(th.Context, model.CallerIDLDAPSync)
	value := &model.PropertyValue{
		GroupID:    managed,
		FieldID:    field.ID,
		TargetType: model.PropertyFieldObjectTypeUser,
		TargetID:   model.NewId(),
		Value:      []byte(`"synced"`),
	}

	_, err := th.service.UpsertPropertyValue(rctx, value)
	require.NoError(t, err)
	require.Len(t, rec.calls, 1, "first write should audit")

	rec.calls = nil
	same := &model.PropertyValue{
		GroupID:    managed,
		FieldID:    field.ID,
		TargetType: model.PropertyFieldObjectTypeUser,
		TargetID:   value.TargetID,
		Value:      []byte(`"synced"`),
	}
	_, err = th.service.UpsertPropertyValue(rctx, same)
	require.NoError(t, err)
	require.Len(t, rec.calls, 1, "identical re-write should audit")
}
