// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"reflect"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// enforceFieldGroupVersionMatch checks that the field and group versions are
// compatible. It returns an error if the field is PSAv1 on a PSAv2 group or
// vice versa. The lookup uses GroupByID which checks the cache first and falls
// back to the database.
func (ps *PropertyService) enforceFieldGroupVersionMatch(caller string, groupID string, field *model.PropertyField) error {
	group, err := ps.GroupByID(groupID)
	if err != nil {
		return fmt.Errorf("%s: failed to look up group for version check: %w", caller, err)
	}

	if group.IsPSAv1() && field.IsPSAv1() {
		return nil
	}
	if (group.IsPSAv2() || group.IsPSAv3()) && field.IsPSAv2() {
		return nil
	}

	return model.NewAppError(caller, "app.property_field.version_mismatch.app_error", nil,
		"field and group version mismatch", http.StatusBadRequest)
}

// Private implementation methods (database access)

func (ps *PropertyService) createPropertyField(field *model.PropertyField) (*model.PropertyField, error) {
	// Whether the caller asked for options of its own, recorded before the linked
	// field block below can replace the list with its link source's.
	suppliedOptions := model.PropertyFieldSuppliesOptions(field.Attrs)

	// Enforce version match between field and group
	if err := ps.enforceFieldGroupVersionMatch("CreatePropertyField", field.GroupID, field); err != nil {
		return nil, err
	}

	// Legacy properties (PSAv1) skip the conflict check.
	if field.IsPSAv1() {
		// A legacy field skips the link validation block below entirely, so
		// without this it could be created carrying both a link and its own
		// option list: the store still honours the link when hydrating
		// options, leaving two lists nothing reconciles. Not conditioned on
		// type -- a flat list collides with an inherited one as badly as a
		// graph does.
		if suppliedOptions && field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
			return nil, optionsChangeRefused(
				"a field linking to field %s takes its option list from that field, so it cannot be created carrying one",
				*field.LinkedFieldID)
		}
		return ps.createFieldWithOptionLinks(field)
	}

	// If this field links to a source, validate the source and copy its schema.
	// source is declared here rather than with := inside the block below so
	// the permissions default after the block can reuse this same fetch
	// instead of reading the template a second time.
	var source *model.PropertyField
	if field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
		// Templates are definition-only and cannot themselves be linked
		if field.ObjectType == model.PropertyFieldObjectTypeTemplate {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.template_cannot_be_linked.app_error",
				nil,
				"template fields cannot have a linked_field_id",
				http.StatusBadRequest,
			)
		}

		var err error
		source, err = ps.fieldStore.Get(store.WithMaster(context.Background()), "", *field.LinkedFieldID)
		if err != nil {
			if store.IsErrNotFound(err) {
				return nil, model.NewAppError(
					"CreatePropertyField",
					"app.property_field.create.linked_source_not_found.app_error",
					nil,
					fmt.Sprintf("linked source field %q not found", *field.LinkedFieldID),
					http.StatusBadRequest,
				)
			}
			return nil, fmt.Errorf("failed to get linked source field %q: %w", *field.LinkedFieldID, err)
		}

		// Cross-group linking is not supported
		if source.GroupID != field.GroupID {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_cross_group.app_error",
				nil,
				fmt.Sprintf("cannot link to field %q in group %q: source must be in the same group %q", *field.LinkedFieldID, source.GroupID, field.GroupID),
				http.StatusBadRequest,
			)
		}

		if source.DeleteAt != 0 {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_deleted.app_error",
				nil,
				fmt.Sprintf("linked source field %q is deleted", *field.LinkedFieldID),
				http.StatusBadRequest,
			)
		}

		// Only template fields can be link sources
		if source.ObjectType != model.PropertyFieldObjectTypeTemplate {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_not_template.app_error",
				nil,
				"can only link to template fields",
				http.StatusBadRequest,
			)
		}

		// Linked field's TargetType must match the source template's TargetType
		if field.TargetType != source.TargetType {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_target_type_mismatch.app_error",
				nil,
				fmt.Sprintf("linked field target_type %q must match source template target_type %q", field.TargetType, source.TargetType),
				http.StatusBadRequest,
			)
		}

		// Prevent chains: source must not itself be linked
		if source.LinkedFieldID != nil && *source.LinkedFieldID != "" {
			return nil, model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_is_linked.app_error",
				nil,
				"cannot link to a field that is itself linked (no chains allowed)",
				http.StatusBadRequest,
			)
		}

		if err := validateLinkedFieldOptionReadCeiling("CreatePropertyField", field, source); err != nil {
			return nil, err
		}

		// A linked field serves its template's option list and owns none of its
		// own. Refused rather than dropped: a caller that sent options would
		// otherwise be told they were created, when the list actually saved is
		// the template's. The legacy path above refuses the same combination
		// for the same reason.
		if suppliedOptions {
			return nil, optionsChangeRefused(
				"a field linking to template %s takes its option list from that template, so it cannot be created carrying one",
				*field.LinkedFieldID)
		}

		// Copy type and options from source
		field.Type = source.Type
		if field.Attrs == nil {
			field.Attrs = make(model.StringInterface)
		}
		if source.Attrs != nil {
			if opts, ok := source.Attrs[model.PropertyFieldAttributeOptions]; ok {
				field.Attrs[model.PropertyFieldAttributeOptions] = opts
			}
		}
	}

	if err := ps.defaultPropertyFieldPermissions(field, source); err != nil {
		return nil, err
	}

	// Check for hierarchical name conflicts
	conflictLevel, err := ps.fieldStore.CheckPropertyNameConflict(field, "")
	if err != nil {
		return nil, fmt.Errorf("failed to check property name conflict: %w", err)
	}

	if conflictLevel != "" {
		return nil, model.NewAppError(
			"CreatePropertyField",
			"app.property_field.create.name_conflict.app_error",
			map[string]any{"Name": field.Name, "ConflictLevel": string(conflictLevel)},
			fmt.Sprintf("property name %q conflicts with existing %s-level property", field.Name, string(conflictLevel)),
			http.StatusConflict,
		)
	}

	return ps.createFieldWithOptionLinks(field)
}

