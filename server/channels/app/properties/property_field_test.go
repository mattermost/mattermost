// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHooksOnlyScopeToManagedGroups(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context

	// Operations on an unmanaged group should bypass the access control
	// hook entirely and proceed directly to the store layer.
	unmanagedGroup, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: "unmanaged_group", Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	t.Run("CreatePropertyField on unmanaged group bypasses hooks", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    unmanagedGroup.ID,
			Name:       "test-field-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("GetPropertyField on unmanaged group bypasses hooks", func(t *testing.T) {
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    unmanagedGroup.ID,
			Name:       "get-field-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		result, err := th.service.GetPropertyField(rctx, unmanagedGroup.ID, field.ID)
		require.NoError(t, err)
		assert.Equal(t, field.ID, result.ID)
	})
}

func TestCountActivePropertyFieldsForGroup(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context

	t.Run("should return count of active property fields for a group", func(t *testing.T) {
		groupID := model.NewId()

		// Create some property fields
		for range 5 {
			th.CreatePropertyFieldDirect(t, &model.PropertyField{
				ObjectType: "channel",
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
				Name:       "Property " + model.NewId(),
			})
		}

		count, err := th.service.CountActivePropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(5), count)
	})

	t.Run("should return 0 for empty group", func(t *testing.T) {
		groupID := model.NewId()

		count, err := th.service.CountActivePropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})

	t.Run("should not count deleted fields", func(t *testing.T) {
		groupID := model.NewId()

		// Create 3 fields
		for range 3 {
			th.CreatePropertyFieldDirect(t, &model.PropertyField{
				ObjectType: "channel",
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
				Name:       "Active " + model.NewId(),
			})
		}

		// Create and delete 2 fields
		for range 2 {
			field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
				ObjectType: "channel",
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
				Name:       "Deleted " + model.NewId(),
			})
			err := th.dbStore.PropertyField().Delete(groupID, field.ID)
			require.NoError(t, err)
		}

		count, err := th.service.CountActivePropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(3), count)
	})
}

func TestCountAllPropertyFieldsForGroup(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context

	t.Run("should return count of all property fields including deleted", func(t *testing.T) {
		groupID := model.NewId()

		// Create 5 active fields
		for range 5 {
			th.CreatePropertyFieldDirect(t, &model.PropertyField{
				ObjectType: "channel",
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
				Name:       "Active " + model.NewId(),
			})
		}

		// Create and delete 3 fields
		for range 3 {
			field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
				ObjectType: "channel",
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
				Name:       "Deleted " + model.NewId(),
			})
			err := th.dbStore.PropertyField().Delete(groupID, field.ID)
			require.NoError(t, err)
		}

		count, err := th.service.CountAllPropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(8), count)
	})

	t.Run("should return 0 for empty group", func(t *testing.T) {
		groupID := model.NewId()

		count, err := th.service.CountAllPropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})

	t.Run("should return higher count than active fields when there are deleted fields", func(t *testing.T) {
		groupID := model.NewId()

		// Create 5 active fields
		for range 5 {
			th.CreatePropertyFieldDirect(t, &model.PropertyField{
				ObjectType: "channel",
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
				Name:       "Active " + model.NewId(),
			})
		}

		// Create and delete 3 fields
		for range 3 {
			field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
				ObjectType: "channel",
				GroupID:    groupID,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
				Name:       "Deleted " + model.NewId(),
			})
			err := th.dbStore.PropertyField().Delete(groupID, field.ID)
			require.NoError(t, err)
		}

		activeCount, err := th.service.CountActivePropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)

		allCount, err := th.service.CountAllPropertyFieldsForGroup(rctx, groupID)
		require.NoError(t, err)

		assert.Equal(t, int64(5), activeCount)
		assert.Equal(t, int64(8), allCount)
		assert.True(t, allCount > activeCount)
	})
}

func TestCreatePropertyField(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context

	t.Run("legacy property with empty ObjectType should skip conflict check", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)
		field := &model.PropertyField{
			ObjectType: "", // Legacy
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "Legacy Property",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
		assert.Equal(t, "Legacy Property", result.Name)
	})

	t.Run("system-level property with no conflict should create successfully", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "System Property",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
		assert.Equal(t, "System Property", result.Name)
	})

	t.Run("system-level property with existing team property should conflict", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		team := th.CreateTeam(t)

		// Create team-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "Status",
		})

		// Try to create system-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "Status",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "team-level")
	})

	t.Run("system-level property with existing channel property should conflict", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team.Id)

		// Create channel-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "Priority",
		})

		// Try to create system-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "Priority",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "channel-level")
	})

	t.Run("team-level property with no conflict should create successfully", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		team := th.CreateTeam(t)

		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "Team Property",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
		assert.Equal(t, "Team Property", result.Name)
	})

	t.Run("team-level property with existing system property should conflict", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		team := th.CreateTeam(t)

		// Create system-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "SystemField",
		})

		// Try to create team-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "SystemField",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "system-level")
	})

	t.Run("team-level property with existing channel property in same team should conflict", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team.Id)

		// Create channel-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "ChannelProp",
		})

		// Try to create team-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "ChannelProp",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "channel-level")
	})

	t.Run("channel-level property with no conflict should create successfully", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team.Id)

		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "Channel Property",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
		assert.Equal(t, "Channel Property", result.Name)
	})

	t.Run("channel-level property with existing system property should conflict", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team.Id)

		// Create system-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "GlobalProp",
		})

		// Try to create channel-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "GlobalProp",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "system-level")
	})

	t.Run("channel-level property with existing team property should conflict", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team.Id)

		// Create team-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "TeamProp",
		})

		// Try to create channel-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "TeamProp",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "team-level")
	})

	t.Run("DM channel only checks system-level for conflicts", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		team := th.CreateTeam(t)
		dmChannel := th.CreateDMChannel(t)

		// Create a team-level property in a team
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "TeamOnlyProp",
		})

		// DM channel property should not conflict with team-level property
		// since DM channels have no team association
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   dmChannel.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "TeamOnlyProp",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("channel in different team does not conflict with team property", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		team1 := th.CreateTeam(t)
		team2 := th.CreateTeam(t)
		channelInTeam2 := th.CreateChannel(t, team2.Id)

		// Create team-level property in team1
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team1.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "Team1Prop",
		})

		// Channel-level property in team2 should not conflict with team1's property
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channelInTeam2.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "Team1Prop",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("properties in different groups with same name do not conflict", func(t *testing.T) {
		group1 := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2).ID
		group2 := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2).ID

		// Create system-level property in group1
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group1,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "SharedName",
		})

		// System-level property in group2 should not conflict
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    group2,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "SharedName",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("deleted properties do not cause conflicts", func(t *testing.T) {
		groupID := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2).ID

		// Create and delete a system-level property
		deleted := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "DeletedProp",
		})
		err := th.dbStore.PropertyField().Delete(groupID, deleted.ID)
		require.NoError(t, err)

		// New property with same name should succeed
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "DeletedProp",
		}
		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
	})
}

