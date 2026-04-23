// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetCPAField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	cpaID := th.CpaGroupID(t)

	t.Run("should get an existing CPA field", func(t *testing.T) {
		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: cpaID,
			Name:    "Test Field",
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityHidden},
		})
		require.NoError(t, err)

		createdField, appErr := th.CreateCPAField(t, field)
		require.Nil(t, appErr)
		require.NotEmpty(t, createdField.ID)

		fetchedField, appErr := th.GetCPAField(t, createdField.ID)
		require.Nil(t, appErr)
		require.Equal(t, createdField.ID, fetchedField.ID)
		require.Equal(t, "Test Field", fetchedField.Name)
		require.Equal(t, model.CustomProfileAttributesVisibilityHidden, fetchedField.Attrs.Visibility)
	})
}

func TestCreateCPAField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	cpaID := th.CpaGroupID(t)

	rctx := th.emptyContextWithCallerID(anonymousCallerId)

	t.Run("should create CPA field with DeleteAt set to 0 even if input has non-zero DeleteAt", func(t *testing.T) {
		// Create a CPAField with DeleteAt != 0
		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: cpaID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityHidden},
		})
		require.NoError(t, err)

		// Set DeleteAt to non-zero value before creation
		field.DeleteAt = time.Now().UnixMilli()
		require.NotZero(t, field.DeleteAt, "Pre-condition: field should have non-zero DeleteAt")

		createdField, appErr := th.CreateCPAField(t, field)
		require.Nil(t, appErr)
		require.NotZero(t, createdField.ID)
		require.Equal(t, cpaID, createdField.GroupID)

		// Verify that DeleteAt has been reset to 0
		require.Zero(t, createdField.DeleteAt, "DeleteAt should be 0 after creation")

		// Double-check by fetching the field from the database
		fetchedField, gErr := th.App.GetPropertyField(rctx, "", createdField.ID)
		require.Nil(t, gErr)
		require.Zero(t, fetchedField.DeleteAt, "DeleteAt should be 0 in database")
	})

	t.Run("CPA should honor the field limit", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

		t.Run("should not be able to create CPA fields above the limit", func(t *testing.T) {
			// we create the rest of the fields required to reach the limit
			for i := 1; i <= 20; i++ {
				field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
					Name: model.NewId(),
					Type: model.PropertyFieldTypeText,
				})
				require.NoError(t, err)

				createdField, appErr := th.CreateCPAField(t, field)
				require.Nil(t, appErr)
				require.NotZero(t, createdField.ID)
			}

			// then, we create a last one that would exceed the limit
			field := &model.CPAField{
				PropertyField: model.PropertyField{
					Name: model.NewId(),
					Type: model.PropertyFieldTypeText,
				},
			}
			createdField, appErr := th.CreateCPAField(t, field)
			require.NotNil(t, appErr)
			require.Equal(t, http.StatusUnprocessableEntity, appErr.StatusCode)
			require.Zero(t, createdField)
		})

		t.Run("deleted fields should not count for the limit", func(t *testing.T) {
			// we retrieve the list of fields and check we've reached the limit
			fields, appErr := th.ListCPAFields(t)
			require.Nil(t, appErr)
			require.Len(t, fields, 20)

			// then we delete one field
			require.Nil(t, th.DeleteCPAField(t, fields[0].ID))

			// creating a new one should work now
			field := &model.CPAField{
				PropertyField: model.PropertyField{
					Name: model.NewId(),
					Type: model.PropertyFieldTypeText,
				},
			}
			createdField, appErr := th.CreateCPAField(t, field)
			require.Nil(t, appErr)
			require.NotZero(t, createdField.ID)
		})
	})
}

