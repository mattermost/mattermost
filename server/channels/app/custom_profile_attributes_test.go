// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGetCPAField(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.CpaGroupID()
	require.NoError(t, cErr)

	t.Run("should fail when getting a non-existent field", func(t *testing.T) {
		field, appErr := th.App.GetCPAField(model.NewId())
		require.NotNil(t, appErr)
		require.Equal(t, "app.custom_profile_attributes.property_field_not_found.app_error", appErr.Id)
		require.Empty(t, field)
	})

	t.Run("should fail when getting a field from a different group", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}
		createdField, err := th.App.Srv().propertyService.CreatePropertyField(field)
		require.NoError(t, err)

		fetchedField, appErr := th.App.GetCPAField(createdField.ID)
		require.NotNil(t, appErr)
		require.Equal(t, "app.custom_profile_attributes.property_field_not_found.app_error", appErr.Id)
		require.Empty(t, fetchedField)
	})

	t.Run("should get an existing CPA field", func(t *testing.T) {
		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: cpaGroupID,
			Name:    "Test Field",
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityHidden},
		})
		require.NoError(t, err)

		createdField, appErr := th.App.CreateCPAField(field)
		require.Nil(t, appErr)
		require.NotEmpty(t, createdField.ID)

		fetchedField, appErr := th.App.GetCPAField(createdField.ID)
		require.Nil(t, appErr)
		require.Equal(t, createdField.ID, fetchedField.ID)
		require.Equal(t, "Test Field", fetchedField.Name)
		require.Equal(t, model.CustomProfileAttributesVisibilityHidden, fetchedField.Attrs["visibility"])
	})

	t.Run("should validate LDAP/SAML synced fields", func(t *testing.T) {
		// Create LDAP synced field
		ldapField, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: cpaGroupID,
			Name:    "LDAP Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsLDAP: "ldap_attribute",
			},
		})
		require.NoError(t, err)
		createdLDAPField, appErr := th.App.CreateCPAField(ldapField)
		require.Nil(t, appErr)

		// Create SAML synced field
		samlField, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: cpaGroupID,
			Name:    "SAML Field",
			Type:    model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsSAML: "saml_attribute",
			},
		})
		require.NoError(t, err)
		createdSAMLField, appErr := th.App.CreateCPAField(samlField)
		require.Nil(t, appErr)

		// Test with allowSynced=false
		userID := model.NewId()

		// Test LDAP field
		_, appErr = th.App.PatchCPAValue(userID, createdLDAPField.ID, json.RawMessage(`"test value"`), false)
		require.NotNil(t, appErr)
		require.Equal(t, "app.custom_profile_attributes.property_field_is_synced.app_error", appErr.Id)

		// Test SAML field
		_, appErr = th.App.PatchCPAValue(userID, createdSAMLField.ID, json.RawMessage(`"test value"`), false)
		require.NotNil(t, appErr)
		require.Equal(t, "app.custom_profile_attributes.property_field_is_synced.app_error", appErr.Id)

		// Test with allowSynced=true
		// LDAP field should work
		patchedValue, appErr := th.App.PatchCPAValue(userID, createdLDAPField.ID, json.RawMessage(`"test value"`), true)
		require.Nil(t, appErr)
		require.NotNil(t, patchedValue)
		require.Equal(t, json.RawMessage(`"test value"`), patchedValue.Value)

		// SAML field should work
		patchedValue, appErr = th.App.PatchCPAValue(userID, createdSAMLField.ID, json.RawMessage(`"test value"`), true)
		require.Nil(t, appErr)
		require.NotNil(t, patchedValue)
		require.Equal(t, json.RawMessage(`"test value"`), patchedValue.Value)
	})
}

