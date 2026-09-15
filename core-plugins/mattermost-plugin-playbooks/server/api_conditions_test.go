// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestPlaybookConditionsCRUD(t *testing.T) {
	e := Setup(t)
	e.CreateClients()
	e.CreateBasicServer()

	// Create a playbook
	playbookID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Test Playbook for Conditions",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)

	// Get the playbooks property group
	playbooksGroup, err := e.A.PropertyService().GetPropertyGroup("playbooks")
	require.NoError(t, err)
	require.NotNil(t, playbooksGroup)

	// Create property fields
	selectPropertyField := createSelectPropertyField("Priority", playbooksGroup.ID, playbookID, []string{"High", "Medium", "Low"})
	selectField, err := e.A.PropertyService().CreatePropertyField(selectPropertyField)
	require.NoError(t, err)
	require.NotEmpty(t, selectField)

	textPropertyField := createTextPropertyField("Description", playbooksGroup.ID, playbookID)
	textField, err := e.A.PropertyService().CreatePropertyField(textPropertyField)
	require.NoError(t, err)
	require.NotEmpty(t, textField)

	// List conditions on new playbook should return empty
	result, err := e.PlaybooksClient.PlaybookConditions.List(context.Background(), playbookID, 0, 100, client.PlaybookConditionListOptions{})
	require.NoError(t, err)
	assert.Equal(t, 0, result.TotalCount)
	assert.Equal(t, 0, len(result.Items))
	assert.False(t, result.HasMore)

	// Parse the created select field to get the actual option IDs
	appSelectField, err := app.NewPropertyFieldFromMattermostPropertyField(selectField)
	require.NoError(t, err)
	require.NotEmpty(t, appSelectField.Attrs.Options)

	// Create a map of option names to IDs for easy reuse
	optionNameToID := make(map[string]string)
	for _, option := range appSelectField.Attrs.Options {
		optionNameToID[option.GetName()] = option.GetID()
	}

	require.NotEmpty(t, optionNameToID["High"], "Could not find High option ID")
	require.NotEmpty(t, optionNameToID["Medium"], "Could not find Medium option ID")
	require.NotEmpty(t, optionNameToID["Low"], "Could not find Low option ID")

	// Create condition using the select field
	selectCondition := createSelectCondition(playbookID, selectField.ID, optionNameToID["High"])

	createdSelectCondition, err := e.PlaybooksClient.PlaybookConditions.Create(context.Background(), playbookID, selectCondition)
	require.NoError(t, err)
	require.NotNil(t, createdSelectCondition)
	assert.NotEmpty(t, createdSelectCondition.ID)
	assert.Equal(t, playbookID, createdSelectCondition.PlaybookID)
	assert.NotNil(t, createdSelectCondition.ConditionExpr.Is)
	assert.Equal(t, selectField.ID, createdSelectCondition.ConditionExpr.Is.FieldID)
	assert.Equal(t, json.RawMessage(`["`+optionNameToID["High"]+`"]`), createdSelectCondition.ConditionExpr.Is.Value)

	// Create condition using the text field
	textCondition := createTextCondition(playbookID, textField.ID, "urgent")

	createdTextCondition, err := e.PlaybooksClient.PlaybookConditions.Create(context.Background(), playbookID, textCondition)
	require.NoError(t, err)
	require.NotNil(t, createdTextCondition)
	assert.NotEmpty(t, createdTextCondition.ID)
	assert.Equal(t, playbookID, createdTextCondition.PlaybookID)
	assert.NotNil(t, createdTextCondition.ConditionExpr.Is)
	assert.Equal(t, textField.ID, createdTextCondition.ConditionExpr.Is.FieldID)
	assert.Equal(t, json.RawMessage(`"urgent"`), createdTextCondition.ConditionExpr.Is.Value)

	// List conditions after creating them - should find both conditions
	result, err = e.PlaybooksClient.PlaybookConditions.List(context.Background(), playbookID, 0, 100, client.PlaybookConditionListOptions{})
	require.NoError(t, err)
	assert.Equal(t, 2, result.TotalCount)
	assert.Equal(t, 2, len(result.Items))
	assert.False(t, result.HasMore)

	// Find our specific conditions in the results
	var foundSelectCondition, foundTextCondition *client.Condition
	for i := range result.Items {
		condition := &result.Items[i]
		if condition.ID == createdSelectCondition.ID {
			foundSelectCondition = condition
		}
		if condition.ID == createdTextCondition.ID {
			foundTextCondition = condition
		}
	}

	// Verify the select condition
	require.NotNil(t, foundSelectCondition, "Could not find select condition in results")
	assert.Equal(t, selectField.ID, foundSelectCondition.ConditionExpr.Is.FieldID)
	assert.Equal(t, json.RawMessage(`["`+optionNameToID["High"]+`"]`), foundSelectCondition.ConditionExpr.Is.Value)

	// Verify the text condition
	require.NotNil(t, foundTextCondition, "Could not find text condition in results")
	assert.Equal(t, textField.ID, foundTextCondition.ConditionExpr.Is.FieldID)
	assert.Equal(t, json.RawMessage(`"urgent"`), foundTextCondition.ConditionExpr.Is.Value)

	// Update the select condition from "High" to "Low"
	updatedSelectCondition := *createdSelectCondition
	updatedSelectCondition.ConditionExpr.Is.Value = json.RawMessage(`["` + optionNameToID["Low"] + `"]`)

	updatedCondition, err := e.PlaybooksClient.PlaybookConditions.Update(context.Background(), playbookID, createdSelectCondition.ID, updatedSelectCondition)
	require.NoError(t, err)
	require.NotNil(t, updatedCondition)
	assert.Equal(t, createdSelectCondition.ID, updatedCondition.ID)
	assert.Equal(t, playbookID, updatedCondition.PlaybookID)
	assert.Equal(t, selectField.ID, updatedCondition.ConditionExpr.Is.FieldID)
	assert.Equal(t, json.RawMessage(`["`+optionNameToID["Low"]+`"]`), updatedCondition.ConditionExpr.Is.Value)

	// List conditions again to verify the update
	result, err = e.PlaybooksClient.PlaybookConditions.List(context.Background(), playbookID, 0, 100, client.PlaybookConditionListOptions{})
	require.NoError(t, err)
	assert.Equal(t, 2, result.TotalCount)
	assert.Equal(t, 2, len(result.Items))

	// Find the updated select condition
	var updatedFoundSelectCondition *client.Condition
	for i := range result.Items {
		condition := &result.Items[i]
		if condition.ID == createdSelectCondition.ID {
			updatedFoundSelectCondition = condition
			break
		}
	}

	// Verify the select condition now has "Low" instead of "High"
	require.NotNil(t, updatedFoundSelectCondition, "Could not find updated select condition in results")
	assert.Equal(t, selectField.ID, updatedFoundSelectCondition.ConditionExpr.Is.FieldID)
	assert.Equal(t, json.RawMessage(`["`+optionNameToID["Low"]+`"]`), updatedFoundSelectCondition.ConditionExpr.Is.Value)

	// Test pagination - get only 1 condition on page 0
	paginatedResult, err := e.PlaybooksClient.PlaybookConditions.List(context.Background(), playbookID, 0, 1, client.PlaybookConditionListOptions{})
	require.NoError(t, err)
	assert.Equal(t, 2, paginatedResult.TotalCount) // Still 2 total
	assert.Equal(t, 1, len(paginatedResult.Items)) // But only 1 returned
	assert.True(t, paginatedResult.HasMore)        // More pages available

	// Delete the text condition
	err = e.PlaybooksClient.PlaybookConditions.Delete(context.Background(), playbookID, createdTextCondition.ID)
	require.NoError(t, err)

	// List conditions after delete - should only have 1 remaining (the select condition)
	finalResult, err := e.PlaybooksClient.PlaybookConditions.List(context.Background(), playbookID, 0, 100, client.PlaybookConditionListOptions{})
	require.NoError(t, err)
	assert.Equal(t, 1, finalResult.TotalCount)
	assert.Equal(t, 1, len(finalResult.Items))
	assert.False(t, finalResult.HasMore)

	// Verify the remaining condition is the select condition (with Low value)
	remainingCondition := finalResult.Items[0]
	assert.Equal(t, createdSelectCondition.ID, remainingCondition.ID)
	assert.Equal(t, selectField.ID, remainingCondition.ConditionExpr.Is.FieldID)
	assert.Equal(t, json.RawMessage(`["`+optionNameToID["Low"]+`"]`), remainingCondition.ConditionExpr.Is.Value)
}

