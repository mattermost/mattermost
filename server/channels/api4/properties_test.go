// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestCreatePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	// Register a property group for testing
	group, err := th.App.RegisterPropertyGroup(th.Context, "test_properties")
	require.Nil(t, err)
	require.NotNil(t, group)

	t.Run("unauthenticated request should fail", func(t *testing.T) {
		client := model.NewAPIv4Client(th.Client.URL)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
		}

		_, resp, err := client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("create protected field should fail", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
			Protected:  true,
		}

		_, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-admin should have permissions forced to member", func(t *testing.T) {
		th.LoginBasic(t)

		sysadminLevel := model.PermissionLevelSysadmin
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			TargetType:        "channel",
			TargetID:          th.BasicChannel.Id,
			PermissionField:   &sysadminLevel,
			PermissionValues:  &sysadminLevel,
			PermissionOptions: &sysadminLevel,
		}

		createdField, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// Non-admin should have permissions forced to member
		require.NotNil(t, createdField.PermissionField)
		require.Equal(t, model.PermissionLevelMember, *createdField.PermissionField)
		require.NotNil(t, createdField.PermissionValues)
		require.Equal(t, model.PermissionLevelMember, *createdField.PermissionValues)
		require.NotNil(t, createdField.PermissionOptions)
		require.Equal(t, model.PermissionLevelMember, *createdField.PermissionOptions)
	})

	t.Run("admin should get default member permissions when not specified", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
		}

		createdField, resp, err := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// Admin with no permissions specified should get member defaults
		require.NotNil(t, createdField.PermissionField)
		require.Equal(t, model.PermissionLevelMember, *createdField.PermissionField)
		require.NotNil(t, createdField.PermissionValues)
		require.Equal(t, model.PermissionLevelMember, *createdField.PermissionValues)
		require.NotNil(t, createdField.PermissionOptions)
		require.Equal(t, model.PermissionLevelMember, *createdField.PermissionOptions)
	})

	t.Run("admin should keep custom permissions when specified", func(t *testing.T) {
		sysadminLevel := model.PermissionLevelSysadmin
		memberLevel := model.PermissionLevelMember
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			TargetType:        "system",
			PermissionField:   &sysadminLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &sysadminLevel,
		}

		createdField, resp, err := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// Admin should keep the custom permissions
		require.NotNil(t, createdField.PermissionField)
		require.Equal(t, model.PermissionLevelSysadmin, *createdField.PermissionField)
		require.NotNil(t, createdField.PermissionValues)
		require.Equal(t, model.PermissionLevelMember, *createdField.PermissionValues)
		require.NotNil(t, createdField.PermissionOptions)
		require.Equal(t, model.PermissionLevelSysadmin, *createdField.PermissionOptions)
	})

	t.Run("invalid group name should fail", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
		}

		// Invalid group name with uppercase — route regex won't match, returns 404
		_, resp, err := th.Client.CreatePropertyField(context.Background(), "Invalid", "post", field)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("nonexistent group name should fail", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
		}

		_, resp, err := th.Client.CreatePropertyField(context.Background(), "nonexistent_group", "post", field)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("successful creation should return 201", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "channel",
			TargetID:   th.BasicChannel.Id,
		}

		createdField, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		require.NotEmpty(t, createdField.ID)
		require.Equal(t, field.Name, createdField.Name)
		require.Equal(t, "post", createdField.ObjectType)
		require.Equal(t, group.ID, createdField.GroupID)
		require.Equal(t, th.BasicUser.Id, createdField.CreatedBy)
	})

	t.Run("websocket event should be fired on field creation", func(t *testing.T) {
		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "channel",
			TargetID:   th.BasicChannel.Id,
		}

		createdField, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		var receivedField model.PropertyField
		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventPropertyFieldCreated {
					fieldData, ok := event.GetData()["property_field"].(string)
					require.True(t, ok)
					require.NoError(t, json.Unmarshal([]byte(fieldData), &receivedField))
					require.Equal(t, "post", event.GetData()["object_type"])
					require.Equal(t, th.BasicChannel.Id, event.GetBroadcast().ChannelId)
					return true
				}
			default:
				return false
			}
			return false
		}, 5*time.Second, 100*time.Millisecond)

		require.Equal(t, createdField.ID, receivedField.ID)
		require.Equal(t, createdField.Name, receivedField.Name)
	})

	t.Run("group_id in body should be overridden by group_name from URL", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "channel",
			TargetID:   th.BasicChannel.Id,
			GroupID:    model.NewId(), // Try to set a different group ID in body
		}

		createdField, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// The group ID should come from the URL's group_name resolution, not the body
		require.Equal(t, group.ID, createdField.GroupID)
	})

	t.Run("system target_type requires ManageSystem permission", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
		}

		// Non-admin should be rejected for system-scoped fields
		_, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Admin should succeed
		createdField, resp, err := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, "system", createdField.TargetType)
	})

	t.Run("channel target_type requires CreatePost permission", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "channel",
			TargetID:   th.BasicChannel.Id,
		}

		// BasicUser is a member of BasicChannel and can post — should succeed
		createdField, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, "channel", createdField.TargetType)
		require.Equal(t, th.BasicChannel.Id, createdField.TargetID)
	})

	t.Run("channel target_type with inaccessible channel should fail", func(t *testing.T) {
		th.LoginBasic(t)

		// Create a channel BasicUser is not a member of
		otherTeam := th.CreateTeamWithClient(t, th.SystemAdminClient)
		otherChannel := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypeOpen, otherTeam.Id)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "channel",
			TargetID:   otherChannel.Id,
		}

		_, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("channel target_type without target_id should fail", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "channel",
		}

		_, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("team target_type requires ManageTeam permission", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "team",
			TargetID:   th.BasicTeam.Id,
		}

		// BasicUser is a member but not a team admin — should fail
		_, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// SystemAdmin should succeed
		createdField, resp, err := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, "team", createdField.TargetType)
		require.Equal(t, th.BasicTeam.Id, createdField.TargetID)
	})

	t.Run("team target_type without target_id should fail", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "team",
		}

		_, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unknown target_type should fail with bad request", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "unknown",
			TargetID:   model.NewId(),
		}

		_, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("empty target_type should fail with bad request", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}

		_, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestGetPropertyFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	// Register property groups for testing
	group, err := th.App.RegisterPropertyGroup(th.Context, "test_properties_get")
	require.Nil(t, err)
	require.NotNil(t, group)

	otherGroup, err := th.App.RegisterPropertyGroup(th.Context, "test_properties_get_other")
	require.Nil(t, err)
	require.NotNil(t, otherGroup)

	memberLevel := model.PermissionLevelMember

	// Create a field in the main group
	field := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "post",
		TargetType:        "system",
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
	require.Nil(t, appErr)
	require.NotNil(t, createdField)

	// Create a field in a different group
	otherField := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           otherGroup.ID,
		ObjectType:        "post",
		TargetType:        "system",
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdOtherField, appErr := th.App.CreatePropertyField(th.Context, otherField, false, "")
	require.Nil(t, appErr)
	require.NotNil(t, createdOtherField)

	t.Run("unauthenticated request should fail", func(t *testing.T) {
		client := model.NewAPIv4Client(th.Client.URL)

		_, resp, err := client.GetPropertyFields(context.Background(), group.Name, "post", model.PropertyFieldSearch{PerPage: 60})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("nonexistent group name should fail", func(t *testing.T) {
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), "nonexistent_group", "post", model.PropertyFieldSearch{PerPage: 60})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("successful get should return fields", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), group.Name, "post", model.PropertyFieldSearch{PerPage: 60, TargetType: "system"})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.NotEmpty(t, fields)
		found := false
		for _, f := range fields {
			if f.ID == createdField.ID {
				found = true
				break
			}
		}
		require.True(t, found, "Created field should be in the response")
	})

	t.Run("cursor pagination should return subsequent pages", func(t *testing.T) {
		th.LoginBasic(t)

		// Create additional fields to have enough for pagination
		for range 3 {
			f := &model.PropertyField{
				Name:              model.NewId(),
				Type:              model.PropertyFieldTypeText,
				GroupID:           group.ID,
				ObjectType:        "post",
				TargetType:        "system",
				PermissionField:   &memberLevel,
				PermissionValues:  &memberLevel,
				PermissionOptions: &memberLevel,
			}
			_, appErr := th.App.CreatePropertyField(th.Context, f, false, "")
			require.Nil(t, appErr)
		}

		// First request without cursor
		page0, resp, err := th.Client.GetPropertyFields(context.Background(), group.Name, "post", model.PropertyFieldSearch{PerPage: 2, TargetType: "system"})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, page0, 2)

		// Use last item from first page as cursor
		lastField := page0[len(page0)-1]
		page1, resp, err := th.Client.GetPropertyFields(context.Background(), group.Name, "post", model.PropertyFieldSearch{
			PerPage:        2,
			TargetType:     "system",
			CursorID:       lastField.ID,
			CursorCreateAt: lastField.CreateAt,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, page1)

		// Pages should contain different fields
		page0IDs := map[string]bool{}
		for _, f := range page0 {
			page0IDs[f.ID] = true
		}
		for _, f := range page1 {
			require.False(t, page0IDs[f.ID], "Second page should not contain fields from first page")
		}
	})

	t.Run("invalid cursor should return 400", func(t *testing.T) {
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), group.Name, "post", model.PropertyFieldSearch{
			PerPage:        2,
			TargetType:     "system",
			CursorID:       "not-a-valid-id",
			CursorCreateAt: 12345,
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get should only return fields from the specified group", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), group.Name, "post", model.PropertyFieldSearch{PerPage: 60, TargetType: "system"})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// All returned fields must belong to the queried group
		for _, f := range fields {
			require.Equal(t, group.ID, f.GroupID, "All returned fields should belong to the queried group")
		}

		// The field from the other group should not be present
		for _, f := range fields {
			require.NotEqual(t, createdOtherField.ID, f.ID, "Field from other group should not be returned")
		}
	})
}