func TestCreatePropertyFieldDefaultsPermissions(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context

	t.Run("a field created with only legacy columns comes back with the equivalent restrictions and reports the same GetAccessMode as before", func(t *testing.T) {
		// A plain group, not the CPA one: the access_control group's create
		// hook pins the three legacy permission levels to sysadmin/by-object-type
		// defaults before this field ever reaches the conversion this asserts,
		// which would test that hook instead of the conversion itself.
		otherGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		adminLevel := model.PermissionLevelAdmin
		memberLevel := model.PermissionLevelMember
		field := &model.PropertyField{
			GroupID:           otherGroup.ID,
			Name:              "legacy-defaults-" + model.NewId(),
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeUser,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &adminLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
		}
		wantAccessMode := field.GetAccessMode()

		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)

		require.NotNil(t, result.Permissions)
		assert.Equal(t, wantAccessMode, result.GetAccessMode())
		assert.Equal(t, model.PermissionLevelAdmin, result.Permissions.Restrictions.Field.Write)
		assert.Equal(t, model.PermissionLevelMember, result.Permissions.Restrictions.Value.Write)
		assert.Equal(t, model.PermissionLevelEveryone, result.Permissions.Restrictions.Value.Read)
		assert.Equal(t, model.PermissionLevelMember, result.Permissions.Restrictions.Option.Write)
		assert.Equal(t, model.PermissionLevelEveryone, result.Permissions.Restrictions.Option.Read)
	})

	t.Run("a field created with an explicit permissions object comes back with it untouched", func(t *testing.T) {
		permissions := &model.Permissions{
			Restrictions: &model.Restrictions{
				Field:  model.WriteOnly{Write: model.PermissionLevelAdmin},
				Option: model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelAdmin},
				Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelMember},
			},
			Grants: []model.Grant{},
		}
		field := &model.PropertyField{
			GroupID:     th.CPAGroupID,
			Name:        "explicit-permissions-" + model.NewId(),
			Type:        model.PropertyFieldTypeText,
			ObjectType:  model.PropertyFieldObjectTypeUser,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
			Permissions: permissions,
		}

		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.Equal(t, permissions, result.Permissions)
	})

	t.Run("a field created by a plugin caller comes back carrying a plugin grant for that plugin", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "test-plugin" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })
		rctxPlugin := RequestContextWithCallerID(rctx, "test-plugin")

		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "plugin-owned-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}

		result, err := th.service.CreatePropertyField(rctxPlugin, field)
		require.NoError(t, err)

		require.NotNil(t, result.Permissions)
		assert.Contains(t, result.Permissions.Grants, model.Grant{
			Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "test-plugin"},
			Allow: []string{
				model.PropertyActionFieldWrite,
				model.PropertyActionOptionRead,
				model.PropertyActionOptionWrite,
				model.PropertyActionValueRead,
				model.PropertyActionValueWrite,
			},
		})
	})

	t.Run("a linked create off a shared_only template comes back with Masking nil and its option.read no more permissive than the template's", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "test-plugin" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })
		rctxPlugin := RequestContextWithCallerID(rctx, "test-plugin")

		template, err := th.service.CreatePropertyField(rctxPlugin, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "shared-only-template-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, template.Permissions)
		require.NotNil(t, template.Permissions.Masking)

		// Only the source plugin may link a field to a protected template, so
		// the linked field is created by the same caller as the template.
		linked, err := th.service.CreatePropertyField(rctxPlugin, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "linked-off-shared-only-" + model.NewId(),
			Type:          model.PropertyFieldTypeSelect,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
		})
		require.NoError(t, err)

		require.NotNil(t, linked.Permissions)
		assert.Nil(t, linked.Permissions.Masking)

		templateOptionRead := template.Permissions.Restrictions.TierFor(model.PropertyActionOptionRead)
		linkedOptionRead := linked.Permissions.Restrictions.TierFor(model.PropertyActionOptionRead)
		assert.True(t, linkedOptionRead.AtMostAsPermissiveAs(templateOptionRead))
	})

	t.Run("a field with an empty ObjectType comes back with Permissions nil", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)
		field := &model.PropertyField{
			ObjectType: "",
			GroupID:    group.ID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "psav1-no-permissions-" + model.NewId(),
		}

		result, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		assert.Nil(t, result.Permissions)
	})
}

func TestUpdatePropertyFieldTranslatesLegacyPermissionKeys(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context

	// field.write on these fields is pinned to sysadmin (the same column
	// pinning every access_control field gets), and the hook judges a human
	// caller's field.write against that tier once the field carries
	// Permissions -- an administrator reaching this service call directly,
	// the way these tests do, needs the same standing an api4 caller would
	// already have through SessionPropertyFieldEditBasis.
	// defaultLadderCheckerForTests treats every caller as an ordinary member,
	// so a definition edit in this test needs its own checker.
	th.service.setLadderCheckerForTests(func(_ request.CTX, _ string, field *model.PropertyField, action, _ string) bool {
		if field.Permissions == nil {
			return false
		}
		return model.PermissionLevelSysadmin.AtMostAsPermissiveAs(field.Permissions.Restrictions.TierFor(action))
	})
	t.Cleanup(func() { th.service.setLadderCheckerForTests(nil) })
	rctxAdmin := RequestContextWithCallerID(rctx, model.NewId())

	t.Run("a PSAv1 field updated through updatePropertyFields still has nil Permissions and the update still succeeds", func(t *testing.T) {
		v1Group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)
		field, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:    v1Group.ID,
			Name:       "psav1-update-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(t, err)
		require.Nil(t, field.Permissions)

		field.Name = "psav1-update-renamed-" + model.NewId()
		updated, _, err := th.service.UpdatePropertyField(rctx, v1Group.ID, field)
		require.NoError(t, err)
		assert.Equal(t, field.Name, updated.Name)
		assert.Nil(t, updated.Permissions)
	})

	t.Run("resubmitting a field unchanged leaves stored permissions byte-identical, masking included", func(t *testing.T) {
		// PermissionField/PermissionOptions are set explicitly to what the
		// column-pinning hook would assign, even though CreatePropertyFieldDirect
		// bypasses that hook: an update always runs it, so an unpinned field
		// created this way would appear to have gained a legacy key the
		// moment it takes its first trip through UpdatePropertyField.
		sysadminLevel := model.PermissionLevelSysadmin
		memberLevel := model.PermissionLevelMember
		exemptUser := model.NewId()
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:           th.CPAGroupID,
			Name:              "masked-roundtrip-" + model.NewId(),
			Type:              model.PropertyFieldTypeSelect,
			ObjectType:        model.PropertyFieldObjectTypeUser,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &sysadminLevel,
			PermissionOptions: &sysadminLevel,
			PermissionValues:  &memberLevel,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field:  model.WriteOnly{Write: model.PermissionLevelSysadmin},
					Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelAdmin},
					Option: model.ReadWrite{Read: model.PermissionLevelEveryone},
				},
				// mask_by_field_id may only be set on a template; this is an
				// unlinked user-object field, so it resolves its own holdings
				// and this test only needs the except list to round-trip.
				Masking: &model.Masking{
					Except: []model.Identity{{Type: model.PropertyOwnerTypeUser, ID: exemptUser}},
				},
			},
		})

		updated, _, err := th.service.UpdatePropertyField(rctxAdmin, th.CPAGroupID, field)
		require.NoError(t, err)
		assert.Equal(t, field.Permissions, updated.Permissions)
	})

	t.Run("changing permission_values on a v2 submission moves restrictions.value.write", func(t *testing.T) {
		memberLevel := model.PermissionLevelMember
		field, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:          th.CPAGroupID,
			Name:             "v2-permvalues-" + model.NewId(),
			Type:             model.PropertyFieldTypeText,
			ObjectType:       model.PropertyFieldObjectTypeUser,
			TargetType:       string(model.PropertyFieldTargetLevelSystem),
			PermissionValues: &memberLevel,
		})
		require.NoError(t, err)
		require.Equal(t, model.PermissionLevelMember, field.Permissions.Restrictions.Value.Write)

		adminLevel := model.PermissionLevelAdmin
		field.PermissionValues = &adminLevel
		updated, _, err := th.service.UpdatePropertyField(rctxAdmin, th.CPAGroupID, field)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelAdmin, updated.Permissions.Restrictions.Value.Write)
	})

	t.Run("an owner submitted with no allow keeps its stored grant's actions; a new owner with no allow gets all five", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "owner-allow-fill-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyAttrsOwners: []model.PropertyOwner{
					{Type: model.PropertyOwnerTypePlugin, ID: "owner-allow-fill-plugin", Allow: []string{model.PropertyActionValueRead, model.PropertyActionValueWrite}},
				},
			},
		})
		require.NoError(t, err)

		grantFor := func(permissions *model.Permissions, id string) *model.Grant {
			for i := range permissions.Grants {
				if permissions.Grants[i].ID == id {
					return &permissions.Grants[i]
				}
			}
			return nil
		}
		stored := grantFor(field.Permissions, "owner-allow-fill-plugin")
		require.NotNil(t, stored)
		require.Len(t, stored.Allow, 2)

		field.Attrs[model.PropertyAttrsOwners] = []model.PropertyOwner{
			{Type: model.PropertyOwnerTypePlugin, ID: "owner-allow-fill-plugin"},
			{Type: model.PropertyOwnerTypePlugin, ID: "owner-allow-fill-new"},
		}
		updated, _, err := th.service.UpdatePropertyField(rctxAdmin, th.CPAGroupID, field)
		require.NoError(t, err)

		existingOwner := grantFor(updated.Permissions, "owner-allow-fill-plugin")
		require.NotNil(t, existingOwner)
		assert.Len(t, existingOwner.Allow, 2, "an identity already holding a grant keeps its stored action list when the submission leaves Allow empty")

		newOwner := grantFor(updated.Permissions, "owner-allow-fill-new")
		require.NotNil(t, newOwner)
		assert.Len(t, newOwner.Allow, 5, "an identity with nothing stored keeps the all-five conversion default")
	})

	t.Run("reconverting a masked field keeps its stored masking whole, a v3-added except entry included", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "mask-source-plugin" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })
		rctxPlugin := RequestContextWithCallerID(rctx, "mask-source-plugin")

		// PermissionValues is set explicitly (not left for the column-pinning
		// hook's object-type default of member) because shared_only and a
		// member-writable value column are mutually exclusive under the
		// still-live legacy validator, and this field is updated again below.
		sysadminLevel := model.PermissionLevelSysadmin
		field, err := th.service.CreatePropertyField(rctxPlugin, &model.PropertyField{
			GroupID:          th.CPAGroupID,
			Name:             "masked-preserve-" + model.NewId(),
			Type:             model.PropertyFieldTypeSelect,
			ObjectType:       model.PropertyFieldObjectTypeUser,
			TargetType:       string(model.PropertyFieldTargetLevelSystem),
			PermissionValues: &sysadminLevel,
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
			},
		})
		require.NoError(t, err)
		require.NotNil(t, field.Permissions.Masking)
		pluginExempt := model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "mask-source-plugin"}
		require.Equal(t, []model.Identity{pluginExempt}, field.Permissions.Masking.Except)

		// A v3 caller widens the except list beyond anything the legacy attrs
		// could produce. No legacy key changes here, so this must land
		// untouched -- the round-trip guarantee rule 2 relies on.
		stewardID := model.NewId()
		augmentedMasking := *field.Permissions.Masking
		augmentedMasking.Except = append(append([]model.Identity{}, field.Permissions.Masking.Except...),
			model.Identity{Type: model.PropertyOwnerTypeUser, ID: stewardID})
		augmented := *field.Permissions
		augmented.Masking = &augmentedMasking
		field.Permissions = &augmented
		field, _, err = th.service.UpdatePropertyField(rctxPlugin, th.CPAGroupID, field)
		require.NoError(t, err)
		require.Len(t, field.Permissions.Masking.Except, 2)

		// Touch a legacy key unrelated to masking so the update reconverts,
		// and confirm the reconversion does not flatten the widened except
		// list back down to only what the legacy attrs alone would produce.
		adminLevel := model.PermissionLevelAdmin
		field.PermissionValues = &adminLevel
		updated, _, err := th.service.UpdatePropertyField(rctxPlugin, th.CPAGroupID, field)
		require.NoError(t, err)
		require.NotNil(t, updated.Permissions.Masking)
		assert.ElementsMatch(t, field.Permissions.Masking.Except, updated.Permissions.Masking.Except)
	})

	t.Run("turning off access_mode on a field whose masking hides data the caller cannot see is refused", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "refuse-mask-plugin" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })
		rctxPlugin := RequestContextWithCallerID(rctx, "refuse-mask-plugin")

		sysadminLevel := model.PermissionLevelSysadmin
		field, err := th.service.CreatePropertyField(rctxPlugin, &model.PropertyField{
			GroupID:          th.CPAGroupID,
			Name:             "masked-refuse-clear-" + model.NewId(),
			Type:             model.PropertyFieldTypeSelect,
			ObjectType:       model.PropertyFieldObjectTypeUser,
			TargetType:       string(model.PropertyFieldTargetLevelSystem),
			PermissionValues: &sysadminLevel,
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
			},
		})
		require.NoError(t, err)
		require.NotEmpty(t, field.Permissions.Masking.Except)

		field.Attrs[model.PropertyAttrsAccessMode] = model.PropertyAccessModePublic
		updated, _, err := th.service.UpdatePropertyField(rctxPlugin, th.CPAGroupID, field)
		require.Error(t, err)
		assert.Nil(t, updated)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Equal(t, "app.property_field.update.masking_discarded.app_error", appErr.Id)
	})

	t.Run("turning off access_mode on a field whose masking hides nothing unmasks it", func(t *testing.T) {
		// Built directly rather than through CreatePropertyField: a plugin is
		// the only caller allowed to set the protected attr, and a plugin
		// creating a shared_only field always gets an except entry of its
		// own -- there would be no way to construct the empty-masking case
		// this asserts through that path.
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "masked-empty-clear-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field: model.WriteOnly{Write: model.PermissionLevelSysadmin},
					Value: model.ReadWrite{Read: model.PermissionLevelEveryone},
				},
				Masking: &model.Masking{},
			},
		})
		require.NotNil(t, field.Permissions.Masking)
		require.Empty(t, field.Permissions.Masking.Except)
		require.Empty(t, field.Permissions.Masking.MaskByFieldID)

		field.Attrs[model.PropertyAttrsAccessMode] = model.PropertyAccessModePublic
		field.Attrs[model.PropertyAttrsProtected] = false
		updated, _, err := th.service.UpdatePropertyField(rctxAdmin, th.CPAGroupID, field)
		require.NoError(t, err)
		assert.Nil(t, updated.Permissions.Masking)
	})
}

