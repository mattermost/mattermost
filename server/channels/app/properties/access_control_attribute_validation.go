// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

var (
	ErrInvalidFieldAttrs = errors.New("invalid field attrs")
	ErrInvalidValue      = errors.New("invalid property value")
	ErrAdminRequired     = errors.New("admin privileges required")
)

// PermissionChecker checks whether a user has a specific permission.
// This avoids a circular dependency between the properties and app packages.
type PermissionChecker func(userID string, permission *model.Permission) bool

// AccessControlAttributeValidationHook validates and sanitizes property field attributes
// and values for managed property groups. It owns the full attr pipeline
// for these groups:
//
//   - validates field Name against the CEL-safe identifier rules
//     ([model.ValidateCPAFieldName]); on update this fires only when Name
//     actually changes, so pre-existing fields with non-conforming names
//     remain editable on all other attrs (lenient grandfather)
//   - trims whitespace on string attrs
//   - applies the visibility default when unset
//   - clears attrs that don't apply to the field type (options on non-select,
//     ldap/saml on non-text fields)
//   - auto-assigns IDs to options that lack one and validates option shape
//   - validates visibility, value_type, managed, display_name, and sort_order
//   - validates property values for text fields against value_type
//     constraints (email, url, phone)
//   - enforces that managed="admin" can only be set by callers with
//     PermissionManageSystem, and keeps PermissionValues in sync with the
//     managed attribute
//
// The hook only applies to groups whose IDs are in managedGroupIDs.
type AccessControlAttributeValidationHook struct {
	BasePropertyHook
	propertyService   *PropertyService
	managedGroupIDs   map[string]struct{}
	permissionChecker PermissionChecker
}

var _ PropertyHook = (*AccessControlAttributeValidationHook)(nil)

// NewAccessControlAttributeValidationHook creates a hook that validates field attributes and
// values for the given property groups.
func NewAccessControlAttributeValidationHook(ps *PropertyService, permChecker PermissionChecker, managedGroupIDs ...string) *AccessControlAttributeValidationHook {
	ids := make(map[string]struct{}, len(managedGroupIDs))
	for _, id := range managedGroupIDs {
		ids[id] = struct{}{}
	}
	return &AccessControlAttributeValidationHook{
		propertyService:   ps,
		managedGroupIDs:   ids,
		permissionChecker: permChecker,
	}
}

func (h *AccessControlAttributeValidationHook) isGroupManaged(groupID string) bool {
	_, ok := h.managedGroupIDs[groupID]
	return ok
}

// sanitizeAndValidateFieldAttrs trims string attrs, applies the visibility
// default, clears attrs that don't apply to the field type, validates each
// attr, and auto-IDs+validates options for select-shaped fields. Mutates
// field.Attrs in place. prevType is the field's type before this operation.
// prevType is empty on creation of a new field.
func (h *AccessControlAttributeValidationHook) sanitizeAndValidateFieldAttrs(field *model.PropertyField, prevType model.PropertyFieldType) error {
	if field.Attrs == nil {
		field.Attrs = model.StringInterface{}
	}

	for _, key := range trimmedFieldAttrKeys {
		if v, ok := field.Attrs[key].(string); ok {
			field.Attrs[key] = strings.TrimSpace(v)
		}
	}

	if v, _ := field.Attrs[model.PropertyFieldAttrVisibility].(string); v == "" {
		field.Attrs[model.PropertyFieldAttrVisibility] = model.PropertyFieldVisibilityWhenSet
	}

	// Type-based attr clearing: select-shaped fields keep options, only text
	// supports external sync, and admin-managed fields can never be synced
	// (mutual exclusivity).
	isSelect := field.Type.SupportsOptions()
	isText := field.Type == model.PropertyFieldTypeText
	managed, _ := field.Attrs[model.PropertyFieldAttrManaged].(string)

	if !isSelect {
		delete(field.Attrs, model.PropertyFieldAttributeOptions)
	}
	if !isText {
		delete(field.Attrs, model.PropertyFieldAttrLDAP)
		delete(field.Attrs, model.PropertyFieldAttrSAML)
	}

	if err := model.ValidatePropertyFieldVisibility(field); err != nil {
		return fmt.Errorf("%s: %w", err.Error(), ErrInvalidFieldAttrs)
	}
	if isText {
		if vt, _ := field.Attrs[model.PropertyFieldAttrValueType].(string); vt != "" && !model.IsValidPropertyFieldValueType(vt) {
			return fmt.Errorf("invalid value_type %q: %w", vt, ErrInvalidFieldAttrs)
		}
	}
	if managed != "" && managed != "admin" {
		return fmt.Errorf("invalid managed %q (must be empty or %q): %w", managed, "admin", ErrInvalidFieldAttrs)
	}
	if dn, _ := field.Attrs[model.PropertyFieldAttrDisplayName].(string); utf8.RuneCountInString(dn) > model.PropertyFieldNameMaxRunes {
		return fmt.Errorf("display_name exceeds max length of %d runes: %w", model.PropertyFieldNameMaxRunes, ErrInvalidFieldAttrs)
	}
	if isSelect {
		if err := h.sanitizeAndValidateOptions(field, prevType); err != nil {
			return err
		}
	}
	if err := model.ValidatePropertyFieldSortOrder(field); err != nil {
		return fmt.Errorf("%s: %w", err.Error(), ErrInvalidFieldAttrs)
	}
	return nil
}

