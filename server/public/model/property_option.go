// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "github.com/pkg/errors"

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
