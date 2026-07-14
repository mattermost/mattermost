package pluginapi

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestPropertyFieldAPI(t *testing.T) {
	t.Run("CreatePropertyField", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		field := &model.PropertyField{
			ID:      "field1",
			GroupID: "group1",
			Name:    "Test Field",
			Type:    model.PropertyFieldTypeText,
		}
		api.On("CreatePropertyField", field).Return(field, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.CreatePropertyField(field)

		// Verify the results
		assert.NoError(t, err)
		assert.Equal(t, field, result)
		api.AssertExpectations(t)
	})

	t.Run("GetPropertyField", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		field := &model.PropertyField{
			ID:      "field1",
			GroupID: "group1",
			Name:    "Test Field",
			Type:    model.PropertyFieldTypeText,
		}
		api.On("GetPropertyField", "group1", "field1").Return(field, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.GetPropertyField("group1", "field1")

		// Verify the results
		assert.NoError(t, err)
		assert.Equal(t, field, result)
		api.AssertExpectations(t)
	})

	t.Run("GetPropertyFields", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		fields := []*model.PropertyField{
			{
				ID:      "field1",
				GroupID: "group1",
				Name:    "Test Field 1",
				Type:    model.PropertyFieldTypeText,
			},
			{
				ID:      "field2",
				GroupID: "group1",
				Name:    "Test Field 2",
				Type:    model.PropertyFieldTypeSelect,
			},
		}
		api.On("GetPropertyFields", "group1", []string{"field1", "field2"}).Return(fields, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.GetPropertyFields("group1", []string{"field1", "field2"})

		// Verify the results
		assert.NoError(t, err)
		assert.Equal(t, fields, result)
		api.AssertExpectations(t)
	})

	t.Run("UpdatePropertyField", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		field := &model.PropertyField{
			ID:      "field1",
			GroupID: "group1",
			Name:    "Updated Field",
			Type:    model.PropertyFieldTypeText,
		}
		api.On("UpdatePropertyField", "group1", field).Return(field, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.UpdatePropertyField("group1", field)

		// Verify the results
		assert.NoError(t, err)
		assert.Equal(t, field, result)
		api.AssertExpectations(t)
	})

	t.Run("DeletePropertyField", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		api.On("DeletePropertyField", "group1", "field1").Return(nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		err := client.Property.DeletePropertyField("group1", "field1")

		// Verify the results
		assert.NoError(t, err)
		api.AssertExpectations(t)
	})

	t.Run("SearchPropertyFields", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		opts := model.PropertyFieldSearchOpts{
			PerPage:   10,
			TargetIDs: []string{"target1"},
		}
		fields := []*model.PropertyField{
			{
				ID:      "field1",
				GroupID: "group1",
				Name:    "Test Field 1",
				Type:    model.PropertyFieldTypeText,
			},
			{
				ID:      "field2",
				GroupID: "group1",
				Name:    "Test Field 2",
				Type:    model.PropertyFieldTypeSelect,
			},
		}
		api.On("SearchPropertyFields", "group1", opts).Return(fields, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.SearchPropertyFields("group1", opts)

		// Verify the results
		require.NoError(t, err)
		assert.Equal(t, fields, result)
		api.AssertExpectations(t)
	})

	t.Run("CountPropertyFields", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call for active fields only
		api.On("CountPropertyFields", "group1", false).Return(int64(5), nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.CountPropertyFields("group1", false)

		// Verify the results
		require.NoError(t, err)
		assert.Equal(t, int64(5), result)
		api.AssertExpectations(t)
	})

	t.Run("CountPropertyFields with deleted", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call for all fields including deleted
		api.On("CountPropertyFields", "group1", true).Return(int64(8), nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.CountPropertyFields("group1", true)

		// Verify the results
		require.NoError(t, err)
		assert.Equal(t, int64(8), result)
		api.AssertExpectations(t)
	})

	t.Run("CountPropertyFieldsForTarget", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call for active fields for a specific target
		api.On("CountPropertyFieldsForTarget", "group1", "user", "target123", false).Return(int64(3), nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.CountPropertyFieldsForTarget("group1", "user", "target123", false)

		// Verify the results
		require.NoError(t, err)
		assert.Equal(t, int64(3), result)
		api.AssertExpectations(t)
	})

	t.Run("CountPropertyFieldsForTarget with deleted", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call for all fields including deleted for a specific target
		api.On("CountPropertyFieldsForTarget", "group1", "user", "target123", true).Return(int64(5), nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.CountPropertyFieldsForTarget("group1", "user", "target123", true)

		// Verify the results
		require.NoError(t, err)
		assert.Equal(t, int64(5), result)
		api.AssertExpectations(t)
	})
}

