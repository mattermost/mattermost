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

	// ResolveVisible answers, for a literal not found in VisibleValues, whether
	// the caller may see it. It exists for a field whose option list could not
	// be inlined into VisibleValues at all (a graph field past the hydration
	// cap): enumerating every name the caller may see up front would mean
	// enumerating their whole down-set, which is exactly the size this escape
	// hatch exists to avoid, so instead each literal is resolved -- and, by
	// IsValueHidden, memoized -- only when a policy actually asks about it. nil
	// for every field that answers from VisibleValues alone.
	ResolveVisible func(name string) bool

	resolved map[string]bool
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
		if _, visible := info.VisibleValues[lit]; visible {
			return false
		}
		if info.ResolveVisible == nil {
			return true
		}
		if visible, ok := info.resolved[lit]; ok {
			return !visible
		}
		visible := info.ResolveVisible(lit)
		if info.resolved == nil {
			info.resolved = make(map[string]bool)
		}
		info.resolved[lit] = visible
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