func TestPatchCPAField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	cpaID := th.CpaGroupID(t)

	t.Run("should preserve option IDs when patching select field options", func(t *testing.T) {
		// Create a select field with options
		selectField, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: cpaID,
			Name:    "Select Field",
			Type:    model.PropertyFieldTypeSelect,
			Attrs: map[string]any{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{
						"name":  "Option 1",
						"color": "#111111",
					},
					map[string]any{
						"name":  "Option 2",
						"color": "#222222",
					},
				},
			},
		})
		require.NoError(t, err)

		createdSelectField, appErr := th.CreateCPAField(t, selectField)
		require.Nil(t, appErr)

		// Get the original option IDs
		options := createdSelectField.Attrs.Options
		require.Len(t, options, 2)
		originalID1 := options[0].ID
		originalID2 := options[1].ID
		require.NotEmpty(t, originalID1)
		require.NotEmpty(t, originalID2)

		// Patch the field with updated option names and colors
		selectPatch := &model.PropertyFieldPatch{
			Attrs: model.NewPointer(model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{
						"id":    originalID1,
						"name":  "Updated Option 1",
						"color": "#333333",
					},
					map[string]any{
						"name":  "New Option 1.5",
						"color": "#353535",
					},
					map[string]any{
						"id":    originalID2,
						"name":  "Updated Option 2",
						"color": "#444444",
					},
				},
			}),
		}

		updatedSelectField, appErr := th.PatchCPAField(t, createdSelectField.ID, selectPatch)
		require.Nil(t, appErr)

		updatedOptions := updatedSelectField.Attrs.Options
		require.Len(t, updatedOptions, 3)

		// Verify the options were updated while preserving IDs
		require.Equal(t, originalID1, updatedOptions[0].ID)
		require.Equal(t, "Updated Option 1", updatedOptions[0].Name)
		require.Equal(t, "#333333", updatedOptions[0].Color)
		require.Equal(t, originalID2, updatedOptions[2].ID)
		require.Equal(t, "Updated Option 2", updatedOptions[2].Name)
		require.Equal(t, "#444444", updatedOptions[2].Color)

		// Check the new option
		require.Equal(t, "New Option 1.5", updatedOptions[1].Name)
		require.Equal(t, "#353535", updatedOptions[1].Color)
	})

	t.Run("Should not delete the values of a field after patching it if the type has not changed", func(t *testing.T) {
		// Create a select field with options
		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: cpaID,
			Name:    "Select Field with values",
			Type:    model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{
						"name":  "Option 1",
						"color": "#FF5733",
					},
					map[string]any{
						"name":  "Option 2",
						"color": "#33FF57",
					},
				},
			},
		})
		require.NoError(t, err)
		createdField, appErr := th.CreateCPAField(t, field)
		require.Nil(t, appErr)

		// Get the option IDs
		options := createdField.Attrs.Options
		require.Len(t, options, 2)
		optionID := options[0].ID
		require.NotEmpty(t, optionID)

		// Create values for this field using the first option
		userID := model.NewId()
		value, appErr := th.PatchCPAValue(t, userID, createdField.ID, json.RawMessage(fmt.Sprintf(`"%s"`, optionID)))
		require.Nil(t, appErr)
		require.NotNil(t, value)

		// Patch the field without changing type (just update name and add a new option)
		patch := &model.PropertyFieldPatch{
			Name: model.NewPointer("Updated select field name"),
			Attrs: model.NewPointer(model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{
						"id":    optionID, // Keep the same ID for the first option
						"name":  "Updated Option 1",
						"color": "#FF5733",
					},
					map[string]any{
						"name":  "Option 2",
						"color": "#33FF57",
					},
					map[string]any{
						"name":  "Option 3",
						"color": "#5733FF",
					},
				},
			}),
		}
		updatedField, appErr := th.PatchCPAField(t, createdField.ID, patch)
		require.Nil(t, appErr)
		require.Equal(t, "Updated select field name", updatedField.Name)
		require.Equal(t, model.PropertyFieldTypeSelect, updatedField.Type)

		// Verify values still exist
		values, appErr := th.ListCPAValues(t, userID)
		require.Nil(t, appErr)
		require.Len(t, values, 1)
		require.Equal(t, json.RawMessage(fmt.Sprintf(`"%s"`, optionID)), values[0].Value)
	})
}

