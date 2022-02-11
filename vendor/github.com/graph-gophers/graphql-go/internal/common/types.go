package common

import (
	"github.com/graph-gophers/graphql-go/errors"
	"github.com/graph-gophers/graphql-go/types"
)

func ParseType(l *Lexer) types.Type {
	t := parseNullType(l)
	if l.Peek() == '!' {
		l.ConsumeToken('!')
		return &types.NonNull{OfType: t}
	}
	return t
}

func parseNullType(l *Lexer) types.Type {
	if l.Peek() == '[' {
		l.ConsumeToken('[')
		ofType := ParseType(l)
		l.ConsumeToken(']')
		return &types.List{OfType: ofType}
	}

	return &types.TypeName{Ident: l.ConsumeIdentWithLoc()}
}

type Resolver func(name string) types.Type

// ResolveType attempts to resolve a type's name against a resolving function.
// This function is used when one needs to check if a TypeName exists in the resolver (typically a Schema).
//
// In the example below, ResolveType would be used to check if the resolving function
// returns a valid type for Dimension:
//
// type Profile {
//    picture(dimensions: Dimension): Url
// }
//
// ResolveType recursively unwraps List and NonNull types until a NamedType is reached.
func ResolveType(t types.Type, resolver Resolver) (types.Type, *errors.QueryError) {
	switch t := t.(type) {
	case *types.List:
		ofType, err := ResolveType(t.OfType, resolver)
		if err != nil {
			return nil, err
		}
		return &types.List{OfType: ofType}, nil
	case *types.NonNull:
		ofType, err := ResolveType(t.OfType, resolver)
		if err != nil {
			return nil, err
		}
		return &types.NonNull{OfType: ofType}, nil
	case *types.TypeName:
		refT := resolver(t.Name)
		if refT == nil {
			err := errors.Errorf("Unknown type %q.", t.Name)
			err.Rule = "KnownTypeNames"
			err.Locations = []errors.Location{t.Loc}
			return nil, err
		}
		return refT, nil
	default:
		return t, nil
	}
}
