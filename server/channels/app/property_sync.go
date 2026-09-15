// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"sort"
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
)

const (
	// propertySyncMaxOptionConflictRetries bounds how often option
	// provisioning re-reads a field after another writer changed it first.
	propertySyncMaxOptionConflictRetries = 5

	propertySyncUpdateConflictErrorID = "app.property_field.update.conflict.app_error"
)

// PropertySyncer applies the attribute values an identity source (AD/LDAP or
// SAML) reports for a user to the custom profile attribute fields linked to
// that source. It is the single implementation of sync semantics; the
// enterprise LDAP and SAML packages only translate their protocol payloads
// into the attrs map SyncUser consumes.
//
// Per field type:
//   - text: the first value is stored verbatim (subject to the text length
//     and value_type rules).
//   - select: the first value is matched, by exact name, to an option of the
//     field. A missing option is created. The stored value is the option ID.
//   - multiselect: every value is matched or created the same way. The stored
//     value is the list of option IDs.
//
// Intentional design choice: an attribute that is absent from attrs, or
// present with no usable values, clears the user's value. The identity source
// is authoritative for a linked field, so what it does not report the user
// does not have; keeping a stale value would let a departed group membership
// keep satisfying an attribute-based access policy.
//
// Options created by the sync are owned by it (see the attribute validation
// hook). They are removed again, by PruneOrphanedOptions, once no live value
// references them.
//
// A syncer caches the linked fields at construction. Create one per sync run
// (the LDAP job) or per login (SAML); it is safe for concurrent use but is not
// meant to outlive a field-definition change made by an admin. Concurrent
// syncers on different nodes are safe with each other: option provisioning
// uses optimistic concurrency and re-reads the field on conflict.
type PropertySyncer struct {
	app      *App
	source   string
	attrKey  string
	callerID string
	groupID  string

	mu sync.Mutex
	// fields holds the linked fields by ID; refreshed whenever this syncer
	// changes a field's options or observes a concurrent change.
	fields map[string]*model.PropertyField
	// order lists field IDs sorted by name so results and writes are
	// deterministic regardless of map iteration.
	order []string
}

// NewPropertySyncer loads the user fields linked to source (one of
// model.PropertySyncSourceLDAP / model.PropertySyncSourceSAML) and returns a
// syncer for them. Fields whose type cannot be synced are ignored with a
// warning; that state is only reachable through legacy data because the
// validation hook strips the link from such fields.
func (a *App) NewPropertySyncer(rctx request.CTX, source string) (*PropertySyncer, *model.AppError) {
	if !model.IsValidPropertySyncSource(source) {
		return nil, model.NewAppError("NewPropertySyncer", "app.property_sync.invalid_source.app_error", nil, "source="+source, http.StatusBadRequest)
	}

	group, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		return nil, appErr
	}

	s := &PropertySyncer{
		app:      a,
		source:   source,
		attrKey:  model.PropertySyncSourceAttr(source),
		callerID: model.PropertySyncCallerID(source),
		groupID:  group.ID,
		fields:   map[string]*model.PropertyField{},
	}

	if appErr := s.loadFields(s.withCaller(rctx)); appErr != nil {
		return nil, appErr
	}
	return s, nil
}

// Source returns the sync source this syncer serves.
func (s *PropertySyncer) Source() string {
	return s.source
}

// HasMappings reports whether any field is linked to the source. Callers use
// it to skip attribute retrieval entirely when there is nothing to sync.
func (s *PropertySyncer) HasMappings() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.fields) > 0
}

