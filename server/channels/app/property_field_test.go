// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// registerTestPropertyGroup creates a fresh, unmanaged PSAv2 property group
// for tests that exercise generic PropertyField CRUD.
func registerTestPropertyGroup(tb testing.TB, th *TestHelper) string {
	tb.Helper()
	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{
		Name:    "test_" + model.NewId(),
		Version: model.PropertyGroupVersionV2,
	})
	require.Nil(tb, appErr)
	return group.ID
}

func TestCreatePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("should create a non-protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Non-Protected Field",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}

		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, "Non-Protected Field", created.Name)
		assert.False(t, created.Protected)
	})

	t.Run("should reject creating protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:           groupID,
			Name:              "Protected Field No Bypass",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeChannel,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			Protected:         true,
			PermissionField:   model.NewPointer(model.PermissionLevelNone),
			PermissionValues:  model.NewPointer(model.PermissionLevelMember),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}

		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, created)
		assert.Equal(t, "app.property_field.create.protected.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("should allow creating protected field with bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:           groupID,
			Name:              "Protected Field With Bypass",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeChannel,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			Protected:         true,
			PermissionField:   model.NewPointer(model.PermissionLevelNone),
			PermissionValues:  model.NewPointer(model.PermissionLevelMember),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}

		created, appErr := th.App.CreatePropertyField(th.Context, field, true, "")
		require.Nil(t, appErr)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, "Protected Field With Bypass", created.Name)
		assert.True(t, created.Protected)
	})

	t.Run("should reject creating an invalid protected field even with bypass", func(t *testing.T) {
		// Protected field without permissions (validation requires permissions.field = "none")
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Invalid Protected Field",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Protected:  true,
			// Missing Permissions - validation should fail
		}

		created, appErr := th.App.CreatePropertyField(th.Context, field, true, "")
		require.NotNil(t, appErr)
		assert.Nil(t, created)
	})

	t.Run("should reject creating protected field with wrong permission level even with bypass", func(t *testing.T) {
		// Protected field with permissions.field != "none" (validation should fail)
		field := &model.PropertyField{
			GroupID:           groupID,
			Name:              "Invalid Protected Field Permissions",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeChannel,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			Protected:         true,
			PermissionField:   model.NewPointer(model.PermissionLevelSysadmin), // Should be "none" for protected fields
			PermissionValues:  model.NewPointer(model.PermissionLevelMember),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}

		created, appErr := th.App.CreatePropertyField(th.Context, field, true, "")
		require.NotNil(t, appErr)
		assert.Nil(t, created)
	})
}

func TestUpdatePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("should update a non-protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Field to Update",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		created.Name = "Updated Field Name"
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
		require.Nil(t, appErr)
		assert.Equal(t, "Updated Field Name", updated.Name)
	})

	t.Run("should reject updating protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:           groupID,
			Name:              "Protected Field to Update",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeChannel,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			Protected:         true,
			PermissionField:   model.NewPointer(model.PermissionLevelNone),
			PermissionValues:  model.NewPointer(model.PermissionLevelMember),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, true, "")
		require.Nil(t, appErr)

		created.Name = "Attempted Update"
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, updated)
		assert.Equal(t, "app.property_field.update.protected.app_error", appErr.Id)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
	})

	t.Run("should allow updating protected field with bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:           groupID,
			Name:              "Protected Field Bypass Update",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeChannel,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			Protected:         true,
			PermissionField:   model.NewPointer(model.PermissionLevelNone),
			PermissionValues:  model.NewPointer(model.PermissionLevelMember),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, true, "")
		require.Nil(t, appErr)

		created.Name = "Successfully Updated Protected"
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, true, "")
		require.Nil(t, appErr)
		assert.Equal(t, "Successfully Updated Protected", updated.Name)
	})

	t.Run("should reject an invalid update", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Field for Invalid Update",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		// Try to update with empty name (invalid)
		created.Name = ""
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, updated)
	})
}

func TestUpdatePropertyFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("should update multiple non-protected fields without bypass", func(t *testing.T) {
		field1 := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Batch Field 1",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		field2 := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Batch Field 2",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}

		created1, appErr := th.App.CreatePropertyField(th.Context, field1, false, "")
		require.Nil(t, appErr)
		created2, appErr := th.App.CreatePropertyField(th.Context, field2, false, "")
		require.Nil(t, appErr)

		created1.Name = "Updated Batch 1"
		created2.Name = "Updated Batch 2"

		updated, _, appErr := th.App.UpdatePropertyFields(th.Context, groupID, []*model.PropertyField{created1, created2}, false, "")
		require.Nil(t, appErr)
		require.Len(t, updated, 2)
	})

	t.Run("should reject batch update if any field is protected without bypass", func(t *testing.T) {
		nonProtected := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Non-Protected in Batch",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		protected := &model.PropertyField{
			GroupID:           groupID,
			Name:              "Protected in Batch",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeChannel,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			Protected:         true,
			PermissionField:   model.NewPointer(model.PermissionLevelNone),
			PermissionValues:  model.NewPointer(model.PermissionLevelMember),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}

		createdNonProtected, appErr := th.App.CreatePropertyField(th.Context, nonProtected, false, "")
		require.Nil(t, appErr)
		createdProtected, appErr := th.App.CreatePropertyField(th.Context, protected, true, "")
		require.Nil(t, appErr)

		createdNonProtected.Name = "Updated Non-Protected"
		createdProtected.Name = "Updated Protected"

		updated, _, appErr := th.App.UpdatePropertyFields(th.Context, groupID, []*model.PropertyField{createdNonProtected, createdProtected}, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, updated)
		assert.Equal(t, "app.property_field.update.protected.app_error", appErr.Id)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)

		// Verify neither field was updated
		fetchedNonProtected, appErr := th.App.GetPropertyField(th.Context, groupID, createdNonProtected.ID)
		require.Nil(t, appErr)
		assert.Equal(t, "Non-Protected in Batch", fetchedNonProtected.Name)

		fetchedProtected, appErr := th.App.GetPropertyField(th.Context, groupID, createdProtected.ID)
		require.Nil(t, appErr)
		assert.Equal(t, "Protected in Batch", fetchedProtected.Name)
	})

	t.Run("should allow batch update with protected fields when bypass is true", func(t *testing.T) {
		nonProtected := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Non-Protected Bypass Batch",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		protected := &model.PropertyField{
			GroupID:           groupID,
			Name:              "Protected Bypass Batch",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeChannel,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			Protected:         true,
			PermissionField:   model.NewPointer(model.PermissionLevelNone),
			PermissionValues:  model.NewPointer(model.PermissionLevelMember),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}

		createdNonProtected, appErr := th.App.CreatePropertyField(th.Context, nonProtected, false, "")
		require.Nil(t, appErr)
		createdProtected, appErr := th.App.CreatePropertyField(th.Context, protected, true, "")
		require.Nil(t, appErr)

		createdNonProtected.Name = "Bypass Updated Non-Protected"
		createdProtected.Name = "Bypass Updated Protected"

		updated, _, appErr := th.App.UpdatePropertyFields(th.Context, groupID, []*model.PropertyField{createdNonProtected, createdProtected}, true, "")
		require.Nil(t, appErr)
		require.Len(t, updated, 2)
	})

	t.Run("should fail to update if any field comes from a different property group", func(t *testing.T) {
		// Create a field in a different group
		otherGroup, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_other_group", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)

		fieldInOtherGroup := &model.PropertyField{
			GroupID: otherGroup.ID,
			Name:    "Field in Other Group",
			Type:    model.PropertyFieldTypeText,
		}
		createdOther, appErr := th.App.CreatePropertyField(th.Context, fieldInOtherGroup, false, "")
		require.Nil(t, appErr)

		// Create a field in the main group
		fieldInMainGroup := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Field in Main Group",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		createdMain, appErr := th.App.CreatePropertyField(th.Context, fieldInMainGroup, false, "")
		require.Nil(t, appErr)

		// Try to update both fields using the main groupID - should fail for the other group's field
		createdMain.Name = "Updated Main"
		createdOther.Name = "Updated Other"

		_, _, appErr = th.App.UpdatePropertyFields(th.Context, groupID, []*model.PropertyField{createdMain, createdOther}, false, "")
		require.NotNil(t, appErr)

		// Verify neither field was updated
		fetchedMain, appErr := th.App.GetPropertyField(th.Context, groupID, createdMain.ID)
		require.Nil(t, appErr)
		assert.Equal(t, "Field in Main Group", fetchedMain.Name)

		fetchedOther, appErr := th.App.GetPropertyField(th.Context, otherGroup.ID, createdOther.ID)
		require.Nil(t, appErr)
		assert.Equal(t, "Field in Other Group", fetchedOther.Name)
	})
}

