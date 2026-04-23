// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/require"
)

func TestGetCPAValue(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.ProtectedAttributesPropertyGroupName)
	require.Nil(t, groupErr)
	cpaID := cpaGroup.ID

	rctx := th.emptyContextWithCallerID(anonymousCallerId)

	field := &model.PropertyField{
		GroupID:    cpaID,
		Name:       model.NewId(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}
	createdField, err := th.App.CreatePropertyField(rctx, field, false, "")
	require.Nil(t, err)
	fieldID := createdField.ID

	t.Run("should fail if the value doesn't exist", func(t *testing.T) {
		pv, appErr := th.App.GetPropertyValue(rctx, cpaID, model.NewId())
		require.NotNil(t, appErr)
		require.Nil(t, pv)
	})

	t.Run("should fail if the group id is invalid", func(t *testing.T) {
		propertyValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: model.PropertyValueTargetTypeUser,
			GroupID:    model.NewId(),
			FieldID:    fieldID,
			Value:      json.RawMessage(`"Value"`),
		}
		created, err := th.App.CreatePropertyValue(rctx, propertyValue)
		require.Nil(t, err)
		require.NotNil(t, created)

		pv, appErr := th.App.GetPropertyValue(rctx, cpaID, created.ID)
		require.NotNil(t, appErr)
		require.Nil(t, pv)
	})

	t.Run("should succeed if id exists", func(t *testing.T) {
		propertyValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: model.PropertyValueTargetTypeUser,
			GroupID:    cpaID,
			FieldID:    fieldID,
			Value:      json.RawMessage(`"Value"`),
		}
		propertyValue, err := th.App.CreatePropertyValue(rctx, propertyValue)
		require.Nil(t, err)

		pv, appErr := th.App.GetPropertyValue(rctx, cpaID, propertyValue.ID)
		require.Nil(t, appErr)
		require.NotNil(t, pv)
	})

	t.Run("should handle array values correctly", func(t *testing.T) {
		optionIDs := []string{model.NewId(), model.NewId(), model.NewId()}
		arrayField := &model.PropertyField{
			GroupID:    cpaID,
			Name:       model.NewId(),
			Type:       model.PropertyFieldTypeMultiselect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"id": optionIDs[0], "name": "option1"},
					map[string]any{"id": optionIDs[1], "name": "option2"},
					map[string]any{"id": optionIDs[2], "name": "option3"},
				},
			},
		}
		createdField, err := th.App.CreatePropertyField(rctx, arrayField, false, "")
		require.Nil(t, err)

		propertyValue := &model.PropertyValue{
			TargetID:   model.NewId(),
			TargetType: model.PropertyValueTargetTypeUser,
			GroupID:    cpaID,
			FieldID:    createdField.ID,
			Value:      json.RawMessage(fmt.Sprintf(`["%s", "%s", "%s"]`, optionIDs[0], optionIDs[1], optionIDs[2])),
		}
		propertyValue, err = th.App.CreatePropertyValue(rctx, propertyValue)
		require.Nil(t, err)

		pv, appErr := th.App.GetPropertyValue(rctx, cpaID, propertyValue.ID)
		require.Nil(t, appErr)
		require.NotNil(t, pv)
		var arrayValues []string
		require.NoError(t, json.Unmarshal(pv.Value, &arrayValues))
		require.Equal(t, optionIDs, arrayValues)
	})
}

func TestDeleteCPAValues(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.CustomProfileAttributes = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.ProtectedAttributesPropertyGroupName)
	require.Nil(t, groupErr)
	cpaID := cpaGroup.ID

	rctx := th.emptyContextWithCallerID(anonymousCallerId)

	userID := model.NewId()
	otherUserID := model.NewId()

	listValues := func(targetID string) []*model.PropertyValue {
		t.Helper()
		values, appErr := th.App.SearchPropertyValues(rctx, cpaID, model.PropertyValueSearchOpts{
			TargetIDs:  []string{targetID},
			TargetType: model.PropertyValueTargetTypeUser,
			PerPage:    250,
		})
		require.Nil(t, appErr)
		return values
	}

	// Create multiple fields and a value per field for userID.
	var createdFields []*model.PropertyField
	for i := 1; i <= 3; i++ {
		field := &model.PropertyField{
			GroupID:    cpaID,
			Name:       fmt.Sprintf("Field %d", i),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		}
		createdField, err := th.App.CreatePropertyField(rctx, field, false, "")
		require.Nil(t, err)
		createdFields = append(createdFields, createdField)

		value := &model.PropertyValue{
			TargetID:   userID,
			TargetType: model.PropertyValueTargetTypeUser,
			GroupID:    cpaID,
			FieldID:    createdField.ID,
			Value:      json.RawMessage(fmt.Sprintf(`"Value %d"`, i)),
		}
		_, err = th.App.CreatePropertyValue(rctx, value)
		require.Nil(t, err)
	}

	require.Len(t, listValues(userID), 3)

	t.Run("should delete all values for a user", func(t *testing.T) {
		appErr := th.App.DeletePropertyValuesForTarget(rctx, cpaID, model.PropertyFieldObjectTypeUser, userID)
		require.Nil(t, appErr)

		require.Empty(t, listValues(userID))
	})

	t.Run("should handle deleting values for a user with no values", func(t *testing.T) {
		appErr := th.App.DeletePropertyValuesForTarget(rctx, cpaID, model.PropertyFieldObjectTypeUser, otherUserID)
		require.Nil(t, appErr)
	})

	t.Run("should not affect values for other users", func(t *testing.T) {
		// Create values for otherUserID.
		for _, field := range createdFields {
			value := &model.PropertyValue{
				TargetID:   otherUserID,
				TargetType: model.PropertyValueTargetTypeUser,
				GroupID:    cpaID,
				FieldID:    field.ID,
				Value:      json.RawMessage(`"Other user value"`),
			}
			_, err := th.App.CreatePropertyValue(rctx, value)
			require.Nil(t, err)
		}

		appErr := th.App.DeletePropertyValuesForTarget(rctx, cpaID, model.PropertyFieldObjectTypeUser, userID)
		require.Nil(t, appErr)

		require.Len(t, listValues(otherUserID), 3)
	})
}
