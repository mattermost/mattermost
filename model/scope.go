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
//   - "posts:read" is the scope for a read-only access to Posts.
//   - "users:*" is the scope for a all operations on Users.
//   - "channels:join" is the scope for joining Channels.
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
	ScopeCommands ScopeResource = "commands"
	ScopeEmojis   ScopeResource = "emojis"
	ScopeFiles    ScopeResource = "files"
	ScopeOAuth2   ScopeResource = "oauth2"
	ScopePosts    ScopeResource = "posts"
	ScopeTeams    ScopeResource = "teams"
	ScopeUsers    ScopeResource = "users"
	ScopePlugins  ScopeResource = "plugins"
)

const (
	ScopeCreate  ScopeOperation = "create"
	ScopeDelete  ScopeOperation = "delete"
	ScopeExecute ScopeOperation = "execute"
	ScopeJoin    ScopeOperation = "join"
	ScopeManage  ScopeOperation = "manage"
	ScopeRead    ScopeOperation = "read"
	ScopeSearch  ScopeOperation = "search"
	ScopeUpdate  ScopeOperation = "update"
)

const (
	ScopeChannelsAny    Scope = "channels:*"
	ScopeChannelsCreate Scope = "channels:create"
	ScopeChannelsDelete Scope = "channels:delete"
	ScopeChannelsRead   Scope = "channels:read"
	ScopeChannelsSearch Scope = "channels:search"
	ScopeChannelsUpdate Scope = "channels:update"
	ScopeChannelsJoin   Scope = "channels:join"

	ScopeCommandsExecute Scope = "commands:execute"

	ScopeEmojisAny    Scope = "emojis:*"
	ScopeEmojisCreate Scope = "emojis:create"
	ScopeEmojisDelete Scope = "emojis:delete"
	ScopeEmojisRead   Scope = "emojis:read"
	ScopeEmojisSearch Scope = "emojis:search"
	ScopeEmojisUpdate Scope = "emojis:update"

	ScopeFilesAny    Scope = "files:*"
	ScopeFilesCreate Scope = "files:create"
	ScopeFilesDelete Scope = "files:delete"
	ScopeFilesRead   Scope = "files:read"
	ScopeFilesSearch Scope = "files:search"

	ScopeOAuth2Manage Scope = "oauth2:manage"

	ScopePostsAny    Scope = "posts:*"
	ScopePostsCreate Scope = "posts:create"
	ScopePostsDelete Scope = "posts:delete"
	ScopePostsRead   Scope = "posts:read"
	ScopePostsSearch Scope = "posts:search"
	ScopePostsUpdate Scope = "posts:update"

	ScopeTeamsAny    Scope = "teams:*"
	ScopeTeamsCreate Scope = "teams:create"
	ScopeTeamsDelete Scope = "teams:delete"
	ScopeTeamsRead   Scope = "teams:read"
	ScopeTeamsSearch Scope = "teams:search"
	ScopeTeamsUpdate Scope = "teams:update"
	ScopeTeamsJoin   Scope = "teams:join"

	ScopeUsersAny    Scope = "users:*"
	ScopeUsersCreate Scope = "users:create"
	ScopeUsersDelete Scope = "users:delete"
	ScopeUsersRead   Scope = "users:read"
	ScopeUsersSearch Scope = "users:search"
	ScopeUsersUpdate Scope = "users:update"
)

var searchAndCRUDScopeOps = []ScopeOperation{ScopeCreate, ScopeRead, ScopeUpdate, ScopeDelete, ScopeSearch}

var validScopes = map[ScopeResource][]ScopeOperation{
	ScopeChannels: append(searchAndCRUDScopeOps, ScopeJoin),
	ScopeCommands: {ScopeExecute},
	ScopeEmojis:   searchAndCRUDScopeOps,
	ScopeFiles:    searchAndCRUDScopeOps,
	ScopeOAuth2:   {ScopeManage},
	ScopePosts:    searchAndCRUDScopeOps,
	ScopeTeams:    append(searchAndCRUDScopeOps, ScopeJoin),
	ScopeUsers:    searchAndCRUDScopeOps,
}

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

// ScopeUnrestrictedAPI marks an API as unrestricted and therefore available to
// OAuth2 clients, regardless of their granted scopes.
var ScopeUnrestrictedAPI = APIScopes{ScopeAny}

