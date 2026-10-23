// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"maps"
	"slices"
)

// LegacyConversionOpts controls how PermissionsFromLegacy reads a field's
// legacy permission columns and Attrs.
type LegacyConversionOpts struct {
	// ConvertAttrs is true only for the access_control group. Only there were
	// the protected flag and access_mode attrs ever enforced, so only there is
	// there anything to preserve when converting them; everywhere else those
	// settings have never gated anything, and a wildcard plugin grant keeps the
	// access every plugin had.
	ConvertAttrs bool
	// Template is the linked field's template, when the field being converted
	// is linked to one. Its option.read tier caps the converted field's own,
	// since a linked field's option.read reads the template's option scheme
	// rather than its own.
	Template *Permissions
}

// PermissionsFromLegacy converts a field's legacy permission columns, and (for
// an access_control field) its Attrs-based protected/access_mode settings,
// into a normalized Permissions object: Restrictions, Grants, and Masking.
func PermissionsFromLegacy(field *PropertyField, opts LegacyConversionOpts) *Permissions {
	restrictions := &Restrictions{
		Field:  WriteOnly{Write: permissionLevelOrNone(field.PermissionField)},
		Option: ReadWrite{Write: permissionLevelOrNone(field.PermissionOptions)},
		Value:  ReadWrite{Write: permissionLevelOrNone(field.PermissionValues)},
	}

	if !opts.ConvertAttrs {
		// Reads in every other group were never gated by anything; the omitted-leaf
		// default of none would take away access every caller has today.
		restrictions.Value.Read = PermissionLevelEveryone
		restrictions.Option.Read = PermissionLevelEveryone
	} else {
		switch LegacyAccessMode(field) {
		case PropertyAccessModePublic:
			restrictions.Value.Read = PermissionLevelEveryone
			restrictions.Option.Read = PermissionLevelEveryone
		case PropertyAccessModeSharedOnly:
			// The read is allowed here and then narrowed by masking (added once its
			// holdings field is resolved) to what the caller holds. Denying the read
			// here would deny the read the filter is meant to narrow.
			restrictions.Value.Read = PermissionLevelEveryone
			restrictions.Option.Read = PermissionLevelEveryone
		default:
			// source_only, or an access_mode this build does not recognize: only the
			// source plugin reads such a field today (its grant is added separately),
			// so this cannot be read as public without widening a field somebody
			// deliberately restricted.
			restrictions.Value.Read = PermissionLevelNone
			restrictions.Option.Read = PermissionLevelNone
		}
	}

	if field.Protected {
		// The legacy human decision refuses field.write outright on a protected
		// field before it ever reads PermissionField, for every group.
		restrictions.Field.Write = PermissionLevelNone
	}
	if opts.ConvertAttrs && (HasPropertyFieldOwners(field) || IsPropertyFieldProtected(field) || syncLockSource(field) != "") {
		// The converted restriction refuses every human on an owner-managed,
		// protected, or synced field before it ever reads PermissionValues;
		// converting that column's level instead would hand those values to
		// members. A grant can still restore write access for a specific
		// identity (e.g. the sync source itself, or a field's own owner),
		// since the model is grant-only and a grant always beats a restriction.
		restrictions.Value.Write = PermissionLevelNone
	}
	if opts.ConvertAttrs && IsPropertyFieldProtected(field) {
		// The legacy hook refused every caller but the source plugin a field
		// write on a protected field, sysadmins included, and gated its options
		// the same way; only the source plugin's grant passes either.
		restrictions.Field.Write = PermissionLevelNone
		restrictions.Option.Write = PermissionLevelNone
	}

	if opts.Template != nil {
		// A linked field's option.read reads the template's option scheme, and the
		// property service refuses a linked field above its template's tier on
		// every write, the backfill's own write included.
		templateOptionRead := opts.Template.Restrictions.TierFor(PropertyActionOptionRead)
		if !restrictions.Option.Read.AtMostAsPermissiveAs(templateOptionRead) {
			restrictions.Option.Read = templateOptionRead
		}
	}

	masking := maskingFromLegacy(field, restrictions, opts)

	var grants []Grant
	if opts.ConvertAttrs {
		// Owners, the source plugin ID and the sync lock are all read from Attrs,
		// so they convert only where Attrs were ever enforced.
		grants = grantsFromLegacy(field)
	} else {
		// No access check ever ran between a plugin and a field outside
		// access_control, so any plugin could act on it. The wildcard keeps that
		// access, now visible on the field and revocable.
		grants = []Grant{{
			Identity: Identity{Type: PropertyOwnerTypePlugin, ID: "*"},
			Allow:    unguardedGroupPluginAllow(field),
		}}
	}
	if opts.Template != nil {
		// A linked field's grant over option.read is read access to the template's
		// own scheme, never a right the identity held over the linked field itself
		// (PropertyField.IsValid refuses such a grant outright), so the converted
		// grants must not carry it.
		for i := range grants {
			grants[i].Allow = removeAction(grants[i].Allow, PropertyActionOptionRead)
		}
		// A grant that only carried option.read now allows nothing, which
		// Grant.isValid rejects.
		grants = slices.DeleteFunc(grants, func(g Grant) bool { return len(g.Allow) == 0 })
	}

	return &Permissions{
		Restrictions: restrictions,
		Grants:       grants,
		Masking:      masking,
	}
}