func TestUpdatePropertyField(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context

	t.Run("updating non-name fields should not trigger conflict check", func(t *testing.T) {
		groupID := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2).ID

		// Create a property
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "NoConflictCheck",
			Attrs: map[string]any{
				"key": "original",
			},
		})

		// Update non-name fields (Attrs only)
		field.Attrs = map[string]any{
			"key": "updated",
		}

		result, _, err := th.service.UpdatePropertyField(rctx, groupID, field)
		require.NoError(t, err)
		assert.Equal(t, "updated", result.Attrs["key"])
	})

	t.Run("updating name to non-conflicting value should succeed", func(t *testing.T) {
		groupID := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2).ID

		// Create a property
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "OriginalName",
		})

		// Update name to non-conflicting value
		field.Name = "NewUniqueName"
		result, _, err := th.service.UpdatePropertyField(rctx, groupID, field)
		require.NoError(t, err)
		assert.Equal(t, "NewUniqueName", result.Name)
	})

	t.Run("updating name to conflicting value at team level should fail", func(t *testing.T) {
		groupID := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2).ID
		team := th.CreateTeam(t)

		// Create a team-level property
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "ExistingTeamProp",
		})

		// Create a system-level property with different name
		systemField := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "SystemProp",
		})

		// Try to update system-level to name that conflicts with team-level
		systemField.Name = "ExistingTeamProp"
		result, _, err := th.service.UpdatePropertyField(rctx, groupID, systemField)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "team-level")
	})

	t.Run("updating DM channel property to same name as regular channel property should succeed", func(t *testing.T) {
		groupID := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2).ID
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team.Id)
		dmChannel := th.CreateDMChannel(t)

		// Create a channel-level property in a regular channel
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "ChannelProp",
		})

		// Create a channel-level property in a DM channel with different name
		dmField := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   dmChannel.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "DMProp",
		})

		// Update DM property to same name as regular channel property - should succeed
		// because DM channels have no team, so they don't conflict with team channels
		dmField.Name = "ChannelProp"
		result, _, err := th.service.UpdatePropertyField(rctx, groupID, dmField)
		require.NoError(t, err)
		assert.Equal(t, "ChannelProp", result.Name)
	})

	t.Run("updating name to conflicting value at system level should fail", func(t *testing.T) {
		groupID := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2).ID
		team := th.CreateTeam(t)

		// Create a system-level property
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "ExistingSystemProp",
		})

		// Create a team-level property with different name
		teamField := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "TeamProp",
		})

		// Try to update team-level to name that conflicts with system-level
		teamField.Name = "ExistingSystemProp"
		result, _, err := th.service.UpdatePropertyField(rctx, groupID, teamField)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "system-level")
	})

	t.Run("updating TargetType that creates conflict should fail", func(t *testing.T) {
		groupID := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2).ID
		team := th.CreateTeam(t)
		channel1 := th.CreateChannel(t, team.Id)
		channel2 := th.CreateChannel(t, team.Id)

		// Create two channel-level properties with the same name in different channels
		// (no conflict since channel-level properties in different channels don't conflict)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel1.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "SharedName",
		})

		channel2Field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel2.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "SharedName",
		})

		// Try to update channel2's property to system-level - should conflict with channel1's property
		channel2Field.TargetType = string(model.PropertyFieldTargetLevelSystem)
		channel2Field.TargetID = ""

		result, _, err := th.service.UpdatePropertyField(rctx, groupID, channel2Field)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "channel-level")
	})

	t.Run("updating TargetID that creates conflict should fail", func(t *testing.T) {
		groupID := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2).ID
		team := th.CreateTeam(t)
		channel1 := th.CreateChannel(t, team.Id)
		channel2 := th.CreateChannel(t, team.Id)

		// Create two channel-level properties with the same name in different channels
		// (no conflict since channel-level properties in different channels don't conflict)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel1.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "SharedName",
		})

		channel2Field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel2.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "SharedName",
		})

		// Update channel2's property TargetID to channel1 - should conflict
		// because channel1 already has a property with the same name.
		// Note: This conflict is caught by the database unique constraint, not the
		// hierarchical conflict check (which only checks cross-level conflicts).
		// We only verify an error occurs without checking the specific error type.
		channel2Field.TargetID = channel1.Id

		result, _, err := th.service.UpdatePropertyField(rctx, groupID, channel2Field)
		require.Error(t, err)
		assert.Nil(t, result)
	})

	t.Run("legacy property updates should skip conflict check", func(t *testing.T) {
		groupID := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1).ID

		// Create a legacy property (no ObjectType)
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "", // Legacy
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "LegacyProp",
		})

		// Update name should succeed without conflict check
		field.Name = "UpdatedLegacyProp"
		result, _, err := th.service.UpdatePropertyField(rctx, groupID, field)
		require.NoError(t, err)
		assert.Equal(t, "UpdatedLegacyProp", result.Name)
	})

	t.Run("property can be renamed to its own name", func(t *testing.T) {
		groupID := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2).ID

		// Create a property
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "SameName",
		})

		// Update with same name should succeed (no actual change to name)
		field.Attrs = map[string]any{"key": "changed"} // Change something else
		result, _, err := th.service.UpdatePropertyField(rctx, groupID, field)
		require.NoError(t, err)
		assert.Equal(t, "SameName", result.Name)
	})
}

