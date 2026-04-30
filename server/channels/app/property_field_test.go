// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreatePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_create_field_v2_group", Version: model.PropertyGroupVersionV2})
	require.Nil(t, appErr)
	groupID := group.ID

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

	group, appErr2 := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_update_field_v2_group", Version: model.PropertyGroupVersionV2})
	require.Nil(t, appErr2)
	groupID := group.ID

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
		updated, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
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
		updated, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
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
		updated, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, true, "")
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
		updated, appErr := th.App.UpdatePropertyField(th.Context, groupID, created, false, "")
		require.NotNil(t, appErr)
		assert.Nil(t, updated)
	})
}

func TestUpdatePropertyFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	group, appErr2 := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_update_fields_v2_group", Version: model.PropertyGroupVersionV2})
	require.Nil(t, appErr2)
	groupID := group.ID

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

		updated, appErr := th.App.UpdatePropertyFields(th.Context, groupID, []*model.PropertyField{created1, created2}, false, "")
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

		updated, appErr := th.App.UpdatePropertyFields(th.Context, groupID, []*model.PropertyField{createdNonProtected, createdProtected}, false, "")
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

		updated, appErr := th.App.UpdatePropertyFields(th.Context, groupID, []*model.PropertyField{createdNonProtected, createdProtected}, true, "")
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

		_, appErr = th.App.UpdatePropertyFields(th.Context, groupID, []*model.PropertyField{createdMain, createdOther}, false, "")
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
		updated, appErr := th.App.UpdatePropertyField(th.Context, v1Group.ID, created, false, "")
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
		updated, appErr := th.App.UpdatePropertyField(th.Context, v2Group.ID, created, false, "")
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
		updated, appErr := th.App.UpdatePropertyField(th.Context, v1Group.ID, created, false, "")
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
		updated, appErr := th.App.UpdatePropertyField(th.Context, v2Group.ID, created, false, "")
		require.Nil(t, appErr)
		assert.Equal(t, "V2 Field Updated", updated.Name)
	})
}

func TestDeletePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	group, appErr2 := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{Name: "test_delete_field_v2_group", Version: model.PropertyGroupVersionV2})
	require.Nil(t, appErr2)
	groupID := group.ID

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

	groupID, err := th.App.CpaGroupID()
	require.Nil(t, err)

	t.Run("should get an existing field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Field to Get",
			Type:    model.PropertyFieldTypeText,
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

	groupID, err := th.App.CpaGroupID()
	require.Nil(t, err)

	t.Run("should get multiple fields", func(t *testing.T) {
		field1 := &model.PropertyField{
			GroupID: groupID,
			Name:    "Multi Get Field 1",
			Type:    model.PropertyFieldTypeText,
		}
		field2 := &model.PropertyField{
			GroupID: groupID,
			Name:    "Multi Get Field 2",
			Type:    model.PropertyFieldTypeText,
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

	groupID, err := th.App.CpaGroupID()
	require.Nil(t, err)

	t.Run("should search for fields", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Searchable Field",
			Type:    model.PropertyFieldTypeText,
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
