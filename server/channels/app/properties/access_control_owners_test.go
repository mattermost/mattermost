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

// ownerField builds a CPA text field owned by the given plugin id for the given scopes.
func ownerField(groupID, name, pluginID string, scopes []string) *model.PropertyField {
	return &model.PropertyField{
		GroupID:    groupID,
		Name:       name,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsOwners: []model.PropertyOwner{
				{ID: pluginID, Type: model.PropertyOwnerTypePlugin, Scopes: scopes},
			},
		},
	}
}

func TestOwnerValueWriteAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner" || pluginID == "plugin-other"
	})

	// The owner plugin assigns ownership on an empty (legacy) field — allowed
	// because the *existing* field has no owners yet.
	rctxOwner := RequestContextWithCallerID(th.Context, "plugin-owner")
	created, err := th.service.CreatePropertyField(rctxOwner, ownerField(th.CPAGroupID, "Owned", "plugin-owner", []string{"entra"}))
	require.NoError(t, err)
	require.True(t, model.HasPropertyFieldOwners(created))

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		}
	}

	t.Run("allows owner plugin writing with a matching scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "entra"})
		v, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.NoError(t, upErr)
		assert.NotNil(t, v)
	})

	t.Run("denies owner plugin writing with a case-mismatched scope", func(t *testing.T) {
		// Scopes are matched verbatim: an owner scoped to "entra" is not
		// writable by a caller acting as "Entra".
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "Entra"})
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})

	t.Run("denies owner plugin writing with a non-matching scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "okta"})
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})

	t.Run("denies owner plugin writing with no scope", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, "plugin-owner")
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})

	t.Run("denies a non-owner plugin even with the right scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-other", model.PropertyRequestOptions{ActingAsScope: "entra"})
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})

	t.Run("denies a human caller (owner-managed values are authoritative to the owning integration)", func(t *testing.T) {
		// A session user is not a machine caller. Unlike other fields, an
		// owner-managed field rejects all human writes at the service hook —
		// mirroring the ldap/saml sync lock — regardless of PermissionValues.
		rctx := RequestContextWithCallerID(th.Context, model.NewId())
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})
}

func TestOwnerFieldWriteAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner" || pluginID == "plugin-other"
	})

	rctxOwner := RequestContextWithCallerID(th.Context, "plugin-owner")
	created, err := th.service.CreatePropertyField(rctxOwner, ownerField(th.CPAGroupID, "OwnedField", "plugin-owner", []string{"entra"}))
	require.NoError(t, err)

	t.Run("owner plugin may edit the field definition with a matching scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "entra"})
		created.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityAlways
		_, _, upErr := th.service.UpdatePropertyField(rctx, th.CPAGroupID, created)
		require.NoError(t, upErr)
	})

	t.Run("owner plugin may not edit the field definition acting as a non-owned scope", func(t *testing.T) {
		existing, getErr := th.service.GetPropertyField(rctxOwner, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityHidden
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "okta"})
		_, _, upErr := th.service.UpdatePropertyField(rctx, th.CPAGroupID, existing)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("a non-owner plugin may not edit an owner-managed field", func(t *testing.T) {
		rctxOther := RequestContextWithCallerID(th.Context, "plugin-other")
		existing, getErr := th.service.GetPropertyField(rctxOther, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityHidden
		_, _, upErr := th.service.UpdatePropertyField(rctxOther, th.CPAGroupID, existing)
		require.Error(t, upErr)
	})
}

func TestOwnerSupersedesLegacyAndSyncLockUnaffected(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner"
	})

	t.Run("legacy sync-locked field with no owners is still gated by the sync lock", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, model.CallerIDLDAPSync)
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "LdapSynced",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsLDAP: "employeeID",
			},
		}
		created, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		require.False(t, model.HasPropertyFieldOwners(created))

		value := &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		}

		// LDAP sync caller allowed through the legacy sync-lock path.
		_, upErr := th.service.UpsertPropertyValue(rctx, value)
		require.NoError(t, upErr)

		// A plugin caller is rejected by the sync lock.
		rctxPlugin := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "entra"})
		_, upErr = th.service.UpsertPropertyValue(rctxPlugin, &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		})
		require.Error(t, upErr)
	})
}

