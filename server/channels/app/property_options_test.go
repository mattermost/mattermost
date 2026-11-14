// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"maps"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPropertyFieldOptionsInUse(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.ChannelAttributes = true
		cfg.FeatureFlags.ChannelAttributesRequired = true
	})
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "options_in_use", Version: model.PropertyGroupVersionV2})
	require.Nil(t, appErr)

	rctx := th.Context
	optionA, optionB, optionC := model.NewId(), model.NewId(), model.NewId()
	options := []model.PropertyFieldOption{
		{ID: optionA, Name: "A"},
		{ID: optionB, Name: "B"},
		{ID: optionC, Name: "C"},
	}

	newField := func(t *testing.T, fieldType model.PropertyFieldType, objectType, targetType string, linkedTo *model.PropertyField) *model.PropertyField {
		t.Helper()
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       model.NewId(),
			Type:       fieldType,
			ObjectType: objectType,
			TargetType: targetType,
		}
		if linkedTo != nil {
			field.LinkedFieldID = &linkedTo.ID
		} else {
			field.Attrs = model.StringInterface{model.PropertyFieldAttributeOptions: options}
		}
		created, err := th.Store.PropertyField().Create(field)
		require.NoError(t, err)
		return created
	}

	hold := func(t *testing.T, field *model.PropertyField, targetType, raw string) *model.PropertyValue {
		t.Helper()
		value, err := th.Store.PropertyValue().Create(&model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: targetType,
			TargetID:   model.NewId(),
			Value:      json.RawMessage(raw),
		})
		require.NoError(t, err)
		return value
	}

	system := string(model.PropertyFieldTargetLevelSystem)
	all := []string{optionA, optionB, optionC}

	t.Run("a template's options are in use through the channel fields linking to it", func(t *testing.T) {
		template := newField(t, model.PropertyFieldTypeMultiselect, model.PropertyFieldObjectTypeTemplate, system, nil)
		linked := newField(t, model.PropertyFieldTypeMultiselect, model.PropertyFieldObjectTypeChannel, system, template)
		hold(t, linked, "channel", `["`+optionA+`"]`)

		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, template.ID, all)
		require.Nil(t, appErr)
		require.Equal(t, []string{optionA}, inUse)
	})

	t.Run("a channel field's own options are in use", func(t *testing.T) {
		field := newField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeChannel, system, nil)
		hold(t, field, "channel", `"`+optionB+`"`)

		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, field.ID, all)
		require.Nil(t, appErr)
		require.Equal(t, []string{optionB}, inUse)
	})

	t.Run("only the options asked about are reported", func(t *testing.T) {
		field := newField(t, model.PropertyFieldTypeMultiselect, model.PropertyFieldObjectTypeChannel, system, nil)
		hold(t, field, "channel", `["`+optionA+`", "`+optionB+`"]`)

		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, field.ID, []string{optionB, optionC})
		require.Nil(t, appErr)
		require.Equal(t, []string{optionB}, inUse)
	})

	t.Run("a deleted value no longer holds its option", func(t *testing.T) {
		field := newField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeChannel, system, nil)
		value := hold(t, field, "channel", `"`+optionC+`"`)
		require.NoError(t, th.Store.PropertyValue().Delete(group.ID, value.ID))

		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, field.ID, all)
		require.Nil(t, appErr)
		require.NotNil(t, inUse)
		require.Empty(t, inUse)
	})

	t.Run("a field no channel uses reports nothing", func(t *testing.T) {
		template := newField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeTemplate, system, nil)
		user := newField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeUser, system, template)
		hold(t, user, "user", `"`+optionA+`"`)

		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, template.ID, all)
		require.Nil(t, appErr)
		require.NotNil(t, inUse)
		require.Empty(t, inUse)

		inUse, appErr = th.App.PropertyFieldOptionsInUse(rctx, group.ID, user.ID, all)
		require.Nil(t, appErr)
		require.NotNil(t, inUse)
		require.Empty(t, inUse)
	})

	t.Run("an unknown field is not found", func(t *testing.T) {
		_, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, model.NewId(), all)
		require.NotNil(t, appErr)
	})
}

