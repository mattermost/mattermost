// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost-plugin-playbooks/client"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestGraphQLPropertyFields(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("add property field", func(t *testing.T) {
		testAddPropertyFieldQuery := `
		mutation AddPlaybookPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
			addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
		}
		`
		var response struct {
			Data   json.RawMessage
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testAddPropertyFieldQuery,
			OperationName: "AddPlaybookPropertyField",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyField": map[string]any{
					"name": "Priority",
					"type": "select",
					"attrs": map[string]any{
						"visibility": "always",
						"sortOrder":  1.0,
						"options": []map[string]any{
							{
								"name":  "High",
								"color": "red",
							},
							{
								"name":  "Medium",
								"color": "yellow",
							},
							{
								"name":  "Low",
								"color": "green",
							},
						},
					},
				},
			},
		}, &response)
		require.NoError(t, err)
		require.Empty(t, response.Errors)
		require.NotEmpty(t, response.Data)

		// Verify the property field was created by retrieving it
		var result struct {
			AddPlaybookPropertyField string `json:"addPlaybookPropertyField"`
		}
		err = json.Unmarshal(response.Data, &result)
		require.NoError(t, err)
		require.NotEmpty(t, result.AddPlaybookPropertyField)

		fieldID := result.AddPlaybookPropertyField

		// Get the playbooks property group using app service
		playbooksGroup, err := e.A.PropertyService().GetPropertyGroup("playbooks")
		require.NoError(t, err)
		require.NotNil(t, playbooksGroup)

		// Get the created property field using app service
		mmCreatedField, err := e.A.PropertyService().GetPropertyField(playbooksGroup.ID, fieldID)
		require.NoError(t, err)
		require.NotNil(t, mmCreatedField)
		require.Equal(t, "Priority", mmCreatedField.Name)
		require.Equal(t, "select", string(mmCreatedField.Type))
		require.Equal(t, playbooksGroup.ID, mmCreatedField.GroupID)
		require.Equal(t, app.PropertyTargetTypePlaybook, mmCreatedField.TargetType)
		require.Equal(t, e.BasicPlaybook.ID, mmCreatedField.TargetID)

		// Convert to our PropertyField type to access parsed options
		createdField, err := app.NewPropertyFieldFromMattermostPropertyField(mmCreatedField)
		require.NoError(t, err)
		require.NotNil(t, createdField)

		// Verify the options were created correctly
		require.Len(t, createdField.Attrs.Options, 3)

		// Check each option by name and color
		optionsByName := make(map[string]*model.PluginPropertyOption)
		for _, opt := range createdField.Attrs.Options {
			optionsByName[opt.GetName()] = opt
		}

		// Verify High option
		require.Contains(t, optionsByName, "High")
		highOption := optionsByName["High"]
		require.NotEmpty(t, highOption.GetID())
		require.Equal(t, "High", highOption.GetName())
		color := highOption.GetValue("color")
		require.Equal(t, "red", color)

		// Verify Medium option
		require.Contains(t, optionsByName, "Medium")
		mediumOption := optionsByName["Medium"]
		require.NotEmpty(t, mediumOption.GetID())
		require.Equal(t, "Medium", mediumOption.GetName())
		color = mediumOption.GetValue("color")
		require.Equal(t, "yellow", color)

		// Verify Low option
		require.Contains(t, optionsByName, "Low")
		lowOption := optionsByName["Low"]
		require.NotEmpty(t, lowOption.GetID())
		require.Equal(t, "Low", lowOption.GetName())
		color = lowOption.GetValue("color")
		require.Equal(t, "green", color)

		// Test the get property field query
		testGetPropertyFieldQuery := `
		query PlaybookProperty($playbookID: String!, $propertyID: String!) {
			playbookProperty(playbookID: $playbookID, propertyID: $propertyID) {
				id
				name
				type
				groupID
				createAt
				updateAt
				deleteAt
				attrs {
					visibility
					sortOrder
					parentID
					options {
						id
						name
						color
					}
				}
			}
		}
		`
		var getResponse struct {
			Data struct {
				PlaybookProperty struct {
					ID       string  `json:"id"`
					Name     string  `json:"name"`
					Type     string  `json:"type"`
					GroupID  string  `json:"groupID"`
					CreateAt float64 `json:"createAt"`
					UpdateAt float64 `json:"updateAt"`
					DeleteAt float64 `json:"deleteAt"`
					Attrs    struct {
						Visibility string  `json:"visibility"`
						SortOrder  float64 `json:"sortOrder"`
						ParentID   *string `json:"parentID"`
						Options    []struct {
							ID    string  `json:"id"`
							Name  string  `json:"name"`
							Color *string `json:"color"`
						} `json:"options"`
					} `json:"attrs"`
				} `json:"playbookProperty"`
			} `json:"data"`
		}

		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testGetPropertyFieldQuery,
			OperationName: "PlaybookProperty",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyID": fieldID,
			},
		}, &getResponse)
		require.NoError(t, err)

		// Verify the GraphQL response
		property := getResponse.Data.PlaybookProperty
		require.Equal(t, fieldID, property.ID)
		require.Equal(t, "Priority", property.Name)
		require.Equal(t, "select", property.Type)
		require.NotEmpty(t, property.GroupID)
		require.NotZero(t, property.CreateAt)
		require.NotZero(t, property.UpdateAt)
		require.Zero(t, property.DeleteAt)

		// Verify attrs
		require.Equal(t, "always", property.Attrs.Visibility)
		require.Equal(t, 1.0, property.Attrs.SortOrder)
		require.Nil(t, property.Attrs.ParentID)
		require.Len(t, property.Attrs.Options, 3)

		// Verify options via GraphQL response
		gqlOptionsByName := make(map[string]struct {
			ID    string
			Color *string
		})
		for _, opt := range property.Attrs.Options {
			gqlOptionsByName[opt.Name] = struct {
				ID    string
				Color *string
			}{ID: opt.ID, Color: opt.Color}
		}

		require.Contains(t, gqlOptionsByName, "High")
		gqlHighOpt := gqlOptionsByName["High"]
		require.NotEmpty(t, gqlHighOpt.ID)
		require.NotNil(t, gqlHighOpt.Color)
		require.Equal(t, "red", *gqlHighOpt.Color)

		require.Contains(t, gqlOptionsByName, "Medium")
		gqlMediumOpt := gqlOptionsByName["Medium"]
		require.NotEmpty(t, gqlMediumOpt.ID)
		require.NotNil(t, gqlMediumOpt.Color)
		require.Equal(t, "yellow", *gqlMediumOpt.Color)

		require.Contains(t, gqlOptionsByName, "Low")
		gqlLowOpt := gqlOptionsByName["Low"]
		require.NotEmpty(t, gqlLowOpt.ID)
		require.NotNil(t, gqlLowOpt.Color)
		require.Equal(t, "green", *gqlLowOpt.Color)
	})

	t.Run("update property field", func(t *testing.T) {
		// Step 1: Create a simple text field
		testAddPropertyFieldQuery := `
		mutation AddPlaybookPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
			addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
		}
		`
		var createResponse struct {
			Data struct {
				AddPlaybookPropertyField string `json:"addPlaybookPropertyField"`
			} `json:"data"`
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testAddPropertyFieldQuery,
			OperationName: "AddPlaybookPropertyField",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyField": map[string]any{
					"name": "New field",
					"type": "text",
				},
			},
		}, &createResponse)
		require.NoError(t, err)
		require.Empty(t, createResponse.Errors)
		require.NotEmpty(t, createResponse.Data.AddPlaybookPropertyField)

		fieldID := createResponse.Data.AddPlaybookPropertyField

		// Step 2: Update the name
		testUpdatePropertyFieldQuery := `
		mutation UpdatePlaybookPropertyField($playbookID: String!, $propertyFieldID: String!, $propertyField: PropertyFieldInput!) {
			updatePlaybookPropertyField(playbookID: $playbookID, propertyFieldID: $propertyFieldID, propertyField: $propertyField)
		}
		`
		var updateResponse struct {
			Data struct {
				UpdatePlaybookPropertyField string `json:"updatePlaybookPropertyField"`
			} `json:"data"`
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testUpdatePropertyFieldQuery,
			OperationName: "UpdatePlaybookPropertyField",
			Variables: map[string]any{
				"playbookID":      e.BasicPlaybook.ID,
				"propertyFieldID": fieldID,
				"propertyField": map[string]any{
					"name": "Updated field name",
					"type": "text",
				},
			},
		}, &updateResponse)
		require.NoError(t, err)
		require.Empty(t, updateResponse.Errors)

		// Verify the name changed
		testGetPropertyFieldQuery := `
		query PlaybookProperty($playbookID: String!, $propertyID: String!) {
			playbookProperty(playbookID: $playbookID, propertyID: $propertyID) {
				id
				name
				type
				attrs {
					options {
						id
						name
						color
					}
				}
			}
		}
		`
		var getResponse struct {
			Data struct {
				PlaybookProperty struct {
					ID    string `json:"id"`
					Name  string `json:"name"`
					Type  string `json:"type"`
					Attrs struct {
						Options []struct {
							ID    string  `json:"id"`
							Name  string  `json:"name"`
							Color *string `json:"color"`
						} `json:"options"`
					} `json:"attrs"`
				} `json:"playbookProperty"`
			} `json:"data"`
		}
		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testGetPropertyFieldQuery,
			OperationName: "PlaybookProperty",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyID": fieldID,
			},
		}, &getResponse)
		require.NoError(t, err)
		require.Equal(t, "Updated field name", getResponse.Data.PlaybookProperty.Name)
		require.Equal(t, "text", getResponse.Data.PlaybookProperty.Type)

		// Step 3: Change type to select and add options
		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testUpdatePropertyFieldQuery,
			OperationName: "UpdatePlaybookPropertyField",
			Variables: map[string]any{
				"playbookID":      e.BasicPlaybook.ID,
				"propertyFieldID": fieldID,
				"propertyField": map[string]any{
					"name": "Updated field name",
					"type": "select",
					"attrs": map[string]any{
						"options": []map[string]any{
							{
								"name":  "Option A",
								"color": "blue",
							},
							{
								"name":  "Option B",
								"color": "green",
							},
						},
					},
				},
			},
		}, &updateResponse)
		require.NoError(t, err)
		require.Empty(t, updateResponse.Errors)

		// Verify the type changed and options were added
		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testGetPropertyFieldQuery,
			OperationName: "PlaybookProperty",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyID": fieldID,
			},
		}, &getResponse)
		require.NoError(t, err)
		require.Equal(t, "Updated field name", getResponse.Data.PlaybookProperty.Name)
		require.Equal(t, "select", getResponse.Data.PlaybookProperty.Type)
		require.Len(t, getResponse.Data.PlaybookProperty.Attrs.Options, 2)

		// Store option IDs for the next steps
		optionsByName := make(map[string]struct {
			ID    string
			Color *string
		})
		for _, opt := range getResponse.Data.PlaybookProperty.Attrs.Options {
			optionsByName[opt.Name] = struct {
				ID    string
				Color *string
			}{opt.ID, opt.Color}
		}

		require.Contains(t, optionsByName, "Option A")
		optionA := optionsByName["Option A"]
		require.NotNil(t, optionA.Color)
		require.Equal(t, "blue", *optionA.Color)

		require.Contains(t, optionsByName, "Option B")
		optionB := optionsByName["Option B"]
		require.NotNil(t, optionB.Color)
		require.Equal(t, "green", *optionB.Color)

		// Step 4: Change the name of an option
		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testUpdatePropertyFieldQuery,
			OperationName: "UpdatePlaybookPropertyField",
			Variables: map[string]any{
				"playbookID":      e.BasicPlaybook.ID,
				"propertyFieldID": fieldID,
				"propertyField": map[string]any{
					"name": "Updated field name",
					"type": "select",
					"attrs": map[string]any{
						"options": []map[string]any{
							{
								"id":    optionA.ID,
								"name":  "Option A Renamed",
								"color": "blue",
							},
							{
								"id":    optionB.ID,
								"name":  "Option B",
								"color": "green",
							},
						},
					},
				},
			},
		}, &updateResponse)
		require.NoError(t, err)
		require.Empty(t, updateResponse.Errors)

		// Verify the option name changed
		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testGetPropertyFieldQuery,
			OperationName: "PlaybookProperty",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyID": fieldID,
			},
		}, &getResponse)
		require.NoError(t, err)
		require.Len(t, getResponse.Data.PlaybookProperty.Attrs.Options, 2)

		// Rebuild options map
		optionsByName = make(map[string]struct {
			ID    string
			Color *string
		})
		for _, opt := range getResponse.Data.PlaybookProperty.Attrs.Options {
			optionsByName[opt.Name] = struct {
				ID    string
				Color *string
			}{opt.ID, opt.Color}
		}

		require.Contains(t, optionsByName, "Option A Renamed")
		renamedOption := optionsByName["Option A Renamed"]
		require.Equal(t, optionA.ID, renamedOption.ID) // Same ID, different name
		require.NotNil(t, renamedOption.Color)
		require.Equal(t, "blue", *renamedOption.Color)

		// Step 5: Delete an option (remove Option B)
		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testUpdatePropertyFieldQuery,
			OperationName: "UpdatePlaybookPropertyField",
			Variables: map[string]any{
				"playbookID":      e.BasicPlaybook.ID,
				"propertyFieldID": fieldID,
				"propertyField": map[string]any{
					"name": "Updated field name",
					"type": "select",
					"attrs": map[string]any{
						"options": []map[string]any{
							{
								"id":    optionA.ID,
								"name":  "Option A Renamed",
								"color": "blue",
							},
						},
					},
				},
			},
		}, &updateResponse)
		require.NoError(t, err)
		require.Empty(t, updateResponse.Errors)

		// Verify Option B no longer exists
		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testGetPropertyFieldQuery,
			OperationName: "PlaybookProperty",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyID": fieldID,
			},
		}, &getResponse)
		require.NoError(t, err)
		require.Len(t, getResponse.Data.PlaybookProperty.Attrs.Options, 1)
		require.Equal(t, "Option A Renamed", getResponse.Data.PlaybookProperty.Attrs.Options[0].Name)
		require.Equal(t, optionA.ID, getResponse.Data.PlaybookProperty.Attrs.Options[0].ID)
	})

	t.Run("delete property field", func(t *testing.T) {
		// First create a property field to delete
		testAddPropertyFieldQuery := `
		mutation AddPlaybookPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
			addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
		}
		`
		var createResponse struct {
			Data struct {
				AddPlaybookPropertyField string `json:"addPlaybookPropertyField"`
			} `json:"data"`
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testAddPropertyFieldQuery,
			OperationName: "AddPlaybookPropertyField",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyField": map[string]any{
					"name": "Field to delete",
					"type": "text",
				},
			},
		}, &createResponse)
		require.NoError(t, err)
		require.Empty(t, createResponse.Errors)
		require.NotEmpty(t, createResponse.Data.AddPlaybookPropertyField)

		fieldID := createResponse.Data.AddPlaybookPropertyField

		// Verify the field exists before deletion
		testGetPropertyFieldQuery := `
		query PlaybookProperty($playbookID: String!, $propertyID: String!) {
			playbookProperty(playbookID: $playbookID, propertyID: $propertyID) {
				id
				name
				type
				deleteAt
			}
		}
		`
		var getResponse struct {
			Data struct {
				PlaybookProperty struct {
					ID       string  `json:"id"`
					Name     string  `json:"name"`
					Type     string  `json:"type"`
					DeleteAt float64 `json:"deleteAt"`
				} `json:"playbookProperty"`
			} `json:"data"`
		}
		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testGetPropertyFieldQuery,
			OperationName: "PlaybookProperty",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyID": fieldID,
			},
		}, &getResponse)
		require.NoError(t, err)
		require.Equal(t, fieldID, getResponse.Data.PlaybookProperty.ID)
		require.Equal(t, "Field to delete", getResponse.Data.PlaybookProperty.Name)
		require.Zero(t, getResponse.Data.PlaybookProperty.DeleteAt) // Should be 0 before deletion

		// Delete the property field
		testDeletePropertyFieldQuery := `
		mutation DeletePlaybookPropertyField($playbookID: String!, $propertyFieldID: String!) {
			deletePlaybookPropertyField(playbookID: $playbookID, propertyFieldID: $propertyFieldID)
		}
		`
		var deleteResponse struct {
			Data struct {
				DeletePlaybookPropertyField string `json:"deletePlaybookPropertyField"`
			} `json:"data"`
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testDeletePropertyFieldQuery,
			OperationName: "DeletePlaybookPropertyField",
			Variables: map[string]any{
				"playbookID":      e.BasicPlaybook.ID,
				"propertyFieldID": fieldID,
			},
		}, &deleteResponse)
		require.NoError(t, err)
		require.Empty(t, deleteResponse.Errors)
		require.Equal(t, fieldID, deleteResponse.Data.DeletePlaybookPropertyField)

		// Verify the field no longer exists
		var getResponseAfterDelete struct {
			Data struct {
				PlaybookProperty struct {
					ID       string  `json:"id"`
					Name     string  `json:"name"`
					Type     string  `json:"type"`
					DeleteAt float64 `json:"deleteAt"`
				} `json:"playbookProperty"`
			} `json:"data"`
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testGetPropertyFieldQuery,
			OperationName: "PlaybookProperty",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyID": fieldID,
			},
		}, &getResponseAfterDelete)
		require.NoError(t, err)

		// Verify the field was soft deleted (deleteAt should be non-zero)
		require.NotZero(t, getResponseAfterDelete.Data.PlaybookProperty.DeleteAt,
			"Property field should be soft deleted")
	})
}

