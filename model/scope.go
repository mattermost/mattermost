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

// Scope signifies a permission to perform a kind of an operation on a kind of a
// resource. It is represented as a string in the format "res:op" where "res" is
// a ScopeResource and "op" is a ScopeOperation (or a wildcard). Examples:
//  - "posts:read" is the scope for a read-only access to Posts.
//  - "users:*" is the scope for a all operations on Users.
//  - "channels:join" is the scope for joining Channels.
//
// When a scope is used to express a permission requested by the app, or a
// granted by a user it can use a "*" for the op to request/grant access to all
// operations on the resource. When a scope is used to express a permission
// required to access an API, wildcards are not allowed.
type Scope string

// ScopeResource represents the resource kind in a scope, the left-hand side of the
// "res:op" syntax. Examples: "posts", "channels", "teams".
type ScopeResource string

// ScopeOperation represents the operation kind in a scope, the right-hand side
// of the "res:op" syntax. Examples: "read", "create", "join".
type ScopeOperation string

const (
	ScopeAny          Scope          = "*:*"
	ScopeAnyOperation ScopeOperation = "*"
	ScopeAnyResource  ScopeResource  = "*"
	ScopeSeparator                   = ":"
)

const (
	ScopeChannels ScopeResource = "channels"
	ScopeFiles    ScopeResource = "files"
	ScopePosts    ScopeResource = "posts"
	ScopeTeams    ScopeResource = "teams"
	ScopeUsers    ScopeResource = "users"
	ScopeOAuth2   ScopeResource = "oauth2"
)

const (
	ScopeRead   ScopeOperation = "read"
	ScopeUpdate ScopeOperation = "update"
	ScopeCreate ScopeOperation = "create"
	ScopeDelete ScopeOperation = "delete"
	ScopeJoin   ScopeOperation = "join"
	ScopeSearch ScopeOperation = "search"
	ScopeManage ScopeOperation = "manage"
)

const (
	ScopeUsersAny       Scope = "users:*"
	ScopeUsersCreate    Scope = "users:create"
	ScopeUsersDelete    Scope = "users:delete"
	ScopeUsersRead      Scope = "users:read"
	ScopeUsersSearch    Scope = "users:search"
	ScopeUsersUpdate    Scope = "users:update"
	ScopePostsAny       Scope = "posts:*"
	ScopePostsCreate    Scope = "posts:create"
	ScopePostsDelete    Scope = "posts:delete"
	ScopePostsRead      Scope = "posts:read"
	ScopePostsSearch    Scope = "posts:search"
	ScopePostsUpdate    Scope = "posts:update"
	ScopeChannelsAny    Scope = "channels:*"
	ScopeChannelsCreate Scope = "channels:create"
	ScopeChannelsDelete Scope = "channels:delete"
	ScopeChannelsRead   Scope = "channels:read"
	ScopeChannelsSearch Scope = "channels:search"
	ScopeChannelsUpdate Scope = "channels:update"
	ScopeOAuth2Manage   Scope = "oauth2:manage"
)

var validScopes = map[ScopeResource][]ScopeOperation{
	ScopeUsers:    append(crudScopeOps, ScopeSearch),
	ScopeTeams:    append(crudScopeOps, ScopeJoin),
	ScopeChannels: append(crudScopeOps, ScopeJoin),
	ScopePosts:    append(crudScopeOps, ScopeSearch),
	ScopeFiles:    crudScopeOps,
	ScopeOAuth2:   {ScopeManage},
}

var crudScopeOps = []ScopeOperation{ScopeCreate, ScopeRead, ScopeUpdate, ScopeDelete}

func (r ScopeResource) Create() Scope { return r.NewScope(ScopeCreate) }
func (r ScopeResource) Read() Scope   { return r.NewScope(ScopeRead) }
func (r ScopeResource) Update() Scope { return r.NewScope(ScopeUpdate) }
func (r ScopeResource) Delete() Scope { return r.NewScope(ScopeDelete) }
func (r ScopeResource) Join() Scope   { return r.NewScope(ScopeJoin) }
func (r ScopeResource) Any() Scope    { return r.NewScope(ScopeAnyOperation) }

func (r ScopeResource) NewScope(op ScopeOperation) Scope {
	return Scope(r) + ScopeSeparator + Scope(op)
}

func (s Scope) Split() (ScopeResource, ScopeOperation) {
	res, op := "", ""
	ss := strings.Split(string(s), ScopeSeparator)
	if len(ss) > 0 {
		res = ss[0]
	}
	if len(ss) > 1 {
		op = ss[1]
	}
	return ScopeResource(res), ScopeOperation(op)
}

func (s Scope) Satisfies(other Scope) bool {
	res, op := s.Split()
	otherRes, otherOp := other.Split()

	return (res == ScopeAnyResource || res == otherRes) && (op == ScopeAnyOperation || op == otherOp)
}

// APIScopes is a set of scopes that a specific API requires. Nil means deny all
// OAuth2 app access. A special value of "*:*" allows the API access regardless
// of the granted scope.
type APIScopes []Scope

// ScopeInternalAPI marks an API as internal and therefore not available to OAuth2 clients.
var ScopeInternalAPI = APIScopes(nil)

// ScopeUnrestricted marks an API as unrestricted and therefore available to
// OAuth2 clients, regardless of their granted scopes.
var ScopeUnrestrictedAPI = APIScopes{ScopeAny}

