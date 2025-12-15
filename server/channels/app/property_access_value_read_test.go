// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPropertyValueReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register a test group
	group, rerr := pas.RegisterPropertyGroup("", "test-group-values")
	require.NoError(t, rerr)

	pluginID1 := "plugin-1"
	pluginID2 := "plugin-2"
	userID1 := model.NewId()
	userID2 := model.NewId()

	t.Run("public field value - any caller can read", func(t *testing.T) {
		// Create public field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "public-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModePublic,
			},
		}
		field, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Create value
		textValue, err := json.Marshal("test value")
		require.NoError(t, err)
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      textValue,
		}
		value, err = pas.CreatePropertyValue("", value)
		require.NoError(t, err)

		// Plugin 1 can read
		retrieved, err := pas.GetPropertyValue(pluginID1, group.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)
		assert.Equal(t, json.RawMessage(textValue), retrieved.Value)

		// Plugin 2 can read
		retrieved, err = pas.GetPropertyValue(pluginID2, group.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)

		// User can read
		retrieved, err = pas.GetPropertyValue(userID2, group.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)

		// Anonymous caller can read
		retrieved, err = pas.GetPropertyValue("", group.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)
	})

	t.Run("source_only field value - only source plugin can read", func(t *testing.T) {
		// Create source_only field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: pluginID1,
			},
		}
		field, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Create value
		textValue, err := json.Marshal("secret value")
		require.NoError(t, err)
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      textValue,
		}
		value, err = pas.CreatePropertyValue("", value)
		require.NoError(t, err)

		// Source plugin can read
		retrieved, err := pas.GetPropertyValue(pluginID1, group.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value.ID, retrieved.ID)
		assert.Equal(t, json.RawMessage(textValue), retrieved.Value)
	})

	t.Run("source_only field value - other plugin gets nil", func(t *testing.T) {
		// Create source_only field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field-2",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: pluginID1,
			},
		}
		field, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Create value
		textValue, err := json.Marshal("secret value")
		require.NoError(t, err)
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      textValue,
		}
		value, err = pas.CreatePropertyValue("", value)
		require.NoError(t, err)

		// Other plugin gets nil
		retrieved, err := pas.GetPropertyValue(pluginID2, group.ID, value.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)

		// User gets nil
		retrieved, err = pas.GetPropertyValue(userID2, group.ID, value.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)

		// Anonymous caller gets nil
		retrieved, err = pas.GetPropertyValue("", group.ID, value.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("shared_only single-select - return value only if caller has same", func(t *testing.T) {
		// Create shared_only field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "shared-only-single-select",
			Type:       model.PropertyFieldTypeSelect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModeSharedOnly,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
					map[string]any{"id": "opt3", "value": "Option 3"},
				},
			},
		}
		field, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// User 1 has opt1
		user1Value, err := json.Marshal("opt1")
		require.NoError(t, err)
		value1 := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      user1Value,
		}
		value1, err = pas.CreatePropertyValue("", value1)
		require.NoError(t, err)

		// User 2 also has opt1
		user2Value, err := json.Marshal("opt1")
		require.NoError(t, err)
		value2 := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID2,
			Value:      user2Value,
		}
		_, err = pas.CreatePropertyValue("", value2)
		require.NoError(t, err)

		// User 2 can see user 1's value (both have opt1)
		retrieved, err := pas.GetPropertyValue(userID2, group.ID, value1.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, value1.ID, retrieved.ID)
		assert.Equal(t, json.RawMessage(user1Value), retrieved.Value)

		// Create another user with opt2
		userID3 := model.NewId()
		user3Value, err := json.Marshal("opt2")
		require.NoError(t, err)
		value3 := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID3,
			Value:      user3Value,
		}
		_, err = pas.CreatePropertyValue("", value3)
		require.NoError(t, err)

		// User 3 cannot see user 1's value (different options, no intersection)
		retrieved, err = pas.GetPropertyValue(userID3, group.ID, value1.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("shared_only multi-select - return intersection of arrays", func(t *testing.T) {
		// Create shared_only multiselect field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "shared-only-multi-select",
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModeSharedOnly,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Hiking"},
					map[string]any{"id": "opt2", "value": "Cooking"},
					map[string]any{"id": "opt3", "value": "Gaming"},
				},
			},
		}
		field, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Alice has ["opt1", "opt2"] (hiking, cooking)
		aliceID := model.NewId()
		aliceValue, err := json.Marshal([]string{"opt1", "opt2"})
		require.NoError(t, err)
		alicePropertyValue := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   aliceID,
			Value:      aliceValue,
		}
		alicePropertyValue, err = pas.CreatePropertyValue("", alicePropertyValue)
		require.NoError(t, err)

		// Bob has ["opt1", "opt3"] (hiking, gaming)
		bobID := model.NewId()
		bobValue, err := json.Marshal([]string{"opt1", "opt3"})
		require.NoError(t, err)
		bobPropertyValue := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   bobID,
			Value:      bobValue,
		}
		_, err = pas.CreatePropertyValue("", bobPropertyValue)
		require.NoError(t, err)

		// Bob views Alice - should only see ["opt1"] (intersection)
		retrieved, err := pas.GetPropertyValue(bobID, group.ID, alicePropertyValue.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, alicePropertyValue.ID, retrieved.ID)

		var retrievedOptions []string
		err = json.Unmarshal(retrieved.Value, &retrievedOptions)
		require.NoError(t, err)
		assert.Len(t, retrievedOptions, 1)
		assert.Contains(t, retrievedOptions, "opt1")

		// Create user with no overlapping values
		charlieID := model.NewId()
		charlieValue, err := json.Marshal([]string{"opt3"})
		require.NoError(t, err)
		charliePropertyValue := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   charlieID,
			Value:      charlieValue,
		}
		_, err = pas.CreatePropertyValue("", charliePropertyValue)
		require.NoError(t, err)

		// Charlie views Alice - should get nil (no intersection)
		retrieved, err = pas.GetPropertyValue(charlieID, group.ID, alicePropertyValue.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})

	t.Run("shared_only value - caller with no values sees nothing", func(t *testing.T) {
		// Create shared_only field
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "shared-only-no-values",
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModeSharedOnly,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
				},
			},
		}
		field, err := pas.CreatePropertyField("", field)
		require.NoError(t, err)

		// Create value for user 1
		user1Value, err := json.Marshal([]string{"opt1"})
		require.NoError(t, err)
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      user1Value,
		}
		value, err = pas.CreatePropertyValue("", value)
		require.NoError(t, err)

		// User 2 has no values for this field
		retrieved, err := pas.GetPropertyValue(userID2, group.ID, value.ID)
		require.NoError(t, err)
		assert.Nil(t, retrieved)
	})
}

func TestGetPropertyValuesReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register a test group
	group, rerr := pas.RegisterPropertyGroup("", "test-group-bulk-values")
	require.NoError(t, rerr)

	pluginID1 := "plugin-1"
	pluginID2 := "plugin-2"
	userID := model.NewId()

	t.Run("mixed access modes - bulk read respects per-field access control", func(t *testing.T) {
		// Create public field
		publicField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "public-field-bulk",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModePublic,
			},
		}
		publicField, err := pas.CreatePropertyField("", publicField)
		require.NoError(t, err)

		// Create source_only field
		sourceOnlyField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field-bulk",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: pluginID1,
			},
		}
		sourceOnlyField, err = pas.CreatePropertyField("", sourceOnlyField)
		require.NoError(t, err)

		// Create values
		publicValue, err := json.Marshal("public")
		require.NoError(t, err)
		publicPropValue := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    publicField.ID,
			TargetType: "user",
			TargetID:   userID,
			Value:      publicValue,
		}
		publicPropValue, err = pas.CreatePropertyValue("", publicPropValue)
		require.NoError(t, err)

		sourceOnlyValue, err := json.Marshal("secret")
		require.NoError(t, err)
		sourceOnlyPropValue := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    sourceOnlyField.ID,
			TargetType: "user",
			TargetID:   userID,
			Value:      sourceOnlyValue,
		}
		sourceOnlyPropValue, err = pas.CreatePropertyValue("", sourceOnlyPropValue)
		require.NoError(t, err)

		// Plugin 1 (source) sees both values
		retrieved, err := pas.GetPropertyValues(pluginID1, group.ID, []string{publicPropValue.ID, sourceOnlyPropValue.ID})
		require.NoError(t, err)
		assert.Len(t, retrieved, 2)

		// Plugin 2 sees only public value
		retrieved, err = pas.GetPropertyValues(pluginID2, group.ID, []string{publicPropValue.ID, sourceOnlyPropValue.ID})
		require.NoError(t, err)
		assert.Len(t, retrieved, 1)
		assert.Equal(t, publicPropValue.ID, retrieved[0].ID)

		// User sees only public value
		retrieved, err = pas.GetPropertyValues(userID, group.ID, []string{publicPropValue.ID, sourceOnlyPropValue.ID})
		require.NoError(t, err)
		assert.Len(t, retrieved, 1)
		assert.Equal(t, publicPropValue.ID, retrieved[0].ID)
	})

	t.Run("empty value list returns empty list", func(t *testing.T) {
		retrieved, err := pas.GetPropertyValues(userID, group.ID, []string{})
		require.NoError(t, err)
		assert.Empty(t, retrieved)
	})
}

