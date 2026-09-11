// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDeepCopyAttrs(t *testing.T) {
	t.Run("nil attrs returns an empty, non-nil map", func(t *testing.T) {
		clone, err := deepCopyAttrs(nil)
		require.NoError(t, err)
		require.NotNil(t, clone)
		require.Empty(t, clone)
	})

	t.Run("mutating the original's nested options does not affect the clone, and vice versa", func(t *testing.T) {
		original := model.StringInterface{
			"options": []any{
				map[string]any{"id": "opt1", "name": "Option One"},
			},
		}

		clone, err := deepCopyAttrs(original)
		require.NoError(t, err)

		// Mutate the original's nested option in place.
		originalOptions := original["options"].([]any)
		originalOptions[0].(map[string]any)["name"] = "Mutated"

		cloneOptions := clone["options"].([]any)
		assert.Equal(t, "Option One", cloneOptions[0].(map[string]any)["name"],
			"clone must not observe a mutation made to the original's nested option map")

		// Mutate the clone's nested option in place.
		cloneOptions[0].(map[string]any)["name"] = "ClonedMutation"
		assert.Equal(t, "Mutated", originalOptions[0].(map[string]any)["name"],
			"original must not observe a mutation made to the clone's nested option map")
	})
}

func TestIsEligibleForGlobalAttributesMigration(t *testing.T) {
	linkedID := model.NewId()

	tests := []struct {
		name     string
		field    *model.PropertyField
		eligible bool
	}{
		{
			name:     "plain CPA field with no attrs is eligible",
			field:    &model.PropertyField{},
			eligible: true,
		},
		{
			name:     "already-linked field is not eligible",
			field:    &model.PropertyField{LinkedFieldID: &linkedID},
			eligible: false,
		},
		{
			name:     "empty-string LinkedFieldID is still eligible",
			field:    &model.PropertyField{LinkedFieldID: model.NewPointer("")},
			eligible: true,
		},
		{
			name: "plugin-managed field (source_plugin_id set) is not eligible",
			field: &model.PropertyField{
				Attrs: model.StringInterface{model.PropertyAttrsSourcePluginID: "com.mattermost.some-plugin"},
			},
			eligible: false,
		},
		{
			name: "protected field is not eligible",
			field: &model.PropertyField{
				Attrs: model.StringInterface{model.PropertyAttrsProtected: true},
			},
			eligible: false,
		},
		{
			name: "field with a non-empty owners list is not eligible",
			field: &model.PropertyField{
				Attrs: model.StringInterface{
					model.PropertyAttrsOwners: []model.PropertyOwner{{ID: "svc1", Type: model.PropertyOwnerTypeService}},
				},
			},
			eligible: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.eligible, isEligibleForGlobalAttributesMigration(tc.field))
		})
	}
}

// setupMigrationTestHelper registers the CPA group with the same hooks
// production wires up for it, so the migration exercises the same write
// path it does at runtime.
func setupMigrationTestHelper(tb testing.TB) *TestHelper {
	th := Setup(tb).RegisterCPAPropertyGroup(tb)

	permChecker := func(_ request.CTX, userID string, _ *model.Permission) bool {
		return userID == model.CallerIDLocalAdmin
	}
	th.service.AddHook(NewAccessControlAttributeValidationHook(th.service, permChecker, th.CPAGroupID))

	fieldLimitHook := NewFieldLimitHook(th.service)
	fieldLimitHook.AddGroupLimit(th.CPAGroupID, &FieldLimitConfig{
		PerObjectType: map[string]int64{model.PropertyFieldObjectTypeUser: 20},
		GlobalLimit:   model.AccessControlGroupFieldLimit,
	})
	th.service.AddHook(fieldLimitHook)

	return th
}

func seedCPAField(tb testing.TB, th *TestHelper, name string, attrs model.StringInterface) *model.PropertyField {
	tb.Helper()
	return th.CreatePropertyFieldDirect(tb, &model.PropertyField{
		GroupID:    th.CPAGroupID,
		Name:       name,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      attrs,
	})
}

func templateByName(tb testing.TB, th *TestHelper, name string) *model.PropertyField {
	tb.Helper()
	field, err := th.service.getPropertyFieldByNameForObjectType(th.Context, th.CPAGroupID, "", model.PropertyFieldObjectTypeTemplate, name)
	require.NoError(tb, err)
	return field
}

