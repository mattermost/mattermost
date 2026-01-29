// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreatePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID, err := th.App.CpaGroupID()
	require.NoError(t, err)

	t.Run("should create a non-protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Non-Protected Field",
			Type:    model.PropertyFieldTypeText,
		}

		created, err := th.App.CreatePropertyField(field, false)
		require.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, "Non-Protected Field", created.Name)
		assert.False(t, created.Protected)
	})

	t.Run("should reject creating protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Protected Field No Bypass",
			Type:      model.PropertyFieldTypeText,
			Protected: true,
			Permissions: &model.PropertyFieldPermissions{
				Field:   model.PermissionLevelNone,
				Values:  model.PermissionLevelMember,
				Options: model.PermissionLevelAdmin,
			},
		}

		created, err := th.App.CreatePropertyField(field, false)
		require.Error(t, err)
		assert.Nil(t, created)

		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.property_field.create.protected.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("should allow creating protected field with bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Protected Field With Bypass",
			Type:      model.PropertyFieldTypeText,
			Protected: true,
			Permissions: &model.PropertyFieldPermissions{
				Field:   model.PermissionLevelNone,
				Values:  model.PermissionLevelMember,
				Options: model.PermissionLevelAdmin,
			},
		}

		created, err := th.App.CreatePropertyField(field, true)
		require.NoError(t, err)
		assert.NotEmpty(t, created.ID)
		assert.Equal(t, "Protected Field With Bypass", created.Name)
		assert.True(t, created.Protected)
	})

	t.Run("should reject creating an invalid protected field even with bypass", func(t *testing.T) {
		// Protected field without permissions (validation requires permissions.field = "none")
		field := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Invalid Protected Field",
			Type:      model.PropertyFieldTypeText,
			Protected: true,
			// Missing Permissions - validation should fail
		}

		created, err := th.App.CreatePropertyField(field, true)
		require.Error(t, err)
		assert.Nil(t, created)
	})

	t.Run("should reject creating protected field with wrong permission level even with bypass", func(t *testing.T) {
		// Protected field with permissions.field != "none" (validation should fail)
		field := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Invalid Protected Field Permissions",
			Type:      model.PropertyFieldTypeText,
			Protected: true,
			Permissions: &model.PropertyFieldPermissions{
				Field:   model.PermissionLevelAdmin, // Should be "none" for protected fields
				Values:  model.PermissionLevelMember,
				Options: model.PermissionLevelAdmin,
			},
		}

		created, err := th.App.CreatePropertyField(field, true)
		require.Error(t, err)
		assert.Nil(t, created)
	})
}

func TestUpdatePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID, err := th.App.CpaGroupID()
	require.NoError(t, err)

	t.Run("should update a non-protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Field to Update",
			Type:    model.PropertyFieldTypeText,
		}
		created, err := th.App.CreatePropertyField(field, false)
		require.NoError(t, err)

		created.Name = "Updated Field Name"
		updated, err := th.App.UpdatePropertyField(groupID, created, false)
		require.NoError(t, err)
		assert.Equal(t, "Updated Field Name", updated.Name)
	})

	t.Run("should reject updating protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Protected Field to Update",
			Type:      model.PropertyFieldTypeText,
			Protected: true,
			Permissions: &model.PropertyFieldPermissions{
				Field:   model.PermissionLevelNone,
				Values:  model.PermissionLevelMember,
				Options: model.PermissionLevelAdmin,
			},
		}
		created, err := th.App.CreatePropertyField(field, true)
		require.NoError(t, err)

		created.Name = "Attempted Update"
		updated, err := th.App.UpdatePropertyField(groupID, created, false)
		require.Error(t, err)
		assert.Nil(t, updated)

		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.property_field.update.protected.app_error", appErr.Id)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
	})

	t.Run("should allow updating protected field with bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Protected Field Bypass Update",
			Type:      model.PropertyFieldTypeText,
			Protected: true,
			Permissions: &model.PropertyFieldPermissions{
				Field:   model.PermissionLevelNone,
				Values:  model.PermissionLevelMember,
				Options: model.PermissionLevelAdmin,
			},
		}
		created, err := th.App.CreatePropertyField(field, true)
		require.NoError(t, err)

		created.Name = "Successfully Updated Protected"
		updated, err := th.App.UpdatePropertyField(groupID, created, true)
		require.NoError(t, err)
		assert.Equal(t, "Successfully Updated Protected", updated.Name)
	})

	t.Run("should reject an invalid update", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Field for Invalid Update",
			Type:    model.PropertyFieldTypeText,
		}
		created, err := th.App.CreatePropertyField(field, false)
		require.NoError(t, err)

		// Try to update with empty name (invalid)
		created.Name = ""
		updated, err := th.App.UpdatePropertyField(groupID, created, false)
		require.Error(t, err)
		assert.Nil(t, updated)
	})
}

func TestUpdatePropertyFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID, err := th.App.CpaGroupID()
	require.NoError(t, err)

	t.Run("should update multiple non-protected fields without bypass", func(t *testing.T) {
		field1 := &model.PropertyField{
			GroupID: groupID,
			Name:    "Batch Field 1",
			Type:    model.PropertyFieldTypeText,
		}
		field2 := &model.PropertyField{
			GroupID: groupID,
			Name:    "Batch Field 2",
			Type:    model.PropertyFieldTypeText,
		}

		created1, err := th.App.CreatePropertyField(field1, false)
		require.NoError(t, err)
		created2, err := th.App.CreatePropertyField(field2, false)
		require.NoError(t, err)

		created1.Name = "Updated Batch 1"
		created2.Name = "Updated Batch 2"

		updated, err := th.App.UpdatePropertyFields(groupID, []*model.PropertyField{created1, created2}, false)
		require.NoError(t, err)
		require.Len(t, updated, 2)
	})

	t.Run("should reject batch update if any field is protected without bypass", func(t *testing.T) {
		nonProtected := &model.PropertyField{
			GroupID: groupID,
			Name:    "Non-Protected in Batch",
			Type:    model.PropertyFieldTypeText,
		}
		protected := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Protected in Batch",
			Type:      model.PropertyFieldTypeText,
			Protected: true,
			Permissions: &model.PropertyFieldPermissions{
				Field:   model.PermissionLevelNone,
				Values:  model.PermissionLevelMember,
				Options: model.PermissionLevelAdmin,
			},
		}

		createdNonProtected, err := th.App.CreatePropertyField(nonProtected, false)
		require.NoError(t, err)
		createdProtected, err := th.App.CreatePropertyField(protected, true)
		require.NoError(t, err)

		createdNonProtected.Name = "Updated Non-Protected"
		createdProtected.Name = "Updated Protected"

		updated, err := th.App.UpdatePropertyFields(groupID, []*model.PropertyField{createdNonProtected, createdProtected}, false)
		require.Error(t, err)
		assert.Nil(t, updated)

		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.property_field.update.protected.app_error", appErr.Id)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)

		// Verify neither field was updated
		fetchedNonProtected, err := th.App.GetPropertyField(groupID, createdNonProtected.ID)
		require.NoError(t, err)
		assert.Equal(t, "Non-Protected in Batch", fetchedNonProtected.Name)

		fetchedProtected, err := th.App.GetPropertyField(groupID, createdProtected.ID)
		require.NoError(t, err)
		assert.Equal(t, "Protected in Batch", fetchedProtected.Name)
	})

	t.Run("should allow batch update with protected fields when bypass is true", func(t *testing.T) {
		nonProtected := &model.PropertyField{
			GroupID: groupID,
			Name:    "Non-Protected Bypass Batch",
			Type:    model.PropertyFieldTypeText,
		}
		protected := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Protected Bypass Batch",
			Type:      model.PropertyFieldTypeText,
			Protected: true,
			Permissions: &model.PropertyFieldPermissions{
				Field:   model.PermissionLevelNone,
				Values:  model.PermissionLevelMember,
				Options: model.PermissionLevelAdmin,
			},
		}

		createdNonProtected, err := th.App.CreatePropertyField(nonProtected, false)
		require.NoError(t, err)
		createdProtected, err := th.App.CreatePropertyField(protected, true)
		require.NoError(t, err)

		createdNonProtected.Name = "Bypass Updated Non-Protected"
		createdProtected.Name = "Bypass Updated Protected"

		updated, err := th.App.UpdatePropertyFields(groupID, []*model.PropertyField{createdNonProtected, createdProtected}, true)
		require.NoError(t, err)
		require.Len(t, updated, 2)
	})

	t.Run("should fail to update if any field comes from a different property group", func(t *testing.T) {
		// Create a field in a different group
		otherGroup, err := th.App.RegisterPropertyGroup("test-other-group")
		require.NoError(t, err)

		fieldInOtherGroup := &model.PropertyField{
			GroupID: otherGroup.ID,
			Name:    "Field in Other Group",
			Type:    model.PropertyFieldTypeText,
		}
		createdOther, err := th.App.CreatePropertyField(fieldInOtherGroup, false)
		require.NoError(t, err)

		// Create a field in the main group
		fieldInMainGroup := &model.PropertyField{
			GroupID: groupID,
			Name:    "Field in Main Group",
			Type:    model.PropertyFieldTypeText,
		}
		createdMain, err := th.App.CreatePropertyField(fieldInMainGroup, false)
		require.NoError(t, err)

		// Try to update both fields using the main groupID - should fail for the other group's field
		createdMain.Name = "Updated Main"
		createdOther.Name = "Updated Other"

		_, err = th.App.UpdatePropertyFields(groupID, []*model.PropertyField{createdMain, createdOther}, false)
		require.Error(t, err)

		// Verify neither field was updated
		fetchedMain, err := th.App.GetPropertyField(groupID, createdMain.ID)
		require.NoError(t, err)
		assert.Equal(t, "Field in Main Group", fetchedMain.Name)

		fetchedOther, err := th.App.GetPropertyField(otherGroup.ID, createdOther.ID)
		require.NoError(t, err)
		assert.Equal(t, "Field in Other Group", fetchedOther.Name)
	})
}

func TestDeletePropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID, err := th.App.CpaGroupID()
	require.NoError(t, err)

	t.Run("should delete a non-protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Field to Delete",
			Type:    model.PropertyFieldTypeText,
		}
		created, err := th.App.CreatePropertyField(field, false)
		require.NoError(t, err)

		err = th.App.DeletePropertyField(groupID, created.ID, false)
		require.NoError(t, err)

		// Verify soft deletion (DeleteAt > 0)
		deleted, err := th.App.GetPropertyField(groupID, created.ID)
		require.NoError(t, err)
		assert.NotZero(t, deleted.DeleteAt)
	})

	t.Run("should reject deleting protected field without bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Protected Field to Delete",
			Type:      model.PropertyFieldTypeText,
			Protected: true,
			Permissions: &model.PropertyFieldPermissions{
				Field:   model.PermissionLevelNone,
				Values:  model.PermissionLevelMember,
				Options: model.PermissionLevelAdmin,
			},
		}
		created, err := th.App.CreatePropertyField(field, true)
		require.NoError(t, err)

		err = th.App.DeletePropertyField(groupID, created.ID, false)
		require.Error(t, err)

		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "app.property_field.delete.protected.app_error", appErr.Id)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)

		// Verify field still exists
		existing, err := th.App.GetPropertyField(groupID, created.ID)
		require.NoError(t, err)
		assert.NotNil(t, existing)
		assert.Zero(t, existing.DeleteAt)
	})

	t.Run("should allow deleting protected field with bypass", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:   groupID,
			Name:      "Protected Field Bypass Delete",
			Type:      model.PropertyFieldTypeText,
			Protected: true,
			Permissions: &model.PropertyFieldPermissions{
				Field:   model.PermissionLevelNone,
				Values:  model.PermissionLevelMember,
				Options: model.PermissionLevelAdmin,
			},
		}
		created, err := th.App.CreatePropertyField(field, true)
		require.NoError(t, err)

		err = th.App.DeletePropertyField(groupID, created.ID, true)
		require.NoError(t, err)

		// Verify soft deletion (DeleteAt > 0)
		deleted, err := th.App.GetPropertyField(groupID, created.ID)
		require.NoError(t, err)
		assert.NotZero(t, deleted.DeleteAt)
	})
}

func TestGetPropertyField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID, err := th.App.CpaGroupID()
	require.NoError(t, err)

	t.Run("should get an existing field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Field to Get",
			Type:    model.PropertyFieldTypeText,
		}
		created, err := th.App.CreatePropertyField(field, false)
		require.NoError(t, err)

		fetched, err := th.App.GetPropertyField(groupID, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, fetched.ID)
		assert.Equal(t, "Field to Get", fetched.Name)
	})

	t.Run("should return error for non-existent field", func(t *testing.T) {
		_, err := th.App.GetPropertyField(groupID, model.NewId())
		require.Error(t, err)
	})
}

func TestGetPropertyFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID, err := th.App.CpaGroupID()
	require.NoError(t, err)

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

		created1, err := th.App.CreatePropertyField(field1, false)
		require.NoError(t, err)
		created2, err := th.App.CreatePropertyField(field2, false)
		require.NoError(t, err)

		fetched, err := th.App.GetPropertyFields(groupID, []string{created1.ID, created2.ID})
		require.NoError(t, err)
		assert.Len(t, fetched, 2)
	})
}

func TestSearchPropertyFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID, err := th.App.CpaGroupID()
	require.NoError(t, err)

	t.Run("should search for fields", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: groupID,
			Name:    "Searchable Field",
			Type:    model.PropertyFieldTypeText,
		}
		_, err := th.App.CreatePropertyField(field, false)
		require.NoError(t, err)

		opts := model.PropertyFieldSearchOpts{
			GroupID: groupID,
			PerPage: 100,
		}
		results, err := th.App.SearchPropertyFields(groupID, opts)
		require.NoError(t, err)
		assert.NotEmpty(t, results)
	})
}