func NormalizeAPIScopes(source []Scope) (APIScopes, error) {
	normal := normalizeScopes(source)
	for _, s := range normal {
		res, op, err := parseScope(string(s))
		if err != nil {
			return nil, err
		}
		if res != ScopeAnyResource && op == ScopeAnyOperation {
			return nil, errors.Errorf("API scopes cannot contain a wildcard operation: %q", s)
		}
	}
	return APIScopes(normal), nil
}

func (ss APIScopes) IsInternal() bool {
	return len(ss) == 0
}

func (ss APIScopes) IsUnrestricted() bool {
	return len(ss) == 1 && ss[0] == ScopeAny
}

// AppScopes is a set of scopes that a specific OAuth2 app requires (and is
// granted by admin's consent). For backwards compatibility, an empty AppScopes
// is equivalent to "*:*", meaning the app requests access to all available
// APIs.
type AppScopes []Scope

var ScopeUnrestrictedApp = AppScopes{ScopeAny}

func ParseAppScopes(str string) (AppScopes, error) {
	scopes := []Scope{}
	for _, s := range strings.Fields(str) {
		res, op, err := parseScope(s)
		if err != nil {
			return nil, err
		}
		scopes = append(scopes, res.NewScope(op))
	}
	scopes = normalizeScopes(scopes)
	return AppScopes(scopes), nil
}

func (ss AppScopes) Validate() error {
	for _, s := range ss {
		_, _, err := parseScope(string(s))
		if err != nil {
			return err
		}
	}
	return nil
}

func (ss AppScopes) IsUnrestricted() bool {
	return len(ss) == 0 ||
		(len(ss) == 1 && ss[0] == ScopeAny)
}

func (ss AppScopes) Satisfies(need APIScopes) bool {
	if need.IsInternal() {
		return false
	}
	if need.IsUnrestricted() || ss.IsUnrestricted() {
		return true
	}
	return ss.IsSuperset(need)
}

func (ss AppScopes) IsSuperset(other []Scope) bool {
	// both ss and other must be already normalized (and sorted).
	i := 0
	for _, s := range other {
		for {
			if i >= len(ss) {
				return false
			}
			if ss[i].Satisfies(s) {
				break
			}
			i++
		}
	}
	return true
}

func parseScope(str string) (ScopeResource, ScopeOperation, error) {
	s := Scope(str)
	if s == "" || s == ScopeAny {
		return ScopeAnyResource, ScopeAnyOperation, nil
	}

	res, op := s.Split()
	if res == "" {
		return "", "", errors.Errorf(`invalid scope %q: missing resource type, e.g. "posts"`, s)
	}

	validOps, ok := validScopes[res]
	if !ok {
		return "", "", errors.Errorf(`invalid scope %q: invalid resource type %q`, s, res)
	}

	if op == ScopeAnyOperation {
		return res, op, nil
	}
	for _, validOp := range validOps {
		if validOp == op {
			return res, op, nil
		}
	}
	return "", "", errors.Errorf(`invalid scope %q: invalid operation %q`, s, op)
}

// Normalize removes all repeated scopes from a list of Scopes.
func normalizeScopes(ss []Scope) []Scope {
	if len(ss) == 0 {
		return ss
	}
	sort.Slice(ss, func(i, j int) bool { return ss[i] < ss[j] })

	j := 0
	wildcards := map[ScopeResource]bool{}
	for i := 0; i < len(ss); i++ {
		s := ss[i]
		// If it's a "res:*" scope, then we don't need to include any other
		// scopes for the same resource.
		res, op := s.Split()
		if op == ScopeAnyOperation {
			wildcards[res] = true
		}

		// Deduplicate.
		if ss[j] == s {
			continue
		}
		j++
		ss[j] = s
	}
	ss = ss[:j+1]

	// If we have a "*:*" no need to include any other.
	if wildcards[ScopeAnyResource] {
		return []Scope{ScopeAny}
	}

	// Remove redundant scopes covered by wildcards.
	j = 0
	for i := 1; i < len(ss); i++ {
		s := ss[i]
		res, op := s.Split()
		if wildcards[res] && op != ScopeAnyOperation {
			// skip this scope since it's covered by a wildcard for the same
			// resource.
			continue
		}
		j++
		ss[j] = s
	}
	ss = ss[:j+1]

	return ss
}

// Value implements driver.Valuer interface for database conversions.
func (ss AppScopes) Value() (driver.Value, error) {
	if ss == nil {
		return nil, nil
	}

	b, err := json.Marshal(ss)
	if err != nil {
		return nil, err
	}

	return string(b), nil
}

// Scan implements sql.Scanner interface for database conversions.
func (ss *AppScopes) Scan(value interface{}) error {
	if value == nil {
		*ss = nil
		return nil
	}
	sv, err := driver.String.ConvertValue(value)
	if err != nil {
		return err
	}

	// MySQL seems to return this as a []byte.
	v, ok := sv.([]byte)
	if !ok {
		// Otherwise a string.
		vs, ok2 := sv.(string)
		if !ok2 {
			return errors.New("value is neither a string nor bytes")
		}
		v = []byte(vs)
	}

	scopes := AppScopes{}
	err = json.Unmarshal(v, &scopes)
	if err != nil {
		return err
	}

	*ss = scopes
	return nil
}
