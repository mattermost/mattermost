// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"cmp"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"slices"
)

type PropertyBoundsOperator string

const (
	PropertyBoundsOperatorAtOrBelow PropertyBoundsOperator = "at_or_below"
	PropertyBoundsOperatorAtOrAbove PropertyBoundsOperator = "at_or_above"
)

type PropertyBoundsReference string

const (
	// PropertyBoundsReferenceParent is the value the containing object holds.
	PropertyBoundsReferenceParent PropertyBoundsReference = "parent"
	// PropertyBoundsReferenceSelf is this object's current value.
	PropertyBoundsReferenceSelf PropertyBoundsReference = "self"
)

type PropertyBoundsRule struct {
	Operator  PropertyBoundsOperator  `json:"operator"`
	Reference PropertyBoundsReference `json:"reference"`
}

// PropertyBounds limits what a value may be; a value must satisfy every rule.
type PropertyBounds []PropertyBoundsRule

type PropertyFieldMutability string

const (
	PropertyFieldMutabilityMutable     PropertyFieldMutability = "mutable"
	PropertyFieldMutabilityWriteOnce   PropertyFieldMutability = "write_once"
	PropertyFieldMutabilitySetOnCreate PropertyFieldMutability = "set_on_create"
)

const PropertyFieldMaxBoundsRules = 8

// orMutable reads an unset mutability as mutable.
func (m PropertyFieldMutability) orMutable() PropertyFieldMutability {
	if m == "" {
		return PropertyFieldMutabilityMutable
	}
	return m
}

// Scan implements sql.Scanner so a jsonb column reads directly into a
// PropertyBounds field.
func (b *PropertyBounds) Scan(value any) error {
	if value == nil {
		return nil
	}

	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, b)
	case string:
		return json.Unmarshal([]byte(v), b)
	default:
		return fmt.Errorf("received value %T is neither a byte slice nor string", value)
	}
}

// Value implements driver.Valuer. It returns JSON text as a string rather than
// []byte so lib/pq doesn't send binary jsonb (whose first byte is a version number).
func (b PropertyBounds) Value() (driver.Value, error) {
	out, err := json.Marshal(b)
	if err != nil {
		return nil, err
	}
	return string(out), nil
}

// PropertyBoundsEqual reports whether a and b hold the same rules. Order doesn't
// count, since a value must satisfy every rule, and nil equals empty.
func PropertyBoundsEqual(a, b PropertyBounds) bool {
	if len(a) != len(b) {
		return false
	}
	sorted := func(p PropertyBounds) PropertyBounds {
		c := slices.Clone(p)
		slices.SortFunc(c, func(x, y PropertyBoundsRule) int {
			return cmp.Or(cmp.Compare(x.Operator, y.Operator), cmp.Compare(x.Reference, y.Reference))
		})
		return c
	}
	return slices.Equal(sorted(a), sorted(b))
}