// defaultPropertyFieldPermissions gives field a Permissions object converted
// from its legacy permission columns and, for an access_control field, its
// Attrs, when the caller submitted none -- so every PSAv2/v3 field reaches the
// store carrying one, and the decision engine can eventually stop consulting
// the legacy columns at all. A field arriving with its own Permissions is left
// exactly as submitted: a v3 caller's object is authoritative, and a caller
// creating a field controls its own permissions by design. template is the
// linked field's source when field.LinkedFieldID is set (nil otherwise); its
// Permissions caps the converted field's own option.read, the same cap the
// startup backfill applies when converting a linked field.
func (ps *PropertyService) defaultPropertyFieldPermissions(field *model.PropertyField, template *model.PropertyField) error {
	if field.Permissions != nil {
		return nil
	}

	convertAttrs, err := ps.groupConvertsAttrs(field.GroupID)
	if err != nil {
		return fmt.Errorf("defaultPropertyFieldPermissions: %w", err)
	}

	opts := model.LegacyConversionOpts{ConvertAttrs: convertAttrs, Template: templatePermissionsOrZero(template)}
	field.Permissions = model.PermissionsFromLegacy(field, opts)

	// A fresh install creates boards/session_attributes/managed_category's
	// builtin fields through this same path, and PermissionsFromLegacy mints no
	// grant for them (their group's Attrs were never enforced, so
	// ConvertAttrs is false and grantsFromLegacy never runs). Without this,
	// the very first version bump after creation would find its own field
	// carrying permissions and no matching grant, and refuse itself.
	group, err := ps.GroupByID(field.GroupID)
	if err != nil {
		return fmt.Errorf("defaultPropertyFieldPermissions: failed to resolve group name: %w", err)
	}
	if grant := model.SystemOwnedFieldGrant(group.Name, field.Name); grant != nil {
		field.Permissions.Grants = append(field.Permissions.Grants, *grant)
	}
	return nil
}

// groupConvertsAttrs reports whether groupID is the access_control group,
// which is the only group whose Attrs (protected, access_mode, owners,
// source plugin, sync lock) were ever enforced -- everywhere else there is
// nothing in Attrs to preserve. A deployment that has never registered the
// group (no CPA fields at all) cannot have a field belonging to it either,
// so a not-found lookup means false rather than a failed create or update.
func (ps *PropertyService) groupConvertsAttrs(groupID string) (bool, error) {
	accessControlGroup, err := ps.Group(model.AccessControlPropertyGroupName)
	var notFound *store.ErrNotFound
	switch {
	case err == nil:
		return groupID == accessControlGroup.ID, nil
	case errors.As(err, &notFound):
		// ps.Group wraps the store error, so the not-found check has to see
		// through that wrapping -- store.IsErrNotFound does a plain type
		// assertion and would miss it.
		return false, nil
	default:
		return false, fmt.Errorf("failed to get access control property group: %w", err)
	}
}

// templatePermissionsOrZero returns template's Permissions, or a zero-value
// Permissions when template is nil (field is not linked) or has not itself
// converted yet -- a template still legacy-shaped is a row the startup
// backfill has not reached, and validateLinkedFieldOptionReadCeiling already
// treats an unconverted template as a ceiling of none for the same reason:
// there is nothing yet to compare against, and refusing the field's own
// option.read anything but none is the recoverable direction.
func templatePermissionsOrZero(template *model.PropertyField) *model.Permissions {
	if template == nil {
		return nil
	}
	if template.Permissions != nil {
		return template.Permissions
	}
	return &model.Permissions{}
}

// validateLinkedFieldOptionReadCeiling refuses a linked field whose option.read
// tier is more permissive than its template's. option.read on a linked field
// governs the same list the template owns, so without this check a linked
// field could be created against a sensitive template with option.read thrown
// wide open, exposing a scheme the template itself never admitted that widely.
// A linked field may match its template's tier or tighten it, never loosen it.
//
// A template carrying no permissions object at all has a ceiling of none:
// there is nothing to compare against, and refusing is the recoverable
// direction — the operator sets the template's option.read first, rather than
// the linked field being created against a comparison that was never made.
func validateLinkedFieldOptionReadCeiling(caller string, field, template *model.PropertyField) error {
	if field.Permissions == nil {
		return nil
	}

	fieldTier := field.Permissions.Restrictions.TierFor(model.PropertyActionOptionRead)

	templateTier := model.PermissionLevelNone
	if template.Permissions != nil {
		templateTier = template.Permissions.Restrictions.TierFor(model.PropertyActionOptionRead)
	}

	if fieldTier.AtMostAsPermissiveAs(templateTier) {
		return nil
	}

	return model.NewAppError(
		caller,
		"app.property_field.linked_option_read_ceiling.app_error",
		map[string]any{"FieldTier": string(fieldTier), "TemplateID": template.ID, "TemplateTier": string(templateTier)},
		fmt.Sprintf("option.read tier %q exceeds template %q's tier %q", fieldTier, template.ID, templateTier),
		http.StatusBadRequest,
	)
}

