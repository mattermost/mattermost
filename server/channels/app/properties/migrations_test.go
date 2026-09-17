// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"strings"
	"testing"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// raceInjectingFieldStore wraps a real store.PropertyFieldStore and, the
// first time Get is called for a specific field ID, fires a caller-supplied
// trigger immediately after the read -- simulating another HA node
// committing a write to that same row in the narrow window between this
// node's read and its own subsequent write.
type raceInjectingFieldStore struct {
	store.PropertyFieldStore
	fieldID string
	trigger func()
	fired   bool
}

func (s *raceInjectingFieldStore) Get(rctx request.CTX, groupID, id string) (*model.PropertyField, error) {
	field, err := s.PropertyFieldStore.Get(rctx, groupID, id)
	if err == nil && !s.fired && id == s.fieldID {
		s.fired = true
		s.trigger()
	}
	return field, err
}

// invalidFieldReturningStore wraps a real store.PropertyFieldStore and mutates
// a specific field ID's in-memory struct on Get into a state that
// PropertyField.IsValid deterministically rejects on the subsequent Update --
// simulating a legacy row inconsistent with a validation rule added after it
// was created.
type invalidFieldReturningStore struct {
	store.PropertyFieldStore
	fieldID string
}

func (s *invalidFieldReturningStore) Get(rctx request.CTX, groupID, id string) (*model.PropertyField, error) {
	field, err := s.PropertyFieldStore.Get(rctx, groupID, id)
	if err == nil && id == s.fieldID {
		// Non-protected fields cannot have field permission set to "none".
		none := model.PermissionLevelNone
		field.PermissionField = &none
	}
	return field, err
}

// optionsCleanupSpyStore wraps a real store.PropertyFieldStore and records
// every PermanentDeleteOwnedOptions call, optionally failing the one made for
// a specific field ID -- simulating a transient DB error during the
// already-linked-field cleanup pass, and letting a test assert whether the
// guard on an optionless field skipped calling it at all.
type optionsCleanupSpyStore struct {
	store.PropertyFieldStore
	failForFieldID string
	calledFor      []string
}

func (s *optionsCleanupSpyStore) PermanentDeleteOwnedOptions(groupID, fieldID string) error {
	s.calledFor = append(s.calledFor, fieldID)
	if fieldID == s.failForFieldID {
		return errors.New("simulated transient DB error")
	}
	return s.PropertyFieldStore.PermanentDeleteOwnedOptions(groupID, fieldID)
}

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
	th.service.AddHook(NewAccessControlAttributeValidationHook(th.service, AccessControlAttributeValidationHookConfig{
		PermissionChecker: permChecker,
	}, th.CPAGroupID))

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