// ExternalAttributes returns the distinct external attribute names the linked
// fields read from, sorted. LDAP callers add them to the search request so the
// directory returns them; SAML callers can use them for diagnostics.
func (s *PropertySyncer) ExternalAttributes() []string {
	s.mu.Lock()
	defer s.mu.Unlock()

	seen := map[string]struct{}{}
	for _, field := range s.fields {
		seen[s.attributeOf(field)] = struct{}{}
	}
	names := make([]string, 0, len(seen))
	for name := range seen {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// Fields returns copies of the linked fields, sorted by name.
func (s *PropertySyncer) Fields() []*model.PropertyField {
	s.mu.Lock()
	defer s.mu.Unlock()

	out := make([]*model.PropertyField, 0, len(s.order))
	for _, id := range s.order {
		out = append(out, copyPropertyField(s.fields[id]))
	}
	return out
}

// SyncUser writes the values in attrs to the user's linked fields. attrs maps
// an external attribute name to the raw values the source reported for it,
// in source order; a nil map clears every linked field. The result reports,
// per field, what happened, and never fails as a whole because one field
// could not be written: those fields carry PropertySyncFieldError. The
// returned *model.AppError is reserved for failures that prevent the sync
// from running at all, such as not being able to read the user's values.
func (s *PropertySyncer) SyncUser(rctx request.CTX, userID string, attrs map[string][]string, opts model.PropertySyncOptions) (*model.PropertySyncResult, *model.AppError) {
	if !model.IsValidId(userID) {
		return nil, model.NewAppError("PropertySyncer.SyncUser", "app.property_sync.invalid_user_id.app_error", nil, "user_id="+userID, http.StatusBadRequest)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	rctx = s.withCaller(rctx)
	result := &model.PropertySyncResult{UserID: userID, Fields: []model.PropertySyncFieldOutcome{}}
	if len(s.fields) == 0 {
		return result, nil
	}

	existing, appErr := s.loadUserValues(rctx, userID)
	if appErr != nil {
		return nil, appErr
	}

	type pendingWrite struct {
		outcomeIdx int
		value      *model.PropertyValue
	}
	var writes []pendingWrite
	shrunkFields := map[string]struct{}{}

	for _, fieldID := range s.order {
		field := s.fields[fieldID]
		attribute := s.attributeOf(field)
		outcome := model.PropertySyncFieldOutcome{
			FieldID:   field.ID,
			FieldName: field.Name,
			FieldType: field.Type,
			Attribute: attribute,
		}

		rawValues, present := attrs[attribute]
		values := normalizeSourceValues(rawValues)
		if !present {
			rctx.Logger().Debug("Property sync: attribute absent from source, clearing linked field",
				mlog.String("source", s.source), mlog.String("attribute", attribute), mlog.String("field_id", field.ID))
		}

		desired, err := s.desiredValue(rctx, field, values, &outcome)
		if err != nil {
			outcome.Status = model.PropertySyncFieldError
			outcome.Reason = err.Error()
			result.Fields = append(result.Fields, outcome)
			continue
		}
		result.OptionsCreated += outcome.OptionsCreated
		if outcome.Status == model.PropertySyncFieldSkipped {
			result.Fields = append(result.Fields, outcome)
			continue
		}

		current := existing[field.ID]
		if !propertyValueChanged(field.Type, current, desired) {
			outcome.Status = model.PropertySyncFieldUnchanged
			result.Fields = append(result.Fields, outcome)
			continue
		}

		if model.IsEmptyPropertyValue(desired) {
			outcome.Status = model.PropertySyncFieldCleared
		} else {
			outcome.Status = model.PropertySyncFieldUpdated
		}
		if field.Type.SupportsOptions() && lostOptionReferences(current, desired) {
			shrunkFields[field.ID] = struct{}{}
		}

		result.Fields = append(result.Fields, outcome)
		writes = append(writes, pendingWrite{
			outcomeIdx: len(result.Fields) - 1,
			value: &model.PropertyValue{
				GroupID:    s.groupID,
				TargetType: model.PropertyValueTargetTypeUser,
				TargetID:   userID,
				FieldID:    field.ID,
				Value:      desired,
			},
		})
	}

	if len(writes) == 0 {
		return result, nil
	}

	values := make([]*model.PropertyValue, 0, len(writes))
	for _, w := range writes {
		values = append(values, w.value)
	}
	upserted, appErr := s.app.UpsertPropertyValues(rctx, values, model.PropertyFieldObjectTypeUser, userID, "")
	if appErr != nil {
		// Fall back to one write per field so one bad value does not block
		// the rest and so each field's outcome is accurate.
		upserted = nil
		for _, w := range writes {
			single, singleErr := s.app.UpsertPropertyValues(rctx, []*model.PropertyValue{w.value}, model.PropertyFieldObjectTypeUser, userID, "")
			if singleErr != nil {
				result.Fields[w.outcomeIdx].Status = model.PropertySyncFieldError
				result.Fields[w.outcomeIdx].Reason = singleErr.Error()
				delete(shrunkFields, w.value.FieldID)
				continue
			}
			upserted = append(upserted, single...)
		}
	}

	s.publishValuesUpdated(userID, upserted)

	if opts.PruneOrphanedOptions && len(shrunkFields) > 0 {
		fieldIDs := make([]string, 0, len(shrunkFields))
		for id := range shrunkFields {
			fieldIDs = append(fieldIDs, id)
		}
		pruned, pruneErr := s.pruneFields(rctx, fieldIDs)
		if pruneErr != nil {
			rctx.Logger().Warn("Property sync: failed to prune orphaned options after user sync",
				mlog.String("source", s.source), mlog.String("user_id", userID), mlog.Err(pruneErr))
		} else {
			result.OptionsPruned = pruned.OptionsPruned()
		}
	}

	return result, nil
}

// PruneOrphanedOptions removes, from every linked select and multiselect
// field, the options that no live value references any more. Batch sources
// call it once after syncing all users so an option disappears with its last
// holder. Options an admin created before linking the field are pruned too:
// on a linked field the source is the only legitimate origin of options.
func (s *PropertySyncer) PruneOrphanedOptions(rctx request.CTX) (*model.PropertySyncPruneResult, *model.AppError) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var fieldIDs []string
	for _, id := range s.order {
		if s.fields[id].Type.SupportsOptions() {
			fieldIDs = append(fieldIDs, id)
		}
	}
	return s.pruneFields(s.withCaller(rctx), fieldIDs)
}

// pruneFields is PruneOrphanedOptions for a subset of fields. Callers hold s.mu.
func (s *PropertySyncer) pruneFields(rctx request.CTX, fieldIDs []string) (*model.PropertySyncPruneResult, *model.AppError) {
	result := &model.PropertySyncPruneResult{Fields: []model.PropertySyncPrunedField{}}

	for _, fieldID := range fieldIDs {
		pruned, appErr := s.pruneField(rctx, fieldID)
		if appErr != nil {
			return nil, appErr
		}
		if pruned != nil {
			result.Fields = append(result.Fields, *pruned)
		}
	}
	return result, nil
}

// pruneField removes unreferenced options from one field, retrying on
// concurrent modification. The referenced set is read from the primary and
// the field write is conditional on the field being unchanged since it was
// read, so an option a concurrent sync is adding cannot be pruned by this one
// without that sync's write being retried against the new state.
func (s *PropertySyncer) pruneField(rctx request.CTX, fieldID string) (*model.PropertySyncPrunedField, *model.AppError) {
	for attempt := 0; ; attempt++ {
		field, ok := s.fields[fieldID]
		if !ok {
			return nil, nil
		}
		options, err := propertyFieldOptions(field)
		if err != nil {
			return nil, model.NewAppError("PropertySyncer.pruneField", "app.property_sync.invalid_options.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if len(options) == 0 {
			return nil, nil
		}

		referenced, err := s.app.Srv().Store().PropertyValue().GetReferencedOptionIDs(s.groupID, fieldID)
		if err != nil {
			return nil, model.NewAppError("PropertySyncer.pruneField", "app.property_sync.referenced_options.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		referencedSet := make(map[string]struct{}, len(referenced))
		for _, id := range referenced {
			referencedSet[id] = struct{}{}
		}

		kept := make(model.PropertyOptions[*model.CustomProfileAttributesSelectOption], 0, len(options))
		pruned := &model.PropertySyncPrunedField{FieldID: field.ID, FieldName: field.Name}
		for _, opt := range options {
			if _, used := referencedSet[opt.ID]; used {
				kept = append(kept, opt)
				continue
			}
			pruned.OptionIDs = append(pruned.OptionIDs, opt.ID)
			pruned.OptionNames = append(pruned.OptionNames, opt.Name)
		}
		if len(pruned.OptionIDs) == 0 {
			return nil, nil
		}

		saved, appErr := s.saveOptions(rctx, field, kept)
		if appErr != nil {
			if appErr.Id == propertySyncUpdateConflictErrorID && attempt < propertySyncMaxOptionConflictRetries {
				if refreshErr := s.refreshField(rctx, fieldID); refreshErr != nil {
					return nil, refreshErr
				}
				continue
			}
			return nil, appErr
		}
		s.fields[fieldID] = saved
		return pruned, nil
	}
}

// desiredValue computes the JSON value the field should hold for the given
// source values, provisioning options where needed. It marks the outcome
// skipped (with a reason) when a value cannot be synced, and records dropped
// values and created options on it.
func (s *PropertySyncer) desiredValue(rctx request.CTX, field *model.PropertyField, values []string, outcome *model.PropertySyncFieldOutcome) (json.RawMessage, error) {
	switch field.Type {
	case model.PropertyFieldTypeText:
		if len(values) == 0 {
			return json.RawMessage(`""`), nil
		}
		value := values[0]
		if len(value) > model.PropertyFieldValueTypeTextMaxLength {
			return s.skip(outcome, value, fmt.Sprintf("value exceeds the %d character limit for text attributes", model.PropertyFieldValueTypeTextMaxLength))
		}
		raw, err := json.Marshal(value)
		if err != nil {
			return nil, err
		}
		if valueType := model.GetPropertyFieldValueType(field); valueType != "" {
			if err := model.ValidatePropertyValueForValueType(valueType, raw); err != nil {
				return s.skip(outcome, value, fmt.Sprintf("value is not a valid %s: %s", valueType, err.Error()))
			}
		}
		return raw, nil

	case model.PropertyFieldTypeSelect:
		if len(values) == 0 {
			return json.RawMessage(`""`), nil
		}
		value := values[0]
		if len(value) > model.CPAOptionNameMaxLength {
			return s.skip(outcome, value, fmt.Sprintf("value exceeds the %d character limit for option names", model.CPAOptionNameMaxLength))
		}
		ids, created, dropped, err := s.ensureOptions(rctx, field.ID, []string{value})
		if err != nil {
			return nil, err
		}
		outcome.OptionsCreated += created
		if len(dropped) > 0 {
			return s.skip(outcome, value, fmt.Sprintf("field already has the maximum of %d options", model.PropertySyncMaxOptionsPerField))
		}
		return json.Marshal(ids[value])

	case model.PropertyFieldTypeMultiselect:
		eligible := make([]string, 0, len(values))
		for _, value := range values {
			if len(value) > model.CPAOptionNameMaxLength {
				outcome.DroppedValues = append(outcome.DroppedValues, value)
				continue
			}
			eligible = append(eligible, value)
		}
		if len(outcome.DroppedValues) > 0 {
			outcome.Reason = fmt.Sprintf("%d value(s) exceed the %d character limit for option names", len(outcome.DroppedValues), model.CPAOptionNameMaxLength)
		}
		if len(eligible) == 0 {
			return json.RawMessage(`[]`), nil
		}
		ids, created, dropped, err := s.ensureOptions(rctx, field.ID, eligible)
		if err != nil {
			return nil, err
		}
		outcome.OptionsCreated += created
		if len(dropped) > 0 {
			outcome.DroppedValues = append(outcome.DroppedValues, dropped...)
			outcome.Reason = strings.TrimSpace(outcome.Reason + fmt.Sprintf(" %d value(s) dropped: field already has the maximum of %d options", len(dropped), model.PropertySyncMaxOptionsPerField))
		}
		optionIDs := make([]string, 0, len(ids))
		for _, value := range eligible {
			if id, ok := ids[value]; ok {
				optionIDs = append(optionIDs, id)
			}
		}
		// Store in the field's option order so equal sets serialize equally.
		s.sortOptionIDsByFieldOrder(field.ID, optionIDs)
		return json.Marshal(optionIDs)
	}

	return nil, fmt.Errorf("field type %s cannot be synced", field.Type)
}

func (s *PropertySyncer) skip(outcome *model.PropertySyncFieldOutcome, value, reason string) (json.RawMessage, error) {
	outcome.Status = model.PropertySyncFieldSkipped
	outcome.Reason = reason
	outcome.DroppedValues = append(outcome.DroppedValues, value)
	return nil, nil
}

// ensureOptions returns the option ID for every name, creating the options
// that do not exist yet. Matching is exact and case-preserving, mirroring the
// option name uniqueness rule. Names that cannot be created because the field
// is at PropertySyncMaxOptionsPerField are returned as dropped. Creation is a
// read-modify-write guarded by the field's UpdateAt; on conflict the field is
// re-read and the missing set recomputed, so two syncers racing on the same
// name converge on one option. Callers hold s.mu.
func (s *PropertySyncer) ensureOptions(rctx request.CTX, fieldID string, names []string) (ids map[string]string, created int, dropped []string, err error) {
	for attempt := 0; ; attempt++ {
		field, ok := s.fields[fieldID]
		if !ok {
			return nil, 0, nil, fmt.Errorf("field %s is no longer linked to %s", fieldID, s.source)
		}
		options, optErr := propertyFieldOptions(field)
		if optErr != nil {
			return nil, 0, nil, optErr
		}

		ids = make(map[string]string, len(options))
		for _, opt := range options {
			ids[opt.Name] = opt.ID
		}

		var missing []string
		for _, name := range names {
			if _, ok := ids[name]; !ok && !slices.Contains(missing, name) {
				missing = append(missing, name)
			}
		}
		if len(missing) == 0 {
			return ids, 0, nil, nil
		}

		room := model.PropertySyncMaxOptionsPerField - len(options)
		if room <= 0 {
			return ids, 0, missing, nil
		}
		if len(missing) > room {
			dropped = missing[room:]
			missing = missing[:room]
		}

		for _, name := range missing {
			options = append(options, &model.CustomProfileAttributesSelectOption{ID: model.NewId(), Name: name})
		}
		sortOptionsByName(options)

		saved, appErr := s.saveOptions(rctx, field, options)
		if appErr != nil {
			if appErr.Id == propertySyncUpdateConflictErrorID && attempt < propertySyncMaxOptionConflictRetries {
				if refreshErr := s.refreshField(rctx, fieldID); refreshErr != nil {
					return nil, 0, nil, refreshErr
				}
				continue
			}
			return nil, 0, nil, appErr
		}
		s.fields[fieldID] = saved

		savedOptions, optErr := propertyFieldOptions(saved)
		if optErr != nil {
			return nil, 0, nil, optErr
		}
		ids = make(map[string]string, len(savedOptions))
		for _, opt := range savedOptions {
			ids[opt.Name] = opt.ID
		}
		return ids, len(missing), dropped, nil
	}
}

// saveOptions writes a new option list for field, conditional on the field
// not having changed since this syncer read it.
func (s *PropertySyncer) saveOptions(rctx request.CTX, field *model.PropertyField, options model.PropertyOptions[*model.CustomProfileAttributesSelectOption]) (*model.PropertyField, *model.AppError) {
	updated := copyPropertyField(field)
	if len(options) == 0 {
		delete(updated.Attrs, model.PropertyFieldAttributeOptions)
	} else {
		updated.Attrs[model.PropertyFieldAttributeOptions] = options
	}

	saved, _, appErr := s.app.updatePropertyFields(rctx, s.groupID, []*model.PropertyField{updated}, false, "", properties.UpdatePropertyFieldsOpts{
		ExpectedUpdateAts: map[string]int64{field.ID: field.UpdateAt},
	})
	if appErr != nil {
		return nil, appErr
	}
	return saved[0], nil
}

func (s *PropertySyncer) loadFields(rctx request.CTX) *model.AppError {
	fields, appErr := s.app.SearchPropertyFields(rctx, s.groupID, model.PropertyFieldSearchOpts{
		GroupID:    s.groupID,
		ObjectType: model.PropertyFieldObjectTypeUser,
		PerPage:    model.AccessControlGroupFieldLimit,
	})
	if appErr != nil {
		return appErr
	}

	s.fields = map[string]*model.PropertyField{}
	for _, field := range fields {
		if field.DeleteAt != 0 || s.attributeOf(field) == "" {
			continue
		}
		if !field.Type.SupportsExternalSync() {
			rctx.Logger().Warn("Property sync: linked field has a type that cannot be synced, ignoring it",
				mlog.String("source", s.source), mlog.String("field_id", field.ID), mlog.String("field_type", string(field.Type)))
			continue
		}
		s.fields[field.ID] = field
	}
	s.rebuildOrder()
	return nil
}

// refreshField re-reads one field from the primary after a concurrent change.
// A field that has been deleted or unlinked in the meantime is dropped from
// the syncer.
func (s *PropertySyncer) refreshField(rctx request.CTX, fieldID string) *model.AppError {
	field, appErr := s.app.GetPropertyField(RequestContextWithMaster(rctx), s.groupID, fieldID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			delete(s.fields, fieldID)
			s.rebuildOrder()
			return nil
		}
		return appErr
	}
	if field.DeleteAt != 0 || s.attributeOf(field) == "" || !field.Type.SupportsExternalSync() {
		delete(s.fields, fieldID)
	} else {
		s.fields[fieldID] = field
	}
	s.rebuildOrder()
	return nil
}

func (s *PropertySyncer) rebuildOrder() {
	s.order = s.order[:0]
	for id := range s.fields {
		s.order = append(s.order, id)
	}
	sort.Slice(s.order, func(i, j int) bool {
		a, b := s.fields[s.order[i]], s.fields[s.order[j]]
		if a.Name != b.Name {
			return a.Name < b.Name
		}
		return a.ID < b.ID
	})
}

func (s *PropertySyncer) loadUserValues(rctx request.CTX, userID string) (map[string]*model.PropertyValue, *model.AppError) {
	values, appErr := s.app.SearchPropertyValues(rctx, s.groupID, model.PropertyValueSearchOpts{
		GroupID:    s.groupID,
		TargetType: model.PropertyValueTargetTypeUser,
		TargetIDs:  []string{userID},
		PerPage:    model.AccessControlGroupFieldLimit,
	})
	if appErr != nil {
		return nil, appErr
	}

	byField := make(map[string]*model.PropertyValue, len(values))
	for _, value := range values {
		if _, linked := s.fields[value.FieldID]; linked {
			byField[value.FieldID] = value
		}
	}
	return byField, nil
}

func (s *PropertySyncer) publishValuesUpdated(userID string, values []*model.PropertyValue) {
	if len(values) == 0 {
		return
	}
	byField := make(map[string]json.RawMessage, len(values))
	for _, value := range values {
		byField[value.FieldID] = value.Value
	}
	message := model.NewWebSocketEvent(model.WebsocketEventCPAValuesUpdated, "", "", "", nil, "")
	message.Add("user_id", userID)
	message.Add("values", byField)
	s.app.Publish(message)
}

func (s *PropertySyncer) sortOptionIDsByFieldOrder(fieldID string, optionIDs []string) {
	options, err := propertyFieldOptions(s.fields[fieldID])
	if err != nil {
		sort.Strings(optionIDs)
		return
	}
	position := make(map[string]int, len(options))
	for i, opt := range options {
		position[opt.ID] = i
	}
	sort.SliceStable(optionIDs, func(i, j int) bool {
		return position[optionIDs[i]] < position[optionIDs[j]]
	})
}

func (s *PropertySyncer) attributeOf(field *model.PropertyField) string {
	if field.Attrs == nil {
		return ""
	}
	name, _ := field.Attrs[s.attrKey].(string)
	return strings.TrimSpace(name)
}

func (s *PropertySyncer) withCaller(rctx request.CTX) request.CTX {
	return RequestContextWithCallerID(rctx, s.callerID)
}

// normalizeSourceValues trims, drops empty entries and removes duplicates
// while preserving source order. Case is preserved: an identity source that
// distinguishes "Sales" from "sales" gets two options, as it does everywhere
// else in Mattermost.
func normalizeSourceValues(raw []string) []string {
	out := make([]string, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, v := range raw {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, dup := seen[v]; dup {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

// propertyValueChanged reports whether writing desired would change what the
// user holds. Empty forms (missing row, null, "", []) are all "unset";
// multiselect values compare as sets.
func propertyValueChanged(fieldType model.PropertyFieldType, current *model.PropertyValue, desired json.RawMessage) bool {
	var currentRaw json.RawMessage
	if current != nil {
		currentRaw = current.Value
	}
	currentEmpty, desiredEmpty := model.IsEmptyPropertyValue(currentRaw), model.IsEmptyPropertyValue(desired)
	if currentEmpty || desiredEmpty {
		return currentEmpty != desiredEmpty
	}

	if fieldType == model.PropertyFieldTypeMultiselect {
		currentIDs, err1 := optionIDsFromValue(currentRaw)
		desiredIDs, err2 := optionIDsFromValue(desired)
		if err1 == nil && err2 == nil {
			slices.Sort(currentIDs)
			slices.Sort(desiredIDs)
			return !slices.Equal(currentIDs, desiredIDs)
		}
		return true
	}

	var currentStr, desiredStr string
	if json.Unmarshal(currentRaw, &currentStr) != nil || json.Unmarshal(desired, &desiredStr) != nil {
		return true
	}
	return currentStr != desiredStr
}

// lostOptionReferences reports whether desired drops any option ID that
// current referenced, meaning an option may have become orphaned.
func lostOptionReferences(current *model.PropertyValue, desired json.RawMessage) bool {
	if current == nil || model.IsEmptyPropertyValue(current.Value) {
		return false
	}
	before, err := optionIDsFromValue(current.Value)
	if err != nil {
		return false
	}
	after, err := optionIDsFromValue(desired)
	if err != nil {
		return true
	}
	for _, id := range before {
		if !slices.Contains(after, id) {
			return true
		}
	}
	return false
}

// optionIDsFromValue reads the option IDs of a select (JSON string) or
// multiselect (JSON string array) value. Empty forms yield no IDs.
func optionIDsFromValue(raw json.RawMessage) ([]string, error) {
	if model.IsEmptyPropertyValue(raw) {
		return nil, nil
	}
	var single string
	if err := json.Unmarshal(raw, &single); err == nil {
		return []string{single}, nil
	}
	var many []string
	if err := json.Unmarshal(raw, &many); err != nil {
		return nil, err
	}
	return many, nil
}

func propertyFieldOptions(field *model.PropertyField) (model.PropertyOptions[*model.CustomProfileAttributesSelectOption], error) {
	if field == nil || field.Attrs == nil {
		return nil, nil
	}
	raw, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok || raw == nil {
		return nil, nil
	}
	options, err := model.NewPropertyOptionsFromFieldAttrs[*model.CustomProfileAttributesSelectOption](raw)
	if err != nil {
		return nil, fmt.Errorf("field %s has invalid options: %w", field.ID, err)
	}
	return options, nil
}

// sortOptionsByName orders options case-insensitively by name, with a
// case-sensitive tiebreak so the order is total and stable across runs.
func sortOptionsByName(options model.PropertyOptions[*model.CustomProfileAttributesSelectOption]) {
	sort.SliceStable(options, func(i, j int) bool {
		a, b := strings.ToLower(options[i].Name), strings.ToLower(options[j].Name)
		if a != b {
			return a < b
		}
		return options[i].Name < options[j].Name
	})
}

func copyPropertyField(field *model.PropertyField) *model.PropertyField {
	cp := *field
	cp.Attrs = make(model.StringInterface, len(field.Attrs))
	maps.Copy(cp.Attrs, field.Attrs)
	return &cp
}
