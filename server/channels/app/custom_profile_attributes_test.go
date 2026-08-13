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

	cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
	require.Nil(t, groupErr)
	cpaID := cpaGroup.ID

	rctx := th.emptyContextWithCallerID(anonymousCallerId)

	field := &model.PropertyField{
		GroupID:    cpaID,
		Name:       "f_" + model.NewId(),
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
			Name:       "f_" + model.NewId(),
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
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
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
			// Single-target search: at most one value per (target, field), so the field cap bounds the page.
			PerPage: model.AccessControlGroupFieldLimit + 5,
		})
		require.Nil(t, appErr)
		return values
	}

	// Create multiple fields and a value per field for userID.
	var createdFields []*model.PropertyField
	for i := 1; i <= 3; i++ {
		field := &model.PropertyField{
			GroupID:    cpaID,
			Name:       fmt.Sprintf("field_%d", i),
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

// TestCPAValueSyncLock exercises AccessControlHook.checkSyncLock end-to-end
// at the app layer: a write for a field with ldap= or saml= set only
// succeeds when the caller ID matches the field's sync source. Covering this
// at the app layer also asserts that the startup wiring in server.go
// (access_control group registration, AccessControlHook install, and
// CallerIDExtractor reading from request.CTX) is intact — something the
// properties-package tests cannot verify because they install the hook
// themselves.
func TestCPAValueSyncLock(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	cpaGroup, groupErr := th.App.GetPropertyGroup(request.TestContext(t), model.AccessControlPropertyGroupName)
	require.Nil(t, groupErr)
	cpaID := cpaGroup.ID

	adminRctx := th.emptyContextWithCallerID(th.SystemAdminUser.Id)

	createField := func(name string, attrs model.CPAAttrs) *model.PropertyField {
		t.Helper()
		cpa := &model.CPAField{
			PropertyField: model.PropertyField{
				GroupID:    cpaID,
				Name:       name,
				Type:       model.PropertyFieldTypeText,
				ObjectType: model.PropertyFieldObjectTypeUser,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
			},
			Attrs: attrs,
		}
		// Sanitization/validation runs inside CreatePropertyField via the
		// AccessControlAttributeValidationHook.
		created, appErr := th.App.CreatePropertyField(adminRctx, cpa.ToPropertyField(), false, "")
		require.Nil(t, appErr)
		return created
	}

	ldapField := createField("ldap_attr_"+model.NewId(), model.CPAAttrs{LDAP: "mail"})
	samlField := createField("saml_attr_"+model.NewId(), model.CPAAttrs{SAML: "email"})
	plainField := createField("plain_attr_"+model.NewId(), model.CPAAttrs{})

	userID := model.NewId()
	upsertAs := func(callerID string, field *model.PropertyField) *model.AppError {
		t.Helper()
		rctx := th.emptyContextWithCallerID(callerID)
		_, appErr := th.App.UpsertPropertyValues(rctx, []*model.PropertyValue{{
			GroupID:    cpaID,
			TargetType: model.PropertyValueTargetTypeUser,
			TargetID:   userID,
			FieldID:    field.ID,
			Value:      json.RawMessage(`"value"`),
		}}, model.PropertyFieldObjectTypeUser, userID, "")
		return appErr
	}

	requireSyncLock := func(appErr *model.AppError) {
		t.Helper()
		require.NotNil(t, appErr)
		require.Equal(t, "app.property.sync_lock.app_error", appErr.Id)
	}

	t.Run("anonymous caller is blocked on an LDAP-synced field", func(t *testing.T) {
		requireSyncLock(upsertAs(anonymousCallerId, ldapField))
	})

	t.Run("anonymous caller is blocked on a SAML-synced field", func(t *testing.T) {
		requireSyncLock(upsertAs(anonymousCallerId, samlField))
	})

	t.Run("anonymous caller is allowed on a non-synced field", func(t *testing.T) {
		require.Nil(t, upsertAs(anonymousCallerId, plainField))
	})

	t.Run("LDAP sync caller is allowed on an LDAP-synced field", func(t *testing.T) {
		require.Nil(t, upsertAs(model.CallerIDLDAPSync, ldapField))
	})

	t.Run("LDAP sync caller is blocked on a SAML-synced field", func(t *testing.T) {
		requireSyncLock(upsertAs(model.CallerIDLDAPSync, samlField))
	})

	t.Run("SAML sync caller is allowed on a SAML-synced field", func(t *testing.T) {
		require.Nil(t, upsertAs(model.CallerIDSAMLSync, samlField))
	})

	t.Run("SAML sync caller is blocked on an LDAP-synced field", func(t *testing.T) {
		requireSyncLock(upsertAs(model.CallerIDSAMLSync, ldapField))
	})
}
