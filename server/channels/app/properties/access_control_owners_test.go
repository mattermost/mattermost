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

// createOwnedField creates an owner-managed field via a human (admin) caller.
// Machine callers may not declare owners.
func createOwnedField(t *testing.T, th *TestHelper, name, pluginID string, scopes []string) *model.PropertyField {
	t.Helper()
	rctxHuman := RequestContextWithCallerID(th.Context, model.NewId())
	created, err := th.service.CreatePropertyField(rctxHuman, ownerField(th.CPAGroupID, name, pluginID, scopes))
	require.NoError(t, err)
	require.True(t, model.HasPropertyFieldOwners(created))
	return created
}

func TestOwnerValueWriteAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner" || pluginID == "plugin-other"
	})

	created := createOwnedField(t, th, "Owned", "plugin-owner", []string{"entra"})

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

	rctxHuman := RequestContextWithCallerID(th.Context, model.NewId())

	t.Run("scopeless owner plugin may edit the field definition", func(t *testing.T) {
		created := createOwnedField(t, th, "ScopelessOwned", "plugin-owner", nil)
		existing, getErr := th.service.GetPropertyField(rctxHuman, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityAlways
		rctx := RequestContextWithCallerID(th.Context, "plugin-owner")
		updated, _, upErr := th.service.UpdatePropertyField(rctx, th.CPAGroupID, existing)
		require.NoError(t, upErr)
		assert.Equal(t, model.PropertyFieldVisibilityAlways, updated.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
	})

	t.Run("scoped owner plugin may edit the field definition", func(t *testing.T) {
		created := createOwnedField(t, th, "ScopedOwned", "plugin-owner", []string{"entra"})
		existing, getErr := th.service.GetPropertyField(rctxHuman, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityHidden
		rctx := RequestContextWithCallerID(th.Context, "plugin-owner")
		updated, _, upErr := th.service.UpdatePropertyField(rctx, th.CPAGroupID, existing)
		require.NoError(t, upErr)
		assert.Equal(t, model.PropertyFieldVisibilityHidden, updated.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
	})

	t.Run("a non-owner plugin may not edit an owner-managed field", func(t *testing.T) {
		created := createOwnedField(t, th, "OwnedByOther", "plugin-owner", nil)
		existing, getErr := th.service.GetPropertyField(rctxHuman, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityHidden
		rctxOther := RequestContextWithCallerID(th.Context, "plugin-other")
		_, _, upErr := th.service.UpdatePropertyField(rctxOther, th.CPAGroupID, existing)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("human may edit an owner-managed field definition", func(t *testing.T) {
		created := createOwnedField(t, th, "HumanEditable", "plugin-owner", []string{"entra"})
		created.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityAlways
		updated, _, upErr := th.service.UpdatePropertyField(rctxHuman, th.CPAGroupID, created)
		require.NoError(t, upErr)
		assert.Equal(t, model.PropertyFieldVisibilityAlways, updated.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
	})

	t.Run("listed owner plugin may delete an owner-managed field", func(t *testing.T) {
		created := createOwnedField(t, th, "OwnerDelete", "plugin-owner", nil)
		rctx := RequestContextWithCallerID(th.Context, "plugin-owner")
		require.NoError(t, th.service.DeletePropertyField(rctx, th.CPAGroupID, created.ID))
	})

	t.Run("non-owner plugin may not delete an owner-managed field", func(t *testing.T) {
		created := createOwnedField(t, th, "NoDelete", "plugin-owner", nil)
		rctxOther := RequestContextWithCallerID(th.Context, "plugin-other")
		delErr := th.service.DeletePropertyField(rctxOther, th.CPAGroupID, created.ID)
		require.Error(t, delErr)
		assert.ErrorIs(t, delErr, ErrAccessDenied)
	})

	t.Run("human may delete an owner-managed field", func(t *testing.T) {
		created := createOwnedField(t, th, "HumanDelete", "plugin-owner", []string{"entra"})
		require.NoError(t, th.service.DeletePropertyField(rctxHuman, th.CPAGroupID, created.ID))
	})
}

func TestOwnerListManagedByAdminOnly(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner" || pluginID == "plugin-other"
	})

	rctxOwner := RequestContextWithCallerID(th.Context, "plugin-owner")
	rctxHuman := RequestContextWithCallerID(th.Context, model.NewId())

	t.Run("rejects plugin create that declares owners", func(t *testing.T) {
		_, err := th.service.CreatePropertyField(rctxOwner, ownerField(th.CPAGroupID, "PluginOwned", "plugin-owner", []string{"entra"}))
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrAccessDenied)
	})

	t.Run("allows human create with owners", func(t *testing.T) {
		created, err := th.service.CreatePropertyField(rctxHuman, ownerField(th.CPAGroupID, "HumanOwned", "plugin-owner", []string{"entra"}))
		require.NoError(t, err)
		require.True(t, model.HasPropertyFieldOwners(created))
	})

	t.Run("rejects plugin update that adds owners", func(t *testing.T) {
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
		_, _, upErr := th.service.UpdatePropertyField(rctxOwner, th.CPAGroupID, plain)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("allows human update that adds owners", func(t *testing.T) {
		plain, createErr := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "AdminAddsOwners",
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

	t.Run("allows listed owner plugin update that changes owners", func(t *testing.T) {
		created := createOwnedField(t, th, "MutableOwners", "plugin-owner", nil)
		created.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
		}
		updated, _, upErr := th.service.UpdatePropertyField(rctxOwner, th.CPAGroupID, created)
		require.NoError(t, upErr)
		owners := model.GetPropertyFieldOwners(updated)
		require.Len(t, owners, 1)
		assert.Equal(t, []string{"entra"}, owners[0].Scopes)
	})

	t.Run("rejects non-owner plugin update that changes owners", func(t *testing.T) {
		created := createOwnedField(t, th, "ImmutableToNonOwner", "plugin-owner", nil)
		created.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
			{ID: "plugin-other", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"okta"}},
		}
		rctxOther := RequestContextWithCallerID(th.Context, "plugin-other")
		_, _, upErr := th.service.UpdatePropertyField(rctxOther, th.CPAGroupID, created)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("allows human update that changes owners", func(t *testing.T) {
		created := createOwnedField(t, th, "HumanMutableOwners", "plugin-owner", []string{"entra"})
		created.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra", "okta"}},
		}
		updated, _, upErr := th.service.UpdatePropertyField(rctxHuman, th.CPAGroupID, created)
		require.NoError(t, upErr)
		owners := model.GetPropertyFieldOwners(updated)
		require.Len(t, owners, 1)
		assert.ElementsMatch(t, []string{"entra", "okta"}, owners[0].Scopes)
	})

	t.Run("allows human update that removes owners", func(t *testing.T) {
		created := createOwnedField(t, th, "RemovableOwners", "plugin-owner", []string{"entra"})
		delete(created.Attrs, model.PropertyAttrsOwners)
		updated, _, upErr := th.service.UpdatePropertyField(rctxHuman, th.CPAGroupID, created)
		require.NoError(t, upErr)
		assert.False(t, model.HasPropertyFieldOwners(updated))
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

	rctxHuman := RequestContextWithCallerID(th.Context, model.NewId())
	created, err := th.service.CreatePropertyField(rctxHuman, &model.PropertyField{
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
		return pluginID == "plugin-a" || pluginID == "plugin-b" || pluginID == "plugin-other"
	})

	rctxHuman := RequestContextWithCallerID(th.Context, model.NewId())

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
	require.Len(t, model.GetPropertyFieldOwners(coOwned), 2)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    coOwned.ID,
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

	t.Run("plugin cannot use another owner's scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndOptions(th.Context, "plugin-a", model.PropertyRequestOptions{ActingAsScope: "scope-b"})
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})

	t.Run("listed co-owner may change the owners list on a co-owned field", func(t *testing.T) {
		rctxA := RequestContextWithCallerID(th.Context, "plugin-a")
		existing, getErr := th.service.GetPropertyField(rctxA, th.CPAGroupID, coOwned.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-a", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-a", "scope-a2"}},
			{ID: "plugin-b", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-b"}},
		}
		updated, _, upErr := th.service.UpdatePropertyField(rctxA, th.CPAGroupID, existing)
		require.NoError(t, upErr)
		owners := model.GetPropertyFieldOwners(updated)
		require.Len(t, owners, 2)
		for _, owner := range owners {
			if owner.ID == "plugin-a" {
				assert.ElementsMatch(t, []string{"scope-a", "scope-a2"}, owner.Scopes)
			}
		}
	})

	t.Run("non-owner plugin may not change the owners list on a co-owned field", func(t *testing.T) {
		rctxOther := RequestContextWithCallerID(th.Context, "plugin-other")
		existing, getErr := th.service.GetPropertyField(rctxHuman, th.CPAGroupID, coOwned.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-a", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-a"}},
			{ID: "plugin-b", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-b"}},
			{ID: "plugin-other", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"scope-other"}},
		}
		_, _, upErr := th.service.UpdatePropertyField(rctxOther, th.CPAGroupID, existing)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})
}

func TestOwnerSyncBidirectionalTransitions(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner"
	})

	rctxHuman := RequestContextWithCallerID(th.Context, model.NewId())

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
		created := createOwnedField(t, th, "ScimFirst", "plugin-owner", []string{"entra"})

		created.Attrs[model.CustomProfileAttributesPropertyAttrsSAML] = "department"
		updated, _, upErr := th.service.UpdatePropertyField(rctxHuman, th.CPAGroupID, created)
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

		created.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{ID: "plugin-owner", Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
		}
		updated, _, upErr := th.service.UpdatePropertyField(rctxHuman, th.CPAGroupID, created)
		require.NoError(t, upErr)
		require.True(t, model.HasPropertyFieldOwners(updated))

		assertCombinedWrites(t, created.ID)
	})
}
