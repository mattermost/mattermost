// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
)

func TestPlaybookPropertyFieldsCRUD(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Step 1: Use the existing basic playbook
	playbookID := e.BasicPlaybook.ID

	// Step 2: Create a property field
	createFieldRequest := client.PropertyFieldRequest{
		Name: "Initial Field",
		Type: "text",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: stringPtr("when_set"),
			SortOrder:  float64Ptr(1.0),
		},
	}

	createdField, err := e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, createFieldRequest)
	require.NoError(t, err)
	require.Equal(t, "Initial Field", createdField.Name)
	require.Equal(t, "text", createdField.Type)
	fieldID := createdField.ID

	// Step 3: List property fields - should contain our new field
	fields1, err := e.PlaybooksClient.Playbooks.GetPropertyFields(context.Background(), playbookID)
	require.NoError(t, err)
	require.Len(t, fields1, 1)
	require.Equal(t, "Initial Field", fields1[0].Name)
	require.Equal(t, fieldID, fields1[0].ID)

	// Step 4a: Update the field name
	updateNameRequest := client.PropertyFieldRequest{
		Name: "Updated Field Name",
		Type: "text",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: stringPtr("when_set"),
			SortOrder:  float64Ptr(1.0),
		},
	}

	updatedField1, err := e.PlaybooksClient.Playbooks.UpdatePropertyField(context.Background(), playbookID, fieldID, updateNameRequest)
	require.NoError(t, err)
	require.Equal(t, "Updated Field Name", updatedField1.Name)
	require.Equal(t, fieldID, updatedField1.ID)

	// List and verify name update
	fields2, err := e.PlaybooksClient.Playbooks.GetPropertyFields(context.Background(), playbookID)
	require.NoError(t, err)
	require.Len(t, fields2, 1)
	require.Equal(t, "Updated Field Name", fields2[0].Name)

	// Step 4b: Update the field type (select requires options)
	updateTypeRequest := client.PropertyFieldRequest{
		Name: "Updated Field Name",
		Type: "select",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: stringPtr("when_set"),
			SortOrder:  float64Ptr(1.0),
			Options: &[]client.PropertyOptionInput{
				{
					Name:  "Basic Option",
					Color: stringPtr("#0000ff"),
				},
			},
		},
	}

	updatedField2, err := e.PlaybooksClient.Playbooks.UpdatePropertyField(context.Background(), playbookID, fieldID, updateTypeRequest)
	require.NoError(t, err)
	require.Equal(t, "select", updatedField2.Type)

	// List and verify type update
	fields3, err := e.PlaybooksClient.Playbooks.GetPropertyFields(context.Background(), playbookID)
	require.NoError(t, err)
	require.Len(t, fields3, 1)
	require.Equal(t, "select", fields3[0].Type)

	// Step 4c: Update to add attributes (options for select field)
	updateAttrsRequest := client.PropertyFieldRequest{
		Name: "Updated Field Name",
		Type: "select",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: stringPtr("always"),
			SortOrder:  float64Ptr(2.0),
			Options: &[]client.PropertyOptionInput{
				{
					Name:  "Option 1",
					Color: stringPtr("#ff0000"),
				},
				{
					Name:  "Option 2",
					Color: stringPtr("#00ff00"),
				},
			},
		},
	}

	_, err = e.PlaybooksClient.Playbooks.UpdatePropertyField(context.Background(), playbookID, fieldID, updateAttrsRequest)
	require.NoError(t, err)

	// List and verify attributes update
	fields4, err := e.PlaybooksClient.Playbooks.GetPropertyFields(context.Background(), playbookID)
	require.NoError(t, err)
	require.Len(t, fields4, 1)

	// Step 5: Delete the property field
	err = e.PlaybooksClient.Playbooks.DeletePropertyField(context.Background(), playbookID, fieldID)
	require.NoError(t, err)

	// Step 6: List property fields - should be empty now
	fields5, err := e.PlaybooksClient.Playbooks.GetPropertyFields(context.Background(), playbookID)
	require.NoError(t, err)
	require.Len(t, fields5, 0, "Property field should be deleted and not appear in the list")
}

