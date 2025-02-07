// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestCreateCPAField(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t)
	defer th.TearDown()

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		field := &model.PropertyField{Name: model.NewId(), Type: model.PropertyFieldTypeText}

		createdField, resp, err := client.CreateCPAField(context.Background(), field)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "api.custom_profile_attributes.license_error")
		require.Empty(t, createdField)
	}, "endpoint should not work if no valid license is present")

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("a user without admin permissions should not be able to create a field", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}

		_, resp, err := th.Client.CreateCPAField(context.Background(), field)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		field := &model.PropertyField{Name: model.NewId()}

		createdField, resp, err := client.CreateCPAField(context.Background(), field)
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
		require.Empty(t, createdField)
	}, "an invalid field should be rejected")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		name := model.NewId()
		field := &model.PropertyField{
			Name:  fmt.Sprintf("  %s\t", name), // name should be sanitized
			Type:  model.PropertyFieldTypeText,
			Attrs: map[string]any{"visibility": "default"},
		}

		createdField, resp, err := client.CreateCPAField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotZero(t, createdField.ID)
		require.Equal(t, name, createdField.Name)
		require.Equal(t, "default", createdField.Attrs["visibility"])
	}, "a user with admin permissions should be able to create the field")
}

func TestListCPAFields(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t)
	defer th.TearDown()

	field := &model.PropertyField{
		Name:  model.NewId(),
		Type:  model.PropertyFieldTypeText,
		Attrs: map[string]any{"visibility": "default"},
	}

	createdField, err := th.App.CreateCPAField(field)
	require.Nil(t, err)
	require.NotNil(t, createdField)

	t.Run("endpoint should not work if no valid license is present", func(t *testing.T) {
		fields, resp, err := th.Client.ListCPAFields(context.Background())
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "api.custom_profile_attributes.license_error")
		require.Empty(t, fields)
	})

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("any user should be able to list fields", func(t *testing.T) {
		fields, resp, err := th.Client.ListCPAFields(context.Background())
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, fields)
		require.Len(t, fields, 1)
		require.Equal(t, createdField.ID, fields[0].ID)
	})

	t.Run("the endpoint should only list non deleted fields", func(t *testing.T) {
		require.Nil(t, th.App.DeleteCPAField(createdField.ID))
		fields, resp, err := th.Client.ListCPAFields(context.Background())
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.Empty(t, fields)
	})
}

func TestPatchCPAField(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t)
	defer th.TearDown()

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		patch := &model.PropertyFieldPatch{Name: model.NewPointer(model.NewId())}
		patchedField, resp, err := client.PatchCPAField(context.Background(), model.NewId(), patch)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "api.custom_profile_attributes.license_error")
		require.Empty(t, patchedField)
	}, "endpoint should not work if no valid license is present")

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("a user without admin permissions should not be able to patch a field", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}
		createdField, appErr := th.App.CreateCPAField(field)
		require.Nil(t, appErr)
		require.NotNil(t, createdField)

		patch := &model.PropertyFieldPatch{Name: model.NewPointer(model.NewId())}
		_, resp, err := th.Client.PatchCPAField(context.Background(), createdField.ID, patch)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}
		createdField, appErr := th.App.CreateCPAField(field)
		require.Nil(t, appErr)
		require.NotNil(t, createdField)

		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: model.NewPointer(fmt.Sprintf("  %s \t ", newName))} // name should be sanitized
		patchedField, resp, err := client.PatchCPAField(context.Background(), createdField.ID, patch)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.Equal(t, newName, patchedField.Name)
	}, "a user with admin permissions should be able to patch the field")
}

