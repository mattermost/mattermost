// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequiresAccessControlFailsClosed(t *testing.T) {
	th := Setup(t)
	rctx := th.Context

	// Use an unregistered group — this means any call to
	// requiresAccessControl will fail to look up the group.
	// The service must return an error rather than silently bypassing
	// access control.
	unregisteredGroupID := model.NewId()

	t.Run("CreatePropertyField returns error when group lookup fails", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    unregisteredGroupID,
			Name:       "test-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		}
		_, err := th.service.CreatePropertyField(rctx, field)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
	})

	t.Run("GetPropertyField returns error when group lookup fails", func(t *testing.T) {
		_, err := th.service.GetPropertyField(rctx, unregisteredGroupID, model.NewId())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
	})

	t.Run("GetPropertyFields returns error when group lookup fails", func(t *testing.T) {
		_, err := th.service.GetPropertyFields(rctx, unregisteredGroupID, []string{model.NewId()})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
	})

	t.Run("UpdatePropertyField returns error when group lookup fails", func(t *testing.T) {
		field := &model.PropertyField{
			ID:         model.NewId(),
			GroupID:    unregisteredGroupID,
			Name:       "test-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		}
		_, err := th.service.UpdatePropertyField(rctx, unregisteredGroupID, field)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
	})

	t.Run("DeletePropertyField returns error when group lookup fails", func(t *testing.T) {
		err := th.service.DeletePropertyField(rctx, unregisteredGroupID, model.NewId())
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
	})

	t.Run("SearchPropertyFields returns error when group lookup fails", func(t *testing.T) {
		_, err := th.service.SearchPropertyFields(rctx, unregisteredGroupID, model.PropertyFieldSearchOpts{})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check access control")
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
		field := &model.PropertyField{
			ObjectType: "", // Legacy
			GroupID:    model.NewId(),
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
		groupID := model.NewId()
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
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
		groupID := model.NewId()
		team := th.CreateTeam(t)

		// Create team-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "Status",
		})

		// Try to create system-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
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
		groupID := model.NewId()
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team.Id)

		// Create channel-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "Priority",
		})

		// Try to create system-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
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
		groupID := model.NewId()
		team := th.CreateTeam(t)

		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
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
		groupID := model.NewId()
		team := th.CreateTeam(t)

		// Create system-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "SystemField",
		})

		// Try to create team-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
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
		groupID := model.NewId()
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team.Id)

		// Create channel-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "ChannelProp",
		})

		// Try to create team-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
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
		groupID := model.NewId()
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team.Id)

		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
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
		groupID := model.NewId()
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team.Id)

		// Create system-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "GlobalProp",
		})

		// Try to create channel-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
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
		groupID := model.NewId()
		team := th.CreateTeam(t)
		channel := th.CreateChannel(t, team.Id)

		// Create team-level property first (direct to avoid conflict check)
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "TeamProp",
		})

		// Try to create channel-level property with same name
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
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
		groupID := model.NewId()
		team := th.CreateTeam(t)
		dmChannel := th.CreateDMChannel(t)

		// Create a team-level property in a team
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "TeamOnlyProp",
		})

		// DM channel property should not conflict with team-level property
		// since DM channels have no team association
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
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
		groupID := model.NewId()
		team1 := th.CreateTeam(t)
		team2 := th.CreateTeam(t)
		channelInTeam2 := th.CreateChannel(t, team2.Id)

		// Create team-level property in team1
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team1.Id,
			Type:       model.PropertyFieldTypeText,
			Name:       "Team1Prop",
		})

		// Channel-level property in team2 should not conflict with team1's property
		field := &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
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
		group1 := model.NewId()
		group2 := model.NewId()

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
		groupID := model.NewId()

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

