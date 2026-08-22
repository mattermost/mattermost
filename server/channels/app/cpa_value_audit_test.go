// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
)

// The CPA value sink writes through AddMeta rather than event parameters, so
// auditParam does not apply here.
func auditMeta(t *testing.T, rec map[string]any, key string) any {
	t.Helper()
	meta, ok := rec[model.AuditKeyMeta].(map[string]any)
	require.True(t, ok, "audit record has no meta")
	return meta[key]
}

func auditMetaHasKey(t *testing.T, rec map[string]any, key string) bool {
	t.Helper()
	meta, ok := rec[model.AuditKeyMeta].(map[string]any)
	require.True(t, ok, "audit record has no meta")
	_, present := meta[key]
	return present
}

// Pins the audit trail governance relies on to answer "who marked this channel,
// and as what". Asserts new_value is captured verbatim: masking hides some values
// from some administrators, so raw capture in the audit stream is a decision, and
// narrowing it must break this test rather than pass unnoticed.
func TestCPAValueChangeAuditForChannelValues(t *testing.T) {
	th := Setup(t).InitBasic(t)
	// LicenseCheckHook gates access_control writes on an Enterprise license.
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	capture := startPluginAuditCapture(t, th)

	rctx := request.TestContext(t)
	cpaGroup, groupErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, groupErr)

	newChannelField := func(t *testing.T) *model.PropertyField {
		t.Helper()
		field, fieldErr := th.App.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:    cpaGroup.ID,
			Name:       "chan_attr_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}, false, "")
		require.Nil(t, fieldErr)
		return field
	}

	writeValue := func(t *testing.T, field *model.PropertyField, raw string) *model.PropertyValue {
		t.Helper()
		values, upsertErr := th.App.UpsertPropertyValues(rctx, []*model.PropertyValue{{
			TargetID:   th.BasicChannel.Id,
			TargetType: model.PropertyFieldObjectTypeChannel,
			GroupID:    cpaGroup.ID,
			FieldID:    field.ID,
			Value:      json.RawMessage(raw),
		}}, model.PropertyFieldObjectTypeChannel, th.BasicChannel.Id, "")
		require.Nil(t, upsertErr)
		require.Len(t, values, 1)
		return values[0]
	}

	nextRecord := func(t *testing.T, fn func()) map[string]any {
		t.Helper()
		before := len(capture.recordsFor(model.AuditEventCPAValueChange))
		fn()
		records := capture.recordsFor(model.AuditEventCPAValueChange)
		require.Len(t, records, before+1, "expected exactly one new %s record", model.AuditEventCPAValueChange)
		return records[len(records)-1]
	}

	t.Run("upsert records the channel target, the field, and the new value verbatim", func(t *testing.T) {
		field := newChannelField(t)

		rec := nextRecord(t, func() { writeValue(t, field, `"AURORA"`) })

		require.Equal(t, model.AuditStatusSuccess, rec[model.AuditKeyStatus])
		require.Equal(t, model.AccessControlPropertyGroupName, auditMeta(t, rec, "group"))
		require.Equal(t, properties.ValueAuditActionUpsert, auditMeta(t, rec, "action"))
		require.Equal(t, model.PropertyFieldObjectTypeChannel, auditMeta(t, rec, "target_type"))
		require.Equal(t, th.BasicChannel.Id, auditMeta(t, rec, "target_id"))
		require.Equal(t, field.ID, auditMeta(t, rec, "field_id"))
		require.Equal(t, `"AURORA"`, auditMeta(t, rec, "new_value"))
	})

	t.Run("editing a value records the new value but not the previous one", func(t *testing.T) {
		field := newChannelField(t)
		writeValue(t, field, `"AURORA"`)

		rec := nextRecord(t, func() { writeValue(t, field, `"NOFORN"`) })

		require.Equal(t, properties.ValueAuditActionUpsert, auditMeta(t, rec, "action"))
		require.Equal(t, `"NOFORN"`, auditMeta(t, rec, "new_value"))

		// The sink supports prior_value but the upsert path never sets
		// ValueAuditEvent.Prev, so an edit has no before/after pair. Asserted so
		// the gap is visible rather than assumed absent.
		require.False(t, auditMetaHasKey(t, rec, "prior_value"))
	})

	t.Run("deleting a single value records the prior value and the value id", func(t *testing.T) {
		field := newChannelField(t)
		value := writeValue(t, field, `"ELEVATED"`)

		rec := nextRecord(t, func() {
			require.Nil(t, th.App.DeletePropertyValue(rctx, cpaGroup.ID, value.ID))
		})

		require.Equal(t, properties.ValueAuditActionDelete, auditMeta(t, rec, "action"))
		require.Equal(t, th.BasicChannel.Id, auditMeta(t, rec, "target_id"))
		require.Equal(t, field.ID, auditMeta(t, rec, "field_id"))
		require.Equal(t, value.ID, auditMeta(t, rec, "value_id"))
		require.Equal(t, `"ELEVATED"`, auditMeta(t, rec, "prior_value"))
	})

	t.Run("bulk deletes record the scope but carry no value payload", func(t *testing.T) {
		targetField := newChannelField(t)
		writeValue(t, targetField, `"UNCLASSIFIED"`)

		rec := nextRecord(t, func() {
			require.Nil(t, th.App.DeletePropertyValuesForTarget(rctx, cpaGroup.ID, model.PropertyFieldObjectTypeChannel, th.BasicChannel.Id))
		})
		require.Equal(t, properties.ValueAuditActionDeleteForTarget, auditMeta(t, rec, "action"))
		require.Equal(t, th.BasicChannel.Id, auditMeta(t, rec, "target_id"))
		require.False(t, auditMetaHasKey(t, rec, "prior_value"))
		require.False(t, auditMetaHasKey(t, rec, "new_value"))

		fieldScoped := newChannelField(t)
		writeValue(t, fieldScoped, `"SECRET"`)

		rec = nextRecord(t, func() {
			require.Nil(t, th.App.DeletePropertyValuesForField(rctx, cpaGroup.ID, fieldScoped.ID))
		})
		require.Equal(t, properties.ValueAuditActionDeleteForField, auditMeta(t, rec, "action"))
		require.Equal(t, fieldScoped.ID, auditMeta(t, rec, "field_id"))
		require.False(t, auditMetaHasKey(t, rec, "prior_value"))
		require.False(t, auditMetaHasKey(t, rec, "new_value"))
	})
}
