package types

import "github.com/graph-gophers/graphql-go/errors"

// InputValueDefinition is a representation of the GraphQL InputValueDefinition.
//
// http://spec.graphql.org/draft/#InputValueDefinition
type InputValueDefinition struct {
	Name       Ident
	Type       Type
	Default    Value
	Desc       string
	Directives DirectiveList
	Loc        errors.Location
	TypeLoc    errors.Location
}

type InputValueDefinitionList []*InputValueDefinition

// Returns an InputValueDefinition by name or nil if not found.
func (l InputValueDefinitionList) Get(name string) *InputValueDefinition {
	for _, v := range l {
		if v.Name.Name == name {
			return v
		}
	}
	return nil
}

// InputObject types define a set of input fields; the input fields are either scalars, enums, or
// other input objects.
//
// This allows arguments to accept arbitrarily complex structs.
//
// http://spec.graphql.org/draft/#sec-Input-Objects
type InputObject struct {
	Name       string
	Desc       string
	Values     ArgumentsDefinition
	Directives DirectiveList
	Loc        errors.Location
}

func (*InputObject) Kind() string          { return "INPUT_OBJECT" }
func (t *InputObject) String() string      { return t.Name }
func (t *InputObject) TypeName() string    { return t.Name }
func (t *InputObject) Description() string { return t.Desc }
