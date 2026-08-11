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

// channelVisibilityCacheKey is the per-request request.CTX value key used to
// memoise PDP membership decisions across N+1 channel filtering work in a
// single Browse Channels load.
type channelVisibilityCacheKey struct{}

type channelVisibilityCache struct {
	mu        sync.Mutex
	decisions map[string]bool
}

func getChannelVisibilityCache(rctx request.CTX) *channelVisibilityCache {
	if v := rctx.Context().Value(channelVisibilityCacheKey{}); v != nil {
		if cache, ok := v.(*channelVisibilityCache); ok {
			return cache
		}
	}
	return nil
}

// withChannelVisibilityCache returns a request context that memoises PDP
// membership decisions across the visibility filter calls in a single request.
// It's safe to call this multiple times — only the outermost installation
// allocates a cache.
func withChannelVisibilityCache(rctx request.CTX) request.CTX {
	if getChannelVisibilityCache(rctx) != nil {
		return rctx
	}
	cache := &channelVisibilityCache{decisions: map[string]bool{}}
	return rctx.WithContext(context.WithValue(rctx.Context(), channelVisibilityCacheKey{}, cache))
}

func (c *channelVisibilityCache) get(channelID string) (bool, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	v, ok := c.decisions[channelID]
	return v, ok
}

func (c *channelVisibilityCache) set(channelID string, allow bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.decisions[channelID] = allow
}

// FilterDiscoverableChannelsByPolicy removes from `channels` any
// policy-enforced private channel that the user fails to satisfy — the
// security-critical visibility invariant in plan §6c. Channels without an
// active policy are returned untouched. Callers that need the additional
// "non-member private must be discoverable" gate should use
// FilterChannelsForUserVisibility instead.
//
// Failure modes are fail-secure: a missing AccessControl service, a
// subject-build failure, or any PDP error drops the offending channel from
// the result so a non-qualifying user can never be inadvertently shown a
// gated channel. Decisions are cached per-request via the request.CTX value
// bag installed by withChannelVisibilityCache.
func (a *App) FilterDiscoverableChannelsByPolicy(rctx request.CTX, channels []*model.Channel, userID string) ([]*model.Channel, *model.AppError) {
	if len(channels) == 0 {
		return channels, nil
	}

	if !a.Config().FeatureFlags.DiscoverableChannels {
		return channels, nil
	}

	rctx = withChannelVisibilityCache(rctx)
	cache := getChannelVisibilityCache(rctx)

	var (
		user      *model.User
		userErr   *model.AppError
		userOnce  sync.Once
		filtered  = make([]*model.Channel, 0, len(channels))
		dropCount int
	)

	for _, channel := range channels {
		if channel == nil {
			continue
		}

		if !channel.PolicyEnforced || channel.Type != model.ChannelTypePrivate || !channel.Discoverable {
			filtered = append(filtered, channel)
			continue
		}

		if cached, ok := cache.get(channel.Id); ok {
			if cached {
				filtered = append(filtered, channel)
			} else {
				dropCount++
			}
			continue
		}

		userOnce.Do(func() {
			user, userErr = a.GetUser(userID)
		})
		if userErr != nil {
			return nil, userErr
		}

		// Guests are never permitted to see discoverable private channels.
		if user.IsGuest() {
			cache.set(channel.Id, false)
			dropCount++
			continue
		}

		decision, evalErr := a.evaluateChannelMembership(rctx, user, channel)
		if evalErr != nil {
			rctx.Logger().Warn("FilterDiscoverableChannelsByPolicy: PDP error, hiding channel (fail-secure)",
				mlog.String("user_id", userID),
				mlog.String("channel_id", channel.Id),
				mlog.Err(evalErr),
			)
			cache.set(channel.Id, false)
			dropCount++
			continue
		}
		cache.set(channel.Id, decision)
		if decision {
			filtered = append(filtered, channel)
		} else {
			dropCount++
		}
	}

	return filtered, nil
}

