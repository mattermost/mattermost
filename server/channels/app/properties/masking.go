// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"bytes"
	"encoding/json"
	"maps"
	"slices"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// A field is masked when it carries a permissions.masking object at all --
// even an empty one. What masking applies to a field, and where the caller's
// holdings are read from, is resolved here; matching a caller against it is
// elsewhere in this package, and filtering a read on the answer is elsewhere
// still.
//
// Masking is declared where the scheme lives, not on every field that shares
// it: only a template or a field with no LinkedFieldID may carry a masking
// object. A field linked to a template inherits the template's object whole
// -- including its except list -- and any masking of its own is ignored
// rather than merged, so a stray one (from a direct store write, or a data
// migration that has not caught up) can never widen what a linked field's own
// masking would have narrowed. The resolution is therefore flat: a linked
// field's masking is its template's, and any other field's is its own.
//
// Holdings resolve the same way: a template's own mask_by_field_id, if it
// sets one, names the field a caller's holdings live on; if it sets none, the
// holdings live on the field being read itself -- not on the template that
// was consulted for the masking object, when the two differ.

// fieldMasking is the resolved masking answer for one field: the masking
// object that applies (nil when the field is not masked) and the ID of the
// field the caller's holdings are read from.
type fieldMasking struct {
	masking         *model.Masking
	holdingsFieldID string
}

// maskingContext memoizes, within one hook call that reads several values on
// one field, everything this phase needs more than once: the fieldMasking
// resolution above, and the caller's holdings on whatever field
// mask_by_field_id names -- the same "resolve once per batch, not once per
// item" problem valueWriteAccessCache already solves for writes. A batch read
// of 50 values on one field must not load the template, or search the
// caller's holdings, 50 times.
type maskingContext struct {
	fieldMasking      map[string]fieldMasking
	holdingsValues    map[string][]*model.PropertyValue
	holdingsOptionIDs map[string]map[string]struct{}
}

// newMaskingContext returns an empty maskingContext, built once per hook call
// that reads values or options through the masking filter.
func newMaskingContext() maskingContext {
	return maskingContext{
		fieldMasking:      make(map[string]fieldMasking),
		holdingsValues:    make(map[string][]*model.PropertyValue),
		holdingsOptionIDs: make(map[string]map[string]struct{}),
	}
}

// resolve returns the masking that applies to field and where its holdings
// live, computing it once per field ID for the lifetime of the
// maskingContext.
func (c maskingContext) resolve(h *AccessControlHook, field *model.PropertyField) (fieldMasking, error) {
	if fm, ok := c.fieldMasking[field.ID]; ok {
		return fm, nil
	}
	fm, err := h.resolveFieldMasking(field)
	if err != nil {
		return fieldMasking{}, err
	}
	c.fieldMasking[field.ID] = fm
	return fm, nil
}

// callerValuesForHoldings returns the caller's raw values on holdingsFieldID,
// searching the store once per holdings field ID for the lifetime of this
// maskingContext -- every field masked against the same holdings field shares
// one search rather than issuing its own.
func (c maskingContext) callerValuesForHoldings(h *AccessControlHook, groupID, holdingsFieldID, callerID string) ([]*model.PropertyValue, error) {
	if values, ok := c.holdingsValues[holdingsFieldID]; ok {
		return values, nil
	}
	values, err := h.getCallerValuesForField(groupID, holdingsFieldID, callerID)
	if err != nil {
		return nil, err
	}
	c.holdingsValues[holdingsFieldID] = values
	return values, nil
}

// callerOptionIDsForHoldings returns the option IDs the caller holds on
// holdingsFieldID, parsed with fieldType -- the type of the field being read,
// which the holdings field is guaranteed to share with it. Memoized
// separately from callerValuesForHoldings, per holdings field ID.
func (c maskingContext) callerOptionIDsForHoldings(h *AccessControlHook, groupID, holdingsFieldID, callerID string, fieldType model.PropertyFieldType) (map[string]struct{}, error) {
	if ids, ok := c.holdingsOptionIDs[holdingsFieldID]; ok {
		return ids, nil
	}
	ids, err := h.getCallerOptionIDsForField(groupID, holdingsFieldID, callerID, fieldType)
	if err != nil {
		return nil, err
	}
	c.holdingsOptionIDs[holdingsFieldID] = ids
	return ids, nil
}

