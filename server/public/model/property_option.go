// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "github.com/pkg/errors"

// The limits a graph field's option hierarchy is held within. All four are
// fixed rather than configurable: they bound what the traversals, the write-path
// checks, and the access rules compiled against a hierarchy have to cope with,
// and a deployment raising one would be changing the shape of the data every one
// of those handles rather than expressing a preference.
//
// Depth counts the options on a chain rather than the links between them, so a
// root and one option below it are a depth of two. The parent limit is per
// option: an option with a hundred options directly above it is already an
// overlay of several dimensions at once.
//
// Every path that creates options or links them enforces the relevant one. The
// option count has two enforcement points because options have two write paths:
// PropertyField.IsValid checks the list a field is written with, and the options
// endpoints check what they add to the options a field already has.
const (
	PropertyGraphMaxOptions          = 100000
	PropertyGraphMaxEdges            = 1000000
	PropertyGraphMaxDepth            = 100
	PropertyGraphMaxParentsPerOption = 100
)

// propertyOptionReservedAttrs are the keys an option's Attrs may not carry.
// Each of them names something PropertyFieldOption models directly or leaves
// out on purpose, and the option list a field serves projects all four from
// their own columns -- so a value under one of these keys would be a second,
// contradictory way to say the same thing.
var propertyOptionReservedAttrs = []string{"id", "name", "color", "rank"}

// PropertyFieldOption is one option of a select-style property field as the
// options endpoints carry it. It is a second projection of the row behind an
// entry in the field's inline Attrs["options"] list: that list is flat and
// open-shaped, while this one names an option's parts and carries its place in
// the field's hierarchy.
//
// Three things an option row holds are deliberately absent:
//
//   - The rank. A rank field's option order is authored through the field's own
//     option list, where the uniqueness of a rank is validated, and a graph
//     field's options may not carry one at all. A write here leaves an existing
//     option's rank as it was.
//   - The sort order. It records where an option sat in the list a field was
//     written with, which is a property of that list rather than of the option.
//     An option created here is appended after the ones already there.
//   - The last-modified time. Nothing pages or synchronizes on it: a change to
//     an option moves the *field's* UpdateAt, which is what clients follow.
//
// On a write, a key left out is left as it was, so patching one part of an
// option does not silently discard the rest; send an empty value to clear one.
// Parents is the key that makes this matter: an option quietly left with no
// parents becomes a root, covered by nothing but itself, and every rule that
// granted access through an option above it starts denying.
//
// ReadOnly and CreateAt are reported, never accepted. Parents is absent
// entirely for a field whose options form no hierarchy.
type PropertyFieldOption struct {
	ID       string           `json:"id"`
	Name     string           `json:"name"`
	Color    *string          `json:"color,omitempty"`
	Attrs    *StringInterface `json:"attrs,omitempty"`
	Parents  *[]string        `json:"parents,omitempty"`
	ReadOnly bool             `json:"read_only,omitempty"`
	CreateAt int64            `json:"create_at,omitempty"`
}

func (o *PropertyFieldOption) GetID() string {
	return o.ID
}

func (o *PropertyFieldOption) GetName() string {
	return o.Name
}

func (o *PropertyFieldOption) SetID(id string) {
	o.ID = id
}

// Auditable reports what an option is and where it sits, and nothing else. The
// parents matter most: a parent link has no delete marker, so the audit log is
// the only record that one ever existed.
//
// The colour and the option's own attrs are left out. Neither says anything about
// what an option means or who a rule reaches through it, and attrs hold whatever
// a caller chose to put there.
func (o *PropertyFieldOption) Auditable() map[string]any {
	auditable := map[string]any{
		"id":   o.ID,
		"name": o.Name,
	}
	if o.Parents != nil {
		auditable["parents"] = *o.Parents
	}
	return auditable
}

// IsValid checks what an option can be judged on without the rest of the
// field's options: whether an option with this name already exists, and whether
// the parents named here resolve to anything, both need those.
//
// The ID is not checked at all. Whether one is required depends on the
// operation -- creating an option assigns it, changing one names it -- and an
// option's ID is whatever it was created with, which for options predating the
// options table is not a generated identifier.
func (o *PropertyFieldOption) IsValid() error {
	if o.Name == "" {
		return errors.New("name cannot be empty")
	}

	if o.Parents != nil {
		if len(*o.Parents) > PropertyGraphMaxParentsPerOption {
			return errors.Errorf("no option may have more than %d options directly above it", PropertyGraphMaxParentsPerOption)
		}
		seen := make(map[string]bool, len(*o.Parents))
		for _, parent := range *o.Parents {
			if parent == "" {
				return errors.New("a parent name cannot be empty")
			}
			if seen[parent] {
				return errors.Errorf("parent %q is named more than once", parent)
			}
			seen[parent] = true
		}
	}

	if o.Attrs != nil {
		for _, reserved := range propertyOptionReservedAttrs {
			if _, ok := (*o.Attrs)[reserved]; ok {
				return errors.Errorf("attrs cannot carry the reserved key %q", reserved)
			}
		}
	}

	return nil
}

// PropertyOptionEdge is one parent link between two options of the same
// property field: ChildOptionID sits directly below ParentOptionID in that
// field's option hierarchy.
//
// Both endpoints belong to the field named in FieldID. An option is identified
// by its field and its ID rather than by its ID alone -- the same ID may name a
// different option on another field -- so an edge is only meaningful together
// with the field it belongs to, and every query for one is field-scoped.
type PropertyOptionEdge struct {
	FieldID        string `json:"field_id"`
	ChildOptionID  string `json:"child_option_id"`
	ParentOptionID string `json:"parent_option_id"`
	CreateAt       int64  `json:"create_at"`
}

// IsValid checks the parts of an edge that can be judged on their own. The
// endpoint IDs are only checked for being present: an option ID is whatever the
// option was created with, and existing options carry IDs no format would
// accept. Whether the endpoints exist, and whether the edge set they belong to
// is free of longer cycles, needs the rest of the field's options to answer.
func (e *PropertyOptionEdge) IsValid() error {
	if !IsValidId(e.FieldID) {
		return errors.New("field id is not a valid ID")
	}

	if e.ChildOptionID == "" {
		return errors.New("child option id cannot be empty")
	}

	if e.ParentOptionID == "" {
		return errors.New("parent option id cannot be empty")
	}

	if e.ChildOptionID == e.ParentOptionID {
		return errors.New("an option cannot be its own parent")
	}

	return nil
}
