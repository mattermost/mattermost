// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mutexLock

import (
	"go/ast"
	"go/token"

	"golang.org/x/tools/go/analysis"
)

var Analyzer = &analysis.Analyzer{
	Name: "mutexLock",
	Doc:  "check for cases where a mutex is left locked before returning",
	Run:  run,
}

func isMutex(varType string) bool {
	switch varType {
	case "sync.Mutex", "sync.RWMutex":
		return true
	}

	return false
}

func isLock(methodName string) bool {
	switch methodName {
	case "Lock", "RLock":
		return true
	}

	return false
}

func isUnlock(methodName string) bool {
	switch methodName {
	case "Unlock", "RUnlock":
		return true
	}

	return false
}

type checkState struct {
	lockPos   token.Pos
	unlockPos token.Pos
	counter   int
	reported  bool
}

func run(pass *analysis.Pass) (interface{}, error) {
	for _, file := range pass.Files {
		var m map[string]*checkState

		check := func() {
			for k, v := range m {
				if v.counter > 0 {
					if !v.reported {
						pass.Reportf(v.lockPos, "possible return with mutex %s locked", k)
						v.reported = true
					}
				}
			}
		}

		ast.Inspect(file, func(node ast.Node) bool {
			if node == nil {
				return false
			}

			if _, ok := node.(*ast.FuncDecl); ok {
				check()
				m = map[string]*checkState{}
			}

			if _, ok := node.(*ast.ReturnStmt); ok {
				check()
			}

			if e, ok := node.(*ast.CallExpr); ok {
				se, ok := e.Fun.(*ast.SelectorExpr)
				if !ok {
					return true
				}

				methodName := se.Sel.Name

				var id *ast.Ident
				switch e := se.X.(type) {
				case *ast.SelectorExpr:
					id = e.Sel
				case *ast.Ident:
					id = e
				default:
					return false
				}

				varName := id.Name
				varType := pass.TypesInfo.Uses[id].Type().String()

				if !isMutex(varType) {
					return false
				}

				st := m[varName]
				if st == nil {
					st = &checkState{}
				}

				if isLock(methodName) {
					st.lockPos = se.Pos()
					st.counter++
				} else if isUnlock(methodName) {
					st.unlockPos = se.Pos()
					st.counter--
				}

				m[varName] = st

				return false
			}

			return true
		})

		check()

	}
	return nil, nil
}
