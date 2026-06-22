// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/require"
)

// celSafeName returns a CPA field name guaranteed to satisfy the CEL identifier
// rule the AccessControlAttributeValidationHook enforces. model.NewId() uses a base32
// alphabet that includes digits, so a raw NewId can start with a digit and trip
// the ^[A-Za-z_]… pattern; the leading "f_" sidesteps that.
func celSafeName() string {
	return "f_" + model.NewId()
}

func TestCreateCPAField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		field := &model.PropertyField{Name: celSafeName(), Type: model.PropertyFieldTypeText}

		createdField, resp, err := client.CreateCPAField(context.Background(), field)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.license_error")
		require.Empty(t, createdField)
	}, "endpoint should not work if no valid license is present")

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("a user without admin permissions should not be able to create a field", func(t *testing.T) {
		field := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
		}

		_, resp, err := th.Client.CreateCPAField(context.Background(), field)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		field := &model.PropertyField{Name: celSafeName()}

		createdField, resp, err := client.CreateCPAField(context.Background(), field)
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
		require.Empty(t, createdField)
	}, "an invalid field should be rejected")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		name := celSafeName()
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

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		managedField := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsManaged: "admin",
				"visibility": "when_set",
			},
		}

		createdManagedField, resp, err := client.CreateCPAField(context.Background(), managedField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotZero(t, createdManagedField.ID)
		require.Equal(t, managedField.Name, createdManagedField.Name)
		require.Equal(t, "admin", createdManagedField.Attrs[model.CustomProfileAttributesPropertyAttrsManaged])
		require.Equal(t, "when_set", createdManagedField.Attrs["visibility"])
	}, "admin should be able to create a managed field")

	t.Run("server zeroes DeleteAt even if input has a non-zero value", func(t *testing.T) {
		field := &model.PropertyField{
			Name:     celSafeName(),
			Type:     model.PropertyFieldTypeText,
			DeleteAt: time.Now().UnixMilli(),
		}
		require.NotZero(t, field.DeleteAt)

		created, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.Zero(t, created.DeleteAt)
	})
}

func TestCPAFieldLimit(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	// Create 20 fields — the maximum allowed by FieldLimitHook.
	createdIDs := make([]string, 0, 20)
	for i := 1; i <= 20; i++ {
		field := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
		}
		created, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		createdIDs = append(createdIDs, created.ID)
	}

	t.Run("creating a 21st field is rejected", func(t *testing.T) {
		field := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
		}
		_, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		CheckUnprocessableEntityStatus(t, resp)
		require.Error(t, err)
	})

	t.Run("deleted fields do not count toward the limit", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DeleteCPAField(context.Background(), createdIDs[0])
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		replacement := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
		}
		created, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), replacement)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotZero(t, created.ID)
	})
}

func TestListCPAFields(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
	})

	// License required for field creation (LicenseCheckHook)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	field := &model.PropertyField{
		Name:  celSafeName(),
		Type:  model.PropertyFieldTypeText,
		Attrs: map[string]any{"visibility": "when_set"},
	}

	createdField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
	CheckCreatedStatus(t, resp)
	require.NoError(t, err)
	require.NotNil(t, createdField)

	t.Run("endpoint should not work if no valid license is present", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)
		defer th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

		fields, resp, err := th.Client.ListCPAFields(context.Background())
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.license_error")
		require.Empty(t, fields)
	})

	t.Run("any user should be able to list fields", func(t *testing.T) {
		fields, resp, err := th.Client.ListCPAFields(context.Background())
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, fields)
		require.Len(t, fields, 1)
		require.Equal(t, createdField.ID, fields[0].ID)
	})

	t.Run("the endpoint should only list non deleted fields", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DeleteCPAField(context.Background(), createdField.ID)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		fields, resp, err := th.Client.ListCPAFields(context.Background())
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.Empty(t, fields)
	})
}

