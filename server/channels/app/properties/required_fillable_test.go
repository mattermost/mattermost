// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"maps"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestAccessControlAttributeValidationRequiredUnfillable(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: model.AccessControlPropertyGroupName, Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	enforced := true
	th.service.AddHook(NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{
		RequiredAttributeEnforcement: func() bool { return enforced },
	}, group.ID))
	th.service.SetRequiredFillableEnforcement(func() bool { return enforced })

	level := func(l model.PermissionLevel) *model.PermissionLevel { return &l }

	newField := func(objectType string, values *model.PermissionLevel, attrs model.StringInterface) *model.PropertyField {
		if attrs == nil {
			attrs = model.StringInterface{}
		}
		return &model.PropertyField{
			GroupID:          group.ID,
			Name:             "text_" + model.NewId(),
			Type:             model.PropertyFieldTypeText,
			TargetType:       "system",
			ObjectType:       objectType,
			PermissionValues: values,
			Attrs:            attrs,
		}
	}
	clone := func(field *model.PropertyField) *model.PropertyField {
		c := *field
		c.Attrs = maps.Clone(field.Attrs)
		return &c
	}
	required := func() model.StringInterface {
		return model.StringInterface{model.PropertyFieldAttrRequired: true}
	}

	// seed stores a field straight through the store, bypassing every hook,
	// the way a field written before this rule existed would have been stored.
	seed := func(t *testing.T, field *model.PropertyField) *model.PropertyField {
		t.Helper()
		field.Permissions = model.PermissionsFromLegacy(field, model.LegacyConversionOpts{ConvertAttrs: true})
		stored, storeErr := th.dbStore.PropertyField().Create(field)
		require.NoError(t, storeErr)
		return stored
	}

	requireUnfillableErr := func(t *testing.T, err error) {
		t.Helper()
		require.Error(t, err)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.property_field.required_unfillable.app_error", appErr.Id)
	}

	t.Run("create", func(t *testing.T) {
		testCases := []struct {
			name    string
			values  *model.PermissionLevel
			attrs   model.StringInterface
			refused bool
		}{
			{name: "sysadmin level is refused", values: level(model.PermissionLevelSysadmin), refused: true},
			{name: "none level is refused", values: level(model.PermissionLevelNone), refused: true},
			{name: "source only access mode is refused", values: level(model.PermissionLevelAdmin), attrs: model.StringInterface{model.PropertyAttrsAccessMode: model.PropertyAccessModeSourceOnly}, refused: true},
			{name: "synced is refused", values: level(model.PermissionLevelAdmin), attrs: model.StringInterface{model.PropertyFieldAttrLDAP: "department"}, refused: true},
			{name: "admin level is allowed", values: level(model.PermissionLevelAdmin)},
			{name: "member level is allowed", values: level(model.PermissionLevelMember)},
			{name: "default level is allowed", values: nil},
		}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				attrs := required()
				maps.Copy(attrs, tc.attrs)
				_, createErr := th.service.CreatePropertyField(th.Context, newField(model.PropertyFieldObjectTypeChannel, tc.values, attrs))
				if tc.refused {
					requireUnfillableErr(t, createErr)
					return
				}
				require.NoError(t, createErr)
			})
		}
	})

	t.Run("create with a masked permissions object is refused", func(t *testing.T) {
		field := newField(model.PropertyFieldObjectTypeChannel, level(model.PermissionLevelAdmin), required())
		field.Permissions = model.PermissionsFromLegacy(field, model.LegacyConversionOpts{ConvertAttrs: true})
		field.Permissions.Masking = &model.Masking{}
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		requireUnfillableErr(t, createErr)
	})

	t.Run("marking an unfillable field required is refused", func(t *testing.T) {
		field, createErr := th.service.CreatePropertyField(th.Context, newField(model.PropertyFieldObjectTypeChannel, level(model.PermissionLevelSysadmin), nil))
		require.NoError(t, createErr)

		field.Attrs[model.PropertyFieldAttrRequired] = true
		_, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, field)
		requireUnfillableErr(t, updateErr)
	})

	t.Run("marking a stored owned or protected field required is refused", func(t *testing.T) {
		for name, attrs := range map[string]model.StringInterface{
			"owned":     {model.PropertyAttrsOwners: []any{map[string]any{"id": "plugin-id", "type": model.PropertyOwnerTypePlugin}}},
			"protected": {model.PropertyAttrsProtected: true, model.PropertyAttrsSourcePluginID: "plugin-id"},
		} {
			t.Run(name, func(t *testing.T) {
				field := seed(t, newField(model.PropertyFieldObjectTypeChannel, level(model.PermissionLevelAdmin), attrs))
				assert.False(t, model.IsChannelFieldFillableByCreators(field))

				_, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, func() *model.PropertyField {
					next := clone(field)
					next.Attrs[model.PropertyFieldAttrRequired] = true
					return next
				}())
				requireUnfillableErr(t, updateErr)
			})
		}
	})

	t.Run("lowering a required field's level to sysadmin is refused", func(t *testing.T) {
		field, createErr := th.service.CreatePropertyField(th.Context, newField(model.PropertyFieldObjectTypeChannel, level(model.PermissionLevelAdmin), required()))
		require.NoError(t, createErr)

		next := clone(field)
		next.Permissions = nil
		next.PermissionValues = level(model.PermissionLevelSysadmin)
		_, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, next)
		requireUnfillableErr(t, updateErr)
	})

	t.Run("raising an unfillable field's level while marking it required is allowed", func(t *testing.T) {
		field, createErr := th.service.CreatePropertyField(th.Context, newField(model.PropertyFieldObjectTypeChannel, level(model.PermissionLevelSysadmin), nil))
		require.NoError(t, createErr)

		next := clone(field)
		next.Permissions = nil
		next.PermissionValues = level(model.PermissionLevelAdmin)
		next.Attrs[model.PropertyFieldAttrRequired] = true
		updated, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, next)
		require.NoError(t, updateErr)
		assert.True(t, model.IsPropertyFieldRequired(updated))
		assert.True(t, model.IsChannelFieldFillableByCreators(updated))
	})

	t.Run("a grandfathered required unfillable field can be renamed", func(t *testing.T) {
		field := seed(t, newField(model.PropertyFieldObjectTypeChannel, level(model.PermissionLevelSysadmin), required()))

		next := clone(field)
		next.Attrs[model.PropertyFieldAttrDisplayName] = "Renamed"
		updated, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, next)
		require.NoError(t, updateErr)
		assert.Equal(t, "Renamed", updated.Attrs[model.PropertyFieldAttrDisplayName])
		assert.True(t, model.IsPropertyFieldRequired(updated))
	})

	t.Run("the batch update path refuses too", func(t *testing.T) {
		field, createErr := th.service.CreatePropertyField(th.Context, newField(model.PropertyFieldObjectTypeChannel, level(model.PermissionLevelSysadmin), nil))
		require.NoError(t, createErr)

		field.Attrs[model.PropertyFieldAttrRequired] = true
		_, _, _, updateErr := th.service.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{field})
		requireUnfillableErr(t, updateErr)
	})

	t.Run("a team-scoped field is not judged", func(t *testing.T) {
		field := newField(model.PropertyFieldObjectTypeChannel, level(model.PermissionLevelSysadmin), required())
		field.TargetType = "team"
		field.TargetID = model.NewId()
		_, createErr := th.service.CreatePropertyField(th.Context, field)
		require.NoError(t, createErr)
	})

	t.Run("non-channel object types are unaffected", func(t *testing.T) {
		for _, objectType := range []string{model.PropertyFieldObjectTypeUser, model.PropertyFieldObjectTypePost} {
			_, createErr := th.service.CreatePropertyField(th.Context, newField(objectType, level(model.PermissionLevelSysadmin), required()))
			require.NoError(t, createErr, "object type %s", objectType)
		}
	})

	t.Run("no rule while enforcement is off", func(t *testing.T) {
		field, createErr := th.service.CreatePropertyField(th.Context, newField(model.PropertyFieldObjectTypeChannel, level(model.PermissionLevelAdmin), required()))
		require.NoError(t, createErr)

		enforced = false
		defer func() { enforced = true }()

		next := clone(field)
		next.Permissions = nil
		next.PermissionValues = level(model.PermissionLevelSysadmin)
		_, _, updateErr := th.service.UpdatePropertyField(th.Context, group.ID, next)
		require.NoError(t, updateErr)
	})
}

