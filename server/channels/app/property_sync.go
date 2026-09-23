// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"cmp"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// propertySyncMaxOptionRetries bounds how often a sync re-reads an option list
// that another writer changed between the sync's read and its write.
const propertySyncMaxOptionRetries = 3

// The errors an option change answers with when another writer got to the
// option list first: the list moved under the change's compare-and-swap, or it
// already has (or no longer has) an option the change names.
const (
	propertyFieldConflictErrorID   = "app.property_field.update.conflict.app_error"
	propertyFieldOptionItemErrorID = "app.property_field.options.invalid_item.app_error"
)

// propertyValueFieldNotFoundErrorID is what a value write answers with when its
// field no longer exists.
const propertyValueFieldNotFoundErrorID = "app.property_value.upsert.field_not_found.app_error"

// PropertySyncer applies the attribute values an identity source (AD/LDAP or
// SAML) reports for a user to the custom profile attributes synced from that
// source. It is the single implementation of sync semantics; the enterprise
// LDAP and SAML packages only translate their protocol payloads into the attrs
// map SyncUser consumes.
//
// An attribute is defined by a template -- a Global Attribute that user,
// channel and post fields link to -- or by a user field that links to nothing.
// The definition names the external attribute the values come from and owns
// the option list every field linked to it serves. The syncer writes values to
// the user field and provisions options on the definition, so a channel field
// linked to the same template offers the options the source introduced.
//
// Per field type:
//   - text: the first value is stored verbatim (subject to the text length
//     and value_type rules).
//   - select: the first value is matched, by exact name, to an option of the
//     definition. A missing option is created. The stored value is the option ID.
//   - multiselect: every value is matched or created the same way. The stored
//     value is the list of option IDs.
//
// Intentional design choice: an attribute that is absent from attrs, or
// present with no usable values, clears the user's value. The identity source
// is authoritative for a synced field, so what it does not report the user
// does not have; keeping a stale value would let a departed group membership
// keep satisfying an attribute-based access policy.
//
// Only the sync may add, rename or remove the options of a synced definition
// (see the attribute validation hook). PruneOrphanedOptions removes them again
// once no live value of any field linked to the definition references them.
//
// A syncer caches the synced fields and their option lists at construction.
// Create one per sync run (the LDAP job) or per login (SAML); it is safe for
// concurrent use but is not meant to outlive a change an admin makes to the
// fields. Syncers on different nodes are safe with each other: the property
// service compare-and-swaps every option change, and a sync that loses the
// race re-reads the option list and tries again.
type PropertySyncer struct {
	app       *App
	source    string
	callerID  string
	groupID   string
	logLevels propertySyncLogLevels

	mu sync.Mutex
	// fields are the user fields values are written to, ordered by name so a
	// user's result lists them the same way every time.
	fields []*syncedField
}

// syncedField is a user field and what its values are synced from.
type syncedField struct {
	field *model.PropertyField
	// attribute is the external attribute the definition names.
	attribute string
	// definition is shared by every synced field linking to the same template.
	definition *syncDefinition
}

// syncDefinition is the field that defines a synced attribute: the template a
// user field links to, or the user field itself.
type syncDefinition struct {
	field *model.PropertyField
	// optionIDs maps option name to ID. Loaded only for select and multiselect.
	optionIDs map[string]string
}

// propertySyncLogLevels are the levels the syncer logs at. The AD/LDAP source
// also logs at the LDAP-specific levels, like the rest of the LDAP sync, so its
// messages follow the AD/LDAP logging settings.
type propertySyncLogLevels struct {
	debug, info, warn, error []mlog.Level
}

func propertySyncLogLevelsFor(source string) propertySyncLogLevels {
	if source == model.PropertySyncSourceLDAP {
		return propertySyncLogLevels{debug: mlog.MlvlLDAPDebug, info: mlog.MlvlLDAPInfo, warn: mlog.MlvlLDAPWarn, error: mlog.MlvlLDAPError}
	}
	return propertySyncLogLevels{
		debug: []mlog.Level{mlog.LvlDebug},
		info:  []mlog.Level{mlog.LvlInfo},
		warn:  []mlog.Level{mlog.LvlWarn},
		error: []mlog.Level{mlog.LvlError},
	}
}