func TestPatchCPAField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
		cfg.FeatureFlags.PropertyFieldRank = true
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// Create a field with a license so we can test the license check on patch.
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		field := &model.PropertyField{Name: celSafeName(), Type: model.PropertyFieldTypeText}
		createdField, _, createErr := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		require.NoError(t, createErr)
		require.NotNil(t, createdField)

		// Remove the license and verify patch is blocked.
		th.App.Srv().SetLicense(nil)
		patch := &model.PropertyFieldPatch{Name: model.NewPointer(celSafeName())}
		patchedField, resp, err := client.PatchCPAField(context.Background(), createdField.ID, patch)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.license_error")
		require.Empty(t, patchedField)
	}, "endpoint should not work if no valid license is present")

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("a user without admin permissions should not be able to patch a field", func(t *testing.T) {
		field := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
		}

		createdField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdField)

		patch := &model.PropertyFieldPatch{Name: model.NewPointer(celSafeName())}
		_, resp, err = th.Client.PatchCPAField(context.Background(), createdField.ID, patch)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		field := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
		}

		createdField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdField)

		newName := celSafeName()
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
	}, "a user with admin permissions should be able to patch the field")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// Create a regular field first
		field := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
		}

		createdField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdField)

		// Verify field is not isManaged initially
		require.Empty(t, createdField.Attrs[model.CustomProfileAttributesPropertyAttrsManaged])

		// Patch to make it managed
		managedPatch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsManaged: "admin",
			},
		}

		patchedManagedField, resp, err := client.PatchCPAField(context.Background(), createdField.ID, managedPatch)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.Equal(t, "admin", patchedManagedField.Attrs[model.CustomProfileAttributesPropertyAttrsManaged])

		// Patch to remove managed attribute
		unManagedPatch := &model.PropertyFieldPatch{
			Attrs: &model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsManaged: "",
			},
		}

		patchedUnmanagedField, resp, err := client.PatchCPAField(context.Background(), patchedManagedField.ID, unManagedPatch)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		// Verify managed attribute is removed or empty
		require.Empty(t, patchedUnmanagedField.Attrs[model.CustomProfileAttributesPropertyAttrsManaged])
	}, "admin should be able to toggle managed attribute on existing field")

	t.Run("patching select options preserves existing option IDs and assigns new IDs to added options", func(t *testing.T) {
		selectField := &model.PropertyField{
			Name: "select_field_" + model.NewId(),
			Type: model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Option 1", "color": "#111111"},
					map[string]any{"name": "Option 2", "color": "#222222"},
				},
			},
		}
		created, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), selectField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)

		createdCPA, err := model.NewCPAFieldFromPropertyField(created)
		require.NoError(t, err)
		require.Len(t, createdCPA.Attrs.Options, 2)
		id1 := createdCPA.Attrs.Options[0].ID
		id2 := createdCPA.Attrs.Options[1].ID
		require.NotEmpty(t, id1)
		require.NotEmpty(t, id2)

		patch := &model.PropertyFieldPatch{
			Attrs: model.NewPointer(model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": id1, "name": "Updated Option 1", "color": "#333333"},
					map[string]any{"name": "New Option 1.5", "color": "#353535"},
					map[string]any{"id": id2, "name": "Updated Option 2", "color": "#444444"},
				},
			}),
		}
		patched, resp, err := th.SystemAdminClient.PatchCPAField(context.Background(), created.ID, patch)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		patchedCPA, err := model.NewCPAFieldFromPropertyField(patched)
		require.NoError(t, err)
		require.Len(t, patchedCPA.Attrs.Options, 3)

		require.Equal(t, id1, patchedCPA.Attrs.Options[0].ID)
		require.Equal(t, "Updated Option 1", patchedCPA.Attrs.Options[0].Name)
		require.Equal(t, "#333333", patchedCPA.Attrs.Options[0].Color)
		require.NotEmpty(t, patchedCPA.Attrs.Options[1].ID)
		require.Equal(t, "New Option 1.5", patchedCPA.Attrs.Options[1].Name)
		require.Equal(t, id2, patchedCPA.Attrs.Options[2].ID)
		require.Equal(t, "Updated Option 2", patchedCPA.Attrs.Options[2].Name)
	})

	t.Run("changing a field's type deletes dependent values and emits delete_values:true", func(t *testing.T) {
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		selectField := &model.PropertyField{
			Name: "select_type_change_" + model.NewId(),
			Type: model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Option 1", "color": "#FF5733"},
				},
			},
		}
		created, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), selectField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)

		createdCPA, err := model.NewCPAFieldFromPropertyField(created)
		require.NoError(t, err)
		require.NotEmpty(t, createdCPA.Attrs.Options)
		optionID := createdCPA.Attrs.Options[0].ID
		require.NotEmpty(t, optionID)

		// Seed a value for BasicUser referencing the option.
		_, resp, err = th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, map[string]json.RawMessage{
			created.ID: json.RawMessage(fmt.Sprintf(`"%s"`, optionID)),
		})
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		// Patch type from select → text.
		typePatch := &model.PropertyFieldPatch{Type: model.NewPointer(model.PropertyFieldTypeText)}
		_, resp, err = th.SystemAdminClient.PatchCPAField(context.Background(), created.ID, typePatch)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		// The dependent value must be gone.
		retrieved, resp, err := th.SystemAdminClient.ListCPAValues(context.Background(), th.BasicUser.Id)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		_, present := retrieved[created.ID]
		require.False(t, present, "value should be deleted when the field's type changes")

		// The legacy CPA WS event must carry delete_values:true.
		var sawDeleteValues bool
		require.Eventually(t, func() bool {
			for {
				select {
				case event := <-webSocketClient.EventChannel:
					if event.EventType() != model.WebsocketEventCPAFieldUpdated {
						continue
					}
					if dv, ok := event.GetData()["delete_values"].(bool); ok && dv {
						sawDeleteValues = true
						return true
					}
				default:
					return false
				}
			}
		}, 5*time.Second, 100*time.Millisecond)
		require.True(t, sawDeleteValues, "expected cpa_field_updated to carry delete_values:true on a type change")
	})

	t.Run("patching a field without changing its type preserves existing values", func(t *testing.T) {
		selectField := &model.PropertyField{
			Name: "select_with_values_" + model.NewId(),
			Type: model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Option 1", "color": "#FF5733"},
					map[string]any{"name": "Option 2", "color": "#33FF57"},
				},
			},
		}
		created, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), selectField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)

		createdCPA, err := model.NewCPAFieldFromPropertyField(created)
		require.NoError(t, err)
		require.NotEmpty(t, createdCPA.Attrs.Options)
		optionID := createdCPA.Attrs.Options[0].ID
		require.NotEmpty(t, optionID)

		// Admin writes a value on behalf of BasicUser.
		values := map[string]json.RawMessage{
			created.ID: json.RawMessage(fmt.Sprintf(`"%s"`, optionID)),
		}
		_, resp, err = th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		// Rename field + add an option, keeping Type unchanged.
		patch := &model.PropertyFieldPatch{
			Name: model.NewPointer("renamed_" + model.NewId()),
			Attrs: model.NewPointer(model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": optionID, "name": "Renamed Option 1", "color": "#FF5733"},
					map[string]any{"name": "Option 2", "color": "#33FF57"},
					map[string]any{"name": "Option 3", "color": "#5733FF"},
				},
			}),
		}
		_, resp, err = th.SystemAdminClient.PatchCPAField(context.Background(), created.ID, patch)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		// BasicUser's value for this field should still be present.
		retrieved, resp, err := th.SystemAdminClient.ListCPAValues(context.Background(), th.BasicUser.Id)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		rawValue, ok := retrieved[created.ID]
		require.True(t, ok, "value should still exist after a non-type-changing patch")
		require.Equal(t, json.RawMessage(fmt.Sprintf(`"%s"`, optionID)), rawValue)
	})

	t.Run("options-only patch on a rank field preserves IDs and round-trips ranks", func(t *testing.T) {
		// A rank field is in the options-only permission branch (alongside
		// select/multiselect), so an attrs.options-only patch routes through the
		// manage-options path. Verify the admin patch succeeds and each option's
		// rank persists through the round-trip.
		rankField := &model.PropertyField{
			Name: "rank_field_" + model.NewId(),
			Type: model.PropertyFieldTypeRank,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Low", "rank": 1},
					map[string]any{"name": "High", "rank": 2},
				},
			},
		}
		created, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), rankField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)

		createdCPA, err := model.NewCPAFieldFromPropertyField(created)
		require.NoError(t, err)
		require.Len(t, createdCPA.Attrs.Options, 2)
		id1 := createdCPA.Attrs.Options[0].ID
		id2 := createdCPA.Attrs.Options[1].ID
		require.NotEmpty(t, id1)
		require.NotEmpty(t, id2)
		require.NotNil(t, createdCPA.Attrs.Options[0].Rank)
		require.Equal(t, 1, *createdCPA.Attrs.Options[0].Rank)

		// Options-only patch: re-rank existing options and add a new one.
		patch := &model.PropertyFieldPatch{
			Attrs: model.NewPointer(model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": id1, "name": "Low", "rank": 10},
					map[string]any{"id": id2, "name": "High", "rank": 20},
					map[string]any{"name": "Highest", "rank": 30},
				},
			}),
		}
		patched, resp, err := th.SystemAdminClient.PatchCPAField(context.Background(), created.ID, patch)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		patchedCPA, err := model.NewCPAFieldFromPropertyField(patched)
		require.NoError(t, err)
		require.Len(t, patchedCPA.Attrs.Options, 3)

		require.Equal(t, id1, patchedCPA.Attrs.Options[0].ID)
		require.NotNil(t, patchedCPA.Attrs.Options[0].Rank)
		require.Equal(t, 10, *patchedCPA.Attrs.Options[0].Rank)
		require.Equal(t, id2, patchedCPA.Attrs.Options[1].ID)
		require.NotNil(t, patchedCPA.Attrs.Options[1].Rank)
		require.Equal(t, 20, *patchedCPA.Attrs.Options[1].Rank)
		require.NotEmpty(t, patchedCPA.Attrs.Options[2].ID)
		require.NotNil(t, patchedCPA.Attrs.Options[2].Rank)
		require.Equal(t, 30, *patchedCPA.Attrs.Options[2].Rank)
	})
}

