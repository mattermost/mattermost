package types

import "github.com/graph-gophers/graphql-go/errors"

// Extension type defines a GraphQL type extension.
// Schemas, Objects, Inputs and Scalars can be extended.
//
// https://spec.graphql.org/draft/#sec-Type-System-Extensions
type Extension struct {
	Type       NamedType
	Directives DirectiveList
	Loc        errors.Location
}
