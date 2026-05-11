// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
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

	cpaGroupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("GetMaskedVisualAST", "app.pap.get_masked_visual_ast.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

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
// getHiddenValues returns the subset of stored condition values not visible to callerID.
// fieldsByName is pre-fetched by the caller to avoid N+1 lookups; a missing entry is
// treated as fail-closed (no hidden values injected for that condition).
func (a *App) getHiddenValues(rctx request.CTX, callerID string, stored *model.Condition, cpaGroupID string, fieldsByName map[string]*model.PropertyField) []string {
	if stored.ValueType == model.AttrValue {
		return nil
	}

	fieldName := extractFieldName(stored.Attribute)
	if fieldName == "" {
		return nil
	}

	field, ok := fieldsByName[fieldName]
	if !ok {
		return nil
	}

	switch field.GetAccessMode() {
	case model.PropertyAccessModeSourceOnly:
		return extractStringValues(stored.Value)
	case model.PropertyAccessModeSharedOnly:
		var visibleNames map[string]struct{}
		if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
			visibleNames = extractVisibleOptionNames(field)
		} else {
			visibleNames = a.getCallerTextValues(rctx, callerID, field, cpaGroupID)
		}
		var hidden []string
		for _, val := range extractStringValues(stored.Value) {
			if _, visible := visibleNames[val]; !visible {
				hidden = append(hidden, val)
			}
		}
		return hidden
	default:
		return nil
	}
}

// isScalarOperator reports whether the operator expects a single value (not a list).
// Used by merge-on-save to normalize the value shape after restoring the stored operator.
func isScalarOperator(op string) bool {
	switch op {
	case "==", "!=", ">", ">=", "<", "<=", "contains", "startsWith", "endsWith":
		return true
	}
	return false
}

// mergeConditionValues appends hiddenValues into the submitted condition's values,
// deduplicating. A nil submitted value is restored from hidden values alone.
func mergeConditionValues(submitted model.Condition, hiddenValues []string) model.Condition {
	if len(hiddenValues) == 0 {
		return submitted
	}

	merged := submitted

	switch v := submitted.Value.(type) {
	case []any:
		// Strip the masked-token sentinel from submitted values: it's the
		// server's own placeholder for hidden values (from a masked GET),
		// not a real value, and we're about to re-inject the actual stored
		// hidden values from hiddenValues.
		seen := make(map[string]struct{})
		cleaned := make([]any, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				if s == maskedTokenValue {
					continue
				}
				seen[s] = struct{}{}
			}
			cleaned = append(cleaned, item)
		}
		result := make([]any, 0, len(cleaned)+len(hiddenValues))
		result = append(result, cleaned...)
		for _, hidden := range hiddenValues {
			if _, exists := seen[hidden]; !exists {
				result = append(result, hidden)
			}
		}
		merged.Value = result

	case string:
		// Empty string and the masked-token sentinel both mean "no real value
		// submitted here"; restore from hidden values.
		if (v == "" || v == maskedTokenValue) && len(hiddenValues) > 0 {
			merged.Value = hiddenValues[0]
		}

	case nil:
		if len(hiddenValues) == 1 {
			merged.Value = hiddenValues[0]
		} else if len(hiddenValues) > 1 {
			result := make([]any, 0, len(hiddenValues))
			for _, h := range hiddenValues {
				result = append(result, h)
			}
			merged.Value = result
		}
	}

	return merged
}

// extractStringValues converts a condition's Value to a slice of strings.
func extractStringValues(value any) []string {
	switch v := value.(type) {
	case []any:
		var result []string
		for _, item := range v {
			if s, ok := item.(string); ok {
				result = append(result, s)
			}
		}
		return result
	case string:
		return []string{v}
	default:
		return nil
	}
}

// buildCELFromConditions reconstructs a CEL expression from conditions, joined with " && ".
func buildCELFromConditions(conditions []model.Condition) string {
	if len(conditions) == 0 {
		return "true"
	}

	parts := make([]string, 0, len(conditions))
	for _, cond := range conditions {
		cel := conditionToCEL(cond)
		if cel != "" {
			parts = append(parts, cel)
		}
	}

	if len(parts) == 0 {
		return "true"
	}

	return strings.Join(parts, " && ")
}

