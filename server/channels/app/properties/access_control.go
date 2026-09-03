// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

// This file implements access control for property fields and values using three key mechanisms:
//
// 1. Protected Fields (protected attribute):
//    - Protected fields can only be modified by their source plugin (identified by source_plugin_id)
//    - Non-protected fields can be modified by any caller with appropriate access
//
// 2. Access Mode (access_mode attribute):
//    - Controls read access to field metadata (like options) and values
//    - Three modes:
//      * Public (empty string, default): Everyone can read all data
//      * Source-only: Only the source plugin can read full field options and values; others see empty options and no values
//      * Shared-only: Callers can only see field options and values they share with the target
//                     (Example: If Alice selected Apples and Bananas, and Bob selected Bananas and Oranges,
//                      then Alice querying Bob's values would only see Bananas)

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var (
	ErrAccessDenied      = errors.New("access denied")
	ErrSyncLocked        = errors.New("field is managed by external sync")
	ErrInvalidAccessMode = errors.New("invalid access_mode")
	ErrFieldNotFound     = errors.New("property field not found")
)

const (
	propertyAccessPaginationPageSize      = 100
	propertyAccessMaxPaginationIterations = 10
)

// PluginChecker is a function type that checks if a plugin is installed.
// Returns true if the plugin exists and is installed, false otherwise.
type PluginChecker func(pluginID string) bool

// PropertyLadderChecker answers whether userID may perform action on field,
// as the union of the human restrictions ladder with any grant naming the
// caller as a user or one of their roles. The properties package cannot
// import the app package to compute this itself -- resolving a role needs
// channel/team membership -- so it arrives as an injected function pointed at
// the app-layer decision. A nil checker means no ladder is available and
// must deny rather than allow.
type PropertyLadderChecker func(rctx request.CTX, userID string, field *model.PropertyField, action, valueTargetID string) bool

// PropertyRoleLister answers which role names userID holds, the same names a
// role grant is matched against (propertyGrantForHuman) and a masking except
// role entry is matched against, so the exemption and the permission gate
// cannot disagree about what a caller is. The properties package cannot
// import the app package to compute this itself, so it arrives as an
// injected function pointed at the app-layer lookup. A nil lister, or one
// whose lookup fails, must be treated as no roles held.
type PropertyRoleLister func(userID string) []string

// AccessControlHook implements the PropertyHook interface to enforce access
// control based on caller identity. It checks protected fields, plugin
// ownership, and access modes (public, source-only, shared-only).
//
// The hook only applies to PSAv2/PSAv3 property groups (isGroupEnforced).
// Operations on a PSAv1 group pass through without access control checks.
type AccessControlHook struct {
	BasePropertyHook
	propertyService *PropertyService
	pluginChecker   PluginChecker
	ladderChecker   PropertyLadderChecker
	roleLister      PropertyRoleLister
}

// Compile-time check that AccessControlHook implements PropertyHook.
var _ PropertyHook = (*AccessControlHook)(nil)

// NewAccessControlHook creates a new AccessControlHook.
// It receives the PropertyService to call private methods for database lookups
// needed during access control checks. The pluginChecker function is used to
// verify plugin installation status when checking access to protected fields.
// Pass nil for pluginChecker if plugin checking is not needed (e.g., in tests).
// The ladderChecker function answers the human half of a permissions decision
// (restrictions ladder plus user/role grants); pass nil where no permissions
// fields are under test.
// The roleLister function answers which roles a human caller holds, for
// matching a masking except list's role entries; pass nil where no masking
// with a role exemption is under test.
func NewAccessControlHook(ps *PropertyService, pluginChecker PluginChecker, ladderChecker PropertyLadderChecker, roleLister PropertyRoleLister) *AccessControlHook {
	return &AccessControlHook{
		propertyService: ps,
		pluginChecker:   pluginChecker,
		ladderChecker:   ladderChecker,
		roleLister:      roleLister,
	}
}

// isGroupEnforced reports whether groupID names a PSAv2 or PSAv3 property
// group. A PSAv1 field cannot hold a permissions object at all
// (PropertyField.IsValid), and enforceFieldGroupVersionMatch already makes
// "v1 group" and "field that cannot hold permissions" the same set, so
// gating on group version -- rather than an allowlist of group IDs -- is an
// exact test for which groups this hook has anything to decide on. A group
// ID that fails to resolve has no fields to protect, so the error is
// returned rather than treated as unenforced: a new enforcement point must
// not fail open.
func (h *AccessControlHook) isGroupEnforced(groupID string) (bool, error) {
	group, err := h.propertyService.GroupByID(groupID)
	if err != nil {
		return false, err
	}
	return group.IsPSAv2() || group.IsPSAv3(), nil
}

// Field Pre-Hooks

// PreCreatePropertyField enforces access control on field creation.
// When the caller is an installed plugin, source_plugin_id is automatically set.
// When the caller is not a plugin, source_plugin_id and protected are rejected.
// When linking to a source template, security attributes are validated and
// inherited from the source.
func (h *AccessControlHook) PreCreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	enforced, err := h.isGroupEnforced(field.GroupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return field, nil
	}

	callerID := h.extractCallerID(rctx)

	if h.isCallerPlugin(callerID) {
		if field.Attrs == nil {
			field.Attrs = make(model.StringInterface)
		}
		field.Attrs[model.PropertyAttrsSourcePluginID] = callerID
	} else {
		if h.getSourcePluginID(field) != "" {
			return nil, fmt.Errorf("source_plugin_id can only be set by a plugin: %w", ErrAccessDenied)
		}
		if model.IsPropertyFieldProtected(field) {
			return nil, fmt.Errorf("protected can only be set by a plugin: %w", ErrAccessDenied)
		}
	}

	// Owners are managed only by administrators via the REST API. Machine
	// callers (plugins/sync) may not declare owners when creating a field.
	if h.isMachineCaller(callerID) && model.HasPropertyFieldOwners(field) {
		return nil, fmt.Errorf("owners can only be set by an administrator: %w", ErrAccessDenied)
	}

	if field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
		if err := h.validateAndInheritLinkedFieldSecurity(rctx, callerID, field); err != nil {
			return nil, fmt.Errorf("PreCreatePropertyField: %w", err)
		}
	}

	if err := model.ValidatePropertyFieldAccessMode(field); err != nil {
		return nil, fmt.Errorf("%s: %w", err.Error(), ErrInvalidAccessMode)
	}

	return field, nil
}