func TestMigrateCPAFieldsToGlobalAttributes_MigratesEligibleField(t *testing.T) {
	th := setupMigrationTestHelper(t)

	seeded := seedCPAField(t, th, "department", model.StringInterface{
		model.PropertyFieldAttrLDAP: "dept",
	})

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 1, migrated)
	assert.Equal(t, 0, skipped)
	assert.Equal(t, 0, retryable)

	template := templateByName(t, th, "department")
	assert.Equal(t, model.PropertyFieldObjectTypeTemplate, template.ObjectType)
	assert.Equal(t, true, template.Attrs[model.PropertyAttrsMigratedToGlobal])
	assert.Equal(t, "dept", template.Attrs[model.PropertyFieldAttrLDAP])

	updatedField, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
	require.NoError(t, err)
	require.NotNil(t, updatedField.LinkedFieldID)
	assert.Equal(t, template.ID, *updatedField.LinkedFieldID)
}

func TestMigrateCPAFieldsToGlobalAttributes_SkipsIneligibleFields(t *testing.T) {
	t.Run("plugin-managed field is left unlinked", func(t *testing.T) {
		th := setupMigrationTestHelper(t)
		seedCPAField(t, th, "plugin_field", model.StringInterface{
			model.PropertyAttrsSourcePluginID: "com.mattermost.some-plugin",
		})

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 0, migrated)
		assert.Equal(t, 1, skipped)
		assert.Equal(t, 0, retryable)

		_, lookupErr := th.service.getPropertyFieldByNameForObjectType(th.Context, th.CPAGroupID, "", model.PropertyFieldObjectTypeTemplate, "plugin_field")
		assert.Error(t, lookupErr, "no template should have been created for a plugin-managed field")
	})

	t.Run("protected field is left unlinked", func(t *testing.T) {
		th := setupMigrationTestHelper(t)
		seedCPAField(t, th, "protected_field", model.StringInterface{
			model.PropertyAttrsProtected: true,
		})

		migrated, skipped, _, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 0, migrated)
		assert.Equal(t, 1, skipped)
	})

	t.Run("field with owners is left unlinked", func(t *testing.T) {
		th := setupMigrationTestHelper(t)
		seedCPAField(t, th, "owned_field", model.StringInterface{
			model.PropertyAttrsOwners: []model.PropertyOwner{{ID: "svc1", Type: model.PropertyOwnerTypeService}},
		})

		migrated, skipped, _, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 0, migrated)
		assert.Equal(t, 1, skipped)
	})

	t.Run("already-linked field is left untouched", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		sysadmin := model.PermissionLevelSysadmin
		template := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:           th.CPAGroupID,
			Name:              "already_linked",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &sysadmin,
			PermissionValues:  &sysadmin,
			PermissionOptions: &sysadmin,
		})

		linked := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:       th.CPAGroupID,
			Name:          "already_linked",
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeUser,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
		})

		migrated, skipped, _, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 0, migrated)
		assert.Equal(t, 1, skipped, "an already-linked field is fetched by the broad search but rejected by the eligibility filter")

		unchanged, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, linked.ID)
		require.NoError(t, err)
		require.NotNil(t, unchanged.LinkedFieldID)
		assert.Equal(t, template.ID, *unchanged.LinkedFieldID)
	})
}

func TestMigrateCPAFieldsToGlobalAttributes_Idempotent(t *testing.T) {
	th := setupMigrationTestHelper(t)
	seedCPAField(t, th, "location", nil)

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	require.Equal(t, 1, migrated)
	require.Equal(t, 0, skipped)
	require.Equal(t, 0, retryable)

	templateAfterFirst := templateByName(t, th, "location")

	// Second run: the field is now linked, so the eligibility filter rejects
	// it (counted as a permanent skip) — nothing about the data should change.
	migrated, skipped, retryable, err = th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 0, migrated)
	assert.Equal(t, 1, skipped)
	assert.Equal(t, 0, retryable)

	templateAfterSecond := templateByName(t, th, "location")
	assert.Equal(t, templateAfterFirst.ID, templateAfterSecond.ID)
	assert.Equal(t, templateAfterFirst.UpdateAt, templateAfterSecond.UpdateAt,
		"second run must not re-write the template")
}

