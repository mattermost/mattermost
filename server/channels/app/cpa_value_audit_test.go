// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
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

	t.Run("a write to a field with no permissions records basis_legacy", func(t *testing.T) {
		field := createField(t, &model.PropertyField{
			Name:       "legacy basis",
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

		assert.Equal(t, true, rec.Meta["basis_legacy"])
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
			"basis_legacy", "basis_unrestricted", "basis_holdings_change",
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
			"basis_legacy", "basis_unrestricted", "basis_holdings_change",
		} {
			assert.NotContains(t, rec.Meta, key)
		}
	})
}
