// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"maps"
	"sync"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestDoSetupManagedCategoryProperties(t *testing.T) {
	t.Run("should register the property group and field on fresh install", func(t *testing.T) {
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
		require.Nil(t, appErr)
		require.NotNil(t, group)
		require.Equal(t, model.ManagedCategoryPropertyGroupName, group.Name)

		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, propertyFields, 1)
		require.Equal(t, model.ManagedCategoryPropertyFieldName, propertyFields[0].Name)

		data, sysErr := th.Store.System().GetByName(managedCategorySetupDoneKey)
		require.NoError(t, sysErr)
		require.NotEmpty(t, data.Value)
	})

	t.Run("should upgrade from a pre-v2 setup by incrementing the group version and updating the system key", func(t *testing.T) {
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
		require.Nil(t, appErr)

		// Simulate the pre-v2 state where the migration has run with the legacy "true" marker.
		sysErr := th.Store.System().SaveOrUpdate(&model.System{Name: managedCategorySetupDoneKey, Value: "true"})
		require.NoError(t, sysErr)
		initialVersion := group.Version

		err := th.Server.doSetupManagedCategoryProperties()
		require.NoError(t, err)

		group, appErr = th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
		require.Nil(t, appErr)
		require.Equal(t, initialVersion+1, group.Version)

		data, sysErr := th.Store.System().GetByName(managedCategorySetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, managedCategoryMigrationVersion, data.Value)
	})

	t.Run("should be idempotent when the system key is already at v2", func(t *testing.T) {
		th := Setup(t)

		sysErr := th.Store.System().SaveOrUpdate(&model.System{Name: managedCategorySetupDoneKey, Value: managedCategoryMigrationVersion})
		require.NoError(t, sysErr)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
		require.Nil(t, appErr)
		versionBefore := group.Version

		err := th.Server.doSetupManagedCategoryProperties()
		require.NoError(t, err)

		group, appErr = th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
		require.Nil(t, appErr)
		require.Equal(t, versionBefore, group.Version)

		data, sysErr := th.Store.System().GetByName(managedCategorySetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, managedCategoryMigrationVersion, data.Value)
	})
}

func TestDoSetupContentFlaggingProperties(t *testing.T) {
	t.Run("should register property group and fields", func(t *testing.T) {
		//we need to call the Setup method and run the full setup instead of
		//just creating a new server via NewServer() because the Setup method
		//also takes care of using the correct database DSN based on environment,
		//settings, setting up the store and initializing services used in store such as property services.
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ContentFlaggingGroupName)
		require.Nil(t, appErr)
		require.NotNil(t, group)
		require.Equal(t, model.ContentFlaggingGroupName, group.Name)

		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, propertyFields, 11)

		data, sysErr := th.Store.System().GetByName(contentFlaggingSetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, "v5", data.Value)
	})

	t.Run("the migration is idempotent", func(t *testing.T) {
		th := Setup(t)

		// Now we will remove the migration done key from systems table to allow the data migration to run again
		_, err := th.Store.System().PermanentDeleteByName(contentFlaggingSetupDoneKey)
		require.NoError(t, err)

		// Run the content flagging data migration again
		err = th.Server.doSetupContentFlaggingProperties()
		require.NoError(t, err)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ContentFlaggingGroupName)
		require.Nil(t, appErr)
		require.Equal(t, model.ContentFlaggingGroupName, group.Name)

		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, propertyFields, 11)

		data, sysErr := th.Store.System().GetByName(contentFlaggingSetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, "v5", data.Value)
	})

	t.Run("concurrent runs tolerate update conflicts", func(t *testing.T) {
		// Reproduce the CI failure: two server instances both read the same
		// UpdateAt timestamps for the existing fields, then race to update them.
		// The store's optimistic concurrency control means only one wins; the
		// other must tolerate ErrConflict rather than crashing fatally.
		th := Setup(t)

		// Fields are already created by Setup. Clear the done key so both
		// goroutines enter the migration body and take the update path.
		_, err := th.Store.System().PermanentDeleteByName(contentFlaggingSetupDoneKey)
		require.NoError(t, err)

		const runners = 5
		errs := make([]error, runners)
		var wg sync.WaitGroup
		wg.Add(runners)
		for i := range runners {
			go func() {
				defer wg.Done()
				errs[i] = th.Server.doSetupContentFlaggingProperties()
			}()
		}
		wg.Wait()

		for i, err := range errs {
			require.NoError(t, err, "runner %d must not fail on concurrent update", i)
		}

		group, appErr := th.App.GetPropertyGroup(th.Context, model.ContentFlaggingGroupName)
		require.Nil(t, appErr)
		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, propertyFields, 11)

		data, sysErr := th.Store.System().GetByName(contentFlaggingSetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, contentFlaggingMigrationVersion, data.Value)
	})
}