// validateAndInheritLinkedFieldSecurity gates and seeds a linked field's
// permissions from its template. The two are independent: the gate applies
// only when the template's reads are restricted at all -- linking to an open
// template requires no permission on it, so gating every link would refuse
// callers who could already see everything the template holds. The
// inheritance runs for every template, restricted or not, whenever the
// caller supplied no permissions of its own: tying it to the gate would
// leave an open template's own write levels (say, field.write: sysadmin)
// unreachable from its linked fields, which would then take their write
// levels from whatever the creator submitted or the api4 default pin.
func (h *AccessControlHook) validateAndInheritLinkedFieldSecurity(rctx request.CTX, callerID string, field *model.PropertyField) error {
	source, err := h.propertyService.getPropertyFieldFromMaster("", *field.LinkedFieldID)
	if err != nil {
		if store.IsErrNotFound(err) {
			return model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_not_found.app_error",
				nil,
				fmt.Sprintf("linked source field %q not found", *field.LinkedFieldID),
				http.StatusBadRequest,
			)
		}
		return fmt.Errorf("failed to get linked source field %q: %w", *field.LinkedFieldID, err)
	}

	if templateReadsAreRestricted(source) {
		scope := h.extractActingAsScope(rctx)
		if !h.permissionsAllows(rctx, source, callerID, scope, model.PropertyActionFieldWrite, "") {
			return model.NewAppError(
				"CreatePropertyField",
				"app.property_field.create.linked_source_protected.app_error",
				nil,
				"only the source plugin can create linked fields from a protected template",
				http.StatusForbidden,
			)
		}
	}

	if field.Permissions == nil && source.Permissions != nil {
		// Masking is never inherited: a linked field cannot declare its own
		// (PropertyField.IsValid refuses one) and the read path resolves it from
		// the template regardless. option.read is dropped from every inherited
		// grant for the same reason -- it reads the template's own option
		// scheme, never a right the identity held over this field.
		field.Permissions = &model.Permissions{
			Restrictions: source.Permissions.Restrictions,
			Grants:       linkedFieldGrantsFrom(source.Permissions.Grants),
		}
	}

	// source_plugin_id is identity metadata, not a permission, so it is copied
	// regardless of whether the template's reads are restricted; the
	// immutability check on update reads it from every linked field.
	if sourcePluginID := h.getSourcePluginID(source); sourcePluginID != "" {
		if field.Attrs == nil {
			field.Attrs = make(model.StringInterface)
		}
		field.Attrs[model.PropertyAttrsSourcePluginID] = sourcePluginID
	}

	return nil
}

// templateReadsAreRestricted reports whether source has anything worth
// gating a link to: an explicit read filter, or a read tier below everyone.
// A nil Permissions object -- unreached in production, since the backfill
// converted every stored PSAv2/v3 field and the create path defaults one onto
// every new one -- fails closed rather than treating "nothing to check" as
// "nothing to protect". Linking to such a field is therefore refused outright,
// which is the fail-closed answer for a row the conversion did not reach.
func templateReadsAreRestricted(source *model.PropertyField) bool {
	if source.Permissions == nil {
		return true
	}
	if source.Permissions.Masking != nil {
		return true
	}
	restrictions := source.Permissions.Restrictions
	return restrictions.TierFor(model.PropertyActionValueRead) != model.PermissionLevelEveryone ||
		restrictions.TierFor(model.PropertyActionOptionRead) != model.PermissionLevelEveryone
}

// linkedFieldGrantsFrom copies source's grants with option.read removed from
// every Allow -- a linked field's option.read reads the template's own
// scheme, so a grant conferring it there was never a right over this field
// (PropertyField.IsValid refuses one outright). A grant left with an empty
// Allow is dropped rather than kept invalid; the identity still holds
// option.read by way of its grant on the template itself.
func linkedFieldGrantsFrom(source []model.Grant) []model.Grant {
	grants := make([]model.Grant, 0, len(source))
	for _, g := range source {
		allow := make([]string, 0, len(g.Allow))
		for _, action := range g.Allow {
			if action != model.PropertyActionOptionRead {
				allow = append(allow, action)
			}
		}
		if len(allow) == 0 {
			continue
		}
		g.Allow = allow
		grants = append(grants, g)
	}
	return grants
}

// PreUpdatePropertyField enforces access control on field updates.
// Checks write access and ensures source_plugin_id is not changed.
func (h *AccessControlHook) PreUpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	enforced, err := h.isGroupEnforced(groupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return field, nil
	}

	callerID := h.extractCallerID(rctx)

	existingField, err := h.propertyService.getPropertyField(groupID, field.ID)
	if err != nil {
		return nil, err
	}

	if err := h.enforceFieldUpdateAccess(rctx, existingField, field, callerID); err != nil {
		return nil, err
	}

	if err := h.ensureSourcePluginIDUnchanged(existingField, field); err != nil {
		return nil, err
	}

	accessModeChanged, protectedChanged := legacyValidatorGates(field, existingField)

	if protectedChanged {
		if err := h.validateProtectedFieldUpdate(field, callerID); err != nil {
			return nil, err
		}
	}

	if accessModeChanged {
		if err := model.ValidatePropertyFieldAccessMode(field); err != nil {
			return nil, fmt.Errorf("%s: %w", err.Error(), ErrInvalidAccessMode)
		}
	}

	return field, nil
}