// validateDependentOptionReadCeilings refuses a template update that tightens
// its own option.read below the tier of a field already linked to it.
// validateLinkedFieldOptionReadCeiling closes the other half of this ceiling —
// a linked field may not move above its template's tier — but a linked field
// serves its template's option names without holding a copy of them, and who
// may read them is decided against the linked field's own option.read, never
// the template's. So a template's tier could otherwise be lowered out from
// under a dependent that already sits at the old, more permissive tier, and
// the dependent would go on serving those names to everyone it was already
// open to.
//
// It runs on every field in the update loop, not only templates: a field
// nothing links to simply has no dependents to check, and loading them costs
// nothing when the tier did not tighten (see the early return below).
//
// incoming holds every field in the same UpdatePropertyFields call, keyed by
// ID: a dependent this same call also updates has not reached the store yet,
// so checking against its stored row would miss a tier the call is raising or
// lowering right alongside the template.
func (ps *PropertyService) validateDependentOptionReadCeilings(field, existing *model.PropertyField, incoming map[string]*model.PropertyField) error {
	newTier := model.PermissionLevelNone
	if field.Permissions != nil {
		newTier = field.Permissions.Restrictions.TierFor(model.PropertyActionOptionRead)
	}

	oldTier := model.PermissionLevelNone
	if existing.Permissions != nil {
		oldTier = existing.Permissions.Restrictions.TierFor(model.PropertyActionOptionRead)
	}

	// Nothing to check unless the tier tightened. Loosening a template can
	// never put a dependent above it, and an unchanged tier was already
	// checked when each dependent was written.
	if newTier == oldTier || !newTier.AtMostAsPermissiveAs(oldTier) {
		return nil
	}

	dependents, err := ps.fieldStore.GetLinkedFields([]string{field.ID}, nil)
	if err != nil {
		return fmt.Errorf("failed to get linked fields for option.read ceiling check: %w", err)
	}

	for _, dependent := range dependents {
		if inc, ok := incoming[dependent.ID]; ok {
			// A dependent this same call unlinks serves no options at all once
			// unlinked, so the template's tier no longer governs anything it
			// shows. Both nil and "" mean unlinked here: the empty-string-to-nil
			// canonicalization happens in that field's own turn round the update
			// loop, which may not have come yet relative to this one.
			if inc.LinkedFieldID == nil || *inc.LinkedFieldID == "" {
				continue
			}
			dependent = inc
		}

		dependentTier := model.PermissionLevelNone
		if dependent.Permissions != nil {
			dependentTier = dependent.Permissions.Restrictions.TierFor(model.PropertyActionOptionRead)
		}

		if !dependentTier.AtMostAsPermissiveAs(newTier) {
			return model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.option_read_ceiling_dependents.app_error",
				map[string]any{"DependentID": dependent.ID, "DependentTier": string(dependentTier), "NewTier": string(newTier)},
				fmt.Sprintf("linked field %q at option.read tier %q would exceed the template's new tier %q", dependent.ID, dependentTier, newTier),
				http.StatusConflict,
			)
		}
	}

	return nil
}

// createFieldWithOptionLinks writes a new field once the hierarchy its option
// list asks for has been checked.
//
// It is called after the schema a linked field takes from its template has been
// copied over, which is what makes the type it reads the field's real one: a field
// created by linking to a graph template arrives with no mention of the graph type
// anywhere in the request. The other call site is the legacy path above: it returns
// before that copy step runs, so a legacy field's schema is never copied from
// anything it links to, even when it carries its own LinkedFieldID.
func (ps *PropertyService) createFieldWithOptionLinks(field *model.PropertyField) (*model.PropertyField, error) {
	if field.Type == model.PropertyFieldTypeGraph && optionSourceID(field) != "" {
		// Two callers reach this branch and both skip validateOptionBlobLinks, for
		// different reasons. On the linking path, any list the field carries now is
		// its template's, copied in above so a read of the new field shows what it
		// serves — none of it is this field's to own. On the legacy path there is no
		// list to validate: a legacy field carrying both a link and an option list is
		// refused before createFieldWithOptionLinks is ever called. Either way the
		// store leaves an option owned by the link source alone.
		return ps.fieldStore.Create(field)
	}

	if err := ps.validateOptionBlobLinks(field, nil); err != nil {
		return nil, err
	}
	return ps.fieldStore.Create(field)
}

func (ps *PropertyService) getPropertyField(groupID, id string) (*model.PropertyField, error) {
	return ps.fieldStore.Get(context.Background(), groupID, id)
}

func (ps *PropertyService) getPropertyFieldFromMaster(groupID, id string) (*model.PropertyField, error) {
	return ps.fieldStore.Get(store.WithMaster(context.Background()), groupID, id)
}

func (ps *PropertyService) getPropertyFields(groupID string, ids []string) ([]*model.PropertyField, error) {
	fields, err := ps.fieldStore.GetMany(context.Background(), groupID, ids)
	if err != nil {
		var resultsMismatchErr *store.ErrResultsMismatch
		if errors.As(err, &resultsMismatchErr) {
			return nil, fmt.Errorf("%w: %w", ErrFieldNotFound, err)
		}
		return nil, err
	}
	return fields, nil
}

func (ps *PropertyService) getPropertyFieldByName(groupID, targetID, name string) (*model.PropertyField, error) {
	return ps.fieldStore.GetFieldByName(context.Background(), groupID, targetID, name)
}

func (ps *PropertyService) getPropertyFieldByNameForObjectType(groupID, targetID, objectType, name string) (*model.PropertyField, error) {
	return ps.fieldStore.GetFieldByNameForObjectType(context.Background(), groupID, targetID, objectType, name)
}

func (ps *PropertyService) countActivePropertyFieldsForGroup(groupID string) (int64, error) {
	return ps.fieldStore.CountForGroup(groupID, false)
}

func (ps *PropertyService) countAllPropertyFieldsForGroup(groupID string) (int64, error) {
	return ps.fieldStore.CountForGroup(groupID, true)
}

func (ps *PropertyService) countActivePropertyFieldsForGroupObjectType(groupID, objectType string) (int64, error) {
	return ps.fieldStore.CountForGroupObjectType(groupID, objectType, false)
}

func (ps *PropertyService) countActivePropertyFieldsForTarget(groupID, targetType, targetID string) (int64, error) {
	return ps.fieldStore.CountForTarget(groupID, targetType, targetID, false)
}

func (ps *PropertyService) countAllPropertyFieldsForTarget(groupID, targetType, targetID string) (int64, error) {
	return ps.fieldStore.CountForTarget(groupID, targetType, targetID, true)
}

func (ps *PropertyService) searchPropertyFields(groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	// groupID is part of the search method signature to
	// incentivize the use of the database indexes in searches
	opts.GroupID = groupID

	return ps.fieldStore.SearchPropertyFields(opts)
}

func (ps *PropertyService) updatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, []string, error) {
	fields, _, clearedIDs, err := ps.updatePropertyFields(rctx, groupID, []*model.PropertyField{field})
	if err != nil {
		return nil, nil, err
	}

	return fields[0], clearedIDs, nil
}