// trimmedFieldAttrKeys lists the string-valued attrs the hook trims on the
// way in. Listed explicitly rather than iterating Attrs to avoid touching
// keys this hook doesn't own (e.g. plugin-set attrs).
var trimmedFieldAttrKeys = []string{
	model.PropertyFieldAttrVisibility,
	model.PropertyFieldAttrValueType,
	model.PropertyFieldAttrManaged,
	model.PropertyFieldAttrLDAP,
	model.PropertyFieldAttrSAML,
	model.PropertyFieldAttrDisplayName,
}

// sanitizeAndValidateOptions auto-assigns IDs to options without one,
// validates the resulting shape, and writes the options back in the
// canonical attrs form ([]any of map[string]any) that the rest of the
// codebase expects (see PropertyField.EnsureOptionIDs). The typed slice
// is used internally for validation only; persisting it would force
// every downstream reader of attrs["options"] to handle two shapes.
func (h *AccessControlAttributeValidationHook) sanitizeAndValidateOptions(field *model.PropertyField, prevType model.PropertyFieldType) error {
	rawOptions, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok || rawOptions == nil {
		return nil
	}

	data, err := json.Marshal(rawOptions)
	if err != nil {
		return fmt.Errorf("invalid options: %s: %w", err, ErrInvalidFieldAttrs)
	}
	var options model.PropertyOptions[*model.CustomProfileAttributesSelectOption]
	if err = json.Unmarshal(data, &options); err != nil {
		return fmt.Errorf("invalid options: %s: %w", err, ErrInvalidFieldAttrs)
	}

	// Rank handling.
	//
	// For non-rank fields, rank is not meaningful, but we keep any values that
	// are present instead of stripping them: that way a rank->select->rank
	// round-trip preserves the option ordering. The values ride along
	// untouched and unvalidated (zero, negative, and duplicate ranks are all
	// fine here); a later conversion into rank normalizes whatever it finds.
	//
	// For rank fields, a conversion from another type first repairs the
	// incoming ranks: they come from an arbitrary source (plain select options,
	// API-set values) and may be missing, duplicated, or non-sequential, so we
	// renumber them to a clean, gap-free 1..N sequence preserving relative
	// order rather than rejecting the request. Authoring a rank field directly
	// (create, or a rank->rank edit) does not repair — the caller owns the
	// values.
	//
	// validateRankOptions then runs on every rank path and is the single source
	// of truth for what a persisted rank field may contain. For direct
	// authoring it rejects the caller's mistake; after a normalize it is a
	// postcondition check that fails closed if normalization and validation
	// ever diverge. That belt-and-suspenders matters here because invalid rank
	// data fails open — it silently denies access at read time (see the matview
	// and buildRankMap) instead of erroring — so we must never persist it.
	if field.Type == model.PropertyFieldTypeRank {
		if prevType != "" && prevType != model.PropertyFieldTypeRank {
			normalizeOptionRanks(options)
		}
		if err = validateRankOptions(options); err != nil {
			return err
		}
	}

	for i := range options {
		if options[i].ID == "" {
			options[i].ID = model.NewId()
		}
	}
	if err = options.IsValid(); err != nil {
		return fmt.Errorf("invalid options: %s: %w", err, ErrInvalidFieldAttrs)
	}

	normalized, err := json.Marshal(options)
	if err != nil {
		return fmt.Errorf("invalid options: %s: %w", err, ErrInvalidFieldAttrs)
	}
	var canonical []any
	if err = json.Unmarshal(normalized, &canonical); err != nil {
		return fmt.Errorf("invalid options: %s: %w", err, ErrInvalidFieldAttrs)
	}
	field.Attrs[model.PropertyFieldAttributeOptions] = canonical
	return nil
}

