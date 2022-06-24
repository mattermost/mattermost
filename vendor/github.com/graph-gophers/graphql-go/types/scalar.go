package types

import "github.com/graph-gophers/graphql-go/errors"

// ScalarTypeDefinition types represent primitive leaf values (e.g. a string or an integer) in a GraphQL type
// system.
//
// GraphQL responses take the form of a hierarchical tree; the leaves on these trees are GraphQL
// scalars.
//
// http://spec.graphql.org/draft/#sec-Scalars
type ScalarTypeDefinition struct {
	Name       string
	Desc       string
	Directives DirectiveList
	Loc        errors.Location
}

func (*ScalarTypeDefinition) Kind() string          { return "SCALAR" }
func (t *ScalarTypeDefinition) String() string      { return t.Name }
func (t *ScalarTypeDefinition) TypeName() string    { return t.Name }
func (t *ScalarTypeDefinition) Description() string { return t.Desc }
