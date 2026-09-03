// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
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

// TestAccessControlHookEnforcesEveryPSAv2Group covers the hook widening from
// one construction-time group ID to every PSAv2/v3 group: the same read
// filter, write refusal and grant admission the access_control tests assert
// hold for a group the hook was never constructed with, such as boards.
func TestAccessControlHookEnforcesEveryPSAv2Group(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	t.Cleanup(func() { th.service.setLadderCheckerForTests(nil) })
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "creator-plugin" || pluginID == "other-plugin"
	})

	group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)

	allowedReaderID := model.NewId()
	th.service.setLadderCheckerForTests(func(_ request.CTX, userID string, _ *model.PropertyField, action, _ string) bool {
		return userID == allowedReaderID && action == model.PropertyActionValueRead
	})

	created, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "NonCPAField-" + model.NewId(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Permissions: &model.Permissions{
			Grants: []model.Grant{
				{Identity: model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "creator-plugin"}, Allow: []string{model.PropertyActionValueWrite}},
			},
		},
	})
	require.NoError(t, err)

	value, err := th.service.CreatePropertyValue(RequestContextWithCallerID(th.Context, "creator-plugin"), &model.PropertyValue{
		GroupID:    group.ID,
		FieldID:    created.ID,
		TargetType: "user",
		TargetID:   model.NewId(),
		Value:      json.RawMessage(`"v"`),
	})
	require.NoError(t, err)

	// A read is filtered by the field's permissions, same as access_control.
	retrieved, getErr := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, allowedReaderID), group.ID, value.ID)
	require.NoError(t, getErr)
	require.NotNil(t, retrieved)

	retrieved, getErr = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, model.NewId()), group.ID, value.ID)
	require.NoError(t, getErr)
	assert.Nil(t, retrieved)

	// A value write by a caller the field refuses is refused.
	_, upErr := th.service.UpsertPropertyValue(RequestContextWithCallerID(th.Context, "other-plugin"), &model.PropertyValue{
		GroupID:    group.ID,
		FieldID:    created.ID,
		TargetType: "user",
		TargetID:   model.NewId(),
		Value:      json.RawMessage(`"v2"`),
	})
	require.Error(t, upErr)
	assert.ErrorIs(t, upErr, ErrAccessDenied)

	// A caller a grant names is allowed.
	_, upErr = th.service.UpsertPropertyValue(RequestContextWithCallerID(th.Context, "creator-plugin"), &model.PropertyValue{
		GroupID:    group.ID,
		FieldID:    created.ID,
		TargetType: "user",
		TargetID:   model.NewId(),
		Value:      json.RawMessage(`"v3"`),
	})
	require.NoError(t, upErr)
}

// TestAccessControlHookGroupVersionGating covers the two ways narrowing the
// gate to a group-version test can go wrong silently: a v1 group must still
// pass through unenforced (the hook has nothing to decide on -- a PSAv1
// field can never carry a permissions object), and a group ID that fails to
// resolve must be refused rather than treated as unenforced, since it is a
// lookup failure, not evidence the group is PSAv1.
func TestAccessControlHookGroupVersionGating(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)

	t.Run("a v1 group passes through unenforced", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV1)

		// Bypasses CreatePropertyField's group/field version-match check, which
		// would otherwise refuse pairing a PSAv2-shaped field (non-empty
		// ObjectType, needed to carry Permissions at all) with a v1 group. The
		// resulting row is exactly the shape this case exists to guard: a
		// permissions object the hook must never reach because its group is v1.
		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "V1PassThrough-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Read: model.PermissionLevelSysadmin, Write: model.PermissionLevelSysadmin},
				},
			},
		})

		value := th.CreatePropertyValue(t, th.Context, &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		})

		// A read the permissions object would refuse to anyone but a sysadmin is
		// unfiltered.
		retrieved, err := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, model.NewId()), group.ID, value.ID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		// A write the permissions object would refuse the same way still succeeds.
		_, upErr := th.service.UpsertPropertyValue(RequestContextWithCallerID(th.Context, model.NewId()), &model.PropertyValue{
			GroupID:    group.ID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v2"`),
		})
		require.NoError(t, upErr)
	})

	t.Run("a group ID that resolves to nothing is refused, not passed through", func(t *testing.T) {
		unregisteredGroupID := model.NewId()

		field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    unregisteredGroupID,
			Name:       "UnknownGroup-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value: model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelEveryone},
				},
			},
		})

		// One read gate.
		_, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, model.NewId()), unregisteredGroupID, field.ID)
		require.Error(t, err)

		// One write gate.
		_, err = th.service.UpsertPropertyValue(RequestContextWithCallerID(th.Context, model.NewId()), &model.PropertyValue{
			GroupID:    unregisteredGroupID,
			FieldID:    field.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		})
		require.Error(t, err)
	})
}

// TestAccessControlHookWideningPreservesExistingBehavior covers the two ways
// widening the gate could be mistaken for a regression: a field that was
// already refused by api4 before this step (a nil legacy PermissionValues,
// converted to value.write: none) must still be refused now that the hook
// gates it too, and a linked create outside access_control must still
// inherit its template's security now that 7.16's inheritance function is
// the only one left running for it.
func TestAccessControlHookWideningPreservesExistingBehavior(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	t.Cleanup(func() { th.service.setLadderCheckerForTests(nil) })

	t.Run("a field converted with no permission grant refuses a value write from anyone", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "boards-plugin" })
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)

		// Restrictions and Grants are both left unset, the shape 7.2 converts a
		// builtin field's nil PermissionValues into: value.write resolves to
		// none for a human (TierFor on a nil Restrictions) and matches no grant
		// for a machine caller.
		created, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:     group.ID,
			Name:        "BoardsLikeAssignee-" + model.NewId(),
			Type:        model.PropertyFieldTypeText,
			ObjectType:  model.PropertyFieldObjectTypeUser,
			TargetType:  string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{},
		})
		require.NoError(t, err)

		newValue := func() *model.PropertyValue {
			return &model.PropertyValue{
				GroupID:    created.GroupID,
				FieldID:    created.ID,
				TargetType: "user",
				TargetID:   model.NewId(),
				Value:      json.RawMessage(`"v"`),
			}
		}

		_, upErr := th.service.UpsertPropertyValue(RequestContextWithCallerID(th.Context, "boards-plugin"), newValue())
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)

		_, upErr = th.service.UpsertPropertyValue(RequestContextWithCallerID(th.Context, model.NewId()), newValue())
		require.Error(t, upErr)
		assert.ErrorIs(t, upErr, ErrAccessDenied)
	})

	t.Run("a linked create outside access_control inherits its template's restrictions", func(t *testing.T) {
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)

		template, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    group.ID,
			Name:       "Template-" + model.NewId(),
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelAdmin},
					Option: model.ReadWrite{Read: model.PermissionLevelEveryone},
					Field:  model.WriteOnly{Write: model.PermissionLevelAdmin},
				},
			},
		})
		require.NoError(t, err)

		linked, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:       group.ID,
			Name:          "Linked-" + model.NewId(),
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
		})
		require.NoError(t, err)
		require.NotNil(t, linked.Permissions)
		require.NotNil(t, linked.Permissions.Restrictions)
		assert.Equal(t, *template.Permissions.Restrictions, *linked.Permissions.Restrictions)
	})
}
