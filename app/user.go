// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	b64 "encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/golang/freetype"
	"github.com/golang/freetype/truetype"
	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/services/mfa"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
)

const (
	TOKEN_TYPE_PASSWORD_RECOVERY  = "password_recovery"
	TOKEN_TYPE_VERIFY_EMAIL       = "verify_email"
	TOKEN_TYPE_TEAM_INVITATION    = "team_invitation"
	TOKEN_TYPE_GUEST_INVITATION   = "guest_invitation"
	TOKEN_TYPE_CWS_ACCESS         = "cws_access_token"
	PASSWORD_RECOVER_EXPIRY_TIME  = 1000 * 60 * 60      // 1 hour
	INVITATION_EXPIRY_TIME        = 1000 * 60 * 60 * 48 // 48 hours
	IMAGE_PROFILE_PIXEL_DIMENSION = 128
)

func (a *App) CreateUserWithToken(user *model.User, token *model.Token) (*model.User, *model.AppError) {
	if err := a.IsUserSignUpAllowed(); err != nil {
		return nil, err
	}

	if token.Type != TOKEN_TYPE_TEAM_INVITATION && token.Type != TOKEN_TYPE_GUEST_INVITATION {
		return nil, model.NewAppError("CreateUserWithToken", "api.user.create_user.signup_link_invalid.app_error", nil, "", http.StatusBadRequest)
	}

	if model.GetMillis()-token.CreateAt >= INVITATION_EXPIRY_TIME {
		a.DeleteToken(token)
		return nil, model.NewAppError("CreateUserWithToken", "api.user.create_user.signup_link_expired.app_error", nil, "", http.StatusBadRequest)
	}

	tokenData := model.MapFromJson(strings.NewReader(token.Extra))

	team, nErr := a.Srv().Store.Team().Get(tokenData["teamId"])
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("CreateUserWithToken", "app.team.get.find.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("CreateUserWithToken", "app.team.get.finding.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	channels, nErr := a.Srv().Store.Channel().GetChannelsByIds(strings.Split(tokenData["channels"], " "), false)
	if nErr != nil {
		return nil, model.NewAppError("CreateUserWithToken", "app.channel.get_channels_by_ids.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	user.Email = tokenData["email"]
	user.EmailVerified = true

	var ruser *model.User
	var err *model.AppError
	if token.Type == TOKEN_TYPE_TEAM_INVITATION {
		ruser, err = a.CreateUser(user)
	} else {
		ruser, err = a.CreateGuest(user)
	}
	if err != nil {
		return nil, err
	}

	if err := a.JoinUserToTeam(team, ruser, ""); err != nil {
		return nil, err
	}

	a.AddDirectChannels(team.Id, ruser)

	if token.Type == TOKEN_TYPE_GUEST_INVITATION {
		for _, channel := range channels {
			_, err := a.AddChannelMember(ruser.Id, channel, "", "")
			if err != nil {
				mlog.Error("Failed to add channel member", mlog.Err(err))
			}
		}
	}

	if err := a.DeleteToken(token); err != nil {
		return nil, err
	}

	return ruser, nil
}

func (a *App) CreateUserWithInviteId(user *model.User, inviteId, redirect string) (*model.User, *model.AppError) {
	if err := a.IsUserSignUpAllowed(); err != nil {
		return nil, err
	}

	team, nErr := a.Srv().Store.Team().GetByInviteId(inviteId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("CreateUserWithInviteId", "app.team.get_by_invite_id.finding.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("CreateUserWithInviteId", "app.team.get_by_invite_id.finding.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	if team.IsGroupConstrained() {
		return nil, model.NewAppError("CreateUserWithInviteId", "app.team.invite_id.group_constrained.error", nil, "", http.StatusForbidden)
	}

	if !CheckUserDomain(user, team.AllowedDomains) {
		return nil, model.NewAppError("CreateUserWithInviteId", "api.team.invite_members.invalid_email.app_error", map[string]interface{}{"Addresses": team.AllowedDomains}, "", http.StatusForbidden)
	}

	user.EmailVerified = false

	ruser, err := a.CreateUser(user)
	if err != nil {
		return nil, err
	}

	if err := a.JoinUserToTeam(team, ruser, ""); err != nil {
		return nil, err
	}

	a.AddDirectChannels(team.Id, ruser)

	if err := a.Srv().EmailService.sendWelcomeEmail(ruser.Id, ruser.Email, ruser.EmailVerified, ruser.Locale, a.GetSiteURL(), redirect); err != nil {
		mlog.Error("Failed to send welcome email on create user with inviteId", mlog.Err(err))
	}

	return ruser, nil
}

func (a *App) CreateUserAsAdmin(user *model.User, redirect string) (*model.User, *model.AppError) {
	ruser, err := a.CreateUser(user)
	if err != nil {
		return nil, err
	}

	if err := a.Srv().EmailService.sendWelcomeEmail(ruser.Id, ruser.Email, ruser.EmailVerified, ruser.Locale, a.GetSiteURL(), redirect); err != nil {
		mlog.Error("Failed to send welcome email on create admin user", mlog.Err(err))
	}

	return ruser, nil
}

func (a *App) CreateUserFromSignup(user *model.User, redirect string) (*model.User, *model.AppError) {
	if err := a.IsUserSignUpAllowed(); err != nil {
		return nil, err
	}

	if !a.IsFirstUserAccount() && !*a.Config().TeamSettings.EnableOpenServer {
		err := model.NewAppError("CreateUserFromSignup", "api.user.create_user.no_open_server", nil, "email="+user.Email, http.StatusForbidden)
		return nil, err
	}

	user.EmailVerified = false

	ruser, err := a.CreateUser(user)
	if err != nil {
		return nil, err
	}

	if err := a.Srv().EmailService.sendWelcomeEmail(ruser.Id, ruser.Email, ruser.EmailVerified, ruser.Locale, a.GetSiteURL(), redirect); err != nil {
		mlog.Error("Failed to send welcome email on create user from signup", mlog.Err(err))
	}

	return ruser, nil
}

func (a *App) IsUserSignUpAllowed() *model.AppError {
	if !*a.Config().EmailSettings.EnableSignUpWithEmail || !*a.Config().TeamSettings.EnableUserCreation {
		err := model.NewAppError("IsUserSignUpAllowed", "api.user.create_user.signup_email_disabled.app_error", nil, "", http.StatusNotImplemented)
		return err
	}
	return nil
}

func (s *Server) IsFirstUserAccount() bool {
	cachedSessions, err := s.sessionCache.Len()
	if err != nil {
		return false
	}
	if cachedSessions == 0 {
		count, err := s.Store.User().Count(model.UserCountOptions{IncludeDeleted: true})
		if err != nil {
			mlog.Error("There was a error fetching if first user account", mlog.Err(err))
			return false
		}
		if count <= 0 {
			return true
		}
	}

	return false
}

func (a *App) IsFirstUserAccount() bool {
	return a.Srv().IsFirstUserAccount()
}

// CreateUser creates a user and sets several fields of the returned User struct to
// their zero values.
func (a *App) CreateUser(user *model.User) (*model.User, *model.AppError) {
	return a.createUserOrGuest(user, false)
}

// CreateGuest creates a guest and sets several fields of the returned User struct to
// their zero values.
func (a *App) CreateGuest(user *model.User) (*model.User, *model.AppError) {
	return a.createUserOrGuest(user, true)
}

func (a *App) createUserOrGuest(user *model.User, guest bool) (*model.User, *model.AppError) {
	user.Roles = model.SYSTEM_USER_ROLE_ID
	if guest {
		user.Roles = model.SYSTEM_GUEST_ROLE_ID
	}

	if !user.IsLDAPUser() && !user.IsSAMLUser() && !user.IsGuest() && !CheckUserDomain(user, *a.Config().TeamSettings.RestrictCreationToDomains) {
		return nil, model.NewAppError("CreateUser", "api.user.create_user.accepted_domain.app_error", nil, "", http.StatusBadRequest)
	}

	if !user.IsLDAPUser() && !user.IsSAMLUser() && user.IsGuest() && !CheckUserDomain(user, *a.Config().GuestAccountsSettings.RestrictCreationToDomains) {
		return nil, model.NewAppError("CreateUser", "api.user.create_user.accepted_domain.app_error", nil, "", http.StatusBadRequest)
	}

	// Below is a special case where the first user in the entire
	// system is granted the system_admin role
	count, err := a.Srv().Store.User().Count(model.UserCountOptions{IncludeDeleted: true})
	if err != nil {
		return nil, model.NewAppError("createUserOrGuest", "app.user.get_total_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if count <= 0 {
		user.Roles = model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID
	}

	if _, ok := utils.GetSupportedLocales()[user.Locale]; !ok {
		user.Locale = *a.Config().LocalizationSettings.DefaultClientLocale
	}

	ruser, appErr := a.createUser(user)
	if appErr != nil {
		return nil, appErr
	}
	// This message goes to everyone, so the teamId, channelId and userId are irrelevant
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_NEW_USER, "", "", "", nil)
	message.Add("user_id", ruser.Id)
	a.Publish(message)

	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		a.Srv().Go(func() {
			pluginContext := a.PluginContext()
			pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.UserHasBeenCreated(pluginContext, user)
				return true
			}, plugin.UserHasBeenCreatedId)
		})
	}

	return ruser, nil
}

func (a *App) createUser(user *model.User) (*model.User, *model.AppError) {
	user.MakeNonNil()

	if err := a.IsPasswordValid(user.Password); user.AuthService == "" && err != nil {
		return nil, err
	}

	ruser, nErr := a.Srv().Store.User().Save(user)
	if nErr != nil {
		mlog.Error("Couldn't save the user", mlog.Err(nErr))
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		case errors.As(nErr, &invErr):
			switch invErr.Field {
			case "email":
				return nil, model.NewAppError("createUser", "app.user.save.email_exists.app_error", nil, invErr.Error(), http.StatusBadRequest)
			case "username":
				return nil, model.NewAppError("createUser", "app.user.save.username_exists.app_error", nil, invErr.Error(), http.StatusBadRequest)
			default:
				return nil, model.NewAppError("createUser", "app.user.save.existing.app_error", nil, invErr.Error(), http.StatusBadRequest)
			}
		default:
			return nil, model.NewAppError("createUser", "app.user.save.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	if user.EmailVerified {
		if err := a.VerifyUserEmail(ruser.Id, user.Email); err != nil {
			mlog.Error("Failed to set email verified", mlog.Err(err))
		}
	}

	pref := model.Preference{UserId: ruser.Id, Category: model.PREFERENCE_CATEGORY_TUTORIAL_STEPS, Name: ruser.Id, Value: "0"}
	if err := a.Srv().Store.Preference().Save(&model.Preferences{pref}); err != nil {
		mlog.Error("Encountered error saving tutorial preference", mlog.Err(err))
	}

	go a.UpdateViewedProductNoticesForNewUser(ruser.Id)
	ruser.Sanitize(map[string]bool{})
	return ruser, nil
}

func (a *App) CreateOAuthUser(service string, userData io.Reader, teamId string) (*model.User, *model.AppError) {
	if !*a.Config().TeamSettings.EnableUserCreation {
		return nil, model.NewAppError("CreateOAuthUser", "api.user.create_user.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	provider := einterfaces.GetOauthProvider(service)
	if provider == nil {
		return nil, model.NewAppError("CreateOAuthUser", "api.user.create_oauth_user.not_available.app_error", map[string]interface{}{"Service": strings.Title(service)}, "", http.StatusNotImplemented)
	}
	user, err1 := provider.GetUserFromJson(userData)
	if err1 != nil {
		return nil, model.NewAppError("CreateOAuthUser", "api.user.create_oauth_user.create.app_error", map[string]interface{}{"Service": service}, err1.Error(), http.StatusInternalServerError)
	}

	suchan := make(chan store.StoreResult, 1)
	euchan := make(chan store.StoreResult, 1)
	go func() {
		userByAuth, err := a.Srv().Store.User().GetByAuth(user.AuthData, service)
		suchan <- store.StoreResult{Data: userByAuth, NErr: err}
		close(suchan)
	}()
	go func() {
		userByEmail, err := a.Srv().Store.User().GetByEmail(user.Email)
		euchan <- store.StoreResult{Data: userByEmail, NErr: err}
		close(euchan)
	}()

	found := true
	count := 0
	for found {
		if found = a.IsUsernameTaken(user.Username); found {
			user.Username = user.Username + strconv.Itoa(count)
			count++
		}
	}

	if result := <-suchan; result.NErr == nil {
		return result.Data.(*model.User), nil
	}

	if result := <-euchan; result.NErr == nil {
		authService := result.Data.(*model.User).AuthService
		if authService == "" {
			return nil, model.NewAppError("CreateOAuthUser", "api.user.create_oauth_user.already_attached.app_error", map[string]interface{}{"Service": service, "Auth": model.USER_AUTH_SERVICE_EMAIL}, "email="+user.Email, http.StatusBadRequest)
		}
		return nil, model.NewAppError("CreateOAuthUser", "api.user.create_oauth_user.already_attached.app_error", map[string]interface{}{"Service": service, "Auth": authService}, "email="+user.Email, http.StatusBadRequest)
	}

	user.EmailVerified = true

	ruser, err := a.CreateUser(user)
	if err != nil {
		return nil, err
	}

	if len(teamId) > 0 {
		err = a.AddUserToTeamByTeamId(teamId, user)
		if err != nil {
			return nil, err
		}

		err = a.AddDirectChannels(teamId, user)
		if err != nil {
			mlog.Error("Failed to add direct channels", mlog.Err(err))
		}
	}

	return ruser, nil
}

// CheckEmailDomain checks that an email domain matches a list of space-delimited domains as a string.
func CheckEmailDomain(email string, domains string) bool {
	if len(domains) == 0 {
		return true
	}

	domainArray := strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(strings.Replace(domains, "@", " ", -1), ",", " ", -1))))

	for _, d := range domainArray {
		if strings.HasSuffix(strings.ToLower(email), "@"+d) {
			return true
		}
	}

	return false
}

// CheckUserDomain checks that a user's email domain matches a list of space-delimited domains as a string.
func CheckUserDomain(user *model.User, domains string) bool {
	return CheckEmailDomain(user.Email, domains)
}

// IsUsernameTaken checks if the username is already used by another user. Return false if the username is invalid.
func (a *App) IsUsernameTaken(name string) bool {
	if !model.IsValidUsername(name) {
		return false
	}

	if _, err := a.Srv().Store.User().GetByUsername(name); err != nil {
		return false
	}

	return true
}

func (a *App) GetUser(userId string) (*model.User, *model.AppError) {
	user, err := a.Srv().Store.User().Get(userId)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUser", MISSING_ACCOUNT_ERROR, nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetUser", "app.user.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return user, nil
}

func (a *App) GetUserByUsername(username string) (*model.User, *model.AppError) {
	result, err := a.Srv().Store.User().GetByUsername(username)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUserByUsername", "app.user.get_by_username.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetUserByUsername", "app.user.get_by_username.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}
	return result, nil
}

func (a *App) GetUserByEmail(email string) (*model.User, *model.AppError) {
	user, err := a.Srv().Store.User().GetByEmail(email)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUserByEmail", MISSING_ACCOUNT_ERROR, nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetUserByEmail", MISSING_ACCOUNT_ERROR, nil, err.Error(), http.StatusInternalServerError)
		}
	}
	return user, nil
}

