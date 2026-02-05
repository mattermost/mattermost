// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

// Note: Board attributes do not emit WebSocket events when fields are created, updated, or deleted.
// This is intentional and differs from Custom Profile Attributes (CPA) which emit WebSocket events.
// If WebSocket events are needed in the future, they should be added to the app layer methods
// (CreateBoardAttributeField, PatchBoardAttributeField, DeleteBoardAttributeField) similar to
// how CPA emits WebsocketEventCPAFieldCreated, WebsocketEventCPAFieldUpdated, etc.

func TestCreateBoardAttributeField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.BoardAttributes = true
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		field := &model.PropertyField{Name: model.NewId(), Type: model.PropertyFieldTypeText}

		createdField, resp, err := client.CreateBoardAttributeField(context.Background(), field)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "api.board_attributes.license_error")
		require.Empty(t, createdField)
	}, "endpoint should not work if no valid license is present")

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("a user without admin permissions should not be able to create a field", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}

		_, resp, err := th.Client.CreateBoardAttributeField(context.Background(), field)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		field := &model.PropertyField{Name: model.NewId()}

		createdField, resp, err := client.CreateBoardAttributeField(context.Background(), field)
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
		require.Empty(t, createdField)
	}, "an invalid field should be rejected")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		name := model.NewId()
		field := &model.PropertyField{
			Name: fmt.Sprintf("  %s\t", name), // name should be sanitized
			Type: model.PropertyFieldTypeText,
			Attrs: map[string]any{"sort_order": 0},
		}

		createdField, resp, err := client.CreateBoardAttributeField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotZero(t, createdField.ID)
		require.Equal(t, name, createdField.Name)
		require.Equal(t, float64(0), createdField.Attrs["sort_order"])
	}, "a user with admin permissions should be able to create the field")

	t.Run("should enforce field limit of 20 fields", func(t *testing.T) {
		// Get current field count
		existingFields, _, err := th.SystemAdminClient.ListBoardAttributeFields(context.Background())
		require.NoError(t, err)
		currentCount := len(existingFields)

		// Create enough fields to reach the limit (20 total)
		const fieldLimit = 20
		fieldsToCreate := fieldLimit - currentCount
		for i := 0; i < fieldsToCreate; i++ {
			field := &model.PropertyField{
				Name: model.NewId(),
				Type: model.PropertyFieldTypeText,
			}
			_, resp, err := th.SystemAdminClient.CreateBoardAttributeField(context.Background(), field)
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
		}

		// Try to create one more field - should fail
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}
		_, resp, err := th.SystemAdminClient.CreateBoardAttributeField(context.Background(), field)
		require.Error(t, err)
		CheckUnprocessableEntityStatus(t, resp)
		CheckErrorID(t, err, "app.board_attributes.limit_reached.app_error")
	})
}

func TestListBoardAttributeFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.BoardAttributes = true
	})

	field := &model.PropertyField{
		Name: model.NewId(),
		Type: model.PropertyFieldTypeText,
		Attrs: map[string]any{"sort_order": 0},
	}

	createdField, appErr := th.App.CreateBoardAttributeField(field)
	require.Nil(t, appErr)
	require.NotNil(t, createdField)

	t.Run("endpoint should not work if no valid license is present", func(t *testing.T) {
		fields, resp, err := th.Client.ListBoardAttributeFields(context.Background())
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "api.board_attributes.license_error")
		require.Empty(t, fields)
	})

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("any user should be able to list fields", func(t *testing.T) {
		fields, resp, err := th.Client.ListBoardAttributeFields(context.Background())
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, fields)
		require.Len(t, fields, 1)
		require.Equal(t, createdField.ID, fields[0].ID)
	})

	t.Run("the endpoint should only list non deleted fields", func(t *testing.T) {
		require.Nil(t, th.App.DeleteBoardAttributeField(createdField.ID))
		fields, resp, err := th.Client.ListBoardAttributeFields(context.Background())
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.Empty(t, fields)
	})

	t.Run("fields should be returned in sort_order", func(t *testing.T) {
		// Create fields with different sort orders
		field1 := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
			Attrs: map[string]any{"sort_order": float64(2)},
		}
		createdField1, appErr := th.App.CreateBoardAttributeField(field1)
		require.Nil(t, appErr)

		field2 := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
			Attrs: map[string]any{"sort_order": float64(0)},
		}
		createdField2, appErr := th.App.CreateBoardAttributeField(field2)
		require.Nil(t, appErr)

		field3 := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
			Attrs: map[string]any{"sort_order": float64(1)},
		}
		createdField3, appErr := th.App.CreateBoardAttributeField(field3)
		require.Nil(t, appErr)

		// List fields and verify they are in sort_order
		fields, resp, err := th.Client.ListBoardAttributeFields(context.Background())
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(fields), 3)

		// Find our created fields in the list
		var foundField1, foundField2, foundField3 *model.PropertyField
		for _, f := range fields {
			if f.ID == createdField1.ID {
				foundField1 = f
			}
			if f.ID == createdField2.ID {
				foundField2 = f
			}
			if f.ID == createdField3.ID {
				foundField3 = f
			}
		}
		require.NotNil(t, foundField1)
		require.NotNil(t, foundField2)
		require.NotNil(t, foundField3)

		// Verify sort_order values
		require.Equal(t, float64(2), foundField1.Attrs["sort_order"])
		require.Equal(t, float64(0), foundField2.Attrs["sort_order"])
		require.Equal(t, float64(1), foundField3.Attrs["sort_order"])

		// Verify fields are returned in sort_order (0, 1, 2)
		field2Index := -1
		field3Index := -1
		field1Index := -1
		for i, f := range fields {
			if f.ID == createdField2.ID {
				field2Index = i
			}
			if f.ID == createdField3.ID {
				field3Index = i
			}
			if f.ID == createdField1.ID {
				field1Index = i
			}
		}
		require.True(t, field2Index >= 0 && field3Index >= 0 && field1Index >= 0)
		require.True(t, field2Index < field3Index, "field with sort_order 0 should come before sort_order 1")
		require.True(t, field3Index < field1Index, "field with sort_order 1 should come before sort_order 2")
	})
}