// Helper functions for creating property fields
func createSelectPropertyField(name, groupID, playbookID string, optionNames []string) *model.PropertyField {
	options := make(model.PropertyOptions[*model.PluginPropertyOption], len(optionNames))
	for i, optionName := range optionNames {
		options[i] = model.NewPluginPropertyOption(strings.ToLower(optionName)+"_id", optionName)
	}

	appField := app.PropertyField{
		PropertyField: model.PropertyField{
			Name:       name,
			Type:       model.PropertyFieldTypeSelect,
			GroupID:    groupID,
			TargetType: "playbook",
			TargetID:   playbookID,
		},
		Attrs: app.Attrs{
			Options: options,
		},
	}

	return appField.ToMattermostPropertyField()
}

func createTextPropertyField(name, groupID, playbookID string) *model.PropertyField {
	return &model.PropertyField{
		Name:       name,
		Type:       model.PropertyFieldTypeText,
		GroupID:    groupID,
		TargetType: "playbook",
		TargetID:   playbookID,
	}
}

// Helper functions for creating conditions
func createSelectCondition(playbookID, fieldID, optionID string) client.Condition {
	return client.Condition{
		PlaybookID: playbookID,
		Version:    1,
		ConditionExpr: client.ConditionExprV1{
			Is: &client.ComparisonCondition{
				FieldID: fieldID,
				Value:   json.RawMessage(`["` + optionID + `"]`),
			},
		},
	}
}

func createTextCondition(playbookID, fieldID, textValue string) client.Condition {
	return client.Condition{
		PlaybookID: playbookID,
		Version:    1,
		ConditionExpr: client.ConditionExprV1{
			Is: &client.ComparisonCondition{
				FieldID: fieldID,
				Value:   json.RawMessage(`"` + textValue + `"`),
			},
		},
	}
}