// ProjectLegacyPermissions returns a copy of field with its legacy permission
// columns and Attrs populated from field.Permissions, so a v2 caller keeps
// reading a field whose access is decided from permissions alone. Returns
// field unchanged when Permissions is nil — there is nothing to project. Never
// mutates field or its Attrs map.
//
// It aims to show a v2 caller the field it had before conversion, and is not
// a lossless inverse of PermissionsFromLegacy for an object written through
// v3. Owners are projected from grants, leaving out the plugin wildcard (v2
// has no owner meaning "any plugin", and expresses that access by listing no
// owners at all) and the grants the conversion derives from the field's other
// attrs (see ownersFromGrants). A user or role owner converts to no grant, so
// it is carried over from the stored owners attr instead (see
// appendHumanOwners). It is carried over even after a v3 edit has changed what
// the field allows, say by opening value.write to members, so in the v2 view
// it can go stale, as the stored attrs already do. field.write none becomes
// protected, except that a field
// whose stored attrs mark it protected, and whose Protected column isn't set,
// projects the unprotected, sysadmin-pinned columns access_control stores for
// it, and carries the protection in the attr.
func ProjectLegacyPermissions(field *PropertyField) *PropertyField {
	return ProjectLegacyPermissionsWithTemplate(field, nil)
}

// ProjectLegacyPermissionsWithTemplate is ProjectLegacyPermissions with
// access_mode taken from EffectiveAccessMode, so a linked field reports its
// template's mode. template is nil when field isn't linked or its template
// couldn't be read.
func ProjectLegacyPermissionsWithTemplate(field, template *PropertyField) *PropertyField {
	if field.Permissions == nil {
		return field
	}

	projected := *field
	projected.Attrs = maps.Clone(field.Attrs)
	if projected.Attrs == nil {
		projected.Attrs = StringInterface{}
	}

	restrictions := field.Permissions.Restrictions
	fieldWrite := restrictions.TierFor(PropertyActionFieldWrite)
	valueWrite := restrictions.TierFor(PropertyActionValueWrite)
	optionWrite := restrictions.TierFor(PropertyActionOptionWrite)
	projected.PermissionField = &fieldWrite
	projected.PermissionValues = &valueWrite
	projected.PermissionOptions = &optionWrite

	switch {
	case fieldWrite == PermissionLevelNone && IsPropertyFieldProtected(field) && !field.Protected:
		// access_control keeps protection in the attr alone. Its hook pins the
		// field and option columns to sysadmin, so master stores such a field
		// as unprotected, sysadmin-editable columns and reads the attr instead.
		// Reporting the column as protected would make master refuse every
		// edit of it after a rollback, the source plugin's included. A field
		// whose Protected column is already set was protected by the column,
		// not by access_control, and keeps it.
		sysadmin := PermissionLevelSysadmin
		projected.Protected = false
		projected.PermissionField = &sysadmin
		if optionWrite == PermissionLevelNone {
			projected.PermissionOptions = &sysadmin
		}
		projected.Attrs[PropertyAttrsProtected] = true
	case fieldWrite == PermissionLevelNone:
		// Protected is derived from field.write: none, which is how IsValid
		// cross-validates protected against permission_field on the projected
		// result.
		projected.Protected = true
		projected.Attrs[PropertyAttrsProtected] = true
	default:
		projected.Protected = false
		delete(projected.Attrs, PropertyAttrsProtected)
	}

	if owners := appendHumanOwners(ownersFromGrants(field), GetPropertyFieldOwners(field)); len(owners) > 0 {
		projected.Attrs[PropertyAttrsOwners] = owners
	} else {
		// No owners at all, so the field looks exactly like a field that never
		// had any, rather than one carrying an empty list.
		delete(projected.Attrs, PropertyAttrsOwners)
	}

	if accessMode := EffectiveAccessMode(field, template); accessMode == PropertyAccessModePublic {
		// An absent key already means public.
		delete(projected.Attrs, PropertyAttrsAccessMode)
	} else {
		projected.Attrs[PropertyAttrsAccessMode] = accessMode
	}

	return &projected
}

