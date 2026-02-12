// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCountActivePropertyFieldsForGroup(t *testing.T) {
	th := Setup(t)

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

		count, err := th.service.CountActivePropertyFieldsForGroup(groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(5), count)
	})

	t.Run("should return 0 for empty group", func(t *testing.T) {
		groupID := model.NewId()

		count, err := th.service.CountActivePropertyFieldsForGroup(groupID)
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

		count, err := th.service.CountActivePropertyFieldsForGroup(groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(3), count)
	})
}

func TestCountAllPropertyFieldsForGroup(t *testing.T) {
	th := Setup(t)

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

		count, err := th.service.CountAllPropertyFieldsForGroup(groupID)
		require.NoError(t, err)
		assert.Equal(t, int64(8), count)
	})

	t.Run("should return 0 for empty group", func(t *testing.T) {
		groupID := model.NewId()

		count, err := th.service.CountAllPropertyFieldsForGroup(groupID)
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

		activeCount, err := th.service.CountActivePropertyFieldsForGroup(groupID)
		require.NoError(t, err)

		allCount, err := th.service.CountAllPropertyFieldsForGroup(groupID)
		require.NoError(t, err)

		assert.Equal(t, int64(5), activeCount)
		assert.Equal(t, int64(8), allCount)
		assert.True(t, allCount > activeCount)
	})
}

func TestCreatePropertyField(t *testing.T) {
	th := Setup(t)

	t.Run("legacy property with empty ObjectType should skip conflict check", func(t *testing.T) {
		field := &model.PropertyField{
			ObjectType: "", // Legacy
			GroupID:    model.NewId(),
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
			Name:       "Legacy Property",
		}
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
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
		result, err := th.service.CreatePropertyField(field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
	})
}

func TestUpdatePropertyField(t *testing.T) {
	th := Setup(t)

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
			"options": []string{"a", "b"},
		}

		result, err := th.service.UpdatePropertyField(groupID, field)
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
		result, err := th.service.UpdatePropertyField(groupID, field)
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
		result, err := th.service.UpdatePropertyField(groupID, systemField)
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
		result, err := th.service.UpdatePropertyField(groupID, dmField)
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
		result, err := th.service.UpdatePropertyField(groupID, teamField)
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

		result, err := th.service.UpdatePropertyField(groupID, channel2Field)
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

		result, err := th.service.UpdatePropertyField(groupID, channel2Field)
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
		result, err := th.service.UpdatePropertyField(groupID, field)
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
		result, err := th.service.UpdatePropertyField(groupID, field)
		require.NoError(t, err)
		assert.Equal(t, "SameName", result.Name)
	})
}
