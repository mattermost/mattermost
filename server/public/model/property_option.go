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

// PropertyFieldOptionsMaxPerRequest bounds how many of a field's options one
// call may read, create, change, or delete. It is the largest page the HTTP
// layer will serve, so a page a caller read is a page it can write back, and it
// keeps one call from carrying a whole hierarchy: nothing about the write path
// degrades at that size, but an unbounded payload is an unbounded amount of work
// to validate before anything is written.
//
// It bounds the page size as well as the payload because a caller that is not
// the HTTP layer chooses its own, and a listing has the same property: the page
// is held in memory and its parents are looked up together.
const PropertyFieldOptionsMaxPerRequest = 200

// The limits one request's hierarchy work is held within. The limits above
// bound what a hierarchy may hold; these bound the work one request may do over
// a hierarchy already inside those limits -- a hierarchy entirely legal by
// PropertyGraphMaxOptions and friends can still be too large to walk on a read
// that has to stay cheap, and that is deliberate rather than a gap in the limits
// above.
//
// Exceeding one is never a partial answer: a masking caller hides what it could
// not resolve, a validation caller refuses the change, and a caller cannot tell
// a hierarchy at the bound from one they cover nothing in -- the server log is
// the only place the difference shows.
//
// Fixed rather than configurable, for the same reason the block above is: a
// deployment raising one would be changing how much work an ordinary read is
// allowed to cost every other request on the node.
const (
	// PropertyGraphMaxWalkRows bounds the (seed, option) pairs one recursive
	// walk over a field's hierarchy may return. One seed reaching every option
	// of a maximum-size field is PropertyGraphMaxOptions (100,000) rows, so
	// this leaves room for a handful of seeds each doing that. Reaching it
	// takes a hierarchy that is both large and an overlay -- most options
	// reachable from most others, which is what options with many parents each
	// produce -- walked from many seeds at once, which is what masking a value
	// marked with hundreds of options does.
	PropertyGraphMaxWalkRows = 250000

	// PropertyGraphMaxMaskedOptions bounds the options the downward walk
	// behind one masked value may visit. Reaching it takes a value marked with
	// an option that has more than this many options below it -- a root, or
	// something near one, of a hierarchy with tens of thousands of options --
	// read by a caller who covers only part of it. The walk is one query per
	// level, so this is also tens of queries on a read that has to stay cheap.
	PropertyGraphMaxMaskedOptions = 10000

	// PropertyFieldOptionCandidatesMaxPerRequest bounds how many candidate
	// option rows one page of a listing may examine, independent of the page
	// size asked for. Reaching it takes a caller who covers so little of a
	// large hierarchy that most rows the page query reads are dropped by the
	// coverage filter -- covering ten options of a hundred thousand, say.
	// Unlike the other two this is not a refusal: the page ends there and the
	// cursor resumes from the last candidate examined.
	PropertyFieldOptionCandidatesMaxPerRequest = 2000
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
// Name is the exception: it is how the payload refers to the option in the
// first place, so it is required on every write, and a patch that omits it is
// refused rather than leaving the stored name alone. Parents is the key that
// makes the rest of this matter: an option quietly left with no parents
// becomes a root, covered by nothing but itself, and every rule that granted
// access through an option above it starts denying.
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

// PropertyFieldOptionPage is one page of a field's options, as the listing
// endpoint returns it. A bare list of options cannot say whether the listing
// continues past them -- a filtered page can be short with options still to
// come -- so the page carries that separately.
//
// HasMore is the only signal that ends a listing: a short page does not, and
// an empty page does not either. A caller loops while HasMore, sending
// NextCursorCreateAt and NextCursorID back each time.
//
// The cursor names the last candidate row the page query *examined*, not the
// last option it *returned*. Those differ whenever a coverage filter dropped
// rows at the end of the window, and the difference is the whole point: a
// caller resuming from the last option returned would re-examine the dropped
// rows on every page, and a page that returns nothing at all would never
// advance.
//
// Options is never nil when the call succeeded: an empty page serializes as
// [] rather than null.
type PropertyFieldOptionPage struct {
	Options            []*PropertyFieldOption `json:"options"`
	HasMore            bool                   `json:"has_more"`
	NextCursorCreateAt int64                  `json:"next_cursor_create_at,omitempty"`
	NextCursorID       string                 `json:"next_cursor_id,omitempty"`
}

// PropertyFieldOptionPageFilter is the coverage filter a listing's page query
// is narrowed by, decided once per listing by the hooks and consumed by the
// store.
//
// A nil filter means the caller may see every option the field has, which is
// what an unmasked read is. ShowNothing means no page of this field will ever
// show this caller anything, so the listing answers empty without reading a
// row. CoveredBy names the caller's own options: a candidate is kept when one
// of them is at-or-above it, the same covering relation the hooks' own
// masking applies elsewhere -- this filter only narrows the query by it.
//
// ShowNothing is checked first when both fields are set on the same value. A
// non-nil filter whose CoveredBy is empty means "nothing", not "everything":
// a filter that failed to name any held option must fail closed.
type PropertyFieldOptionPageFilter struct {
	ShowNothing bool
	CoveredBy   []string
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
