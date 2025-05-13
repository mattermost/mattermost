// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/v8/channels/app/plugin_api_tests"
)

type MyPlugin struct {
	plugin.MattermostPlugin
	configuration plugin_api_tests.BasicConfig
}

func (p *MyPlugin) OnConfigurationChange() error {
	if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
		return err
	}
	return nil
}

// MessageWillBePosted is used as the entry point for testing property field API methods
func (p *MyPlugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
	// Test fields for all operations
	groupID := "test-group-id"
	fieldID := "test-field-id"
	targetID := "test-target-id"
	targetType := "test-target-type"

	// Test creating a property field
	field := &model.PropertyField{
		GroupID:    groupID,
		Name:       "Test Field",
		Type:       model.PropertyFieldTypeText,
		TargetID:   targetID,
		TargetType: targetType,
		Attrs: model.StringInterface{
			"description": "Test field description",
		},
	}

	// Test field creation
	createdField, err := p.API.CreatePropertyField(field)
	if err != nil {
		return nil, "Error creating property field: " + err.Error()
	}
	if createdField == nil {
		return nil, "Failed to create property field: returned field is nil"
	}
	if createdField.ID == "" {
		return nil, "Created property field has no ID"
	}
	if createdField.Name != "Test Field" {
		return nil, "Created property field has wrong name"
	}

	// Save the generated ID for later use
	createdFieldID := createdField.ID

	// Test getting a property field by ID
	retrievedField, err := p.API.GetPropertyField(groupID, createdFieldID)
	if err != nil {
		return nil, "Error getting property field: " + err.Error()
	}
	if retrievedField == nil {
		return nil, "Failed to get property field: returned field is nil"
	}
	if retrievedField.ID != createdFieldID {
		return nil, "Retrieved property field has wrong ID"
	}

	// Test getting multiple property fields by IDs
	fields, err := p.API.GetPropertyFields(groupID, []string{createdFieldID})
	if err != nil {
		return nil, "Error getting property fields: " + err.Error()
	}
	if len(fields) != 1 {
		return nil, "Wrong number of property fields returned"
	}
	if fields[0].ID != createdFieldID {
		return nil, "Retrieved property fields have wrong IDs"
	}

	// Test updating a property field
	updateField := &model.PropertyField{
		ID:         createdFieldID,
		GroupID:    groupID,
		Name:       "Updated Field",
		Type:       model.PropertyFieldTypeText,
		TargetID:   targetID,
		TargetType: targetType,
		Attrs: model.StringInterface{
			"description": "Updated field description",
		},
	}

	updatedField, err := p.API.UpdatePropertyField(groupID, updateField)
	if err != nil {
		return nil, "Error updating property field: " + err.Error()
	}
	if updatedField == nil {
		return nil, "Failed to update property field: returned field is nil"
	}
	if updatedField.Name != "Updated Field" {
		return nil, "Updated property field has wrong name"
	}

	// Test searching for property fields
	searchOpts := model.PropertyFieldSearchOpts{
		PerPage: 10,
	}
	searchResults, err := p.API.SearchPropertyFields(groupID, targetID, searchOpts)
	if err != nil {
		return nil, "Error searching property fields: " + err.Error()
	}
	if len(searchResults) < 1 {
		return nil, "No property fields found in search"
	}

	// Test deleting a property field
	err = p.API.DeletePropertyField(groupID, createdFieldID)
	if err != nil {
		return nil, "Error deleting property field: " + err.Error()
	}

	// Verify deletion by trying to get it again
	_, err = p.API.GetPropertyField(groupID, createdFieldID)
	// We should get an error since the field was deleted
	if err == nil {
		return nil, "Property field was not properly deleted"
	}

	// All tests passed
	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}