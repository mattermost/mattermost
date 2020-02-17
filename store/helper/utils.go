package helper

import (
	"strings"

	sq "github.com/Masterminds/squirrel"
)

func sanitizeSearchTerm(term string, escapeChar string) string {
	term = strings.Replace(term, escapeChar, "", -1)

	for _, c := range escapeLikeSearchChar {
		term = strings.Replace(term, c, escapeChar+c, -1)
	}

	return term
}

var escapeLikeSearchChar = []string{
	"%",
	"_",
}

var spaceFulltextSearchChar = []string{
	"<",
	">",
	"+",
	"-",
	"(",
	")",
	"~",
	":",
	"*",
	"\"",
	"!",
	"@",
}

func getQueryBuilder() sq.StatementBuilderType {
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	builder = builder.PlaceholderFormat(sq.Dollar)
	return builder
}
