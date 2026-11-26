// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestLocalCreateChannelWithPropertyValues(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.ChannelAttributes = true
		cfg.FeatureFlags.ChannelAttributesRequired = true
	}).InitBasic(t)

	// The attribute validation hook is registered against the access_control
	// group only, and channel attributes need Enterprise Advanced.
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)

	memberLevel := model.PermissionLevelMember
	sysadminLevel := model.PermissionLevelSysadmin
	noneLevel := model.PermissionLevelNone

	// Required attributes are system-wide, so one left behind by a subtest would
	// have to be satisfied by every later one. Each field lives for one subtest.
	// Fields are seeded through the property service: App.CreatePropertyField
	// refuses one created already required while any active channel lacks a value.
	createField := func(t *testing.T, fieldType model.PropertyFieldType, level model.PermissionLevel, attrs model.StringInterface) *model.PropertyField {
		t.Helper()
		field, fieldErr := th.App.Srv().PropertyService().CreatePropertyField(th.Context, &model.PropertyField{
			Name:              "f_" + model.NewId(),
			Type:              fieldType,
			GroupID:           group.ID,
			ObjectType:        "channel",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &level,
			PermissionOptions: &memberLevel,
			Attrs:             attrs,
		})
		require.NoError(t, fieldErr)
		t.Cleanup(func() {
			require.Nil(t, th.App.DeletePropertyField(th.Context, group.ID, field.ID, true, ""))
		})
		return field
	}

	newRequest := func(items ...model.PropertyValuePatchItem) (*model.ChannelCreateRequest, string) {
		name := "local-attr-" + model.NewId()
		return &model.ChannelCreateRequest{
			Channel: model.Channel{
				DisplayName: "Local attributes",
				Name:        name,
				Type:        model.ChannelTypeOpen,
				TeamId:      th.BasicTeam.Id,
			},
			PropertyValues: items,
		}, name
	}

	valuesFor := func(t *testing.T, channelID string) []*model.PropertyValue {
		t.Helper()
		values, valuesErr := th.App.SearchPropertyValues(th.Context, group.ID, model.PropertyValueSearchOpts{
			TargetType: model.PropertyValueTargetTypeChannel,
			TargetIDs:  []string{channelID},
			PerPage:    20,
		})
		require.Nil(t, valuesErr)
		return values
	}

	requireNoSuchChannel := func(t *testing.T, name string) {
		t.Helper()
		_, chErr := th.App.GetChannelByName(th.Context, name, th.BasicTeam.Id, false)
		require.NotNil(t, chErr, "the channel must not survive a refused create")
	}

	ctx := context.Background()

	t.Run("values are stored with the channel and carry no creator", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeText, memberLevel, nil)

		req, _ := newRequest(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"SECRET"`)})
		channel, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		values := valuesFor(t, channel.Id)
		require.Len(t, values, 1)
		require.Equal(t, field.ID, values[0].FieldID)
		require.JSONEq(t, `"SECRET"`, string(values[0].Value))
		// There is no session user to attribute a local write to, so none is invented.
		require.Empty(t, values[0].CreatedBy)
		require.Empty(t, values[0].UpdatedBy)
	})

	t.Run("a required attribute with a value is stored", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeText, memberLevel, model.StringInterface{
			model.PropertyFieldAttrRequired: true,
		})

		req, _ := newRequest(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"SECRET"`)})
		channel, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		values := valuesFor(t, channel.Id)
		require.Len(t, values, 1)
		require.JSONEq(t, `"SECRET"`, string(values[0].Value))
	})

	t.Run("a required attribute with no value is refused without naming it", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeText, memberLevel, model.StringInterface{
			model.PropertyFieldAttrRequired: true,
		})

		req, name := newRequest()
		_, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.channel.create_channel.missing_required_attributes.app_error")
		require.NotContains(t, err.Error(), field.Name)
		requireNoSuchChannel(t, name)
	})

	t.Run("a required attribute present only as an empty value is refused", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeText, memberLevel, model.StringInterface{
			model.PropertyFieldAttrRequired: true,
		})

		req, name := newRequest(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"   "`)})
		_, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.channel.create_channel.missing_required_attributes.app_error")
		requireNoSuchChannel(t, name)
	})

	t.Run("the local admin is held to a sysadmin-level required attribute", func(t *testing.T) {
		createField(t, model.PropertyFieldTypeText, sysadminLevel, model.StringInterface{
			model.PropertyFieldAttrRequired: true,
		})

		req, name := newRequest()
		_, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.channel.create_channel.missing_required_attributes.app_error")
		requireNoSuchChannel(t, name)
	})

	t.Run("a required attribute nobody can set does not block creation, and no direct message is posted", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeText, noneLevel, model.StringInterface{
			model.PropertyFieldAttrRequired: true,
		})

		req, _ := newRequest()
		channel, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Empty(t, valuesFor(t, channel.Id))

		missing, err := th.App.GetChannelsMissingAttributeValue(th.Context, group.ID, field, 0, 200)
		require.NoError(t, err)
		var flagged []string
		for _, entry := range missing.Channels {
			flagged = append(flagged, entry.ChannelId)
		}
		require.Contains(t, flagged, channel.Id, "the channel is flagged as missing a value")

		// Nobody is made admin of a locally created channel, so there is no one for
		// the System bot to tell.
		bot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		for _, user := range []*model.User{th.BasicUser, th.BasicUser2, th.SystemAdminUser} {
			dm, storeErr := th.App.Srv().Store().Channel().GetByName("", model.GetDMNameFromIds(bot.UserId, user.Id), false)
			if storeErr != nil {
				continue
			}
			posts, storeErr := th.App.Srv().Store().Post().GetPosts(th.Context, model.GetPostsOptions{ChannelId: dm.Id, PerPage: 50}, false, map[string]bool{})
			require.NoError(t, storeErr)
			for _, post := range posts.Posts {
				require.Nil(t, post.GetProp("property_field_ids"), "no missing-attributes message is expected")
			}
		}
	})

	t.Run("a value for an unknown field is refused and creates nothing", func(t *testing.T) {
		req, name := newRequest(model.PropertyValuePatchItem{FieldID: model.NewId(), Value: json.RawMessage(`"x"`)})
		_, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.channel.create_channel.invalid_attribute.app_error")
		requireNoSuchChannel(t, name)
	})

	t.Run("a malformed field id is refused and creates nothing", func(t *testing.T) {
		req, name := newRequest(model.PropertyValuePatchItem{FieldID: "not-an-id", Value: json.RawMessage(`"x"`)})
		_, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.channel.create_channel.invalid_attribute.app_error")
		requireNoSuchChannel(t, name)
	})

	t.Run("a duplicate field is refused and creates nothing", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeText, memberLevel, nil)

		req, name := newRequest(
			model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"a"`)},
			model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"b"`)},
		)
		_, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.channel.create_channel.invalid_attribute.app_error")
		requireNoSuchChannel(t, name)
	})

	t.Run("a value the hook rejects leaves no channel behind", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeSelect, memberLevel, model.StringInterface{
			model.PropertyFieldAttributeOptions: []map[string]any{{"id": model.NewId(), "name": "Alpha"}},
		})

		req, name := newRequest(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"not-an-option"`)})
		_, _, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.Error(t, err)
		requireNoSuchChannel(t, name)
	})

	t.Run("a classification value is refused while ClassificationMarkings is off", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ClassificationMarkings = true
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ClassificationMarkings = false
		})

		optionID := model.NewId()
		templateField, fieldErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			Name:       "classification",
			Type:       model.PropertyFieldTypeSelect,
			GroupID:    group.ID,
			ObjectType: "template",
			TargetType: "system",
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []map[string]any{{"id": optionID, "name": "SECRET"}},
			},
		}, false, "")
		require.Nil(t, fieldErr)
		t.Cleanup(func() {
			require.Nil(t, th.App.DeletePropertyField(th.Context, group.ID, templateField.ID, true, ""))
		})

		classificationField, fieldErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			Name:             "classification",
			Type:             model.PropertyFieldTypeSelect,
			GroupID:          group.ID,
			ObjectType:       "channel",
			TargetType:       "system",
			PermissionField:  &memberLevel,
			PermissionValues: &memberLevel,
			LinkedFieldID:    &templateField.ID,
		}, false, "")
		require.Nil(t, fieldErr)
		t.Cleanup(func() {
			require.Nil(t, th.App.DeletePropertyField(th.Context, group.ID, classificationField.ID, true, ""))
		})

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ClassificationMarkings = false
		})

		req, name := newRequest(model.PropertyValuePatchItem{FieldID: classificationField.ID, Value: json.RawMessage(`"` + optionID + `"`)})
		_, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.channel.create_channel.attributes_feature_disabled.app_error")
		requireNoSuchChannel(t, name)
	})

	t.Run("a plain channel body is created as before", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: "Plain local",
			Name:        "local-plain-" + model.NewId(),
			Type:        model.ChannelTypePrivate,
			TeamId:      th.BasicTeam.Id,
		}
		created, resp, err := th.LocalClient.CreateChannel(ctx, channel)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, channel.Name, created.Name)
		require.Equal(t, model.ChannelTypePrivate, created.Type)
		require.Empty(t, created.CreatorId)
		require.Empty(t, valuesFor(t, created.Id))
	})

	t.Run("board and space channels are refused", func(t *testing.T) {
		for _, channelType := range []model.ChannelType{model.ChannelTypeOpenBoard, model.ChannelTypePrivateBoard, model.ChannelTypeSpace} {
			req, name := newRequest()
			req.Type = channelType
			_, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
			require.Error(t, err, "type %s", channelType)
			CheckBadRequestStatus(t, resp)
			requireNoSuchChannel(t, name)
		}
	})

	t.Run("values are refused when the feature flag is off", func(t *testing.T) {
		field := createField(t, model.PropertyFieldTypeText, memberLevel, nil)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ChannelAttributes = false
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ChannelAttributes = true
		})

		req, name := newRequest(model.PropertyValuePatchItem{FieldID: field.ID, Value: json.RawMessage(`"x"`)})
		_, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "api.channel.create_channel.attributes_feature_disabled.app_error")
		requireNoSuchChannel(t, name)
	})

	t.Run("a plain create is unchanged when the feature flag is off", func(t *testing.T) {
		createField(t, model.PropertyFieldTypeText, memberLevel, model.StringInterface{
			model.PropertyFieldAttrRequired: true,
		})

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ChannelAttributes = false
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ChannelAttributes = true
		})

		req, _ := newRequest()
		channel, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Empty(t, valuesFor(t, channel.Id))
	})

	t.Run("a required attribute with no value is allowed when ChannelAttributesRequired is off", func(t *testing.T) {
		createField(t, model.PropertyFieldTypeText, memberLevel, model.StringInterface{
			model.PropertyFieldAttrRequired: true,
		})

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ChannelAttributesRequired = false
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.ChannelAttributesRequired = true
		})

		req, _ := newRequest()
		_, resp, err := th.LocalClient.CreateChannelWithPropertyValues(ctx, req)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})
}