func TestDeleteCPAField(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t)
	defer th.TearDown()

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		resp, err := client.DeleteCPAField(context.Background(), model.NewId())
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "api.custom_profile_attributes.license_error")
	}, "endpoint should not work if no valid license is present")

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("a user without admin permissions should not be able to delete a field", func(t *testing.T) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}
		createdField, _, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		require.NoError(t, err)
		require.NotNil(t, createdField)

		resp, err := th.Client.DeleteCPAField(context.Background(), createdField.ID)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		field := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		}
		createdField, _, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		require.NoError(t, err)
		require.NotNil(t, createdField)
		require.Zero(t, createdField.DeleteAt)

		resp, err := client.DeleteCPAField(context.Background(), createdField.ID)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		deletedField, appErr := th.App.GetCPAField(createdField.ID)
		require.Nil(t, appErr)
		require.NotZero(t, deletedField.DeleteAt)
	}, "a user with admin permissions should be able to delete the field")
}

func TestListCPAValues(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
	defer th.AddPermissionToRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)

	field := &model.PropertyField{
		Name: model.NewId(),
		Type: model.PropertyFieldTypeText,
	}
	createdField, appErr := th.App.CreateCPAField(field)
	require.Nil(t, appErr)
	require.NotNil(t, createdField)

	_, appErr = th.App.PatchCPAValue(th.BasicUser.Id, createdField.ID, json.RawMessage(`"Field Value"`))
	require.Nil(t, appErr)

	t.Run("endpoint should not work if no valid license is present", func(t *testing.T) {
		values, resp, err := th.Client.ListCPAValues(context.Background(), th.BasicUser.Id)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "api.custom_profile_attributes.license_error")
		require.Empty(t, values)
	})

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	// login with Client2 from this point on
	th.LoginBasic2()

	t.Run("any team member should be able to list values", func(t *testing.T) {
		values, resp, err := th.Client.ListCPAValues(context.Background(), th.BasicUser.Id)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, values)
		require.Len(t, values, 1)
	})

	t.Run("should handle array values correctly", func(t *testing.T) {
		arrayField := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeMultiselect,
		}
		createdArrayField, appErr := th.App.CreateCPAField(arrayField)
		require.Nil(t, appErr)
		require.NotNil(t, createdArrayField)

		_, appErr = th.App.PatchCPAValue(th.BasicUser.Id, createdArrayField.ID, json.RawMessage(`["option1", "option2", "option3"]`))
		require.Nil(t, appErr)

		values, resp, err := th.Client.ListCPAValues(context.Background(), th.BasicUser.Id)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, values)

		var arrayValues []string
		require.NoError(t, json.Unmarshal(values[createdArrayField.ID], &arrayValues))
		require.Equal(t, []string{"option1", "option2", "option3"}, arrayValues)
	})

	t.Run("non team member should NOT be able to list values", func(t *testing.T) {
		resp, err := th.SystemAdminClient.RemoveTeamMember(context.Background(), th.BasicTeam.Id, th.BasicUser2.Id)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		_, resp, err = th.Client.ListCPAValues(context.Background(), th.BasicUser.Id)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})
}

