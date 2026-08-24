// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"slices"
)

// Property field permission actions. Each names one cell of the
// field/option/value × read/write grid the permission model is asked per
// action. Aspect comes first so everything governing one part of a
// field sorts together.
//
// Five of the six grid cells are enforced and appear here. The sixth,
// field.read, is deliberately left unenforced — a field definition's
// discoverability is not gated — so it has no constant, and neither a grant's
// allow list nor a restrictions leaf may name it.
const (
	PropertyActionFieldWrite  = "field.write"
	PropertyActionOptionRead  = "option.read"
	PropertyActionOptionWrite = "option.write"
	PropertyActionValueRead   = "value.read"
	PropertyActionValueWrite  = "value.write"
)

// validPropertyActions is the set of enforced actions a grant's allow list may
// name. There is deliberately no "*": full access is typed out, so a serialization
// default or a future action never confers control by accident.
var validPropertyActions = []string{
	PropertyActionFieldWrite,
	PropertyActionOptionRead,
	PropertyActionOptionWrite,
	PropertyActionValueRead,
	PropertyActionValueWrite,
}

// Permissions is a field's single "who may do what" setting. It comprises three parts:
//
//   - Restrictions — the default rule for human callers, on the ladder.
//   - Grants — named machine/human identities, each with an explicit action list.
//   - Masking — an optional read filter for fields whose option list is itself
//     sensitive.
//
// All three are optional at the top level; an absent part means "unchanged"
// on update, which is why each is a pointer or a nil-able slice rather than a value.
type Permissions struct {
	Restrictions *Restrictions `json:"restrictions,omitempty"`
	Grants       []Grant       `json:"grants,omitempty"`
	Masking      *Masking      `json:"masking,omitempty"`
}

// Scan implements sql.Scanner so a jsonb column reads directly into a
// *Permissions field.
func (p *Permissions) Scan(value any) error {
	if value == nil {
		return nil
	}

	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, p)
	case string:
		return json.Unmarshal([]byte(v), p)
	default:
		return fmt.Errorf("received value %T is neither a byte slice nor string", value)
	}
}

// Restrictions holds the human permission ladder per aspect. A leaf omitted on input
// means none; validation fills it in so a stored object always carries
// all five enforced leaves. field carries no read leaf because field.read is not
// enforced.
type Restrictions struct {
	Value  ReadWrite `json:"value"`
	Option ReadWrite `json:"option"`
	Field  WriteOnly `json:"field"`
}

// ReadWrite is the read/write pair for the value and option aspects. Each leaf
// is a permission level; the empty string means the leaf was omitted (none).
type ReadWrite struct {
	Read  PermissionLevel `json:"read,omitempty"`
	Write PermissionLevel `json:"write,omitempty"`
}

// WriteOnly is the field aspect's single write leaf. There is no read leaf by
// construction, which is how field.read is kept unexpressible.
type WriteOnly struct {
	Write PermissionLevel `json:"write,omitempty"`
}

// UnmarshalJSON rejects a "read" key outright rather than silently dropping it,
// so a caller that submits field.read gets an error instead of a no-op. Without
// this the struct having no Read field would swallow the key and the ban would
// be invisible.
func (w *WriteOnly) UnmarshalJSON(data []byte) error {
	var m map[string]json.RawMessage
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}
	if _, ok := m["read"]; ok {
		return fmt.Errorf("field.read is not an enforced action and cannot be set")
	}
	if raw, ok := m["write"]; ok {
		return json.Unmarshal(raw, &w.Write)
	}
	return nil
}

// Grant names one identity and lists the actions it may perform.
// Allow is required and non-empty; an empty allow is rejected, not ignored.
type Grant struct {
	Identity
	Scopes []string `json:"scopes,omitempty"`
	Allow  []string `json:"allow"`
}

// Masking is the read filter for a field whose option list is sensitive.
// Its presence (even empty) marks the field masked; MaskByFieldID names where
// the caller's holdings live (template-only), and Except lists identities exempt
// from masking.
type Masking struct {
	MaskByFieldID string     `json:"mask_by_field_id,omitempty"`
	Except        []Identity `json:"except,omitempty"`
}

// Identity names one caller by type and id, used in Masking.Except. It carries
// no scopes or actions — it is only ever asked "is this caller exempt?".
type Identity struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

