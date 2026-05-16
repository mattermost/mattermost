// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

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

// doBuiltinLdapLogin performs a minimal LDAP bind-and-search authentication
// used as a fallback when a.Ldap() is nil (Team Edition without enterprise plugin).
// It reads exclusively from LdapSettings and never touches the enterprise interface.
func (a *App) doBuiltinLdapLogin(rctx request.CTX, ldapID, password string) (*model.User, *model.AppError) {
	cfg := a.Config().LdapSettings

	server := *cfg.LdapServer
	port := *cfg.LdapPort
	addr := net.JoinHostPort(server, fmt.Sprintf("%d", port))

	connSecurity := model.ConnSecurityNone
	if cfg.ConnectionSecurity != nil {
		connSecurity = *cfg.ConnectionSecurity
	}
	skipVerify := cfg.SkipCertificateVerification != nil && *cfg.SkipCertificateVerification

	// When InsecureSkipVerify is false, Go's crypto/tls uses the system cert pool,
	// which on Linux also picks up the SSL_CERT_FILE environment variable.
	// This means a mounted IPA CA cert is trusted automatically without extra code.
	tlsCfg := &tls.Config{
		InsecureSkipVerify: skipVerify, //nolint:gosec
		ServerName:         server,
	}

	var conn *ldap.Conn
	var dialErr error
	switch connSecurity {
	case model.ConnSecurityTLS:
		conn, dialErr = ldap.DialTLS("tcp", addr, tlsCfg)
	case model.ConnSecurityStarttls:
		conn, dialErr = ldap.Dial("tcp", addr)
		if dialErr == nil {
			dialErr = conn.StartTLS(tlsCfg)
		}
	default:
		conn, dialErr = ldap.Dial("tcp", addr)
	}
	if dialErr != nil {
		return nil, model.NewAppError("doBuiltinLdapLogin", "app.ldap_builtin.dial.app_error", nil, dialErr.Error(), http.StatusInternalServerError)
	}
	defer conn.Close()

	// Патч: всегда выставляем таймаут на LDAP-операции (bind, search).
	// Без него requestTimeout == 0 и операции зависают бесконечно.
	queryTimeout := 30 * time.Second
	if cfg.QueryTimeout != nil && *cfg.QueryTimeout > 0 {
		queryTimeout = time.Duration(*cfg.QueryTimeout) * time.Second
	}
	conn.SetTimeout(queryTimeout)

	// Service-account bind
	if cfg.BindUsername != nil && *cfg.BindUsername != "" {
		if err := conn.Bind(*cfg.BindUsername, *cfg.BindPassword); err != nil {
			return nil, model.NewAppError("doBuiltinLdapLogin", "app.ldap_builtin.bind.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	idAttr := "uid"
	if cfg.IdAttribute != nil && *cfg.IdAttribute != "" {
		idAttr = *cfg.IdAttribute
	}
	baseDN := ""
	if cfg.BaseDN != nil {
		baseDN = *cfg.BaseDN
	}

	// Build search filter, optionally ANDed with UserFilter
	filter := fmt.Sprintf("(%s=%s)", idAttr, ldap.EscapeFilter(ldapID))
	if cfg.UserFilter != nil && *cfg.UserFilter != "" {
		filter = fmt.Sprintf("(&%s%s)", filter, *cfg.UserFilter)
	}

	// Collect only the attributes we need
	type attrKey struct{ key, attr string }
	attrKeys := []attrKey{
		{"username", strDeref(cfg.UsernameAttribute)},
		{"email", strDeref(cfg.EmailAttribute)},
		{"firstname", strDeref(cfg.FirstNameAttribute)},
		{"lastname", strDeref(cfg.LastNameAttribute)},
	}
	searchAttrs := []string{"dn"}
	for _, ak := range attrKeys {
		if ak.attr != "" {
			searchAttrs = append(searchAttrs, ak.attr)
		}
	}

	searchReq := ldap.NewSearchRequest(
		baseDN,
		ldap.ScopeWholeSubtree,
		ldap.NeverDerefAliases,
		2, // size limit: we expect exactly one result
		0,
		false,
		filter,
		searchAttrs,
		nil,
	)

	result, searchErr := conn.Search(searchReq)
	if searchErr != nil {
		return nil, model.NewAppError("doBuiltinLdapLogin", "app.ldap_builtin.search.app_error", nil, searchErr.Error(), http.StatusInternalServerError)
	}
	if len(result.Entries) == 0 {
		return nil, model.NewAppError("doBuiltinLdapLogin", "app.ldap_builtin.user_not_found.app_error", nil, "ldap_id="+ldapID, http.StatusUnauthorized)
	}

	entry := result.Entries[0]

	// Verify the user's password with a direct bind
	if err := conn.Bind(entry.DN, password); err != nil {
		return nil, model.NewAppError("doBuiltinLdapLogin", "ent.ldap.do_login.invalid_password.app_error", nil, err.Error(), http.StatusUnauthorized)
	}

	// Extract LDAP attributes
	getAttr := func(attr string) string {
		if attr == "" {
			return ""
		}
		return entry.GetAttributeValue(attr)
	}
	username := getAttr(strDeref(cfg.UsernameAttribute))
	email := getAttr(strDeref(cfg.EmailAttribute))
	firstName := getAttr(strDeref(cfg.FirstNameAttribute))
	lastName := getAttr(strDeref(cfg.LastNameAttribute))

	// Return the existing DB user, or create one on first login
	ldapIDPtr := &ldapID
	dbUser, appErr := a.GetUserByAuth(ldapIDPtr, model.UserAuthServiceLdap)
	if appErr == nil {
		return dbUser, nil
	}

	// User not yet in DB (not yet synced) — create on first login
	newUser := &model.User{
		Username:      username,
		Email:         email,
		FirstName:     firstName,
		LastName:      lastName,
		AuthData:      ldapIDPtr,
		AuthService:   model.UserAuthServiceLdap,
		EmailVerified: true,
	}
	return a.CreateUser(rctx, newUser)
}

// doBuiltinLdapTest verifies that the supplied LdapSettings allow a successful
// connection + service-account bind + one-entry search against BaseDN.
// It is used as a fallback for TestLdap / TestLdapConnection in Team Edition.
func doBuiltinLdapTest(cfg model.LdapSettings) *model.AppError {
	server := strDeref(cfg.LdapServer)
	if server == "" {
		return model.NewAppError("doBuiltinLdapTest", "app.ldap_builtin.no_server.app_error", nil, "LdapServer is empty", http.StatusBadRequest)
	}

	port := 389
	if cfg.LdapPort != nil {
		port = *cfg.LdapPort
	}
	addr := net.JoinHostPort(server, fmt.Sprintf("%d", port))

	mlog.Debug("Builtin LDAP test: dialing", mlog.String("addr", addr))

	skipVerify := cfg.SkipCertificateVerification != nil && *cfg.SkipCertificateVerification
	tlsCfg := &tls.Config{
		InsecureSkipVerify: skipVerify, //nolint:gosec
		ServerName:         server,
	}

	connSec := model.ConnSecurityNone
	if cfg.ConnectionSecurity != nil {
		connSec = *cfg.ConnectionSecurity
	}

	var conn *ldap.Conn
	var dialErr error
	switch connSec {
	case model.ConnSecurityTLS:
		conn, dialErr = ldap.DialTLS("tcp", addr, tlsCfg)
	case model.ConnSecurityStarttls:
		conn, dialErr = ldap.Dial("tcp", addr)
		if dialErr == nil {
			dialErr = conn.StartTLS(tlsCfg)
		}
	default:
		conn, dialErr = ldap.Dial("tcp", addr)
	}
	if dialErr != nil {
		mlog.Debug("Builtin LDAP test: dial failed", mlog.String("addr", addr), mlog.Err(dialErr))
		return model.NewAppError("doBuiltinLdapTest", "app.ldap_builtin.dial.app_error", nil, dialErr.Error(), http.StatusInternalServerError)
	}
	defer conn.Close()
	mlog.Debug("Builtin LDAP test: dial OK", mlog.String("addr", addr))

	// Патч: всегда выставляем таймаут на LDAP-операции (bind, search).
	// Без него requestTimeout == 0 и операции зависают бесконечно.
	queryTimeout := 30 * time.Second
	if cfg.QueryTimeout != nil && *cfg.QueryTimeout > 0 {
		queryTimeout = time.Duration(*cfg.QueryTimeout) * time.Second
	}
	conn.SetTimeout(queryTimeout)

	// Service-account bind
	if bindUser := strDeref(cfg.BindUsername); bindUser != "" {
		mlog.Debug("Builtin LDAP test: binding", mlog.String("bind_user", bindUser))
		if err := conn.Bind(bindUser, strDeref(cfg.BindPassword)); err != nil {
			mlog.Debug("Builtin LDAP test: bind failed", mlog.Err(err))
			return model.NewAppError("doBuiltinLdapTest", "app.ldap_builtin.bind.app_error", nil, err.Error(), http.StatusUnauthorized)
		}
		mlog.Debug("Builtin LDAP test: bind OK")
	}

	// Verify BaseDN is reachable with a minimal base-object search
	baseDN := strDeref(cfg.BaseDN)
	mlog.Debug("Builtin LDAP test: searching BaseDN", mlog.String("base_dn", baseDN))
	req := ldap.NewSearchRequest(
		baseDN, ldap.ScopeBaseObject, ldap.NeverDerefAliases,
		1, 0, false, "(objectClass=*)", []string{"dn"}, nil,
	)
	if _, err := conn.Search(req); err != nil {
		mlog.Debug("Builtin LDAP test: search failed", mlog.Err(err))
		return model.NewAppError("doBuiltinLdapTest", "app.ldap_builtin.search.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	mlog.Debug("Builtin LDAP test: all checks passed")
	return nil
}

// GetAllLDAPUsers returns every user in the DB whose AuthService is "ldap".
// Used by the builtin sync worker to identify users to deactivate.
func (a *App) GetAllLDAPUsers() ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store().User().GetAllUsingAuthService(model.UserAuthServiceLdap)
	if err != nil {
		return nil, model.NewAppError("GetAllLDAPUsers", "app.user.get_by_auth.other.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return users, nil
}

func strDeref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