// clearCPABackfillMarker removes the System-key marker for the CPA display_name backfill
// so the migration body actually executes when called from a test. Setup(t) runs
// doAppMigrations which now includes the backfill; without clearing, the System key is
// already present and doSetupCPADisplayNameBackfill short-circuits at the idempotency check
// — the test would then pass for the wrong reason.
func clearCPABackfillMarker(t *testing.T, th *TestHelper) {
	t.Helper()
	_, err := th.Store.System().PermanentDeleteByName(cpaDisplayNameBackfillKey)
	require.NoError(t, err, "failed to clear CPA backfill marker for test isolation")
}

func TestCPADisplayNameBackfill_NoExistingFields(t *testing.T) {
	th := Setup(t)

	clearCPABackfillMarker(t, th)

	err := th.Server.doSetupCPADisplayNameBackfill(th.Context)
	require.NoError(t, err)

	data, sysErr := th.Store.System().GetByName(cpaDisplayNameBackfillKey)
	require.NoError(t, sysErr)
	require.NotNil(t, data)
	require.Equal(t, "true", data.Value)
}

func TestCPADisplayNameBackfill_BackfillsMissing(t *testing.T) {
	th := Setup(t)
	// LicenseCheckHook gates writes to the access_control group on an
	// Enterprise license; the seed CreatePropertyField calls below would
	// otherwise be rejected with app.property.license_error.
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	clearCPABackfillMarker(t, th)

	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)

	// fieldA exercises the "display_name absent / empty in JSONB" case — the
	// true idempotency boundary the migration is designed to fix.
	fieldA, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "department",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)
	require.Empty(t, fieldA.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName],
		"seed invariant: fieldA must have empty display_name")

	fieldB, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "job_title",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.CustomProfileAttributesPropertyAttrsDisplayName: "Job Title",
		},
	}, false, "")
	require.Nil(t, appErr)
	require.Equal(t, "Job Title", fieldB.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName],
		"seed invariant: fieldB must have display_name set")

	err := th.Server.doSetupCPADisplayNameBackfill(th.Context)
	require.NoError(t, err)

	updatedFieldA, appErr := th.App.GetPropertyField(th.Context, group.ID, fieldA.ID)
	require.Nil(t, appErr)
	require.Equal(t, "department", updatedFieldA.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName],
		"fieldA: display_name must be backfilled to field name")

	updatedFieldB, appErr := th.App.GetPropertyField(th.Context, group.ID, fieldB.ID)
	require.Nil(t, appErr)
	require.Equal(t, "Job Title", updatedFieldB.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName],
		"fieldB: display_name must not be overwritten when already set")

	data, sysErr := th.Store.System().GetByName(cpaDisplayNameBackfillKey)
	require.NoError(t, sysErr)
	require.NotNil(t, data)
	require.Equal(t, "true", data.Value)
}

func TestCPADisplayNameBackfill_Idempotent(t *testing.T) {
	th := Setup(t)
	// LicenseCheckHook gates writes to the access_control group on an
	// Enterprise license; the seed CreatePropertyField call below would
	// otherwise be rejected with app.property.license_error.
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	clearCPABackfillMarker(t, th)

	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)

	seeded, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    group.ID,
		Name:       "location",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)

	err := th.Server.doSetupCPADisplayNameBackfill(th.Context)
	require.NoError(t, err)

	data1, sysErr := th.Store.System().GetByName(cpaDisplayNameBackfillKey)
	require.NoError(t, sysErr)
	require.Equal(t, "true", data1.Value)

	updatedAfterFirst, appErr := th.App.GetPropertyField(th.Context, group.ID, seeded.ID)
	require.Nil(t, appErr)
	require.Equal(t, "location", updatedAfterFirst.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName])

	// Snapshot UpdateAt before the second run so we can prove the second run is a no-op
	// at the DB-write level. PropertyField.UpdateAt is set to model.GetMillis() on every
	// write, so a re-run would change it. (model.System exposes only Name + Value, so the
	// System key cannot be probed the same way; the System-key SaveOrUpdate is gated by
	// the same short-circuit that gates the field write, so the field check is sufficient.)
	firstFieldUpdate := updatedAfterFirst.UpdateAt

	// Second run: idempotency check fires immediately, returns nil without any DB writes.
	err = th.Server.doSetupCPADisplayNameBackfill(th.Context)
	require.NoError(t, err)

	data2, sysErr := th.Store.System().GetByName(cpaDisplayNameBackfillKey)
	require.NoError(t, sysErr)
	require.Equal(t, "true", data2.Value)

	updatedAfterSecond, appErr := th.App.GetPropertyField(th.Context, group.ID, seeded.ID)
	require.Nil(t, appErr)
	require.Equal(t, "location", updatedAfterSecond.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName],
		"second run must not change display_name")

	require.Equal(t, firstFieldUpdate, updatedAfterSecond.UpdateAt,
		"second run must not re-write the field row")
}