// ownersFromGrants converts each grant into the PropertyOwner shape a v2
// caller reads from Attrs, carrying the grant's own Allow list rather than
// enumerating every action.
//
// Wildcard grants are skipped. To a v2 reader any owner means the values
// belong to an integration and no person may set them, so projecting the
// wildcard the conversion gives every unowned field would lock it for
// everyone. An unowned field converts back to the same wildcard, so nothing
// is lost.
//
// So is a grant the conversion derives from the field's other attrs: the
// source plugin's on a protected field, and the sync service's on a synced
// one. A v2 reader never saw either as an owner, and would read a synced
// field as managed by an integration. Both attrs are still on the field, so
// converting the projection back derives the same grants. A grant edited
// past what the attrs give is a real owner, and is projected.
//
// One rare case is lost. A stored machine owner whose explicit Allow is no
// wider than a derived grant of the same identity, such as a service owner
// allowed only value.write on a field its own sync locks, merges into that
// grant at conversion and is then left out here as derived. The v2 view
// shows the field unowned, and converting it back opens the writes an owners
// list closes to the plugin wildcard.
func ownersFromGrants(field *PropertyField) []PropertyOwner {
	derived := derivedGrantAllow(field)
	var owners []PropertyOwner
	for _, grant := range field.Permissions.Grants {
		if grant.ID == "*" {
			continue
		}
		if allow, ok := derived[grant.Identity]; ok && len(grant.Scopes) == 0 && isSubsetOf(grant.Allow, allow) {
			continue
		}
		owners = append(owners, PropertyOwner{
			ID:     grant.ID,
			Type:   grant.Type,
			Scopes: grant.Scopes,
			Allow:  grant.Allow,
		})
	}
	return mergeSplitOwners(owners, derived)
}