func (ps *PropertyService) updatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) (requested []*model.PropertyField, propagated []*model.PropertyField, clearedFieldIDs []string, err error) {
	if len(fields) == 0 {
		return nil, nil, nil, nil
	}

	// Fetch existing fields to compare for changes that require conflict check
	ids := make([]string, len(fields))
	for i, f := range fields {
		if f == nil {
			return nil, nil, nil, fmt.Errorf("field at index %d is nil", i)
		}
		ids[i] = f.ID
	}

	// Read from master to avoid replication lag between this read and the
	// subsequent UPDATE (which also runs against master). This closes the
	// TOCTOU window that a replica read would leave open.
	existingFields, err := ps.fieldStore.GetMany(store.WithMaster(context.Background()), groupID, ids)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to get existing fields for update: %w", err)
	}

	// Build a map of existing fields by ID for quick lookup
	existingByID := make(map[string]*model.PropertyField, len(existingFields))
	for _, ef := range existingFields {
		existingByID[ef.ID] = ef
	}

	// A field elsewhere in this same call is not yet in the store, so the
	// option.read ceiling checks below must consult this map before falling
	// back to a store read — otherwise a call that moves a template and one
	// of its linked fields in the same request has each side judged against
	// the other's stale, pre-update row.
	incoming := make(map[string]*model.PropertyField, len(fields))
	for _, f := range fields {
		incoming[f.ID] = f
	}

	// Enforce version match between field and group for each field
	for _, field := range fields {
		if err := ps.enforceFieldGroupVersionMatch("UpdatePropertyFields", groupID, field); err != nil {
			return nil, nil, nil, err
		}
	}

	// Check each field for changes that require conflict validation and linked field restrictions
	for _, field := range fields {
		existing, ok := existingByID[field.ID]
		if !ok {
			continue
		}

		// A field converted at create time carries the owners, source plugin
		// and sync source it had at that moment. Keep it in sync with a v2
		// caller's legacy-shaped update before anything below reads
		// field.Permissions, or a co-owner or sync source added through the
		// legacy Attrs path would be silently refused by the very object that
		// was supposed to grant it.
		if err := ps.translateLegacyPermissionKeys(field, existing); err != nil {
			return nil, nil, nil, err
		}

		// A field with more than model.PropertyFieldMaxHydratedOptions options
		// reads back with its option list left out, so a caller that read it and
		// is now writing it back has no idea what the field's options are. Any
		// list it supplies is therefore built on nothing: the shape a UI produces
		// by appending to the empty list it was given claims the field has one
		// option and implicitly deletes the other thousand.
		//
		// Refuse rather than guess. Obeying the list destroys data the caller never
		// saw; ignoring it reports success for a change that did not happen. A
		// supplied *empty* list — a caller echoing back the absent list, which is
		// what a read-modify-write of any other attr looks like — is not refused,
		// because that would block renaming such a field; the store leaves the
		// options alone for it. Editing the options of a field this large needs an
		// interface that addresses one option at a time.
		//
		// Checked before the PSAv1 skip below: a legacy field's options are just as
		// destroyable.
		if model.PropertyFieldOptionsOmitted(existing.Attrs) && model.PropertyFieldSuppliesOptions(field.Attrs) {
			return nil, nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.options_withheld.app_error",
				map[string]any{"FieldID": existing.ID, "Max": model.PropertyFieldMaxHydratedOptions},
				"cannot replace the option list of a field whose options were not loaded",
				http.StatusBadRequest,
			)
		}

		// The graph type is not interchangeable with any other, in either
		// direction. Its option set is meant to carry a hierarchy that no other
		// type has a notion of, so a conversion either way changes what the
		// field's values mean without saying so: out of graph, options authored
		// as a hierarchy become a flat list; into graph, a flat list becomes a
		// hierarchy nobody wrote. Neither is worth supporting when creating a
		// field of the type actually wanted and moving the values across is
		// always available.
		//
		// Checked before the PSAv1 skip below: the type means the same thing
		// whichever property generation the field belongs to.
		if field.Type != existing.Type &&
			(field.Type == model.PropertyFieldTypeGraph || existing.Type == model.PropertyFieldTypeGraph) {
			return nil, nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.graph_type_change.app_error",
				map[string]any{"FieldID": existing.ID},
				"cannot convert a field to or from the graph type",
				http.StatusBadRequest,
			)
		}

		// What the submitted option list asks for: the hierarchy it states, the
		// options it leaves out, and the names it introduces. All three are checked
		// before the PSAv1 skip below, for the same reason the two checks above are:
		// what an option list says is decided by the field's type, not by which
		// property generation the field belongs to.
		if err := ps.validateOptionBlobLinks(field, existing); err != nil {
			return nil, nil, nil, err
		}
		if err := ps.requireDroppedOptionsAreLeaves(field, existing); err != nil {
			return nil, nil, nil, err
		}
		if err := ps.requireNamesFreeOfDependents(existing, optionNamesAddedBy(field.Attrs, existing.Attrs)); err != nil {
			return nil, nil, nil, err
		}

		// Checked before the PSAv1 skip below: which field a linked field's
		// option list belongs to, and whether a link may be created after the
		// fact, do not depend on which property generation the field belongs to.

		// Block options changes on linked fields
		if existing.LinkedFieldID != nil && *existing.LinkedFieldID != "" && optionsChanged(existing.Attrs, field.Attrs) {
			return nil, nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.linked_options_change.app_error",
				nil,
				"cannot modify options of a linked field",
				http.StatusBadRequest,
			)
		}

		// Block setting LinkedFieldID on a field that wasn't linked at creation.
		// LinkedFieldID can only be set during CreatePropertyField, which copies
		// the source's type and options. Allowing it on update would create a
		// link without that schema copy, causing type/options mismatches.
		// Canonicalize empty-string LinkedFieldID to nil (unlink).
		// Empty string is the JSON signal for "clear this field"; convert to
		// nil before persistence to avoid a third state distinct from NULL.
		if field.LinkedFieldID != nil && *field.LinkedFieldID == "" {
			field.LinkedFieldID = nil
		}

		existingIsLinked := existing.LinkedFieldID != nil && *existing.LinkedFieldID != ""
		newIsLinked := field.LinkedFieldID != nil

		if !existingIsLinked && newIsLinked {
			return nil, nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.cannot_link_existing.app_error",
				nil,
				"linked_field_id can only be set at creation time",
				http.StatusBadRequest,
			)
		}

		// Block changing link target. To re-link, unlink first then create a
		// new linked field.
		if existingIsLinked && newIsLinked && *field.LinkedFieldID != *existing.LinkedFieldID {
			return nil, nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.cannot_change_link_target.app_error",
				nil,
				"cannot change link target; unlink first then create a new linked field",
				http.StatusBadRequest,
			)
		}

		// Checked before the PSAv1 skip below: whether a linked field's type may
		// change does not depend on which property generation the field belongs to.
		if existingIsLinked && field.Type != existing.Type {
			return nil, nil, nil, model.NewAppError(
				"UpdatePropertyFields",
				"app.property_field.update.linked_type_change.app_error",
				nil,
				"cannot modify type of a linked field",
				http.StatusBadRequest,
			)
		}

		// The same rule seen from the other end: a field that others link to
		// cannot change type either, because they take their options from it and
		// would be left serving options of the wrong kind. Above the skip below
		// because a legacy field can be a link source just as easily.
		if field.Type != existing.Type {
			count, cErr := ps.fieldStore.CountLinkedFields(field.ID)
			if cErr != nil {
				return nil, nil, nil, fmt.Errorf("failed to count linked fields: %w", cErr)
			}

			if count > 0 {
				return nil, nil, nil, model.NewAppError(
					"UpdatePropertyFields",
					"app.property_field.update.type_change_with_dependents.app_error",
					nil,
					"cannot change type of a field with active linked dependents",
					http.StatusConflict,
				)
			}
		}

		// Legacy properties (PSAv1) stop here, because nothing below can apply to
		// them. A legacy field is not allowed a Permissions object at all, so the
		// two option.read checks have nothing to read; and legacy name uniqueness
		// is enforced by a database constraint, so CheckPropertyNameConflict
		// returns early for them anyway.
		if field.IsPSAv1() {
			continue
		}

		// The option.read ceiling holds for the life of a linked field, not just
		// at creation. Only load the template when there is something to check:
		// a linked field being updated without a Permissions object writes no
		// restrictions, so it cannot breach the ceiling, and an unlinked field
		// (checked against field.LinkedFieldID, final as of the canonicalization
		// above) has no ceiling to hold it to.
		if newIsLinked && field.Permissions != nil {
			template, ok := incoming[*field.LinkedFieldID]
			if !ok {
				var tErr error
				template, tErr = ps.fieldStore.Get(store.WithMaster(context.Background()), "", *field.LinkedFieldID)
				if tErr != nil {
					return nil, nil, nil, fmt.Errorf("failed to get linked template field %q: %w", *field.LinkedFieldID, tErr)
				}
			}

			if err := validateLinkedFieldOptionReadCeiling("UpdatePropertyFields", field, template); err != nil {
				return nil, nil, nil, err
			}
		}

		// The ceiling holds from the template's side too: tightening this
		// field's own option.read below what a field linked to it already
		// sits at is the same breach reached from the other direction.
		if err := ps.validateDependentOptionReadCeilings(field, existing, incoming); err != nil {
			return nil, nil, nil, err
		}

		// Any change to Name or identity fields (TargetType/TargetID/ObjectType)
		// can shift the uniqueness domain. The DB unique index catches same-level
		// collisions, but cross-level hierarchy conflicts (system ↔ team ↔ channel)
		// are only caught here.
		if existing.Name != field.Name ||
			existing.TargetType != field.TargetType ||
			existing.TargetID != field.TargetID ||
			existing.ObjectType != field.ObjectType {
			conflictLevel, cErr := ps.fieldStore.CheckPropertyNameConflict(field, field.ID)
			if cErr != nil {
				return nil, nil, nil, fmt.Errorf("failed to check property name conflict: %w", cErr)
			}

			if conflictLevel != "" {
				return nil, nil, nil, model.NewAppError(
					"UpdatePropertyFields",
					"app.property_field.update.name_conflict.app_error",
					map[string]any{"Name": field.Name, "ConflictLevel": string(conflictLevel)},
					fmt.Sprintf("property name %q conflicts with existing %s-level property", field.Name, string(conflictLevel)),
					http.StatusConflict,
				)
			}
		}
	}

	// A field left with no Permissions by translateLegacyPermissionKeys above
	// (nothing legacy changed, so nothing was reconverted) still must not
	// reach the store nil: there is no legitimate "clear the permissions"
	// write, and a field with none would eventually deny everyone everything
	// once nothing else falls back to the legacy columns. Backfilling here,
	// after every check above that treats nil as meaningful (the option-read
	// ceiling in particular) has already run, is what lets those checks keep
	// seeing "no Permissions object was submitted" for a field nothing
	// changed on.
	for _, field := range fields {
		if field.Permissions != nil || field.IsPSAv1() {
			continue
		}
		if existing, ok := existingByID[field.ID]; ok {
			field.Permissions = existing.Permissions
		}
	}

	// Build expected UpdateAt map for optimistic concurrency control.
	// This closes the TOCTOU window: if any field was modified between the
	// GetMany above and the UPDATE below, the store will reject the write.
	expectedUpdateAts := make(map[string]int64, len(existingByID))
	for id, ef := range existingByID {
		expectedUpdateAts[id] = ef.UpdateAt
	}

	// Update fields atomically. Along with the requested fields the store returns
	// any linked dependents whose option list changed as a result: a dependent
	// derives its options from the field it links to, so its own row does not
	// change but what it serves does.
	all, uErr := ps.fieldStore.Update(groupID, fields, expectedUpdateAts)
	if uErr != nil {
		return nil, nil, nil, uErr
	}

	// Partition the returned fields into requested vs propagated by matching
	// against the IDs we submitted. This avoids assuming anything about the
	// ordering the store uses in its return value.
	requestedIDs := make(map[string]struct{}, len(fields))
	for _, f := range fields {
		requestedIDs[f.ID] = struct{}{}
	}

	requested = make([]*model.PropertyField, 0, len(fields))
	propagated = make([]*model.PropertyField, 0, len(all)-len(fields))
	for _, f := range all {
		if _, ok := requestedIDs[f.ID]; ok {
			requested = append(requested, f)
		} else {
			propagated = append(propagated, f)
		}
	}

	// Run post-hooks. prev is parallel to requested. Hooks may transform
	// either the requested or propagated bucket (e.g. attr redaction); the
	// dispatcher enforces cardinality preservation on both buckets so a buggy
	// hook that drops fields surfaces an error rather than silently truncating
	// the broadcast. cleared IDs are unioned across hooks.
	prev := make([]*model.PropertyField, 0, len(requested))
	for _, r := range requested {
		prev = append(prev, existingByID[r.ID])
	}
	requested, propagated, clearedFieldIDs = ps.runPostUpdatePropertyFields(rctx, groupID, prev, requested, propagated)

	return requested, propagated, clearedFieldIDs, nil
}