func TestCreatePropertyFieldVersionEnforcement(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("should reject creating a v2 field on a v1 group", func(t *testing.T) {
		group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "v1_group_reject_v2_field", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)

		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "V2 Field on V1 Group",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}

		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, created)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("should reject creating a v1 field on a v2 group", func(t *testing.T) {
		group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "v2_group_reject_v1_field", Version: model.PropertyGroupVersionV2})
		require.Nil(t, appErr)

		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "V1 Field on V2 Group",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			// No ObjectType → PSAv1 field
		}

		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, created)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("should allow creating a v1 field on a v1 group", func(t *testing.T) {
		group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "v1_group_allow_v1_field", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)

		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "V1 Field on V1 Group",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			// No ObjectType → PSAv1 field
		}

		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		assert.NotEmpty(t, created.ID)
	})

	t.Run("should allow creating a v2 field on a v2 group", func(t *testing.T) {
		group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "v2_group_allow_v2_field", Version: model.PropertyGroupVersionV2})
		require.Nil(t, appErr)

		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "V2 Field on V2 Group",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}

		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		assert.NotEmpty(t, created.ID)
	})
}

func TestUpdatePropertyFieldVersionEnforcement(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("should reject updating a v2 field on a v1 group", func(t *testing.T) {
		v1Group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "v1_group_update_reject_v2", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)

		// Create a v1 field on the v1 group (allowed)
		field := &model.PropertyField{
			GroupID:    v1Group.ID,
			Name:       "V1 Field for Update Test",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		// Attempt to update it as a v2 field (add ObjectType to make it v2)
		created.ObjectType = model.PropertyFieldObjectTypeUser
		created.TargetType = string(model.PropertyFieldTargetLevelSystem)
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, v1Group.ID, created, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, updated)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("should reject updating a v1 field on a v2 group", func(t *testing.T) {
		v2Group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "v2_group_update_reject_v1", Version: model.PropertyGroupVersionV2})
		require.Nil(t, appErr)

		// Create a v2 field on the v2 group (allowed)
		field := &model.PropertyField{
			GroupID:    v2Group.ID,
			Name:       "V2 Field for Update Test",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		// Attempt to update it as a v1 field (remove ObjectType to make it v1)
		created.ObjectType = ""
		created.TargetType = "user"
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, v2Group.ID, created, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, updated)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("should allow updating a v1 field on a v1 group", func(t *testing.T) {
		v1Group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "v1_group_update_allow_v1", Version: model.PropertyGroupVersionV1})
		require.Nil(t, appErr)

		field := &model.PropertyField{
			GroupID:    v1Group.ID,
			Name:       "V1 Field Update Allowed",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		created.Name = "V1 Field Updated"
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, v1Group.ID, created, false, "")
		require.Nil(t, appErr)
		assert.Equal(t, "V1 Field Updated", updated.Name)
	})

	t.Run("should allow updating a v2 field on a v2 group", func(t *testing.T) {
		v2Group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "v2_group_update_allow_v2", Version: model.PropertyGroupVersionV2})
		require.Nil(t, appErr)

		field := &model.PropertyField{
			GroupID:    v2Group.ID,
			Name:       "V2 Field Update Allowed",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		created.Name = "V2 Field Updated"
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, v2Group.ID, created, false, "")
		require.Nil(t, appErr)
		assert.Equal(t, "V2 Field Updated", updated.Name)
	})
}

func TestDeletePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("should delete a non-protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Field to Delete",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		appErr = th.App.DeletePropertyField(th.Context, groupID, created.ID, false, "")
		require.Nil(t, appErr)

		// Verify soft deletion (DeleteAt > 0)
		deleted, appErr := th.App.GetPropertyField(th.Context, groupID, created.ID)
		require.Nil(t, appErr)
		assert.NotZero(t, deleted.DeleteAt)
	})

	t.Run("should reject deleting protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:           groupID,
			Name:              "Protected Field to Delete",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeChannel,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			Protected:         true,
			PermissionField:   model.NewPointer(model.PermissionLevelNone),
			PermissionValues:  model.NewPointer(model.PermissionLevelMember),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, true, "")
		require.Nil(t, appErr)

		appErr = th.App.DeletePropertyField(th.Context, groupID, created.ID, false, "")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.property_field.delete.protected.app_error", appErr.Id)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)

		// Verify field still exists
		existing, appErr := th.App.GetPropertyField(th.Context, groupID, created.ID)
		require.Nil(t, appErr)
		assert.NotNil(t, existing)
		assert.Zero(t, existing.DeleteAt)
	})

	t.Run("should allow deleting protected field with bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:           groupID,
			Name:              "Protected Field Bypass Delete",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeChannel,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			Protected:         true,
			PermissionField:   model.NewPointer(model.PermissionLevelNone),
			PermissionValues:  model.NewPointer(model.PermissionLevelMember),
			PermissionOptions: model.NewPointer(model.PermissionLevelSysadmin),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, true, "")
		require.Nil(t, appErr)

		appErr = th.App.DeletePropertyField(th.Context, groupID, created.ID, true, "")
		require.Nil(t, appErr)

		// Verify soft deletion (DeleteAt > 0)
		deleted, appErr := th.App.GetPropertyField(th.Context, groupID, created.ID)
		require.Nil(t, appErr)
		assert.NotZero(t, deleted.DeleteAt)
	})

	t.Run("should delete a user-targeted field without triggering broadcast", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "User Targeted Field",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		appErr = th.App.DeletePropertyField(th.Context, groupID, created.ID, false, "")
		require.Nil(t, appErr)

		// Verify soft deletion (DeleteAt > 0)
		deleted, appErr := th.App.GetPropertyField(th.Context, groupID, created.ID)
		require.Nil(t, appErr)
		assert.NotZero(t, deleted.DeleteAt)
	})
}

func TestPropertyFieldCacheInvalidation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	newField := func(groupID, name string) *model.PropertyField {
		return &model.PropertyField{
			GroupID:    groupID,
			Name:       name,
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
	}

	t.Run("create invalidates the cached group listing", func(t *testing.T) {
		groupID := registerTestPropertyGroup(t, th)

		_, appErr := th.App.CreatePropertyField(th.Context, newField(groupID, "First Field"), false, "")
		require.Nil(t, appErr)

		// Populate the cache for this group.
		fields, appErr := th.App.GetPropertyFieldsForGroup(th.Context, groupID)
		require.Nil(t, appErr)
		require.Len(t, fields, 1)

		_, appErr = th.App.CreatePropertyField(th.Context, newField(groupID, "Second Field"), false, "")
		require.Nil(t, appErr)

		// A stale cache would still return a single field here.
		fields, appErr = th.App.GetPropertyFieldsForGroup(th.Context, groupID)
		require.Nil(t, appErr)
		assert.Len(t, fields, 2)
	})

	t.Run("update invalidates the cached group listing", func(t *testing.T) {
		groupID := registerTestPropertyGroup(t, th)

		created, appErr := th.App.CreatePropertyField(th.Context, newField(groupID, "Original Name"), false, "")
		require.Nil(t, appErr)

		fields, appErr := th.App.GetPropertyFieldsForGroup(th.Context, groupID)
		require.Nil(t, appErr)
		require.Len(t, fields, 1)
		require.Equal(t, "Original Name", fields[0].Name)

		created.Name = "Updated Name"
		_, _, appErr = th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
		require.Nil(t, appErr)

		// A stale cache would still return the original name here.
		fields, appErr = th.App.GetPropertyFieldsForGroup(th.Context, groupID)
		require.Nil(t, appErr)
		require.Len(t, fields, 1)
		assert.Equal(t, "Updated Name", fields[0].Name)
	})

	t.Run("delete invalidates the cached group listing", func(t *testing.T) {
		groupID := registerTestPropertyGroup(t, th)

		created, appErr := th.App.CreatePropertyField(th.Context, newField(groupID, "Field to Delete"), false, "")
		require.Nil(t, appErr)

		fields, appErr := th.App.GetPropertyFieldsForGroup(th.Context, groupID)
		require.Nil(t, appErr)
		require.Len(t, fields, 1)

		appErr = th.App.DeletePropertyField(th.Context, groupID, created.ID, false, "")
		require.Nil(t, appErr)

		// A stale cache would still return the deleted field here.
		fields, appErr = th.App.GetPropertyFieldsForGroup(th.Context, groupID)
		require.Nil(t, appErr)
		assert.Empty(t, fields)
	})
}

