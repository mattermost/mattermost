// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// errBoundsCheckFailed marks a bounds rule that can't be checked because the
// data it depends on is broken, such as a missing parent object. It refuses the
// write, unlike a rule that simply has nothing to compare against.
var errBoundsCheckFailed = errors.New("bounds check failed")

// errBoundsViolated marks a value that breaks a bounds rule.
var errBoundsViolated = errors.New("bounds violated")

// compareByRank checks next against ref by option rank under op. Which value
// ref is (the parent's or the object's own) is the caller's to resolve, and
// empty values are the caller's to handle: an empty one fails the check.
// Messages never carry option IDs or ranks, since the writer may not be allowed
// to see ref.
func compareByRank(field *model.PropertyField, op model.PropertyBoundsOperator, next, ref json.RawMessage) error {
	ranks := buildOptionRankMap(field)
	nextRank, nextOK := singleOptionRank(field.Type, next, ranks)
	refRank, refOK := singleOptionRank(field.Type, ref, ranks)
	if !nextOK || !refOK {
		return fmt.Errorf("field %s: operator %q: a value can't be ranked: %w", field.ID, op, errBoundsCheckFailed)
	}

	var ok bool
	switch op {
	case model.PropertyBoundsOperatorAtOrBelow:
		ok = nextRank <= refRank
	case model.PropertyBoundsOperatorAtOrAbove:
		ok = nextRank >= refRank
	default:
		// Save refuses unknown operators, so this is bad data; passing would quietly stop the rule applying.
		return fmt.Errorf("field %s: unknown operator %q: %w", field.ID, op, errBoundsCheckFailed)
	}
	if !ok {
		return fmt.Errorf("field %s: operator %q: %w", field.ID, op, errBoundsViolated)
	}
	return nil
}

// boundsParent returns the field and the object that hold the value a parent
// rule on field compares against, for a value written to targetID. Every
// failure to find them refuses the write: a store error is returned wrapped, and
// anything missing or ambiguous wraps errBoundsCheckFailed. Messages name IDs,
// never a value.
func (h *AccessControlAttributeValidationHook) boundsParent(rctx request.CTX, field *model.PropertyField, targetID string) (parentField *model.PropertyField, parentTargetType, parentTargetID string, err error) {
	switch field.ObjectType {
	case model.PropertyFieldObjectTypeChannel, model.PropertyFieldObjectTypeUser:
		parentTargetType, parentTargetID = model.PropertyValueTargetTypeSystem, model.PropertyValueSystemTargetID
	case model.PropertyFieldObjectTypePost:
		if h.postChannelResolver == nil {
			return nil, "", "", fmt.Errorf("field %s: no way to find the channel of post %s: %w", field.ID, targetID, errBoundsCheckFailed)
		}
		channelID, resolveErr := h.postChannelResolver(rctx, targetID)
		if resolveErr != nil {
			return nil, "", "", fmt.Errorf("field %s: could not find the channel of post %s: %v: %w", field.ID, targetID, resolveErr, errBoundsCheckFailed)
		}
		if channelID == "" {
			return nil, "", "", fmt.Errorf("field %s: post %s has no channel: %w", field.ID, targetID, errBoundsCheckFailed)
		}
		parentTargetType, parentTargetID = model.PropertyValueTargetTypeChannel, channelID
	default:
		return nil, "", "", fmt.Errorf("field %s: object type %q has no parent: %w", field.ID, field.ObjectType, errBoundsCheckFailed)
	}

	matches, err := h.propertyService.parentMatchingFields(rctx, field)
	if err != nil {
		return nil, "", "", fmt.Errorf("field %s: failed to look up the parent's field for target %s: %w", field.ID, targetID, err)
	}
	if len(matches) != 1 {
		found := "none"
		if len(matches) > 1 {
			found = "more than one"
		}
		return nil, "", "", fmt.Errorf("field %s: target %s needs exactly one parent field, found %s: %w", field.ID, targetID, found, errBoundsCheckFailed)
	}
	return matches[0], parentTargetType, parentTargetID, nil
}

