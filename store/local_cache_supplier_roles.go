// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
)

func (s *LocalCacheSupplier) handleClusterInvalidateRole(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.roleCache.Purge()
	} else {
		s.roleCache.Remove(msg.Data)
	}
}

func (s *LocalCacheSupplier) RoleSave(ctx context.Context, role *model.Role, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	if len(role.Id) != 0 {
		s.doInvalidateCacheCluster(s.roleCache, role.Name)
	}
	return s.Next().RoleSave(ctx, role, hints...)
}

func (s *LocalCacheSupplier) RoleGet(ctx context.Context, roleId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// TODO: No caching. Remove this method altogether from the store.
	return s.Next().RoleGet(ctx, roleId, hints...)
}

func (s *LocalCacheSupplier) RoleGetByName(ctx context.Context, name string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	if result := s.doStandardReadCache(ctx, s.reactionCache, name, hints...); result != nil {
		return result
	}

	result := s.Next().RoleGetByName(ctx, name, hints...)

	s.doStandardAddToCache(ctx, s.reactionCache, name, result, hints...)

	return result
}

func (s *LocalCacheSupplier) RoleGetByNames(ctx context.Context, roleNames []string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	var foundRoles model.Roles

	for _, roleName := range roleNames {
		if result := s.doStandardReadCache(ctx, s.reactionCache, roleName, hints...); result != nil {
			foundRoles = append(foundRoles, result.Data.(*model.Role))
		}
	}

	var rolesToQuery []string
	for _, roleName := range roleNames {
		found := false
		for _, role := range foundRoles {
			if roleName == role.Name {
				l4g.Debug("Found a role in the cache")
				found = true
				break
			}
		}
		if !found {
			rolesToQuery = append(rolesToQuery, roleName)
		}
	}

	result := s.Next().RoleGetByNames(ctx, rolesToQuery, hints...)

	if result.Data != nil {
		rolesFound := result.Data.(model.Roles)
		for _, role := range rolesFound {
			res := NewSupplierResult()
			res.Data = role
			s.doStandardAddToCache(ctx, s.roleCache, role.Name, res, hints...)
		}
		result.Data = append(foundRoles, result.Data.(model.Roles)...)
	}

	return result
}