// conditionToCEL converts a single Condition to its CEL string representation.
func conditionToCEL(cond model.Condition) string {
	attr := cond.Attribute

	switch cond.Operator {
	case "==", "!=", ">", ">=", "<", "<=":
		if cond.Value == nil {
			return ""
		}
		return attr + " " + cond.Operator + " " + celValueLiteral(cond.Value)

	case "in":
		values := extractStringValues(cond.Value)
		if len(values) == 0 {
			return ""
		}
		if cond.AttributeType == "multiselect" {
			// multiselect: "v1" in attr && "v2" in attr
			inParts := make([]string, 0, len(values))
			for _, v := range values {
				inParts = append(inParts, celStringLiteral(v)+" in "+attr)
			}
			return strings.Join(inParts, " && ")
		}
		// select: attr in ["v1", "v2"]
		valLiterals := make([]string, 0, len(values))
		for _, v := range values {
			valLiterals = append(valLiterals, celStringLiteral(v))
		}
		return attr + " in [" + strings.Join(valLiterals, ", ") + "]"

	case "hasAnyOf":
		values := extractStringValues(cond.Value)
		if len(values) == 0 {
			return ""
		}
		orParts := make([]string, 0, len(values))
		for _, v := range values {
			orParts = append(orParts, celStringLiteral(v)+" in "+attr)
		}
		if len(orParts) == 1 {
			return orParts[0]
		}
		return "(" + strings.Join(orParts, " || ") + ")"

	case "hasAllOf":
		values := extractStringValues(cond.Value)
		if len(values) == 0 {
			return ""
		}
		andParts := make([]string, 0, len(values))
		for _, v := range values {
			andParts = append(andParts, celStringLiteral(v)+" in "+attr)
		}
		return strings.Join(andParts, " && ")

	case "contains", "startsWith", "endsWith":
		if cond.Value == nil {
			return ""
		}
		return attr + "." + cond.Operator + "(" + celValueLiteral(cond.Value) + ")"

	default:
		if cond.Value == nil {
			return ""
		}
		return attr + " " + cond.Operator + " " + celValueLiteral(cond.Value)
	}
}

// celStringLiteral wraps s in double quotes with backslash and quote escaping.
func celStringLiteral(s string) string {
	escaped := strings.ReplaceAll(s, `\`, `\\`)
	escaped = strings.ReplaceAll(escaped, `"`, `\"`)
	return `"` + escaped + `"`
}

// celValueLiteral returns the CEL literal for a condition value.
func celValueLiteral(value any) string {
	switch v := value.(type) {
	case string:
		return celStringLiteral(v)
	case float64:
		return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%f", v), "0"), ".")
	case int:
		return fmt.Sprintf("%d", v)
	case int64:
		return fmt.Sprintf("%d", v)
	case bool:
		if v {
			return "true"
		}
		return "false"
	case nil:
		return "null"
	default:
		return fmt.Sprintf("%v", v)
	}
}

// maskedTokenValue is the sentinel the frontend uses for masked values; never a valid attribute value.
const maskedTokenValue = "--------"

// validatePolicyExpressionValues checks that all submitted literal values are held by the caller.
// Returns the same generic error for every rejection to prevent value enumeration.
func (a *App) validatePolicyExpressionValues(rctx request.CTX, policy *model.AccessControlPolicy, callerID string) *model.AppError {
	cpaGroupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return model.NewAppError("validatePolicyExpressionValues", "app.pap.validate_expression_values.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)

	for _, rule := range policy.Rules {
		if rule.Expression == "" || rule.Expression == "true" {
			continue
		}

		visualAST, appErr := a.ExpressionToVisualAST(rctx, rule.Expression)
		if appErr != nil {
			return appErr
		}

		for _, cond := range visualAST.Conditions {
			if appErr := a.validateConditionValues(rctxWithCaller, &cond, cpaGroupID); appErr != nil {
				return appErr
			}
		}
	}

	return nil
}

// invalidValueError returns the same generic 400 for all write-path rejections (no enumeration leakage).
func invalidValueError() *model.AppError {
	return model.NewAppError("validatePolicyExpressionValues", "app.pap.save_policy.invalid_value", nil, "Invalid value.", http.StatusBadRequest)
}

// validateConditionValues checks that all literal values in a single condition are held by the caller.
func (a *App) validateConditionValues(rctx request.CTX, cond *model.Condition, cpaGroupID string) *model.AppError {
	if cond.ValueType == model.AttrValue {
		return nil
	}

	// The masked-token sentinel is what the server itself emits when masking the
	// raw CEL of policy GET / search responses. If the frontend round-trips a GET
	// response back to us unchanged (e.g. the admin only modified channel
	// assignment, not the rules), it will appear here. Skip it during validation;
	// mergeConditionValues will strip it from the merged result and re-inject the
	// actual hidden values from the stored policy.
	values := extractStringValues(cond.Value)
	nonTokenValues := make([]string, 0, len(values))
	for _, v := range values {
		if v != maskedTokenValue {
			nonTokenValues = append(nonTokenValues, v)
		}
	}

	fieldName := extractFieldName(cond.Attribute)
	if fieldName == "" {
		return nil
	}

	field, appErr := a.GetPropertyFieldByName(rctx, cpaGroupID, "", fieldName)
	if appErr != nil {
		return invalidValueError() // reject unknown fields to prevent probing
	}

	switch field.GetAccessMode() {
	case model.PropertyAccessModePublic:
		return nil
	case model.PropertyAccessModeSourceOnly:
		if len(nonTokenValues) > 0 {
			return invalidValueError()
		}
		return nil
	case model.PropertyAccessModeSharedOnly:
		var visibleNames map[string]struct{}
		if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
			visibleNames = extractVisibleOptionNames(field)
		} else {
			callerID, _ := CallerIDFromRequestContext(rctx)
			visibleNames = a.getCallerTextValues(rctx, callerID, field, cpaGroupID)
		}
		for _, v := range nonTokenValues {
			if _, visible := visibleNames[v]; !visible {
				return invalidValueError()
			}
		}
		return nil
	default:
		if len(nonTokenValues) > 0 {
			return invalidValueError()
		}
		return nil
	}
}


func (a *App) GetMaskedExpression(rctx request.CTX, expression string, callerID string) (string, *model.AppError) {
	if expression == "" || expression == "true" {
		return expression, nil
	}

	visualAST, appErr := a.ExpressionToVisualAST(rctx, expression)
	if appErr != nil {
		return "true", nil
	}

	cpaGroupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return "true", nil
	}

	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)

	for i := range visualAST.Conditions {
		a.maskConditionValuesWithToken(rctxWithCaller, callerID, &visualAST.Conditions[i], cpaGroupID)
	}

	return buildCELFromConditions(visualAST.Conditions), nil
}