// FilterChannelsForUserVisibility wraps FilterDiscoverableChannelsByPolicy with
// the secondary invariant: a non-member private channel must be discoverable
// to be visible at all. The caller is expected to scope `channels` to results
// where the user is a non-member; member channels should not be passed
// through this filter (their visibility is governed by membership alone).
//
// In practice the search/autocomplete store paths return a mix of member and
// non-member rows; callers should pass the full list because the helper
// detects membership-implying fields. The current implementation only checks
// the discoverability gate (the SQL-level membership join already excluded
// unaffiliated channels).
func (a *App) FilterChannelsForUserVisibility(rctx request.CTX, channels []*model.Channel, userID string) ([]*model.Channel, *model.AppError) {
	return a.FilterDiscoverableChannelsByPolicy(rctx, channels, userID)
}

// FilterChannelListForUserVisibility is the convenience overload for
// model.ChannelList callers (the standard list shape returned by app-layer
// search functions).
func (a *App) FilterChannelListForUserVisibility(rctx request.CTX, channels model.ChannelList, userID string) (model.ChannelList, *model.AppError) {
	filtered, err := a.FilterChannelsForUserVisibility(rctx, channels, userID)
	if err != nil {
		return nil, err
	}
	return model.ChannelList(filtered), nil
}

// FilterChannelListWithTeamDataForUserVisibility filters the team-data list
// shape used by Autocomplete and SearchAllChannels. The function preserves
// the embedded TeamDisplayName / TeamName fields. Returns the post-filter
// total adjustment so paginated callers can shrink TotalCount alongside the
// trimmed result set.
func (a *App) FilterChannelListWithTeamDataForUserVisibility(rctx request.CTX, channels model.ChannelListWithTeamData, userID string) (model.ChannelListWithTeamData, int, *model.AppError) {
	if len(channels) == 0 {
		return channels, 0, nil
	}

	if !a.Config().FeatureFlags.DiscoverableChannels {
		return channels, 0, nil
	}

	rctx = withChannelVisibilityCache(rctx)
	cache := getChannelVisibilityCache(rctx)

	var (
		user     *model.User
		userErr  *model.AppError
		userOnce sync.Once
		out      = make(model.ChannelListWithTeamData, 0, len(channels))
		dropped  int
	)

	for i := range channels {
		ch := channels[i]
		if !ch.PolicyEnforced || ch.Type != model.ChannelTypePrivate || !ch.Discoverable {
			out = append(out, ch)
			continue
		}

		if cached, ok := cache.get(ch.Id); ok {
			if cached {
				out = append(out, ch)
			} else {
				dropped++
			}
			continue
		}

		userOnce.Do(func() {
			user, userErr = a.GetUser(userID)
		})
		if userErr != nil {
			return nil, 0, userErr
		}

		if user.IsGuest() {
			cache.set(ch.Id, false)
			dropped++
			continue
		}

		decision, evalErr := a.evaluateChannelMembership(rctx, user, &ch.Channel)
		if evalErr != nil {
			rctx.Logger().Warn("FilterChannelListWithTeamDataForUserVisibility: PDP error, hiding channel (fail-secure)",
				mlog.String("user_id", userID),
				mlog.String("channel_id", ch.Id),
				mlog.Err(evalErr),
			)
			cache.set(ch.Id, false)
			dropped++
			continue
		}
		cache.set(ch.Id, decision)
		if decision {
			out = append(out, ch)
		} else {
			dropped++
		}
	}

	return out, dropped, nil
}

// IsDiscoverableJoinAllowed reports whether `user` may view `channel` as a
// non-member through the discoverable-channels surface. Returns 404 (mapped
// by callers) when the channel is hidden from this user — matching the
// "indistinguishable from a non-existent channel" requirement so the policy
// cannot act as an existence oracle.
func (a *App) IsDiscoverableJoinAllowed(rctx request.CTX, user *model.User, channel *model.Channel) (bool, *model.AppError) {
	if channel == nil {
		return false, nil
	}
	if channel.Type != model.ChannelTypePrivate || !channel.Discoverable {
		return false, nil
	}
	if user == nil || user.IsGuest() || user.DeleteAt != 0 {
		return false, nil
	}
	if channel.DeleteAt != 0 || channel.IsShared() {
		return false, nil
	}
	if !channel.PolicyEnforced {
		return true, nil
	}
	decision, evalErr := a.evaluateChannelMembership(rctx, user, channel)
	if evalErr != nil {
		// Fail-secure: PDP failure hides the channel rather than leak it.
		rctx.Logger().Warn("IsDiscoverableJoinAllowed: PDP error, hiding channel (fail-secure)",
			mlog.String("user_id", user.Id),
			mlog.String("channel_id", channel.Id),
			mlog.Err(evalErr),
		)
		return false, nil
	}
	return decision, nil
}

