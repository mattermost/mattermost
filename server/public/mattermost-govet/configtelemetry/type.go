// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package configtelemetry

import (
	"go/ast"
	"go/token"
	"strings"
)

var ignoreComments = []string{
	"telemetry: none",
	"Deprecated: do not use",
}

// typeFieldMap will generate map of its all possible selectors and adds them as a key. The value
// is the position of the declaration in the type spec.
func typeFieldMap(file *ast.File, typeName string) (map[string]token.Pos, error) {

	var fieldsMap map[string]token.Pos

	ast.Inspect(file, func(n ast.Node) bool {
		decl, ok := n.(*ast.GenDecl)
		if !ok || decl.Tok != token.TYPE || len(decl.Specs) < 1 {
			return true
		}

		spec, ok := decl.Specs[0].(*ast.TypeSpec)
		if !ok || spec.Name.Name != typeName {
			return true
		}

		typ, ok := spec.Type.(*ast.StructType)
		if !ok {
			return true
		}

		fieldsMap = fields(typ)

		return false
	})

	return fieldsMap, nil
}

func fields(str *ast.StructType) map[string]token.Pos {
	structFields := make(map[string]token.Pos)

	for _, field := range str.Fields.List {
		if field.Comment != nil && ignored(field.Comment) {
			continue
		}

		expr := field.Type
		if ptr, ok := field.Type.(*ast.StarExpr); ok {
			expr = ptr.X
		}

		if len(field.Names) != 1 {
			panic("unhandled struct field definition")
		}

		key := field.Names[0].Name

		v, ok := expr.(*ast.Ident)
		if !ok || v.Obj == nil || v.Obj.Decl == nil {
			structFields[key] = field.Pos()
			continue
		}

		typeDecl, ok := v.Obj.Decl.(*ast.TypeSpec)
		if !ok {
			continue
		}

		typ, ok := typeDecl.Type.(*ast.StructType)
		if !ok {
			continue
		}

		for k, v := range fields(typ) {
			structFields[key+"."+k] = v
		}
	}

	return structFields
}

func ignored(comments *ast.CommentGroup) bool {
	for _, comment := range comments.List {
		for _, ignore := range ignoreComments {
			if strings.Contains(comment.Text, ignore) {
				return true
			}
		}
	}
	return false
}