func TestGraphQLPropertyFieldsLicenseEnforcement(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	// Create a property field while licensed
	e.SetEnterpriseLicence()

	testAddPropertyFieldQuery := `
	mutation AddPlaybookPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
		addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
	}
	`

	var addResponse struct {
		Data struct {
			AddPlaybookPropertyField string `json:"addPlaybookPropertyField"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}

	err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         testAddPropertyFieldQuery,
		OperationName: "AddPlaybookPropertyField",
		Variables: map[string]any{
			"playbookID": e.BasicPlaybook.ID,
			"propertyField": map[string]any{
				"name": "Test Field",
				"type": "text",
			},
		},
	}, &addResponse)
	require.NoError(t, err)
	require.Empty(t, addResponse.Errors, "Should be able to create property field with enterprise license")
	propertyFieldID := addResponse.Data.AddPlaybookPropertyField

	t.Run("add property field without license should fail", func(t *testing.T) {
		e.RemoveLicence()

		var response struct {
			Data   json.RawMessage
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}

		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testAddPropertyFieldQuery,
			OperationName: "AddPlaybookPropertyField",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyField": map[string]any{
					"name": "Unlicensed Field",
					"type": "text",
				},
			},
		}, &response)
		require.NoError(t, err)
		require.NotEmpty(t, response.Errors, "Should return error when not licensed")
	})

	t.Run("get property field without license should fail", func(t *testing.T) {
		e.RemoveLicence()

		testGetPropertyQuery := `
		query PlaybookProperty($playbookID: String!, $propertyID: String!) {
			playbookProperty(playbookID: $playbookID, propertyID: $propertyID) {
				id
				name
			}
		}
		`

		var response struct {
			Data   json.RawMessage
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}

		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testGetPropertyQuery,
			OperationName: "PlaybookProperty",
			Variables: map[string]any{
				"playbookID": e.BasicPlaybook.ID,
				"propertyID": propertyFieldID,
			},
		}, &response)
		require.NoError(t, err)
		require.NotEmpty(t, response.Errors, "Should return error when not licensed")
	})

	t.Run("update property field without license should fail", func(t *testing.T) {
		e.RemoveLicence()

		testUpdatePropertyQuery := `
		mutation UpdatePlaybookPropertyField($playbookID: String!, $propertyFieldID: String!, $propertyField: PropertyFieldInput!) {
			updatePlaybookPropertyField(playbookID: $playbookID, propertyFieldID: $propertyFieldID, propertyField: $propertyField)
		}
		`

		var response struct {
			Data   json.RawMessage
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}

		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testUpdatePropertyQuery,
			OperationName: "UpdatePlaybookPropertyField",
			Variables: map[string]any{
				"playbookID":      e.BasicPlaybook.ID,
				"propertyFieldID": propertyFieldID,
				"propertyField": map[string]any{
					"name": "Updated Field",
					"type": "text",
				},
			},
		}, &response)
		require.NoError(t, err)
		require.NotEmpty(t, response.Errors, "Should return error when not licensed")
	})

	t.Run("delete property field without license should fail", func(t *testing.T) {
		e.RemoveLicence()

		testDeletePropertyQuery := `
		mutation DeletePlaybookPropertyField($playbookID: String!, $propertyFieldID: String!) {
			deletePlaybookPropertyField(playbookID: $playbookID, propertyFieldID: $propertyFieldID)
		}
		`

		var response struct {
			Data   json.RawMessage
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}

		err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
			Query:         testDeletePropertyQuery,
			OperationName: "DeletePlaybookPropertyField",
			Variables: map[string]any{
				"playbookID":      e.BasicPlaybook.ID,
				"propertyFieldID": propertyFieldID,
			},
		}, &response)
		require.NoError(t, err)
		require.NotEmpty(t, response.Errors, "Should return error when not licensed")
	})
}

func TestPropertyFieldDeletionWithConditions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	playbookID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Test Playbook for Property Deletion",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)

	testAddPropertyFieldQuery := `
	mutation AddPlaybookPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
		addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
	}
	`
	var createResponse struct {
		Data struct {
			AddPlaybookPropertyField string `json:"addPlaybookPropertyField"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         testAddPropertyFieldQuery,
		OperationName: "AddPlaybookPropertyField",
		Variables: map[string]any{
			"playbookID": playbookID,
			"propertyField": map[string]any{
				"name": "Status",
				"type": "select",
				"attrs": map[string]any{
					"options": []map[string]any{
						{"name": "Active"},
						{"name": "Inactive"},
					},
				},
			},
		},
	}, &createResponse)
	require.NoError(t, err)
	require.Empty(t, createResponse.Errors)

	fieldID := createResponse.Data.AddPlaybookPropertyField

	playbooksGroup, err := e.A.PropertyService().GetPropertyGroup("playbooks")
	require.NoError(t, err)
	require.NotNil(t, playbooksGroup)

	mmCreatedField, err := e.A.PropertyService().GetPropertyField(playbooksGroup.ID, fieldID)
	require.NoError(t, err)
	require.NotNil(t, mmCreatedField)

	appCreatedField, err := app.NewPropertyFieldFromMattermostPropertyField(mmCreatedField)
	require.NoError(t, err)
	require.NotEmpty(t, appCreatedField.Attrs.Options)

	optionID := appCreatedField.Attrs.Options[0].GetID()

	condition := client.Condition{
		PlaybookID: playbookID,
		Version:    1,
		ConditionExpr: client.ConditionExprV1{
			Is: &client.ComparisonCondition{
				FieldID: fieldID,
				Value:   json.RawMessage(`["` + optionID + `"]`),
			},
		},
	}

	createdCondition, err := e.PlaybooksClient.PlaybookConditions.Create(context.Background(), playbookID, condition)
	require.NoError(t, err)
	require.NotNil(t, createdCondition)
	require.NotEmpty(t, createdCondition.ID)

	testDeletePropertyFieldQuery := `
	mutation DeletePlaybookPropertyField($playbookID: String!, $propertyFieldID: String!) {
		deletePlaybookPropertyField(playbookID: $playbookID, propertyFieldID: $propertyFieldID)
	}
	`
	var deleteResponse struct {
		Data struct {
			DeletePlaybookPropertyField string `json:"deletePlaybookPropertyField"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         testDeletePropertyFieldQuery,
		OperationName: "DeletePlaybookPropertyField",
		Variables: map[string]any{
			"playbookID":      playbookID,
			"propertyFieldID": fieldID,
		},
	}, &deleteResponse)
	require.NoError(t, err)
	require.NotEmpty(t, deleteResponse.Errors)
	require.Contains(t, deleteResponse.Errors[0].Message, "property field is in use")
	require.Contains(t, deleteResponse.Errors[0].Message, "1 condition(s)")

	err = e.PlaybooksClient.PlaybookConditions.Delete(context.Background(), playbookID, createdCondition.ID)
	require.NoError(t, err)

	var deleteResponse2 struct {
		Data struct {
			DeletePlaybookPropertyField string `json:"deletePlaybookPropertyField"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	err = e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query:         testDeletePropertyFieldQuery,
		OperationName: "DeletePlaybookPropertyField",
		Variables: map[string]any{
			"playbookID":      playbookID,
			"propertyFieldID": fieldID,
		},
	}, &deleteResponse2)
	require.NoError(t, err)
	require.Empty(t, deleteResponse2.Errors)
	require.Equal(t, fieldID, deleteResponse2.Data.DeletePlaybookPropertyField)
}

