package pluginapi

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
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