// PreUpdatePropertyFields enforces access control on batch field updates.
// Checks write access for all fields atomically before allowing any updates.
func (h *AccessControlHook) PreUpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if len(fields) == 0 {
		return fields, nil
	}
	enforced, err := h.isGroupEnforced(groupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return fields, nil
	}

	callerID := h.extractCallerID(rctx)

	// Get field IDs
	fieldIDs := make([]string, len(fields))
	for i, field := range fields {
		fieldIDs[i] = field.ID
	}

	existingFields, err := h.propertyService.getPropertyFields(groupID, fieldIDs)
	if err != nil {
		return nil, err
	}

	existingFieldMap := make(map[string]*model.PropertyField, len(existingFields))
	for _, field := range existingFields {
		existingFieldMap[field.ID] = field
	}

	for _, field := range fields {
		existingField, exists := existingFieldMap[field.ID]
		if !exists {
			return nil, fmt.Errorf("field %s: %w", field.ID, ErrFieldNotFound)
		}

		if err := h.enforceFieldUpdateAccess(rctx, existingField, field, callerID); err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}

		if err := h.ensureSourcePluginIDUnchanged(existingField, field); err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}

		accessModeChanged, protectedChanged := legacyValidatorGates(field, existingField)

		if protectedChanged {
			if err := h.validateProtectedFieldUpdate(field, callerID); err != nil {
				return nil, fmt.Errorf("field %s: %w", field.ID, err)
			}
		}

		if accessModeChanged {
			if err := model.ValidatePropertyFieldAccessMode(field); err != nil {
				return nil, fmt.Errorf("field %s: %s: %w", field.ID, err.Error(), ErrInvalidAccessMode)
			}
		}
	}

	return fields, nil
}

// PreCountPropertyFields is a no-op — counts don't expose per-row metadata,
// so access control doesn't apply. License gating happens in LicenseCheckHook.
func (h *AccessControlHook) PreCountPropertyFields(_ request.CTX, _ string) error {
	return nil
}

// PreDeletePropertyField enforces access control on field deletion.
func (h *AccessControlHook) PreDeletePropertyField(rctx request.CTX, groupID string, id string) error {
	enforced, err := h.isGroupEnforced(groupID)
	if err != nil {
		return err
	}
	if !enforced {
		return nil
	}

	callerID := h.extractCallerID(rctx)

	existingField, err := h.propertyService.getPropertyField(groupID, id)
	if err != nil {
		return err
	}

	return h.checkFieldDeleteAccess(rctx, existingField, callerID)
}

// PostUpdatePropertyFields is a no-op for access control; cleanup of dependent
// values is handled by TypeChangeValueCleanupHook.
func (h *AccessControlHook) PostUpdatePropertyFields(_ request.CTX, _ string, _, requested, propagated []*model.PropertyField) ([]*model.PropertyField, []*model.PropertyField, []string, error) {
	return requested, propagated, nil, nil
}

// Field Post-Hooks

// Field option hooks

// PreChangePropertyFieldOptions gates a change to a field's options on
// option.write -- the action §2.2 measures at the field target for exactly this
// operation. The same answer has to come out of the other path to a field's
// options, a field update carrying nothing but a new option list, which
// enforceFieldUpdateAccess routes here's equivalent; otherwise one of the two
// endpoints is a way around the other.
//
// The field is the one the store has. An option change alters no attribute of
// the field, so there is no incoming copy to judge, and in particular no owners
// list a caller could be adding itself to.
func (h *AccessControlHook) PreChangePropertyFieldOptions(rctx request.CTX, field *model.PropertyField) error {
	if field == nil {
		return nil
	}
	enforced, err := h.isGroupEnforced(field.GroupID)
	if err != nil {
		return err
	}
	if !enforced {
		return nil
	}
	return h.enforceOptionWriteAccess(rctx, field, h.extractCallerID(rctx))
}

// enforceOptionWriteAccess answers option.write for a caller changing a field's
// option list. Separate from enforceFieldUpdateAccess because the two name
// different grid cells: a field configured field.write: sysadmin with
// option.write: member delegates option management to members without letting
// them touch the definition, and gating options as a field write would make
// that configuration unusable.
func (h *AccessControlHook) enforceOptionWriteAccess(rctx request.CTX, field *model.PropertyField, callerID string) error {
	if field.Permissions == nil {
		// The same fail-closed arm enforceFieldUpdateAccess has, for the same
		// reason: every PSAv2/v3 field has carried a converted object since the
		// backfill, so this is unreached in production.
		return fmt.Errorf("field %s carries no permissions object: %w", field.ID, ErrAccessDenied)
	}
	if h.permissionsAllows(rctx, field, callerID, "", model.PropertyActionOptionWrite, "") {
		return nil
	}
	return fmt.Errorf("field %s refuses caller %q an option write: %w", field.ID, callerID, ErrAccessDenied)
}

// PostGetPropertyFieldOptions applies the field's read access to a page of its
// options, which are otherwise read straight from their own rows and so reach
// none of the filtering a field read applies to the option list it carries
// inline.
//
// Gated on option.read, then -- when the field is also masked -- the page is
// filtered to what the caller may see via filterMaskedOptionPage, the same
// overlap rule a value read applies.
func (h *AccessControlHook) PostGetPropertyFieldOptions(rctx request.CTX, field *model.PropertyField, options []*model.PropertyFieldOption) ([]*model.PropertyFieldOption, error) {
	if field == nil {
		return options, nil
	}
	enforced, err := h.isGroupEnforced(field.GroupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return options, nil
	}
	callerID := h.extractCallerID(rctx)
	if field.Permissions != nil {
		scope := h.extractActingAsScope(rctx)
		if !h.permissionsAllows(rctx, field, callerID, scope, model.PropertyActionOptionRead, "") {
			return []*model.PropertyFieldOption{}, nil
		}

		c := maskingContextFromRequest(rctx)
		fm, err := c.resolve(h, field)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve field %s's masking: %w", field.ID, err)
		}
		if fm.masking == nil || h.exempt(fm.masking.Except, callerID) {
			return options, nil
		}
		return h.filterMaskedOptionPage(rctx, c, field, fm, options, callerID)
	}

	// Every group-managed field has carried a converted permissions object
	// since the migration backfill, and the create/update path populates it
	// too; unreached in production. Fails closed rather than serving options
	// under an access mode nothing sets any more.
	return []*model.PropertyFieldOption{}, nil
}

// PostGetPropertyField applies read access control to a single field.
func (h *AccessControlHook) PostGetPropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	enforced, err := h.isGroupEnforced(field.GroupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return field, nil
	}

	callerID := h.extractCallerID(rctx)
	return h.applyFieldReadAccessControl(rctx, newMaskingContext(), field, callerID), nil
}