// IsValid validates the permissions object and normalizes it in place so a
// stored object is always complete: restrictions leaves omitted on input are
// filled to none, which is why the receiver is a pointer. It is
// idempotent, so re-validating a normalized object is a no-op.
//
// objectType is the owning field's object type; masking's self-writable rule is
// stated relative to it.
func (p *Permissions) IsValid(objectType string) error {
	if p.Restrictions != nil {
		if err := p.Restrictions.normalizeAndValidate(); err != nil {
			return err
		}
	}
	for i := range p.Grants {
		if err := p.Grants[i].isValid(); err != nil {
			return fmt.Errorf("grant %d: %w", i, err)
		}
	}
	if p.Masking != nil {
		if err := p.Masking.isValid(objectType); err != nil {
			return err
		}
		if err := p.validateMaskingForField(objectType); err != nil {
			return err
		}
	}
	return nil
}

// isValid checks the shape-only masking rules — the ones answerable without a
// store: every except identity is a known type with a present, non-wildcard
// id; mask_by_field_id is only ever set on a template; and a masked field that
// isn't object_type:user must set it, since object_type:user is the only place
// holdings can be read from today. Whether mask_by_field_id actually names a
// live, linked field is checked separately, by the store's
// ValidateMaskByFieldID.
func (m *Masking) isValid(objectType string) error {
	for _, id := range m.Except {
		if !IsValidPropertyOwnerType(id.Type) {
			return fmt.Errorf("except: invalid type %q", id.Type)
		}
		if id.ID == "" {
			return fmt.Errorf("except: id is required")
		}
		if id.ID == "*" {
			return fmt.Errorf("except: wildcard id is not allowed")
		}
	}
	if m.MaskByFieldID != "" && objectType != PropertyFieldObjectTypeTemplate {
		return fmt.Errorf("mask_by_field_id is only allowed on object_type:template")
	}
	if objectType != PropertyFieldObjectTypeUser && m.MaskByFieldID == "" {
		return fmt.Errorf("masked field with no mask_by_field_id and object_type != user has no resolvable holdings")
	}
	return nil
}

// validateMaskingForField enforces the self-writable rule: a masked
// object_type:user field may not let a human write its own holdings, or a caller
// could widen their own view by editing their value. Runs after restrictions
// normalization, so value.write is already filled.
func (p *Permissions) validateMaskingForField(objectType string) error {
	if objectType != PropertyFieldObjectTypeUser || p.Restrictions == nil {
		return nil
	}
	if w := p.Restrictions.Value.Write; w == PermissionLevelMember || w == PermissionLevelEveryone {
		return fmt.Errorf("a masked object_type:user field may not be self-writable (value.write is %q)", w)
	}
	return nil
}

// isValid checks one grant's shape: a known identity type, a present id,
// the wildcard limited to machine types, identifier-shaped scopes, and a
// non-empty allow list naming only enforced actions.
func (g *Grant) isValid() error {
	if !IsValidPropertyOwnerType(g.Type) {
		return fmt.Errorf("invalid type %q", g.Type)
	}
	if g.ID == "" {
		return fmt.Errorf("id is required")
	}
	// The wildcard is machine-only: "any human" is what restrictions already
	// express.
	if g.ID == "*" && g.Type != PropertyOwnerTypePlugin && g.Type != PropertyOwnerTypeService {
		return fmt.Errorf("wildcard id is only allowed for plugin or service grants")
	}
	for _, scope := range g.Scopes {
		if !IsValidPropertyOwnerScope(scope) {
			return fmt.Errorf("invalid scope %q", scope)
		}
	}
	// Required and non-empty: a grant that grants nothing is almost always a
	// mistake, so it is rejected rather than dropped.
	if len(g.Allow) == 0 {
		return fmt.Errorf("allow must be non-empty")
	}
	for _, action := range g.Allow {
		if !slices.Contains(validPropertyActions, action) {
			return fmt.Errorf("invalid action %q", action)
		}
	}
	return nil
}

// TierFor returns the ladder tier Restrictions assigns to action, or none for
// a nil receiver, an unrecognized action, or a leaf that was never set. Nil
// happens for real: all three parts of Permissions are optional, so a field
// can carry grants with no restrictions at all, and then it must grant no
// human anything.
func (r *Restrictions) TierFor(action string) PermissionLevel {
	if r == nil {
		return PermissionLevelNone
	}
	var leaf PermissionLevel
	switch action {
	case PropertyActionFieldWrite:
		leaf = r.Field.Write
	case PropertyActionOptionRead:
		leaf = r.Option.Read
	case PropertyActionOptionWrite:
		leaf = r.Option.Write
	case PropertyActionValueRead:
		leaf = r.Value.Read
	case PropertyActionValueWrite:
		leaf = r.Value.Write
	default:
		return PermissionLevelNone
	}
	if leaf == "" {
		return PermissionLevelNone
	}
	return leaf
}