func (a *App) GetUserByAuth(authData *string, authService string) (*model.User, *model.AppError) {
	user, err := a.Srv().Store.User().GetByAuth(authData, authService)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetUserByAuth", MISSING_AUTH_ACCOUNT_ERROR, nil, invErr.Error(), http.StatusBadRequest)
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUserByAuth", MISSING_AUTH_ACCOUNT_ERROR, nil, nfErr.Error(), http.StatusInternalServerError)
		default:
			return nil, model.NewAppError("GetUserByAuth", "app.user.get_by_auth.other.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return user, nil
}

func (a *App) GetUsers(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetAllProfiles(options)
	if err != nil {
		return nil, model.NewAppError("GetUsers", "app.user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

func (a *App) GetUsersPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsers(options)
	if err != nil {
		return nil, err
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersEtag(restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", a.Srv().Store.User().GetEtagForAllProfiles(), a.Config().PrivacySettings.ShowFullName, a.Config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (a *App) GetUsersInTeam(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetProfiles(options)
	if err != nil {
		return nil, model.NewAppError("GetUsersInTeam", "app.user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

func (a *App) GetUsersNotInTeam(teamId string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetProfilesNotInTeam(teamId, groupConstrained, offset, limit, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetUsersNotInTeam", "app.user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

func (a *App) GetUsersInTeamPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersInTeam(options)
	if err != nil {
		return nil, err
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersNotInTeamPage(teamId string, groupConstrained bool, page int, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersNotInTeam(teamId, groupConstrained, page*perPage, perPage, viewRestrictions)
	if err != nil {
		return nil, err
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersInTeamEtag(teamId string, restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", a.Srv().Store.User().GetEtagForProfiles(teamId), a.Config().PrivacySettings.ShowFullName, a.Config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (a *App) GetUsersNotInTeamEtag(teamId string, restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", a.Srv().Store.User().GetEtagForProfilesNotInTeam(teamId), a.Config().PrivacySettings.ShowFullName, a.Config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (a *App) GetUsersInChannel(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetProfilesInChannel(options)
	if err != nil {
		return nil, model.NewAppError("GetUsersInChannel", "app.user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

func (a *App) GetUsersInChannelByStatus(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetProfilesInChannelByStatus(options)
	if err != nil {
		return nil, model.NewAppError("GetUsersInChannelByStatus", "app.user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

func (a *App) GetUsersInChannelMap(options *model.UserGetOptions, asAdmin bool) (map[string]*model.User, *model.AppError) {
	users, err := a.GetUsersInChannel(options)
	if err != nil {
		return nil, err
	}

	userMap := make(map[string]*model.User, len(users))

	for _, user := range users {
		a.SanitizeProfile(user, asAdmin)
		userMap[user.Id] = user
	}

	return userMap, nil
}

func (a *App) GetUsersInChannelPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersInChannel(options)
	if err != nil {
		return nil, err
	}
	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersInChannelPageByStatus(options *model.UserGetOptions, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersInChannelByStatus(options)
	if err != nil {
		return nil, err
	}
	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersNotInChannel(teamId string, channelId string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetProfilesNotInChannel(teamId, channelId, groupConstrained, offset, limit, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetUsersNotInChannel", "app.user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

func (a *App) GetUsersNotInChannelMap(teamId string, channelId string, groupConstrained bool, offset int, limit int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) (map[string]*model.User, *model.AppError) {
	users, err := a.GetUsersNotInChannel(teamId, channelId, groupConstrained, offset, limit, viewRestrictions)
	if err != nil {
		return nil, err
	}

	userMap := make(map[string]*model.User, len(users))

	for _, user := range users {
		a.SanitizeProfile(user, asAdmin)
		userMap[user.Id] = user
	}

	return userMap, nil
}

func (a *App) GetUsersNotInChannelPage(teamId string, channelId string, groupConstrained bool, page int, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersNotInChannel(teamId, channelId, groupConstrained, page*perPage, perPage, viewRestrictions)
	if err != nil {
		return nil, err
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersWithoutTeamPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersWithoutTeam(options)
	if err != nil {
		return nil, err
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersWithoutTeam(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetProfilesWithoutTeam(options)
	if err != nil {
		return nil, model.NewAppError("GetUsersWithoutTeam", "app.user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

// GetTeamGroupUsers returns the users who are associated to the team via GroupTeams and GroupMembers.
func (a *App) GetTeamGroupUsers(teamID string) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetTeamGroupUsers(teamID)
	if err != nil {
		return nil, model.NewAppError("GetTeamGroupUsers", "app.user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

// GetChannelGroupUsers returns the users who are associated to the channel via GroupChannels and GroupMembers.
func (a *App) GetChannelGroupUsers(channelID string) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetChannelGroupUsers(channelID)
	if err != nil {
		return nil, model.NewAppError("GetChannelGroupUsers", "app.user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

func (a *App) GetUsersByIds(userIds []string, options *store.UserGetByIdsOpts) ([]*model.User, *model.AppError) {
	allowFromCache := options.ViewRestrictions == nil

	users, err := a.Srv().Store.User().GetProfileByIds(userIds, options, allowFromCache)
	if err != nil {
		return nil, model.NewAppError("GetUsersByIds", "app.user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return a.sanitizeProfiles(users, options.IsAdmin), nil
}

func (a *App) GetUsersByGroupChannelIds(channelIds []string, asAdmin bool) (map[string][]*model.User, *model.AppError) {
	usersByChannelId, err := a.Srv().Store.User().GetProfileByGroupChannelIdsForUser(a.Session().UserId, channelIds)
	if err != nil {
		return nil, model.NewAppError("GetUsersByGroupChannelIds", "app.user.get_profile_by_group_channel_ids_for_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	for channelId, userList := range usersByChannelId {
		usersByChannelId[channelId] = a.sanitizeProfiles(userList, asAdmin)
	}

	return usersByChannelId, nil
}

func (a *App) GetUsersByUsernames(usernames []string, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store.User().GetProfilesByUsernames(usernames, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetUsersByUsernames", "app.user.get_profiles.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) sanitizeProfiles(users []*model.User, asAdmin bool) []*model.User {
	for _, u := range users {
		a.SanitizeProfile(u, asAdmin)
	}

	return users
}

func (a *App) GenerateMfaSecret(userId string) (*model.MfaSecret, *model.AppError) {
	user, err := a.GetUser(userId)
	if err != nil {
		return nil, err
	}

	mfaService := mfa.New(a, a.Srv().Store)
	secret, img, err := mfaService.GenerateSecret(user)
	if err != nil {
		return nil, err
	}

	// Make sure the old secret is not cached on any cluster nodes.
	a.InvalidateCacheForUser(user.Id)

	mfaSecret := &model.MfaSecret{Secret: secret, QRCode: b64.StdEncoding.EncodeToString(img)}
	return mfaSecret, nil
}

func (a *App) ActivateMfa(userId, token string) *model.AppError {
	user, err := a.Srv().Store.User().Get(userId)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("ActivateMfa", MISSING_ACCOUNT_ERROR, nil, nfErr.Error(), http.StatusNotFound)
		default:
			return model.NewAppError("ActivateMfa", "app.user.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	if len(user.AuthService) > 0 && user.AuthService != model.USER_AUTH_SERVICE_LDAP {
		return model.NewAppError("ActivateMfa", "api.user.activate_mfa.email_and_ldap_only.app_error", nil, "", http.StatusBadRequest)
	}

	mfaService := mfa.New(a, a.Srv().Store)
	if err := mfaService.Activate(user, token); err != nil {
		return err
	}

	// Make sure old MFA status is not cached locally or in cluster nodes.
	a.InvalidateCacheForUser(userId)

	return nil
}

func (a *App) DeactivateMfa(userId string) *model.AppError {
	mfaService := mfa.New(a, a.Srv().Store)
	if err := mfaService.Deactivate(userId); err != nil {
		return err
	}

	// Make sure old MFA status is not cached locally or in cluster nodes.
	a.InvalidateCacheForUser(userId)

	return nil
}

func CreateProfileImage(username string, userId string, initialFont string) ([]byte, *model.AppError) {
	colors := []color.NRGBA{
		{197, 8, 126, 255},
		{227, 207, 18, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
	}

	h := fnv.New32a()
	h.Write([]byte(userId))
	seed := h.Sum32()

	initial := string(strings.ToUpper(username)[0])

	font, err := getFont(initialFont)
	if err != nil {
		return nil, model.NewAppError("CreateProfileImage", "api.user.create_profile_image.default_font.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	color := colors[int64(seed)%int64(len(colors))]
	dstImg := image.NewRGBA(image.Rect(0, 0, IMAGE_PROFILE_PIXEL_DIMENSION, IMAGE_PROFILE_PIXEL_DIMENSION))
	srcImg := image.White
	draw.Draw(dstImg, dstImg.Bounds(), &image.Uniform{color}, image.Point{}, draw.Src)
	size := float64(IMAGE_PROFILE_PIXEL_DIMENSION / 2)

	c := freetype.NewContext()
	c.SetFont(font)
	c.SetFontSize(size)
	c.SetClip(dstImg.Bounds())
	c.SetDst(dstImg)
	c.SetSrc(srcImg)

	pt := freetype.Pt(IMAGE_PROFILE_PIXEL_DIMENSION/5, IMAGE_PROFILE_PIXEL_DIMENSION*2/3)
	_, err = c.DrawString(initial, pt)
	if err != nil {
		return nil, model.NewAppError("CreateProfileImage", "api.user.create_profile_image.initial.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	buf := new(bytes.Buffer)

	if imgErr := png.Encode(buf, dstImg); imgErr != nil {
		return nil, model.NewAppError("CreateProfileImage", "api.user.create_profile_image.encode.app_error", nil, imgErr.Error(), http.StatusInternalServerError)
	}
	return buf.Bytes(), nil
}

func getFont(initialFont string) (*truetype.Font, error) {
	// Some people have the old default font still set, so just treat that as if they're using the new default
	if initialFont == "luximbi.ttf" {
		initialFont = "nunito-bold.ttf"
	}

	fontDir, _ := fileutils.FindDir("fonts")
	fontBytes, err := ioutil.ReadFile(filepath.Join(fontDir, initialFont))
	if err != nil {
		return nil, err
	}

	return freetype.ParseFont(fontBytes)
}

func (a *App) GetProfileImage(user *model.User) ([]byte, bool, *model.AppError) {
	if len(*a.Config().FileSettings.DriverName) == 0 {
		img, appErr := a.GetDefaultProfileImage(user)
		if appErr != nil {
			return nil, false, appErr
		}
		return img, false, nil
	}

	path := "users/" + user.Id + "/profile.png"

	data, err := a.ReadFile(path)
	if err != nil {
		img, appErr := a.GetDefaultProfileImage(user)
		if appErr != nil {
			return nil, false, appErr
		}

		if user.LastPictureUpdate == 0 {
			if _, err := a.WriteFile(bytes.NewReader(img), path); err != nil {
				return nil, false, err
			}
		}
		return img, true, nil
	}

	return data, false, nil
}

func (a *App) GetDefaultProfileImage(user *model.User) ([]byte, *model.AppError) {
	var img []byte
	var appErr *model.AppError

	if user.IsBot {
		img = model.BotDefaultImage
		appErr = nil
	} else {
		img, appErr = CreateProfileImage(user.Username, user.Id, *a.Config().FileSettings.InitialFont)
	}
	if appErr != nil {
		return nil, appErr
	}
	return img, nil
}

func (a *App) SetDefaultProfileImage(user *model.User) *model.AppError {
	img, appErr := a.GetDefaultProfileImage(user)
	if appErr != nil {
		return appErr
	}

	path := "users/" + user.Id + "/profile.png"

	if _, err := a.WriteFile(bytes.NewReader(img), path); err != nil {
		return err
	}

	if err := a.Srv().Store.User().ResetLastPictureUpdate(user.Id); err != nil {
		mlog.Error("Failed to reset last picture update", mlog.Err(err))
	}

	a.InvalidateCacheForUser(user.Id)

	updatedUser, appErr := a.GetUser(user.Id)
	if appErr != nil {
		mlog.Error("Error in getting users profile forcing logout", mlog.String("user_id", user.Id), mlog.Err(appErr))
		return nil
	}

	options := a.Config().GetSanitizeOptions()
	updatedUser.SanitizeProfile(options)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_UPDATED, "", "", "", nil)
	message.Add("user", updatedUser)
	a.Publish(message)

	return nil
}

func (a *App) SetProfileImage(userId string, imageData *multipart.FileHeader) *model.AppError {
	file, err := imageData.Open()
	if err != nil {
		return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.open.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	defer file.Close()
	return a.SetProfileImageFromMultiPartFile(userId, file)
}

func (a *App) SetProfileImageFromMultiPartFile(userId string, file multipart.File) *model.AppError {
	// Decode image config first to check dimensions before loading the whole thing into memory later on
	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.decode_config.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	// This casting is done to prevent overflow on 32 bit systems (not needed
	// in 64 bits systems because images can't have more than 32 bits height or
	// width)
	if int64(config.Width)*int64(config.Height) > model.MaxImageSize {
		return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.too_large.app_error", nil, "", http.StatusBadRequest)
	}

	file.Seek(0, 0)

	return a.SetProfileImageFromFile(userId, file)
}

func (a *App) AdjustImage(file io.Reader) (*bytes.Buffer, *model.AppError) {
	// Decode image into Image object
	img, _, err := image.Decode(file)
	if err != nil {
		return nil, model.NewAppError("SetProfileImage", "api.user.upload_profile_user.decode.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	orientation, _ := getImageOrientation(file)
	img = makeImageUpright(img, orientation)

	// Scale profile image
	profileWidthAndHeight := 128
	img = imaging.Fill(img, profileWidthAndHeight, profileWidthAndHeight, imaging.Center, imaging.Lanczos)

	buf := new(bytes.Buffer)
	err = png.Encode(buf, img)
	if err != nil {
		return nil, model.NewAppError("SetProfileImage", "api.user.upload_profile_user.encode.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return buf, nil
}

func (a *App) SetProfileImageFromFile(userId string, file io.Reader) *model.AppError {

	buf, err := a.AdjustImage(file)
	if err != nil {
		return err
	}
	path := "users/" + userId + "/profile.png"

	if _, err := a.WriteFile(buf, path); err != nil {
		return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.upload_profile.app_error", nil, "", http.StatusInternalServerError)
	}

	if err := a.Srv().Store.User().UpdateLastPictureUpdate(userId); err != nil {
		mlog.Error("Error with updating last picture update", mlog.Err(err))
	}
	a.invalidateUserCacheAndPublish(userId)

	return nil
}

func (a *App) UpdatePasswordAsUser(userId, currentPassword, newPassword string) *model.AppError {
	user, err := a.GetUser(userId)
	if err != nil {
		return err
	}

	if user == nil {
		err = model.NewAppError("updatePassword", "api.user.update_password.valid_account.app_error", nil, "", http.StatusBadRequest)
		return err
	}

	if user.AuthData != nil && *user.AuthData != "" {
		err = model.NewAppError("updatePassword", "api.user.update_password.oauth.app_error", nil, "auth_service="+user.AuthService, http.StatusBadRequest)
		return err
	}

	if err := a.DoubleCheckPassword(user, currentPassword); err != nil {
		if err.Id == "api.user.check_user_password.invalid.app_error" {
			err = model.NewAppError("updatePassword", "api.user.update_password.incorrect.app_error", nil, "", http.StatusBadRequest)
		}
		return err
	}

	T := utils.GetUserTranslations(user.Locale)

	return a.UpdatePasswordSendEmail(user, newPassword, T("api.user.update_password.menu"))
}

func (a *App) userDeactivated(userId string) *model.AppError {
	if err := a.RevokeAllSessions(userId); err != nil {
		return err
	}

	a.SetStatusOffline(userId, false)

	user, err := a.GetUser(userId)
	if err != nil {
		return err
	}

	// when disable a user, userDeactivated is called for the user and the
	// bots the user owns. Only notify once, when the user is the owner, not the
	// owners bots
	if !user.IsBot {
		a.notifySysadminsBotOwnerDeactivated(userId)
	}

	if *a.Config().ServiceSettings.DisableBotsWhenOwnerIsDeactivated {
		a.disableUserBots(userId)
	}

	return nil
}

func (a *App) invalidateUserChannelMembersCaches(userId string) *model.AppError {
	teamsForUser, err := a.GetTeamsForUser(userId)
	if err != nil {
		return err
	}

	for _, team := range teamsForUser {
		channelsForUser, err := a.GetChannelsForUser(team.Id, userId, false, 0)
		if err != nil {
			return err
		}

		for _, channel := range *channelsForUser {
			a.invalidateCacheForChannelMembers(channel.Id)
		}
	}

	return nil
}

func (a *App) UpdateActive(user *model.User, active bool) (*model.User, *model.AppError) {
	user.UpdateAt = model.GetMillis()
	if active {
		user.DeleteAt = 0
	} else {
		user.DeleteAt = user.UpdateAt
	}

	userUpdate, err := a.Srv().Store.User().Update(user, true)
	if err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateActive", "app.user.update.find.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("UpdateActive", "app.user.update.finding.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}
	ruser := userUpdate.New

	if !active {
		if err := a.userDeactivated(ruser.Id); err != nil {
			return nil, err
		}
	}

	a.invalidateUserChannelMembersCaches(user.Id)
	a.InvalidateCacheForUser(user.Id)

	a.sendUpdatedUserEvent(*ruser)

	return ruser, nil
}

func (a *App) DeactivateGuests() *model.AppError {
	userIds, err := a.Srv().Store.User().DeactivateGuests()
	if err != nil {
		return model.NewAppError("DeactivateGuests", "app.user.update_active_for_multiple_users.updating.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, userId := range userIds {
		if err := a.userDeactivated(userId); err != nil {
			return err
		}
	}

	a.Srv().Store.Channel().ClearCaches()
	a.Srv().Store.User().ClearCaches()

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_GUESTS_DEACTIVATED, "", "", "", nil)
	a.Publish(message)

	return nil
}

func (a *App) GetSanitizeOptions(asAdmin bool) map[string]bool {
	options := a.Config().GetSanitizeOptions()
	if asAdmin {
		options["email"] = true
		options["fullname"] = true
		options["authservice"] = true
	}
	return options
}

func (a *App) SanitizeProfile(user *model.User, asAdmin bool) {
	options := a.GetSanitizeOptions(asAdmin)

	user.SanitizeProfile(options)
}

func (a *App) UpdateUserAsUser(user *model.User, asAdmin bool) (*model.User, *model.AppError) {
	updatedUser, err := a.UpdateUser(user, true)
	if err != nil {
		return nil, err
	}

	a.sendUpdatedUserEvent(*updatedUser)

	return updatedUser, nil
}

func (a *App) PatchUser(userId string, patch *model.UserPatch, asAdmin bool) (*model.User, *model.AppError) {
	user, err := a.GetUser(userId)
	if err != nil {
		return nil, err
	}

	user.Patch(patch)

	updatedUser, err := a.UpdateUser(user, true)
	if err != nil {
		return nil, err
	}

	a.sendUpdatedUserEvent(*updatedUser)

	return updatedUser, nil
}

func (a *App) UpdateUserAuth(userId string, userAuth *model.UserAuth) (*model.UserAuth, *model.AppError) {
	if userAuth.AuthData == nil || *userAuth.AuthData == "" || userAuth.AuthService == "" {
		userAuth.AuthData = nil
		userAuth.AuthService = ""

		if err := a.IsPasswordValid(userAuth.Password); err != nil {
			return nil, err
		}
		password := model.HashPassword(userAuth.Password)

		if err := a.Srv().Store.User().UpdatePassword(userId, password); err != nil {
			return nil, model.NewAppError("UpdateUserAuth", "app.user.update_password.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	} else {
		userAuth.Password = ""

		if _, err := a.Srv().Store.User().UpdateAuthData(userId, userAuth.AuthService, userAuth.AuthData, "", false); err != nil {
			var invErr *store.ErrInvalidInput
			switch {
			case errors.As(err, &invErr):
				return nil, model.NewAppError("UpdateUserAuth", "app.user.update_auth_data.email_exists.app_error", nil, invErr.Error(), http.StatusBadRequest)
			default:
				return nil, model.NewAppError("UpdateUserAuth", "app.user.update_auth_data.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}
	}

	return userAuth, nil
}

func (a *App) sendUpdatedUserEvent(user model.User) {
	adminCopyOfUser := user.DeepCopy()
	a.SanitizeProfile(adminCopyOfUser, true)
	adminMessage := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_UPDATED, "", "", "", nil)
	adminMessage.Add("user", adminCopyOfUser)
	adminMessage.GetBroadcast().ContainsSensitiveData = true
	a.Publish(adminMessage)

	a.SanitizeProfile(&user, false)
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_UPDATED, "", "", "", nil)
	message.Add("user", &user)
	message.GetBroadcast().ContainsSanitizedData = true
	a.Publish(message)
}

func (a *App) UpdateUser(user *model.User, sendNotifications bool) (*model.User, *model.AppError) {
	prev, err := a.Srv().Store.User().Get(user.Id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateUser", MISSING_ACCOUNT_ERROR, nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("UpdateUser", "app.user.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	if !CheckUserDomain(user, *a.Config().TeamSettings.RestrictCreationToDomains) {
		if !prev.IsGuest() && !prev.IsLDAPUser() && !prev.IsSAMLUser() && user.Email != prev.Email {
			return nil, model.NewAppError("UpdateUser", "api.user.update_user.accepted_domain.app_error", nil, "", http.StatusBadRequest)
		}
	}

	if !CheckUserDomain(user, *a.Config().GuestAccountsSettings.RestrictCreationToDomains) {
		if prev.IsGuest() && !prev.IsLDAPUser() && !prev.IsSAMLUser() && user.Email != prev.Email {
			return nil, model.NewAppError("UpdateUser", "api.user.update_user.accepted_guest_domain.app_error", nil, "", http.StatusBadRequest)
		}
	}

	// Don't set new eMail on user account if email verification is required, this will be done as a post-verification action
	// to avoid users being able to set non-controlled eMails as their account email
	newEmail := ""
	if *a.Config().EmailSettings.RequireEmailVerification && prev.Email != user.Email {
		newEmail = user.Email

		_, appErr := a.GetUserByEmail(newEmail)
		if appErr == nil {
			return nil, model.NewAppError("UpdateUser", "store.sql_user.update.email_taken.app_error", nil, "user_id="+user.Id, http.StatusBadRequest)
		}

		//  When a bot is created, prev.Email will be an autogenerated faked email,
		//  which will not match a CLI email input during bot to user conversions.
		//  To update a bot users email, do not set the email to the faked email
		//  stored in prev.Email.  Allow using the email defined in the CLI
		if !user.IsBot {
			user.Email = prev.Email
		}
	}

	userUpdate, err := a.Srv().Store.User().Update(user, false)
	if err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateUser", "app.user.update.find.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("UpdateUser", "app.user.update.finding.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	if sendNotifications {
		if userUpdate.New.Email != userUpdate.Old.Email || newEmail != "" {
			if *a.Config().EmailSettings.RequireEmailVerification {
				a.Srv().Go(func() {
					if err := a.SendEmailVerification(userUpdate.New, newEmail, ""); err != nil {
						mlog.Error("Failed to send email verification", mlog.Err(err))
					}
				})
			} else {
				a.Srv().Go(func() {
					if err := a.Srv().EmailService.sendEmailChangeEmail(userUpdate.Old.Email, userUpdate.New.Email, userUpdate.New.Locale, a.GetSiteURL()); err != nil {
						mlog.Error("Failed to send email change email", mlog.Err(err))
					}
				})
			}
		}

		if userUpdate.New.Username != userUpdate.Old.Username {
			a.Srv().Go(func() {
				if err := a.Srv().EmailService.sendChangeUsernameEmail(userUpdate.Old.Username, userUpdate.New.Username, userUpdate.New.Email, userUpdate.New.Locale, a.GetSiteURL()); err != nil {
					mlog.Error("Failed to send change username email", mlog.Err(err))
				}
			})
		}
	}

	a.InvalidateCacheForUser(user.Id)

	return userUpdate.New, nil
}

func (a *App) UpdateUserActive(userId string, active bool) *model.AppError {
	user, err := a.GetUser(userId)

	if err != nil {
		return err
	}
	if _, err = a.UpdateActive(user, active); err != nil {
		return err
	}

	return nil
}

func (a *App) UpdateUserNotifyProps(userId string, props map[string]string) (*model.User, *model.AppError) {
	user, err := a.GetUser(userId)
	if err != nil {
		return nil, err
	}

	user.NotifyProps = props

	ruser, err := a.UpdateUser(user, true)
	if err != nil {
		return nil, err
	}

	return ruser, nil
}

func (a *App) UpdateMfa(activate bool, userId, token string) *model.AppError {
	if activate {
		if err := a.ActivateMfa(userId, token); err != nil {
			return err
		}
	} else {
		if err := a.DeactivateMfa(userId); err != nil {
			return err
		}
	}

	a.Srv().Go(func() {
		user, err := a.GetUser(userId)
		if err != nil {
			mlog.Error("Failed to get user", mlog.Err(err))
			return
		}

		if err := a.Srv().EmailService.sendMfaChangeEmail(user.Email, activate, user.Locale, a.GetSiteURL()); err != nil {
			mlog.Error("Failed to send mfa change email", mlog.Err(err))
		}
	})

	return nil
}

func (a *App) UpdatePasswordByUserIdSendEmail(userId, newPassword, method string) *model.AppError {
	user, err := a.GetUser(userId)
	if err != nil {
		return err
	}

	return a.UpdatePasswordSendEmail(user, newPassword, method)
}

func (a *App) UpdatePassword(user *model.User, newPassword string) *model.AppError {
	if err := a.IsPasswordValid(newPassword); err != nil {
		return err
	}

	hashedPassword := model.HashPassword(newPassword)

	if err := a.Srv().Store.User().UpdatePassword(user.Id, hashedPassword); err != nil {
		return model.NewAppError("UpdatePassword", "api.user.update_password.failed.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	a.InvalidateCacheForUser(user.Id)

	return nil
}

func (a *App) UpdatePasswordSendEmail(user *model.User, newPassword, method string) *model.AppError {
	if err := a.UpdatePassword(user, newPassword); err != nil {
		return err
	}

	a.Srv().Go(func() {
		if err := a.Srv().EmailService.sendPasswordChangeEmail(user.Email, method, user.Locale, a.GetSiteURL()); err != nil {
			mlog.Error("Failed to send password change email", mlog.Err(err))
		}
	})

	return nil
}

func (a *App) UpdateHashedPasswordByUserId(userId, newHashedPassword string) *model.AppError {
	user, err := a.GetUser(userId)
	if err != nil {
		return err
	}

	return a.UpdateHashedPassword(user, newHashedPassword)
}

func (a *App) UpdateHashedPassword(user *model.User, newHashedPassword string) *model.AppError {
	if err := a.Srv().Store.User().UpdatePassword(user.Id, newHashedPassword); err != nil {
		return model.NewAppError("UpdatePassword", "api.user.update_password.failed.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	a.InvalidateCacheForUser(user.Id)

	return nil
}

func (a *App) ResetPasswordFromToken(userSuppliedTokenString, newPassword string) *model.AppError {
	token, err := a.GetPasswordRecoveryToken(userSuppliedTokenString)
	if err != nil {
		return err
	}
	if model.GetMillis()-token.CreateAt >= PASSWORD_RECOVER_EXPIRY_TIME {
		return model.NewAppError("resetPassword", "api.user.reset_password.link_expired.app_error", nil, "", http.StatusBadRequest)
	}

	tokenData := struct {
		UserId string
		Email  string
	}{}

	err2 := json.Unmarshal([]byte(token.Extra), &tokenData)
	if err2 != nil {
		return model.NewAppError("resetPassword", "api.user.reset_password.token_parse.error", nil, "", http.StatusInternalServerError)
	}

	user, err := a.GetUser(tokenData.UserId)
	if err != nil {
		return err
	}

	if user.Email != tokenData.Email {
		return model.NewAppError("resetPassword", "api.user.reset_password.link_expired.app_error", nil, "", http.StatusBadRequest)
	}

	if user.IsSSOUser() {
		return model.NewAppError("ResetPasswordFromCode", "api.user.reset_password.sso.app_error", nil, "userId="+user.Id, http.StatusBadRequest)
	}

	T := utils.GetUserTranslations(user.Locale)

	if err := a.UpdatePasswordSendEmail(user, newPassword, T("api.user.reset_password.method")); err != nil {
		return err
	}

	if err := a.DeleteToken(token); err != nil {
		mlog.Error("Failed to delete token", mlog.Err(err))
	}

	return nil
}

func (a *App) SendPasswordReset(email string, siteURL string) (bool, *model.AppError) {
	user, err := a.GetUserByEmail(email)
	if err != nil {
		return false, nil
	}

	if user.AuthData != nil && len(*user.AuthData) != 0 {
		return false, model.NewAppError("SendPasswordReset", "api.user.send_password_reset.sso.app_error", nil, "userId="+user.Id, http.StatusBadRequest)
	}

	token, err := a.CreatePasswordRecoveryToken(user.Id, user.Email)
	if err != nil {
		return false, err
	}

	return a.Srv().EmailService.SendPasswordResetEmail(user.Email, token, user.Locale, siteURL)
}

func (a *App) CreatePasswordRecoveryToken(userId, email string) (*model.Token, *model.AppError) {

	tokenExtra := struct {
		UserId string
		Email  string
	}{
		userId,
		email,
	}
	jsonData, err := json.Marshal(tokenExtra)

	if err != nil {
		return nil, model.NewAppError("CreatePasswordRecoveryToken", "api.user.create_password_token.error", nil, "", http.StatusInternalServerError)
	}

	token := model.NewToken(TOKEN_TYPE_PASSWORD_RECOVERY, string(jsonData))

	if err := a.Srv().Store.Token().Save(token); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreatePasswordRecoveryToken", "app.recover.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return token, nil
}

func (a *App) GetPasswordRecoveryToken(token string) (*model.Token, *model.AppError) {
	rtoken, err := a.Srv().Store.Token().GetByToken(token)
	if err != nil {
		return nil, model.NewAppError("GetPasswordRecoveryToken", "api.user.reset_password.invalid_link.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	if rtoken.Type != TOKEN_TYPE_PASSWORD_RECOVERY {
		return nil, model.NewAppError("GetPasswordRecoveryToken", "api.user.reset_password.broken_token.app_error", nil, "", http.StatusBadRequest)
	}
	return rtoken, nil
}

func (a *App) DeleteToken(token *model.Token) *model.AppError {
	err := a.Srv().Store.Token().Delete(token.Token)
	if err != nil {
		return model.NewAppError("DeleteToken", "app.recover.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (a *App) UpdateUserRoles(userId string, newRoles string, sendWebSocketEvent bool) (*model.User, *model.AppError) {
	user, err := a.GetUser(userId)
	if err != nil {
		err.StatusCode = http.StatusBadRequest
		return nil, err
	}

	if err := a.CheckRolesExist(strings.Fields(newRoles)); err != nil {
		return nil, err
	}

	user.Roles = newRoles
	uchan := make(chan store.StoreResult, 1)
	go func() {
		userUpdate, err := a.Srv().Store.User().Update(user, true)
		uchan <- store.StoreResult{Data: userUpdate, NErr: err}
		close(uchan)
	}()

	schan := make(chan store.StoreResult, 1)
	go func() {
		id, err := a.Srv().Store.Session().UpdateRoles(user.Id, newRoles)
		schan <- store.StoreResult{Data: id, NErr: err}
		close(schan)
	}()

	result := <-uchan
	if result.NErr != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(result.NErr, &appErr):
			return nil, appErr
		case errors.As(result.NErr, &invErr):
			return nil, model.NewAppError("UpdateUserRoles", "app.user.update.find.app_error", nil, invErr.Error(), http.StatusBadRequest)
		default:
			return nil, model.NewAppError("UpdateUserRoles", "app.user.update.finding.app_error", nil, result.NErr.Error(), http.StatusInternalServerError)
		}
	}
	ruser := result.Data.(*model.UserUpdate).New

	if result := <-schan; result.NErr != nil {
		// soft error since the user roles were still updated
		mlog.Error("Failed during updating user roles", mlog.Err(result.NErr))
	}

	a.InvalidateCacheForUser(userId)
	a.ClearSessionCacheForUser(user.Id)

	if sendWebSocketEvent {
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_ROLE_UPDATED, "", "", user.Id, nil)
		message.Add("user_id", user.Id)
		message.Add("roles", newRoles)
		a.Publish(message)
	}

	return ruser, nil
}

func (a *App) PermanentDeleteUser(user *model.User) *model.AppError {
	mlog.Warn("Attempting to permanently delete account", mlog.String("user_id", user.Id), mlog.String("user_email", user.Email))
	if user.IsInRole(model.SYSTEM_ADMIN_ROLE_ID) {
		mlog.Warn("You are deleting a user that is a system administrator.  You may need to set another account as the system administrator using the command line tools.", mlog.String("user_email", user.Email))
	}

	if _, err := a.UpdateActive(user, false); err != nil {
		return err
	}

	if err := a.Srv().Store.Session().PermanentDeleteSessionsByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.session.permanent_delete_sessions_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.UserAccessToken().DeleteAllForUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.user_access_token.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.OAuth().PermanentDeleteAuthDataByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.oauth.permanent_delete_auth_data_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.Webhook().PermanentDeleteIncomingByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.webhooks.permanent_delete_incoming_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.Webhook().PermanentDeleteOutgoingByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.webhooks.permanent_delete_outgoing_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.Command().PermanentDeleteByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.user.permanentdeleteuser.internal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.Preference().PermanentDeleteByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.preference.permanent_delete_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.Channel().PermanentDeleteMembersByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.channel.permanent_delete_members_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.Group().PermanentDeleteMembersByUser(user.Id); err != nil {
		return err
	}

	if err := a.Srv().Store.Post().PermanentDeleteByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.post.permanent_delete_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.Bot().PermanentDelete(user.Id); err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return model.NewAppError("PermanentDeleteUser", "app.bot.permenent_delete.bad_id", map[string]interface{}{"user_id": invErr.Value}, invErr.Error(), http.StatusBadRequest)
		default: // last fallback in case it doesn't map to an existing app error.
			return model.NewAppError("PermanentDeleteUser", "app.bot.permanent_delete.internal_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	infos, err := a.Srv().Store.FileInfo().GetForUser(user.Id)
	if err != nil {
		mlog.Warn("Error getting file list for user from FileInfoStore", mlog.Err(err))
	}

	for _, info := range infos {
		res, err := a.FileExists(info.Path)
		if err != nil {
			mlog.Warn(
				"Error checking existence of file",
				mlog.String("path", info.Path),
				mlog.Err(err),
			)
			continue
		}

		if !res {
			mlog.Warn("File not found", mlog.String("path", info.Path))
			continue
		}

		err = a.RemoveFile(info.Path)

		if err != nil {
			mlog.Warn(
				"Unable to remove file",
				mlog.String("path", info.Path),
				mlog.Err(err),
			)
		}
	}

	if _, err := a.Srv().Store.FileInfo().PermanentDeleteByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.file_info.permanent_delete_by_user.app_error", nil, ""+err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.User().PermanentDelete(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.user.permanent_delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.Audit().PermanentDeleteByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.audit.permanent_delete_by_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.Srv().Store.Team().RemoveAllMembersByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.team.remove_member.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	mlog.Warn("Permanently deleted account", mlog.String("user_email", user.Email), mlog.String("user_id", user.Id))

	return nil
}

func (a *App) PermanentDeleteAllUsers() *model.AppError {
	users, err := a.Srv().Store.User().GetAll()
	if err != nil {
		return model.NewAppError("PermanentDeleteAllUsers", "app.user.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	for _, user := range users {
		a.PermanentDeleteUser(user)
	}

	return nil
}

func (a *App) SendEmailVerification(user *model.User, newEmail, redirect string) *model.AppError {
	token, err := a.Srv().EmailService.CreateVerifyEmailToken(user.Id, newEmail)
	if err != nil {
		return err
	}

	if _, err := a.GetStatus(user.Id); err != nil {
		return a.Srv().EmailService.sendVerifyEmail(newEmail, user.Locale, a.GetSiteURL(), token.Token, redirect)
	}
	return a.Srv().EmailService.sendEmailChangeVerifyEmail(newEmail, user.Locale, a.GetSiteURL(), token.Token)
}

func (a *App) VerifyEmailFromToken(userSuppliedTokenString string) *model.AppError {
	token, err := a.GetVerifyEmailToken(userSuppliedTokenString)
	if err != nil {
		return err
	}
	if model.GetMillis()-token.CreateAt >= PASSWORD_RECOVER_EXPIRY_TIME {
		return model.NewAppError("VerifyEmailFromToken", "api.user.verify_email.link_expired.app_error", nil, "", http.StatusBadRequest)
	}

	tokenData := struct {
		UserId string
		Email  string
	}{}

	err2 := json.Unmarshal([]byte(token.Extra), &tokenData)
	if err2 != nil {
		return model.NewAppError("VerifyEmailFromToken", "api.user.verify_email.token_parse.error", nil, "", http.StatusInternalServerError)
	}

	user, err := a.GetUser(tokenData.UserId)
	if err != nil {
		return err
	}

	tokenData.Email = strings.ToLower(tokenData.Email)
	if err := a.VerifyUserEmail(tokenData.UserId, tokenData.Email); err != nil {
		return err
	}

	if user.Email != tokenData.Email {
		a.Srv().Go(func() {
			if err := a.Srv().EmailService.sendEmailChangeEmail(user.Email, tokenData.Email, user.Locale, a.GetSiteURL()); err != nil {
				mlog.Error("Failed to send email change email", mlog.Err(err))
			}
		})
	}

	if err := a.DeleteToken(token); err != nil {
		mlog.Error("Failed to delete token", mlog.Err(err))
	}

	return nil
}

func (a *App) GetVerifyEmailToken(token string) (*model.Token, *model.AppError) {
	rtoken, err := a.Srv().Store.Token().GetByToken(token)
	if err != nil {
		return nil, model.NewAppError("GetVerifyEmailToken", "api.user.verify_email.bad_link.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	if rtoken.Type != TOKEN_TYPE_VERIFY_EMAIL {
		return nil, model.NewAppError("GetVerifyEmailToken", "api.user.verify_email.broken_token.app_error", nil, "", http.StatusBadRequest)
	}
	return rtoken, nil
}

// GetTotalUsersStats is used for the DM list total
func (a *App) GetTotalUsersStats(viewRestrictions *model.ViewUsersRestrictions) (*model.UsersStats, *model.AppError) {
	count, err := a.Srv().Store.User().Count(model.UserCountOptions{
		IncludeBotAccounts: true,
		ViewRestrictions:   viewRestrictions,
	})
	if err != nil {
		return nil, model.NewAppError("GetTotalUsersStats", "app.user.get_total_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	stats := &model.UsersStats{
		TotalUsersCount: count,
	}
	return stats, nil
}

// GetFilteredUsersStats is used to get a count of users based on the set of filters supported by UserCountOptions.
func (a *App) GetFilteredUsersStats(options *model.UserCountOptions) (*model.UsersStats, *model.AppError) {
	count, err := a.Srv().Store.User().Count(*options)
	if err != nil {
		return nil, model.NewAppError("GetFilteredUsersStats", "app.user.get_total_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	stats := &model.UsersStats{
		TotalUsersCount: count,
	}
	return stats, nil
}

func (a *App) VerifyUserEmail(userId, email string) *model.AppError {
	if _, err := a.Srv().Store.User().VerifyEmail(userId, email); err != nil {
		return model.NewAppError("VerifyUserEmail", "app.user.verify_email.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	a.InvalidateCacheForUser(userId)

	user, err := a.GetUser(userId)

	if err != nil {
		return err
	}

	a.sendUpdatedUserEvent(*user)

	return nil
}

func (a *App) SearchUsers(props *model.UserSearch, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	if props.WithoutTeam {
		return a.SearchUsersWithoutTeam(props.Term, options)
	}
	if props.InChannelId != "" {
		return a.SearchUsersInChannel(props.InChannelId, props.Term, options)
	}
	if props.NotInChannelId != "" {
		return a.SearchUsersNotInChannel(props.TeamId, props.NotInChannelId, props.Term, options)
	}
	if props.NotInTeamId != "" {
		return a.SearchUsersNotInTeam(props.NotInTeamId, props.Term, options)
	}
	if props.InGroupId != "" {
		return a.SearchUsersInGroup(props.InGroupId, props.Term, options)
	}
	return a.SearchUsersInTeam(props.TeamId, props.Term, options)
}

func (a *App) SearchUsersInChannel(channelId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)
	users, err := a.Srv().Store.User().SearchInChannel(channelId, term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersInChannel", "app.user.search.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersNotInChannel(teamId string, channelId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)
	users, err := a.Srv().Store.User().SearchNotInChannel(teamId, channelId, term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersNotInChannel", "app.user.search.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersInTeam(teamId, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)

	users, err := a.Srv().Store.User().Search(teamId, term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersInTeam", "app.user.search.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersNotInTeam(notInTeamId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)
	users, err := a.Srv().Store.User().SearchNotInTeam(notInTeamId, term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersNotInTeam", "app.user.search.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersWithoutTeam(term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)
	users, err := a.Srv().Store.User().SearchWithoutTeam(term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersWithoutTeam", "app.user.search.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersInGroup(groupID string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)
	users, err := a.Srv().Store.User().SearchInGroup(groupID, term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersInGroup", "app.user.search.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) AutocompleteUsersInChannel(teamId string, channelId string, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, *model.AppError) {
	term = strings.TrimSpace(term)

	autocomplete, err := a.Srv().Store.User().AutocompleteUsersInChannel(teamId, channelId, term, options)
	if err != nil {
		return nil, model.NewAppError("AutocompleteUsersInChannel", "app.user.search.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, user := range autocomplete.InChannel {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	for _, user := range autocomplete.OutOfChannel {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return autocomplete, nil
}

func (a *App) AutocompleteUsersInTeam(teamId string, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInTeam, *model.AppError) {
	term = strings.TrimSpace(term)

	users, err := a.Srv().Store.User().Search(teamId, term, options)
	if err != nil {
		return nil, model.NewAppError("AutocompleteUsersInTeam", "app.user.search.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	autocomplete := &model.UserAutocompleteInTeam{}
	autocomplete.InTeam = users
	return autocomplete, nil
}

func (a *App) UpdateOAuthUserAttrs(userData io.Reader, user *model.User, provider einterfaces.OauthProvider, service string) *model.AppError {
	oauthUser, err1 := provider.GetUserFromJson(userData)
	if err1 != nil {
		return model.NewAppError("UpdateOAuthUserAttrs", "api.user.update_oauth_user_attrs.get_user.app_error", map[string]interface{}{"Service": service}, err1.Error(), http.StatusBadRequest)
	}

	userAttrsChanged := false

	if oauthUser.Username != user.Username {
		if existingUser, _ := a.GetUserByUsername(oauthUser.Username); existingUser == nil {
			user.Username = oauthUser.Username
			userAttrsChanged = true
		}
	}

	if oauthUser.GetFullName() != user.GetFullName() {
		user.FirstName = oauthUser.FirstName
		user.LastName = oauthUser.LastName
		userAttrsChanged = true
	}

	if oauthUser.Email != user.Email {
		if existingUser, _ := a.GetUserByEmail(oauthUser.Email); existingUser == nil {
			user.Email = oauthUser.Email
			userAttrsChanged = true
		}
	}

	if user.DeleteAt > 0 {
		// Make sure they are not disabled
		user.DeleteAt = 0
		userAttrsChanged = true
	}

	if userAttrsChanged {
		users, err := a.Srv().Store.User().Update(user, true)
		if err != nil {
			var appErr *model.AppError
			var invErr *store.ErrInvalidInput
			switch {
			case errors.As(err, &appErr):
				return appErr
			case errors.As(err, &invErr):
				return model.NewAppError("UpdateOAuthUserAttrs", "app.user.update.find.app_error", nil, invErr.Error(), http.StatusBadRequest)
			default:
				return model.NewAppError("UpdateOAuthUserAttrs", "app.user.update.finding.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
		}

		user = users.New
		a.InvalidateCacheForUser(user.Id)
	}

	return nil
}

func (a *App) RestrictUsersGetByPermissions(userId string, options *model.UserGetOptions) (*model.UserGetOptions, *model.AppError) {
	restrictions, err := a.GetViewUsersRestrictions(userId)
	if err != nil {
		return nil, err
	}

	options.ViewRestrictions = restrictions
	return options, nil
}

// FilterNonGroupTeamMembers returns the subset of the given user IDs of the users who are not members of groups
// associated to the team excluding bots.
func (a *App) FilterNonGroupTeamMembers(userIds []string, team *model.Team) ([]string, error) {
	teamGroupUsers, err := a.GetTeamGroupUsers(team.Id)
	if err != nil {
		return nil, err
	}
	return a.filterNonGroupUsers(userIds, teamGroupUsers)
}

// FilterNonGroupChannelMembers returns the subset of the given user IDs of the users who are not members of groups
// associated to the channel excluding bots
func (a *App) FilterNonGroupChannelMembers(userIds []string, channel *model.Channel) ([]string, error) {
	channelGroupUsers, err := a.GetChannelGroupUsers(channel.Id)
	if err != nil {
		return nil, err
	}
	return a.filterNonGroupUsers(userIds, channelGroupUsers)
}

// filterNonGroupUsers is a helper function that takes a list of user ids and a list of users
// and returns the list of normal users present in userIds but not in groupUsers.
func (a *App) filterNonGroupUsers(userIds []string, groupUsers []*model.User) ([]string, error) {
	nonMemberIds := []string{}
	users, err := a.Srv().Store.User().GetProfileByIds(userIds, nil, false)
	if err != nil {
		return nil, err
	}

	for _, user := range users {
		userIsMember := user.IsBot

		for _, pu := range groupUsers {
			if pu.Id == user.Id {
				userIsMember = true
				break
			}
		}
		if !userIsMember {
			nonMemberIds = append(nonMemberIds, user.Id)
		}
	}

	return nonMemberIds, nil
}

func (a *App) RestrictUsersSearchByPermissions(userId string, options *model.UserSearchOptions) (*model.UserSearchOptions, *model.AppError) {
	restrictions, err := a.GetViewUsersRestrictions(userId)
	if err != nil {
		return nil, err
	}

	options.ViewRestrictions = restrictions
	return options, nil
}

func (a *App) UserCanSeeOtherUser(userId string, otherUserId string) (bool, *model.AppError) {
	if userId == otherUserId {
		return true, nil
	}

	restrictions, err := a.GetViewUsersRestrictions(userId)
	if err != nil {
		return false, err
	}

	if restrictions == nil {
		return true, nil
	}

	if len(restrictions.Teams) > 0 {
		result, err := a.Srv().Store.Team().UserBelongsToTeams(otherUserId, restrictions.Teams)
		if err != nil {
			return false, model.NewAppError("UserCanSeeOtherUser", "app.team.user_belongs_to_teams.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		if result {
			return true, nil
		}
	}

	if len(restrictions.Channels) > 0 {
		result, err := a.userBelongsToChannels(otherUserId, restrictions.Channels)
		if err != nil {
			return false, err
		}
		if result {
			return true, nil
		}
	}

	return false, nil
}

func (a *App) userBelongsToChannels(userId string, channelIds []string) (bool, *model.AppError) {
	belongs, err := a.Srv().Store.Channel().UserBelongsToChannels(userId, channelIds)
	if err != nil {
		return false, model.NewAppError("userBelongsToChannels", "app.channel.user_belongs_to_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return belongs, nil
}

func (a *App) GetViewUsersRestrictions(userId string) (*model.ViewUsersRestrictions, *model.AppError) {
	if a.HasPermissionTo(userId, model.PERMISSION_VIEW_MEMBERS) {
		return nil, nil
	}

	teamIds, nErr := a.Srv().Store.Team().GetUserTeamIds(userId, true)
	if nErr != nil {
		return nil, model.NewAppError("GetViewUsersRestrictions", "app.team.get_user_team_ids.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	teamIdsWithPermission := []string{}
	for _, teamId := range teamIds {
		if a.HasPermissionToTeam(userId, teamId, model.PERMISSION_VIEW_MEMBERS) {
			teamIdsWithPermission = append(teamIdsWithPermission, teamId)
		}
	}

	userChannelMembers, err := a.Srv().Store.Channel().GetAllChannelMembersForUser(userId, true, true)
	if err != nil {
		return nil, model.NewAppError("GetViewUsersRestrictions", "app.channel.get_channels.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	channelIds := []string{}
	for channelId := range userChannelMembers {
		channelIds = append(channelIds, channelId)
	}

	return &model.ViewUsersRestrictions{Teams: teamIdsWithPermission, Channels: channelIds}, nil
}

// PromoteGuestToUser Convert user's roles and all his mermbership's roles from
// guest roles to regular user roles.
func (a *App) PromoteGuestToUser(user *model.User, requestorId string) *model.AppError {
	nErr := a.Srv().Store.User().PromoteGuestToUser(user.Id)
	a.InvalidateCacheForUser(user.Id)
	if nErr != nil {
		return model.NewAppError("PromoteGuestToUser", "app.user.promote_guest.user_update.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}
	userTeams, nErr := a.Srv().Store.Team().GetTeamsByUserId(user.Id)
	if nErr != nil {
		return model.NewAppError("PromoteGuestToUser", "app.team.get_all.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	for _, team := range userTeams {
		// Soft error if there is an issue joining the default channels
		if err := a.JoinDefaultChannels(team.Id, user, false, requestorId); err != nil {
			mlog.Error("Failed to join default channels", mlog.String("user_id", user.Id), mlog.String("team_id", team.Id), mlog.String("requestor_id", requestorId), mlog.Err(err))
		}
	}

	promotedUser, err := a.GetUser(user.Id)
	if err != nil {
		mlog.Error("Failed to get user on promote guest to user", mlog.Err(err))
	} else {
		a.sendUpdatedUserEvent(*promotedUser)
		a.UpdateSessionsIsGuest(promotedUser.Id, promotedUser.IsGuest())
	}

	teamMembers, err := a.GetTeamMembersForUser(user.Id)
	if err != nil {
		mlog.Error("Failed to get team members for user on promote guest to user", mlog.Err(err))
	}

	for _, member := range teamMembers {
		a.sendUpdatedMemberRoleEvent(user.Id, member)

		channelMembers, err := a.GetChannelMembersForUser(member.TeamId, user.Id)
		if err != nil {
			mlog.Error("Failed to get channel members for user on promote guest to user", mlog.Err(err))
		}

		for _, member := range *channelMembers {
			a.invalidateCacheForChannelMembers(member.ChannelId)

			evt := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_MEMBER_UPDATED, "", "", user.Id, nil)
			evt.Add("channelMember", member.ToJson())
			a.Publish(evt)
		}
	}

	a.ClearSessionCacheForUser(user.Id)
	return nil
}

// DemoteUserToGuest Convert user's roles and all his mermbership's roles from
// regular user roles to guest roles.
func (a *App) DemoteUserToGuest(user *model.User) *model.AppError {
	nErr := a.Srv().Store.User().DemoteUserToGuest(user.Id)
	a.InvalidateCacheForUser(user.Id)
	if nErr != nil {
		return model.NewAppError("DemoteUserToGuest", "app.user.demote_user_to_guest.user_update.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	demotedUser, err := a.GetUser(user.Id)
	if err != nil {
		mlog.Error("Failed to get user on demote user to guest", mlog.Err(err))
	} else {
		a.sendUpdatedUserEvent(*demotedUser)
		a.UpdateSessionsIsGuest(demotedUser.Id, demotedUser.IsGuest())
	}

	teamMembers, err := a.GetTeamMembersForUser(user.Id)
	if err != nil {
		mlog.Error("Failed to get team members for users on demote user to guest", mlog.Err(err))
	}

	for _, member := range teamMembers {
		a.sendUpdatedMemberRoleEvent(user.Id, member)

		channelMembers, err := a.GetChannelMembersForUser(member.TeamId, user.Id)
		if err != nil {
			mlog.Error("Failed to get channel members for users on demote user to guest", mlog.Err(err))
		}

		for _, member := range *channelMembers {
			a.invalidateCacheForChannelMembers(member.ChannelId)

			evt := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_MEMBER_UPDATED, "", "", user.Id, nil)
			evt.Add("channelMember", member.ToJson())
			a.Publish(evt)
		}
	}

	a.ClearSessionCacheForUser(user.Id)

	return nil
}

func (a *App) PublishUserTyping(userId, channelId, parentId string) *model.AppError {
	omitUsers := make(map[string]bool, 1)
	omitUsers[userId] = true

	event := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_TYPING, "", channelId, "", omitUsers)
	event.Add("parent_id", parentId)
	event.Add("user_id", userId)
	a.Publish(event)

	return nil
}

// invalidateUserCacheAndPublish Invalidates cache for a user and publishes user updated event
func (a *App) invalidateUserCacheAndPublish(userId string) {
	a.InvalidateCacheForUser(userId)

	user, userErr := a.GetUser(userId)
	if userErr != nil {
		mlog.Error("Error in getting users profile", mlog.String("user_id", userId), mlog.Err(userErr))
		return
	}

	options := a.Config().GetSanitizeOptions()
	user.SanitizeProfile(options)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_UPDATED, "", "", "", nil)
	message.Add("user", user)
	a.Publish(message)
}

// GetKnownUsers returns the list of user ids of users with any direct
// relationship with a user. That means any user sharing any channel, including
// direct and group channels.
func (a *App) GetKnownUsers(userID string) ([]string, *model.AppError) {
	users, err := a.Srv().Store.User().GetKnownUsers(userID)
	if err != nil {
		return nil, model.NewAppError("GetKnownUsers", "app.user.get_known_users.get_users.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return users, nil
}

// ConvertBotToUser converts a bot to user.
func (a *App) ConvertBotToUser(bot *model.Bot, userPatch *model.UserPatch, sysadmin bool) (*model.User, *model.AppError) {
	user, nErr := a.Srv().Store.User().Get(bot.UserId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("ConvertBotToUser", MISSING_ACCOUNT_ERROR, nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("ConvertBotToUser", "app.user.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
	}

	if sysadmin && !user.IsInRole(model.SYSTEM_ADMIN_ROLE_ID) {
		_, appErr := a.UpdateUserRoles(
			user.Id,
			fmt.Sprintf("%s %s", user.Roles, model.SYSTEM_ADMIN_ROLE_ID),
			false)
		if appErr != nil {
			return nil, appErr
		}
	}

	user.Patch(userPatch)

	user, err := a.UpdateUser(user, false)
	if err != nil {
		return nil, err
	}

	err = a.UpdatePassword(user, *userPatch.Password)
	if err != nil {
		return nil, err
	}

	appErr := a.Srv().Store.Bot().PermanentDelete(bot.UserId)
	if appErr != nil {
		return nil, model.NewAppError("ConvertBotToUser", "app.user.convert_bot_to_user.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return user, nil
}