func TestRequiredUnfillableLinkedField(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: model.AccessControlPropertyGroupName, Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	// The access control hook copies a template's restrictions onto the fields
	// linking to it, as in production.
	th.service.AddHook(NewAccessControlHook(th.service, nil, defaultLadderCheckerForTests, nil))
	th.service.AddHook(NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{}, group.ID))
	th.service.SetRequiredFillableEnforcement(func() bool { return true })

	// A template's values default to sysadmin.
	template, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "template_" + model.NewId(),
		Type:       model.PropertyFieldTypeText,
		TargetType: "system",
		ObjectType: model.PropertyFieldObjectTypeTemplate,
	})
	require.NoError(t, err)

	linked := func(values *model.PermissionLevel) *model.PropertyField {
		return &model.PropertyField{
			GroupID:          group.ID,
			Name:             "linked_" + model.NewId(),
			Type:             model.PropertyFieldTypeText,
			TargetType:       "system",
			ObjectType:       model.PropertyFieldObjectTypeChannel,
			LinkedFieldID:    &template.ID,
			PermissionValues: values,
			Attrs:            model.StringInterface{model.PropertyFieldAttrRequired: true},
		}
	}

	t.Run("a field taking its template's sysadmin value level is refused", func(t *testing.T) {
		_, createErr := th.service.CreatePropertyField(th.Context, linked(nil))
		require.Error(t, createErr)
		var appErr *model.AppError
		require.ErrorAs(t, createErr, &appErr)
		assert.Equal(t, "app.property_field.required_unfillable.app_error", appErr.Id)
	})

	t.Run("a field pinning admin is allowed", func(t *testing.T) {
		admin := model.PermissionLevelAdmin
		created, createErr := th.service.CreatePropertyField(th.Context, linked(&admin))
		require.NoError(t, createErr)
		assert.True(t, model.IsChannelFieldFillableByCreators(created))
	})
}