func TestDeleteCPAField(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		// Create a field with a license so we can test the license check on delete.
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
		field := &model.PropertyField{Name: celSafeName(), Type: model.PropertyFieldTypeText}
		createdField, _, createErr := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		require.NoError(t, createErr)
		require.NotNil(t, createdField)

		// Remove the license and verify delete is blocked.
		th.App.Srv().SetLicense(nil)
		resp, err := client.DeleteCPAField(context.Background(), createdField.ID)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.license_error")
	}, "endpoint should not work if no valid license is present")

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("a user without admin permissions should not be able to delete a field", func(t *testing.T) {
		field := &model.PropertyField{
			Name: celSafeName(),
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
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
		}
		createdField, _, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		require.NoError(t, err)
		require.NotNil(t, createdField)
		require.Zero(t, createdField.DeleteAt)

		resp, err := client.DeleteCPAField(context.Background(), createdField.ID)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		// The list endpoint filters out deleted fields, so read at the app layer
		// to confirm the soft-delete landed on the record itself.
		rctx := request.TestContext(t)
		group, appErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
		require.Nil(t, appErr)
		deletedField, appErr := th.App.GetPropertyField(rctx, group.ID, createdField.ID)
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
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
	}).InitBasic(t)

	// License required for field/value creation (LicenseCheckHook)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	th.RemovePermissionFromRole(t, model.PermissionViewMembers.Id, model.SystemUserRoleId)
	defer th.AddPermissionToRole(t, model.PermissionViewMembers.Id, model.SystemUserRoleId)

	field := &model.PropertyField{
		Name: celSafeName(),
		Type: model.PropertyFieldTypeText,
	}

	createdField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
	CheckCreatedStatus(t, resp)
	require.NoError(t, err)
	require.NotNil(t, createdField)

	_, resp, err = th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, map[string]json.RawMessage{
		createdField.ID: json.RawMessage(`"Field Value"`),
	})
	CheckOKStatus(t, resp)
	require.NoError(t, err)

	t.Run("endpoint should not work if no valid license is present", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)
		defer th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

		values, resp, err := th.Client.ListCPAValues(context.Background(), th.BasicUser.Id)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.license_error")
		require.Empty(t, values)
	})

	// login with Client2 from this point on
	th.LoginBasic2(t)

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
		arrayField := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeMultiselect,
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": optionID1, "name": "option1"},
					{"id": optionID2, "name": "option2"},
				},
			},
		}

		createdArrayField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), arrayField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdArrayField)

		_, resp, err = th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, map[string]json.RawMessage{
			createdArrayField.ID: json.RawMessage(fmt.Sprintf(`["%s", "%s"]`, optionID1, optionID2)),
		})
		CheckOKStatus(t, resp)
		require.NoError(t, err)

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
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
	}).InitBasic(t)

	// License required for field creation (LicenseCheckHook)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	field := &model.PropertyField{
		Name: celSafeName(),
		Type: model.PropertyFieldTypeText,
	}

	createdField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
	CheckCreatedStatus(t, resp)
	require.NoError(t, err)
	require.NotNil(t, createdField)

	t.Run("endpoint should not work if no valid license is present", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)
		defer th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

		values := map[string]json.RawMessage{createdField.ID: json.RawMessage(`"Field Value"`)}
		patchedValues, resp, err := th.Client.PatchCPAValues(context.Background(), values)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.license_error")
		require.Empty(t, patchedValues)
	})

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

		arrayField := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeMultiselect,
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": optionsID[0], "name": "option1"},
					{"id": optionsID[1], "name": "option2"},
					{"id": optionsID[2], "name": "option3"},
					{"id": optionsID[3], "name": "option4"},
				},
			},
		}

		createdArrayField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), arrayField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
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
		ldapField := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsLDAP: "ldap_attr",
			},
		}

		createdLDAPField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), ldapField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdLDAPField)

		// Create a field with SAML attribute
		samlField := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsSAML: "saml_attr",
			},
		}

		createdSAMLField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), samlField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdSAMLField)

		// Test LDAP field
		values := map[string]json.RawMessage{
			createdLDAPField.ID: json.RawMessage(`"LDAP Value"`),
		}
		_, resp, err = th.Client.PatchCPAValues(context.Background(), values)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.sync_lock.app_error")

		// Test SAML field
		values = map[string]json.RawMessage{
			createdSAMLField.ID: json.RawMessage(`"SAML Value"`),
		}
		_, resp, err = th.Client.PatchCPAValues(context.Background(), values)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.sync_lock.app_error")

		// Test multiple fields with one being LDAP synced
		values = map[string]json.RawMessage{
			createdField.ID:     json.RawMessage(`"Regular Value"`),
			createdLDAPField.ID: json.RawMessage(`"LDAP Value"`),
		}
		_, resp, err = th.Client.PatchCPAValues(context.Background(), values)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.sync_lock.app_error")
	})

	t.Run("an invalid patch should be rejected", func(t *testing.T) {
		field := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
		}

		createdField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdField)

		// Create a value that's too long (over 64 characters)
		tooLongValue := strings.Repeat("a", model.CPAValueTypeTextMaxLength+1)
		values := map[string]json.RawMessage{
			createdField.ID: json.RawMessage(fmt.Sprintf(`"%s"`, tooLongValue)),
		}

		_, resp, err = th.Client.PatchCPAValues(context.Background(), values)
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property_value.validate.app_error")
	})

	t.Run("admin-managed fields", func(t *testing.T) {
		// Create a managed field (only admins can create fields)
		managedField := &model.PropertyField{
			Name: "managed_field_" + model.NewId(),
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsManaged: "admin",
			},
		}

		createdManagedField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), managedField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdManagedField)

		// Create a non-managed field for comparison
		regularField := &model.PropertyField{
			Name: "regular_field_" + model.NewId(),
			Type: model.PropertyFieldTypeText,
		}

		createdRegularField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), regularField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdRegularField)

		t.Run("regular user cannot update managed field", func(t *testing.T) {
			values := map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Managed Value"`),
			}

			_, resp, err := th.Client.PatchCPAValues(context.Background(), values)
			CheckForbiddenStatus(t, resp)
			require.Error(t, err)
			CheckErrorID(t, err, "api.property_value.patch.no_values_permission.app_error")
		})

		t.Run("regular user can update non-managed field", func(t *testing.T) {
			values := map[string]json.RawMessage{
				createdRegularField.ID: json.RawMessage(`"Regular Value"`),
			}

			patchedValues, resp, err := th.Client.PatchCPAValues(context.Background(), values)
			CheckOKStatus(t, resp)
			require.NoError(t, err)
			require.NotEmpty(t, patchedValues)

			var actualValue string
			require.NoError(t, json.Unmarshal(patchedValues[createdRegularField.ID], &actualValue))
			require.Equal(t, "Regular Value", actualValue)
		})

		t.Run("system admin can update managed field", func(t *testing.T) {
			values := map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Admin Updated Value"`),
			}

			patchedValues, resp, err := th.SystemAdminClient.PatchCPAValues(context.Background(), values)
			CheckOKStatus(t, resp)
			require.NoError(t, err)
			require.NotEmpty(t, patchedValues)

			var actualValue string
			require.NoError(t, json.Unmarshal(patchedValues[createdManagedField.ID], &actualValue))
			require.Equal(t, "Admin Updated Value", actualValue)
		})

		t.Run("batch update with managed fields fails for regular user", func(t *testing.T) {
			// Admin seeds initial values for both fields on BasicUser.
			_, resp, err := th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, map[string]json.RawMessage{
				createdRegularField.ID: json.RawMessage(`"Initial Regular Value"`),
			})
			CheckOKStatus(t, resp)
			require.NoError(t, err)

			_, resp, err = th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Initial Managed Value"`),
			})
			CheckOKStatus(t, resp)
			require.NoError(t, err)

			// Try to batch update both managed and regular fields - this should fail
			attemptedValues := map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Managed Batch Value"`),
				createdRegularField.ID: json.RawMessage(`"Regular Batch Value"`),
			}

			_, resp, err = th.Client.PatchCPAValues(context.Background(), attemptedValues)
			CheckForbiddenStatus(t, resp)
			require.Error(t, err)
			CheckErrorID(t, err, "api.property_value.patch.no_values_permission.app_error")

			// Verify that no values were updated when the batch operation failed.
			currentValues, resp, err := th.SystemAdminClient.ListCPAValues(context.Background(), th.BasicUser.Id)
			CheckOKStatus(t, resp)
			require.NoError(t, err)

			var managedValue, regularValue string
			require.NoError(t, json.Unmarshal(currentValues[createdManagedField.ID], &managedValue))
			require.NoError(t, json.Unmarshal(currentValues[createdRegularField.ID], &regularValue))
			require.Equal(t, "Initial Managed Value", managedValue, "Managed field should not have been updated in failed batch operation")
			require.Equal(t, "Initial Regular Value", regularValue, "Regular field should not have been updated in failed batch operation")
		})

		t.Run("batch update with managed fields succeeds for admin", func(t *testing.T) {
			values := map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Admin Managed Batch"`),
				createdRegularField.ID: json.RawMessage(`"Admin Regular Batch"`),
			}

			patchedValues, resp, err := th.SystemAdminClient.PatchCPAValues(context.Background(), values)
			CheckOKStatus(t, resp)
			require.NoError(t, err)
			require.Len(t, patchedValues, 2)

			var managedValue, regularValue string
			require.NoError(t, json.Unmarshal(patchedValues[createdManagedField.ID], &managedValue))
			require.NoError(t, json.Unmarshal(patchedValues[createdRegularField.ID], &regularValue))
			require.Equal(t, "Admin Managed Batch", managedValue)
			require.Equal(t, "Admin Regular Batch", regularValue)
		})
	})

	t.Run("patch fails if any field in the map does not exist", func(t *testing.T) {
		// App.GetPropertyFields rejects an unknown id with a 404 before the
		// handler's per-field 404 check runs. The property service wraps the
		// store's ErrResultsMismatch with the ErrFieldNotFound sentinel,
		// which mapPropertyServiceError translates into a not-found error.
		values := map[string]json.RawMessage{
			model.NewId(): json.RawMessage(`"any value"`),
		}
		_, resp, err := th.Client.PatchCPAValues(context.Background(), values)
		CheckNotFoundStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property_field.not_found.app_error")
	})

	t.Run("rejects values that fail hook validation", func(t *testing.T) {
		optionsID := []string{model.NewId(), model.NewId(), model.NewId()}
		arrayField := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeMultiselect,
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": optionsID[0], "name": "option1"},
					{"id": optionsID[1], "name": "option2"},
					{"id": optionsID[2], "name": "option3"},
				},
			},
		}

		createdArrayField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), arrayField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdArrayField)

		t.Run("invalid option ID", func(t *testing.T) {
			unknownOption := model.NewId()
			values := map[string]json.RawMessage{
				createdArrayField.ID: json.RawMessage(fmt.Sprintf(`["%s", "%s"]`, optionsID[0], unknownOption)),
			}
			_, resp, err := th.Client.PatchCPAValues(context.Background(), values)
			CheckBadRequestStatus(t, resp)
			require.Error(t, err)
		})

		t.Run("wrong value type (string instead of array)", func(t *testing.T) {
			values := map[string]json.RawMessage{
				createdArrayField.ID: json.RawMessage(`"not an array"`),
			}
			_, resp, err := th.Client.PatchCPAValues(context.Background(), values)
			CheckBadRequestStatus(t, resp)
			require.Error(t, err)
		})
	})
}

