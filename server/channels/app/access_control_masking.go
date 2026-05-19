// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// GetMaskedVisualAST converts the given CEL expression to a VisualExpression and
// filters each condition's literal values to the subset visible to callerID.
//
// Masking is attribute-based, not role-based: every caller (including system
// admins) sees only values they themselves hold for shared_only fields, all
// values for public fields, and no values for source_only fields. Conditions
// whose values are partially or fully filtered get HasMaskedValues=true so the
// client can render the masked-chip UI.
func (a *App) GetMaskedVisualAST(rctx request.CTX, expression string, callerID string) (*model.VisualExpression, *model.AppError) {
	visualAST, appErr := a.ExpressionToVisualAST(rctx, expression)
	if appErr != nil {
		return nil, appErr
	}
	if visualAST == nil || len(visualAST.Conditions) == 0 {
		return visualAST, nil
	}

	cpaGroup, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		return nil, model.NewAppError("GetMaskedVisualAST", "app.pap.get_masked_visual_ast.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}
	cpaGroupID := cpaGroup.ID

	// Embed callerID in context so GetPropertyFieldByName applies per-caller option filtering.
	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)

	// Pre-fetch all referenced fields once to avoid N+1 DB queries across conditions.
	fieldsByName := a.fetchConditionFields(rctxWithCaller, visualAST.Conditions, cpaGroupID)

	for i := range visualAST.Conditions {
		a.maskConditionValues(rctxWithCaller, callerID, &visualAST.Conditions[i], cpaGroupID, fieldsByName)
	}

	return visualAST, nil
}

// fetchConditionFields collects unique field names from conditions and fetches each once.
// Fields that fail lookup are omitted; maskConditionValues treats missing entries as fail-closed.
func (a *App) fetchConditionFields(rctx request.CTX, conditions []model.Condition, cpaGroupID string) map[string]*model.PropertyField {
	seen := make(map[string]bool)
	for _, c := range conditions {
		if c.ValueType == model.AttrValue {
			continue
		}
		if name := extractFieldName(c.Attribute); name != "" {
			seen[name] = true
		}
	}

	fields := make(map[string]*model.PropertyField, len(seen))
	for name := range seen {
		field, appErr := a.GetPropertyFieldByName(rctx, cpaGroupID, "", name)
		if appErr != nil {
			rctx.Logger().Warn("Failed to look up field for masking, failing closed",
				mlog.String("field_name", name),
				mlog.Err(appErr),
			)
			continue
		}
		fields[name] = field
	}
	return fields
}

// maskConditionValues applies masking to a single condition in place.
//
// Masking semantics differ by field type:
//
//   - select / multiselect (partial masking): each value in a multi-value
//     condition is independently masked or visible. A row may end up with some
//     visible chips plus the masked-token covering the omitted values.
//   - text (binary masking): a text condition is a single string comparison.
//     The condition's value is either visible in full (the caller's stored
//     text value matches it exactly) or fully masked. No partial chip behavior
//     is possible because there's no multi-value list to filter.
func (a *App) maskConditionValues(rctx request.CTX, callerID string, condition *model.Condition, cpaGroupID string, fieldsByName map[string]*model.PropertyField) {
	// AttrValue conditions compare two attributes (e.g. user.attr1 == user.attr2) — no literal values to mask.
	if condition.ValueType == model.AttrValue {
		return
	}

	fieldName := extractFieldName(condition.Attribute)
	if fieldName == "" {
		return
	}

	field, ok := fieldsByName[fieldName]
	if !ok {
		// Fail closed: field lookup failed at prefetch time.
		condition.Value = nil
		condition.HasMaskedValues = true
		return
	}

	switch field.GetAccessMode() {
	case model.PropertyAccessModePublic:
		// no-op
	case model.PropertyAccessModeSourceOnly:
		condition.Value = nil
		condition.HasMaskedValues = true
	case model.PropertyAccessModeSharedOnly:
		if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
			filterConditionValues(condition, extractVisibleOptionNames(field))
		} else {
			filterConditionValues(condition, a.getCallerTextValues(rctx, callerID, field, cpaGroupID))
		}
	default:
		// Unknown access mode: fail closed.
		condition.Value = nil
		condition.HasMaskedValues = true
	}
}