func TestGetCPAValue(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	cpaID := th.CpaGroupID(t)

	rctx := th.emptyContextWithCallerID(anonymousCallerId)

	field := &model.PropertyField{
		GroupID:    cpaID,
		Name:       model.NewId(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}
	createdField, err := th.App.CreatePropertyField(rctx, field, false, "")
	require.Nil(t, err)
	fieldID := createdField.ID

	t.Run("should fail if the value doesn't exist", func(t *testing.T) {
		pv, appErr := th.GetCPAValue(t, model.NewId())
		require.NotNil(t, appErr)
		require.Nil(t, pv)
	})

	t.Run("should fail if the group id is invalid", func(t *testing.T) {
		propertyValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: model.PropertyValueTargetTypeUser,
			GroupID:    model.NewId(),
			FieldID:    fieldID,
			Value:      json.RawMessage(`"Value"`),
		}
		created, err := th.App.CreatePropertyValue(rctx, propertyValue)
		require.Nil(t, err)
		require.NotNil(t, created)

		pv, appErr := th.GetCPAValue(t, created.ID)
		require.NotNil(t, appErr)
		require.Nil(t, pv)
	})

	t.Run("should succeed if id exists", func(t *testing.T) {
		propertyValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: model.PropertyValueTargetTypeUser,
			GroupID:    cpaID,
			FieldID:    fieldID,
			Value:      json.RawMessage(`"Value"`),
		}
		propertyValue, err := th.App.CreatePropertyValue(rctx, propertyValue)
		require.Nil(t, err)

		pv, appErr := th.GetCPAValue(t, propertyValue.ID)
		require.Nil(t, appErr)
		require.NotNil(t, pv)
	})

	t.Run("should handle array values correctly", func(t *testing.T) {
		optionIDs := []string{model.NewId(), model.NewId(), model.NewId()}
		arrayField := &model.PropertyField{
			GroupID:    cpaID,
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": optionIDs[0], "name": "option1"},
					map[string]any{"id": optionIDs[1], "name": "option2"},
					map[string]any{"id": optionIDs[2], "name": "option3"},
				},
			},
		}
		createdField, err := th.App.CreatePropertyField(rctx, arrayField, false, "")
		require.Nil(t, err)

		propertyValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: model.PropertyValueTargetTypeUser,
			GroupID:    cpaID,
			FieldID:    createdField.ID,
			Value:      json.RawMessage(fmt.Sprintf(`["%s", "%s", "%s"]`, optionIDs[0], optionIDs[1], optionIDs[2])),
		}
		propertyValue, err = th.App.CreatePropertyValue(rctx, propertyValue)
		require.Nil(t, err)

		pv, appErr := th.GetCPAValue(t, propertyValue.ID)
		require.Nil(t, appErr)
		require.NotNil(t, pv)
		var arrayValues []string
		require.NoError(t, json.Unmarshal(pv.Value, &arrayValues))
		require.Equal(t, optionIDs, arrayValues)
	})
}

func TestListCPAValues(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	cpaID := th.CpaGroupID(t)

	rctx := th.emptyContextWithCallerID(anonymousCallerId)

	userID := model.NewId()

	t.Run("should return empty list when user has no values", func(t *testing.T) {
		values, appErr := th.ListCPAValues(t, userID)
		require.Nil(t, appErr)
		require.Empty(t, values)
	})

	t.Run("should list all values for a user", func(t *testing.T) {
		var expectedValues []json.RawMessage

		for i := 1; i <= 20; i++ {
			field := &model.PropertyField{
				GroupID:    cpaID,
				Name:       fmt.Sprintf("Field %d", i),
				Type:       model.PropertyFieldTypeText,
				ObjectType: model.PropertyFieldObjectTypeUser,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
			}
			_, err := th.App.CreatePropertyField(rctx, field, false, "")
			require.Nil(t, err)

			value := &model.PropertyValue{
				TargetID:   userID,
				TargetType: model.PropertyValueTargetTypeUser,
				GroupID:    cpaID,
				FieldID:    field.ID,
				Value:      json.RawMessage(fmt.Sprintf(`"Value %d"`, i)),
			}
			_, err = th.App.CreatePropertyValue(rctx, value)
			require.Nil(t, err)
			expectedValues = append(expectedValues, value.Value)
		}

		// List values for original user
		values, appErr := th.ListCPAValues(t, userID)
		require.Nil(t, appErr)
		require.Len(t, values, 20)

		actualValues := make([]json.RawMessage, len(values))
		for i, value := range values {
			require.Equal(t, userID, value.TargetID)
			require.Equal(t, "user", value.TargetType)
			require.Equal(t, cpaID, value.GroupID)
			actualValues[i] = value.Value
		}
		require.ElementsMatch(t, expectedValues, actualValues)
	})
}

