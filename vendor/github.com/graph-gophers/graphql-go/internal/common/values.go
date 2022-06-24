package common

import (
	"github.com/graph-gophers/graphql-go/types"
)

func ParseInputValue(l *Lexer) *types.InputValueDefinition {
	p := &types.InputValueDefinition{}
	p.Loc = l.Location()
	p.Desc = l.DescComment()
	p.Name = l.ConsumeIdentWithLoc()
	l.ConsumeToken(':')
	p.TypeLoc = l.Location()
	p.Type = ParseType(l)
	if l.Peek() == '=' {
		l.ConsumeToken('=')
		p.Default = ParseLiteral(l, true)
	}
	p.Directives = ParseDirectives(l)
	return p
}

func ParseArgumentList(l *Lexer) types.ArgumentList {
	var args types.ArgumentList
	l.ConsumeToken('(')
	for l.Peek() != ')' {
		name := l.ConsumeIdentWithLoc()
		l.ConsumeToken(':')
		value := ParseLiteral(l, false)
		args = append(args, &types.Argument{
			Name:  name,
			Value: value,
		})
	}
	l.ConsumeToken(')')
	return args
}
