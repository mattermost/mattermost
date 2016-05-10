// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package ldap

import (
	"crypto/tls"
	"fmt"

	l4g "github.com/alecthomas/log4go"
	"github.com/go-ldap/ldap"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type LdapInterfaceImpl struct {
}

func init() {
	ldap := &LdapInterfaceImpl{}
	einterfaces.RegisterLdapInterface(ldap)
}

func connect() (*ldap.Conn, *model.AppError) {
	if !utils.IsLicensed || !*utils.License.Features.LDAP {
		return nil, model.NewLocAppError("connect", "ent.ldap.do_login.licence_disable.app_error", nil, "")
	}

	athority := fmt.Sprintf("%s:%d", *utils.Cfg.LdapSettings.LdapServer, *utils.Cfg.LdapSettings.LdapPort)
	tlsConfig := &tls.Config{
		ServerName:         *utils.Cfg.LdapSettings.LdapServer,
		InsecureSkipVerify: *utils.Cfg.LdapSettings.SkipCertificateVerification,
	}

	var lconn *ldap.Conn
	var err error
	if *utils.Cfg.LdapSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {
		lconn, err = ldap.DialTLS("tcp", athority, tlsConfig)
		if err != nil {
			return nil, model.NewLocAppError("connect", "ent.ldap.do_login.unable_to_connect.app_error", nil, err.Error())
		}
	} else {
		lconn, err = ldap.Dial("tcp", athority)
		if err != nil {
			return nil, model.NewLocAppError("connect", "ent.ldap.do_login.unable_to_connect.app_error", nil, err.Error())
		}

		if *utils.Cfg.LdapSettings.ConnectionSecurity == model.CONN_SECURITY_STARTTLS {
			if err = lconn.StartTLS(tlsConfig); err != nil {
				return nil, model.NewLocAppError("connect", "ent.ldap.do_login.unable_to_connect.app_error", nil, err.Error())
			}
		}
	}

	// Bind as our user
	if err = lconn.Bind(*utils.Cfg.LdapSettings.BindUsername, *utils.Cfg.LdapSettings.BindPassword); err != nil {
		return nil, model.NewLocAppError("connect", "ent.ldap.do_login.bind_admin_user.app_error", nil, err.Error())
	}

	return lconn, nil
}

func doLdapSearch(conn *ldap.Conn, filter string) (*ldap.SearchResult, error) {
	// Search for the user
	searchRequest := ldap.NewSearchRequest(
		*utils.Cfg.LdapSettings.BaseDN,
		ldap.ScopeWholeSubtree,
		ldap.DerefAlways,
		0,
		*utils.Cfg.LdapSettings.QueryTimeout,
		false,
		filter,
		nil,
		nil,
	)

	return conn.Search(searchRequest)
}

func findUser(conn *ldap.Conn, id string) (*model.User, *string, *model.AppError) {
	// Construct filter
	filter := ""
	if *utils.Cfg.LdapSettings.UserFilter != "" {
		filter = "(&(" + *utils.Cfg.LdapSettings.IdAttribute + "=" + id + ")" + *utils.Cfg.LdapSettings.UserFilter + ")"
	} else {
		filter = "(" + *utils.Cfg.LdapSettings.IdAttribute + "=" + id + ")"
	}

	result, err := doLdapSearch(conn, filter)
	if err != nil {
		return nil, nil, model.NewLocAppError("findUser", "ent.ldap.do_login.search_ldap_server.app_error", nil, err.Error())
	}

	// Check that we got only one result
	if len(result.Entries) < 1 {
		if *utils.Cfg.LdapSettings.UserFilter != "" {
			// Check to see if the user exists without the admin supplied user filter.
			plainFilter := "(" + *utils.Cfg.LdapSettings.IdAttribute + "=" + id + ")"
			result, err := doLdapSearch(conn, plainFilter)
			if err != nil {
				// This would probably only happen in some strange case where Mattermost was restricted from
				// searching outside it's pre-defined filter. So just give up and use the generic error message.
				return nil, nil, model.NewLocAppError("findUser", "ent.ldap.do_login.user_not_registered.app_error", nil, "username="+id)
			}
			// If we found the user, this means they are registered on the LDAP server but filtered from using
			// mattermost. So give a nice error saying so.
			if len(result.Entries) >= 1 {
				return nil, nil, model.NewLocAppError("findUser", "ent.ldap.do_login.user_filtered.app_error", nil, "username="+id)
			}
		}
		// If we didn't get the user, it does not exist
		return nil, nil, model.NewLocAppError("findUser", "ent.ldap.do_login.user_not_registered.app_error", nil, "username="+id)
	}
	if len(result.Entries) > 1 {
		return nil, nil, model.NewLocAppError("findUser", "ent.ldap.do_login.matched_to_many_users.app_error", nil, "username="+id)
	}

	userdn := result.Entries[0].DN
	return userFromLdapUser(result.Entries[0]), &userdn, nil
}

func checkPassword(conn *ldap.Conn, userdn string, password string) *model.AppError {
	// Check some silly cases
	if userdn == "" || password == "" {
		return model.NewLocAppError("checkPassword", "ent.ldap.do_login.invalid_password.app_error", nil, "blank password or dn")
	}
	// If we can bind to the LDAP server the credentials are valid
	err := conn.Bind(userdn, password)
	if err != nil {
		return model.NewLocAppError("checkPassword", "ent.ldap.do_login.invalid_password.app_error", nil, err.Error())
	}

	return nil
}

func userFromLdapUser(ldapUser *ldap.Entry) *model.User {
	user := &model.User{}
	user.Username = model.CleanUsername(ldapUser.GetAttributeValue(*utils.Cfg.LdapSettings.UsernameAttribute))
	user.FirstName = ldapUser.GetAttributeValue(*utils.Cfg.LdapSettings.FirstNameAttribute)
	user.LastName = ldapUser.GetAttributeValue(*utils.Cfg.LdapSettings.LastNameAttribute)
	user.Nickname = ldapUser.GetAttributeValue(*utils.Cfg.LdapSettings.NicknameAttribute)
	user.Email = ldapUser.GetAttributeValue(*utils.Cfg.LdapSettings.EmailAttribute)
	user.AuthService = model.USER_AUTH_SERVICE_LDAP
	user.AuthData = ldapUser.GetAttributeValue(*utils.Cfg.LdapSettings.IdAttribute)

	if user.Email != "" {
		user.EmailVerified = true
	}

	return user
}

func updateLdapUser(existingUser *model.User, currentLdapUser *model.User) *model.User {
	// Required Fields
	existingUser.Username = currentLdapUser.Username
	existingUser.FirstName = currentLdapUser.FirstName
	existingUser.LastName = currentLdapUser.LastName
	existingUser.Email = currentLdapUser.Email

	// Optional Fields
	if *utils.Cfg.LdapSettings.NicknameAttribute != "" {
		existingUser.Nickname = currentLdapUser.Nickname
	}

	if result := <-api.Srv.Store.User().Update(existingUser, false); result.Err != nil {
		l4g.Error("Unable to update existing LDAP user. Allowing login anyway. err=%v", result.Err)
		return existingUser
	} else {
		return result.Data.([2]*model.User)[0]
	}
}

func (m *LdapInterfaceImpl) GetUser(id string) (*model.User, *model.AppError) {
	l, err := connect()
	if err != nil {
		return nil, err
	}
	defer l.Close()

	currentLdapUser, _, err := findUser(l, id)
	if err != nil {
		return nil, err
	}

	return currentLdapUser, nil
}

func (m *LdapInterfaceImpl) CheckPassword(id string, password string) *model.AppError {
	l, err := connect()
	if err != nil {
		return err
	}
	defer l.Close()

	_, userdn, err := findUser(l, id)
	if err != nil {
		return err
	}

	err = checkPassword(l, *userdn, password)
	if err != nil {
		return err
	}

	return nil
}

func (m *LdapInterfaceImpl) DoLogin(id string, password string) (*model.User, *model.AppError) {
	l, err := connect()
	if err != nil {
		return nil, err
	}
	defer l.Close()

	currentLdapUser, userdn, err := findUser(l, id)
	if err != nil {
		return nil, err
	}

	userc := api.Srv.Store.User().GetByAuth(currentLdapUser.AuthData, currentLdapUser.AuthService)

	err = checkPassword(l, *userdn, password)
	if err != nil {
		// For the audit trail check if the user we tried to log into is a real account
		if result := <-userc; result.Err == nil {
			existingUser := result.Data.(*model.User)
			return existingUser, err
		}
		return nil, err
	}

	//
	// At this point the user is authenticated with the LDAP server
	//

	if result := <-userc; result.Err != nil {
		// MM Account does not exist
		if user, err := api.CreateUser(currentLdapUser); err != nil {
			return nil, err
		} else {
			return user, nil
		}
	} else {
		// MM Account exists
		existingUser := result.Data.(*model.User)
		return updateLdapUser(existingUser, currentLdapUser), nil
	}
}

func (m *LdapInterfaceImpl) SwitchToLdap(userId, ldapId, ldapPassword string) *model.AppError {
	l, err := connect()
	if err != nil {
		return err
	}
	defer l.Close()

	currentLdapUser, userdn, err := findUser(l, ldapId)
	if err != nil {
		return err
	}

	err = checkPassword(l, *userdn, ldapPassword)
	if err != nil {
		return err
	}

	if result := <-api.Srv.Store.User().UpdateAuthData(userId, model.USER_AUTH_SERVICE_LDAP, currentLdapUser.AuthData, currentLdapUser.Email); result.Err != nil {
		return result.Err
	}

	return nil
}

func (m *LdapInterfaceImpl) ValidateFilter(filter string) *model.AppError {
	if _, err := ldap.CompileFilter(filter); err != nil {
		return model.NewLocAppError("ValidateFilter", "ent.ldap.validate_filter.app_error", nil, err.Error())
	}
	return nil
}