func TestPatchCPAValue(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	cpaID := th.CpaGroupID(t)

	rctx := th.emptyContextWithCallerID(anonymousCallerId)

	t.Run("should fail if the field doesn't exist", func(t *testing.T) {
		invalidFieldID := model.NewId()
		_, appErr := th.PatchCPAValue(t, model.NewId(), invalidFieldID, json.RawMessage(`"fieldValue"`))
		require.NotNil(t, appErr)
	})

	t.Run("should create value if new field value", func(t *testing.T) {
		newField := &model.PropertyField{
			GroupID:    cpaID,
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		createdField, err := th.App.CreatePropertyField(rctx, newField, false, "")
		require.Nil(t, err)

		userID := model.NewId()
		patchedValue, appErr := th.PatchCPAValue(t, userID, createdField.ID, json.RawMessage(`"test value"`))
		require.Nil(t, appErr)
		require.NotNil(t, patchedValue)
		require.Equal(t, json.RawMessage(`"test value"`), patchedValue.Value)
		require.Equal(t, userID, patchedValue.TargetID)

		t.Run("should correctly patch the CPA property value", func(t *testing.T) {
			patch2, appErr := th.PatchCPAValue(t, userID, createdField.ID, json.RawMessage(`"new patched value"`))
			require.Nil(t, appErr)
			require.NotNil(t, patch2)
			require.Equal(t, patchedValue.ID, patch2.ID)
			require.Equal(t, json.RawMessage(`"new patched value"`), patch2.Value)
			require.Equal(t, userID, patch2.TargetID)
		})
	})

	t.Run("should fail if field is deleted", func(t *testing.T) {
		newField := &model.PropertyField{
			GroupID:    cpaID,
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		createdField, err := th.App.CreatePropertyField(rctx, newField, false, "")
		require.Nil(t, err)
		err = th.App.DeletePropertyField(rctx, cpaID, createdField.ID, false, "")
		require.Nil(t, err)

		userID := model.NewId()
		patchedValue, appErr := th.PatchCPAValue(t, userID, createdField.ID, json.RawMessage(`"test value"`))
		require.NotNil(t, appErr)
		require.Nil(t, patchedValue)
	})

	t.Run("should handle array values correctly", func(t *testing.T) {
		optionsID := []string{model.NewId(), model.NewId(), model.NewId(), model.NewId()}
		arrayField := &model.PropertyField{
			GroupID:    cpaID,
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": optionsID[0], "name": "option1"},
					{"id": optionsID[1], "name": "option2"},
					{"id": optionsID[2], "name": "option3"},
					{"id": optionsID[3], "name": "option4"},
				},
			},
		}
		createdField, err := th.App.CreatePropertyField(rctx, arrayField, false, "")
		require.Nil(t, err)

		// Create a JSON array with option IDs (not names)
		optionJSON := fmt.Sprintf(`["%s", "%s", "%s"]`, optionsID[0], optionsID[1], optionsID[2])

		userID := model.NewId()
		patchedValue, appErr := th.PatchCPAValue(t, userID, createdField.ID, json.RawMessage(optionJSON))
		require.Nil(t, appErr)
		require.NotNil(t, patchedValue)
		var arrayValues []string
		require.NoError(t, json.Unmarshal(patchedValue.Value, &arrayValues))
		require.Equal(t, []string{optionsID[0], optionsID[1], optionsID[2]}, arrayValues)
		require.Equal(t, userID, patchedValue.TargetID)

		// Update array values with valid option IDs
		updatedOptionJSON := fmt.Sprintf(`["%s", "%s"]`, optionsID[1], optionsID[3])
		updatedValue, appErr := th.PatchCPAValue(t, userID, createdField.ID, json.RawMessage(updatedOptionJSON))
		require.Nil(t, appErr)
		require.NotNil(t, updatedValue)
		require.Equal(t, patchedValue.ID, updatedValue.ID)
		arrayValues = nil
		require.NoError(t, json.Unmarshal(updatedValue.Value, &arrayValues))
		require.Equal(t, []string{optionsID[1], optionsID[3]}, arrayValues)
		require.Equal(t, userID, updatedValue.TargetID)

		t.Run("should fail if it tries to set a value that not valid for a field", func(t *testing.T) {
			// Try to use an ID that doesn't exist in the options
			invalidID := model.NewId()
			invalidOptionJSON := fmt.Sprintf(`["%s", "%s"]`, optionsID[0], invalidID)

			invalidValue, appErr := th.PatchCPAValue(t, userID, createdField.ID, json.RawMessage(invalidOptionJSON))
			require.NotNil(t, appErr)
			require.Nil(t, invalidValue)

			// Test with completely invalid JSON format
			invalidJSON := `[not valid json]`
			invalidValue, appErr = th.PatchCPAValue(t, userID, createdField.ID, json.RawMessage(invalidJSON))
			require.NotNil(t, appErr)
			require.Nil(t, invalidValue)

			// Test with wrong data type (sending string instead of array)
			wrongTypeJSON := `"not an array"`
			invalidValue, appErr = th.PatchCPAValue(t, userID, createdField.ID, json.RawMessage(wrongTypeJSON))
			require.NotNil(t, appErr)
			require.Nil(t, invalidValue)
		})
	})
}

