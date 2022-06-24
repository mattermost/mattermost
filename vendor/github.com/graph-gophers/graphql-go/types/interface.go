package types

import "github.com/graph-gophers/graphql-go/errors"

// InterfaceTypeDefinition recusrively defines list of named fields with their arguments via the
// implementation chain of interfaces.
//
// GraphQL objects can then implement these interfaces which requires that the object type will
// define all fields defined by those interfaces.
//
// http://spec.graphql.org/draft/#sec-Interfaces
type InterfaceTypeDefinition struct {
	Name          string
	PossibleTypes []*ObjectTypeDefinition
	Fields        FieldsDefinition
	Desc          string
	Directives    DirectiveList
	Loc           errors.Location
	Interfaces    []*InterfaceTypeDefinition
}

func (*InterfaceTypeDefinition) Kind() string          { return "INTERFACE" }
func (t *InterfaceTypeDefinition) String() string      { return t.Name }
func (t *InterfaceTypeDefinition) TypeName() string    { return t.Name }
func (t *InterfaceTypeDefinition) Description() string { return t.Desc }
