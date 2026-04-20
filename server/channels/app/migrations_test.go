// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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

func TestCPADisplayNameBackfill_NoExistingFields(t *testing.T) {
	th := Setup(t)

	// Clear any prior backfill marker so the migration body executes against an empty CPA group.
	_, err := th.Store.System().PermanentDeleteByName(cpaDisplayNameBackfillKey)
	require.NoError(t, err)

	err = th.Server.doSetupCPADisplayNameBackfill()
	require.NoError(t, err)

	data, sysErr := th.Store.System().GetByName(cpaDisplayNameBackfillKey)
	require.NoError(t, sysErr)
	require.NotNil(t, data)
	require.Equal(t, cpaDisplayNameBackfillVersion, data.Value)
}

func TestCPADisplayNameBackfill_BackfillsMissing(t *testing.T) {
	th := Setup(t)

	_, err := th.Store.System().PermanentDeleteByName(cpaDisplayNameBackfillKey)
	require.NoError(t, err)

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

	err = th.Server.doSetupCPADisplayNameBackfill()
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
	require.Equal(t, cpaDisplayNameBackfillVersion, data.Value)
}

func TestCPADisplayNameBackfill_Idempotent(t *testing.T) {
	th := Setup(t)

	_, err := th.Store.System().PermanentDeleteByName(cpaDisplayNameBackfillKey)
	require.NoError(t, err)

	fieldBase, convErr := model.NewCPAFieldFromPropertyField(&model.PropertyField{
		Name: "location",
		Type: model.PropertyFieldTypeText,
	})
	require.NoError(t, convErr)
	seeded, appErr := th.App.CreateCPAField(th.Context, fieldBase)
	require.Nil(t, appErr)

	err = th.Server.doSetupCPADisplayNameBackfill()
	require.NoError(t, err)

	data1, sysErr := th.Store.System().GetByName(cpaDisplayNameBackfillKey)
	require.NoError(t, sysErr)
	require.Equal(t, cpaDisplayNameBackfillVersion, data1.Value)

	updatedAfterFirst, appErr := th.App.GetCPAField(th.Context, seeded.ID)
	require.Nil(t, appErr)
	require.Equal(t, "location", updatedAfterFirst.Attrs.DisplayName)

	// Second run: idempotency check fires immediately, returns nil without any DB writes.
	err = th.Server.doSetupCPADisplayNameBackfill()
	require.NoError(t, err)

	data2, sysErr := th.Store.System().GetByName(cpaDisplayNameBackfillKey)
	require.NoError(t, sysErr)
	require.Equal(t, cpaDisplayNameBackfillVersion, data2.Value)

	updatedAfterSecond, appErr := th.App.GetCPAField(th.Context, seeded.ID)
	require.Nil(t, appErr)
	require.Equal(t, "location", updatedAfterSecond.Attrs.DisplayName,
		"second run must not change display_name")
}