func TestSearchPropertyValuesReadAccess(t *testing.T) {
	th := Setup(t)

	pas := th.App.PropertyAccessService()

	// Register a test group
	group, rerr := pas.RegisterPropertyGroup("", "test-group-search-values")
	require.NoError(t, rerr)

	pluginID1 := "plugin-1"
	pluginID2 := "plugin-2"
	userID1 := model.NewId()
	userID2 := model.NewId()

	t.Run("search filters based on field access", func(t *testing.T) {
		// Create public field
		publicField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "public-field-search",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModePublic,
			},
		}
		publicField, err := pas.CreatePropertyField("", publicField)
		require.NoError(t, err)

		// Create source_only field
		sourceOnlyField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "source-only-field-search",
			Type:       model.PropertyFieldTypeText,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode:     model.CustomProfileAttributesAccessModeSourceOnly,
				model.CustomProfileAttributesPropertyAttrsSourcePluginID: pluginID1,
			},
		}
		sourceOnlyField, err = pas.CreatePropertyField("", sourceOnlyField)
		require.NoError(t, err)

		// Create values for both fields
		publicValue, err := json.Marshal("public data")
		require.NoError(t, err)
		_, err = pas.CreatePropertyValue("", &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    publicField.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      publicValue,
		})
		require.NoError(t, err)

		sourceOnlyValue, err := json.Marshal("secret data")
		require.NoError(t, err)
		_, err = pas.CreatePropertyValue("", &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    sourceOnlyField.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      sourceOnlyValue,
		})
		require.NoError(t, err)

		// Source plugin sees both values
		results, err := pas.SearchPropertyValues(pluginID1, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{userID1},
			PerPage:   100,
		})
		require.NoError(t, err)
		assert.Len(t, results, 2)

		// Other plugin sees only public value
		results, err = pas.SearchPropertyValues(pluginID2, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{userID1},
			PerPage:   100,
		})
		require.NoError(t, err)
		assert.Len(t, results, 1)
		assert.Equal(t, publicField.ID, results[0].FieldID)
	})

	t.Run("search shared_only values show intersection", func(t *testing.T) {
		// Create shared_only field
		sharedField := &model.PropertyField{
			GroupID:    group.ID,
			Name:       "shared-field-search",
			Type:       model.PropertyFieldTypeMultiselect,
			TargetType: "user",
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsAccessMode: model.CustomProfileAttributesAccessModeSharedOnly,
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": "opt1", "value": "Option 1"},
					map[string]any{"id": "opt2", "value": "Option 2"},
					map[string]any{"id": "opt3", "value": "Option 3"},
				},
			},
		}
		sharedField, err := pas.CreatePropertyField("", sharedField)
		require.NoError(t, err)

		// User 1 has ["opt1", "opt2"]
		user1Value, err := json.Marshal([]string{"opt1", "opt2"})
		require.NoError(t, err)
		_, err = pas.CreatePropertyValue("", &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    sharedField.ID,
			TargetType: "user",
			TargetID:   userID1,
			Value:      user1Value,
		})
		require.NoError(t, err)

		// User 2 has ["opt1", "opt3"]
		user2Value, err := json.Marshal([]string{"opt1", "opt3"})
		require.NoError(t, err)
		_, err = pas.CreatePropertyValue("", &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    sharedField.ID,
			TargetType: "user",
			TargetID:   userID2,
			Value:      user2Value,
		})
		require.NoError(t, err)

		// User 2 searches for user 1's values - should see only ["opt1"]
		results, err := pas.SearchPropertyValues(userID2, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{userID1},
			FieldID:   sharedField.ID,
			PerPage:   100,
		})
		require.NoError(t, err)
		require.Len(t, results, 1)

		var retrievedOptions []string
		err = json.Unmarshal(results[0].Value, &retrievedOptions)
		require.NoError(t, err)
		assert.Len(t, retrievedOptions, 1)
		assert.Contains(t, retrievedOptions, "opt1")
	})
}
