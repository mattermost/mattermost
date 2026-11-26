// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func TestPropertyRoutesEnabled(t *testing.T) {
	mainHelper.Parallel(t)

	require.False(t, propertyRoutesEnabled(&model.FeatureFlags{}))

	for name, set := range map[string]func(*model.FeatureFlags){
		"IntegratedBoards":         func(f *model.FeatureFlags) { f.IntegratedBoards = true },
		"ManagedChannelCategories": func(f *model.FeatureFlags) { f.ManagedChannelCategories = true },
		"ClassificationMarkings":   func(f *model.FeatureFlags) { f.ClassificationMarkings = true },
		"SessionAttributes":        func(f *model.FeatureFlags) { f.SessionAttributes = true },
		"PostAttributes":           func(f *model.FeatureFlags) { f.PostAttributes = true },
		"ChannelAttributes":        func(f *model.FeatureFlags) { f.ChannelAttributes = true },
	} {
		t.Run(name+" alone enables the routes", func(t *testing.T) {
			flags := &model.FeatureFlags{}
			set(flags)
			require.True(t, propertyRoutesEnabled(flags))
		})
	}
}

func TestPropertiesLocalRoutes(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = false
		cfg.FeatureFlags.ManagedChannelCategories = false
		cfg.FeatureFlags.ClassificationMarkings = false
		cfg.FeatureFlags.SessionAttributes = false
		cfg.FeatureFlags.PostAttributes = false
		cfg.FeatureFlags.ChannelAttributes = true
	}).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)

	memberLevel := model.PermissionLevelMember
	noneLevel := model.PermissionLevelNone

	createField := func(t *testing.T, fieldType model.PropertyFieldType, valueLevel model.PermissionLevel, attrs model.StringInterface) *model.PropertyField {
		t.Helper()
		field, err := th.App.Srv().PropertyService().CreatePropertyField(th.Context, &model.PropertyField{
			Name:              "f_" + model.NewId(),
			Type:              fieldType,
			GroupID:           group.ID,
			ObjectType:        model.PropertyFieldObjectTypeChannel,
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &valueLevel,
			PermissionOptions: &memberLevel,
			Attrs:             attrs,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			require.Nil(t, th.App.DeletePropertyField(th.Context, group.ID, field.ID, true, ""))
		})
		return field
	}

	ctx := context.Background()
	channelObject := model.PropertyFieldObjectTypeChannel

	t.Run("field search lists the channel fields", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeText, memberLevel, nil)

		fields, resp, err := th.LocalClient.SearchPropertyFields(ctx, group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{channelObject},
			TargetType:  string(model.PropertyValueTargetTypeSystem),
			PerPage:     model.AccessControlGroupFieldLimit + 5,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		var found *model.PropertyField
		for _, f := range fields {
			if f.ID == field.ID {
				found = f
			}
		}
		require.NotNil(t, found, "the channel field must be listed")
		require.Equal(t, field.Name, found.Name)
	})

	t.Run("field options are paged", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeSelect, memberLevel, model.StringInterface{
			model.PropertyFieldAttributeOptions: []map[string]any{
				{"id": model.NewId(), "name": "Alpha"},
				{"id": model.NewId(), "name": "Beta"},
				{"id": model.NewId(), "name": "Gamma"},
			},
		})

		page, resp, err := th.LocalClient.GetPropertyFieldOptions(ctx, group.Name, channelObject, field.ID, 0, "", 2)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, page.Options, 2)
		require.True(t, page.HasMore)

		next, resp, err := th.LocalClient.GetPropertyFieldOptions(ctx, group.Name, channelObject, field.ID, page.NextCursorCreateAt, page.NextCursorID, 2)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, next.Options, 1)
		require.False(t, next.HasMore)

		names := []string{page.Options[0].Name, page.Options[1].Name, next.Options[0].Name}
		require.ElementsMatch(t, []string{"Alpha", "Beta", "Gamma"}, names)
	})

	t.Run("a channel's values are read", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeText, memberLevel, nil)

		rctx := app.RequestContextWithCallerID(th.Context, model.CallerIDLocalAdmin)
		_, appErr := th.App.UpsertPropertyValues(rctx, []*model.PropertyValue{{
			TargetID:   th.BasicChannel.Id,
			TargetType: channelObject,
			GroupID:    group.ID,
			FieldID:    field.ID,
			Value:      json.RawMessage(`"SEEDED"`),
		}}, channelObject, th.BasicChannel.Id, "")
		require.Nil(t, appErr)

		values, resp, err := th.LocalClient.GetPropertyValues(ctx, group.Name, channelObject, th.BasicChannel.Id, model.PropertyValueSearch{PerPage: 20})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)
		require.Equal(t, field.ID, values[0].FieldID)
		require.JSONEq(t, `"SEEDED"`, string(values[0].Value))
	})

	t.Run("a channel's value is written without a creator", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeText, memberLevel, nil)

		written, resp, err := th.LocalClient.PatchPropertyValues(ctx, group.Name, channelObject, th.BasicChannel.Id, []model.PropertyValuePatchItem{
			{FieldID: field.ID, Value: json.RawMessage(`"WRITTEN"`)},
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, written, 1)
		require.JSONEq(t, `"WRITTEN"`, string(written[0].Value))
		// A local session has no user, and none is invented for it.
		require.Empty(t, written[0].CreatedBy)
		require.Empty(t, written[0].UpdatedBy)

		stored, appErr := th.App.SearchPropertyValues(th.Context, group.ID, model.PropertyValueSearchOpts{
			TargetType: model.PropertyValueTargetTypeChannel,
			TargetIDs:  []string{th.BasicChannel.Id},
			PerPage:    20,
		})
		require.Nil(t, appErr)
		require.Len(t, stored, 1)
		require.JSONEq(t, `"WRITTEN"`, string(stored[0].Value))
	})

	t.Run("a value write runs as the local admin", func(t *testing.T) {
		// Nobody holds a tier of none, a system admin included, so only a caller
		// the property hooks know as the local admin gets through.
		field := createField(t, model.PropertyFieldTypeText, noneLevel, nil)
		items := []model.PropertyValuePatchItem{{FieldID: field.ID, Value: json.RawMessage(`"LOCKED"`)}}

		_, resp, err := th.SystemAdminClient.PatchPropertyValues(ctx, group.Name, channelObject, th.BasicChannel.Id, items)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		written, resp, err := th.LocalClient.PatchPropertyValues(ctx, group.Name, channelObject, th.BasicChannel.Id, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, written, 1)
	})

	t.Run("a value the hook rejects is refused", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeSelect, memberLevel, model.StringInterface{
			model.PropertyFieldAttributeOptions: []map[string]any{{"id": model.NewId(), "name": "Alpha"}},
		})

		_, resp, err := th.LocalClient.PatchPropertyValues(ctx, group.Name, channelObject, th.BasicChannel.Id, []model.PropertyValuePatchItem{
			{FieldID: field.ID, Value: json.RawMessage(`"not-an-option"`)},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("a channel field's definition and options are not served", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeSelect, memberLevel, model.StringInterface{
			model.PropertyFieldAttributeOptions: []map[string]any{{"id": model.NewId(), "name": "Alpha"}},
		})
		page, _, err := th.SystemAdminClient.GetPropertyFieldOptions(ctx, group.Name, channelObject, field.ID, 0, "", 10)
		require.NoError(t, err)
		require.Len(t, page.Options, 1)

		renamed := "renamed"
		option := &model.PropertyFieldOption{ID: page.Options[0].ID, Name: "Other"}

		for name, call := range map[string]func() (*model.Response, error){
			"create a field": func() (*model.Response, error) {
				_, resp, err := th.LocalClient.CreatePropertyField(ctx, group.Name, channelObject, &model.PropertyField{
					Name:       model.NewId(),
					Type:       model.PropertyFieldTypeText,
					TargetType: "system",
				})
				return resp, err
			},
			"list fields": func() (*model.Response, error) {
				_, resp, err := th.LocalClient.GetPropertyFields(ctx, group.Name, channelObject, model.PropertyFieldSearch{TargetType: "system"})
				return resp, err
			},
			"patch a field": func() (*model.Response, error) {
				_, resp, err := th.LocalClient.PatchPropertyField(ctx, group.Name, channelObject, field.ID, &model.PropertyFieldPatch{Name: &renamed})
				return resp, err
			},
			"delete a field": func() (*model.Response, error) {
				return th.LocalClient.DeletePropertyField(ctx, group.Name, channelObject, field.ID)
			},
			"create options": func() (*model.Response, error) {
				_, resp, err := th.LocalClient.CreatePropertyFieldOptions(ctx, group.Name, channelObject, field.ID, []*model.PropertyFieldOption{{Name: "New"}})
				return resp, err
			},
			"patch options": func() (*model.Response, error) {
				_, resp, err := th.LocalClient.PatchPropertyFieldOptions(ctx, group.Name, channelObject, field.ID, []*model.PropertyFieldOption{option})
				return resp, err
			},
			"delete options": func() (*model.Response, error) {
				return th.LocalClient.DeletePropertyFieldOptions(ctx, group.Name, channelObject, field.ID, []string{option.ID})
			},
			"read system values": func() (*model.Response, error) {
				_, resp, err := th.LocalClient.GetSystemPropertyValues(ctx, group.Name, model.PropertyValueSearch{})
				return resp, err
			},
			"write system values": func() (*model.Response, error) {
				_, resp, err := th.LocalClient.PatchSystemPropertyValues(ctx, group.Name, []model.PropertyValuePatchItem{
					{FieldID: field.ID, Value: json.RawMessage(`"x"`)},
				})
				return resp, err
			},
			"list channels missing a value": func() (*model.Response, error) {
				_, resp, err := th.LocalClient.GetChannelsMissingAttributeValue(ctx, group.Name, field.ID, 0, 10)
				return resp, err
			},
			"notify channel admins": func() (*model.Response, error) {
				_, resp, err := th.LocalClient.NotifyChannelAdminsOfMissingAttributeValue(ctx, group.Name, field.ID)
				return resp, err
			},
		} {
			t.Run(name, func(t *testing.T) {
				resp, err := call()
				require.Error(t, err)
				CheckNotFoundStatus(t, resp)
			})
		}

		after, appErr := th.App.GetPropertyField(th.Context, group.ID, field.ID)
		require.Nil(t, appErr)
		require.Equal(t, field.Name, after.Name)
	})
}

func TestPropertiesLocalRoutesAbsentWithoutGateFlags(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = false
		cfg.FeatureFlags.ManagedChannelCategories = false
		cfg.FeatureFlags.ClassificationMarkings = false
		cfg.FeatureFlags.SessionAttributes = false
		cfg.FeatureFlags.PostAttributes = false
		cfg.FeatureFlags.ChannelAttributes = false
	}).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	ctx := context.Background()
	group := model.AccessControlPropertyGroupName
	channelObject := model.PropertyFieldObjectTypeChannel
	fieldID := model.NewId()

	_, resp, err := th.LocalClient.SearchPropertyFields(ctx, group, model.PropertyFieldSearch{ObjectTypes: []string{channelObject}})
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = th.LocalClient.GetPropertyFieldOptions(ctx, group, channelObject, fieldID, 0, "", 10)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = th.LocalClient.GetPropertyValues(ctx, group, channelObject, th.BasicChannel.Id, model.PropertyValueSearch{})
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = th.LocalClient.PatchPropertyValues(ctx, group, channelObject, th.BasicChannel.Id, []model.PropertyValuePatchItem{
		{FieldID: fieldID, Value: json.RawMessage(`"x"`)},
	})
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}