func seedTemplate(tb testing.TB, th *TestHelper, name string, fieldType model.PropertyFieldType, attrs model.StringInterface) *model.PropertyField {
	tb.Helper()
	sysadmin := model.PermissionLevelSysadmin
	return th.CreatePropertyFieldDirect(tb, &model.PropertyField{
		GroupID:           th.CPAGroupID,
		Name:              name,
		Type:              fieldType,
		ObjectType:        model.PropertyFieldObjectTypeTemplate,
		TargetType:        string(model.PropertyFieldTargetLevelSystem),
		PermissionField:   &sysadmin,
		PermissionValues:  &sysadmin,
		PermissionOptions: &sysadmin,
		Attrs:             attrs,
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

// TestMigrateCPAFieldsToGlobalAttributes_MigratesSelectFieldWithoutDuplicatingOptions
// reproduces the bug fixed alongside this test: attemptCreateOrReuseTemplate
// deep-copies a select/multiselect field's options (IDs included) onto the new
// template, and optionOwnerIDs reads a linked field's options as the union of
// its own rows and its template's. Leaving the original field's own rows in
// place after linking therefore served every option twice.
func TestMigrateCPAFieldsToGlobalAttributes_MigratesFieldWithoutDuplicatingOptions(t *testing.T) {
	tests := []struct {
		name    string
		optType model.PropertyFieldType
		options []map[string]any
	}{
		{
			name:    "select",
			optType: model.PropertyFieldTypeSelect,
			options: []map[string]any{{"name": "a"}, {"name": "b"}, {"name": "c"}},
		},
		{
			name:    "multiselect",
			optType: model.PropertyFieldTypeMultiselect,
			options: []map[string]any{{"name": "a"}, {"name": "b"}, {"name": "c"}},
		},
		{
			name:    "rank",
			optType: model.PropertyFieldTypeRank,
			// A rank field's options each need a distinct rank -- see
			// CreateFieldOptions' "rank field" validation error -- otherwise
			// it never reaches the migration's link step at all.
			options: []map[string]any{{"name": "a", "rank": 1}, {"name": "b", "rank": 2}, {"name": "c", "rank": 3}},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			th := setupMigrationTestHelper(t)

			seeded := th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:    th.CPAGroupID,
				Name:       "roles",
				Type:       tc.optType,
				ObjectType: model.PropertyFieldObjectTypeUser,
				TargetType: string(model.PropertyFieldTargetLevelSystem),
				Attrs: model.StringInterface{
					model.PropertyFieldAttributeOptions: tc.options,
				},
			})

			migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
			require.NoError(t, err)
			assert.Equal(t, 1, migrated)
			assert.Equal(t, 0, skipped)
			assert.Equal(t, 0, retryable)

			updatedField, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
			require.NoError(t, err)
			require.NotNil(t, updatedField.LinkedFieldID)

			page, err := th.service.GetFieldOptions(th.Context, th.CPAGroupID, updatedField.ID, 0, "", 100)
			require.NoError(t, err)
			names := make([]string, 0, len(page.Options))
			for _, option := range page.Options {
				names = append(names, option.Name)
			}
			assert.ElementsMatch(t, []string{"a", "b", "c"}, names, "each option must be served once, not once per source (own rows + template rows)")
		})
	}
}

