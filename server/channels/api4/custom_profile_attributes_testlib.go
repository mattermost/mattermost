// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CPA test helpers — thin fixture-setup shims that route through the generic
// property API. They mirror the behavior of the old app-layer CPA wrappers
// (SanitizeAndValidate, hooks via CreatePropertyField) without emitting CPA
// websocket events or performing HTTP-layer authorization.
//
// Defined on api4.TestHelper so enterprise test harnesses (LdapTestHelper,
// SamlTestHelper) and mmctl tests — which all embed *api4.TestHelper — can
// use them without reaching into the underlying *app.App.

// cpaGroupID resolves the protected_attributes group ID for test setup.
func (th *TestHelper) cpaGroupID(tb testing.TB) string {
	tb.Helper()
	group, appErr := th.App.GetPropertyGroup(request.TestContext(tb), model.ProtectedAttributesPropertyGroupName)
	require.Nil(tb, appErr)
	return group.ID
}

// CreateCPAField inserts a CPA field for test fixture setup. The field is
// validated via SanitizeAndValidate and routed through CreatePropertyField
// so hooks fire (license, permission defaults, attribute validation, etc.).
func (th *TestHelper) CreateCPAField(tb testing.TB, field *model.CPAField) *model.CPAField {
	tb.Helper()

	field.GroupID = th.cpaGroupID(tb)
	field.ObjectType = model.PropertyFieldObjectTypeUser
	field.TargetType = string(model.PropertyFieldTargetLevelSystem)

	require.Nil(tb, field.SanitizeAndValidate())

	created, appErr := th.App.CreatePropertyField(request.TestContext(tb), field.ToPropertyField(), false, "")
	require.Nil(tb, appErr)

	cpaField, err := model.NewCPAFieldFromPropertyField(created)
	require.NoError(tb, err)
	return cpaField
}

// PatchCPAValue upserts a single CPA value for test fixture setup. Always
// passes the real objectType/targetID so the generic websocket event fires.
func (th *TestHelper) PatchCPAValue(tb testing.TB, userID, fieldID string, value json.RawMessage) *model.PropertyValue {
	tb.Helper()

	v := &model.PropertyValue{
		GroupID:    th.cpaGroupID(tb),
		TargetType: model.PropertyValueTargetTypeUser,
		TargetID:   userID,
		FieldID:    fieldID,
		Value:      value,
	}
	upserted, appErr := th.App.UpsertPropertyValues(request.TestContext(tb), []*model.PropertyValue{v}, model.PropertyFieldObjectTypeUser, userID, "")
	require.Nil(tb, appErr)
	require.Len(tb, upserted, 1)
	return upserted[0]
}

// DeleteCPAField deletes a CPA field for test fixture cleanup.
func (th *TestHelper) DeleteCPAField(tb testing.TB, fieldID string) {
	tb.Helper()
	appErr := th.App.DeletePropertyField(request.TestContext(tb), th.cpaGroupID(tb), fieldID, false, "")
	require.Nil(tb, appErr)
}