func TestPatchCPAValuesForUser(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
	}).InitBasic(t)

	// License required for field creation (LicenseCheckHook)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	field := &model.PropertyField{
		Name: celSafeName(),
		Type: model.PropertyFieldTypeText,
	}

	createdField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
	CheckCreatedStatus(t, resp)
	require.NoError(t, err)
	require.NotNil(t, createdField)

	t.Run("endpoint should not work if no valid license is present", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)
		defer th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

		values := map[string]json.RawMessage{createdField.ID: json.RawMessage(`"Field Value"`)}
		patchedValues, resp, err := th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.license_error")
		require.Empty(t, patchedValues)
	})

	// add a valid license
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("any team member should be able to create their own values", func(t *testing.T) {
		webSocketClient := th.CreateConnectedWebSocketClient(t)

		values := map[string]json.RawMessage{}
		value := "Field Value"
		values[createdField.ID] = json.RawMessage(fmt.Sprintf(`"  %s "`, value)) // value should be sanitized
		patchedValues, resp, err := th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
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
		patchedValues, resp, err := th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
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

		arrayField := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeMultiselect,
			Attrs: model.StringInterface{
				"options": []map[string]any{
					{"id": optionsID[0], "name": "option1"},
					{"id": optionsID[1], "name": "option2"},
					{"id": optionsID[2], "name": "option3"},
					{"id": optionsID[3], "name": "option4"},
				},
			},
		}

		createdArrayField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), arrayField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdArrayField)

		values := map[string]json.RawMessage{
			createdArrayField.ID: json.RawMessage(fmt.Sprintf(`["%s", "%s", "%s"]`, optionsID[0], optionsID[1], optionsID[2])),
		}
		patchedValues, resp, err := th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.NotEmpty(t, patchedValues)

		var actualValues []string
		require.NoError(t, json.Unmarshal(patchedValues[createdArrayField.ID], &actualValues))
		require.Equal(t, optionsID[:3], actualValues)

		// Test updating array values
		values[createdArrayField.ID] = json.RawMessage(fmt.Sprintf(`["%s", "%s"]`, optionsID[2], optionsID[3]))
		patchedValues, resp, err = th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		actualValues = nil
		require.NoError(t, json.Unmarshal(patchedValues[createdArrayField.ID], &actualValues))
		require.Equal(t, optionsID[2:4], actualValues)
	})

	t.Run("should fail if any of the values belongs to a field that is LDAP/SAML synced", func(t *testing.T) {
		// Create a field with LDAP attribute
		ldapField := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsLDAP: "ldap_attr",
			},
		}

		createdLDAPField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), ldapField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdLDAPField)

		// Create a field with SAML attribute
		samlField := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsSAML: "saml_attr",
			},
		}

		createdSAMLField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), samlField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdSAMLField)

		// Test LDAP field
		values := map[string]json.RawMessage{
			createdLDAPField.ID: json.RawMessage(`"LDAP Value"`),
		}
		_, resp, err = th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.sync_lock.app_error")

		// Test SAML field
		values = map[string]json.RawMessage{
			createdSAMLField.ID: json.RawMessage(`"SAML Value"`),
		}
		_, resp, err = th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.sync_lock.app_error")

		// Test multiple fields with one being LDAP synced
		values = map[string]json.RawMessage{
			createdField.ID:     json.RawMessage(`"Regular Value"`),
			createdLDAPField.ID: json.RawMessage(`"LDAP Value"`),
		}
		_, resp, err = th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.sync_lock.app_error")
	})

	t.Run("an invalid patch should be rejected", func(t *testing.T) {
		field := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
		}

		createdField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdField)

		// Create a value that's too long (over 64 characters)
		tooLongValue := strings.Repeat("a", model.CPAValueTypeTextMaxLength+1)
		values := map[string]json.RawMessage{
			createdField.ID: json.RawMessage(fmt.Sprintf(`"%s"`, tooLongValue)),
		}

		_, resp, err = th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
		CheckBadRequestStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property_value.validate.app_error")
	})

	t.Run("admin-managed fields", func(t *testing.T) {
		// Create a managed field (only admins can create fields)
		managedField := &model.PropertyField{
			Name: "managed_field_" + model.NewId(),
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsManaged: "admin",
			},
		}

		createdManagedField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), managedField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdManagedField)

		// Create a non-managed field for comparison
		regularField := &model.PropertyField{
			Name: "regular_field_" + model.NewId(),
			Type: model.PropertyFieldTypeText,
		}

		createdRegularField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), regularField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, createdRegularField)

		t.Run("regular user cannot update managed field", func(t *testing.T) {
			values := map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Managed Value"`),
			}

			_, resp, err := th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
			CheckForbiddenStatus(t, resp)
			require.Error(t, err)
			CheckErrorID(t, err, "api.property_value.patch.no_values_permission.app_error")
		})

		t.Run("regular user can update non-managed field", func(t *testing.T) {
			values := map[string]json.RawMessage{
				createdRegularField.ID: json.RawMessage(`"Regular Value"`),
			}

			patchedValues, resp, err := th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
			CheckOKStatus(t, resp)
			require.NoError(t, err)
			require.NotEmpty(t, patchedValues)

			var actualValue string
			require.NoError(t, json.Unmarshal(patchedValues[createdRegularField.ID], &actualValue))
			require.Equal(t, "Regular Value", actualValue)
		})

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			// Seed a baseline value that the test run then replaces.
			_, resp, err := th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), th.SystemAdminUser.Id, map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Initial Admin Value"`),
			})
			CheckOKStatus(t, resp)
			require.NoError(t, err)

			values := map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Admin Updated Value"`),
			}

			patchedValues, resp, err := client.PatchCPAValuesForUser(context.Background(), th.SystemAdminUser.Id, values)
			CheckOKStatus(t, resp)
			require.NoError(t, err)
			require.NotEmpty(t, patchedValues)

			var actualValue string
			require.NoError(t, json.Unmarshal(patchedValues[createdManagedField.ID], &actualValue))
			require.Equal(t, "Admin Updated Value", actualValue)
		}, "system admin can update managed field")

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			values := map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Admin Updated Managed Value For Other User"`),
			}

			patchedValues, resp, err := th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
			CheckOKStatus(t, resp)
			require.NoError(t, err)
			require.NotEmpty(t, patchedValues)

			var actualValue string
			require.NoError(t, json.Unmarshal(patchedValues[createdManagedField.ID], &actualValue))
			require.Equal(t, "Admin Updated Managed Value For Other User", actualValue)

			// Verify the value was actually set for the target user
			userValues, resp, err := th.SystemAdminClient.ListCPAValues(context.Background(), th.BasicUser.Id)
			CheckOKStatus(t, resp)
			require.NoError(t, err)
			require.NotEmpty(t, userValues)

			var storedValue string
			require.NoError(t, json.Unmarshal(userValues[createdManagedField.ID], &storedValue))
			require.Equal(t, "Admin Updated Managed Value For Other User", storedValue)
		}, "system admin can update managed field values for other users")

		t.Run("a user should not be able to update other user's field values", func(t *testing.T) {
			values := map[string]json.RawMessage{
				createdRegularField.ID: json.RawMessage(`"Attempted Value For Other User"`),
			}

			// th.Client (BasicUser) trying to update th.BasicUser2's values should fail
			_, resp, err := th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser2.Id, values)
			CheckForbiddenStatus(t, resp)
			require.Error(t, err)
			CheckErrorID(t, err, "api.context.permissions.app_error")
		})

		t.Run("batch update with managed fields fails for regular user", func(t *testing.T) {
			// Admin seeds initial values for both fields on BasicUser.
			_, resp, err := th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, map[string]json.RawMessage{
				createdRegularField.ID: json.RawMessage(`"Initial Regular Value"`),
			})
			CheckOKStatus(t, resp)
			require.NoError(t, err)

			_, resp, err = th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Initial Managed Value"`),
			})
			CheckOKStatus(t, resp)
			require.NoError(t, err)

			// Try to batch update both managed and regular fields - this should fail
			attemptedValues := map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Managed Batch Value"`),
				createdRegularField.ID: json.RawMessage(`"Regular Batch Value"`),
			}

			_, resp, err = th.Client.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, attemptedValues)
			CheckForbiddenStatus(t, resp)
			require.Error(t, err)
			CheckErrorID(t, err, "api.property_value.patch.no_values_permission.app_error")

			// Verify that no values were updated when the batch operation failed.
			currentValues, resp, err := th.SystemAdminClient.ListCPAValues(context.Background(), th.BasicUser.Id)
			CheckOKStatus(t, resp)
			require.NoError(t, err)

			var managedValue, regularValue string
			require.NoError(t, json.Unmarshal(currentValues[createdManagedField.ID], &managedValue))
			require.NoError(t, json.Unmarshal(currentValues[createdRegularField.ID], &regularValue))
			require.Equal(t, "Initial Managed Value", managedValue, "Managed field should not have been updated in failed batch operation")
			require.Equal(t, "Initial Regular Value", regularValue, "Regular field should not have been updated in failed batch operation")
		})

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
			values := map[string]json.RawMessage{
				createdManagedField.ID: json.RawMessage(`"Admin Managed Batch"`),
				createdRegularField.ID: json.RawMessage(`"Admin Regular Batch"`),
			}

			patchedValues, resp, err := th.SystemAdminClient.PatchCPAValuesForUser(context.Background(), th.BasicUser.Id, values)
			CheckOKStatus(t, resp)
			require.NoError(t, err)
			require.Len(t, patchedValues, 2)

			var managedValue, regularValue string
			require.NoError(t, json.Unmarshal(patchedValues[createdManagedField.ID], &managedValue))
			require.NoError(t, json.Unmarshal(patchedValues[createdRegularField.ID], &regularValue))
			require.Equal(t, "Admin Managed Batch", managedValue)
			require.Equal(t, "Admin Regular Batch", regularValue)
		}, "batch update with managed fields succeeds for admin")
	})
}