// PostGetPropertyFields applies read access control to a list of fields.
// All fields in a batch share the same GroupID (enforced by the public API).
func (h *AccessControlHook) PostGetPropertyFields(rctx request.CTX, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if len(fields) == 0 {
		return fields, nil
	}

	enforced, err := h.isGroupEnforced(fields[0].GroupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return fields, nil
	}

	callerID := h.extractCallerID(rctx)
	return h.applyFieldReadAccessControlToList(rctx, fields, callerID), nil
}

// Value Pre-Hooks

// PreCreatePropertyValue enforces write access and sync locking on the value's field before creation.
func (h *AccessControlHook) PreCreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	enforced, err := h.isGroupEnforced(value.GroupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return value, nil
	}

	callerID := h.extractCallerID(rctx)

	field, err := h.propertyService.getPropertyField(value.GroupID, value.FieldID)
	if err != nil {
		return nil, err
	}

	if err := h.checkValueWriteAccess(rctx, newMaskingContext(), field, callerID, h.extractActingAsScope(rctx), value.TargetID); err != nil {
		return nil, err
	}

	return value, nil
}

// PreCreatePropertyValues enforces write access and sync locking for all fields atomically before creation.
// All values in a batch share the same GroupID (enforced by the public API).
func (h *AccessControlHook) PreCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}
	enforced, err := h.isGroupEnforced(values[0].GroupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return values, nil
	}

	callerID := h.extractCallerID(rctx)
	scope := h.extractActingAsScope(rctx)

	fieldMap, err := h.getFieldsForValues(values)
	if err != nil {
		return nil, err
	}

	cache := make(valueWriteAccessCache)
	mc := newMaskingContext()
	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, ErrFieldNotFound)
		}
		if err := cache.check(h, rctx, mc, field, callerID, scope, value.TargetID); err != nil {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, err)
		}
	}

	return values, nil
}

// PreUpdatePropertyValue enforces write access and sync locking on the value's field before update.
func (h *AccessControlHook) PreUpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	enforced, err := h.isGroupEnforced(groupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return value, nil
	}

	callerID := h.extractCallerID(rctx)

	field, err := h.propertyService.getPropertyField(groupID, value.FieldID)
	if err != nil {
		return nil, err
	}

	if err := h.checkValueWriteAccess(rctx, newMaskingContext(), field, callerID, h.extractActingAsScope(rctx), value.TargetID); err != nil {
		return nil, err
	}

	return value, nil
}

// PreUpdatePropertyValues enforces write access and sync locking for all fields atomically before update.
// All values in a batch share the same GroupID (enforced by the public API).
func (h *AccessControlHook) PreUpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}
	enforced, err := h.isGroupEnforced(groupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return values, nil
	}

	callerID := h.extractCallerID(rctx)
	scope := h.extractActingAsScope(rctx)

	fieldMap, err := h.getFieldsForValues(values)
	if err != nil {
		return nil, err
	}

	cache := make(valueWriteAccessCache)
	mc := newMaskingContext()
	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, ErrFieldNotFound)
		}
		if err := cache.check(h, rctx, mc, field, callerID, scope, value.TargetID); err != nil {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, err)
		}
	}

	return values, nil
}

// PreUpsertPropertyValue enforces write access and sync locking on the value's field before upsert.
func (h *AccessControlHook) PreUpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	enforced, err := h.isGroupEnforced(value.GroupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return value, nil
	}

	callerID := h.extractCallerID(rctx)

	field, err := h.propertyService.getPropertyField(value.GroupID, value.FieldID)
	if err != nil {
		return nil, err
	}

	if err := h.checkValueWriteAccess(rctx, newMaskingContext(), field, callerID, h.extractActingAsScope(rctx), value.TargetID); err != nil {
		return nil, err
	}

	return value, nil
}

// PreUpsertPropertyValues enforces write access and sync locking for all fields atomically before upsert.
// All values in a batch share the same GroupID (enforced by the public API).
func (h *AccessControlHook) PreUpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}
	enforced, err := h.isGroupEnforced(values[0].GroupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return values, nil
	}

	callerID := h.extractCallerID(rctx)
	scope := h.extractActingAsScope(rctx)

	fieldMap, err := h.getFieldsForValues(values)
	if err != nil {
		return nil, err
	}

	cache := make(valueWriteAccessCache)
	mc := newMaskingContext()
	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, ErrFieldNotFound)
		}
		if err := cache.check(h, rctx, mc, field, callerID, scope, value.TargetID); err != nil {
			return nil, fmt.Errorf("field %s: %w", value.FieldID, err)
		}
	}

	return values, nil
}

// PreDeletePropertyValue enforces write access before deleting a value.
func (h *AccessControlHook) PreDeletePropertyValue(rctx request.CTX, groupID string, id string) error {
	enforced, err := h.isGroupEnforced(groupID)
	if err != nil {
		return err
	}
	if !enforced {
		return nil
	}

	callerID := h.extractCallerID(rctx)

	value, err := h.propertyService.getPropertyValue(groupID, id)
	if err != nil {
		return err
	}

	field, err := h.propertyService.getPropertyField(groupID, value.FieldID)
	if err != nil {
		return err
	}

	// value is already loaded, so hand it to the visibility check directly
	// rather than paying a second read for the same row.
	mc := newMaskingContext()
	mc.primeStoredValue(field.ID, value.TargetID, value)

	return h.checkValueWriteAccess(rctx, mc, field, callerID, h.extractActingAsScope(rctx), value.TargetID)
}

