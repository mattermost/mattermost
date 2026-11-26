// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// PluginAccessControlEngineInterface serves plugin-owned access control policies
// (types "<pluginID>:<resourceType>"). Every method refuses non-plugin types, and
// is available whenever model.PluginAccessControlMode reports the type available
// and the engine is initialized; without conditionsAllowed only people-list rules
// ("true" or user.id in [...]) can be saved, checked, or evaluated.
//
// Callers must treat every error as a denial.
type PluginAccessControlEngineInterface interface {
	// PluginPolicyMode reports whether policies of policyType are available
	// and whether they may use attribute conditions. It is
	// model.PluginAccessControlMode plus a check that the engine is initialized.
	PluginPolicyMode(rctx request.CTX, policyType string) (available bool, conditionsAllowed bool)

	// EvaluatePluginResource decides accessRequest. It refuses a Resource.Type
	// that is not a plugin policy type.
	EvaluatePluginResource(rctx request.CTX, accessRequest model.AccessRequest) (model.AccessDecision, *model.AppError)

	// SavePluginPolicy creates or updates a plugin-owned policy. Without
	// conditionsAllowed it rejects any rule that is not a people-list rule.
	SavePluginPolicy(rctx request.CTX, policy *model.AccessControlPolicy) (*model.AccessControlPolicy, *model.AppError)

	// GetPluginPolicy returns the policy with the given ID. It returns 404 when
	// no such policy exists or the stored policy's type differs from policyType.
	GetPluginPolicy(rctx request.CTX, policyType, id string) (*model.AccessControlPolicy, *model.AppError)

	// DeletePluginPolicy deletes the policy with the given ID. It returns 404
	// when no such policy exists or the stored policy's type differs from policyType.
	DeletePluginPolicy(rctx request.CTX, policyType, id string) *model.AppError

	// CheckPluginExpression validates expression and returns its errors. With
	// forSearch it also applies the membership and search-lane checks.
	CheckPluginExpression(rctx request.CTX, policyType, expression string, forSearch bool) ([]model.CELExpressionError, *model.AppError)

	// QueryUsersForPluginExpression returns the users matching expression.
	QueryUsersForPluginExpression(rctx request.CTX, policyType, expression string, opts model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError)

	// QueryUsersForPluginResource resolves the stored rule for (resourceID,
	// action) and returns the users it allows. It returns no users for a rule
	// it would deny, such as a non-people-list rule while conditions are not allowed.
	QueryUsersForPluginResource(rctx request.CTX, policyType, resourceID, action string, opts model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError)
}
