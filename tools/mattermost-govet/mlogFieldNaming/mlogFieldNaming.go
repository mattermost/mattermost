// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlogFieldNaming

import (
	"fmt"
	"go/ast"
	"go/constant"
	"go/token"
	"go/types"
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "mlogFieldNaming",
	Doc:  "check that mlog field keys are snake_case",
	Run:  run,
}

const mlogPkgPath = "github.com/mattermost/mattermost/server/public/shared/mlog"

// keyedFieldConstructors are the mlog field constructors that take a field key
// as their first argument.
var keyedFieldConstructors = map[string]bool{
	"Any":      true,
	"Array":    true,
	"Bool":     true,
	"Duration": true,
	"Float":    true,
	"Int":      true,
	"Map":      true,
	"Millis":   true,
	"NamedErr": true,
	"String":   true,
	"Stringer": true,
	"Time":     true,
	"Uint":     true,
}

var snakeCase = regexp.MustCompile(`^[a-z][a-z0-9]*(_[a-z0-9]+)*$`)

func run(pass *analysis.Pass) (interface{}, error) {
	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok {
				return true
			}

			fun, ok := calleeSelector(call.Fun)
			if !ok || !keyedFieldConstructors[fun.Sel.Name] {
				return true
			}

			if !isMlogPackage(pass, fun.X) {
				return true
			}

			if len(call.Args) == 0 {
				return true
			}

			arg := call.Args[0]

			key, ok := constantString(pass, arg)
			if !ok {
				// The key isn't statically known, so there's nothing to check.
				return true
			}

			if snakeCase.MatchString(key) {
				return true
			}

			pass.Report(diagnostic(arg, key))

			return true
		})
	}

	return nil, nil
}

func diagnostic(arg ast.Expr, key string) analysis.Diagnostic {
	// A fix can only rewrite the key in place when it is spelled out as a
	// string literal. Keys that come from a named constant have to be renamed
	// at the declaration instead, which is beyond what this analyzer offers.
	lit, isLiteral := arg.(*ast.BasicLit)
	isLiteral = isLiteral && lit.Kind == token.STRING

	fixed, canFix := toSnakeCase(key)
	if !isLiteral || !canFix {
		return analysis.Diagnostic{
			Pos:     arg.Pos(),
			End:     arg.End(),
			Message: fmt.Sprintf("mlog field key %q is not snake_case", key),
		}
	}

	return analysis.Diagnostic{
		Pos:     arg.Pos(),
		End:     arg.End(),
		Message: fmt.Sprintf("mlog field key %q is not snake_case, use %q", key, fixed),
		SuggestedFixes: []analysis.SuggestedFix{{
			Message: fmt.Sprintf("Rename mlog field key to %q", fixed),
			TextEdits: []analysis.TextEdit{{
				Pos:     arg.Pos(),
				End:     arg.End(),
				NewText: []byte(strconv.Quote(fixed)),
			}},
		}},
	}
}

// toSnakeCase converts a field key to snake_case, reporting whether the result
// is a valid snake_case key. Keys that cannot be converted mechanically (an
// empty key, or one that would start with a digit) are left to the author.
func toSnakeCase(key string) (string, bool) {
	runes := []rune(key)

	var b strings.Builder
	for i, r := range runes {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			b.WriteRune('_')
			continue
		}

		// Break before an uppercase rune that starts a new word, either
		// following a lowercase rune or a digit ("userId" -> "user_id"), or
		// ending a run of uppercase runes ("requestURLPath" ->
		// "request_url_path").
		if i > 0 && unicode.IsUpper(r) {
			prev := runes[i-1]
			startsWord := unicode.IsLower(prev) || unicode.IsDigit(prev)
			endsAcronym := unicode.IsUpper(prev) && startsNewWord(runes, i+1)
			if startsWord || endsAcronym {
				b.WriteRune('_')
			}
		}

		b.WriteRune(unicode.ToLower(r))
	}

	fixed := strings.Trim(b.String(), "_")
	for strings.Contains(fixed, "__") {
		fixed = strings.ReplaceAll(fixed, "__", "_")
	}

	return fixed, snakeCase.MatchString(fixed)
}

// startsNewWord reports whether the lowercase run beginning at i is a new word
// rather than a plural suffix on the acronym that precedes it, so that
// "requestURLPath" breaks before "Path" but "userIDs" keeps its trailing "s"
// ("user_ids", not "user_i_ds").
func startsNewWord(runes []rune, i int) bool {
	if i >= len(runes) || !unicode.IsLower(runes[i]) {
		return false
	}

	// A lone "s" pluralizes the acronym instead of starting a word.
	if runes[i] == 's' && (i+1 == len(runes) || !unicode.IsLower(runes[i+1])) {
		return false
	}

	return true
}

// calleeSelector returns the pkg.Name selector a call expression resolves to.
// Most of the keyed constructors are generic, so an explicitly instantiated
// call such as mlog.Int[int64](...) reaches here as an index expression
// wrapping the selector rather than as the selector itself.
func calleeSelector(fun ast.Expr) (*ast.SelectorExpr, bool) {
	switch expr := ast.Unparen(fun).(type) {
	case *ast.IndexExpr:
		fun = expr.X
	case *ast.IndexListExpr:
		fun = expr.X
	}

	sel, ok := ast.Unparen(fun).(*ast.SelectorExpr)

	return sel, ok
}

func isMlogPackage(pass *analysis.Pass, expr ast.Expr) bool {
	ident, ok := expr.(*ast.Ident)
	if !ok {
		return false
	}

	pkgName, ok := pass.TypesInfo.Uses[ident].(*types.PkgName)
	if !ok {
		return false
	}

	return pkgName.Imported().Path() == mlogPkgPath
}

func constantString(pass *analysis.Pass, expr ast.Expr) (string, bool) {
	tv, ok := pass.TypesInfo.Types[expr]
	if !ok || tv.Value == nil || tv.Value.Kind() != constant.String {
		return "", false
	}

	return constant.StringVal(tv.Value), true
}
