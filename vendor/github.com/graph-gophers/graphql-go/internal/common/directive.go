package common

import "github.com/graph-gophers/graphql-go/types"

func ParseDirectives(l *Lexer) types.DirectiveList {
	var directives types.DirectiveList
	for l.Peek() == '@' {
		l.ConsumeToken('@')
		d := &types.Directive{}
		d.Name = l.ConsumeIdentWithLoc()
		d.Name.Loc.Column--
		if l.Peek() == '(' {
			d.Arguments = ParseArgumentList(l)
		}
		directives = append(directives, d)
	}
	return directives
}