// translateLegacyPermissionKeys reconverts field.Permissions when a
// legacy-shaped update changes one of the columns or attrs it was last
// converted from, so a field converted at create time does not go stale the
// moment a co-owner or a sync source is added through the legacy Attrs path
// afterward -- a converted Permissions object is authoritative over the
// legacy columns, so a stale one would go on refusing the very identity that
// was just given ownership.
//
// Deliberately leaves a nil field.Permissions nil when nothing legacy
// changed, rather than filling it from existing here: the option-read
// ceiling check later in this same loop treats a nil Permissions as "nothing
// to check", which is correct when nothing did change, and filling it in
// this early would make every linked-field update pay that check's cost even
// when the field itself asked for nothing. updatePropertyFields backfills a
// still-nil Permissions from existing right before the write, once every
// check that cares about the distinction has already run.
//
// Skips a PSAv1 field outright: it cannot hold a Permissions object, so
// translating one would produce a row the store refuses -- a plugin
// changing its own field's access_mode would start getting a 400 where it
// works today.
func (ps *PropertyService) translateLegacyPermissionKeys(field, existing *model.PropertyField) error {
	if field.IsPSAv1() {
		return nil
	}

	convertAttrs, err := ps.groupConvertsAttrs(field.GroupID)
	if err != nil {
		return fmt.Errorf("translateLegacyPermissionKeys: %w", err)
	}

	if !legacyPermissionKeysChanged(field, existing, convertAttrs) {
		// A v2 caller's whole-object update always carries these columns back
		// exactly as read, so "unchanged from what's stored" and "unchanged
		// from what the caller was shown" are the same question. A pure v3
		// caller that never sets a legacy column or attr compares as
		// unchanged too, by the same rule: there is nothing to diff against.
		return nil
	}

	opts := model.LegacyConversionOpts{ConvertAttrs: convertAttrs}
	if field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
		template, tErr := ps.fieldStore.Get(store.WithMaster(context.Background()), "", *field.LinkedFieldID)
		if tErr != nil {
			return fmt.Errorf("translateLegacyPermissionKeys: failed to get linked template field %q: %w", *field.LinkedFieldID, tErr)
		}
		opts.Template = templatePermissionsOrZero(template)
	}

	reconverted := model.PermissionsFromLegacy(fillOwnerAllowFromStored(field, existing), opts)
	if err := reconcileTranslatedMasking(reconverted, existing); err != nil {
		return err
	}

	field.Permissions = reconverted
	return nil
}

