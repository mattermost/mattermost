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
)

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

	queryTimeout := 30 * time.Second
	if cfg.QueryTimeout != nil && *cfg.QueryTimeout > 0 {
		queryTimeout = time.Duration(*cfg.QueryTimeout) * time.Second
	}
	// SetTimeout uses time.AfterFunc which may not unblock a hung TLS read;
	// still set it as a hint to the library, but enforce the deadline ourselves.
	conn.SetTimeout(queryTimeout)

	// Service-account bind
	if bindUser := strDeref(cfg.BindUsername); bindUser != "" {
		bindPass := strDeref(cfg.BindPassword)
		if bindPass == "" {
			mlog.Debug("Builtin LDAP test: bind skipped — BindPassword is empty")
			return model.NewAppError("doBuiltinLdapTest", "app.ldap_builtin.bind.app_error", nil, "BindPassword is empty", http.StatusBadRequest)
		}
		mlog.Debug("Builtin LDAP test: binding", mlog.String("bind_user", bindUser))
		if err := ldapWithTimeout(conn, queryTimeout, func() error { return conn.Bind(bindUser, bindPass) }); err != nil {
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
	if err := ldapWithTimeout(conn, queryTimeout, func() error { _, err := conn.Search(req); return err }); err != nil {
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

// ldapWithTimeout runs fn in a goroutine and returns its error, or closes conn
// and returns a timeout error if fn does not complete within timeout.
// conn.SetTimeout is unreliable for TLS connections; this is the fallback.
func ldapWithTimeout(conn interface{ Close() }, timeout time.Duration, fn func() error) error {
	ch := make(chan error, 1)
	go func() { ch <- fn() }()
	select {
	case err := <-ch:
		return err
	case <-time.After(timeout):
		conn.Close()
		return fmt.Errorf("ldap operation timed out after %s", timeout)
	}
}