// resolveFieldMasking answers what masks field and where the caller's
// holdings for it are read from. An unmasked field resolves to a zero
// fieldMasking (masking is nil).
func (h *AccessControlHook) resolveFieldMasking(field *model.PropertyField) (fieldMasking, error) {
	target := field
	if field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
		template, err := h.propertyService.getPropertyField(field.GroupID, *field.LinkedFieldID)
		if err != nil {
			return fieldMasking{}, errors.Wrapf(err, "failed to resolve masking template %q for field %q", *field.LinkedFieldID, field.ID)
		}
		// The field's own masking, if it has one, was rejected on save and is
		// ignored here rather than merged -- only the template's applies.
		target = template
	}

	if target.Permissions == nil || target.Permissions.Masking == nil {
		return fieldMasking{}, nil
	}

	masking := target.Permissions.Masking
	// Default to the field being read, not target -- target is the template
	// when field links to one, and an unset mask_by_field_id means holdings
	// live on field itself, never on the template consulted for the masking
	// object.
	holdingsFieldID := field.ID
	if masking.MaskByFieldID != "" {
		holdingsFieldID = masking.MaskByFieldID
	}

	return fieldMasking{masking: masking, holdingsFieldID: holdingsFieldID}, nil
}

// exempt reports whether callerID, acting under scope, is named in except.
// Exemption is explicit -- holding a grant confers none (§2.6) -- so this
// only ever matches an identity except actually lists, and skips the masking
// filter alone: the §2.5 permission gate still runs regardless of the answer.
//
// A machine caller matches the identity callerOwnerIdentity reports for it,
// mirroring how permissionsGrantAllows resolves a machine's identity. A human
// caller matches a user entry naming their ID, or a role entry naming a role
// they hold -- asking the injected roleLister only when except actually
// carries a role entry, the same guard propertyGrantForHuman uses so an
// ordinary masked field pays no store read. A nil roleLister, or one that
// resolves no roles, matches no role entry.
//
// An empty callerID is never exempt. model.CallerIDLocalAdmin is not a
// machine and not a real user ID, so it is only exempt when except names it
// explicitly as a user entry -- masking does not inherit the ladder's
// local-admin bypass.
func (h *AccessControlHook) exempt(except []model.Identity, callerID, scope string) bool {
	if callerID == "" || len(except) == 0 {
		return false
	}

	if h.isMachineCaller(callerID) {
		ownerID, ownerType, _ := h.callerOwnerIdentity(callerID, scope)
		for _, id := range except {
			if id.Type == ownerType && id.ID == ownerID {
				return true
			}
		}
		return false
	}

	for _, id := range except {
		if id.Type == model.PropertyOwnerTypeUser && id.ID == callerID {
			return true
		}
	}

	hasRoleEntry := false
	for _, id := range except {
		if id.Type == model.PropertyOwnerTypeRole {
			hasRoleEntry = true
			break
		}
	}
	if !hasRoleEntry || h.roleLister == nil {
		return false
	}
	for _, role := range h.roleLister(callerID) {
		for _, id := range except {
			if id.Type == model.PropertyOwnerTypeRole && id.ID == role {
				return true
			}
		}
	}
	return false
}

// maskValue returns what callerID may see of value, given the masking fm
// already resolved for the field it belongs to: the value as stored when it
// overlaps what the caller holds, or nil when it does not. One rule per field
// type, and never a clamp, approximation or placeholder -- callers get part
// of the truth or none of it.
//
// This runs only on the branch permissionsAllows already admitted; a caller
// the gate refused never reaches it, and masking can only narrow that answer
// further, never grant a read the gate denied.
func (h *AccessControlHook) maskValue(rctx request.CTX, c maskingContext, field *model.PropertyField, fm fieldMasking, value *model.PropertyValue, callerID string) *model.PropertyValue {
	switch field.Type {
	case model.PropertyFieldTypeSelect, model.PropertyFieldTypeMultiselect, model.PropertyFieldTypeRank:
		return h.maskOptionValue(c, field, fm, value, callerID)
	case model.PropertyFieldTypeGraph:
		return h.maskGraphValue(rctx, c, field, fm, value, callerID)
	default:
		return h.maskScalarValue(c, field, fm, value, callerID)
	}
}

