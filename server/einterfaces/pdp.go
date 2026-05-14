// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// PolicyDecisionPointInterface is the service that evaluates access requests
// using the OpenID Auth API spec. It determines whether a subject can perform
// an action on a resource based on the resource policy.
type PolicyDecisionPointInterface interface {
	AccessEvaluation(rctx request.CTX, accessRequest model.AccessRequest) (model.AccessDecision, *model.AppError)
	// EvaluatePostPolicies returns whether the given post is allowed by every
	// post_filter rule on the channel's AccessControlPolicy (deny-wins). A
	// rule applies to a post only when the post carries at least one of the
	// post.attributes.* keys referenced by the rule. Any compile or eval
	// error is treated as a deny (fail-closed). Returns true when the
	// access-control service is not ready (no license, flag off) — callers
	// gate on the feature flag at the call site.
	EvaluatePostPolicies(rctx request.CTX, channelID string, post *model.PostWithValues, subject *model.Subject) (bool, *model.AppError)
}