// NewPropertySyncer loads the user fields synced from source (one of
// model.PropertySyncSourceLDAP / model.PropertySyncSourceSAML) and returns a
// syncer for them.
//
// A field is synced from the source its definition names. A definition naming
// both is synced from AD/LDAP only, which is also the only sync the value lock
// admits for it (see model.GetPropertyFieldSyncSource).
func (a *App) NewPropertySyncer(rctx request.CTX, source string) (*PropertySyncer, *model.AppError) {
	if !model.IsValidPropertySyncSource(source) {
		return nil, model.NewAppError("NewPropertySyncer", "app.property_sync.invalid_source.app_error", nil, "source="+source, http.StatusBadRequest)
	}

	group, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		return nil, appErr
	}

	s := &PropertySyncer{
		app:       a,
		source:    source,
		callerID:  model.PropertySyncCallerID(source),
		groupID:   group.ID,
		logLevels: propertySyncLogLevelsFor(source),
	}
	if appErr := s.loadFields(s.withCaller(rctx)); appErr != nil {
		return nil, appErr
	}
	return s, nil
}

// HasMappings reports whether any field is synced from the source. Callers use
// it to skip attribute retrieval entirely when there is nothing to sync.
func (s *PropertySyncer) HasMappings() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.fields) > 0
}

// ExternalAttributes returns the distinct external attribute names the synced
// fields read from, sorted. LDAP callers add them to the search request so the
// directory returns them.
func (s *PropertySyncer) ExternalAttributes() []string {
	s.mu.Lock()
	defer s.mu.Unlock()

	names := make([]string, 0, len(s.fields))
	for _, sf := range s.fields {
		names = append(names, sf.attribute)
	}
	slices.Sort(names)
	return slices.Compact(names)
}

// SyncUser writes the values in attrs to the user's synced fields. attrs maps
// an external attribute name to the raw values the source reported for it,
// in source order; a nil map clears every synced field. The result reports,
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

	current, appErr := s.loadUserValues(rctx, userID)
	if appErr != nil {
		return nil, appErr
	}

	type pendingWrite struct {
		outcomeIdx int
		field      *syncedField
		value      *model.PropertyValue
	}
	var writes []pendingWrite
	// The definitions whose options this sync stops referencing for the user;
	// each may have lost its last holder.
	var shrunk []*syncDefinition

	for _, sf := range s.fields {
		outcome := model.PropertySyncFieldOutcome{
			FieldID:   sf.field.ID,
			FieldName: sf.field.Name,
			FieldType: sf.field.Type,
			Attribute: sf.attribute,
		}

		desired, err := s.desiredValue(rctx, sf, normalizeSourceValues(attrs[sf.attribute]), &outcome)
		result.OptionsCreated += outcome.OptionsCreated
		switch {
		case err != nil:
			outcome.Status = model.PropertySyncFieldError
			outcome.Reason = err.Error()
		case outcome.Status == model.PropertySyncFieldSkipped:
			// The stored value is left as it is.
		case !propertyValueChanged(sf.field.Type, current[sf.field.ID], desired):
			outcome.Status = model.PropertySyncFieldUnchanged
		default:
			outcome.Status = model.PropertySyncFieldUpdated
			if model.IsEmptyPropertyValue(desired) {
				outcome.Status = model.PropertySyncFieldCleared
			}
			if sf.field.Type.SupportsOptions() && lostOptionReferences(current[sf.field.ID], desired) && !slices.Contains(shrunk, sf.definition) {
				shrunk = append(shrunk, sf.definition)
			}
			writes = append(writes, pendingWrite{
				outcomeIdx: len(result.Fields),
				field:      sf,
				value: &model.PropertyValue{
					GroupID:    s.groupID,
					TargetType: model.PropertyValueTargetTypeUser,
					TargetID:   userID,
					FieldID:    sf.field.ID,
					Value:      desired,
				},
			})
		}
		result.Fields = append(result.Fields, outcome)
	}

	if len(writes) > 0 {
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
					if singleErr.Id == propertyValueFieldNotFoundErrorID {
						s.forget(rctx, w.field)
					}
					continue
				}
				upserted = append(upserted, single...)
			}
		}
		s.publishValuesUpdated(userID, upserted)
	}

	if opts.PruneOrphanedOptions && len(shrunk) > 0 {
		pruned, appErr := s.pruneDefinitions(rctx, shrunk)
		if appErr != nil {
			rctx.Logger().LogM(s.logLevels.warn, "Failed to remove unused options after syncing custom profile attributes",
				mlog.String("source", s.source), mlog.String("user_id", userID), mlog.Err(appErr))
		}
		result.OptionsPruned = pruned.OptionsPruned()
	}

	s.logOutcomes(rctx, result)
	return result, nil
}