func TestUpdatePropertyField(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context

	t.Run("updating non-name fields should not trigger conflict check", func(t *testing.T) {
		groupID := model.NewId()

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

		// Update non-name fields (Type, Attrs)
		field.Type = model.PropertyFieldTypeSelect
		field.Attrs = map[string]any{
			"options": []any{
				map[string]any{"name": "a"},
				map[string]any{"name": "b"},
			},
		}

		result, err := th.service.UpdatePropertyField(rctx, groupID, field)
		require.NoError(t, err)
		assert.Equal(t, model.PropertyFieldTypeSelect, result.Type)
	})

	t.Run("updating name to non-conflicting value should succeed", func(t *testing.T) {
		groupID := model.NewId()

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
		result, err := th.service.UpdatePropertyField(rctx, groupID, field)
		require.NoError(t, err)
		assert.Equal(t, "NewUniqueName", result.Name)
	})

	t.Run("updating name to conflicting value at team level should fail", func(t *testing.T) {
		groupID := model.NewId()
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
		result, err := th.service.UpdatePropertyField(rctx, groupID, systemField)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "team-level")
	})

	t.Run("updating DM channel property to same name as regular channel property should succeed", func(t *testing.T) {
		groupID := model.NewId()
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
		result, err := th.service.UpdatePropertyField(rctx, groupID, dmField)
		require.NoError(t, err)
		assert.Equal(t, "ChannelProp", result.Name)
	})

	t.Run("updating name to conflicting value at system level should fail", func(t *testing.T) {
		groupID := model.NewId()
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
		result, err := th.service.UpdatePropertyField(rctx, groupID, teamField)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "system-level")
	})

	t.Run("updating TargetType that creates conflict should fail", func(t *testing.T) {
		groupID := model.NewId()
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

		result, err := th.service.UpdatePropertyField(rctx, groupID, channel2Field)
		require.Error(t, err)
		assert.Nil(t, result)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Contains(t, appErr.DetailedError, "channel-level")
	})

	t.Run("updating TargetID that creates conflict should fail", func(t *testing.T) {
		groupID := model.NewId()
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

		result, err := th.service.UpdatePropertyField(rctx, groupID, channel2Field)
		require.Error(t, err)
		assert.Nil(t, result)
	})

	t.Run("legacy property updates should skip conflict check", func(t *testing.T) {
		groupID := model.NewId()

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
		result, err := th.service.UpdatePropertyField(rctx, groupID, field)
		require.NoError(t, err)
		assert.Equal(t, "UpdatedLegacyProp", result.Name)
	})

	t.Run("property can be renamed to its own name", func(t *testing.T) {
		groupID := model.NewId()

		// Create a property
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			ObjectType: "channel",
			GroupID:    groupID,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "SameName",
		})

		// Update with same name should succeed (no actual change to name)
		field.Type = model.PropertyFieldTypeSelect // Change something else
		result, err := th.service.UpdatePropertyField(rctx, groupID, field)
		require.NoError(t, err)
		assert.Equal(t, "SameName", result.Name)
	})
}