// TestMigrateCPAFieldsToGlobalAttributes_MigratesGraphFieldWithoutDuplicatingOptions
// covers graph (hierarchical) fields separately from the table above: their
// options carry a parent/child hierarchy built via MutateOptions rather than
// inline in Attrs. Graph fields are hidden from the admin console's create
// menu -- only the REST and plugin APIs build one -- but they are a real,
// reachable CPA field type and SupportsOptions() covers them the same as
// select/multiselect/rank, so they hit the same duplication bug.
func TestMigrateCPAFieldsToGlobalAttributes_MigratesGraphFieldWithoutDuplicatingOptions(t *testing.T) {
	th := setupMigrationTestHelper(t)

	parentID := model.NewId()
	childID := model.NewId()
	seeded := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:    th.CPAGroupID,
		Name:       "org_unit",
		Type:       model.PropertyFieldTypeGraph,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []map[string]any{
				{"id": parentID, "name": "Engineering"},
				{"id": childID, "name": "Platform"},
			},
		},
	})

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 1, migrated)
	assert.Equal(t, 0, skipped)
	assert.Equal(t, 0, retryable)

	updatedField, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
	require.NoError(t, err)
	require.NotNil(t, updatedField.LinkedFieldID)

	// This intentionally does not assert on hierarchy (AncestorsOrSelf):
	// attemptCreateOrReuseTemplate deep-copies only Attrs, and a graph field's
	// hierarchy lives in the separate PropertyOptionEdges table, which the
	// migration never copies to the new template at all. That leaves a
	// migrated graph field's hierarchy unreachable through the template it
	// now derives from -- a distinct, more severe gap (hierarchy loss, not
	// duplication) than the one covered here.
	page, err := th.service.GetFieldOptions(th.Context, th.CPAGroupID, updatedField.ID, 0, "", 100)
	require.NoError(t, err)
	names := make([]string, 0, len(page.Options))
	for _, option := range page.Options {
		names = append(names, option.Name)
	}
	assert.ElementsMatch(t, []string{"Engineering", "Platform"}, names, "each option must be served once, not once per source (own rows + template rows)")
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

		template := seedTemplate(t, th, "already_linked", model.PropertyFieldTypeText, nil)

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

	orphan := seedTemplate(t, th, "recovered", model.PropertyFieldTypeText, model.StringInterface{
		model.PropertyAttrsMigratedToGlobal: true,
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
	t.Run("generic unrelated template name collision is resolved via an ID-suffixed name", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		// No PropertyAttrsMigratedToGlobal marker: an admin-created template.
		unrelated := seedTemplate(t, th, "department", model.PropertyFieldTypeText, model.StringInterface{
			model.PropertyFieldAttrDisplayName: "Department",
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

		disambiguated := templateByName(t, th, "department_"+seeded.ID)
		assert.Equal(t, *updated.LinkedFieldID, disambiguated.ID, "field must be linked to the ID-disambiguated template")
		assert.Equal(t, "Department (copy)", disambiguated.Attrs[model.PropertyFieldAttrDisplayName])
		assert.Equal(t, true, disambiguated.Attrs[model.PropertyAttrsMigratedToGlobal], "the disambiguated template must still carry the marker for future-run idempotency")

		stillNoDependents, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, unrelated.ID)
		require.NoError(t, err)
		assert.Nil(t, stillNoDependents.LinkedFieldID, "the unrelated template itself must be left untouched")
	})

	t.Run("a pre-existing 'name_copy' template does not block migration, since the fallback name carries the field's own ID", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		// Both unrelated, unmarked -- including one that happens to already sit
		// at the legacy "_copy" name a naive suffix scheme would have retried.
		seedTemplate(t, th, "department", model.PropertyFieldTypeText, nil)
		seedTemplate(t, th, "department_copy", model.PropertyFieldTypeText, nil)

		seeded := seedCPAField(t, th, "department", nil)

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 1, migrated, "an ID-suffixed fallback name can't collide with a pre-existing 'name_copy' template")
		assert.Equal(t, 0, skipped)
		assert.Equal(t, 0, retryable)

		updated, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
		require.NoError(t, err)
		require.NotNil(t, updated.LinkedFieldID)

		disambiguated := templateByName(t, th, "department_"+seeded.ID)
		assert.Equal(t, disambiguated.ID, *updated.LinkedFieldID)
	})

	t.Run("a marker-tagged disambiguated template from a crashed prior run is reused, not recreated", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		// Unrelated, unmarked -- the original collision that forces disambiguation.
		seedTemplate(t, th, "department", model.PropertyFieldTypeText, nil)

		seeded := seedCPAField(t, th, "department", nil)

		// A prior run created this and marked it, then crashed before linking.
		orphan := seedTemplate(t, th, "department_"+seeded.ID, model.PropertyFieldTypeText, model.StringInterface{
			model.PropertyAttrsMigratedToGlobal: true,
		})

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 1, migrated)
		assert.Equal(t, 0, skipped)
		assert.Equal(t, 0, retryable)

		updated, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
		require.NoError(t, err)
		require.NotNil(t, updated.LinkedFieldID)
		assert.Equal(t, orphan.ID, *updated.LinkedFieldID, "must reuse the existing marked orphan template rather than creating another one")
	})

	t.Run("a CPA field literally named 'classification' migrates under a disambiguated name, never hijacking Classification Markings' template", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		// Real shape: Classification Markings' template has no
		// PropertyAttrsMigratedToGlobal marker, since it isn't created by
		// this migration.
		classification := seedTemplate(t, th, "classification", model.PropertyFieldTypeRank, nil)

		// Same Type (Rank, matching Classification's real template type) as the
		// template above -- isolates the marker check as the reason this
		// collides, rather than the unrelated type-mismatch gate.
		seeded := th.CreatePropertyFieldDirect(t, &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "classification",
			Type:       model.PropertyFieldTypeRank,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
		})

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 1, migrated, "an ID-suffixed name can never collide with Classification Markings' reserved name")
		assert.Equal(t, 0, skipped)
		assert.Equal(t, 0, retryable)

		updated, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
		require.NoError(t, err)
		require.NotNil(t, updated.LinkedFieldID)
		assert.NotEqual(t, classification.ID, *updated.LinkedFieldID, "must never link to Classification Markings' own template")

		disambiguated := templateByName(t, th, "classification_"+seeded.ID)
		assert.Equal(t, disambiguated.ID, *updated.LinkedFieldID)

		unchangedClassification, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, classification.ID)
		require.NoError(t, err)
		assert.Equal(t, classification.UpdateAt, unchangedClassification.UpdateAt,
			"Classification Markings' own template must not be written to")
	})

	t.Run("a disambiguated name's display_name copy suffix is skipped, not failed, when it would exceed the length limit", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		seedTemplate(t, th, "department", model.PropertyFieldTypeText, nil)

		maxLengthDisplayName := strings.Repeat("a", model.PropertyFieldNameMaxRunes)
		seeded := seedCPAField(t, th, "department", model.StringInterface{
			model.PropertyFieldAttrDisplayName: maxLengthDisplayName,
		})

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 1, migrated, "an over-length display_name must not turn a disambiguation attempt into a permanent skip")
		assert.Equal(t, 0, skipped)
		assert.Equal(t, 0, retryable)

		updated, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
		require.NoError(t, err)
		require.NotNil(t, updated.LinkedFieldID)

		disambiguated := templateByName(t, th, "department_"+seeded.ID)
		assert.Equal(t, disambiguated.ID, *updated.LinkedFieldID)
		assert.Equal(t, maxLengthDisplayName, disambiguated.Attrs[model.PropertyFieldAttrDisplayName],
			"the ' (copy)' suffix must be skipped, not appended, since it would overflow the length limit")
	})

	t.Run("a slugified name that overflows the length limit once ID-suffixed is a permanent skip, not an error", func(t *testing.T) {
		th := setupMigrationTestHelper(t)

		// Long enough that baseName + "_" + a 26-char field ID exceeds
		// PropertyFieldNameMaxRunes (255). The space forces slugification;
		// slugifying doesn't shorten the name, so this baseName is already
		// 250 runes long.
		longName := strings.Repeat("a", 125) + " " + strings.Repeat("a", 124)
		longSlug := strings.Repeat("a", 125) + "_" + strings.Repeat("a", 124)

		// No PropertyAttrsMigratedToGlobal marker: an admin-created template,
		// forcing the ID-suffixed disambiguation retry.
		seedTemplate(t, th, longSlug, model.PropertyFieldTypeText, nil)
		seeded := seedCPAField(t, th, longName, nil)

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 0, migrated)
		assert.Equal(t, 1, skipped, "an over-length disambiguated name must be a permanent skip, not retried forever")
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
	for range model.AccessControlGroupFieldLimit {
		seedTemplate(t, th, "filler_"+model.NewId(), model.PropertyFieldTypeText, nil)
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

func TestMigrateCPAFieldsToGlobalAttributes_LegacyInvalidNameIsSlugified(t *testing.T) {
	// A legacy CPA field whose Name predates the CEL-safe-identifier rule
	// (e.g. containing a space) can't be used as the template's Name
	// verbatim, so the migration slugifies it into a CEL-safe name instead
	// of permanently skipping the field.
	th := setupMigrationTestHelper(t)

	seeded := seedCPAField(t, th, "Job Title", nil)

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 1, migrated)
	assert.Equal(t, 0, skipped)
	assert.Equal(t, 0, retryable)

	template := templateByName(t, th, "job_title")
	assert.Equal(t, model.PropertyFieldObjectTypeTemplate, template.ObjectType)

	updatedField, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
	require.NoError(t, err)
	require.NotNil(t, updatedField.LinkedFieldID)
	assert.Equal(t, template.ID, *updatedField.LinkedFieldID)
	assert.Equal(t, "Job Title", updatedField.Name, "the original CPA field's Name is left untouched -- only the new template gets a CEL-safe name")
}

func TestMigrateCPAFieldsToGlobalAttributes_ReservedWordNameIsSlugified(t *testing.T) {
	// A legacy CPA field named after a bare CEL keyword (valid charset, but
	// reserved) must also be slugified rather than permanently skipped.
	th := setupMigrationTestHelper(t)

	seedCPAField(t, th, "in", nil)

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 1, migrated)
	assert.Equal(t, 0, skipped)
	assert.Equal(t, 0, retryable)

	templateByName(t, th, "in_attr")
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

		unsafeTemplate := seedTemplate(t, th, "protected_template", model.PropertyFieldTypeText, model.StringInterface{
			model.PropertyAttrsMigratedToGlobal: true,
			model.PropertyAttrsProtected:        true,
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

		mismatchedTemplate := seedTemplate(t, th, "type_mismatch", model.PropertyFieldTypeSelect, model.StringInterface{
			model.PropertyAttrsMigratedToGlobal: true,
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

	t.Run("marked template already linked from another field is not reused", func(t *testing.T) {
		// Reproduces the "ambiguous sibling" state access_control_masking.go
		// documents as having no DB-level uniqueness guard: two independent
		// CPA fields must never end up linked to the same template. A name
		// collision plus the ID-suffixed fallback can otherwise manufacture
		// this if a second, unrelated field happens to already be named
		// exactly like the first field's disambiguated fallback name.
		th := setupMigrationTestHelper(t)

		// Unrelated, unmarked -- forces the "budget" CPA field below into a
		// disambiguated fallback name.
		unrelated := seedTemplate(t, th, "budget", model.PropertyFieldTypeText, nil)

		budget := seedCPAField(t, th, "budget", nil)

		migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		require.Equal(t, 1, migrated)
		require.Equal(t, 0, skipped)
		require.Equal(t, 0, retryable)

		disambiguatedName := "budget_" + budget.ID
		disambiguated := templateByName(t, th, disambiguatedName)
		updatedBudget, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, budget.ID)
		require.NoError(t, err)
		require.Equal(t, disambiguated.ID, *updatedBudget.LinkedFieldID)

		// A second, independent CPA field that happens to share the exact
		// name budget's disambiguated template landed at.
		collidingField := seedCPAField(t, th, disambiguatedName, nil)

		migrated, skipped, retryable, err = th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
		require.NoError(t, err)
		assert.Equal(t, 0, migrated, "must not silently link a second field to a template another field already claimed")
		assert.Equal(t, 2, skipped, "budget is now ineligible (already linked) and the colliding field is permanently skipped")
		assert.Equal(t, 0, retryable)

		untouchedColliding, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, collidingField.ID)
		require.NoError(t, err)
		assert.Nil(t, untouchedColliding.LinkedFieldID, "must not link to a template another field already claimed")

		unchangedUnrelated, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, unrelated.ID)
		require.NoError(t, err)
		assert.Nil(t, unchangedUnrelated.LinkedFieldID, "the original unrelated template must be left untouched")
	})
}

func TestMigrateLinkCPAFieldToGlobalAttributeTemplate_ConcurrentEditIsNotClobbered(t *testing.T) {
	th := setupMigrationTestHelper(t)

	seeded := seedCPAField(t, th, "department", nil)

	template := seedTemplate(t, th, "department", model.PropertyFieldTypeText, model.StringInterface{
		model.PropertyAttrsMigratedToGlobal: true,
	})

	realStore := th.service.fieldStore
	th.service.fieldStore = &raceInjectingFieldStore{
		PropertyFieldStore: realStore,
		fieldID:            seeded.ID,
		trigger: func() {
			// Simulate another HA node committing an admin edit to this same
			// field in the window between this node's read (just above) and
			// its own link-write below.
			concurrentEdit := *seeded
			concurrentEdit.Name = "department_renamed_concurrently"
			_, updateErr := realStore.Update(th.CPAGroupID, []*model.PropertyField{&concurrentEdit}, nil)
			require.NoError(t, updateErr)
		},
	}

	_, linkErr := th.service.MigrateLinkCPAFieldToGlobalAttributeTemplate(th.Context, th.CPAGroupID, seeded.ID, template.ID)
	assert.Error(t, linkErr, "a concurrent write between the read and the link-write must surface as an error, not be silently overwritten")

	reloaded, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
	require.NoError(t, err)
	assert.Equal(t, "department_renamed_concurrently", reloaded.Name, "the concurrent edit must survive the failed link attempt")
	assert.Nil(t, reloaded.LinkedFieldID, "the field must not end up linked when the write lost the race")
}

func TestMigrateCPAFieldsToGlobalAttributes_ConcurrentEditIsRetryableAndSelfHeals(t *testing.T) {
	th := setupMigrationTestHelper(t)

	seeded := seedCPAField(t, th, "department", model.StringInterface{
		model.PropertyFieldAttrLDAP: "dept",
	})

	realStore := th.service.fieldStore
	th.service.fieldStore = &raceInjectingFieldStore{
		PropertyFieldStore: realStore,
		fieldID:            seeded.ID,
		trigger: func() {
			// Simulate a concurrent admin edit racing the migration's
			// link-write for this field, on its first attempt only.
			concurrentEdit := *seeded
			concurrentEdit.Name = "department_renamed_concurrently"
			_, updateErr := realStore.Update(th.CPAGroupID, []*model.PropertyField{&concurrentEdit}, nil)
			require.NoError(t, updateErr)
		},
	}

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 0, migrated, "a field that loses the concurrency race must not count as migrated")
	assert.Equal(t, 0, skipped, "a concurrency conflict is transient, not a permanent skip")
	assert.Equal(t, 1, retryable)

	raced, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
	require.NoError(t, err)
	assert.Nil(t, raced.LinkedFieldID, "the field must remain unlinked after losing the race")

	// Restore the real store: the race only fires once, so a later restart
	// (another call with no concurrent writer) must succeed.
	th.service.fieldStore = realStore

	migrated, skipped, retryable, err = th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 1, migrated, "the field must self-heal on a later restart once nothing races it")
	assert.Equal(t, 0, skipped)
	assert.Equal(t, 0, retryable)

	healed, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, seeded.ID)
	require.NoError(t, err)
	require.NotNil(t, healed.LinkedFieldID)

	template := templateByName(t, th, "department_renamed_concurrently")
	assert.Equal(t, template.ID, *healed.LinkedFieldID, "must migrate under the name the concurrent edit left in place")
}

