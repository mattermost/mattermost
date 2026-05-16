// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package ldap_sync_builtin implements a full LDAP user+group sync job for
// Mattermost Team Edition (no enterprise license required). It reads exclusively
// from LdapSettings and the standard app interfaces; the enterprise LDAP plugin
// interface is never touched.
package ldap_sync_builtin

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/mattermost/ldap"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

// AppIface lists the app methods the worker needs. Keeping it narrow avoids
// coupling to the full *App and makes the interface easy to satisfy in tests.
type AppIface interface {
	Config() *model.Config
	GetUserByAuth(authData *string, authService string) (*model.User, *model.AppError)
	CreateUser(rctx request.CTX, user *model.User) (*model.User, *model.AppError)
	UpdateUser(rctx request.CTX, user *model.User, sendNotifications bool) (*model.User, *model.AppError)
	UpdateActive(rctx request.CTX, user *model.User, active bool) (*model.User, *model.AppError)
	GetAllLDAPUsers() ([]*model.User, *model.AppError)
	GetGroupByRemoteID(remoteID string, groupSource model.GroupSource) (*model.Group, *model.AppError)
	CreateGroup(group *model.Group) (*model.Group, *model.AppError)
	UpdateGroup(group *model.Group) (*model.Group, *model.AppError)
	GetGroupsBySource(groupSource model.GroupSource) ([]*model.Group, *model.AppError)
	GetGroupMemberUsers(groupID string) ([]*model.User, *model.AppError)
	UpsertGroupMembers(groupID string, userIDs []string) ([]*model.GroupMember, *model.AppError)
	DeleteGroupMembers(groupID string, userIDs []string) ([]*model.GroupMember, *model.AppError)
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	const workerName = "BuiltinLdapSync"

	isEnabled := func(cfg *model.Config) bool {
		return cfg.LdapSettings.Enable != nil && *cfg.LdapSettings.Enable &&
			cfg.LdapSettings.EnableSync != nil && *cfg.LdapSettings.EnableSync
	}

	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		rctx := request.EmptyContext(logger)
		cfg := app.Config().LdapSettings

		conn, err := dialLDAP(cfg)
		if err != nil {
			return fmt.Errorf("ldap dial: %w", err)
		}
		defer conn.Close()

		if cfg.BindUsername != nil && *cfg.BindUsername != "" {
			if err := conn.Bind(*cfg.BindUsername, *cfg.BindPassword); err != nil {
				return fmt.Errorf("ldap service bind: %w", err)
			}
		}

		// Phase 1 — users
		ldapUsers, dnToLdapID, err := searchAllUsers(conn, cfg, logger)
		if err != nil {
			return fmt.Errorf("ldap user search: %w", err)
		}
		logger.Info("Builtin LDAP sync: found users in directory", mlog.Int("count", len(ldapUsers)))

		ldapIDToMMUserID, syncErr := syncUsers(rctx, app, ldapUsers, logger)
		if syncErr != nil {
			return fmt.Errorf("user sync: %w", syncErr)
		}

		// Phase 2 — deactivate DB users not found in LDAP
		if deactErr := deactivateRemovedUsers(rctx, app, ldapIDToMMUserID, logger); deactErr != nil {
			// Non-fatal: log and continue
			logger.Warn("Builtin LDAP sync: deactivation step failed", mlog.Err(deactErr))
		}

		// Phase 3 — groups (only when GroupFilter is set)
		groupFilter := ""
		if cfg.GroupFilter != nil {
			groupFilter = *cfg.GroupFilter
		}
		if groupFilter != "" {
			dnToMMUserID := buildDNToMMUserID(dnToLdapID, ldapIDToMMUserID)
			if grpErr := syncGroups(rctx, conn, app, cfg, dnToMMUserID, logger); grpErr != nil {
				logger.Warn("Builtin LDAP sync: group sync failed", mlog.Err(grpErr))
			}
		}

		return nil
	}

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}

// ── LDAP connection ──────────────────────────────────────────────────────────

func dialLDAP(cfg model.LdapSettings) (*ldap.Conn, error) {
	server := ""
	if cfg.LdapServer != nil {
		server = *cfg.LdapServer
	}
	port := 389
	if cfg.LdapPort != nil {
		port = *cfg.LdapPort
	}
	addr := net.JoinHostPort(server, fmt.Sprintf("%d", port))

	skipVerify := cfg.SkipCertificateVerification != nil && *cfg.SkipCertificateVerification
	tlsCfg := &tls.Config{
		InsecureSkipVerify: skipVerify, //nolint:gosec
		ServerName:         server,
	}

	connSec := model.ConnSecurityNone
	if cfg.ConnectionSecurity != nil {
		connSec = *cfg.ConnectionSecurity
	}

	switch connSec {
	case model.ConnSecurityTLS:
		return ldap.DialTLS("tcp", addr, tlsCfg)
	case model.ConnSecurityStarttls:
		conn, err := ldap.Dial("tcp", addr)
		if err != nil {
			return nil, err
		}
		if err := conn.StartTLS(tlsCfg); err != nil {
			conn.Close()
			return nil, err
		}
		return conn, nil
	default:
		return ldap.Dial("tcp", addr)
	}
}

