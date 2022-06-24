package types

import "github.com/graph-gophers/graphql-go/errors"

// ExecutableDefinition represents a set of operations or fragments that can be executed
// against a schema.
//
// http://spec.graphql.org/draft/#ExecutableDefinition
type ExecutableDefinition struct {
	Operations OperationList
	Fragments  FragmentList
}

// OperationDefinition represents a GraphQL Operation.
//
// https://spec.graphql.org/draft/#sec-Language.Operations
type OperationDefinition struct {
	Type       OperationType
	Name       Ident
	Vars       ArgumentsDefinition
	Selections SelectionSet
	Directives DirectiveList
	Loc        errors.Location
}

type OperationType string

// A Selection is a field requested in a GraphQL operation.
//
// http://spec.graphql.org/draft/#Selection
type Selection interface {
	isSelection()
}

// A SelectionSet represents a collection of Selections
//
// http://spec.graphql.org/draft/#sec-Selection-Sets
type SelectionSet []Selection

// Field represents a field used in a query.
type Field struct {
	Alias           Ident
	Name            Ident
	Arguments       ArgumentList
	Directives      DirectiveList
	SelectionSet    SelectionSet
	SelectionSetLoc errors.Location
}

func (Field) isSelection() {}

type OperationList []*OperationDefinition

// Get returns an OperationDefinition by name or nil if not found.
func (l OperationList) Get(name string) *OperationDefinition {
	for _, f := range l {
		if f.Name.Name == name {
			return f
		}
	}
	return nil
}