// validateRankOptions enforces that every option on a rank field carries a
// positive, unique rank. It is the single source of truth for rank validity
// and runs on every rank path: it rejects a directly-authored field (create or
// rank->rank edit) whose ranks the caller got wrong, and double-checks the
// output of normalizeOptionRanks on a conversion (which should always pass, so
// a failure there signals the two have diverged and must not be persisted).
func validateRankOptions(options model.PropertyOptions[*model.CustomProfileAttributesSelectOption]) error {
	ranks := make(map[int]struct{}, len(options))
	for i, opt := range options {
		if opt.Rank == nil {
			return fmt.Errorf("invalid options: option at index %d is missing rank for rank field: %w", i, ErrInvalidFieldAttrs)
		}
		rank := *opt.Rank
		if rank <= 0 {
			return fmt.Errorf("invalid options: option rank must be a positive integer, got %d at index %d: %w", rank, i, ErrInvalidFieldAttrs)
		}
		if _, exists := ranks[rank]; exists {
			return fmt.Errorf("invalid options: duplicate option rank %d at index %d: %w", rank, i, ErrInvalidFieldAttrs)
		}
		ranks[rank] = struct{}{}
	}
	return nil
}

// normalizeOptionRanks rewrites every option's rank to a contiguous 1..N
// sequence, preserving relative order, when an arbitrary set of options is
// converted into a rank field. Options are stable-sorted by their current rank
// so that existing order is kept and duplicate ranks break ties by array
// position; options with no rank sort last (a newly-added option never
// silently outranks the existing hierarchy). The result is the gap-free,
// duplicate-free numbering the rank UI expects, and is idempotent: an already
// 1..N field re-normalizes to itself. Mutates the options in place.
func normalizeOptionRanks(options model.PropertyOptions[*model.CustomProfileAttributesSelectOption]) {
	order := make([]int, len(options))
	for i := range options {
		order[i] = i
	}
	sort.SliceStable(order, func(a, b int) bool {
		return rankSortKey(options[order[a]].Rank) < rankSortKey(options[order[b]].Rank)
	})
	for seq, idx := range order {
		rank := seq + 1
		options[idx].Rank = &rank
	}
}

// rankSortKey maps an option's rank to its sort key, treating a missing rank as
// the largest possible value so rank-less options sort after ranked ones.
func rankSortKey(rank *int) int {
	if rank == nil {
		return math.MaxInt
	}
	return *rank
}

// enforceGroupPermissions pins schema-edit permissions for fields in
// managed groups and applies the managed=admin upgrade to PermissionValues:
//   - PermissionField and PermissionOptions are always set to sysadmin so
//     that only admins can modify field definitions and options.
//   - When managed="admin", PermissionValues is set to sysadmin. This is
//     gated on PermissionManageSystem; callers without an identifiable
//     caller ID (e.g. internal callers with no session on rctx) are
//     treated as non-admin and rejected.
//   - Otherwise, PermissionValues is left as-is when set, and default-filled
//     by ObjectType when nil (member for user fields, sysadmin for system
//     and template). Caller pins are never downgraded.
func (h *AccessControlAttributeValidationHook) enforceGroupPermissions(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	sysadmin := model.PermissionLevelSysadmin

	if managed, _ := field.Attrs[model.PropertyFieldAttrManaged].(string); managed == "admin" {
		// Verify the caller has admin privileges. Default-deny if the
		// permission checker isn't wired up or if the caller is
		// unidentifiable — we never silently promote to sysadmin.
		if h.permissionChecker == nil {
			return nil, fmt.Errorf("missing permission to set managed=admin: no permission checker configured: %w", ErrAdminRequired)
		}
		callerID := h.propertyService.extractCallerID(rctx)
		if callerID == "" || !h.permissionChecker(callerID, model.PermissionManageSystem) {
			return nil, fmt.Errorf("missing permission to set managed=admin: only system admins can set managed=admin: %w", ErrAdminRequired)
		}
		field.PermissionValues = &sysadmin
	} else if field.PermissionValues == nil {
		defaultLevel := defaultPermissionValuesForObjectType(field.ObjectType)
		field.PermissionValues = &defaultLevel
	}

	// Fields in managed groups always require sysadmin for field/options edits.
	field.PermissionField = &sysadmin
	field.PermissionOptions = &sysadmin

	return field, nil
}