func TestSanitizePropertyValue(t *testing.T) {
	t.Run("text field type", func(t *testing.T) {
		t.Run("valid text", func(t *testing.T) {
			result, err := sanitizePropertyValue(model.PropertyFieldTypeText, json.RawMessage(`"hello world"`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Equal(t, "hello world", value)
		})

		t.Run("empty text should be allowed", func(t *testing.T) {
			result, err := sanitizePropertyValue(model.PropertyFieldTypeText, json.RawMessage(`""`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Empty(t, value)
		})

		t.Run("invalid JSON", func(t *testing.T) {
			_, err := sanitizePropertyValue(model.PropertyFieldTypeText, json.RawMessage(`invalid`))
			require.Error(t, err)
		})

		t.Run("wrong type", func(t *testing.T) {
			_, err := sanitizePropertyValue(model.PropertyFieldTypeText, json.RawMessage(`123`))
			require.Error(t, err)
			require.Contains(t, err.Error(), "json: cannot unmarshal number into Go value of type string")
		})
	})

	t.Run("date field type", func(t *testing.T) {
		t.Run("valid date", func(t *testing.T) {
			result, err := sanitizePropertyValue(model.PropertyFieldTypeDate, json.RawMessage(`"2023-01-01"`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Equal(t, "2023-01-01", value)
		})

		t.Run("empty date should be allowed", func(t *testing.T) {
			result, err := sanitizePropertyValue(model.PropertyFieldTypeDate, json.RawMessage(`""`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Empty(t, value)
		})
	})

	t.Run("select field type", func(t *testing.T) {
		t.Run("valid option", func(t *testing.T) {
			result, err := sanitizePropertyValue(model.PropertyFieldTypeSelect, json.RawMessage(`"option1"`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Equal(t, "option1", value)
		})

		t.Run("empty option should be allowed", func(t *testing.T) {
			result, err := sanitizePropertyValue(model.PropertyFieldTypeSelect, json.RawMessage(`""`))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Empty(t, value)
		})
	})

	t.Run("user field type", func(t *testing.T) {
		t.Run("valid user ID", func(t *testing.T) {
			validID := model.NewId()
			result, err := sanitizePropertyValue(model.PropertyFieldTypeUser, json.RawMessage(fmt.Sprintf(`"%s"`, validID)))
			require.NoError(t, err)
			var value string
			require.NoError(t, json.Unmarshal(result, &value))
			require.Equal(t, validID, value)
		})

		t.Run("empty user ID should be allowed", func(t *testing.T) {
			_, err := sanitizePropertyValue(model.PropertyFieldTypeUser, json.RawMessage(`""`))
			require.NoError(t, err)
		})

		t.Run("invalid user ID format", func(t *testing.T) {
			_, err := sanitizePropertyValue(model.PropertyFieldTypeUser, json.RawMessage(`"invalid-id"`))
			require.Error(t, err)
			require.Equal(t, "invalid user id", err.Error())
		})
	})

	t.Run("multiselect field type", func(t *testing.T) {
		t.Run("valid options", func(t *testing.T) {
			result, err := sanitizePropertyValue(model.PropertyFieldTypeMultiselect, json.RawMessage(`["option1", "option2"]`))
			require.NoError(t, err)
			var values []string
			require.NoError(t, json.Unmarshal(result, &values))
			require.Equal(t, []string{"option1", "option2"}, values)
		})

		t.Run("empty array", func(t *testing.T) {
			_, err := sanitizePropertyValue(model.PropertyFieldTypeMultiselect, json.RawMessage(`[]`))
			require.NoError(t, err)
		})

		t.Run("array with empty values should filter them out", func(t *testing.T) {
			result, err := sanitizePropertyValue(model.PropertyFieldTypeMultiselect, json.RawMessage(`["option1", "", "option2", "   ", "option3"]`))
			require.NoError(t, err)
			var values []string
			require.NoError(t, json.Unmarshal(result, &values))
			require.Equal(t, []string{"option1", "option2", "option3"}, values)
		})
	})

	t.Run("multiuser field type", func(t *testing.T) {
		t.Run("valid user IDs", func(t *testing.T) {
			validID1 := model.NewId()
			validID2 := model.NewId()
			result, err := sanitizePropertyValue(model.PropertyFieldTypeMultiuser, json.RawMessage(fmt.Sprintf(`["%s", "%s"]`, validID1, validID2)))
			require.NoError(t, err)
			var values []string
			require.NoError(t, json.Unmarshal(result, &values))
			require.Equal(t, []string{validID1, validID2}, values)
		})

		t.Run("empty array", func(t *testing.T) {
			_, err := sanitizePropertyValue(model.PropertyFieldTypeMultiuser, json.RawMessage(`[]`))
			require.NoError(t, err)
		})

		t.Run("array with empty strings should be filtered out", func(t *testing.T) {
			validID1 := model.NewId()
			validID2 := model.NewId()
			result, err := sanitizePropertyValue(model.PropertyFieldTypeMultiuser, json.RawMessage(fmt.Sprintf(`["%s", "", "   ", "%s"]`, validID1, validID2)))
			require.NoError(t, err)
			var values []string
			require.NoError(t, json.Unmarshal(result, &values))
			require.Equal(t, []string{validID1, validID2}, values)
		})

		t.Run("array with invalid ID should return error", func(t *testing.T) {
			validID1 := model.NewId()
			_, err := sanitizePropertyValue(model.PropertyFieldTypeMultiuser, json.RawMessage(fmt.Sprintf(`["%s", "invalid-id"]`, validID1)))
			require.Error(t, err)
			require.Equal(t, "invalid user id: invalid-id", err.Error())
		})
	})

	t.Run("unknown field type", func(t *testing.T) {
		_, err := sanitizePropertyValue("unknown", json.RawMessage(`"value"`))
		require.Error(t, err)
		require.Equal(t, "unknown field type: unknown", err.Error())
	})
}

func TestPatchCPAValues(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	field := &model.PropertyField{
		Name: model.NewId(),
		Type: model.PropertyFieldTypeText,
	}
	createdField, appErr := th.App.CreateCPAField(field)
	require.Nil(t, appErr)
	require.NotNil(t, createdField)

	t.Run("endpoint should not work if no valid license is present", func(t *testing.T) {
		values := map[string]json.RawMessage{createdField.ID: json.RawMessage(`"Field Value"`)}
		patchedValues, resp, err := th.Client.PatchCPAValues(context.Background(), values)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "api.custom_profile_attributes.license_error")
		require.Empty(t, patchedValues)
	})

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("any team member should be able to create their own values", func(t *testing.T) {
		values := map[string]json.RawMessage{}
		value := "Field Value"
		values[createdField.ID] = json.RawMessage(fmt.Sprintf(`"  %s "`, value)) // value should be sanitized
		patchedValues, resp, err := th.Client.PatchCPAValues(context.Background(), values)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, patchedValues)
		require.Len(t, patchedValues, 1)
		var actualValue string
		require.NoError(t, json.Unmarshal(patchedValues[createdField.ID], &actualValue))
		require.Equal(t, value, actualValue)

		values, resp, err = th.Client.ListCPAValues(context.Background(), th.BasicUser.Id)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, values)
		require.Len(t, values, 1)
		actualValue = ""
		require.NoError(t, json.Unmarshal(values[createdField.ID], &actualValue))
		require.Equal(t, value, actualValue)
	})

	t.Run("any team member should be able to patch their own values", func(t *testing.T) {
		values, resp, err := th.Client.ListCPAValues(context.Background(), th.BasicUser.Id)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, values)
		require.Len(t, values, 1)

		value := "Updated Field Value"
		values[createdField.ID] = json.RawMessage(fmt.Sprintf(`" %s  \t"`, value)) // value should be sanitized
		patchedValues, resp, err := th.Client.PatchCPAValues(context.Background(), values)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		var actualValue string
		require.NoError(t, json.Unmarshal(patchedValues[createdField.ID], &actualValue))
		require.Equal(t, value, actualValue)

		values, resp, err = th.Client.ListCPAValues(context.Background(), th.BasicUser.Id)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		actualValue = ""
		require.NoError(t, json.Unmarshal(values[createdField.ID], &actualValue))
		require.Equal(t, value, actualValue)
	})

	t.Run("should handle array values correctly", func(t *testing.T) {
		arrayField := &model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeMultiselect,
		}
		createdArrayField, appErr := th.App.CreateCPAField(arrayField)
		require.Nil(t, appErr)
		require.NotNil(t, createdArrayField)

		values := map[string]json.RawMessage{
			createdArrayField.ID: json.RawMessage(`["option1", "option2", "option3"]`),
		}
		patchedValues, resp, err := th.Client.PatchCPAValues(context.Background(), values)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, patchedValues)

		var actualValues []string
		require.NoError(t, json.Unmarshal(patchedValues[createdArrayField.ID], &actualValues))
		require.Equal(t, []string{"option1", "option2", "option3"}, actualValues)

		// Test updating array values
		values[createdArrayField.ID] = json.RawMessage(`["newOption1", "newOption2"]`)
		patchedValues, resp, err = th.Client.PatchCPAValues(context.Background(), values)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		actualValues = nil
		require.NoError(t, json.Unmarshal(patchedValues[createdArrayField.ID], &actualValues))
		require.Equal(t, []string{"newOption1", "newOption2"}, actualValues)
	})
}
