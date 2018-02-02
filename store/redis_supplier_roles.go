// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"
	"fmt"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/mattermost-server/model"
)

func (s *RedisSupplier) RoleSave(ctx context.Context, role *model.Role, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	if err := s.client.Del(buildRedisKeyForRoleName(role.Name)).Err(); err != nil {
		l4g.Error("Redis failed to remove key roles:" + role.Name + " Error: " + err.Error())
	}
	return s.Next().RoleSave(ctx, role, hints...)
}

func (s *RedisSupplier) RoleGet(ctx context.Context, roleId string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	// Roles are cached by name, as that is most commonly how they are looked up.
	// This means that no caching is supported on roles being looked up by ID.
	return s.Next().RoleGet(ctx, roleId, hints...)
}

func (s *RedisSupplier) RoleGetByName(ctx context.Context, name string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	var role *model.Role
	found, err := s.load(buildRedisKeyForRoleName(name), &role)
	if err != nil {
		l4g.Error("Redis encountered an error on read: " + err.Error())
	} else if found {
		result := NewSupplierResult()
		result.Data = role
		return result
	}

	result := s.Next().RoleGetByName(ctx, name, hints...)

	if result.Err == nil {
		if err := s.save(buildRedisKeyForRoleName(name), result.Data, REDIS_EXPIRY_TIME); err != nil {
			l4g.Error("Redis encountered and error on write: " + err.Error())
		}
	}

	return result
}

func (s *RedisSupplier) RoleGetByNames(ctx context.Context, roleNames []string, hints ...LayeredStoreHint) *LayeredStoreSupplierResult {
	var foundRoles []*model.Role
	var rolesToQuery []string

	for _, roleName := range roleNames {
		var role *model.Role
		found, err := s.load(buildRedisKeyForRoleName(roleName), &role)
		if err == nil && found {
			foundRoles = append(foundRoles, role)
		} else {
			rolesToQuery = append(rolesToQuery, roleName)
			if err != nil {
				l4g.Error("Redis encountered an error on read: " + err.Error())
			}
		}
	}

	result := s.Next().RoleGetByNames(ctx, rolesToQuery, hints...)

	if result.Err == nil {
		rolesFound := result.Data.([]*model.Role)
		for _, role := range rolesFound {
			if err := s.save(buildRedisKeyForRoleName(role.Name), role, REDIS_EXPIRY_TIME); err != nil {
				l4g.Error("Redis encountered and error on write: " + err.Error())
			}
		}
		result.Data = append(foundRoles, result.Data.([]*model.Role)...)
	}

	return result
}

func buildRedisKeyForRoleName(roleName string) string {
	return fmt.Sprintf("roles:%s", roleName)
}
