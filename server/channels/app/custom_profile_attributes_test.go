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

	cpaGroupID, cErr := th.App.cpaGroupID()
	require.NoError(t, cErr)

	t.Run("should fail when getting a non-existent field", func(t *testing.T) {
		field, err := th.App.GetCPAField(model.NewId())
		require.NotNil(t, err)
		require.Equal(t, "app.custom_profile_attributes.get_property_field.app_error", err.Id)
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
		field := &model.PropertyField{
			GroupID: cpaGroupID,
			Name:    "Test Field",
			Type:    model.PropertyFieldTypeText,
			Attrs:   map[string]any{"visibility": "hidden"},
		}

		createdField, err := th.App.CreateCPAField(field)
		require.Nil(t, err)
		require.NotEmpty(t, createdField.ID)

		fetchedField, err := th.App.GetCPAField(createdField.ID)
		require.Nil(t, err)
		require.Equal(t, createdField.ID, fetchedField.ID)
		require.Equal(t, "Test Field", fetchedField.Name)
		require.Equal(t, model.StringInterface{"visibility": "hidden"}, fetchedField.Attrs)
	})
}

func TestListCPAFields(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.cpaGroupID()
	require.NoError(t, cErr)

	t.Run("should list the CPA property fields", func(t *testing.T) {
		field1 := &model.PropertyField{
			GroupID: cpaGroupID,
			Name:    "Field 1",
			Type:    model.PropertyFieldTypeText,
		}

		_, err := th.App.Srv().propertyService.CreatePropertyField(field1)
		require.NoError(t, err)

		field2 := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    "Field 2",
			Type:    model.PropertyFieldTypeText,
		}
		_, err = th.App.Srv().propertyService.CreatePropertyField(field2)
		require.NoError(t, err)

		field3 := &model.PropertyField{
			GroupID: cpaGroupID,
			Name:    "Field 3",
			Type:    model.PropertyFieldTypeText,
		}
		_, err = th.App.Srv().propertyService.CreatePropertyField(field3)
		require.NoError(t, err)

		fields, appErr := th.App.ListCPAFields()
		require.Nil(t, appErr)
		require.Len(t, fields, 2)

		fieldNames := []string{}
		for _, field := range fields {
			fieldNames = append(fieldNames, field.Name)
		}
		require.ElementsMatch(t, []string{"Field 1", "Field 3"}, fieldNames)
	})
}

func TestCreateCPAField(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()

	cpaGroupID, cErr := th.App.cpaGroupID()
	require.NoError(t, cErr)

	t.Run("should fail if the field is not valid", func(t *testing.T) {
		field := &model.PropertyField{Name: model.NewId()}

		createdField, err := th.App.CreateCPAField(field)
		require.NotNil(t, err)
		require.Empty(t, createdField)
	})

	t.Run("should not be able to create a property field for a different feature", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: model.NewId(),
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
		}

		createdField, appErr := th.App.CreateCPAField(field)
		require.Nil(t, appErr)
		require.Equal(t, cpaGroupID, createdField.GroupID)
	})

	t.Run("should correctly create a CPA field", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID: cpaGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeText,
			Attrs:   map[string]any{"visibility": "hidden"},
		}

		createdField, err := th.App.CreateCPAField(field)
		require.Nil(t, err)
		require.NotZero(t, createdField.ID)
		require.Equal(t, cpaGroupID, createdField.GroupID)
		require.Equal(t, model.StringInterface{"visibility": "hidden"}, createdField.Attrs)

		fetchedField, gErr := th.App.Srv().propertyService.GetPropertyField(createdField.ID)
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
				field := &model.PropertyField{
					Name: model.NewId(),
					Type: model.PropertyFieldTypeText,
				}
				createdField, err := th.App.CreateCPAField(field)
				require.Nil(t, err)
				require.NotZero(t, createdField.ID)
			}

			// then, we create a last one that would exceed the limit
			field := &model.PropertyField{
				Name: model.NewId(),
				Type: model.PropertyFieldTypeText,
			}
			createdField, err := th.App.CreateCPAField(field)
			require.NotNil(t, err)
			require.Equal(t, http.StatusUnprocessableEntity, err.StatusCode)
			require.Zero(t, createdField)
		})

		t.Run("deleted fields should not count for the limit", func(t *testing.T) {
			// we retrieve the list of fields and check we've reached the limit
			fields, err := th.App.ListCPAFields()
			require.Nil(t, err)
			require.Len(t, fields, CustomProfileAttributesFieldLimit)

			// then we delete one field
			require.Nil(t, th.App.DeleteCPAField(fields[0].ID))

			// creating a new one should work now
			field := &model.PropertyField{
				Name: model.NewId(),
				Type: model.PropertyFieldTypeText,
			}
			createdField, err := th.App.CreateCPAField(field)
			require.Nil(t, err)
			require.NotZero(t, createdField.ID)
		})
	})
}

