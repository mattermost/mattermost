// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

// AccessDecisionInvalidator is the app layer's ABAC decision cache. Platform calls it on the
// node where a change happened; the app layer broadcasts it.
type AccessDecisionInvalidator interface {
	InvalidateAccessDecisionsForUser(userID string)
	InvalidateAccessDecisionsForSession(sessionID string)
	// InvalidateAllAccessDecisions with broadcast false is for callers that run on every node.
	InvalidateAllAccessDecisions(broadcast bool)
}

// SetAccessDecisionInvalidator must be called during server construction.
func (ps *PlatformService) SetAccessDecisionInvalidator(inv AccessDecisionInvalidator) {
	ps.accessDecisionInvalidator = inv
}

func (ps *PlatformService) invalidateAccessDecisionsForUser(userID string) {
	if ps.accessDecisionInvalidator != nil {
		ps.accessDecisionInvalidator.InvalidateAccessDecisionsForUser(userID)
	}
}

func (ps *PlatformService) invalidateAccessDecisionsForSession(sessionID string) {
	if ps.accessDecisionInvalidator != nil {
		ps.accessDecisionInvalidator.InvalidateAccessDecisionsForSession(sessionID)
	}
}

func (ps *PlatformService) invalidateAllAccessDecisions(broadcast bool) {
	if ps.accessDecisionInvalidator != nil {
		ps.accessDecisionInvalidator.InvalidateAllAccessDecisions(broadcast)
	}
}
