// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/google/cel-go/cel"
	exprpb "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

func ExtractAttributeFieldsFromAST(ast *cel.Ast) ([]string, error) {
	checkedExpr, err := cel.AstToCheckedExpr(ast)
	if err != nil {
		return nil, err
	}

	extractor := &attributeExtractor{
		fields: make(map[string]bool),
	}

	if err := extractor.visit(checkedExpr.Expr); err != nil {
		return nil, err
	}

	// Convert map keys to slice
	result := make([]string, 0, len(extractor.fields))
	for field := range extractor.fields {
		result = append(result, field)
	}

	return result, nil
}

type attributeExtractor struct {
	fields map[string]bool
}

func (ex *attributeExtractor) visit(expr *exprpb.Expr) error {
	switch expr.ExprKind.(type) {
	case *exprpb.Expr_SelectExpr:
		return ex.visitSelect(expr)
	case *exprpb.Expr_CallExpr:
		return ex.visitCall(expr)
	case *exprpb.Expr_IdentExpr:
		return nil // Skip identifiers
	case *exprpb.Expr_ConstExpr:
		return nil // Skip constants
	case *exprpb.Expr_ListExpr:
		return ex.visitList(expr)
	case *exprpb.Expr_StructExpr:
		return ex.visitStruct(expr)
	}
	return nil
}

func (ex *attributeExtractor) visitSelect(expr *exprpb.Expr) error {
	sel := expr.GetSelectExpr()

	// Check if this is a select on "attributes"
	if sel.GetField() != "attributes" {
		// If this is a field selection after attributes, capture it
		if isAttributesSelect(sel.GetOperand()) {
			ex.fields[sel.GetField()] = true
			return nil
		}
	}

	// Continue traversing
	return ex.visit(sel.GetOperand())
}

func (ex *attributeExtractor) visitCall(expr *exprpb.Expr) error {
	c := expr.GetCallExpr()
	// Visit target if it exists
	if c.GetTarget() != nil {
		if err := ex.visit(c.GetTarget()); err != nil {
			return err
		}
	}

	// Visit all arguments
	for _, arg := range c.GetArgs() {
		if err := ex.visit(arg); err != nil {
			return err
		}
	}
	return nil
}

func (ex *attributeExtractor) visitList(expr *exprpb.Expr) error {
	l := expr.GetListExpr()
	for _, elem := range l.GetElements() {
		if err := ex.visit(elem); err != nil {
			return err
		}
	}
	return nil
}

func (ex *attributeExtractor) visitStruct(expr *exprpb.Expr) error {
	s := expr.GetStructExpr()
	for _, entry := range s.GetEntries() {
		if err := ex.visit(entry.GetValue()); err != nil {
			return err
		}
		if entry.GetMapKey() != nil {
			if err := ex.visit(entry.GetMapKey()); err != nil {
				return err
			}
		}
	}
	return nil
}

// isAttributesSelect checks if the expression is a select of "attributes" on "user"
func isAttributesSelect(expr *exprpb.Expr) bool {
	if sel, ok := expr.ExprKind.(*exprpb.Expr_SelectExpr); ok {
		if sel.SelectExpr.GetField() == "attributes" {
			if ident, ok := sel.SelectExpr.GetOperand().ExprKind.(*exprpb.Expr_IdentExpr); ok {
				return ident.IdentExpr.GetName() == "user"
			}
		}
	}
	return false
}