func TestListCPAFields(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.CpaGroupID()
	require.NoError(t, cErr)

	t.Run("should list the CPA property fields", func(t *testing.T) {
		field1 := model.PropertyField{
			GroupID: cpaGroupID,
			Name:    "Field 1",
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{model.CustomProfileAttributesPropertyAttrsSortOrder: 1},
		}

		_, err := th.App.Srv().propertyService.CreatePropertyField(&field1)
		require.NoError(t, err)

		field2 := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "Field 2",
			Type:    model.PropertyFieldTypeText,
		}
		_, err = th.App.Srv().propertyService.CreatePropertyField(field2)
		require.NoError(t, err)

		field3 := model.PropertyField{
			GroupID: cpaGroupID,
			Name:    "Field 3",
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{model.CustomProfileAttributesPropertyAttrsSortOrder: 0},
		}
		_, err = th.App.Srv().propertyService.CreatePropertyField(&field3)
		require.NoError(t, err)

		fields, appErr := th.App.ListCPAFields()
		require.Nil(t, appErr)
		require.Len(t, fields, 2)
		require.Equal(t, "Field 3", fields[0].Name)
		require.Equal(t, "Field 1", fields[1].Name)
	})
}

func TestCreateCPAField(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()

	cpaGroupID, cErr := th.App.CpaGroupID()
	require.NoError(t, cErr)

	t.Run("should fail if the field is not valid", func(t *testing.T) {
		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{Name: model.NewId()})
		require.NoError(t, err)

		createdField, err := th.App.CreateCPAField(field)
		require.Error(t, err)
		require.Empty(t, createdField)
	})

	t.Run("should not be able to create a property field for a different feature", func(t *testing.T) {
		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: model.NewId(),
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		})
		require.NoError(t, err)

		createdField, appErr := th.App.CreateCPAField(field)
		require.Nil(t, appErr)
		require.Equal(t, cpaGroupID, createdField.GroupID)
	})

	t.Run("should correctly create a CPA field", func(t *testing.T) {
		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: cpaGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs:   model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityHidden},
		})
		require.NoError(t, err)

		createdField, appErr := th.App.CreateCPAField(field)
		require.Nil(t, appErr)
		require.NotZero(t, createdField.ID)
		require.Equal(t, cpaGroupID, createdField.GroupID)
		require.Equal(t, model.CustomProfileAttributesVisibilityHidden, createdField.Attrs["visibility"])

		fetchedField, gErr := th.App.Srv().propertyService.GetPropertyField("", createdField.ID)
		require.NoError(t, gErr)
		require.Equal(t, field.Name, fetchedField.Name)
		require.NotZero(t, fetchedField.CreateAt)
		require.Equal(t, fetchedField.CreateAt, fetchedField.UpdateAt)
	})

	// reset the server at this point to avoid polluting the state
	th.TearDown()

	t.Run("CPA should honor the field limit", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		t.Run("should not be able to create CPA fields above the limit", func(t *testing.T) {
			// we create the rest of the fields required to reach the limit
			for i := 1; i <= CustomProfileAttributesFieldLimit; i++ {
				field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
					Name: model.NewId(),
					Type: model.PropertyFieldTypeText,
				})
				require.NoError(t, err)

				createdField, appErr := th.App.CreateCPAField(field)
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
			createdField, appErr := th.App.CreateCPAField(field)
			require.NotNil(t, appErr)
			require.Equal(t, http.StatusUnprocessableEntity, appErr.StatusCode)
			require.Zero(t, createdField)
		})

		t.Run("deleted fields should not count for the limit", func(t *testing.T) {
			// we retrieve the list of fields and check we've reached the limit
			fields, appErr := th.App.ListCPAFields()
			require.Nil(t, appErr)
			require.Len(t, fields, CustomProfileAttributesFieldLimit)

			// then we delete one field
			require.Nil(t, th.App.DeleteCPAField(fields[0].ID))

			// creating a new one should work now
			field := &model.CPAField{
				PropertyField: model.PropertyField{
					Name: model.NewId(),
					Type: model.PropertyFieldTypeText,
				},
			}
			createdField, appErr := th.App.CreateCPAField(field)
			require.Nil(t, appErr)
			require.NotZero(t, createdField.ID)
		})
	})
}

