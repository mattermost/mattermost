// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package inconsistentReceiverName

import (
	"go/ast"
	"strings"

	"golang.org/x/tools/go/analysis"
)

var (
	Analyzer = &analysis.Analyzer{
		Name: "inconsistentReceiverName",
		Doc:  "check for inconsistent receiver names in the methods of a struct",
		Run:  run,
	}
	ignoreFilesPattern string
)

type firstReceiverName = struct {
	Name string
	Node ast.Node
}

func init() {
	Analyzer.Flags.StringVar(&ignoreFilesPattern, "ignore", "", "Comma separated list of files to ignore")
}

func run(pass *analysis.Pass) (interface{}, error) {
	var ignoreFiles []string
	if ignoreFilesPattern != "" {
		ignoreFiles = strings.Split(ignoreFilesPattern, ",")
	}

	firstReceiverNameForType := make(map[string]firstReceiverName)
	for _, file := range pass.Files {
		ast.Inspect(file, func(node ast.Node) bool {
			if node != nil {
				f := pass.Fset.File(node.Pos())
				if isIgnore(f.Name(), ignoreFiles) {
					return false
				}
			}

			switch funDecl := node.(type) {
			case *ast.FuncDecl:
				if funDecl.Recv != nil && len(funDecl.Recv.List) > 0 && len(funDecl.Recv.List[0].Names) > 0 {
					field := funDecl.Recv.List[0]
					expr := field.Type
					starExpr, ok := field.Type.(*ast.StarExpr)
					if ok {
						expr = starExpr.X
					}

					typeIdent, ok := expr.(*ast.Ident)
					if !ok {
						return false
					}

					currentReceiverName := field.Names[0].Name
					firstReceiver, ok := firstReceiverNameForType[typeIdent.Name]
					if !ok {
						firstReceiverNameForType[typeIdent.Name] = firstReceiverName{
							Name: currentReceiverName,
							Node: node,
						}
						return true
					}

					if firstReceiver.Name != currentReceiverName {
						otherReceiverName := firstReceiver.Name
						otherReceiverPosition := pass.Fset.Position(firstReceiver.Node.Pos())
						pass.Reportf(
							node.Pos(),
							"Different receiver name used for the struct \"%s\" in different methods: using \"%s\" here but was named as \"%s\" before at %s",
							typeIdent.Name,
							currentReceiverName,
							otherReceiverName,
							otherReceiverPosition.String(),
						)
					}
				}
			}
			return true
		})
	}
	return nil, nil
}

func isIgnore(file string, ignoreFiles []string) bool {
	for _, f := range ignoreFiles {
		if strings.HasSuffix(file, f) {
			return true
		}
	}
	return false
}
