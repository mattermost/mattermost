// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
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

	t.Run("a human caller on a field whose grants name only a plugin is judged by the ladder checker, not the grant", func(t *testing.T) {
		t.Cleanup(func() { th.service.setLadderCheckerForTests(nil) })

		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "GrantHumanLadder", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionValueWrite}},
		}))
		require.NoError(t, err)

		humanID := model.NewId()
		th.service.setLadderCheckerForTests(func(_ request.CTX, userID string, _ *model.PropertyField, action, _ string) bool {
			return userID == humanID && action == model.PropertyActionValueWrite
		})

		rctx := RequestContextWithCallerID(th.Context, humanID)
		_, upErr := th.service.UpsertPropertyValue(rctx, newValueFor(created.ID))
		require.NoError(t, upErr)

		th.service.setLadderCheckerForTests(nil)
		_, upErr = th.service.UpsertPropertyValue(rctx, newValueFor(created.ID))
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})
}

func TestPermissionsHumanValueWriteAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	t.Cleanup(func() { th.service.setLadderCheckerForTests(nil) })

	newValueFor := func(fieldID, targetID string) *model.PropertyValue {
		return &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    fieldID,
			TargetType: "channel",
			TargetID:   targetID,
			Value:      json.RawMessage(`"v"`),
		}
	}

	t.Run("a human the ladder checker denies is refused a value write by the hook", func(t *testing.T) {
		th.service.setLadderCheckerForTests(func(_ request.CTX, _ string, _ *model.PropertyField, _, _ string) bool {
			return false
		})

		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "HumanDenied", nil))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, model.NewId())
		_, upErr := th.service.UpsertPropertyValue(rctx, newValueFor(created.ID, model.NewId()))
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("a human the ladder checker allows is admitted", func(t *testing.T) {
		userID := model.NewId()
		th.service.setLadderCheckerForTests(func(_ request.CTX, callerID string, _ *model.PropertyField, action, _ string) bool {
			return callerID == userID && action == model.PropertyActionValueWrite
		})

		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "HumanAllowed", nil))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, userID)
		_, upErr := th.service.UpsertPropertyValue(rctx, newValueFor(created.ID, model.NewId()))
		require.NoError(t, upErr)
	})

	t.Run("the value's own target reaches the checker, not the field", func(t *testing.T) {
		userID := model.NewId()
		clearedChannelID := model.NewId()
		otherChannelID := model.NewId()

		th.service.setLadderCheckerForTests(func(_ request.CTX, callerID string, _ *model.PropertyField, action, valueTargetID string) bool {
			return callerID == userID && action == model.PropertyActionValueWrite && valueTargetID == clearedChannelID
		})

		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "ChannelValueWrite", nil))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, userID)

		_, upErr := th.service.UpsertPropertyValue(rctx, newValueFor(created.ID, clearedChannelID))
		require.NoError(t, upErr)

		_, upErr = th.service.UpsertPropertyValue(rctx, newValueFor(created.ID, otherChannelID))
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("a nil ladder checker refuses a human value write on a field carrying permissions", func(t *testing.T) {
		th.service.setLadderCheckerForTests(nil)

		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "NilCheckerWrite", nil))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, model.NewId())
		_, upErr := th.service.UpsertPropertyValue(rctx, newValueFor(created.ID, model.NewId()))
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("a batch write of several values on one field and target invokes the ladder checker once", func(t *testing.T) {
		userID := model.NewId()
		targetID := model.NewId()
		calls := 0
		th.service.setLadderCheckerForTests(func(_ request.CTX, callerID string, _ *model.PropertyField, _, _ string) bool {
			calls++
			return callerID == userID
		})

		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "BatchField", nil))
		require.NoError(t, err)

		rctx := RequestContextWithCallerID(th.Context, userID)
		_, upErr := th.service.UpsertPropertyValues(rctx, []*model.PropertyValue{
			newValueFor(created.ID, targetID),
			newValueFor(created.ID, targetID),
			newValueFor(created.ID, targetID),
		})
		require.NoError(t, upErr)
		assert.Equal(t, 1, calls)
	})

	t.Run("field update and delete refuse a human the ladder checker denies and admit one it permits", func(t *testing.T) {
		allowedUserID := model.NewId()
		th.service.setLadderCheckerForTests(func(_ request.CTX, callerID string, _ *model.PropertyField, action, _ string) bool {
			return callerID == allowedUserID && action == model.PropertyActionFieldWrite
		})

		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "HumanFieldWrite", nil))
		require.NoError(t, err)

		deniedRctx := RequestContextWithCallerID(th.Context, model.NewId())
		created.Attrs = model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.PropertyFieldVisibilityAlways}
		_, _, upErr := th.service.UpdatePropertyField(deniedRctx, th.CPAGroupID, created)
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)

		delErr := th.service.DeletePropertyField(deniedRctx, th.CPAGroupID, created.ID)
		require.Error(t, delErr)
		assert.ErrorIs(t, delErr, ErrAccessDenied)

		allowedRctx := RequestContextWithCallerID(th.Context, allowedUserID)
		updated, _, upErr := th.service.UpdatePropertyField(allowedRctx, th.CPAGroupID, created)
		require.NoError(t, upErr)
		assert.Equal(t, model.PropertyFieldVisibilityAlways, updated.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])

		require.NoError(t, th.service.DeletePropertyField(allowedRctx, th.CPAGroupID, created.ID))
	})

	t.Run("deleting all of a field's values still admits a human even though it carries permissions", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "plugin-owner" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })

		field := grantsField(th.CPAGroupID, "DeleteAllValues", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionValueWrite}},
		})
		created, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "plugin-owner"), field)
		require.NoError(t, err)

		_, err = th.service.CreatePropertyValue(RequestContextWithCallerID(th.Context, "plugin-owner"), newValueFor(created.ID, model.NewId()))
		require.NoError(t, err)

		// A ladder checker that always denies -- proves the human pass-through on
		// this path is a deliberate exception, not an accidental allow.
		th.service.setLadderCheckerForTests(func(_ request.CTX, _ string, _ *model.PropertyField, _, _ string) bool {
			return false
		})

		delErr := th.service.DeletePropertyValuesForField(RequestContextWithCallerID(th.Context, model.NewId()), th.CPAGroupID, created.ID)
		require.NoError(t, delErr)
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

func TestPermissionsReadAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	t.Cleanup(func() { th.service.setLadderCheckerForTests(nil) })

	t.Run("a value.read restriction is measured against the value's own object, not the field", func(t *testing.T) {
		adminID := model.NewId()
		memberID := model.NewId()
		channelID := model.NewId()

		// The value has to get in somehow -- a plugin write grant does that
		// without bearing on the human read decision under test, which the
		// ladder checker below answers on its own.
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "creator-plugin" })
		th.service.setLadderCheckerForTests(func(_ request.CTX, userID string, _ *model.PropertyField, action, valueTargetID string) bool {
			return userID == adminID && action == model.PropertyActionValueRead && valueTargetID == channelID
		})

		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "ChannelValueRead", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "creator-plugin"}, Allow: []string{model.PropertyActionValueWrite}},
		}))
		require.NoError(t, err)

		value, err := th.service.CreatePropertyValue(RequestContextWithCallerID(th.Context, "creator-plugin"), &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "channel",
			TargetID:   channelID,
			Value:      json.RawMessage(`"secret"`),
		})
		require.NoError(t, err)

		retrieved, getErr := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, adminID), th.CPAGroupID, value.ID)
		require.NoError(t, getErr)
		require.NotNil(t, retrieved)

		retrieved, getErr = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, memberID), th.CPAGroupID, value.ID)
		require.NoError(t, getErr)
		assert.Nil(t, retrieved)
	})

	t.Run("a plugin's value.read grant serves the value where the legacy public access mode would have served every caller", func(t *testing.T) {
		th.service.setLadderCheckerForTests(nil)
		th.service.setPluginCheckerForTests(func(pluginID string) bool {
			return pluginID == "plugin-owner" || pluginID == "plugin-other"
		})

		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "GrantValueRead", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionValueRead, model.PropertyActionValueWrite}},
		}))
		require.NoError(t, err)

		value, err := th.service.CreatePropertyValue(RequestContextWithCallerID(th.Context, "plugin-owner"), &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		})
		require.NoError(t, err)

		retrieved, getErr := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, "plugin-owner"), th.CPAGroupID, value.ID)
		require.NoError(t, getErr)
		require.NotNil(t, retrieved)

		retrieved, getErr = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, "plugin-other"), th.CPAGroupID, value.ID)
		require.NoError(t, getErr)
		assert.Nil(t, retrieved)
	})

	t.Run("an option.read restriction gates the inline option list and the paged option listing, without hiding the field itself", func(t *testing.T) {
		sysadminID := model.NewId()
		memberID := model.NewId()

		th.service.setLadderCheckerForTests(func(_ request.CTX, userID string, _ *model.PropertyField, action, valueTargetID string) bool {
			return userID == sysadminID && (action == model.PropertyActionOptionRead || action == model.PropertyActionFieldWrite)
		})

		field := grantsField(th.CPAGroupID, "OptionReadField", nil)
		field.Type = model.PropertyFieldTypeSelect
		field.Attrs = model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": "opt1", "value": "Option 1"},
				map[string]any{"id": "opt2", "value": "Option 2"},
			},
		}
		created, err := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, err)

		sysadminRead, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, sysadminID), th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Len(t, sysadminRead.Attrs[model.PropertyFieldAttributeOptions].([]any), 2)

		memberRead, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, memberID), th.CPAGroupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.Name, memberRead.Name)
		assert.Equal(t, created.Type, memberRead.Type)
		assert.Empty(t, memberRead.Attrs[model.PropertyFieldAttributeOptions])

		_, err = th.service.CreateFieldOptions(RequestContextWithCallerID(th.Context, sysadminID), created, []*model.PropertyFieldOption{{Name: "Row Option"}})
		require.NoError(t, err)

		options, err := th.service.GetFieldOptions(RequestContextWithCallerID(th.Context, memberID), created, 0, "", 100)
		require.NoError(t, err)
		assert.Empty(t, options)

		options, err = th.service.GetFieldOptions(RequestContextWithCallerID(th.Context, sysadminID), created, 0, "", 100)
		require.NoError(t, err)
		assert.Len(t, options, 3)
	})

	t.Run("a nil ladder checker denies a human read on a permissions field", func(t *testing.T) {
		th.service.setLadderCheckerForTests(nil)
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "creator-plugin" })

		created, err := th.service.CreatePropertyField(th.Context, grantsField(th.CPAGroupID, "NilCheckerField", []model.Grant{
			{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "creator-plugin"}, Allow: []string{model.PropertyActionValueWrite}},
		}))
		require.NoError(t, err)

		value, err := th.service.CreatePropertyValue(RequestContextWithCallerID(th.Context, "creator-plugin"), &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		})
		require.NoError(t, err)

		retrieved, getErr := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, model.NewId()), th.CPAGroupID, value.ID)
		require.NoError(t, getErr)
		assert.Nil(t, retrieved)
	})
}