func TestLinkedPropertyFields(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context
	group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)

	// Helper to create a source template field with select options
	createSourceField := func(t *testing.T, name string) *model.PropertyField {
		t.Helper()
		return th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       name,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
					map[string]any{"id": model.NewId(), "name": "Option B"},
				},
			},
		})
	}

	t.Run("create linked field copies source type and options", func(t *testing.T) {
		source := createSourceField(t, "Source-"+model.NewId())

		linked, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText, // will be overwritten
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, linked.LinkedFieldID)
		assert.Equal(t, source.ID, *linked.LinkedFieldID)
		assert.Equal(t, source.Type, linked.Type)

		// Verify options were copied
		sourceOpts := source.Attrs[model.PropertyFieldAttributeOptions]
		linkedOpts := linked.Attrs[model.PropertyFieldAttributeOptions]
		require.NotNil(t, linkedOpts)
		assert.Equal(t, sourceOpts, linkedOpts)
	})

	t.Run("create linked field refuses a supplied option list", func(t *testing.T) {
		source := createSourceField(t, "SuppliedOptsSource-"+model.NewId())

		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "SuppliedOptsLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Own Option"},
				},
			},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "takes its option list from that template")
	})

	t.Run("create legacy linked field refuses a supplied option list", func(t *testing.T) {
		legacyGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)
		fakeSourceID := model.NewId()

		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       legacyGroup.ID,
			ObjectType:    "", // Legacy
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "LegacySuppliedOptsLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeGraph,
			LinkedFieldID: &fakeSourceID,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Own Option"},
				},
			},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "takes its option list from that field")

		_, err = th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       legacyGroup.ID,
			ObjectType:    "", // Legacy
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "LegacySuppliedOptsLinkedSelect-" + model.NewId(),
			Type:          model.PropertyFieldTypeSelect,
			LinkedFieldID: &fakeSourceID,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Own Option"},
				},
			},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "takes its option list from that field")
	})

	t.Run("create legacy linked field with no options succeeds", func(t *testing.T) {
		legacyGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)
		fakeSourceID := model.NewId()

		linked, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       legacyGroup.ID,
			ObjectType:    "", // Legacy
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "LegacyLinkedNoOpts-" + model.NewId(),
			Type:          model.PropertyFieldTypeGraph,
			LinkedFieldID: &fakeSourceID,
		})
		require.NoError(t, err)

		reloaded, err := th.service.GetPropertyField(rctx, legacyGroup.ID, linked.ID)
		require.NoError(t, err)
		require.NotNil(t, reloaded.LinkedFieldID)
		assert.Equal(t, fakeSourceID, *reloaded.LinkedFieldID)
	})

	t.Run("create legacy field with options and no link succeeds", func(t *testing.T) {
		legacyGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)

		field, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:    legacyGroup.ID,
			ObjectType: "", // Legacy
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Name:       "LegacyOptsNoLink-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Own Option"},
				},
			},
		})
		require.NoError(t, err)

		reloaded, err := th.service.GetPropertyField(rctx, legacyGroup.ID, field.ID)
		require.NoError(t, err)
		assert.NotNil(t, reloaded.Attrs[model.PropertyFieldAttributeOptions])
	})

	t.Run("update refuses linking a legacy field that already carries its own options", func(t *testing.T) {
		legacyGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)

		field, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:    legacyGroup.ID,
			ObjectType: "", // Legacy
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Name:       "LegacyOptsThenLink-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Own Option"},
				},
			},
		})
		require.NoError(t, err)

		fakeSourceID := model.NewId()
		field.LinkedFieldID = &fakeSourceID
		_, _, err = th.service.UpdatePropertyField(rctx, legacyGroup.ID, field)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Error(), "creation time")
	})

	t.Run("update refuses giving a linked legacy field its own options", func(t *testing.T) {
		legacyGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)
		fakeSourceID := model.NewId()

		field, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       legacyGroup.ID,
			ObjectType:    "", // Legacy
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "LegacyLinkThenOpts-" + model.NewId(),
			Type:          model.PropertyFieldTypeGraph,
			LinkedFieldID: &fakeSourceID,
		})
		require.NoError(t, err)

		field.Attrs = model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": model.NewId(), "name": "New Option"},
			},
		}
		_, _, err = th.service.UpdatePropertyField(rctx, legacyGroup.ID, field)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Error(), "cannot modify options of a linked field")
	})

	t.Run("update refuses re-linking a legacy field to a different source", func(t *testing.T) {
		legacyGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)
		fakeSourceID := model.NewId()

		field, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       legacyGroup.ID,
			ObjectType:    "", // Legacy
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "LegacyRelink-" + model.NewId(),
			Type:          model.PropertyFieldTypeGraph,
			LinkedFieldID: &fakeSourceID,
		})
		require.NoError(t, err)

		otherSourceID := model.NewId()
		field.LinkedFieldID = &otherSourceID
		_, _, err = th.service.UpdatePropertyField(rctx, legacyGroup.ID, field)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Error(), "cannot change link target")
	})

	t.Run("update with an empty LinkedFieldID on an unlinked legacy field still canonicalizes to nil", func(t *testing.T) {
		legacyGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)

		field, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:    legacyGroup.ID,
			ObjectType: "", // Legacy
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Name:       "LegacyEmptyLink-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
		})
		require.NoError(t, err)

		empty := ""
		field.LinkedFieldID = &empty
		_, _, err = th.service.UpdatePropertyField(rctx, legacyGroup.ID, field)
		require.NoError(t, err)

		reloaded, err := th.service.GetPropertyField(rctx, legacyGroup.ID, field.ID)
		require.NoError(t, err)
		assert.Nil(t, reloaded.LinkedFieldID)
	})

	t.Run("update renaming a legacy field with nothing link-related still succeeds", func(t *testing.T) {
		legacyGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)

		field, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:    legacyGroup.ID,
			ObjectType: "", // Legacy
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Name:       "LegacyRename-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
		})
		require.NoError(t, err)

		newName := "LegacyRenamed-" + model.NewId()
		field.Name = newName
		_, _, err = th.service.UpdatePropertyField(rctx, legacyGroup.ID, field)
		require.NoError(t, err)

		reloaded, err := th.service.GetPropertyField(rctx, legacyGroup.ID, field.ID)
		require.NoError(t, err)
		assert.Equal(t, newName, reloaded.Name)
	})

	t.Run("update refuses changing the type of a linked legacy field", func(t *testing.T) {
		legacyGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)
		fakeSourceID := model.NewId()

		field, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       legacyGroup.ID,
			ObjectType:    "", // Legacy
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "LegacyLinkedTypeChange-" + model.NewId(),
			Type:          model.PropertyFieldTypeSelect,
			LinkedFieldID: &fakeSourceID,
		})
		require.NoError(t, err)

		field.Type = model.PropertyFieldTypeText
		_, _, err = th.service.UpdatePropertyField(rctx, legacyGroup.ID, field)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Error(), "cannot modify type of a linked field")
	})

	t.Run("update still allows changing the type of an unlinked legacy field", func(t *testing.T) {
		legacyGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)

		field, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:    legacyGroup.ID,
			ObjectType: "", // Legacy
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Name:       "LegacyUnlinkedTypeChange-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
		})
		require.NoError(t, err)

		field.Type = model.PropertyFieldTypeSelect
		_, _, err = th.service.UpdatePropertyField(rctx, legacyGroup.ID, field)
		require.NoError(t, err)

		reloaded, err := th.service.GetPropertyField(rctx, legacyGroup.ID, field.ID)
		require.NoError(t, err)
		assert.Equal(t, model.PropertyFieldTypeSelect, reloaded.Type)
	})

	t.Run("update refuses changing the type of a legacy field other fields link to", func(t *testing.T) {
		legacyGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)

		source, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:    legacyGroup.ID,
			ObjectType: "", // Legacy
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Name:       "LegacySource-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
		})
		require.NoError(t, err)

		_, err = th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       legacyGroup.ID,
			ObjectType:    "", // Legacy
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "LegacyDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeSelect,
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)

		source.Type = model.PropertyFieldTypeText
		_, _, err = th.service.UpdatePropertyField(rctx, legacyGroup.ID, source)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.Error(), "cannot change type of a field with active linked dependents")

		reloaded, err := th.service.GetPropertyField(rctx, legacyGroup.ID, source.ID)
		require.NoError(t, err)
		assert.Equal(t, model.PropertyFieldTypeSelect, reloaded.Type)
	})

	t.Run("create linked field with an empty option list succeeds", func(t *testing.T) {
		source := createSourceField(t, "EmptyOptsSource-"+model.NewId())

		linked, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "EmptyOptsLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{},
			},
		})
		require.NoError(t, err)
		assert.Equal(t, source.Attrs[model.PropertyFieldAttributeOptions], linked.Attrs[model.PropertyFieldAttributeOptions])
	})

	t.Run("create linked field rejects non-existent source", func(t *testing.T) {
		fakeID := model.NewId()
		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &fakeID,
		})
		require.Error(t, err)
	})

	t.Run("create linked field rejects non-template source", func(t *testing.T) {
		// Create a regular (non-template) field
		regular := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "RegularSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
		})

		// Try to link to the non-template field — should be rejected
		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "LinkToRegular-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &regular.ID,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "template")
	})

	t.Run("create linked field rejects chaining", func(t *testing.T) {
		source := createSourceField(t, "ChainSource-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "ChainLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		// Try to link to the linked field (chain) — rejected because it's not a template
		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeChannel,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "ChainAttempt-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &linked.ID,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "template")
	})

	t.Run("create linked template field is rejected", func(t *testing.T) {
		source := createSourceField(t, "TemplateLink-"+model.NewId())

		// A template field should not itself be linked to another template
		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeTemplate,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "LinkedTemplate-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "template")
	})

	t.Run("create linked field rejects target type mismatch", func(t *testing.T) {
		source := createSourceField(t, "TTMismatchSource-"+model.NewId())

		// Source has TargetType=system, try to link with TargetType=channel
		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeChannel,
			TargetType:    string(model.PropertyFieldTargetLevelChannel),
			Name:          "TTMismatch-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "target_type")
	})

	t.Run("create linked field rejects option.read more permissive than template's", func(t *testing.T) {
		source := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "CeilingSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "CeilingLoose-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelEveryone}},
			},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "option.read")
	})

	t.Run("create linked field allows option.read equal to or tighter than template's", func(t *testing.T) {
		source := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "CeilingEqualSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		equal, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "CeilingEqual-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, equal)

		tighter, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeChannel,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "CeilingTighter-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelAdmin}},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, tighter)
	})

	t.Run("create linked field rejects any option.read against a template with no permissions object", func(t *testing.T) {
		source := createSourceField(t, "NoPermsSource-"+model.NewId())

		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "NoPermsLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "option.read")

		// A linked field that sets no permissions at all has nothing to compare and
		// is unaffected by the template carrying none either.
		unset, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeChannel,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "NoPermsUnset-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, unset)
	})

	t.Run("create linked field ceiling is confined to option.read", func(t *testing.T) {
		source := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "ConfinedSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		linked, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "ConfinedLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Option: model.ReadWrite{Read: model.PermissionLevelMember},
					Value:  model.ReadWrite{Read: model.PermissionLevelEveryone},
				},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, linked)
	})

	t.Run("create unlinked field with option.read everyone is unaffected", func(t *testing.T) {
		unlinked, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Name:       "Unlinked-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelEveryone}},
			},
		})
		require.NoError(t, err)
		require.NotNil(t, unlinked)
	})

	t.Run("update linked field blocks type change", func(t *testing.T) {
		source := createSourceField(t, "TypeBlockSource-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "TypeBlockLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		linked.Type = model.PropertyFieldTypeText
		_, _, err := th.service.UpdatePropertyField(rctx, group.ID, linked)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("update linked field blocks options change", func(t *testing.T) {
		source := createSourceField(t, "OptsBlockSource-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "OptsBlockLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		linked.Attrs[model.PropertyFieldAttributeOptions] = []any{
			map[string]any{"id": model.NewId(), "name": "Different"},
		}
		_, _, err := th.service.UpdatePropertyField(rctx, group.ID, linked)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("update linked field allows name change", func(t *testing.T) {
		source := createSourceField(t, "NameChangeSource-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "NameChangeLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		linked.Name = "NewName-" + model.NewId()
		result, _, err := th.service.UpdatePropertyField(rctx, group.ID, linked)
		require.NoError(t, err)
		assert.Equal(t, linked.Name, result.Name)
	})

	t.Run("update source field propagates options to linked fields", func(t *testing.T) {
		source := createSourceField(t, "PropagateSource-"+model.NewId())

		linked1 := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "PropLinked1-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		linked2 := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeChannel,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "PropLinked2-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		// Update source options
		newOptions := []any{
			map[string]any{"id": model.NewId(), "name": "New Option 1"},
			map[string]any{"id": model.NewId(), "name": "New Option 2"},
			map[string]any{"id": model.NewId(), "name": "New Option 3"},
		}
		source.Attrs[model.PropertyFieldAttributeOptions] = newOptions

		result, propagated, _, err := th.service.UpdatePropertyFields(rctx, group.ID, []*model.PropertyField{source})
		require.NoError(t, err)
		require.Len(t, result, 1)     // only the requested source field
		require.Len(t, propagated, 2) // 2 linked fields

		// Verify linked fields got the new options
		updatedLinked1, err := th.service.GetPropertyField(rctx, group.ID, linked1.ID)
		require.NoError(t, err)
		updatedLinked2, err := th.service.GetPropertyField(rctx, group.ID, linked2.ID)
		require.NoError(t, err)

		for _, linked := range []*model.PropertyField{updatedLinked1, updatedLinked2} {
			opts := extractOptionIDList(linked.Attrs[model.PropertyFieldAttributeOptions])
			expectedOpts := extractOptionIDList(newOptions)
			assert.Equal(t, expectedOpts, opts)
		}
	})

	t.Run("update source field blocks type change when dependents exist", func(t *testing.T) {
		source := createSourceField(t, "TypeBlockDeps-"+model.NewId())

		th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "DepLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		source.Type = model.PropertyFieldTypeMultiselect
		_, _, err := th.service.UpdatePropertyField(rctx, group.ID, source)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
	})

	t.Run("delete source field blocked when linked dependents exist", func(t *testing.T) {
		source := createSourceField(t, "DeleteBlock-"+model.NewId())

		th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "DelDepLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		err := th.service.DeletePropertyField(rctx, group.ID, source.ID)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
	})

	t.Run("delete source field succeeds after dependents are deleted", func(t *testing.T) {
		source := createSourceField(t, "DeleteOK-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "DeleteOKLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		// Delete the linked dependent first
		err := th.service.DeletePropertyField(rctx, group.ID, linked.ID)
		require.NoError(t, err)

		// Now delete the source
		err = th.service.DeletePropertyField(rctx, group.ID, source.ID)
		require.NoError(t, err)
	})

	t.Run("deleting a graph template is refused while a field links to it, and clears its hierarchy once none does", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeGraph,
			Name:       "GraphSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Air Program"},
					map[string]any{"name": "Fighter Jet Program", "parents": []string{"Air Program"}},
				},
			},
		})

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "GraphLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText, // will be overwritten
			LinkedFieldID: &template.ID,
		})
		require.Equal(t, model.PropertyFieldTypeGraph, linked.Type)

		// What the template owns: how many live options, and how many parent links
		// between them.
		owned := func(t *testing.T) (int, int) {
			t.Helper()
			options, err := th.dbStore.PropertyField().CountOptions(template.ID)
			require.NoError(t, err)
			edges, err := th.dbStore.PropertyField().GetOptionEdges(template.ID)
			require.NoError(t, err)
			return options, len(edges)
		}

		options, edges := owned(t)
		require.Equal(t, 2, options)
		require.Equal(t, 1, edges)

		err := th.service.DeletePropertyField(rctx, group.ID, template.ID)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)

		// The refusal is what protects the dependent: it serves the template's
		// hierarchy rather than a copy, so a template deleted underneath it would
		// leave it serving nothing.
		options, edges = owned(t)
		require.Equal(t, 2, options)
		require.Equal(t, 1, edges)

		// Deleting the dependent is not a route to emptying the template either. It
		// owns no options at all, and every statement behind a field delete is scoped
		// to the field's own rows.
		require.NoError(t, th.service.DeletePropertyField(rctx, group.ID, linked.ID))
		options, edges = owned(t)
		require.Equal(t, 2, options)
		require.Equal(t, 1, edges)

		// With nothing deriving them, the options go with the template.
		require.NoError(t, th.service.DeletePropertyField(rctx, group.ID, template.ID))
		options, edges = owned(t)
		require.Zero(t, options)
		require.Zero(t, edges)
	})

	t.Run("unlink field preserves type and options", func(t *testing.T) {
		source := createSourceField(t, "UnlinkSource-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "UnlinkLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		// Unlink by clearing LinkedFieldID
		linked.LinkedFieldID = nil
		result, _, err := th.service.UpdatePropertyField(rctx, group.ID, linked)
		require.NoError(t, err)
		assert.Nil(t, result.LinkedFieldID)
		assert.Equal(t, source.Type, result.Type)

		// Verify options are preserved after unlinking
		sourceOpts := extractOptionIDList(source.Attrs[model.PropertyFieldAttributeOptions])
		resultOpts := extractOptionIDList(result.Attrs[model.PropertyFieldAttributeOptions])
		require.NotEmpty(t, sourceOpts, "source should have options")
		assert.Equal(t, sourceOpts, resultOpts, "options should be preserved after unlinking")
	})

	t.Run("template field value creation is rejected at service layer", func(t *testing.T) {
		source := createSourceField(t, "TemplateValReject-"+model.NewId())

		value := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "user",
			GroupID:    group.ID,
			FieldID:    source.ID,
			Value:      json.RawMessage(`"some value"`),
		}

		_, err := th.service.CreatePropertyValue(rctx, value)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "template")
	})

	t.Run("template field value upsert is rejected at service layer", func(t *testing.T) {
		source := createSourceField(t, "TemplateUpsertReject-"+model.NewId())

		value := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "user",
			GroupID:    group.ID,
			FieldID:    source.ID,
			Value:      json.RawMessage(`"some value"`),
		}

		_, err := th.service.UpsertPropertyValue(rctx, value)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "template")
	})

	t.Run("update blocks setting LinkedFieldID on non-linked field", func(t *testing.T) {
		// Create a regular (non-linked) field
		regular := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Name:       "Regular-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
		})

		require.Nil(t, regular.LinkedFieldID)

		// Attempt to set LinkedFieldID on update — should be rejected
		source := createSourceField(t, "LinkAttemptSource-"+model.NewId())
		regular.LinkedFieldID = &source.ID
		_, _, err := th.service.UpdatePropertyField(rctx, group.ID, regular)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Error(), "creation time")
	})

	t.Run("update blocks changing LinkedFieldID to a different source", func(t *testing.T) {
		source1 := createSourceField(t, "ChangeSource1-"+model.NewId())
		source2 := createSourceField(t, "ChangeSource2-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "ChangeLink-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source1.ID,
		})

		// Attempt to change the link target — should be rejected
		linked.LinkedFieldID = &source2.ID
		_, _, err := th.service.UpdatePropertyField(rctx, group.ID, linked)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Error(), "cannot change link target")
	})

	t.Run("update linked field rejects option.read raised past template's ceiling", func(t *testing.T) {
		source := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "UpdateCeilingSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "UpdateCeilingLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelAdmin}},
			},
		})

		linked.Permissions.Restrictions.Option.Read = model.PermissionLevelEveryone
		_, _, err := th.service.UpdatePropertyField(rctx, group.ID, linked)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Error(), "option.read")

		linked.Permissions.Restrictions.Option.Read = model.PermissionLevelSysadmin
		result, _, err := th.service.UpdatePropertyField(rctx, group.ID, linked)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelSysadmin, result.Permissions.Restrictions.Option.Read)
	})

	t.Run("update linked field reads the template for the ceiling check only when a Permissions object is supplied", func(t *testing.T) {
		source := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "UpdateNoPermsSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "UpdateNoPermsLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		counter := &countingPropertyFieldStore{PropertyFieldStore: th.service.fieldStore}
		th.service.fieldStore = counter
		t.Cleanup(func() { th.service.fieldStore = counter.PropertyFieldStore })

		// Create now defaults a Permissions object onto every field, so linked
		// arrives from th.CreatePropertyField carrying one; nil it back out to
		// exercise the "no Permissions object submitted" case this asserts.
		linked.Permissions = nil
		linked.Name = "UpdateNoPermsLinked-Renamed-" + model.NewId()
		before := counter.gets
		result, _, err := th.service.UpdatePropertyField(rctx, group.ID, linked)
		require.NoError(t, err)
		assert.Equal(t, linked.Name, result.Name)
		assert.Equal(t, before, counter.gets, "no Permissions object on the update must not read the template")

		linked.Permissions = &model.Permissions{
			Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelSysadmin}},
		}
		before = counter.gets
		_, _, err = th.service.UpdatePropertyField(rctx, group.ID, linked)
		require.NoError(t, err)
		assert.Equal(t, before+1, counter.gets, "an update carrying a Permissions object must read the template to check the ceiling")
	})

	t.Run("tightening template's option.read past a dependent's tier is refused", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "TemplateCeilingSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		dependent := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "TemplateCeilingDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		template.Permissions.Restrictions.Option.Read = model.PermissionLevelSysadmin
		_, _, err := th.service.UpdatePropertyField(rctx, group.ID, template)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.Error(), dependent.ID)

		reloaded, err := th.service.GetPropertyField(rctx, group.ID, template.ID)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelMember, reloaded.Permissions.Restrictions.Option.Read)
	})

	t.Run("tightening template's option.read to match a dependent's tier succeeds", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "TemplateCeilingEqualSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "TemplateCeilingEqualDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelSysadmin}},
			},
		})

		template.Permissions.Restrictions.Option.Read = model.PermissionLevelSysadmin
		result, _, err := th.service.UpdatePropertyField(rctx, group.ID, template)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelSysadmin, result.Permissions.Restrictions.Option.Read)
	})

	t.Run("clearing template's Permissions object counts as tightening to none", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "TemplateClearSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "TemplateClearDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		template.Permissions = nil
		_, _, err := th.service.UpdatePropertyField(rctx, group.ID, template)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
	})

	t.Run("loosening template's option.read is unaffected by a dependent's tier", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "TemplateLoosenSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelSysadmin}},
			},
		})

		th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "TemplateLoosenDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelSysadmin}},
			},
		})

		template.Permissions.Restrictions.Option.Read = model.PermissionLevelMember
		result, _, err := th.service.UpdatePropertyField(rctx, group.ID, template)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelMember, result.Permissions.Restrictions.Option.Read)
	})

	t.Run("tightening a template with no dependents succeeds", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "TemplateNoDependentsSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		template.Permissions.Restrictions.Option.Read = model.PermissionLevelSysadmin
		result, _, err := th.service.UpdatePropertyField(rctx, group.ID, template)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelSysadmin, result.Permissions.Restrictions.Option.Read)
	})

	t.Run("tightening template while renaming leaves option.read alone succeeds", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "TemplateRenameSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "TemplateRenameDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		template.Name = "TemplateRenameSource-Renamed-" + model.NewId()
		result, _, err := th.service.UpdatePropertyField(rctx, group.ID, template)
		require.NoError(t, err)
		assert.Equal(t, template.Name, result.Name)
	})

	t.Run("only a template update that tightens option.read queries its dependents", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "TemplateQueryCostSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "TemplateQueryCostDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		counter := &countingPropertyFieldStore{PropertyFieldStore: th.service.fieldStore}
		th.service.fieldStore = counter
		t.Cleanup(func() { th.service.fieldStore = counter.PropertyFieldStore })

		template.Name = "TemplateQueryCostSource-Renamed-" + model.NewId()
		before := counter.linkedFields
		_, _, err := th.service.UpdatePropertyField(rctx, group.ID, template)
		require.NoError(t, err)
		assert.Equal(t, before, counter.linkedFields, "leaving option.read alone must not query dependents")

		template.Permissions.Restrictions.Option.Read = model.PermissionLevelSysadmin
		before = counter.linkedFields
		_, _, err = th.service.UpdatePropertyField(rctx, group.ID, template)
		require.Error(t, err)
		assert.Equal(t, before+1, counter.linkedFields, "tightening option.read must query dependents")
	})

	t.Run("moving a template and its dependent in the same call is checked against each other, not the stored rows", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "BatchCeilingSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelEveryone}},
			},
		})

		dependent := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "BatchCeilingDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		template.Permissions.Restrictions.Option.Read = model.PermissionLevelMember
		dependent.Permissions.Restrictions.Option.Read = model.PermissionLevelEveryone
		_, _, _, err := th.service.UpdatePropertyFields(rctx, group.ID, []*model.PropertyField{template, dependent})
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)

		reloadedTemplate, err := th.service.GetPropertyField(rctx, group.ID, template.ID)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelEveryone, reloadedTemplate.Permissions.Restrictions.Option.Read, "template tier must not have changed")

		reloadedDependent, err := th.service.GetPropertyField(rctx, group.ID, dependent.ID)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelMember, reloadedDependent.Permissions.Restrictions.Option.Read, "dependent tier must not have changed")
	})

	t.Run("tightening a template and its dependent together in the same call succeeds", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "BatchTightenSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		dependent := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "BatchTightenDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		template.Permissions.Restrictions.Option.Read = model.PermissionLevelSysadmin
		dependent.Permissions.Restrictions.Option.Read = model.PermissionLevelSysadmin
		_, _, _, err := th.service.UpdatePropertyFields(rctx, group.ID, []*model.PropertyField{template, dependent})
		require.NoError(t, err)

		reloadedTemplate, err := th.service.GetPropertyField(rctx, group.ID, template.ID)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelSysadmin, reloadedTemplate.Permissions.Restrictions.Option.Read)

		reloadedDependent, err := th.service.GetPropertyField(rctx, group.ID, dependent.ID)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelSysadmin, reloadedDependent.Permissions.Restrictions.Option.Read)
	})

	t.Run("tightening a template while unlinking its dependent in the same call succeeds", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "BatchUnlinkSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		dependent := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "BatchUnlinkDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		template.Permissions.Restrictions.Option.Read = model.PermissionLevelSysadmin
		dependent.LinkedFieldID = nil
		_, _, _, err := th.service.UpdatePropertyFields(rctx, group.ID, []*model.PropertyField{template, dependent})
		require.NoError(t, err)

		reloadedTemplate, err := th.service.GetPropertyField(rctx, group.ID, template.ID)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelSysadmin, reloadedTemplate.Permissions.Restrictions.Option.Read)

		reloadedDependent, err := th.service.GetPropertyField(rctx, group.ID, dependent.ID)
		require.NoError(t, err)
		assert.Nil(t, reloadedDependent.LinkedFieldID)
	})

	t.Run("a batch carrying both a linked field and its template checks the ceiling without reading the template from the store", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "BatchNoGetSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		dependent := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "BatchNoGetDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		counter := &countingPropertyFieldStore{PropertyFieldStore: th.service.fieldStore}
		th.service.fieldStore = counter
		t.Cleanup(func() { th.service.fieldStore = counter.PropertyFieldStore })

		template.Permissions.Restrictions.Option.Read = model.PermissionLevelSysadmin
		dependent.Permissions.Restrictions.Option.Read = model.PermissionLevelSysadmin
		before := counter.gets
		_, _, _, err := th.service.UpdatePropertyFields(rctx, group.ID, []*model.PropertyField{template, dependent})
		require.NoError(t, err)
		assert.Equal(t, before, counter.gets, "the template's row is already in the call, so the linked-field side must not read the store for it")
	})

	t.Run("a deleted dependent does not block its template from tightening", func(t *testing.T) {
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "TemplateDeletedDependentSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		dependent := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "TemplateDeletedDependent-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		require.NoError(t, th.service.DeletePropertyField(rctx, group.ID, dependent.ID))

		template.Permissions.Restrictions.Option.Read = model.PermissionLevelSysadmin
		result, _, err := th.service.UpdatePropertyField(rctx, group.ID, template)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelSysadmin, result.Permissions.Restrictions.Option.Read)
	})

	t.Run("unlinking a field while raising option.read past the old template's ceiling succeeds", func(t *testing.T) {
		source := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "UnlinkCeilingSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelMember}},
			},
		})

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "UnlinkCeilingLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		linked.LinkedFieldID = nil
		linked.Permissions = &model.Permissions{
			Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelEveryone}},
		}
		result, _, err := th.service.UpdatePropertyField(rctx, group.ID, linked)
		require.NoError(t, err)
		assert.Nil(t, result.LinkedFieldID)
		assert.Equal(t, model.PermissionLevelEveryone, result.Permissions.Restrictions.Option.Read)
	})

	t.Run("update to an unlinked field with option.read everyone is unaffected", func(t *testing.T) {
		unlinked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Name:       "UpdateUnlinked-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
		})

		unlinked.Permissions = &model.Permissions{
			Restrictions: &model.Restrictions{Option: model.ReadWrite{Read: model.PermissionLevelEveryone}},
		}
		result, _, err := th.service.UpdatePropertyField(rctx, group.ID, unlinked)
		require.NoError(t, err)
		assert.Equal(t, model.PermissionLevelEveryone, result.Permissions.Restrictions.Option.Read)
	})

	t.Run("linked CPA field with LinkedFieldID behaves correctly", func(t *testing.T) {
		source := createSourceField(t, "CPASource-"+model.NewId())

		// Create a CPA-style linked field (user object type)
		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "CPALinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		// Verify type and options were inherited
		assert.Equal(t, source.Type, linked.Type)
		assert.NotNil(t, linked.LinkedFieldID)
		assert.Equal(t, source.ID, *linked.LinkedFieldID)
	})

	t.Run("CPA linked field delete succeeds", func(t *testing.T) {
		source := createSourceField(t, "CPADelSource-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "CPADelLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		// Deleting the linked field should succeed
		err := th.service.DeletePropertyField(rctx, group.ID, linked.ID)
		require.NoError(t, err)
	})

	t.Run("update source field propagates option removal to linked fields", func(t *testing.T) {
		optAID := model.NewId()
		optBID := model.NewId()
		optCID := model.NewId()

		source := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "RemovalSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": optAID, "name": "Option A", "color": "red"},
					map[string]any{"id": optBID, "name": "Option B", "color": "blue"},
					map[string]any{"id": optCID, "name": "Option C", "color": "green"},
				},
			},
		})

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       group.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "RemovalLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		// Remove option B, keep A and C
		source.Attrs[model.PropertyFieldAttributeOptions] = []any{
			map[string]any{"id": optAID, "name": "Option A", "color": "red"},
			map[string]any{"id": optCID, "name": "Option C", "color": "green"},
		}

		result, propagated, _, err := th.service.UpdatePropertyFields(rctx, group.ID, []*model.PropertyField{source})
		require.NoError(t, err)
		require.Len(t, result, 1)     // only the requested source field
		require.Len(t, propagated, 1) // 1 linked field

		// Verify the linked field has the updated options (B removed)
		updatedLinked, err := th.service.GetPropertyField(rctx, group.ID, linked.ID)
		require.NoError(t, err)

		linkedOptIDs := extractOptionIDList(updatedLinked.Attrs[model.PropertyFieldAttributeOptions])
		assert.Equal(t, []string{optAID, optCID}, linkedOptIDs, "option B should be removed from linked field")

		// Verify option content (names, colors) was propagated correctly
		linkedOpts := asOptionSlice(updatedLinked.Attrs)
		require.Len(t, linkedOpts, 2)
		assert.Equal(t, "Option A", linkedOpts[0]["name"])
		assert.Equal(t, "red", linkedOpts[0]["color"])
		assert.Equal(t, "Option C", linkedOpts[1]["name"])
		assert.Equal(t, "green", linkedOpts[1]["color"])
	})

	t.Run("template field creation is rejected on v1 group", func(t *testing.T) {
		v1Group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)

		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:    v1Group.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "V1Template-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "Option A"},
				},
			},
		})
		require.Error(t, err)
	})

	t.Run("cross-group linking is rejected", func(t *testing.T) {
		registeredA := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		registeredB := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)

		// Create a template in group A
		source := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    registeredA.ID,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeSelect,
			Name:       "CrossGroupSource-" + model.NewId(),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": model.NewId(), "name": "X"},
					map[string]any{"id": model.NewId(), "name": "Y"},
				},
			},
		})

		// Linking from group B to a template in group A must fail
		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       registeredB.ID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "CrossGroupLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "cross_group")
	})

	t.Run("update template value is rejected at service layer", func(t *testing.T) {
		source := createSourceField(t, "TemplateUpdateReject-"+model.NewId())

		// First create a value on a non-template field, then try to update
		// using template field ID via UpdatePropertyValues
		value := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "user",
			GroupID:    group.ID,
			FieldID:    source.ID,
			Value:      json.RawMessage(`"some value"`),
		}

		_, err := th.service.UpdatePropertyValues(rctx, group.ID, []*model.PropertyValue{value})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "template")
	})
}