func TestGetPropertyFieldsScopeAccess(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_properties_scope")
	require.Nil(t, err)
	require.NotNil(t, group)

	baseURL := "/properties/groups/" + group.Name + "/post/fields"

	// target_type=system without target_id should succeed (system needs no resource scope)
	t.Run("system target_type without target_id should succeed", func(t *testing.T) {
		th.LoginBasic(t)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL+"?target_type=system", "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()
	})

	// target_type=system with target_id should succeed
	t.Run("system target_type with target_id should succeed", func(t *testing.T) {
		th.LoginBasic(t)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL+"?target_type=system&target_id="+model.NewId(), "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()
	})

	// target_type=channel without target_id should fail with 400
	t.Run("channel target_type without target_id should fail", func(t *testing.T) {
		th.LoginBasic(t)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL+"?target_type=channel", "")
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()
	})

	// target_type=channel with target_id the user has access to should succeed
	t.Run("channel target_type with accessible channel should succeed", func(t *testing.T) {
		th.LoginBasic(t)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL+"?target_type=channel&target_id="+th.BasicChannel.Id, "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()
	})

	// target_type=channel with target_id the user does NOT have access to should fail with 403
	t.Run("channel target_type with inaccessible channel should fail", func(t *testing.T) {
		th.LoginBasic(t)

		// Create a channel in a team the basic user is not a member of
		otherTeam := th.CreateTeamWithClient(t, th.SystemAdminClient)
		otherChannel := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypeOpen, otherTeam.Id)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL+"?target_type=channel&target_id="+otherChannel.Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})

	// target_type=team without target_id should fail with 400
	t.Run("team target_type without target_id should fail", func(t *testing.T) {
		th.LoginBasic(t)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL+"?target_type=team", "")
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()
	})

	// target_type=team with target_id the user has access to should succeed
	t.Run("team target_type with accessible team should succeed", func(t *testing.T) {
		th.LoginBasic(t)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL+"?target_type=team&target_id="+th.BasicTeam.Id, "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()
	})

	// target_type=team with target_id the user does NOT have access to should fail with 403
	t.Run("team target_type with inaccessible team should fail", func(t *testing.T) {
		th.LoginBasic(t)

		// Create a team the basic user is not a member of
		otherTeam := th.CreateTeamWithClient(t, th.SystemAdminClient)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL+"?target_type=team&target_id="+otherTeam.Id, "")
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		resp.Body.Close()
	})

	// No target_type at all should fail with bad request
	t.Run("no target_type should fail", func(t *testing.T) {
		th.LoginBasic(t)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL, "")
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()
	})
}

func TestGetPropertyFieldsFiltering(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_properties_filter")
	require.Nil(t, err)
	require.NotNil(t, group)

	memberLevel := model.PermissionLevelMember

	// Create fields with different target_type/target_id combinations
	systemField := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "post",
		TargetType:        "system",
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdSystemField, appErr := th.App.CreatePropertyField(th.Context, systemField, false, "")
	require.Nil(t, appErr)

	channelField := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "post",
		TargetType:        "channel",
		TargetID:          th.BasicChannel.Id,
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdChannelField, appErr := th.App.CreatePropertyField(th.Context, channelField, false, "")
	require.Nil(t, appErr)

	otherChannelField := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "post",
		TargetType:        "channel",
		TargetID:          th.BasicChannel2.Id,
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdOtherChannelField, appErr := th.App.CreatePropertyField(th.Context, otherChannelField, false, "")
	require.Nil(t, appErr)

	baseURL := "/properties/groups/" + group.Name + "/post/fields"

	decodeFields := func(t *testing.T, resp *http.Response) []*model.PropertyField {
		t.Helper()
		var fields []*model.PropertyField
		err := json.NewDecoder(resp.Body).Decode(&fields)
		require.NoError(t, err)
		return fields
	}

	fieldIDs := func(fields []*model.PropertyField) map[string]bool {
		ids := make(map[string]bool, len(fields))
		for _, f := range fields {
			ids[f.ID] = true
		}
		return ids
	}

	t.Run("no target_type returns bad request", func(t *testing.T) {
		th.LoginBasic(t)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL, "")
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		resp.Body.Close()
	})

	t.Run("filter by target_type=system returns only system fields", func(t *testing.T) {
		th.LoginBasic(t)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL+"?target_type=system", "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		ids := fieldIDs(decodeFields(t, resp))
		resp.Body.Close()

		require.True(t, ids[createdSystemField.ID], "system field should be present")
		require.False(t, ids[createdChannelField.ID], "channel field should not be present")
		require.False(t, ids[createdOtherChannelField.ID], "other channel field should not be present")
	})

	t.Run("filter by target_type=channel and target_id returns only matching field", func(t *testing.T) {
		th.LoginBasic(t)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL+"?target_type=channel&target_id="+th.BasicChannel.Id, "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		ids := fieldIDs(decodeFields(t, resp))
		resp.Body.Close()

		require.True(t, ids[createdChannelField.ID], "channel field should be present")
		require.False(t, ids[createdSystemField.ID], "system field should not be present")
		require.False(t, ids[createdOtherChannelField.ID], "other channel field should not be present")
	})

	t.Run("filter by target_type=channel and different target_id returns different field", func(t *testing.T) {
		th.LoginBasic(t)

		resp, err := th.Client.DoAPIGet(context.Background(), baseURL+"?target_type=channel&target_id="+th.BasicChannel2.Id, "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		ids := fieldIDs(decodeFields(t, resp))
		resp.Body.Close()

		require.True(t, ids[createdOtherChannelField.ID], "other channel field should be present")
		require.False(t, ids[createdSystemField.ID], "system field should not be present")
		require.False(t, ids[createdChannelField.ID], "first channel field should not be present")
	})
}

func TestPatchPropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	// Register property groups for testing
	group, err := th.App.RegisterPropertyGroup(th.Context, "test_properties_patch")
	require.Nil(t, err)
	require.NotNil(t, group)

	otherGroup, err := th.App.RegisterPropertyGroup(th.Context, "test_properties_patch_other")
	require.Nil(t, err)
	require.NotNil(t, otherGroup)

	noneLevel := model.PermissionLevelNone
	memberLevel := model.PermissionLevelMember
	sysadminLevel := model.PermissionLevelSysadmin

	t.Run("unauthenticated request should fail", func(t *testing.T) {
		client := model.NewAPIv4Client(th.Client.URL)

		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: &newName}

		_, resp, err := client.PatchPropertyField(context.Background(), group.Name, "post", model.NewId(), patch)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("protected field update should fail", func(t *testing.T) {
		protectedField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			Protected:         true,
			PermissionField:   &noneLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdProtectedField, appErr := th.App.CreatePropertyField(th.Context, protectedField, true, "")
		require.Nil(t, appErr)
		require.NotNil(t, createdProtectedField)

		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: &newName}

		_, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "post", createdProtectedField.ID, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("object type mismatch should fail", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: &newName}

		// Try to update with wrong object_type in URL
		_, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "channel", createdField.ID, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch with wrong group name should fail", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: &newName}

		// Try to patch using the other group's name — field belongs to `group`, not `otherGroup`
		_, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), otherGroup.Name, "post", createdField.ID, patch)
		require.Error(t, err)
		// GetPropertyField with the wrong groupID should not find the field
		require.NotEqual(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("options-only update should check options permission", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			GroupID:    group.ID,
			ObjectType: "post",
			TargetType: "system",
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "Option 1"},
				},
			},
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &sysadminLevel, // Only admin can manage options
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		require.NotNil(t, createdField)

		// Try to update options as a non-admin
		th.LoginBasic(t)
		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "New Option"},
				},
			},
		}

		_, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Admin should be able to update options
		_, resp, err = th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("options-only update on non-select field should check field permission", func(t *testing.T) {
		// A text field with options in attrs should NOT use the options permission path
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &sysadminLevel, // Only admin can edit field
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel, // Member can manage options
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		require.NotNil(t, createdField)

		// Non-admin patches only options on a text field — should require field permission, not options
		th.LoginBasic(t)
		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "Option 1"},
				},
			},
		}

		_, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Admin should succeed (has field permission)
		_, resp, err = th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("options-only update on select field with member options permission should succeed", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			GroupID:    group.ID,
			ObjectType: "post",
			TargetType: "system",
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "Option 1"},
				},
			},
			PermissionField:   &sysadminLevel, // Only admin can edit field
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel, // Member can manage options
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		th.LoginBasic(t)
		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "New Option"},
				},
			},
		}

		updatedField, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, updatedField)
	})

	t.Run("options-only update on multiselect field with member options permission should succeed", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			GroupID:    group.ID,
			ObjectType: "post",
			TargetType: "system",
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "Option 1"},
				},
			},
			PermissionField:   &sysadminLevel, // Only admin can edit field
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel, // Member can manage options
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		th.LoginBasic(t)
		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "New Option"},
				},
			},
		}

		updatedField, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, updatedField)
	})

	t.Run("options-only update on select field with none options permission should fail for all", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			GroupID:    group.ID,
			ObjectType: "post",
			TargetType: "system",
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "Option 1"},
				},
			},
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &noneLevel, // Nobody can manage options via permission
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "New Option"},
				},
			},
		}

		// Non-admin should fail
		th.LoginBasic(t)
		_, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Admin should also fail
		_, resp, err = th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("name and options update on select field should check field permission not options", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			GroupID:    group.ID,
			ObjectType: "post",
			TargetType: "system",
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "Option 1"},
				},
			},
			PermissionField:   &sysadminLevel, // Only admin can edit field
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel, // Member can manage options
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		newName := model.NewId()
		patch := &model.PropertyFieldPatch{
			Name: &newName,
			Attrs: &model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "New Option"},
				},
			},
		}

		// Non-admin should fail — name change requires field permission (sysadmin)
		th.LoginBasic(t)
		_, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Admin should succeed
		updatedField, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, newName, updatedField.Name)
	})

	t.Run("field update should check field permission", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &sysadminLevel, // Only admin can edit field
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		require.NotNil(t, createdField)

		// Try to update name as a non-admin
		th.LoginBasic(t)
		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: &newName}

		_, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Admin should be able to update name
		_, resp, err = th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("successful update should return updated field", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		th.LoginBasic(t)
		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: &newName}

		updatedField, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Equal(t, newName, updatedField.Name)
		require.Equal(t, th.BasicUser.Id, updatedField.UpdatedBy)
	})

	t.Run("websocket event should be fired on field update", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: &newName}

		updatedField, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		var receivedField model.PropertyField
		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventPropertyFieldUpdated {
					fieldData, ok := event.GetData()["property_field"].(string)
					require.True(t, ok)
					require.NoError(t, json.Unmarshal([]byte(fieldData), &receivedField))
					require.Equal(t, "post", event.GetData()["object_type"])
					// system-scoped field: no team or channel in broadcast
					require.Empty(t, event.GetBroadcast().TeamId)
					require.Empty(t, event.GetBroadcast().ChannelId)
					return true
				}
			default:
				return false
			}
			return false
		}, 5*time.Second, 100*time.Millisecond)

		require.Equal(t, updatedField.ID, receivedField.ID)
		require.Equal(t, newName, receivedField.Name)
	})

	t.Run("target_id in patch should be silently ignored", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		th.LoginSystemAdmin(t)
		newName := model.NewId()
		newTargetID := model.NewId()
		patch := &model.PropertyFieldPatch{
			Name:     &newName,
			TargetID: &newTargetID,
		}

		updatedField, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Equal(t, newName, updatedField.Name)
		require.Equal(t, createdField.TargetID, updatedField.TargetID)
	})

	t.Run("target_type in patch should be silently ignored", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		th.LoginSystemAdmin(t)
		newName := model.NewId()
		newTargetType := "channel"
		patch := &model.PropertyFieldPatch{
			Name:       &newName,
			TargetType: &newTargetType,
		}

		updatedField, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Equal(t, newName, updatedField.Name)
		require.Equal(t, "system", updatedField.TargetType)
	})

	t.Run("options-only patch should preserve other attrs keys via merge semantics", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			GroupID:    group.ID,
			ObjectType: "post",
			TargetType: "system",
			Attrs: model.StringInterface{
				"subtype": "color",
				"options": []map[string]any{
					{"id": model.NewId(), "name": "Option 1"},
				},
			},
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		th.LoginBasic(t)
		newOptionID := model.NewId()
		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				"options": []map[string]any{
					{"id": newOptionID, "name": "New Option"},
				},
			},
		}

		updatedField, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// The "subtype" key should be preserved even though only "options" was patched
		require.Equal(t, "color", updatedField.Attrs["subtype"])
		// The "options" key should be updated
		require.NotNil(t, updatedField.Attrs["options"])
	})

	t.Run("PSAv1 field should not be patchable", func(t *testing.T) {
		// Create a PSAv1 field (empty ObjectType) directly via the service
		v1Field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			GroupID:    group.ID,
			ObjectType: "",
			TargetType: "system",
			TargetID:   model.NewId(),
		}
		createdV1Field, appErr := th.App.CreatePropertyField(th.Context, v1Field, true, "")
		require.Nil(t, appErr)

		th.LoginBasic(t)
		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: &newName}

		_, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdV1Field.ID, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestDeletePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	// Register property groups for testing
	group, err := th.App.RegisterPropertyGroup(th.Context, "test_properties_delete")
	require.Nil(t, err)
	require.NotNil(t, group)

	otherGroup, err := th.App.RegisterPropertyGroup(th.Context, "test_properties_delete_other")
	require.Nil(t, err)
	require.NotNil(t, otherGroup)

	noneLevel := model.PermissionLevelNone
	memberLevel := model.PermissionLevelMember
	sysadminLevel := model.PermissionLevelSysadmin

	t.Run("unauthenticated request should fail", func(t *testing.T) {
		client := model.NewAPIv4Client(th.Client.URL)

		resp, err := client.DeletePropertyField(context.Background(), group.Name, "post", model.NewId())
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("protected field delete should fail", func(t *testing.T) {
		protectedField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			Protected:         true,
			PermissionField:   &noneLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdProtectedField, appErr := th.App.CreatePropertyField(th.Context, protectedField, true, "")
		require.Nil(t, appErr)

		resp, err := th.SystemAdminClient.DeletePropertyField(context.Background(), group.Name, "post", createdProtectedField.ID)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("object type mismatch should fail", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		// Try to delete with wrong object_type in URL
		resp, err := th.SystemAdminClient.DeletePropertyField(context.Background(), group.Name, "channel", createdField.ID)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete with wrong group name should fail", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		// Try to delete using the other group's name — field belongs to `group`, not `otherGroup`
		th.LoginBasic(t)
		resp, err := th.Client.DeletePropertyField(context.Background(), otherGroup.Name, "post", createdField.ID)
		require.Error(t, err)
		// GetPropertyField with the wrong groupID should not find the field
		require.NotEqual(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("user without permission should not be able to delete", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &sysadminLevel, // Only admin can edit/delete field
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		th.LoginBasic(t)
		resp, err := th.Client.DeletePropertyField(context.Background(), group.Name, "post", createdField.ID)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("successful delete should return 200", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		th.LoginBasic(t)
		resp, err := th.Client.DeletePropertyField(context.Background(), group.Name, "post", createdField.ID)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("websocket event should be fired on field deletion", func(t *testing.T) {
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		resp, err := th.Client.DeletePropertyField(context.Background(), group.Name, "post", createdField.ID)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventPropertyFieldDeleted {
					require.Equal(t, createdField.ID, event.GetData()["field_id"])
					require.Equal(t, "post", event.GetData()["object_type"])
					// system-scoped field: no team or channel in broadcast
					require.Empty(t, event.GetBroadcast().TeamId)
					require.Empty(t, event.GetBroadcast().ChannelId)
					return true
				}
			default:
				return false
			}
			return false
		}, 5*time.Second, 100*time.Millisecond)
	})
}

func TestIsOptionsOnlyPatch(t *testing.T) {
	t.Run("nil attrs is not options-only", func(t *testing.T) {
		patch := &model.PropertyFieldPatch{
			Name: model.NewPointer("new name"),
		}
		require.False(t, isOptionsOnlyPatch(patch))
	})

	t.Run("empty attrs is not options-only", func(t *testing.T) {
		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{},
		}
		require.False(t, isOptionsOnlyPatch(patch))
	})

	t.Run("attrs with only options is options-only", func(t *testing.T) {
		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				"options": []any{},
			},
		}
		require.True(t, isOptionsOnlyPatch(patch))
	})

	t.Run("attrs with options and other keys is not options-only", func(t *testing.T) {
		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				"options": []any{},
				"other":   "value",
			},
		}
		require.False(t, isOptionsOnlyPatch(patch))
	})

	t.Run("name change with options is not options-only", func(t *testing.T) {
		patch := &model.PropertyFieldPatch{
			Name: model.NewPointer("new name"),
			Attrs: &model.StringInterface{
				"options": []any{},
			},
		}
		require.False(t, isOptionsOnlyPatch(patch))
	})

	t.Run("type change is not options-only", func(t *testing.T) {
		newType := model.PropertyFieldTypeSelect
		patch := &model.PropertyFieldPatch{
			Type: &newType,
		}
		require.False(t, isOptionsOnlyPatch(patch))
	})
}

