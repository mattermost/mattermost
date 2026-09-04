// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

// TestConvertSystemOwnedFields exercises the bootstrap path a real upgrade
// takes: a field written with legacy columns only (Permissions nil) on a
// PSAv2/v3 group the hook enforces. ConvertSystemOwnedFields has to convert
// and grant it before the owning subsystem's hook-gated writes ever see it,
// since a nil-Permissions field denies outright regardless of caller
// (see the identical comment in migrations.go).
func TestConvertSystemOwnedFields(t *testing.T) {
	th := Setup(t)
	t.Cleanup(func() { th.service.setLadderCheckerForTests(nil) })

	boardsGroup, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: model.BoardsPropertyGroupName, Version: model.PropertyGroupVersionV2})
	require.NoError(t, err)

	th.service.AddHook(NewAccessControlHook(th.service, nil, defaultLadderCheckerForTests, nil))

	// Planted directly through the store, bypassing every hook -- the shape a
	// row written before this whole effort shipped is in: legacy columns set,
	// no Permissions object at all.
	legacyField := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:         boardsGroup.ID,
		Name:            model.BoardsPropertyFieldAssignee,
		Type:            model.PropertyFieldTypeUser,
		ObjectType:      model.PropertyFieldObjectTypePost,
		TargetType:      string(model.PropertyFieldTargetLevelSystem),
		Protected:       true,
		PermissionField: model.NewPointer(model.PermissionLevelNone),
	})
	require.Nil(t, legacyField.Permissions)

	require.NoError(t, th.service.ConvertSystemOwnedFields(th.Context, boardsGroup.ID, model.BoardsPropertyGroupName))

	converted, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, model.CallerIDBoardsSystem), boardsGroup.ID, legacyField.ID)
	require.NoError(t, err)
	require.NotNil(t, converted.Permissions)
	require.NotNil(t, converted.Permissions.MatchingGrant(model.PropertyOwnerTypeService, model.BoardsPropertyGroupName, "", model.PropertyActionFieldWrite),
		"converted field should carry the boards service grant")

	t.Run("is idempotent", func(t *testing.T) {
		require.NoError(t, th.service.ConvertSystemOwnedFields(th.Context, boardsGroup.ID, model.BoardsPropertyGroupName))

		again, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, model.CallerIDBoardsSystem), boardsGroup.ID, legacyField.ID)
		require.NoError(t, err)
		require.Len(t, again.Permissions.Grants, 1, "a second run must not duplicate the grant")
	})

	t.Run("the owning subsystem can write the converted field", func(t *testing.T) {
		toUpdate := *converted
		_, _, _, err := th.service.UpdatePropertyFields(RequestContextWithCallerID(th.Context, model.CallerIDBoardsSystem), boardsGroup.ID, []*model.PropertyField{&toUpdate})
		require.NoError(t, err)
	})

	t.Run("a different subsystem is refused field.write on it", func(t *testing.T) {
		toUpdate := *converted
		_, _, _, err := th.service.UpdatePropertyFields(RequestContextWithCallerID(th.Context, model.CallerIDSessionAttributesSystem), boardsGroup.ID, []*model.PropertyField{&toUpdate})
		require.Error(t, err)
	})

	t.Run("revoking the grant takes the access away", func(t *testing.T) {
		current, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, model.CallerIDBoardsSystem), boardsGroup.ID, legacyField.ID)
		require.NoError(t, err)

		revoked := *current.Permissions
		revoked.Grants = nil
		current.Permissions = &revoked

		// An administrator revoking a grant edits Permissions directly -- not a
		// call the hook would let the subsystem itself make, since that would
		// let a machine caller un-revoke its own access. Write it straight to
		// the store, the way the API's own permissions write would land it.
		_, err = th.dbStore.PropertyField().Update(boardsGroup.ID, []*model.PropertyField{current}, map[string]int64{current.ID: current.UpdateAt})
		require.NoError(t, err)

		_, _, _, err = th.service.UpdatePropertyFields(RequestContextWithCallerID(th.Context, model.CallerIDBoardsSystem), boardsGroup.ID, []*model.PropertyField{current})
		require.Error(t, err, "revoking the service grant must actually take the access away")

		// A subsequent boot or migration run must not restore the revoked grant.
		require.NoError(t, th.service.ConvertSystemOwnedFields(th.Context, boardsGroup.ID, model.BoardsPropertyGroupName))

		afterBoot, err := th.service.GetPropertyField(RequestContextWithCallerID(th.Context, model.CallerIDBoardsSystem), boardsGroup.ID, legacyField.ID)
		require.NoError(t, err)
		require.Nil(t, afterBoot.Permissions.MatchingGrant(model.PropertyOwnerTypeService, model.BoardsPropertyGroupName, "", model.PropertyActionFieldWrite),
			"ConvertSystemOwnedFields must not re-add a revoked grant")

		_, _, _, err = th.service.UpdatePropertyFields(RequestContextWithCallerID(th.Context, model.CallerIDBoardsSystem), boardsGroup.ID, []*model.PropertyField{current})
		require.Error(t, err, "subsystem must still be refused after subsequent ConvertSystemOwnedFields run")
	})
}
