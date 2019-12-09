// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package localcachelayer

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type LocalCacheRoleStore struct {
	store.RoleStore
	rootStore *LocalCacheStore
}

func (s *LocalCacheRoleStore) handleClusterInvalidateRole(msg *model.ClusterMessage) {
	if msg.Data == CLEAR_CACHE_MESSAGE_DATA {
		s.rootStore.roleCache.Purge()
	} else {
		s.rootStore.roleCache.Remove(msg.Data)
	}
}

func (s LocalCacheRoleStore) Save(role *model.Role) (*model.Role, *model.AppError) {
	if len(role.Name) != 0 {
		defer s.rootStore.doInvalidateCacheCluster(s.rootStore.roleCache, role.Name)
	}
	return s.RoleStore.Save(role)
}

func (s LocalCacheRoleStore) GetByName(name string) (*model.Role, *model.AppError) {
	if role := s.rootStore.doStandardReadCache(s.rootStore.roleCache, name); role != nil {
		return role.(*model.Role), nil
	}

	role, err := s.RoleStore.GetByName(name)
	if err != nil {
		return nil, err
	}
	s.rootStore.doStandardAddToCache(s.rootStore.roleCache, name, role)
	return role, nil
}

func (s LocalCacheRoleStore) GetByNames(names []string) ([]*model.Role, *model.AppError) {
	var foundRoles []*model.Role
	var rolesToQuery []string

	for _, roleName := range names {
		if role := s.rootStore.doStandardReadCache(s.rootStore.roleCache, roleName); role != nil {
			foundRoles = append(foundRoles, role.(*model.Role))
		} else {
			rolesToQuery = append(rolesToQuery, roleName)
		}
	}

	roles, _ := s.RoleStore.GetByNames(rolesToQuery)

	for _, role := range roles {
		s.rootStore.doStandardAddToCache(s.rootStore.roleCache, role.Name, role)
	}

	return append(foundRoles, roles...), nil
}

func (s LocalCacheRoleStore) Delete(roleId string) (*model.Role, *model.AppError) {
	role, err := s.RoleStore.Delete(roleId)

	if err == nil {
		s.rootStore.doInvalidateCacheCluster(s.rootStore.roleCache, role.Name)
	}
	return role, err
}

func (s LocalCacheRoleStore) PermanentDeleteAll() *model.AppError {
	defer s.rootStore.roleCache.Purge()
	defer s.rootStore.doClearCacheCluster(s.rootStore.roleCache)

	return s.RoleStore.PermanentDeleteAll()
}
