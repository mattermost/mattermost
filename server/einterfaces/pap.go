// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// PolicyAdministrationPointInterface is the service that manages access control policies.
// It is responsible for creating, updating, and deleting policies.
// Also, it provides methods to check the validity of expressions and to retrieve policies.
type PolicyAdministrationPointInterface interface {
	// Init initializes the policy administration point and intiates the CEL engine.
	// It is an idempotent operation, meaning that it can be called multiple times.
	Init(rctx request.CTX) error
	// BasicAutocomplete returns a map of basic autocomplete values for the given target type.
	GetBasicAutocomplete(rctx request.CTX, targetType string) (map[string]any, error)
	// CheckExpression checks the validity of the given expression using the CEL engine.
	// It returns a list of CELExpressionError if the expression is invalid.
	// If the expression is valid, it returns an empty list.
	CheckExpression(rctx request.CTX, expression string) ([]model.CELExpressionError, error)
	// ExtractAttributeFields extracts the attribute fields from the given expression.
	// Achieves this by parsing the expression into AST and returning a list of attribute fields.
	ExtractAttributeFields(rctx request.CTX, targetType, expression string) ([]string, error)
	// SavePolicy saves the given access control policy.
	SavePolicy(rctx request.CTX, policy *model.AccessControlPolicy) (*model.AccessControlPolicy, error)
	// GetPolicy retrieves the access control policy with the given ID.
	GetPolicy(rctx request.CTX, id string) (*model.AccessControlPolicy, error)
	// DeletePolicy deletes the access control policy with the given ID.
	DeletePolicy(rctx request.CTX, id string) error
}
