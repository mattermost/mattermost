// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

// BuiltinLdap implements einterfaces.LdapInterface for Team Edition without the
// enterprise plugin. It is instantiated in channels.go when ldapInterface (the
// enterprise factory) is nil.
//
// Design: same registration pattern as enterprise — the struct is stored in
// ch.Ldap so a.Ldap() returns a non-nil value and all upstream LDAP code paths
// work unchanged.

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/mattermost/ldap"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// BuiltinLdap is a minimal LDAP implementation for Team Edition.
type BuiltinLdap struct {
	app *App
}

// NewBuiltinLdap constructs a BuiltinLdap backed by the given App.
func NewBuiltinLdap(a *App) *BuiltinLdap {
	return &BuiltinLdap{app: a}
}

// ─── connection helpers ──────────────────────────────────────────────────────

// dial opens an LDAP connection according to the current LdapSettings.
func (b *BuiltinLdap) dial() (*ldap.Conn, error) {
	cfg := b.app.Config().LdapSettings
	server := strDeref(cfg.LdapServer)
	port := 389
	if cfg.LdapPort != nil {
		port = *cfg.LdapPort
	}
	addr := net.JoinHostPort(server, fmt.Sprintf("%d", port))

	connSec := model.ConnSecurityNone
	if cfg.ConnectionSecurity != nil {
		connSec = *cfg.ConnectionSecurity
	}
	skip := cfg.SkipCertificateVerification != nil && *cfg.SkipCertificateVerification
	tlsCfg := &tls.Config{
		InsecureSkipVerify: skip, //nolint:gosec
		ServerName:         server,
	}

	var conn *ldap.Conn
	var err error
	switch connSec {
	case model.ConnSecurityTLS:
		conn, err = ldap.DialTLS("tcp", addr, tlsCfg)
	case model.ConnSecurityStarttls:
		conn, err = ldap.Dial("tcp", addr)
		if err == nil {
			err = conn.StartTLS(tlsCfg)
		}
	default:
		conn, err = ldap.Dial("tcp", addr)
	}
	if err != nil {
		return nil, err
	}

	qt := b.queryTimeout()
	conn.SetTimeout(qt)
	return conn, nil
}

// queryTimeout returns the configured LDAP query timeout.
func (b *BuiltinLdap) queryTimeout() time.Duration {
	cfg := b.app.Config().LdapSettings
	qt := 30 * time.Second
	if cfg.QueryTimeout != nil && *cfg.QueryTimeout > 0 {
		qt = time.Duration(*cfg.QueryTimeout) * time.Second
	}
	return qt
}

// bindServiceAccount performs the service-account bind when BindUsername is set.
func (b *BuiltinLdap) bindServiceAccount(conn *ldap.Conn) error {
	cfg := b.app.Config().LdapSettings
	bindUser := strDeref(cfg.BindUsername)
	if bindUser == "" {
		return nil
	}
	return ldapWithTimeout(conn, b.queryTimeout(), func() error {
		return conn.Bind(bindUser, strDeref(cfg.BindPassword))
	})
}

// searchUser runs an LDAP search using the provided filter and returns the first
// matching entry. Returns (nil, nil) when no entry is found.
func (b *BuiltinLdap) searchUser(conn *ldap.Conn, filter string, attrs []string) (*ldap.Entry, error) {
	cfg := b.app.Config().LdapSettings
	baseDN := strDeref(cfg.BaseDN)

	req := ldap.NewSearchRequest(
		baseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		2, 0, false,
		filter, attrs, nil,
	)
	var result *ldap.SearchResult
	if err := ldapWithTimeout(conn, b.queryTimeout(), func() error {
		var e error
		result, e = conn.Search(req)
		return e
	}); err != nil {
		return nil, err
	}
	if len(result.Entries) == 0 {
		return nil, nil
	}
	return result.Entries[0], nil
}

