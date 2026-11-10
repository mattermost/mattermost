// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"math"
	"net/http"
	"reflect"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var (
	ErrInvalidFieldAttrs = errors.New("invalid field attrs")
	ErrInvalidValue      = errors.New("invalid property value")
	ErrAdminRequired     = errors.New("admin privileges required")
)

// PermissionChecker checks whether a user has a specific permission.
// This avoids a circular dependency between the properties and app packages.
type PermissionChecker func(rctx request.CTX, userID string, permission *model.Permission) bool

// DirectChannelChecker reports whether a channel is a direct or group message.
// This avoids a circular dependency between the properties and app packages,
// the same way PermissionChecker does.
type DirectChannelChecker func(rctx request.CTX, channelID string) (bool, error)

// PostChannelResolver returns the ID of the channel a post is in, so a parent
// rule on a post field can find the channel whose value it compares against.
// This avoids a circular dependency between the properties and app packages,
// the same way DirectChannelChecker does.
type PostChannelResolver func(rctx request.CTX, postID string) (string, error)

// AccessControlAttributeValidationHook validates and sanitizes property field attributes
// and values for managed property groups. It owns the full attr pipeline
// for these groups:
//
//   - validates field Name against the CEL-safe identifier rules
//     ([model.ValidateCPAFieldName]); on update this fires only when Name
//     actually changes, so pre-existing fields with non-conforming names
//     remain editable on all other attrs (lenient grandfather)
//   - refuses the field types access policies cannot read (number,
//     checkbox; see PropertyFieldType.SupportsAccessControl)
//   - trims whitespace on string attrs
//   - applies the visibility default when unset
//   - clears attrs that don't apply to the field type (options on non-select,
//     ldap/saml on types that cannot be synced from an identity source)
//   - auto-assigns IDs to options that lack one and validates option shape
//   - keeps the option set of a synced select-shaped field owned by its sync:
//     other callers may only recolor or reorder its options
//   - validates visibility, value_type, managed, display_name, and sort_order
//   - validates required and editable, removing either when explicitly unset
//   - validates and canonicalizes actions, the render-placement allow-list
//     shared by the classification banner and channel labels; on update this
//     fires only when actions actually change, so a field carrying a value
//     that is no longer valid stays editable on all other attrs (lenient
//     grandfather, as for Name)
//   - validates property values for text fields against value_type
//     constraints (email, url, phone)
//   - enforces that managed="admin" can only be set by callers with
//     PermissionManageSystem, and keeps PermissionValues in sync with the
//     managed attribute
//   - refuses a human write to a channel-object value whose target is a DM or
//     GM, at every permission tier, on both the upsert and the delete paths
//     (see refuseDirectChannelValueWrite)
//
// The hook only applies to groups whose IDs are in managedGroupIDs.

// RequiredAttributeEnforcementProvider reports whether required-attribute
// enforcement is currently active. Backed by a closure over live config so a
// flag flip takes effect without restarting the hook.
type RequiredAttributeEnforcementProvider func() bool

// OpenIDAttributeSyncProvider reports whether linking attributes to OpenID
// Connect claims is currently enabled. Backed by a closure over live config,
// like RequiredAttributeEnforcementProvider.
type OpenIDAttributeSyncProvider func() bool

// PropertyFieldBoundsProvider reports whether the PropertyFieldBounds flag is
// on, which lets a field gain a bounds rule or a write_once lock. Backed by a
// closure over live config, like RequiredAttributeEnforcementProvider.
type PropertyFieldBoundsProvider func() bool

type AccessControlAttributeValidationHook struct {
	BasePropertyHook
	propertyService              *PropertyService
	managedGroupIDs              map[string]struct{}
	permissionChecker            PermissionChecker
	pluginChecker                PluginChecker
	directChannelChecker         DirectChannelChecker
	postChannelResolver          PostChannelResolver
	requiredAttributeEnforcement RequiredAttributeEnforcementProvider
	openIDAttributeSync          OpenIDAttributeSyncProvider
	propertyFieldBounds          PropertyFieldBoundsProvider
	valueAudit                   *PropertyValueAuditHook
}

var _ PropertyHook = (*AccessControlAttributeValidationHook)(nil)

// AccessControlAttributeValidationHookConfig carries the hook's callbacks into
// the app package. A config struct rather than three positional callbacks ahead
// of a variadic.
//
// Every callback is optional, and each rule that needs one guards on nil, so a
// test can construct the hook with only the callbacks its assertions reach.
type AccessControlAttributeValidationHookConfig struct {
	// PermissionChecker resolves a permission for a caller. Without it, the
	// manage_system bypasses are unavailable and those callers are treated as
	// ordinary users.
	PermissionChecker PermissionChecker
	// PluginChecker reports whether a caller ID is an installed plugin.
	// Without it, only the built-in sync services count as machine actors.
	PluginChecker PluginChecker
	// DirectChannelChecker reports whether a channel is a DM or GM. Without
	// it, refuseDirectChannelValueWrite does not run at all.
	DirectChannelChecker DirectChannelChecker
	// PostChannelResolver returns the channel a post is in. Without it, a
	// parent rule on a post field refuses every write.
	PostChannelResolver PostChannelResolver
	// RequiredAttributeEnforcement reports whether required-attribute
	// enforcement is active for channel-object-type fields. A nil provider
	// defaults to enforced. Applies uniformly to every required channel
	// field, classification included; a required field on any other object
	// type (post, user) is always enforced regardless of this provider.
	RequiredAttributeEnforcement RequiredAttributeEnforcementProvider
	// OpenIDAttributeSync reports whether attributes may be linked to OpenID
	// Connect claims. A nil provider defaults to enabled. When it reports
	// false, a new or changed openid link is refused; an existing one rides
	// along untouched.
	OpenIDAttributeSync OpenIDAttributeSyncProvider
	// PropertyFieldBounds reports whether a field may gain a bounds rule or a
	// write_once lock. A nil provider defaults to off.
	PropertyFieldBounds PropertyFieldBoundsProvider
	// ValueAudit receives a record for each value write a bounds rule or
	// mutability refuses, or would refuse without Enterprise Advanced. Without
	// it nothing is audited.
	ValueAudit *PropertyValueAuditHook
}

// NewAccessControlAttributeValidationHook creates a hook that validates field attributes and
// values for the given property groups.
func NewAccessControlAttributeValidationHook(ps *PropertyService, cfg AccessControlAttributeValidationHookConfig, managedGroupIDs ...string) *AccessControlAttributeValidationHook {
	ids := make(map[string]struct{}, len(managedGroupIDs))
	for _, id := range managedGroupIDs {
		ids[id] = struct{}{}
	}
	return &AccessControlAttributeValidationHook{
		propertyService:              ps,
		managedGroupIDs:              ids,
		permissionChecker:            cfg.PermissionChecker,
		pluginChecker:                cfg.PluginChecker,
		directChannelChecker:         cfg.DirectChannelChecker,
		postChannelResolver:          cfg.PostChannelResolver,
		requiredAttributeEnforcement: cfg.RequiredAttributeEnforcement,
		openIDAttributeSync:          cfg.OpenIDAttributeSync,
		propertyFieldBounds:          cfg.PropertyFieldBounds,
		valueAudit:                   cfg.ValueAudit,
	}
}

func (h *AccessControlAttributeValidationHook) isGroupManaged(groupID string) bool {
	_, ok := h.managedGroupIDs[groupID]
	return ok
}

// requiredEnforced reports whether required-attribute enforcement is active.
// A nil provider defaults to enforced, matching pre-flag behavior, so tests
// and callers that don't care about the flag don't need to supply one.
func (h *AccessControlAttributeValidationHook) requiredEnforced() bool {
	return h.requiredAttributeEnforcement == nil || h.requiredAttributeEnforcement()
}

// openIDAttributeSyncEnabled reports whether attributes may be linked to
// OpenID Connect claims. A nil provider defaults to enabled.
func (h *AccessControlAttributeValidationHook) openIDAttributeSyncEnabled() bool {
	return h.openIDAttributeSync == nil || h.openIDAttributeSync()
}

// propertyFieldBoundsEnabled reports whether the PropertyFieldBounds flag is on.
// A nil provider means off, unlike openIDAttributeSyncEnabled: this flag defaults
// off and gates new protections, so a hook built without a provider must not
// quietly let rules in.
func (h *AccessControlAttributeValidationHook) propertyFieldBoundsEnabled() bool {
	return h.propertyFieldBounds != nil && h.propertyFieldBounds()
}

