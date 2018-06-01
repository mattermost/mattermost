// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"

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
		defer s.doInvalidateCacheCluster(s.roleCache, role.Name)
	}
	return s.Next().RoleSave(ctx, role, hints...)
}

func (s *LocalCacheSupplier) RoleGet(ctx context.Context, roleId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// Roles are cached by name, as that is most commonly how they are looked up.
	// This means that no caching is supported on roles being looked up by ID.
	return s.Next().RoleGet(ctx, roleId, hints...)
}

func (s *LocalCacheSupplier) RoleGetByName(ctx context.Context, name string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	if result := s.doStandardReadCache(ctx, s.roleCache, name, hints...); result != nil {
		return result
	}

	result := s.Next().RoleGetByName(ctx, name, hints...)

	s.doStandardAddToCache(ctx, s.roleCache, name, result, hints...)

	return result
}

func (s *LocalCacheSupplier) RoleGetByNames(ctx context.Context, roleNames []string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	var foundRoles []*model.Role
	var rolesToQuery []string

	for _, roleName := range roleNames {
		if result := s.doStandardReadCache(ctx, s.roleCache, roleName, hints...); result != nil {
			foundRoles = append(foundRoles, result.Data.(*model.Role))
		} else {
			rolesToQuery = append(rolesToQuery, roleName)
		}
	}

	result := s.Next().RoleGetByNames(ctx, rolesToQuery, hints...)

	if result.Data != nil {
		rolesFound := result.Data.([]*model.Role)
		for _, role := range rolesFound {
			res := NewSupplierResult()
			res.Data = role
			s.doStandardAddToCache(ctx, s.roleCache, role.Name, res, hints...)
		}
		result.Data = append(foundRoles, result.Data.([]*model.Role)...)
	}

	return result
}

func (s *LocalCacheSupplier) RoleDelete(ctx context.Context, roleId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	result := s.Next().RoleDelete(ctx, roleId, hints...)

	if result.Err == nil {
		role := result.Data.(*model.Role)
		s.doInvalidateCacheCluster(s.roleCache, role.Name)
	}

	return result
}

func (s *LocalCacheSupplier) RolePermanentDeleteAll(ctx context.Context, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	defer s.roleCache.Purge()
	defer s.doClearCacheCluster(s.roleCache)

	return s.Next().RolePermanentDeleteAll(ctx, hints...)
}