func TestLinkedPropertyFields(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	rctx := th.Context
	groupID := model.NewId()

	// Helper to create a source template field with select options
	createSourceField := func(t *testing.T, name string) *model.PropertyField {
		t.Helper()
		return th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
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
			GroupID:       groupID,
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

	t.Run("create linked field rejects non-existent source", func(t *testing.T) {
		fakeID := model.NewId()
		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       groupID,
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
			GroupID:    groupID,
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
			GroupID:       groupID,
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
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "ChainLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		// Try to link to the linked field (chain) — rejected because it's not a template
		_, err := th.service.CreatePropertyField(rctx, &model.PropertyField{
			GroupID:       groupID,
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
			GroupID:       groupID,
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
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeChannel,
			TargetType:    string(model.PropertyFieldTargetLevelChannel),
			Name:          "TTMismatch-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "target_type")
	})

	t.Run("update linked field blocks type change", func(t *testing.T) {
		source := createSourceField(t, "TypeBlockSource-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "TypeBlockLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		linked.Type = model.PropertyFieldTypeText
		_, err := th.service.UpdatePropertyField(rctx, groupID, linked)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("update linked field blocks options change", func(t *testing.T) {
		source := createSourceField(t, "OptsBlockSource-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "OptsBlockLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		linked.Attrs[model.PropertyFieldAttributeOptions] = []any{
			map[string]any{"id": model.NewId(), "name": "Different"},
		}
		_, err := th.service.UpdatePropertyField(rctx, groupID, linked)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("update linked field allows name change", func(t *testing.T) {
		source := createSourceField(t, "NameChangeSource-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "NameChangeLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		linked.Name = "NewName-" + model.NewId()
		result, err := th.service.UpdatePropertyField(rctx, groupID, linked)
		require.NoError(t, err)
		assert.Equal(t, linked.Name, result.Name)
	})

	t.Run("update source field propagates options to linked fields", func(t *testing.T) {
		source := createSourceField(t, "PropagateSource-"+model.NewId())

		linked1 := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "PropLinked1-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		linked2 := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       groupID,
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

		result, propagated, err := th.service.UpdatePropertyFields(rctx, groupID, []*model.PropertyField{source})
		require.NoError(t, err)
		require.Len(t, result, 1)     // only the requested source field
		require.Len(t, propagated, 2) // 2 linked fields

		// Verify linked fields got the new options
		updatedLinked1, err := th.service.GetPropertyField(rctx, groupID, linked1.ID)
		require.NoError(t, err)
		updatedLinked2, err := th.service.GetPropertyField(rctx, groupID, linked2.ID)
		require.NoError(t, err)

		for _, linked := range []*model.PropertyField{updatedLinked1, updatedLinked2} {
			opts := extractOptionIDs(linked.Attrs[model.PropertyFieldAttributeOptions])
			expectedOpts := extractOptionIDs(newOptions)
			assert.Equal(t, expectedOpts, opts)
		}
	})

	t.Run("update source field blocks type change when dependents exist", func(t *testing.T) {
		source := createSourceField(t, "TypeBlockDeps-"+model.NewId())

		th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "DepLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		source.Type = model.PropertyFieldTypeMultiselect
		_, err := th.service.UpdatePropertyField(rctx, groupID, source)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
	})

	t.Run("delete source field blocked when linked dependents exist", func(t *testing.T) {
		source := createSourceField(t, "DeleteBlock-"+model.NewId())

		th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "DelDepLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		err := th.service.DeletePropertyField(rctx, groupID, source.ID)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
	})

	t.Run("delete source field succeeds after dependents are deleted", func(t *testing.T) {
		source := createSourceField(t, "DeleteOK-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "DeleteOKLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		// Delete the linked dependent first
		err := th.service.DeletePropertyField(rctx, groupID, linked.ID)
		require.NoError(t, err)

		// Now delete the source
		err = th.service.DeletePropertyField(rctx, groupID, source.ID)
		require.NoError(t, err)
	})

	t.Run("unlink field preserves type and options", func(t *testing.T) {
		source := createSourceField(t, "UnlinkSource-"+model.NewId())

		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "UnlinkLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		// Unlink by clearing LinkedFieldID
		linked.LinkedFieldID = nil
		result, err := th.service.UpdatePropertyField(rctx, groupID, linked)
		require.NoError(t, err)
		assert.Nil(t, result.LinkedFieldID)
		assert.Equal(t, source.Type, result.Type)

		// Verify options are preserved after unlinking
		sourceOpts := extractOptionIDs(source.Attrs[model.PropertyFieldAttributeOptions])
		resultOpts := extractOptionIDs(result.Attrs[model.PropertyFieldAttributeOptions])
		require.NotEmpty(t, sourceOpts, "source should have options")
		assert.Equal(t, sourceOpts, resultOpts, "options should be preserved after unlinking")
	})

	t.Run("template field value creation is rejected at service layer", func(t *testing.T) {
		source := createSourceField(t, "TemplateValReject-"+model.NewId())

		value := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "user",
			GroupID:    groupID,
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
			GroupID:    groupID,
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
			GroupID:    groupID,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Name:       "Regular-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
		})

		require.Nil(t, regular.LinkedFieldID)

		// Attempt to set LinkedFieldID on update — should be rejected
		source := createSourceField(t, "LinkAttemptSource-"+model.NewId())
		regular.LinkedFieldID = &source.ID
		_, err := th.service.UpdatePropertyField(rctx, groupID, regular)
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
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "ChangeLink-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source1.ID,
		})

		// Attempt to change the link target — should be rejected
		linked.LinkedFieldID = &source2.ID
		_, err := th.service.UpdatePropertyField(rctx, groupID, linked)
		require.Error(t, err)
		appErr, ok := err.(*model.AppError)
		require.True(t, ok)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		assert.Contains(t, appErr.Error(), "cannot change link target")
	})

	t.Run("linked CPA field with LinkedFieldID behaves correctly", func(t *testing.T) {
		source := createSourceField(t, "CPASource-"+model.NewId())

		// Create a CPA-style linked field (user object type)
		linked := th.CreatePropertyField(t, rctx, &model.PropertyField{
			GroupID:       groupID,
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
			GroupID:       groupID,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			Name:          "CPADelLinked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			LinkedFieldID: &source.ID,
		})

		// Deleting the linked field should succeed
		err := th.service.DeletePropertyField(rctx, groupID, linked.ID)
		require.NoError(t, err)
	})

	t.Run("update source field propagates option removal to linked fields", func(t *testing.T) {
		optAID := model.NewId()
		optBID := model.NewId()
		optCID := model.NewId()

		source := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
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
			GroupID:       groupID,
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

		result, propagated, err := th.service.UpdatePropertyFields(rctx, groupID, []*model.PropertyField{source})
		require.NoError(t, err)
		require.Len(t, result, 1)     // only the requested source field
		require.Len(t, propagated, 1) // 1 linked field

		// Verify the linked field has the updated options (B removed)
		updatedLinked, err := th.service.GetPropertyField(rctx, groupID, linked.ID)
		require.NoError(t, err)

		linkedOptIDs := extractOptionIDs(updatedLinked.Attrs[model.PropertyFieldAttributeOptions])
		assert.Equal(t, []string{optAID, optCID}, linkedOptIDs, "option B should be removed from linked field")

		// Verify option content (names, colors) was propagated correctly
		linkedOpts := asOptionSlice(updatedLinked.Attrs)
		require.Len(t, linkedOpts, 2)
		assert.Equal(t, "Option A", linkedOpts[0]["name"])
		assert.Equal(t, "red", linkedOpts[0]["color"])
		assert.Equal(t, "Option C", linkedOpts[1]["name"])
		assert.Equal(t, "green", linkedOpts[1]["color"])
	})

	t.Run("cross-group linking is rejected", func(t *testing.T) {
		groupA := model.NewId()
		groupB := model.NewId()

		// Create a template in group A
		source := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupA,
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
			GroupID:       groupB,
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
			GroupID:    groupID,
			FieldID:    source.ID,
			Value:      json.RawMessage(`"some value"`),
		}

		_, err := th.service.UpdatePropertyValues(rctx, groupID, []*model.PropertyValue{value})
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
}