// TestCPANonAdminWriteOwnValueViaGenericAPI confirms a non-admin user can set
// their own value on a regular CPA field via the generic property API.
func TestCPANonAdminWriteOwnValueViaGenericAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	field := &model.PropertyField{
		Name: celSafeName(),
		Type: model.PropertyFieldTypeText,
	}
	createdField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
	CheckCreatedStatus(t, resp)
	require.NoError(t, err)
	require.NotNil(t, createdField)

	value := "Self Value"
	items := []model.PropertyValuePatchItem{{
		FieldID: createdField.ID,
		Value:   json.RawMessage(fmt.Sprintf(`%q`, value)),
	}}

	upserted, resp, err := th.Client.PatchPropertyValues(
		context.Background(),
		model.AccessControlPropertyGroupName,
		model.PropertyFieldObjectTypeUser,
		th.BasicUser.Id,
		items,
	)
	CheckOKStatus(t, resp)
	require.NoError(t, err)
	require.Len(t, upserted, 1)
	require.Equal(t, createdField.ID, upserted[0].FieldID)
	require.Equal(t, th.BasicUser.Id, upserted[0].TargetID)
	require.Equal(t, model.PropertyValueTargetTypeUser, upserted[0].TargetType)

	var actualValue string
	require.NoError(t, json.Unmarshal(upserted[0].Value, &actualValue))
	require.Equal(t, value, actualValue)

	// Verify the write persisted via a generic-API read on the same target.
	stored, resp, err := th.Client.GetPropertyValues(
		context.Background(),
		model.AccessControlPropertyGroupName,
		model.PropertyFieldObjectTypeUser,
		th.BasicUser.Id,
		model.PropertyValueSearch{PerPage: 60},
	)
	CheckOKStatus(t, resp)
	require.NoError(t, err)
	require.Len(t, stored, 1)
	require.Equal(t, createdField.ID, stored[0].FieldID)

	var readValue string
	require.NoError(t, json.Unmarshal(stored[0].Value, &readValue))
	require.Equal(t, value, readValue)
}