// PruneOrphanedOptions removes, from every synced select and multiselect
// attribute, the options that no live value of any field linked to its
// definition references any more -- a channel's value keeps an option as surely
// as a user's does. Batch sources call it once after syncing all users so an
// option disappears with its last holder. Options an admin created before the
// attribute was synced are pruned too: once synced, the source is the only
// legitimate origin of its options.
func (s *PropertySyncer) PruneOrphanedOptions(rctx request.CTX) (*model.PropertySyncPruneResult, *model.AppError) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var definitions []*syncDefinition
	for _, sf := range s.fields {
		if sf.field.Type.SupportsOptions() && !slices.Contains(definitions, sf.definition) {
			definitions = append(definitions, sf.definition)
		}
	}
	return s.pruneDefinitions(s.withCaller(rctx), definitions)
}

func (s *PropertySyncer) pruneDefinitions(rctx request.CTX, definitions []*syncDefinition) (*model.PropertySyncPruneResult, *model.AppError) {
	result := &model.PropertySyncPruneResult{Fields: []model.PropertySyncPrunedField{}}
	for _, def := range definitions {
		pruned, appErr := s.pruneDefinition(rctx, def)
		if appErr != nil {
			return result, appErr
		}
		if pruned == nil {
			continue
		}
		result.Fields = append(result.Fields, *pruned)
		rctx.Logger().LogM(s.logLevels.info, "Removed unused options of synced custom profile attribute",
			mlog.String("source", s.source),
			mlog.String("field_id", pruned.FieldID),
			mlog.String("field_name", pruned.FieldName),
			mlog.Int("options_pruned", len(pruned.OptionIDs)))
	}
	return result, nil
}

