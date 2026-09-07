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

	// ActionHasPermissionPolicy reports whether any active system-scoped permission
	// policy declares the given action. Enforcement gates use it as a cheap negative:
	// when no policy governs the action, there is nothing to decide and no subject
	// needs building. Implementations MUST report "governed" alongside any error, so
	// a caller that ignores the error falls through to a full evaluation instead of
	// skipping one that would have denied.
	ActionHasPermissionPolicy(rctx request.CTX, action string) (bool, *model.AppError)
}