func TestCPADisplayNameBackfill_BackfillsProtectedSourceOnlyField(t *testing.T) {
	th := Setup(t)
	// LicenseCheckHook gates writes to the access_control group on an
	// Enterprise license. The seed below bypasses Create-side hooks via a
	// direct store insert, but the backfill migration calls UpdatePropertyFields
	// (unhooked) which still runs the version-match check; the license is
	// nevertheless required by other CPA paths exercised across the suite.
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	clearCPABackfillMarker(t, th)

	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)
	groupID := group.ID

	// Insert directly via the store so we bypass the property service's
	// access-control routing (which would reject creating a protected
	// source_only field from a non-plugin caller). ObjectType/TargetType are
	// required so the field is recognized as PSAv2 and matches the group's
	// version when the migration's UpdatePropertyFields runs.
	field := &model.PropertyField{
		GroupID:    groupID,
		Name:       "uas_employee_id",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsProtected:      true,
			model.PropertyAttrsAccessMode:     model.PropertyAccessModeSourceOnly,
			model.PropertyAttrsSourcePluginID: "com.mattermost.uas-plugin",
			// display_name intentionally omitted - this is the state the migration
			// is designed to fix.
		},
	}
	created, err := th.Store.PropertyField().Create(field)
	require.NoError(t, err, "seed: protected source_only field must be insertable directly via the store")

	err = th.Server.doSetupCPADisplayNameBackfill(th.Context)
	require.NoError(t, err, "migration must succeed even when CPA fields are protected and owned by a plugin")

	// Read back via the store directly to avoid any read-access filtering
	// the AC layer might apply for a non-source-plugin caller.
	got, err := th.Store.PropertyField().Get(context.Background(), groupID, created.ID)
	require.NoError(t, err)
	require.Equal(t, "uas_employee_id", got.Attrs[model.CustomProfileAttributesPropertyAttrsDisplayName],
		"display_name must be backfilled to the field name even on protected/source_only fields")

	// Confirm the protection metadata was preserved untouched.
	require.Equal(t, true, got.Attrs[model.PropertyAttrsProtected], "protected flag must be preserved")
	require.Equal(t, model.PropertyAccessModeSourceOnly, got.Attrs[model.PropertyAttrsAccessMode], "access_mode must be preserved")
	require.Equal(t, "com.mattermost.uas-plugin", got.Attrs[model.PropertyAttrsSourcePluginID], "source_plugin_id must be preserved")

	data, sysErr := th.Store.System().GetByName(cpaDisplayNameBackfillKey)
	require.NoError(t, sysErr)
	require.NotNil(t, data)
	require.Equal(t, "true", data.Value)
}