func TestPropertyFieldBroadcastParams(t *testing.T) {
	rctx := request.TestContext(t)

	t.Run("team target type returns team ID", func(t *testing.T) {
		field := &model.PropertyField{TargetType: "team", TargetID: "team123"}
		teamID, channelID, ok := propertyFieldBroadcastParams(rctx, field)
		assert.True(t, ok)
		assert.Equal(t, "team123", teamID)
		assert.Empty(t, channelID)
	})

	t.Run("channel target type returns channel ID", func(t *testing.T) {
		field := &model.PropertyField{TargetType: "channel", TargetID: "chan123"}
		teamID, channelID, ok := propertyFieldBroadcastParams(rctx, field)
		assert.True(t, ok)
		assert.Empty(t, teamID)
		assert.Equal(t, "chan123", channelID)
	})

	t.Run("system target type returns empty strings", func(t *testing.T) {
		field := &model.PropertyField{TargetType: "system"}
		teamID, channelID, ok := propertyFieldBroadcastParams(rctx, field)
		assert.True(t, ok)
		assert.Empty(t, teamID)
		assert.Empty(t, channelID)
	})

	t.Run("empty target type returns ok=false", func(t *testing.T) {
		field := &model.PropertyField{TargetType: ""}
		_, _, ok := propertyFieldBroadcastParams(rctx, field)
		assert.False(t, ok)
	})

	t.Run("unrecognized target type returns ok=false", func(t *testing.T) {
		field := &model.PropertyField{TargetType: "organization", TargetID: "org123"}
		_, _, ok := propertyFieldBroadcastParams(rctx, field)
		assert.False(t, ok)
	})
}

func TestGetPropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("should get an existing field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Field to Get",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		fetched, appErr := th.App.GetPropertyField(th.Context, groupID, created.ID)
		require.Nil(t, appErr)
		assert.Equal(t, created.ID, fetched.ID)
		assert.Equal(t, "Field to Get", fetched.Name)
	})

	t.Run("should return error for non-existent field", func(t *testing.T) {
		_, appErr := th.App.GetPropertyField(th.Context, groupID, model.NewId())
		require.NotNil(t, appErr)
	})
}

func TestGetPropertyFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("should get multiple fields", func(t *testing.T) {
		field1 := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Multi Get Field 1",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		field2 := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Multi Get Field 2",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}

		created1, appErr := th.App.CreatePropertyField(th.Context, field1, false, "")
		require.Nil(t, appErr)
		created2, appErr := th.App.CreatePropertyField(th.Context, field2, false, "")
		require.Nil(t, appErr)

		fetched, appErr := th.App.GetPropertyFields(th.Context, groupID, []string{created1.ID, created2.ID})
		require.Nil(t, appErr)
		assert.Len(t, fetched, 2)
	})
}

func TestSearchPropertyFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("should search for fields", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Searchable Field",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		_, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		opts := model.PropertyFieldSearchOpts{
			GroupID: groupID,
			PerPage: 100,
		}
		results, appErr := th.App.SearchPropertyFields(th.Context, groupID, opts)
		require.Nil(t, appErr)
		assert.NotEmpty(t, results)
	})
}

func TestCreatePropertyField_SystemCanonicalization(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("system object: TargetType+TargetID and Permission* are canonicalized", func(t *testing.T) {
		member := model.PermissionLevelMember
		field := &model.PropertyField{
			GroupID:           groupID,
			Name:              "System Canonicalize",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeSystem,
			TargetType:        "channel",
			TargetID:          model.NewId(),
			PermissionField:   &member,
			PermissionValues:  &member,
			PermissionOptions: &member,
		}

		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		assert.Equal(t, string(model.PropertyFieldTargetLevelSystem), created.TargetType)
		assert.Empty(t, created.TargetID)
		require.NotNil(t, created.PermissionField)
		assert.Equal(t, model.PermissionLevelSysadmin, *created.PermissionField)
		require.NotNil(t, created.PermissionValues)
		assert.Equal(t, model.PermissionLevelSysadmin, *created.PermissionValues)
		require.NotNil(t, created.PermissionOptions)
		assert.Equal(t, model.PermissionLevelSysadmin, *created.PermissionOptions)
	})
}