func TestIsPermanentPropertyFieldFailure(t *testing.T) {
	appErr := model.NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", nil, "", 400)

	tests := []struct {
		name      string
		err       error
		permanent bool
	}{
		{"an AppError wrapped with fmt.Errorf is permanent", fmt.Errorf("failed to link field: %w", appErr), true},
		{"an AppError wrapped with pkg/errors.Wrap (the store layer's own wrapping) is permanent", errors.Wrap(appErr, "property_field_update_isvalid"), true},
		{"ErrGroupFieldLimitReached is permanent", ErrGroupFieldLimitReached, true},
		{"a plain store.ErrConflict is transient", store.NewErrConflict("PropertyField", nil, "concurrent modification detected"), false},
		{"a plain store.ErrNotFound is transient", store.NewErrNotFound("PropertyField", "some-id"), false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.permanent, isPermanentPropertyFieldFailure(tc.err))
		})
	}
}

func TestMigrateLinkCPAFieldToGlobalAttributeTemplate_DeterministicallyInvalidFieldIsPermanentFailure(t *testing.T) {
	th := setupMigrationTestHelper(t)

	seeded := seedCPAField(t, th, "department", nil)
	template := seedTemplate(t, th, "department", model.PropertyFieldTypeText, model.StringInterface{
		model.PropertyAttrsMigratedToGlobal: true,
	})

	th.service.fieldStore = &invalidFieldReturningStore{
		PropertyFieldStore: th.service.fieldStore,
		fieldID:            seeded.ID,
	}

	_, linkErr := th.service.MigrateLinkCPAFieldToGlobalAttributeTemplate(th.Context, th.CPAGroupID, seeded.ID, template.ID)
	require.Error(t, linkErr)
	assert.True(t, isPermanentPropertyFieldFailure(linkErr), "an IsValid() AppError must classify as permanent, not retried forever")
}