func TestPropertyValueAPI(t *testing.T) {
	t.Run("CreatePropertyValue", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		value := &model.PropertyValue{
			ID:         "value1",
			GroupID:    "group1",
			FieldID:    "field1",
			TargetID:   "target1",
			TargetType: "post",
			Value:      json.RawMessage(`"Test Value"`),
		}
		api.On("CreatePropertyValue", value).Return(value, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.CreatePropertyValue(value)

		// Verify the results
		assert.NoError(t, err)
		assert.Equal(t, value, result)
		api.AssertExpectations(t)
	})

	t.Run("GetPropertyValue", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		value := &model.PropertyValue{
			ID:         "value1",
			GroupID:    "group1",
			FieldID:    "field1",
			TargetID:   "target1",
			TargetType: "post",
			Value:      json.RawMessage(`"Test Value"`),
		}
		api.On("GetPropertyValue", "group1", "value1").Return(value, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.GetPropertyValue("group1", "value1")

		// Verify the results
		assert.NoError(t, err)
		assert.Equal(t, value, result)
		api.AssertExpectations(t)
	})

	t.Run("GetPropertyValues", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		values := []*model.PropertyValue{
			{
				ID:         "value1",
				GroupID:    "group1",
				FieldID:    "field1",
				TargetID:   "target1",
				TargetType: "post",
				Value:      json.RawMessage(`"Test Value 1"`),
			},
			{
				ID:         "value2",
				GroupID:    "group1",
				FieldID:    "field2",
				TargetID:   "target1",
				TargetType: "post",
				Value:      json.RawMessage(`"Test Value 2"`),
			},
		}
		api.On("GetPropertyValues", "group1", []string{"value1", "value2"}).Return(values, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.GetPropertyValues("group1", []string{"value1", "value2"})

		// Verify the results
		assert.NoError(t, err)
		assert.Equal(t, values, result)
		api.AssertExpectations(t)
	})

	t.Run("UpdatePropertyValue", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		value := &model.PropertyValue{
			ID:         "value1",
			GroupID:    "group1",
			FieldID:    "field1",
			TargetID:   "target1",
			TargetType: "post",
			Value:      json.RawMessage(`"Updated Value"`),
		}
		api.On("UpdatePropertyValue", "group1", value).Return(value, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.UpdatePropertyValue("group1", value)

		// Verify the results
		assert.NoError(t, err)
		assert.Equal(t, value, result)
		api.AssertExpectations(t)
	})

	t.Run("UpsertPropertyValue", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		value := &model.PropertyValue{
			ID:         "value1",
			GroupID:    "group1",
			FieldID:    "field1",
			TargetID:   "target1",
			TargetType: "post",
			Value:      json.RawMessage(`"Upsert Value"`),
		}
		api.On("UpsertPropertyValue", value).Return(value, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.UpsertPropertyValue(value)

		// Verify the results
		assert.NoError(t, err)
		assert.Equal(t, value, result)
		api.AssertExpectations(t)
	})

	t.Run("DeletePropertyValue", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		api.On("DeletePropertyValue", "group1", "value1").Return(nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		err := client.Property.DeletePropertyValue("group1", "value1")

		// Verify the results
		assert.NoError(t, err)
		api.AssertExpectations(t)
	})

	t.Run("SearchPropertyValues", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		opts := model.PropertyValueSearchOpts{
			PerPage:   10,
			TargetIDs: []string{"target1"},
		}
		values := []*model.PropertyValue{
			{
				ID:         "value1",
				GroupID:    "group1",
				FieldID:    "field1",
				TargetID:   "target1",
				TargetType: "post",
				Value:      json.RawMessage(`"Test Value 1"`),
			},
			{
				ID:         "value2",
				GroupID:    "group1",
				FieldID:    "field2",
				TargetID:   "target1",
				TargetType: "post",
				Value:      json.RawMessage(`"Test Value 2"`),
			},
		}
		api.On("SearchPropertyValues", "group1", opts).Return(values, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.SearchPropertyValues("group1", opts)

		// Verify the results
		require.NoError(t, err)
		assert.Equal(t, values, result)
		api.AssertExpectations(t)
	})
}