func TestDoSetupSessionAttributesProperties(t *testing.T) {
	expectedFieldCount := len(model.SessionAttributeSystemFields("group-id"))

	t.Run("fresh install seeds the group and fields", func(t *testing.T) {
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.SessionAttributesPropertyGroupName)
		require.Nil(t, appErr)
		require.NotNil(t, group)
		require.Equal(t, model.SessionAttributesPropertyGroupName, group.Name)

		fields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, fields, expectedFieldCount)

		fieldsByName := make(map[string]*model.PropertyField, len(fields))
		for _, field := range fields {
			fieldsByName[field.Name] = field

			require.Equal(t, model.PropertyFieldObjectTypeSession, field.ObjectType, "field %q object type", field.Name)
			require.Equal(t, string(model.PropertyFieldTargetLevelSystem), field.TargetType, "field %q target type", field.Name)
			require.False(t, field.Protected, "field %q must not be protected", field.Name)
			require.NotNil(t, field.PermissionField)
			require.Equal(t, model.PermissionLevelSysadmin, *field.PermissionField, "field %q permission_field", field.Name)
			require.NotNil(t, field.PermissionValues)
			require.Equal(t, model.PermissionLevelSysadmin, *field.PermissionValues, "field %q permission_values", field.Name)
			require.Equal(t, false, field.Attrs["enabled"], "field %q must seed disabled", field.Name)
			require.NotEmpty(t, field.Attrs[model.SAAttrDisplayName], "field %q must seed a display name", field.Name)
		}

		ipField := fieldsByName[model.SessionAttributesPropertyFieldIPAddress]
		require.NotNil(t, ipField)
		require.Equal(t, model.PropertyFieldTypeText, ipField.Type)

		networkField := fieldsByName[model.SessionAttributesPropertyFieldNetworkInterfaceType]
		require.NotNil(t, networkField)
		require.Equal(t, model.PropertyFieldTypeSelect, networkField.Type)
		require.NotNil(t, networkField.Attrs[model.PropertyFieldAttributeOptions])

		// The typed attrs must survive the DB round trip so the app reads back what it seeded.
		saField, err := model.SAFieldFromPropertyField(networkField)
		require.NoError(t, err)
		require.Equal(t, model.SessionAttributesDisplayNameNetworkInterfaceType, saField.Attrs.DisplayName)
		require.Equal(t, model.SessionAttributeDefaultTTLNetworkIdentity, saField.Attrs.TTLSeconds)
		require.Equal(t, model.SessionAttributeDefaultGraceNetworkIdentity, saField.Attrs.GracePeriodSeconds)
		require.ElementsMatch(t,
			[]string{model.SessionAttributePlatformDesktop, model.SessionAttributePlatformMobile},
			saField.Attrs.Platforms,
		)
	})

	t.Run("re-running is idempotent", func(t *testing.T) {
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.SessionAttributesPropertyGroupName)
		require.Nil(t, appErr)

		before, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, before, expectedFieldCount)

		err := th.Server.doSetupSessionAttributesProperties()
		require.NoError(t, err)

		after, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, after, expectedFieldCount, "re-running must not create duplicate fields")
	})

	t.Run("concurrent runs tolerate update conflicts", func(t *testing.T) {
		th := Setup(t)

		// Fields already exist from Setup. Every goroutine runs the seed body
		// and races on the same UpdateAt timestamps. Only one wins; the rest
		// must tolerate the resulting ErrConflict rather than failing.
		const runners = 5
		errs := make([]error, runners)
		var wg sync.WaitGroup
		wg.Add(runners)
		for i := range runners {
			go func() {
				defer wg.Done()
				errs[i] = th.Server.doSetupSessionAttributesProperties()
			}()
		}
		wg.Wait()

		for i, err := range errs {
			require.NoError(t, err, "runner %d must not fail on concurrent update", i)
		}

		group, appErr := th.App.GetPropertyGroup(th.Context, model.SessionAttributesPropertyGroupName)
		require.Nil(t, appErr)
		fields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, fields, expectedFieldCount)
	})
}