func TestMigrateCPAFieldsToGlobalAttributes_OrphanTemplateReuse(t *testing.T) {
	th := setupMigrationTestHelper(t)

	sysadmin := model.PermissionLevelSysadmin
	orphan := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:           th.CPAGroupID,
		Name:              "recovered",
		Type:              model.PropertyFieldTypeText,
		ObjectType:        model.PropertyFieldObjectTypeTemplate,
		TargetType:        string(model.PropertyFieldTargetLevelSystem),
		PermissionField:   &sysadmin,
		PermissionValues:  &sysadmin,
		PermissionOptions: &sysadmin,
		Attrs: model.StringInterface{
			model.PropertyAttrsMigratedToGlobal: true,
		},
	})

	seeded := seedCPAField(t, th, "recovered", nil)

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 1, migrated)
	assert.Equal(t, 0, skipped)
	assert.Equal(t, 0, retryable)

	updated, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
	require.NoError(t, err)
	require.NotNil(t, updated.LinkedFieldID)
	assert.Equal(t, orphan.ID, *updated.LinkedFieldID, "must reuse the marker-tagged orphan template rather than creating a new one")
}

func TestMigrateCPAFieldsToGlobalAttributes_NameCollisionWithoutMarker(t *testing.T) {
	t.Run("generic unrelated template name collision is resolved via a _copy suffix", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		sysadmin := model.PermissionLevelSysadmin
		unrelated := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:           th.CPAGroupID,
			Name:              "department",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &sysadmin,
			PermissionValues:  &sysadmin,
			PermissionOptions: &sysadmin,
			Attrs: model.StringInterface{
				model.PropertyFieldAttrDisplayName: "Department",
			},
			// No PropertyAttrsMigratedToGlobal marker: an admin-created template.
		})

		seeded := seedCPAField(t, th, "department", model.StringInterface{
			model.PropertyFieldAttrDisplayName: "Department",
		})

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 1, migrated)
		assert.Equal(t, 0, skipped)
		assert.Equal(t, 0, retryable)

		updated, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
		require.NoError(t, err)
		require.NotNil(t, updated.LinkedFieldID)

		copyTemplate := templateByName(t, th, "department_copy")
		assert.Equal(t, *updated.LinkedFieldID, copyTemplate.ID, "field must be linked to the disambiguated _copy template")
		assert.Equal(t, "Department (copy)", copyTemplate.Attrs[model.PropertyFieldAttrDisplayName])
		assert.Equal(t, true, copyTemplate.Attrs[model.PropertyAttrsMigratedToGlobal], "the _copy template must still carry the marker for future-run idempotency")

		stillNoDependents, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, unrelated.ID)
		require.NoError(t, err)
		assert.Nil(t, stillNoDependents.LinkedFieldID, "the unrelated template itself must be left untouched")
	})

	t.Run("a collision on the _copy name too falls back to a permanent skip", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		sysadmin := model.PermissionLevelSysadmin
		for _, name := range []string{"department", "department_copy"} {
			th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:           th.CPAGroupID,
				Name:              name,
				Type:              model.PropertyFieldTypeText,
				ObjectType:        model.PropertyFieldObjectTypeTemplate,
				TargetType:        string(model.PropertyFieldTargetLevelSystem),
				PermissionField:   &sysadmin,
				PermissionValues:  &sysadmin,
				PermissionOptions: &sysadmin,
				// Neither carries the marker: both are unrelated, admin-created templates.
			})
		}

		seeded := seedCPAField(t, th, "department", nil)

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 0, migrated)
		assert.Equal(t, 1, skipped, "no _copy_copy attempt: a second collision is a permanent skip")
		assert.Equal(t, 0, retryable)

		untouched, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
		require.NoError(t, err)
		assert.Nil(t, untouched.LinkedFieldID)
	})

	t.Run("a marker-tagged _copy template from a crashed prior run is reused, not recreated", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		sysadmin := model.PermissionLevelSysadmin
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:           th.CPAGroupID,
			Name:              "department",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &sysadmin,
			PermissionValues:  &sysadmin,
			PermissionOptions: &sysadmin,
			// Unrelated, unmarked -- the original collision that forced a _copy on a prior run.
		})
		orphanCopy := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:           th.CPAGroupID,
			Name:              "department_copy",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &sysadmin,
			PermissionValues:  &sysadmin,
			PermissionOptions: &sysadmin,
			Attrs: model.StringInterface{
				// A prior run created this and marked it, then crashed before linking.
				model.PropertyAttrsMigratedToGlobal: true,
			},
		})

		seeded := seedCPAField(t, th, "department", nil)

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 1, migrated)
		assert.Equal(t, 0, skipped)
		assert.Equal(t, 0, retryable)

		updated, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
		require.NoError(t, err)
		require.NotNil(t, updated.LinkedFieldID)
		assert.Equal(t, orphanCopy.ID, *updated.LinkedFieldID, "must reuse the existing marked _copy template rather than creating another one")
	})

	t.Run("Classification Markings' own template is never retried under a _copy name", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		sysadmin := model.PermissionLevelSysadmin
		classification := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:           th.CPAGroupID,
			Name:              "classification",
			Type:              model.PropertyFieldTypeRank,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &sysadmin,
			PermissionValues:  &sysadmin,
			PermissionOptions: &sysadmin,
			// Real shape: Classification Markings' template has no
			// PropertyAttrsMigratedToGlobal marker, since it isn't created by
			// this migration.
		})

		// Same Type (Rank, matching Classification's real template type) as the
		// template above -- isolates the marker check as the reason this field
		// is skipped, rather than the unrelated type-mismatch gate.
		seeded := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "classification",
			Type:       model.PropertyFieldTypeRank,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 0, migrated)
		assert.Equal(t, 1, skipped)
		assert.Equal(t, 0, retryable)

		untouched, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
		require.NoError(t, err)
		assert.Nil(t, untouched.LinkedFieldID)

		unchangedClassification, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, classification.ID)
		require.NoError(t, err)
		assert.Equal(t, classification.UpdateAt, unchangedClassification.UpdateAt,
			"Classification Markings' own template must not be written to")

		_, lookupErr := th.service.getPropertyFieldByNameForObjectType(th.Context, th.CPAGroupID, "", model.PropertyFieldObjectTypeTemplate, "classification_copy")
		assert.Error(t, lookupErr, "reserved names must never be retried under a _copy suffix")
	})

	t.Run("a _copy suffix that pushes display_name over the length limit is a permanent skip, not an error", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		sysadmin := model.PermissionLevelSysadmin
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:           th.CPAGroupID,
			Name:              "department",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &sysadmin,
			PermissionValues:  &sysadmin,
			PermissionOptions: &sysadmin,
		})

		maxLengthDisplayName := strings.Repeat("a", model.PropertyFieldNameMaxRunes)
		seeded := seedCPAField(t, th, "department", model.StringInterface{
			model.PropertyFieldAttrDisplayName: maxLengthDisplayName,
		})

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 0, migrated)
		assert.Equal(t, 1, skipped, "display_name exceeding the length limit after ' (copy)' is appended must be a permanent skip")
		assert.Equal(t, 0, retryable)

		untouched, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
		require.NoError(t, err)
		assert.Nil(t, untouched.LinkedFieldID)
	})
}

