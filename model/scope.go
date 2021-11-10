// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"database/sql/driver"
	"encoding/json"
	"sort"
	"strings"

	"github.com/pkg/errors"
)

type Scopes []Scope
type Scope string

const (
	ScopeChannelJoin  Scope = "channels:join"
	ScopeMessageRead  Scope = "message:read"
	ScopeMessageWrite Scope = "message:write"
	ScopeFilesRead    Scope = "files:read"
	ScopeFilesWrite   Scope = "files:write"
	ScopeSearchPosts  Scope = "search:post"

	PluginScopePrefix         = "plugin:"
	PluginSpecificScopePrefix = "pluginscope:"
)

func ScopeAny(scopes ...Scope) Scopes {
	return scopes
}

func ScopeAllow() Scopes {
	return Scopes{}
}

func ScopeDeny() Scopes {
	return nil
}

func NewPluginScope(pluginID string) Scope {
	return Scope(PluginScopePrefix + pluginID)
}

func NewPluginSpecificScope(pluginID, scopeName string) Scope {
	// This is valid since a plugin can't have a ":" in their ID
	return Scope(PluginSpecificScopePrefix + pluginID + ":" + scopeName)
}

func (s Scope) IsPluginScope() bool {
	return strings.HasPrefix(string(s), PluginScopePrefix)
}

func (s Scope) IsPluginSpecificScope() bool {
	return strings.HasPrefix(string(s), PluginSpecificScopePrefix)
}

func getPredefinedScopes() Scopes {
	return Scopes{
		ScopeChannelJoin,
		ScopeMessageRead,
		ScopeMessageWrite,
		ScopeFilesRead,
		ScopeFilesWrite,
		ScopeSearchPosts,
	}
}

func (s Scope) IsPredefinedScope() bool {
	return s.isInScope(getPredefinedScopes())
}

func (s Scope) IsScopeForPlugin(pluginID string) bool {
	return s.IsPluginScope() &&
		strings.TrimPrefix(string(s), PluginScopePrefix) == pluginID
}

// isInScope checks if a scope is in the scope list
func (s Scope) isInScope(scopes Scopes) bool {
	if scopes == nil {
		return false
	}

	for _, allowed := range scopes {
		if s == allowed {
			return true
		}
	}

	return false
}

func (ss Scopes) AreAllowed(allowed Scopes) bool {
	// To support legacy OAuth Apps, we consider nil scopes as a non-scoped OAuth App.
	if ss == nil {
		return true
	}

	// Allowed endpoints will just relay the scopes, in case there is any consideration to be made based on scopes.
	if allowed.Equals(ScopeAllow()) {
		return true
	}

	if allowed.Equals(ScopeDeny()) {
		return false
	}

	if len(ss.intersection(allowed)) == 0 {
		return false
	}

	return true
}

func (ss Scopes) IsPluginInScope(pluginID string) bool {
	if ss == nil {
		return true
	}

	for _, allowed := range ss {
		if allowed.IsScopeForPlugin(pluginID) {
			return true
		}
	}

	return false
}

func (ss Scopes) intersection(scope Scopes) Scopes {
	if ss == nil || scope == nil {
		return ScopeDeny()
	}

	out := Scopes{}
	for _, x := range ss {
		if x.isInScope(scope) {
			out = append(out, x)
		}
	}

	if len(out) == 0 {
		return ScopeDeny()
	}

	return out
}

func (ss Scopes) Validate() bool {
	for _, s := range ss {
		if !s.IsPluginScope() &&
			!s.IsPluginSpecificScope() &&
			!s.IsPredefinedScope() {
			return false
		}
	}

	return true
}

func (ss Scopes) Equals(ss2 Scopes) bool {
	if ss == nil {
		return ss2 == nil
	}

	if ss2 == nil {
		return false
	}

	return len(ss) == len(ss2) && len(ss) == len(ss.intersection(ss2))
}

func (ss Scopes) IsSuperset(ss2 Scopes) bool {
	if ss == nil {
		return true
	}

	if ss2 == nil {
		return false
	}

	if len(ss2) > len(ss) {
		return false
	}

	for _, s2 := range ss2 {
		if !s2.isInScope(ss) {
			return false
		}
	}

	return true
}

// Normalize removes all repeated scopes from a list of Scopes.
func (ss Scopes) Normalize() Scopes {
	if len(ss) == 0 {
		return ss
	}

	// https://github.com/golang/go/wiki/slicetricks#in-place-deduplicate-comparable
	sort.Slice(ss, func(i, j int) bool { return ss[i] < ss[j] })

	j := 0
	for i := 1; i < len(ss); i++ {
		if ss[j] == ss[i] {
			continue
		}
		j++
		// preserve the original data
		// in[i], in[j] = in[j], in[i]
		// only set what is required
		ss[j] = ss[i]
	}
	ss = ss[:j+1]
	return ss
}

// Value implements driver.Valuer interface for database conversions
func (ss Scopes) Value() (driver.Value, error) {
	if ss == nil {
		return nil, nil
	}

	b, err := json.Marshal(ss)
	if err != nil {
		return nil, err
	}

	return string(b), nil
}

// Scan implements sql.Scanner interface for database conversions
func (ss *Scopes) Scan(value interface{}) error {
	if value == nil {
		*ss = nil
		return nil
	}
	sv, err := driver.String.ConvertValue(value)
	if err != nil {
		return err
	}

	v, ok := sv.(string)
	if !ok {
		// MySQL seems to return this as a []byte
		vb, ok2 := sv.([]byte)
		if !ok2 {
			return errors.New("value cannot be converted to string")
		}
		v = string(vb)
	}

	scopes := Scopes{}
	err = json.Unmarshal([]byte(v), &scopes)
	if err != nil {
		return err
	}

	*ss = scopes
	return nil
}
