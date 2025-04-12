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
}
