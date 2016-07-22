package ldap

import (
	"crypto/tls"
	"fmt"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"

	"github.com/go-ldap/ldap"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type LDAPClient struct {
	cfg *model.LdapSettings
}

func NewLdapInterface() einterfaces.LdapInterface {
	cfg := &utils.Cfg.LdapSettings
	return &LDAPClient{cfg: cfg}
}

func (lp *LDAPClient) connect() (conn *ldap.Conn, err error) {
	ldap.DefaultTimeout = time.Duration(*lp.cfg.QueryTimeout) * time.Second
	if *lp.cfg.ConnectionSecurity == "TLS" {
		conn, err = ldap.DialTLS("tcp", fmt.Sprintf("%s:%d", *lp.cfg.LdapServer, *lp.cfg.LdapPort), &tls.Config{InsecureSkipVerify: *lp.cfg.SkipCertificateVerification, ServerName: *lp.cfg.LdapServer})
	} else {
		conn, err = ldap.Dial("tcp", fmt.Sprintf("%s:%d", *lp.cfg.LdapServer, *lp.cfg.LdapPort))
	}
	return
}

func (lp *LDAPClient) bindRoot(conn *ldap.Conn) (err error) {
	err = conn.Bind(*lp.cfg.BindUsername, *lp.cfg.BindPassword)
	return
}

func (lp *LDAPClient) doConnect() (conn *ldap.Conn, err error) {
	conn, err = lp.connect()
	if err != nil {
		l4g.Error(utils.T("ent.ldap.do_login.unable_to_connect.app_error"), err)
		return
	}

	err = lp.bindRoot(conn)
	if err != nil {
		l4g.Error(utils.T("ent.ldap.do_login.bind_admin_user.app_error"), err)
		conn.Close()
		return
	}
	return
}

func escapeUIDs(uids []string) (escaped []string) {
	for _, uid := range uids {
		escaped = append(escaped, ldap.EscapeFilter(uid))
	}
	return
}

func (lp *LDAPClient) getUsersByUIDs(uids []string) (conn *ldap.Conn, entries []*ldap.Entry, users map[string]*model.User, err error) {
	conn, err = lp.doConnect()
	if err != nil {
		return
	}

	// there is no limit for ldap query string
	// let's use users filter instead of retrieving all LDAP users
	uidsFilter := fmt.Sprintf(
		"|(%s=%s)",
		*lp.cfg.LoginFieldName,
		strings.Join(
			escapeUIDs(uids),
			fmt.Sprintf(")(%s=",
				*lp.cfg.LoginFieldName)))
	result, err := conn.Search(&ldap.SearchRequest{
		BaseDN: *lp.cfg.BaseDN,
		Scope:  ldap.ScopeWholeSubtree,
		Filter: fmt.Sprintf("(&(%s)%s)", uidsFilter, *lp.cfg.UserFilter)})
	if err != nil {
		l4g.Error(utils.T("ent.ldap.do_login.search_ldap_server.app_error"), err)
		conn.Close()
		return
	}
	entries = result.Entries
	users = make(map[string]*model.User, len(result.Entries))

	for _, entry := range entries {
		authData := entry.GetAttributeValue(*lp.cfg.LoginFieldName)
		users[authData] = &model.User{
			AuthService: model.USER_AUTH_SERVICE_LDAP,
			FirstName:   entry.GetAttributeValue(*lp.cfg.FirstNameAttribute),
			LastName:    entry.GetAttributeValue(*lp.cfg.LastNameAttribute),
			Email:       entry.GetAttributeValue(*lp.cfg.EmailAttribute),
			Username:    entry.GetAttributeValue(*lp.cfg.UsernameAttribute),
			AuthData:    &authData,
			Nickname:    entry.GetAttributeValue(*lp.cfg.NicknameAttribute),
		}
	}

	return
}

func (lp *LDAPClient) getUserByUID(uid string) (conn *ldap.Conn, entry *ldap.Entry, user *model.User, err *model.AppError) {
	conn, entries, users, _ := lp.getUsersByUIDs([]string{uid})
	if len(entries) > 1 {
		conn.Close()
		return nil, nil, nil, model.NewLocAppError("ldap.DoLogin", "ent.ldap.do_login.matched_to_many_users.app_error", nil, "")
	} else if len(entries) < 1 {
		return nil, nil, nil, model.NewLocAppError("ldap.DoLogin", "ent.ldap.do_login.user_not_registered.app_error", nil, "")
	}
	for _, user := range users {
		return conn, entries[0], user, nil
	}

	return
}

func (lp *LDAPClient) DoLogin(id string, password string) (user *model.User, errApp *model.AppError) {
	l4g.Debug("Started DoLogin")
	conn, entry, user, errAp := lp.getUserByUID(id)

	if errAp != nil {
		return nil, errAp
	}

	defer conn.Close()

	err := conn.Bind(entry.DN, password)
	if err != nil {
		return nil, model.NewLocAppError("ldap.DoLogin", "ent.ldap.do_login.invalid_password.app_error", nil, "")
	}

	if !api.IsUsernameTaken(user.Username) {
		ruser, errApp := api.CreateUser(user)
		if errApp != nil {
			return nil, errApp
		}
		return ruser, nil
	} else if result := <-api.Srv.Store.User().GetForLogin(*user.AuthData, false, false, true); result.Err != nil {
		return nil, model.NewLocAppError("ldap.DoLogin", "ent.ldap.do_login.unable_to_create_user.app_error", nil, result.Err.Error())
	} else {
		return result.Data.(*model.User), nil
	}

	return user, nil
}

func (lp *LDAPClient) GetUser(id string) (*model.User, *model.AppError) {
	l4g.Debug("Started GetUser")
	conn, _, user, err := lp.getUserByUID(id)

	if err != nil {
		return nil, model.NewLocAppError("ldap.GetUser", "Cannot get user from LDAP", nil, "")
	}

	conn.Close()

	if result := <-api.Srv.Store.User().GetForLogin(*user.AuthData, false, false, true); result.Err != nil {
		return user, nil
	} else {
		return result.Data.(*model.User), nil
	}
}

func (lp *LDAPClient) CheckPassword(id string, password string) *model.AppError {
	l4g.Debug("Started CheckPassword")
	conn, entry, _, errAp := lp.getUserByUID(id)
	if errAp != nil {
		return errAp
	}
	defer conn.Close()

	err := conn.Bind(entry.DN, password)
	if err != nil {
		return model.NewLocAppError("ldap.CheckPassword", "ent.ldap.do_login.invalid_password.app_error", nil, err.Error())
	}

	return nil
}

func (lp *LDAPClient) SwitchToLdap(userId, ldapId, ldapPassword string) *model.AppError {
	// called from api/user.go:emailToLdap
	l4g.Debug("Started SwitchToLdap")

	conn, _, ldapUser, err := lp.getUserByUID(ldapId)

	if err != nil {
		return model.NewLocAppError("ldap.SwitchToLdap", "Cannot get user from LDAP", nil, "")
	}

	defer conn.Close()

	err = lp.CheckPassword(ldapId, ldapPassword)
	if err != nil {
		return err
	}
	if result := <-api.Srv.Store.User().UpdateAuthData(userId, model.USER_AUTH_SERVICE_LDAP, ldapUser.AuthData, ldapUser.Email); result.Err != nil {
		return model.NewLocAppError("ldap.SwitchToLdap", "ent.ldap.do_login.unable_to_create_user.app_error", nil, result.Err.Error())
	}
	return nil
}

func (lp *LDAPClient) ValidateFilter(filter string) *model.AppError {
	l4g.Debug("Started ValidateFilter")
	_, err := ldap.CompileFilter(filter)
	if err != nil {
		return model.NewLocAppError("ldap.ValidateFilter", "ent.ldap.validate_filter.app_error", nil, err.Error())
	}
	return nil
}

func (lp *LDAPClient) StartLdapSyncJob() {
	// executed from mattermost.go:main
	l4g.Debug("Started StartLdapSyncJob")
	lp.Syncronize()
	ticker := time.NewTicker(time.Duration(*lp.cfg.SyncIntervalMinutes) * time.Minute)
	go func() {
		for {
			select {
			case <-ticker.C:
				lp.Syncronize()
			}
		}
	}()
}

func updateActive(user *model.User, active bool) *model.AppError {
	if active {
		user.DeleteAt = 0
	} else {
		user.DeleteAt = model.GetMillis()
	}

	if result := <-api.Srv.Store.User().Update(user, true); result.Err != nil {
		return result.Err
	} else {

		if user.DeleteAt > 0 {
			errAp := api.RevokeAllSessionsNoContext(user.Id)
			if errAp != nil {
				return errAp
			}
		}

		if extra := <-api.Srv.Store.Channel().ExtraUpdateByUser(user.Id, model.GetMillis()); extra.Err != nil {
			return extra.Err
		}
	}
	return nil
}

func (lp *LDAPClient) Syncronize() *model.AppError {
	// executed from mattermost.go:cmdRunLdapSync
	l4g.Debug("Started Syncronize")

	pchan := api.Srv.Store.User().GetAllUsingAuthService(model.USER_AUTH_SERVICE_LDAP)
	var uids []string

	if result := <-pchan; result.Err != nil {
		return result.Err
	} else {
		profiles := result.Data.([]*model.User)

		for _, user := range profiles {
			uids = append(uids, *user.AuthData)
		}
		conn, _, users, err := lp.getUsersByUIDs(uids)
		if err != nil {
			return model.NewLocAppError("ldap.Syncronize", "ent.ldap.syncronize.get_all.app_error", nil, "")
		}
		conn.Close()
		for _, user := range profiles {
			if _, ok := users[*user.AuthData]; !ok {
				if user.DeleteAt == 0 {
					l4g.Debug("ldap.Syncronize: User %s should be deactivated", *user.AuthData)
					errAp := updateActive(user, false)
					if errAp != nil {
						l4g.Error("%s", errAp.Error())
					}
				}
			} else if user.DeleteAt != 0 {
				l4g.Debug("ldap.Syncronize: User %s should be activated", *user.AuthData)
				errAp := updateActive(user, true)
				if errAp != nil {
					l4g.Error("%s", errAp.Error())
				}
			}
		}
	}
	l4g.Debug(utils.T("ent.ldap.syncdone.info"))
	return nil
}

func (lp *LDAPClient) SyncNow() {
	lp.Syncronize()
}

// RunTest does a test for making a simple connection.
func (lp *LDAPClient) RunTest() *model.AppError {
	conn, err := lp.doConnect()
	if err != nil {
		return model.NewLocAppError("ldap.RunTest", "ent.ldap.do_login.unable_to_connect.app_error", nil, "")
	}
	defer conn.Close()

	return nil
}

// GetAllLdapUsers() retrieves a list of all LDAP users.
func (lp *LDAPClient) GetAllLdapUsers() ([]*model.User, *model.AppError) {
	l4g.Debug("Started GetAllLdapUsers")
	conn, err := lp.doConnect()
	if err != nil {
		return nil, model.NewLocAppError("ldap.GetAllLdapUsers", "ent.ldap.getallldapusers.get_all.app_error", nil, "")
	}
	defer conn.Close()

	// retrieve all user entries
	result, err := conn.Search(&ldap.SearchRequest{
		BaseDN: *lp.cfg.BaseDN,
		Scope:  ldap.ScopeWholeSubtree})
	if err != nil {
		l4g.Error(utils.T("ent.ldap.getallldapusers.get_all.app_error"), err)
		return nil, model.NewLocAppError("ldap.GetAllLdapUsers", "ent.ldap.getallldapusers.get_all.app_error", nil, "")
	}
	entries := result.Entries
	users := make([]*model.User, len(entries))

	for _, entry := range entries {
		authData := entry.GetAttributeValue(*lp.cfg.LoginFieldName)
		users = append(users, &model.User{
			AuthService: model.USER_AUTH_SERVICE_LDAP,
			FirstName:   entry.GetAttributeValue(*lp.cfg.FirstNameAttribute),
			LastName:    entry.GetAttributeValue(*lp.cfg.LastNameAttribute),
			Email:       entry.GetAttributeValue(*lp.cfg.EmailAttribute),
			Username:    entry.GetAttributeValue(*lp.cfg.UsernameAttribute),
			AuthData:    &authData,
			Nickname:    entry.GetAttributeValue(*lp.cfg.NicknameAttribute),
		})
	}

	return users, nil
}
