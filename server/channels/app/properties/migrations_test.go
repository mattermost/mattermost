// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// createLegacyPropertyField creates field through the service and then strips
// off the Permissions the create path now defaults onto every PSAv2/v3 field,
// leaving a legacy-shaped row for convertBatch/MigrateBackfillPropertyPermissions
// to convert. Routing the strip back through CreatePropertyField would just
// re-default it, so this writes the stripped field straight through the store
// instead; a nil expectedUpdateAts skips the optimistic-concurrency check, so
// this is a plain overwrite.
func createLegacyPropertyField(t *testing.T, th *TestHelper, rctx request.CTX, field *model.PropertyField) *model.PropertyField {
	t.Helper()
	created, err := th.service.CreatePropertyField(rctx, field)
	require.NoError(t, err)

	created.Permissions = nil
	_, err = th.service.fieldStore.Update(created.GroupID, []*model.PropertyField{created}, nil)
	require.NoError(t, err)

	return created
}

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

		acField := createLegacyPropertyField(t, th, rctxPlugin, &model.PropertyField{
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

		otherGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)
		adminLevel := model.PermissionLevelAdmin
		memberLevel := model.PermissionLevelMember
		// Straight to the store, not through the service: shared_only paired with
		// a member-writable permission_values is a combination the legacy
		// access-mode validator refuses, and that validator reaches this group
		// now. Rows in exactly that shape predate the validator and are what the
		// backfill exists to convert, so the fixture has to be able to hold one.
		// A direct write also leaves Permissions nil, so nothing needs stripping.
		otherField := th.CreatePropertyFieldDirect(t, &model.PropertyField{
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
			return createLegacyPropertyField(t, th, th.Context, &model.PropertyField{
				GroupID:       th.CPAGroupID,
				Name:          name,
				Type:          model.PropertyFieldTypeText,
				ObjectType:    model.PropertyFieldObjectTypeUser,
				TargetType:    string(model.PropertyFieldTargetLevelSystem),
				LinkedFieldID: &template.ID,
			})
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

		linked := createLegacyPropertyField(t, th, rctxPlugin, &model.PropertyField{
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

// TestMigrateBackfillPropertyPermissions_Paging covers the driver on top of
// convertBatch: paging across groups with no group filter, and idempotency on
// a second run.
func TestMigrateBackfillPropertyPermissions_Paging(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	otherGroup := th.RegisterPropertyGroup(t, model.PropertyGroupVersionV2)

	// Small enough that four fields need several pages, so a bug that only
	// walks the first page would still fail this test.
	orig := propertyPermissionsBackfillPageSize
	propertyPermissionsBackfillPageSize = 1
	t.Cleanup(func() { propertyPermissionsBackfillPageSize = orig })

	newField := func(groupID, name string) *model.PropertyField {
		return createLegacyPropertyField(t, th, th.Context, &model.PropertyField{
			GroupID:    groupID,
			Name:       name,
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})
	}

	fields := []*model.PropertyField{
		newField(th.CPAGroupID, "cpa-one"),
		newField(th.CPAGroupID, "cpa-two"),
		newField(otherGroup.ID, "other-one"),
		newField(otherGroup.ID, "other-two"),
	}

	converted, skipped, err := th.service.MigrateBackfillPropertyPermissions(th.Context)
	require.NoError(t, err)
	assert.Equal(t, len(fields), converted)
	assert.Equal(t, 0, skipped)

	for _, field := range fields {
		updated, getErr := th.service.GetPropertyField(th.Context, field.GroupID, field.ID)
		require.NoError(t, getErr)
		assert.NotNil(t, updated.Permissions)
	}

	// A re-run must find every field already converted rather than reverting
	// or reconverting it.
	converted, skipped, err = th.service.MigrateBackfillPropertyPermissions(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 0, converted)
	assert.Equal(t, len(fields), skipped)
}

// TestMigrateBackfillPropertyPermissions_OversizedOptions pins the same
// regression as TestOptionsOmitted_DisplayNameBackfill for this backfill: it
// writes every field it touches back to the store, so it is the one place a
// lost withheld-options marker would show up as deleted options.
func TestMigrateBackfillPropertyPermissions_OversizedOptions(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)

	field := createLegacyPropertyField(t, th, th.Context, &model.PropertyField{
		GroupID:    th.CPAGroupID,
		Name:       "oversized_select",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: oversizedOptions(false),
		},
	})
	// A field with no permissions object is refused at the hook, so read
	// through the store accessor the backfill itself uses to see what was
	// persisted, same as the check after MigrateBackfillPropertyPermissions.
	before, err := th.service.getPropertyField(th.Context, th.CPAGroupID, field.ID)
	require.NoError(t, err)
	requireOptionsWithheld(t, before)

	converted, skipped, err := th.service.MigrateBackfillPropertyPermissions(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 1, converted)
	assert.Equal(t, 0, skipped)

	// After conversion the field carries Permissions, so a hooked read
	// withholds options via HideOptions — a different reason than the one
	// under test. Read through the store accessor the backfill uses to see
	// what was persisted.
	updated, err := th.service.getPropertyField(th.Context, th.CPAGroupID, field.ID)
	require.NoError(t, err)
	assert.NotNil(t, updated.Permissions)
	requireOptionsWithheld(t, updated)
}

// TestMigrateBackfillPropertyPermissions_LinkedFieldInheritsTemplateMasking
// converts a template and a field linked to it in the same run, which writes
// both through one updatePropertyFields call for their shared group. That is
// the path where a linked field's own row could be stomped by whatever the
// store propagates from the template's row changing alongside it.
func TestMigrateBackfillPropertyPermissions_LinkedFieldInheritsTemplateMasking(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)

	th.service.setPluginCheckerForTests(func(pluginID string) bool { return pluginID == "test-plugin" })
	t.Cleanup(func() { th.service.setPluginCheckerForTests(nil) })
	rctxPlugin := RequestContextWithCallerID(th.Context, "test-plugin")

	template := createLegacyPropertyField(t, th, rctxPlugin, &model.PropertyField{
		GroupID:    th.CPAGroupID,
		Name:       "masked-template",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsAccessMode: model.PropertyAccessModeSharedOnly,
			model.PropertyAttrsProtected:  true,
		},
	})

	// Created straight through the store, bypassing the service: template has
	// already been stripped back to a legacy-shaped row with no Permissions,
	// which the create-time gate on a linked field can only read as "nothing
	// declared yet" -- not yet backfilled is not a state any caller's create
	// request can reach in production, since the startup backfill always runs
	// first, so there is nothing for the gate to authorize against here either.
	linked := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:       th.CPAGroupID,
		Name:          "linked-field",
		Type:          model.PropertyFieldTypeText,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &template.ID,
	})

	converted, skipped, err := th.service.MigrateBackfillPropertyPermissions(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 2, converted)
	assert.Equal(t, 0, skipped)

	updatedTemplate, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, template.ID)
	require.NoError(t, err)
	require.NotNil(t, updatedTemplate.Permissions)
	assert.NotNil(t, updatedTemplate.Permissions.Masking)

	updatedLinked, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, linked.ID)
	require.NoError(t, err)
	require.NotNil(t, updatedLinked.Permissions)
	assert.Nil(t, updatedLinked.Permissions.Masking)
}

