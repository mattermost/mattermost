// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSyncLocking(t *testing.T) {
	th := Setup(t)

	group, err := th.service.RegisterPropertyGroup("test_sync_lock")
	require.NoError(t, err)

	hook := NewAccessControlHook(th.service, nil, group.ID)
	th.service.AddHook(hook)

	// Create an LDAP-synced field and a SAML-synced field
	ldapField := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "ldap_field_" + model.NewId(),
		Type:       model.PropertyFieldTypeText,
		TargetType: "system",
		ObjectType: "user",
		Attrs:      model.StringInterface{model.PropertyFieldAttrLDAP: "cn"},
	})

	samlField := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "saml_field_" + model.NewId(),
		Type:       model.PropertyFieldTypeText,
		TargetType: "system",
		ObjectType: "user",
		Attrs:      model.StringInterface{model.PropertyFieldAttrSAML: "displayName"},
	})

	nonSyncedField := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "normal_field_" + model.NewId(),
		Type:       model.PropertyFieldTypeText,
		TargetType: "system",
		ObjectType: "user",
	})

	targetID := model.NewId()

	t.Run("blocks upsert on LDAP-synced field without caller ID", func(t *testing.T) {
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    ldapField.ID,
			TargetID:   targetID,
			TargetType: "user",
			Value:      json.RawMessage(`"test"`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "ldap sync")
	})

	t.Run("allows LDAP sync service to upsert LDAP-synced field", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, model.CallerIDLDAPSync)
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    ldapField.ID,
			TargetID:   targetID,
			TargetType: "user",
			Value:      json.RawMessage(`"John Doe"`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(rctx, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("blocks SAML sync service from writing LDAP-synced field", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, model.CallerIDSAMLSync)
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    ldapField.ID,
			TargetID:   targetID,
			TargetType: "user",
			Value:      json.RawMessage(`"wrong caller"`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(rctx, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "ldap sync")
	})

	t.Run("allows SAML sync service to upsert SAML-synced field", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, model.CallerIDSAMLSync)
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    samlField.ID,
			TargetID:   targetID,
			TargetType: "user",
			Value:      json.RawMessage(`"Jane Doe"`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(rctx, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("blocks regular user from writing SAML-synced field", func(t *testing.T) {
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    samlField.ID,
			TargetID:   targetID,
			TargetType: "user",
			Value:      json.RawMessage(`"sneaky"`),
		}
		_, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "saml sync")
	})

	t.Run("allows regular user to upsert non-synced field", func(t *testing.T) {
		value := &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    nonSyncedField.ID,
			TargetID:   targetID,
			TargetType: "user",
			Value:      json.RawMessage(`"hello"`),
		}
		result, upsertErr := th.service.UpsertPropertyValue(th.Context, value)
		require.NoError(t, upsertErr)
		assert.NotEmpty(t, result.ID)
	})

	t.Run("sync lock applies to batch upsert", func(t *testing.T) {
		values := []*model.PropertyValue{
			{
				GroupID:    group.ID,
				FieldID:    ldapField.ID,
				TargetID:   targetID,
				TargetType: "user",
				Value:      json.RawMessage(`"batch test"`),
			},
		}
		_, upsertErr := th.service.UpsertPropertyValues(th.Context, values)
		require.Error(t, upsertErr)
		assert.Contains(t, upsertErr.Error(), "ldap sync")

		// Same batch with the right caller should succeed
		rctx := RequestContextWithCallerID(th.Context, model.CallerIDLDAPSync)
		results, upsertErr := th.service.UpsertPropertyValues(rctx, values)
		require.NoError(t, upsertErr)
		assert.Len(t, results, 1)
	})
}
