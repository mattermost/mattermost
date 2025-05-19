// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

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
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		name := model.NewId()
		field := &model.PropertyField{
			Name:  fmt.Sprintf("  %s\t", name), // name should be sanitized
			Type:  model.PropertyFieldTypeText,
			Attrs: map[string]any{"visibility": "when_set"},
		}

		createdField, resp, err := client.CreateCPAField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotZero(t, createdField.ID)
		require.Equal(t, name, createdField.Name)
		require.Equal(t, "when_set", createdField.Attrs["visibility"])

		t.Run("a websocket event should be fired as part of the field creation", func(t *testing.T) {
			var wsField model.PropertyField
			require.Eventually(t, func() bool {
				select {
				case event := <-webSocketClient.EventChannel:
					if event.EventType() == model.WebsocketEventCPAFieldCreated {
						fieldData, err := json.Marshal(event.GetData()["field"])
						require.NoError(t, err)
						require.NoError(t, json.Unmarshal(fieldData, &wsField))
						return true
					}
				default:
					return false
				}
				return false
			}, 5*time.Second, 100*time.Millisecond)

			require.NotEmpty(t, wsField.ID)
			require.Equal(t, createdField, &wsField)
		})
	}, "a user with admin permissions should be able to create the field")
}

func TestListCPAFields(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t)
	defer th.TearDown()

	field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
		Name:  model.NewId(),
		Type:  model.PropertyFieldTypeText,
		Attrs: map[string]any{"visibility": "when_set"},
	})
	require.NoError(t, err)

	createdField, appErr := th.App.CreateCPAField(field)
	require.Nil(t, appErr)
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
		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		})
		require.NoError(t, err)

		createdField, appErr := th.App.CreateCPAField(field)
		require.Nil(t, appErr)
		require.NotNil(t, createdField)

		patch := &model.PropertyFieldPatch{Name: model.NewPointer(model.NewId())}
		_, resp, err := th.Client.PatchCPAField(context.Background(), createdField.ID, patch)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		})
		require.NoError(t, err)

		createdField, appErr := th.App.CreateCPAField(field)
		require.Nil(t, appErr)
		require.NotNil(t, createdField)

		newName := model.NewId()
		patch := &model.PropertyFieldPatch{Name: model.NewPointer(fmt.Sprintf("  %s \t ", newName))} // name should be sanitized
		patchedField, resp, err := client.PatchCPAField(context.Background(), createdField.ID, patch)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.Equal(t, newName, patchedField.Name)

		t.Run("a websocket event should be fired as part of the field patch", func(t *testing.T) {
			var wsField model.PropertyField
			require.Eventually(t, func() bool {
				select {
				case event := <-webSocketClient.EventChannel:
					if event.EventType() == model.WebsocketEventCPAFieldUpdated {
						fieldData, err := json.Marshal(event.GetData()["field"])
						require.NoError(t, err)
						require.NoError(t, json.Unmarshal(fieldData, &wsField))
						return true
					}
				default:
					return false
				}
				return false
			}, 5*time.Second, 100*time.Millisecond)

			require.NotEmpty(t, wsField.ID)
			require.Equal(t, patchedField, &wsField)
		})

		t.Run("sanitization should remove options and sync details when necessary", func(t *testing.T) {
			// Create a select field with options
			optionID1 := model.NewId()
			optionID2 := model.NewId()
			selectField, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
				Name: model.NewId(),
				Type: model.PropertyFieldTypeSelect,
				Attrs: model.StringInterface{
					"options": []map[string]any{
						{"id": optionID1, "name": "Option 1", "color": "#FF0000"},
						{"id": optionID2, "name": "Option 2", "color": "#00FF00"},
					},
				},
			})
			require.NoError(t, err)

			createdField, _, err := client.CreateCPAField(context.Background(), selectField.ToPropertyField())
			require.NoError(t, err)
			require.NotNil(t, createdField)

			// Verify options were created
			options, ok := createdField.Attrs["options"]
			require.True(t, ok)
			require.NotNil(t, options)

			// Patch to change type to text with LDAP attribute
			// Options should be automatically removed even though we don't explicitly remove them
			ldapAttr := "user_attribute"
			textPatch := &model.PropertyFieldPatch{
				Type:  model.NewPointer(model.PropertyFieldTypeText),
				Attrs: &model.StringInterface{"ldap": ldapAttr},
			}

			patchedTextField, resp, err := client.PatchCPAField(context.Background(), createdField.ID, textPatch)
			CheckOKStatus(t, resp)
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTypeText, patchedTextField.Type)

			// Verify options were removed
			options = patchedTextField.Attrs["options"]
			require.Empty(t, options)

			// Verify LDAP attribute was set
			ldap, ok := patchedTextField.Attrs["ldap"]
			require.True(t, ok)
			require.Equal(t, ldapAttr, ldap)

			// Now patch to change type to date
			// LDAP attribute should be automatically removed even though we don't explicitly remove it
			datePatch := &model.PropertyFieldPatch{
				Type: model.NewPointer(model.PropertyFieldTypeDate),
			}

			patchedDateField, resp, err := client.PatchCPAField(context.Background(), patchedTextField.ID, datePatch)
			CheckOKStatus(t, resp)
			require.NoError(t, err)
			require.Equal(t, model.PropertyFieldTypeDate, patchedDateField.Type)

			// Verify LDAP attribute was removed
			ldap = patchedDateField.Attrs["ldap"]
			require.Empty(t, ldap)
		})
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
		webSocketClient := th.CreateConnectedWebSocketClient(t)

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

		t.Run("a websocket event should be fired as part of the field deletion", func(t *testing.T) {
			var fieldID string
			require.Eventually(t, func() bool {
				select {
				case event := <-webSocketClient.EventChannel:
					if event.EventType() == model.WebsocketEventCPAFieldDeleted {
						var ok bool
						fieldID, ok = event.GetData()["field_id"].(string)
						require.True(t, ok)
						return true
					}
				default:
					return false
				}
				return false
			}, 5*time.Second, 100*time.Millisecond)

			require.Equal(t, createdField.ID, fieldID)
		})
	}, "a user with admin permissions should be able to delete the field")
}

