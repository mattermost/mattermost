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

	// field.write is set because a template nobody may write is protected,
	// and linking to one is gated however open its reads are.
	openReads := &model.Permissions{
		Restrictions: &model.Restrictions{
			Field:  model.WriteOnly{Write: model.PermissionLevelSysadmin},
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

// TestLinkedFieldSyncLock covers where the ldap/saml sync lock lands when a
// field links to a synced template: on linked user fields only, never on the
// template itself or on a linked field of another object type.
func TestLinkedFieldSyncLock(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setLadderCheckerForTests(func(_ request.CTX, _ string, field *model.PropertyField, action, _ string) bool {
		if field.Permissions == nil {
			return false
		}
		return model.PermissionLevelSysadmin.AtMostAsPermissiveAs(field.Permissions.Restrictions.TierFor(action))
	})
	t.Cleanup(func() { th.service.setLadderCheckerForTests(nil) })
	rctxAdmin := RequestContextWithCallerID(th.Context, model.NewId())

	sysadmin := model.PermissionLevelSysadmin
	member := model.PermissionLevelMember
	wildcardPlugin := func(p *model.Permissions) *model.Grant {
		for i := range p.Grants {
			if p.Grants[i].Identity == (model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "*"}) {
				return &p.Grants[i]
			}
		}
		return nil
	}

	for _, syncAttr := range []string{model.PropertyFieldAttrLDAP, model.PropertyFieldAttrSAML} {
		t.Run(syncAttr, func(t *testing.T) {
			template, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
				GroupID:           th.CPAGroupID,
				Name:              "Synced-Template-" + model.NewId(),
				Type:              model.PropertyFieldTypeText,
				ObjectType:        model.PropertyFieldObjectTypeTemplate,
				TargetType:        string(model.PropertyFieldTargetLevelSystem),
				PermissionField:   &sysadmin,
				PermissionOptions: &sysadmin,
				PermissionValues:  &sysadmin,
				Attrs:             model.StringInterface{syncAttr: "mappedAttr"},
			})
			require.NoError(t, err)

			newLinked := func(t *testing.T, objectType string, pin *model.PermissionLevel) *model.PropertyField {
				t.Helper()
				linked, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
					GroupID:          th.CPAGroupID,
					Name:             "Linked-" + model.NewId(),
					Type:             model.PropertyFieldTypeText,
					ObjectType:       objectType,
					TargetType:       string(model.PropertyFieldTargetLevelSystem),
					LinkedFieldID:    &template.ID,
					PermissionValues: pin,
				})
				require.NoError(t, err)
				require.NotNil(t, linked.Permissions)
				return linked
			}

			t.Run("the template's own permissions and projected columns carry its real levels", func(t *testing.T) {
				stored, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, template.ID)
				require.NoError(t, err)
				assert.Equal(t, model.PermissionLevelSysadmin, stored.Permissions.Restrictions.Value.Write)
				assert.Nil(t, stored.Permissions.MatchingGrant(model.PropertyOwnerTypeService, syncAttr, "", model.PropertyActionValueWrite))
				require.NotNil(t, wildcardPlugin(stored.Permissions))
				assert.Contains(t, wildcardPlugin(stored.Permissions).Allow, model.PropertyActionValueWrite)
				assert.Equal(t, model.PermissionLevelSysadmin, *model.ProjectLegacyPermissions(stored).PermissionValues)
			})

			for _, tc := range []struct {
				name      string
				pin       *model.PermissionLevel
				wantWrite model.PermissionLevel
			}{
				{"a linked channel field without a pin takes the template's level and no lock", nil, model.PermissionLevelSysadmin},
				{"a linked channel field with a pin takes the pin and no lock", &member, model.PermissionLevelMember},
			} {
				t.Run(tc.name, func(t *testing.T) {
					linked := newLinked(t, model.PropertyFieldObjectTypeChannel, tc.pin)
					assert.Equal(t, tc.wantWrite, linked.Permissions.Restrictions.Value.Write)
					assert.Nil(t, linked.Permissions.MatchingGrant(model.PropertyOwnerTypeService, syncAttr, "", model.PropertyActionValueWrite))
					require.NotNil(t, wildcardPlugin(linked.Permissions))
					assert.Contains(t, wildcardPlugin(linked.Permissions).Allow, model.PropertyActionValueWrite)
				})
			}

			for _, tc := range []struct {
				name string
				pin  *model.PermissionLevel
			}{
				{"a linked user field without a pin keeps the lock", nil},
				{"a linked user field with a pin keeps the lock", &member},
			} {
				t.Run(tc.name, func(t *testing.T) {
					linked := newLinked(t, model.PropertyFieldObjectTypeUser, tc.pin)
					assert.Equal(t, model.PermissionLevelNone, linked.Permissions.Restrictions.Value.Write)
					syncGrant := linked.Permissions.MatchingGrant(model.PropertyOwnerTypeService, syncAttr, "", model.PropertyActionValueWrite)
					require.NotNil(t, syncGrant)
					assert.Equal(t, []string{model.PropertyActionFieldWrite, model.PropertyActionValueWrite}, syncGrant.Allow)
					if wildcard := wildcardPlugin(linked.Permissions); wildcard != nil {
						assert.NotContains(t, wildcard.Allow, model.PropertyActionValueWrite)
					}
				})
			}

			t.Run("an owners patch on a linked channel field round-trips", func(t *testing.T) {
				linked := newLinked(t, model.PropertyFieldObjectTypeChannel, nil)
				newOwner := model.NewId()
				submitted := model.ProjectLegacyPermissions(linked)
				submitted.Attrs[model.PropertyAttrsOwners] = append(model.GetPropertyFieldOwners(submitted),
					model.PropertyOwner{Type: model.PropertyOwnerTypeUser, ID: newOwner})
				updated, _, err := th.service.UpdatePropertyField(rctxAdmin, th.CPAGroupID, submitted)
				require.NoError(t, err)
				assert.NotNil(t, updated.Permissions.MatchingGrant(model.PropertyOwnerTypeUser, newOwner, "", model.PropertyActionValueWrite))
			})
		})
	}
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

	retrieved, getErr := th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, allowedReaderID), group.ID, value.ID)
	require.NoError(t, getErr)
	require.NotNil(t, retrieved)

	retrieved, getErr = th.service.GetPropertyValue(RequestContextWithCallerID(th.Context, model.NewId()), group.ID, value.ID)
	require.NoError(t, getErr)
	assert.Nil(t, retrieved)

	_, upErr := th.service.UpsertPropertyValue(RequestContextWithCallerID(th.Context, "other-plugin"), &model.PropertyValue{
		GroupID:    group.ID,
		FieldID:    created.ID,
		TargetType: "user",
		TargetID:   model.NewId(),
		Value:      json.RawMessage(`"v2"`),
	})
	require.Error(t, upErr)
	assert.ErrorIs(t, upErr, ErrAccessDenied)

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

		_, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, model.NewId()), unregisteredGroupID, field.ID)
		require.Error(t, err)

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

// TestAccessControlHookWideningPreservesExistingBehavior covers two shapes
// that must still hold once the hook gates every PSAv2/v3 group: a field
// converted from a nil PermissionValues (value.write: none, no grants) is
// still refused a value write, and a linked create outside access_control
// still inherits its template's security from
// validateAndInheritLinkedFieldSecurity.
func TestAccessControlHookWideningPreservesExistingBehavior(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	t.Cleanup(func() { th.service.setLadderCheckerForTests(nil) })

	t.Run("a field converted with no permission grant refuses a value write from anyone", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "boards-plugin" })
		group := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)

		// Restrictions and Grants are both left unset, the shape a builtin
		// field's nil PermissionValues converts into: value.write resolves to
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