func TestCreatePropertyField_TrimName(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("trims whitespace around name", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "  trim-me  ",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}

		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		assert.Equal(t, "trim-me", created.Name)
	})
}

func TestUpdatePropertyField_TrimNameOnUpdate(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("trims whitespace on update", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "Trim Update",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)

		created.Name = "  trimmed-on-update  "
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
		require.Nil(t, appErr)
		assert.Equal(t, "trimmed-on-update", updated.Name)
	})
}

func TestUpdatePropertyField_LinkedFieldInvariants(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	makeLinkedPair := func(t *testing.T) (template, linked *model.PropertyField) {
		t.Helper()
		tmpl := &model.PropertyField{
			GroupID:    groupID,
			Name:       "tmpl-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []map[string]any{
					{"id": model.NewId(), "name": "opt1"},
				},
			},
		}
		createdTmpl, appErr := th.App.CreatePropertyField(th.Context, tmpl, false, "")
		require.Nil(t, appErr)

		linkedID := createdTmpl.ID
		linkedField := &model.PropertyField{
			GroupID:       groupID,
			Name:          "linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeSelect,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &linkedID,
		}
		createdLinked, appErr := th.App.CreatePropertyField(th.Context, linkedField, false, "")
		require.Nil(t, appErr)
		return createdTmpl, createdLinked
	}

	t.Run("type immutable on linked field", func(t *testing.T) {
		_, linked := makeLinkedPair(t)
		linked.Type = model.PropertyFieldTypeText
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, linked, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, updated)
		assert.Equal(t, "app.property_field.update.linked_type_change.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("options immutable on linked field", func(t *testing.T) {
		_, linked := makeLinkedPair(t)
		linked.Attrs = model.StringInterface{
			model.PropertyFieldAttributeOptions: []map[string]any{
				{"id": model.NewId(), "name": "different"},
			},
		}
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, linked, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, updated)
		assert.Equal(t, "app.property_field.update.linked_options_change.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("link target immutable: cannot change to different target", func(t *testing.T) {
		altTmpl, linked := makeLinkedPair(t)
		// Create another template to point to
		_ = altTmpl
		newTmpl := &model.PropertyField{
			GroupID:    groupID,
			Name:       "tmpl-alt-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []map[string]any{
					{"id": model.NewId(), "name": "x"},
				},
			},
		}
		createdNew, appErr := th.App.CreatePropertyField(th.Context, newTmpl, false, "")
		require.Nil(t, appErr)

		newID := createdNew.ID
		linked.LinkedFieldID = &newID
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, linked, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, updated)
		assert.Equal(t, "app.property_field.update.cannot_change_link_target.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("cannot link a previously-unlinked field", func(t *testing.T) {
		unlinked := &model.PropertyField{
			GroupID:    groupID,
			Name:       "unlinked-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		createdUnlinked, appErr := th.App.CreatePropertyField(th.Context, unlinked, false, "")
		require.Nil(t, appErr)

		// Create a template to link to
		tmpl := &model.PropertyField{
			GroupID:    groupID,
			Name:       "tmpl-late-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		createdTmpl, appErr := th.App.CreatePropertyField(th.Context, tmpl, false, "")
		require.Nil(t, appErr)
		tID := createdTmpl.ID

		createdUnlinked.LinkedFieldID = &tID
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, createdUnlinked, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, updated)
		assert.Equal(t, "app.property_field.update.cannot_link_existing.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}

func TestUpdatePropertyField_LinkedFieldNoOpPatchOK(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("setting Type to current value on a linked field passes", func(t *testing.T) {
		// Build template + linked
		tmpl := &model.PropertyField{
			GroupID:    groupID,
			Name:       "tmpl-noop-" + model.NewId(),
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []map[string]any{
					{"id": model.NewId(), "name": "n"},
				},
			},
		}
		createdTmpl, appErr := th.App.CreatePropertyField(th.Context, tmpl, false, "")
		require.Nil(t, appErr)
		linkedID := createdTmpl.ID

		linked := &model.PropertyField{
			GroupID:       groupID,
			Name:          "linked-noop-" + model.NewId(),
			Type:          model.PropertyFieldTypeSelect,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &linkedID,
		}
		createdLinked, appErr := th.App.CreatePropertyField(th.Context, linked, false, "")
		require.Nil(t, appErr)

		// No-op update: Type unchanged.
		createdLinked.Name = "linked-renamed"
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, createdLinked, false, "")
		require.Nil(t, appErr)
		assert.Equal(t, "linked-renamed", updated.Name)
	})
}

func TestUpdatePropertyField_LinkedFieldUnlinkAllowed(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	t.Run("plugin path: setting LinkedFieldID = nil on a linked field unlinks it", func(t *testing.T) {
		tmpl := &model.PropertyField{
			GroupID:    groupID,
			Name:       "tmpl-unlink-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		createdTmpl, appErr := th.App.CreatePropertyField(th.Context, tmpl, false, "")
		require.Nil(t, appErr)
		linkedID := createdTmpl.ID

		linked := &model.PropertyField{
			GroupID:       groupID,
			Name:          "linked-unlink-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &linkedID,
		}
		createdLinked, appErr := th.App.CreatePropertyField(th.Context, linked, false, "")
		require.Nil(t, appErr)

		createdLinked.LinkedFieldID = nil
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, createdLinked, false, "")
		require.Nil(t, appErr)
		assert.Nil(t, updated.LinkedFieldID)
	})
}

// TestPropertyFieldAccessControlSignalling verifies that mutating a property
// field notifies the access control service via OnPropertyFieldOptionsChanged
// so it can drop cached per-field metadata (e.g. the rank-by-name lookup) and
// invalidate compiled-policy cache entries. The call is guarded by a nil check
// because the AccessControl service is enterprise-only.
func TestPropertyFieldAccessControlSignalling(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Rank fields are gated behind the PropertyFieldRank feature flag.
	th.ConfigStore.SetReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.PropertyFieldRank = true
	})

	groupID := registerTestPropertyGroup(t, th)

	newRankField := func(t *testing.T) *model.PropertyField {
		t.Helper()
		field := &model.PropertyField{
			GroupID:    groupID,
			Name:       "rank_" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			TargetType: "system",
			ObjectType: "user",
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "LOW", "rank": 1},
					map[string]any{"name": "HIGH", "rank": 2},
				},
			},
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		return created
	}

	t.Run("UpdatePropertyFields signals for each updated field", func(t *testing.T) {
		f1 := newRankField(t)
		f2 := newRankField(t)

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		mockACS.On("OnPropertyFieldOptionsChanged", mock.Anything, f1.ID).Return().Once()
		mockACS.On("OnPropertyFieldOptionsChanged", mock.Anything, f2.ID).Return().Once()

		_, _, appErr := th.App.UpdatePropertyFields(th.Context, groupID, []*model.PropertyField{f1, f2}, false, "")
		require.Nil(t, appErr)

		mockACS.AssertExpectations(t)
	})

	t.Run("DeletePropertyField signals for the deleted field", func(t *testing.T) {
		f := newRankField(t)

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		mockACS.On("OnPropertyFieldOptionsChanged", mock.Anything, f.ID).Return().Once()

		appErr := th.App.DeletePropertyField(th.Context, groupID, f.ID, false, "")
		require.Nil(t, appErr)

		mockACS.AssertExpectations(t)
	})

	t.Run("mutations succeed (no panic) when access control is unavailable", func(t *testing.T) {
		// The signalling is guarded by `if acs != nil`; with no enterprise
		// service installed the field CRUD must still succeed.
		th.App.Srv().ch.AccessControl = nil

		f := newRankField(t)

		_, _, appErr := th.App.UpdatePropertyFields(th.Context, groupID, []*model.PropertyField{f}, false, "")
		require.Nil(t, appErr)

		appErr = th.App.DeletePropertyField(th.Context, groupID, f.ID, false, "")
		require.Nil(t, appErr)
	})
}