func TestGetPropertyValues(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_values_get")
	require.Nil(t, err)

	memberLevel := model.PermissionLevelMember

	// Create a field
	field := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "post",
		TargetType:        "system",
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
	require.Nil(t, appErr)

	// Use a real post as the target so target access checks pass
	targetID := th.BasicPost.Id

	// Create a value via upsert
	value := &model.PropertyValue{
		TargetID:   targetID,
		TargetType: "post",
		GroupID:    group.ID,
		FieldID:    createdField.ID,
		Value:      json.RawMessage(`"hello"`),
		CreatedBy:  th.BasicUser.Id,
		UpdatedBy:  th.BasicUser.Id,
	}
	_, appErr2 := th.App.UpsertPropertyValues(th.Context, []*model.PropertyValue{value}, "", "", "")
	require.Nil(t, appErr2)

	t.Run("unauthenticated request should fail", func(t *testing.T) {
		client := model.NewAPIv4Client(th.Client.URL)

		_, resp, err := client.GetPropertyValues(context.Background(), group.Name, "post", targetID, model.PropertyValueSearch{PerPage: 60})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("successful get should return values", func(t *testing.T) {
		th.LoginBasic(t)

		values, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "post", targetID, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, values)

		found := false
		for _, v := range values {
			if v.FieldID == createdField.ID {
				found = true
				require.Equal(t, json.RawMessage(`"hello"`), v.Value)
				break
			}
		}
		require.True(t, found, "Created value should be in the response")
	})

	t.Run("nonexistent group should fail", func(t *testing.T) {
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyValues(context.Background(), "nonexistent_group", "post", targetID, model.PropertyValueSearch{PerPage: 60})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("invalid target_id should not match route", func(t *testing.T) {
		th.LoginBasic(t)

		// The route regex [A-Za-z0-9]+ rejects IDs with invalid characters
		_, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "post", "bad-id", model.PropertyValueSearch{PerPage: 60})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get with no values returns empty array", func(t *testing.T) {
		th.LoginBasic(t)

		emptyPost := th.CreatePost(t)
		values, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "post", emptyPost.Id, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Empty(t, values)
	})

	t.Run("cursor pagination should return subsequent pages", func(t *testing.T) {
		th.LoginBasic(t)

		// Create a real post and additional fields/values for pagination
		paginationPost := th.CreatePost(t)
		paginationTarget := paginationPost.Id
		for range 4 {
			f := &model.PropertyField{
				Name:              model.NewId(),
				Type:              model.PropertyFieldTypeText,
				GroupID:           group.ID,
				ObjectType:        "post",
				TargetType:        "system",
				PermissionField:   &memberLevel,
				PermissionValues:  &memberLevel,
				PermissionOptions: &memberLevel,
			}
			cf, appErr := th.App.CreatePropertyField(th.Context, f, false, "")
			require.Nil(t, appErr)

			_, appErr2 := th.App.UpsertPropertyValues(th.Context, []*model.PropertyValue{{
				TargetID:   paginationTarget,
				TargetType: "post",
				GroupID:    group.ID,
				FieldID:    cf.ID,
				Value:      json.RawMessage(`"val"`),
				CreatedBy:  th.BasicUser.Id,
				UpdatedBy:  th.BasicUser.Id,
			}}, "", "", "")
			require.Nil(t, appErr2)
		}

		// First page
		page0, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "post", paginationTarget, model.PropertyValueSearch{PerPage: 2})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, page0, 2)

		// Second page using cursor from last item
		last := page0[len(page0)-1]
		page1, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "post", paginationTarget, model.PropertyValueSearch{
			PerPage:        2,
			CursorID:       last.ID,
			CursorCreateAt: last.CreateAt,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, page1)

		// Pages should not overlap
		page0IDs := map[string]bool{}
		for _, v := range page0 {
			page0IDs[v.ID] = true
		}
		for _, v := range page1 {
			require.False(t, page0IDs[v.ID], "Second page should not contain values from first page")
		}
	})
}