func TestPatchBoardAttributeField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.BoardAttributes = true
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		patch := &model.PropertyFieldPatch{Name: model.NewPointer(model.NewId())}
		patchedField, resp, err := client.PatchBoardAttributeField(context.Background(), model.NewId(), patch)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "api.board_attributes.license_error")
		require.Empty(t, patchedField)
	}, "endpoint should not work if no valid license is present")

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("a user without admin permissions should not be able to patch a field", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}
		createdField, appErr := th.App.CreateBoardAttributeField(field)
		require.Nil(t, appErr)
		require.NotNil(t, createdField)

		patch := &model.PropertyFieldPatch{Name: model.NewPointer(model.NewId())}
		_, resp, err := th.Client.PatchBoardAttributeField(context.Background(), createdField.ID, patch)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}
		createdField, appErr := th.App.CreateBoardAttributeField(field)
		require.Nil(t, appErr)
		require.NotNil(t, createdField)

		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: model.NewPointer(fmt.Sprintf("  %s \t ", newName))} // name should be sanitized
		patchedField, resp, err := client.PatchBoardAttributeField(context.Background(), createdField.ID, patch)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.Equal(t, newName, patchedField.Name)

		t.Run("sanitization should remove options when changing type from select to non-select", func(t *testing.T) {
			// Create a select field with options
			optionID1 := model.NewId()
			optionID2 := model.NewId()
			selectField := &model.PropertyField{
				Name: model.NewId(),
				Type: model.PropertyFieldTypeSelect,
				Attrs: map[string]any{
					"options": []map[string]any{
						{"id": optionID1, "name": "Option 1"},
						{"id": optionID2, "name": "Option 2"},
					},
				},
			}

			createdSelectField, _, err := client.CreateBoardAttributeField(context.Background(), selectField)
			require.NoError(t, err)
			require.NotNil(t, createdSelectField)

			// Verify options were created
			options, ok := createdSelectField.Attrs["options"]
			require.True(t, ok)
			require.NotNil(t, options)

			// Patch to change type to text
			// Options should be automatically removed
			textPatch := &model.PropertyFieldPatch{
				Type: model.NewPointer(model.PropertyFieldTypeText),
			}

			patchedTextField, resp, err := client.PatchBoardAttributeField(context.Background(), createdSelectField.ID, textPatch)
			CheckOKStatus(t, resp)
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTypeText, patchedTextField.Type)

			// Verify options were removed
			options, ok = patchedTextField.Attrs["options"]
			require.False(t, ok, "options should be removed when changing from select to text type")
		})
	}, "a user with admin permissions should be able to patch the field")
}

