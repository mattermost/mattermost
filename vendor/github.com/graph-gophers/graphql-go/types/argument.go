package types

// Argument is a representation of the GraphQL Argument.
//
// https://spec.graphql.org/draft/#sec-Language.Arguments
type Argument struct {
	Name  Ident
	Value Value
}

// ArgumentList is a collection of GraphQL Arguments.
type ArgumentList []*Argument

// Returns a Value in the ArgumentList by name.
func (l ArgumentList) Get(name string) (Value, bool) {
	for _, arg := range l {
		if arg.Name.Name == name {
			return arg.Value, true
		}
	}
	return nil, false
}

// MustGet returns a Value in the ArgumentList by name.
// MustGet will panic if the argument name is not found in the ArgumentList.
func (l ArgumentList) MustGet(name string) Value {
	value, ok := l.Get(name)
	if !ok {
		panic("argument not found")
	}
	return value
}

type ArgumentsDefinition []*InputValueDefinition

// Get returns an InputValueDefinition in the ArgumentsDefinition by name or nil if not found.
func (a ArgumentsDefinition) Get(name string) *InputValueDefinition {
	for _, inputValue := range a {
		if inputValue.Name.Name == name {
			return inputValue
		}
	}
	return nil
}