func TestMigrateCPAFieldsToGlobalAttributes_DeterministicLinkFailureIsPermanentlySkipped(t *testing.T) {
	th := setupMigrationTestHelper(t)

	seeded := seedCPAField(t, th, "department", nil)

	th.service.fieldStore = &invalidFieldReturningStore{
		PropertyFieldStore: th.service.fieldStore,
		fieldID:            seeded.ID,
	}

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 0, migrated)
	assert.Equal(t, 1, skipped, "a deterministically-invalid link write must be a permanent skip, not retried forever")
	assert.Equal(t, 0, retryable)
}

// TestMigrateCPAFieldsToGlobalAttributes_RerunClearsAlreadyLinkedFieldDuplicatedOptions
// covers the actual remediation story for an install that already ran a
// version of this migration that left an already-linked field's own option
// rows in place (doubling every option it serves, since optionOwnerIDs unions
// a linked field's own rows with its template's): clearing this same
// migration's own existing System-key marker and running it again must clean
// up that field too, not just link anything still unlinked. No separate
// migration or marker for it.
func TestMigrateCPAFieldsToGlobalAttributes_RerunClearsAlreadyLinkedFieldDuplicatedOptions(t *testing.T) {
	tests := []struct {
		name    string
		optType model.PropertyFieldType
		options []map[string]any
	}{
		{
			name:    "select",
			optType: model.PropertyFieldTypeSelect,
			options: []map[string]any{{"name": "a"}, {"name": "b"}},
		},
		{
			name:    "multiselect",
			optType: model.PropertyFieldTypeMultiselect,
			options: []map[string]any{{"name": "a"}, {"name": "b"}},
		},
		{
			name:    "rank",
			optType: model.PropertyFieldTypeRank,
			options: []map[string]any{{"name": "a", "rank": 1}, {"name": "b", "rank": 2}},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			th := setupMigrationTestHelper(t)

			template := seedTemplate(t, th, "roles", tc.optType, model.StringInterface{
				model.PropertyFieldAttributeOptions: tc.options,
			})

			// Simulates the pre-fix broken state directly: a field already
			// linked to its template, still carrying the own option rows the
			// old migration never cleared after linking.
			linked := th.CreatePropertyFieldDirect(t, &model.PropertyField{
				GroupID:       th.CPAGroupID,
				Name:          "roles_linked",
				Type:          tc.optType,
				ObjectType:    model.PropertyFieldObjectTypeUser,
				TargetType:    string(model.PropertyFieldTargetLevelSystem),
				LinkedFieldID: &template.ID,
				Attrs: model.StringInterface{
					model.PropertyFieldAttributeOptions: tc.options,
				},
			})

			// Simulates clearing the migration's own existing marker and
			// letting it run again -- the template is ObjectType=Template, so
			// this migration's own search (ObjectType=User) never sees it and
			// it is left alone regardless.
			migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
			require.NoError(t, err)
			assert.Equal(t, 0, migrated)
			assert.Equal(t, 1, skipped, "already linked, so not re-migrated, but still reached for cleanup")
			assert.Equal(t, 0, retryable)

			page, err := th.service.GetFieldOptions(th.Context, th.CPAGroupID, linked.ID, 0, "", 100)
			require.NoError(t, err)
			names := make([]string, 0, len(page.Options))
			for _, option := range page.Options {
				names = append(names, option.Name)
			}
			assert.ElementsMatch(t, []string{"a", "b"}, names, "options must now come solely from the template, not doubled by the field's own cleared rows")

			// The template's own options must survive the cleanup: only the
			// linked field's rows are in scope, never the template's.
			templatePage, err := th.service.GetFieldOptions(th.Context, th.CPAGroupID, template.ID, 0, "", 100)
			require.NoError(t, err)
			assert.Len(t, templatePage.Options, 2)
		})
	}
}

