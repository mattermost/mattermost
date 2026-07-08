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

	t.Run("allows owner plugin writing with a mixed-case acting-as scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-owner", model.PropertyRequestOptions{ActingAsScope: "Entra"})
		v, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.NoError(t, upErr)
		assert.NotNil(t, v)
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

	t.Run("allows a human caller through (governed by API permission levels, not owners)", func(t *testing.T) {
		// A session user is not a machine caller, so the owner gate lets it
		// pass; the API layer's pinned permission levels govern humans.
		rctx := RequestContextWithCallerID(th.Context, model.NewId())
		v, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.NoError(t, upErr)
		assert.NotNil(t, v)
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
	// Field-definition edits are scope-gated, so plugin-a must act as one of
	// its owned scopes to reach the owner-mutation rules.
	rctxAScoped := RequestContextWithCallerIDAndOptions(th.Context, "plugin-a", model.PropertyRequestOptions{ActingAsScope: "scope-a"})

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
		_, _, upErr := th.service.UpdatePropertyField(rctxAScoped, th.CPAGroupID, existing)
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
			updated, _, upErr := th.service.UpdatePropertyField(rctxAScoped, th.CPAGroupID, existing)
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
			_, _, upErr := th.service.UpdatePropertyField(rctxAScoped, th.CPAGroupID, existing)
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

		rctxOwner := RequestContextWithCallerID(th.Context, "plugin-owner")
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
	// Field-definition edits are scope-gated, so the owning plugin must act as
	// one of its owned scopes to edit an existing owner-managed field.
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
		updated, _, upErr := th.service.UpdatePropertyField(rctxOwnerScoped, th.CPAGroupID, existing)
		require.NoError(t, upErr)
		owners := model.GetPropertyFieldOwners(updated)
		require.Len(t, owners, 1)
		assert.ElementsMatch(t, []string{"entra", "okta"}, owners[0].Scopes)
	})
}
