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
	// GetTeamMembersToRemove retrieves the team members that need to be removed from the given team.
	GetTeamMembersToRemove(rctx request.CTX, teamID string) ([]*model.TeamMember, *model.AppError)
	// SavePolicy saves the given access control policy.
	SavePolicy(rctx request.CTX, policy *model.AccessControlPolicy) (*model.AccessControlPolicy, *model.AppError)
	// GetPolicy retrieves the access control policy with the given ID.
	GetPolicy(rctx request.CTX, id string) (*model.AccessControlPolicy, *model.AppError)
	// DeletePolicy deletes the access control policy with the given ID.
	DeletePolicy(rctx request.CTX, id string) *model.AppError
	// GetPoliciesForFieldIDs returns the policies that reference any of the given
	// property field IDs in their CEL rule expressions.
	GetPoliciesForFieldIDs(rctx request.CTX, fieldIDs []string) ([]*model.AccessControlPolicy, *model.AppError)
	// SimulatePolicyForUsers evaluates a DRAFT policy against an explicit
	// user list (with optional per-user session attribute overrides) and
	// returns per-user, per-action ALLOW/DENY decisions plus blame
	// attribution. The draft is compiled in-memory only; nothing is
	// persisted. Backs the picker-based "Simulate access" UX in the
	// System Console and Channel Settings.
	SimulatePolicyForUsers(rctx request.CTX, params model.PolicySimulationByUsersParams) (*model.PolicySimulationResponse, *model.AppError)

	// OnPropertyFieldOptionsChanged signals the access control service that
	// a property field's options changed (e.g. an admin re-ranked or
	// renamed options on a rank-typed field). The service invalidates any
	// cached per-field metadata and clears compiled-policy cache entries
	// for policies that reference the field so subsequent evaluations
	// re-read the authoritative values. Safe to call for any field type;
	// the service no-ops for fields it does not track.
	OnPropertyFieldOptionsChanged(rctx request.CTX, fieldID string)

	// HasMaskedValuesForCaller reports whether expression contains any literal
	// value hidden from the caller according to resolver. Returns an error when
	// field resolution or CEL parsing fails — callers must treat any error as
	// fail-closed (assume values are hidden).
	HasMaskedValuesForCaller(rctx request.CTX, expression string, resolver model.MaskingFieldResolver) (bool, *model.AppError)

	// MaskExpressionForCaller rewrites hidden literal values in expression to
	// the masked token and returns the modified CEL string. The logical tree
	// shape is preserved (|| / grouping / function calls are not flattened).
	MaskExpressionForCaller(rctx request.CTX, expression string, resolver model.MaskingFieldResolver) (string, bool, *model.AppError)

	// ValidateExpressionValuesForCaller walks expression and returns an error
	// if any non-token literal is forbidden for the caller under resolver's
	// visibility rules.
	ValidateExpressionValuesForCaller(rctx request.CTX, expression string, resolver model.MaskingFieldResolver) *model.AppError

	// MergeExpressionWithMaskedValuesCanonical re-injects hidden stored
	// literals from storedExpr into submittedExpr using a canonical CEL AST
	// walk. Returns the merged CEL string. Fails closed when the submitted
	// tree's shape diverges from stored while hidden values are present.
	MergeExpressionWithMaskedValuesCanonical(rctx request.CTX, submittedExpr, storedExpr string, resolver model.MaskingFieldResolver) (string, *model.AppError)
}
