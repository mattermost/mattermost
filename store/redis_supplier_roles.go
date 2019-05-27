// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"context"
	"fmt"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

func (s *RedisSupplier) RoleSave(ctx context.Context, role *model.Role, hints ...LayeredStoreHint) (*model.Role, *model.AppError) {
	key := buildRedisKeyForRoleName(role.Name)

	defer func() {
		if err := s.client.Del(key).Err(); err != nil {
			mlog.Error("Redis failed to remove key " + key + " Error: " + err.Error())
		}
	}()

	return s.Next().RoleSave(ctx, role, hints...)
}

func (s *RedisSupplier) RoleGet(ctx context.Context, roleId string, hints ...LayeredStoreHint) (*model.Role, *model.AppError) {
	// Roles are cached by name, as that is most commonly how they are looked up.
	// This means that no caching is supported on roles being looked up by ID.
	return s.Next().RoleGet(ctx, roleId, hints...)
}

func (s *RedisSupplier) RoleGetAll(ctx context.Context, hints ...LayeredStoreHint) ([]*model.Role, *model.AppError) {
	// Roles are cached by name, as that is most commonly how they are looked up.
	// This means that no caching is supported on roles being listed.
	return s.Next().RoleGetAll(ctx, hints...)
}

func (s *RedisSupplier) RoleGetByName(ctx context.Context, name string, hints ...LayeredStoreHint) (*model.Role, *model.AppError) {
	key := buildRedisKeyForRoleName(name)

	var role *model.Role
	found, err := s.load(key, &role)
	if err != nil {
		mlog.Error("Redis encountered an error on read: " + err.Error())
	} else if found {
		return role, nil
	}

	role, appErr := s.Next().RoleGetByName(ctx, name, hints...)

	if appErr == nil {
		if err := s.save(key, role, REDIS_EXPIRY_TIME); err != nil {
			mlog.Error("Redis encountered and error on write: " + err.Error())
		}
	}

	return role, appErr
}

func (s *RedisSupplier) RoleGetByNames(ctx context.Context, roleNames []string, hints ...LayeredStoreHint) ([]*model.Role, *model.AppError) {
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
				mlog.Error("Redis encountered an error on read: " + err.Error())
			}
		}
	}

	rolesFound, appErr := s.Next().RoleGetByNames(ctx, rolesToQuery, hints...)

	if appErr == nil {
		for _, role := range rolesFound {
			if err := s.save(buildRedisKeyForRoleName(role.Name), role, REDIS_EXPIRY_TIME); err != nil {
				mlog.Error("Redis encountered and error on write: " + err.Error())
			}
		}
		foundRoles = append(foundRoles, rolesFound...)
	}

	return foundRoles, appErr
}

func (s *RedisSupplier) RoleDelete(ctx context.Context, roleId string, hints ...LayeredStoreHint) (*model.Role, *model.AppError) {
	role, appErr := s.Next().RoleGet(ctx, roleId, hints...)

	if appErr == nil {
		defer func() {
			key := buildRedisKeyForRoleName(role.Name)

			if err := s.client.Del(key).Err(); err != nil {
				mlog.Error("Redis failed to remove key " + key + " Error: " + err.Error())
			}
		}()
	}

	return s.Next().RoleDelete(ctx, roleId, hints...)
}

func (s *RedisSupplier) RolePermanentDeleteAll(ctx context.Context, hints ...LayeredStoreHint) *model.AppError {
	defer func() {
		if keys, err := s.client.Keys("roles:*").Result(); err != nil {
			mlog.Error("Redis encountered an error on read: " + err.Error())
		} else {
			if err := s.client.Del(keys...).Err(); err != nil {
				mlog.Error("Redis encountered an error on delete: " + err.Error())
			}
		}
	}()

	return s.Next().RolePermanentDeleteAll(ctx, hints...)
}

func buildRedisKeyForRoleName(roleName string) string {
	return fmt.Sprintf("roles:%s", roleName)
}