// sanitizeAndValidateFieldAttrs trims string attrs, applies the visibility
// default, clears attrs that don't apply to the field type, validates each
// attr, and auto-IDs+validates options for select-shaped fields. Mutates
// field.Attrs in place. existing is the field before this operation, nil on
// creation of a new field (or when an update targets a field that does not
// exist, which the store reports later): every rule then treats the field as
// brand new, with nothing to grandfather.
func (h *AccessControlAttributeValidationHook) sanitizeAndValidateFieldAttrs(rctx request.CTX, field, existing *model.PropertyField) error {
	// Access policies and the attribute views they read have no notion of a
	// number or a boolean, so those types are refused here, whether a field is
	// created with one or changed to one, rather than stored and then ignored or
	// misread by every rule.
	if !field.Type.SupportsAccessControl() {
		return fmt.Errorf("a %s field cannot be an access control attribute: %w", field.Type, ErrInvalidFieldAttrs)
	}

	if field.Attrs == nil {
		field.Attrs = model.StringInterface{}
	}

	var prevType model.PropertyFieldType
	var prevActions any
	var prevRequired bool
	if existing != nil {
		prevType = existing.Type
		prevActions = existing.Attrs[model.PropertyFieldAttrActions]
		prevRequired = model.IsPropertyFieldRequired(existing)
	}

	for _, key := range trimmedFieldAttrKeys {
		if v, ok := field.Attrs[key].(string); ok {
			field.Attrs[key] = strings.TrimSpace(v)
		}
	}

	if v, _ := field.Attrs[model.PropertyFieldAttrVisibility].(string); v == "" {
		field.Attrs[model.PropertyFieldAttrVisibility] = model.PropertyFieldVisibilityWhenSet
	}

	// Type-based attr clearing: select-shaped fields keep options, and only
	// the types that can be populated from an identity source keep their
	// ldap/saml/openid link (see PropertyFieldType.SupportsExternalSync).
	isSelect := field.Type.SupportsOptions()
	isText := field.Type == model.PropertyFieldTypeText
	managed, _ := field.Attrs[model.PropertyFieldAttrManaged].(string)

	if !isSelect {
		delete(field.Attrs, model.PropertyFieldAttributeOptions)
		// The two keys a read substitutes for an oversized option list go with it.
		// Only a select-shaped field's attrs are stripped of them before storage,
		// so converting an oversized field to text would otherwise persist them
		// and every later read of that text field would claim its (non-existent)
		// options were withheld.
		delete(field.Attrs, model.PropertyFieldAttributeOptionsCount)
		delete(field.Attrs, model.PropertyFieldAttributeOptionsOmitted)
	}
	if !field.Type.SupportsExternalSync() {
		for _, source := range model.PropertySyncSources() {
			delete(field.Attrs, model.PropertySyncSourceAttr(source))
		}
	}
	if err := h.validateSyncSources(field, existing); err != nil {
		return err
	}
	if err := refuseSetOnCreate(field); err != nil {
		return err
	}
	// change_policy only ever meant something on a channel field, so elsewhere it
	// is dropped before validation rather than refused: an integration still
	// sending it is warned instead of broken. A raise/lower policy on a field
	// that isn't a rank is stripped by the validation below; read it first so
	// that is logged too.
	oldKeys := oldPolicyKeysWritten(field, existing)
	// Read before validation, which deletes change_policy "any" and nulls.
	_, statesPolicy := field.Attrs[model.PropertyFieldAttrChangePolicy]
	if _, ok := field.Attrs[model.PropertyFieldAttrEditable]; ok {
		statesPolicy = true
	}
	loggable := false
	if field.ObjectType != model.PropertyFieldObjectTypeChannel {
		dropOldPolicyKeys(field)
		loggable = true
	} else if p, _ := field.Attrs[model.PropertyFieldAttrChangePolicy].(string); model.IsOrderedPropertyFieldChangePolicy(p) && field.Type != model.PropertyFieldTypeRank {
		loggable = true
	}
	// Both old keys are validated first: the translation below reads them.
	for _, key := range boolFieldAttrKeys {
		if err := model.SanitizeAndValidatePropertyFieldBoolAttr(field, key); err != nil {
			return fmt.Errorf("%s: %w", err.Error(), ErrInvalidFieldAttrs)
		}
	}
	if err := model.SanitizeAndValidatePropertyFieldChangePolicy(field); err != nil {
		return fmt.Errorf("%s: %w", err.Error(), ErrInvalidFieldAttrs)
	}
	oldFormatWrite, err := translateChangePolicy(field, existing, statesPolicy)
	if err != nil {
		return err
	}
	if oldFormatWrite && len(oldKeys) == 0 {
		// Unlocking with change_policy "any" or editable=true names none of them.
		oldKeys = []string{model.PropertyFieldAttrChangePolicy}
	}
	if oldFormatWrite || loggable {
		h.propertyService.warnOldPolicyKeys(rctx, field, oldKeys)
	}
	if err := h.validateBoundsChange(field, existing, oldFormatWrite); err != nil {
		return err
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
	if err := h.sanitizeAndValidateOwners(field, existing); err != nil {
		return err
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
	// The kill switch blocks only newly marking a channel field required: a
	// field that predates the switch being engaged keeps its required=true
	// attr untouched (same lenient-grandfather rationale as Name and
	// Actions above), so it snaps back to enforced the moment the switch
	// flips off again. Non-channel fields (post, user) are never gated by
	// this flag, matching the value-enforcement side in validateValues.
	if field.ObjectType == model.PropertyFieldObjectTypeChannel && !h.requiredEnforced() &&
		model.IsPropertyFieldRequired(field) && !prevRequired {
		return newRequiredAttrDisabledError(field)
	}
	// Lenient grandfather, same rationale as Name: a PATCH merges attrs, so a
	// field carrying an actions value that predates (or has since fallen out of)
	// the allow-list would otherwise be unpatchable on every other attr, with
	// delete/recreate the only way out. Only a caller actually changing actions
	// gets the strict check; an untouched value rides along as-is.
	if err := model.SanitizeAndValidatePropertyFieldActions(field); err != nil {
		if !sameFieldActions(field.Attrs[model.PropertyFieldAttrActions], prevActions) {
			return fmt.Errorf("%s: %w", err.Error(), ErrInvalidFieldAttrs)
		}
	}
	return nil
}

// sameFieldActions reports whether two raw attrs["actions"] values carry the
// same list. Anything that isn't a list of strings compares unequal, so a
// caller sending a malformed value is still rejected rather than grandfathered.
func sameFieldActions(a, b any) bool {
	as, aOK := fieldActionsAsStrings(a)
	bs, bOK := fieldActionsAsStrings(b)
	return aOK && bOK && slices.Equal(as, bs)
}

func fieldActionsAsStrings(raw any) ([]string, bool) {
	switch v := raw.(type) {
	case nil:
		return nil, true
	case []string:
		return v, true
	case []any:
		out := make([]string, 0, len(v))
		for _, elem := range v {
			s, ok := elem.(string)
			if !ok {
				return nil, false
			}
			out = append(out, s)
		}
		return out, true
	}
	return nil, false
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
	model.PropertyFieldAttrOpenID,
	model.PropertyFieldAttrDisplayName,
}

// boolFieldAttrKeys lists the boolean-valued attrs the hook validates. No
// object_type branch: scoping comes from the field's ObjectType, as for every
// other key.
var boolFieldAttrKeys = []string{
	model.PropertyFieldAttrRequired,
	model.PropertyFieldAttrEditable,
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

	// A synced option field has no options until its first sync provisions
	// them, so an empty list is legitimate there. It is dropped rather than
	// canonicalized: an absent list and an empty one both state that the field
	// has no options.
	if len(options) == 0 && model.IsPropertyFieldSynced(field) {
		delete(field.Attrs, model.PropertyFieldAttributeOptions)
		return nil
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

// sanitizeAndValidateOwners normalizes and validates the owners attr on a
// field. Each entry is trimmed and must be well-formed ({id, type, scopes}
// with a recognized type); scopes are trimmed and deduped; duplicate owner
// entries (same type+id) are merged by mergeDuplicateOwners. An empty or
// absent list is removed so HasPropertyFieldOwners stays false. The
// normalized list is written back in canonical form ([]any of maps) so
// downstream readers see a single shape.
//
// Defensive bounds (see the Property Owner* constants) cap the id and scope
// lengths and the number of owners/scopes so a buggy or hostile owner cannot
// bloat the Attrs blob. They are deliberately far above real usage. The owner
// cap skips the synthetic owners a projected echo of existing carries, since
// they are dropped before saving.
//
// An unrecognized owner type is rejected here, but an owner that simply does
// not correspond to any real installed plugin/service is intentionally
// accepted: it is a harmless no-op (the field stays locked to its real owners),
// so the system fails safe and access is checked at the moment of action.
func (h *AccessControlAttributeValidationHook) sanitizeAndValidateOwners(field, existing *model.PropertyField) error {
	raw, ok := field.Attrs[model.PropertyAttrsOwners]
	if !ok || raw == nil {
		return nil
	}

	data, err := json.Marshal(raw)
	if err != nil {
		return fmt.Errorf("invalid owners: %s: %w", err, ErrInvalidFieldAttrs)
	}
	var owners []model.PropertyOwner
	if err = json.Unmarshal(data, &owners); err != nil {
		return fmt.Errorf("invalid owners: %s: %w", err, ErrInvalidFieldAttrs)
	}

	if len(owners) == 0 {
		delete(field.Attrs, model.PropertyAttrsOwners)
		return nil
	}

	for i := range owners {
		owner := &owners[i]
		owner.ID = strings.TrimSpace(owner.ID)
		owner.Type = strings.TrimSpace(owner.Type)
		if owner.ID == "" {
			return fmt.Errorf("invalid owners: owner id cannot be empty: %w", ErrInvalidFieldAttrs)
		}
		if utf8.RuneCountInString(owner.ID) > model.PropertyOwnerIDMaxRunes {
			return fmt.Errorf("invalid owners: owner id exceeds max length of %d runes: %w", model.PropertyOwnerIDMaxRunes, ErrInvalidFieldAttrs)
		}
		if !model.IsValidPropertyOwnerType(owner.Type) {
			return fmt.Errorf("invalid owners: unknown owner type %q: %w", owner.Type, ErrInvalidFieldAttrs)
		}

		scopes := make([]string, 0, len(owner.Scopes))
		for _, scope := range owner.Scopes {
			scope = strings.TrimSpace(scope)
			if scope == "" || slices.Contains(scopes, scope) {
				continue
			}
			if utf8.RuneCountInString(scope) > model.PropertyOwnerScopeMaxRunes {
				return fmt.Errorf("invalid owners: scope exceeds max length of %d runes: %w", model.PropertyOwnerScopeMaxRunes, ErrInvalidFieldAttrs)
			}
			if !model.IsValidPropertyOwnerScope(scope) {
				return fmt.Errorf("invalid owners: scope %q contains invalid characters: %w", scope, ErrInvalidFieldAttrs)
			}
			scopes = append(scopes, scope)
		}
		owner.Scopes = scopes
	}
	normalized := mergeDuplicateOwners(owners)

	saved := len(normalized)
	if existing != nil {
		synthetic := syntheticOwnerIdentities(existing)
		for _, owner := range normalized {
			if synthetic[model.Identity{Type: owner.Type, ID: owner.ID}] {
				saved--
			}
		}
	}
	if saved > model.PropertyOwnersMaxPerField {
		return fmt.Errorf("invalid owners: too many owners (%d), max is %d: %w", saved, model.PropertyOwnersMaxPerField, ErrInvalidFieldAttrs)
	}
	for _, owner := range normalized {
		if len(owner.Scopes) > model.PropertyOwnerScopesMax {
			return fmt.Errorf("invalid owners: owner %q has too many scopes (%d), max is %d: %w", owner.ID, len(owner.Scopes), model.PropertyOwnerScopesMax, ErrInvalidFieldAttrs)
		}
	}

	out, err := json.Marshal(normalized)
	if err != nil {
		return fmt.Errorf("invalid owners: %s: %w", err, ErrInvalidFieldAttrs)
	}
	var canonical []any
	if err = json.Unmarshal(out, &canonical); err != nil {
		return fmt.Errorf("invalid owners: %s: %w", err, ErrInvalidFieldAttrs)
	}
	field.Attrs[model.PropertyAttrsOwners] = canonical
	return nil
}

// mergeDuplicateOwners merges owners sharing a type and id into the first
// one, unioning Scopes and Allow in first-seen order; a map would make the
// order random. The projection splits a scoped owner into a value half and
// an unscoped rest (see grantsFromLegacy), and the union converts back to
// the same two grants. An empty Allow means every action, so it absorbs the
// other entry's list. owners is not modified.
func mergeDuplicateOwners(owners []model.PropertyOwner) []model.PropertyOwner {
	appendMissing := func(into, from []string) []string {
		into = slices.Clip(into)
		for _, s := range from {
			if !slices.Contains(into, s) {
				into = append(into, s)
			}
		}
		return into
	}

	merged := make([]model.PropertyOwner, 0, len(owners))
	indexByIdentity := make(map[model.Identity]int, len(owners))
	for _, owner := range owners {
		identity := model.Identity{Type: owner.Type, ID: owner.ID}
		idx, dup := indexByIdentity[identity]
		if !dup {
			indexByIdentity[identity] = len(merged)
			merged = append(merged, owner)
			continue
		}
		first := &merged[idx]
		first.Scopes = appendMissing(first.Scopes, owner.Scopes)
		if len(first.Allow) == 0 || len(owner.Allow) == 0 {
			first.Allow = nil
		} else {
			first.Allow = appendMissing(first.Allow, owner.Allow)
		}
	}
	return merged
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
	slices.SortStableFunc(order, func(a, b int) int {
		return cmp.Compare(rankSortKey(options[a].Rank), rankSortKey(options[b].Rank))
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
//     that only admins can modify field definitions and options. A protected
//     field gets PermissionField none instead, the only level IsValid
//     accepts with Protected. On update, Protected follows the protected
//     attr (see pinFieldPermission).
//   - When managed="admin", PermissionValues is set to sysadmin. This is
//     gated on PermissionManageSystem; callers without an identifiable
//     caller ID (e.g. internal callers with no session on rctx) are
//     treated as non-admin and rejected. A plugin listed as an owner of a
//     field that is already admin-managed is exempt, so it can edit the
//     field or remove itself as owner without being a system admin.
//   - When the field is created owner-managed or an update changes its owners,
//     PermissionValues is pinned to sysadmin. Human value writes are already
//     blocked authoritatively by the converted restriction
//     (PermissionsFromLegacy forces value.write to none for an owner-managed
//     field), but pinning sysadmin here is the safe fallback: if the owners
//     list is ever dropped, the field defaults to admin-only rather than
//     becoming writable by every member. An unchanged echo is not pinned: a
//     projected read reports every grant as an owner, and pinning it would
//     reconvert value.write to none on a field nobody touched.
//   - Otherwise, PermissionValues is left as-is when set, and default-filled
//     by ObjectType when nil (member for user fields, sysadmin for system
//     and template). Caller pins are never downgraded.
func (h *AccessControlAttributeValidationHook) enforceGroupPermissions(rctx request.CTX, field, existing *model.PropertyField) (*model.PropertyField, error) {
	sysadmin := model.PermissionLevelSysadmin

	if managed, _ := field.Attrs[model.PropertyFieldAttrManaged].(string); managed == "admin" {
		callerID := h.propertyService.extractCallerID(rctx)

		exempt := false
		if existing != nil {
			if exManaged, _ := existing.Attrs[model.PropertyFieldAttrManaged].(string); exManaged == "admin" {
				if isMachineCaller(h.pluginChecker, callerID) && isListedOwner(existing, callerID) {
					exempt = true
				}
			}
		}

		if !exempt {
			// Verify the caller has admin privileges. Default-deny if the
			// permission checker isn't wired up or if the caller is
			// unidentifiable — we never silently promote to sysadmin.
			if h.permissionChecker == nil {
				return nil, fmt.Errorf("missing permission to set managed=admin: no permission checker configured: %w", ErrAdminRequired)
			}
			if callerID == "" || !h.permissionChecker(rctx, callerID, model.PermissionManageSystem) {
				return nil, fmt.Errorf("missing permission to set managed=admin: only system admins can set managed=admin: %w", ErrAdminRequired)
			}
		}
		field.PermissionValues = &sysadmin
	} else if model.HasPropertyFieldOwners(field) && (existing == nil || legacyOwnersChanged(field, existing)) {
		field.PermissionValues = &sysadmin
	} else if field.PermissionValues == nil {
		defaultLevel := defaultPermissionValuesForObjectType(field.ObjectType)
		field.PermissionValues = &defaultLevel
	}

	// Fields in managed groups require sysadmin for field/options edits.
	pinFieldPermission(field, existing)
	field.PermissionOptions = &sysadmin

	return field, nil
}

// pinFieldPermission pins PermissionField to sysadmin, or to none on a
// protected field. The stored columns are written from Permissions, so
// pinning none grants nobody anything. On update, protection comes from the
// attr alone: the projection reports Protected whenever field.write is none,
// so an echo that clears the attr still carries Protected, and reconverting
// from it would keep the field locked.
func pinFieldPermission(field, existing *model.PropertyField) {
	if existing != nil {
		field.Protected = model.IsPropertyFieldProtected(field)
	}
	level := model.PermissionLevelSysadmin
	if field.Protected {
		level = model.PermissionLevelNone
	}
	field.PermissionField = &level
}

// defaultPermissionValuesForObjectType returns the PermissionValues level a
// field should default to when the caller doesn't pin one. User fields are
// member-writable so users can set their own values; system and template
// fields attach to admin-owned scopes and require sysadmin. Channel fields
// default to admin: unlike a user field, a channel attribute is shared state
// that any member reading the channel would otherwise be able to overwrite,
// and these values are expected to feed access-control policy decisions, so
// the safer default is channel-admin (or sysadmin) rather than membership.
func defaultPermissionValuesForObjectType(objectType string) model.PermissionLevel {
	switch objectType {
	case model.PropertyFieldObjectTypeSystem, model.PropertyFieldObjectTypeTemplate:
		return model.PermissionLevelSysadmin
	case model.PropertyFieldObjectTypeChannel:
		return model.PermissionLevelAdmin
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

	// Create: no prior type, actions, or required state, so a rank field here is
	// authored directly and its ranks are validated strictly rather than
	// repaired, actions get the strict check with nothing to grandfather, and a
	// required=true channel field is rejected outright if the kill switch is on
	// (there is nothing to grandfather on a brand new field).
	if err := h.sanitizeAndValidateFieldAttrs(rctx, field, nil); err != nil {
		return nil, err
	}

	return h.enforceGroupPermissions(rctx, field, nil)
}

func (h *AccessControlAttributeValidationHook) PreUpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(groupID) {
		return field, nil
	}

	// Lenient grandfather: only validate Name against CEL rules when it
	// actually changes, so pre-existing fields whose names predate this
	// validation remain editable on all other attrs.
	existing, err := h.propertyService.getPropertyField(rctx, groupID, field.ID)
	if err != nil {
		return nil, err
	}
	if existing.Name != field.Name {
		if appErr := model.ValidateCPAFieldName(field.Name); appErr != nil {
			return nil, appErr
		}
	}

	if err := h.sanitizeAndValidateFieldAttrs(rctx, field, existing); err != nil {
		return nil, err
	}
	if err := h.validateSyncedOptionsOwnership(rctx, existing, field); err != nil {
		return nil, err
	}

	return h.enforceGroupPermissions(rctx, field, existing)
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
	existingFields, err := h.propertyService.getPropertyFields(rctx, groupID, fieldIDs)
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

		// existing is nil when the field isn't found (the store surfaces the
		// not-found error later): strict rank validation is the safe default
		// for that path, and a required channel field is rejected outright
		// rather than grandfathered.
		if err := h.sanitizeAndValidateFieldAttrs(rctx, field, existing); err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}
		if existing != nil {
			if err := h.validateSyncedOptionsOwnership(rctx, existing, field); err != nil {
				return nil, err
			}
		}

		updated, err := h.enforceGroupPermissions(rctx, field, existing)
		if err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}
		fields[i] = updated
	}

	return fields, nil
}

// optionsMissing checks that every one of optionIDs is in existing, returning
// an error naming the first one that is not. existing is normally the set of
// IDs one GetExistingOptionIDs call returned, covering every value in a batch
// that names options on the same field, so this itself never touches the
// store.
func optionsMissing(optionIDs []string, existing map[string]struct{}) error {
	for _, id := range optionIDs {
		if _, ok := existing[id]; !ok {
			return fmt.Errorf("option %q does not exist", id)
		}
	}
	return nil
}

// The options of a synced attribute belong to its sync: it provisions them
// from the identity source's values and prunes them once nobody holds them, so
// an option someone else adds, renames or removes is either undone by the next
// sync or, worse, becomes a value a policy can match that the source never
// reported. While a field is synced, only its own sync may change which options
// it has. Unlinking the field (dropping its ldap/saml attr) hands the options
// back in the same update.
//
// For a linked field the options are its template's, and the template carries
// the sync link it copies to the user fields linking to it, so the rule lands
// on the template -- where the options are edited.

// isFieldSync reports whether callerID is the sync that owns field's options.
func isFieldSync(field *model.PropertyField, callerID string) bool {
	return callerID != "" && callerID == model.PropertySyncCallerID(model.GetPropertyFieldSyncSource(field))
}

// isDefinitionSync reports whether callerID is the sync of field's definition:
// the field's own link, or, for a field linked to a template whose link it has
// no copy of, the template's. Attribute Management edits the template alone, so
// a user field created before the template was linked carries no copy, and the
// sync follows the template for it.
func (ps *PropertyService) isDefinitionSync(rctx request.CTX, field *model.PropertyField, callerID string) bool {
	if model.PropertySyncSourceForCallerID(callerID) == "" {
		return false
	}
	if model.IsPropertyFieldSynced(field) {
		return isFieldSync(field, callerID)
	}
	if field.LinkSourceID() == "" {
		return false
	}
	template, err := ps.getPropertyFieldFromMaster(rctx, field.GroupID, field.LinkSourceID())
	if err != nil {
		return false
	}
	return isFieldSync(template, callerID)
}

// syncedOptionsLockedError is an AppError so that its i18n key survives the
// HTTP layer's mapPropertyServiceError fallback.
func syncedOptionsLockedError(where string, field *model.PropertyField) *model.AppError {
	details := fmt.Sprintf("field %s: options of a synced field are managed by %s sync", field.ID, model.GetPropertyFieldSyncSource(field))
	return model.NewAppError(where, "app.property_field.synced_options_locked.app_error", nil, details, http.StatusForbidden)
}

// syncSourceUnlinkedError refuses a sync changing a field that is not synced
// from its source, such as one an admin unlinked while a sync job was running.
func syncSourceUnlinkedError(where string, field *model.PropertyField, source string) *model.AppError {
	details := fmt.Sprintf("field %s is not synced from %s", field.ID, source)
	return model.NewAppError(where, "app.property_field.sync_source_unlinked.app_error", nil, details, http.StatusConflict)
}

// validateSyncedOptionsOwnership applies the synced-options rule to a field
// write. The write states the whole option list, so it can be judged option by
// option: recoloring or reordering is allowed, adding, renaming or removing is
// not. It is judged on the incoming type, so converting a synced field to an
// option type cannot bring options in with the conversion.
func (h *AccessControlAttributeValidationHook) validateSyncedOptionsOwnership(rctx request.CTX, existing, field *model.PropertyField) error {
	if !field.Type.SupportsOptions() || !model.IsPropertyFieldSynced(existing) || !model.IsPropertyFieldSynced(field) ||
		isFieldSync(existing, h.propertyService.extractCallerID(rctx)) {
		return nil
	}

	before, err := optionNamesByID(existing)
	if err != nil {
		return fmt.Errorf("invalid existing options: %s: %w", err, ErrInvalidFieldAttrs)
	}
	after, err := optionNamesByID(field)
	if err != nil {
		return fmt.Errorf("invalid options: %s: %w", err, ErrInvalidFieldAttrs)
	}
	if maps.Equal(before, after) {
		return nil
	}
	return syncedOptionsLockedError("UpdatePropertyField", existing)
}

// PreChangePropertyFieldOptions applies the synced-options rule to the options
// endpoints. The change itself is not visible here, only the field, so every
// change is refused to anyone but the sync -- a recolor included; the field's
// option list, judged option by option above, is where that is done.
//
// A sync, in turn, changes only the options of a field synced from its own
// source: a field an admin unlinked while a sync job was running is the
// admin's again, options added since included.
func (h *AccessControlAttributeValidationHook) PreChangePropertyFieldOptions(rctx request.CTX, field *model.PropertyField) error {
	if field == nil || !h.isGroupManaged(field.GroupID) || !field.Type.SupportsOptions() {
		return nil
	}
	callerID := h.propertyService.extractCallerID(rctx)
	if isFieldSync(field, callerID) {
		return nil
	}
	if model.IsPropertyFieldSynced(field) {
		return syncedOptionsLockedError("PropertyFieldOptions", field)
	}
	if source := model.PropertySyncSourceForCallerID(callerID); source != "" {
		return syncSourceUnlinkedError("PropertyFieldOptions", field, source)
	}
	return nil
}

// optionNamesByID maps option ID to option name for a field, ignoring color
// and order. Returns an empty map for a field with no options.
func optionNamesByID(field *model.PropertyField) (map[string]string, error) {
	out := map[string]string{}
	if field.Attrs == nil {
		return out, nil
	}
	rawOptions, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok || rawOptions == nil {
		return out, nil
	}
	data, err := json.Marshal(rawOptions)
	if err != nil {
		return nil, err
	}
	var options []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(data, &options); err != nil {
		return nil, err
	}
	for _, opt := range options {
		out[opt.ID] = opt.Name
	}
	return out, nil
}

// validateValueAgainstField checks a property value against field-type
// constraints:
//   - text: max length, value_type format (email, url, phone)
//   - select, rank: option ID must exist in the field's options
//   - multiselect: all option IDs must exist
//   - graph: all option IDs must exist, and none may be repeated
//   - user: value must be a valid Mattermost ID
//   - multiuser: all values must be valid Mattermost IDs
//   - date: nothing
//
// Every field type the model allows has a case, and a type with none is refused
// outright. Access rules in these groups are written against the values this
// decides on, so a type falling through to "valid" would let anything at all be
// stored under it -- the wrong shape, or option identifiers naming no option --
// and every rule reading it would then decide from data nothing had checked.
//
// For an option-bearing type this does not itself check the options exist —
// it returns the option IDs the value names, and leaves that check to the
// caller. That lets validateValues batch the check into one store call per
// field instead of one per value: the store call queries the option rows
// rather than the option list inlined into field.Attrs, because a field with
// more than model.PropertyFieldMaxHydratedOptions options reads back without
// that list, and a check against the list cannot tell the absent list from a
// field that has no options.
func (h *AccessControlAttributeValidationHook) validateValueAgainstField(field *model.PropertyField, value *model.PropertyValue) ([]string, error) {
	switch field.Type {
	case model.PropertyFieldTypeText:
		var str string
		if err := json.Unmarshal(value.Value, &str); err != nil {
			return nil, fmt.Errorf("expected string value: %w", err)
		}
		if len(strings.TrimSpace(str)) > model.PropertyFieldValueTypeTextMaxLength {
			return nil, fmt.Errorf("text value exceeds maximum length of %d characters", model.PropertyFieldValueTypeTextMaxLength)
		}

		valueType := model.GetPropertyFieldValueType(field)
		if valueType == "" {
			return nil, nil
		}
		return nil, model.ValidatePropertyValueForValueType(valueType, value.Value)

	case model.PropertyFieldTypeSelect, model.PropertyFieldTypeRank:
		var str string
		if err := json.Unmarshal(value.Value, &str); err != nil {
			return nil, fmt.Errorf("expected string value for select field: %w", err)
		}
		if str == "" {
			return nil, nil
		}
		return []string{str}, nil

	case model.PropertyFieldTypeMultiselect:
		var values []string
		if err := json.Unmarshal(value.Value, &values); err != nil {
			return nil, fmt.Errorf("expected string array value for multiselect field: %w", err)
		}
		return values, nil

	case model.PropertyFieldTypeGraph:
		// The same shape as a multiselect value -- the options an object holds, in
		// no particular order -- and checked the same way, against the option rows.
		var values []string
		if err := json.Unmarshal(value.Value, &values); err != nil {
			return nil, fmt.Errorf("expected string array value for graph field: %w", err)
		}

		// Holding an option twice says nothing that holding it once does not, so a
		// repeat is a mistake in the caller rather than something to quietly
		// discard. Refused here and not for multiselect, where a repeat has always
		// been accepted and refusing one now would reject values callers already
		// send.
		seen := make(map[string]bool, len(values))
		for _, v := range values {
			if seen[v] {
				return nil, fmt.Errorf("option %q is listed more than once", v)
			}
			seen[v] = true
		}
		return values, nil

	case model.PropertyFieldTypeUser:
		var str string
		if err := json.Unmarshal(value.Value, &str); err != nil {
			return nil, fmt.Errorf("expected string value for user field: %w", err)
		}
		if str != "" && !model.IsValidId(str) {
			return nil, fmt.Errorf("invalid user id")
		}

	case model.PropertyFieldTypeMultiuser:
		var values []string
		if err := json.Unmarshal(value.Value, &values); err != nil {
			return nil, fmt.Errorf("expected string array value for multiuser field: %w", err)
		}
		for _, v := range values {
			if !model.IsValidId(v) {
				return nil, fmt.Errorf("invalid user id: %s", v)
			}
		}

	case model.PropertyFieldTypeDate:
		// Nothing to check. A date value's shape has never been constrained here,
		// and constraining it now would refuse values already stored. Listed so
		// that the case below is only reached by a type nobody has considered.

	default:
		return nil, fmt.Errorf("values of a %s field are not validated, so none may be written", field.Type)
	}

	return nil, nil
}

// refuseDirectChannelValueWrite refuses a write to a channel-object value whose
// target is a DM or GM unless the caller holds PermissionManageSystem or is a
// machine actor. These values are meant to be derived from the participants'
// own attributes rather than typed in, so participation alone does not earn the
// write at any permission tier.
//
// Who passes, and why:
//
//   - callers with PermissionManageSystem -- sysadmins, and local-mode admins
//     via the CallerIDLocalAdmin short-circuit inside permissionChecker.
//   - machine actors: an installed plugin, or an LDAP/SAML sync service. These
//     are the derivation path the rule reserves the write for.
//
// Everyone else is refused, including a participant of the DM or GM itself. An
// untagged caller (empty caller ID) is refused too, failing closed.
//
// Ordering matters for cost: the caller checks come first, so a plugin or a
// sysadmin pays no channel lookup and only an ordinary user triggers one.
// Targets are deduped because a batch upsert normally addresses one channel.
func (h *AccessControlAttributeValidationHook) refuseDirectChannelValueWrite(rctx request.CTX, values []*model.PropertyValue) error {
	if h.directChannelChecker == nil {
		return nil
	}

	callerID := h.propertyService.extractCallerID(rctx)
	if isMachineCaller(h.pluginChecker, callerID) {
		return nil
	}
	if callerID != "" && h.permissionChecker != nil &&
		h.permissionChecker(rctx, callerID, model.PermissionManageSystem) {
		return nil
	}

	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if value.TargetType != model.PropertyValueTargetTypeChannel {
			continue
		}
		if _, dup := seen[value.TargetID]; dup {
			continue
		}
		seen[value.TargetID] = struct{}{}

		isDirect, err := h.directChannelChecker(rctx, value.TargetID)
		if err != nil {
			return fmt.Errorf("failed to resolve channel %s for the direct-channel value check: %w", value.TargetID, err)
		}
		if isDirect {
			return newDirectChannelValueError(value.TargetID)
		}
	}

	return nil
}

// refuseMisaddressedUpdate refuses an update whose ID names a row of another group, field or
// target than the value states. The store matches rows by ID alone, while every check here reads
// the stated field's rules, so a plugin could otherwise overwrite a write-once value by naming a
// mutable field, or by stating an unmanaged group that validateValues then skips. An empty
// groupID is covered too: the store's update drops its group filter then, so it can reach a row
// of any group. An ID with no row is left to the store, which fails it as not found.
func (h *AccessControlAttributeValidationHook) refuseMisaddressedUpdate(rctx request.CTX, groupID string, values []*model.PropertyValue) error {
	// An empty ID list would search the whole group.
	if len(values) == 0 || (groupID != "" && !h.isGroupManaged(groupID)) {
		return nil
	}

	ids := make([]string, 0, len(values))
	for _, v := range values {
		ids = append(ids, v.ID)
	}
	rows, err := h.propertyService.searchPropertyValues(store.RequestContextWithMaster(rctx), groupID, model.PropertyValueSearchOpts{IDs: ids, IncludeDeleted: true, PerPage: len(ids)})
	if err != nil {
		return fmt.Errorf("failed to read the rows named by the update: %w", err)
	}
	rowByID := make(map[string]*model.PropertyValue, len(rows))
	for _, row := range rows {
		rowByID[row.ID] = row
	}
	for _, v := range values {
		row, ok := rowByID[v.ID]
		if ok && (row.GroupID != v.GroupID || row.FieldID != v.FieldID || row.TargetID != v.TargetID || row.TargetType != v.TargetType) {
			return fmt.Errorf("value %s: names a row of another group, field or target: %w", v.ID, ErrInvalidValue)
		}
	}
	return nil
}

func (h *AccessControlAttributeValidationHook) validateValues(rctx request.CTX, values []*model.PropertyValue) error {
	if len(values) == 0 {
		return nil
	}

	groupID := values[0].GroupID
	if !h.isGroupManaged(groupID) {
		return nil
	}
	callerID := h.propertyService.extractCallerID(rctx)

	// Authorization precedes validation, and refusing here avoids the field
	// round trip below.
	if err := h.refuseDirectChannelValueWrite(rctx, values); err != nil {
		return err
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

	fields, err := h.propertyService.getPropertyFields(rctx, groupID, fieldIDs)
	if err != nil {
		return fmt.Errorf("failed to fetch fields for validation: %w", err)
	}

	fieldMap := make(map[string]*model.PropertyField, len(fields))
	for _, f := range fields {
		fieldMap[f.ID] = f
	}

	// A value whose field is option-bearing names option IDs to check against the
	// store; held here rather than checked immediately so every value against the
	// same field can be checked with one store call instead of one each.
	type namedOptions struct {
		fieldID   string
		optionIDs []string
	}
	var pending []namedOptions

	neededByField := make(map[string][]string)
	seenByField := make(map[string]map[string]struct{})

	for _, value := range values {
		field, ok := fieldMap[value.FieldID]
		if !ok {
			return fmt.Errorf("field %s: %w", value.FieldID, ErrFieldNotFound)
		}
		optionIDs, err := h.validateValueAgainstField(field, value)
		if err != nil {
			return fmt.Errorf("field %s: %s: %w", value.FieldID, err.Error(), ErrInvalidValue)
		}
		// The kill switch is scoped to channel attributes: a required field on any
		// other object type (post, user) stays enforced regardless of the flag.
		// The field's own sync may still clear it: the source decides the value,
		// including that there is none, and a value it no longer reports must not
		// stay behind to satisfy an access policy.
		if (field.ObjectType != model.PropertyFieldObjectTypeChannel || h.requiredEnforced()) &&
			model.IsPropertyFieldRequired(field) && model.IsEmptyPropertyValue(value.Value) &&
			!h.propertyService.isDefinitionSync(rctx, field, callerID) {
			return newRequiredValueError(field)
		}
		if len(optionIDs) == 0 {
			continue
		}
		pending = append(pending, namedOptions{fieldID: value.FieldID, optionIDs: optionIDs})

		seen, ok := seenByField[value.FieldID]
		if !ok {
			seen = make(map[string]struct{})
			seenByField[value.FieldID] = seen
		}
		for _, id := range optionIDs {
			if _, dup := seen[id]; dup {
				continue
			}
			seen[id] = struct{}{}
			neededByField[value.FieldID] = append(neededByField[value.FieldID], id)
		}
	}

	existingByField := make(map[string]map[string]struct{}, len(neededByField))
	for fieldID, optionIDs := range neededByField {
		existing, err := h.propertyService.fieldStore.GetExistingOptionIDs(fieldMap[fieldID], optionIDs)
		if err != nil {
			return fmt.Errorf("failed to look up the options of field %s: %w", fieldID, err)
		}
		existingSet := make(map[string]struct{}, len(existing))
		for _, id := range existing {
			existingSet[id] = struct{}{}
		}
		existingByField[fieldID] = existingSet
	}

	for _, p := range pending {
		if err := optionsMissing(p.optionIDs, existingByField[p.fieldID]); err != nil {
			return fmt.Errorf("field %s: %s: %w", p.fieldID, err.Error(), ErrInvalidValue)
		}
	}

	return h.enforceBounds(rctx, values, fieldMap)
}

// newDirectChannelValueError returns the refusal for a hand-written DM/GM
// channel attribute value.
func newDirectChannelValueError(channelID string) error {
	details := fmt.Sprintf("channel %s: direct and group channel attribute values are derived, not set", channelID)
	return model.NewAppError("UpsertPropertyValues", "app.property_value.direct_channel.app_error", nil, details, http.StatusForbidden)
}

// newRequiredValueError returns the refusal for writing or deleting an empty
// value on a required field.
func newRequiredValueError(field *model.PropertyField) error {
	details := fmt.Sprintf("field %s: value is required", field.ID)
	return model.NewAppError("UpsertPropertyValues", "app.property_value.required.app_error", nil, details, http.StatusBadRequest)
}

// newRequiredAttrDisabledError returns the refusal for newly marking a channel
// field required while required-attribute enforcement is disabled: nothing
// would enforce it, and an admin authoring it now would reasonably expect the
// opposite.
// validateSyncSources applies the rules on which identity sources may sync a
// field. An OpenID Connect link is exclusive: OpenID Connect users never pass
// through the AD/LDAP or SAML sync, so under the AD/LDAP-first precedence a
// field also linked to one of those would be locked against the OpenID Connect
// sync and never written for its users. AD/LDAP plus SAML stays allowed.
//
// While the OpenIdAttributeSync kill switch is engaged, an openid link may not
// be added or changed. One that predates the switch rides along untouched, so
// the field stays editable on every other attr, and removing it is allowed.
func (h *AccessControlAttributeValidationHook) validateSyncSources(field, existing *model.PropertyField) error {
	sources := model.GetPropertyFieldSyncSources(field)
	if slices.Contains(sources, model.PropertySyncSourceOpenID) && len(sources) > 1 {
		details := fmt.Sprintf("field %s: an openid link cannot be combined with an ldap or saml link", field.ID)
		return model.NewAppError("UpsertPropertyField", "app.property_field.sync_source_exclusive.app_error", nil, details, http.StatusBadRequest)
	}

	claim, _ := field.Attrs[model.PropertyFieldAttrOpenID].(string)
	var prevClaim string
	if existing != nil {
		prevClaim, _ = existing.Attrs[model.PropertyFieldAttrOpenID].(string)
	}
	if claim != "" && claim != prevClaim && !h.openIDAttributeSyncEnabled() {
		details := fmt.Sprintf("field %s: cannot link to an OpenID Connect claim while OpenID Connect attribute sync is disabled", field.ID)
		return model.NewAppError("UpsertPropertyField", "app.property_field.openid_sync_disabled.app_error", nil, details, http.StatusBadRequest)
	}
	return nil
}

// refuseSetOnCreate refuses a field whose mutability is set_on_create, flag on or
// off: that lock allows a write only from the request that creates the object, and
// no write path checks that, so a field must not carry a lock that isn't enforced.
// TODO: remove once writes enforce set_on_create.
func refuseSetOnCreate(field *model.PropertyField) error {
	if field.Mutability != model.PropertyFieldMutabilitySetOnCreate {
		return nil
	}
	details := fmt.Sprintf("field %s: set_on_create mutability is not supported yet", field.ID)
	return model.NewAppError("UpsertPropertyField", "app.property_field.set_on_create_unsupported.app_error", nil, details, http.StatusBadRequest)
}

// changePolicyDeprecatedMessage is logged for every write of the old keys.
const changePolicyDeprecatedMessage = "change_policy and editable are deprecated; set mutability and bounds instead"

// oldPolicyKeysWritten lists the old keys field carries that differ from the
// stored field's, so a save echoing what it was shown writes none. change_policy
// "any" and editable=true mean the same as absent and don't count.
func oldPolicyKeysWritten(field, existing *model.PropertyField) []string {
	changed := func(key string) bool {
		return existing == nil || !reflect.DeepEqual(field.Attrs[key], existing.Attrs[key])
	}
	var keys []string
	if p := field.Attrs[model.PropertyFieldAttrChangePolicy]; p != nil && p != "" && p != model.PropertyFieldChangePolicyAny &&
		changed(model.PropertyFieldAttrChangePolicy) {
		keys = append(keys, model.PropertyFieldAttrChangePolicy)
	}
	if field.Attrs[model.PropertyFieldAttrEditable] == false && changed(model.PropertyFieldAttrEditable) {
		keys = append(keys, model.PropertyFieldAttrEditable)
	}
	return keys
}

// dropOldPolicyKeys removes change_policy and editable=false from a field they
// don't apply to. editable=true stays: it means the same as absent, and content
// flagging sets it on its own fields.
func dropOldPolicyKeys(field *model.PropertyField) {
	delete(field.Attrs, model.PropertyFieldAttrChangePolicy)
	if editable, ok := field.Attrs[model.PropertyFieldAttrEditable].(bool); ok && !editable {
		delete(field.Attrs, model.PropertyFieldAttrEditable)
	}
}

// warnOldPolicyKeys logs a write of the old keys, so integrations still using
// them can be found. Nothing is logged for no keys.
func (ps *PropertyService) warnOldPolicyKeys(rctx request.CTX, field *model.PropertyField, keys []string) {
	if len(keys) == 0 {
		return
	}
	rctx.Logger().Warn(changePolicyDeprecatedMessage,
		mlog.String("caller_id", ps.extractCallerID(rctx)),
		mlog.String("field_id", field.ID),
		mlog.String("group_id", field.GroupID),
		mlog.String("keys", strings.Join(keys, ",")),
	)
}

// changePolicyBaseline returns the mutability and bounds a save is judged
// against: the stored field's, or for a channel field locked only by its old
// change_policy (the startup conversion hasn't reached it yet) that policy
// translated. On create it is mutable with no rules.
func changePolicyBaseline(existing *model.PropertyField) (model.PropertyFieldMutability, model.PropertyBounds) {
	if existing == nil {
		return model.PropertyFieldMutabilityMutable, nil
	}
	mutability, bounds := existing.Mutability.OrMutable(), existing.Bounds
	if existing.ObjectType != model.PropertyFieldObjectTypeChannel ||
		model.PropertyFieldChangePolicyFromSettings(mutability, bounds) != model.PropertyFieldChangePolicyAny {
		return mutability, bounds
	}
	if m, b, err := model.PropertyFieldSettingsFromChangePolicy(model.GetPropertyFieldChangePolicy(existing), bounds); err == nil {
		return m, b
	}
	return mutability, bounds
}

// translateChangePolicy settles a channel field's mutability and bounds from the
// old change_policy / editable keys, then rewrites the old keys from the result so
// they always match (v2 readers, mobile and a rolled-back server read them). Only
// channel fields translate: change_policy was never enforced on others. It reports
// whether the save is an old-format write, one whose old policy differs from the
// stored field's. That write sets the settings from the policy; any other save
// keeps the settings it states, with unstated ones (mutability "", bounds nil)
// taken from the baseline. A caller sending back the policy it was shown is not
// using the old format, and nor is one whose attrs carry neither old key
// (statesPolicy false): every locked field's attrs carry the keys the server
// derived, so a whole-object update that rebuilds attrs without them would
// otherwise unlock a field it never meant to. Like an omitted mutability, an
// omitted key is not an unlock; change_policy "any" or editable=true is.
func translateChangePolicy(field, existing *model.PropertyField, statesPolicy bool) (bool, error) {
	if field.ObjectType != model.PropertyFieldObjectTypeChannel {
		return false, nil
	}

	policy := model.GetPropertyFieldChangePolicy(field)
	oldFormatWrite := statesPolicy && (existing == nil && policy != model.PropertyFieldChangePolicyAny ||
		existing != nil && policy != model.GetPropertyFieldChangePolicy(existing))

	mutability, bounds := field.Mutability, field.Bounds
	baseMutability, baseBounds := changePolicyBaseline(existing)
	if mutability == "" {
		mutability = baseMutability
	}
	if bounds == nil {
		bounds = baseBounds
	}
	if oldFormatWrite {
		if !model.PropertyFieldChangePolicyDescribes(baseMutability, baseBounds) {
			details := fmt.Sprintf("field %s: its rules can't be expressed with change_policy", field.ID)
			return false, model.NewAppError("UpsertPropertyField", "app.property_field.change_policy_unsupported.app_error", nil, details, http.StatusBadRequest)
		}
		var err error
		if mutability, bounds, err = model.PropertyFieldSettingsFromChangePolicy(policy, bounds); err != nil {
			return false, fmt.Errorf("%s: %w", err.Error(), ErrInvalidFieldAttrs)
		}
		if changePolicyConflicts(field, existing, mutability, bounds) {
			details := fmt.Sprintf("field %s: change_policy disagrees with the mutability or bounds in the same request", field.ID)
			return false, model.NewAppError("UpsertPropertyField", "app.property_field.change_policy_conflict.app_error", nil, details, http.StatusBadRequest)
		}
	}

	// Mutable and no rules stay unstated, as the update path refills them from the
	// stored field. An old-format write states them: that is how it unlocks.
	if oldFormatWrite || mutability != model.PropertyFieldMutabilityMutable {
		field.Mutability = mutability
	}
	if oldFormatWrite || (field.Bounds == nil && len(bounds) > 0) {
		field.Bounds = bounds
	}
	field.Attrs = model.SetPropertyFieldChangePolicyAttrs(field.Attrs, model.PropertyFieldChangePolicyFromSettings(mutability, bounds))
	return oldFormatWrite, nil
}

// changePolicyConflicts reports whether an old-format write also changes
// mutability or the self rules to something its change_policy doesn't translate
// to. Changed is judged against the stored field, so an echo of it is not a
// change; on create anything stated is.
func changePolicyConflicts(field, existing *model.PropertyField, translatedMutability model.PropertyFieldMutability, translatedBounds model.PropertyBounds) bool {
	var storedBounds model.PropertyBounds
	storedMutability := model.PropertyFieldMutabilityMutable
	if existing != nil {
		storedMutability, storedBounds = existing.Mutability.OrMutable(), existing.Bounds
	}
	changesMutability := field.Mutability != "" &&
		(existing == nil || field.Mutability.OrMutable() != storedMutability)
	if changesMutability && field.Mutability.OrMutable() != translatedMutability {
		return true
	}
	if field.Bounds != nil && !model.PropertyBoundsEqual(selfRules(field.Bounds), selfRules(storedBounds)) {
		return !model.PropertyBoundsEqual(selfRules(field.Bounds), selfRules(translatedBounds))
	}
	return false
}

func selfRules(bounds model.PropertyBounds) model.PropertyBounds {
	var out model.PropertyBounds
	for _, r := range bounds {
		if r.Reference == model.PropertyBoundsReferenceSelf {
			out = append(out, r)
		}
	}
	return out
}

// validateBoundsChange refuses a new bounds rule, or a mutability that newly
// becomes write_once, judged against changePolicyBaseline. With the
// PropertyFieldBounds flag off it is refused whatever the license, except what an
// old-format write's translation adds (a self rule or write_once): that carries
// the existing change_policy feature over and needs only the license. A parent
// rule saved beside change_policy is still refused. With the flag on it is
// refused unless the server is licensed for Enterprise Advanced. Rules and locks
// already on the field ride along, and removing them is always allowed. Unstated
// bounds (nil) and mutability ("") add nothing; the update path fills them in
// from the stored field. This hook manages only the access_control group, the one
// v3 group that can carry bounds, so every field that can gain them passes
// through here.
func (h *AccessControlAttributeValidationHook) validateBoundsChange(field, existing *model.PropertyField, oldFormatWrite bool) error {
	prevMutability, prevBounds := changePolicyBaseline(existing)

	// adding is the first thing the write adds, which the license check names;
	// flagGated is the first of those the flag also refuses, so it skips the self
	// rules and write_once that an old-format write's translation adds.
	var adding, flagGated string
	for _, rule := range field.Bounds {
		if slices.Contains(prevBounds, rule) {
			continue
		}
		desc := fmt.Sprintf("add the bounds rule %s %s", rule.Operator, rule.Reference)
		if adding == "" {
			adding = desc
		}
		if flagGated == "" && (!oldFormatWrite || rule.Reference != model.PropertyBoundsReferenceSelf) {
			flagGated = desc
		}
	}
	if field.Mutability == model.PropertyFieldMutabilityWriteOnce && prevMutability != field.Mutability {
		desc := fmt.Sprintf("make the field %s", field.Mutability)
		if adding == "" {
			adding = desc
		}
		if flagGated == "" && !oldFormatWrite {
			flagGated = desc
		}
	}
	if adding == "" {
		return nil
	}

	if flagGated != "" && !h.propertyFieldBoundsEnabled() {
		details := fmt.Sprintf("field %s: cannot %s while the PropertyFieldBounds feature flag is off", field.ID, flagGated)
		return model.NewAppError("UpsertPropertyField", "app.property_field.bounds_disabled.app_error", nil, details, http.StatusBadRequest)
	}
	if !h.propertyService.boundsEnforced() {
		details := fmt.Sprintf("field %s: cannot %s without an Enterprise Advanced license", field.ID, adding)
		return model.NewAppError("UpsertPropertyField", "app.property_field.bounds_license.app_error", nil, details, http.StatusNotImplemented)
	}
	return nil
}

func newRequiredAttrDisabledError(field *model.PropertyField) error {
	details := fmt.Sprintf("field %s: cannot mark required while required-attribute enforcement is disabled", field.ID)
	return model.NewAppError("UpsertPropertyField", "app.property_field.required_disabled.app_error", nil, details, http.StatusBadRequest)
}

// getValuesForTarget loads every value stored against one target, paging with
// the same bounds as the access-control lookups.
func (h *AccessControlAttributeValidationHook) getValuesForTarget(rctx request.CTX, groupID, targetType, targetID string) ([]*model.PropertyValue, error) {
	allValues := []*model.PropertyValue{}
	var cursor model.PropertyValueSearchCursor

	for iterations := 0; ; iterations++ {
		if iterations >= propertyAccessMaxPaginationIterations {
			return nil, fmt.Errorf("exceeded maximum pagination iterations (%d)", propertyAccessMaxPaginationIterations)
		}

		opts := model.PropertyValueSearchOpts{
			TargetType: targetType,
			TargetIDs:  []string{targetID},
			PerPage:    propertyAccessPaginationPageSize,
		}
		if !cursor.IsEmpty() {
			opts.Cursor = cursor
		}

		values, err := h.propertyService.searchPropertyValues(rctx, groupID, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to load existing values for target %s: %w", targetID, err)
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

func (h *AccessControlAttributeValidationHook) PreUpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validateValues(rctx, []*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AccessControlAttributeValidationHook) PreUpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validateValues(rctx, values); err != nil {
		return nil, err
	}
	return values, nil
}

func (h *AccessControlAttributeValidationHook) PreCreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validateValues(rctx, []*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AccessControlAttributeValidationHook) PreCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validateValues(rctx, values); err != nil {
		return nil, err
	}
	return values, nil
}

func (h *AccessControlAttributeValidationHook) PreUpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.refuseMisaddressedUpdate(rctx, groupID, []*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	if err := h.validateValues(rctx, []*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *AccessControlAttributeValidationHook) PreUpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.refuseMisaddressedUpdate(rctx, groupID, values); err != nil {
		return nil, err
	}
	if err := h.validateValues(rctx, values); err != nil {
		return nil, err
	}
	return values, nil
}

// PreDeletePropertyValue closes the gap a literal delete would otherwise leave in
// mutability and bounds: a delete is indistinguishable from a clear, which a
// locked field already refuses on the upsert path. Without this, deleting a
// locked value and writing a fresh one would launder it past its rules.
//
// A delete naming no group (plugins pass "") is judged by the row's own group.
func (h *AccessControlAttributeValidationHook) PreDeletePropertyValue(rctx request.CTX, groupID string, id string) error {
	if groupID != "" && !h.isGroupManaged(groupID) {
		return nil
	}

	// Read from master: a replica error or lag must not let a locked value be deleted.
	master := store.RequestContextWithMaster(rctx)
	rows, err := h.propertyService.searchPropertyValues(master, groupID, model.PropertyValueSearchOpts{IDs: []string{id}, PerPage: 1})
	if err != nil {
		return fmt.Errorf("failed to read value %s before deleting it: %w", id, err)
	}
	// Nothing to enforce against a value that cannot be found; the delete
	// itself will fail downstream with the appropriate not-found error.
	if len(rows) == 0 {
		return nil
	}
	value := rows[0]
	groupID = value.GroupID
	if !h.isGroupManaged(groupID) {
		return nil
	}

	// A delete is a clear, so a participant must not be able to use it to strip
	// a DM/GM marking that they could not have written in the first place.
	if dcErr := h.refuseDirectChannelValueWrite(rctx, []*model.PropertyValue{value}); dcErr != nil {
		return dcErr
	}
	if err := h.refuseRequiredDelete(rctx, groupID, []*model.PropertyValue{value}); err != nil {
		return err
	}
	// Last, so a bounds_not_enforced audit record only follows a delete nothing else refused.
	// A null row is refused too: a by-ID delete can't be made conditional on the value, so
	// letting a null row go would let it race a first write and make a second "first" write possible.
	return h.refuseLockedFieldClear(master, groupID, value.FieldID, value)
}

// PreDeletePropertyValuesForField refuses wiping every value of a field that refuses clears. It
// is a bulk clear that can't be made conditional on each value, so it is refused whether or not
// any value is set. With no group named it is judged by the field's own group.
func (h *AccessControlAttributeValidationHook) PreDeletePropertyValuesForField(rctx request.CTX, groupID string, fieldID string) error {
	master := store.RequestContextWithMaster(rctx)
	if groupID == "" {
		fields, err := h.propertyService.getPropertyFields(master, "", []string{fieldID})
		if errors.Is(err, ErrFieldNotFound) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("failed to read field %s before clearing its values: %w", fieldID, err)
		}
		groupID = fields[0].GroupID
	}
	if !h.isGroupManaged(groupID) {
		return nil
	}
	return h.refuseLockedFieldClear(master, groupID, fieldID, nil)
}

// PreDeletePropertyValuesForTarget covers the same gap for a target-wide delete
// (e.g. via the plugin API). Locked values are protected for every target type; the
// required check applies as it does on the value write path.
//
// With no group named, every managed group is checked, since the delete reaches all of them.
func (h *AccessControlAttributeValidationHook) PreDeletePropertyValuesForTarget(rctx request.CTX, groupID string, targetType string, targetID string) error {
	if groupID != "" {
		if !h.isGroupManaged(groupID) {
			return nil
		}
		return h.preDeleteValuesForTargetInGroup(rctx, groupID, targetType, targetID)
	}
	// Sorted so that which refusal a caller sees doesn't depend on map order.
	for _, g := range slices.Sorted(maps.Keys(h.managedGroupIDs)) {
		if err := h.preDeleteValuesForTargetInGroup(rctx, g, targetType, targetID); err != nil {
			return err
		}
	}
	return nil
}

func (h *AccessControlAttributeValidationHook) preDeleteValuesForTargetInGroup(rctx request.CTX, groupID string, targetType string, targetID string) error {
	if targetType != model.PropertyValueTargetTypeChannel {
		return h.refuseLockedTargetDelete(rctx, groupID, targetType, targetID)
	}
	// Checked against a synthetic value so a refusal costs no value load; the
	// rule only reads TargetType and TargetID.
	if err := h.refuseDirectChannelValueWrite(rctx, []*model.PropertyValue{{
		TargetType: targetType,
		TargetID:   targetID,
	}}); err != nil {
		return err
	}
	values, err := h.getValuesForTarget(rctx, groupID, targetType, targetID)
	if err != nil {
		return err
	}
	if err := h.refuseRequiredDelete(rctx, groupID, values); err != nil {
		return err
	}
	// Last, so a bounds_not_enforced audit record only follows a delete nothing else refused.
	return h.refuseLockedTargetDelete(rctx, groupID, targetType, targetID)
}

// refuseRequiredDelete refuses to delete any set value of a required field. A locked
// field's value is refused afterwards, by refuseLockedFieldClear and refuseLockedTargetDelete.
func (h *AccessControlAttributeValidationHook) refuseRequiredDelete(rctx request.CTX, groupID string, values []*model.PropertyValue) error {
	if !h.isGroupManaged(groupID) {
		return nil
	}

	setValues := make([]*model.PropertyValue, 0, len(values))
	for _, v := range values {
		if !model.IsEmptyPropertyValue(v.Value) {
			setValues = append(setValues, v)
		}
	}
	if len(setValues) == 0 {
		return nil
	}

	fieldIDSet := make(map[string]struct{})
	for _, v := range setValues {
		fieldIDSet[v.FieldID] = struct{}{}
	}
	fieldIDs := make([]string, 0, len(fieldIDSet))
	for id := range fieldIDSet {
		fieldIDs = append(fieldIDs, id)
	}

	fields, err := h.propertyService.getPropertyFields(rctx, groupID, fieldIDs)
	if err != nil {
		return fmt.Errorf("failed to fetch fields for delete validation: %w", err)
	}
	fieldMap := make(map[string]*model.PropertyField, len(fields))
	for _, f := range fields {
		fieldMap[f.ID] = f
	}

	for _, v := range setValues {
		field, ok := fieldMap[v.FieldID]
		if !ok {
			continue
		}
		// Required is enforced for every target type, matching the write path
		// in validateValues. The kill switch is scoped to channel attributes: a
		// required post/user field stays enforced regardless of the flag.
		if (field.ObjectType != model.PropertyFieldObjectTypeChannel || h.requiredEnforced()) &&
			model.IsPropertyFieldRequired(field) {
			return newRequiredValueError(field)
		}
	}

	return nil
}