func TestPropertyOptionRemovalWithConditions(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	playbookID, err := e.PlaybooksClient.Playbooks.Create(context.Background(), client.PlaybookCreateOptions{
		Title:  "Test Complex Option Updates",
		TeamID: e.BasicTeam.Id,
		Public: true,
	})
	require.NoError(t, err)

	fieldID, optionIDs := gqlCreateSelectPropertyField(t, e, playbookID, "Status", []string{
		"Todo", "In Progress", "Done", "Blocked", "Archived",
	})
	todoID, inProgressID, doneID, blockedID, archivedID := optionIDs[0], optionIDs[1], optionIDs[2], optionIDs[3], optionIDs[4]

	cond1 := gqlCreateConditionWithOptions(t, e, playbookID, fieldID, []string{todoID}, false)
	cond2 := gqlCreateConditionWithOptions(t, e, playbookID, fieldID, []string{doneID}, true)
	cond3 := gqlCreateConditionWithOptions(t, e, playbookID, fieldID, []string{doneID, archivedID}, false)

	t.Run("removing multiple options with mixed usage", func(t *testing.T) {
		response := gqlUpdatePropertyFieldOptions(t, e, playbookID, fieldID, []map[string]any{
			{"id": inProgressID, "name": "In Progress"},
			{"id": blockedID, "name": "Blocked"},
		})
		require.NotEmpty(t, response.Errors)
		require.Contains(t, response.Errors[0].Message, "property options are in use")
		require.Contains(t, response.Errors[0].Message, "Todo")
		require.Contains(t, response.Errors[0].Message, "Done")
		require.Contains(t, response.Errors[0].Message, "Archived")
	})

	t.Run("keeping used options allows update", func(t *testing.T) {
		response := gqlUpdatePropertyFieldOptions(t, e, playbookID, fieldID, []map[string]any{
			{"id": todoID, "name": "Todo"},
			{"id": doneID, "name": "Done"},
			{"id": archivedID, "name": "Archived"},
			{"name": "New Option"},
		})
		require.Empty(t, response.Errors)
		require.Equal(t, fieldID, response.Data.UpdatePlaybookPropertyField)
	})

	t.Run("after deleting conditions can remove all options", func(t *testing.T) {
		require.NoError(t, e.PlaybooksClient.PlaybookConditions.Delete(context.Background(), playbookID, cond1.ID))
		require.NoError(t, e.PlaybooksClient.PlaybookConditions.Delete(context.Background(), playbookID, cond2.ID))
		require.NoError(t, e.PlaybooksClient.PlaybookConditions.Delete(context.Background(), playbookID, cond3.ID))

		response := gqlUpdatePropertyFieldOptions(t, e, playbookID, fieldID, []map[string]any{
			{"name": "Completely New"},
		})
		require.Empty(t, response.Errors)
		require.Equal(t, fieldID, response.Data.UpdatePlaybookPropertyField)
	})
}