func TestPropertyGroupAPI(t *testing.T) {
	t.Run("RegisterPropertyGroup", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		group := &model.PropertyGroup{
			ID:   "group1",
			Name: "Test Group",
		}
		api.On("RegisterPropertyGroup", "Test Group").Return(group, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.RegisterPropertyGroup("Test Group")

		// Verify the results
		assert.NoError(t, err)
		assert.Equal(t, group, result)
		api.AssertExpectations(t)
	})

	t.Run("GetPropertyGroup", func(t *testing.T) {
		// Setup
		api := &plugintest.API{}

		// Mock the API call
		group := &model.PropertyGroup{
			ID:   "group1",
			Name: "Test Group",
		}
		api.On("GetPropertyGroup", "Test Group").Return(group, nil)

		// Create the client
		client := NewClient(api, nil)

		// Call the method
		result, err := client.Property.GetPropertyGroup("Test Group")

		// Verify the results
		assert.NoError(t, err)
		assert.Equal(t, group, result)
		api.AssertExpectations(t)
	})
}

func TestPropertyFieldOwnerHelpers(t *testing.T) {
	pluginID := "com.mattermost.scim"
	otherPluginID := "com.other.plugin"

	t.Run("AddPropertyFieldOwner adds first owner", func(t *testing.T) {
		api := &plugintest.API{}
		field := &model.PropertyField{
			ID:      "field1",
			GroupID: "group1",
			Attrs: model.StringInterface{
				"options": []any{map[string]any{"name": "A", "id": "opt1"}},
			},
		}
		api.On("GetPropertyField", "group1", "field1").Return(field, nil)
		api.On("UpdatePropertyField", "group1", mock.MatchedBy(func(f *model.PropertyField) bool {
			owners := model.GetPropertyFieldOwners(f)
			if len(owners) != 1 || owners[0].ID != pluginID || owners[0].Type != model.PropertyOwnerTypePlugin {
				return false
			}
			if !assert.Equal(t, []string{"entra"}, owners[0].Scopes) {
				return false
			}
			// Other attrs preserved
			_, ok := f.Attrs["options"]
			return ok
		})).Return(field, nil)

		client := NewClient(api, nil)
		err := client.Property.AddPropertyFieldOwner("group1", "field1", model.PropertyOwner{
			ID: pluginID, Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"},
		})
		require.NoError(t, err)
		api.AssertExpectations(t)
	})

	t.Run("AddPropertyFieldOwner merges scopes and dedupes", func(t *testing.T) {
		api := &plugintest.API{}
		field := &model.PropertyField{
			ID:      "field1",
			GroupID: "group1",
			Attrs: model.StringInterface{
				model.PropertyAttrsOwners: []model.PropertyOwner{
					{ID: pluginID, Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
					{ID: otherPluginID, Type: model.PropertyOwnerTypePlugin, Scopes: []string{"other"}},
				},
			},
		}
		api.On("GetPropertyField", "group1", "field1").Return(field, nil)
		api.On("UpdatePropertyField", "group1", mock.MatchedBy(func(f *model.PropertyField) bool {
			owners := model.GetPropertyFieldOwners(f)
			if len(owners) != 2 {
				return false
			}
			var ours, theirs *model.PropertyOwner
			for i := range owners {
				switch owners[i].ID {
				case pluginID:
					ours = &owners[i]
				case otherPluginID:
					theirs = &owners[i]
				}
			}
			if ours == nil || theirs == nil {
				return false
			}
			return assert.Equal(t, []string{"entra", "okta"}, ours.Scopes) &&
				assert.Equal(t, []string{"other"}, theirs.Scopes)
		})).Return(field, nil)

		client := NewClient(api, nil)
		err := client.Property.AddPropertyFieldOwner("group1", "field1", model.PropertyOwner{
			ID: pluginID, Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra", "okta"},
		})
		require.NoError(t, err)
		api.AssertExpectations(t)
	})

	t.Run("RemovePropertyFieldOwner removes a scope and prunes empty entry", func(t *testing.T) {
		api := &plugintest.API{}
		field := &model.PropertyField{
			ID:      "field1",
			GroupID: "group1",
			Attrs: model.StringInterface{
				model.PropertyAttrsOwners: []model.PropertyOwner{
					{ID: pluginID, Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
					{ID: otherPluginID, Type: model.PropertyOwnerTypePlugin, Scopes: []string{"other"}},
				},
				"visibility": "always",
			},
		}
		opts := model.PropertyRequestOptions{ActingAsScope: "entra"}
		api.On("GetPropertyField", "group1", "field1").Return(field, nil)
		api.On("UpdatePropertyFieldWithOptions", "group1", mock.MatchedBy(func(f *model.PropertyField) bool {
			owners := model.GetPropertyFieldOwners(f)
			if len(owners) != 1 || owners[0].ID != otherPluginID {
				return false
			}
			return assert.Equal(t, "always", f.Attrs["visibility"])
		}), opts).Return(field, nil)

		client := NewClient(api, nil)
		err := client.Property.RemovePropertyFieldOwner("group1", "field1", model.PropertyOwner{
			ID: pluginID, Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"},
		}, opts)
		require.NoError(t, err)
		api.AssertExpectations(t)
	})

	t.Run("RemovePropertyFieldOwner with empty scopes removes whole entry", func(t *testing.T) {
		api := &plugintest.API{}
		field := &model.PropertyField{
			ID:      "field1",
			GroupID: "group1",
			Attrs: model.StringInterface{
				model.PropertyAttrsOwners: []model.PropertyOwner{
					{ID: pluginID, Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra", "okta"}},
				},
			},
		}
		opts := model.PropertyRequestOptions{}
		api.On("GetPropertyField", "group1", "field1").Return(field, nil)
		api.On("UpdatePropertyFieldWithOptions", "group1", mock.MatchedBy(func(f *model.PropertyField) bool {
			return !model.HasPropertyFieldOwners(f)
		}), opts).Return(field, nil)

		client := NewClient(api, nil)
		err := client.Property.RemovePropertyFieldOwner("group1", "field1", model.PropertyOwner{
			ID: pluginID, Type: model.PropertyOwnerTypePlugin,
		}, opts)
		require.NoError(t, err)
		api.AssertExpectations(t)
	})

	t.Run("AddPropertyFieldOwner is no-op-safe on repeat", func(t *testing.T) {
		api := &plugintest.API{}
		field := &model.PropertyField{
			ID:      "field1",
			GroupID: "group1",
			Attrs: model.StringInterface{
				model.PropertyAttrsOwners: []model.PropertyOwner{
					{ID: pluginID, Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"}},
				},
			},
		}
		api.On("GetPropertyField", "group1", "field1").Return(field, nil)
		api.On("UpdatePropertyField", "group1", mock.MatchedBy(func(f *model.PropertyField) bool {
			owners := model.GetPropertyFieldOwners(f)
			return len(owners) == 1 && assert.Equal(t, []string{"entra"}, owners[0].Scopes)
		})).Return(field, nil)

		client := NewClient(api, nil)
		err := client.Property.AddPropertyFieldOwner("group1", "field1", model.PropertyOwner{
			ID: pluginID, Type: model.PropertyOwnerTypePlugin, Scopes: []string{"entra"},
		})
		require.NoError(t, err)
		api.AssertExpectations(t)
	})

	t.Run("scopeless ownership add and remove", func(t *testing.T) {
		api := &plugintest.API{}
		field := &model.PropertyField{
			ID:      "field1",
			GroupID: "group1",
			Attrs:   model.StringInterface{},
		}
		api.On("GetPropertyField", "group1", "field1").Return(field, nil).Once()
		api.On("UpdatePropertyField", "group1", mock.MatchedBy(func(f *model.PropertyField) bool {
			owners := model.GetPropertyFieldOwners(f)
			return len(owners) == 1 &&
				owners[0].ID == pluginID &&
				owners[0].Type == model.PropertyOwnerTypePlugin &&
				len(owners[0].Scopes) == 0
		})).Return(field, nil).Once()

		client := NewClient(api, nil)
		err := client.Property.AddPropertyFieldOwner("group1", "field1", model.PropertyOwner{
			ID: pluginID, Type: model.PropertyOwnerTypePlugin,
		})
		require.NoError(t, err)

		owned := &model.PropertyField{
			ID:      "field1",
			GroupID: "group1",
			Attrs: model.StringInterface{
				model.PropertyAttrsOwners: []model.PropertyOwner{
					{ID: pluginID, Type: model.PropertyOwnerTypePlugin},
				},
			},
		}
		opts := model.PropertyRequestOptions{}
		api.On("GetPropertyField", "group1", "field1").Return(owned, nil).Once()
		api.On("UpdatePropertyFieldWithOptions", "group1", mock.MatchedBy(func(f *model.PropertyField) bool {
			return !model.HasPropertyFieldOwners(f)
		}), opts).Return(owned, nil).Once()

		err = client.Property.RemovePropertyFieldOwner("group1", "field1", model.PropertyOwner{
			ID: pluginID, Type: model.PropertyOwnerTypePlugin,
		}, opts)
		require.NoError(t, err)
		api.AssertExpectations(t)
	})
}
