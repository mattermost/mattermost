// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

// AccessDecisionInvalidator is implemented by the app layer's access-control decision cache.
// Platform calls it from the invalidation paths it owns, on the node where the change happened;
// the app layer carries the change to the rest of the cluster.
type AccessDecisionInvalidator interface {
	// InvalidateAccessDecisionsForUser drops every cached decision whose subject is userID,
	// across all of the user's sessions.
	InvalidateAccessDecisionsForUser(userID string)
	// InvalidateAccessDecisionsForSession drops every cached decision for one session.
	InvalidateAccessDecisionsForSession(sessionID string)
	// InvalidateAllAccessDecisions drops every cached decision. With broadcast false the
	// change is applied on this node only, for callers that already run on every node.
	InvalidateAllAccessDecisions(broadcast bool)
}

// SetAccessDecisionInvalidator sets the access-control decision cache platform notifies. It must
// be called during server construction, before any traffic.
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
