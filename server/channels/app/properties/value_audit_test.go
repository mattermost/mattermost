// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
		require.NoError(t, hook.PostCreatePropertyValue(th.Context, v))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionCreate, rec.calls[0].event.Action)
		assert.Nil(t, rec.calls[0].event.Prev)
		assert.Equal(t, v, rec.calls[0].event.Current)
	})

	t.Run("audits each value in a batch and ignores unregistered groups", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		other := newValue()
		other.GroupID = "other"
		require.NoError(t, hook.PostCreatePropertyValues(th.Context, []*model.PropertyValue{newValue(), other, newValue()}))
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
		require.NoError(t, hook.PostUpdatePropertyValue(th.Context, next))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionUpdate, rec.calls[0].event.Action)
	})

	t.Run("audits an unchanged value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		require.NoError(t, hook.PostUpdatePropertyValue(th.Context, newValue()))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionUpdate, rec.calls[0].event.Action)
	})

	t.Run("audits each value in a batch", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		changed := newValue()
		changed.Value = []byte(`"changed"`)
		values := []*model.PropertyValue{newValue(), changed}
		require.NoError(t, hook.PostUpdatePropertyValues(th.Context, values))
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
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, newValue()))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionUpsert, rec.calls[0].event.Action)
		assert.Equal(t, "f1", rec.calls[0].event.FieldID)
	})

	t.Run("audits an unchanged value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, newValue()))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionUpsert, rec.calls[0].event.Action)
	})

	t.Run("audits a changed value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, next))
		require.Len(t, rec.calls, 1)
	})

	t.Run("ignores values in an unregistered group", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		v := newValue()
		v.GroupID = "other"
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, v))
		assert.Empty(t, rec.calls)
	})
}

func TestPropertyValueAuditHook_PostDelete(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)
	rec := &recordingSink{}
	hook := newRegisteredAuditHook(managed, rec.sink())

	require.NoError(t, hook.PostDeletePropertyValue(th.Context, managed, "v1", &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1"}))
	require.NoError(t, hook.PostDeletePropertyValuesForTarget(th.Context, managed, "user", "u1"))
	require.NoError(t, hook.PostDeletePropertyValuesForField(th.Context, managed, "f1"))

	// Unregistered group is ignored on every delete variant.
	require.NoError(t, hook.PostDeletePropertyValue(th.Context, "other", "v3", &model.PropertyValue{GroupID: "other"}))
	require.NoError(t, hook.PostDeletePropertyValuesForTarget(th.Context, "other", "user", "u1"))
	require.NoError(t, hook.PostDeletePropertyValuesForField(th.Context, "other", "f1"))

	require.Len(t, rec.calls, 3)
	assert.Equal(t, ValueAuditActionDelete, rec.calls[0].event.Action)
	assert.Equal(t, "v1", rec.calls[0].event.ValueID)
	assert.Equal(t, ValueAuditActionDeleteForTarget, rec.calls[1].event.Action)
	assert.Equal(t, ValueAuditActionDeleteForField, rec.calls[2].event.Action)
}

func TestPropertyValueAuditHook_PostDeleteSparseSnapshot(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)
	rec := &recordingSink{}
	hook := newRegisteredAuditHook(managed, rec.sink())

	t.Run("audits a successful delete without a snapshot", func(t *testing.T) {
		require.NoError(t, hook.PostDeletePropertyValue(th.Context, managed, "value-id", nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionDelete, rec.calls[0].event.Action)
		assert.Equal(t, "value-id", rec.calls[0].event.ValueID)
	})
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