// entryToUser converts an LDAP entry to a model.User using the current settings.
// authData is the stable unique identifier to store as AuthData (e.g. ipaUniqueID).
func (b *BuiltinLdap) entryToUser(entry *ldap.Entry, authData string) *model.User {
	cfg := b.app.Config().LdapSettings
	get := func(attr string) string {
		if attr == "" {
			return ""
		}
		return entry.GetAttributeValue(attr)
	}
	authDataCopy := authData
	return &model.User{
		Username:      get(strDeref(cfg.UsernameAttribute)),
		Email:         get(strDeref(cfg.EmailAttribute)),
		FirstName:     get(strDeref(cfg.FirstNameAttribute)),
		LastName:      get(strDeref(cfg.LastNameAttribute)),
		AuthData:      &authDataCopy,
		AuthService:   model.UserAuthServiceLdap,
		EmailVerified: true,
	}
}

// requiredAttrs returns the list of LDAP attributes we need to fetch.
func (b *BuiltinLdap) requiredAttrs() []string {
	cfg := b.app.Config().LdapSettings
	attrs := []string{"dn"}
	for _, a := range []string{
		strDeref(cfg.IdAttribute),
		strDeref(cfg.UsernameAttribute),
		strDeref(cfg.EmailAttribute),
		strDeref(cfg.FirstNameAttribute),
		strDeref(cfg.LastNameAttribute),
	} {
		if a != "" {
			attrs = append(attrs, a)
		}
	}
	return attrs
}

// ─── LdapInterface ───────────────────────────────────────────────────────────