// permissionLevelRank orders the human ladder most restrictive to least
// permissive: none admits no human at all (only grants can act), sysadmin
// admits only a system administrator, admin additionally admits an admin of
// the target, member additionally admits any member, and everyone admits
// anyone. An empty string (leaf omitted) and any value outside this map both
// rank as none, the fail-closed answer.
var permissionLevelRank = map[PermissionLevel]int{
	PermissionLevelNone:     0,
	PermissionLevelSysadmin: 1,
	PermissionLevelAdmin:    2,
	PermissionLevelMember:   3,
	PermissionLevelEveryone: 4,
}

// AtMostAsPermissiveAs reports whether l admits no more callers than other —
// true when l sits at or below other on the human ladder. Equal tiers count
// as at most as permissive, which is what a tighten-only ceiling needs: a
// linked field may match its template's tier, not just undercut it.
func (l PermissionLevel) AtMostAsPermissiveAs(other PermissionLevel) bool {
	return permissionLevelRank[l] <= permissionLevelRank[other]
}

// PropertyActionMeasuredAgainstValueObject reports whether action is measured
// against the object a value is attached to (found through the field's
// ObjectType) rather than against the field's own definition
// (TargetType/TargetID).
//
// value.read and value.write are measured against the value's object; a
// system-targeted field whose values attach to posts takes a system
// administrator to redefine but only membership of the post's channel to set
// a value on. field.write, option.read and option.write are measured against
// the field's target instead, because the definition exists once — measuring
// value writes against the field's target would make "member" mean "every
// user on the install".
func PropertyActionMeasuredAgainstValueObject(action string) bool {
	switch action {
	case PropertyActionValueRead, PropertyActionValueWrite:
		return true
	default:
		return false
	}
}

// MatchingGrant returns the first grant that lets (callerType, callerID),
// acting under scope, perform action — or nil if none does. The grant itself
// is returned rather than a bool because an audit record must name the grant
// that allowed a write, including whether it matched by wildcard (grant.ID ==
// "*").
//
// A caller matches a grant only by an identity it cannot forge: callerID
// must be non-empty and not itself "*", since the wildcard is a property of
// the grant, never of the actor. Scope is consulted only after that identity
// match, so a scope can narrow what a listed identity may do and can never
// get it onto a field it was not listed on. There is no "*" action: a grant
// listing value.write does not confer value.read.
func (p *Permissions) MatchingGrant(callerType, callerID, scope, action string) *Grant {
	if p == nil || callerID == "" || callerID == "*" || !IsValidPropertyOwnerType(callerType) {
		return nil
	}
	for i := range p.Grants {
		g := &p.Grants[i]
		if g.Type != callerType {
			continue
		}
		if g.ID != callerID {
			isWildcardEligible := callerType == PropertyOwnerTypePlugin || callerType == PropertyOwnerTypeService
			if !(g.ID == "*" && isWildcardEligible) {
				continue
			}
		}
		if len(g.Scopes) > 0 && !slices.Contains(g.Scopes, scope) {
			continue
		}
		if !slices.Contains(g.Allow, action) {
			continue
		}
		return g
	}
	return nil
}

// restrictionsLeaves returns pointers to the five enforced leaves in a stable
// order, so normalization and validation walk exactly the set of enforced leaves —
// field.read is absent by construction.
func (r *Restrictions) restrictionsLeaves() []*PermissionLevel {
	return []*PermissionLevel{
		&r.Value.Read, &r.Value.Write,
		&r.Option.Read, &r.Option.Write,
		&r.Field.Write,
	}
}

// normalizeAndValidate fills every omitted leaf with none and rejects any
// present leaf that is not a valid permission level. After it returns nil all five
// leaves are set explicitly, so nothing has to be inferred on read.
func (r *Restrictions) normalizeAndValidate() error {
	for _, leaf := range r.restrictionsLeaves() {
		if *leaf == "" {
			*leaf = PermissionLevelNone
			continue
		}
		if !slices.Contains(validPermissionLevels, *leaf) {
			return fmt.Errorf("invalid permission level %q in restrictions", *leaf)
		}
	}
	return nil
}
