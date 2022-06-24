package types

import "github.com/graph-gophers/graphql-go/errors"

// Directive is a representation of the GraphQL Directive.
//
// http://spec.graphql.org/draft/#sec-Language.Directives
type Directive struct {
	Name      Ident
	Arguments ArgumentList
}

// DirectiveDefinition is a representation of the GraphQL DirectiveDefinition.
//
// http://spec.graphql.org/draft/#sec-Type-System.Directives
type DirectiveDefinition struct {
	Name       string
	Desc       string
	Repeatable bool
	Locations  []string
	Arguments  ArgumentsDefinition
	Loc        errors.Location
}

type DirectiveList []*Directive

// Returns the Directive in the DirectiveList by name or nil if not found.
func (l DirectiveList) Get(name string) *Directive {
	for _, d := range l {
		if d.Name.Name == name {
			return d
		}
	}
	return nil
}
