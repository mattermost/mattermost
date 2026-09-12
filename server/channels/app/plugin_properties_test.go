// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// cleanupCPAFields deletes all existing CPA fields to ensure a clean state
func cleanupCPAFields(t *testing.T, th *TestHelper) {
	t.Helper()

	cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
	require.Nil(t, groupErr)
	cpaID := cpaGroup.ID

	fields, searchErr := th.App.Srv().Store().PropertyField().SearchPropertyFields(model.PropertyFieldSearchOpts{
		GroupID: cpaID,
		PerPage: 100,
	})
	require.NoError(t, searchErr)

	for _, field := range fields {
		deleteErr := th.App.Srv().Store().PropertyField().Delete(cpaID, field.ID)
		require.NoError(t, deleteErr)
	}
}

func TestPluginProperties(t *testing.T) {
	th := Setup(t).InitBasic(t)

	// Subtests that exercise the access_control group require an
	// Enterprise license because LicenseCheckHook gates that group.
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
	t.Cleanup(func() { _ = th.App.Srv().RemoveLicense() })

	t.Run("test property field methods", func(t *testing.T) {
		groupName := model.NewId()
		tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Register a property group
				group, err := p.API.RegisterPropertyGroup("` + groupName + `")
				if err != nil {
					return fmt.Errorf("failed to register property group: %w", err)
				}

				// Create a property field
				fieldName := "Test Field " + model.NewId()
				field := &model.PropertyField{
					GroupID:     group.ID,
					Name:        fieldName,
					Type:        model.PropertyFieldTypeText,
					TargetType:  "user",
				}

				createdField, err := p.API.CreatePropertyField(field)
				if err != nil {
					return fmt.Errorf("failed to create property field: %w", err)
				}

				// Verify the field was created correctly
				retrievedField, err := p.API.GetPropertyField(group.ID, createdField.ID)
				if err != nil {
					return fmt.Errorf("failed to get property field: %w", err)
				}
				if retrievedField.Name != fieldName {
					return fmt.Errorf("field name mismatch: expected '%s', got '%s'", fieldName, retrievedField.Name)
				}

				// Update the field
				retrievedField.Name = "Updated Test Field"
				updatedField, err := p.API.UpdatePropertyField(group.ID, retrievedField)
				if err != nil {
					return fmt.Errorf("failed to update property field: %w", err)
				}
				if updatedField.Name != "Updated Test Field" {
					return fmt.Errorf("updated field name mismatch: expected 'Updated Test Field', got '%s'", updatedField.Name)
				}

				// Search for fields
				fields, err := p.API.SearchPropertyFields(group.ID, model.PropertyFieldSearchOpts{PerPage: 50})
				if err != nil {
					return fmt.Errorf("failed to search property fields: %w", err)
				}
				if len(fields) != 1 {
					return fmt.Errorf("unexpected number of fields: expected 1, got %d", len(fields))
				}

				// Delete the field
				err = p.API.DeletePropertyField(group.ID, updatedField.ID)
				if err != nil {
					return fmt.Errorf("failed to delete property field: %w", err)
				}

				// Verify deletion
				fields, err = p.API.SearchPropertyFields(group.ID, model.PropertyFieldSearchOpts{PerPage: 50})
				if err != nil {
					return fmt.Errorf("failed to search property fields after deletion: %w", err)
				}
				if len(fields) != 0 {
					return fmt.Errorf("field still exists after deletion: found %d fields", len(fields))
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 1)
		require.NoError(t, activationErrors[0])

		// Clean up
		err2 := th.App.DisablePlugin(pluginIDs[0])
		require.Nil(t, err2)
		appErr := th.App.ch.RemovePlugin(pluginIDs[0])
		require.Nil(t, appErr)
	})

	t.Run("test property value methods", func(t *testing.T) {
		groupName := model.NewId()
		tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Register a property group
				group, err := p.API.RegisterPropertyGroup("` + groupName + `")
				if err != nil {
					return fmt.Errorf("failed to register property group: %w", err)
				}

				// Create a property field
				fieldName := "Test Field " + model.NewId()
				field := &model.PropertyField{
					GroupID:     group.ID,
					Name:        fieldName,
					Type:        model.PropertyFieldTypeText,
					TargetType:  "user",
				}

				createdField, err := p.API.CreatePropertyField(field)
				if err != nil {
					return fmt.Errorf("failed to create property field: %w", err)
				}

				// Create a property value
				targetId := model.NewId()
				valueJson := []byte("\"test-value\"")
				value := &model.PropertyValue{
					GroupID:    group.ID,
					FieldID:    createdField.ID,
					TargetID:   targetId,
					TargetType: "user",
					Value:      valueJson,
				}

				createdValue, err := p.API.CreatePropertyValue(value)
				if err != nil {
					return fmt.Errorf("failed to create property value: %w", err)
				}

				// Verify the value was created correctly
				retrievedValue, err := p.API.GetPropertyValue(group.ID, createdValue.ID)
				if err != nil {
					return fmt.Errorf("failed to get property value: %w", err)
				}
				if string(retrievedValue.Value) != "\"test-value\"" {
					return fmt.Errorf("value mismatch: expected '\"test-value\"', got '%s'", string(retrievedValue.Value))
				}

				// Update the value
				retrievedValue.Value = []byte("\"updated-test-value\"")
				updatedValue, err := p.API.UpdatePropertyValue(group.ID, retrievedValue)
				if err != nil {
					return fmt.Errorf("failed to update property value: %w", err)
				}
				if string(updatedValue.Value) != "\"updated-test-value\"" {
					return fmt.Errorf("updated value mismatch: expected '\"updated-test-value\"', got '%s'", string(updatedValue.Value))
				}

				// Upsert the value
				upsertValueJson := []byte("\"upserted-value\"")
				upsertValue := &model.PropertyValue{
					GroupID:    group.ID,
					FieldID:    createdField.ID,
					TargetID:   model.NewId(),
					TargetType: "user",
					Value:      upsertValueJson,
				}

				_, err = p.API.UpsertPropertyValue(upsertValue)
				if err != nil {
					return fmt.Errorf("failed to upsert property value: %w", err)
				}

				// Search for values
				values, err := p.API.SearchPropertyValues(group.ID, model.PropertyValueSearchOpts{TargetIDs: []string{targetId}, PerPage: 50})
				if err != nil {
					return fmt.Errorf("failed to search property values: %w", err)
				}
				if len(values) != 1 {
					return fmt.Errorf("unexpected number of values: expected 1, got %d", len(values))
				}

				// Delete the value
				err = p.API.DeletePropertyValue(group.ID, updatedValue.ID)
				if err != nil {
					return fmt.Errorf("failed to delete property value: %w", err)
				}

				// Verify deletion
				values, err = p.API.SearchPropertyValues(group.ID, model.PropertyValueSearchOpts{TargetIDs: []string{targetId}, PerPage: 50})
				if err != nil {
					return fmt.Errorf("failed to search property values after deletion: %w", err)
				}
				if len(values) != 0 {
					return fmt.Errorf("value still exists after deletion: found %d values", len(values))
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 1)
		require.NoError(t, activationErrors[0])

		// Clean up
		err2 := th.App.DisablePlugin(pluginIDs[0])
		require.Nil(t, err2)
		appErr := th.App.ch.RemovePlugin(pluginIDs[0])
		require.Nil(t, appErr)
	})

	t.Run("test property group methods", func(t *testing.T) {
		groupName := model.NewId()
		tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Register a property group
				group, err := p.API.RegisterPropertyGroup("` + groupName + `")
				if err != nil {
					return fmt.Errorf("failed to register property group: %w", err)
				}

				// Get the registered group
				retrievedGroup, err := p.API.GetPropertyGroup(group.Name)
				if err != nil {
					return fmt.Errorf("failed to get property group: %w", err)
				}
				if retrievedGroup.ID != group.ID {
					return fmt.Errorf("group ID mismatch: expected '%s', got '%s'", group.ID, retrievedGroup.ID)
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 1)
		require.NoError(t, activationErrors[0])

		// Clean up
		err2 := th.App.DisablePlugin(pluginIDs[0])
		require.Nil(t, err2)
		appErr := th.App.ch.RemovePlugin(pluginIDs[0])
		require.Nil(t, appErr)
	})

	t.Run("test property field counting", func(t *testing.T) {
		groupName := model.NewId()
		tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Register a property group
				group, err := p.API.RegisterPropertyGroup("` + groupName + `")
				if err != nil {
					return fmt.Errorf("failed to register property group: %w", err)
				}

				// Create multiple property fields for the same target
				targetId := model.NewId()
				for i := 1; i <= 20; i++ {
					field := &model.PropertyField{
						GroupID:     group.ID,
						Name:        fmt.Sprintf("Field %d", i),
						Type:        model.PropertyFieldTypeText,
						TargetType:  "user",
						TargetID:    targetId,
					}

					_, err := p.API.CreatePropertyField(field)
					if err != nil {
						return fmt.Errorf("failed to create property field %d: %w", i, err)
					}
				}

				// Count active fields - should be 20
				count, err := p.API.CountPropertyFields(group.ID, false)
				if err != nil {
					return fmt.Errorf("failed to count property fields: %w", err)
				}
				if count != 20 {
					return fmt.Errorf("expected 20 active fields (test creates 20), got %d", count)
				}

				// Search for fields to get one to delete
				fields, err := p.API.SearchPropertyFields(group.ID, model.PropertyFieldSearchOpts{PerPage: 1})
				if err != nil {
					return fmt.Errorf("failed to search property fields: %w", err)
				}
				if len(fields) == 0 {
					return fmt.Errorf("no fields found to delete")
				}

				// Delete one field
				err = p.API.DeletePropertyField(group.ID, fields[0].ID)
				if err != nil {
					return fmt.Errorf("failed to delete property field: %w", err)
				}

				// Count active fields - should be 19
				count, err = p.API.CountPropertyFields(group.ID, false)
				if err != nil {
					return fmt.Errorf("failed to count property fields after deletion: %w", err)
				}
				if count != 19 {
					return fmt.Errorf("expected 19 active fields after deletion, got %d", count)
				}

				// Count all fields including deleted - should be 20
				totalCount, err := p.API.CountPropertyFields(group.ID, true)
				if err != nil {
					return fmt.Errorf("failed to count all property fields: %w", err)
				}
				if totalCount != 20 {
					return fmt.Errorf("expected 20 total fields including deleted (test created 20), got %d", totalCount)
				}

				// Now creating a new field for the same target should work again
				newField := &model.PropertyField{
					GroupID:     group.ID,
					Name:        "New Field",
					Type:        model.PropertyFieldTypeText,
					TargetType:  "user",
					TargetID:    targetId,
				}

				_, err = p.API.CreatePropertyField(newField)
				if err != nil {
					return fmt.Errorf("failed to create new field after deletion: %w", err)
				}

				// Count should be back to 20
				count, err = p.API.CountPropertyFields(group.ID, false)
				if err != nil {
					return fmt.Errorf("failed to count property fields after new creation: %w", err)
				}
				if count != 20 {
					return fmt.Errorf("expected 20 active fields after new creation (19 + 1), got %d", count)
				}

				// Test that we can create fields for a different target
				differentTargetId := model.NewId()
				for i := 1; i <= 20; i++ {
					field := &model.PropertyField{
						GroupID:     group.ID,
						Name:        fmt.Sprintf("Different Target Field %d", i),
						Type:        model.PropertyFieldTypeText,
						TargetType:  "user",
						TargetID:    differentTargetId,
					}

					_, err := p.API.CreatePropertyField(field)
					if err != nil {
						return fmt.Errorf("failed to create property field %d for different target: %w", i, err)
					}
				}

				// Total count should now be 40 (20 for each target)
				totalCount, err = p.API.CountPropertyFields(group.ID, false)
				if err != nil {
					return fmt.Errorf("failed to count total property fields: %w", err)
				}
				if totalCount != 40 {
					return fmt.Errorf("expected 40 total active fields, got %d", totalCount)
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 1)
		require.NoError(t, activationErrors[0])

		// Clean up
		err2 := th.App.DisablePlugin(pluginIDs[0])
		require.Nil(t, err2)
		appErr := th.App.ch.RemovePlugin(pluginIDs[0])
		require.Nil(t, appErr)
	})

	t.Run("test plugin-created CPA field gets source_plugin_id", func(t *testing.T) {
		cleanupCPAFields(t, th)

		cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
		require.Nil(t, groupErr)
		cpaID := cpaGroup.ID

		tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Create a CPA field
				field := &model.PropertyField{
					GroupID:    "` + cpaID + `",
					Name:       "cpa_test_field",
					Type:       model.PropertyFieldTypeText,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
				}

				createdField, err := p.API.CreatePropertyField(field)
				if err != nil {
					return fmt.Errorf("failed to create CPA field: %w", err)
				}

				// Verify source_plugin_id was automatically set
				if createdField.Attrs == nil {
					return fmt.Errorf("field attrs is nil")
				}

				sourcePluginID, ok := createdField.Attrs["source_plugin_id"].(string)
				if !ok {
					return fmt.Errorf("source_plugin_id not found in attrs")
				}

				if sourcePluginID != p.API.GetPluginID() {
					return fmt.Errorf("source_plugin_id mismatch: expected %s, got %s", p.API.GetPluginID(), sourcePluginID)
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 1)
		require.NoError(t, activationErrors[0])

		// Clean up
		err2 := th.App.DisablePlugin(pluginIDs[0])
		require.Nil(t, err2)
		appErr := th.App.ch.RemovePlugin(pluginIDs[0])
		require.Nil(t, appErr)
	})

	t.Run("test plugin can update its own protected field", func(t *testing.T) {
		cleanupCPAFields(t, th)

		cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
		require.Nil(t, groupErr)
		cpaID := cpaGroup.ID

		tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Create a protected CPA field
				field := &model.PropertyField{
					GroupID:    "` + cpaID + `",
					Name:       "protected_field",
					Type:       model.PropertyFieldTypeText,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
					Attrs: map[string]any{
						"protected": true,
					},
				}

				createdField, err := p.API.CreatePropertyField(field)
				if err != nil {
					return fmt.Errorf("failed to create protected field: %w", err)
				}

				// Try to update the protected field (should succeed since we created it)
				createdField.Name = "updated_protected_field"
				updatedField, err := p.API.UpdatePropertyField("` + cpaID + `", createdField)
				if err != nil {
					return fmt.Errorf("failed to update own protected field: %w", err)
				}

				if updatedField.Name != "updated_protected_field" {
					return fmt.Errorf("field name not updated correctly")
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 1)
		require.NoError(t, activationErrors[0])

		// Clean up
		err2 := th.App.DisablePlugin(pluginIDs[0])
		require.Nil(t, err2)
		appErr := th.App.ch.RemovePlugin(pluginIDs[0])
		require.Nil(t, appErr)
	})

	t.Run("test plugin cannot update another plugin's protected field", func(t *testing.T) {
		cleanupCPAFields(t, th)

		cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
		require.Nil(t, groupErr)
		cpaID := cpaGroup.ID

		// Both plugins in same environment
		tearDown, _, activationErrors := SetAppEnvironmentWithPlugins(t, []string{
			// Plugin 1: creates a protected field
			`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Create a protected CPA field
				field := &model.PropertyField{
					GroupID:    "` + cpaID + `",
					Name:       "plugin1_protected_field",
					Type:       model.PropertyFieldTypeText,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
					Attrs: map[string]any{
						"protected": true,
					},
				}

				_, err := p.API.CreatePropertyField(field)
				if err != nil {
					return fmt.Errorf("failed to create protected field: %w", err)
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
			// Plugin 2: tries to update plugin1's field
			`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Search for plugin1's protected field
				fields, err := p.API.SearchPropertyFields("` + cpaID + `", model.PropertyFieldSearchOpts{PerPage: 100})
				if err != nil {
					return fmt.Errorf("failed to search fields: %w", err)
				}

				var plugin1Field *model.PropertyField
				for _, field := range fields {
					if field.Name == "plugin1_protected_field" {
						plugin1Field = field
						break
					}
				}

				if plugin1Field == nil {
					return fmt.Errorf("plugin1 field not found")
				}

				// Attempt to update it (should fail)
				plugin1Field.Name = "Hacked By Plugin2"
				_, err = p.API.UpdatePropertyField("` + cpaID + `", plugin1Field)
				if err == nil {
					return fmt.Errorf("expected error when updating another plugin's protected field, but got none")
				}

				// Error is expected
				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 2)
		require.NoError(t, activationErrors[0])
		require.NoError(t, activationErrors[1])
	})

	t.Run("test plugin can delete its own protected field", func(t *testing.T) {
		cleanupCPAFields(t, th)

		cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
		require.Nil(t, groupErr)
		cpaID := cpaGroup.ID

		tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Create a protected CPA field
				field := &model.PropertyField{
					GroupID:    "` + cpaID + `",
					Name:       "field_to_delete",
					Type:       model.PropertyFieldTypeText,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
					Attrs: map[string]any{
						"protected": true,
					},
				}

				createdField, err := p.API.CreatePropertyField(field)
				if err != nil {
					return fmt.Errorf("failed to create protected field: %w", err)
				}

				// Try to delete the protected field (should succeed since we created it)
				err = p.API.DeletePropertyField("` + cpaID + `", createdField.ID)
				if err != nil {
					return fmt.Errorf("failed to delete own protected field: %w", err)
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 1)
		require.NoError(t, activationErrors[0])

		// Clean up
		err2 := th.App.DisablePlugin(pluginIDs[0])
		require.Nil(t, err2)
		appErr := th.App.ch.RemovePlugin(pluginIDs[0])
		require.Nil(t, appErr)
	})

	t.Run("test plugin cannot delete another plugin's protected field", func(t *testing.T) {
		cleanupCPAFields(t, th)

		cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
		require.Nil(t, groupErr)
		cpaID := cpaGroup.ID

		// Both plugins in same environment
		tearDown, _, activationErrors := SetAppEnvironmentWithPlugins(t, []string{
			// Plugin 1: creates a protected field
			`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				field := &model.PropertyField{
					GroupID:    "` + cpaID + `",
					Name:       "plugin1_field_to_keep",
					Type:       model.PropertyFieldTypeText,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
					Attrs: map[string]any{
						"protected": true,
					},
				}

				_, err := p.API.CreatePropertyField(field)
				if err != nil {
					return fmt.Errorf("failed to create protected field: %w", err)
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
			// Plugin 2: tries to delete plugin1's field
			`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Search for plugin1's protected field
				fields, err := p.API.SearchPropertyFields("` + cpaID + `", model.PropertyFieldSearchOpts{PerPage: 100})
				if err != nil {
					return fmt.Errorf("failed to search fields: %w", err)
				}

				var plugin1Field *model.PropertyField
				for _, field := range fields {
					if field.Name == "plugin1_field_to_keep" {
						plugin1Field = field
						break
					}
				}

				if plugin1Field == nil {
					return fmt.Errorf("plugin1 field not found")
				}

				// Attempt to delete it (should fail)
				err = p.API.DeletePropertyField("` + cpaID + `", plugin1Field.ID)
				if err == nil {
					return fmt.Errorf("expected error when deleting another plugin's protected field, but got none")
				}

				// Error is expected
				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 2)
		require.NoError(t, activationErrors[0])
		require.NoError(t, activationErrors[1])
	})

	t.Run("test plugin can update values for its own protected field", func(t *testing.T) {
		cleanupCPAFields(t, th)

		cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
		require.Nil(t, groupErr)
		cpaID := cpaGroup.ID

		tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Create a protected CPA field
				field := &model.PropertyField{
					GroupID:    "` + cpaID + `",
					Name:       "protected_field_with_values",
					Type:       model.PropertyFieldTypeText,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
					Attrs: map[string]any{
						"protected": true,
					},
				}

				createdField, err := p.API.CreatePropertyField(field)
				if err != nil {
					return fmt.Errorf("failed to create protected field: %w", err)
				}

				// Create a value for this field
				targetID := model.NewId()
				value := &model.PropertyValue{
					GroupID:    "` + cpaID + `",
					FieldID:    createdField.ID,
					TargetID:   targetID,
					TargetType: "user",
					Value:      []byte("\"initial value\""),
				}

				createdValue, err := p.API.CreatePropertyValue(value)
				if err != nil {
					return fmt.Errorf("failed to create value: %w", err)
				}

				// Update the value (should succeed)
				createdValue.Value = []byte("\"updated value\"")
				updatedValue, err := p.API.UpdatePropertyValue("` + cpaID + `", createdValue)
				if err != nil {
					return fmt.Errorf("failed to update value for own protected field: %w", err)
				}

				if string(updatedValue.Value) != "\"updated value\"" {
					return fmt.Errorf("value not updated correctly")
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 1)
		require.NoError(t, activationErrors[0])

		// Clean up
		err2 := th.App.DisablePlugin(pluginIDs[0])
		require.Nil(t, err2)
		appErr := th.App.ch.RemovePlugin(pluginIDs[0])
		require.Nil(t, appErr)
	})

	t.Run("test plugin cannot update values for another plugin's protected field", func(t *testing.T) {
		cleanupCPAFields(t, th)

		cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
		require.Nil(t, groupErr)
		cpaID := cpaGroup.ID

		testTargetID := model.NewId()

		// Both plugins in same environment
		tearDown, _, activationErrors := SetAppEnvironmentWithPlugins(t, []string{
			// Plugin 1: creates a protected field with a value
			`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				field := &model.PropertyField{
					GroupID:    "` + cpaID + `",
					Name:       "plugin1_field_with_protected_values",
					Type:       model.PropertyFieldTypeText,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
					Attrs: map[string]any{
						"protected": true,
					},
				}

				createdField, err := p.API.CreatePropertyField(field)
				if err != nil {
					return fmt.Errorf("failed to create protected field: %w", err)
				}

				// Create a value
				value := &model.PropertyValue{
					GroupID:    "` + cpaID + `",
					FieldID:    createdField.ID,
					TargetID:   "` + testTargetID + `",
					TargetType: "user",
					Value:      []byte("\"plugin1 value\""),
				}

				_, err = p.API.CreatePropertyValue(value)
				if err != nil {
					return fmt.Errorf("failed to create value: %w", err)
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
			// Plugin 2: tries to update plugin1's field value
			`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Search for plugin1's protected field
				fields, err := p.API.SearchPropertyFields("` + cpaID + `", model.PropertyFieldSearchOpts{PerPage: 100})
				if err != nil {
					return fmt.Errorf("failed to search fields: %w", err)
				}

				var plugin1Field *model.PropertyField
				for _, field := range fields {
					if field.Name == "plugin1_field_with_protected_values" {
						plugin1Field = field
						break
					}
				}

				if plugin1Field == nil {
					return fmt.Errorf("plugin1 field not found")
				}

				// Try to update the value (should fail)
				value := &model.PropertyValue{
					GroupID:    "` + cpaID + `",
					FieldID:    plugin1Field.ID,
					TargetID:   "` + testTargetID + `",
					TargetType: "user",
					Value:      []byte("\"hacked by plugin2\""),
				}

				_, err = p.API.UpsertPropertyValue(value)
				if err == nil {
					return fmt.Errorf("expected error when updating another plugin's protected field value, but got none")
				}

				// Error is expected
				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 2)
		require.NoError(t, activationErrors[0])
		require.NoError(t, activationErrors[1])
	})

	t.Run("test plugin can modify non-protected CPA fields from other plugins", func(t *testing.T) {
		cleanupCPAFields(t, th)

		cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
		require.Nil(t, groupErr)
		cpaID := cpaGroup.ID

		// Both plugins in same environment
		tearDown, _, activationErrors := SetAppEnvironmentWithPlugins(t, []string{
			// Plugin 1: creates a NON-protected field
			`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				field := &model.PropertyField{
					GroupID:    "` + cpaID + `",
					Name:       "non_protected_field",
					Type:       model.PropertyFieldTypeText,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
					// Note: protected is not set
				}

				_, err := p.API.CreatePropertyField(field)
				if err != nil {
					return fmt.Errorf("failed to create non-protected field: %w", err)
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
			// Plugin 2: modifies plugin1's non-protected field
			`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				// Search for plugin1's non-protected field
				fields, err := p.API.SearchPropertyFields("` + cpaID + `", model.PropertyFieldSearchOpts{PerPage: 100})
				if err != nil {
					return fmt.Errorf("failed to search fields: %w", err)
				}

				var plugin1Field *model.PropertyField
				for _, field := range fields {
					if field.Name == "non_protected_field" {
						plugin1Field = field
						break
					}
				}

				if plugin1Field == nil {
					return fmt.Errorf("plugin1 field not found")
				}

				// Update it (should succeed since it's not protected)
				plugin1Field.Name = "modified_by_plugin2"
				_, err = p.API.UpdatePropertyField("` + cpaID + `", plugin1Field)
				if err != nil {
					return fmt.Errorf("failed to update non-protected field: %w", err)
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 2)
		require.NoError(t, activationErrors[0])
		require.NoError(t, activationErrors[1])

		// Verify the field was actually updated
		updatedFields, appErr := th.App.SearchPropertyFields(request.TestContext(t), cpaID, model.PropertyFieldSearchOpts{
			GroupID:    cpaID,
			ObjectType: model.PropertyFieldObjectTypeUser,
			PerPage:    model.AccessControlGroupFieldLimit + 5,
		})
		require.Nil(t, appErr)
		var fieldWasUpdated bool
		for _, field := range updatedFields {
			if field.Name == "modified_by_plugin2" {
				fieldWasUpdated = true
				break
			}
		}
		require.True(t, fieldWasUpdated, "Non-protected field should have been updated by plugin2")
	})

	// A field's options are addressable one at a time, which is what a hierarchy
	// of them needs. Everything a plugin can do to them is exercised in one
	// activation, against a graph template and a field linking to it, because
	// each subtest here compiles and runs a plugin of its own.
	//
	// In the access_control group, because a group a plugin registers for itself
	// is a version 1 group and a legacy field's options are part of the field
	// rather than addressable.
	t.Run("test property field option methods", func(t *testing.T) {
		cleanupCPAFields(t, th)

		cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
		require.Nil(t, groupErr)
		cpaID := cpaGroup.ID

		// Feature flags are read-only at runtime by default, and creating the
		// graph field below needs the gate open.
		th.ConfigStore.SetReadOnlyFF(false)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.PropertyFieldGraph = true })
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.PropertyFieldGraph = false })
			th.ConfigStore.SetReadOnlyFF(true)
		})

		tearDown, pluginIDs, activationErrors := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"fmt"
				"strings"

				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func parents(names ...string) *[]string {
				return &names
			}

			func byName(options []*model.PropertyFieldOption, name string) *model.PropertyFieldOption {
				for _, option := range options {
					if option.Name == name {
						return option
					}
				}
				return nil
			}

			func (p *MyPlugin) OnActivate() error {
				groupID := "` + cpaID + `"

				template, err := p.API.CreatePropertyField(&model.PropertyField{
					GroupID:    groupID,
					Name:       "Programs",
					Type:       model.PropertyFieldTypeGraph,
					ObjectType: model.PropertyFieldObjectTypeTemplate,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
				})
				if err != nil {
					return fmt.Errorf("failed to create the template field: %w", err)
				}

				linked, err := p.API.CreatePropertyField(&model.PropertyField{
					GroupID:       groupID,
					Name:          "Program",
					ObjectType:    model.PropertyFieldObjectTypeUser,
					TargetType:    string(model.PropertyFieldTargetLevelSystem),
					LinkedFieldID: &template.ID,
				})
				if err != nil {
					return fmt.Errorf("failed to create the linked field: %w", err)
				}

				// A whole hierarchy in one call, naming an option further down the
				// payload: the names resolve after every option has an identifier.
				created, err := p.API.CreatePropertyFieldOptions(groupID, template.ID, []*model.PropertyFieldOption{
					{Name: "Fighter Jet Program", Parents: parents("Air Program")},
					{Name: "Air Program"},
					{Name: "F-18 Program", Parents: parents("Fighter Jet Program")},
				})
				if err != nil {
					return fmt.Errorf("failed to create options: %w", err)
				}
				if len(created) != 3 {
					return fmt.Errorf("expected 3 options, got %d", len(created))
				}
				for _, option := range created {
					if !model.IsValidId(option.ID) {
						return fmt.Errorf("option %q was created without an identifier", option.Name)
					}
					if option.ReadOnly {
						return fmt.Errorf("option %q is the template's own and should not be read only", option.Name)
					}
				}
				if jet := byName(created, "Fighter Jet Program"); jet.Parents == nil || len(*jet.Parents) != 1 || (*jet.Parents)[0] != "Air Program" {
					return fmt.Errorf("the fighter jet program came back under %v", jet.Parents)
				}

				// The field linking to the template serves those options without
				// owning any of them, which is what read only says.
				inherited, err := p.API.GetPropertyFieldOptions(groupID, linked.ID, 0, "", 100)
				if err != nil {
					return fmt.Errorf("failed to list the linked field's options: %w", err)
				}
				if len(inherited) != 3 {
					return fmt.Errorf("expected the linked field to serve 3 options, got %d", len(inherited))
				}
				for _, option := range inherited {
					if !option.ReadOnly {
						return fmt.Errorf("option %q is inherited and should be read only", option.Name)
					}
				}

				// It cannot own options of its own: one could never be attached to
				// the hierarchy it exists to serve.
				if _, err = p.API.CreatePropertyFieldOptions(groupID, linked.ID, []*model.PropertyFieldOption{
					{Name: "Land Program"},
				}); err == nil {
					return fmt.Errorf("a linked graph field was allowed to own an option of its own")
				}

				// Nor change one it merely inherits.
				air := byName(created, "Air Program")
				if _, err = p.API.UpdatePropertyFieldOptions(groupID, linked.ID, []*model.PropertyFieldOption{
					{ID: air.ID, Name: "Aerial Program"},
				}); err == nil {
					return fmt.Errorf("an inherited option was changed through the field that inherits it")
				}

				// A rename and a move through the field that owns them. The colour
				// is left out and so left alone; the parents given replace the ones
				// the option had.
				f18 := byName(created, "F-18 Program")
				updated, err := p.API.UpdatePropertyFieldOptions(groupID, template.ID, []*model.PropertyFieldOption{
					{ID: f18.ID, Name: "F/A-18 Program", Parents: parents("Air Program")},
				})
				if err != nil {
					return fmt.Errorf("failed to update an option: %w", err)
				}
				if len(updated) != 1 || updated[0].Name != "F/A-18 Program" {
					return fmt.Errorf("the option came back as %v", updated)
				}
				if len(*updated[0].Parents) != 1 || (*updated[0].Parents)[0] != "Air Program" {
					return fmt.Errorf("the option came back under %v", *updated[0].Parents)
				}

				// The first item that cannot be accepted fails the call, and the
				// answer says which one it was.
				_, err = p.API.CreatePropertyFieldOptions(groupID, template.ID, []*model.PropertyFieldOption{
					{Name: "Sea Program"},
					{Name: "Carrier Program", Parents: parents("No Such Program")},
				})
				if err == nil {
					return fmt.Errorf("an option under a parent nothing is called was accepted")
				}
				if !strings.Contains(err.Error(), "options[1]") {
					return fmt.Errorf("the refusal did not say which item was at fault: %s", err.Error())
				}
				// Nothing was written, including the item that was fine.
				held, err := p.API.GetPropertyFieldOptions(groupID, template.ID, 0, "", 100)
				if err != nil {
					return fmt.Errorf("failed to list options: %w", err)
				}
				if len(held) != 3 {
					return fmt.Errorf("expected the refused call to write nothing, found %d options", len(held))
				}

				if _, err = p.API.CreatePropertyFieldOptions(groupID, template.ID, nil); err == nil {
					return fmt.Errorf("a call naming no options was accepted")
				}

				// An option with something still below it cannot go on its own,
				// because whatever is under it would be left hanging off nothing.
				jet := byName(created, "Fighter Jet Program")
				if err = p.API.DeletePropertyFieldOptions(groupID, template.ID, []string{air.ID}); err == nil {
					return fmt.Errorf("an option with options below it was deleted on its own")
				}

				// The whole branch at once is the supported way.
				if err = p.API.DeletePropertyFieldOptions(groupID, template.ID, []string{air.ID, jet.ID, f18.ID}); err != nil {
					return fmt.Errorf("failed to delete a branch: %w", err)
				}
				held, err = p.API.GetPropertyFieldOptions(groupID, template.ID, 0, "", 100)
				if err != nil {
					return fmt.Errorf("failed to list options after the deletion: %w", err)
				}
				if len(held) != 0 {
					return fmt.Errorf("expected no options left, found %d", len(held))
				}

				// A page has to be asked for: an empty page would read as a field
				// with no options, which is the answer a page size of zero would
				// give for every field.
				if _, err = p.API.GetPropertyFieldOptions(groupID, template.ID, 0, "", 0); err == nil {
					return fmt.Errorf("a listing with no page size was accepted")
				}

				// And a cursor is both halves or neither: half of one would start
				// from the beginning again, so a caller paging until a short page
				// would never stop.
				if _, err = p.API.GetPropertyFieldOptions(groupID, template.ID, 0, model.NewId(), 100); err == nil {
					return fmt.Errorf("a listing with half a cursor was accepted")
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 1)
		require.NoError(t, activationErrors[0])

		err2 := th.App.DisablePlugin(pluginIDs[0])
		require.Nil(t, err2)
		appErr := th.App.ch.RemovePlugin(pluginIDs[0])
		require.Nil(t, appErr)
	})

	t.Run("test plugin cannot read or change the options of another plugin's protected field", func(t *testing.T) {
		cleanupCPAFields(t, th)

		cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
		require.Nil(t, groupErr)
		cpaID := cpaGroup.ID

		tearDown, _, activationErrors := SetAppEnvironmentWithPlugins(t, []string{
			// Plugin 1: a protected field only it may read the options of, which
			// it then adds an option to through the options API.
			`
			package main

			import (
				"fmt"
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				field, err := p.API.CreatePropertyField(&model.PropertyField{
					GroupID:    "` + cpaID + `",
					Name:       "plugin1_protected_options",
					Type:       model.PropertyFieldTypeMultiselect,
					ObjectType: model.PropertyFieldObjectTypeUser,
					TargetType: string(model.PropertyFieldTargetLevelSystem),
					Attrs: map[string]any{
						"protected":   true,
						"access_mode": model.PropertyAccessModeSourceOnly,
						"options": []any{
							map[string]any{"name": "Air Program"},
						},
					},
				})
				if err != nil {
					return fmt.Errorf("failed to create protected field: %w", err)
				}

				if _, err = p.API.CreatePropertyFieldOptions("` + cpaID + `", field.ID, []*model.PropertyFieldOption{
					{Name: "Sea Program"},
				}); err != nil {
					return fmt.Errorf("the source plugin failed to add an option to its own field: %w", err)
				}

				options, err := p.API.GetPropertyFieldOptions("` + cpaID + `", field.ID, 0, "", 100)
				if err != nil {
					return fmt.Errorf("the source plugin failed to list its own field's options: %w", err)
				}
				if len(options) != 2 {
					return fmt.Errorf("expected the source plugin to see 2 options, got %d", len(options))
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
			// Plugin 2: the same field, from a plugin that does not own it.
			`
			package main

			import (
				"errors"
				"fmt"
				"net/http"

				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				fields, err := p.API.SearchPropertyFields("` + cpaID + `", model.PropertyFieldSearchOpts{PerPage: 100})
				if err != nil {
					return fmt.Errorf("failed to search fields: %w", err)
				}

				var target *model.PropertyField
				for _, field := range fields {
					if field.Name == "plugin1_protected_options" {
						target = field
						break
					}
				}
				if target == nil {
					return fmt.Errorf("plugin1 field not found")
				}

				// The field itself reads back with its option list emptied, and the
				// options behind it answer the same way rather than serving what the
				// field read refused.
				options, err := p.API.GetPropertyFieldOptions("` + cpaID + `", target.ID, 0, "", 100)
				if err != nil {
					return fmt.Errorf("failed to list another plugin's options: %w", err)
				}
				if len(options) != 0 {
					return fmt.Errorf("expected to see none of another plugin's options, got %d", len(options))
				}

				// Refused for want of authority over the field, not because the
				// option named cannot be found: an option this plugin may not
				// change is a different answer from one that is not there, and
				// only the first is a refusal it cannot work around.
				refused := func(verb string, err error) error {
					if err == nil {
						return fmt.Errorf("%s an option of another plugin's protected field", verb)
					}
					var appErr *model.AppError
					if !errors.As(err, &appErr) {
						return fmt.Errorf("%s: expected an app error, got %T: %s", verb, err, err.Error())
					}
					if appErr.StatusCode != http.StatusForbidden {
						return fmt.Errorf("%s: expected the change to be forbidden, got %d: %s", verb, appErr.StatusCode, appErr.Error())
					}
					return nil
				}

				_, err = p.API.CreatePropertyFieldOptions("` + cpaID + `", target.ID, []*model.PropertyFieldOption{
					{Name: "Land Program"},
				})
				if problem := refused("added", err); problem != nil {
					return problem
				}

				_, err = p.API.UpdatePropertyFieldOptions("` + cpaID + `", target.ID, []*model.PropertyFieldOption{
					{ID: model.NewId(), Name: "Land Program"},
				})
				if problem := refused("changed", err); problem != nil {
					return problem
				}

				err = p.API.DeletePropertyFieldOptions("` + cpaID + `", target.ID, []string{model.NewId()})
				if problem := refused("deleted", err); problem != nil {
					return problem
				}

				return nil
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, activationErrors, 2)
		require.NoError(t, activationErrors[0])
		require.NoError(t, activationErrors[1])
	})
}