func TestPatchPropertyValues(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_values_patch")
	require.Nil(t, err)

	memberLevel := model.PermissionLevelMember
	sysadminLevel := model.PermissionLevelSysadmin
	noneLevel := model.PermissionLevelNone

	// Create fields with different permission levels
	memberField := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "post",
		TargetType:        "system",
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdMemberField, appErr := th.App.CreatePropertyField(th.Context, memberField, false, "")
	require.Nil(t, appErr)

	adminField := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "post",
		TargetType:        "system",
		PermissionField:   &sysadminLevel,
		PermissionValues:  &sysadminLevel,
		PermissionOptions: &sysadminLevel,
	}
	createdAdminField, appErr := th.App.CreatePropertyField(th.Context, adminField, false, "")
	require.Nil(t, appErr)

	noneField := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "post",
		TargetType:        "system",
		PermissionField:   &memberLevel,
		PermissionValues:  &noneLevel,
		PermissionOptions: &memberLevel,
	}
	createdNoneField, appErr := th.App.CreatePropertyField(th.Context, noneField, false, "")
	require.Nil(t, appErr)

	// Use a real post as the target so target access checks pass
	targetID := th.BasicPost.Id

	t.Run("unauthenticated request should fail", func(t *testing.T) {
		client := model.NewAPIv4Client(th.Client.URL)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdMemberField.ID, Value: json.RawMessage(`"test"`)},
		}
		_, resp, err := client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("member can set values on field with values permission member", func(t *testing.T) {
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdMemberField.ID, Value: json.RawMessage(`"hello"`)},
		}
		values, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)
		require.Equal(t, createdMemberField.ID, values[0].FieldID)
		require.Equal(t, json.RawMessage(`"hello"`), values[0].Value)
	})

	t.Run("websocket event should be fired on values update", func(t *testing.T) {
		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdMemberField.ID, Value: json.RawMessage(`"ws-test"`)},
		}
		_, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventPropertyValuesUpdated {
					require.Equal(t, "post", event.GetData()["object_type"])
					require.Equal(t, targetID, event.GetData()["target_id"])
					// Post target: broadcast should be to the post's channel
					require.Equal(t, th.BasicPost.ChannelId, event.GetBroadcast().ChannelId)
					// values should be a JSON string
					valuesStr, ok := event.GetData()["values"].(string)
					require.True(t, ok)
					var values []*model.PropertyValue
					require.NoError(t, json.Unmarshal([]byte(valuesStr), &values))
					require.Len(t, values, 1)
					require.Equal(t, createdMemberField.ID, values[0].FieldID)
					return true
				}
			default:
				return false
			}
			return false
		}, 5*time.Second, 100*time.Millisecond)
	})

	t.Run("non-admin cannot set values on field with values permission sysadmin", func(t *testing.T) {
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdAdminField.ID, Value: json.RawMessage(`"test"`)},
		}
		_, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("admin can set values on field with values permission sysadmin", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdAdminField.ID, Value: json.RawMessage(`"admin-value"`)},
		}
		values, resp, err := th.SystemAdminClient.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)
		require.Equal(t, json.RawMessage(`"admin-value"`), values[0].Value)
	})

	t.Run("values permission none blocks everyone", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdNoneField.ID, Value: json.RawMessage(`"test"`)},
		}
		_, resp, err := th.SystemAdminClient.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("batch update with mixed permissions fails all-or-nothing", func(t *testing.T) {
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdMemberField.ID, Value: json.RawMessage(`"allowed"`)},
			{FieldID: createdAdminField.ID, Value: json.RawMessage(`"denied"`)},
		}
		_, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("empty body should fail", func(t *testing.T) {
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{}
		_, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid field_id should fail", func(t *testing.T) {
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: "not-valid", Value: json.RawMessage(`"test"`)},
		}
		_, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("field from different group should fail", func(t *testing.T) {
		th.LoginBasic(t)

		otherGroup, err := th.App.RegisterPropertyGroup(th.Context, "test_values_patch_other")
		require.Nil(t, err)

		otherField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           otherGroup.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdOtherField, appErr := th.App.CreatePropertyField(th.Context, otherField, false, "")
		require.Nil(t, appErr)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdOtherField.ID, Value: json.RawMessage(`"test"`)},
		}
		_, resp, patchErr := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.Error(t, patchErr)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("nonexistent group should fail", func(t *testing.T) {
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdMemberField.ID, Value: json.RawMessage(`"test"`)},
		}
		_, resp, err := th.Client.PatchPropertyValues(context.Background(), "nonexistent_group", "post", targetID, items)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("channel member can set values on channel-scoped field with values permission member", func(t *testing.T) {
		th.LoginBasic(t)

		// Create a channel-scoped field with member values permission
		channelField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "channel",
			TargetID:          th.BasicChannel.Id,
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdChannelField, appErr := th.App.CreatePropertyField(th.Context, channelField, false, "")
		require.Nil(t, appErr)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdChannelField.ID, Value: json.RawMessage(`"channel-value"`)},
		}
		values, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)
		require.Equal(t, json.RawMessage(`"channel-value"`), values[0].Value)
	})

	t.Run("non-member cannot set values on channel-scoped field with values permission member", func(t *testing.T) {
		// Create a channel that BasicUser is NOT a member of
		privateChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Type:        model.ChannelTypePrivate,
			Name:        model.NewId(),
			DisplayName: "Private Channel",
			CreatorId:   th.SystemAdminUser.Id,
		}, false)
		require.Nil(t, chanErr)

		channelField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "channel",
			TargetID:          privateChannel.Id,
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdChannelField, fieldErr := th.App.CreatePropertyField(th.Context, channelField, false, "")
		require.Nil(t, fieldErr)

		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdChannelField.ID, Value: json.RawMessage(`"should-fail"`)},
		}
		_, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("upsert updates existing value", func(t *testing.T) {
		th.LoginBasic(t)

		// Set initial value
		items := []model.PropertyValuePatchItem{
			{FieldID: createdMemberField.ID, Value: json.RawMessage(`"initial"`)},
		}
		_, _, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.NoError(t, err)

		// Update to new value
		items[0].Value = json.RawMessage(`"updated"`)
		values, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)
		require.Equal(t, json.RawMessage(`"updated"`), values[0].Value)

		// Verify via GET
		got, _, err := th.Client.GetPropertyValues(context.Background(), group.Name, "post", targetID, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		found := false
		for _, v := range got {
			if v.FieldID == createdMemberField.ID {
				found = true
				require.Equal(t, json.RawMessage(`"updated"`), v.Value)
				break
			}
		}
		require.True(t, found)
	})

	t.Run("returned value should have all fields correctly set", func(t *testing.T) {
		th.LoginBasic(t)

		valueTargetPost := th.CreatePost(t)
		valueTargetID := valueTargetPost.Id
		items := []model.PropertyValuePatchItem{
			{FieldID: createdMemberField.ID, Value: json.RawMessage(`"test-fields"`)},
		}

		values, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", valueTargetID, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)

		v := values[0]
		require.NotEmpty(t, v.ID, "ID should be set")
		require.True(t, model.IsValidId(v.ID), "ID should be a valid ID")
		require.Equal(t, valueTargetID, v.TargetID)
		require.Equal(t, "post", v.TargetType)
		require.Equal(t, group.ID, v.GroupID)
		require.Equal(t, createdMemberField.ID, v.FieldID)
		require.Equal(t, json.RawMessage(`"test-fields"`), v.Value)
		require.NotZero(t, v.CreateAt, "CreateAt should be set")
		require.NotZero(t, v.UpdateAt, "UpdateAt should be set")
		require.Equal(t, v.CreateAt, v.UpdateAt, "CreateAt and UpdateAt should be equal on first insert")
		require.Equal(t, int64(0), v.DeleteAt, "DeleteAt should be zero")
		require.Equal(t, th.BasicUser.Id, v.CreatedBy)
		require.Equal(t, th.BasicUser.Id, v.UpdatedBy)
	})

	t.Run("upsert should update timestamps and updatedBy correctly", func(t *testing.T) {
		// Create initial value as BasicUser
		th.LoginBasic(t)

		upsertTargetPost := th.CreatePost(t)
		upsertTargetID := upsertTargetPost.Id
		items := []model.PropertyValuePatchItem{
			{FieldID: createdMemberField.ID, Value: json.RawMessage(`"first"`)},
		}
		created, _, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", upsertTargetID, items)
		require.NoError(t, err)
		require.Len(t, created, 1)

		originalID := created[0].ID
		originalCreateAt := created[0].CreateAt
		originalUpdatedBy := created[0].UpdatedBy

		require.Equal(t, th.BasicUser.Id, originalUpdatedBy)

		// Update the same value as SystemAdmin
		th.LoginSystemAdmin(t)
		items[0].Value = json.RawMessage(`"second"`)
		updated, _, err := th.SystemAdminClient.PatchPropertyValues(context.Background(), group.Name, "post", upsertTargetID, items)
		require.NoError(t, err)
		require.Len(t, updated, 1)

		u := updated[0]
		// ID should be the same (upsert, not new insert)
		require.Equal(t, originalID, u.ID, "ID should not change on upsert")
		// CreateAt should not change
		require.Equal(t, originalCreateAt, u.CreateAt, "CreateAt should not change on upsert")
		// UpdateAt should be >= CreateAt
		require.GreaterOrEqual(t, u.UpdateAt, u.CreateAt, "UpdateAt should be >= CreateAt after update")
		// UpdatedBy should reflect the new user
		require.Equal(t, th.SystemAdminUser.Id, u.UpdatedBy, "UpdatedBy should be the user who performed the update")
		// Value should be updated
		require.Equal(t, json.RawMessage(`"second"`), u.Value)
	})

	t.Run("duplicate field IDs should fail", func(t *testing.T) {
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdMemberField.ID, Value: json.RawMessage(`"first"`)},
			{FieldID: createdMemberField.ID, Value: json.RawMessage(`"second"`)},
		}
		_, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestGetPropertyValuesUserTargetAccess(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_user_get_access")
	require.Nil(t, err)

	memberLevel := model.PermissionLevelMember

	// Create a user-scoped field
	field := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "user",
		TargetType:        "system",
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
	require.Nil(t, appErr)

	// Create a value for BasicUser
	_, appErr = th.App.UpsertPropertyValues(th.Context, []*model.PropertyValue{{
		TargetID:   th.BasicUser.Id,
		TargetType: "user",
		GroupID:    group.ID,
		FieldID:    createdField.ID,
		Value:      json.RawMessage(`"my-value"`),
		CreatedBy:  th.BasicUser.Id,
		UpdatedBy:  th.BasicUser.Id,
	}}, "", "", "")
	require.Nil(t, appErr)

	t.Run("user can get their own property values", func(t *testing.T) {
		th.LoginBasic(t)

		values, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "user", th.BasicUser.Id, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, values)
	})

	t.Run("non-admin can get another user's property values", func(t *testing.T) {
		th.LoginBasic2(t)

		values, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "user", th.BasicUser.Id, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, values)
	})

	t.Run("admin can get another user's property values", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		values, resp, err := th.SystemAdminClient.GetPropertyValues(context.Background(), group.Name, "user", th.BasicUser.Id, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, values)
	})
}