// extractFieldName strips the "user.attributes." prefix from a CEL attribute
// reference, returning just the property field name. Returns the empty string
// if the attribute is not a user-attribute reference.
func extractFieldName(attribute string) string {
	const prefix = "user.attributes."
	name := strings.TrimPrefix(attribute, prefix)
	if name == attribute || name == "" {
		return ""
	}
	return name
}

// extractVisibleOptionNames pulls option names from a pre-filtered PropertyField's
// Attrs["options"]. The field is expected to have already been filtered by
// PropertyAccessService.applyFieldReadAccessControl to the caller's holdings,
// so the names returned here are exactly what the caller can see.
func extractVisibleOptionNames(field *model.PropertyField) map[string]struct{} {
	names := make(map[string]struct{})
	if field.Attrs == nil {
		return names
	}

	optionsRaw, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return names
	}

	optionsSlice, ok := optionsRaw.([]any)
	if !ok {
		return names
	}

	for _, opt := range optionsSlice {
		optMap, ok := opt.(map[string]any)
		if !ok {
			continue
		}
		name, ok := optMap["name"].(string)
		if ok && name != "" {
			names[name] = struct{}{}
		}
	}

	return names
}

// getCallerTextValues returns the caller's stored text value(s) for the given
// text-type field, as the visible-names set used by filterConditionValues.
// A user has at most one text value per field, so this set has zero or one
// element. Empty values are treated as no value.
func (a *App) getCallerTextValues(rctx request.CTX, callerID string, field *model.PropertyField, cpaGroupID string) map[string]struct{} {
	visible := make(map[string]struct{})

	// Each (user, field) pair has at most one text value.
	values, appErr := a.SearchPropertyValues(rctx, cpaGroupID, model.PropertyValueSearchOpts{
		FieldID:   field.ID,
		TargetIDs: []string{callerID},
		PerPage:   1,
	})
	if appErr != nil {
		rctx.Logger().Warn("Failed to look up caller text value for masking, failing closed",
			mlog.String("field_id", field.ID),
			mlog.String("caller_id", callerID),
			mlog.Err(appErr),
		)
		return visible
	}

	for _, pv := range values {
		var textVal string
		if err := json.Unmarshal(pv.Value, &textVal); err != nil {
			rctx.Logger().Warn("Failed to unmarshal caller text value for masking, treating as no value",
				mlog.String("field_id", field.ID),
				mlog.String("caller_id", callerID),
				mlog.String("value_id", pv.ID),
				mlog.Err(err),
			)
			continue
		}
		if textVal != "" {
			visible[textVal] = struct{}{}
		}
	}

	return visible
}

// filterConditionValues drops any element of condition.Value that is not in the
// visibleNames set, setting HasMaskedValues=true if anything was dropped.
//
// For multi-value conditions ([]any), each string element is checked individually
// (partial masking). For single-value conditions (string), the whole value is
// either kept or replaced with nil (binary masking).
func filterConditionValues(condition *model.Condition, visibleNames map[string]struct{}) {
	switch v := condition.Value.(type) {
	case []any:
		filtered := make([]any, 0, len(v))
		totalStrings := 0
		for _, val := range v {
			strVal, ok := val.(string)
			if !ok {
				continue // non-string elements are not masking candidates
			}
			totalStrings++
			if _, visible := visibleNames[strVal]; visible {
				filtered = append(filtered, val)
			}
		}
		if len(filtered) < totalStrings {
			condition.HasMaskedValues = true
		}
		condition.Value = filtered

	case string:
		if _, visible := visibleNames[v]; !visible {
			condition.Value = nil
			condition.HasMaskedValues = true
		}
	}
}