func TestOwnerValueWriteWithImplicitSyncOwners(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner" || pluginID == "plugin-other"
	})

	rctxOwner := RequestContextWithCallerID(th.Context, "plugin-owner")
	created, err := th.service.CreatePropertyField(rctxOwner, &model.PropertyField{
		GroupID:    th.CPAGroupID,
		Name:       "SamlAndScim",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsOwners: []model.PropertyOwner{
				{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra", "okta"}},
			},
			model.CustomProfileAttributesPropertyAttrsSAML: "department",
		},
	})
	require.NoError(t, err)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		}
	}

	t.Run("SAML sync caller can write via implicit service owner", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, model.CallerIDSAMLSync)
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.NoError(t, upErr)
	})

	t.Run("owner plugin can write with each listed scope", func(t *testing.T) {
		for _, scope := range []string{"entra", "okta"} {
			rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: scope})
			_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
			require.NoError(t, upErr, "scope %q", scope)
		}
	})

	t.Run("owner plugin is denied for an unlisted scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "keycloak"})
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})

	t.Run("LDAP sync caller is denied without attrs.ldap", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, model.CallerIDLDAPSync)
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})

	t.Run("unlisted plugin is denied", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-other", model.PropertyRequestOptions{ActingAsScope: "entra"})
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})
}

func TestMultipleDistinctPluginOwners(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-a" || pluginID == "plugin-b"
	})

	rctxA := RequestContextWithCallerID(th.Context, "plugin-a")

	t.Run("rejects create when a plugin lists another plugin as owner", func(t *testing.T) {
		_, err := th.service.CreatePropertyField(rctxA, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "MultiPluginOwners",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyAttrsOwners: []model.PropertyOwner{
					{ID: "plugin-a", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-a"}},
					{ID: "plugin-b", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-b"}},
				},
			},
		})
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrAccessDenied)
	})

	created, err := th.service.CreatePropertyField(rctxA, ownerField(th.CPAGroupID, "SinglePluginOwner", "plugin-a", []string{"scope-a"}))
	require.NoError(t, err)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		}
	}

	t.Run("listed plugin can write with its scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-a", model.PropertyRequestOptions{ActingAsScope: "scope-a"})
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.NoError(t, upErr)
	})

	t.Run("rejects update that adds another plugin as owner", func(t *testing.T) {
		existing, getErr := th.service.GetPropertyField(rctxA, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-a", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-a"}},
			{ID: "plugin-b", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-b"}},
		}
		_, _, upErr := th.service.UpdatePropertyField(rctxA, th.CPAGroupID, existing)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("plugin cannot use another owner's scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-a", model.PropertyRequestOptions{ActingAsScope: "scope-b"})
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})

	rctxHuman := RequestContextWithCallerID(th.Context, model.NewId())

	t.Run("allows human create with co-ownership", func(t *testing.T) {
		coOwned, err := th.service.CreatePropertyField(rctxHuman, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "CoOwnedByAdmin",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyAttrsOwners: []model.PropertyOwner{
					{ID: "plugin-a", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-a"}},
					{ID: "plugin-b", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-b"}},
				},
			},
		})
		require.NoError(t, err)
		owners := model.GetPropertyFieldOwners(coOwned)
		require.Len(t, owners, 2)

		t.Run("plugin may edit its own entry on co-owned field", func(t *testing.T) {
			existing, getErr := th.service.GetPropertyField(rctxA, th.CPAGroupID, coOwned.ID)
			require.NoError(t, getErr)
			existing.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
				{ID: "plugin-a", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-a", "scope-a2"}},
				{ID: "plugin-b", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-b"}},
			}
			// Adding scope-a2 requires acting as it.
			rctxA2 := RequestContextWithCallerIDAndOptions(th.Context, "plugin-a", model.PropertyRequestOptions{ActingAsScope: "scope-a2"})
			updated, _, upErr := th.service.UpdatePropertyField(rctxA2, th.CPAGroupID, existing)
			require.NoError(t, upErr)
			owners := model.GetPropertyFieldOwners(updated)
			require.Len(t, owners, 2)
			for _, owner := range owners {
				if owner.ID == "plugin-a" {
					assert.ElementsMatch(t, []string{"scope-a", "scope-a2"}, owner.Scopes)
				}
			}
		})

		t.Run("plugin may not modify another plugin's entry on co-owned field", func(t *testing.T) {
			existing, getErr := th.service.GetPropertyField(rctxA, th.CPAGroupID, coOwned.ID)
			require.NoError(t, getErr)
			existing.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
				{ID: "plugin-a", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-a"}},
				{ID: "plugin-b", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-b", "scope-b2"}},
			}
			_, _, upErr := th.service.UpdatePropertyField(rctxA, th.CPAGroupID, existing)
			require.Error(t, upErr)
			assert.ErrorIs(t, upErr, ErrAccessDenied)
		})
	})
}

func TestOwnerSyncBidirectionalTransitions(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner"
	})

	newValue := func(fieldID string) *model.PropertyValue {
		return &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    fieldID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		}
	}

	assertCombinedWrites := func(t *testing.T, fieldID string) {
		t.Helper()
		rctxSAML := RequestContextWithCallerID(th.Context, model.CallerIDSAMLSync)
		_, upErr := th.service.UpsertPropertyValue(rctxSAML, newValue(fieldID))
		require.NoError(t, upErr)

		rctxPlugin := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "entra"})
		_, upErr = th.service.UpsertPropertyValue(rctxPlugin, newValue(fieldID))
		require.NoError(t, upErr)
	}

	t.Run("SCIM-first then link SAML", func(t *testing.T) {
		rctxOwner := RequestContextWithCallerID(th.Context, "plugin-owner")
		created, err := th.service.CreatePropertyField(rctxOwner, ownerField(th.CPAGroupID, "ScimFirst", "plugin-owner", []string{"entra"}))
		require.NoError(t, err)

		created.Attrs[model.CustomProfileAttributesPropertyAttrsSAML] = "department"
		updated, _, upErr := th.service.UpdatePropertyField(th.Context, th.CPAGroupID, created)
		require.NoError(t, upErr)
		require.Equal(t, "department", updated.Attrs[model.CustomProfileAttributesPropertyAttrsSAML])

		assertCombinedWrites(t, created.ID)
	})

	t.Run("SAML-first then add plugin owner", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "SamlFirst",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsSAML: "department",
			},
		})
		require.NoError(t, err)
		require.False(t, model.HasPropertyFieldOwners(created))

		// Claiming ownership of an existing field requires acting as the scope.
		rctxOwner := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "entra"})
		created.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
		}
		updated, _, upErr := th.service.UpdatePropertyField(rctxOwner, th.CPAGroupID, created)
		require.NoError(t, upErr)
		require.True(t, model.HasPropertyFieldOwners(updated))

		assertCombinedWrites(t, created.ID)
	})
}

