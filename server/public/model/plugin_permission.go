// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"sync"
)

const (
	// PluginPermissionIDSeparator namespaces a plugin-owned permission as "{pluginID}:{localID}".
	PluginPermissionIDSeparator = ":"

	// PluginRoleNamePrefix is prepended to the hashed plugin-id segment of a plugin-owned role name.
	PluginRoleNamePrefix = "p"

	MaxPluginPermissionsPerPlugin = 32
	MaxPluginRolesPerPlugin       = 8

	MaxPluginPermissionLocalIDLength = 64
	MaxPluginRoleLocalNameLength     = 32

	pluginRoleNameHashLength = 16
)

var pluginPermissionLocalIDRe = regexp.MustCompile(`^[a-z0-9]+(_[a-z0-9]+)*$`)

// PluginPermission is a permission registered by a plugin. PermissionId is the namespaced
// ID stored on roles ("{pluginID}:{localID}"). Id is the plugin-local identifier.
type PluginPermission struct {
	PluginId       string   `json:"plugin_id"`
	PluginName     string   `json:"plugin_name,omitempty"`
	Id             string   `json:"id"`
	PermissionId   string   `json:"permission_id"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	Scope          string   `json:"scope"`
	DefaultRoles   []string `json:"default_roles,omitempty"`
	Active         bool     `json:"active"`
	DefaultsApplied bool    `json:"-"`
	CreateAt       int64    `json:"create_at,omitempty"`
	UpdateAt       int64    `json:"update_at,omitempty"`
}

// PluginRoleOwnership maps a plugin-owned role's local name to the Roles.Name used in assignments.
type PluginRoleOwnership struct {
	PluginId  string `json:"plugin_id"`
	RoleName  string `json:"role_name"`
	LocalName string `json:"local_name"`
	CreateAt  int64  `json:"create_at,omitempty"`
}

// PluginRole is the plugin API payload for registering a custom role.
type PluginRole struct {
	Name        string   `json:"name"`
	DisplayName string   `json:"display_name"`
	Description string   `json:"description,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
}

// ManifestPermission is a permission declared in plugin.json.
type ManifestPermission struct {
	Id           string   `json:"id" yaml:"id"`
	Name         string   `json:"name" yaml:"name"`
	Description  string   `json:"description,omitempty" yaml:"description,omitempty"`
	Scope        string   `json:"scope" yaml:"scope"`
	DefaultRoles []string `json:"default_roles,omitempty" yaml:"default_roles,omitempty"`
}

// ManifestRole is a role declared in plugin.json.
type ManifestRole struct {
	Name        string   `json:"name" yaml:"name"`
	DisplayName string   `json:"display_name" yaml:"display_name"`
	Description string   `json:"description,omitempty" yaml:"description,omitempty"`
	Permissions []string `json:"permissions,omitempty" yaml:"permissions,omitempty"`
}

func PluginPermissionId(pluginID, localID string) string {
	return pluginID + PluginPermissionIDSeparator + localID
}

func SplitPluginPermissionId(permissionID string) (pluginID, localID string, ok bool) {
	pluginID, localID, found := strings.Cut(permissionID, PluginPermissionIDSeparator)
	if !found || !IsValidPluginId(pluginID) || !IsValidPluginPermissionLocalID(localID) {
		return "", "", false
	}
	return pluginID, localID, true
}

func IsValidPluginPermissionLocalID(id string) bool {
	if id == "" || len(id) > MaxPluginPermissionLocalIDLength {
		return false
	}
	return pluginPermissionLocalIDRe.MatchString(id)
}

func IsValidPluginRoleLocalName(name string) bool {
	if name == "" || len(name) > MaxPluginRoleLocalNameLength {
		return false
	}
	return pluginPermissionLocalIDRe.MatchString(name)
}

func IsValidPluginPermissionScope(scope string) bool {
	switch scope {
	case PermissionScopeSystem, PermissionScopeTeam, PermissionScopeChannel:
		return true
	default:
		return false
	}
}

