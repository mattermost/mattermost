package types

import "github.com/graph-gophers/graphql-go/errors"

// Union types represent objects that could be one of a list of GraphQL object types, but provides no
// guaranteed fields between those types.
//
// They also differ from interfaces in that object types declare what interfaces they implement, but
// are not aware of what unions contain them.
//
// http://spec.graphql.org/draft/#sec-Unions
type Union struct {
	Name             string
	UnionMemberTypes []*ObjectTypeDefinition
	Desc             string
	Directives       DirectiveList
	TypeNames        []string
	Loc              errors.Location
}

func (*Union) Kind() string          { return "UNION" }
func (t *Union) String() string      { return t.Name }
func (t *Union) TypeName() string    { return t.Name }
func (t *Union) Description() string { return t.Desc }