// pruneDefinition removes the options of def that no live value of def or of a
// field linking to it references.
//
// The option list and the fields linking to def are read from the master
// together, and the property service compare-and-swaps the removal against its
// own read of the field, so an option another sync adds in between is never
// removed unseen: the removal is refused and retried against a fresh read. What
// this cannot rule out is a value naming an orphaned option being written
// between the read of the references and the removal. That value is then
// ignored like any value naming a missing option, until its user's next sync
// provisions the option again and rewrites it.
func (s *PropertySyncer) pruneDefinition(rctx request.CTX, def *syncDefinition) (*model.PropertySyncPrunedField, *model.AppError) {
	for attempt := 0; ; attempt++ {
		current, dependents, err := s.app.Srv().propertyService.FieldWithDependents(rctx, s.groupID, def.field.ID)
		if err != nil {
			return nil, model.NewAppError("PropertySyncer.pruneDefinition", "app.property_sync.referenced_options.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		def.field = current
		if appErr := s.loadOptions(rctx, def); appErr != nil {
			return nil, appErr
		}

		familyIDs := []string{current.ID}
		for _, dependent := range dependents {
			familyIDs = append(familyIDs, dependent.ID)
		}
		referenced, err := s.app.Srv().Store().PropertyValue().GetReferencedOptionIDs(s.groupID, familyIDs)
		if err != nil {
			return nil, model.NewAppError("PropertySyncer.pruneDefinition", "app.property_sync.referenced_options.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		inUse := make(map[string]bool, len(referenced))
		for _, id := range referenced {
			inUse[id] = true
		}
		var orphaned []string
		for _, id := range def.optionIDs {
			if !inUse[id] {
				orphaned = append(orphaned, id)
			}
		}
		if len(orphaned) == 0 {
			return nil, nil
		}
		slices.Sort(orphaned)

		appErr := s.deleteOptions(rctx, def, orphaned)
		if appErr == nil {
			return &model.PropertySyncPrunedField{FieldID: current.ID, FieldName: current.Name, OptionIDs: orphaned}, nil
		}
		if !lostOptionRace(appErr) || attempt == propertySyncMaxOptionRetries {
			return nil, appErr
		}
	}
}

// deleteOptions removes options from def in batches the options API accepts,
// dropping each batch from the cached list as it lands.
func (s *PropertySyncer) deleteOptions(rctx request.CTX, def *syncDefinition, optionIDs []string) *model.AppError {
	for batch := range slices.Chunk(optionIDs, model.PropertyFieldOptionsMaxPerRequest) {
		deleted, appErr := s.app.DeletePropertyFieldOptions(rctx, s.groupID, def.field.ID, batch, "")
		if appErr != nil {
			return appErr
		}
		for _, option := range deleted {
			delete(def.optionIDs, option.Name)
		}
	}
	return nil
}

// desiredValue computes the JSON value the field should hold for the given
// source values, provisioning options where needed. It marks the outcome
// skipped (with a reason) when a value cannot be synced, and records dropped
// values and created options on it.
func (s *PropertySyncer) desiredValue(rctx request.CTX, sf *syncedField, values []string, outcome *model.PropertySyncFieldOutcome) (json.RawMessage, error) {
	switch sf.field.Type {
	case model.PropertyFieldTypeText:
		if len(values) == 0 {
			return json.RawMessage(`""`), nil
		}
		value := values[0]
		if len(value) > model.PropertyFieldValueTypeTextMaxLength {
			return skipValue(outcome, value, fmt.Sprintf("value exceeds the %d character limit for text attributes", model.PropertyFieldValueTypeTextMaxLength))
		}
		raw, err := json.Marshal(value)
		if err != nil {
			return nil, err
		}
		// The validation error would quote the value, so only its type is reported.
		if valueType := model.GetPropertyFieldValueType(sf.field); valueType != "" && model.ValidatePropertyValueForValueType(valueType, raw) != nil {
			return skipValue(outcome, value, fmt.Sprintf("value is not a valid %s", valueType))
		}
		return raw, nil

	case model.PropertyFieldTypeSelect:
		if len(values) == 0 {
			return json.RawMessage(`""`), nil
		}
		value := values[0]
		if len(value) > model.CPAOptionNameMaxLength {
			return skipValue(outcome, value, fmt.Sprintf("value exceeds the %d character limit for option names", model.CPAOptionNameMaxLength))
		}
		created, dropped, appErr := s.ensureOptions(rctx, sf.definition, []string{value})
		outcome.OptionsCreated += created
		if appErr != nil {
			return nil, appErr
		}
		if len(dropped) > 0 {
			return skipValue(outcome, value, fmt.Sprintf("the attribute already has the maximum of %d options", model.PropertySyncMaxOptionsPerField))
		}
		return json.Marshal(sf.definition.optionIDs[value])

	case model.PropertyFieldTypeMultiselect:
		var reasons []string
		eligible := make([]string, 0, len(values))
		for _, value := range values {
			if len(value) > model.CPAOptionNameMaxLength {
				outcome.DroppedValues = append(outcome.DroppedValues, value)
				continue
			}
			eligible = append(eligible, value)
		}
		if len(outcome.DroppedValues) > 0 {
			reasons = append(reasons, fmt.Sprintf("%d value(s) exceed the %d character limit for option names", len(outcome.DroppedValues), model.CPAOptionNameMaxLength))
		}

		created, dropped, appErr := s.ensureOptions(rctx, sf.definition, eligible)
		outcome.OptionsCreated += created
		if appErr != nil {
			return nil, appErr
		}
		if len(dropped) > 0 {
			outcome.DroppedValues = append(outcome.DroppedValues, dropped...)
			reasons = append(reasons, fmt.Sprintf("%d value(s) dropped because the attribute already has the maximum of %d options", len(dropped), model.PropertySyncMaxOptionsPerField))
		}
		outcome.Reason = strings.Join(reasons, "; ")

		optionIDs := make([]string, 0, len(eligible))
		for _, value := range eligible {
			if id, ok := sf.definition.optionIDs[value]; ok {
				optionIDs = append(optionIDs, id)
			}
		}
		return json.Marshal(optionIDs)
	}

	return nil, fmt.Errorf("field type %s cannot be synced", sf.field.Type)
}

func skipValue(outcome *model.PropertySyncFieldOutcome, value, reason string) (json.RawMessage, error) {
	outcome.Status = model.PropertySyncFieldSkipped
	outcome.Reason = reason
	outcome.DroppedValues = append(outcome.DroppedValues, value)
	return nil, nil
}

// ensureOptions makes sure def has an option for every name, creating the ones
// it lacks. Matching is exact and case-preserving, like option name uniqueness.
// Names that do not fit under PropertySyncMaxOptionsPerField are returned as
// dropped. When another writer changes the option list first -- another node
// creating the same name, or a prune -- the list is re-read and the names still
// missing are created against it, so racing syncs converge on one option.
func (s *PropertySyncer) ensureOptions(rctx request.CTX, def *syncDefinition, names []string) (created int, dropped []string, appErr *model.AppError) {
	for attempt := 0; ; attempt++ {
		var missing []string
		for _, name := range names {
			if _, ok := def.optionIDs[name]; !ok {
				missing = append(missing, name)
			}
		}
		room := max(model.PropertySyncMaxOptionsPerField-len(def.optionIDs), 0)
		dropped = nil
		if len(missing) > room {
			dropped = missing[room:]
			missing = missing[:room]
		}
		if len(missing) == 0 {
			return created, dropped, nil
		}

		n, appErr := s.createOptions(rctx, def, missing)
		created += n
		if appErr == nil {
			return created, dropped, nil
		}
		if !lostOptionRace(appErr) || attempt == propertySyncMaxOptionRetries {
			return created, dropped, appErr
		}
		if appErr := s.refreshDefinition(rctx, def); appErr != nil {
			return created, dropped, appErr
		}
	}
}

// createOptions adds options named names to def in batches the options API
// accepts, recording each batch in the cached list as it lands.
func (s *PropertySyncer) createOptions(rctx request.CTX, def *syncDefinition, names []string) (int, *model.AppError) {
	created := 0
	for batch := range slices.Chunk(names, model.PropertyFieldOptionsMaxPerRequest) {
		options := make([]*model.PropertyFieldOption, 0, len(batch))
		for _, name := range batch {
			options = append(options, &model.PropertyFieldOption{Name: name})
		}
		saved, appErr := s.app.CreatePropertyFieldOptions(rctx, s.groupID, def.field.ID, options, "")
		if appErr != nil {
			return created, appErr
		}
		for _, option := range saved {
			def.optionIDs[option.Name] = option.ID
		}
		created += len(saved)
	}
	return created, nil
}

// lostOptionRace reports whether an option change was refused because another
// writer changed the option list after this syncer read it.
func lostOptionRace(appErr *model.AppError) bool {
	return appErr.Id == propertyFieldConflictErrorID || appErr.Id == propertyFieldOptionItemErrorID
}

// loadFields reads the synced fields and their definitions from the master:
// the LDAP job keeps them for its whole run, so a field linked moments earlier
// on another node must not be missed for all of it.
func (s *PropertySyncer) loadFields(rctx request.CTX) *model.AppError {
	rctx = RequestContextWithMaster(rctx)
	userFields, appErr := s.app.SearchPropertyFields(rctx, s.groupID, model.PropertyFieldSearchOpts{
		ObjectTypes: []string{model.PropertyFieldObjectTypeUser},
		PerPage:     model.AccessControlGroupFieldLimit + 5,
	})
	if appErr != nil {
		return appErr
	}

	definitions := make(map[string]*syncDefinition, len(userFields))
	var templateIDs []string
	for _, field := range userFields {
		if templateID := field.LinkSourceID(); templateID != "" {
			if !slices.Contains(templateIDs, templateID) {
				templateIDs = append(templateIDs, templateID)
			}
		} else {
			definitions[field.ID] = &syncDefinition{field: field}
		}
	}
	if len(templateIDs) > 0 {
		templates, appErr := s.app.GetPropertyFields(rctx, s.groupID, templateIDs)
		if appErr != nil {
			return appErr
		}
		for _, template := range templates {
			definitions[template.ID] = &syncDefinition{field: template}
		}
	}

	s.fields = nil
	for _, field := range userFields {
		def := definitions[cmp.Or(field.LinkSourceID(), field.ID)]
		if def == nil || def.field.DeleteAt != 0 || model.GetPropertyFieldSyncSource(def.field) != s.source {
			continue
		}
		if !field.Type.SupportsExternalSync() {
			// Only reachable through legacy data: the validation hook strips the
			// sync link from a field whose type cannot be synced.
			rctx.Logger().LogM(s.logLevels.warn, "Ignoring synced custom profile attribute whose type cannot be synced",
				mlog.String("source", s.source), mlog.String("field_id", field.ID), mlog.String("field_type", string(field.Type)))
			continue
		}
		if field.Type.SupportsOptions() && def.optionIDs == nil {
			if appErr := s.loadOptions(rctx, def); appErr != nil {
				return appErr
			}
		}
		attribute, _ := def.field.Attrs[model.PropertySyncSourceAttr(s.source)].(string)
		s.fields = append(s.fields, &syncedField{field: field, attribute: attribute, definition: def})
	}

	slices.SortFunc(s.fields, func(a, b *syncedField) int {
		return cmp.Or(cmp.Compare(a.field.Name, b.field.Name), cmp.Compare(a.field.ID, b.field.ID))
	})
	return nil
}

// loadOptions caches def's option list from the options the field was read
// with. Past PropertyFieldMaxHydratedOptions a field is read without them, and
// the list is paged through instead.
func (s *PropertySyncer) loadOptions(rctx request.CTX, def *syncDefinition) *model.AppError {
	optionIDs := map[string]string{}
	if !model.PropertyFieldOptionsOmitted(def.field.Attrs) {
		if raw := def.field.Attrs[model.PropertyFieldAttributeOptions]; raw != nil {
			options, err := model.NewPropertyOptionsFromFieldAttrs[*model.CustomProfileAttributesSelectOption](raw)
			if err != nil {
				return model.NewAppError("PropertySyncer.loadOptions", "app.property_sync.invalid_options.app_error", nil, "field_id="+def.field.ID, http.StatusInternalServerError).Wrap(err)
			}
			for _, option := range options {
				optionIDs[option.Name] = option.ID
			}
		}
		def.optionIDs = optionIDs
		return nil
	}

	var cursorCreateAt int64
	var cursorID string
	for {
		page, appErr := s.app.GetPropertyFieldOptions(rctx, s.groupID, def.field.ID, cursorCreateAt, cursorID, model.PropertyFieldOptionsMaxPerRequest)
		if appErr != nil {
			return appErr
		}
		for _, option := range page.Options {
			optionIDs[option.Name] = option.ID
		}
		if !page.HasMore {
			break
		}
		cursorCreateAt, cursorID = page.NextCursorCreateAt, page.NextCursorID
	}
	def.optionIDs = optionIDs
	return nil
}

// refreshDefinition re-reads def and its option list from the master after
// another writer changed them.
func (s *PropertySyncer) refreshDefinition(rctx request.CTX, def *syncDefinition) *model.AppError {
	rctx = RequestContextWithMaster(rctx)
	field, appErr := s.app.GetPropertyField(rctx, s.groupID, def.field.ID)
	if appErr != nil {
		return appErr
	}
	def.field = field
	return s.loadOptions(rctx, def)
}

// forget stops syncing a field that was deleted while this syncer was running,
// so the rest of a sync run does not fail the same write for every user.
func (s *PropertySyncer) forget(rctx request.CTX, sf *syncedField) {
	s.fields = slices.DeleteFunc(s.fields, func(other *syncedField) bool { return other == sf })
	rctx.Logger().LogM(s.logLevels.warn, "Stopped syncing a custom profile attribute that no longer exists",
		mlog.String("source", s.source), mlog.String("field_id", sf.field.ID))
}

func (s *PropertySyncer) loadUserValues(rctx request.CTX, userID string) (map[string]*model.PropertyValue, *model.AppError) {
	values, appErr := s.app.SearchPropertyValues(rctx, s.groupID, model.PropertyValueSearchOpts{
		GroupID:    s.groupID,
		TargetType: model.PropertyValueTargetTypeUser,
		TargetIDs:  []string{userID},
		PerPage:    model.AccessControlGroupFieldLimit + 5,
	})
	if appErr != nil {
		return nil, appErr
	}

	byField := make(map[string]*model.PropertyValue, len(values))
	for _, value := range values {
		byField[value.FieldID] = value
	}
	return byField, nil
}

// publishValuesUpdated sends the custom profile attribute event for the
// written values. UpsertPropertyValues already announces them as
// property_values_updated; this event is kept for clients that still listen
// for it. Like every broadcast, it withholds the values of fields whose access
// mode restricts who may read them.
func (s *PropertySyncer) publishValuesUpdated(userID string, values []*model.PropertyValue) {
	if len(values) == 0 {
		return
	}
	byField := make(map[string]json.RawMessage, len(values))
	for _, value := range values {
		var field *model.PropertyField
		if i := slices.IndexFunc(s.fields, func(sf *syncedField) bool { return sf.field.ID == value.FieldID }); i >= 0 {
			field = s.fields[i].field
		}
		byField[value.FieldID] = model.BroadcastValue(field, value.Value)
	}
	message := model.NewWebSocketEvent(model.WebsocketEventCPAValuesUpdated, "", "", "", nil, "")
	message.Add("user_id", userID)
	message.Add("values", byField)
	s.app.Publish(message)
}

// logOutcomes reports what the sync did to each field of one user: changes at
// debug, values that could not be synced as warnings, failed writes as errors.
// Attribute values are counted, never logged.
func (s *PropertySyncer) logOutcomes(rctx request.CTX, result *model.PropertySyncResult) {
	for _, outcome := range result.Fields {
		fields := []mlog.Field{
			mlog.String("source", s.source),
			mlog.String("user_id", result.UserID),
			mlog.String("field_id", outcome.FieldID),
			mlog.String("attribute", outcome.Attribute),
			mlog.String("status", string(outcome.Status)),
		}
		if outcome.OptionsCreated > 0 {
			fields = append(fields, mlog.Int("options_created", outcome.OptionsCreated))
		}
		if len(outcome.DroppedValues) > 0 {
			fields = append(fields, mlog.Int("dropped_values", len(outcome.DroppedValues)))
		}
		if outcome.Reason != "" {
			fields = append(fields, mlog.String("reason", outcome.Reason))
		}

		switch {
		case outcome.Status == model.PropertySyncFieldError:
			rctx.Logger().LogM(s.logLevels.error, "Failed to sync custom profile attribute", fields...)
		case outcome.Status == model.PropertySyncFieldSkipped || len(outcome.DroppedValues) > 0:
			rctx.Logger().LogM(s.logLevels.warn, "Could not sync every value of a custom profile attribute", fields...)
		case outcome.Status == model.PropertySyncFieldUpdated || outcome.Status == model.PropertySyncFieldCleared:
			rctx.Logger().LogM(s.logLevels.debug, "Synced custom profile attribute", fields...)
		}
	}
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
	seen := make(map[string]bool, len(raw))
	for _, v := range raw {
		v = strings.TrimSpace(v)
		if v != "" && !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
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
		if err1 != nil || err2 != nil {
			return true
		}
		slices.Sort(currentIDs)
		slices.Sort(desiredIDs)
		return !slices.Equal(currentIDs, desiredIDs)
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
	if current == nil {
		return false
	}
	before, err := optionIDsFromValue(current.Value)
	if err != nil {
		return false
	}
	after, err := optionIDsFromValue(desired)
	if err != nil {
		return len(before) > 0
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
