// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func TestConvertRequestToPropertyField(t *testing.T) {
	tests := []struct {
		name     string
		request  PropertyFieldRequest
		expected *app.PropertyField
	}{
		{
			name: "minimal text field with no attrs",
			request: PropertyFieldRequest{
				Name: "Test Field",
				Type: "text",
			},
			expected: &app.PropertyField{
				PropertyField: model.PropertyField{
					Name: "Test Field",
					Type: "text",
				},
				Attrs: app.Attrs{
					Visibility: app.PropertyFieldVisibilityDefault,
				},
			},
		},
		{
			name: "field with all attrs",
			request: PropertyFieldRequest{
				Name: "Custom Field",
				Type: "user",
				Attrs: &PropertyFieldAttrsInput{
					Visibility: "always",
					SortOrder:  5.0,
					ParentID:   "parent-123",
					ValueType:  "user_id",
				},
			},
			expected: &app.PropertyField{
				PropertyField: model.PropertyField{
					Name: "Custom Field",
					Type: "user",
				},
				Attrs: app.Attrs{
					Visibility: "always",
					SortOrder:  5.0,
					ParentID:   "parent-123",
					ValueType:  "user_id",
				},
			},
		},
		{
			name: "select field with options",
			request: PropertyFieldRequest{
				Name: "Priority",
				Type: "select",
				Attrs: &PropertyFieldAttrsInput{
					Visibility: "when_set",
					SortOrder:  2.0,
					Options: []PropertyOptionInput{
						{
							ID:    stringPtr("opt-1"),
							Name:  "High",
							Color: stringPtr("#ff0000"),
						},
						{
							ID:    stringPtr("opt-2"),
							Name:  "Low",
							Color: stringPtr("#00ff00"),
						},
					},
				},
			},
			expected: func() *app.PropertyField {
				opt1 := model.NewPluginPropertyOption("opt-1", "High")
				opt1.SetValue("color", "#ff0000")
				opt2 := model.NewPluginPropertyOption("opt-2", "Low")
				opt2.SetValue("color", "#00ff00")
				return &app.PropertyField{
					PropertyField: model.PropertyField{
						Name: "Priority",
						Type: "select",
					},
					Attrs: app.Attrs{
						Visibility: "when_set",
						SortOrder:  2.0,
						Options:    model.PropertyOptions[*model.PluginPropertyOption]{opt1, opt2},
					},
				}
			}(),
		},
		{
			name: "option without id (for creation)",
			request: PropertyFieldRequest{
				Name: "Status",
				Type: "select",
				Attrs: &PropertyFieldAttrsInput{
					Options: []PropertyOptionInput{
						{
							Name:  "New Option",
							Color: stringPtr("#0000ff"),
						},
					},
				},
			},
			expected: func() *app.PropertyField {
				opt := model.NewPluginPropertyOption("", "New Option")
				opt.SetValue("color", "#0000ff")
				return &app.PropertyField{
					PropertyField: model.PropertyField{
						Name: "Status",
						Type: "select",
					},
					Attrs: app.Attrs{
						Visibility: app.PropertyFieldVisibilityDefault,
						Options:    model.PropertyOptions[*model.PluginPropertyOption]{opt},
					},
				}
			}(),
		},
		{
			name: "field with partial attrs",
			request: PropertyFieldRequest{
				Name: "Partial Field",
				Type: "date",
				Attrs: &PropertyFieldAttrsInput{
					SortOrder: 10.0,
				},
			},
			expected: &app.PropertyField{
				PropertyField: model.PropertyField{
					Name: "Partial Field",
					Type: "date",
				},
				Attrs: app.Attrs{
					Visibility: app.PropertyFieldVisibilityDefault,
					SortOrder:  10.0,
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := convertRequestToPropertyField(tt.request)

			require.NotNil(t, result)
			assert.Equal(t, tt.expected.Name, result.Name)
			assert.Equal(t, tt.expected.Type, result.Type)
			assert.Equal(t, tt.expected.Attrs.Visibility, result.Attrs.Visibility)
			assert.Equal(t, tt.expected.Attrs.SortOrder, result.Attrs.SortOrder)
			assert.Equal(t, tt.expected.Attrs.ParentID, result.Attrs.ParentID)
			assert.Equal(t, tt.expected.Attrs.ValueType, result.Attrs.ValueType)

			if tt.expected.Attrs.Options != nil {
				require.NotNil(t, result.Attrs.Options)
				require.Len(t, result.Attrs.Options, len(tt.expected.Attrs.Options))

				for i, expectedOpt := range tt.expected.Attrs.Options {
					actualOpt := result.Attrs.Options[i]
					assert.Equal(t, expectedOpt.GetID(), actualOpt.GetID())
					assert.Equal(t, expectedOpt.GetName(), actualOpt.GetName())

					// Check color if present
					expectedColor := expectedOpt.GetValue("color")
					actualColor := actualOpt.GetValue("color")
					assert.Equal(t, expectedColor, actualColor)
				}
			} else {
				assert.Nil(t, result.Attrs.Options)
			}
		})
	}
}

func stringPtr(s string) *string {
	return &s
}