// GetUser searches LDAP for a user by loginId (what the user types: uid/email).
// Returns a model.User with AuthData set to the stable IdAttribute value.
// This is called by GetUserForLogin before the user exists in the DB.
func (b *BuiltinLdap) GetUser(rctx request.CTX, loginId string) (*model.User, *model.AppError) {
	cfg := b.app.Config().LdapSettings

	conn, err := b.dial()
	if err != nil {
		return nil, model.NewAppError("BuiltinLdap.GetUser", "app.ldap_builtin.dial.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer conn.Close()

	if err := b.bindServiceAccount(conn); err != nil {
		return nil, model.NewAppError("BuiltinLdap.GetUser", "app.ldap_builtin.bind.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	loginAttr := "uid"
	if cfg.LoginIdAttribute != nil && *cfg.LoginIdAttribute != "" {
		loginAttr = *cfg.LoginIdAttribute
	}
	idAttr := strDeref(cfg.IdAttribute)

	filter := fmt.Sprintf("(%s=%s)", loginAttr, ldap.EscapeFilter(loginId))
	if cfg.UserFilter != nil && *cfg.UserFilter != "" {
		filter = fmt.Sprintf("(&%s%s)", filter, *cfg.UserFilter)
	}

	entry, searchErr := b.searchUser(conn, filter, b.requiredAttrs())
	if searchErr != nil {
		return nil, model.NewAppError("BuiltinLdap.GetUser", "app.ldap_builtin.search.app_error", nil, searchErr.Error(), http.StatusInternalServerError)
	}
	if entry == nil {
		return nil, model.NewAppError("BuiltinLdap.GetUser", "app.ldap_builtin.user_not_found.app_error", nil, "login_id="+loginId, http.StatusNotFound)
	}

	authData := loginId
	if idAttr != "" {
		if v := entry.GetAttributeValue(idAttr); v != "" {
			authData = v
		}
	}
	return b.entryToUser(entry, authData), nil
}

// DoLogin authenticates an existing (or first-time) LDAP user.
// ldapID is the AuthData value stored in DB (i.e., the IdAttribute value).
// It finds the user in LDAP, verifies the password, and creates the DB record
// on first login.
func (b *BuiltinLdap) DoLogin(rctx request.CTX, ldapID, password string) (*model.User, *model.AppError) {
	cfg := b.app.Config().LdapSettings

	conn, err := b.dial()
	if err != nil {
		return nil, model.NewAppError("BuiltinLdap.DoLogin", "app.ldap_builtin.dial.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer conn.Close()

	if err := b.bindServiceAccount(conn); err != nil {
		return nil, model.NewAppError("BuiltinLdap.DoLogin", "app.ldap_builtin.bind.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	idAttr := strDeref(cfg.IdAttribute)
	loginAttr := "uid"
	if cfg.LoginIdAttribute != nil && *cfg.LoginIdAttribute != "" {
		loginAttr = *cfg.LoginIdAttribute
	}

	// Search by IdAttribute first (stable key stored as AuthData).
	// Fall back to LoginIdAttribute so that users who registered before
	// IdAttribute was configured can still log in.
	var searchAttr string
	if idAttr != "" {
		searchAttr = idAttr
	} else {
		searchAttr = loginAttr
	}

	filter := fmt.Sprintf("(%s=%s)", searchAttr, ldap.EscapeFilter(ldapID))
	if cfg.UserFilter != nil && *cfg.UserFilter != "" {
		filter = fmt.Sprintf("(&%s%s)", filter, *cfg.UserFilter)
	}

	entry, searchErr := b.searchUser(conn, filter, b.requiredAttrs())
	if searchErr != nil {
		return nil, model.NewAppError("BuiltinLdap.DoLogin", "app.ldap_builtin.search.app_error", nil, searchErr.Error(), http.StatusInternalServerError)
	}

	// Fallback: if not found by IdAttribute, try LoginIdAttribute
	// (handles legacy AuthData that contains the login name, not the stable ID).
	if entry == nil && idAttr != "" && idAttr != loginAttr {
		fallbackFilter := fmt.Sprintf("(%s=%s)", loginAttr, ldap.EscapeFilter(ldapID))
		if cfg.UserFilter != nil && *cfg.UserFilter != "" {
			fallbackFilter = fmt.Sprintf("(&%s%s)", fallbackFilter, *cfg.UserFilter)
		}
		entry, searchErr = b.searchUser(conn, fallbackFilter, b.requiredAttrs())
		if searchErr != nil {
			return nil, model.NewAppError("BuiltinLdap.DoLogin", "app.ldap_builtin.search.app_error", nil, searchErr.Error(), http.StatusInternalServerError)
		}
	}

	if entry == nil {
		return nil, model.NewAppError("BuiltinLdap.DoLogin", "app.ldap_builtin.user_not_found.app_error", nil, "ldap_id="+ldapID, http.StatusUnauthorized)
	}

	// Verify password via direct bind to the user's DN.
	if err := ldapWithTimeout(conn, b.queryTimeout(), func() error {
		return conn.Bind(entry.DN, password)
	}); err != nil {
		return nil, model.NewAppError("BuiltinLdap.DoLogin", "ent.ldap.do_login.invalid_password.app_error", nil, err.Error(), http.StatusUnauthorized)
	}

	// Determine the stable AuthData for DB storage.
	authData := ldapID
	if idAttr != "" {
		if v := entry.GetAttributeValue(idAttr); v != "" {
			authData = v
		}
	}

	// Return existing DB user or create on first login.
	if dbUser, appErr := b.app.GetUserByAuth(&authData, model.UserAuthServiceLdap); appErr == nil {
		return dbUser, nil
	}
	newUser := b.entryToUser(entry, authData)
	return b.app.CreateUser(rctx, newUser)
}

// GetLDAPUserForMMUser returns the LDAP representation of an existing MM user.
func (b *BuiltinLdap) GetLDAPUserForMMUser(rctx request.CTX, mmUser *model.User) (*model.User, string, *model.AppError) {
	if mmUser.AuthData == nil {
		return nil, "", model.NewAppError("BuiltinLdap.GetLDAPUserForMMUser", "app.ldap_builtin.user_not_found.app_error", nil, "no AuthData", http.StatusBadRequest)
	}
	ldapUser, err := b.GetUser(rctx, *mmUser.AuthData)
	if err != nil {
		return nil, "", err
	}
	return ldapUser, *ldapUser.AuthData, nil
}

// GetUserAttributes returns a map of requested LDAP attributes for the given ID.
func (b *BuiltinLdap) GetUserAttributes(rctx request.CTX, id string, attributes []string) (map[string]string, *model.AppError) {
	cfg := b.app.Config().LdapSettings

	conn, err := b.dial()
	if err != nil {
		return nil, model.NewAppError("BuiltinLdap.GetUserAttributes", "app.ldap_builtin.dial.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer conn.Close()

	if err := b.bindServiceAccount(conn); err != nil {
		return nil, model.NewAppError("BuiltinLdap.GetUserAttributes", "app.ldap_builtin.bind.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	idAttr := strDeref(cfg.IdAttribute)
	if idAttr == "" {
		idAttr = "uid"
	}
	filter := fmt.Sprintf("(%s=%s)", idAttr, ldap.EscapeFilter(id))

	entry, searchErr := b.searchUser(conn, filter, attributes)
	if searchErr != nil {
		return nil, model.NewAppError("BuiltinLdap.GetUserAttributes", "app.ldap_builtin.search.app_error", nil, searchErr.Error(), http.StatusInternalServerError)
	}
	if entry == nil {
		return map[string]string{}, nil
	}

	result := make(map[string]string, len(attributes))
	for _, attr := range attributes {
		result[attr] = entry.GetAttributeValue(attr)
	}
	return result, nil
}

// CheckProviderAttributes returns "" — all user fields may be edited locally.
func (b *BuiltinLdap) CheckProviderAttributes(_ request.CTX, _ *model.LdapSettings, _ *model.User, _ *model.UserPatch) string {
	return ""
}

// SwitchToLdap verifies LDAP credentials and updates the user's auth to LDAP.
func (b *BuiltinLdap) SwitchToLdap(rctx request.CTX, userID, ldapID, ldapPassword string) *model.AppError {
	if _, err := b.DoLogin(rctx, ldapID, ldapPassword); err != nil {
		return err
	}
	if _, nErr := b.app.Srv().Store().User().UpdateAuthData(userID, model.UserAuthServiceLdap, &ldapID, "", false); nErr != nil {
		return model.NewAppError("BuiltinLdap.SwitchToLdap", "app.user.update_auth_data.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	return nil
}

// StartSynchronizeJob enqueues a ldap_sync_builtin job.
func (b *BuiltinLdap) StartSynchronizeJob(rctx request.CTX, _ bool) (*model.Job, *model.AppError) {
	return b.app.Srv().Jobs.CreateJob(rctx, model.JobTypeLdapSync, nil)
}

// GetAllLdapUsers returns every DB user whose AuthService is "ldap".
func (b *BuiltinLdap) GetAllLdapUsers(_ request.CTX) ([]*model.User, *model.AppError) {
	return b.app.GetAllLDAPUsers()
}

// FirstLoginSync syncs user attributes from LDAP after the first login.
func (b *BuiltinLdap) FirstLoginSync(rctx request.CTX, user *model.User) *model.AppError {
	if user.AuthData == nil || user.Id == "" {
		return nil
	}
	ldapUser, err := b.GetUser(rctx, *user.AuthData)
	if err != nil {
		mlog.Warn("BuiltinLdap.FirstLoginSync: could not fetch user from LDAP", mlog.String("user_id", user.Id), mlog.Err(err))
		return nil // non-fatal
	}
	patch := &model.UserPatch{
		FirstName: &ldapUser.FirstName,
		LastName:  &ldapUser.LastName,
		Email:     &ldapUser.Email,
	}
	if _, appErr := b.app.PatchUser(rctx, user.Id, patch, true); appErr != nil {
		mlog.Warn("BuiltinLdap.FirstLoginSync: could not patch user", mlog.String("user_id", user.Id), mlog.Err(appErr))
	}
	return nil
}

// UpdateProfilePictureIfNecessary is a no-op for the builtin provider.
func (b *BuiltinLdap) UpdateProfilePictureIfNecessary(_ request.CTX, _ model.User, _ model.Session) {
}

// ─── Stub methods (group sync — not supported in Team Edition) ───────────────

func (b *BuiltinLdap) MigrateIDAttribute(_ request.CTX, _ string) error {
	return nil
}

func (b *BuiltinLdap) GetGroup(_ request.CTX, _ string) (*model.Group, *model.AppError) {
	return nil, model.NewAppError("BuiltinLdap", "app.ldap_builtin.not_implemented.app_error", nil, "group sync not supported in Team Edition", http.StatusNotImplemented)
}

func (b *BuiltinLdap) GetAllGroupsPage(_ request.CTX, _ int, _ int, _ model.LdapGroupSearchOpts) ([]*model.Group, int, *model.AppError) {
	return nil, 0, model.NewAppError("BuiltinLdap", "app.ldap_builtin.not_implemented.app_error", nil, "group sync not supported in Team Edition", http.StatusNotImplemented)
}