func TestPatchCPAField(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.CpaGroupID()
	require.NoError(t, cErr)

	newField, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
		GroupID: cpaGroupID,
		Name:    model.NewId(),
		Type:    model.PropertyFieldTypeText,
		Attrs:   model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityHidden},
	})
	require.NoError(t, err)

	createdField, appErr := th.App.CreateCPAField(newField)
	require.Nil(t, appErr)

	patch := &model.PropertyFieldPatch{
		Name:       model.NewPointer("Patched name"),
		Attrs:      model.NewPointer(model.StringInterface{model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityWhenSet}),
		TargetID:   model.NewPointer(model.NewId()),
		TargetType: model.NewPointer(model.NewId()),
	}

	t.Run("should fail if the field doesn't exist", func(t *testing.T) {
		updatedField, appErr := th.App.PatchCPAField(model.NewId(), patch)
		require.NotNil(t, appErr)
		require.Empty(t, updatedField)
	})

	t.Run("should not allow to patch a field outside of CPA", func(t *testing.T) {
		newField := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}

		field, err := th.App.Srv().propertyService.CreatePropertyField(newField)
		require.NoError(t, err)

		updatedField, uErr := th.App.PatchCPAField(field.ID, patch)
		require.NotNil(t, uErr)
		require.Equal(t, "app.custom_profile_attributes.property_field_not_found.app_error", uErr.Id)
		require.Empty(t, updatedField)
	})

	t.Run("should correctly patch the CPA property field", func(t *testing.T) {
		time.Sleep(10 * time.Millisecond) // ensure the UpdateAt is different than CreateAt

		updatedField, appErr := th.App.PatchCPAField(createdField.ID, patch)
		require.Nil(t, appErr)
		require.Equal(t, createdField.ID, updatedField.ID)
		require.Equal(t, "Patched name", updatedField.Name)
		require.Equal(t, model.CustomProfileAttributesVisibilityWhenSet, updatedField.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
		require.Empty(t, updatedField.TargetID, "CPA should not allow to patch the field's target ID")
		require.Empty(t, updatedField.TargetType, "CPA should not allow to patch the field's target type")
		require.Greater(t, updatedField.UpdateAt, createdField.UpdateAt)
	})

	t.Run("should preserve option IDs when patching select field options", func(t *testing.T) {
		// Create a select field with options
		selectField, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: cpaGroupID,
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

		createdSelectField, appErr := th.App.CreateCPAField(selectField)
		require.Nil(t, appErr)

		// Get the original option IDs
		options := createdSelectField.Attrs[model.PropertyFieldAttributeOptions].(model.PropertyOptions[*model.CustomProfileAttributesSelectOption])
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

		updatedSelectField, appErr := th.App.PatchCPAField(createdSelectField.ID, selectPatch)
		require.Nil(t, appErr)

		updatedOptions := updatedSelectField.Attrs[model.PropertyFieldAttributeOptions].(model.PropertyOptions[*model.CustomProfileAttributesSelectOption])
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
}

func TestDeleteCPAField(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.CpaGroupID()
	require.NoError(t, cErr)

	newField, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
		GroupID: cpaGroupID,
		Name:    model.NewId(),
		Type:    model.PropertyFieldTypeText,
	})
	require.NoError(t, err)

	createdField, appErr := th.App.CreateCPAField(newField)
	require.Nil(t, appErr)

	for i := range 3 {
		newValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "user",
			GroupID:    cpaGroupID,
			FieldID:    createdField.ID,
			Value:      json.RawMessage(fmt.Sprintf(`"Value %d"`, i)),
		}
		value, err := th.App.Srv().propertyService.CreatePropertyValue(newValue)
		require.NoError(t, err)
		require.NotZero(t, value.ID)
	}

	t.Run("should fail if the field doesn't exist", func(t *testing.T) {
		err := th.App.DeleteCPAField(model.NewId())
		require.NotNil(t, err)
		require.Equal(t, "app.custom_profile_attributes.property_field_delete.app_error", err.Id)
	})

	t.Run("should not allow to delete a field outside of CPA", func(t *testing.T) {
		newField := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}
		field, err := th.App.Srv().propertyService.CreatePropertyField(newField)
		require.NoError(t, err)

		dErr := th.App.DeleteCPAField(field.ID)
		require.NotNil(t, dErr)
		require.Equal(t, "app.custom_profile_attributes.property_field_delete.app_error", dErr.Id)
	})

	t.Run("should correctly delete the field", func(t *testing.T) {
		// check that we have the associated values to the field prior deletion
		opts := model.PropertyValueSearchOpts{PerPage: 10, FieldID: createdField.ID}
		values, err := th.App.Srv().propertyService.SearchPropertyValues(cpaGroupID, "", opts)
		require.NoError(t, err)
		require.Len(t, values, 3)

		// delete the field
		require.Nil(t, th.App.DeleteCPAField(createdField.ID))

		// check that it is marked as deleted
		fetchedField, err := th.App.Srv().propertyService.GetPropertyField("", createdField.ID)
		require.NoError(t, err)
		require.NotZero(t, fetchedField.DeleteAt)

		// ensure that the associated fields have been marked as deleted too
		values, err = th.App.Srv().propertyService.SearchPropertyValues(cpaGroupID, "", opts)
		require.NoError(t, err)
		require.Len(t, values, 0)

		opts.IncludeDeleted = true
		values, err = th.App.Srv().propertyService.SearchPropertyValues(cpaGroupID, "", opts)
		require.NoError(t, err)
		require.Len(t, values, 3)
		for _, value := range values {
			require.NotZero(t, value.DeleteAt)
		}
	})
}

