// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"bytes"
	"context"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

type LocalCacheRoleStore struct {
	store.RoleStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheRoleStore) handleClusterInvalidateRole(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.roleCache.Purge()
	} else {
		s.rootStore.roleCache.Remove(string(msg.Data))
	}
}

func (s *LocalCacheRoleStore) handleClusterInvalidateRolePermissions(msg *model.ClusterMessage) {
	if bytes.Equal(msg.Data, clearCacheMessageData) {
		s.rootStore.rolePermissionsCache.Purge()
	} else {
		s.rootStore.rolePermissionsCache.Remove(string(msg.Data))
	}
}

func (s LocalCacheRoleStore) Save(role *model.Role) (*model.Role, error) {
	if role.Name != "" {
		defer s.rootStore.doInvalidateCacheCluster(s.rootStore.roleCache, role.Name, nil)
		defer s.rootStore.doClearCacheCluster(s.rootStore.rolePermissionsCache)
	}
	return s.RoleStore.Save(role)
}

func (s LocalCacheRoleStore) GetByName(ctx context.Context, name string) (*model.Role, error) {
	var role *model.Role
	if err := s.rootStore.doStandardReadCache(s.rootStore.roleCache, name, &role); err == nil {
		return role, nil
	}

	role, err := s.RoleStore.GetByName(ctx, name)
	if err != nil {
		return nil, err
	}
	s.rootStore.doStandardAddToCache(s.rootStore.roleCache, name, role)
	return role, nil
}

func (s LocalCacheRoleStore) GetByNames(names []string) ([]*model.Role, error) {
	var foundRoles []*model.Role
	var rolesToQuery []string

	toPass := allocateCacheTargets[*model.Role](len(names))
	errs := s.rootStore.doMultiReadCache(s.rootStore.roleCache, names, toPass)
	for i, err := range errs {
		if err != nil {
			if err != cache.ErrKeyNotFound {
				s.rootStore.logger.Warn("Error in Rolestore.GetByNames: ", mlog.Err(err))
			}
			rolesToQuery = append(rolesToQuery, names[i])
		} else {
			gotRole := *(toPass[i].(**model.Role))
			if gotRole != nil {
				foundRoles = append(foundRoles, gotRole)
				continue
			}
			s.rootStore.logger.Warn("Found nil role in GetByNames. This is not expected")
		}
	}

	if len(rolesToQuery) == 0 {
		return foundRoles, nil
	}

	roles, err := s.RoleStore.GetByNames(rolesToQuery)
	if err != nil {
		return nil, err
	}

	for _, role := range roles {
		s.rootStore.doStandardAddToCache(s.rootStore.roleCache, role.Name, role)
	}

	return append(foundRoles, roles...), nil
}

func (s LocalCacheRoleStore) Delete(roleId string) (*model.Role, error) {
	role, err := s.RoleStore.Delete(roleId)

	if err == nil {
		s.rootStore.doInvalidateCacheCluster(s.rootStore.roleCache, role.Name, nil)
		defer s.rootStore.doClearCacheCluster(s.rootStore.rolePermissionsCache)
	}
	return role, err
}

func (s LocalCacheRoleStore) PermanentDeleteAll() error {
	defer s.rootStore.roleCache.Purge()
	defer s.rootStore.doClearCacheCluster(s.rootStore.roleCache)
	defer s.rootStore.doClearCacheCluster(s.rootStore.rolePermissionsCache)

	return s.RoleStore.PermanentDeleteAll()
}

func (s LocalCacheRoleStore) ChannelHigherScopedPermissions(roleNames []string) (map[string]*model.RolePermissions, error) {
	sort.Strings(roleNames)
	cacheKey := strings.Join(roleNames, "/")
	var rolePermissionsMap map[string]*model.RolePermissions
	if err := s.rootStore.doStandardReadCache(s.rootStore.rolePermissionsCache, cacheKey, &rolePermissionsMap); err == nil {
		return rolePermissionsMap, nil
	}

	rolePermissionsMap, err := s.RoleStore.ChannelHigherScopedPermissions(roleNames)
	if err != nil {
		return nil, err
	}

	s.rootStore.doStandardAddToCache(s.rootStore.rolePermissionsCache, cacheKey, rolePermissionsMap)
	return rolePermissionsMap, nil
}
