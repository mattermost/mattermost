package noSelectStar

import (
	"go/ast"
	"go/token"
	"strings"

	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "noSelectStar",
	Doc:  "checks for SQL queries containing SELECT * which breaks forwards compatibility",
	Run:  run,
}

func run(pass *analysis.Pass) (interface{}, error) {
	inspect := func(node ast.Node) bool {
		// Check 1: Look for raw strings containing "SELECT *"
		if lit, ok := node.(*ast.BasicLit); ok && lit.Kind == token.STRING {
			if strings.Contains(strings.ToUpper(lit.Value), "SELECT *") {
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
							strings.Contains(lit.Value, "*") {
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
