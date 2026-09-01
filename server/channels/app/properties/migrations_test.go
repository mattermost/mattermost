// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// requireWarnLogged flushes th's logger and asserts buffer holds a warn entry
// whose message contains substr.
func requireWarnLogged(t *testing.T, th *TestHelper, buffer *mlog.Buffer, substr string) {
	t.Helper()
	logger, ok := th.Context.Logger().(*mlog.Logger)
	require.True(t, ok)
	require.NoError(t, logger.Flush())

	logOutput := buffer.String()
	found := false
	for _, e := range testlib.ParseLogEntries(t, strings.NewReader(logOutput)) {
		if strings.Contains(e.Msg, substr) {
			found = true
			break
		}
	}
	assert.True(t, found, "expected a warn log entry containing %q, got: %s", substr, logOutput)
}

func TestPermissionsBackfillConvertBatch(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	accessControlGroupID := th.CPAGroupID

	t.Run("a field already carrying Permissions is left alone", func(t *testing.T) {
		field, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "already-converted",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field:  model.WriteOnly{Write: model.PermissionLevelAdmin},
					Option: model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelAdmin},
					Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelMember},
				},
				Grants: []model.Grant{},
			},
		})
		require.NoError(t, err)
		before := field.Permissions

		b := newPermissionsBackfill(th.service, accessControlGroupID)
		converted, err := b.convertBatch(th.Context, []*model.PropertyField{field})
		require.NoError(t, err)
		assert.Empty(t, converted)
		assert.Equal(t, before, field.Permissions)
	})

	t.Run("access_control shared_only with a source plugin converts to masked; the same attrs elsewhere convert write levels only", func(t *testing.T) {
		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "test-plugin" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })
		rctxPlugin := RequestContextWithCallerID(th.Context, "test-plugin")

		acField, err := th.service.CreatePropertyField(rctxPlugin, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "masked-field",
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
			},
		})
		require.NoError(t, err)

		otherGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		adminLevel := model.PermissionLevelAdmin
		memberLevel := model.PermissionLevelMember
		otherField, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:           otherGroup.ID,
			Name:              "shared-only-elsewhere",
			Type:              model.PropertyFieldTypeSelect,
			ObjectType:        model.PropertyFieldObjectTypeUser,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &adminLevel,
			PermissionValues:  &memberLevel,
			PermissionOptions: &memberLevel,
			// Attrs were never enforced outside access_control, so the same
			// shared_only + protected + source plugin combination here must not
			// produce a masked object or narrow a read.
			Attrs: model.StringInterface{
				model.PropertyAttrsAccessMode:     model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:      true,
				model.PropertyAttrsSourcePluginID: "test-plugin",
			},
		})
		require.NoError(t, err)

		b := newPermissionsBackfill(th.service, accessControlGroupID)
		converted, err := b.convertBatch(th.Context, []*model.PropertyField{acField, otherField})
		require.NoError(t, err)
		require.Len(t, converted, 2)

		require.NotNil(t, acField.Permissions)
		require.NotNil(t, acField.Permissions.Masking)
		assert.Contains(t, acField.Permissions.Masking.Except, model.Identity{Type: model.PropertyOwnerTypePlugin, ID: "test-plugin"})

		require.NotNil(t, otherField.Permissions)
		assert.Nil(t, otherField.Permissions.Masking)
		assert.Equal(t, model.PermissionLevelEveryone, otherField.Permissions.Restrictions.Value.Read)
		assert.Equal(t, model.PermissionLevelEveryone, otherField.Permissions.Restrictions.Option.Read)
		assert.Equal(t, model.PermissionLevelAdmin, otherField.Permissions.Restrictions.Field.Write)
		assert.Equal(t, model.PermissionLevelMember, otherField.Permissions.Restrictions.Value.Write)
		assert.Equal(t, model.PermissionLevelMember, otherField.Permissions.Restrictions.Option.Write)
		assert.Empty(t, otherField.Permissions.Grants)
	})

	t.Run("two fields linked to one template read that template once", func(t *testing.T) {
		template, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "shared-template",
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(t, err)

		newLinked := func(name string) *model.PropertyField {
			created, linkErr := th.service.CreatePropertyField(th.Context, &model.PropertyField{
				GroupID:       th.CPAGroupID,
				Name:          name,
				Type:          model.PropertyFieldTypeText,
				ObjectType:    model.PropertyFieldObjectTypeUser,
				TargetType:    string(model.PropertyFieldTargetLevelSystem),
				LinkedFieldID: &template.ID,
			})
			require.NoError(t, linkErr)
			return created
		}
		linked1 := newLinked("linked-1")
		linked2 := newLinked("linked-2")

		counter := &countingPropertyFieldStore{PropertyFieldStore: th.service.fieldStore}
		th.service.fieldStore = counter
		t.Cleanup(func() { th.service.fieldStore = counter.PropertyFieldStore })

		b := newPermissionsBackfill(th.service, accessControlGroupID)
		converted, err := b.convertBatch(th.Context, []*model.PropertyField{linked1, linked2})
		require.NoError(t, err)
		assert.Len(t, converted, 2)
		assert.Equal(t, 1, counter.gets)
	})

	t.Run("a linked field whose template is unmasked but which is itself shared_only closes read access, with one warn line", func(t *testing.T) {
		template, err := th.service.CreatePropertyField(th.Context, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "unmasked-template",
			Type:       model.PropertyFieldTypeSelect,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
		require.NoError(t, err)

		th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "test-plugin" })
		t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })
		rctxPlugin := RequestContextWithCallerID(th.Context, "test-plugin")

		linked, err := th.service.CreatePropertyField(rctxPlugin, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "linked-shared-only",
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
			Attrs: model.StringInterface{
				// The template is unprotected, so validateAndInheritLinkedFieldSecurity
				// leaves these alone rather than overwriting them from the template.
				model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
				model.PropertyAttrsProtected:  true,
			},
		})
		require.NoError(t, err)

		buffer := captureMaskingFailureLog(t, th)

		b := newPermissionsBackfill(th.service, accessControlGroupID)
		converted, err := b.convertBatch(th.Context, []*model.PropertyField{linked})
		require.NoError(t, err)
		require.Len(t, converted, 1)

		require.NotNil(t, linked.Permissions)
		assert.Nil(t, linked.Permissions.Masking)
		assert.Equal(t, model.PermissionLevelNone, linked.Permissions.Restrictions.Value.Read)
		assert.Equal(t, model.PermissionLevelNone, linked.Permissions.Restrictions.Option.Read)

		requireWarnLogged(t, th, buffer, "shared_only access mode to no read access")
	})
}