// defaultPermissionValuesForObjectType returns the PermissionValues level a
// field should default to when the caller doesn't pin one. User fields are
// member-writable so users can set their own values; system and template
// fields attach to admin-owned scopes and require sysadmin.
func defaultPermissionValuesForObjectType(objectType string) model.PermissionLevel {
	switch objectType {
	case model.PropertyFieldObjectTypeSystem, model.PropertyFieldObjectTypeTemplate:
		return model.PermissionLevelSysadmin
	default:
		return model.PermissionLevelMember
	}
}

func (h *AccessControlAttributeValidationHook) PreCreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(field.GroupID) {
		return field, nil
	}

	// Names in managed groups are referenced from ABAC policy expressions
	// (user.attributes.<name>), so they must satisfy the CEL grammar and
	// avoid CEL reserved words. Returning the AppError directly preserves
	// its specific i18n key through the HTTP layer's mapPropertyServiceError
	// fallback (no sentinel wrap).
	if appErr := model.ValidateCPAFieldName(field.Name); appErr != nil {
		return nil, appErr
	}

	// Create: no prior type, so a rank field here is authored directly and its
	// ranks are validated strictly rather than repaired.
	if err := h.sanitizeAndValidateFieldAttrs(field, ""); err != nil {
		return nil, err
	}

	return h.enforceGroupPermissions(rctx, field)
}

func (h *AccessControlAttributeValidationHook) PreUpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(groupID) {
		return field, nil
	}

	// Lenient grandfather: only validate Name against CEL rules when it
	// actually changes, so pre-existing fields whose names predate this
	// validation remain editable on all other attrs.
	existing, err := h.propertyService.getPropertyField(groupID, field.ID)
	if err != nil {
		return nil, err
	}
	if existing.Name != field.Name {
		if appErr := model.ValidateCPAFieldName(field.Name); appErr != nil {
			return nil, appErr
		}
	}

	if err := h.sanitizeAndValidateFieldAttrs(field, existing.Type); err != nil {
		return nil, err
	}

	return h.enforceGroupPermissions(rctx, field)
}

func (h *AccessControlAttributeValidationHook) PreUpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if len(fields) == 0 || !h.isGroupManaged(groupID) {
		return fields, nil
	}

	// Single batched read for the lenient-grandfather name check; a missing
	// ID falls through to the store, which surfaces the not-found error.
	fieldIDs := make([]string, len(fields))
	for i, f := range fields {
		fieldIDs[i] = f.ID
	}
	existingFields, err := h.propertyService.getPropertyFields(groupID, fieldIDs)
	if err != nil {
		return nil, err
	}
	existingByID := make(map[string]*model.PropertyField, len(existingFields))
	for _, ex := range existingFields {
		existingByID[ex.ID] = ex
	}

	for i, field := range fields {
		existing := existingByID[field.ID]
		if existing != nil && existing.Name != field.Name {
			if appErr := model.ValidateCPAFieldName(field.Name); appErr != nil {
				return nil, fmt.Errorf("field %s: %w", field.ID, appErr)
			}
		}

		// prevType stays empty when the field isn't found (the store surfaces
		// the not-found error later); strict rank validation is the safe
		// default for that path.
		var prevType model.PropertyFieldType
		if existing != nil {
			prevType = existing.Type
		}
		if err := h.sanitizeAndValidateFieldAttrs(field, prevType); err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}

		updated, err := h.enforceGroupPermissions(rctx, field)
		if err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}
		fields[i] = updated
	}

	return fields, nil
}

// extractOptionIDs extracts the set of valid option IDs from a
// select or multiselect PropertyField's attrs. Returns nil if the
// field has no options.
func extractOptionIDs(field *model.PropertyField) (map[string]struct{}, error) {
	if field.Attrs == nil {
		return nil, nil
	}

	rawOptions, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok || rawOptions == nil {
		return nil, nil
	}

	data, err := json.Marshal(rawOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal options: %w", err)
	}

	var options []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &options); err != nil {
		return nil, fmt.Errorf("invalid options format: %w", err)
	}

	ids := make(map[string]struct{}, len(options))
	for _, opt := range options {
		if opt.ID != "" {
			ids[opt.ID] = struct{}{}
		}
	}
	return ids, nil
}