// legacyPermissionKeysChanged reports whether field's legacy-shaped
// permission keys -- Protected, the three permission levels, the sync-source
// attrs, and the protected/owners/access_mode attrs -- differ from what is
// already stored on existing.
//
// Protected and the three permission-level columns are no longer selected
// from the store, so existing.Protected / Permission* are always the zero
// value after a load. PermissionValues is compared against
// ProjectLegacyPermissions(existing) instead: that is the v2 view a caller
// was shown and would echo back. Protected, PermissionField and
// PermissionOptions are only compared that way when this group's update
// hook does not pin Field/Options to sysadmin first -- that pin would
// otherwise make every protected-field update look like a column change.
// The owners / access_mode / protected / sync-source attrs are still stored,
// and are compared against existing.Attrs rather than the projection -- the
// owners attr can carry fewer entries than ProjectLegacyPermissions would
// report once a source plugin, a sync lock or the ambient-access wildcard
// has added a grant of its own, and comparing against those synthetic
// entries would report "changed" for a caller that never touched the owners
// list at all.
//
// A submitted permission-level pointer of nil never counts as a change: a v2
// caller's whole-object update always carries a real value here (every v2
// create pins all three before the row is ever written), so nil only means a
// caller that never speaks the legacy shape, and there is no legitimate way
// to ask "clear this column" through this path.
func legacyPermissionKeysChanged(field, existing *model.PropertyField, columnsPinned bool) bool {
	projected := model.ProjectLegacyPermissions(existing)
	if !columnsPinned {
		if field.Protected != projected.Protected {
			return true
		}
		if permissionLevelPtrChanged(field.PermissionField, projected.PermissionField) {
			return true
		}
		if permissionLevelPtrChanged(field.PermissionOptions, projected.PermissionOptions) {
			return true
		}
	}
	if permissionLevelPtrChanged(field.PermissionValues, projected.PermissionValues) {
		return true
	}
	if legacyAttrString(field.Attrs, model.PropertyAttrsAccessMode) != legacyAttrString(existing.Attrs, model.PropertyAttrsAccessMode) {
		return true
	}
	if legacyAttrBool(field.Attrs, model.PropertyAttrsProtected) != legacyAttrBool(existing.Attrs, model.PropertyAttrsProtected) {
		return true
	}
	if legacyAttrString(field.Attrs, model.PropertyFieldAttrLDAP) != legacyAttrString(existing.Attrs, model.PropertyFieldAttrLDAP) {
		return true
	}
	if legacyAttrString(field.Attrs, model.PropertyFieldAttrSAML) != legacyAttrString(existing.Attrs, model.PropertyFieldAttrSAML) {
		return true
	}
	if !reflect.DeepEqual(model.GetPropertyFieldOwners(field), model.GetPropertyFieldOwners(existing)) {
		return true
	}

	return false
}

func permissionLevelPtrChanged(submitted, stored *model.PermissionLevel) bool {
	if submitted == nil {
		return false
	}
	return stored == nil || *submitted != *stored
}

func legacyAttrString(attrs model.StringInterface, key string) string {
	if attrs == nil {
		return ""
	}
	s, _ := attrs[key].(string)
	return s
}

func legacyAttrBool(attrs model.StringInterface, key string) bool {
	if attrs == nil {
		return false
	}
	b, _ := attrs[key].(bool)
	return b
}