// TestMigrateCPAFieldsToGlobalAttributes_RerunSkipsAlreadyLinkedOptionlessField
// covers the guard on the same rerun path: a linked field of a type that
// carries no options (e.g. text) must not have PermanentDeleteOwnedOptions attempted
// against it at all.
func TestMigrateCPAFieldsToGlobalAttributes_RerunSkipsAlreadyLinkedOptionlessField(t *testing.T) {
	th := setupMigrationTestHelper(t)

	template := seedTemplate(t, th, "department", model.PropertyFieldTypeText, nil)
	linkedText := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:       th.CPAGroupID,
		Name:          "linked_text",
		Type:          model.PropertyFieldTypeText,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &template.ID,
	})

	spy := &optionsCleanupSpyStore{PropertyFieldStore: th.service.fieldStore}
	th.service.fieldStore = spy

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 0, migrated)
	assert.Equal(t, 1, skipped)
	assert.Equal(t, 0, retryable)
	assert.Empty(t, spy.calledFor, "a text field carries no options and must not have PermanentDeleteOwnedOptions attempted against it at all")

	updatedLinkedText, err := th.service.GetPropertyField(th.Context, th.CPAGroupID, linkedText.ID)
	require.NoError(t, err)
	require.NotNil(t, updatedLinkedText.LinkedFieldID)
}