func stringPtr(s string) *string {
	return &s
}

func float64Ptr(f float64) *float64 {
	return &f
}

func TestRunPropertyOperations(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Step 1: Use the existing basic playbook and add property fields to it
	playbookID := e.BasicPlaybook.ID

	// Field 1: Jira Ticket (text)
	jiraFieldRequest := client.PropertyFieldRequest{
		Name: "Jira Ticket",
		Type: "text",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: stringPtr("when_set"),
			SortOrder:  float64Ptr(1.0),
		},
	}

	_, err := e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, jiraFieldRequest)
	require.NoError(t, err)

	// Field 2: Priority (select: Low, Med, High)
	priorityFieldRequest := client.PropertyFieldRequest{
		Name: "Priority",
		Type: "select",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: stringPtr("always"),
			SortOrder:  float64Ptr(2.0),
			Options: &[]client.PropertyOptionInput{
				{
					Name:  "Low",
					Color: stringPtr("#00ff00"),
				},
				{
					Name:  "Med",
					Color: stringPtr("#ffff00"),
				},
				{
					Name:  "High",
					Color: stringPtr("#ff0000"),
				},
			},
		},
	}

	_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, priorityFieldRequest)
	require.NoError(t, err)

	// Field 3: Tags (multiselect: Frontend, Backend, CI)
	tagsFieldRequest := client.PropertyFieldRequest{
		Name: "Tags",
		Type: "multiselect",
		Attrs: &client.PropertyFieldAttrsInput{
			Visibility: stringPtr("when_set"),
			SortOrder:  float64Ptr(3.0),
			Options: &[]client.PropertyOptionInput{
				{
					Name:  "Frontend",
					Color: stringPtr("#0066cc"),
				},
				{
					Name:  "Backend",
					Color: stringPtr("#cc6600"),
				},
				{
					Name:  "CI",
					Color: stringPtr("#660066"),
				},
			},
		},
	}

	_, err = e.PlaybooksClient.Playbooks.CreatePropertyField(context.Background(), playbookID, tagsFieldRequest)
	require.NoError(t, err)

	// Step 2: Create a run from the playbook using client method
	runCreateOptions := client.PlaybookRunCreateOptions{
		PlaybookID:  playbookID,
		Name:        "Test Run with Properties",
		OwnerUserID: e.RegularUser.Id,
		TeamID:      e.BasicTeam.Id,
	}

	createdRun, err := e.PlaybooksClient.PlaybookRuns.Create(context.Background(), runCreateOptions)
	require.NoError(t, err)
	runID := createdRun.ID

	// Step 3: List property fields from the run and verify by name
	runFields, err := e.PlaybooksClient.PlaybookRuns.GetPropertyFields(context.Background(), runID)
	require.NoError(t, err)
	require.Len(t, runFields, 3, "Should have 3 property fields")

	// Verify fields by name (IDs may differ between playbook and run)
	fieldsByName := make(map[string]client.PropertyField)
	for _, field := range runFields {
		fieldsByName[field.Name] = field
	}

	// Check Jira Ticket field
	jiraRunField, exists := fieldsByName["Jira Ticket"]
	require.True(t, exists, "Jira Ticket field should exist")
	require.Equal(t, "text", jiraRunField.Type)

	// Check Priority field
	priorityRunField, exists := fieldsByName["Priority"]
	require.True(t, exists, "Priority field should exist")
	require.Equal(t, "select", priorityRunField.Type)

	// Check Tags field
	tagsRunField, exists := fieldsByName["Tags"]
	require.True(t, exists, "Tags field should exist")
	require.Equal(t, "multiselect", tagsRunField.Type)

	// Step 4: Set values for all three property fields
	// Set Jira Ticket value
	jiraValueRequest := client.PropertyValueRequest{
		Value: []byte(`"PROJ-123"`),
	}

	_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(context.Background(), runID, jiraRunField.ID, jiraValueRequest)
	require.NoError(t, err)

	// Extract option IDs from the Priority field for select field
	var highOptionID string
	if options, ok := priorityRunField.Attrs["options"].([]interface{}); ok {
		for _, option := range options {
			if optMap, ok := option.(map[string]interface{}); ok {
				if name, ok := optMap["name"].(string); ok && name == "High" {
					if id, ok := optMap["id"].(string); ok {
						highOptionID = id
						break
					}
				}
			}
		}
	}
	require.NotEmpty(t, highOptionID, "High option ID should exist")

	// Set Priority value using actual option ID
	priorityValueRequest := client.PropertyValueRequest{
		Value: []byte(`"` + highOptionID + `"`),
	}

	_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(context.Background(), runID, priorityRunField.ID, priorityValueRequest)
	require.NoError(t, err)

	// Extract option IDs from the Tags field for multiselect field
	var frontendOptionID, ciOptionID string
	if options, ok := tagsRunField.Attrs["options"].([]interface{}); ok {
		for _, option := range options {
			if optMap, ok := option.(map[string]interface{}); ok {
				if name, ok := optMap["name"].(string); ok {
					if id, ok := optMap["id"].(string); ok {
						switch name {
						case "Frontend":
							frontendOptionID = id
						case "CI":
							ciOptionID = id
						}
					}
				}
			}
		}
	}
	require.NotEmpty(t, frontendOptionID, "Frontend option ID should exist")
	require.NotEmpty(t, ciOptionID, "CI option ID should exist")

	// Set Tags value using actual option IDs
	tagsValueRequest := client.PropertyValueRequest{
		Value: []byte(`["` + frontendOptionID + `", "` + ciOptionID + `"]`),
	}

	_, err = e.PlaybooksClient.PlaybookRuns.SetPropertyValue(context.Background(), runID, tagsRunField.ID, tagsValueRequest)
	require.NoError(t, err)

	// Step 5: List property values and verify they were set correctly
	propertyValues, err := e.PlaybooksClient.PlaybookRuns.GetPropertyValues(context.Background(), runID)
	require.NoError(t, err)
	require.Len(t, propertyValues, 3, "Should have 3 property values")

	// Verify values by field ID
	valuesByFieldID := make(map[string]client.PropertyValue)
	for _, value := range propertyValues {
		valuesByFieldID[value.FieldID] = value
	}

	// Check Jira Ticket value
	jiraValue, exists := valuesByFieldID[jiraRunField.ID]
	require.True(t, exists, "Jira Ticket value should exist")
	var jiraStringValue string
	err = json.Unmarshal(jiraValue.Value, &jiraStringValue)
	require.NoError(t, err)
	require.Equal(t, "PROJ-123", jiraStringValue)

	// Check Priority value (should be option ID, not name)
	priorityValue, exists := valuesByFieldID[priorityRunField.ID]
	require.True(t, exists, "Priority value should exist")
	var priorityStringValue string
	err = json.Unmarshal(priorityValue.Value, &priorityStringValue)
	require.NoError(t, err)
	require.Equal(t, highOptionID, priorityStringValue)

	// Check Tags value (should be option IDs, not names)
	tagsValue, exists := valuesByFieldID[tagsRunField.ID]
	require.True(t, exists, "Tags value should exist")
	var tagsArrayValue []string
	err = json.Unmarshal(tagsValue.Value, &tagsArrayValue)
	require.NoError(t, err)
	require.Len(t, tagsArrayValue, 2)
	require.Contains(t, tagsArrayValue, frontendOptionID)
	require.Contains(t, tagsArrayValue, ciOptionID)
}
