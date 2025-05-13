package pluginapi

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPropertyAPI(t *testing.T) {
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
			PerPage: 10,
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
		api.On("SearchPropertyFields", "group1", "target1", opts).Return(fields, nil)
		
		// Create the client
		client := NewClient(api, nil)
		
		// Call the method
		result, err := client.Property.SearchPropertyFields("group1", "target1", opts)
		
		// Verify the results
		require.NoError(t, err)
		assert.Equal(t, fields, result)
		api.AssertExpectations(t)
	})
}