func TestPatchCPAField(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.cpaGroupID()
	require.NoError(t, cErr)

	newField := &model.PropertyField{
		GroupID: cpaGroupID,
		Name:    model.NewId(),
		Type:    model.PropertyFieldTypeText,
		Attrs:   map[string]any{"visibility": "hidden"},
	}
	createdField, err := th.App.CreateCPAField(newField)
	require.Nil(t, err)

	patch := &model.PropertyFieldPatch{
		Name:       model.NewPointer("Patched name"),
		Attrs:      model.NewPointer(map[string]any{"visibility": "default"}),
		TargetID:   model.NewPointer(model.NewId()),
		TargetType: model.NewPointer(model.NewId()),
	}

	t.Run("should fail if the field doesn't exist", func(t *testing.T) {
		updatedField, err := th.App.PatchCPAField(model.NewId(), patch)
		require.NotNil(t, err)
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

		updatedField, err := th.App.PatchCPAField(createdField.ID, patch)
		require.Nil(t, err)
		require.Equal(t, createdField.ID, updatedField.ID)
		require.Equal(t, "Patched name", updatedField.Name)
		require.Equal(t, "default", updatedField.Attrs["visibility"])
		require.Empty(t, updatedField.TargetID, "CPA should not allow to patch the field's target ID")
		require.Empty(t, updatedField.TargetType, "CPA should not allow to patch the field's target type")
		require.Greater(t, updatedField.UpdateAt, createdField.UpdateAt)
	})
}

func TestDeleteCPAField(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.cpaGroupID()
	require.NoError(t, cErr)

	newField := &model.PropertyField{
		GroupID: cpaGroupID,
		Name:    model.NewId(),
		Type:    model.PropertyFieldTypeText,
	}
	createdField, err := th.App.CreateCPAField(newField)
	require.Nil(t, err)

	for i := 0; i < 3; i++ {
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
		require.Equal(t, "app.custom_profile_attributes.get_property_field.app_error", err.Id)
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
		require.Equal(t, "app.custom_profile_attributes.property_field_not_found.app_error", dErr.Id)
	})

	t.Run("should correctly delete the field", func(t *testing.T) {
		// check that we have the associated values to the field prior deletion
		opts := model.PropertyValueSearchOpts{PerPage: 10, FieldID: createdField.ID}
		values, err := th.App.Srv().propertyService.SearchPropertyValues(opts)
		require.NoError(t, err)
		require.Len(t, values, 3)

		// delete the field
		require.Nil(t, th.App.DeleteCPAField(createdField.ID))

		// check that it is marked as deleted
		fetchedField, err := th.App.Srv().propertyService.GetPropertyField(createdField.ID)
		require.NoError(t, err)
		require.NotZero(t, fetchedField.DeleteAt)

		// ensure that the associated fields have been marked as deleted too
		values, err = th.App.Srv().propertyService.SearchPropertyValues(opts)
		require.NoError(t, err)
		require.Len(t, values, 0)

		opts.IncludeDeleted = true
		values, err = th.App.Srv().propertyService.SearchPropertyValues(opts)
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

	cpaGroupID, cErr := th.App.cpaGroupID()
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

func TestPatchCPAValue(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	cpaGroupID, cErr := th.App.cpaGroupID()
	require.NoError(t, cErr)

	t.Run("should fail if the field doesn't exist", func(t *testing.T) {
		invalidFieldID := model.NewId()
		_, appErr := th.App.PatchCPAValue(model.NewId(), invalidFieldID, json.RawMessage(`"fieldValue"`))
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
		patchedValue, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(`"test value"`))
		require.Nil(t, appErr)
		require.NotNil(t, patchedValue)
		require.Equal(t, json.RawMessage(`"test value"`), patchedValue.Value)
		require.Equal(t, userID, patchedValue.TargetID)

		t.Run("should correctly patch the CPA property value", func(t *testing.T) {
			patch2, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(`"new patched value"`))
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
		err = th.App.Srv().propertyService.DeletePropertyField(createdField.ID)
		require.NoError(t, err)

		userID := model.NewId()
		patchedValue, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(`"test value"`))
		require.NotNil(t, appErr)
		require.Nil(t, patchedValue)
	})

	t.Run("should handle array values correctly", func(t *testing.T) {
		arrayField := &model.PropertyField{
			GroupID: cpaGroupID,
			Name:    model.NewId(),
			Type:    model.PropertyFieldTypeMultiselect,
		}
		createdField, err := th.App.Srv().propertyService.CreatePropertyField(arrayField)
		require.NoError(t, err)

		userID := model.NewId()
		patchedValue, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(`["option1", "option2", "option3"]`))
		require.Nil(t, appErr)
		require.NotNil(t, patchedValue)
		var arrayValues []string
		require.NoError(t, json.Unmarshal(patchedValue.Value, &arrayValues))
		require.Equal(t, []string{"option1", "option2", "option3"}, arrayValues)
		require.Equal(t, userID, patchedValue.TargetID)

		// Update array values
		updatedValue, appErr := th.App.PatchCPAValue(userID, createdField.ID, json.RawMessage(`["newOption1", "newOption2"]`))
		require.Nil(t, appErr)
		require.NotNil(t, updatedValue)
		require.Equal(t, patchedValue.ID, updatedValue.ID)
		arrayValues = nil
		require.NoError(t, json.Unmarshal(updatedValue.Value, &arrayValues))
		require.Equal(t, []string{"newOption1", "newOption2"}, arrayValues)
		require.Equal(t, userID, updatedValue.TargetID)
	})
}