func TestGetCPAValue(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.CpaGroupID()
	require.NoError(t, cErr)

	fieldID := model.NewId()

	t.Run("should fail if the value doesn't exist", func(t *testing.T) {
		pv, appErr := th.App.GetCPAValue(model.NewId())
		require.NotNil(t, appErr)
		require.Nil(t, pv)
	})

	t.Run("should fail if the group id is invalid", func(t *testing.T) {
		propertyValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "user",
			GroupID:    model.NewId(),
			FieldID:    fieldID,
			Value:      json.RawMessage(`"Value"`),
		}
		propertyValue, err := th.App.Srv().propertyService.CreatePropertyValue(propertyValue)
		require.NoError(t, err)

		pv, appErr := th.App.GetCPAValue(propertyValue.ID)
		require.NotNil(t, appErr)
		require.Nil(t, pv)
	})

	t.Run("should succeed if id exists", func(t *testing.T) {
		propertyValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "user",
			GroupID:    cpaGroupID,
			FieldID:    fieldID,
			Value:      json.RawMessage(`"Value"`),
		}
		propertyValue, err := th.App.Srv().propertyService.CreatePropertyValue(propertyValue)
		require.NoError(t, err)

		pv, appErr := th.App.GetCPAValue(propertyValue.ID)
		require.Nil(t, appErr)
		require.NotNil(t, pv)
	})

	t.Run("should handle array values correctly", func(t *testing.T) {
		arrayField := &model.PropertyField{
			GroupID: cpaGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeMultiselect,
		}
		createdField, err := th.App.Srv().propertyService.CreatePropertyField(arrayField)
		require.NoError(t, err)

		propertyValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: "user",
			GroupID:    cpaGroupID,
			FieldID:    createdField.ID,
			Value:      json.RawMessage(`["option1", "option2", "option3"]`),
		}
		propertyValue, err = th.App.Srv().propertyService.CreatePropertyValue(propertyValue)
		require.NoError(t, err)

		pv, appErr := th.App.GetCPAValue(propertyValue.ID)
		require.Nil(t, appErr)
		require.NotNil(t, pv)
		var arrayValues []string
		require.NoError(t, json.Unmarshal(pv.Value, &arrayValues))
		require.Equal(t, []string{"option1", "option2", "option3"}, arrayValues)
	})
}