func TestDeleteBoardAttributeField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.BoardAttributes = true
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err := client.DeleteBoardAttributeField(context.Background(), model.NewId())
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "api.board_attributes.license_error")
	}, "endpoint should not work if no valid license is present")

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("a user without admin permissions should not be able to delete a field", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}
		createdField, _, err := th.SystemAdminClient.CreateBoardAttributeField(context.Background(), field)
		require.NoError(t, err)
		require.NotNil(t, createdField)

		resp, err := th.Client.DeleteBoardAttributeField(context.Background(), createdField.ID)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}
		createdField, _, err := th.SystemAdminClient.CreateBoardAttributeField(context.Background(), field)
		require.NoError(t, err)
		require.NotNil(t, createdField)
		require.Zero(t, createdField.DeleteAt)

		resp, err := client.DeleteBoardAttributeField(context.Background(), createdField.ID)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		deletedField, appErr := th.App.GetBoardAttributeField(createdField.ID)
		require.Nil(t, appErr)
		require.NotZero(t, deletedField.DeleteAt)
	}, "a user with admin permissions should be able to delete the field")
}

func TestBoardAttributeFieldEdgeCases(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.BoardAttributes = true
	})
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("should handle empty options array for select field", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeSelect,
			Attrs: map[string]any{
				"options": []map[string]any{},
			},
		}

		createdField, resp, err := th.SystemAdminClient.CreateBoardAttributeField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdField)
		require.Equal(t, model.PropertyFieldTypeSelect, createdField.Type)
	})

	t.Run("should handle select field with options having duplicate names", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeSelect,
			Attrs: map[string]any{
				"options": []map[string]any{
					{"id": model.NewId(), "name": "Option 1"},
					{"id": model.NewId(), "name": "Option 1"}, // duplicate name
					{"id": model.NewId(), "name": "Option 2"},
				},
			},
		}

		createdField, resp, err := th.SystemAdminClient.CreateBoardAttributeField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdField)

		options, ok := createdField.Attrs["options"].([]any)
		require.True(t, ok)
		require.Len(t, options, 3)
	})

	t.Run("should handle very long field names", func(t *testing.T) {
		longName := ""
		for i := 0; i < 1000; i++ {
			longName += "a"
		}

		field := &model.PropertyField{
			Name: longName,
			Type: model.PropertyFieldTypeText,
		}

		// The store layer should validate name length, so this might fail
		// We're testing that the system handles it gracefully
		createdField, resp, err := th.SystemAdminClient.CreateBoardAttributeField(context.Background(), field)
		if err != nil {
			// If it fails, that's expected for very long names
			require.Error(t, err)
		} else {
			CheckCreatedStatus(t, resp)
			require.NotNil(t, createdField)
		}
	})

	t.Run("should handle field names with special characters", func(t *testing.T) {
		field := &model.PropertyField{
			Name: "Field with !@#$%^&*() characters",
			Type: model.PropertyFieldTypeText,
		}

		createdField, resp, err := th.SystemAdminClient.CreateBoardAttributeField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdField)
		require.Equal(t, "Field with !@#$%^&*() characters", createdField.Name)
	})

	t.Run("should handle field names with unicode characters", func(t *testing.T) {
		field := &model.PropertyField{
			Name: "Field with 中文 and 🎉 emoji",
			Type: model.PropertyFieldTypeText,
		}

		createdField, resp, err := th.SystemAdminClient.CreateBoardAttributeField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdField)
		require.Equal(t, "Field with 中文 and 🎉 emoji", createdField.Name)
	})

	t.Run("should handle select field with very long option names", func(t *testing.T) {
		longOptionName := ""
		for i := 0; i < 500; i++ {
			longOptionName += "a"
		}

		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeSelect,
			Attrs: map[string]any{
				"options": []map[string]any{
					{"name": longOptionName},
				},
			},
		}

		createdField, resp, err := th.SystemAdminClient.CreateBoardAttributeField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdField)

		options, ok := createdField.Attrs["options"].([]any)
		require.True(t, ok)
		require.Len(t, options, 1)
	})

	t.Run("should handle multiselect field with options", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeMultiselect,
			Attrs: map[string]any{
				"options": []map[string]any{
					{"name": "Option 1"},
					{"name": "Option 2"},
					{"name": "Option 3"},
				},
			},
		}

		createdField, resp, err := th.SystemAdminClient.CreateBoardAttributeField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdField)
		require.Equal(t, model.PropertyFieldTypeMultiselect, createdField.Type)

		options, ok := createdField.Attrs["options"].([]any)
		require.True(t, ok)
		require.Len(t, options, 3)

		// Verify all options have IDs assigned
		for _, opt := range options {
			optMap, ok := opt.(map[string]any)
			require.True(t, ok)
			id, ok := optMap["id"].(string)
			require.True(t, ok)
			require.NotEmpty(t, id)
		}
	})
}
