package noSelectStar

import (
	"go/ast"
	"go/token"
	"regexp"
	"strings"

	"golang.org/x/tools/go/analysis"
)

var selectStarRegex = regexp.MustCompile(`(?i)SELECT\s+(.+\.)?\*`)

// replaceCountStar replaces COUNT(*) patterns with COUNT() to avoid false positives
func replaceCountStar(s string) string {
	countStarRegex := regexp.MustCompile(`(?i)COUNT\(\s*\*\s*\)`)
	return countStarRegex.ReplaceAllString(s, "COUNT()")
}

var Analyzer = &analysis.Analyzer{
	Name: "noSelectStar",
	Doc:  "checks for SQL queries containing SELECT * which breaks forwards compatibility",
	Run:  run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	inspect := func(node ast.Node) bool {
		// Check 1: Look for raw strings containing "SELECT *"
		if lit, ok := node.(*ast.BasicLit); ok && lit.Kind == token.STRING {
			if selectStarRegex.MatchString(replaceCountStar(lit.Value)) {
				pass.Reportf(lit.Pos(), "do not use SELECT *: explicitly select the needed columns instead")
			}
			return true
		}

		// Check 2: Look for Select/Column/Columns method calls containing "*"
		if call, ok := node.(*ast.CallExpr); ok {
			if sel, ok := call.Fun.(*ast.SelectorExpr); ok {
				methodName := sel.Sel.Name
				switch methodName {
				case "Select", "Column", "Columns":
					for _, arg := range call.Args {
						if lit, ok := arg.(*ast.BasicLit); ok &&
							lit.Kind == token.STRING &&
							strings.Contains(replaceCountStar(lit.Value), "*") {
							pass.Reportf(lit.Pos(), "do not use SELECT *: explicitly select the needed columns instead")
						}
					}
				}
			}
		}
		return true
	}

	for _, f := range pass.Files {
		ast.Inspect(f, inspect)
	}

	return nil, nil
}