// PreDeletePropertyValuesForTarget enforces write access for all affected fields
// before deleting all values for a target.
func (h *AccessControlHook) PreDeletePropertyValuesForTarget(rctx request.CTX, groupID string, targetType string, targetID string) error {
	if enforced, err := h.isGroupEnforced(groupID); err != nil {
		return err
	} else if !enforced {
		return nil
	}

	callerID := h.extractCallerID(rctx)

	// Collect one value per field for targetID -- the deletion this hook is
	// gating -- so checkValueWriteVisibility can judge each field's write
	// without a second read for the row already in hand.
	fieldValues := make(map[string]*model.PropertyValue)
	var cursor model.PropertyValueSearchCursor
	iterations := 0

	for {
		iterations++
		if iterations > propertyAccessMaxPaginationIterations {
			return fmt.Errorf("exceeded maximum pagination iterations (%d)", propertyAccessMaxPaginationIterations)
		}

		opts := model.PropertyValueSearchOpts{
			TargetType: targetType,
			TargetIDs:  []string{targetID},
			PerPage:    propertyAccessPaginationPageSize,
		}

		if !cursor.IsEmpty() {
			opts.Cursor = cursor
		}

		values, err := h.propertyService.searchPropertyValues(groupID, opts)
		if err != nil {
			return err
		}

		for _, value := range values {
			fieldValues[value.FieldID] = value
		}

		if len(values) < propertyAccessPaginationPageSize {
			break
		}

		lastValue := values[len(values)-1]
		cursor = model.PropertyValueSearchCursor{
			PropertyValueID: lastValue.ID,
			CreateAt:        lastValue.CreateAt,
		}
	}

	if len(fieldValues) == 0 {
		return nil
	}

	fieldIDSlice := make([]string, 0, len(fieldValues))
	for fieldID := range fieldValues {
		fieldIDSlice = append(fieldIDSlice, fieldID)
	}

	fields, err := h.propertyService.getPropertyFields(groupID, fieldIDSlice)
	if err != nil {
		return err
	}

	mc := newMaskingContext()
	for fieldID, value := range fieldValues {
		mc.primeStoredValue(fieldID, targetID, value)
	}

	cache := make(valueWriteAccessCache)
	scope := h.extractActingAsScope(rctx)
	for _, field := range fields {
		if err := cache.check(h, rctx, mc, field, callerID, scope, targetID); err != nil {
			return fmt.Errorf("field %s: %w", field.ID, err)
		}
	}

	return nil
}

// PreDeletePropertyValuesForField enforces write access before deleting all values for a field.
func (h *AccessControlHook) PreDeletePropertyValuesForField(rctx request.CTX, groupID string, fieldID string) error {
	enforced, err := h.isGroupEnforced(groupID)
	if err != nil {
		return err
	}
	if !enforced {
		return nil
	}

	callerID := h.extractCallerID(rctx)

	field, err := h.propertyService.getPropertyField(groupID, fieldID)
	if err != nil {
		return err
	}

	// This clears every value the field has across every object, so there is no
	// single object to measure value.write against here -- an empty target would
	// resolve as a denied channel/team membership check for anyone but a
	// sysadmin, refusing a legitimate cascade. A human caller's authority for
	// this operation comes from the field-level write gate on the delete path
	// (PreDeletePropertyField / enforceFieldUpdateAccess), not from here.
	if !h.isMachineCaller(callerID) {
		return nil
	}

	return h.checkValueWriteAccess(rctx, newMaskingContext(), field, callerID, h.extractActingAsScope(rctx), "")
}

// Value Post-Hooks

// PostGetPropertyValue applies read access control to a single value.
// Returns nil if the caller doesn't have access.
func (h *AccessControlHook) PostGetPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil {
		return nil, nil
	}
	enforced, err := h.isGroupEnforced(value.GroupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return value, nil
	}

	callerID := h.extractCallerID(rctx)

	filtered, err := h.applyValueReadAccessControl(rctx, []*model.PropertyValue{value}, callerID)
	if err != nil {
		return nil, err
	}

	if len(filtered) == 0 {
		return nil, nil
	}

	return filtered[0], nil
}

// PostGetPropertyValues applies read access control to a list of values.
// Values the caller doesn't have access to are silently filtered out.
// All values in a batch share the same GroupID (enforced by the public API).
func (h *AccessControlHook) PostGetPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}
	enforced, err := h.isGroupEnforced(values[0].GroupID)
	if err != nil {
		return nil, err
	}
	if !enforced {
		return values, nil
	}

	callerID := h.extractCallerID(rctx)

	return h.applyValueReadAccessControl(rctx, values, callerID)
}

// Access Control Helper Methods

// extractCallerID gets the caller ID from a request context using the property service's extractor.
func (h *AccessControlHook) extractCallerID(rctx request.CTX) string {
	return h.propertyService.extractCallerID(rctx)
}

// extractActingAsScope gets the caller's acting-as scope from a request context
// using the property service's extractor.
func (h *AccessControlHook) extractActingAsScope(rctx request.CTX) string {
	return h.propertyService.extractRequestOptions(rctx).ActingAsScope
}

// isCallerPlugin checks whether the callerID corresponds to an installed plugin.
func (h *AccessControlHook) isCallerPlugin(callerID string) bool {
	return callerID != "" && h.pluginChecker != nil && h.pluginChecker(callerID)
}

// isMachineCaller reports whether the caller is a machine actor (an installed
// plugin, a built-in sync service, or a system subsystem's setup migration)
// rather than a human. Owner-list enforcement applies only to machine
// callers; human callers (session users and local admins) are governed by
// the API-layer permission levels. A system caller holds no position in any
// scheme, so the restrictions ladder is meaningless for it -- like a plugin
// or a sync service, it acts only by matching a grant.
func (h *AccessControlHook) isMachineCaller(callerID string) bool {
	if h.isCallerPlugin(callerID) ||
		callerID == model.CallerIDLDAPSync ||
		callerID == model.CallerIDSAMLSync {
		return true
	}
	_, isSystem := model.SystemCallerOwnedGroup(callerID)
	return isSystem
}

// callerOwnerIdentity maps a machine caller (and its acting-as scope) to the
// owner identity it would match in a field's owners list. A built-in sync
// service is a singleton (one LDAP, one SAML), so its owner type is "service"
// and it carries no scope; a system subsystem is the same shape, keyed by the
// group name it owns rather than a fixed attr name; for a plugin the manifest
// ID is the owner ID and the scope is whatever the plugin declared on the
// request context.
func (h *AccessControlHook) callerOwnerIdentity(callerID, scope string) (ownerID, ownerType, effectiveScope string) {
	switch callerID {
	case model.CallerIDLDAPSync:
		return model.PropertyFieldAttrLDAP, model.PropertyOwnerTypeService, ""
	case model.CallerIDSAMLSync:
		return model.PropertyFieldAttrSAML, model.PropertyOwnerTypeService, ""
	default:
		if group, ok := model.SystemCallerOwnedGroup(callerID); ok {
			return group, model.PropertyOwnerTypeService, ""
		}
		return callerID, model.PropertyOwnerTypePlugin, scope
	}
}

