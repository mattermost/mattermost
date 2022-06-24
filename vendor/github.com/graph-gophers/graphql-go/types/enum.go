package types

import "github.com/graph-gophers/graphql-go/errors"

// EnumTypeDefinition defines a set of possible enum values.
//
// Like scalar types, an EnumTypeDefinition also represents a leaf value in a GraphQL type system.
//
// http://spec.graphql.org/draft/#sec-Enums
type EnumTypeDefinition struct {
	Name                 string
	EnumValuesDefinition []*EnumValueDefinition
	Desc                 string
	Directives           DirectiveList
	Loc                  errors.Location
}

// EnumValueDefinition are unique values that may be serialized as a string: the name of the
// represented value.
//
// http://spec.graphql.org/draft/#EnumValueDefinition
type EnumValueDefinition struct {
	EnumValue  string
	Directives DirectiveList
	Desc       string
	Loc        errors.Location
}

func (*EnumTypeDefinition) Kind() string          { return "ENUM" }
func (t *EnumTypeDefinition) String() string      { return t.Name }
func (t *EnumTypeDefinition) TypeName() string    { return t.Name }
func (t *EnumTypeDefinition) Description() string { return t.Desc }
