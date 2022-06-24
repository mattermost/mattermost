package types

import "github.com/graph-gophers/graphql-go/errors"

type Fragment struct {
	On         TypeName
	Selections SelectionSet
}

// InlineFragment is a representation of the GraphQL InlineFragment.
//
// http://spec.graphql.org/draft/#InlineFragment
type InlineFragment struct {
	Fragment
	Directives DirectiveList
	Loc        errors.Location
}

// FragmentDefinition is a representation of the GraphQL FragmentDefinition.
//
// http://spec.graphql.org/draft/#FragmentDefinition
type FragmentDefinition struct {
	Fragment
	Name       Ident
	Directives DirectiveList
	Loc        errors.Location
}

// FragmentSpread is a representation of the GraphQL FragmentSpread.
//
// http://spec.graphql.org/draft/#FragmentSpread
type FragmentSpread struct {
	Name       Ident
	Directives DirectiveList
	Loc        errors.Location
}

type FragmentList []*FragmentDefinition

// Returns a FragmentDefinition by name or nil if not found.
func (l FragmentList) Get(name string) *FragmentDefinition {
	for _, f := range l {
		if f.Name.Name == name {
			return f
		}
	}
	return nil
}

func (InlineFragment) isSelection() {}
func (FragmentSpread) isSelection() {}
