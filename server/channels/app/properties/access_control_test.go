// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestLinkedFieldCreateOnTemplatePermissions covers
// validateAndInheritLinkedFieldSecurity: gating a linked create on the
// template's permissions when its reads are restricted, and seeding the new
// field's own permissions from the template when the caller submits none.
func TestLinkedFieldCreateOnTemplatePermissions(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner" || pluginID == "plugin-other"
	})

	newTemplate := func(name string, permissions *model.Permissions) *model.PropertyField {
		created, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:     th.CPAGroupID,
			Name:        name,
			Type:        model.PropertyFieldTypeText,
			ObjectType:  model.PropertyFieldObjectTypeTemplate,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
			Permissions: permissions,
		})
		require.NoError(t, err)
		return created
	}

	openReads := &model.Permissions{
		Restrictions: &model.Restrictions{
			Value:  model.ReadWrite{Read: model.PermissionLevelEveryone},
			Option: model.ReadWrite{Read: model.PermissionLevelEveryone},
		},
	}

	t.Run("a masked template refuses a caller with no field.write grant and admits one with it", func(t *testing.T) {
		source := newTemplate("Masked-"+model.NewId(), &model.Permissions{
			Masking: &model.Masking{},
			Grants: []model.Grant{
				{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionFieldWrite}},
			},
		})

		_, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "plugin-other"), &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "Linked-Refused-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &source.ID,
		})
		require.Error(t, err)
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)

		linked, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "plugin-owner"), &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "Linked-Allowed-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, linked.Permissions)
	})

	t.Run("a template with open reads requires no permission on it to link", func(t *testing.T) {
		source := newTemplate("Open-"+model.NewId(), openReads)

		_, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "some-random-user"), &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)
	})

	t.Run("a template with open reads and non-default restrictions passes them to the linked field", func(t *testing.T) {
		source := newTemplate("OpenCustom-"+model.NewId(), &model.Permissions{
			Restrictions: &model.Restrictions{
				Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelAdmin},
				Option: model.ReadWrite{Read: model.PermissionLevelEveryone},
				Field:  model.WriteOnly{Write: model.PermissionLevelAdmin},
			},
		})

		linked, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "some-random-user"), &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, linked.Permissions)
		require.NotNil(t, linked.Permissions.Restrictions)
		assert.Equal(t, *source.Permissions.Restrictions, *linked.Permissions.Restrictions)
	})

	t.Run("a linked create submitting no permissions inherits the template's restrictions and grants minus option.read", func(t *testing.T) {
		source := newTemplate("GrantsAndRestrictions-"+model.NewId(), &model.Permissions{
			Restrictions: &model.Restrictions{
				Value:  model.ReadWrite{Read: model.PermissionLevelEveryone},
				Option: model.ReadWrite{Read: model.PermissionLevelEveryone},
				Field:  model.WriteOnly{Write: model.PermissionLevelAdmin},
			},
			Grants: []model.Grant{
				{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionOptionRead, model.PropertyActionValueWrite}},
				{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-other"}, Allow: []string{model.PropertyActionOptionRead}},
			},
		})

		linked, err := th.service.CreatePropertyField(RequestContextWithCallerID(th.Context, "some-random-user"), &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &source.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, linked.Permissions)
		assert.Equal(t, *source.Permissions.Restrictions, *linked.Permissions.Restrictions)
		assert.Nil(t, linked.Permissions.Masking)
		// plugin-owner keeps value.write with option.read stripped; plugin-other's
		// grant named nothing else, so it is dropped rather than kept empty.
		require.Len(t, linked.Permissions.Grants, 1)
		assert.Equal(t, "plugin-owner", linked.Permissions.Grants[0].ID)
		assert.Equal(t, []string{model.PropertyActionValueWrite}, linked.Permissions.Grants[0].Allow)
	})

	t.Run("a linked create submitting its own permissions keeps them, and the store still refuses one carrying masking", func(t *testing.T) {
		source := newTemplate("SelfSubmitted-"+model.NewId(), openReads)

		ownPermissions := &model.Permissions{
			Grants: []model.Grant{
				{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "plugin-owner"}, Allow: []string{model.PropertyActionValueWrite}},
			},
		}
		linked, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "Linked-Own-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &source.ID,
			Permissions:   ownPermissions,
		})
		require.NoError(t, err)
		require.NotNil(t, linked.Permissions)
		assert.Equal(t, ownPermissions.Grants, linked.Permissions.Grants)

		_, err = th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "Linked-Masked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &source.ID,
			Permissions:   &model.Permissions{Masking: &model.Masking{}},
		})
		require.Error(t, err)
	})
}