// legacyValidatorGates reports, for each of the two legacy update validators
// the hook still runs, whether the key that validator judges is one the
// caller actually asked to change. "Changed" here means differs from
// ProjectLegacyPermissions(existing) -- the same legacy-shaped view a caller
// reading this field would have been shown -- not from the raw stored
// columns: a field converted straight from a typed permissions object, with
// no legacy columns of its own, still needs a caller's echoed-back read to
// compare as unchanged. legacyPermissionKeysChanged answers a different
// question (has anything legacy been asked to change at all) for deciding
// whether to reconvert Permissions, and is deliberately not reused here for
// that reason.
func legacyValidatorGates(field, existing *model.PropertyField) (accessModeChanged, protectedChanged bool) {
	projected := model.ProjectLegacyPermissions(existing)
	accessModeChanged = legacyAttrString(field.Attrs, model.PropertyAttrsAccessMode) != legacyAttrString(projected.Attrs, model.PropertyAttrsAccessMode)
	protectedChanged = legacyAttrBool(field.Attrs, model.PropertyAttrsProtected) != legacyAttrBool(projected.Attrs, model.PropertyAttrsProtected)
	return accessModeChanged, protectedChanged
}

// fillOwnerAllowFromStored replaces an empty Allow on any owner field
// submits with the Allow already stored for that identity, read off the
// projection of existing -- exactly what a v2 caller was shown.
// PermissionsFromLegacy enumerates every action for an owner with no Allow,
// which is right for a first conversion and wrong for a v2 client that never
// knew action lists existed: it would silently re-widen an owner's grant to
// every action on every save. An owner naming an identity with nothing
// stored keeps that all-five default, since there is nothing to preserve.
//
// An identity can be split across two stored owners -- one for the value
// actions, one for the rest -- when they carry different scopes (see
// grantsFromLegacy), so every stored match's Allow is merged rather than
// just the first, and the submission's own Scopes are kept rather than
// overwritten by whichever stored half happened to match.
func fillOwnerAllowFromStored(field, existing *model.PropertyField) *model.PropertyField {
	submitted := model.GetPropertyFieldOwners(field)
	if len(submitted) == 0 {
		return field
	}

	stored := model.GetPropertyFieldOwners(model.ProjectLegacyPermissions(existing))
	if len(stored) == 0 {
		return field
	}

	changed := false
	filled := make([]model.PropertyOwner, 0, len(submitted))
	for _, owner := range submitted {
		if len(owner.Allow) > 0 {
			filled = append(filled, owner)
			continue
		}
		var allow []string
		for _, s := range stored {
			if s.Type == owner.Type && s.ID == owner.ID {
				allow = append(allow, s.Allow...)
			}
		}
		if len(allow) == 0 {
			filled = append(filled, owner)
			continue
		}
		owner.Allow = allow
		filled = append(filled, owner)
		changed = true
	}
	if !changed {
		return field
	}

	copied := *field
	copied.Attrs = maps.Clone(field.Attrs)
	copied.Attrs[model.PropertyAttrsOwners] = filled
	return &copied
}

// reconcileTranslatedMasking folds a translated field's stored masking back
// into its freshly reconverted Permissions. Masking's internals --
// mask_by_field_id and except -- are never shown to a v2 caller (§2.6), so an
// inbound access_mode must never flatten them to an empty object; this is the
// same refusal an access control policy already gives a caller editing a
// rule carrying masked values, rather than trusting them to notice a flag and
// re-read.
func reconcileTranslatedMasking(reconverted *model.Permissions, existing *model.PropertyField) error {
	var stored *model.Masking
	if existing.Permissions != nil {
		stored = existing.Permissions.Masking
	}

	if reconverted.Masking != nil {
		if stored != nil {
			reconverted.Masking = stored
		}
		return nil
	}

	if stored != nil && (stored.MaskByFieldID != "" || len(stored.Except) > 0) {
		return model.NewAppError(
			"UpdatePropertyFields",
			"app.property_field.update.masking_discarded.app_error",
			nil,
			"cannot change this field's access mode because it contains data the caller may not read",
			http.StatusBadRequest,
		)
	}

	return nil
}

func (ps *PropertyService) deletePropertyField(groupID, id string) error {
	// if groupID is not empty, we need to check first that the field belongs to the group
	if groupID != "" {
		if _, err := ps.getPropertyField(groupID, id); err != nil {
			return fmt.Errorf("error getting property field %q for group %q: %w", id, groupID, err)
		}
	}

	// Deletion protection: cannot delete a field that has active linked dependents
	count, err := ps.fieldStore.CountLinkedFields(id)
	if err != nil {
		return fmt.Errorf("failed to count linked fields: %w", err)
	}
	if count > 0 {
		return model.NewAppError(
			"DeletePropertyField",
			"app.property_field.delete.has_linked_dependents.app_error",
			nil,
			"cannot delete field with active linked dependents; unlink or delete dependent fields first",
			http.StatusConflict,
		)
	}

	if err := ps.valueStore.DeleteForField(groupID, id); err != nil {
		return err
	}

	return ps.fieldStore.Delete(groupID, id)
}

// Public methods

func (ps *PropertyService) CreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	field, err := ps.runPreCreatePropertyField(rctx, field)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyField: %w", err)
	}

	return ps.createPropertyField(field)
}

func (ps *PropertyService) GetPropertyField(rctx request.CTX, groupID, id string) (*model.PropertyField, error) {
	field, err := ps.getPropertyField(groupID, id)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyField: %w", err)
	}

	return ps.runPostGetPropertyField(rctx, field)
}

func (ps *PropertyService) GetPropertyFields(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyField, error) {
	fields, err := ps.getPropertyFields(groupID, ids)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFields: %w", err)
	}

	return ps.runPostGetPropertyFields(rctx, fields)
}

func (ps *PropertyService) GetPropertyFieldsForGroup(rctx request.CTX, groupID string) ([]*model.PropertyField, error) {
	fields, err := ps.fieldStore.GetForGroup(context.Background(), groupID)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFieldsForGroup: %w", err)
	}

	return ps.runPostGetPropertyFields(rctx, fields)
}

// GetPropertyFieldByName looks up a field by name within a group and target.
//
// Deprecated: name is not unique within a group when fields of different object
// types share a name. Use GetPropertyFieldByNameForObjectType to disambiguate.
func (ps *PropertyService) GetPropertyFieldByName(rctx request.CTX, groupID, targetID, name string) (*model.PropertyField, error) {
	field, err := ps.getPropertyFieldByName(groupID, targetID, name)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFieldByName: %w", err)
	}

	return ps.runPostGetPropertyField(rctx, field)
}

