// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPluginProperties(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
}