// checkParentRule decides whether value, about to be written to field, satisfies
// a parent rule. An empty parent value isn't a limit: the walk moves up only
// through parent fields carrying the same rule, so an object isn't held to a
// level that its own level isn't. Nothing up the chain having a value means no
// limit. The parent's value is read from the store directly, so masking doesn't
// loosen the rule.
func (h *AccessControlAttributeValidationHook) checkParentRule(rctx request.CTX, field *model.PropertyField, rule model.PropertyBoundsRule, value *model.PropertyValue) error {
	if model.IsEmptyPropertyValue(value.Value) {
		return nil
	}

	// The walk ends at the system, which has no parent and so never carries a parent rule.
	current, targetID := field, value.TargetID
	for {
		parentField, parentTargetType, parentTargetID, err := h.boundsParent(rctx, current, targetID)
		if err != nil {
			return err
		}

		values, err := h.propertyService.searchPropertyValues(rctx, field.GroupID, model.PropertyValueSearchOpts{
			FieldID:    parentField.ID,
			TargetType: parentTargetType,
			TargetIDs:  []string{parentTargetID},
			PerPage:    1,
		})
		if err != nil {
			return fmt.Errorf("field %s: failed to read the parent's value for target %s: %w", field.ID, targetID, err)
		}

		// A user's clear leaves a null-valued row behind, so a row isn't proof of a value.
		if len(values) > 0 && !model.IsEmptyPropertyValue(values[0].Value) {
			return compareByRank(field, rule.Operator, value.Value, values[0].Value)
		}
		if !slices.Contains(parentField.Bounds, rule) {
			return nil
		}
		current, targetID = parentField, parentTargetID
	}
}

// fieldGoverned reports whether any bounds or mutability rule applies to field's values. Values of
// other fields skip every check here, so ordinary writes pay no extra cost.
func fieldGoverned(field *model.PropertyField) bool {
	return len(field.Bounds) > 0 || field.Mutability.OrMutable() != model.PropertyFieldMutabilityMutable
}

// storedValueMatters reports whether checking a write to field means comparing it with the object's
// own stored value, which is what makes the write conditional on that value not having changed.
func storedValueMatters(field *model.PropertyField) bool {
	return field.Mutability.OrMutable() != model.PropertyFieldMutabilityMutable ||
		slices.ContainsFunc(field.Bounds, func(r model.PropertyBoundsRule) bool { return r.Reference == model.PropertyBoundsReferenceSelf })
}

// enforceBounds is the one entry point for the bounds and mutability checks on a value write. The
// request is refused whole on the first value that breaks a rule.
//
// Stored values are read from master and recorded on the request, so the write lands only if each
// row is still what the check judged against. That is what stops two simultaneous first writes
// both passing write-once.
func (h *AccessControlAttributeValidationHook) enforceBounds(rctx request.CTX, values []*model.PropertyValue, fieldMap map[string]*model.PropertyField) error {
	var governed []*model.PropertyValue
	seen := make(map[store.PropertyValueKey]struct{})
	targetsByField := make(map[string][]string)
	for _, v := range values {
		field, ok := fieldMap[v.FieldID]
		if !ok || !fieldGoverned(field) {
			continue
		}
		key := store.PropertyValueKey{FieldID: v.FieldID, TargetID: v.TargetID}
		if _, dup := seen[key]; dup {
			return fmt.Errorf("field %s: target %s is written more than once: %w", v.FieldID, v.TargetID, ErrInvalidValue)
		}
		seen[key] = struct{}{}
		governed = append(governed, v)
		if storedValueMatters(field) {
			targetsByField[v.FieldID] = append(targetsByField[v.FieldID], v.TargetID)
		}
	}

	var conditions *valueWriteConditions
	if len(targetsByField) > 0 {
		// Only the service's write methods attach a record, and hooks run only inside them, so this
		// guards against a caller outside those methods rather than a path users reach.
		if conditions = valueWriteConditionsFrom(rctx); conditions == nil {
			return errors.New("no write conditions on the request")
		}
	}

	stored := make(map[store.PropertyValueKey]*model.PropertyValue)
	for fieldID, targetIDs := range targetsByField {
		field := fieldMap[fieldID]
		rows, err := h.propertyService.searchPropertyValues(store.RequestContextWithMaster(rctx), field.GroupID, model.PropertyValueSearchOpts{
			FieldID:   fieldID,
			TargetIDs: targetIDs,
			PerPage:   len(targetIDs),
		})
		if err != nil {
			return fmt.Errorf("field %s: failed to read the stored values: %w", fieldID, err)
		}
		for _, row := range rows {
			stored[store.PropertyValueKey{FieldID: fieldID, TargetID: row.TargetID}] = row
		}
		for _, targetID := range targetIDs {
			conditions.expectStored(fieldID, targetID, stored[store.PropertyValueKey{FieldID: fieldID, TargetID: targetID}])
		}
	}

	for _, v := range governed {
		var storedValue json.RawMessage
		if row := stored[store.PropertyValueKey{FieldID: v.FieldID, TargetID: v.TargetID}]; row != nil && !model.IsEmptyPropertyValue(row.Value) {
			storedValue = row.Value
		}
		// A soft delete is a clear.
		next := v.Value
		if v.DeleteAt != 0 {
			next = nil
		}
		field := fieldMap[v.FieldID]
		if err := checkMutability(field, storedValue, next); err != nil {
			return err
		}
		for _, rule := range field.Bounds {
			var err error
			switch rule.Reference {
			case model.PropertyBoundsReferenceSelf:
				err = checkSelfRule(field, rule, storedValue, next)
			case model.PropertyBoundsReferenceParent:
				// Records no read: the container is another object whose value can change between this read
				// and the write, and that takes two writes within milliseconds, one an admin's.
				checked := *v
				checked.Value = next
				err = h.checkParentRule(store.RequestContextWithMaster(rctx), field, rule, &checked)
			default:
				// Save refuses unknown references, so this is bad data; skipping would quietly stop the rule applying.
				err = fmt.Errorf("field %s: unknown reference %q: %w", field.ID, rule.Reference, errBoundsCheckFailed)
			}
			if err != nil {
				return boundsRefusal(err)
			}
		}
	}
	return nil
}

