// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestShapePropertyFieldForCaller(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	groupID := registerTestPropertyGroup(t, th)

	newField := func(permissions *model.Permissions) *model.PropertyField {
		return &model.PropertyField{
			GroupID:     groupID,
			Name:        "v3 shaping field",
			Type:        model.PropertyFieldTypeText,
			ObjectType:  model.PropertyFieldObjectTypeUser,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
			Permissions: permissions,
		}
	}

	t.Run("serveV3 false strips permissions outright", func(t *testing.T) {
		field := newField(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelSysadmin}},
		})

		session := model.Session{UserId: th.BasicUser.Id}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, session, field, false)
		require.NotNil(t, shaped)
		assert.Nil(t, shaped.Permissions)
	})

	t.Run("field with no permissions is returned unchanged", func(t *testing.T) {
		field := newField(nil)

		session := model.Session{UserId: th.BasicUser.Id}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, session, field, true)
		assert.Same(t, field, shaped)
	})

	t.Run("a caller who may edit the field receives everything and no filtered flag", func(t *testing.T) {
		field := newField(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelSysadmin}},
			Grants: []model.Grant{
				{Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser2.Id}, Allow: []string{model.PropertyActionValueWrite}},
			},
			Masking: &model.Masking{MaskByFieldID: "some-field-id"},
		})

		session := model.Session{UserId: th.SystemAdminUser.Id, Roles: model.SystemAdminRoleId}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, session, field, true)
		require.NotNil(t, shaped.Permissions)
		assert.False(t, shaped.Permissions.Filtered)
		assert.Len(t, shaped.Permissions.Grants, 1)
		assert.Equal(t, "some-field-id", shaped.Permissions.Masking.MaskByFieldID)
		// The stored field is untouched.
		assert.Equal(t, "some-field-id", field.Permissions.Masking.MaskByFieldID)
	})

	t.Run("a non-editing caller sees only their own grants", func(t *testing.T) {
		field := newField(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelSysadmin}},
			Grants: []model.Grant{
				{Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser.Id}, Allow: []string{model.PropertyActionValueWrite}},
				{Identity: model.Identity{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser2.Id}, Allow: []string{model.PropertyActionValueWrite}},
				{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "*"}, Allow: []string{model.PropertyActionValueWrite}},
			},
		})

		session := model.Session{UserId: th.BasicUser.Id}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, session, field, true)
		require.NotNil(t, shaped.Permissions)
		require.Len(t, shaped.Permissions.Grants, 1)
		assert.Equal(t, th.BasicUser.Id, shaped.Permissions.Grants[0].ID)
		assert.True(t, shaped.Permissions.Filtered)
	})

	t.Run("a non-editing caller matches a role grant they hold", func(t *testing.T) {
		// Field.Write none denies field.write to everyone, including the
		// sysadmin session, so the sysadmin session below is exercising the
		// non-editor path rather than the edit-basis shortcut.
		field := newField(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelNone}},
			Grants: []model.Grant{
				{Identity: model.Identity{Type: model.PropertyOwnerTypeRole, ID: model.SystemAdminRoleId}, Allow: []string{model.PropertyActionValueWrite}},
			},
		})

		adminSession := model.Session{UserId: th.SystemAdminUser.Id, Roles: model.SystemAdminRoleId}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, adminSession, field, true)
		require.NotNil(t, shaped.Permissions)
		require.Len(t, shaped.Permissions.Grants, 1)
		assert.Equal(t, model.SystemAdminRoleId, shaped.Permissions.Grants[0].ID)

		memberSession := model.Session{UserId: th.BasicUser.Id}
		shaped = th.App.ShapePropertyFieldForCaller(th.Context, memberSession, field, true)
		require.NotNil(t, shaped.Permissions)
		assert.Empty(t, shaped.Permissions.Grants)
		assert.True(t, shaped.Permissions.Filtered)
	})

	t.Run("an empty grants list serializes as an empty slice, never nil", func(t *testing.T) {
		field := newField(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelSysadmin}},
		})

		session := model.Session{UserId: th.BasicUser.Id}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, session, field, true)
		require.NotNil(t, shaped.Permissions)
		require.NotNil(t, shaped.Permissions.Grants)
		assert.Empty(t, shaped.Permissions.Grants)
	})

	t.Run("restrictions are never reduced and never set filtered", func(t *testing.T) {
		field := newField(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelSysadmin}},
		})

		session := model.Session{UserId: th.BasicUser.Id}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, session, field, true)
		require.NotNil(t, shaped.Permissions)
		assert.Equal(t, field.Permissions.Restrictions, shaped.Permissions.Restrictions)
		assert.False(t, shaped.Permissions.Filtered)
	})

	t.Run("masking presence survives but its contents are withheld", func(t *testing.T) {
		field := newField(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelSysadmin}},
			Masking:      &model.Masking{Except: []model.Identity{{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser2.Id}}},
		})

		session := model.Session{UserId: th.BasicUser.Id}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, session, field, true)
		require.NotNil(t, shaped.Permissions.Masking)
		assert.Empty(t, shaped.Permissions.Masking.MaskByFieldID)
		assert.Empty(t, shaped.Permissions.Masking.Except)
		assert.True(t, shaped.Permissions.Filtered)
	})

	t.Run("an empty masking object withholds nothing and does not set filtered", func(t *testing.T) {
		field := newField(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelSysadmin}},
			Masking:      &model.Masking{},
		})

		session := model.Session{UserId: th.BasicUser.Id}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, session, field, true)
		require.NotNil(t, shaped.Permissions.Masking)
		assert.False(t, shaped.Permissions.Filtered)
	})

	newTemplate := func(permissions *model.Permissions) *model.PropertyField {
		tmpl, sErr := th.Store.PropertyField().Create(&model.PropertyField{
			GroupID:     groupID,
			Name:        celSafeName(),
			Type:        model.PropertyFieldTypeText,
			ObjectType:  model.PropertyFieldObjectTypeUser,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
			Permissions: permissions,
		})
		require.NoError(t, sErr)
		return tmpl
	}

	newLinkedField := func(templateID string) *model.PropertyField {
		field := newField(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelSysadmin}},
		})
		field.LinkedFieldID = model.NewPointer(templateID)
		return field
	}

	t.Run("a linked field reports its masked template as masked with contents withheld, even to an editor", func(t *testing.T) {
		template := newTemplate(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelSysadmin}},
			Masking:      &model.Masking{Except: []model.Identity{{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser2.Id}}},
		})
		field := newLinkedField(template.ID)

		adminSession := model.Session{UserId: th.SystemAdminUser.Id, Roles: model.SystemAdminRoleId}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, adminSession, field, true)
		require.NotNil(t, shaped.Permissions.Masking)
		assert.Empty(t, shaped.Permissions.Masking.MaskByFieldID)
		assert.Empty(t, shaped.Permissions.Masking.Except)
		assert.True(t, shaped.Permissions.Filtered)

		memberSession := model.Session{UserId: th.BasicUser.Id}
		shaped = th.App.ShapePropertyFieldForCaller(th.Context, memberSession, field, true)
		require.NotNil(t, shaped.Permissions.Masking)
		assert.True(t, shaped.Permissions.Filtered)
	})

	t.Run("a linked field whose template is not masked reports no masking", func(t *testing.T) {
		template := newTemplate(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelSysadmin}},
		})
		field := newLinkedField(template.ID)

		session := model.Session{UserId: th.BasicUser.Id}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, session, field, true)
		require.NotNil(t, shaped.Permissions)
		assert.Nil(t, shaped.Permissions.Masking)
		assert.False(t, shaped.Permissions.Filtered)
	})

	t.Run("a linked field whose template read fails is reported as masked with contents withheld", func(t *testing.T) {
		field := newLinkedField(model.NewId())

		session := model.Session{UserId: th.BasicUser.Id}
		shaped := th.App.ShapePropertyFieldForCaller(th.Context, session, field, true)
		require.NotNil(t, shaped.Permissions.Masking)
		assert.True(t, shaped.Permissions.Filtered)
	})

	t.Run("a batch reads a shared template's masking once for every field linked to it", func(t *testing.T) {
		template := newTemplate(&model.Permissions{
			Restrictions: &model.Restrictions{Field: model.WriteOnly{Write: model.PermissionLevelSysadmin}},
			Masking:      &model.Masking{Except: []model.Identity{{Type: model.PropertyOwnerTypeUser, ID: th.BasicUser2.Id}}},
		})
		fieldA := newLinkedField(template.ID)
		fieldB := newLinkedField(template.ID)

		session := model.Session{UserId: th.BasicUser.Id}
		shaped := th.App.ShapePropertyFieldsForCaller(th.Context, session, []*model.PropertyField{fieldA, fieldB}, true)
		require.Len(t, shaped, 2)
		for _, f := range shaped {
			require.NotNil(t, f.Permissions.Masking)
			assert.True(t, f.Permissions.Filtered)
		}
	})
}
