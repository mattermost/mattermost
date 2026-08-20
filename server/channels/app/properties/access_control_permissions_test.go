// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// grantsField builds a CPA text field carrying the given grants under a typed
// permissions object, with no restrictions and no masking.
func grantsField(groupID, name string, grants []model.Grant) *model.PropertyField {
	return &model.PropertyField{
		GroupID:    groupID,
		Name:       name,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Permissions: &model.Permissions{
			Grants: grants,
		},
	}
}

func TestPermissionsGrantValueWriteAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner" || pluginID == "plugin-other"
	})

	newValueFor := func(fieldID string) *model.PropertyValue {
		return &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    fieldID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		}
	}

	t.Run("plugin with a value.write grant may write", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "GrantWrite", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionValueWrite}},
		}))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, "plugin-owner")
		_, upErr := th.service.UpsertPropertyValue(rctx, newValueFor(created.ID))
		require.NoError(t, upErr)
	})

	t.Run("plugin with only a value.read grant may not write", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "GrantReadOnly", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionValueRead}},
		}))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, "plugin-owner")
		_, upErr := th.service.UpsertPropertyValue(rctx, newValueFor(created.ID))
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("a plugin not named in grants may not write, even though the field has grants", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "GrantOther", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionValueWrite}},
		}))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, "plugin-other")
		_, upErr := th.service.UpsertPropertyValue(rctx, newValueFor(created.ID))
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("a wildcard plugin grant admits an arbitrary plugin id", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "GrantWildcard", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "*"}, Allow: []string{model.PropertyActionValueWrite}},
		}))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, "plugin-other")
		_, upErr := th.service.UpsertPropertyValue(rctx, newValueFor(created.ID))
		require.NoError(t, upErr)
	})

	t.Run("a scoped grant admits the matching scope and refuses another scope or none", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "GrantScoped", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Scopes: []string{"entra"}, Allow: []string{model.PropertyActionValueWrite}},
		}))
		require.NoError(t, err)

		rctxMatch := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "entra"})
		_, upErr := th.service.UpsertPropertyValue(rctxMatch, newValueFor(created.ID))
		require.NoError(t, upErr)

		rctxOtherScope := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "okta"})
		_, upErr = th.service.UpsertPropertyValue(rctxOtherScope, newValueFor(created.ID))
		require.Error(t, upErr)

		rctxNoScope := RequestContextWithCallerID(th.Context, "plugin-owner")
		_, upErr = th.service.UpsertPropertyValue(rctxNoScope, newValueFor(created.ID))
		require.Error(t, upErr)
	})

	t.Run("permissions supersede legacy protected and source_plugin_id", func(t *testing.T) {
		field := grantsField(th.CPAGroupID, "GrantOverLegacy", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionValueWrite}},
		})
		field.Attrs = model.StringInterface{
			model.PropertyAttrsProtected: true,
		}
		// Created by "plugin-other" so the hook stamps it as the source
		// plugin -- the legacy flags a permissions-carrying field must not
		// defer to.
		created, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "plugin-other"), field)
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, "plugin-owner")
		_, upErr := th.service.UpsertPropertyValue(rctx, newValueFor(created.ID))
		require.NoError(t, upErr)
	})

	t.Run("a human caller is passed through on a field whose grants name only a plugin", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "GrantHumanPassthrough", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionValueWrite}},
		}))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, model.NewId())
		_, upErr := th.service.UpsertPropertyValue(rctx, newValueFor(created.ID))
		require.NoError(t, upErr)
	})
}

func TestPermissionsGrantFieldWriteAndDeleteAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner"
	})

	t.Run("a field.write grant may update the definition and delete the field", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "FieldWriteGrant", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionFieldWrite}},
		}))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, "plugin-owner")
		created.Attrs = model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.PropertyFieldVisibilityAlways}
		updated, _, upErr := th.service.UpdatePropertyField(rctx, th.CPAGroupID, created)
		require.NoError(t, upErr)
		assert.Equal(t, model.PropertyFieldVisibilityAlways, updated.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])

		require.NoError(t, th.service.DeletePropertyField(rctx, th.CPAGroupID, created.ID))
	})

	t.Run("a value.write-only grant may neither update the definition nor delete the field", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "ValueWriteOnlyGrant", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionValueWrite}},
		}))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, "plugin-owner")
		created.Attrs = model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.PropertyFieldVisibilityAlways}
		_, _, upErr := th.service.UpdatePropertyField(rctx, th.CPAGroupID, created)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)

		delErr := th.service.DeletePropertyField(rctx, th.CPAGroupID, created.ID)
		require.Error(t, delErr)
		assert.ErrorIs(t, delErr, ErrAccessDenied)
	})
}