func TestDoSetupBoardsProperties(t *testing.T) {
	t.Run("should register property group and fields", func(t *testing.T) {
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.BoardsPropertyGroupName)
		require.Nil(t, appErr)
		require.NotNil(t, group)
		require.Equal(t, model.BoardsPropertyGroupName, group.Name)

		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, propertyFields, 2)

		fieldsByName := map[string]*model.PropertyField{}
		for _, f := range propertyFields {
			fieldsByName[f.Name] = f
		}

		assignee := fieldsByName[model.BoardsPropertyFieldAssignee]
		require.NotNil(t, assignee)
		require.Equal(t, model.PropertyFieldTypeUser, assignee.Type)
		require.True(t, assignee.Protected)

		status := fieldsByName[model.BoardsPropertyFieldStatus]
		require.NotNil(t, status)
		require.Equal(t, model.PropertyFieldTypeSelect, status.Type)
		require.True(t, status.Protected)
		require.NotNil(t, status.Attrs["options"])

		// v2 seeds a default colour per status option. Verify the three seeded
		// options carry the expected colours so kanban columns render with
		// their intended palette out of the box.
		assertStatusColors(t, status.Attrs, map[string]string{
			model.BoardsStatusOptionTodo:       model.BoardsStatusColorTodo,
			model.BoardsStatusOptionInProgress: model.BoardsStatusColorInProgress,
			model.BoardsStatusOptionComplete:   model.BoardsStatusColorComplete,
		})

		data, sysErr := th.Store.System().GetByName(boardsPropertySetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, boardsPropertyMigrationVersion, data.Value)
	})

	t.Run("the migration is idempotent", func(t *testing.T) {
		th := Setup(t)

		_, err := th.Store.System().PermanentDeleteByName(boardsPropertySetupDoneKey)
		require.NoError(t, err)

		err = th.Server.doSetupBoardsProperties()
		require.NoError(t, err)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.BoardsPropertyGroupName)
		require.Nil(t, appErr)
		require.Equal(t, model.BoardsPropertyGroupName, group.Name)

		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		require.Len(t, propertyFields, 2)

		data, sysErr := th.Store.System().GetByName(boardsPropertySetupDoneKey)
		require.NoError(t, sysErr)
		require.Equal(t, boardsPropertyMigrationVersion, data.Value)
	})

	t.Run("upgrading v1 → v2 layers colours onto existing options without rewriting their IDs", func(t *testing.T) {
		// Setup() already runs v2 cleanly. Simulate a workspace that was
		// previously seeded with v1 (no colours) by stripping every colour
		// from the Status options and rolling the system flag back to v1.
		th := Setup(t)

		group, appErr := th.App.GetPropertyGroup(th.Context, model.BoardsPropertyGroupName)
		require.Nil(t, appErr)

		fields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)

		var statusBefore *model.PropertyField
		for _, f := range fields {
			if f.Name == model.BoardsPropertyFieldStatus {
				statusBefore = f
				break
			}
		}
		require.NotNil(t, statusBefore)

		// Snapshot the option IDs assigned by the v1 seed run so we can verify
		// they survive the v2 upgrade.
		idsBefore := optionIDsByName(t, statusBefore.Attrs)
		require.Len(t, idsBefore, 3)
		for _, id := range idsBefore {
			require.NotEmpty(t, id)
		}

		// Strip colours to simulate the v1 shape, then rewind the version flag.
		stripped := stripStatusColors(t, statusBefore.Attrs)
		statusBefore.Attrs = stripped
		_, _, _, updateErr := th.Server.propertyService.UpdatePropertyFields(th.Context, group.ID, []*model.PropertyField{statusBefore})
		require.NoError(t, updateErr)

		sysErr := th.Store.System().SaveOrUpdate(&model.System{Name: boardsPropertySetupDoneKey, Value: "v1"})
		require.NoError(t, sysErr)

		// Run the migration again — should layer colours back on without
		// changing option IDs.
		require.NoError(t, th.Server.doSetupBoardsProperties())

		fields, appErr = th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
		require.Nil(t, appErr)
		var statusAfter *model.PropertyField
		for _, f := range fields {
			if f.Name == model.BoardsPropertyFieldStatus {
				statusAfter = f
				break
			}
		}
		require.NotNil(t, statusAfter)

		assertStatusColors(t, statusAfter.Attrs, map[string]string{
			model.BoardsStatusOptionTodo:       model.BoardsStatusColorTodo,
			model.BoardsStatusOptionInProgress: model.BoardsStatusColorInProgress,
			model.BoardsStatusOptionComplete:   model.BoardsStatusColorComplete,
		})

		idsAfter := optionIDsByName(t, statusAfter.Attrs)
		require.Equal(t, idsBefore, idsAfter, "v2 upgrade must preserve every existing option ID")
	})
}

func assertStatusColors(t *testing.T, attrs model.StringInterface, want map[string]string) {
	t.Helper()
	got := map[string]string{}
	encoded, err := json.Marshal(attrs["options"])
	require.NoError(t, err)
	var options []map[string]any
	require.NoError(t, json.Unmarshal(encoded, &options))
	for _, opt := range options {
		name, _ := opt["name"].(string)
		color, _ := opt["color"].(string)
		if name != "" {
			got[name] = color
		}
	}
	require.Equal(t, want, got)
}

func optionIDsByName(t *testing.T, attrs model.StringInterface) map[string]string {
	t.Helper()
	out := map[string]string{}
	encoded, err := json.Marshal(attrs["options"])
	require.NoError(t, err)
	var options []map[string]any
	require.NoError(t, json.Unmarshal(encoded, &options))
	for _, opt := range options {
		name, _ := opt["name"].(string)
		id, _ := opt["id"].(string)
		if name != "" {
			out[name] = id
		}
	}
	return out
}

func stripStatusColors(t *testing.T, attrs model.StringInterface) model.StringInterface {
	t.Helper()
	encoded, err := json.Marshal(attrs["options"])
	require.NoError(t, err)
	var options []map[string]any
	require.NoError(t, json.Unmarshal(encoded, &options))
	for _, opt := range options {
		delete(opt, "color")
	}
	out := make(model.StringInterface, len(attrs))
	maps.Copy(out, attrs)
	out["options"] = options
	return out
}
