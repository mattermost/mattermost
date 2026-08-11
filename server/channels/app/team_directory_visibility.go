// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// teamVisibilityCacheKey is the per-request request.CTX value key used to
// memoise PDP membership decisions across the N+1 team filtering work in a
// single directory/search load.
type teamVisibilityCacheKey struct{}

type teamVisibilityCache struct {
	mu        sync.Mutex
	decisions map[string]bool
}

func getTeamVisibilityCache(rctx request.CTX) *teamVisibilityCache {
	if v := rctx.Context().Value(teamVisibilityCacheKey{}); v != nil {
		if cache, ok := v.(*teamVisibilityCache); ok {
			return cache
		}
	}
	return nil
}

// withTeamVisibilityCache returns a request context that memoises PDP membership
// decisions across the visibility filter calls in a single request. It's safe to
// call multiple times — only the outermost installation allocates a cache.
func withTeamVisibilityCache(rctx request.CTX) request.CTX {
	if getTeamVisibilityCache(rctx) != nil {
		return rctx
	}
	cache := &teamVisibilityCache{decisions: map[string]bool{}}
	return rctx.WithContext(context.WithValue(rctx.Context(), teamVisibilityCacheKey{}, cache))
}

func (c *teamVisibilityCache) get(teamID string) (bool, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	v, ok := c.decisions[teamID]
	return v, ok
}

func (c *teamVisibilityCache) set(teamID string, allow bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.decisions[teamID] = allow
}

// evaluateTeamMembership runs the ABAC membership decision for user against team.
// Mirrors evaluateChannelMembership; the empty channelID means no channel-scoped
// role is attached (team membership evaluates identity attributes only).
// Fail-secure: a missing service denies.
func (a *App) evaluateTeamMembership(rctx request.CTX, user *model.User, team *model.Team) (bool, *model.AppError) {
	acs := a.Srv().Channels().AccessControl
	if acs == nil {
		return false, nil
	}

	subject, appErr := a.BuildAccessControlSubject(rctx, user.Id, user.Roles, "")
	if appErr != nil {
		return false, appErr
	}

	decision, evalErr := acs.AccessEvaluation(rctx, model.AccessRequest{
		Subject: *subject,
		Resource: model.Resource{
			Type: model.AccessControlPolicyTypeTeam,
			ID:   team.Id,
		},
		Action: model.AccessControlPolicyActionMembership,
	})
	if evalErr != nil {
		return false, evalErr
	}
	return decision.Decision, nil
}

// FilterNonQualifyingTeamsForUser removes from teams any policy-enforced team that
// userID is neither a member of nor qualifies to join — the directory
// non-disclosure invariant. Teams without an active policy are returned untouched,
// and existing members always retain visibility regardless of the policy decision.
// Hiding applies only to non-public teams: on a public team the policy is advisory,
// so the team stays visible to everyone. Type and AllowOpenInvite are read to decide
// public vs. non-public, but never mutated.
//
// Failure modes are fail-secure: a missing AccessControl service, a subject-build
// failure, or any PDP error drops the offending team so a non-qualifying user can
// never be shown a governed team. Decisions are memoised per-request. Returns the
// trimmed list and the number of teams dropped so paginated callers can shrink the
// reported total.
func (a *App) FilterNonQualifyingTeamsForUser(rctx request.CTX, teams []*model.Team, userID string) ([]*model.Team, int, *model.AppError) {
	if len(teams) == 0 {
		return teams, 0, nil
	}

	if !a.TeamMembershipAccessControlEnabled() {
		return teams, 0, nil
	}

	rctx = withTeamVisibilityCache(rctx)
	cache := getTeamVisibilityCache(rctx)

	var (
		user       *model.User
		userErr    *model.AppError
		userOnce   sync.Once
		memberOf   map[string]bool
		memberErr  *model.AppError
		memberOnce sync.Once
		filtered   = make([]*model.Team, 0, len(teams))
		dropCount  int
	)

	for _, team := range teams {
		if team == nil {
			continue
		}

		if !team.PolicyEnforced {
			filtered = append(filtered, team)
			continue
		}

		// Public teams enforce the policy in advisory mode: it never hides the team.
		// Privacy follows master's open-directory model, which keys on
		// AllowOpenInvite alone.
		if team.AllowOpenInvite {
			filtered = append(filtered, team)
			continue
		}

		// Existing members keep visibility even if they would no longer qualify —
		// directory hiding governs discovery, not retention.
		memberOnce.Do(func() {
			members, err := a.GetTeamMembersForUser(rctx, userID, "", false)
			if err != nil {
				memberErr = err
				return
			}
			memberOf = make(map[string]bool, len(members))
			for _, m := range members {
				memberOf[m.TeamId] = true
			}
		})
		if memberErr != nil {
			return nil, 0, memberErr
		}
		if memberOf[team.Id] {
			filtered = append(filtered, team)
			continue
		}

		if cached, ok := cache.get(team.Id); ok {
			if cached {
				filtered = append(filtered, team)
			} else {
				dropCount++
			}
			continue
		}

		userOnce.Do(func() {
			user, userErr = a.GetUser(userID)
		})
		if userErr != nil {
			return nil, 0, userErr
		}

		decision, evalErr := a.evaluateTeamMembership(rctx, user, team)
		if evalErr != nil {
			rctx.Logger().Warn("FilterNonQualifyingTeamsForUser: PDP error, hiding team (fail-secure)",
				mlog.String("user_id", userID),
				mlog.String("team_id", team.Id),
				mlog.Err(evalErr),
			)
			cache.set(team.Id, false)
			dropCount++
			continue
		}
		cache.set(team.Id, decision)
		if decision {
			filtered = append(filtered, team)
		} else {
			dropCount++
		}
	}

	return filtered, dropCount, nil
}

