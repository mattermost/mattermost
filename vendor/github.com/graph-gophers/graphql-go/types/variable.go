package types

import "github.com/graph-gophers/graphql-go/errors"

// Variable is used in GraphQL operations to parameterize an input value.
//
// http://spec.graphql.org/draft/#Variable
type Variable struct {
	Name string
	Loc  errors.Location
}

func (v Variable) Deserialize(vars map[string]interface{}) interface{} { return vars[v.Name] }
func (v Variable) String() string                                      { return "$" + v.Name }
func (v *Variable) Location() errors.Location                          { return v.Loc }