func TestListCPAValues(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.RemovePermissionFromRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)
	defer th.AddPermissionToRole(model.PermissionViewMembers.Id, model.SystemUserRoleId)

	field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
		Name: model.NewId(),
		Type: model.PropertyFieldTypeText,
	})
	require.NoError(t, err)

	createdField, appErr := th.App.CreateCPAField(field)
	require.Nil(t, appErr)
	require.NotNil(t, createdField)

	_, appErr = th.App.PatchCPAValue(th.BasicUser.Id, createdField.ID, json.RawMessage(`"Field Value"`), true)
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
		optionID1 := model.NewId()
		optionID2 := model.NewId()
		arrayField, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeMultiselect,
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": optionID1, "name": "option1"},
					{"id": optionID2, "name": "option2"},
				},
			},
		})
		require.NoError(t, err)

		createdArrayField, appErr := th.App.CreateCPAField(arrayField)
		require.Nil(t, appErr)
		require.NotNil(t, createdArrayField)

		_, appErr = th.App.PatchCPAValue(th.BasicUser.Id, createdArrayField.ID, json.RawMessage(fmt.Sprintf(`["%s", "%s"]`, optionID1, optionID2)), true)
		require.Nil(t, appErr)

		values, resp, err := th.Client.ListCPAValues(context.Background(), th.BasicUser.Id)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, values)

		var arrayValues []string
		require.NoError(t, json.Unmarshal(values[createdArrayField.ID], &arrayValues))
		require.ElementsMatch(t, []string{optionID1, optionID2}, arrayValues)
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

