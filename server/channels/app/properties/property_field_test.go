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
				GroupID:    groupID,
				Name:       "Property " + model.NewId(),
				ObjectType: "channel",
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
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
				GroupID:    groupID,
				Name:       "Active " + model.NewId(),
				ObjectType: "channel",
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
			})
		}

		// Create and delete 2 fields
		for range 2 {
			field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:    groupID,
				Name:       "Deleted " + model.NewId(),
				ObjectType: "channel",
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
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
				GroupID:    groupID,
				Name:       "Active " + model.NewId(),
				ObjectType: "channel",
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
			})
		}

		// Create and delete 3 fields
		for range 3 {
			field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:    groupID,
				Name:       "Deleted " + model.NewId(),
				ObjectType: "channel",
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
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
				GroupID:    groupID,
				Name:       "Active " + model.NewId(),
				ObjectType: "channel",
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
			})
		}

		// Create and delete 3 fields
		for range 3 {
			field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:    groupID,
				Name:       "Deleted " + model.NewId(),
				ObjectType: "channel",
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Type:       model.PropertyFieldTypeText,
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
			GroupID:    model.NewId(),
			Name:       "Legacy Property",
			ObjectType: "", // Legacy
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
		}
		result, err := th.service.CreatePropertyField(field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
		assert.Equal(t, "Legacy Property", result.Name)
	})

	t.Run("system-level property with no conflict should create successfully", func(t *testing.T) {
		groupID := model.NewId()
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "System Property",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
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
			GroupID:    groupID,
			Name:       "Status",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
		})

		// Try to create system-level property with same name
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Status",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
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
			GroupID:    groupID,
			Name:       "Priority",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
		})

		// Try to create system-level property with same name
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Priority",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
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
			GroupID:    groupID,
			Name:       "Team Property",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
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
			GroupID:    groupID,
			Name:       "SystemField",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
		})

		// Try to create team-level property with same name
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "SystemField",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
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
			GroupID:    groupID,
			Name:       "ChannelProp",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
		})

		// Try to create team-level property with same name
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "ChannelProp",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
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
			GroupID:    groupID,
			Name:       "Channel Property",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
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
			GroupID:    groupID,
			Name:       "GlobalProp",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
		})

		// Try to create channel-level property with same name
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "GlobalProp",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
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
			GroupID:    groupID,
			Name:       "TeamProp",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
		})

		// Try to create channel-level property with same name
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "TeamProp",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channel.Id,
			Type:       model.PropertyFieldTypeText,
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
			GroupID:    groupID,
			Name:       "TeamOnlyProp",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team.Id,
			Type:       model.PropertyFieldTypeText,
		})

		// DM channel property should not conflict with team-level property
		// since DM channels have no team association
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "TeamOnlyProp",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   dmChannel.Id,
			Type:       model.PropertyFieldTypeText,
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
			GroupID:    groupID,
			Name:       "Team1Prop",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelTeam),
			TargetID:   team1.Id,
			Type:       model.PropertyFieldTypeText,
		})

		// Channel-level property in team2 should not conflict with team1's property
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Team1Prop",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			TargetID:   channelInTeam2.Id,
			Type:       model.PropertyFieldTypeText,
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
			GroupID:    group1,
			Name:       "SharedName",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
		})

		// System-level property in group2 should not conflict
		field := &model.PropertyField{
			GroupID:    group2,
			Name:       "SharedName",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
		}
		result, err := th.service.CreatePropertyField(field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("deleted properties do not cause conflicts", func(t *testing.T) {
		groupID := model.NewId()

		// Create and delete a system-level property
		deleted := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    groupID,
			Name:       "DeletedProp",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
		})
		err := th.dbStore.PropertyField().Delete(groupID, deleted.ID)
		require.NoError(t, err)

		// New property with same name should succeed
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "DeletedProp",
			ObjectType: "channel",
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Type:       model.PropertyFieldTypeText,
		}
		result, err := th.service.CreatePropertyField(field)
		require.NoError(t, err)
		assert.NotEmpty(t, result.ID)
	})
}
