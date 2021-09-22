package model

import (
	"encoding/json"
	"strings"
)

type Scope []string

const (
	ScopeChannelJoin  = "channels:join"
	ScopeMessageRead  = "message:read"
	ScopeMessageWrite = "message:write"
	ScopeFilesRead    = "files:read"
	ScopeFilesWrite   = "files:write"
	ScopeSearchPosts  = "search:post"
)

func ScopeAny(scopes ...string) Scope {
	return scopes
}

func ScopeAllow() Scope {
	return Scope{}
}

func ScopeDeny() Scope {
	return nil
}

func (s Scope) IsInScope(scope string) bool {
	if s == nil {
		return false
	}

	for _, allowed := range s {
		if scope == allowed {
			return true
		}
	}

	return false
}

func (s Scope) IsPluginInScope(pluginID string) bool {
	if s == nil {
		return false
	}

	for _, allowed := range s {
		if strings.HasPrefix(allowed, "plugin:") &&
			strings.TrimPrefix(allowed, "plugin:") == pluginID {
			return true
		}
	}

	return false
}

func (s Scope) Intersection(scope Scope) Scope {
	if s == nil || scope == nil {
		return ScopeDeny()
	}

	out := Scope{}
	for _, x := range s {
		if scope.IsInScope(x) {
			out = append(out, x)
		}
	}

	if len(out) == 0 {
		return ScopeDeny()
	}

	return out
}

func (s Scope) ToJSON() string {
	bytes, err := json.Marshal(s)
	if err != nil {
		return ""
	}
	return string(bytes)
}

func ScopeFromJSON(in string) (Scope, error) {
	var scope = Scope{}
	err := json.Unmarshal([]byte(in), &scope)
	if err != nil {
		return nil, err
	}
	return scope, nil
}

func (s Scope) Validate() bool {
	validScopes := Scope{
		ScopeChannelJoin,
		ScopeMessageRead,
		ScopeMessageWrite,
		ScopeFilesRead,
		ScopeFilesWrite,
		ScopeSearchPosts,
	}

	for _, scope := range s {
		// Scopes as "plugin:plugin_id" that allow to access that plugin API
		if strings.HasPrefix(scope, "plugin:") {
			continue
		}
		// Scopes as "pluginscope:scope_name". These will be for plugins to interpret.
		if strings.HasPrefix(scope, "pluginscope:") {
			continue
		}
		if !validScopes.IsInScope(scope) {
			return false
		}
	}

	return true
}

func (s Scope) Equals(s2 Scope) bool {
	// TODO OAUTH confirm this is true
	if s == nil {
		return s2 == nil
	}
	return len(s) == len(s2) && len(s) == len(s.Intersection(s2))
}

func (s Scope) IsSuperset(s2 Scope) bool {
	if s == nil {
		return s2 == nil
	}

	if len(s2) > len(s) {
		return false
	}

	for _, ss2 := range s2 {
		if !s.IsInScope(ss2) {
			return false
		}
	}

	return true
}

func (s Scope) Normalize() Scope {
	if s == nil {
		return nil
	}

	out := Scope{}

OUTER:
	for _, inScope := range s {
		for _, outScope := range out {
			if inScope == outScope {
				continue OUTER
			}
		}

		out = append(out, inScope)
	}

	return out
}
