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
	"strings"

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

// boundsRuleContainedValues is the audited rule for a container value whose change would put the
// values beneath it out of bounds.
const boundsRuleContainedValues = "contained_values"

// isBoundsRefusal reports whether err says a rule was broken or couldn't be checked, as opposed to
// a store or lookup failure, which fails the write under any license.
func isBoundsRefusal(err error) bool {
	return errors.Is(err, errBoundsViolated) || errors.Is(err, errBoundsCheckFailed)
}

// boundsEvent starts the audit event for a value that broke rule. written is the value as the
// writer sent it, with a nil Value for a clear.
func boundsEvent(written *model.PropertyValue, rule string, affected int64) ValueAuditEvent {
	return ValueAuditEvent{
		TargetType:     written.TargetType,
		TargetID:       written.TargetID,
		FieldID:        written.FieldID,
		Current:        written,
		BoundsRule:     rule,
		BoundsAffected: affected,
	}
}

// boundsBreak handles a write that breaks a rule or mutability, err being the refusal. It audits
// the break once, as refused or, without Enterprise Advanced, as not enforced, and returns err to
// refuse the write, or nil to let it go ahead. e carries what the call site knows; the action and
// the reason are set here.
func (h *AccessControlAttributeValidationHook) boundsBreak(rctx request.CTX, groupID string, e ValueAuditEvent, err error) error {
	enforced := h.propertyService.boundsEnforced()
	e.Action = ValueAuditActionBoundsNotEnforced
	if enforced {
		e.Action = ValueAuditActionBoundsRefused
	}
	e.BoundsReason = ValueAuditBoundsReasonViolated
	if errors.Is(err, errBoundsCheckFailed) {
		e.BoundsReason = ValueAuditBoundsReasonCheckFailed
	}
	if h.valueAudit != nil {
		h.valueAudit.emit(rctx, groupID, e)
	}
	if !enforced {
		return nil
	}
	return boundsRefusal(err)
}

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

// enforceBounds is the one entry point for the bounds and mutability checks on a value write. With
// Enterprise Advanced the request is refused whole on the first value that breaks a rule. Without
// it every break is audited and the write goes ahead.
//
// Stored values are read from master and, when enforced, recorded on the request, so the write
// lands only if each row is still what the check judged against. That is what stops two
// simultaneous first writes both passing write-once. Without enforcement nothing is recorded: a
// write that can't be refused must not fail because a stored value moved.
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
	if len(targetsByField) > 0 && h.propertyService.boundsEnforced() {
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
		if conditions == nil {
			continue
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
		checked := *v
		if v.DeleteAt != 0 {
			checked.Value = nil
		}
		next := checked.Value
		field := fieldMap[v.FieldID]
		if err := checkMutability(field, storedValue, next); err != nil {
			if refusal := h.boundsBreak(rctx, field.GroupID, boundsEvent(&checked, string(field.Mutability.OrMutable()), 0), err); refusal != nil {
				return refusal
			}
		}
		for _, rule := range field.Bounds {
			var err error
			switch rule.Reference {
			case model.PropertyBoundsReferenceSelf:
				err = checkSelfRule(field, rule, storedValue, next)
			case model.PropertyBoundsReferenceParent:
				// Records no read: the container is another object whose value can change between this read
				// and the write, and that takes two writes within milliseconds, one an admin's.
				err = h.checkParentRule(store.RequestContextWithMaster(rctx), field, rule, &checked)
			default:
				// Save refuses unknown references, so this is bad data; skipping would quietly stop the rule applying.
				err = fmt.Errorf("field %s: unknown reference %q: %w", field.ID, rule.Reference, errBoundsCheckFailed)
			}
			if err == nil {
				continue
			}
			if !isBoundsRefusal(err) {
				return err
			}
			if refusal := h.boundsBreak(rctx, field.GroupID, boundsEvent(&checked, string(rule.Operator)+" "+string(rule.Reference), 0), err); refusal != nil {
				return refusal
			}
		}
	}
	return h.refuseContainedValuesOutOfBounds(rctx, values, fieldMap)
}

