// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// Sync sources for property fields. An attribute is synced from a source when
// its definition -- the template a field links to, or the field itself when it
// links to none -- names an external attribute under the matching attr
// (PropertyFieldAttrLDAP / PropertyFieldAttrSAML). These are also the values
// GetPropertyFieldSyncSource returns and the sync lock keys on.
const (
	PropertySyncSourceLDAP = "ldap"
	PropertySyncSourceSAML = "saml"
)

// PropertySyncMaxOptionsPerField caps the number of options a sync may
// provision on one attribute's option list. Source values beyond the cap are
// dropped and reported, never silently mapped to a different option. The cap
// sits well below PropertyFieldMaxHydratedOptions so a synced attribute keeps
// serving its option list inline wherever the field is read.
const PropertySyncMaxOptionsPerField = 500

// IsValidPropertySyncSource reports whether source names a known sync source.
func IsValidPropertySyncSource(source string) bool {
	return source == PropertySyncSourceLDAP || source == PropertySyncSourceSAML
}

// PropertySyncCallerID returns the caller ID under which the given source
// writes synced values, or "" for an unknown source.
func PropertySyncCallerID(source string) string {
	switch source {
	case PropertySyncSourceLDAP:
		return CallerIDLDAPSync
	case PropertySyncSourceSAML:
		return CallerIDSAMLSync
	}
	return ""
}

// PropertySyncSourceAttr returns the field attr that holds the external
// attribute name for the given source, or "" for an unknown source.
func PropertySyncSourceAttr(source string) string {
	switch source {
	case PropertySyncSourceLDAP:
		return PropertyFieldAttrLDAP
	case PropertySyncSourceSAML:
		return PropertyFieldAttrSAML
	}
	return ""
}

// PropertySyncOptions tunes a single SyncUser call.
type PropertySyncOptions struct {
	// PruneOrphanedOptions removes, after the user's values are written,
	// every option this sync stopped referencing that no live value references
	// any more. Per-user sources (SAML login) enable it so an option
	// disappears with its last holder; batch sources (the AD/LDAP job) leave
	// it off and call PropertySyncer.PruneOrphanedOptions once at the end.
	PruneOrphanedOptions bool
}

// PropertySyncFieldStatus is the outcome of syncing one field for one user.
type PropertySyncFieldStatus string

const (
	// PropertySyncFieldUpdated: the value was written with new content.
	PropertySyncFieldUpdated PropertySyncFieldStatus = "updated"
	// PropertySyncFieldUnchanged: the stored value already matched; nothing was written.
	PropertySyncFieldUnchanged PropertySyncFieldStatus = "unchanged"
	// PropertySyncFieldCleared: the source no longer carries the attribute
	// and a previously set value was emptied.
	PropertySyncFieldCleared PropertySyncFieldStatus = "cleared"
	// PropertySyncFieldSkipped: the source value could not be synced (for
	// example it exceeds a length limit); the stored value was left as is.
	PropertySyncFieldSkipped PropertySyncFieldStatus = "skipped"
	// PropertySyncFieldError: a write was attempted and failed.
	PropertySyncFieldError PropertySyncFieldStatus = "error"
)

// PropertySyncFieldOutcome describes what the sync did to one field.
type PropertySyncFieldOutcome struct {
	FieldID   string                  `json:"field_id"`
	FieldName string                  `json:"field_name"`
	FieldType PropertyFieldType       `json:"field_type"`
	Attribute string                  `json:"attribute"`
	Status    PropertySyncFieldStatus `json:"status"`
	// Reason explains a skipped or error status, or why values were dropped
	// from an otherwise successful multiselect sync.
	Reason string `json:"reason,omitempty"`
	// OptionsCreated counts options provisioned for the field by this call.
	OptionsCreated int `json:"options_created,omitempty"`
	// DroppedValues lists source values that were not synced because they
	// exceed a limit or the option cap. For multiselect the remaining values
	// are still synced; for text and select a dropped value skips the field.
	// They are attribute values, so they are counted rather than logged.
	DroppedValues []string `json:"dropped_values,omitempty"`
}

// PropertySyncResult is the outcome of syncing one user.
type PropertySyncResult struct {
	UserID string                     `json:"user_id"`
	Fields []PropertySyncFieldOutcome `json:"fields"`
	// OptionsCreated and OptionsPruned aggregate option changes made while
	// syncing this user (pruning only when PropertySyncOptions requested it).
	OptionsCreated int `json:"options_created"`
	OptionsPruned  int `json:"options_pruned"`
}

// Count returns how many fields ended with the given status.
func (r *PropertySyncResult) Count(status PropertySyncFieldStatus) int {
	if r == nil {
		return 0
	}
	n := 0
	for _, f := range r.Fields {
		if f.Status == status {
			n++
		}
	}
	return n
}

// Changed reports whether any value was written for the user.
func (r *PropertySyncResult) Changed() bool {
	return r.Count(PropertySyncFieldUpdated)+r.Count(PropertySyncFieldCleared) > 0
}

// HasErrors reports whether any field write failed.
func (r *PropertySyncResult) HasErrors() bool {
	return r.Count(PropertySyncFieldError) > 0
}

// PropertySyncPrunedField lists the options removed from one option list,
// identified by the field that owns it: the template a synced field links to,
// or the synced field itself.
type PropertySyncPrunedField struct {
	FieldID   string   `json:"field_id"`
	FieldName string   `json:"field_name"`
	OptionIDs []string `json:"option_ids"`
}

// PropertySyncPruneResult is the outcome of an orphaned-option prune.
type PropertySyncPruneResult struct {
	Fields []PropertySyncPrunedField `json:"fields"`
}

// OptionsPruned returns the total number of options removed.
func (r *PropertySyncPruneResult) OptionsPruned() int {
	if r == nil {
		return 0
	}
	n := 0
	for _, f := range r.Fields {
		n += len(f.OptionIDs)
	}
	return n
}