// AnnotateRecommendedTeamsForUser sets Team.Recommended on public, policy-enforced
// teams that userID qualifies to join and is not already a member of. The flag is a
// transient per-viewer hint, never persisted and carrying no policy detail. Private
// teams are never annotated — they are hidden by the directory filter, not
// recommended. Decisions are memoised per-request, sharing the cache with the filter.
//
// Fail-secure: a missing AccessControl service, a member-lookup failure, a
// subject-build failure, or any PDP error leaves Recommended false, so a
// non-qualifying user is never tagged as recommended.
func (a *App) AnnotateRecommendedTeamsForUser(rctx request.CTX, teams []*model.Team, userID string) {
	if len(teams) == 0 || !a.TeamMembershipAccessControlEnabled() {
		return
	}

	rctx = withTeamVisibilityCache(rctx)
	cache := getTeamVisibilityCache(rctx)

	var (
		user       *model.User
		userErr    *model.AppError
		userOnce   sync.Once
		memberOf   map[string]bool
		memberErr  *model.AppError
		memberOnce sync.Once
	)

	for _, team := range teams {
		if team == nil || !team.PolicyEnforced {
			continue
		}

		// Only public (advisory) governed teams carry the tag; private governed
		// teams are hidden, never recommended. Privacy keys on AllowOpenInvite,
		// matching master's open-directory model.
		if !team.AllowOpenInvite {
			continue
		}

		// Suppress for current members — this also covers auto-added users, who
		// are members by the time they would be tagged.
		memberOnce.Do(func() {
			members, err := a.GetTeamMembersForUser(rctx, userID, "", false)
			if err != nil {
				memberErr = err
				return
			}
			memberOf = make(map[string]bool, len(members))
			for _, m := range members {
				memberOf[m.TeamId] = true
			}
		})
		if memberErr != nil {
			return
		}
		if memberOf[team.Id] {
			continue
		}

		if cached, ok := cache.get(team.Id); ok {
			team.Recommended = cached
			continue
		}

		userOnce.Do(func() {
			user, userErr = a.GetUser(userID)
		})
		if userErr != nil {
			return
		}

		decision, evalErr := a.evaluateTeamMembership(rctx, user, team)
		if evalErr != nil {
			rctx.Logger().Warn("AnnotateRecommendedTeamsForUser: PDP error, not recommending (fail-secure)",
				mlog.String("user_id", userID),
				mlog.String("team_id", team.Id),
				mlog.Err(evalErr),
			)
			cache.set(team.Id, false)
			continue
		}
		cache.set(team.Id, decision)
		team.Recommended = decision
	}
}
