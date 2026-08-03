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
// Every path that creates options or links them enforces the relevant one.
// PropertyField.IsValid checks the option count of a field written with its
// option list inline, which is the only way options are created today.
const (
	PropertyGraphMaxOptions          = 100000
	PropertyGraphMaxEdges            = 1000000
	PropertyGraphMaxDepth            = 100
	PropertyGraphMaxParentsPerOption = 100
)

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