func TestOwnerMutationIdentityBinding(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner" || pluginID == "plugin-other"
	})

	rctxOwner := RequestContextWithCallerID(th.Context, "plugin-owner")
	// Edits outside the owners struct are scope-gated, so the owning plugin must
	// act as one of its owned scopes to change a field's schema/attrs.
	rctxOwnerScoped := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "entra"})
	rctxHuman := RequestContextWithCallerID(th.Context, model.NewId())

	t.Run("allows human create with owners", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(rctxHuman, ownerField(th.CPAGroupID, "HumanOwned", "plugin-owner", []string{"entra"}))
		require.NoError(t, err)
		require.True(t, model.HasPropertyFieldOwners(created))
	})

	t.Run("allows plugin create listing itself", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(rctxOwner, ownerField(th.CPAGroupID, "PluginOwned", "plugin-owner", []string{"entra"}))
		require.NoError(t, err)
		require.True(t, model.HasPropertyFieldOwners(created))
	})

	t.Run("rejects plugin create listing another id", func(t *testing.T) {
		_, err := th.service.CreatePropertyField(rctxOwner, ownerField(th.CPAGroupID, "WrongOwner", "plugin-other", []string{"entra"}))
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrAccessDenied)
	})

	t.Run("rejects plugin create with non-plugin owner type", func(t *testing.T) {
		field := ownerField(th.CPAGroupID, "ServiceOwner", "plugin-owner", []string{"entra"})
		field.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypeService, Scopes: []string{"ldap"}},
		}
		_, err := th.service.CreatePropertyField(rctxOwner, field)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrAccessDenied)
	})

	created, err := th.service.CreatePropertyField(rctxOwner, ownerField(th.CPAGroupID, "MutableOwned", "plugin-owner", []string{"entra"}))
	require.NoError(t, err)

	t.Run("allows human update that adds owners", func(t *testing.T) {
		plain, createErr := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "NoOwnersYet",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(t, createErr)

		plain.Attrs = model.StringInterface{
			model.PropertyAttrsOwners: []model.PropertyOwner{
				{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
			},
		}
		updated, _, upErr := th.service.UpdatePropertyField(rctxHuman, th.CPAGroupID, plain)
		require.NoError(t, upErr)
		require.True(t, model.HasPropertyFieldOwners(updated))
	})

	t.Run("allows human update when owners are unchanged", func(t *testing.T) {
		existing, getErr := th.service.GetPropertyField(rctxHuman, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityAlways
		updated, _, upErr := th.service.UpdatePropertyField(rctxHuman, th.CPAGroupID, existing)
		require.NoError(t, upErr)
		assert.Equal(t, model.PropertyFieldVisibilityAlways, updated.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
	})

	t.Run("allows plugin update when owners are unchanged", func(t *testing.T) {
		existing, getErr := th.service.GetPropertyField(rctxOwner, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityHidden
		updated, _, upErr := th.service.UpdatePropertyField(rctxOwnerScoped, th.CPAGroupID, existing)
		require.NoError(t, upErr)
		assert.Equal(t, model.PropertyFieldVisibilityHidden, updated.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
	})

	t.Run("allows plugin to change its own owner scopes", func(t *testing.T) {
		existing, getErr := th.service.GetPropertyField(rctxOwner, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra", "okta"}},
		}
		// Adding a scope requires acting as that scope.
		rctxOkta := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "okta"})
		updated, _, upErr := th.service.UpdatePropertyField(rctxOkta, th.CPAGroupID, existing)
		require.NoError(t, upErr)
		owners := model.GetPropertyFieldOwners(updated)
		require.Len(t, owners, 1)
		assert.ElementsMatch(t, []string{"entra", "okta"}, owners[0].Scopes)
	})

	t.Run("rejects removing an owner scope without acting as it", func(t *testing.T) {
		existing, getErr := th.service.GetPropertyField(rctxOwner, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		// created now owns {entra, okta}; drop okta while acting as entra.
		existing.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
		}
		_, _, upErr := th.service.UpdatePropertyField(rctxOwnerScoped, th.CPAGroupID, existing)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("allows removing an owner scope when acting as it", func(t *testing.T) {
		existing, getErr := th.service.GetPropertyField(rctxOwner, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		// created owns {entra, okta}; drop okta while acting as okta.
		existing.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
		}
		rctxOkta := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "okta"})
		updated, _, upErr := th.service.UpdatePropertyField(rctxOkta, th.CPAGroupID, existing)
		require.NoError(t, upErr)
		owners := model.GetPropertyFieldOwners(updated)
		require.Len(t, owners, 1)
		assert.ElementsMatch(t, []string{"entra"}, owners[0].Scopes)
	})
}

func TestPluginSelfOwnershipNotScopeGated(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-a" || pluginID == "plugin-b"
	})

	rctxA := RequestContextWithCallerID(th.Context, "plugin-a")
	created, err := th.service.CreatePropertyField(rctxA, ownerField(th.CPAGroupID, "SelfOwnership", "plugin-a", []string{"scope-a"}))
	require.NoError(t, err)

	rctxB := RequestContextWithCallerID(th.Context, "plugin-b")

	t.Run("a plugin may add itself as a co-owner by acting as the scope it claims", func(t *testing.T) {
		rctxBScoped := RequestContextWithCallerIDAndOptions(th.Context, "plugin-b", model.PropertyRequestOptions{ActingAsScope: "scope-b"})
		existing, getErr := th.service.GetPropertyField(rctxB, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-a", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-a"}},
			{ID: "plugin-b", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-b"}},
		}
		updated, _, upErr := th.service.UpdatePropertyField(rctxBScoped, th.CPAGroupID, existing)
		require.NoError(t, upErr)
		require.Len(t, model.GetPropertyFieldOwners(updated), 2)
	})

	t.Run("editing schema still requires acting as an owned scope", func(t *testing.T) {
		existing, getErr := th.service.GetPropertyField(rctxB, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityHidden
		_, _, upErr := th.service.UpdatePropertyField(rctxB, th.CPAGroupID, existing)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)

		rctxBScoped := RequestContextWithCallerIDAndOptions(th.Context, "plugin-b", model.PropertyRequestOptions{ActingAsScope: "scope-b"})
		scoped, getErr := th.service.GetPropertyField(rctxB, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		scoped.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityHidden
		_, _, upErr = th.service.UpdatePropertyField(rctxBScoped, th.CPAGroupID, scoped)
		require.NoError(t, upErr)
	})
}