// ── User search ──────────────────────────────────────────────────────────────

type ldapUserEntry struct {
	dn        string
	ldapID    string
	username  string
	email     string
	firstName string
	lastName  string
}

func searchAllUsers(conn *ldap.Conn, cfg model.LdapSettings, logger mlog.LoggerIFace) (
	users []ldapUserEntry,
	dnToLdapID map[string]string,
	err error,
) {
	baseDN := deref(cfg.BaseDN)
	idAttr := deref(cfg.IdAttribute)
	if idAttr == "" {
		idAttr = "uid"
	}

	filter := fmt.Sprintf("(%s=*)", idAttr)
	if uf := deref(cfg.UserFilter); uf != "" {
		filter = fmt.Sprintf("(&%s%s)", filter, uf)
	}

	attrs := []string{"dn", idAttr}
	if a := deref(cfg.UsernameAttribute); a != "" {
		attrs = append(attrs, a)
	}
	if a := deref(cfg.EmailAttribute); a != "" {
		attrs = append(attrs, a)
	}
	if a := deref(cfg.FirstNameAttribute); a != "" {
		attrs = append(attrs, a)
	}
	if a := deref(cfg.LastNameAttribute); a != "" {
		attrs = append(attrs, a)
	}

	pageSize := uint32(500)
	if cfg.MaxPageSize != nil && *cfg.MaxPageSize > 0 {
		pageSize = uint32(*cfg.MaxPageSize)
	}

	req := ldap.NewSearchRequest(
		baseDN, ldap.ScopeWholeSubtree, ldap.NeverDerefAliases,
		0, 0, false, filter, attrs, nil,
	)

	var timeout time.Duration
	if cfg.QueryTimeout != nil && *cfg.QueryTimeout > 0 {
		timeout = time.Duration(*cfg.QueryTimeout) * time.Second
		conn.SetTimeout(timeout)
	}

	result, searchErr := conn.SearchWithPaging(req, pageSize)
	if searchErr != nil {
		return nil, nil, searchErr
	}

	dnToLdapID = make(map[string]string, len(result.Entries))
	for _, entry := range result.Entries {
		ldapID := entry.GetAttributeValue(idAttr)
		if ldapID == "" {
			logger.Warn("Builtin LDAP sync: skipping entry with empty IdAttribute", mlog.String("dn", entry.DN))
			continue
		}
		u := ldapUserEntry{
			dn:        entry.DN,
			ldapID:    ldapID,
			username:  entry.GetAttributeValue(deref(cfg.UsernameAttribute)),
			email:     entry.GetAttributeValue(deref(cfg.EmailAttribute)),
			firstName: entry.GetAttributeValue(deref(cfg.FirstNameAttribute)),
			lastName:  entry.GetAttributeValue(deref(cfg.LastNameAttribute)),
		}
		users = append(users, u)
		dnToLdapID[strings.ToLower(entry.DN)] = ldapID
	}
	return users, dnToLdapID, nil
}

// ── User sync ────────────────────────────────────────────────────────────────

