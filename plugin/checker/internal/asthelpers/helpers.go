// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package asthelpers

import (
	"go/ast"

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

func FindAPIInterface(files []*ast.File) *ast.InterfaceType {
	for _, f := range files {
		var iface *ast.InterfaceType

		ast.Inspect(f, func(n ast.Node) bool {
			if t, ok := n.(*ast.TypeSpec); ok {
				if i, ok := t.Type.(*ast.InterfaceType); ok && t.Name.Name == "API" {
					iface = i
					return false
				}
			}
			return true
		})

		if iface != nil {
			return iface
		}
	}
	return nil
}
