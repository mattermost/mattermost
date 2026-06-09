// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
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
// Lookup failures are logged and omitted from the returned map; read-path callers treat
// missing entries as fail-closed (mask the value). Write-path callers should additionally
// call requireAllFieldsResolved to refuse to proceed when any referenced field is missing.
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

// requireAllFieldsResolved returns the generic invalid-value error if any condition
// references a field name missing from fieldsByName. Write-path callers use this to refuse
// the save rather than silently strip hidden values from conditions whose fields could not
// be resolved. We return the same generic 400 used by the rest of write-path validation so
// unknown/deleted fields don't leak an enumeration signal distinct from hidden-value
// rejection — the actual field name is logged for operator diagnostics instead.
func requireAllFieldsResolved(rctx request.CTX, conditions []model.Condition, fieldsByName map[string]*model.PropertyField) *model.AppError {
	for _, c := range conditions {
		if c.ValueType == model.AttrValue {
			continue
		}
		name := extractFieldName(c.Attribute)
		if name == "" {
			continue
		}
		if _, ok := fieldsByName[name]; !ok {
			rctx.Logger().Warn("Field referenced by condition could not be resolved during write-path validation",
				mlog.String("field_name", name),
			)
			return invalidValueError()
		}
	}
	return nil
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
		// For scalar conditions the caller cannot edit a value they cannot see.
		// Always restore the stored hidden value regardless of what was submitted,
		// preventing a crafted save from overwriting a hidden stored value with a
		// different caller-visible string that passes validateConditionValues.
		if len(hiddenValues) > 0 {
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

// containsNonStringLiteral reports whether the condition value contains any
// non-string element (numeric, boolean, etc.). Used by the write-path to reject
// type-mismatched literals on property-backed conditions — without this guard,
// extractStringValues would silently drop such elements and let invalid CEL
// bypass the source_only / shared_only checks.
func containsNonStringLiteral(value any) bool {
	switch v := value.(type) {
	case nil, string:
		return false
	case []any:
		for _, item := range v {
			if _, ok := item.(string); !ok {
				return true
			}
		}
		return false
	default:
		// numeric, boolean, etc.
		return true
	}
}

// extractStringValues converts a condition's Value to a slice of strings.
// Non-string elements are silently dropped — write-path callers should pair
// this with containsNonStringLiteral to reject type-mismatched literals first.
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

// isVisualASTRepresentable reports whether buildCELFromConditions(ast) round-trips
// back to originalExpr. False means merging would silently rewrite the shape
// (typically || or grouping that the AST flattens into ANDs). Stopgap until the
// canonical AST walker lands.
func isVisualASTRepresentable(originalExpr string, ast *model.VisualExpression) bool {
	if ast == nil || len(ast.Conditions) == 0 {
		return originalExpr == "" || originalExpr == "true"
	}
	return normalizedEqual(originalExpr, buildCELFromConditions(ast.Conditions))
}

// normalizedEqual compares two CEL expressions modulo whitespace and quote style.
// Unbalanced quotes on either side count as not-equal (fail-closed).
func normalizedEqual(a, b string) bool {
	na, okA := normalizeForComparison(a)
	if !okA {
		return false
	}
	nb, okB := normalizeForComparison(b)
	if !okB {
		return false
	}
	return na == nb
}

// normalizeForComparison strips whitespace outside string literals and rewrites
// single quotes to double. String contents are preserved verbatim. Returns
// ok=false on unbalanced quotes.
func normalizeForComparison(s string) (string, bool) {
	var b strings.Builder
	b.Grow(len(s))
	var quote byte // 0 outside string literal; '"' or '\'' inside
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case quote == 0 && (c == '"' || c == '\''):
			quote = c
			b.WriteByte('"')
		case quote != 0 && c == '\\' && i+1 < len(s):
			// keep escapes verbatim
			b.WriteByte(c)
			b.WriteByte(s[i+1])
			i++
		case quote != 0 && c == quote:
			b.WriteByte('"')
			quote = 0
		case quote == 0 && (c == ' ' || c == '\t' || c == '\n' || c == '\r'):
			// drop whitespace outside strings
		default:
			b.WriteByte(c)
		}
	}
	if quote != 0 {
		return "", false
	}
	return b.String(), true
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
			// When the sole value is the masked-token sentinel, duplicate it into a
			// two-branch OR so that the parser can recover hasAnyOf on the next read.
			// A standalone "tok in attr" is promoted to hasAllOf by
			// mergeMultiselectConditions, which would display the wrong operator in the UI.
			if values[0] == maskedTokenValue {
				return "(" + orParts[0] + " || " + orParts[0] + ")"
			}
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

// celStringLiteral wraps s in a CEL-compatible double-quoted string literal.
// strconv.Quote produces Go syntax that overlaps with CEL's escape grammar
// (backslash, double quote, \a \b \f \n \r \t \v, \xHH, \uHHHH, \UHHHHHHHH),
// so it safely round-trips strings containing control characters, embedded
// quotes, or non-ASCII content — none of which the previous naive ReplaceAll
// handled. Attribute values that legitimately contain newlines or tabs would
// have produced broken CEL otherwise.
func celStringLiteral(s string) string {
	return strconv.Quote(s)
}

// celValueLiteral returns the CEL literal for a condition value.
func celValueLiteral(value any) string {
	switch v := value.(type) {
	case string:
		return celStringLiteral(v)
	case float64:
		// 'g' with precision -1 produces the shortest representation that
		// round-trips back to v exactly. Avoids the precision loss from
		// fmt.Sprintf("%f") which rounds to six fractional digits.
		return strconv.FormatFloat(v, 'g', -1, 64)
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
func (a *App) validatePolicyExpressionValues(rctx request.CTX, policy *model.AccessControlPolicy, callerID string) *model.AppError {
	cpaGroup, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		return model.NewAppError("validatePolicyExpressionValues", "app.pap.validate_expression_values.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}
	cpaGroupID := cpaGroup.ID

	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)

	// Parse all rule ASTs first and collect every referenced field so we can
	// pre-fetch in a single pass, avoiding N+1 lookups across conditions.
	rulesASTs := make([]*model.VisualExpression, 0, len(policy.Rules))
	var allConditions []model.Condition
	for _, rule := range policy.Rules {
		if rule.Expression == "" || rule.Expression == "true" {
			continue
		}
		visualAST, appErr := a.ExpressionToVisualAST(rctx, rule.Expression)
		if appErr != nil {
			return appErr
		}
		rulesASTs = append(rulesASTs, visualAST)
		allConditions = append(allConditions, visualAST.Conditions...)
	}

	fieldsByName := a.fetchConditionFields(rctxWithCaller, allConditions, cpaGroupID)
	if appErr := requireAllFieldsResolved(rctxWithCaller, allConditions, fieldsByName); appErr != nil {
		return appErr
	}

	for _, visualAST := range rulesASTs {
		for _, cond := range visualAST.Conditions {
			if appErr := a.validateConditionValues(rctxWithCaller, &cond, cpaGroupID, fieldsByName); appErr != nil {
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
// fieldsByName is pre-fetched by the caller to avoid N+1 lookups; a missing entry means the field
// could not be resolved (deleted, or DB error at prefetch time) — rejected with the generic error.
func (a *App) validateConditionValues(rctx request.CTX, cond *model.Condition, cpaGroupID string, fieldsByName map[string]*model.PropertyField) *model.AppError {
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

	field, ok := fieldsByName[fieldName]
	if !ok {
		return invalidValueError() // reject unknown fields to prevent probing
	}

	// Property-backed conditions must use string literals. Numeric / boolean values
	// would be silently dropped by extractStringValues above, letting them bypass the
	// source_only / shared_only checks. Reject them with the same generic error.
	if containsNonStringLiteral(cond.Value) {
		return invalidValueError()
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
		return "", appErr
	}

	cpaGroup, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		return "", appErr
	}
	cpaGroupID := cpaGroup.ID

	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)
	fieldsByName := a.fetchConditionFields(rctxWithCaller, visualAST.Conditions, cpaGroupID)

	hasMasked := false
	for i := range visualAST.Conditions {
		if a.maskConditionValuesWithToken(rctxWithCaller, callerID, &visualAST.Conditions[i], cpaGroupID, fieldsByName) {
			hasMasked = true
		}
	}
	if !hasMasked {
		return expression, nil
	}

	return buildCELFromConditions(visualAST.Conditions), nil
}

// maskConditionValuesWithToken replaces non-held values with the masked token in place,
// preserving expression structure so the visual AST endpoint can still parse it.
// fieldsByName is pre-fetched by the caller to avoid N+1 lookups; a missing entry
// is treated as fail-closed (whole value masked). Returns true if any value was masked.
func (a *App) maskConditionValuesWithToken(rctx request.CTX, callerID string, condition *model.Condition, cpaGroupID string, fieldsByName map[string]*model.PropertyField) bool {
	if condition.ValueType == model.AttrValue {
		return false
	}

	fieldName := extractFieldName(condition.Attribute)
	if fieldName == "" {
		return false
	}

	field, ok := fieldsByName[fieldName]
	if !ok {
		condition.Value = maskedTokenValue // fail closed
		return true
	}

	switch field.GetAccessMode() {
	case model.PropertyAccessModePublic:
		return false
	case model.PropertyAccessModeSourceOnly:
		condition.Value = maskedTokenValue
		return true
	case model.PropertyAccessModeSharedOnly:
		var visibleNames map[string]struct{}
		if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
			visibleNames = extractVisibleOptionNames(field)
		} else {
			visibleNames = a.getCallerTextValues(rctx, callerID, field, cpaGroupID)
		}
		return replaceHiddenValuesWithToken(condition, visibleNames)
	default:
		condition.Value = maskedTokenValue
		return true
	}
}

// replaceHiddenValuesWithToken keeps visible values and appends a single masked token if any were hidden.
// One token regardless of count prevents count-based inference about the number of hidden values.
// Returns true if any value was replaced.
func replaceHiddenValuesWithToken(condition *model.Condition, visibleNames map[string]struct{}) bool {
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
		return hasMasked
	case string:
		if _, visible := visibleNames[v]; !visible {
			condition.Value = maskedTokenValue
			return true
		}
	}
	return false
}

// MaskSimulationPolicyLiteralsForCaller re-applies attribute-value
// masking to every CEL expression and per-leaf ExpectedValue the
// simulator returned. Without this pass, the response would leak the
// literal values that mergeStoredPolicyExpressions re-injected before
// evaluation — the simulator's verdicts are correct because the
// engine sees the real (unmasked) policy, but the response surfaces
// (Blame.Expression, MergedRules expressions, every leaf in the
// evaluation tree) would otherwise carry those re-injected literals
// back to the caller.
//
// Masking is attribute-based, not role-based: system admins are NOT
// bypassed. A caller who doesn't hold the literal sees the
// "--------" sentinel regardless of role, mirroring the policy GET
// masking contract enforced by MaskPolicyExpressions.
//
// Failure handling is per-surface fail-closed: any masking error on
// a single expression clears that field (Expression -> "",
// ExpectedValue -> sentinel) rather than leaving the unmasked literal
// visible. A top-level CPA group lookup failure wipes every literal
// surface in the response.
//
// No-op when AttributeValueMasking is disabled — same gate as the
// stored-policy merge that precedes evaluation; either both run or
// neither does, so the response always matches the policy state that
// produced it.
func (a *App) MaskSimulationPolicyLiteralsForCaller(rctx request.CTX, resp *model.PolicySimulationResponse, callerID string) {
	if resp == nil || callerID == "" {
		return
	}
	if !a.Config().FeatureFlags.AttributeValueMasking {
		return
	}

	cpaGroup, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		rctx.Logger().Warn(
			"MaskSimulationPolicyLiteralsForCaller: failed to resolve CPA group, clearing every simulation literal as fail-closed default",
			mlog.Err(appErr),
		)
		clearAllSimulationLiterals(resp)
		return
	}

	mc := &simulationMaskContext{
		cpaGroupID:     cpaGroup.ID,
		rctxWithCaller: RequestContextWithCallerID(rctx, callerID),
		callerID:       callerID,
		fieldsByName:   map[string]*model.PropertyField{},
	}

	for i := range resp.Results {
		for action, dec := range resp.Results[i].Decisions {
			a.maskSimulationDecisionLiterals(&dec, mc)
			resp.Results[i].Decisions[action] = dec
		}
		for k := range resp.Results[i].Sessions {
			for action, dec := range resp.Results[i].Sessions[k].Decisions {
				a.maskSimulationDecisionLiterals(&dec, mc)
				resp.Results[i].Sessions[k].Decisions[action] = dec
			}
		}
	}
}

// simulationMaskContext is the per-request mask cache shared across
// every expression in a single simulate response. The CPA group ID
// and the request context (with callerID embedded so the property
// service applies per-caller read access control) are stable for the
// life of the call; fieldsByName grows lazily as new field names are
// encountered, so each unique field is fetched at most once even
// across hundreds of tree nodes.
type simulationMaskContext struct {
	cpaGroupID     string
	rctxWithCaller request.CTX
	callerID       string
	fieldsByName   map[string]*model.PropertyField
}

// maskExpressionWithCache parses `expression` through the Visual AST,
// hydrates any newly-referenced fields into mc.fieldsByName, and
// rewrites every literal value through maskConditionValuesWithToken
// using the shared cache. Returns "" on any parse / lookup failure
// so the caller can drop the surface entirely (fail-closed).
//
// Visual-AST flattening (||, !, nested parens collapse to a flat
// AND of conditions) is the same trade-off GetMaskedExpression
// already makes for the policy GET path — we re-use it here so that
// the masking contract is identical end-to-end. Callers that need
// to preserve compound structure (e.g. the tree-root rebuild for
// Blame.Expression) should source their text from
// maskSimulationEvaluationTree's child-rebuilt Expression instead.
func (a *App) maskExpressionWithCache(expression string, mc *simulationMaskContext) string {
	if expression == "" || expression == "true" {
		return expression
	}
	visualAST, appErr := a.ExpressionToVisualAST(mc.rctxWithCaller, expression)
	if appErr != nil {
		return ""
	}
	for _, c := range visualAST.Conditions {
		if c.ValueType == model.AttrValue {
			continue
		}
		name := extractFieldName(c.Attribute)
		if name == "" {
			continue
		}
		if _, ok := mc.fieldsByName[name]; ok {
			continue
		}
		field, appErr := a.GetPropertyFieldByName(mc.rctxWithCaller, mc.cpaGroupID, "", name)
		if appErr != nil {
			// Leave the entry absent so maskConditionValuesWithToken's
			// fail-closed branch overrides the value below — same
			// semantics as fetchConditionFields' Warn-and-omit path.
			continue
		}
		mc.fieldsByName[name] = field
	}
	for i := range visualAST.Conditions {
		a.maskConditionValuesWithToken(mc.rctxWithCaller, mc.callerID, &visualAST.Conditions[i], mc.cpaGroupID, mc.fieldsByName)
	}
	return buildCELFromConditions(visualAST.Conditions)
}

// maskSimulationDecisionLiterals masks every Expression and per-leaf
// ExpectedValue on every blame entry the action decision carries.
// Walks merged-rule sub-surfaces with the same rules so they stay in
// sync with the parent Blame.Expression.
func (a *App) maskSimulationDecisionLiterals(dec *model.PolicySimulationActionDecision, mc *simulationMaskContext) {
	for i := range dec.Blame {
		b := &dec.Blame[i]

		// Mask the evaluation tree first; the root's rebuilt
		// Expression preserves the original OR / NOT structure so
		// when we backfill Blame.Expression from it below the
		// caller-visible CEL keeps the same boolean shape the rule
		// author wrote. Without this we'd fall through to the
		// Visual-AST-flattening branch and "A || B" would surface as
		// "A && --------" — same security outcome but a misleading
		// trace.
		if b.EvaluationTree != nil {
			a.maskSimulationEvaluationTree(b.EvaluationTree, mc)
		}
		if b.Expression != "" {
			if b.EvaluationTree != nil {
				b.Expression = b.EvaluationTree.Expression
			} else {
				b.Expression = a.maskExpressionWithCache(b.Expression, mc)
			}
		}

		for j := range b.MergedRules {
			m := &b.MergedRules[j]
			if m.EvaluationTree != nil {
				a.maskSimulationEvaluationTree(m.EvaluationTree, mc)
			}
			if m.Expression != "" {
				if m.EvaluationTree != nil {
					m.Expression = m.EvaluationTree.Expression
				} else {
					m.Expression = a.maskExpressionWithCache(m.Expression, mc)
				}
			}
		}
	}
}

// maskSimulationEvaluationTree walks `node` and its children bottom-
// up. Leaf-shaped nodes (compare / function / other) have their
// Expression re-masked through maskExpressionWithCache and their
// ExpectedValue overwritten with the sentinel whenever the masker
// hid at least one literal in the leaf. Compound nodes (and / or /
// not) rebuild their Expression from the already-masked children's
// Expressions, preserving the original boolean shape — the
// Visual-AST flatten that maskExpressionWithCache uses on a leaf
// expression is harmless (a leaf has no inner OR / NOT to lose),
// but at the compound level it would collapse OR/NOT to AND and
// misrepresent the rule's logic to the caller.
func (a *App) maskSimulationEvaluationTree(node *model.PolicySimulationEvaluationNode, mc *simulationMaskContext) {
	if node == nil {
		return
	}
	for i := range node.Children {
		a.maskSimulationEvaluationTree(&node.Children[i], mc)
	}
	switch node.Kind {
	case model.PolicySimulationEvaluationKindAnd:
		node.Expression = joinChildExpressions(node.Children, "&&")
	case model.PolicySimulationEvaluationKindOr:
		node.Expression = joinChildExpressions(node.Children, "||")
	case model.PolicySimulationEvaluationKindNot:
		if len(node.Children) == 0 {
			node.Expression = ""
		} else if child := node.Children[0].Expression; child == "" {
			node.Expression = ""
		} else {
			node.Expression = "!(" + child + ")"
		}
	default:
		// compare / function / other — leaf-shaped. Mask the leaf
		// expression in place, then drop ExpectedValue to the
		// sentinel whenever the masker hid at least one literal —
		// the sentinel can never be a legitimate value (write-path
		// validation rejects it on save), so its presence in the
		// masked CEL is unambiguous evidence that masking applied.
		if node.Expression != "" {
			masked := a.maskExpressionWithCache(node.Expression, mc)
			if masked == "" {
				node.Expression = ""
				node.ExpectedValue = maskedTokenValue
			} else {
				if node.ExpectedValue != "" && strings.Contains(masked, maskedTokenValue) {
					node.ExpectedValue = maskedTokenValue
				}
				node.Expression = masked
			}
		}
		// ActualValue is the simulated user's recorded value —
		// independent from the rule literal we just masked above,
		// but just as sensitive under AVM. A caller who couldn't
		// see "il5" as a rule literal would still see "il5"
		// surface in the leaf's "Actual: il5" line without this
		// pass. Apply the same per-value access-mode check the rule
		// literal uses (source_only hides every value, shared_only
		// hides values the caller doesn't hold, public passes
		// through), so the trace stays in lockstep with the
		// policy GET masking contract end-to-end. Skips when the
		// leaf has no attribute path (function-call leaves with
		// non-attribute operands).
		if node.Attribute != "" && node.ActualValue != "" {
			a.maskLeafActualValue(node, mc)
		}
	}
}

// maskLeafActualValue replaces `node.ActualValue` with the masked
// token whenever the caller is not allowed to see that value for
// the leaf's underlying CPA field. Skips when the attribute path is
// not a user-attribute reference (e.g. function-call leaves with a
// non-attribute LHS). Fails closed by masking when the field can't
// be resolved.
func (a *App) maskLeafActualValue(node *model.PolicySimulationEvaluationNode, mc *simulationMaskContext) {
	fieldName := extractFieldName(node.Attribute)
	if fieldName == "" {
		return
	}
	field, ok := mc.fieldsByName[fieldName]
	if !ok {
		fetched, appErr := a.GetPropertyFieldByName(mc.rctxWithCaller, mc.cpaGroupID, "", fieldName)
		if appErr != nil {
			node.ActualValue = maskedTokenValue
			return
		}
		mc.fieldsByName[fieldName] = fetched
		field = fetched
	}
	if !a.callerCanSeeFieldValue(field, node.ActualValue, mc) {
		node.ActualValue = maskedTokenValue
	}
}

// callerCanSeeFieldValue reports whether the caller is allowed to
// see `value` for `field` under AVM semantics. Mirrors the per-
// access-mode logic that maskConditionValuesWithToken applies to
// rule literals so the simulator's user-data surfaces (ActualValue)
// stay in lockstep with the rule-literal surfaces (ExpectedValue /
// Expression). Unknown access modes fail closed to "not visible"
// so a new mode added later doesn't silently bypass the masker.
func (a *App) callerCanSeeFieldValue(field *model.PropertyField, value string, mc *simulationMaskContext) bool {
	switch field.GetAccessMode() {
	case model.PropertyAccessModePublic:
		return true
	case model.PropertyAccessModeSourceOnly:
		return false
	case model.PropertyAccessModeSharedOnly:
		var visibleNames map[string]struct{}
		if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
			visibleNames = extractVisibleOptionNames(field)
		} else {
			visibleNames = a.getCallerTextValues(mc.rctxWithCaller, mc.callerID, field, mc.cpaGroupID)
		}
		_, visible := visibleNames[value]
		return visible
	default:
		return false
	}
}

// joinChildExpressions wraps every non-empty child Expression in
// parens and joins them with " <op> ". Empty children (e.g. a leaf
// whose maskExpressionWithCache failed-closed) are skipped so the
// rebuilt parent doesn't carry a dangling operator. The parens are
// unconditional so the result stays unambiguous when the parent op
// has lower precedence than a child's internal op.
func joinChildExpressions(children []model.PolicySimulationEvaluationNode, op string) string {
	parts := make([]string, 0, len(children))
	for i := range children {
		if children[i].Expression == "" {
			continue
		}
		parts = append(parts, "("+children[i].Expression+")")
	}
	return strings.Join(parts, " "+op+" ")
}

// clearAllSimulationLiterals wipes every literal-carrying surface on
// `resp`: Expression / EvaluationTree on each Blame and each
// MergedRule, plus ExpectedValue on every leaf the tree contained.
// Companion to MaskSimulationPolicyLiteralsForCaller's top-level
// fail-closed branch: when the CPA group can't be resolved we don't
// know which fields are public vs masked, so we drop every literal
// rather than risk shipping a hidden value back to the caller.
func clearAllSimulationLiterals(resp *model.PolicySimulationResponse) {
	if resp == nil {
		return
	}
	for i := range resp.Results {
		for action, dec := range resp.Results[i].Decisions {
			clearDecisionLiterals(&dec)
			resp.Results[i].Decisions[action] = dec
		}
		for k := range resp.Results[i].Sessions {
			for action, dec := range resp.Results[i].Sessions[k].Decisions {
				clearDecisionLiterals(&dec)
				resp.Results[i].Sessions[k].Decisions[action] = dec
			}
		}
	}
}

func clearDecisionLiterals(dec *model.PolicySimulationActionDecision) {
	for i := range dec.Blame {
		b := &dec.Blame[i]
		b.Expression = ""
		if b.EvaluationTree != nil {
			clearEvaluationTreeLiterals(b.EvaluationTree)
		}
		for j := range b.MergedRules {
			b.MergedRules[j].Expression = ""
			if b.MergedRules[j].EvaluationTree != nil {
				clearEvaluationTreeLiterals(b.MergedRules[j].EvaluationTree)
			}
		}
	}
}

func clearEvaluationTreeLiterals(node *model.PolicySimulationEvaluationNode) {
	if node == nil {
		return
	}
	node.Expression = ""
	if node.ExpectedValue != "" {
		node.ExpectedValue = maskedTokenValue
	}
	// ActualValue is the simulated user's value — also a literal
	// the masker normally checks against per-caller AVM semantics.
	// When the CPA group lookup fails we can't tell whether the
	// field is public or protected, so we collapse to the sentinel
	// rather than risk leaving an actual value visible.
	if node.ActualValue != "" {
		node.ActualValue = maskedTokenValue
	}
	for i := range node.Children {
		clearEvaluationTreeLiterals(&node.Children[i])
	}
}

// maskFailClosedSentinel is the CEL expression written into a response rule when masking
// cannot safely produce a redacted version (parse failure or CPA group unavailable).
// "false" is used because it is deny-all if ever evaluated literally, matching the
// fail-closed intent. This value only ever appears in API responses — the stored DB
// expression is never overwritten by this path.
const maskFailClosedSentinel = "false"

// MaskPolicyExpressions masks non-held literal values in all policy rule expressions, in place.
// Fails closed (sets a rule to maskFailClosedSentinel) if its expression cannot be parsed or masked.
func (a *App) MaskPolicyExpressions(rctx request.CTX, policy *model.AccessControlPolicy, callerID string) {
	cpaGroup, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		rctx.Logger().Warn("MaskPolicyExpressions: failed to resolve CPA group, masking all rules closed",
			mlog.Err(appErr),
		)
		for i, rule := range policy.Rules {
			if rule.Expression == "" || rule.Expression == "true" {
				continue
			}
			policy.Rules[i].Expression = maskFailClosedSentinel
		}
		return
	}
	cpaGroupID := cpaGroup.ID

	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)

	// Parse each rule's AST once and collect all conditions so we can pre-fetch
	// every referenced field in a single pass, avoiding N+1 lookups across rules.
	asts := make([]*model.VisualExpression, len(policy.Rules))
	var allConditions []model.Condition
	for i, rule := range policy.Rules {
		if rule.Expression == "" || rule.Expression == "true" {
			continue
		}
		ast, appErr := a.ExpressionToVisualAST(rctx, rule.Expression)
		if appErr != nil {
			policy.Rules[i].Expression = maskFailClosedSentinel // fail closed: deny-all sentinel, response-only
			continue
		}
		asts[i] = ast
		allConditions = append(allConditions, ast.Conditions...)
	}

	fieldsByName := a.fetchConditionFields(rctxWithCaller, allConditions, cpaGroupID)

	for i, ast := range asts {
		if ast == nil {
			continue
		}
		hasMasked := false
		for j := range ast.Conditions {
			if a.maskConditionValuesWithToken(rctxWithCaller, callerID, &ast.Conditions[j], cpaGroupID, fieldsByName) {
				hasMasked = true
			}
		}
		if hasMasked {
			policy.Rules[i].Expression = buildCELFromConditions(ast.Conditions)
		}
	}
}