// mergeSplitOwners rejoins the two grants grantsFromLegacy splits a scoped
// owner into: a scoped grant over the value actions, and an unscoped one over
// the rest. A v2 reader expects the one owner it set, not a second, unscoped
// copy of it. The merged owner carries the scopes and every action of both,
// and converts back to the same two grants. Any other pair for one identity
// is left as it is.
//
// The unscoped half also holds the unscoped value actions of the identity's
// derived grant, if it has one: the source plugin's reads when the scoped
// owner is the source plugin, or the sync service's value.read and
// value.write when it is the sync service. Those are ignored when telling the halves apart, since
// the attrs derive them again on conversion, so such an owner still merges
// into one scoped owner.
func mergeSplitOwners(owners []PropertyOwner, derived map[Identity][]string) []PropertyOwner {
	isValueHalf := func(o PropertyOwner) bool {
		return len(o.Scopes) > 0 && !slices.ContainsFunc(o.Allow, func(a string) bool { return !PropertyActionMeasuredAgainstValueObject(a) })
	}
	isOtherHalf := func(o PropertyOwner) bool {
		derivedAllow := derived[Identity{Type: o.Type, ID: o.ID}]
		return len(o.Scopes) == 0 && !slices.ContainsFunc(o.Allow, func(a string) bool {
			return PropertyActionMeasuredAgainstValueObject(a) && !slices.Contains(derivedAllow, a)
		})
	}

	merged := make([]PropertyOwner, 0, len(owners))
	used := make([]bool, len(owners))
	for i, owner := range owners {
		if used[i] {
			continue
		}
		for j := i + 1; j < len(owners); j++ {
			other := owners[j]
			if used[j] || other.Type != owner.Type || other.ID != owner.ID {
				continue
			}
			if (isValueHalf(owner) && isOtherHalf(other)) || (isOtherHalf(owner) && isValueHalf(other)) {
				scopes := owner.Scopes
				if len(scopes) == 0 {
					scopes = other.Scopes
				}
				owner = PropertyOwner{Type: owner.Type, ID: owner.ID, Scopes: scopes, Allow: unionActions(owner.Allow, other.Allow)}
				used[j] = true
				break
			}
		}
		merged = append(merged, owner)
	}
	return merged
}

// derivedGrantAllow returns, for each identity grantsFromLegacy grants from
// attrs other than owners, the actions it grants it: the source plugin of a
// protected field (only its reads once the field has owners, see
// sourcePluginGrantAllow), and the sync service of a synced one. A machine
// owner of the same identity merges into that grant, so one whose Allow fits
// inside it is indistinguishable from it (see ownersFromGrants).
func derivedGrantAllow(field *PropertyField) map[Identity][]string {
	derived := map[Identity][]string{}
	if pluginID, allow := sourcePluginGrantAllow(field); pluginID != "" {
		derived[Identity{Type: PropertyOwnerTypePlugin, ID: pluginID}] = allow
	}
	if syncSource := GetPropertyFieldSyncSource(field); syncSource != "" {
		derived[Identity{Type: PropertyOwnerTypeService, ID: syncSource}] = syncGrantAllow(field)
	}
	return derived
}

// isSubsetOf reports whether every action in allow is also in of.
func isSubsetOf(allow, of []string) bool {
	for _, action := range allow {
		if !slices.Contains(of, action) {
			return false
		}
	}
	return true
}

// appendHumanOwners appends to owners each user or role owner in stored that
// owners does not already name. Such an owner converts to no grant, yet to a
// v2 reader it is what locks the field to people, and reconverting a
// projection without it would hand the field's writes to the plugin
// wildcard. A machine owner in stored is left out: its grant is the
// authority, and ownersFromGrants projects it, except for a narrow owner
// merged into a derived grant, which is left out with that grant (see
// ownersFromGrants).
func appendHumanOwners(owners, stored []PropertyOwner) []PropertyOwner {
	for _, owner := range stored {
		if isMachineOwnerType(owner.Type) {
			continue
		}
		if slices.ContainsFunc(owners, func(o PropertyOwner) bool { return o.Type == owner.Type && o.ID == owner.ID }) {
			continue
		}
		owners = append(owners, owner)
	}
	return owners
}