// refuseContainedValuesOutOfBounds refuses a request that sets a channel's or the server's value
// when the objects beneath would end up out of bounds under a child field's parent rule (without
// Enterprise Advanced it audits the break and lets the write go ahead). Only
// linked channel and system fields are looked at, and each pays one search for the child fields
// whose parent rule reads from it, even when there are none; unlinked fields and other object types
// pay nothing. Clearing is never refused (what's beneath only gets a looser limit), and
// neither is writing the stored value again, so re-saving a form doesn't fail on values the writer
// didn't touch.
func (h *AccessControlAttributeValidationHook) refuseContainedValuesOutOfBounds(rctx request.CTX, values []*model.PropertyValue, fieldMap map[string]*model.PropertyField) error {
nextValue:
	for _, v := range values {
		field, ok := fieldMap[v.FieldID]
		if !ok || (field.ObjectType != model.PropertyFieldObjectTypeChannel && field.ObjectType != model.PropertyFieldObjectTypeSystem) ||
			field.LinkSourceID() == "" || v.DeleteAt != 0 || model.IsEmptyPropertyValue(v.Value) {
			continue
		}
		children, err := h.propertyService.childFieldsWithParentRule(rctx, field)
		if err != nil {
			return fmt.Errorf("field %s: failed to look up the child fields: %w", field.ID, err)
		}
		if len(children) == 0 {
			continue
		}

		// A value beneath written between this read and the container's write can still land out of
		// bounds; no lock spans the two objects.
		rows, err := h.propertyService.searchPropertyValues(store.RequestContextWithMaster(rctx), field.GroupID, model.PropertyValueSearchOpts{
			FieldID:   field.ID,
			TargetIDs: []string{v.TargetID},
			PerPage:   1,
		})
		if err != nil {
			return fmt.Errorf("field %s: failed to read the stored value of target %s: %w", field.ID, v.TargetID, err)
		}
		if len(rows) > 0 && samePropertyValue(rows[0].Value, v.Value) {
			continue
		}

		ranks := buildOptionRankMap(field)
		newRank, ok := singleOptionRank(field.Type, v.Value, ranks)
		if !ok {
			if err := h.boundsBreak(rctx, field.GroupID, boundsEvent(v, boundsRuleContainedValues, 0), fmt.Errorf("field %s: target %s: the new value can't be ranked: %w", field.ID, v.TargetID, errBoundsCheckFailed)); err != nil {
				return err
			}
			continue nextValue
		}
		var breaches storedValueBreaches
		var breachedFieldID string
		for _, child := range children {
			for _, rule := range child.Bounds {
				if rule.Reference != model.PropertyBoundsReferenceParent {
					continue
				}
				allowed, err := allowedByRule(ranks, rule.Operator, newRank)
				if err != nil {
					if !isBoundsRefusal(err) {
						return err
					}
					if refusal := h.boundsBreak(rctx, field.GroupID, boundsEvent(v, boundsRuleContainedValues, 0), fmt.Errorf("field %s: %w", child.ID, err)); refusal != nil {
						return refusal
					}
					continue nextValue
				}
				// A channel's posts are those in the channel; every channel and user is held to the server.
				var scope *store.PostValueScope
				if field.ObjectType == model.PropertyFieldObjectTypeChannel {
					scope = &store.PostValueScope{ChannelID: v.TargetID}
				}
				n, examples, err := h.propertyService.valueStore.CountValuesOutsideOptions(child.GroupID, child.ID, allowed, scope, storedValueExamples)
				if err != nil {
					return fmt.Errorf("field %s: failed to count the values of field %s: %w", field.ID, child.ID, err)
				}
				if n > 0 && breachedFieldID == "" {
					breachedFieldID = child.ID
				}
				breaches.add(n, examples)
			}
			if field.ObjectType != model.PropertyFieldObjectTypeSystem || child.ObjectType != model.PropertyFieldObjectTypeChannel {
				continue
			}
			// Posts in channels with no value fall back to the server, but only through a channel
			// field that carries the same rule as the post field.
			found, firstID, err := h.propertyService.fallbackPostBreaches(rctx, child, child.Bounds, nil, func(rule model.PropertyBoundsRule) ([]string, error) {
				return allowedByRule(ranks, rule.Operator, newRank)
			}, nil)
			if err != nil {
				if !isBoundsRefusal(err) {
					return err
				}
				if refusal := h.boundsBreak(rctx, field.GroupID, boundsEvent(v, boundsRuleContainedValues, 0), err); refusal != nil {
					return refusal
				}
				continue nextValue
			}
			if found.Count > 0 && breachedFieldID == "" {
				breachedFieldID = firstID
			}
			breaches.add(found.Count, found.Examples)
		}
		if breaches.Count > 0 {
			examples := strings.Join(breaches.Examples, ", ")
			err := model.NewAppError("UpsertPropertyValues", "app.property_value.bounds_contained_values.app_error",
				map[string]any{"Count": breaches.Count, "Examples": examples},
				fmt.Sprintf("field %s: target %s: %d contained values of field %s out of bounds, e.g. %s", field.ID, v.TargetID, breaches.Count, breachedFieldID, examples),
				http.StatusConflict)
			if err := h.boundsBreak(rctx, field.GroupID, boundsEvent(v, boundsRuleContainedValues, breaches.Count), err); err != nil {
				return err
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

// clearRefusal returns the refusal for clearing a set value of field and the audited rule that
// refuses it, or a nil error when clears are allowed. It is non-nil exactly when storedValueMatters:
// a clear is judged by the same rules as any other change to a stored value. Same errors as the
// write path, so a refused clear tells the caller nothing about the value. The self-rule error is
// not yet an AppError: boundsBreak turns it into one.
func clearRefusal(field *model.PropertyField) (rule string, err error) {
	if field.Mutability.OrMutable() != model.PropertyFieldMutabilityMutable {
		return string(field.Mutability.OrMutable()), newMutabilityError(field)
	}
	if i := slices.IndexFunc(field.Bounds, func(r model.PropertyBoundsRule) bool { return r.Reference == model.PropertyBoundsReferenceSelf }); i >= 0 {
		r := field.Bounds[i]
		return string(r.Operator) + " " + string(r.Reference), fmt.Errorf("field %s: a value can't be cleared: %w", field.ID, errBoundsViolated)
	}
	return "", nil
}

// refuseLockedFieldClear audits and refuses the field's clearRefusal, reading the field from master,
// or lets the delete go ahead without Enterprise Advanced. value is the row being deleted, nil when
// every value of the field goes.
func (h *AccessControlAttributeValidationHook) refuseLockedFieldClear(master request.CTX, groupID, fieldID string, value *model.PropertyValue) error {
	fields, err := h.propertyService.getPropertyFields(master, groupID, []string{fieldID})
	if errors.Is(err, ErrFieldNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("failed to read field %s before clearing its values: %w", fieldID, err)
	}
	rule, err := clearRefusal(fields[0])
	if err == nil {
		return nil
	}
	e := ValueAuditEvent{FieldID: fieldID, BoundsRule: rule}
	if value != nil {
		e.TargetType, e.TargetID, e.ValueID, e.Prev = value.TargetType, value.TargetID, value.ID, value
	}
	return h.boundsBreak(master, groupID, e, err)
}

// refuseLockedTargetDelete refuses deleting everything on a target when it holds a set value of a
// field that refuses clears, and otherwise tells the delete to leave those fields' rows alone. A
// first write that lands between this read and the delete keeps its value, the same outcome as
// the delete having run first. Without Enterprise Advanced it audits each such value and lets the
// delete take everything.
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
		if _, refusal := clearRefusal(f); refusal != nil {
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
	enforced := h.propertyService.boundsEnforced()
	for _, v := range values {
		f, ok := locked[v.FieldID]
		if !ok || model.IsEmptyPropertyValue(v.Value) {
			continue
		}
		rule, refusal := clearRefusal(f)
		// Without Enterprise Advanced this audits every locked value and returns nil.
		if err := h.boundsBreak(master, groupID, ValueAuditEvent{TargetType: v.TargetType, TargetID: v.TargetID, ValueID: v.ID, FieldID: v.FieldID, Prev: v, BoundsRule: rule}, refusal); err != nil {
			return err
		}
	}
	if !enforced {
		return nil
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
