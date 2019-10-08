// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package asthelpers

import (
	"go/ast"
	"go/types"

	"github.com/pkg/errors"
	"golang.org/x/tools/go/packages"
)

func GetPackage(pkgPath string) (*packages.Package, error) {
	cfg := &packages.Config{
		Mode: packages.NeedName | packages.NeedTypes | packages.NeedSyntax,
	}
	pkgs, err := packages.Load(cfg, pkgPath)
	if err != nil {
		return nil, err
	}

	if len(pkgs) == 0 {
		return nil, errors.Errorf("could not find package %s", pkgPath)
	}
	return pkgs[0], nil
}

func FindInterface(name string, files []*ast.File) (*ast.InterfaceType, error) {
	var iface *ast.InterfaceType

	for _, f := range files {
		ast.Inspect(f, func(n ast.Node) bool {
			if t, ok := n.(*ast.TypeSpec); ok {
				if iface != nil {
					return false
				}

				if i, ok := t.Type.(*ast.InterfaceType); ok && t.Name.Name == name {
					iface = i
					return false
				}
			}
			return true
		})

		if iface != nil {
			return iface, nil
		}
	}
	return nil, errors.Errorf("could not find %s interface", name)
}

func FindMethodsCalledOnType(info *types.Info, typ types.Type, caller *ast.FuncDecl) []string {
	var methods []string

	ast.Inspect(caller, func(n ast.Node) bool {
		if s, ok := n.(*ast.SelectorExpr); ok {

			var receiver *ast.Ident
			switch r := s.X.(type) {
			case *ast.Ident:
				// Left-hand side of the selector is an identifier, eg:
				//
				//   a := p.API
				//   a.GetTeams()
				//
				receiver = r
			case *ast.SelectorExpr:
				// Left-hand side of the selector is a selector, eg:
				//
				//   p.API.GetTeams()
				//
				receiver = r.Sel
			}

			if receiver != nil {
				obj := info.ObjectOf(receiver)
				if obj != nil && types.Identical(obj.Type(), typ) {
					methods = append(methods, s.Sel.Name)
				}
				return false
			}

		}
		return true
	})

	return methods
}