// checkSelfRule decides whether next, replacing stored, satisfies a rule that compares an object with
// its own value. stored is nil when the object has no value; next is empty for a clear.
func checkSelfRule(field *model.PropertyField, rule model.PropertyBoundsRule, stored, next json.RawMessage) error {
	if stored == nil || samePropertyValue(stored, next) {
		return nil
	}
	// Clearing is the biggest change there is, and allowing it would let a writer clear a value and
	// then make any "first" write.
	if model.IsEmptyPropertyValue(next) {
		return fmt.Errorf("field %s: operator %q: a value can't be cleared: %w", field.ID, rule.Operator, errBoundsViolated)
	}
	return compareByRank(field, rule.Operator, next, stored)
}

// boundsRefusal turns a bounds sentinel into the AppError the caller sees, keeping the sentinel
// reachable through Unwrap. Details come from err, which never names a value or option. Any other
// error is returned as is.
//
// Each key is written inline: i18n-extract only sees IDs passed literally to NewAppError.
func boundsRefusal(err error) error {
	switch {
	case errors.Is(err, errBoundsViolated):
		return model.NewAppError("UpsertPropertyValues", "app.property_value.bounds_violated.app_error", nil, err.Error(), http.StatusForbidden).Wrap(err)
	case errors.Is(err, errBoundsCheckFailed):
		return model.NewAppError("UpsertPropertyValues", "app.property_value.bounds_check_failed.app_error", nil, err.Error(), http.StatusConflict).Wrap(err)
	}
	return err
}

// checkMutability decides whether field's mutability permits replacing stored with next. stored is
// nil when the object has no value; next is empty for a clear.
func checkMutability(field *model.PropertyField, stored, next json.RawMessage) error {
	// Writing the stored value again changes nothing, so re-saving an unchanged form never fails.
	if samePropertyValue(stored, next) {
		return nil
	}
	switch field.Mutability.OrMutable() {
	case model.PropertyFieldMutabilityMutable:
		return nil
	case model.PropertyFieldMutabilityWriteOnce:
		if stored == nil {
			return nil
		}
	}
	// set_on_create, and any mutability this server doesn't recognise: a mutability must never
	// quietly stop applying.
	return newMutabilityError(field)
}

// samePropertyValue compares decoded JSON: Postgres returns jsonb with its own spacing, so a client
// echoing a stored value back can differ byte for byte. Array order still counts, and two empty
// values are the same.
func samePropertyValue(a, b json.RawMessage) bool {
	if model.IsEmptyPropertyValue(a) || model.IsEmptyPropertyValue(b) {
		return model.IsEmptyPropertyValue(a) && model.IsEmptyPropertyValue(b)
	}
	var x, y any
	if json.Unmarshal(a, &x) != nil || json.Unmarshal(b, &y) != nil {
		return false
	}
	return reflect.DeepEqual(x, y)
}

