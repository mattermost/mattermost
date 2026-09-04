// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
)

func TestBuildCPAValueAuditRecord(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	createField := func(t *testing.T, field *model.PropertyField) *model.PropertyField {
		field.GroupID = groupID
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		return created
	}

	t.Run("a tier-allowed write records basis_tier and no grant meta", func(t *testing.T) {
		field := createField(t, &model.PropertyField{
			Name:       "tier basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelEveryone},
				},
			},
		})

		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)
		rec := th.App.buildCPAValueAuditRecord(rctx, properties.ValueAuditEvent{
			Action:     properties.ValueAuditActionCreate,
			TargetType: model.PropertyFieldObjectTypeUser,
			TargetID:   th.BasicUser.Id,
			FieldID:    field.ID,
			Current:    &model.PropertyValue{Value: []byte(`"v"`)},
		})

		assert.Equal(t, model.PermissionLevelEveryone, rec.Meta["basis_tier"])
		assert.NotContains(t, rec.Meta, "basis_grant_id")
	})

	t.Run("a grant-allowed write records basis_grant_id, and wildcard only for a wildcard grant", func(t *testing.T) {
		field := createField(t, &model.PropertyField{
			Name:       "grant basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Write: model.PermissionLevelNone},
				},
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser.Id},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		})

		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)
		rec := th.App.buildCPAValueAuditRecord(rctx, properties.ValueAuditEvent{
			Action:     properties.ValueAuditActionCreate,
			TargetType: model.PropertyFieldObjectTypeUser,
			TargetID:   th.BasicUser.Id,
			FieldID:    field.ID,
			Current:    &model.PropertyValue{Value: []byte(`"v"`)},
		})

		assert.Equal(t, th.BasicUser.Id, rec.Meta["basis_grant_id"])
		assert.NotContains(t, rec.Meta, "basis_grant_wildcard")

		wildcardField := createField(t, &model.PropertyField{
			Name:       "wildcard grant basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "*"},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		})
		pluginRctx := RequestContextWithCallerID(th.Context, "com.example.plugin")
		wildcardRec := th.App.buildCPAValueAuditRecord(pluginRctx, properties.ValueAuditEvent{
			Action:     properties.ValueAuditActionCreate,
			TargetType: model.PropertyFieldObjectTypeUser,
			TargetID:   model.NewId(),
			FieldID:    wildcardField.ID,
			Current:    &model.PropertyValue{Value: []byte(`"v"`)},
		})
		assert.Equal(t, "*", wildcardRec.Meta["basis_grant_id"])
		assert.Equal(t, true, wildcardRec.Meta["basis_grant_wildcard"])
	})

	t.Run("a write to a field created without permissions records the converted restriction tier", func(t *testing.T) {
		field := createField(t, &model.PropertyField{
			Name:       "no permissions basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})

		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)
		rec := th.App.buildCPAValueAuditRecord(rctx, properties.ValueAuditEvent{
			Action:     properties.ValueAuditActionCreate,
			TargetType: model.PropertyFieldObjectTypeUser,
			TargetID:   th.BasicUser.Id,
			FieldID:    field.ID,
			Current:    &model.PropertyValue{Value: []byte(`"v"`)},
		})

		assert.Equal(t, model.PermissionLevelMember, rec.Meta["basis_tier"])
		assert.NotContains(t, rec.Meta, "basis_grant_id")
	})

	t.Run("a write changing the caller's own holdings on a masked field is called out", func(t *testing.T) {
		maskedField := createField(t, &model.PropertyField{
			Name:       "masked holdings basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Masking: &model.Masking{},
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser.Id},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		})
		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)

		ownValueRec := th.App.buildCPAValueAuditRecord(rctx, properties.ValueAuditEvent{
			Action:     properties.ValueAuditActionCreate,
			TargetType: model.PropertyFieldObjectTypeUser,
			TargetID:   th.BasicUser.Id,
			FieldID:    maskedField.ID,
			Current:    &model.PropertyValue{Value: []byte(`"v"`)},
		})
		assert.Equal(t, true, ownValueRec.Meta["basis_holdings_change"])

		otherValueRec := th.App.buildCPAValueAuditRecord(rctx, properties.ValueAuditEvent{
			Action:     properties.ValueAuditActionCreate,
			TargetType: model.PropertyFieldObjectTypeUser,
			TargetID:   th.BasicUser2.Id,
			FieldID:    maskedField.ID,
			Current:    &model.PropertyValue{Value: []byte(`"v"`)},
		})
		assert.NotContains(t, otherValueRec.Meta, "basis_holdings_change")

		unmaskedField := createField(t, &model.PropertyField{
			Name:       "unmasked holdings basis",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Grants: []model.Grant{
					{
						Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser.Id},
						Allow:    []string{model.PropertyActionValueWrite},
					},
				},
			},
		})
		unmaskedRec := th.App.buildCPAValueAuditRecord(rctx, properties.ValueAuditEvent{
			Action:     properties.ValueAuditActionCreate,
			TargetType: model.PropertyFieldObjectTypeUser,
			TargetID:   th.BasicUser.Id,
			FieldID:    unmaskedField.ID,
			Current:    &model.PropertyValue{Value: []byte(`"v"`)},
		})
		assert.NotContains(t, unmaskedRec.Meta, "basis_holdings_change")
	})

	t.Run("delete_for_target emits its record with no basis meta and no field fetch", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)
		rec := th.App.buildCPAValueAuditRecord(rctx, properties.ValueAuditEvent{
			Action:     properties.ValueAuditActionDeleteForTarget,
			TargetType: model.PropertyFieldObjectTypeUser,
			TargetID:   th.BasicUser.Id,
		})

		assert.Equal(t, th.BasicUser.Id, rec.Meta["caller_id"])
		for _, key := range []string{
			"basis_tier", "basis_grant_id", "basis_grant_scope", "basis_grant_wildcard",
			"basis_unrestricted", "basis_holdings_change",
		} {
			assert.NotContains(t, rec.Meta, key)
		}
	})

	t.Run("an event naming a field that does not exist still emits a record carrying the caller identity", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, th.BasicUser.Id)
		rec := th.App.buildCPAValueAuditRecord(rctx, properties.ValueAuditEvent{
			Action:     properties.ValueAuditActionCreate,
			TargetType: model.PropertyFieldObjectTypeUser,
			TargetID:   th.BasicUser.Id,
			FieldID:    model.NewId(),
			Current:    &model.PropertyValue{Value: []byte(`"v"`)},
		})

		assert.Equal(t, th.BasicUser.Id, rec.Meta["caller_id"])
		for _, key := range []string{
			"basis_tier", "basis_grant_id", "basis_grant_scope", "basis_grant_wildcard",
			"basis_unrestricted", "basis_holdings_change",
		} {
			assert.NotContains(t, rec.Meta, key)
		}
	})
}

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

	// Named caller: a converted field's value.write tier is member, measured
	// against the channel the value hangs off, and BasicUser is a member of
	// BasicChannel. An unnamed caller is refused outright, which is the point of
	// the model rather than something for this test to work around.
	rctx := RequestContextWithCallerID(request.TestContext(t), th.BasicUser.Id)
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