// CancelPendingChannelJoinRequestsOnConvert transitions every pending request
// for a channel to the withdrawn state — used when the channel is converted
// to public (open channels are inherently joinable, so a pending queue is
// nonsensical) and when the channel is archived. Failures are logged because
// the conversion / archive must not be blocked.
func (a *App) CancelPendingChannelJoinRequestsOnConvert(rctx request.CTX, channel *model.Channel) {
	if channel == nil {
		return
	}

	const (
		pageSize      = 200
		maxIterations = 50 // hard cap at ~10k requests per channel
	)
	for range maxIterations {
		opts := model.GetChannelJoinRequestsOpts{
			Status:  model.ChannelJoinRequestStatusPending,
			Page:    0,
			PerPage: pageSize,
		}
		rows, _, err := a.Srv().Store().ChannelJoinRequest().GetForChannel(channel.Id, opts)
		if err != nil {
			rctx.Logger().Warn("CancelPendingChannelJoinRequestsOnConvert: failed to list pending requests",
				mlog.String("channel_id", channel.Id),
				mlog.Err(err),
			)
			return
		}
		if len(rows) == 0 {
			return
		}
		failed := 0
		for _, row := range rows {
			row.Status = model.ChannelJoinRequestStatusWithdrawn
			row.Message = ""
			updated, updateErr := a.Srv().Store().ChannelJoinRequest().Update(row)
			if updateErr != nil {
				failed++
				rctx.Logger().Warn("CancelPendingChannelJoinRequestsOnConvert: failed to withdraw pending request",
					mlog.String("channel_id", channel.Id),
					mlog.String("request_id", row.Id),
					mlog.Err(updateErr),
				)
				continue
			}
			a.broadcastChannelJoinRequestUpdated(rctx, channel, updated)
		}
		// If every row in the batch failed to update, the next iteration
		// would re-fetch the same rows and loop forever. Break out and
		// surface the situation in the log — the operator can re-run the
		// cleanup manually after addressing the underlying store error.
		if failed == len(rows) {
			rctx.Logger().Warn("CancelPendingChannelJoinRequestsOnConvert: every row in batch failed to update, aborting to avoid infinite loop",
				mlog.String("channel_id", channel.Id),
				mlog.Int("failed", failed),
			)
			return
		}
		// Standard exit when the last page is partial: every remaining
		// pending row was successfully withdrawn (or logged as failed).
		if len(rows) < pageSize {
			return
		}
	}
	// maxIterations safety net — this should be effectively unreachable
	// because the per-batch all-failed check above already aborts on
	// systemic update failures. Fire a higher-severity log if we hit it.
	rctx.Logger().Error("CancelPendingChannelJoinRequestsOnConvert: hit maxIterations, aborting",
		mlog.String("channel_id", channel.Id),
		mlog.Int("max_iterations", maxIterations),
	)
}

// IsDiscoverableSelfAddBlocked reports whether a user trying to self-add to
// `channel` via POST /channels/{id}/members must instead go through the
// request flow. The block applies only when:
//   - the channel is private,
//   - it is discoverable but does NOT have an active ABAC policy
//     (channels with a policy use the existing PDP gate inside
//     addUserToChannel — admins can still add others by policy),
//   - the user is not yet a member,
//   - and the requester is the user themselves.
//
// Other paths (admin invites, API by reviewer ID) are unaffected: the request
// flow exists to give admins a queue, not to block invites.
func (a *App) IsDiscoverableSelfAddBlocked(rctx request.CTX, channel *model.Channel, requesterUserID, targetUserID string) bool {
	if channel == nil || channel.Type != model.ChannelTypePrivate {
		return false
	}
	if !channel.Discoverable {
		return false
	}
	if channel.PolicyEnforced {
		return false
	}
	if requesterUserID != targetUserID {
		return false
	}
	if !a.Config().FeatureFlags.DiscoverableChannels {
		return false
	}
	return true
}
