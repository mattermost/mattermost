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
				field := &model.PropertyField{
					GroupID:     group.ID,
					Name:        "Test Field",
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
				if retrievedField.Name != "Test Field" {
					return fmt.Errorf("field name mismatch: expected 'Test Field', got '%s'", retrievedField.Name)
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
				fields, err := p.API.SearchPropertyFields(group.ID, "", model.PropertyFieldSearchOpts{})
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
				fields, err = p.API.SearchPropertyFields(group.ID, "", model.PropertyFieldSearchOpts{})
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
		require.Nil(t, nil, activationErrors[0])

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
				field := &model.PropertyField{
					GroupID:     group.ID,
					Name:        "Test Field",
					Type:        model.PropertyFieldTypeText,
					TargetType:  "user",
				}

				createdField, err := p.API.CreatePropertyField(field)
				if err != nil {
					return fmt.Errorf("failed to create property field: %w", err)
				}

				// Create a property value
				targetId := model.NewId()
				valueJson := []byte("test-value")
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
				if string(retrievedValue.Value) != "test-value" {
					return fmt.Errorf("value mismatch: expected 'test-value', got '%s'", string(retrievedValue.Value))
				}

				// Update the value
				retrievedValue.Value = []byte("updated-test-value")
				updatedValue, err := p.API.UpdatePropertyValue(group.ID, retrievedValue)
				if err != nil {
					return fmt.Errorf("failed to update property value: %w", err)
				}
				if string(updatedValue.Value) != "updated-test-value" {
					return fmt.Errorf("updated value mismatch: expected 'updated-test-value', got '%s'", string(updatedValue.Value))
				}

				// Upsert the value
				upsertValueJson := []byte("upserted-value")
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
				values, err := p.API.SearchPropertyValues(group.ID, targetId, model.PropertyValueSearchOpts{})
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
				values, err = p.API.SearchPropertyValues(group.ID, targetId, model.PropertyValueSearchOpts{})
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
		require.Nil(t, nil, activationErrors[0])

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
		require.Nil(t, nil, activationErrors[0])

		// Clean up
		err2 := th.App.DisablePlugin(pluginIDs[0])
		require.Nil(t, err2)
		appErr := th.App.ch.RemovePlugin(pluginIDs[0])
		require.Nil(t, appErr)
	})
}