// maskConditionValuesWithToken replaces non-held values with the masked token in place,
// preserving expression structure so the visual AST endpoint can still parse it.
func (a *App) maskConditionValuesWithToken(rctx request.CTX, callerID string, condition *model.Condition, cpaGroupID string) {
	if condition.ValueType == model.AttrValue {
		return
	}

	fieldName := extractFieldName(condition.Attribute)
	if fieldName == "" {
		return
	}

	field, appErr := a.GetPropertyFieldByName(rctx, cpaGroupID, "", fieldName)
	if appErr != nil {
		condition.Value = maskedTokenValue // fail closed
		return
	}

	switch field.GetAccessMode() {
	case model.PropertyAccessModePublic:
		return
	case model.PropertyAccessModeSourceOnly:
		condition.Value = maskedTokenValue
	case model.PropertyAccessModeSharedOnly:
		var visibleNames map[string]struct{}
		if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
			visibleNames = extractVisibleOptionNames(field)
		} else {
			visibleNames = a.getCallerTextValues(rctx, callerID, field, cpaGroupID)
		}
		replaceHiddenValuesWithToken(condition, visibleNames)
	default:
		condition.Value = maskedTokenValue
	}
}

// replaceHiddenValuesWithToken keeps visible values and appends a single masked token if any were hidden.
// One token regardless of count prevents count-based inference about the number of hidden values.
func replaceHiddenValuesWithToken(condition *model.Condition, visibleNames map[string]struct{}) {
	switch v := condition.Value.(type) {
	case []any:
		var result []any
		hasMasked := false
		for _, val := range v {
			if strVal, ok := val.(string); ok {
				if _, visible := visibleNames[strVal]; visible {
					result = append(result, val)
				} else {
					hasMasked = true
				}
			} else {
				result = append(result, val)
			}
		}
		if hasMasked {
			result = append(result, maskedTokenValue)
		}
		condition.Value = result
	case string:
		if _, visible := visibleNames[v]; !visible {
			condition.Value = maskedTokenValue
		}
	}
}

// MaskPolicyExpressions masks non-held literal values in all policy rule expressions, in place.
func (a *App) MaskPolicyExpressions(rctx request.CTX, policy *model.AccessControlPolicy, callerID string) {
	for i, rule := range policy.Rules {
		if rule.Expression == "" || rule.Expression == "true" {
			continue
		}
		maskedExpr, appErr := a.GetMaskedExpression(rctx, rule.Expression, callerID)
		if appErr != nil {
			policy.Rules[i].Expression = "true" // fail closed
			continue
		}
		policy.Rules[i].Expression = maskedExpr
	}
}