func TestPatchPropertyValuesUserTargetAccess(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_user_patch_access")
	require.Nil(t, err)

	memberLevel := model.PermissionLevelMember

	// Create a user-scoped field
	field := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "user",
		TargetType:        "system",
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
	require.Nil(t, appErr)

	t.Run("user can set their own property values", func(t *testing.T) {
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdField.ID, Value: json.RawMessage(`"self-value"`)},
		}
		values, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "user", th.BasicUser.Id, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)
		require.Equal(t, json.RawMessage(`"self-value"`), values[0].Value)
	})

	t.Run("non-admin cannot set another user's property values", func(t *testing.T) {
		th.LoginBasic2(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdField.ID, Value: json.RawMessage(`"should-fail"`)},
		}
		_, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "user", th.BasicUser.Id, items)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("admin can set another user's property values", func(t *testing.T) {
		th.LoginSystemAdmin(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdField.ID, Value: json.RawMessage(`"admin-set"`)},
		}
		values, resp, err := th.SystemAdminClient.PatchPropertyValues(context.Background(), group.Name, "user", th.BasicUser.Id, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)
		require.Equal(t, json.RawMessage(`"admin-set"`), values[0].Value)
	})
}

func TestGetPropertyValuesChannelTargetAccess(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, appErr := th.App.RegisterPropertyGroup(th.Context, "test_chan_get_access")
	require.Nil(t, appErr)

	memberLevel := model.PermissionLevelMember

	createFieldAndValue := func(t *testing.T, channelID string) {
		t.Helper()
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "channel",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		_, appErr = th.App.UpsertPropertyValues(th.Context, []*model.PropertyValue{{
			TargetID:   channelID,
			TargetType: "channel",
			GroupID:    group.ID,
			FieldID:    createdField.ID,
			Value:      json.RawMessage(`"val"`),
			CreatedBy:  th.BasicUser.Id,
			UpdatedBy:  th.BasicUser.Id,
		}}, "", "", "")
		require.Nil(t, appErr)
	}

	// Create a non-member user
	nonMember := th.CreateUser(t)
	nonMemberClient := th.CreateClient()
	_, _, err := nonMemberClient.Login(context.Background(), nonMember.Email, nonMember.Password)
	require.NoError(t, err)

	t.Run("public channel - member can read", func(t *testing.T) {
		createFieldAndValue(t, th.BasicChannel.Id)
		th.LoginBasic(t)

		values, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "channel", th.BasicChannel.Id, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, values)
	})

	t.Run("public channel - non-member cannot read", func(t *testing.T) {
		_, resp, err := nonMemberClient.GetPropertyValues(context.Background(), group.Name, "channel", th.BasicChannel.Id, model.PropertyValueSearch{PerPage: 60})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("private channel - member can read", func(t *testing.T) {
		createFieldAndValue(t, th.BasicPrivateChannel.Id)
		th.LoginBasic(t)

		values, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "channel", th.BasicPrivateChannel.Id, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, values)
	})

	t.Run("private channel - non-member cannot read", func(t *testing.T) {
		_, resp, err := nonMemberClient.GetPropertyValues(context.Background(), group.Name, "channel", th.BasicPrivateChannel.Id, model.PropertyValueSearch{PerPage: 60})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("DM channel - participant can read", func(t *testing.T) {
		dmChannel := th.CreateDmChannel(t, th.BasicUser2)
		createFieldAndValue(t, dmChannel.Id)
		th.LoginBasic(t)

		values, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "channel", dmChannel.Id, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, values)
	})

	t.Run("DM channel - non-participant cannot read", func(t *testing.T) {
		dmChannel := th.CreateDmChannel(t, th.BasicUser2)
		createFieldAndValue(t, dmChannel.Id)

		_, resp, err := nonMemberClient.GetPropertyValues(context.Background(), group.Name, "channel", dmChannel.Id, model.PropertyValueSearch{PerPage: 60})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("GM channel - participant can read", func(t *testing.T) {
		gmChannel, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)
		createFieldAndValue(t, gmChannel.Id)
		th.LoginBasic(t)

		values, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "channel", gmChannel.Id, model.PropertyValueSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, values)
	})

	t.Run("GM channel - non-participant cannot read", func(t *testing.T) {
		gmChannel, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)
		createFieldAndValue(t, gmChannel.Id)

		_, resp, err := nonMemberClient.GetPropertyValues(context.Background(), group.Name, "channel", gmChannel.Id, model.PropertyValueSearch{PerPage: 60})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestPatchPropertyValuesChannelTargetAccess(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, appErr := th.App.RegisterPropertyGroup(th.Context, "test_chan_patch_access")
	require.Nil(t, appErr)

	memberLevel := model.PermissionLevelMember

	createField := func(t *testing.T) *model.PropertyField {
		t.Helper()
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "channel",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		return createdField
	}

	// Create a non-member user
	nonMember := th.CreateUser(t)
	nonMemberClient := th.CreateClient()
	_, _, err := nonMemberClient.Login(context.Background(), nonMember.Email, nonMember.Password)
	require.NoError(t, err)

	t.Run("public channel - member with manage permission can write", func(t *testing.T) {
		f := createField(t)
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: f.ID, Value: json.RawMessage(`"pub-val"`)},
		}
		values, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "channel", th.BasicChannel.Id, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)
	})

	t.Run("public channel - non-member cannot write", func(t *testing.T) {
		f := createField(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: f.ID, Value: json.RawMessage(`"should-fail"`)},
		}
		_, resp, err := nonMemberClient.PatchPropertyValues(context.Background(), group.Name, "channel", th.BasicChannel.Id, items)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("private channel - member with manage permission can write", func(t *testing.T) {
		f := createField(t)
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: f.ID, Value: json.RawMessage(`"priv-val"`)},
		}
		values, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "channel", th.BasicPrivateChannel.Id, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)
	})

	t.Run("private channel - non-member cannot write", func(t *testing.T) {
		f := createField(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: f.ID, Value: json.RawMessage(`"should-fail"`)},
		}
		_, resp, err := nonMemberClient.PatchPropertyValues(context.Background(), group.Name, "channel", th.BasicPrivateChannel.Id, items)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("DM channel - participant can write", func(t *testing.T) {
		dmChannel := th.CreateDmChannel(t, th.BasicUser2)
		f := createField(t)
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: f.ID, Value: json.RawMessage(`"dm-val"`)},
		}
		values, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "channel", dmChannel.Id, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)
	})

	t.Run("DM channel - non-participant cannot write", func(t *testing.T) {
		dmChannel := th.CreateDmChannel(t, th.BasicUser2)
		f := createField(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: f.ID, Value: json.RawMessage(`"should-fail"`)},
		}
		_, resp, err := nonMemberClient.PatchPropertyValues(context.Background(), group.Name, "channel", dmChannel.Id, items)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("GM channel - participant can write", func(t *testing.T) {
		gmChannel, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)
		f := createField(t)
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: f.ID, Value: json.RawMessage(`"gm-val"`)},
		}
		values, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "channel", gmChannel.Id, items)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, values, 1)
	})

	t.Run("GM channel - non-participant cannot write", func(t *testing.T) {
		gmChannel, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)
		f := createField(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: f.ID, Value: json.RawMessage(`"should-fail"`)},
		}
		_, resp, err := nonMemberClient.PatchPropertyValues(context.Background(), group.Name, "channel", gmChannel.Id, items)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestCreatePropertyFieldTeamScopedBroadcast(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_team_broadcast")
	require.Nil(t, err)

	t.Run("team-scoped field broadcast has TeamId set and ChannelId empty", func(t *testing.T) {
		// Connect websocket as BasicUser (who is a member of BasicTeam)
		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		// Create the field as SystemAdmin (has ManageTeam permission)
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "team",
			TargetID:   th.BasicTeam.Id,
		}

		createdField, resp, createErr := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, createErr)
		CheckCreatedStatus(t, resp)

		var receivedField model.PropertyField
		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventPropertyFieldCreated {
					fieldData, ok := event.GetData()["property_field"].(string)
					require.True(t, ok)
					require.NoError(t, json.Unmarshal([]byte(fieldData), &receivedField))
					require.Equal(t, "post", event.GetData()["object_type"])
					// Team-scoped: TeamId should be set, ChannelId should be empty
					require.Equal(t, th.BasicTeam.Id, event.GetBroadcast().TeamId)
					require.Empty(t, event.GetBroadcast().ChannelId)
					return true
				}
			default:
				return false
			}
			return false
		}, 5*time.Second, 100*time.Millisecond)

		require.Equal(t, createdField.ID, receivedField.ID)
		require.Equal(t, createdField.Name, receivedField.Name)
	})
}

