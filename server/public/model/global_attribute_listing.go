// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"slices"
	"unicode/utf8"
)

// Source filter values for the Global Attributes listing. The sync sources
// reuse the PropertySyncSource values so a filter value and the sync source it
// selects are the same string.
const (
	GlobalAttributeSourceManaged = "managed"
	GlobalAttributeSourcePlugin  = "plugin"
	GlobalAttributeSourceLDAP    = PropertySyncSourceLDAP
	GlobalAttributeSourceSAML    = PropertySyncSourceSAML
	GlobalAttributeSourceOpenID  = PropertySyncSourceOpenID
)

// Source kinds a listing row reports, matching what the Source column renders:
// a plugin-created protected field, a field synced from an identity source, or
// neither.
const (
	GlobalAttributeSourceKindPlugin   = "plugin"
	GlobalAttributeSourceKindExternal = "external"
	GlobalAttributeSourceKindManaged  = "managed"
)

var globalAttributeListingSources = []string{
	GlobalAttributeSourceManaged,
	GlobalAttributeSourcePlugin,
	GlobalAttributeSourceLDAP,
	GlobalAttributeSourceSAML,
	GlobalAttributeSourceOpenID,
}

// globalAttributeListingResourceTypes are the resources a template can be
// applied to, and so the values the resource type filter accepts.
var globalAttributeListingResourceTypes = []string{
	PropertyFieldObjectTypeUser,
	PropertyFieldObjectTypeChannel,
	PropertyFieldObjectTypePost,
}

// GlobalAttributeListingSearch is the request body of the Global Attributes
// listing search. An empty Term matches every row, and an empty Source or
// ResourceType means no filter on that facet.
type GlobalAttributeListingSearch struct {
	Term         string `json:"term,omitempty"`
	Source       string `json:"source,omitempty"`
	ResourceType string `json:"resource_type,omitempty"`
}

// IsValid rejects a term longer than any field name, which could match no row,
// and a source or resource type outside the filter values.
func (s *GlobalAttributeListingSearch) IsValid() error {
	if utf8.RuneCountInString(s.Term) > PropertyFieldNameMaxRunes {
		return fmt.Errorf("term is longer than %d characters", PropertyFieldNameMaxRunes)
	}
	if s.Source != "" && !slices.Contains(globalAttributeListingSources, s.Source) {
		return fmt.Errorf("invalid source %q", s.Source)
	}
	if s.ResourceType != "" && !slices.Contains(globalAttributeListingResourceTypes, s.ResourceType) {
		return fmt.Errorf("invalid resource_type %q", s.ResourceType)
	}
	return nil
}

// GlobalAttributeNameConflict is a live user field sharing a row's name
// (ignoring case) without belonging to it. CEL rules name user fields as
// user.attributes.<name>, so the two are indistinguishable to a policy author.
// OwnerTemplate is the template the conflicting field is linked to, nil when it
// is a standalone user field. Exact reports whether the names match including
// case, the only case the server's own uniqueness check refuses.
type GlobalAttributeNameConflict struct {
	Field         *PropertyField `json:"field"`
	OwnerTemplate *PropertyField `json:"owner_template,omitempty"`
	Exact         bool           `json:"exact"`
}

// GlobalAttributeListingRow is one row of the Global Attributes listing: a
// template, or a system-level resource field linked to no template, with the
// values the table derives from its linked fields.
type GlobalAttributeListingRow struct {
	Field *PropertyField `json:"field"`

	// AppliesTo lists the resource types the row applies to: the object types
	// of a template's live linked fields, or a resource field's own object type.
	AppliesTo []string `json:"applies_to"`

	// Owners are read from the linked user field for a template, or from the
	// field itself for a user field.
	Owners []PropertyOwner `json:"owners"`

	SourceKind  string   `json:"source_kind"`
	SyncSources []string `json:"sync_sources"`

	IsClassification bool                         `json:"is_classification"`
	NameConflict     *GlobalAttributeNameConflict `json:"name_conflict,omitempty"`
}

type GlobalAttributeListing struct {
	Rows []*GlobalAttributeListingRow `json:"rows"`
}

// GlobalAttributeListingOpts selects the Global Attributes listing rows from
// the store. AllowedResourceTypes bounds which unlinked resource fields are rows
// at all, and ExcludeIDs removes fields the caller has decided to hide, such as
// the Classification template when Classification Markings is unreachable.
// An empty Source or ResourceType means no filter on that facet.
type GlobalAttributeListingOpts struct {
	GroupID              string
	Term                 string
	Source               string
	ResourceType         string
	AllowedResourceTypes []string
	ExcludeIDs           []string
}

func (o *GlobalAttributeListingOpts) IsValid() error {
	if o.GroupID == "" {
		return fmt.Errorf("group id is required")
	}
	if o.Source != "" && !slices.Contains(globalAttributeListingSources, o.Source) {
		return fmt.Errorf("invalid source %q", o.Source)
	}
	if o.ResourceType != "" && !slices.Contains(globalAttributeListingResourceTypes, o.ResourceType) {
		return fmt.Errorf("invalid resource_type %q", o.ResourceType)
	}
	for _, resourceType := range o.AllowedResourceTypes {
		if !slices.Contains(globalAttributeListingResourceTypes, resourceType) {
			return fmt.Errorf("invalid allowed resource type %q", resourceType)
		}
	}
	return nil
}