func TestListCPAValues(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.CpaGroupID()
	require.NoError(t, cErr)

	userID := model.NewId()

	t.Run("should return empty list when user has no values", func(t *testing.T) {
		values, appErr := th.App.ListCPAValues(userID)
		require.Nil(t, appErr)
		require.Empty(t, values)
	})

	t.Run("should list all values for a user", func(t *testing.T) {
		var expectedValues []json.RawMessage

		for i := 1; i <= CustomProfileAttributesFieldLimit; i++ {
			field := &model.PropertyField{
				GroupID: cpaGroupID,
				Name:    fmt.Sprintf("Field %d", i),
				Type:    model.PropertyFieldTypeText,
			}
			_, err := th.App.Srv().propertyService.CreatePropertyField(field)
			require.NoError(t, err)

			value := &model.PropertyValue{
				TargetID:   userID,
				TargetType: "user",
				GroupID:    cpaGroupID,
				FieldID:    field.ID,
				Value:      json.RawMessage(fmt.Sprintf(`"Value %d"`, i)),
			}
			_, err = th.App.Srv().propertyService.CreatePropertyValue(value)
			require.NoError(t, err)
			expectedValues = append(expectedValues, value.Value)
		}

		// List values for original user
		values, appErr := th.App.ListCPAValues(userID)
		require.Nil(t, appErr)
		require.Len(t, values, CustomProfileAttributesFieldLimit)

		actualValues := make([]json.RawMessage, len(values))
		for i, value := range values {
			require.Equal(t, userID, value.TargetID)
			require.Equal(t, "user", value.TargetType)
			require.Equal(t, cpaGroupID, value.GroupID)
			actualValues[i] = value.Value
		}
		require.ElementsMatch(t, expectedValues, actualValues)
	})
}

func TestPatchCPAValue(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.CpaGroupID()
	require.NoError(t, cErr)

	t.Run("should fail if the field doesn't exist", func(t *testing.T) {
		invalidFieldID := model.NewId()
		_, appErr := th.App.PatchCPAValue(model.NewId(), invalidFieldID, json.RawMessage(`"fieldValue"`), true)
		require.NotNil(t, appErr)
	})

	t.Run("should create value if new field value", func(t *testing.T) {
		newField := &model.PropertyField{
			GroupID: cpaGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}
		createdField, err := th.App.Srv().propertyService.CreatePropertyField(newField)
		require.NoError(t, err)

		userID := model.NewId()
		patchedValue, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(`"test value"`), true)
		require.Nil(t, appErr)
		require.NotNil(t, patchedValue)
		require.Equal(t, json.RawMessage(`"test value"`), patchedValue.Value)
		require.Equal(t, userID, patchedValue.TargetID)

		t.Run("should correctly patch the CPA property value", func(t *testing.T) {
			patch2, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(`"new patched value"`), true)
			require.Nil(t, appErr)
			require.NotNil(t, patch2)
			require.Equal(t, patchedValue.ID, patch2.ID)
			require.Equal(t, json.RawMessage(`"new patched value"`), patch2.Value)
			require.Equal(t, userID, patch2.TargetID)
		})
	})

	t.Run("should fail if field is deleted", func(t *testing.T) {
		newField := &model.PropertyField{
			GroupID: cpaGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}
		createdField, err := th.App.Srv().propertyService.CreatePropertyField(newField)
		require.NoError(t, err)
		err = th.App.Srv().propertyService.DeletePropertyField(cpaGroupID, createdField.ID)
		require.NoError(t, err)

		userID := model.NewId()
		patchedValue, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(`"test value"`), true)
		require.NotNil(t, appErr)
		require.Nil(t, patchedValue)
	})

	t.Run("should handle array values correctly", func(t *testing.T) {
		optionsID := []string{model.NewId(), model.NewId(), model.NewId(), model.NewId()}
		arrayField := &model.PropertyField{
			GroupID: cpaGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeMultiselect,
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": optionsID[0], "name": "option1"},
					{"id": optionsID[1], "name": "option2"},
					{"id": optionsID[2], "name": "option3"},
					{"id": optionsID[3], "name": "option4"},
				},
			},
		}
		createdField, err := th.App.Srv().propertyService.CreatePropertyField(arrayField)
		require.NoError(t, err)

		// Create a JSON array with option IDs (not names)
		optionJSON := fmt.Sprintf(`["%s", "%s", "%s"]`, optionsID[0], optionsID[1], optionsID[2])

		userID := model.NewId()
		patchedValue, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(optionJSON), true)
		require.Nil(t, appErr)
		require.NotNil(t, patchedValue)
		var arrayValues []string
		require.NoError(t, json.Unmarshal(patchedValue.Value, &arrayValues))
		require.Equal(t, []string{optionsID[0], optionsID[1], optionsID[2]}, arrayValues)
		require.Equal(t, userID, patchedValue.TargetID)

		// Update array values with valid option IDs
		updatedOptionJSON := fmt.Sprintf(`["%s", "%s"]`, optionsID[1], optionsID[3])
		updatedValue, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(updatedOptionJSON), true)
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

			invalidValue, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(invalidOptionJSON), true)
			require.NotNil(t, appErr)
			require.Nil(t, invalidValue)
			require.Equal(t, "app.custom_profile_attributes.validate_value.app_error", appErr.Id)

			// Test with completely invalid JSON format
			invalidJSON := `[not valid json]`
			invalidValue, appErr = th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(invalidJSON), true)
			require.NotNil(t, appErr)
			require.Nil(t, invalidValue)
			require.Equal(t, "app.custom_profile_attributes.validate_value.app_error", appErr.Id)

			// Test with wrong data type (sending string instead of array)
			wrongTypeJSON := `"not an array"`
			invalidValue, appErr = th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(wrongTypeJSON), true)
			require.NotNil(t, appErr)
			require.Nil(t, invalidValue)
			require.Equal(t, "app.custom_profile_attributes.validate_value.app_error", appErr.Id)
		})
	})
}

