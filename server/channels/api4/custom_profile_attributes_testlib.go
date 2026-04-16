// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CPA test helpers — test-only shims that mirror the old app-layer CPA
// wrapper API (now deleted). They route through the generic property API
// so the property-service hooks still fire. Defined on api4.TestHelper so
// enterprise test harnesses (LdapTestHelper, SamlTestHelper) and mmctl
// tests — which all embed *api4.TestHelper — can use them without reaching
// into the underlying *app.App.
//
// A follow-up consolidation pass will drop any tests that are fully
// redundant with the generic property tests.

// CpaGroupID resolves the protected_attributes group ID, asserting success.
func (th *TestHelper) CpaGroupID(tb testing.TB) string {
	tb.Helper()
	group, appErr := th.App.GetPropertyGroup(request.TestContext(tb), model.ProtectedAttributesPropertyGroupName)
	require.Nil(tb, appErr)
	return group.ID
}

// GetCPAField looks up a CPA field, returning the CPA-formatted field or
// an AppError (with the historical CPA error IDs preserved for tests that
// assert on them).
func (th *TestHelper) GetCPAField(tb testing.TB, fieldID string) (*model.CPAField, *model.AppError) {
	tb.Helper()
	rctx := request.TestContext(tb)
	groupID := th.CpaGroupID(tb)

	field, appErr := th.App.GetPropertyField(rctx, groupID, fieldID)
	if appErr != nil {
		if errors.Is(appErr, sql.ErrNoRows) {
			return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		}
		return nil, appErr
	}

	cpaField, err := model.NewCPAFieldFromPropertyField(field)
	if err != nil {
		return nil, model.NewAppError("GetCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return cpaField, nil
}

// ListCPAFields lists all CPA fields, sorted by sort_order.
func (th *TestHelper) ListCPAFields(tb testing.TB) ([]*model.CPAField, *model.AppError) {
	tb.Helper()
	rctx := request.TestContext(tb)
	groupID := th.CpaGroupID(tb)

	pfs, appErr := th.App.SearchPropertyFields(rctx, groupID, model.PropertyFieldSearchOpts{
		GroupID:    groupID,
		ObjectType: model.PropertyFieldObjectTypeUser,
		PerPage:    200,
	})
	if appErr != nil {
		return nil, appErr
	}

	cpaFields := make([]*model.CPAField, 0, len(pfs))
	for _, pf := range pfs {
		cpaField, err := model.NewCPAFieldFromPropertyField(pf)
		if err != nil {
			return nil, model.NewAppError("ListCPAFields", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		cpaFields = append(cpaFields, cpaField)
	}

	sort.Slice(cpaFields, func(i, j int) bool {
		return cpaFields[i].Attrs.SortOrder < cpaFields[j].Attrs.SortOrder
	})
	return cpaFields, nil
}

// CreateCPAField creates a CPA field for test fixture setup. Mirrors the
// old app.CreateCPAField behavior: sets defaults, calls SanitizeAndValidate,
// routes through CreatePropertyField so hooks run.
func (th *TestHelper) CreateCPAField(tb testing.TB, field *model.CPAField) (*model.CPAField, *model.AppError) {
	tb.Helper()
	rctx := request.TestContext(tb)
	groupID := th.CpaGroupID(tb)

	field.GroupID = groupID
	field.ObjectType = model.PropertyFieldObjectTypeUser
	field.TargetType = string(model.PropertyFieldTargetLevelSystem)

	if appErr := field.SanitizeAndValidate(); appErr != nil {
		return nil, appErr
	}

	created, appErr := th.App.CreatePropertyField(rctx, field.ToPropertyField(), false, "")
	if appErr != nil {
		return nil, appErr
	}

	cpaField, err := model.NewCPAFieldFromPropertyField(created)
	if err != nil {
		return nil, model.NewAppError("CreateCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return cpaField, nil
}

// PatchCPAField patches a CPA field, preserving CPA-specific constraints
// (no target_id / target_type patching).
func (th *TestHelper) PatchCPAField(tb testing.TB, fieldID string, patch *model.PropertyFieldPatch) (*model.CPAField, *model.AppError) {
	tb.Helper()
	rctx := request.TestContext(tb)

	existing, appErr := th.GetCPAField(tb, fieldID)
	if appErr != nil {
		return nil, appErr
	}

	if err := existing.Patch(patch); err != nil {
		return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.patch_field.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if appErr := existing.SanitizeAndValidate(); appErr != nil {
		return nil, appErr
	}

	groupID := th.CpaGroupID(tb)
	patched, appErr := th.App.UpdatePropertyField(rctx, groupID, existing.ToPropertyField(), false, "")
	if appErr != nil {
		if errors.Is(appErr, sql.ErrNoRows) {
			return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		}
		return nil, appErr
	}

	cpaField, err := model.NewCPAFieldFromPropertyField(patched)
	if err != nil {
		return nil, model.NewAppError("PatchCPAField", "app.custom_profile_attributes.property_field_conversion.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return cpaField, nil
}

// DeleteCPAField deletes a CPA field.
func (th *TestHelper) DeleteCPAField(tb testing.TB, fieldID string) *model.AppError {
	tb.Helper()
	rctx := request.TestContext(tb)
	groupID := th.CpaGroupID(tb)

	appErr := th.App.DeletePropertyField(rctx, groupID, fieldID, false, "")
	if appErr != nil {
		if errors.Is(appErr, sql.ErrNoRows) {
			return model.NewAppError("DeleteCPAField", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
		}
		return appErr
	}
	return nil
}

// GetCPAValue fetches a CPA value by ID.
func (th *TestHelper) GetCPAValue(tb testing.TB, valueID string) (*model.PropertyValue, *model.AppError) {
	tb.Helper()
	return th.App.GetPropertyValue(request.TestContext(tb), th.CpaGroupID(tb), valueID)
}

// ListCPAValues lists CPA values for a given user.
func (th *TestHelper) ListCPAValues(tb testing.TB, userID string) ([]*model.PropertyValue, *model.AppError) {
	tb.Helper()
	return th.App.SearchPropertyValues(request.TestContext(tb), th.CpaGroupID(tb), model.PropertyValueSearchOpts{
		TargetIDs: []string{userID},
		PerPage:   200,
	})
}

// PatchCPAValue upserts a single CPA value. Always passes the real
// objectType/targetID so the generic websocket event fires.
func (th *TestHelper) PatchCPAValue(tb testing.TB, userID, fieldID string, value json.RawMessage) (*model.PropertyValue, *model.AppError) {
	tb.Helper()
	values, appErr := th.PatchCPAValues(tb, userID, map[string]json.RawMessage{fieldID: value})
	if appErr != nil {
		return nil, appErr
	}
	if len(values) == 0 {
		return nil, model.NewAppError("PatchCPAValue", "app.custom_profile_attributes.property_value_upsert.app_error", nil, "upsert returned no results", http.StatusInternalServerError)
	}
	return values[0], nil
}

// PatchCPAValues upserts a batch of CPA values for a user, mirroring the
// field-existence + DeleteAt checks of the old app.PatchCPAValues.
func (th *TestHelper) PatchCPAValues(tb testing.TB, userID string, fieldValueMap map[string]json.RawMessage) ([]*model.PropertyValue, *model.AppError) {
	tb.Helper()
	rctx := request.TestContext(tb)
	groupID := th.CpaGroupID(tb)

	toUpdate := []*model.PropertyValue{}
	for fieldID, rawValue := range fieldValueMap {
		field, fieldErr := th.GetCPAField(tb, fieldID)
		if fieldErr != nil {
			return nil, fieldErr
		} else if field.DeleteAt > 0 {
			return nil, model.NewAppError("PatchCPAValues", "app.custom_profile_attributes.property_field_not_found.app_error", nil, "", http.StatusNotFound)
		}

		toUpdate = append(toUpdate, &model.PropertyValue{
			GroupID:    groupID,
			TargetType: model.PropertyValueTargetTypeUser,
			TargetID:   userID,
			FieldID:    fieldID,
			Value:      rawValue,
		})
	}

	return th.App.UpsertPropertyValues(rctx, toUpdate, model.PropertyFieldObjectTypeUser, userID, "")
}

// DeleteCPAValues deletes all CPA values for a user.
func (th *TestHelper) DeleteCPAValues(tb testing.TB, userID string) *model.AppError {
	tb.Helper()
	return th.App.DeletePropertyValuesForTarget(request.TestContext(tb), th.CpaGroupID(tb), model.PropertyFieldObjectTypeUser, userID)
}
