package types

import (
	"github.com/graph-gophers/graphql-go/errors"
)

// TypeName is a base building block for GraphQL type references.
type TypeName struct {
	Ident
}

// NamedType represents a type with a name.
//
// http://spec.graphql.org/draft/#NamedType
type NamedType interface {
	Type
	TypeName() string
	Description() string
}

type Ident struct {
	Name string
	Loc  errors.Location
}

type Type interface {
	// Kind returns one possible GraphQL type kind. A type kind must be
	// valid as defined by the GraphQL spec.
	//
	// https://spec.graphql.org/draft/#sec-Type-Kinds
	Kind() string

	// String serializes a Type into a GraphQL specification format type.
	//
	// http://spec.graphql.org/draft/#sec-Serialization-Format
	String() string
}

// List represents a GraphQL ListType.
//
// http://spec.graphql.org/draft/#ListType
type List struct {
	// OfType represents the inner-type of a List type.
	// For example, the List type `[Foo]` has an OfType of Foo.
	OfType Type
}

// NonNull represents a GraphQL NonNullType.
//
// https://spec.graphql.org/draft/#NonNullType
type NonNull struct {
	// OfType represents the inner-type of a NonNull type.
	// For example, the NonNull type `Foo!` has an OfType of Foo.
	OfType Type
}

func (*List) Kind() string     { return "LIST" }
func (*NonNull) Kind() string  { return "NON_NULL" }
func (*TypeName) Kind() string { panic("TypeName needs to be resolved to actual type") }

func (t *List) String() string    { return "[" + t.OfType.String() + "]" }
func (t *NonNull) String() string { return t.OfType.String() + "!" }
func (*TypeName) String() string  { panic("TypeName needs to be resolved to actual type") }