func TestMigrateCPAFieldsToGlobalAttributes_FieldLimitReached(t *testing.T) {
	th := setupMigrationTestHelper(t)

	// Fill the group up to the global field limit with template fields (an
	// object type not subject to the per-object-type "user" cap), then add one
	// eligible CPA field that would push the group over the limit.
	sysadmin := model.PermissionLevelSysadmin
	for i := int64(0); i < model.AccessControlGroupFieldLimit; i++ {
		th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:           th.CPAGroupID,
			Name:              "filler_" + model.NewId(),
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &sysadmin,
			PermissionValues:  &sysadmin,
			PermissionOptions: &sysadmin,
		})
	}

	seeded := seedCPAField(t, th, "over_the_limit", nil)

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 0, migrated)
	assert.Equal(t, 1, skipped)
	assert.Equal(t, 0, retryable, "a field-limit skip is permanent, not retryable")

	untouched, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
	require.NoError(t, err)
	assert.Nil(t, untouched.LinkedFieldID)
}

func TestMigrateCPAFieldsToGlobalAttributes_ManagedAdminField(t *testing.T) {
	// Regression test for the model.CallerIDLocalAdmin context requirement:
	// without it, AccessControlAttributeValidationHook.enforceGroupPermissions
	// deterministically rejects creating a template that copies a
	// managed=admin field's attrs with ErrAdminRequired, and this field would
	// never succeed on any retry.
	th := setupMigrationTestHelper(t)

	seedCPAField(t, th, "admin_managed", model.StringInterface{
		model.PropertyFieldAttrManaged: "admin",
	})

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 1, migrated, "managed=admin field must migrate successfully, not be rejected with ErrAdminRequired")
	assert.Equal(t, 0, skipped)
	assert.Equal(t, 0, retryable)

	template := templateByName(t, th, "admin_managed")
	assert.Equal(t, "admin", template.Attrs[model.PropertyFieldAttrManaged])
}