// TestMigrateCPAFieldsToGlobalAttributes_RerunCleanupFailureIsRetryableNotSkipped
// covers the fix for the asymmetry found in review: a PermanentDeleteOwnedOptions
// failure on an already-linked field must count toward retryable, the same way
// the forward-link path already does, so a transient failure doesn't let the
// caller persist the "done" marker with this field's duplication still unfixed.
func TestMigrateCPAFieldsToGlobalAttributes_RerunCleanupFailureIsRetryableNotSkipped(t *testing.T) {
	th := setupMigrationTestHelper(t)

	template := seedTemplate(t, th, "roles", model.PropertyFieldTypeSelect, model.StringInterface{
		model.PropertyFieldAttributeOptions: []map[string]any{{"name": "a"}, {"name": "b"}},
	})
	linked := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:       th.CPAGroupID,
		Name:          "roles_linked",
		Type:          model.PropertyFieldTypeSelect,
		ObjectType:    model.PropertyFieldObjectTypeUser,
		TargetType:    string(model.PropertyFieldTargetLevelSystem),
		LinkedFieldID: &template.ID,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []map[string]any{{"name": "a"}, {"name": "b"}},
		},
	})

	th.service.fieldStore = &optionsCleanupSpyStore{PropertyFieldStore: th.service.fieldStore, failForFieldID: linked.ID}

	migrated, skipped, retryable, err := th.service.MigrateCPAFieldsToGlobalAttributes(th.Context)
	require.NoError(t, err)
	assert.Equal(t, 0, migrated)
	assert.Equal(t, 0, skipped, "a failed cleanup must not be counted as skipped -- that would let the caller mark the migration done")
	assert.Equal(t, 1, retryable)
}