func TestPatchPropertyValuesChannelObjectTypeBroadcast(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_channel_val_broadcast")
	require.Nil(t, err)

	memberLevel := model.PermissionLevelMember

	field := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "channel",
		TargetType:        "system",
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
	require.Nil(t, appErr)

	t.Run("channel objectType broadcasts to channel members", func(t *testing.T) {
		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdField.ID, Value: json.RawMessage(`"chan-val"`)},
		}
		_, resp, patchErr := th.Client.PatchPropertyValues(context.Background(), group.Name, "channel", th.BasicChannel.Id, items)
		require.NoError(t, patchErr)
		CheckOKStatus(t, resp)

		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventPropertyValuesUpdated {
					require.Equal(t, "channel", event.GetData()["object_type"])
					require.Equal(t, th.BasicChannel.Id, event.GetData()["target_id"])
					// Channel target: broadcast should be to that channel
					require.Equal(t, th.BasicChannel.Id, event.GetBroadcast().ChannelId)
					require.Empty(t, event.GetBroadcast().TeamId)
					return true
				}
			default:
				return false
			}
			return false
		}, 5*time.Second, 100*time.Millisecond)
	})
}

func TestPatchPropertyValuesUserObjectTypeBroadcast(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_user_val_broadcast")
	require.Nil(t, err)

	memberLevel := model.PermissionLevelMember

	field := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           group.ID,
		ObjectType:        "user",
		TargetType:        "system",
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
	require.Nil(t, appErr)

	t.Run("user objectType broadcasts system-wide", func(t *testing.T) {
		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdField.ID, Value: json.RawMessage(`"user-val"`)},
		}
		_, resp, patchErr := th.Client.PatchPropertyValues(context.Background(), group.Name, "user", th.BasicUser.Id, items)
		require.NoError(t, patchErr)
		CheckOKStatus(t, resp)

		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventPropertyValuesUpdated {
					require.Equal(t, "user", event.GetData()["object_type"])
					require.Equal(t, th.BasicUser.Id, event.GetData()["target_id"])
					// User target: broadcast should be system-wide (empty team/channel)
					require.Empty(t, event.GetBroadcast().TeamId)
					require.Empty(t, event.GetBroadcast().ChannelId)
					return true
				}
			default:
				return false
			}
			return false
		}, 5*time.Second, 100*time.Millisecond)
	})
}

func TestUpsertPropertyValuesPSAv1OptOut(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_psav1_optout")
	require.Nil(t, err)

	// Create a PSAv1-style field: no ObjectType, meaning it predates
	// the websocket broadcast machinery added in PSAv2.
	psav1Field := &model.PropertyField{
		Name:       model.NewId(),
		Type:       model.PropertyFieldTypeText,
		GroupID:    group.ID,
		TargetType: "system",
	}
	createdField, appErr := th.App.CreatePropertyField(th.Context, psav1Field, false, "")
	require.Nil(t, appErr)
	require.Empty(t, createdField.ObjectType, "PSAv1 field should have no ObjectType")

	t.Run("upserting values for a PSAv1 field should not publish websocket event", func(t *testing.T) {
		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		// We call the app layer directly because the PSAv2 API endpoints
		// would reject a request without objectType. This mimics what a
		// PSAv1 custom endpoint would do: call UpsertPropertyValues with
		// empty objectType/targetID, skipping websocket broadcasting.
		values := []*model.PropertyValue{
			{
				TargetID:   th.BasicPost.Id,
				TargetType: "post",
				GroupID:    group.ID,
				FieldID:    createdField.ID,
				Value:      json.RawMessage(`"psav1-value"`),
				CreatedBy:  th.BasicUser.Id,
				UpdatedBy:  th.BasicUser.Id,
			},
		}
		result, upsertErr := th.App.UpsertPropertyValues(th.Context, values, "", "", "")
		require.Nil(t, upsertErr)
		require.Len(t, result, 1)

		// Trigger a known marker event so we can detect when we've
		// drained the websocket channel. If a property_values_updated
		// event arrives before the marker, the test fails.
		memberLevel := model.PermissionLevelMember
		markerField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "channel",
			TargetID:          th.BasicChannel.Id,
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		_, markerErr := th.App.CreatePropertyField(th.Context, markerField, false, "")
		require.Nil(t, markerErr)

		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				require.NotEqual(t, model.WebsocketEventPropertyValuesUpdated, event.EventType(),
					"PSAv1 opt-out should not produce a property_values_updated event")
				if event.EventType() == model.WebsocketEventPropertyFieldCreated {
					// Marker arrived, no values event was seen
					return true
				}
			default:
				return false
			}
			return false
		}, 5*time.Second, 100*time.Millisecond)
	})
}