// TestCPANonAdminBlockedFromAdminManagedViaGenericAPI confirms a non-admin user
// is blocked from writing their own value on an admin-only CPA field via the
// generic property API.
func TestCPANonAdminBlockedFromAdminManagedViaGenericAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	managedField := &model.PropertyField{
		Name: celSafeName(),
		Type: model.PropertyFieldTypeText,
		Attrs: model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsManaged: "admin",
		},
	}
	createdManagedField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), managedField)
	CheckCreatedStatus(t, resp)
	require.NoError(t, err)
	require.NotNil(t, createdManagedField)

	items := []model.PropertyValuePatchItem{{
		FieldID: createdManagedField.ID,
		Value:   json.RawMessage(`"Non-Admin Value"`),
	}}

	t.Run("non-admin writing own admin-managed value is forbidden", func(t *testing.T) {
		_, resp, err := th.Client.PatchPropertyValues(
			context.Background(),
			model.AccessControlPropertyGroupName,
			model.PropertyFieldObjectTypeUser,
			th.BasicUser.Id,
			items,
		)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "api.property_value.patch.no_values_permission.app_error")
	})

	t.Run("admin writing same admin-managed value succeeds", func(t *testing.T) {
		adminItems := []model.PropertyValuePatchItem{{
			FieldID: createdManagedField.ID,
			Value:   json.RawMessage(`"Admin Value"`),
		}}
		upserted, resp, err := th.SystemAdminClient.PatchPropertyValues(
			context.Background(),
			model.AccessControlPropertyGroupName,
			model.PropertyFieldObjectTypeUser,
			th.BasicUser.Id,
			adminItems,
		)
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.Len(t, upserted, 1)

		var actualValue string
		require.NoError(t, json.Unmarshal(upserted[0].Value, &actualValue))
		require.Equal(t, "Admin Value", actualValue)
	})
}