type graphqlPropertyResponse struct {
	Data struct {
		AddPlaybookPropertyField    string `json:"addPlaybookPropertyField"`
		UpdatePlaybookPropertyField string `json:"updatePlaybookPropertyField"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func gqlCreateSelectPropertyField(t *testing.T, e *TestEnvironment, playbookID, name string, optionNames []string) (fieldID string, optionIDs []string) {
	t.Helper()

	options := make([]map[string]any, len(optionNames))
	for i, name := range optionNames {
		options[i] = map[string]any{"name": name}
	}

	var response graphqlPropertyResponse
	err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query: `mutation AddPlaybookPropertyField($playbookID: String!, $propertyField: PropertyFieldInput!) {
			addPlaybookPropertyField(playbookID: $playbookID, propertyField: $propertyField)
		}`,
		OperationName: "AddPlaybookPropertyField",
		Variables: map[string]any{
			"playbookID": playbookID,
			"propertyField": map[string]any{
				"name": name,
				"type": "select",
				"attrs": map[string]any{
					"options": options,
				},
			},
		},
	}, &response)
	require.NoError(t, err)
	require.Empty(t, response.Errors)

	fieldID = response.Data.AddPlaybookPropertyField

	playbooksGroup, err := e.A.PropertyService().GetPropertyGroup("playbooks")
	require.NoError(t, err)

	mmField, err := e.A.PropertyService().GetPropertyField(playbooksGroup.ID, fieldID)
	require.NoError(t, err)

	appField, err := app.NewPropertyFieldFromMattermostPropertyField(mmField)
	require.NoError(t, err)
	require.Len(t, appField.Attrs.Options, len(optionNames))

	optionIDs = make([]string, len(appField.Attrs.Options))
	for i, opt := range appField.Attrs.Options {
		optionIDs[i] = opt.GetID()
	}

	return fieldID, optionIDs
}

func gqlUpdatePropertyFieldOptions(t *testing.T, e *TestEnvironment, playbookID, fieldID string, options []map[string]any) graphqlPropertyResponse {
	t.Helper()

	var response graphqlPropertyResponse
	err := e.PlaybooksClient.DoGraphql(context.Background(), &client.GraphQLInput{
		Query: `mutation UpdatePlaybookPropertyField($playbookID: String!, $propertyFieldID: String!, $propertyField: PropertyFieldInput!) {
			updatePlaybookPropertyField(playbookID: $playbookID, propertyFieldID: $propertyFieldID, propertyField: $propertyField)
		}`,
		OperationName: "UpdatePlaybookPropertyField",
		Variables: map[string]any{
			"playbookID":      playbookID,
			"propertyFieldID": fieldID,
			"propertyField": map[string]any{
				"name": "Status",
				"type": "select",
				"attrs": map[string]any{
					"options": options,
				},
			},
		},
	}, &response)
	require.NoError(t, err)

	return response
}

func gqlCreateConditionWithOptions(t *testing.T, e *TestEnvironment, playbookID, fieldID string, optionIDs []string, isNot bool) *client.Condition {
	t.Helper()

	valueBytes, err := json.Marshal(optionIDs)
	require.NoError(t, err)

	condition := client.Condition{
		PlaybookID:    playbookID,
		Version:       1,
		ConditionExpr: client.ConditionExprV1{},
	}

	if isNot {
		condition.ConditionExpr.IsNot = &client.ComparisonCondition{
			FieldID: fieldID,
			Value:   json.RawMessage(valueBytes),
		}
	} else {
		condition.ConditionExpr.Is = &client.ComparisonCondition{
			FieldID: fieldID,
			Value:   json.RawMessage(valueBytes),
		}
	}

	created, err := e.PlaybooksClient.PlaybookConditions.Create(context.Background(), playbookID, condition)
	require.NoError(t, err)

	return created
}
