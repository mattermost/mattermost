// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"slices"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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

// maskingContext memoizes, within one hook call that reads or writes several
// values on one field, everything this phase needs more than once: the
// fieldMasking resolution above, the caller's holdings on whatever field
// mask_by_field_id names, and -- for a write -- the value already stored at
// a (field, target) a write is about to replace. Same "resolve once per
// batch, not once per item" problem valueWriteAccessCache already solves for
// the write decision itself. A batch read or write of 50 values on one field
// must not load the template, or search the caller's holdings, or fetch the
// stored row, 50 times.
type maskingContext struct {
	fieldMasking      map[string]fieldMasking
	holdingsValues    map[string][]*model.PropertyValue
	holdingsOptionIDs map[string]map[string]struct{}
	existingValues    map[[2]string]*model.PropertyValue
}

// newMaskingContext returns an empty maskingContext, built once per hook call
// that reads values or options through the masking filter, or writes to a
// field masking may refuse.
func newMaskingContext() maskingContext {
	return maskingContext{
		fieldMasking:      make(map[string]fieldMasking),
		holdingsValues:    make(map[string][]*model.PropertyValue),
		holdingsOptionIDs: make(map[string]map[string]struct{}),
		existingValues:    make(map[[2]string]*model.PropertyValue),
	}
}

// maskingContextKey is the request-context key a maskingContext travels
// under. Unexported so nothing outside this file can plant or read one.
type maskingContextKey struct{}

// withMaskingContext returns rctx carrying c, so every hook call made through
// it -- however many, across however many pages of a listing -- shares the
// one resolution rather than each building its own. The one caller of this is
// GetFieldOptions, which is the one read path where a single logical read
// invokes the hook more than once.
func withMaskingContext(rctx request.CTX, c maskingContext) request.CTX {
	return rctx.WithContext(context.WithValue(rctx.Context(), maskingContextKey{}, c))
}