func TestMigrateCPAFieldsToGlobalAttributes_DeterministicValidationFailureIsPermanentlySkipped(t *testing.T) {
	// A legacy CPA field whose Name predates the CEL-safe-identifier rule
	// (e.g. containing a space) deterministically fails this migration's
	// template create on every restart and must be a permanent skip, not
	// retried forever.
	th := setupMigrationTestHelper(t)

	seedCPAField(t, th, "Job Title", nil)

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 0, migrated)
	assert.Equal(t, 1, skipped, "a deterministic name-validation rejection must be a permanent skip, not retryable")
	assert.Equal(t, 0, retryable)

	_, lookupErr := th.service.getPropertyFieldByNameForObjectType(th.Context, th.CPAGroupID, "", model.PropertyFieldObjectTypeTemplate, "Job Title")
	assert.Error(t, lookupErr, "no template should have been created for a field that fails create-time validation")
}

func TestMigrateCPAFieldsToGlobalAttributes_InvalidAttrsFailureIsPermanentlySkipped(t *testing.T) {
	// An invalid "managed" value fails create-time validation with the plain
	// error ErrInvalidFieldAttrs, not an AppError -- must still classify as a
	// permanent skip, not retryable.
	th := setupMigrationTestHelper(t)

	seedCPAField(t, th, "bogus_managed", model.StringInterface{
		model.PropertyFieldAttrManaged: "not_a_real_value",
	})

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 0, migrated)
	assert.Equal(t, 1, skipped, "a deterministic attrs-validation rejection must be a permanent skip, not retryable")
	assert.Equal(t, 0, retryable)

	_, lookupErr := th.service.getPropertyFieldByNameForObjectType(th.Context, th.CPAGroupID, "", model.PropertyFieldObjectTypeTemplate, "bogus_managed")
	assert.Error(t, lookupErr, "no template should have been created for a field that fails create-time attrs validation")
}

func TestMigrateCPAFieldsToGlobalAttributes_RefusesToReuseAnUnsafeMarkedTemplate(t *testing.T) {
	// A marker-tagged template isn't automatically safe to link to --
	// lookupReusableTemplate must reproduce the protected/plugin/owner/type
	// checks the link-write itself bypasses.
	t.Run("protected marked template is not reused", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		sysadmin := model.PermissionLevelSysadmin
		unsafeTemplate := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:           th.CPAGroupID,
			Name:              "protected_template",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &sysadmin,
			PermissionValues:  &sysadmin,
			PermissionOptions: &sysadmin,
			Attrs: model.StringInterface{
				model.PropertyAttrsMigratedToGlobal: true,
				model.PropertyAttrsProtected:        true,
			},
		})

		seeded := seedCPAField(t, th, "protected_template", nil)

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 0, migrated)
		assert.Equal(t, 1, skipped)
		assert.Equal(t, 0, retryable)

		untouched, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
		require.NoError(t, err)
		assert.Nil(t, untouched.LinkedFieldID)

		unchangedTemplate, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, unsafeTemplate.ID)
		require.NoError(t, err)
		assert.Equal(t, unsafeTemplate.UpdateAt, unchangedTemplate.UpdateAt)
	})

	t.Run("type-mismatched marked template is not reused", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		sysadmin := model.PermissionLevelSysadmin
		mismatchedTemplate := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:           th.CPAGroupID,
			Name:              "type_mismatch",
			Type:              model.PropertyFieldTypeSelect,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &sysadmin,
			PermissionValues:  &sysadmin,
			PermissionOptions: &sysadmin,
			Attrs: model.StringInterface{
				model.PropertyAttrsMigratedToGlobal: true,
			},
		})

		// The CPA field is a text field, but the marker-tagged template with a
		// matching name is a select field — simulating a template whose type
		// changed after an earlier crashed run left it orphaned.
		seeded := seedCPAField(t, th, "type_mismatch", nil)

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 0, migrated)
		assert.Equal(t, 1, skipped)
		assert.Equal(t, 0, retryable)

		untouched, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
		require.NoError(t, err)
		assert.Nil(t, untouched.LinkedFieldID)

		unchangedTemplate, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, mismatchedTemplate.ID)
		require.NoError(t, err)
		assert.Equal(t, mismatchedTemplate.UpdateAt, unchangedTemplate.UpdateAt)
	})
}