// validateValueAgainstField checks a property value against field-type
// constraints:
//   - text: max length, value_type format (email, url, phone)
//   - select: option ID must exist in the field's options
//   - multiselect: all option IDs must exist
//   - user: value must be a valid Mattermost ID
//   - multiuser: all values must be valid Mattermost IDs
func (h *AccessControlAttributeValidationHook) validateValueAgainstField(field *model.PropertyField, value *model.PropertyValue) error {
	switch field.Type {
	case model.PropertyFieldTypeText:
		var str string
		if err := json.Unmarshal(value.Value, &str); err != nil {
			return fmt.Errorf("expected string value: %w", err)
		}
		if len(strings.TrimSpace(str)) > model.PropertyFieldValueTypeTextMaxLength {
			return fmt.Errorf("text value exceeds maximum length of %d characters", model.PropertyFieldValueTypeTextMaxLength)
		}

		valueType := model.GetPropertyFieldValueType(field)
		if valueType == "" {
			return nil
		}
		return model.ValidatePropertyValueForValueType(valueType, value.Value)

	case model.PropertyFieldTypeSelect, model.PropertyFieldTypeRank:
		var str string
		if err := json.Unmarshal(value.Value, &str); err != nil {
			return fmt.Errorf("expected string value for select field: %w", err)
		}
		if str == "" {
			return nil
		}
		optionIDs, err := extractOptionIDs(field)
		if err != nil {
			return fmt.Errorf("failed to extract options: %w", err)
		}
		if _, ok := optionIDs[str]; !ok {
			return fmt.Errorf("option %q does not exist", str)
		}

	case model.PropertyFieldTypeMultiselect:
		var values []string
		if err := json.Unmarshal(value.Value, &values); err != nil {
			return fmt.Errorf("expected string array value for multiselect field: %w", err)
		}
		optionIDs, err := extractOptionIDs(field)
		if err != nil {
			return fmt.Errorf("failed to extract options: %w", err)
		}
		for _, v := range values {
			if _, ok := optionIDs[v]; !ok {
				return fmt.Errorf("option %q does not exist", v)
			}
		}

	case model.PropertyFieldTypeUser:
		var str string
		if err := json.Unmarshal(value.Value, &str); err != nil {
			return fmt.Errorf("expected string value for user field: %w", err)
		}
		if str != "" && !model.IsValidId(str) {
			return fmt.Errorf("invalid user id")
		}

	case model.PropertyFieldTypeMultiuser:
		var values []string
		if err := json.Unmarshal(value.Value, &values); err != nil {
			return fmt.Errorf("expected string array value for multiuser field: %w", err)
		}
		for _, v := range values {
			if !model.IsValidId(v) {
				return fmt.Errorf("invalid user id: %s", v)
			}
		}
	}

	return nil
}

func (h *AccessControlAttributeValidationHook) validateValues(values []*model.PropertyValue) error {
	if len(values) == 0 {
		return nil
	}

	groupID := values[0].GroupID
	if !h.isGroupManaged(groupID) {
		return nil
	}

	// Collect unique field IDs
	fieldIDSet := make(map[string]struct{})
	for _, v := range values {
		fieldIDSet[v.FieldID] = struct{}{}
	}
	fieldIDs := make([]string, 0, len(fieldIDSet))
	for id := range fieldIDSet {
		fieldIDs = append(fieldIDs, id)
	}

	fields, err := h.propertyService.getPropertyFields(groupID, fieldIDs)
	if err != nil {
		return fmt.Errorf("failed to fetch fields for validation: %w", err)
	}

	fieldMap := make(map[string]*model.PropertyField, len(fields))
	for _, f := range fields {
		fieldMap[f.ID] = f
	}

	for _, value := range values {
		field, ok := fieldMap[value.FieldID]
		if !ok {
			return fmt.Errorf("field %s: %w", value.FieldID, ErrFieldNotFound)
		}
		if err := h.validateValueAgainstField(field, value); err != nil {
			return fmt.Errorf("field %s: %s: %w", value.FieldID, err.Error(), ErrInvalidValue)
		}
	}

	return nil
}

func (h *AccessControlAttributeValidationHook) PreUpsertPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validateValues([]*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AccessControlAttributeValidationHook) PreUpsertPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validateValues(values); err != nil {
		return nil, err
	}
	return values, nil
}

func (h *AccessControlAttributeValidationHook) PreCreatePropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validateValues([]*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AccessControlAttributeValidationHook) PreCreatePropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validateValues(values); err != nil {
		return nil, err
	}
	return values, nil
}

func (h *AccessControlAttributeValidationHook) PreUpdatePropertyValue(_ request.CTX, _ string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validateValues([]*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AccessControlAttributeValidationHook) PreUpdatePropertyValues(_ request.CTX, _ string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validateValues(values); err != nil {
		return nil, err
	}
	return values, nil
}