// ScopeCheckedByImplementation is an alias for ScopeUnrestrictedAPI indicating
// that the all calls should be passed to the API implementation by the router,
// and it perform do its own checks.
var ScopeCheckedByImplementation = ScopeUnrestrictedAPI

// NormalizeAPIScopes checks and normalizes scopes list of an API handler,
// provided as a ...Scope argument. If an invalid scope is provided the function
// returns ScopeInternalAPI (nil). The API developers should use tests to assert
// that the scopes they assign are indeed valid.
func NormalizeAPIScopes(source []Scope) APIScopes {
	normal := NormalizeScopes(source)
	for _, s := range normal {
		res, op, err := parseScope(s)
		if err != nil {
			return nil
		}
		if res != ScopeAnyResource && op == ScopeAnyOperation {
			return nil
		}
	}
	return APIScopes(normal)
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
		res, op, err := parseScope(Scope(s))
		if err != nil {
			return nil, err
		}
		scopes = append(scopes, res.NewScope(op))
	}
	scopes = NormalizeScopes(scopes)
	return AppScopes(scopes), nil
}

func (ss AppScopes) Validate() error {
	for _, s := range ss {
		_, _, err := parseScope(s)
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

	superset, equals := ss.Compare([]Scope(need))
	return superset || equals
}

func (ss AppScopes) SatisfiesPluginRequest(pluginID, path string) error {
	if ss.IsUnrestricted() {
		return nil
	}
	for _, s := range ss {
		res, op, err := parseScope(s)
		if err != nil {
			return err
		}
		if res == ScopePlugins {
			if op == ScopeAnyOperation {
				return nil
			}
			parts := strings.SplitN(string(op), "/", 2)
			if len(parts) > 0 && parts[0] == pluginID {
				if len(parts) == 1 {
					return nil
				}
				if len(parts) == 2 && strings.HasPrefix(path, "/"+parts[1]) {
					return nil
				}
			}
		}
	}
	return errors.Errorf("insufficient scope, need %s:%s%s", ScopePlugins, pluginID, path)
}

// Compare compares two sets of scopes and returns whether the first set is a
// superset of the second, and whether they are identical. Both sets must be
// normalized and sorted.
func (ss AppScopes) Compare(sub AppScopes) (isSuperset, equals bool) {
	super := ss
	// Nothing is a superset of everything.
	if sub.IsUnrestricted() {
		return false, super.IsUnrestricted()
	}
	// Everything is a superset of non-everything.
	if super.IsUnrestricted() {
		return true, false
	}

	// Now the lists are not empty, and resources are not "*".
	iSuper, iSub := 0, 0
	equals = true
	for {
		switch {
		case iSuper == len(super) && iSub == len(sub):
			// ran out of both at the same time, so super is a superset of sub
			// (with wildcards) unless they were identical.
			return !equals, equals
		case iSuper == len(super):
			return false, false
		case iSub == len(sub):
			return true, false
		}

		superRes, superOp := super[iSuper].Split()
		subRes, sub := sub[iSub].Split()
		if subRes < superRes {
			return false, false
		}
		if superRes < subRes {
			equals = false
			iSuper++
			continue
		}
		iSub++

		if superOp == sub {
			iSuper++
			continue
		}
		if superOp != ScopeAnyOperation {
			return false, false
		}
		equals = false
	}
}

func parseScope(s Scope) (ScopeResource, ScopeOperation, error) {
	if s == "" || s == ScopeAny {
		return ScopeAnyResource, ScopeAnyOperation, nil
	}

	res, op := s.Split()
	if res == "" {
		return "", "", errors.Errorf(`invalid scope %q: missing resource type, e.g. "posts"`, s)
	}

	if res == ScopePlugins {
		if op == "" {
			return "", "", errors.Errorf(`invalid scope %q: missing plugin ID, e.g. "com.mattermost.example"`, s)
		}
		return res, op, nil
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
func NormalizeScopes(ss []Scope) []Scope {
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

func (ss AppScopes) String() string {
	sss := []string{}
	for _, s := range ss {
		sss = append(sss, string(s))
	}
	return strings.Join(sss, " ")
}