// permissionsGrantAllows reports whether a machine caller may perform action
// on field under its typed permissions object. A machine caller has no human
// role, so the restrictions ladder never applies to it: the decision is
// grant-only, with nothing to fall back on when no grant matches. Callers
// must confirm isMachineCaller first -- callerOwnerIdentity's default branch
// assumes a plugin, and a human's user ID would otherwise be resolved as one.
func (h *AccessControlHook) permissionsGrantAllows(field *model.PropertyField, callerID, scope, action string) bool {
	ownerID, ownerType, effectiveScope := h.callerOwnerIdentity(callerID, scope)
	return field.Permissions.MatchingGrant(ownerType, ownerID, effectiveScope, action) != nil
}

// permissionsAllows answers whether a caller may read or write a field
// carrying a typed permissions object. A machine caller is judged by
// its grants alone -- the restrictions ladder never applies to it. A human
// caller is judged by the injected ladderChecker, which already answers the
// union of the ladder and the caller's user/role grants as one bool, so this
// function's only job is splitting machine from human.
func (h *AccessControlHook) permissionsAllows(rctx request.CTX, field *model.PropertyField, callerID, scope, action, valueTargetID string) bool {
	if callerID == "" {
		return false
	}
	if h.isMachineCaller(callerID) {
		return h.permissionsGrantAllows(field, callerID, scope, action)
	}
	if h.ladderChecker == nil {
		return false
	}
	return h.ladderChecker(rctx, callerID, field, action, valueTargetID)
}

// enforceFieldUpdateAccess gates a field-definition update. A machine caller
// needs a field.write grant on the stored (existing) field -- so it cannot
// grant itself the write in the same patch that uses it -- and a human caller
// is judged by the same permissions object, via the injected ladder checker.
// updated is accepted but never consulted, for the same reason: judging the
// field being written would let a caller author its own way past the check.
func (h *AccessControlHook) enforceFieldUpdateAccess(rctx request.CTX, existing, updated *model.PropertyField, callerID string) error {
	// An update that changes nothing but the option list is an option write, not
	// a field write, and has to be answered the same way the options endpoint
	// answers it. channels/api4's patchPropertyField already routes such a patch
	// to option.write (isOptionsOnlyPatch); the hook sees only the merged field,
	// so it derives the same distinction by comparing. Without this the two
	// layers decide about different grid cells and a field delegating option
	// management to members is allowed at api4 and refused here.
	if model.PropertyFieldChangeIsOptionsOnly(existing, updated) {
		return h.enforceOptionWriteAccess(rctx, existing, callerID)
	}

	if existing.Permissions != nil {
		if h.isMachineCaller(callerID) {
			if h.permissionsGrantAllows(existing, callerID, "", model.PropertyActionFieldWrite) {
				return nil
			}
			return fmt.Errorf("field %s carries permissions and caller %q matches no field.write grant: %w", existing.ID, callerID, ErrAccessDenied)
		}
		if h.permissionsAllows(rctx, existing, callerID, "", model.PropertyActionFieldWrite, "") {
			return nil
		}
		return fmt.Errorf("field %s refuses caller %q a field write: %w", existing.ID, callerID, ErrAccessDenied)
	}

	// Every group-managed field has carried a converted permissions object
	// since the migration backfill, and the create/update path populates it
	// too; unreached in production. Fails closed rather than falling back to
	// the owners and source-plugin rules those columns no longer govern.
	return fmt.Errorf("field %s carries no permissions object: %w", existing.ID, ErrAccessDenied)
}

// getSourcePluginID extracts the source_plugin_id from a PropertyField's attrs.
func (h *AccessControlHook) getSourcePluginID(field *model.PropertyField) string {
	if field.Attrs == nil {
		return ""
	}
	sourcePluginID, _ := field.Attrs[model.PropertyAttrsSourcePluginID].(string)
	return sourcePluginID
}

// ensureSourcePluginIDUnchanged checks that the source_plugin_id attribute hasn't changed between fields.
func (h *AccessControlHook) ensureSourcePluginIDUnchanged(existingField, updatedField *model.PropertyField) error {
	existingSourcePluginID := h.getSourcePluginID(existingField)
	updatedSourcePluginID := h.getSourcePluginID(updatedField)

	if existingSourcePluginID != updatedSourcePluginID {
		return fmt.Errorf("source_plugin_id is immutable and cannot be changed from '%s' to '%s': %w", existingSourcePluginID, updatedSourcePluginID, ErrAccessDenied)
	}

	return nil
}

// validateProtectedFieldUpdate validates that a field can be updated to protected=true.
func (h *AccessControlHook) validateProtectedFieldUpdate(updatedField *model.PropertyField, callerID string) error {
	if !model.IsPropertyFieldProtected(updatedField) {
		return nil
	}

	sourcePluginID := h.getSourcePluginID(updatedField)
	if sourcePluginID == "" {
		return fmt.Errorf("cannot set protected=true on a field without a source_plugin_id: %w", ErrAccessDenied)
	}

	if sourcePluginID != callerID {
		return fmt.Errorf("cannot set protected=true: only source plugin '%s' can modify this field: %w", sourcePluginID, ErrAccessDenied)
	}

	return nil
}

// checkFieldDeleteAccess checks if the given caller can delete a PropertyField.
// There is no separate delete action, so deleting a definition is judged as a
// field.write.
// IMPORTANT: Always pass the existing field fetched from the database, not a field provided by the caller.
func (h *AccessControlHook) checkFieldDeleteAccess(rctx request.CTX, field *model.PropertyField, callerID string) error {
	if field.Permissions != nil {
		if h.isMachineCaller(callerID) {
			if h.permissionsGrantAllows(field, callerID, "", model.PropertyActionFieldWrite) {
				return nil
			}
			return fmt.Errorf("field %s carries permissions and caller %q matches no field.write grant: %w", field.ID, callerID, ErrAccessDenied)
		}
		if h.permissionsAllows(rctx, field, callerID, "", model.PropertyActionFieldWrite, "") {
			return nil
		}
		return fmt.Errorf("field %s refuses caller %q a field delete: %w", field.ID, callerID, ErrAccessDenied)
	}

	// Every group-managed field has carried a converted permissions object
	// since the migration backfill, and the create/update path populates it
	// too; unreached in production. Fails closed rather than falling back to
	// the owners and source-plugin rules those columns no longer govern.
	return fmt.Errorf("field %s carries no permissions object: %w", field.ID, ErrAccessDenied)
}