func TestOwnerAddFirstThenEditSchema(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-a" || pluginID == "plugin-b"
	})

	rctxA := RequestContextWithCallerID(th.Context, "plugin-a")
	created, err := th.service.CreatePropertyField(rctxA, ownerField(th.CPAGroupID, "AddFirst", "plugin-a", []string{"scope-a"}))
	require.NoError(t, err)

	rctxB := RequestContextWithCallerIDAndOptions(th.Context, "plugin-b", model.PropertyRequestOptions{ActingAsScope: "scope-b"})

	coOwners := []model.PropertyOwner{
		{ID: "plugin-a", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-a"}},
		{ID: "plugin-b", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-b"}},
	}

	t.Run("cannot add itself and edit the schema in one call", func(t *testing.T) {
		existing, getErr := th.service.GetPropertyField(rctxB, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.PropertyAttrsOwners] = coOwners
		existing.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityHidden
		_, _, upErr := th.service.UpdatePropertyField(rctxB, th.CPAGroupID, existing)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("may add itself in one call then edit the schema in the next", func(t *testing.T) {
		// Call 1: become an owner for scope-b (owners-only change).
		existing, getErr := th.service.GetPropertyField(rctxB, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.PropertyAttrsOwners] = coOwners
		owned, _, upErr := th.service.UpdatePropertyField(rctxB, th.CPAGroupID, existing)
		require.NoError(t, upErr)
		require.Len(t, model.GetPropertyFieldOwners(owned), 2)

		// Call 2: now edit the schema acting as scope-b.
		owned.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityHidden
		updated, _, upErr := th.service.UpdatePropertyField(rctxB, th.CPAGroupID, owned)
		require.NoError(t, upErr)
		assert.Equal(t, model.PropertyFieldVisibilityHidden, updated.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
	})
}

func TestOwnerAddScopeRequiresActingAsScope(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-a" || pluginID == "plugin-b"
	})

	rctxA := RequestContextWithCallerID(th.Context, "plugin-a")
	created, err := th.service.CreatePropertyField(rctxA, ownerField(th.CPAGroupID, "AddScope", "plugin-a", []string{"scope-a"}))
	require.NoError(t, err)

	coOwners := []model.PropertyOwner{
		{ID: "plugin-a", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-a"}},
		{ID: "plugin-b", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-b"}},
	}

	t.Run("rejects adding an owner scope without acting as it", func(t *testing.T) {
		rctxB := RequestContextWithCallerID(th.Context, "plugin-b")
		existing, getErr := th.service.GetPropertyField(rctxB, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.PropertyAttrsOwners] = coOwners
		_, _, upErr := th.service.UpdatePropertyField(rctxB, th.CPAGroupID, existing)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("rejects adding an owner scope while acting as a different scope", func(t *testing.T) {
		rctxWrong := RequestContextWithCallerIDAndOptions(th.Context, "plugin-b", model.PropertyRequestOptions{ActingAsScope: "scope-x"})
		existing, getErr := th.service.GetPropertyField(rctxWrong, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.PropertyAttrsOwners] = coOwners
		_, _, upErr := th.service.UpdatePropertyField(rctxWrong, th.CPAGroupID, existing)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("allows adding an owner scope when acting as it", func(t *testing.T) {
		rctxB := RequestContextWithCallerIDAndOptions(th.Context, "plugin-b", model.PropertyRequestOptions{ActingAsScope: "scope-b"})
		existing, getErr := th.service.GetPropertyField(rctxB, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.PropertyAttrsOwners] = coOwners
		updated, _, upErr := th.service.UpdatePropertyField(rctxB, th.CPAGroupID, existing)
		require.NoError(t, upErr)
		require.Len(t, model.GetPropertyFieldOwners(updated), 2)
	})
}

// TestOwnerMutationForeignEntriesOnUpdate verifies that on an update a plugin can
// only touch its OWN plugin-type entry: it may never add, remove, or modify
// another id's entry, nor recast its own entry to a non-plugin type, even when
// bundled with an otherwise-valid change to its own entry.
func TestOwnerMutationForeignEntriesOnUpdate(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner" || pluginID == "plugin-other"
	})

	rctxHuman := RequestContextWithCallerID(th.Context, model.NewId())
	// Acting as an owned scope, so schema/scope gates pass and only the
	// identity-binding rules can be responsible for a rejection.
	rctxOwner := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "entra"})

	selfOwner := func() []model.PropertyOwner {
		return []model.PropertyOwner{{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}}}
	}
	coOwners := func() []model.PropertyOwner {
		return []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
			{ID: "plugin-other", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"okta"}},
		}
	}

	// newField creates a fresh field as a human (who may set any owners), so each
	// subtest starts from a known owners list without cross-test state leakage.
	newField := func(t *testing.T, name string, owners []model.PropertyOwner) *model.PropertyField {
		created, err := th.service.CreatePropertyField(rctxHuman, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       name,
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs:      model.StringInterface{model.PropertyAttrsOwners: owners},
		})
		require.NoError(t, err)
		return created
	}

	t.Run("rejects adding a foreign owner", func(t *testing.T) {
		f := newField(t, "AddForeign", selfOwner())
		f.Attrs[model.PropertyAttrsOwners] = coOwners()
		_, _, upErr := th.service.UpdatePropertyField(rctxOwner, th.CPAGroupID, f)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("rejects adding a foreign owner alongside a valid self change", func(t *testing.T) {
		f := newField(t, "SelfPlusForeign", selfOwner())
		// A legitimate self-scope addition (okta, acting as okta) bundled with an
		// illegitimate foreign owner in the same update must still be rejected.
		f.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra", "okta"}},
			{ID: "plugin-other", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"okta"}},
		}
		rctxOkta := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "okta"})
		_, _, upErr := th.service.UpdatePropertyField(rctxOkta, th.CPAGroupID, f)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("rejects removing a foreign owner", func(t *testing.T) {
		f := newField(t, "RemoveForeign", coOwners())
		f.Attrs[model.PropertyAttrsOwners] = selfOwner()
		_, _, upErr := th.service.UpdatePropertyField(rctxOwner, th.CPAGroupID, f)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("rejects modifying a foreign owner's scopes", func(t *testing.T) {
		f := newField(t, "ModifyForeign", coOwners())
		f.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
			{ID: "plugin-other", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"okta", "sneaky"}},
		}
		_, _, upErr := th.service.UpdatePropertyField(rctxOwner, th.CPAGroupID, f)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("rejects recasting its own entry to a non-plugin type", func(t *testing.T) {
		f := newField(t, "SelfWrongType", selfOwner())
		f.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypeService, Scopes: []string{"entra"}},
		}
		_, _, upErr := th.service.UpdatePropertyField(rctxOwner, th.CPAGroupID, f)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("rejects adding a foreign non-plugin owner", func(t *testing.T) {
		f := newField(t, "ForeignService", selfOwner())
		f.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
			{ID: "some-service", Type: model.PropertyOwnerTypeService, Scopes: []string{"ldap"}},
		}
		_, _, upErr := th.service.UpdatePropertyField(rctxOwner, th.CPAGroupID, f)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("allows changing only its own entry while leaving a foreign owner intact", func(t *testing.T) {
		f := newField(t, "SelfOnlyChange", coOwners())
		// Add okta to its own entry (acting as okta); plugin-other's entry is byte-for-byte unchanged.
		f.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra", "okta"}},
			{ID: "plugin-other", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"okta"}},
		}
		rctxOkta := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "okta"})
		updated, _, upErr := th.service.UpdatePropertyField(rctxOkta, th.CPAGroupID, f)
		require.NoError(t, upErr)
		require.Len(t, model.GetPropertyFieldOwners(updated), 2)
	})
}
