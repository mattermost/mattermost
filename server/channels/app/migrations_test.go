// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

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

	clearCPABackfillMarker(t, th)

	// fieldA exercises the "display_name present as empty string in JSONB" case — the true
	// idempotency boundary.
	fieldABase, convErr := model.NewCPAFieldFromPropertyField(&model.PropertyField{
		Name: "department",
		Type: model.PropertyFieldTypeText,
	})
	require.NoError(t, convErr)
	fieldA, appErr := th.App.CreateCPAField(th.Context, fieldABase)
	require.Nil(t, appErr)
	require.Equal(t, "", fieldA.Attrs.DisplayName, "seed invariant: fieldA must have empty display_name")

	fieldBBase, convErr := model.NewCPAFieldFromPropertyField(&model.PropertyField{
		Name: "job_title",
		Type: model.PropertyFieldTypeText,
	})
	require.NoError(t, convErr)
	fieldBBase.Attrs.DisplayName = "Job Title"
	fieldB, appErr := th.App.CreateCPAField(th.Context, fieldBBase)
	require.Nil(t, appErr)
	require.Equal(t, "Job Title", fieldB.Attrs.DisplayName, "seed invariant: fieldB must have display_name set")

	err := th.Server.doSetupCPADisplayNameBackfill(th.Context)
	require.NoError(t, err)

	updatedFieldA, appErr := th.App.GetCPAField(th.Context, fieldA.ID)
	require.Nil(t, appErr)
	require.Equal(t, "department", updatedFieldA.Attrs.DisplayName,
		"fieldA: display_name must be backfilled to field name")

	updatedFieldB, appErr := th.App.GetCPAField(th.Context, fieldB.ID)
	require.Nil(t, appErr)
	require.Equal(t, "Job Title", updatedFieldB.Attrs.DisplayName,
		"fieldB: display_name must not be overwritten when already set")

	data, sysErr := th.Store.System().GetByName(cpaDisplayNameBackfillKey)
	require.NoError(t, sysErr)
	require.NotNil(t, data)
	require.Equal(t, "true", data.Value)
}

func TestCPADisplayNameBackfill_Idempotent(t *testing.T) {
	th := Setup(t)

	clearCPABackfillMarker(t, th)

	fieldBase, convErr := model.NewCPAFieldFromPropertyField(&model.PropertyField{
		Name: "location",
		Type: model.PropertyFieldTypeText,
	})
	require.NoError(t, convErr)
	seeded, appErr := th.App.CreateCPAField(th.Context, fieldBase)
	require.Nil(t, appErr)

	err := th.Server.doSetupCPADisplayNameBackfill(th.Context)
	require.NoError(t, err)

	data1, sysErr := th.Store.System().GetByName(cpaDisplayNameBackfillKey)
	require.NoError(t, sysErr)
	require.Equal(t, "true", data1.Value)

	updatedAfterFirst, appErr := th.App.GetCPAField(th.Context, seeded.ID)
	require.Nil(t, appErr)
	require.Equal(t, "location", updatedAfterFirst.Attrs.DisplayName)

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

	updatedAfterSecond, appErr := th.App.GetCPAField(th.Context, seeded.ID)
	require.Nil(t, appErr)
	require.Equal(t, "location", updatedAfterSecond.Attrs.DisplayName,
		"second run must not change display_name")

	require.Equal(t, firstFieldUpdate, updatedAfterSecond.UpdateAt,
		"second run must not re-write the field row")
}

func TestCPADisplayNameBackfill_BackfillsProtectedSourceOnlyField(t *testing.T) {
	th := Setup(t)

	clearCPABackfillMarker(t, th)

	groupID, appErr := th.App.CpaGroupID()
	require.Nil(t, appErr)

	// Insert directly via the store so we bypass the property service's
	// access-control routing (which would reject creating a protected
	// source_only field from a non-plugin caller). Type=text avoids the
	// options-stripping branch in read access control, but the migration's
	// correctness here doesn't depend on the field type.
	field := &model.PropertyField{
		GroupID: groupID,
		Name:    "uas_employee_id",
		Type:    model.PropertyFieldTypeText,
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