// valueWriteAccessCache memoizes checkValueWriteAccess within one hook call
// that gates several values or fields at once. The human arm resolves role
// and channel/team membership on every call, so without this a batch write
// on one field and target would repeat that resolution once per value.
type valueWriteAccessCache map[[2]string]error

func (c valueWriteAccessCache) check(h *AccessControlHook, rctx request.CTX, mc maskingContext, field *model.PropertyField, callerID, scope, valueTargetID string) error {
	key := [2]string{field.ID, valueTargetID}
	if err, ok := c[key]; ok {
		return err
	}
	err := h.checkValueWriteAccess(rctx, mc, field, callerID, scope, valueTargetID)
	c[key] = err
	return err
}

// checkValueWriteAccess gates a value write: a machine caller is allowed only
// by a matching value.write grant, and a human caller is judged against
// valueTargetID, the object the value hangs off. Once either has admitted the
// write, a masked field still gets a say: checkValueWriteVisibility refuses it
// if the caller cannot see the whole of what is already stored there.
func (h *AccessControlHook) checkValueWriteAccess(rctx request.CTX, mc maskingContext, field *model.PropertyField, callerID, scope, valueTargetID string) error {
	if field.Permissions != nil {
		if h.isMachineCaller(callerID) {
			if !h.permissionsGrantAllows(field, callerID, scope, model.PropertyActionValueWrite) {
				return fmt.Errorf("field %s carries permissions and caller %q acting as scope %q matches no value.write grant: %w", field.ID, callerID, scope, ErrAccessDenied)
			}
		} else if !h.permissionsAllows(rctx, field, callerID, scope, model.PropertyActionValueWrite, valueTargetID) {
			return fmt.Errorf("field %s refuses caller %q a value write on target %q: %w", field.ID, callerID, valueTargetID, ErrAccessDenied)
		}
		return h.checkValueWriteVisibility(rctx, mc, field, callerID, valueTargetID)
	}

	// Every group-managed field has carried a converted permissions object
	// since the migration backfill, and the create/update path populates it
	// too; unreached in production. Fails closed rather than falling back to
	// the owners, protected, and sync-lock rules those columns no longer govern.
	return fmt.Errorf("field %s carries no permissions object: %w", field.ID, ErrAccessDenied)
}

// getCallerValuesForField retrieves all property values for the caller on a specific field.
func (h *AccessControlHook) getCallerValuesForField(groupID, fieldID, callerID string) ([]*model.PropertyValue, error) {
	if callerID == "" {
		return []*model.PropertyValue{}, nil
	}

	allValues := []*model.PropertyValue{}
	var cursor model.PropertyValueSearchCursor
	iterations := 0

	for {
		iterations++
		if iterations > propertyAccessMaxPaginationIterations {
			return nil, fmt.Errorf("exceeded maximum pagination iterations (%d)", propertyAccessMaxPaginationIterations)
		}

		opts := model.PropertyValueSearchOpts{
			FieldID:   fieldID,
			TargetIDs: []string{callerID},
			PerPage:   propertyAccessPaginationPageSize,
		}

		if !cursor.IsEmpty() {
			opts.Cursor = cursor
		}

		values, err := h.propertyService.searchPropertyValues(groupID, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to get caller values for field: %w", err)
		}

		allValues = append(allValues, values...)

		if len(values) < propertyAccessPaginationPageSize {
			break
		}

		lastValue := values[len(values)-1]
		cursor = model.PropertyValueSearchCursor{
			PropertyValueID: lastValue.ID,
			CreateAt:        lastValue.CreateAt,
		}
	}

	return allValues, nil
}

// extractOptionIDsFromValue parses a JSON value and extracts option IDs into a set.
func (h *AccessControlHook) extractOptionIDsFromValue(fieldType model.PropertyFieldType, value []byte) (map[string]struct{}, error) {
	if len(value) == 0 {
		return nil, nil
	}

	optionIDs := make(map[string]struct{})

	switch fieldType {
	case model.PropertyFieldTypeSelect, model.PropertyFieldTypeRank:
		var optionID string
		if err := json.Unmarshal(value, &optionID); err != nil {
			return nil, err
		}
		if optionID != "" {
			optionIDs[optionID] = struct{}{}
		}

	// A graph value holds the options an object is marked with, which is a
	// multiselect value's shape; what differs is the relation between those
	// options, and nothing about parsing them.
	case model.PropertyFieldTypeMultiselect, model.PropertyFieldTypeGraph:
		var ids []string
		if err := json.Unmarshal(value, &ids); err != nil {
			return nil, err
		}
		for _, id := range ids {
			if id != "" {
				optionIDs[id] = struct{}{}
			}
		}

	default:
		return nil, fmt.Errorf("extractOptionIDsFromValue only supports select, multiselect, rank and graph field types, got: %s", fieldType)
	}

	return optionIDs, nil
}

// copyPropertyField returns a copy of a PropertyField with a fresh Attrs map.
// The Attrs copy is shallow: nested slices/maps (notably Attrs["options"])
// share backing storage with the original. That is safe today because
// maskFieldOptions (masking.go) replaces Attrs["options"] wholesale rather
// than mutating in place. A future hook that mutates a nested value in the
// returned copy would also mutate the caller's original — deep-copy those
// entries if that changes.
func (h *AccessControlHook) copyPropertyField(field *model.PropertyField) *model.PropertyField {
	copied := *field
	copied.Attrs = make(model.StringInterface)
	if field.Attrs != nil {
		maps.Copy(copied.Attrs, field.Attrs)
	}
	return &copied
}

