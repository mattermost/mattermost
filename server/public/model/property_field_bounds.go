// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"cmp"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"net/http"
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

// OrMutable reads an unset mutability as mutable.
func (m PropertyFieldMutability) OrMutable() PropertyFieldMutability {
	if m == "" {
		return PropertyFieldMutabilityMutable
	}
	return m
}

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

// boundsOperators is the operator table: each entry names the field types it
// works on and the references it accepts. A new operator or reference is a new
// entry here, not a change to the rule's shape.
var boundsOperators = map[PropertyBoundsOperator]struct {
	fieldTypes []PropertyFieldType
	references []PropertyBoundsReference
}{
	PropertyBoundsOperatorAtOrBelow: {[]PropertyFieldType{PropertyFieldTypeRank}, []PropertyBoundsReference{PropertyBoundsReferenceParent, PropertyBoundsReferenceSelf}},
	PropertyBoundsOperatorAtOrAbove: {[]PropertyFieldType{PropertyFieldTypeRank}, []PropertyBoundsReference{PropertyBoundsReferenceParent, PropertyBoundsReferenceSelf}},
}

var knownBoundsReferences = []PropertyBoundsReference{PropertyBoundsReferenceParent, PropertyBoundsReferenceSelf}

// objectTypesWithParent are the object types whose objects sit inside another
// one (a post in its channel, a channel or user in the system).
var objectTypesWithParent = []string{PropertyFieldObjectTypePost, PropertyFieldObjectTypeChannel, PropertyFieldObjectTypeUser}

var writeOnceObjectTypes = []string{PropertyFieldObjectTypeChannel, PropertyFieldObjectTypePost, PropertyFieldObjectTypeUser, PropertyFieldObjectTypeSystem}

// Set-on-create needs every creation path of the object to say so. User creation
// has too many (directory provisioning among them) and the system is never created.
var setOnCreateObjectTypes = []string{PropertyFieldObjectTypeChannel, PropertyFieldObjectTypePost}

// validateBounds refuses a rule or mutability that can't apply to this field, so a
// rule that looks enforced but isn't never gets saved. It uses only what is on the
// field; checks that need the group, the store, the flag or the license live elsewhere.
func (pf *PropertyField) validateBounds() *AppError {
	refuse := func(fieldName, reason string) *AppError {
		return NewAppError("PropertyField.IsValid", "model.property_field.is_valid.app_error", map[string]any{"FieldName": fieldName, "Reason": reason}, "id="+pf.ID, http.StatusBadRequest)
	}

	mutability := pf.Mutability.OrMutable()
	switch mutability {
	case PropertyFieldMutabilityMutable, PropertyFieldMutabilityWriteOnce, PropertyFieldMutabilitySetOnCreate:
	default:
		return refuse("mutability", fmt.Sprintf("unrecognised mutability %q", pf.Mutability))
	}

	if pf.ObjectType == PropertyFieldObjectTypeTemplate {
		// Nothing passes down through a link, so a rule or lock on a template would apply to nothing.
		if len(pf.Bounds) > 0 {
			return refuse("bounds", "a template field cannot carry rules")
		}
		if mutability != PropertyFieldMutabilityMutable {
			return refuse("mutability", "a template field cannot be "+string(mutability))
		}
		return nil
	}

	if len(pf.Bounds) > PropertyFieldMaxBoundsRules {
		return refuse("bounds", fmt.Sprintf("a field cannot have more than %d rules", PropertyFieldMaxBoundsRules))
	}

	for i, rule := range pf.Bounds {
		name := fmt.Sprintf("bounds[%d]", i)
		desc := fmt.Sprintf("%s (%s %s)", name, rule.Operator, rule.Reference)

		entry, ok := boundsOperators[rule.Operator]
		if !ok {
			return refuse(name, fmt.Sprintf("%s: unrecognised operator %q", desc, rule.Operator))
		}
		if !slices.Contains(knownBoundsReferences, rule.Reference) {
			return refuse(name, fmt.Sprintf("%s: unrecognised reference %q", desc, rule.Reference))
		}
		if slices.Contains(pf.Bounds[:i], rule) {
			return refuse(name, desc+": the same rule is listed twice")
		}
		if !slices.Contains(entry.fieldTypes, pf.Type) {
			return refuse(name, fmt.Sprintf("%s: the operator doesn't work on a %s field", desc, pf.Type))
		}
		if !slices.Contains(entry.references, rule.Reference) {
			return refuse(name, desc+": the operator doesn't accept that reference")
		}
		if rule.Reference == PropertyBoundsReferenceParent {
			if !slices.Contains(objectTypesWithParent, pf.ObjectType) {
				return refuse(name, desc+": a parent rule needs an object type that has a parent")
			}
			if pf.LinkSourceID() == "" {
				return refuse(name, desc+": a parent rule needs a field linked to a template")
			}
		}
		if rule.Reference == PropertyBoundsReferenceSelf && mutability != PropertyFieldMutabilityMutable {
			return refuse(name, fmt.Sprintf("%s: a rule on the value's own history can't apply when the field is %s", desc, mutability))
		}
	}

	if mutability == PropertyFieldMutabilityWriteOnce && !slices.Contains(writeOnceObjectTypes, pf.ObjectType) {
		return refuse("mutability", "write_once isn't supported on a "+pf.ObjectType+" field")
	}
	if mutability == PropertyFieldMutabilitySetOnCreate && !slices.Contains(setOnCreateObjectTypes, pf.ObjectType) {
		return refuse("mutability", "set_on_create isn't supported on a "+pf.ObjectType+" field")
	}
	return nil
}