// maskingFromLegacy converts a shared_only access mode into a Masking object.
// It returns nil for every other access mode, and for a linked field it never
// returns one of the field's own — it either leaves the field to inherit the
// template's object whole, or, if the template did not convert to masked,
// narrows the field's own reads to none in restrictions instead.
func maskingFromLegacy(field *PropertyField, restrictions *Restrictions, opts LegacyConversionOpts) *Masking {
	if !opts.ConvertAttrs || LegacyAccessMode(field) != PropertyAccessModeSharedOnly {
		return nil
	}

	if opts.Template != nil {
		if opts.Template.Masking != nil {
			// Inherits the template's object whole: the model refuses a linked field
			// that declares its own, and the read path already resolves a linked
			// field's masking from its template.
			return nil
		}
		// Configured as filtered but linked to a template with nothing to filter by.
		// Leaving reads at everyone (set above by the shared_only case) would unmask
		// values that are filtered today, so fail closed instead.
		restrictions.Value.Read = PermissionLevelNone
		restrictions.Option.Read = PermissionLevelNone
		return nil
	}

	masking := &Masking{}
	if pluginID, _ := field.Attrs[PropertyAttrsSourcePluginID].(string); pluginID != "" {
		// Replaces the source plugin's silent shared_only bypass with an explicit
		// exemption.
		masking.Except = append(masking.Except, Identity{Type: PropertyOwnerTypePlugin, ID: pluginID})
	}
	if syncSource := GetPropertyFieldSyncSource(field); syncSource != "" {
		// A machine caller holds no values, so without this a masked synced field
		// would accept only the first sync write and refuse every one after it.
		// Kept on a template too: its linked user fields inherit its masking.
		masking.Except = append(masking.Except, Identity{Type: PropertyOwnerTypeService, ID: syncSource})
	}

	if field.ObjectType == PropertyFieldObjectTypeUser &&
		(restrictions.Value.Write == PermissionLevelMember || restrictions.Value.Write == PermissionLevelEveryone) {
		// Unreachable for a field that passed ValidatePropertyFieldAccessMode:
		// shared_only requires protected, and a protected field's value.write was
		// zeroed above. This is the fail-safe for a row that reached the conversion
		// without passing that validator — a caller who can edit their own holdings
		// on a masked user field could widen their own view by writing into it, and
		// validateMaskingForField refuses that combination outright, so raise the
		// tier rather than emit an object the model would reject.
		restrictions.Value.Write = PermissionLevelAdmin
	}

	return masking
}