func TestPatchPropertyValuesMultiValuePayload(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_multi_val_payload")
	require.Nil(t, err)

	memberLevel := model.PermissionLevelMember

	// Create three fields
	var createdFields []*model.PropertyField
	for i := range 3 {
		f := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		cf, fieldErr := th.App.CreatePropertyField(th.Context, f, false, "")
		require.Nil(t, fieldErr, "failed to create field %d", i)
		createdFields = append(createdFields, cf)
	}

	t.Run("multi-value patch includes all values in websocket event", func(t *testing.T) {
		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdFields[0].ID, Value: json.RawMessage(`"val-0"`)},
			{FieldID: createdFields[1].ID, Value: json.RawMessage(`"val-1"`)},
			{FieldID: createdFields[2].ID, Value: json.RawMessage(`"val-2"`)},
		}

		targetID := th.BasicPost.Id
		_, resp, patchErr := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.NoError(t, patchErr)
		CheckOKStatus(t, resp)

		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventPropertyValuesUpdated {
					require.Equal(t, "post", event.GetData()["object_type"])
					require.Equal(t, targetID, event.GetData()["target_id"])

					valuesStr, ok := event.GetData()["values"].(string)
					require.True(t, ok)
					var values []*model.PropertyValue
					require.NoError(t, json.Unmarshal([]byte(valuesStr), &values))
					require.Len(t, values, 3, "websocket event should contain all 3 values")

					// Verify all field IDs are present
					fieldIDs := map[string]bool{}
					for _, v := range values {
						fieldIDs[v.FieldID] = true
					}
					for _, f := range createdFields {
						require.True(t, fieldIDs[f.ID], "field %s should be in the websocket event values", f.ID)
					}
					return true
				}
			default:
				return false
			}
			return false
		}, 5*time.Second, 100*time.Millisecond)
	})
}
func TestLinkedProperties(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, "test_linked_properties")
	require.Nil(t, err)

	sysadminLevel := model.PermissionLevelSysadmin
	memberLevel := model.PermissionLevelMember

	t.Run("create template field requires sysadmin", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "system",
		}

		createdField, resp, err := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, "template", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		require.NotNil(t, createdField.PermissionField)
		require.Equal(t, model.PermissionLevelSysadmin, *createdField.PermissionField)
		require.NotNil(t, createdField.PermissionValues)
		require.Equal(t, model.PermissionLevelSysadmin, *createdField.PermissionValues)
		require.NotNil(t, createdField.PermissionOptions)
		require.Equal(t, model.PermissionLevelSysadmin, *createdField.PermissionOptions)
	})

	t.Run("create template field as non-admin fails", func(t *testing.T) {
		th.LoginBasic(t)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "system",
		}

		_, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, "template", field)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("create linked field with valid source", func(t *testing.T) {
		// Create a template field as the source
		sourceField := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: "system",
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "Option A"},
					{"id": model.NewId(), "name": "Option B"},
				},
			},
			PermissionField:   &sysadminLevel,
			PermissionValues:  &sysadminLevel,
			PermissionOptions: &sysadminLevel,
		}
		createdSource, appErr := th.App.CreatePropertyField(th.Context, sourceField, false, "")
		require.Nil(t, appErr)

		sourceID := createdSource.ID
		field := &model.PropertyField{
			Name:          model.NewId(),
			Type:          model.PropertyFieldTypeSelect,
			TargetType:    "system",
			LinkedFieldID: &sourceID,
		}

		createdField, resp, err := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, "user", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		require.Equal(t, createdSource.Type, createdField.Type)
		require.NotNil(t, createdField.Attrs)
		require.NotNil(t, createdField.Attrs["options"])
	})

	t.Run("patch linked field rejects type change", func(t *testing.T) {
		// Create source + linked field via App
		sourceField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			GroupID:           group.ID,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        "system",
			PermissionField:   &sysadminLevel,
			PermissionValues:  &sysadminLevel,
			PermissionOptions: &sysadminLevel,
		}
		createdSource, appErr := th.App.CreatePropertyField(th.Context, sourceField, false, "")
		require.Nil(t, appErr)

		sourceID := createdSource.ID
		linkedField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			GroupID:           group.ID,
			ObjectType:        "user",
			TargetType:        "system",
			LinkedFieldID:     &sourceID,
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdLinked, appErr := th.App.CreatePropertyField(th.Context, linkedField, false, "")
		require.Nil(t, appErr)

		newType := model.PropertyFieldTypeText
		patch := &model.PropertyFieldPatch{Type: &newType}

		_, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "user", createdLinked.ID, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch linked field rejects options change", func(t *testing.T) {
		sourceField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			GroupID:           group.ID,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        "system",
			PermissionField:   &sysadminLevel,
			PermissionValues:  &sysadminLevel,
			PermissionOptions: &sysadminLevel,
		}
		createdSource, appErr := th.App.CreatePropertyField(th.Context, sourceField, false, "")
		require.Nil(t, appErr)

		sourceID := createdSource.ID
		linkedField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			GroupID:           group.ID,
			ObjectType:        "user",
			TargetType:        "system",
			LinkedFieldID:     &sourceID,
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdLinked, appErr := th.App.CreatePropertyField(th.Context, linkedField, false, "")
		require.Nil(t, appErr)

		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "New Option"},
				},
			},
		}

		_, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "user", createdLinked.ID, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch linked field allows name change", func(t *testing.T) {
		sourceField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			GroupID:           group.ID,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        "system",
			PermissionField:   &sysadminLevel,
			PermissionValues:  &sysadminLevel,
			PermissionOptions: &sysadminLevel,
		}
		createdSource, appErr := th.App.CreatePropertyField(th.Context, sourceField, false, "")
		require.Nil(t, appErr)

		sourceID := createdSource.ID
		linkedField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			GroupID:           group.ID,
			ObjectType:        "user",
			TargetType:        "system",
			LinkedFieldID:     &sourceID,
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdLinked, appErr := th.App.CreatePropertyField(th.Context, linkedField, false, "")
		require.Nil(t, appErr)

		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: &newName}

		updatedField, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "user", createdLinked.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, newName, updatedField.Name)
	})

	t.Run("patch unlink clears LinkedFieldID", func(t *testing.T) {
		sourceField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			GroupID:           group.ID,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        "system",
			PermissionField:   &sysadminLevel,
			PermissionValues:  &sysadminLevel,
			PermissionOptions: &sysadminLevel,
		}
		createdSource, appErr := th.App.CreatePropertyField(th.Context, sourceField, false, "")
		require.Nil(t, appErr)

		sourceID := createdSource.ID
		linkedField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			GroupID:           group.ID,
			ObjectType:        "user",
			TargetType:        "system",
			LinkedFieldID:     &sourceID,
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdLinked, appErr := th.App.CreatePropertyField(th.Context, linkedField, false, "")
		require.Nil(t, appErr)

		emptyID := ""
		patch := &model.PropertyFieldPatch{LinkedFieldID: &emptyID}

		updatedField, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "user", createdLinked.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Nil(t, updatedField.LinkedFieldID)
	})

	t.Run("patch existing field rejects setting LinkedFieldID", func(t *testing.T) {
		// Create a regular (non-linked) field
		regularField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "user",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdRegular, appErr := th.App.CreatePropertyField(th.Context, regularField, false, "")
		require.Nil(t, appErr)

		someID := model.NewId()
		patch := &model.PropertyFieldPatch{LinkedFieldID: &someID}

		_, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "user", createdRegular.ID, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete source with dependents returns 409", func(t *testing.T) {
		sourceField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			GroupID:           group.ID,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        "system",
			PermissionField:   &sysadminLevel,
			PermissionValues:  &sysadminLevel,
			PermissionOptions: &sysadminLevel,
		}
		createdSource, appErr := th.App.CreatePropertyField(th.Context, sourceField, false, "")
		require.Nil(t, appErr)

		sourceID := createdSource.ID
		linkedField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			GroupID:           group.ID,
			ObjectType:        "user",
			TargetType:        "system",
			LinkedFieldID:     &sourceID,
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		_, appErr = th.App.CreatePropertyField(th.Context, linkedField, false, "")
		require.Nil(t, appErr)

		resp, err := th.SystemAdminClient.DeletePropertyField(context.Background(), group.Name, "template", createdSource.ID)
		require.Error(t, err)
		require.Equal(t, http.StatusConflict, resp.StatusCode)
	})

	t.Run("get values for template returns 400", func(t *testing.T) {
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "template", model.NewId(), model.PropertyValueSearch{PerPage: 10})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch values for template returns 400", func(t *testing.T) {
		th.LoginBasic(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: model.NewId(), Value: json.RawMessage(`"val"`)},
		}
		_, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "template", model.NewId(), items)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch source field options propagates to linked fields", func(t *testing.T) {
		// Create a template (source) with one option
		optA := map[string]any{"id": model.NewId(), "name": "PropTestA"}
		sourceField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			GroupID:           group.ID,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        "system",
			PermissionField:   &sysadminLevel,
			PermissionValues:  &sysadminLevel,
			PermissionOptions: &sysadminLevel,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{optA},
			},
		}
		createdSource, appErr := th.App.CreatePropertyField(th.Context, sourceField, false, "")
		require.Nil(t, appErr)

		// Create two linked fields and keep their IDs
		sourceID := createdSource.ID
		var linkedIDs []string
		for range 2 {
			linked := &model.PropertyField{
				Name:              "PropLinked-" + model.NewId(),
				Type:              model.PropertyFieldTypeSelect,
				GroupID:           group.ID,
				ObjectType:        "user",
				TargetType:        "system",
				LinkedFieldID:     &sourceID,
				PermissionField:   &memberLevel,
				PermissionValues:  &memberLevel,
				PermissionOptions: &memberLevel,
			}
			createdLinked, lErr := th.App.CreatePropertyField(th.Context, linked, false, "")
			require.Nil(t, lErr)
			linkedIDs = append(linkedIDs, createdLinked.ID)
		}

		// Patch the source field's options via the API — add a second option
		optB := map[string]any{"id": model.NewId(), "name": "PropTestB"}
		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{optA, optB},
			},
		}
		updatedSource, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "template", createdSource.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Source should have 2 options now
		sourceOpts := updatedSource.Attrs[model.PropertyFieldAttributeOptions].([]any)
		require.Len(t, sourceOpts, 2)

		// Fetch each linked field and verify propagation
		for _, linkedID := range linkedIDs {
			lf, lfErr := th.App.GetPropertyField(th.Context, group.ID, linkedID)
			require.Nil(t, lfErr)
			opts := lf.Attrs[model.PropertyFieldAttributeOptions].([]any)
			require.Len(t, opts, 2, "linked field %s should have 2 options after propagation", linkedID)
		}
	})
}