// syncUsers creates or updates Mattermost users for every LDAP entry.
// Returns a map of ldapID → mmUserID for the group sync phase.
func syncUsers(rctx request.CTX, app AppIface, ldapUsers []ldapUserEntry, logger mlog.LoggerIFace) (map[string]string, error) {
	ldapIDToMMUserID := make(map[string]string, len(ldapUsers))

	for _, lu := range ldapUsers {
		ldapIDCopy := lu.ldapID
		dbUser, appErr := app.GetUserByAuth(&ldapIDCopy, model.UserAuthServiceLdap)

		if appErr == nil {
			// Existing user — update attributes and re-activate if needed
			changed := false
			if lu.username != "" && dbUser.Username != lu.username {
				dbUser.Username = lu.username
				changed = true
			}
			if lu.email != "" && dbUser.Email != lu.email {
				dbUser.Email = lu.email
				changed = true
			}
			if dbUser.FirstName != lu.firstName {
				dbUser.FirstName = lu.firstName
				changed = true
			}
			if dbUser.LastName != lu.lastName {
				dbUser.LastName = lu.lastName
				changed = true
			}
			if changed {
				if _, updateErr := app.UpdateUser(rctx, dbUser, false); updateErr != nil {
					logger.Warn("Builtin LDAP sync: failed to update user", mlog.String("ldap_id", lu.ldapID), mlog.Err(updateErr))
				}
			}
			// Re-activate previously deactivated users that are back in LDAP
			if dbUser.DeleteAt > 0 {
				if _, actErr := app.UpdateActive(rctx, dbUser, true); actErr != nil {
					logger.Warn("Builtin LDAP sync: failed to reactivate user", mlog.String("ldap_id", lu.ldapID), mlog.Err(actErr))
				}
			}
			ldapIDToMMUserID[lu.ldapID] = dbUser.Id
		} else if appErr.StatusCode == http.StatusBadRequest {
			// User not in DB yet — create
			if lu.email == "" || lu.username == "" {
				logger.Warn("Builtin LDAP sync: skipping user with missing email/username", mlog.String("ldap_id", lu.ldapID))
				continue
			}
			newUser := &model.User{
				Username:      lu.username,
				Email:         lu.email,
				FirstName:     lu.firstName,
				LastName:      lu.lastName,
				AuthData:      &ldapIDCopy,
				AuthService:   model.UserAuthServiceLdap,
				EmailVerified: true,
			}
			created, createErr := app.CreateUser(rctx, newUser)
			if createErr != nil {
				logger.Warn("Builtin LDAP sync: failed to create user", mlog.String("ldap_id", lu.ldapID), mlog.Err(createErr))
				continue
			}
			ldapIDToMMUserID[lu.ldapID] = created.Id
			logger.Info("Builtin LDAP sync: created user", mlog.String("ldap_id", lu.ldapID), mlog.String("username", lu.username))
		} else {
			logger.Warn("Builtin LDAP sync: error looking up user", mlog.String("ldap_id", lu.ldapID), mlog.Err(appErr))
		}
	}
	return ldapIDToMMUserID, nil
}

// deactivateRemovedUsers deactivates DB LDAP users whose ldapID was not found
// in the current LDAP search results.
func deactivateRemovedUsers(rctx request.CTX, app AppIface, ldapIDToMMUserID map[string]string, logger mlog.LoggerIFace) error {
	dbLDAPUsers, appErr := app.GetAllLDAPUsers()
	if appErr != nil {
		return appErr
	}
	for _, u := range dbLDAPUsers {
		if u.AuthData == nil {
			continue
		}
		if _, found := ldapIDToMMUserID[*u.AuthData]; !found && u.DeleteAt == 0 {
			if _, err := app.UpdateActive(rctx, u, false); err != nil {
				logger.Warn("Builtin LDAP sync: failed to deactivate removed user",
					mlog.String("user_id", u.Id), mlog.Err(err))
			} else {
				logger.Info("Builtin LDAP sync: deactivated user removed from LDAP", mlog.String("user_id", u.Id))
			}
		}
	}
	return nil
}

// ── Group sync ───────────────────────────────────────────────────────────────

func buildDNToMMUserID(dnToLdapID map[string]string, ldapIDToMMUserID map[string]string) map[string]string {
	m := make(map[string]string, len(dnToLdapID))
	for dn, ldapID := range dnToLdapID {
		if mmID, ok := ldapIDToMMUserID[ldapID]; ok {
			m[dn] = mmID
		}
	}
	return m
}

type ldapGroupEntry struct {
	dn          string
	ldapGroupID string
	displayName string
	memberDNs   []string
}

func syncGroups(
	rctx request.CTX,
	conn *ldap.Conn,
	app AppIface,
	cfg model.LdapSettings,
	dnToMMUserID map[string]string,
	logger mlog.LoggerIFace,
) error {
	groupBaseDN := deref(cfg.GroupBaseDN)
	if groupBaseDN == "" {
		groupBaseDN = deref(cfg.BaseDN)
	}

	groupFilter := deref(cfg.GroupFilter)
	groupIDAttr := deref(cfg.GroupIdAttribute)
	if groupIDAttr == "" {
		groupIDAttr = "cn"
	}
	groupNameAttr := deref(cfg.GroupDisplayNameAttribute)
	if groupNameAttr == "" {
		groupNameAttr = "cn"
	}
	memberAttr := deref(cfg.GroupMemberAttribute)
	if memberAttr == "" {
		memberAttr = "member"
	}

	pageSize := uint32(500)
	if cfg.MaxPageSize != nil && *cfg.MaxPageSize > 0 {
		pageSize = uint32(*cfg.MaxPageSize)
	}

	req := ldap.NewSearchRequest(
		groupBaseDN, ldap.ScopeWholeSubtree, ldap.NeverDerefAliases,
		0, 0, false, groupFilter,
		[]string{groupIDAttr, groupNameAttr, memberAttr},
		nil,
	)
	result, err := conn.SearchWithPaging(req, pageSize)
	if err != nil {
		return fmt.Errorf("group search: %w", err)
	}

	logger.Info("Builtin LDAP sync: found groups in directory", mlog.Int("count", len(result.Entries)))

	// Track which LDAP group remote IDs are still active (for future cleanup)
	seenRemoteIDs := make(map[string]bool, len(result.Entries))

	for _, entry := range result.Entries {
		ldapGroupID := entry.GetAttributeValue(groupIDAttr)
		if ldapGroupID == "" {
			continue
		}
		displayName := entry.GetAttributeValue(groupNameAttr)
		if displayName == "" {
			displayName = ldapGroupID
		}
		memberDNs := entry.GetAttributeValues(memberAttr)

		ge := ldapGroupEntry{
			dn:          entry.DN,
			ldapGroupID: ldapGroupID,
			displayName: displayName,
			memberDNs:   memberDNs,
		}
		seenRemoteIDs[ldapGroupID] = true

		if err := upsertGroup(rctx, app, ge, dnToMMUserID, logger); err != nil {
			logger.Warn("Builtin LDAP sync: failed to sync group",
				mlog.String("ldap_group_id", ldapGroupID), mlog.Err(err))
		}
	}

	return nil
}