// grantsFromLegacy converts the Attrs-based identities the legacy model let
// past its checks into grants enumerating the five enforced actions: plugin
// and service owners, the source plugin of a protected field, and the sync
// service. It adds one wildcard plugin grant for ambient access a machine
// caller named nowhere on the field still holds (see
// ambientMachineGrantAllow).
//
// Each input's Allow is split by PropertyActionMeasuredAgainstValueObject
// before it is merged in: an owner's Scopes only ever narrows the value
// actions, since field.write and the option actions are measured against the
// field's own target rather than a value's object, so scope has nothing to
// say about them. The value actions are tracked in two parts per identity,
// the scoped and the unscoped ones, so an unscoped action one input gives an
// identity never lifts the scope off the actions another input scoped: the
// source plugin's unscoped value.read on an owned protected field leaves its
// scoped owner grant's value.write scoped. A scoped action the identity also
// holds unscoped is dropped from the scoped part, which the unscoped grant
// already covers. So a scoped owner that is the field's sync service reads
// and writes values under every scope, through its derived sync grant. That matches
// master, which adds the sync service as an unscoped owner of any owned
// field it syncs, and whose sync caller never acts under a scope.
//
// The unscoped value actions and the definition actions recombine into one
// unscoped grant, and the scoped value actions, if any, become a second
// grant: a scoped owner keeps its field.write and option grants unscoped even
// though its value grant is not, matching how the store's grants table
// (keyed on FieldID, Type, ID, Action, not Scopes) lets two grants for one
// identity coexist as long as their actions are disjoint.
func grantsFromLegacy(field *PropertyField) []Grant {
	type identityKey struct{ typ, id string }
	var order []identityKey
	scopedByIdentity := map[identityKey]*Grant{}
	unscopedByIdentity := map[identityKey]*Grant{}

	addTo := func(byIdentity map[identityKey]*Grant, key identityKey, scopes, allow []string) {
		if len(allow) == 0 {
			return
		}
		if existing, ok := byIdentity[key]; ok {
			existing.Allow = unionActions(existing.Allow, allow)
			existing.Scopes = mergeScopes(existing.Scopes, scopes)
			return
		}
		byIdentity[key] = &Grant{
			Identity: Identity{Type: key.typ, ID: key.id},
			Scopes:   scopes,
			Allow:    allow,
		}
	}

	addGrant := func(identityType, id string, scopes, allow []string) {
		if id == "" {
			return
		}
		key := identityKey{identityType, id}
		if _, ok := scopedByIdentity[key]; !ok {
			if _, ok := unscopedByIdentity[key]; !ok {
				order = append(order, key)
			}
		}
		var valueAllow, otherAllow []string
		for _, action := range allow {
			if PropertyActionMeasuredAgainstValueObject(action) {
				valueAllow = append(valueAllow, action)
			} else {
				otherAllow = append(otherAllow, action)
			}
		}
		if len(scopes) > 0 {
			addTo(scopedByIdentity, key, scopes, valueAllow)
		} else {
			addTo(unscopedByIdentity, key, nil, valueAllow)
		}
		// field.write/option grants are never scope-gated, no matter what
		// scope the same call passed for the value half above.
		addTo(unscopedByIdentity, key, nil, otherAllow)
	}

	for _, owner := range GetPropertyFieldOwners(field) {
		if !isMachineOwnerType(owner.Type) {
			// Under the legacy model an owners list is a lock: only a plugin or
			// service caller ever matched an owner, and every human was refused on
			// an owned field. A user or role owner was accepted but changed
			// nothing, so it converts to no grant, and the restrictions above keep
			// the lock.
			continue
		}
		allow := validPropertyActions
		if len(owner.Allow) > 0 {
			// An owner written by ProjectLegacyPermissions carries the exact list its
			// grant was allowed; honoring it verbatim is what makes projecting a
			// converted field and converting it back lossless. An owner with no Allow
			// predates this field and keeps the legacy assumption of full access.
			allow = owner.Allow
		}
		addGrant(owner.Type, owner.ID, owner.Scopes, allow)
	}

	if pluginID, allow := sourcePluginGrantAllow(field); pluginID != "" {
		addGrant(PropertyOwnerTypePlugin, pluginID, nil, allow)
	}

	if syncSource := GetPropertyFieldSyncSource(field); syncSource != "" {
		addGrant(PropertyOwnerTypeService, syncSource, nil, syncGrantAllow(field))
	}

	if allow := ambientMachineGrantAllow(field); len(allow) > 0 {
		// An installed plugin arriving through the plugin API matches no
		// owner, protected, or sync-lock grant of its own, so without this
		// wildcard the conversion would revoke access nothing else on this
		// field replaces.
		addGrant(PropertyOwnerTypePlugin, "*", nil, allow)
	}

	grants := make([]Grant, 0, len(order))
	for _, key := range order {
		scoped, unscoped := scopedByIdentity[key], unscopedByIdentity[key]
		if scoped != nil && unscoped != nil {
			scoped.Allow = slices.DeleteFunc(scoped.Allow, func(a string) bool { return slices.Contains(unscoped.Allow, a) })
			if len(scoped.Allow) == 0 {
				scoped = nil
			}
		}
		if scoped != nil {
			grants = append(grants, *scoped)
		}
		if unscoped != nil {
			grants = append(grants, *unscoped)
		}
	}
	return grants
}

// ambientMachineGrantAllow returns the actions a machine caller may perform on
// field with no grant naming it at all, so PermissionsFromLegacy can mint a
// wildcard plugin grant preserving that access instead of silently revoking
// it. Returns an empty slice when the field grants no such ambient access, so
// the caller adds no grant rather than one with an empty Allow.
//
// Each action mirrors what an unnamed plugin could do on the field:
//   - value.read and option.read: only a public field. A source_only field
//     denies both (no grant needed to match); a shared_only field is unmasked
//     either way for a caller holding nothing, so it needs none either.
//   - value.write: only when the field has no owners, is not protected, and
//     is not synced.
//   - field.write and option.write: the same owners/protected pair. Option
//     changes are gated on option.write, so they share that grant.
//
// An orphaned protected field (source plugin uninstalled) converts to no
// wildcard write: a stored grant cannot express "the source is gone", and
// narrower is the recoverable direction.
func ambientMachineGrantAllow(field *PropertyField) []string {
	granted := map[string]bool{}

	if LegacyAccessMode(field) == PropertyAccessModePublic {
		granted[PropertyActionValueRead] = true
		granted[PropertyActionOptionRead] = true
	}

	// field.Protected and the access_control-only Attrs flag are two separate
	// columns that both mean "protected"; either one stands in the way.
	protected := field.Protected || IsPropertyFieldProtected(field)
	if !HasPropertyFieldOwners(field) && !protected {
		granted[PropertyActionFieldWrite] = true
		granted[PropertyActionOptionWrite] = true
		if syncLockSource(field) == "" {
			granted[PropertyActionValueWrite] = true
		}
	}

	allow := make([]string, 0, len(granted))
	for _, action := range validPropertyActions {
		if granted[action] {
			allow = append(allow, action)
		}
	}
	return allow
}

