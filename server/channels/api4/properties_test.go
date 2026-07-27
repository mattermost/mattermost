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

func TestSessionAttributesFieldEditing(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.SessionAttributes = true
	}).InitBasic(t)

	groupName := model.SessionAttributesPropertyGroupName
	objectType := model.PropertyFieldObjectTypeSession

	t.Run("requires an Enterprise Advanced license", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.GetPropertyFields(context.Background(), groupName, objectType, model.PropertyFieldSearch{
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			PerPage:    100,
		})
		require.Error(t, err)
		CheckErrorID(t, err, "api.property.session_attributes.license.app_error")
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	fields, _, err := th.SystemAdminClient.GetPropertyFields(context.Background(), groupName, objectType, model.PropertyFieldSearch{
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		PerPage:    100,
	})
	require.NoError(t, err)
	require.NotEmpty(t, fields)

	var field *model.PropertyField
	for _, f := range fields {
		if f.Name == model.SessionAttributesPropertyFieldVPNActive {
			field = f
			break
		}
	}
	require.NotNil(t, field)
	require.False(t, field.Protected, "seeded session attribute fields must not be protected")

	t.Run("can enable and tune ttl/grace", func(t *testing.T) {
		patched, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), groupName, objectType, field.ID, &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				model.SAAttrEnabled:            true,
				model.SAAttrTTLSeconds:         30,
				model.SAAttrGracePeriodSeconds: 30,
			},
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, true, patched.Attrs[model.SAAttrEnabled])
	})

	t.Run("cannot rename", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), groupName, objectType, field.ID, &model.PropertyFieldPatch{
			Name: model.NewPointer("renamed_field"),
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, "app.session_attributes.field_immutable.app_error")
	})

	t.Run("cannot change non-tunable attrs", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), groupName, objectType, field.ID, &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{model.SAAttrDisplayName: "Hacked"},
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("cannot be deleted", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DeletePropertyField(context.Background(), groupName, objectType, field.ID)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestSessionAttributesFeatureFlagGate(t *testing.T) {
	// Routes are registered through the ClassificationMarkings flag so the
	// generic Properties API is reachable while the SessionAttributes feature
	// flag stays off.
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.SessionAttributes = false
		cfg.FeatureFlags.ClassificationMarkings = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	groupName := model.SessionAttributesPropertyGroupName
	objectType := model.PropertyFieldObjectTypeSession
	search := model.PropertyFieldSearch{
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		PerPage:    100,
	}

	t.Run("admin read returns 501 when feature flag is off", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.GetPropertyFields(context.Background(), groupName, objectType, search)
		require.Error(t, err)
		CheckErrorID(t, err, "api.property.session_attributes.license.app_error")
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("non-admin read returns 501 when feature flag is off", func(t *testing.T) {
		th.LoginBasic(t)
		_, resp, err := th.Client.GetPropertyFields(context.Background(), groupName, objectType, search)
		require.Error(t, err)
		CheckErrorID(t, err, "api.property.session_attributes.license.app_error")
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}

func TestPropertyRoutesWithClassificationMarkingsFlag(t *testing.T) {
	mainHelper.Parallel(t)

	// Routes should be available when ClassificationMarkings=true even with IntegratedBoards=false
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = false
		cfg.FeatureFlags.ClassificationMarkings = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{
		Name:    "classification_test",
		Version: model.PropertyGroupVersionV2,
	})
	require.Nil(t, err)
	require.NotNil(t, group)

	t.Run("create field should succeed with ClassificationMarkings flag", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
		}

		createdField, resp, err := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotEmpty(t, createdField.ID)
	})

	t.Run("get fields should succeed with ClassificationMarkings flag", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.GetPropertyFields(context.Background(), group.Name, "post", model.PropertyFieldSearch{TargetType: "system"})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestCreatePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	// Register a property group for testing
	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties", Version: model.PropertyGroupVersionV2})
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

	t.Run("admin can set permission level=admin on a channel-target field", func(t *testing.T) {
		adminLevel := model.PermissionLevelAdmin
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			TargetType:        "channel",
			TargetID:          th.BasicChannel.Id,
			PermissionField:   &adminLevel,
			PermissionValues:  &adminLevel,
			PermissionOptions: &adminLevel,
		}

		createdField, resp, err := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, "post", field)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		require.NotNil(t, createdField.PermissionField)
		require.Equal(t, model.PermissionLevelAdmin, *createdField.PermissionField)
		require.NotNil(t, createdField.PermissionValues)
		require.Equal(t, model.PermissionLevelAdmin, *createdField.PermissionValues)
		require.NotNil(t, createdField.PermissionOptions)
		require.Equal(t, model.PermissionLevelAdmin, *createdField.PermissionOptions)
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

	t.Run("v1 group should return 404", func(t *testing.T) {
		v1Group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_v1_create", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)
		require.NotNil(t, v1Group)

		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: "system",
		}

		_, resp, err := th.Client.CreatePropertyField(context.Background(), v1Group.Name, "post", field)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestGetPropertyFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	// Register property groups for testing
	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties_get", Version: model.PropertyGroupVersionV2})
	require.Nil(t, err)
	require.NotNil(t, group)

	otherGroup, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties_get_other", Version: model.PropertyGroupVersionV2})
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

	// Hierarchical-scope fixtures live under a dedicated group so length
	// assertions in those subtests can be exact — independent of any fields
	// created by the unrelated subtests in `group` above.
	hierGroup, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties_get_hier", Version: model.PropertyGroupVersionV2})
	require.Nil(t, err)
	require.NotNil(t, hierGroup)

	mkField := func(t *testing.T, targetType model.PropertyFieldTargetLevel, targetID string) *model.PropertyField {
		t.Helper()
		f := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           hierGroup.ID,
			ObjectType:        "post",
			TargetType:        string(targetType),
			TargetID:          targetID,
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		created, cerr := th.App.CreatePropertyField(th.Context, f, false, "")
		require.Nil(t, cerr)
		return created
	}

	// Fixtures: 1 system, 1 team-A (BasicTeam), 1 team-B (other team),
	// 2 channel-X (BasicChannel, in team-A), 1 channel-Y (in team-A).
	otherTeam := th.CreateTeamWithClient(t, th.SystemAdminClient)
	channelY := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypeOpen, th.BasicTeam.Id)
	// BasicUser is *not* a member of channelY by default.

	sysField := mkField(t, model.PropertyFieldTargetLevelSystem, "")
	teamAField := mkField(t, model.PropertyFieldTargetLevelTeam, th.BasicTeam.Id)
	chanX1Field := mkField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id)
	chanX2Field := mkField(t, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id)
	// Side-effect-only fixtures: their DB presence proves the hierarchical
	// filter actively excludes them. ElementsMatch on the expected ID set
	// handles the exclusion check.
	_ = mkField(t, model.PropertyFieldTargetLevelTeam, otherTeam.Id)   // team-B field
	_ = mkField(t, model.PropertyFieldTargetLevelChannel, channelY.Id) // channel-Y field (BasicUser has no access)

	// A dedicated group holding a single system-object-type field
	// (ObjectType=system, TargetType=system). Used by the DWIM subtests
	// to assert that requests with object_type=system collapse to the
	// system scope regardless of any channel/team/target params passed.
	systemObjGroup, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties_get_system_obj", Version: model.PropertyGroupVersionV2})
	require.Nil(t, err)
	sysObjField := &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		GroupID:           systemObjGroup.ID,
		ObjectType:        model.PropertyFieldObjectTypeSystem,
		TargetType:        string(model.PropertyFieldTargetLevelSystem),
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	}
	createdSysObjField, appErr := th.App.CreatePropertyField(th.Context, sysObjField, false, "")
	require.Nil(t, appErr)

	fieldIDs := func(fields []*model.PropertyField) []string {
		ids := make([]string, len(fields))
		for i, f := range fields {
			ids[i] = f.ID
		}
		return ids
	}

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

	t.Run("v1 group should return 404", func(t *testing.T) {
		v1Group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_v1_get_fields", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)
		require.NotNil(t, v1Group)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), v1Group.Name, "post", model.PropertyFieldSearch{PerPage: 60})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("no scope (no target_type, channel_id or team_id) returns 400 scope_required", func(t *testing.T) {
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("object_type=system without scope returns system-level rows", func(t *testing.T) {
		// System-object-type fields can only live at the system scope, so
		// the GET endpoint defaults to target_type=system when the caller
		// omits the scope.
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), systemObjGroup.Name, model.PropertyFieldObjectTypeSystem, model.PropertyFieldSearch{PerPage: 60})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.ElementsMatch(t, []string{createdSysObjField.ID}, fieldIDs(fields))
	})

	t.Run("object_type=system collapses to system scope regardless of channel_id (DWIM)", func(t *testing.T) {
		// System-object fields can only live at the system scope by
		// invariant, so the channel_id filter is a semantic no-op. The
		// endpoint accepts the request and returns the same rows as the
		// unscoped call rather than 400-ing on scope_conflict.
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), systemObjGroup.Name, model.PropertyFieldObjectTypeSystem, model.PropertyFieldSearch{
			ChannelID: th.BasicChannel.Id,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.ElementsMatch(t, []string{createdSysObjField.ID}, fieldIDs(fields))
	})

	t.Run("object_type=system collapses to system scope regardless of team_id (DWIM)", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), systemObjGroup.Name, model.PropertyFieldObjectTypeSystem, model.PropertyFieldSearch{
			TeamID: th.BasicTeam.Id,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.ElementsMatch(t, []string{createdSysObjField.ID}, fieldIDs(fields))
	})

	t.Run("object_type=system collapses to system scope regardless of target_type=channel (DWIM)", func(t *testing.T) {
		// Even a confused single-target request like target_type=channel
		// + target_id=<channel> is reduced to system scope when the
		// object_type is system. The non-system filter values are
		// dropped before the conflict check runs.
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), systemObjGroup.Name, model.PropertyFieldObjectTypeSystem, model.PropertyFieldSearch{
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   th.BasicChannel.Id,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.ElementsMatch(t, []string{createdSysObjField.ID}, fieldIDs(fields))
	})

	t.Run("channel_id combined with target_type returns 400 scope_conflict", func(t *testing.T) {
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			ChannelID:  th.BasicChannel.Id,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("team_id combined with target_id returns 400 scope_conflict", func(t *testing.T) {
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TeamID:   th.BasicTeam.Id,
			TargetID: model.NewId(),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("channel_id pointing at non-existent channel returns 403", func(t *testing.T) {
		// Permission is checked before existence — non-existent channels are
		// indistinguishable from inaccessible ones, by design.
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			ChannelID: model.NewId(),
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("channel_id where user has no access returns 403", func(t *testing.T) {
		th.LoginBasic(t)

		// BasicUser is not a member of channelY.
		_, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			ChannelID: channelY.Id,
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("team_id where user has no access returns 403", func(t *testing.T) {
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TeamID: otherTeam.Id,
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("team_id alone returns system + team rows only", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TeamID:  th.BasicTeam.Id,
			PerPage: 200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Len(t, fields, 2, "should return exactly sysField + teamAField")
		require.ElementsMatch(t, []string{sysField.ID, teamAField.ID}, fieldIDs(fields))
	})

	t.Run("channel_id + team_id returns system + team + channel rows", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			ChannelID: th.BasicChannel.Id,
			TeamID:    th.BasicTeam.Id,
			PerPage:   200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Len(t, fields, 4, "should return exactly sysField + teamAField + 2 channel-X fields")
		require.ElementsMatch(t, []string{sysField.ID, teamAField.ID, chanX1Field.ID, chanX2Field.ID}, fieldIDs(fields))
	})

	t.Run("channel_id without team_id returns system + team + channel rows", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			ChannelID: th.BasicChannel.Id,
			PerPage:   200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Len(t, fields, 4, "should return exactly sysField + teamAField + 2 channel-X fields")
		require.ElementsMatch(t, []string{sysField.ID, teamAField.ID, chanX1Field.ID, chanX2Field.ID}, fieldIDs(fields))
	})

	t.Run("DM channel returns system + channel rows (no team in the hierarchy)", func(t *testing.T) {
		// DM channels have no parent team, so the hierarchy collapses
		// to system → channel. teamAField must not leak in even though
		// the BasicUser shares team-A with other channels.
		dmChannel := th.CreateDmChannel(t, th.BasicUser2)
		dmField := mkField(t, model.PropertyFieldTargetLevelChannel, dmChannel.Id)

		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			ChannelID: dmChannel.Id,
			PerPage:   200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.ElementsMatch(t, []string{sysField.ID, dmField.ID}, fieldIDs(fields))
	})

	t.Run("GM channel returns system + channel rows (no team in the hierarchy)", func(t *testing.T) {
		gmChannel, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)
		gmField := mkField(t, model.PropertyFieldTargetLevelChannel, gmChannel.Id)

		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			ChannelID: gmChannel.Id,
			PerPage:   200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.ElementsMatch(t, []string{sysField.ID, gmField.ID}, fieldIDs(fields))
	})

	t.Run("a bad team_id is overwritten by the channel's team_id when channel_id is present and correctly returns system + team + channel rows", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			ChannelID: th.BasicChannel.Id,
			TeamID:    otherTeam.Id,
			PerPage:   200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Len(t, fields, 4, "should return exactly sysField + teamAField + 2 channel-X fields")
		require.ElementsMatch(t, []string{sysField.ID, teamAField.ID, chanX1Field.ID, chanX2Field.ID}, fieldIDs(fields))
	})

	t.Run("since=-1 is treated as no filter", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			SinceUpdateAt: -1,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Len(t, fields, 1, "should return exactly sysField — the only system row in hierGroup at this point")
		require.ElementsMatch(t, []string{sysField.ID}, fieldIDs(fields))
	})

	t.Run("since returns soft-deleted rows", func(t *testing.T) {
		// Create a dedicated field, delete it, then verify it shows up in a since query.
		toDelete := mkField(t, model.PropertyFieldTargetLevelSystem, "")

		// Snapshot a since cutoff strictly less than UpdateAt of the delete.
		// CreatePropertyField sets UpdateAt to CreateAt; use it - 1.
		cutoff := toDelete.UpdateAt - 1

		// Soft-delete via the App layer.
		require.Nil(t, th.App.DeletePropertyField(th.Context, hierGroup.ID, toDelete.ID, false, ""))

		// Use sysadmin to avoid any read-permission masking on tombstones.
		fields, resp, err := th.SystemAdminClient.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TeamID:        th.BasicTeam.Id,
			SinceUpdateAt: cutoff,
			PerPage:       200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		var found *model.PropertyField
		for _, f := range fields {
			if f.ID == toDelete.ID {
				found = f
				break
			}
		}
		require.NotNil(t, found, "soft-deleted field should be returned in since-delta")
		require.Greater(t, found.DeleteAt, int64(0), "returned field should be tombstoned")
	})

	t.Run("cursor_create_at while since>0 returns 400", func(t *testing.T) {
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TargetType:     string(model.PropertyFieldTargetLevelSystem),
			SinceUpdateAt:  1,
			CursorID:       model.NewId(),
			CursorCreateAt: 12345,
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("cursor_update_at while since absent returns 400", func(t *testing.T) {
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TargetType:     string(model.PropertyFieldTargetLevelSystem),
			CursorID:       model.NewId(),
			CursorUpdateAt: 12345,
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("cursor with both create_at and update_at set returns 400", func(t *testing.T) {
		// Cursor.IsValid() requires exactly one of the two timestamps.
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TargetType:     string(model.PropertyFieldTargetLevelSystem),
			SinceUpdateAt:  1,
			CursorID:       model.NewId(),
			CursorCreateAt: 12345,
			CursorUpdateAt: 12345,
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("target_id alone without scope returns 400", func(t *testing.T) {
		th.LoginBasic(t)

		_, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TargetID: model.NewId(),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delta-mode cursor paginates correctly across multiple updates", func(t *testing.T) {
		// Round-trip the dual-mode cursor: create N fresh fields after a
		// cutoff, then page through them in delta mode with per_page < N.
		// Use a dedicated team so the count is exactly predictable.
		paginationTeam := th.CreateTeamWithClient(t, th.SystemAdminClient)
		cutoff := model.GetMillis()
		// CreatePropertyField stamps UpdateAt = GetMillis(); sleep to ensure
		// all rows are strictly greater than `cutoff` even at ms precision.
		time.Sleep(2 * time.Millisecond)

		fresh := make([]*model.PropertyField, 0, 3)
		for range 3 {
			fresh = append(fresh, mkField(t, model.PropertyFieldTargetLevelTeam, paginationTeam.Id))
		}

		// Page 1: per_page=2, no cursor. Use sysadmin to side-step team membership.
		page1, resp, err := th.SystemAdminClient.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TeamID:        paginationTeam.Id,
			SinceUpdateAt: cutoff,
			PerPage:       2,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, page1, 2)

		// Page 2: cursor from last of page 1, using update_at (delta mode).
		last := page1[len(page1)-1]
		page2, resp, err := th.SystemAdminClient.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TeamID:         paginationTeam.Id,
			SinceUpdateAt:  cutoff,
			CursorID:       last.ID,
			CursorUpdateAt: last.UpdateAt,
			PerPage:        2,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Combined pages should match the freshly-created set with no dups or skips.
		combined := append(append([]string{}, fieldIDs(page1)...), fieldIDs(page2)...)
		expected := []string{fresh[0].ID, fresh[1].ID, fresh[2].ID}
		require.ElementsMatch(t, expected, combined, "delta-mode cursor must paginate the full set with no dups or skips")
	})

	t.Run("single-target target_type=team returns only that team's rows", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.GetPropertyFields(context.Background(), hierGroup.Name, "post", model.PropertyFieldSearch{
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   th.BasicTeam.Id,
			PerPage:    100,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.Len(t, fields, 1, "should return exactly teamAField")
		require.ElementsMatch(t, []string{teamAField.ID}, fieldIDs(fields))
	})
}

func TestGetPropertyFieldsScopeAccess(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties_scope", Version: model.PropertyGroupVersionV2})
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

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties_filter", Version: model.PropertyGroupVersionV2})
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

func TestSearchPropertyFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties_search", Version: model.PropertyGroupVersionV2})
	require.Nil(t, err)
	require.NotNil(t, group)

	memberLevel := model.PermissionLevelMember
	mkField := func(t *testing.T, objectType string, targetType model.PropertyFieldTargetLevel, targetID string) *model.PropertyField {
		t.Helper()
		f := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        objectType,
			TargetType:        string(targetType),
			TargetID:          targetID,
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		created, cerr := th.App.CreatePropertyField(th.Context, f, false, "")
		require.Nil(t, cerr)
		return created
	}

	otherTeam := th.CreateTeamWithClient(t, th.SystemAdminClient)

	// Fixtures across multiple object types, all in team-A / channel-X scope.
	postSysField := mkField(t, model.PropertyFieldObjectTypePost, model.PropertyFieldTargetLevelSystem, "")
	postTeamAField := mkField(t, model.PropertyFieldObjectTypePost, model.PropertyFieldTargetLevelTeam, th.BasicTeam.Id)
	postChanXField := mkField(t, model.PropertyFieldObjectTypePost, model.PropertyFieldTargetLevelChannel, th.BasicChannel.Id)
	chanSysField := mkField(t, model.PropertyFieldObjectTypeChannel, model.PropertyFieldTargetLevelSystem, "")
	chanTeamAField := mkField(t, model.PropertyFieldObjectTypeChannel, model.PropertyFieldTargetLevelTeam, th.BasicTeam.Id)
	userSysField := mkField(t, model.PropertyFieldObjectTypeUser, model.PropertyFieldTargetLevelSystem, "")
	sysObjField := mkField(t, model.PropertyFieldObjectTypeSystem, model.PropertyFieldTargetLevelSystem, "")
	// Out-of-scope rows that must NOT leak into hierarchical results.
	_ = mkField(t, model.PropertyFieldObjectTypePost, model.PropertyFieldTargetLevelTeam, otherTeam.Id) // team-B
	_ = mkField(t, model.PropertyFieldObjectTypeChannel, model.PropertyFieldTargetLevelTeam, otherTeam.Id)

	fieldIDs := func(fields []*model.PropertyField) []string {
		ids := make([]string, len(fields))
		for i, f := range fields {
			ids[i] = f.ID
		}
		return ids
	}

	t.Run("unauthenticated request should fail", func(t *testing.T) {
		client := model.NewAPIv4Client(th.Client.URL)
		_, resp, err := client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost},
			TeamID:      th.BasicTeam.Id,
		})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("nonexistent group should return 404", func(t *testing.T) {
		th.LoginBasic(t)
		_, resp, err := th.Client.SearchPropertyFields(context.Background(), "nonexistent_group", model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost},
			TeamID:      th.BasicTeam.Id,
		})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("missing object_types returns 400", func(t *testing.T) {
		th.LoginBasic(t)
		_, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			TeamID: th.BasicTeam.Id,
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid object_types returns 400", func(t *testing.T) {
		th.LoginBasic(t)
		_, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{"garbage"},
			TeamID:      th.BasicTeam.Id,
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("no scope (no target_type, channel_id or team_id) returns 400 scope_required", func(t *testing.T) {
		th.LoginBasic(t)
		_, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("object_types=[system] without scope returns system-object rows", func(t *testing.T) {
		// System-object fields can only live at the system scope, so the
		// endpoint defaults to target_type=system when object_types is
		// exactly [system]. This mirrors the GET endpoint's shortcut.
		th.LoginBasic(t)
		fields, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypeSystem},
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Contains(t, fieldIDs(fields), sysObjField.ID)
	})

	t.Run("object_types=[system] collapses to system scope regardless of channel_id (DWIM)", func(t *testing.T) {
		// Any channel/team/target filter is a semantic no-op when
		// object_types is exactly [system]. The endpoint must return
		// the same rows as the unscoped call rather than 400-ing.
		th.LoginBasic(t)
		fields, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypeSystem},
			ChannelID:   th.BasicChannel.Id,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Contains(t, fieldIDs(fields), sysObjField.ID)
	})

	t.Run("object_types=[system, post] without scope returns 400 (shortcut requires exactly [system])", func(t *testing.T) {
		// The system shortcut is only safe when every requested object
		// type lives at the system scope. Mixing system with another
		// object type without an explicit scope would silently drop the
		// non-system rows under target_type=system, so we reject it.
		th.LoginBasic(t)
		_, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{
				model.PropertyFieldObjectTypeSystem,
				model.PropertyFieldObjectTypePost,
			},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("scope conflict (channel_id + target_type) returns 400", func(t *testing.T) {
		th.LoginBasic(t)
		_, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost},
			ChannelID:   th.BasicChannel.Id,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("team_id unauthorized returns 403", func(t *testing.T) {
		th.LoginBasic(t)
		_, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost},
			TeamID:      otherTeam.Id,
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("multi-OT hierarchical scope returns all matching rows across types", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{
				model.PropertyFieldObjectTypePost,
				model.PropertyFieldObjectTypeChannel,
				model.PropertyFieldObjectTypeUser,
			},
			ChannelID: th.BasicChannel.Id,
			TeamID:    th.BasicTeam.Id,
			PerPage:   200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// For each requested object_type, the hierarchical scope (system +
		// team-A + channel-X) yields the matching rows:
		//   post    -> postSysField, postTeamAField, postChanXField
		//   channel -> chanSysField, chanTeamAField
		//   user    -> userSysField
		expected := []string{
			postSysField.ID, postTeamAField.ID, postChanXField.ID,
			chanSysField.ID, chanTeamAField.ID,
			userSysField.ID,
		}
		require.Len(t, fields, len(expected))
		require.ElementsMatch(t, expected, fieldIDs(fields))
	})

	t.Run("DM channel returns multi-OT system + channel rows (no team in the hierarchy)", func(t *testing.T) {
		// DM channels have no parent team — the hierarchy collapses to
		// system → channel across every requested object_type.
		dmChannel := th.CreateDmChannel(t, th.BasicUser2)
		dmPostField := mkField(t, model.PropertyFieldObjectTypePost, model.PropertyFieldTargetLevelChannel, dmChannel.Id)
		dmChannelField := mkField(t, model.PropertyFieldObjectTypeChannel, model.PropertyFieldTargetLevelChannel, dmChannel.Id)

		th.LoginBasic(t)

		fields, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{
				model.PropertyFieldObjectTypePost,
				model.PropertyFieldObjectTypeChannel,
				model.PropertyFieldObjectTypeUser,
			},
			ChannelID: dmChannel.Id,
			PerPage:   200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// system rows for every requested OT + the DM-scoped fields. No
		// team rows (postTeamAField / chanTeamAField) since the DM has
		// no parent team.
		require.ElementsMatch(t, []string{
			postSysField.ID, chanSysField.ID, userSysField.ID,
			dmPostField.ID, dmChannelField.ID,
		}, fieldIDs(fields))
	})

	t.Run("GM channel returns multi-OT system + channel rows (no team in the hierarchy)", func(t *testing.T) {
		gmChannel, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)
		gmChannelField := mkField(t, model.PropertyFieldObjectTypeChannel, model.PropertyFieldTargetLevelChannel, gmChannel.Id)

		th.LoginBasic(t)

		fields, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypeChannel, model.PropertyFieldObjectTypeUser},
			ChannelID:   gmChannel.Id,
			PerPage:     200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		require.ElementsMatch(t, []string{
			chanSysField.ID, userSysField.ID, gmChannelField.ID,
		}, fieldIDs(fields))
	})

	t.Run("a bad team_id is overwritten by the channel's team_id when channel_id is present and correctly returns multi-OT rows", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{
				model.PropertyFieldObjectTypePost,
				model.PropertyFieldObjectTypeChannel,
				model.PropertyFieldObjectTypeUser,
			},
			ChannelID: th.BasicChannel.Id,
			TeamID:    otherTeam.Id, // wrong team — server should ignore it
			PerPage:   200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Exactly the same set as the "channel_id + team_id" case above, even
		// though the request specified the wrong team_id.
		expected := []string{
			postSysField.ID, postTeamAField.ID, postChanXField.ID,
			chanSysField.ID, chanTeamAField.ID,
			userSysField.ID,
		}
		require.Len(t, fields, len(expected))
		require.ElementsMatch(t, expected, fieldIDs(fields))
	})

	t.Run("single object_type behaves like singular endpoint", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypeChannel},
			TeamID:      th.BasicTeam.Id,
			PerPage:     200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// team_id scope for object_type=channel: chanSysField + chanTeamAField.
		require.ElementsMatch(t, []string{chanSysField.ID, chanTeamAField.ID}, fieldIDs(fields))
	})

	t.Run("single-target scope returns only that exact slice", func(t *testing.T) {
		th.LoginBasic(t)

		fields, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost, model.PropertyFieldObjectTypeChannel},
			TargetType:  string(model.PropertyFieldTargetLevelTeam),
			TargetID:    th.BasicTeam.Id,
			PerPage:     200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Single-target team-A across post + channel object types: only the
		// team-A rows, no system or channel rows.
		require.ElementsMatch(t, []string{postTeamAField.ID, chanTeamAField.ID}, fieldIDs(fields))
	})

	t.Run("v1 group returns 404", func(t *testing.T) {
		v1Group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_v1_search_fields", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)
		require.NotNil(t, v1Group)

		_, resp, err := th.Client.SearchPropertyFields(context.Background(), v1Group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost},
			TeamID:      th.BasicTeam.Id,
		})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("channel_id pointing at non-existent channel returns 403", func(t *testing.T) {
		// Mirrors the singular endpoint: permission is checked first, so
		// non-existent and inaccessible channels are indistinguishable.
		th.LoginBasic(t)
		_, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost},
			ChannelID:   model.NewId(),
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("channel_id where user has no access returns 403", func(t *testing.T) {
		// Channel BasicUser is not a member of.
		inaccessibleChannel := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypeOpen, otherTeam.Id)
		th.LoginBasic(t)
		_, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost},
			ChannelID:   inaccessibleChannel.Id,
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("target_id alone without scope returns 400", func(t *testing.T) {
		// target_id with no target_type, channel_id or team_id is malformed.
		th.LoginBasic(t)
		_, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost},
			TargetID:    model.NewId(),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("duplicate object_type values are idempotent", func(t *testing.T) {
		// Sending the same object_type twice should not double-count rows.
		th.LoginBasic(t)
		fields, resp, err := th.Client.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost, model.PropertyFieldObjectTypePost},
			ChannelID:   th.BasicChannel.Id,
			TeamID:      th.BasicTeam.Id,
			PerPage:     200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Same set as a single-OT "post" query in hierarchical scope:
		// postSysField + postTeamAField + postChanXField (no team-B / channel-Y).
		require.ElementsMatch(t, []string{postSysField.ID, postTeamAField.ID, postChanXField.ID}, fieldIDs(fields))
	})

	t.Run("since returns soft-deleted rows across multiple object types", func(t *testing.T) {
		// Create dedicated post and channel fields scoped to BasicTeam, delete
		// them, then verify both tombstones surface in a search delta query.
		postToDelete := mkField(t, model.PropertyFieldObjectTypePost, model.PropertyFieldTargetLevelTeam, th.BasicTeam.Id)
		chanToDelete := mkField(t, model.PropertyFieldObjectTypeChannel, model.PropertyFieldTargetLevelTeam, th.BasicTeam.Id)

		cutoff := min(postToDelete.UpdateAt, chanToDelete.UpdateAt) - 1

		require.Nil(t, th.App.DeletePropertyField(th.Context, group.ID, postToDelete.ID, false, ""))
		require.Nil(t, th.App.DeletePropertyField(th.Context, group.ID, chanToDelete.ID, false, ""))

		// Sysadmin sidesteps any read-permission masking on tombstones.
		fields, resp, err := th.SystemAdminClient.SearchPropertyFields(context.Background(), group.Name, model.PropertyFieldSearch{
			ObjectTypes:   []string{model.PropertyFieldObjectTypePost, model.PropertyFieldObjectTypeChannel},
			TeamID:        th.BasicTeam.Id,
			SinceUpdateAt: cutoff,
			PerPage:       200,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		// Build a quick lookup keyed on ID.
		byID := make(map[string]*model.PropertyField, len(fields))
		for _, f := range fields {
			byID[f.ID] = f
		}
		require.Contains(t, byID, postToDelete.ID, "post tombstone should be returned")
		require.Contains(t, byID, chanToDelete.ID, "channel tombstone should be returned")
		require.Greater(t, byID[postToDelete.ID].DeleteAt, int64(0))
		require.Greater(t, byID[chanToDelete.ID].DeleteAt, int64(0))
	})

	t.Run("cursor pagination paginates a multi-OT scope without dups or skips", func(t *testing.T) {
		// Create a dedicated team and a small set of rows under it across
		// multiple object types, then page through in directory mode.
		paginationTeam := th.CreateTeamWithClient(t, th.SystemAdminClient)
		fresh := []*model.PropertyField{
			mkField(t, model.PropertyFieldObjectTypePost, model.PropertyFieldTargetLevelTeam, paginationTeam.Id),
			mkField(t, model.PropertyFieldObjectTypePost, model.PropertyFieldTargetLevelTeam, paginationTeam.Id),
			mkField(t, model.PropertyFieldObjectTypeChannel, model.PropertyFieldTargetLevelTeam, paginationTeam.Id),
			mkField(t, model.PropertyFieldObjectTypeChannel, model.PropertyFieldTargetLevelTeam, paginationTeam.Id),
		}

		searchBody := model.PropertyFieldSearch{
			ObjectTypes: []string{model.PropertyFieldObjectTypePost, model.PropertyFieldObjectTypeChannel},
			TargetType:  string(model.PropertyFieldTargetLevelTeam),
			TargetID:    paginationTeam.Id,
			PerPage:     2,
		}

		page1, resp, err := th.SystemAdminClient.SearchPropertyFields(context.Background(), group.Name, searchBody)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, page1, 2)

		last := page1[len(page1)-1]
		searchBody.CursorID = last.ID
		searchBody.CursorCreateAt = last.CreateAt
		page2, resp, err := th.SystemAdminClient.SearchPropertyFields(context.Background(), group.Name, searchBody)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, page2, 2)

		combined := append(append([]string{}, fieldIDs(page1)...), fieldIDs(page2)...)
		expected := []string{fresh[0].ID, fresh[1].ID, fresh[2].ID, fresh[3].ID}
		require.ElementsMatch(t, expected, combined, "search cursor pagination must cover the full set without dups or skips")
	})
}

func TestPatchPropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
		cfg.FeatureFlags.PropertyFieldRank = true
	}).InitBasic(t)

	// Register property groups for testing
	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties_patch", Version: model.PropertyGroupVersionV2})
	require.Nil(t, err)
	require.NotNil(t, group)

	otherGroup, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties_patch_other", Version: model.PropertyGroupVersionV2})
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

		// Try to update with wrong object_type in URL. Expected 404 to match
		// the shape of a non-existent field.
		_, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "channel", createdField.ID, patch)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("patch with wrong group name should fail 404", func(t *testing.T) {
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

		// Try to patch using the other group's name — field belongs to `group`, not `otherGroup`.
		// A field not found because of a wrong group must surface as 404, not a generic 500.
		_, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), otherGroup.Name, "post", createdField.ID, patch)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Equal(t, "app.property.not_found.app_error", err.(*model.AppError).Id)
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
		require.NotNil(t, updatedField)

		// Verify the patched option was actually stored, not just that the request succeeded.
		opts := updatedField.Attrs[model.PropertyFieldAttributeOptions].([]any)
		require.Len(t, opts, 1)
		option := opts[0].(map[string]any)
		require.Equal(t, newOptionID, option["id"])
		require.Equal(t, "New Option", option["name"])
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
		require.NotNil(t, updatedField)

		// Verify the patched option was actually stored, not just that the request succeeded.
		opts := updatedField.Attrs[model.PropertyFieldAttributeOptions].([]any)
		require.Len(t, opts, 1)
		option := opts[0].(map[string]any)
		require.Equal(t, newOptionID, option["id"])
		require.Equal(t, "New Option", option["name"])
	})

	t.Run("options-only update on rank field with member options permission should succeed", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			GroupID:    group.ID,
			ObjectType: "post",
			TargetType: "system",
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "Option 1", "rank": 1},
				},
			},
			PermissionField:   &sysadminLevel, // Only admin can edit field
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel, // Member can manage options
		}
		createdField, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		// A member may re-rank options: options-only patches on rank fields
		// use the narrower manage-options permission, same as select/multiselect.
		th.LoginBasic(t)
		newOptionID := model.NewId()
		patch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				"options": []map[string]any{
					{"id": newOptionID, "name": "New Option", "rank": 2},
				},
			},
		}

		updatedField, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, updatedField)

		// Verify the patched option (including its rank) was actually stored.
		opts := updatedField.Attrs[model.PropertyFieldAttributeOptions].([]any)
		require.Len(t, opts, 1)
		option := opts[0].(map[string]any)
		require.Equal(t, newOptionID, option["id"])
		require.Equal(t, "New Option", option["name"])
		require.EqualValues(t, 2, option["rank"])
	})

	t.Run("name and options update on rank field should check field permission not options", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			GroupID:    group.ID,
			ObjectType: "post",
			TargetType: "system",
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "Option 1", "rank": 1},
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
					{"id": model.NewId(), "name": "New Option", "rank": 2},
				},
			},
		}

		// Member fails — a structural change (name) on a rank field requires the
		// full edit-field permission, not the narrower options permission.
		th.LoginBasic(t)
		_, resp, err := th.Client.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		// Admin (has field permission) succeeds.
		updatedField, resp, err := th.SystemAdminClient.PatchPropertyField(context.Background(), group.Name, "post", createdField.ID, patch)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, newName, updatedField.Name)
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

	t.Run("v1 group should return 404", func(t *testing.T) {
		v1Group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_v1_patch_field", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)
		require.NotNil(t, v1Group)

		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: &newName}

		_, resp, err := th.Client.PatchPropertyField(context.Background(), v1Group.Name, "post", model.NewId(), patch)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestDeletePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	// Register property groups for testing
	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties_delete", Version: model.PropertyGroupVersionV2})
	require.Nil(t, err)
	require.NotNil(t, group)

	otherGroup, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_properties_delete_other", Version: model.PropertyGroupVersionV2})
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

		// Try to delete with wrong object_type in URL. Expected 404 to match
		// the shape of a non-existent field.
		resp, err := th.SystemAdminClient.DeletePropertyField(context.Background(), group.Name, "channel", createdField.ID)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("delete with wrong group name should fail 404", func(t *testing.T) {
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

		// Try to delete using the other group's name — field belongs to `group`, not `otherGroup`.
		// A field not found because of a wrong group must surface as 404, not a generic 500.
		th.LoginSystemAdmin(t)
		resp, err := th.SystemAdminClient.DeletePropertyField(context.Background(), otherGroup.Name, "post", createdField.ID)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Equal(t, "app.property.not_found.app_error", err.(*model.AppError).Id)
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

	t.Run("v1 group should return 404", func(t *testing.T) {
		v1Group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_v1_delete_field", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)
		require.NotNil(t, v1Group)

		resp, err := th.Client.DeletePropertyField(context.Background(), v1Group.Name, "post", model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestIsOptionsOnlyPatch(t *testing.T) {
	t.Run("nil attrs is not options-only", func(t *testing.T) {
		patch := &model.PropertyFieldPatch{
			Name: new("new name"),
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
			Name: new("new name"),
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

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_values_get", Version: model.PropertyGroupVersionV2})
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

	t.Run("v1 group should return 404", func(t *testing.T) {
		v1Group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_v1_get_values", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)
		require.NotNil(t, v1Group)

		_, resp, err := th.Client.GetPropertyValues(context.Background(), v1Group.Name, "post", th.BasicPost.Id, model.PropertyValueSearch{PerPage: 60})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("since", func(t *testing.T) {
		// Dedicated post + field/value so we can move UpdateAt deterministically.
		sincePost := th.CreatePost(t)
		sinceTarget := sincePost.Id

		sinceField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "post",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdSinceField, appErr := th.App.CreatePropertyField(th.Context, sinceField, false, "")
		require.Nil(t, appErr)

		upserted, appErr := th.App.UpsertPropertyValues(th.Context, []*model.PropertyValue{{
			TargetID:   sinceTarget,
			TargetType: "post",
			GroupID:    group.ID,
			FieldID:    createdSinceField.ID,
			Value:      json.RawMessage(`"initial"`),
			CreatedBy:  th.BasicUser.Id,
			UpdatedBy:  th.BasicUser.Id,
		}}, "", "", "")
		require.Nil(t, appErr)
		require.Len(t, upserted, 1)
		sinceValue := upserted[0]

		t.Run("since=-1 is treated as no filter", func(t *testing.T) {
			th.LoginBasic(t)

			values, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "post", sinceTarget, model.PropertyValueSearch{
				SinceUpdateAt: -1,
				PerPage:       60,
			})
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.NotEmpty(t, values, "negative since should behave like no filter")
		})

		t.Run("since>0 returns only rows with UpdateAt > since", func(t *testing.T) {
			th.LoginBasic(t)

			cutoff := model.GetMillis() + 10_000 // far in the future
			values, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "post", sinceTarget, model.PropertyValueSearch{
				SinceUpdateAt: cutoff,
				PerPage:       60,
			})
			require.NoError(t, err)
			CheckOKStatus(t, resp)
			require.Empty(t, values, "since cutoff in the future should exclude all rows")
		})

		t.Run("since returns soft-deleted rows", func(t *testing.T) {
			th.LoginBasic(t)

			// Snapshot a since cutoff strictly less than the upcoming tombstone UpdateAt.
			cutoff := sinceValue.UpdateAt - 1

			// Soft-delete the field through the app layer; this cascades to its values.
			require.Nil(t, th.App.DeletePropertyField(th.Context, group.ID, createdSinceField.ID, false, ""))

			values, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "post", sinceTarget, model.PropertyValueSearch{
				SinceUpdateAt: cutoff,
				PerPage:       60,
			})
			require.NoError(t, err)
			CheckOKStatus(t, resp)

			var found *model.PropertyValue
			for _, v := range values {
				if v.ID == sinceValue.ID {
					found = v
					break
				}
			}
			require.NotNil(t, found, "soft-deleted value should be returned in since-delta")
			require.Greater(t, found.DeleteAt, int64(0), "returned value should be tombstoned")
		})

		t.Run("cursor_create_at while since>0 returns 400", func(t *testing.T) {
			th.LoginBasic(t)

			_, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "post", sinceTarget, model.PropertyValueSearch{
				SinceUpdateAt:  1,
				CursorID:       model.NewId(),
				CursorCreateAt: 12345,
				PerPage:        60,
			})
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("cursor_update_at while since absent returns 400", func(t *testing.T) {
			th.LoginBasic(t)

			_, resp, err := th.Client.GetPropertyValues(context.Background(), group.Name, "post", sinceTarget, model.PropertyValueSearch{
				CursorID:       model.NewId(),
				CursorUpdateAt: 12345,
				PerPage:        60,
			})
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})
	})
}

func TestPatchPropertyValues(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_values_patch", Version: model.PropertyGroupVersionV2})
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

	// Use a real post as the target so target access checks pass.
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

		otherGroup, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_values_patch_other", Version: model.PropertyGroupVersionV2})
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
		CheckNotFoundStatus(t, resp)
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

	t.Run("field with mismatched object type should fail 404", func(t *testing.T) {
		// A field in the same group but scoped to a different ObjectType must not
		// be patchable through the URL of a peer ObjectType; the mismatch collapses
		// to 404 so callers cannot distinguish "no such field" from "field exists
		// but in a different object-type bucket".
		userField := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			GroupID:           group.ID,
			ObjectType:        "user",
			TargetType:        "system",
			PermissionField:   &memberLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		createdUserField, appErr := th.App.CreatePropertyField(th.Context, userField, false, "")
		require.Nil(t, appErr)

		th.LoginSystemAdmin(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: createdUserField.ID, Value: json.RawMessage(`"test"`)},
		}
		_, resp, err := th.SystemAdminClient.PatchPropertyValues(context.Background(), group.Name, "post", targetID, items)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
		require.Equal(t, "api.property_field.object_type_mismatch.app_error", err.(*model.AppError).Id)
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

	t.Run("non-member cannot set values on post in a channel they don't belong to", func(t *testing.T) {
		privateChannel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Type:        model.ChannelTypePrivate,
			Name:        model.NewId(),
			DisplayName: "Private Channel",
			CreatorId:   th.SystemAdminUser.Id,
		}, false)
		require.Nil(t, chanErr)

		// Create a post in the private channel as SystemAdmin (BasicUser is not a member).
		privatePost := th.CreatePostWithClient(t, th.SystemAdminClient, privateChannel)

		th.LoginBasic(t)
		items := []model.PropertyValuePatchItem{
			{FieldID: createdMemberField.ID, Value: json.RawMessage(`"should-fail"`)},
		}
		_, resp, err := th.Client.PatchPropertyValues(context.Background(), group.Name, "post", privatePost.Id, items)
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

	t.Run("v1 group should return 404", func(t *testing.T) {
		v1Group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_v1_patch_values", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)
		require.NotNil(t, v1Group)

		items := []model.PropertyValuePatchItem{
			{FieldID: model.NewId(), Value: json.RawMessage(`"test"`)},
		}

		_, resp, err := th.Client.PatchPropertyValues(context.Background(), v1Group.Name, "post", th.BasicPost.Id, items)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestGetPropertyValuesUserTargetAccess(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_user_get_access", Version: model.PropertyGroupVersionV2})
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

	t.Run("non-admin cannot get values of a user they cannot see", func(t *testing.T) {
		// Strip system-wide view_members so UserCanSeeOtherUser falls back to team/channel membership.
		th.RemovePermissionFromRole(t, model.PermissionViewMembers.Id, model.SystemUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionViewMembers.Id, model.SystemUserRoleId)

		// Drop BasicUser2 from BasicTeam so they no longer share a team with BasicUser.
		resp, err := th.SystemAdminClient.RemoveTeamMember(context.Background(), th.BasicTeam.Id, th.BasicUser2.Id)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		th.LoginBasic2(t)

		_, resp, err = th.Client.GetPropertyValues(context.Background(), group.Name, "user", th.BasicUser.Id, model.PropertyValueSearch{PerPage: 60})
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})
}

func TestPatchPropertyValuesUserTargetAccess(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_user_patch_access", Version: model.PropertyGroupVersionV2})
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

	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_chan_get_access", Version: model.PropertyGroupVersionV2})
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

	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_chan_patch_access", Version: model.PropertyGroupVersionV2})
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

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_team_broadcast", Version: model.PropertyGroupVersionV2})
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

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_channel_val_broadcast", Version: model.PropertyGroupVersionV2})
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

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_user_val_broadcast", Version: model.PropertyGroupVersionV2})
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

	// PSAv1 fields must live in a v1 group; the marker v2 field uses a separate v2 group.
	psav1Group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_psav1_optout_v1", Version: model.PropertyGroupVersionV1})
	require.Nil(t, err)
	v2Group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_psav1_optout_v2", Version: model.PropertyGroupVersionV2})
	require.Nil(t, err)

	// Create a PSAv1-style field: no ObjectType, meaning it predates
	// the websocket broadcast machinery added in PSAv2.
	psav1Field := &model.PropertyField{
		Name:       model.NewId(),
		Type:       model.PropertyFieldTypeText,
		GroupID:    psav1Group.ID,
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
				GroupID:    psav1Group.ID,
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
			GroupID:           v2Group.ID,
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

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_multi_val_payload", Version: model.PropertyGroupVersionV2})
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

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_linked_properties", Version: model.PropertyGroupVersionV2})
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

func TestSystemObjectType(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)

	group, err := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_system_object_type", Version: model.PropertyGroupVersionV2})
	require.Nil(t, err)

	t.Run("non-admin cannot create a system field", func(t *testing.T) {
		field := &model.PropertyField{
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		_, resp, createErr := th.Client.CreatePropertyField(context.Background(), group.Name, model.PropertyFieldObjectTypeSystem, field)
		require.Error(t, createErr)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("sysadmin creates a system field with canonical target and sysadmin-default permissions", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
			// Intentionally submit mismatched target fields to confirm the server canonicalizes them.
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   model.NewId(),
		}
		created, resp, createErr := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, model.PropertyFieldObjectTypeSystem, field)
		require.NoError(t, createErr)
		CheckCreatedStatus(t, resp)

		require.Equal(t, model.PropertyFieldObjectTypeSystem, created.ObjectType)
		require.Equal(t, string(model.PropertyFieldTargetLevelSystem), created.TargetType)
		require.Empty(t, created.TargetID)
		require.NotNil(t, created.PermissionField)
		require.Equal(t, model.PermissionLevelSysadmin, *created.PermissionField)
		require.NotNil(t, created.PermissionValues)
		require.Equal(t, model.PermissionLevelSysadmin, *created.PermissionValues)
	})

	t.Run("any authenticated user can list system fields", func(t *testing.T) {
		fields, resp, getErr := th.Client.GetPropertyFields(context.Background(), group.Name, model.PropertyFieldObjectTypeSystem, model.PropertyFieldSearch{
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(t, getErr)
		CheckOKStatus(t, resp)
		require.NotEmpty(t, fields)
	})

	t.Run("legacy values GET route rejects system object type", func(t *testing.T) {
		// Force a URL that matches {object_type}/values/{target_id}. "system" is a valid
		// character set for {target_id}, so the route is reachable even though the handler
		// must reject it.
		_, resp, getErr := th.Client.GetPropertyValues(context.Background(), group.Name, model.PropertyFieldObjectTypeSystem, model.PropertyValueSystemTargetID, model.PropertyValueSearch{})
		require.Error(t, getErr)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("legacy values PATCH route rejects system object type", func(t *testing.T) {
		// Mirrors the GET rejection: the legacy URL pattern matches system/system, so the
		// route is reachable and the handler must reject it pointing callers to the
		// dedicated system route.
		items := []model.PropertyValuePatchItem{
			{FieldID: model.NewId(), Value: json.RawMessage(`"ignored"`)},
		}
		_, resp, patchErr := th.SystemAdminClient.PatchPropertyValues(context.Background(), group.Name, model.PropertyFieldObjectTypeSystem, model.PropertyValueSystemTargetID, items)
		require.Error(t, patchErr)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("system PATCH rejects template field IDs", func(t *testing.T) {
		// Create the template field directly via the app layer so the test stays
		// focused on the value-patch handler. Template fields are definition-only
		// and must never accept values, regardless of entry point.
		templateField := &model.PropertyField{
			GroupID:           group.ID,
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   model.NewPointer(model.PermissionLevelSysadmin),
			PermissionValues:  model.NewPointer(model.PermissionLevelSysadmin),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, templateField, false, "")
		require.Nil(t, appErr)

		items := []model.PropertyValuePatchItem{
			{FieldID: created.ID, Value: json.RawMessage(`"ignored"`)},
		}
		_, resp, patchErr := th.SystemAdminClient.PatchSystemPropertyValues(context.Background(), group.Name, items)
		require.Error(t, patchErr)
		// Mismatch (template field ObjectType != system route's objectType)
		// collapses to 404 to match the executePatchPropertyField shape.
		CheckNotFoundStatus(t, resp)
	})

	t.Run("system field round-trips a value via the dedicated route", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}
		created, resp, createErr := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, model.PropertyFieldObjectTypeSystem, field)
		require.NoError(t, createErr)
		CheckCreatedStatus(t, resp)

		items := []model.PropertyValuePatchItem{
			{FieldID: created.ID, Value: json.RawMessage(`"hello-system"`)},
		}

		// Non-admin cannot write a system value.
		_, resp, patchErr := th.Client.PatchSystemPropertyValues(context.Background(), group.Name, items)
		require.Error(t, patchErr)
		CheckForbiddenStatus(t, resp)

		// Sysadmin writes succeed and store the sentinel TargetID.
		upserted, resp, patchErr := th.SystemAdminClient.PatchSystemPropertyValues(context.Background(), group.Name, items)
		require.NoError(t, patchErr)
		CheckOKStatus(t, resp)
		require.Len(t, upserted, 1)
		require.Equal(t, model.PropertyValueSystemTargetID, upserted[0].TargetID)
		require.Equal(t, model.PropertyValueTargetTypeSystem, upserted[0].TargetType)

		// Any authed user can read.
		values, resp, getErr := th.Client.GetSystemPropertyValues(context.Background(), group.Name, model.PropertyValueSearch{})
		require.NoError(t, getErr)
		CheckOKStatus(t, resp)
		found := false
		for _, v := range values {
			if v.FieldID == created.ID {
				require.Equal(t, model.PropertyValueSystemTargetID, v.TargetID)
				require.Equal(t, json.RawMessage(`"hello-system"`), v.Value)
				found = true
			}
		}
		require.True(t, found, "expected to find the system value we just wrote")
	})

	t.Run("system value patch broadcasts system-wide", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}
		created, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:           group.ID,
			Name:              field.Name,
			Type:              field.Type,
			ObjectType:        model.PropertyFieldObjectTypeSystem,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   model.NewPointer(model.PermissionLevelSysadmin),
			PermissionValues:  model.NewPointer(model.PermissionLevelSysadmin),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}, false, "")
		require.Nil(t, appErr)

		th.LoginBasic(t)
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		items := []model.PropertyValuePatchItem{
			{FieldID: created.ID, Value: json.RawMessage(`"broadcast-me"`)},
		}
		_, resp, patchErr := th.SystemAdminClient.PatchSystemPropertyValues(context.Background(), group.Name, items)
		require.NoError(t, patchErr)
		CheckOKStatus(t, resp)

		require.Eventually(t, func() bool {
			select {
			case event := <-webSocketClient.EventChannel:
				if event.EventType() == model.WebsocketEventPropertyValuesUpdated &&
					event.GetData()["object_type"] == model.PropertyFieldObjectTypeSystem {
					require.Equal(t, model.PropertyValueSystemTargetID, event.GetData()["target_id"])
					// System target: broadcast should be system-wide (empty team/channel)
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

	t.Run("system field permissions are canonicalized to sysadmin even when admin requests member", func(t *testing.T) {
		// Without canonicalization, an admin could POST member-level
		// permissions on a system field; the per-field permission check
		// would then resolve "member" against TargetType=system, which
		// hasPropertyFieldScopeAccess treats as "any authenticated user",
		// effectively making the field publicly mutable.
		field := &model.PropertyField{
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			PermissionField:   model.NewPointer(model.PermissionLevelMember),
			PermissionValues:  model.NewPointer(model.PermissionLevelMember),
			PermissionOptions: model.NewPointer(model.PermissionLevelMember),
		}
		created, resp, createErr := th.SystemAdminClient.CreatePropertyField(context.Background(), group.Name, model.PropertyFieldObjectTypeSystem, field)
		require.NoError(t, createErr)
		CheckCreatedStatus(t, resp)

		require.NotNil(t, created.PermissionField)
		require.Equal(t, model.PermissionLevelSysadmin, *created.PermissionField)
		require.NotNil(t, created.PermissionValues)
		require.Equal(t, model.PermissionLevelSysadmin, *created.PermissionValues)
		require.NotNil(t, created.PermissionOptions)
		require.Equal(t, model.PermissionLevelSysadmin, *created.PermissionOptions)

		// With permissions canonicalized to sysadmin, the existing
		// per-field permission check rejects non-admin patch/delete
		// without any additional handler-level floor.
		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: &newName}
		_, resp, patchErr := th.Client.PatchPropertyField(context.Background(), group.Name, model.PropertyFieldObjectTypeSystem, created.ID, patch)
		require.Error(t, patchErr)
		CheckForbiddenStatus(t, resp)

		resp, deleteErr := th.Client.DeletePropertyField(context.Background(), group.Name, model.PropertyFieldObjectTypeSystem, created.ID)
		require.Error(t, deleteErr)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("legacy values PATCH route rejects body referencing a system field ID", func(t *testing.T) {
		// Cross-route reference: a non-system route receives a body whose
		// field IDs belong to a system-typed field. Without the ObjectType
		// match check this would either bypass the system-write sysadmin
		// gate or persist a value whose TargetType disagrees with
		// field.ObjectType.
		systemField, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:           group.ID,
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeSystem,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   model.NewPointer(model.PermissionLevelSysadmin),
			PermissionValues:  model.NewPointer(model.PermissionLevelMember),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}, false, "")
		require.Nil(t, appErr)

		items := []model.PropertyValuePatchItem{
			{FieldID: systemField.ID, Value: json.RawMessage(`"smuggled"`)},
		}
		// Even sysadmin should be rejected — this is a structural check on
		// the route, not a permission check. Mismatch collapses to 404 to
		// match the executePatchPropertyField/executeDeletePropertyField shape.
		_, resp, patchErr := th.SystemAdminClient.PatchPropertyValues(context.Background(), group.Name, model.PropertyFieldObjectTypeUser, th.SystemAdminUser.Id, items)
		require.Error(t, patchErr)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("system values PATCH route rejects body referencing a non-system field ID", func(t *testing.T) {
		// Inverse of the previous case: the dedicated system route is
		// reachable only by sysadmin, but it must still reject body field
		// IDs whose ObjectType isn't system, otherwise rows get persisted
		// with TargetType=system pointing at fields that attach to other
		// entity types.
		postField, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:           group.ID,
			Name:              model.NewId(),
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypePost,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   model.NewPointer(model.PermissionLevelSysadmin),
			PermissionValues:  model.NewPointer(model.PermissionLevelSysadmin),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}, false, "")
		require.Nil(t, appErr)

		items := []model.PropertyValuePatchItem{
			{FieldID: postField.ID, Value: json.RawMessage(`"misrouted"`)},
		}
		_, resp, patchErr := th.SystemAdminClient.PatchSystemPropertyValues(context.Background(), group.Name, items)
		require.Error(t, patchErr)
		CheckNotFoundStatus(t, resp)
	})
}
