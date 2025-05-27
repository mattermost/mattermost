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
	Init(rctx request.CTX) *model.AppError
	// GetPolicyRuleAttributes retrieves the attributes of the given policy.
	// It returns a map of attribute names to their values for given action.
	GetPolicyRuleAttributes(rctx request.CTX, policyID string, action string) (map[string][]string, *model.AppError)
	// CheckExpression checks the validity of the given expression using the CEL engine.
	// It returns a list of CELExpressionError if the expression is invalid.
	// If the expression is valid, it returns an empty list.
	CheckExpression(rctx request.CTX, expression string) ([]model.CELExpressionError, *model.AppError)
	// ExpressionToVisualAST converts the given expression to a visual AST.
	ExpressionToVisualAST(rctx request.CTX, expression string) (*model.VisualExpression, *model.AppError)
	// NormalizePolicy normalizes the given policy by restoring ids back to names.
	NormalizePolicy(rctx request.CTX, policy *model.AccessControlPolicy) (*model.AccessControlPolicy, *model.AppError)
	// QueryUsersForExpression evaluates the given expression using the CEL engine.
	// It returns a list of users that match the expression.
	QueryUsersForExpression(rctx request.CTX, expression string, opts model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError)
	// QueryUsersForResource evaluates finds the users match to the resource.
	QueryUsersForResource(rctx request.CTX, resourceID, action string, opts model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError)
	// GetChannelMembersToRemove retrieves the channel members that need to be removed from the given channel.
	GetChannelMembersToRemove(rctx request.CTX, channelID string) ([]*model.ChannelMember, *model.AppError)
	// SavePolicy saves the given access control policy.
	SavePolicy(rctx request.CTX, policy *model.AccessControlPolicy) (*model.AccessControlPolicy, *model.AppError)
	// GetPolicy retrieves the access control policy with the given ID.
	GetPolicy(rctx request.CTX, id string) (*model.AccessControlPolicy, *model.AppError)
	// DeletePolicy deletes the access control policy with the given ID.
	DeletePolicy(rctx request.CTX, id string) *model.AppError
}