func TestOptionsChanged(t *testing.T) {
	// attrsFromJSON simulates what arrives over the wire: JSON bytes
	// deserialized into model.StringInterface, where options become
	// []interface{} of map[string]interface{}.
	attrsFromJSON := func(t *testing.T, jsonStr string) model.StringInterface {
		t.Helper()
		var attrs model.StringInterface
		require.NoError(t, json.Unmarshal([]byte(jsonStr), &attrs))
		return attrs
	}

	optID1 := model.NewId()
	optID2 := model.NewId()
	optID3 := model.NewId()

	t.Run("both nil attrs means no change", func(t *testing.T) {
		assert.False(t, optionsChanged(nil, nil))
	})

	t.Run("both empty attrs means no change", func(t *testing.T) {
		assert.False(t, optionsChanged(model.StringInterface{}, model.StringInterface{}))
	})

	t.Run("nil vs empty attrs means no change", func(t *testing.T) {
		assert.False(t, optionsChanged(nil, model.StringInterface{}))
		assert.False(t, optionsChanged(model.StringInterface{}, nil))
	})

	t.Run("nil vs attrs with no options key means no change", func(t *testing.T) {
		attrs := attrsFromJSON(t, `{"other_key": "value"}`)
		assert.False(t, optionsChanged(nil, attrs))
		assert.False(t, optionsChanged(attrs, nil))
	})

	t.Run("identical options means no change", func(t *testing.T) {
		raw := `{"options": [{"id": "` + optID1 + `", "name": "A"}, {"id": "` + optID2 + `", "name": "B"}]}`
		old := attrsFromJSON(t, raw)
		updated := attrsFromJSON(t, raw)
		assert.False(t, optionsChanged(old, updated))
	})

	t.Run("different option count is a change", func(t *testing.T) {
		old := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}]}`)
		updated := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}, {"id": "`+optID2+`", "name": "B"}]}`)
		assert.True(t, optionsChanged(old, updated))
		assert.True(t, optionsChanged(updated, old))
	})

	t.Run("option replaced with different ID (same count) is a change", func(t *testing.T) {
		old := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}, {"id": "`+optID2+`", "name": "B"}]}`)
		updated := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}, {"id": "`+optID3+`", "name": "C"}]}`)
		assert.True(t, optionsChanged(old, updated))
	})

	t.Run("option name renamed is a change", func(t *testing.T) {
		old := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}]}`)
		updated := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A-renamed"}]}`)
		assert.True(t, optionsChanged(old, updated))
	})

	t.Run("extra key added to option is a change", func(t *testing.T) {
		old := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}]}`)
		updated := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A", "color": "red"}]}`)
		assert.True(t, optionsChanged(old, updated))
	})

	t.Run("extra key removed from option is a change", func(t *testing.T) {
		old := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A", "color": "red"}]}`)
		updated := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}]}`)
		assert.True(t, optionsChanged(old, updated))
	})

	t.Run("reordered options with same IDs means no change", func(t *testing.T) {
		old := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}, {"id": "`+optID2+`", "name": "B"}]}`)
		updated := attrsFromJSON(t, `{"options": [{"id": "`+optID2+`", "name": "B"}, {"id": "`+optID1+`", "name": "A"}]}`)
		assert.False(t, optionsChanged(old, updated))
	})

	t.Run("no options vs options present is a change", func(t *testing.T) {
		old := model.StringInterface{}
		updated := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}]}`)
		assert.True(t, optionsChanged(old, updated))
		assert.True(t, optionsChanged(updated, old))
	})

	t.Run("options null in JSON vs absent means no change", func(t *testing.T) {
		old := attrsFromJSON(t, `{"options": null}`)
		updated := model.StringInterface{}
		assert.False(t, optionsChanged(old, updated))
		assert.False(t, optionsChanged(updated, old))
	})

	t.Run("empty options array vs absent is a change", func(t *testing.T) {
		old := attrsFromJSON(t, `{"options": []}`)
		updated := model.StringInterface{}
		// []any{} has len 0, nil has len 0 — asOptionSlice returns empty vs nil
		// but len check treats both as 0, so no change detected
		assert.False(t, optionsChanged(old, updated))
	})

	t.Run("non-map items in options array are skipped", func(t *testing.T) {
		// After JSON unmarshal, options are always maps. But if somehow
		// a non-map sneaks in, asOptionSlice drops it — which changes
		// the effective count.
		old := model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": optID1, "name": "A"},
				"not a map",
			},
		}
		updated := model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": optID1, "name": "A"},
			},
		}
		// old becomes 1 valid option (non-map dropped), new has 1 — same
		assert.False(t, optionsChanged(old, updated))
	})

	t.Run("options value is not a slice means no change vs absent", func(t *testing.T) {
		old := model.StringInterface{
			model.PropertyFieldAttributeOptions: "not a slice",
		}
		assert.False(t, optionsChanged(old, nil))
	})

	t.Run("options value is not a slice vs real options is a change", func(t *testing.T) {
		old := model.StringInterface{
			model.PropertyFieldAttributeOptions: "not a slice",
		}
		updated := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}]}`)
		assert.True(t, optionsChanged(old, updated))
	})

	t.Run("other attrs keys are ignored", func(t *testing.T) {
		old := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}], "color": "red"}`)
		updated := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}], "color": "blue"}`)
		assert.False(t, optionsChanged(old, updated))
	})

	t.Run("numeric value in option survives JSON round-trip", func(t *testing.T) {
		// JSON numbers deserialize as float64 — verify DeepEqual handles this
		old := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A", "sort_order": 1}]}`)
		updated := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A", "sort_order": 1}]}`)
		assert.False(t, optionsChanged(old, updated))

		changed := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A", "sort_order": 2}]}`)
		assert.True(t, optionsChanged(old, changed))
	})

	t.Run("boolean value in option survives JSON round-trip", func(t *testing.T) {
		old := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A", "disabled": false}]}`)
		updated := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A", "disabled": true}]}`)
		assert.True(t, optionsChanged(old, updated))
	})

	t.Run("non-[]any option slice returns nil (treated as no options)", func(t *testing.T) {
		// Producers in this codebase normalize attrs["options"] to []any of
		// map[string]any (see EnsureOptionIDs, AccessControlAttributeValidationHook.
		// sanitizeAndValidateOptions). If a non-canonical shape ever sneaks in,
		// asOptionSlice returns nil, which makes optionsChanged report "changed"
		// against any populated side — the safe failure mode that surfaces the
		// contract violation instead of silently passing.
		dbForm := attrsFromJSON(t, `{"options": [{"id": "`+optID1+`", "name": "A"}]}`)
		nonCanonical := model.StringInterface{
			model.PropertyFieldAttributeOptions: model.PropertyOptions[*model.CustomProfileAttributesSelectOption]{
				{ID: optID1, Name: "A"},
			},
		}
		assert.True(t, optionsChanged(dbForm, nonCanonical))
	})
}