// maskOptionValue answers select, multiselect and rank alike: the value the
// caller may see is the intersection of the options it names with the
// options the caller holds on the holdings field, an exact-option-membership
// rule with no ordering to it. select and rank hold at most one option, so
// their intersection has at most one element; multiselect's may have several.
// A caller holding nothing, or an intersection of none, sees nothing.
func (h *AccessControlHook) maskOptionValue(c maskingContext, field *model.PropertyField, fm fieldMasking, value *model.PropertyValue, callerID string) *model.PropertyValue {
	callerOptionIDs, err := c.callerOptionIDsForHoldings(h, field.GroupID, fm.holdingsFieldID, callerID, field.Type)
	if err != nil || len(callerOptionIDs) == 0 {
		return nil
	}

	targetOptionIDs, err := h.extractOptionIDsFromValue(field.Type, value.Value)
	if err != nil || len(targetOptionIDs) == 0 {
		return nil
	}

	intersection := make([]string, 0, len(targetOptionIDs))
	for id := range targetOptionIDs {
		if _, ok := callerOptionIDs[id]; ok {
			intersection = append(intersection, id)
		}
	}
	if len(intersection) == 0 {
		return nil
	}

	// select and rank are select-shaped: exactly one option, so intersection
	// has at most one element and it is marshaled bare; multiselect's may
	// have several and is marshaled as the list.
	toMarshal := any(intersection[0])
	if field.Type == model.PropertyFieldTypeMultiselect {
		toMarshal = intersection
	}

	jsonValue, marshalErr := json.Marshal(toMarshal)
	if marshalErr != nil {
		return nil
	}
	filtered := *value
	filtered.Value = jsonValue
	return &filtered
}

// maskGraphValue answers a graph field's value the way filterSharedOnlyGraphValue
// does for the legacy shared_only path -- covered options stand as they are and an
// uncovered one is replaced by the covered options below it -- but reading the
// caller's holdings from fm.holdingsFieldID rather than always from field itself,
// since a linked field's holdings can live on the template's mask_by_field_id.
// Any failure to resolve coverage fails closed and is logged, never falls
// through to the unfiltered value.
func (h *AccessControlHook) maskGraphValue(rctx request.CTX, c maskingContext, field *model.PropertyField, fm fieldMasking, value *model.PropertyValue, callerID string) *model.PropertyValue {
	callerOptionIDs, err := c.callerOptionIDsForHoldings(h, field.GroupID, fm.holdingsFieldID, callerID, field.Type)
	if err != nil {
		logHiddenGraphValue(rctx, field, value, err)
		return nil
	}
	if len(callerOptionIDs) == 0 {
		return nil
	}

	targetOptionIDs, err := h.extractOptionIDsFromValue(field.Type, value.Value)
	if err != nil {
		logHiddenGraphValue(rctx, field, value, err)
		return nil
	}
	if len(targetOptionIDs) == 0 {
		return nil
	}

	visible, err := h.propertyService.clampToCoverage(rctx, field,
		slices.Collect(maps.Keys(targetOptionIDs)), slices.Collect(maps.Keys(callerOptionIDs)))
	if err != nil {
		logHiddenGraphValue(rctx, field, value, err)
		return nil
	}
	if len(visible) == 0 {
		return nil
	}

	jsonValue, err := json.Marshal(visible)
	if err != nil {
		logHiddenGraphValue(rctx, field, value, err)
		return nil
	}

	filtered := *value
	filtered.Value = jsonValue
	return &filtered
}

// maskScalarValue applies binary masking to a non-option field's value: the
// value as stored when it equals one of the caller's own stored values on the
// holdings field (compared as stored bytes), nil otherwise. Caller and target
// may legitimately store nothing, in which case the value is hidden.
func (h *AccessControlHook) maskScalarValue(c maskingContext, field *model.PropertyField, fm fieldMasking, value *model.PropertyValue, callerID string) *model.PropertyValue {
	if value == nil || len(value.Value) == 0 {
		return nil
	}

	callerValues, err := c.callerValuesForHoldings(h, field.GroupID, fm.holdingsFieldID, callerID)
	if err != nil || len(callerValues) == 0 {
		return nil
	}

	for _, cv := range callerValues {
		if bytes.Equal(cv.Value, value.Value) {
			filtered := *value
			return &filtered
		}
	}
	return nil
}