// maskingContextFromRequest returns the maskingContext carried on rctx, or a
// fresh standalone one when none is attached. Every hook call outside
// GetFieldOptions's listing loop takes this fallback, and behaves exactly as
// it would if this mechanism did not exist.
func maskingContextFromRequest(rctx request.CTX) maskingContext {
	if c, ok := rctx.Context().Value(maskingContextKey{}).(maskingContext); ok {
		return c
	}
	return newMaskingContext()
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

// exempt reports whether callerID is named in except. Exemption is explicit
// -- holding a grant confers none -- so this only ever matches an identity
// except actually lists, and skips the masking filter alone: the permission
// gate still runs regardless of the answer. It is also scope-blind: an
// except entry (model.Identity) names an identity and nothing else, so
// there is no scope to compare it against.
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
func (h *AccessControlHook) exempt(except []model.Identity, callerID string) bool {
	if callerID == "" || len(except) == 0 {
		return false
	}

	if h.isMachineCaller(callerID) {
		ownerID, ownerType, _ := h.callerOwnerIdentity(callerID, "")
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
		return h.maskOptionValue(rctx, c, field, fm, value, callerID)
	case model.PropertyFieldTypeGraph:
		return h.maskGraphValue(rctx, c, field, fm, value, callerID)
	default:
		return h.maskScalarValue(rctx, c, field, fm, value, callerID)
	}
}

// logMaskingFailure records that a masking filter could not establish what a
// caller may see of value, so the nil it returns is read in the log as "we
// don't know" rather than as the ordinary, expected "the caller holds
// nothing" -- the two look identical to the caller but must not look
// identical to whoever reads the log. Never logs the value itself or the
// caller's holdings; that is exactly what masking exists to withhold. Shared
// by every masking filter regardless of field type, unlike the legacy path's
// logHiddenGraphValue, which is graph-specific and belongs to code that gets
// deleted with the rest of the shim.
func logMaskingFailure(rctx request.CTX, field *model.PropertyField, value *model.PropertyValue, err error) {
	rctx.Logger().Error(
		"Hiding a masked property value because what the caller may see of it could not be established",
		mlog.String("field_id", field.ID),
		mlog.String("value_id", value.ID),
		mlog.Err(err),
	)
}

// maskOptionValue answers select, multiselect and rank alike: the value the
// caller may see is the intersection of the options it names with the
// options the caller holds on the holdings field, an exact-option-membership
// rule with no ordering to it. select and rank hold at most one option, so
// their intersection has at most one element; multiselect's may have several.
// A caller holding nothing, or an intersection of none, sees nothing.
func (h *AccessControlHook) maskOptionValue(rctx request.CTX, c maskingContext, field *model.PropertyField, fm fieldMasking, value *model.PropertyValue, callerID string) *model.PropertyValue {
	callerOptionIDs, err := c.callerOptionIDsForHoldings(h, field.GroupID, fm.holdingsFieldID, callerID, field.Type)
	if err != nil {
		logMaskingFailure(rctx, field, value, err)
		return nil
	}
	if len(callerOptionIDs) == 0 {
		return nil
	}

	targetOptionIDs, err := h.extractOptionIDsFromValue(field.Type, value.Value)
	if err != nil {
		logMaskingFailure(rctx, field, value, err)
		return nil
	}
	if len(targetOptionIDs) == 0 {
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
	// Sorted so a multiselect value's options come back in the same order on
	// every read -- they are built by ranging over a map, which promises none.
	slices.Sort(intersection)

	// select and rank are select-shaped: exactly one option, so intersection
	// has at most one element and it is marshaled bare; multiselect's may
	// have several and is marshaled as the list.
	toMarshal := any(intersection[0])
	if field.Type == model.PropertyFieldTypeMultiselect {
		toMarshal = intersection
	}

	jsonValue, marshalErr := json.Marshal(toMarshal)
	if marshalErr != nil {
		logMaskingFailure(rctx, field, value, marshalErr)
		return nil
	}
	filtered := *value
	filtered.Value = jsonValue
	return &filtered
}

// maskGraphValue answers a graph field's value with exact coverage: an option
// the caller covers (holds it or an ancestor of it) stands as it is, and one
// they do not is dropped outright, never replaced by the covered options
// below it -- that replacement is the legacy shared_only path's clamp
// (filterSharedOnlyGraphValue), and handing back a narrower option than the
// one actually stored would tell a masked caller the object carries a marking
// weaker than the one it does, which is telling them something false rather
// than just less than the truth. Reads the caller's holdings from
// fm.holdingsFieldID rather than always from field itself, since a linked
// field's holdings can live on the template's mask_by_field_id. Any failure
// to resolve coverage fails closed and is logged, never falls through to the
// unfiltered value.
func (h *AccessControlHook) maskGraphValue(rctx request.CTX, c maskingContext, field *model.PropertyField, fm fieldMasking, value *model.PropertyValue, callerID string) *model.PropertyValue {
	callerOptionIDs, err := c.callerOptionIDsForHoldings(h, field.GroupID, fm.holdingsFieldID, callerID, field.Type)
	if err != nil {
		logMaskingFailure(rctx, field, value, err)
		return nil
	}
	if len(callerOptionIDs) == 0 {
		return nil
	}

	targetOptionIDs, err := h.extractOptionIDsFromValue(field.Type, value.Value)
	if err != nil {
		logMaskingFailure(rctx, field, value, err)
		return nil
	}
	if len(targetOptionIDs) == 0 {
		return nil
	}

	targetIDs := slices.Collect(maps.Keys(targetOptionIDs))
	covered, err := h.propertyService.coveredBy(rctx, field, targetIDs, slices.Collect(maps.Keys(callerOptionIDs)))
	if err != nil {
		logMaskingFailure(rctx, field, value, err)
		return nil
	}

	visible := make([]string, 0, len(targetIDs))
	for _, id := range targetIDs {
		if covered[id] {
			visible = append(visible, id)
		}
	}
	if len(visible) == 0 {
		return nil
	}
	// Sorted for the same reason the option-value path is: two reads of an
	// unchanged value must come back in the same order.
	slices.Sort(visible)

	jsonValue, err := json.Marshal(visible)
	if err != nil {
		logMaskingFailure(rctx, field, value, err)
		return nil
	}

	filtered := *value
	filtered.Value = jsonValue
	return &filtered
}

// visibleOptionIDs answers, for a field already known to carry masking, which
// of candidateOptionIDs callerID may see: a graph field asks coveredBy -- one
// of the caller's own held options is at-or-above the candidate -- and every
// other option-supporting type asks exact membership in what the caller
// holds, the same holdings maskOptionValue and maskGraphValue check a value
// against. A caller holding nothing sees nothing, without asking coveredBy at
// all.
func (c maskingContext) visibleOptionIDs(h *AccessControlHook, rctx request.CTX, field *model.PropertyField, fm fieldMasking, candidateOptionIDs []string, callerID string) (map[string]bool, error) {
	callerOptionIDs, err := c.callerOptionIDsForHoldings(h, field.GroupID, fm.holdingsFieldID, callerID, field.Type)
	if err != nil {
		return nil, err
	}
	if len(callerOptionIDs) == 0 {
		return map[string]bool{}, nil
	}

	if field.Type == model.PropertyFieldTypeGraph {
		return h.propertyService.coveredBy(rctx, field, candidateOptionIDs, slices.Collect(maps.Keys(callerOptionIDs)))
	}

	visible := make(map[string]bool, len(candidateOptionIDs))
	for _, id := range candidateOptionIDs {
		if _, ok := callerOptionIDs[id]; ok {
			visible[id] = true
		}
	}
	return visible, nil
}

// maskFieldOptions returns a copy of field whose inline option list is
// filtered to what callerID may see, given the masking fm already resolved
// for it. Mirrors filterSharedOnlyFieldOptions's shape and Attrs handling
// (access_control.go), using copyPropertyField and extractOptionIDList the
// same way -- but never applies the rank ladder that function keeps for a
// field with no permissions: a masked rank field's options are exact-option
// membership, the same rule select and multiselect use, so
// filterSharedOnlyRankFieldOptions is never called from here.
//
// This runs only on the branch permissionsAllows already admitted for
// option.read; a caller the gate refused never reaches it.
func (h *AccessControlHook) maskFieldOptions(rctx request.CTX, c maskingContext, field *model.PropertyField, fm fieldMasking, callerID string) *model.PropertyField {
	if !field.Type.SupportsOptions() {
		return field
	}

	// Options withheld: the read left the list out because the field has more
	// than model.PropertyFieldMaxHydratedOptions of them, so there is nothing
	// to intersect the caller's holdings against. Hide the lot — returning the
	// field as-is would hand an unentitled caller the option count, which on a
	// masked field is itself controlled information.
	if model.PropertyFieldOptionsOmitted(field.Attrs) {
		filteredField := h.copyPropertyField(field)
		filteredField.HideOptions()
		return filteredField
	}

	if field.Attrs == nil {
		return field
	}
	optionsArr, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return field
	}
	optionsSlice, ok := optionsArr.([]any)
	if !ok {
		return field
	}

	visible, err := c.visibleOptionIDs(h, rctx, field, fm, extractOptionIDList(optionsSlice), callerID)
	if err != nil {
		rctx.Logger().Error(
			"Hiding a masked property field's options because which of them the caller may see could not be established",
			mlog.String("field_id", field.ID),
			mlog.Err(err),
		)
		filteredField := h.copyPropertyField(field)
		filteredField.HideOptions()
		return filteredField
	}

	filteredOptions := []any{}
	for _, opt := range optionsSlice {
		optMap, ok := opt.(map[string]any)
		if !ok {
			continue
		}
		optID, ok := optMap["id"].(string)
		if !ok {
			continue
		}
		if visible[optID] {
			filteredOptions = append(filteredOptions, opt)
		}
	}

	filteredField := h.copyPropertyField(field)
	filteredField.Attrs[model.PropertyFieldAttributeOptions] = filteredOptions
	return filteredField
}

// filterMaskedOptionPage keeps the options in one page of a masked field's
// paged option listing that callerID may see, and strips each kept option's
// parents. Generalizes filterSharedOnlyGraphOptionPage (access_control.go)
// off graph-only and access_mode onto every option-supporting type and
// masking, via visibleOptionIDs -- same page-not-reach framing (judging the
// page bounds the work to the page size, where building the caller's full
// reach walks the whole hierarchy), same parent-stripping reasoning (an
// option's parent is by definition above it, so reporting it would hand a
// caller who holds an option exactly the name masking withholds).
//
// A resolution failure is returned as an error rather than answered with an
// empty page: every other masking path hides because it has nowhere to put a
// failure, but a listing does, and an empty page here would be
// indistinguishable from a field with no options -- exactly the confusion
// the option rows exist to prevent.
func (h *AccessControlHook) filterMaskedOptionPage(rctx request.CTX, c maskingContext, field *model.PropertyField, fm fieldMasking, options []*model.PropertyFieldOption, callerID string) ([]*model.PropertyFieldOption, error) {
	if len(options) == 0 {
		return []*model.PropertyFieldOption{}, nil
	}

	pageIDs := make([]string, 0, len(options))
	for _, option := range options {
		pageIDs = append(pageIDs, option.ID)
	}

	visible, err := c.visibleOptionIDs(h, rctx, field, fm, pageIDs, callerID)
	if err != nil {
		return nil, fmt.Errorf("failed to establish which of field %s's options the caller may see: %w", field.ID, err)
	}

	shown := []*model.PropertyFieldOption{}
	for _, option := range options {
		if !visible[option.ID] {
			continue
		}
		// See filterSharedOnlyGraphOptionPage for why parents come off: an absent
		// parents key means "not reported", not "this is a root".
		copied := *option
		copied.Parents = nil
		shown = append(shown, &copied)
	}
	return shown, nil
}

// maskScalarValue applies binary masking to a non-option field's value: the
// value as stored when it equals one of the caller's own stored values on the
// holdings field (compared as stored bytes), nil otherwise. Caller and target
// may legitimately store nothing, in which case the value is hidden.
func (h *AccessControlHook) maskScalarValue(rctx request.CTX, c maskingContext, field *model.PropertyField, fm fieldMasking, value *model.PropertyValue, callerID string) *model.PropertyValue {
	if value == nil || len(value.Value) == 0 {
		return nil
	}

	callerValues, err := c.callerValuesForHoldings(h, field.GroupID, fm.holdingsFieldID, callerID)
	if err != nil {
		logMaskingFailure(rctx, field, value, err)
		return nil
	}
	if len(callerValues) == 0 {
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

// storedValue returns the value currently stored at (fieldID, targetID), nil
// when there is none, memoized per (fieldID, targetID) for the lifetime of
// the maskingContext -- the same pair valueWriteAccessCache already batches
// the write decision itself under, so a batch write on one field and target
// loads the row it is about to replace once. An empty targetID never has a
// single row to load (PreDeletePropertyValuesForField's exception passes one
// in to mean "no single object"), so it short-circuits to nothing stored.
func (c maskingContext) storedValue(h *AccessControlHook, groupID, fieldID, targetID string) (*model.PropertyValue, error) {
	if targetID == "" {
		return nil, nil
	}
	key := [2]string{fieldID, targetID}
	if v, ok := c.existingValues[key]; ok {
		return v, nil
	}
	values, err := h.propertyService.searchPropertyValues(groupID, model.PropertyValueSearchOpts{
		FieldID:   fieldID,
		TargetIDs: []string{targetID},
		PerPage:   1,
	})
	if err != nil {
		return nil, err
	}
	var v *model.PropertyValue
	if len(values) > 0 {
		v = values[0]
	}
	c.existingValues[key] = v
	return v, nil
}

// primeStoredValue seeds storedValue's cache with a row the caller already
// has in hand, so a delete path that loaded the value to find its field does
// not pay a second read for the same lookup.
func (c maskingContext) primeStoredValue(fieldID, targetID string, value *model.PropertyValue) {
	if targetID == "" {
		return
	}
	c.existingValues[[2]string{fieldID, targetID}] = value
}

// checkValueWriteVisibility refuses a write to a masked field when the
// caller cannot see the whole of what is already stored at valueTargetID.
// Masking narrows what a read returns without touching what a write
// replaces, so without this a caller shown only part of a value could
// destroy the rest of it by editing and saving back what little they were
// shown. Reuses maskValue itself rather than a second set of per-type
// overlap rules, so the rule holds for every field type the same way the
// read filter already does.
//
// Runs only once the permission decision has already admitted the write; it
// can only refuse a write the gate would otherwise allow, never grant one it
// denied.
func (h *AccessControlHook) checkValueWriteVisibility(rctx request.CTX, mc maskingContext, field *model.PropertyField, callerID, valueTargetID string) error {
	fm, err := mc.resolve(h, field)
	if err != nil {
		return err
	}
	if fm.masking == nil || h.exempt(fm.masking.Except, callerID) {
		return nil
	}

	existing, err := mc.storedValue(h, field.GroupID, field.ID, valueTargetID)
	if err != nil {
		return err
	}
	if existing == nil {
		// Nothing stored yet to hide any of -- this is what lets a caller tag
		// an object they cannot fully see.
		return nil
	}

	masked := h.maskValue(rctx, mc, field, fm, existing, callerID)
	visible, err := h.valueFullyVisible(field, existing, masked)
	if err != nil {
		return err
	}
	if !visible {
		return fmt.Errorf("field %s refuses caller %q a write on target %q: the stored value contains data the caller may not read: %w", field.ID, callerID, valueTargetID, ErrAccessDenied)
	}
	return nil
}

// valueFullyVisible reports whether masked -- maskValue's answer for
// existing -- is the whole of existing rather than part of it. A scalar
// field's mask is exact-or-nothing already (maskScalarValue never returns a
// partial value), so any non-nil answer is the whole thing. An
// option-supporting field's mask can be a subset, so full visibility means
// the masked answer names exactly as many options as the stored value does
// -- it can only ever be a subset of them, so equal counts mean equal sets.
func (h *AccessControlHook) valueFullyVisible(field *model.PropertyField, existing, masked *model.PropertyValue) (bool, error) {
	if masked == nil {
		return false, nil
	}
	if !field.Type.SupportsOptions() {
		return true, nil
	}
	originalIDs, err := h.extractOptionIDsFromValue(field.Type, existing.Value)
	if err != nil {
		return false, err
	}
	maskedIDs, err := h.extractOptionIDsFromValue(field.Type, masked.Value)
	if err != nil {
		return false, err
	}
	return len(maskedIDs) == len(originalIDs), nil
}