func TestDeleteCPAValues(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	cpaID := th.CpaGroupID(t)

	userID := model.NewId()
	otherUserID := model.NewId()

	// Create multiple fields and values for the user
	var createdFields []*model.CPAField
	for i := 1; i <= 3; i++ {
		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: cpaID,
			Name:    fmt.Sprintf("Field %d", i),
			Type:    model.PropertyFieldTypeText,
		})
		require.NoError(t, err)
		createdField, appErr := th.CreateCPAField(t, field)
		require.Nil(t, appErr)
		createdFields = append(createdFields, createdField)

		// Create a value for this field
		value, appErr := th.PatchCPAValue(t, userID, createdField.ID, json.RawMessage(fmt.Sprintf(`"Value %d"`, i)))
		require.Nil(t, appErr)
		require.NotNil(t, value)
	}

	// Verify values exist before deletion
	values, appErr := th.ListCPAValues(t, userID)
	require.Nil(t, appErr)
	require.Len(t, values, 3)

	// Test deleting values for user
	t.Run("should delete all values for a user", func(t *testing.T) {
		appErr := th.DeleteCPAValues(t, userID)
		require.Nil(t, appErr)

		// Verify values are gone
		values, appErr := th.ListCPAValues(t, userID)
		require.Nil(t, appErr)
		require.Empty(t, values)
	})

	t.Run("should handle deleting values for a user with no values", func(t *testing.T) {
		appErr := th.DeleteCPAValues(t, otherUserID)
		require.Nil(t, appErr)
	})

	t.Run("should not affect values for other users", func(t *testing.T) {
		// Create values for another user
		for _, field := range createdFields {
			value, appErr := th.PatchCPAValue(t, otherUserID, field.ID, json.RawMessage(`"Other user value"`))
			require.Nil(t, appErr)
			require.NotNil(t, value)
		}

		// Delete values for original user
		appErr := th.DeleteCPAValues(t, userID)
		require.Nil(t, appErr)

		// Verify other user's values still exist
		values, appErr := th.ListCPAValues(t, otherUserID)
		require.Nil(t, appErr)
		require.Len(t, values, 3)
	})
}