func TestDeletePropertyFieldOptionsInUse(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.ChannelAttributes = true
		cfg.FeatureFlags.ChannelAttributesRequired = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "options_delete_in_use", Version: model.PropertyGroupVersionV2})
	require.Nil(t, appErr)

	rctx := th.Context
	system := string(model.PropertyFieldTargetLevelSystem)
	memberLevel := model.PermissionLevelMember

	newOptions := func() ([]any, []string) {
		ids := []string{model.NewId(), model.NewId(), model.NewId()}
		options := make([]any, 0, len(ids))
		for i, id := range ids {
			options = append(options, map[string]any{"id": id, "name": string(rune('A' + i))})
		}
		return options, ids
	}

	newField := func(t *testing.T, fieldType model.PropertyFieldType, objectType string, attrs model.StringInterface) *model.PropertyField {
		t.Helper()
		field, appErr := th.App.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:           group.ID,
			Name:              model.NewId(),
			Type:              fieldType,
			ObjectType:        objectType,
			TargetType:        system,
			Attrs:             attrs,
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}, false, "")
		require.Nil(t, appErr)
		return field
	}

	// channelField is a channel field with three options, and their IDs.
	channelField := func(t *testing.T, fieldType model.PropertyFieldType, attrs model.StringInterface) (*model.PropertyField, []string) {
		t.Helper()
		options, ids := newOptions()
		if attrs == nil {
			attrs = model.StringInterface{}
		}
		attrs[model.PropertyFieldAttributeOptions] = options
		return newField(t, fieldType, model.PropertyFieldObjectTypeChannel, attrs), ids
	}

	hold := func(t *testing.T, field *model.PropertyField, raw string) {
		t.Helper()
		_, err := th.Store.PropertyValue().Create(&model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "channel",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(raw),
		})
		require.NoError(t, err)
	}

	optionIDs := func(t *testing.T, fieldID string) []string {
		t.Helper()
		page, appErr := th.App.GetPropertyFieldOptions(rctx, group.ID, fieldID, 0, "", 100)
		require.Nil(t, appErr)
		ids := make([]string, 0, len(page.Options))
		for _, option := range page.Options {
			ids = append(ids, option.ID)
		}
		return ids
	}

	requireInUseRefusal := func(t *testing.T, appErr *model.AppError) {
		t.Helper()
		require.NotNil(t, appErr)
		require.Equal(t, "api.property_field.options.delete.in_use.app_error", appErr.Id)
		require.Equal(t, http.StatusConflict, appErr.StatusCode)
	}

	t.Run("a select option held by a channel is refused and nothing is deleted", func(t *testing.T) {
		field, ids := channelField(t, model.PropertyFieldTypeSelect, nil)
		hold(t, field, `"`+ids[0]+`"`)

		_, appErr := th.App.DeletePropertyFieldOptions(rctx, group.ID, field.ID, []string{ids[0]}, "")
		requireInUseRefusal(t, appErr)
		require.ElementsMatch(t, ids, optionIDs(t, field.ID))
	})

	t.Run("an element of a multiselect value is refused", func(t *testing.T) {
		field, ids := channelField(t, model.PropertyFieldTypeMultiselect, nil)
		hold(t, field, `["`+ids[0]+`", "`+ids[1]+`"]`)

		_, appErr := th.App.DeletePropertyFieldOptions(rctx, group.ID, field.ID, []string{ids[1]}, "")
		requireInUseRefusal(t, appErr)
		require.ElementsMatch(t, ids, optionIDs(t, field.ID))
	})

	t.Run("a template option held through a linked channel field is refused", func(t *testing.T) {
		options, ids := newOptions()
		template := newField(t, model.PropertyFieldTypeSelect, model.PropertyFieldObjectTypeTemplate, model.StringInterface{model.PropertyFieldAttributeOptions: options})
		linked, appErr := th.App.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			Name:          model.NewId(),
			ObjectType:    model.PropertyFieldObjectTypeChannel,
			TargetType:    system,
			LinkedFieldID: &template.ID,
		}, false, "")
		require.Nil(t, appErr)
		hold(t, linked, `"`+ids[2]+`"`)

		_, appErr = th.App.DeletePropertyFieldOptions(rctx, group.ID, template.ID, []string{ids[2]}, "")
		requireInUseRefusal(t, appErr)
		require.ElementsMatch(t, ids, optionIDs(t, template.ID))
	})

	t.Run("a value on an archived channel counts", func(t *testing.T) {
		field, ids := channelField(t, model.PropertyFieldTypeSelect, nil)
		channel := th.CreateChannel(t, th.BasicTeam)
		_, err := th.Store.PropertyValue().Create(&model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "channel",
			TargetID:   channel.Id,
			Value:      json.RawMessage(`"` + ids[0] + `"`),
		})
		require.NoError(t, err)
		require.Nil(t, th.App.DeleteChannel(rctx, channel, th.BasicUser.Id))

		_, appErr := th.App.DeletePropertyFieldOptions(rctx, group.ID, field.ID, []string{ids[0]}, "")
		requireInUseRefusal(t, appErr)
	})

	t.Run("an unused option is deleted", func(t *testing.T) {
		field, ids := channelField(t, model.PropertyFieldTypeSelect, nil)
		hold(t, field, `"`+ids[0]+`"`)

		_, appErr := th.App.DeletePropertyFieldOptions(rctx, group.ID, field.ID, []string{ids[1]}, "")
		require.Nil(t, appErr)
		require.ElementsMatch(t, []string{ids[0], ids[2]}, optionIDs(t, field.ID))
	})

	t.Run("one used and one unused option refuses the whole request", func(t *testing.T) {
		field, ids := channelField(t, model.PropertyFieldTypeSelect, nil)
		hold(t, field, `"`+ids[0]+`"`)

		_, appErr := th.App.DeletePropertyFieldOptions(rctx, group.ID, field.ID, []string{ids[0], ids[1]}, "")
		requireInUseRefusal(t, appErr)
		require.ElementsMatch(t, ids, optionIDs(t, field.ID))
	})

	t.Run("a field update dropping a used option is refused and the field is unchanged", func(t *testing.T) {
		field, ids := channelField(t, model.PropertyFieldTypeSelect, nil)
		hold(t, field, `"`+ids[0]+`"`)

		patched := *field
		patched.Attrs = maps.Clone(field.Attrs)
		patched.Attrs[model.PropertyFieldAttributeOptions] = []any{
			map[string]any{"id": ids[1], "name": "B"},
			map[string]any{"id": ids[2], "name": "C"},
		}
		_, _, appErr := th.App.UpdatePropertyField(rctx, group.ID, &patched, false, "")
		requireInUseRefusal(t, appErr)
		require.ElementsMatch(t, ids, optionIDs(t, field.ID))
	})

	t.Run("a field update dropping an unused option drops it", func(t *testing.T) {
		field, ids := channelField(t, model.PropertyFieldTypeSelect, nil)
		hold(t, field, `"`+ids[0]+`"`)

		patched := *field
		patched.Attrs = maps.Clone(field.Attrs)
		patched.Attrs[model.PropertyFieldAttributeOptions] = []any{
			map[string]any{"id": ids[0], "name": "A"},
			map[string]any{"id": ids[1], "name": "B"},
		}
		_, _, appErr := th.App.UpdatePropertyField(rctx, group.ID, &patched, false, "")
		require.Nil(t, appErr)
		require.ElementsMatch(t, []string{ids[0], ids[1]}, optionIDs(t, field.ID))
	})

	t.Run("a source-managed field is exempt", func(t *testing.T) {
		field, ids := channelField(t, model.PropertyFieldTypeSelect, model.StringInterface{model.PropertyFieldAttrLDAP: "attr"})
		hold(t, field, `"`+ids[0]+`"`)

		// The console asks first, so it is told the same.
		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, field.ID, ids)
		require.Nil(t, appErr)
		require.Empty(t, inUse)

		_, appErr = th.App.DeletePropertyFieldOptions(rctx, group.ID, field.ID, []string{ids[0]}, "")
		require.Nil(t, appErr)
		require.ElementsMatch(t, []string{ids[1], ids[2]}, optionIDs(t, field.ID))
	})

	t.Run("the plugin API is refused the same way", func(t *testing.T) {
		field, ids := channelField(t, model.PropertyFieldTypeSelect, nil)
		hold(t, field, `"`+ids[0]+`"`)

		err := th.SetupPluginAPI().DeletePropertyFieldOptions(group.ID, field.ID, []string{ids[0]})
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		requireInUseRefusal(t, appErr)
		require.ElementsMatch(t, ids, optionIDs(t, field.ID))
	})

	t.Run("with the flag off a used option is deleted", func(t *testing.T) {
		field, ids := channelField(t, model.PropertyFieldTypeSelect, nil)
		hold(t, field, `"`+ids[0]+`"`)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.ChannelAttributesRequired = false })
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.ChannelAttributesRequired = true })

		inUse, appErr := th.App.PropertyFieldOptionsInUse(rctx, group.ID, field.ID, ids)
		require.Nil(t, appErr)
		require.Empty(t, inUse)

		_, appErr = th.App.DeletePropertyFieldOptions(rctx, group.ID, field.ID, []string{ids[0]}, "")
		require.Nil(t, appErr)
	})
}