func TestDeleteCPAValues(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.CpaGroupID()
	require.NoError(t, cErr)

	userID := model.NewId()
	otherUserID := model.NewId()

	// Create multiple fields and values for the user
	var createdFields []*model.PropertyField
	for i := 1; i <= 3; i++ {
		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			GroupID: cpaGroupID,
			Name:    fmt.Sprintf("Field %d", i),
			Type:    model.PropertyFieldTypeText,
		})
		require.NoError(t, err)
		createdField, appErr := th.App.CreateCPAField(field)
		require.Nil(t, appErr)
		createdFields = append(createdFields, createdField)

		// Create a value for this field
		value, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(fmt.Sprintf(`"Value %d"`, i)), false)
		require.Nil(t, appErr)
		require.NotNil(t, value)
	}

	// Verify values exist before deletion
	values, appErr := th.App.ListCPAValues(userID)
	require.Nil(t, appErr)
	require.Len(t, values, 3)

	// Test deleting values for user
	t.Run("should delete all values for a user", func(t *testing.T) {
		appErr := th.App.DeleteCPAValues(userID)
		require.Nil(t, appErr)

		// Verify values are gone
		values, appErr := th.App.ListCPAValues(userID)
		require.Nil(t, appErr)
		require.Empty(t, values)
	})

	t.Run("should handle deleting values for a user with no values", func(t *testing.T) {
		appErr := th.App.DeleteCPAValues(otherUserID)
		require.Nil(t, appErr)
	})

	t.Run("should not affect values for other users", func(t *testing.T) {
		// Create values for another user
		for _, field := range createdFields {
			value, appErr := th.App.PatchCPAValue(otherUserID, field.ID, json.RawMessage(`"Other user value"`), false)
			require.Nil(t, appErr)
			require.NotNil(t, value)
		}

		// Delete values for original user
		appErr := th.App.DeleteCPAValues(userID)
		require.Nil(t, appErr)

		// Verify other user's values still exist
		values, appErr := th.App.ListCPAValues(otherUserID)
		require.Nil(t, appErr)
		require.Len(t, values, 3)
	})
}
