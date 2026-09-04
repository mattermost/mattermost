// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPropertyOptionEdgeIsValid(t *testing.T) {
	fieldID := NewId()
	childID := NewId()
	parentID := NewId()

	for name, tc := range map[string]struct {
		edge  *PropertyOptionEdge
		valid bool
	}{
		"a link between two options of a field": {
			edge:  &PropertyOptionEdge{FieldID: fieldID, ChildOptionID: childID, ParentOptionID: parentID},
			valid: true,
		},
		// Option IDs are whatever the option was created with: options predate the
		// table they live in and carry identifiers no format check would accept,
		// and property values already point at them.
		"endpoints are not checked for being generated IDs": {
			edge:  &PropertyOptionEdge{FieldID: fieldID, ChildOptionID: "short-id", ParentOptionID: "another one"},
			valid: true,
		},
		"no field": {
			edge: &PropertyOptionEdge{ChildOptionID: childID, ParentOptionID: parentID},
		},
		"a field that is not an ID": {
			edge: &PropertyOptionEdge{FieldID: "not-an-id", ChildOptionID: childID, ParentOptionID: parentID},
		},
		"no child": {
			edge: &PropertyOptionEdge{FieldID: fieldID, ParentOptionID: parentID},
		},
		"no parent": {
			edge: &PropertyOptionEdge{FieldID: fieldID, ChildOptionID: childID},
		},
		// The shortest cycle there is, and the only one a single edge can form.
		"an option linked to itself": {
			edge: &PropertyOptionEdge{FieldID: fieldID, ChildOptionID: childID, ParentOptionID: childID},
		},
	} {
		t.Run(name, func(t *testing.T) {
			err := tc.edge.IsValid()
			if tc.valid {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
		})
	}
}