func grantAllowFor(t *testing.T, p *model.Permissions, ownerType, ownerID string) []string {
	t.Helper()
	require.NotNil(t, p)
	for _, grant := range p.Grants {
		if grant.Type == ownerType && grant.ID == ownerID {
			return grant.Allow
		}
	}
	require.FailNowf(t, "missing grant", "no grant for %s %s", ownerType, ownerID)
	return nil
}

// TestMigrateBackfillPropertyPermissions_LinkedFieldDropsOptionReadGrant
// is the startup write: a linked field cannot grant read of the template's
// option scheme, and PropertyField.IsValid refuses the row if conversion
// leaves option.read on that grant. A model unit test would miss that write.
func TestMigrateBackfillPropertyPermissions_LinkedFieldDropsOptionReadGrant(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)

	const ownerID = "owner-user"
	owners := []model.PropertyOwner{{Type: model.PropertyOwnerTypeUser, ID: ownerID}}

	template := createLegacyPropertyField(t, th, th.Context, &model.PropertyField{
		GroupID:    th.CPAGroupID,
		Name:       "owned-template",
		Type:       model.PropertyFieldTypeSelect,
		ObjectType: model.PropertyFieldObjectTypeTemplate,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsOwners: owners,
		},
	})

	// The template is a stripped legacy-shaped row with no Permissions. The
	// create-time gate on a linked field reads that as nothing declared yet,
	// which no production create can reach — the startup backfill always
	// runs first — so there is nothing for the gate to authorize against.
	linked := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:       th.CPAGroupID,
		Name:          "owned-linked-field",
		Type:          model.PropertyFieldTypeText,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &template.ID,
		Attrs: model.StringInterface{
			model.PropertyAttrsOwners: owners,
		},
	})

	converted, skipped, err := th.service.MigrateBackfillPropertyPermissions(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 2, converted)
	assert.Equal(t, 0, skipped)

	updatedTemplate, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, template.ID)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{
		model.PropertyActionFieldWrite,
		model.PropertyActionOptionRead,
		model.PropertyActionOptionWrite,
		model.PropertyActionValueRead,
		model.PropertyActionValueWrite,
	}, grantAllowFor(t, updatedTemplate.Permissions, model.PropertyOwnerTypeUser, ownerID))

	updatedLinked, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, linked.ID)
	require.NoError(t, err)
	linkedAllow := grantAllowFor(t, updatedLinked.Permissions, model.PropertyOwnerTypeUser, ownerID)
	assert.NotContains(t, linkedAllow, model.PropertyActionOptionRead)
	assert.ElementsMatch(t, []string{
		model.PropertyActionFieldWrite,
		model.PropertyActionOptionWrite,
		model.PropertyActionValueRead,
		model.PropertyActionValueWrite,
	}, linkedAllow)
}