// TestPropertyFieldRankGate verifies the consolidated PropertyFieldRank feature
// flag gate in CreatePropertyField / UpdatePropertyFields: when the flag is off
// (the default), the app layer must reject both creating a rank field and
// converting an existing field to rank, while leaving non-rank fields alone.
func TestPropertyFieldRankGate(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	// Feature flags are read-only at runtime by default; allow this test to
	// toggle PropertyFieldRank on and off.
	th.ConfigStore.SetReadOnlyFF(false)

	setRankFlag := func(t *testing.T, enabled bool) {
		t.Helper()
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PropertyFieldRank = enabled
		})
	}

	rankField := func() *model.PropertyField {
		return &model.PropertyField{
			GroupID:    groupID,
			Name:       "rank_" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "LOW", "rank": 1},
					map[string]any{"name": "HIGH", "rank": 2},
				},
			},
		}
	}

	textField := func() *model.PropertyField {
		return &model.PropertyField{
			GroupID:    groupID,
			Name:       "text_" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
	}

	// classificationRankField models how the classification-markings feature
	// uses the rank type: a non-user object type (template/system/channel). The
	// gate is scoped to user-object fields, so these must remain creatable and
	// editable even with the flag off — otherwise the classification admin
	// panel breaks in the default configuration.
	classificationRankField := func() *model.PropertyField {
		return &model.PropertyField{
			GroupID:    groupID,
			Name:       "classification_" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			ObjectType: model.PropertyFieldObjectTypeChannel,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "UNCLASSIFIED", "rank": 1},
					map[string]any{"name": "SECRET", "rank": 2},
				},
			},
		}
	}

	t.Run("rejects creating a rank field when the flag is off", func(t *testing.T) {
		setRankFlag(t, false)

		created, appErr := th.App.CreatePropertyField(th.Context, rankField(), false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, created)
		assert.Equal(t, "app.property_field.rank_disabled.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("rejects converting an existing field to rank when the flag is off", func(t *testing.T) {
		setRankFlag(t, false)

		created, appErr := th.App.CreatePropertyField(th.Context, textField(), false, "")
		require.Nil(t, appErr)

		created.Type = model.PropertyFieldTypeRank
		created.Attrs = model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"name": "LOW", "rank": 1},
			},
		}
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, updated)
		assert.Equal(t, "app.property_field.rank_disabled.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("allows non-rank field create and update when the flag is off", func(t *testing.T) {
		setRankFlag(t, false)

		created, appErr := th.App.CreatePropertyField(th.Context, textField(), false, "")
		require.Nil(t, appErr)

		created.Name = "renamed_" + model.NewId()
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
		require.Nil(t, appErr)
		assert.Equal(t, model.PropertyFieldTypeText, updated.Type)
	})

	t.Run("allows creating a non-user (classification) rank field when the flag is off", func(t *testing.T) {
		setRankFlag(t, false)

		created, appErr := th.App.CreatePropertyField(th.Context, classificationRankField(), false, "")
		require.Nil(t, appErr)
		assert.Equal(t, model.PropertyFieldTypeRank, created.Type)
		assert.Equal(t, model.PropertyFieldObjectTypeChannel, created.ObjectType)
	})

	t.Run("allows converting a non-user field to rank when the flag is off", func(t *testing.T) {
		setRankFlag(t, false)

		channelText := textField()
		channelText.ObjectType = model.PropertyFieldObjectTypeChannel
		created, appErr := th.App.CreatePropertyField(th.Context, channelText, false, "")
		require.Nil(t, appErr)

		created.Type = model.PropertyFieldTypeRank
		created.Attrs = model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"name": "UNCLASSIFIED", "rank": 1},
			},
		}
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
		require.Nil(t, appErr)
		assert.Equal(t, model.PropertyFieldTypeRank, updated.Type)
	})

	t.Run("allows creating a rank field when the flag is on", func(t *testing.T) {
		setRankFlag(t, true)

		created, appErr := th.App.CreatePropertyField(th.Context, rankField(), false, "")
		require.Nil(t, appErr)
		assert.Equal(t, model.PropertyFieldTypeRank, created.Type)
	})

	t.Run("allows converting an existing field to rank when the flag is on", func(t *testing.T) {
		setRankFlag(t, true)

		created, appErr := th.App.CreatePropertyField(th.Context, textField(), false, "")
		require.Nil(t, appErr)

		created.Type = model.PropertyFieldTypeRank
		created.Attrs = model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"name": "LOW", "rank": 1},
			},
		}
		updated, _, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
		require.Nil(t, appErr)
		assert.Equal(t, model.PropertyFieldTypeRank, updated.Type)
	})
}
