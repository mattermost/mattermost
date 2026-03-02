// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

const PolicyScopeCacheSize = 10000
const PolicyScopeCacheDuration = 15 * time.Minute

// policyScopeCache caches the derived team scope for policies.
// Key: policyID (string)
// Value: teamID (string) - empty string means system-scoped
var policyScopeCache = cache.NewLRU(&cache.CacheOptions{
	Size:                   PolicyScopeCacheSize,
	DefaultExpiry:          PolicyScopeCacheDuration,
	Name:                   "PolicyScope",
	InvalidateClusterEvent: model.ClusterEventInvalidateCacheForPolicyScope,
})

func PurgePolicyScopeCache() error {
	return policyScopeCache.Purge()
}

func PolicyScopeCache() cache.Cache {
	return policyScopeCache
}

// InvalidatePolicyScopeCacheSkipClusterSend invalidates the policy scope cache locally
// without broadcasting to the cluster. Used by cluster message handlers.
func (ps *PlatformService) InvalidatePolicyScopeCacheSkipClusterSend(policyID string) {
	if policyID == "" {
		// Purge all
		if err := PurgePolicyScopeCache(); err != nil {
			ps.logger.Warn("Failed to purge policy scope cache", mlog.Err(err))
		}
	} else {
		// Invalidate specific policy
		if err := PolicyScopeCache().Remove(policyID); err != nil {
			ps.logger.Warn("Failed to invalidate policy scope cache",
				mlog.String("policy_id", policyID), mlog.Err(err))
		}
	}
}

// InvalidatePolicyScopeCacheForPolicy invalidates the policy scope cache on this node
// and broadcasts the invalidation to all cluster nodes.
//
// This should be called when:
// - Policy channels are assigned/unassigned
// - A channel's team membership changes
// - A policy is deleted
func (ps *PlatformService) InvalidatePolicyScopeCacheForPolicy(policyID string) {
	// Invalidate locally
	if err := PolicyScopeCache().Remove(policyID); err != nil {
		ps.logger.Warn("Failed to invalidate local policy scope cache", mlog.String("policy_id", policyID), mlog.Err(err))
	}

	// Broadcast to cluster
	if ps.clusterIFace != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventInvalidateCacheForPolicyScope,
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(policyID),
		}
		ps.clusterIFace.SendClusterMessage(msg)
	}
}