// TestCPACrossAPIFieldRoundtrip verifies that a CPA field created via one
// API surface reads back equivalently from the other. We deliberately do
// not do a full map-equality on Attrs: ToPropertyField packs empty-string
// defaults for every CPA-known key, so CPA→generic→CPA is lossy at the
// map level. Compare the explicit set of fields that should match instead.
func TestCPACrossAPIFieldRoundtrip(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("create via CPA API, read via generic API", func(t *testing.T) {
		name := celSafeName()
		field := &model.PropertyField{
			Name: name,
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsValueType:  model.CustomProfileAttributesValueTypeEmail,
				model.CustomProfileAttributesPropertyAttrsSortOrder:  5,
				model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityWhenSet,
			},
		}
		created, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, created)

		listed, resp, err := th.SystemAdminClient.GetPropertyFields(
			context.Background(),
			model.AccessControlPropertyGroupName,
			model.PropertyFieldObjectTypeUser,
			model.PropertyFieldSearch{
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				PerPage:    60,
			},
		)
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		var found *model.PropertyField
		for _, pf := range listed {
			if pf.ID == created.ID {
				found = pf
				break
			}
		}
		require.NotNil(t, found, "field created via CPA API should be readable via generic API")

		require.Equal(t, created.ID, found.ID)
		require.Equal(t, name, found.Name)
		require.Equal(t, created.Type, found.Type)
		require.Equal(t, created.GroupID, found.GroupID)
		require.Equal(t, model.PropertyFieldObjectTypeUser, found.ObjectType)
		require.Equal(t, string(model.PropertyFieldTargetLevelSystem), found.TargetType)
		require.Empty(t, found.TargetID)
		require.Equal(t, created.CreatedBy, found.CreatedBy)
		require.Equal(t, created.CreateAt, found.CreateAt)
		require.Equal(t, int64(0), found.DeleteAt)
		require.Equal(t, created.PermissionField, found.PermissionField)
		require.Equal(t, created.PermissionValues, found.PermissionValues)
		require.Equal(t, created.PermissionOptions, found.PermissionOptions)

		require.Equal(t, model.CustomProfileAttributesValueTypeEmail, found.Attrs[model.CustomProfileAttributesPropertyAttrsValueType])
		require.EqualValues(t, 5, found.Attrs[model.CustomProfileAttributesPropertyAttrsSortOrder])
		require.Equal(t, model.CustomProfileAttributesVisibilityWhenSet, found.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility])
	})

	t.Run("create via generic API, read via CPA API", func(t *testing.T) {
		name := celSafeName()
		field := &model.PropertyField{
			Name:       name,
			Type:       model.PropertyFieldTypeText,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsSortOrder:  3,
				model.CustomProfileAttributesPropertyAttrsVisibility: model.CustomProfileAttributesVisibilityAlways,
			},
		}
		created, resp, err := th.SystemAdminClient.CreatePropertyField(
			context.Background(),
			model.AccessControlPropertyGroupName,
			model.PropertyFieldObjectTypeUser,
			field,
		)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)
		require.NotNil(t, created)

		listed, resp, err := th.SystemAdminClient.ListCPAFields(context.Background())
		CheckOKStatus(t, resp)
		require.NoError(t, err)

		var found *model.PropertyField
		for _, pf := range listed {
			if pf.ID == created.ID {
				found = pf
				break
			}
		}
		require.NotNil(t, found, "field created via generic API should be readable via CPA ListCPAFields")

		require.Equal(t, created.ID, found.ID)
		require.Equal(t, name, found.Name)
		require.Equal(t, created.Type, found.Type)
		require.Equal(t, created.GroupID, found.GroupID)
		require.Equal(t, created.CreateAt, found.CreateAt)
		require.Equal(t, int64(0), found.DeleteAt)

		// The CPA list response is CPAField-shaped: unmarshal to confirm
		// the typed attrs struct round-trips cleanly.
		cpaField, err := model.NewCPAFieldFromPropertyField(found)
		require.NoError(t, err)
		require.EqualValues(t, 3, cpaField.Attrs.SortOrder)
		require.Equal(t, model.CustomProfileAttributesVisibilityAlways, cpaField.Attrs.Visibility)
	})
}

