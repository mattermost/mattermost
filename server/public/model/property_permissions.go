// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// Property field permission actions. Each names one cell of the
// field/option/value × read/write grid the permission model is asked per
// action (§2.1). Aspect comes first so everything governing one part of a
// field sorts together.
//
// Five of the six grid cells are enforced and appear here. The sixth,
// field.read, is deliberately left unenforced in v1 — a field definition's
// discoverability is not gated — so it has no constant, and neither a grant's
// allow list nor a restrictions leaf may name it.
const (
	PropertyActionFieldWrite  = "field.write"
	PropertyActionOptionRead  = "option.read"
	PropertyActionOptionWrite = "option.write"
	PropertyActionValueRead   = "value.read"
	PropertyActionValueWrite  = "value.write"
)

// Permissions is a field's single "who may do what" setting (§1.3). It replaces
// the seven legacy mechanisms with three parts:
//
//   - Restrictions — the default rule for human callers, on the ladder.
//   - Grants — named machine/human identities, each with an explicit action list.
//   - Masking — an optional read filter for fields whose option list is itself
//     sensitive.
//
// All three are optional at the top level; on a whole-object write an absent
// part means "unchanged" (§9.3), which is why each is a pointer or a nil-able
// slice rather than a value.
type Permissions struct {
	Restrictions *Restrictions `json:"restrictions,omitempty"`
	Grants       []Grant       `json:"grants,omitempty"`
	Masking      *Masking      `json:"masking,omitempty"`
}

// Restrictions holds the human ladder per aspect (§2.2). A leaf omitted on input
// means none (§2.2); validation fills it in so a stored object always carries
// all five enforced leaves. field carries no read leaf because field.read is not
// enforced in v1 (§2.1).
type Restrictions struct {
	Value  ReadWrite `json:"value"`
	Option ReadWrite `json:"option"`
	Field  WriteOnly `json:"field"`
}

// ReadWrite is the read/write pair for the value and option aspects. Each leaf
// is a ladder tier; the empty string means the leaf was omitted (→ none).
type ReadWrite struct {
	Read  PermissionLevel `json:"read,omitempty"`
	Write PermissionLevel `json:"write,omitempty"`
}

// WriteOnly is the field aspect's single write leaf. There is no read leaf by
// construction, which is how field.read is kept unexpressible (§2.1).
type WriteOnly struct {
	Write PermissionLevel `json:"write,omitempty"`
}

// Grant names one identity and lists the actions it may perform (§2.3). Type is
// one of the PropertyOwnerType* constants (grants generalize the owners list).
// Allow is required and non-empty; an empty allow is rejected, not ignored.
type Grant struct {
	Type   string   `json:"type"`
	ID     string   `json:"id"`
	Scopes []string `json:"scopes,omitempty"`
	Allow  []string `json:"allow"`
}

// Masking is the read filter for a field whose option list is sensitive (§2.6).
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