// getCallerOptionIDsForField retrieves the caller's values for a field and extracts all option IDs.
func (h *AccessControlHook) getCallerOptionIDsForField(groupID, fieldID, callerID string, fieldType model.PropertyFieldType) (map[string]struct{}, error) {
	callerValues, err := h.getCallerValuesForField(groupID, fieldID, callerID)
	if err != nil {
		return make(map[string]struct{}), err
	}

	if len(callerValues) == 0 {
		return make(map[string]struct{}), nil
	}

	callerOptionIDs := make(map[string]struct{})
	for _, val := range callerValues {
		optionIDs, err := h.extractOptionIDsFromValue(fieldType, val.Value)
		if err == nil && optionIDs != nil {
			for optionID := range optionIDs {
				callerOptionIDs[optionID] = struct{}{}
			}
		}
	}

	return callerOptionIDs, nil
}

// applyFieldReadAccessControl applies read access control to a single field.
// A caller who holds option.read gets the field back, its option list
// filtered to what masking allows them to see; a caller who does not is
// still given the field itself -- field.read is left unenforced -- with its
// option list hidden.
//
// c is the masking context for the batch this field read is part of --
// callers that read one field at a time still build one, of one field, so
// there is a single path through the masking resolution.
func (h *AccessControlHook) applyFieldReadAccessControl(rctx request.CTX, c maskingContext, field *model.PropertyField, callerID string) *model.PropertyField {
	if field.Permissions != nil {
		scope := h.extractActingAsScope(rctx)
		if h.permissionsAllows(rctx, field, callerID, scope, model.PropertyActionOptionRead, "") {
			fm, err := c.resolve(h, field)
			if err != nil {
				rctx.Logger().Error(
					"Hiding a property field's options because its masking could not be resolved",
					mlog.String("field_id", field.ID),
					mlog.Err(err),
				)
				filteredField := h.copyPropertyField(field)
				if field.Type.SupportsOptions() {
					filteredField.HideOptions()
				}
				return filteredField
			}
			if fm.masking == nil || h.exempt(fm.masking.Except, callerID) {
				return field
			}
			return h.maskFieldOptions(rctx, c, field, fm, callerID)
		}
		// Denied: the field itself is still returned -- field.read is left
		// unenforced -- only its option list is hidden.
		filteredField := h.copyPropertyField(field)
		if field.Type.SupportsOptions() {
			filteredField.HideOptions()
		}
		return filteredField
	}

	// Every group-managed field has carried a converted permissions object
	// since the migration backfill, and the create/update path populates it
	// too; unreached in production. Fails closed the same way the denied
	// branch above does, rather than falling back to an access mode nothing
	// sets any more.
	filteredField := h.copyPropertyField(field)
	if field.Type.SupportsOptions() {
		filteredField.HideOptions()
	}
	return filteredField
}

// applyFieldReadAccessControlToList applies read access control to a list of
// fields, sharing one masking context across the batch: a holdings search a
// field's masking needs runs once for every field that shares the same
// holdings field, and each field's masking is resolved once rather than once
// per call into it. The template lookup a linked field's resolution makes is
// not shared -- maskingContext has no template cache -- so fields linked to
// the same template each pay their own template read.
func (h *AccessControlHook) applyFieldReadAccessControlToList(rctx request.CTX, fields []*model.PropertyField, callerID string) []*model.PropertyField {
	if len(fields) == 0 {
		return fields
	}

	c := newMaskingContext()
	filtered := make([]*model.PropertyField, 0, len(fields))
	for _, field := range fields {
		filtered = append(filtered, h.applyFieldReadAccessControl(rctx, c, field, callerID))
	}

	return filtered
}

// getFieldsForValues fetches all unique fields associated with the given values.
func (h *AccessControlHook) getFieldsForValues(values []*model.PropertyValue) (map[string]*model.PropertyField, error) {
	if len(values) == 0 {
		return make(map[string]*model.PropertyField), nil
	}

	groupAndFieldIDs := make(map[string]map[string]struct{})
	for _, value := range values {
		if groupAndFieldIDs[value.GroupID] == nil {
			groupAndFieldIDs[value.GroupID] = make(map[string]struct{})
		}
		groupAndFieldIDs[value.GroupID][value.FieldID] = struct{}{}
	}

	fieldMap := make(map[string]*model.PropertyField)
	for groupID, fieldIDs := range groupAndFieldIDs {
		fieldIDSlice := make([]string, 0, len(fieldIDs))
		for fieldID := range fieldIDs {
			fieldIDSlice = append(fieldIDSlice, fieldID)
		}

		fields, err := h.propertyService.getPropertyFields(groupID, fieldIDSlice)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch fields for values: %w", err)
		}

		for _, field := range fields {
			fieldMap[field.ID] = field
		}
	}

	return fieldMap, nil
}

// applyValueReadAccessControl applies read access control to a list of values.
func (h *AccessControlHook) applyValueReadAccessControl(rctx request.CTX, values []*model.PropertyValue, callerID string) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}

	fieldMap, err := h.getFieldsForValues(values)
	if err != nil {
		return nil, fmt.Errorf("applyValueReadAccessControl: %w", err)
	}

	scope := h.extractActingAsScope(rctx)
	mc := newMaskingContext()

	filtered := make([]*model.PropertyValue, 0, len(values))
	for _, value := range values {
		field, exists := fieldMap[value.FieldID]
		if !exists {
			return nil, fmt.Errorf("applyValueReadAccessControl: field not found for value %s", value.ID)
		}

		if field.Permissions != nil {
			if !h.permissionsAllows(rctx, field, callerID, scope, model.PropertyActionValueRead, value.TargetID) {
				// Denied: dropped silently.
				continue
			}

			fm, err := mc.resolve(h, field)
			if err != nil {
				return nil, fmt.Errorf("applyValueReadAccessControl: %w", err)
			}
			if fm.masking == nil || h.exempt(fm.masking.Except, callerID) {
				filtered = append(filtered, value)
				continue
			}
			maskedValue, err := h.maskValue(rctx, mc, field, fm, value, callerID)
			if err != nil {
				// Hide rather than fail the read: what one value's filter could not
				// establish must not turn into an error for the whole list.
				logMaskingFailure(rctx, field, value, err)
			} else if maskedValue != nil {
				filtered = append(filtered, maskedValue)
			}
			continue
		}

		// Every group-managed field has carried a converted permissions object
		// since the migration backfill, and the create/update path populates it
		// too; unreached in production. Fails closed by dropping the value,
		// rather than falling back to an access mode nothing sets any more.
	}

	return filtered, nil
}