func TestPatchCPAValues(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES")
	th := Setup(t).InitBasic()
	defer th.TearDown()

	field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
		Name: model.NewId(),
		Type: model.PropertyFieldTypeText,
	})
	require.NoError(t, err)

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
		webSocketClient := th.CreateConnectedWebSocketClient(t)

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

		t.Run("a websocket event should be fired as part of the value changes", func(t *testing.T) {
			var wsValues map[string]json.RawMessage
			require.Eventually(t, func() bool {
				select {
				case event := <-webSocketClient.EventChannel:
					if event.EventType() == model.WebsocketEventCPAValuesUpdated {
						valuesData, err := json.Marshal(event.GetData()["values"])
						require.NoError(t, err)
						require.NoError(t, json.Unmarshal(valuesData, &wsValues))
						return true
					}
				default:
					return false
				}
				return false
			}, 5*time.Second, 100*time.Millisecond)

			require.NotEmpty(t, wsValues)
			require.Equal(t, patchedValues, wsValues)
		})
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
		optionsID := []string{model.NewId(), model.NewId(), model.NewId(), model.NewId()}

		arrayField, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeMultiselect,
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": optionsID[0], "name": "option1"},
					{"id": optionsID[1], "name": "option2"},
					{"id": optionsID[2], "name": "option3"},
					{"id": optionsID[3], "name": "option4"},
				},
			},
		})
		require.NoError(t, err)

		createdArrayField, appErr := th.App.CreateCPAField(arrayField)
		require.Nil(t, appErr)
		require.NotNil(t, createdArrayField)

		values := map[string]json.RawMessage{
			createdArrayField.ID: json.RawMessage(fmt.Sprintf(`["%s", "%s", "%s"]`, optionsID[0], optionsID[1], optionsID[2])),
		}
		patchedValues, resp, err := th.Client.PatchCPAValues(context.Background(), values)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, patchedValues)

		var actualValues []string
		require.NoError(t, json.Unmarshal(patchedValues[createdArrayField.ID], &actualValues))
		require.Equal(t, optionsID[:3], actualValues)

		// Test updating array values
		values[createdArrayField.ID] = json.RawMessage(fmt.Sprintf(`["%s", "%s"]`, optionsID[2], optionsID[3]))
		patchedValues, resp, err = th.Client.PatchCPAValues(context.Background(), values)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		actualValues = nil
		require.NoError(t, json.Unmarshal(patchedValues[createdArrayField.ID], &actualValues))
		require.Equal(t, optionsID[2:4], actualValues)
	})

	t.Run("should fail if any of the values belongs to a field that is LDAP/SAML synced", func(t *testing.T) {
		// Create a field with LDAP attribute
		ldapField, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsLDAP: "ldap_attr",
			},
		})
		require.NoError(t, err)

		createdLDAPField, appErr := th.App.CreateCPAField(ldapField)
		require.Nil(t, appErr)
		require.NotNil(t, createdLDAPField)

		// Create a field with SAML attribute
		samlField, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsSAML: "saml_attr",
			},
		})
		require.NoError(t, err)

		createdSAMLField, appErr := th.App.CreateCPAField(samlField)
		require.Nil(t, appErr)
		require.NotNil(t, createdSAMLField)

		// Test LDAP field
		values := map[string]json.RawMessage{
			createdLDAPField.ID: json.RawMessage(`"LDAP Value"`),
		}
		_, resp, err := th.Client.PatchCPAValues(context.Background(), values)
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.custom_profile_attributes.property_field_is_synced.app_error")

		// Test SAML field
		values = map[string]json.RawMessage{
			createdSAMLField.ID: json.RawMessage(`"SAML Value"`),
		}
		_, resp, err = th.Client.PatchCPAValues(context.Background(), values)
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.custom_profile_attributes.property_field_is_synced.app_error")

		// Test multiple fields with one being LDAP synced
		values = map[string]json.RawMessage{
			createdField.ID:     json.RawMessage(`"Regular Value"`),
			createdLDAPField.ID: json.RawMessage(`"LDAP Value"`),
		}
		_, resp, err = th.Client.PatchCPAValues(context.Background(), values)
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.custom_profile_attributes.property_field_is_synced.app_error")
	})

	t.Run("an invalid patch should be rejected", func(t *testing.T) {
		field, err := model.NewCPAFieldFromPropertyField(&model.PropertyField{
			Name: model.NewId(),
			Type: model.PropertyFieldTypeText,
		})
		require.NoError(t, err)

		createdField, appErr := th.App.CreateCPAField(field)
		require.Nil(t, appErr)
		require.NotNil(t, createdField)

		// Create a value that's too long (over 64 characters)
		tooLongValue := strings.Repeat("a", model.CPAValueTypeTextMaxLength+1)
		values := map[string]json.RawMessage{
			createdField.ID: json.RawMessage(fmt.Sprintf(`"%s"`, tooLongValue)),
		}

		_, resp, err := th.Client.PatchCPAValues(context.Background(), values)
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "Failed to validate property value")
	})
}