// PluginRoleName returns the Roles.Name for a plugin-owned role. Role names are limited to
// [a-z0-9_] and 64 characters, so the plugin ID is hashed rather than inlined.
func PluginRoleName(pluginID, localName string) string {
	sum := sha256.Sum256([]byte(pluginID))
	return fmt.Sprintf("%s%s_%s", PluginRoleNamePrefix, hex.EncodeToString(sum[:])[:pluginRoleNameHashLength], localName)
}

func PluginPermissionNameI18nKey(permissionID string) string {
	return "admin.permissions.permission." + permissionID + ".name"
}

func PluginPermissionDescriptionI18nKey(permissionID string) string {
	return "admin.permissions.permission." + permissionID + ".description"
}

func PluginRoleNameI18nKey(roleName string) string {
	return "admin.permissions.roles." + roleName + ".name"
}

func PluginRoleDescriptionI18nKey(roleName string) string {
	return "admin.permissions.roles." + roleName + ".description"
}

func PluginPermissionGroupI18nKey(pluginID string) string {
	return "admin.permissions.groups." + pluginID + ".name"
}

// pluginPermissionRegistry is the overlay consulted by UnknownPermissions so plugin
// permission IDs remain valid while a plugin is disabled.
var pluginPermissionRegistry sync.RWMutex
var pluginPermissionsByID = map[string]*PluginPermission{}

func RegisterPluginPermissionInMemory(p *PluginPermission) {
	if p == nil || p.PermissionId == "" {
		return
	}
	copy := *p
	if p.DefaultRoles != nil {
		copy.DefaultRoles = append([]string(nil), p.DefaultRoles...)
	}
	pluginPermissionRegistry.Lock()
	pluginPermissionsByID[p.PermissionId] = &copy
	pluginPermissionRegistry.Unlock()
}

func UnregisterPluginPermissionsInMemory(pluginID string) {
	pluginPermissionRegistry.Lock()
	defer pluginPermissionRegistry.Unlock()
	for id, p := range pluginPermissionsByID {
		if p.PluginId == pluginID {
			delete(pluginPermissionsByID, id)
		}
	}
}

func SetPluginPermissionsActiveInMemory(pluginID string, active bool) {
	pluginPermissionRegistry.Lock()
	defer pluginPermissionRegistry.Unlock()
	for _, p := range pluginPermissionsByID {
		if p.PluginId == pluginID {
			p.Active = active
		}
	}
}

func GetRegisteredPluginPermission(permissionID string) *PluginPermission {
	pluginPermissionRegistry.RLock()
	defer pluginPermissionRegistry.RUnlock()
	p := pluginPermissionsByID[permissionID]
	if p == nil {
		return nil
	}
	copy := *p
	if p.DefaultRoles != nil {
		copy.DefaultRoles = append([]string(nil), p.DefaultRoles...)
	}
	return &copy
}

func IsRegisteredPluginPermission(permissionID string) bool {
	pluginPermissionRegistry.RLock()
	defer pluginPermissionRegistry.RUnlock()
	_, ok := pluginPermissionsByID[permissionID]
	return ok
}

func AllRegisteredPluginPermissions() []*PluginPermission {
	pluginPermissionRegistry.RLock()
	defer pluginPermissionRegistry.RUnlock()
	out := make([]*PluginPermission, 0, len(pluginPermissionsByID))
	for _, p := range pluginPermissionsByID {
		copy := *p
		if p.DefaultRoles != nil {
			copy.DefaultRoles = append([]string(nil), p.DefaultRoles...)
		}
		out = append(out, &copy)
	}
	return out
}

func CountRegisteredPluginPermissions(pluginID string) int {
	pluginPermissionRegistry.RLock()
	defer pluginPermissionRegistry.RUnlock()
	n := 0
	for _, p := range pluginPermissionsByID {
		if p.PluginId == pluginID {
			n++
		}
	}
	return n
}

// ResetPluginPermissionRegistryForTest clears the in-memory catalog. Tests only.
func ResetPluginPermissionRegistryForTest() {
	pluginPermissionRegistry.Lock()
	pluginPermissionsByID = map[string]*PluginPermission{}
	pluginPermissionRegistry.Unlock()
}