// newMutabilityError returns the refusal for a write a field's mutability forbids, written like
// newChangePolicyError. Details name the field only, never a value or option.
//
// Each key is written inline: i18n-extract only sees IDs passed literally to NewAppError.
func newMutabilityError(field *model.PropertyField) error {
	mutability := field.Mutability.OrMutable()
	details := fmt.Sprintf("field %s: mutability %s does not permit this change", field.ID, mutability)
	if mutability == model.PropertyFieldMutabilityWriteOnce {
		return model.NewAppError("UpsertPropertyValues", "app.property_value.write_once.app_error", nil, details, http.StatusForbidden)
	}
	return model.NewAppError("UpsertPropertyValues", "app.property_value.set_on_create.app_error", nil, details, http.StatusForbidden)
}

// clearRefusal returns the refusal for clearing a set value of field, or nil when clears are
// allowed. It is non-nil exactly when storedValueMatters: a clear is judged by the same rules as
// any other change to a stored value. Same errors as the write path, so a refused clear tells the
// caller nothing about the value.
func clearRefusal(field *model.PropertyField) error {
	if field.Mutability.OrMutable() != model.PropertyFieldMutabilityMutable {
		return newMutabilityError(field)
	}
	if slices.ContainsFunc(field.Bounds, func(r model.PropertyBoundsRule) bool { return r.Reference == model.PropertyBoundsReferenceSelf }) {
		return boundsRefusal(fmt.Errorf("field %s: a value can't be cleared: %w", field.ID, errBoundsViolated))
	}
	return nil
}

// refuseLockedRowDelete refuses deleting the value row id when its field refuses clears. A null
// row is refused too: a by-ID delete can't be made conditional on the value, so letting a null
// row go would let it race a first write and make a second "first" write possible.
func (h *AccessControlAttributeValidationHook) refuseLockedRowDelete(rctx request.CTX, groupID, id string) error {
	master := store.RequestContextWithMaster(rctx)
	rows, err := h.propertyService.searchPropertyValues(master, groupID, model.PropertyValueSearchOpts{IDs: []string{id}, PerPage: 1})
	if err != nil {
		return fmt.Errorf("failed to read value %s before deleting it: %w", id, err)
	}
	// No live row: nothing to protect, and the store handles the missing ID.
	if len(rows) == 0 {
		return nil
	}
	return h.refuseLockedFieldClear(master, groupID, rows[0].FieldID)
}

// refuseLockedFieldClear returns the field's clearRefusal, reading the field from master.
func (h *AccessControlAttributeValidationHook) refuseLockedFieldClear(master request.CTX, groupID, fieldID string) error {
	fields, err := h.propertyService.getPropertyFields(master, groupID, []string{fieldID})
	if errors.Is(err, ErrFieldNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("failed to read field %s before clearing its values: %w", fieldID, err)
	}
	return clearRefusal(fields[0])
}

// refuseLockedTargetDelete refuses deleting everything on a target when it holds a set value of a
// field that refuses clears, and otherwise tells the delete to leave those fields' rows alone. A
// first write that lands between this read and the delete keeps its value, the same outcome as
// the delete having run first.
func (h *AccessControlAttributeValidationHook) refuseLockedTargetDelete(rctx request.CTX, groupID, targetType, targetID string) error {
	master := store.RequestContextWithMaster(rctx)
	// Loads every live field of the group with its options on each call; target-wide deletes are
	// rare and plugin-only, so there's no cache.
	fields, err := h.propertyService.fieldStore.GetForGroup(master, groupID)
	if err != nil {
		return fmt.Errorf("failed to read the group's fields before deleting values: %w", err)
	}
	locked := make(map[string]*model.PropertyField)
	for _, f := range fields {
		if clearRefusal(f) != nil {
			locked[f.ID] = f
		}
	}
	if len(locked) == 0 {
		return nil
	}

	values, err := h.getValuesForTarget(master, groupID, targetType, targetID)
	if err != nil {
		return err
	}
	for _, v := range values {
		if f, ok := locked[v.FieldID]; ok && !model.IsEmptyPropertyValue(v.Value) {
			return clearRefusal(f)
		}
	}

	conditions := valueWriteConditionsFrom(rctx)
	if conditions == nil {
		return errors.New("no write conditions on the request")
	}
	for id := range locked {
		conditions.keepField(id)
	}
	return nil
}