// syncGrantAllow returns what the sync service identity may do on a field
// synced from its source, which is what master's hook lets the sync caller do
// there:
//   - It reads the whole option list and every value, whatever the access
//     mode. The syncer matches source values to options by name and compares
//     them with the values it already wrote, so a filtered view would have it
//     create options that already exist.
//   - It adds and removes options, which is how it provisions and prunes
//     them, and on a field that holds values it writes the definition, unless
//     an owners list or protection stands in the way. Master gates a
//     definition edit and an option change with one check,
//     enforceFieldUpdateAccess, and a field delete with its twin,
//     checkFieldDeleteAccess. Both refuse a machine caller that isn't a
//     listed owner of an owned field, and anyone but the source plugin on a
//     protected one, so field.write and option.write carry the same
//     condition. A sync listed as an owner gets what its owner grant allows.
//   - On a field that holds values, it writes them, which the sync lock
//     leaves to it alone, unless the field is protected and has no owners.
//     There master's protected check passes only the source plugin, and the
//     sync lock then refuses that plugin, so nobody writes them. Master's
//     protected check reads the attr alone, so the Protected column doesn't
//     count here. Once the field has owners, master's owner check supersedes
//     both and counts the sync among the owners, so it writes them again.
//
// A template holds no values and is never sync-locked (see syncLockSource),
// but it is where the options of the user fields linked to it live, and the
// syncer reads, provisions and prunes them there, so it gets the option
// actions alone. A linked field's option.read reads its template's options,
// which the template's grant covers; the conversion drops it from a linked
// field's grants as it does from every other grant.
func syncGrantAllow(field *PropertyField) []string {
	owned := HasPropertyFieldOwners(field)
	writable := !owned && !field.Protected && !IsPropertyFieldProtected(field)
	var allow []string
	if writable && field.ObjectType != PropertyFieldObjectTypeTemplate {
		allow = append(allow, PropertyActionFieldWrite)
	}
	allow = append(allow, PropertyActionOptionRead)
	if writable {
		allow = append(allow, PropertyActionOptionWrite)
	}
	if field.ObjectType != PropertyFieldObjectTypeTemplate {
		allow = append(allow, PropertyActionValueRead)
		if owned || !IsPropertyFieldProtected(field) {
			allow = append(allow, PropertyActionValueWrite)
		}
	}
	return allow
}

// unguardedGroupPluginAllow returns what any plugin could do on a field
// outside access_control: every action except a definition write on a
// protected field, which the app layer's protected check refuses to plugins.
// Option writes stay granted, because the options endpoints never checked
// protected.
func unguardedGroupPluginAllow(field *PropertyField) []string {
	if field.Protected {
		return removeAction(validPropertyActions, PropertyActionFieldWrite)
	}
	return slices.Clone(validPropertyActions)
}