// TestCPABackwardCompatAfterRefactor spot-checks invariants that could have
// drifted in the Phase 7 refactor of the CPA handlers into thin shims. Broad
// behavioral equivalence is already covered by the existing CPA tests (they
// still pass); these subtests target invariants that those tests don't
// exercise directly.
func TestCPABackwardCompatAfterRefactor(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
		cfg.FeatureFlags.IntegratedBoards = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	t.Run("ListCPAFields preserves sort_order ordering", func(t *testing.T) {
		// Create in a non-sorted order; ListCPAFields should return them
		// sorted ascending by sort_order via CPAFieldsFromPropertyFields.
		ids := make([]string, 3)
		for _, order := range []int{2, 0, 1} {
			field := &model.PropertyField{
				Name: celSafeName(),
				Type: model.PropertyFieldTypeText,
				Attrs: model.StringInterface{
					model.CustomProfileAttributesPropertyAttrsSortOrder: order,
				},
			}
			created, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
			CheckCreatedStatus(t, resp)
			require.NoError(t, err)
			ids[order] = created.ID
		}

		listed, resp, err := th.SystemAdminClient.ListCPAFields(context.Background())
		CheckOKStatus(t, resp)
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(listed), 3)

		// Extract the three fields we just created, preserving ListCPAFields
		// return order, and verify they match ids[0], ids[1], ids[2].
		var observed []string
		for _, pf := range listed {
			for _, expected := range ids {
				if pf.ID == expected {
					observed = append(observed, pf.ID)
				}
			}
		}
		require.Equal(t, ids, observed, "ListCPAFields must return fields in ascending sort_order")
	})

	t.Run("CPA create response has typed CPAField attrs, with defaults filled", func(t *testing.T) {
		field := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsValueType: model.CustomProfileAttributesValueTypeEmail,
			},
		}
		created, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), field)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)

		// The CPA response goes through ToPropertyField on the server side,
		// so every CPA-known attrs key is present — including defaults like
		// Visibility="when_set" that the caller did not send.
		require.Contains(t, created.Attrs, model.CustomProfileAttributesPropertyAttrsValueType)
		require.Contains(t, created.Attrs, model.CustomProfileAttributesPropertyAttrsVisibility)
		require.Contains(t, created.Attrs, model.CustomProfileAttributesPropertyAttrsSortOrder)
		require.Contains(t, created.Attrs, model.CustomProfileAttributesPropertyAttrsLDAP)
		require.Contains(t, created.Attrs, model.CustomProfileAttributesPropertyAttrsSAML)
		require.Contains(t, created.Attrs, model.CustomProfileAttributesPropertyAttrsManaged)

		cpaField, err := model.NewCPAFieldFromPropertyField(created)
		require.NoError(t, err)
		require.Equal(t, model.CustomProfileAttributesValueTypeEmail, cpaField.Attrs.ValueType)
		require.Equal(t, model.CustomProfileAttributesVisibilityWhenSet, cpaField.Attrs.Visibility)
	})

	t.Run("AccessControlHook still blocks LDAP-synced writes via CPA path", func(t *testing.T) {
		ldapField := &model.PropertyField{
			Name: celSafeName(),
			Type: model.PropertyFieldTypeText,
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsLDAP: "ldap_attr",
			},
		}
		createdLDAPField, resp, err := th.SystemAdminClient.CreateCPAField(context.Background(), ldapField)
		CheckCreatedStatus(t, resp)
		require.NoError(t, err)

		_, resp, err = th.SystemAdminClient.PatchCPAValuesForUser(
			context.Background(),
			th.BasicUser.Id,
			map[string]json.RawMessage{createdLDAPField.ID: json.RawMessage(`"attempted write"`)},
		)
		CheckForbiddenStatus(t, resp)
		require.Error(t, err)
		CheckErrorID(t, err, "app.property.sync_lock.app_error")
	})
}