func upsertGroup(
	rctx request.CTX,
	app AppIface,
	ge ldapGroupEntry,
	dnToMMUserID map[string]string,
	logger mlog.LoggerIFace,
) error {
	remoteID := ge.ldapGroupID
	group, appErr := app.GetGroupByRemoteID(remoteID, model.GroupSourceLdap)

	if appErr != nil && appErr.StatusCode == http.StatusNotFound {
		// Create new group
		newGroup := &model.Group{
			DisplayName:    truncate(ge.displayName, model.GroupDisplayNameMaxLength),
			Name:           model.NewPointer(sanitizeGroupName(ge.displayName)),
			Source:         model.GroupSourceLdap,
			RemoteId:       model.NewPointer(remoteID),
			AllowReference: false,
		}
		created, createErr := app.CreateGroup(newGroup)
		if createErr != nil {
			return fmt.Errorf("create group: %w", createErr)
		}
		group = created
		logger.Info("Builtin LDAP sync: created group", mlog.String("display_name", ge.displayName))
	} else if appErr != nil {
		return fmt.Errorf("lookup group: %w", appErr)
	} else {
		// Update display name if it changed
		if group.DisplayName != ge.displayName {
			group.DisplayName = truncate(ge.displayName, model.GroupDisplayNameMaxLength)
			if _, updateErr := app.UpdateGroup(group); updateErr != nil {
				logger.Warn("Builtin LDAP sync: failed to update group display name",
					mlog.String("group_id", group.Id), mlog.Err(updateErr))
			}
		}
	}

	// Resolve member DNs to MM user IDs
	wantedUserIDs := make(map[string]bool)
	for _, memberDN := range ge.memberDNs {
		mmUserID, ok := dnToMMUserID[strings.ToLower(memberDN)]
		if ok {
			wantedUserIDs[mmUserID] = true
		}
	}

	// Get current MM group members
	currentMembers, membErr := app.GetGroupMemberUsers(group.Id)
	if membErr != nil {
		return fmt.Errorf("get group members: %w", membErr)
	}
	currentUserIDs := make(map[string]bool, len(currentMembers))
	for _, u := range currentMembers {
		currentUserIDs[u.Id] = true
	}

	// Add missing members
	var toAdd []string
	for uid := range wantedUserIDs {
		if !currentUserIDs[uid] {
			toAdd = append(toAdd, uid)
		}
	}
	if len(toAdd) > 0 {
		if _, err := app.UpsertGroupMembers(group.Id, toAdd); err != nil {
			logger.Warn("Builtin LDAP sync: failed to add group members",
				mlog.String("group_id", group.Id), mlog.Err(err))
		}
	}

	// Remove stale members
	var toRemove []string
	for uid := range currentUserIDs {
		if !wantedUserIDs[uid] {
			toRemove = append(toRemove, uid)
		}
	}
	if len(toRemove) > 0 {
		if _, err := app.DeleteGroupMembers(group.Id, toRemove); err != nil {
			logger.Warn("Builtin LDAP sync: failed to remove group members",
				mlog.String("group_id", group.Id), mlog.Err(err))
		}
	}

	return nil
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

var nonAlphanumeric = regexp.MustCompile(`[^a-z0-9]+`)

// sanitizeGroupName converts an LDAP group CN into a Mattermost group name
// (lowercase alphanumeric + hyphens, max 64 chars).
func sanitizeGroupName(name string) string {
	s := strings.ToLower(name)
	s = nonAlphanumeric.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if len(s) > 64 {
		s = s[:64]
	}
	if s == "" {
		s = "ldap-group"
	}
	return s
}

func truncate(s string, max int) string {
	if len(s) > max {
		return s[:max]
	}
	return s
}