// sourcePluginGrantAllow returns field's source plugin and the actions its
// grant allows, or "" when it gets none. It has standing of its own only on a
// protected field; on an unprotected one the owners list, or the wildcard on
// an unowned field, already says what it may do.
//
// On a protected field with no owners it may read, write the definition and
// write values; anything less takes access away, and it is never
// scope-restricted. The legacy sync lock refuses it a synced field's value
// writes, so value.write is left out there. Once the field has owners, the
// legacy write checks read only the owners list, never protected or the
// source plugin, so the source plugin keeps only the reads the legacy read
// path still gives it on any access mode: value.read and option.read. If it
// is also a listed owner, that owner gets its own grant.
func sourcePluginGrantAllow(field *PropertyField) (string, []string) {
	pluginID, _ := field.Attrs[PropertyAttrsSourcePluginID].(string)
	if pluginID == "" || !IsPropertyFieldProtected(field) {
		return "", nil
	}
	if HasPropertyFieldOwners(field) {
		return pluginID, []string{PropertyActionOptionRead, PropertyActionValueRead}
	}
	if syncLockSource(field) != "" {
		return pluginID, removeAction(validPropertyActions, PropertyActionValueWrite)
	}
	return pluginID, validPropertyActions
}

// isMachineOwnerType reports whether a legacy owner of this type was ever
// matched by an access check. Only plugin and service callers were; a user or
// role owner was stored but never matched anyone.
func isMachineOwnerType(ownerType string) bool {
	return ownerType == PropertyOwnerTypePlugin || ownerType == PropertyOwnerTypeService
}

// syncLockSource returns the sync source whose lock applies to field's own
// values. A template holds no values, so its sync attrs lock nothing on it;
// a user field linked to it takes the lock from its own copy of the attr,
// which the link copies onto it. Its sync still gets a grant over its options
// (see syncGrantAllow).
func syncLockSource(field *PropertyField) string {
	if field.ObjectType == PropertyFieldObjectTypeTemplate {
		return ""
	}
	return GetPropertyFieldSyncSource(field)
}

// unionActions merges two allow lists, returning their union in
// validPropertyActions order so a merged grant's Allow is deterministic.
func unionActions(a, b []string) []string {
	seen := map[string]bool{}
	for _, action := range a {
		seen[action] = true
	}
	for _, action := range b {
		seen[action] = true
	}
	result := make([]string, 0, len(seen))
	for _, action := range validPropertyActions {
		if seen[action] {
			result = append(result, action)
		}
	}
	return result
}

// mergeScopes combines two owner scope lists for the same identity. An empty
// list means unrestricted (Grant.matches skips the scope check when Scopes is
// empty), so if either side is unrestricted the merge must stay unrestricted
// rather than narrowing it to the other side's scopes.
func mergeScopes(a, b []string) []string {
	if len(a) == 0 || len(b) == 0 {
		return nil
	}
	seen := map[string]bool{}
	result := make([]string, 0, len(a)+len(b))
	for _, scopes := range [][]string{a, b} {
		for _, scope := range scopes {
			if !seen[scope] {
				seen[scope] = true
				result = append(result, scope)
			}
		}
	}
	return result
}

// removeAction returns allow with action removed, preserving order.
func removeAction(allow []string, action string) []string {
	result := make([]string, 0, len(allow))
	for _, a := range allow {
		if a != action {
			result = append(result, a)
		}
	}
	return result
}

// LegacyAccessMode reads Attrs[access_mode] directly, ignoring Permissions
// even when it is set. GetAccessMode prefers Permissions once it is non-nil,
// which is right for every other reader -- but converting a field is the one
// place that must read what the legacy submission actually says regardless
// of what Permissions currently holds: reconverting an already-converted
// field puts the stored object on the field before this runs (see
// updatePropertyFields' translation), and GetAccessMode would then report
// the old, pre-update mode instead of the caller's submitted one. The same
// applies to a backfill row whose Permissions has been stripped: GetAccessMode
// reports public, and the stored attr is the value the conversion must see.
func LegacyAccessMode(field *PropertyField) string {
	if field.Attrs == nil {
		return PropertyAccessModePublic
	}
	accessMode, ok := field.Attrs[PropertyAttrsAccessMode].(string)
	if !ok || accessMode == "" {
		return PropertyAccessModePublic
	}
	return accessMode
}

// permissionLevelOrNone reads a legacy *PermissionLevel column, converting an
// unset column (nil, meaning the level was never set) to none rather than
// leaving the leaf empty — an unset legacy column denies today, same as none.
func permissionLevelOrNone(level *PermissionLevel) PermissionLevel {
	if level == nil {
		return PermissionLevelNone
	}
	return *level
}
