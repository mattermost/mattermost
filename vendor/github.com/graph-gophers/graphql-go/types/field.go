package types

import "github.com/graph-gophers/graphql-go/errors"

// FieldDefinition is a representation of a GraphQL FieldDefinition.
//
// http://spec.graphql.org/draft/#FieldDefinition
type FieldDefinition struct {
	Name       string
	Arguments  ArgumentsDefinition
	Type       Type
	Directives DirectiveList
	Desc       string
	Loc        errors.Location
}

// FieldsDefinition is a list of an ObjectTypeDefinition's Fields.
//
// https://spec.graphql.org/draft/#FieldsDefinition
type FieldsDefinition []*FieldDefinition

// Get returns a FieldDefinition in a FieldsDefinition by name or nil if not found.
func (l FieldsDefinition) Get(name string) *FieldDefinition {
	for _, f := range l {
		if f.Name == name {
			return f
		}
	}
	return nil
}

// Names returns a slice of FieldDefinition names.
func (l FieldsDefinition) Names() []string {
	names := make([]string, len(l))
	for i, f := range l {
		names[i] = f.Name
	}
	return names
}