func (ps *PropertyService) GetPropertyFieldByNameForObjectType(rctx request.CTX, groupID, targetID, objectType, name string) (*model.PropertyField, error) {
	field, err := ps.getPropertyFieldByNameForObjectType(groupID, targetID, objectType, name)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyFieldByNameForObjectType: %w", err)
	}

	return ps.runPostGetPropertyField(rctx, field)
}

func (ps *PropertyService) CountActivePropertyFieldsForGroup(rctx request.CTX, groupID string) (int64, error) {
	if err := ps.runPreCountPropertyFields(rctx, groupID); err != nil {
		return 0, fmt.Errorf("CountActivePropertyFieldsForGroup: %w", err)
	}
	return ps.countActivePropertyFieldsForGroup(groupID)
}

func (ps *PropertyService) CountAllPropertyFieldsForGroup(rctx request.CTX, groupID string) (int64, error) {
	if err := ps.runPreCountPropertyFields(rctx, groupID); err != nil {
		return 0, fmt.Errorf("CountAllPropertyFieldsForGroup: %w", err)
	}
	return ps.countAllPropertyFieldsForGroup(groupID)
}

func (ps *PropertyService) CountActivePropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string) (int64, error) {
	if err := ps.runPreCountPropertyFields(rctx, groupID); err != nil {
		return 0, fmt.Errorf("CountActivePropertyFieldsForTarget: %w", err)
	}
	return ps.countActivePropertyFieldsForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) CountAllPropertyFieldsForTarget(rctx request.CTX, groupID, targetType, targetID string) (int64, error) {
	if err := ps.runPreCountPropertyFields(rctx, groupID); err != nil {
		return 0, fmt.Errorf("CountAllPropertyFieldsForTarget: %w", err)
	}
	return ps.countAllPropertyFieldsForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) SearchPropertyFields(rctx request.CTX, groupID string, opts model.PropertyFieldSearchOpts) ([]*model.PropertyField, error) {
	fields, err := ps.searchPropertyFields(groupID, opts)
	if err != nil {
		return nil, fmt.Errorf("SearchPropertyFields: %w", err)
	}

	return ps.runPostGetPropertyFields(rctx, fields)
}

// UpdatePropertyField updates a single field. It returns the updated field and
// the IDs of fields whose dependent property values were cleared as a side
// effect (e.g. by TypeChangeValueCleanupHook on a type change). Hooks may
// cascade clears to other fields, so the slice is not necessarily limited to
// the updated field's own ID. The caller is expected to publish any
// value-cleanup WS events.
func (ps *PropertyService) UpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, []string, error) {
	field, err := ps.runPreUpdatePropertyField(rctx, groupID, field)
	if err != nil {
		return nil, nil, fmt.Errorf("UpdatePropertyField: %w", err)
	}

	return ps.updatePropertyField(rctx, groupID, field)
}

// UpdatePropertyFields updates a batch of fields and returns the requested set,
// any linked fields whose derived option list the update changed, and the IDs of
// fields whose dependent property values were cleared as a side effect. The
// caller is expected to publish any value-cleanup WS events.
func (ps *PropertyService) UpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) (requested []*model.PropertyField, propagated []*model.PropertyField, clearedFieldIDs []string, err error) {
	fields, err = ps.runPreUpdatePropertyFields(rctx, groupID, fields)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("UpdatePropertyFields: %w", err)
	}

	return ps.updatePropertyFields(rctx, groupID, fields)
}

func (ps *PropertyService) DeletePropertyField(rctx request.CTX, groupID, id string) error {
	if err := ps.runPreDeletePropertyField(rctx, groupID, id); err != nil {
		return fmt.Errorf("DeletePropertyField: %w", err)
	}

	return ps.deletePropertyField(groupID, id)
}

// asOptionSlice extracts the options from an attrs map as []map[string]any
// via direct type assertion. By the time options reach the service layer,
// they are always []any containing map[string]any elements (from JSON
// deserialization, EnsureOptionIDs, or AccessControlAttributeValidationHook.
// sanitizeAndValidateOptions — all of which normalize to this shape).
func asOptionSlice(attrs model.StringInterface) []map[string]any {
	if attrs == nil {
		return nil
	}
	raw, ok := attrs[model.PropertyFieldAttributeOptions]
	if !ok || raw == nil {
		return nil
	}
	slice, ok := raw.([]any)
	if !ok {
		return nil
	}
	result := make([]map[string]any, 0, len(slice))
	for _, item := range slice {
		if m, ok := item.(map[string]any); ok {
			result = append(result, m)
		}
	}
	return result
}

// optionsChanged compares the options in two attrs maps and returns true if they differ.
// Compares by building a map keyed on option ID and using reflect.DeepEqual for
// value comparison, which correctly handles nested structures (maps, slices).
//
// Neither side needs a withheld-option-list branch: a non-empty list supplied
// against a field whose list was withheld is refused outright before this runs
// (see the option-list invariant in updatePropertyFields), and every remaining
// shape has no list on either side and so compares unchanged.
func optionsChanged(oldAttrs, newAttrs model.StringInterface) bool {
	oldOpts := asOptionSlice(oldAttrs)
	newOpts := asOptionSlice(newAttrs)

	if len(oldOpts) != len(newOpts) {
		return true
	}

	// Both nil/empty means no change
	if len(oldOpts) == 0 {
		return false
	}

	// Build map of new options keyed by ID for lookup
	newByID := make(map[string]map[string]any, len(newOpts))
	for _, opt := range newOpts {
		if id, _ := opt["id"].(string); id != "" {
			newByID[id] = opt
		}
	}

	for _, oldOpt := range oldOpts {
		id, _ := oldOpt["id"].(string)
		newOpt, exists := newByID[id]
		if !exists {
			return true
		}
		if !reflect.DeepEqual(oldOpt, newOpt) {
			return true
		}
	}

	return false
}

// extractOptionIDList extracts the "id" field from each option in the given options value
// using direct type assertions (no JSON marshaling).
func extractOptionIDList(options any) []string {
	if options == nil {
		return nil
	}
	slice, ok := options.([]any)
	if !ok {
		return nil
	}
	ids := make([]string, 0, len(slice))
	for _, item := range slice {
		if m, ok := item.(map[string]any); ok {
			if id, ok := m["id"].(string); ok && id != "" {
				ids = append(ids, id)
			}
		}
	}
	return ids
}
