// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// MaskingFieldAccessMode indicates how a property field's literal values are
// exposed to a given caller under attribute value masking rules.
type MaskingFieldAccessMode int

const (
	MaskingFieldAccessUnknown MaskingFieldAccessMode = iota
	// MaskingFieldAccessPublic means all values are visible to every caller.
	MaskingFieldAccessPublic
	// MaskingFieldAccessSharedOnly means the caller sees only values they themselves hold.
	MaskingFieldAccessSharedOnly
	// MaskingFieldAccessSourceOnly means values are never visible to callers.
	MaskingFieldAccessSourceOnly
)

// MaskingTokenValue is the sentinel string written into masked CEL expressions
// to represent one or more hidden values without revealing their content.
const MaskingTokenValue = "--------"

// MaskingFieldInfo bundles per-field, per-caller visibility data for use by
// the canonical CEL AST masking walker.
type MaskingFieldInfo struct {
	Access MaskingFieldAccessMode
	// VisibleValues contains the literal values the caller may see.
	// Populated for MaskingFieldAccessSharedOnly fields; nil for Public/SourceOnly/Unknown.
	VisibleValues map[string]struct{}
}

// IsValueHidden reports whether the literal value lit is hidden from the caller
// under this field's access mode. It is the single source of truth for the
// per-value visibility decision shared by the masking, validation, and merge
// walkers.
//
// The masked-token placeholder (MaskingTokenValue) is never itself "hidden": it
// is a server-generated stand-in from a prior read response, not a real value.
// Unknown or unrecognised access modes fail closed (treated as hidden).
func (info *MaskingFieldInfo) IsValueHidden(lit string) bool {
	if lit == MaskingTokenValue {
		return false
	}
	switch info.Access {
	case MaskingFieldAccessPublic:
		return false
	case MaskingFieldAccessSourceOnly:
		return true
	case MaskingFieldAccessSharedOnly:
		_, visible := info.VisibleValues[lit]
		return !visible
	default:
		return true
	}
}

// MaskingFieldResolver answers field-visibility questions for a property
// attribute identified by its CPA object type (PropertyFieldObjectTypeUser for
// user.attributes.*, PropertyFieldObjectTypeChannel for resource.attributes.*)
// and field name (the suffix after the ".attributes." segment, e.g.
// "department"). The object type is required because a user field and a channel
// field can share a name but differ in visibility, so each must be resolved
// against its own CPA schema.
//
// Implementations must be fail-closed: return a non-nil error for any lookup
// that cannot be proven safe. The walker treats any resolver error as a
// reason to mask all literals for that field.
type MaskingFieldResolver interface {
	Resolve(objectType, fieldName string) (*MaskingFieldInfo, error)
}
