// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	b64 "encoding/base64"
	"encoding/json"
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
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/services/mfa"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/utils/fileutils"
)

const (
	TOKEN_TYPE_PASSWORD_RECOVERY  = "password_recovery"
	TOKEN_TYPE_VERIFY_EMAIL       = "verify_email"
	TOKEN_TYPE_TEAM_INVITATION    = "team_invitation"
	PASSWORD_RECOVER_EXPIRY_TIME  = 1000 * 60 * 60      // 1 hour
	TEAM_INVITATION_EXPIRY_TIME   = 1000 * 60 * 60 * 48 // 48 hours
	IMAGE_PROFILE_PIXEL_DIMENSION = 128
)

func (a *App) CreateUserWithToken(user *model.User, tokenId string) (*model.User, *model.AppError) {
	if err := a.IsUserSignUpAllowed(); err != nil {
		return nil, err
	}

	result := <-a.Srv.Store.Token().GetByToken(tokenId)
	if result.Err != nil {
		return nil, model.NewAppError("CreateUserWithToken", "api.user.create_user.signup_link_invalid.app_error", nil, result.Err.Error(), http.StatusBadRequest)
	}

	token := result.Data.(*model.Token)
	if token.Type != TOKEN_TYPE_TEAM_INVITATION {
		return nil, model.NewAppError("CreateUserWithToken", "api.user.create_user.signup_link_invalid.app_error", nil, "", http.StatusBadRequest)
	}

	if model.GetMillis()-token.CreateAt >= TEAM_INVITATION_EXPIRY_TIME {
		a.DeleteToken(token)
		return nil, model.NewAppError("CreateUserWithToken", "api.user.create_user.signup_link_expired.app_error", nil, "", http.StatusBadRequest)
	}

	tokenData := model.MapFromJson(strings.NewReader(token.Extra))

	result = <-a.Srv.Store.Team().Get(tokenData["teamId"])
	if result.Err != nil {
		return nil, result.Err
	}
	team := result.Data.(*model.Team)

	user.Email = tokenData["email"]
	user.EmailVerified = true

	ruser, err := a.CreateUser(user)
	if err != nil {
		return nil, err
	}

	if err := a.JoinUserToTeam(team, ruser, ""); err != nil {
		return nil, err
	}

	a.AddDirectChannels(team.Id, ruser)

	if err := a.DeleteToken(token); err != nil {
		return nil, err
	}

	return ruser, nil
}

func (a *App) CreateUserWithInviteId(user *model.User, inviteId string) (*model.User, *model.AppError) {
	if err := a.IsUserSignUpAllowed(); err != nil {
		return nil, err
	}

	result := <-a.Srv.Store.Team().GetByInviteId(inviteId)
	if result.Err != nil {
		return nil, result.Err
	}
	team := result.Data.(*model.Team)

	user.EmailVerified = false

	ruser, err := a.CreateUser(user)
	if err != nil {
		return nil, err
	}

	if err := a.JoinUserToTeam(team, ruser, ""); err != nil {
		return nil, err
	}

	a.AddDirectChannels(team.Id, ruser)

	if err := a.SendWelcomeEmail(ruser.Id, ruser.Email, ruser.EmailVerified, ruser.Locale, a.GetSiteURL()); err != nil {
		mlog.Error(err.Error())
	}

	return ruser, nil
}

func (a *App) CreateUserAsAdmin(user *model.User) (*model.User, *model.AppError) {
	ruser, err := a.CreateUser(user)
	if err != nil {
		return nil, err
	}

	if err := a.SendWelcomeEmail(ruser.Id, ruser.Email, ruser.EmailVerified, ruser.Locale, a.GetSiteURL()); err != nil {
		mlog.Error(err.Error())
	}

	return ruser, nil
}

func (a *App) CreateUserFromSignup(user *model.User) (*model.User, *model.AppError) {
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

	if err := a.SendWelcomeEmail(ruser.Id, ruser.Email, ruser.EmailVerified, ruser.Locale, a.GetSiteURL()); err != nil {
		mlog.Error(err.Error())
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

func (a *App) IsFirstUserAccount() bool {
	if a.SessionCacheLength() == 0 {
		cr := <-a.Srv.Store.User().Count(model.UserCountOptions{
			IncludeDeleted: true,
		})
		if cr.Err != nil {
			mlog.Error(fmt.Sprint(cr.Err))
			return false
		}
		if cr.Data.(int64) <= 0 {
			return true
		}
	}

	return false
}

// indexUser fetches the required information to index a user from the database and
// calls the elasticsearch interface method
func (a *App) indexUser(user *model.User) *model.AppError {
	userTeams := <-a.Srv.Store.Team().GetTeamsByUserId(user.Id)
	if userTeams.Err != nil {
		return userTeams.Err
	}

	userTeamsIds := []string{}
	for _, team := range userTeams.Data.([]*model.Team) {
		userTeamsIds = append(userTeamsIds, team.Id)
	}

	userChannelMembers := <-a.Srv.Store.Channel().GetAllChannelMembersForUser(user.Id, false, true)
	if userChannelMembers.Err != nil {
		return userChannelMembers.Err
	}

	userChannelsIds := []string{}
	for channelId := range userChannelMembers.Data.(map[string]string) {
		userChannelsIds = append(userChannelsIds, channelId)
	}

	return a.Elasticsearch.IndexUser(user, userTeamsIds, userChannelsIds)
}

func (a *App) indexUserFromId(userId string) *model.AppError {
	user, err := a.GetUser(userId)
	if err != nil {
		return err
	}
	return a.indexUser(user)
}

// CreateUser creates a user and sets several fields of the returned User struct to
// their zero values.
func (a *App) CreateUser(user *model.User) (*model.User, *model.AppError) {
	if !user.IsLDAPUser() && !user.IsSAMLUser() && !CheckUserDomain(user, *a.Config().TeamSettings.RestrictCreationToDomains) {
		return nil, model.NewAppError("CreateUser", "api.user.create_user.accepted_domain.app_error", nil, "", http.StatusBadRequest)
	}

	user.Roles = model.SYSTEM_USER_ROLE_ID

	// Below is a special case where the first user in the entire
	// system is granted the system_admin role
	result := <-a.Srv.Store.User().Count(model.UserCountOptions{
		IncludeDeleted: true,
	})
	if result.Err != nil {
		return nil, result.Err
	}
	if result.Data.(int64) <= 0 {
		user.Roles = model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID
	}

	if _, ok := utils.GetSupportedLocales()[user.Locale]; !ok {
		user.Locale = *a.Config().LocalizationSettings.DefaultClientLocale
	}

	ruser, err := a.createUser(user)
	if err != nil {
		return nil, err
	}
	// This message goes to everyone, so the teamId, channelId and userId are irrelevant
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_NEW_USER, "", "", "", nil)
	message.Add("user_id", ruser.Id)
	a.Publish(message)

	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		a.Srv.Go(func() {
			pluginContext := a.PluginContext()
			pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				hooks.UserHasBeenCreated(pluginContext, user)
				return true
			}, plugin.UserHasBeenCreatedId)
		})
	}

	esInterface := a.Elasticsearch
	if esInterface != nil && *a.Config().ElasticsearchSettings.EnableIndexing {
		a.Srv.Go(func() {
			if err := a.indexUser(user); err != nil {
				mlog.Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.Err(err))
			}
		})
	}

	return ruser, nil
}

func (a *App) createUser(user *model.User) (*model.User, *model.AppError) {
	user.MakeNonNil()

	if err := a.IsPasswordValid(user.Password); user.AuthService == "" && err != nil {
		return nil, err
	}

	result := <-a.Srv.Store.User().Save(user)
	if result.Err != nil {
		mlog.Error(fmt.Sprintf("Couldn't save the user err=%v", result.Err))
		return nil, result.Err
	}
	ruser := result.Data.(*model.User)

	if user.EmailVerified {
		if err := a.VerifyUserEmail(ruser.Id, user.Email); err != nil {
			mlog.Error(fmt.Sprintf("Failed to set email verified err=%v", err))
		}
	}

	pref := model.Preference{UserId: ruser.Id, Category: model.PREFERENCE_CATEGORY_TUTORIAL_STEPS, Name: ruser.Id, Value: "0"}
	if presult := <-a.Srv.Store.Preference().Save(&model.Preferences{pref}); presult.Err != nil {
		mlog.Error(fmt.Sprintf("Encountered error saving tutorial preference, err=%v", presult.Err.Message))
	}

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
	user := provider.GetUserFromJson(userData)

	if user == nil {
		return nil, model.NewAppError("CreateOAuthUser", "api.user.create_oauth_user.create.app_error", map[string]interface{}{"Service": service}, "", http.StatusInternalServerError)
	}

	suchan := a.Srv.Store.User().GetByAuth(user.AuthData, service)
	euchan := a.Srv.Store.User().GetByEmail(user.Email)

	found := true
	count := 0
	for found {
		if found = a.IsUsernameTaken(user.Username); found {
			user.Username = user.Username + strconv.Itoa(count)
			count++
		}
	}

	if result := <-suchan; result.Err == nil {
		return result.Data.(*model.User), nil
	}

	if result := <-euchan; result.Err == nil {
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
			mlog.Error(err.Error())
		}
	}

	return ruser, nil
}

// CheckUserDomain checks that a user's email domain matches a list of space-delimited domains as a string.
func CheckUserDomain(user *model.User, domains string) bool {
	if len(domains) == 0 {
		return true
	}

	domainArray := strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(strings.Replace(domains, "@", " ", -1), ",", " ", -1))))

	for _, d := range domainArray {
		if strings.HasSuffix(strings.ToLower(user.Email), "@"+d) {
			return true
		}
	}

	return false
}

// IsUsernameTaken checks if the username is already used by another user. Return false if the username is invalid.
func (a *App) IsUsernameTaken(name string) bool {
	if !model.IsValidUsername(name) {
		return false
	}

	if result := <-a.Srv.Store.User().GetByUsername(name); result.Err != nil {
		return false
	}

	return true
}

func (a *App) GetUser(userId string) (*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().Get(userId)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.User), nil
}

func (a *App) GetUserByUsername(username string) (*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetByUsername(username)
	if result.Err != nil && result.Err.Id == "store.sql_user.get_by_username.app_error" {
		result.Err.StatusCode = http.StatusNotFound
		return nil, result.Err
	}
	return result.Data.(*model.User), nil
}

func (a *App) GetUserByEmail(email string) (*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetByEmail(email)
	if result.Err != nil {
		if result.Err.Id == "store.sql_user.missing_account.const" {
			result.Err.StatusCode = http.StatusNotFound
			return nil, result.Err
		}
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	}
	return result.Data.(*model.User), nil
}

func (a *App) GetUserByAuth(authData *string, authService string) (*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetByAuth(authData, authService)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.(*model.User), nil
}

func (a *App) GetUsers(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetAllProfiles(options)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.User), nil
}

func (a *App) GetUsersPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsers(options)
	if err != nil {
		return nil, err
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersEtag() string {
	return fmt.Sprintf("%v.%v.%v", (<-a.Srv.Store.User().GetEtagForAllProfiles()).Data.(string), a.Config().PrivacySettings.ShowFullName, a.Config().PrivacySettings.ShowEmailAddress)
}

func (a *App) GetUsersInTeam(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetProfiles(options)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.User), nil
}

func (a *App) GetUsersNotInTeam(teamId string, offset int, limit int) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetProfilesNotInTeam(teamId, offset, limit)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.User), nil
}

func (a *App) GetUsersInTeamPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersInTeam(options)
	if err != nil {
		return nil, err
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersNotInTeamPage(teamId string, page int, perPage int, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersNotInTeam(teamId, page*perPage, perPage)
	if err != nil {
		return nil, err
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersInTeamEtag(teamId string) string {
	return fmt.Sprintf("%v.%v.%v", (<-a.Srv.Store.User().GetEtagForProfiles(teamId)).Data.(string), a.Config().PrivacySettings.ShowFullName, a.Config().PrivacySettings.ShowEmailAddress)
}

func (a *App) GetUsersNotInTeamEtag(teamId string) string {
	return fmt.Sprintf("%v.%v.%v", (<-a.Srv.Store.User().GetEtagForProfilesNotInTeam(teamId)).Data.(string), a.Config().PrivacySettings.ShowFullName, a.Config().PrivacySettings.ShowEmailAddress)
}

func (a *App) GetUsersInChannel(channelId string, offset int, limit int) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetProfilesInChannel(channelId, offset, limit)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.User), nil
}

func (a *App) GetUsersInChannelByStatus(channelId string, offset int, limit int) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetProfilesInChannelByStatus(channelId, offset, limit)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.User), nil
}

func (a *App) GetUsersInChannelMap(channelId string, offset int, limit int, asAdmin bool) (map[string]*model.User, *model.AppError) {
	users, err := a.GetUsersInChannel(channelId, offset, limit)
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

func (a *App) GetUsersInChannelPage(channelId string, page int, perPage int, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersInChannel(channelId, page*perPage, perPage)
	if err != nil {
		return nil, err
	}
	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersInChannelPageByStatus(channelId string, page int, perPage int, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersInChannelByStatus(channelId, page*perPage, perPage)
	if err != nil {
		return nil, err
	}
	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersNotInChannel(teamId string, channelId string, offset int, limit int) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetProfilesNotInChannel(teamId, channelId, offset, limit)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.User), nil
}

func (a *App) GetUsersNotInChannelMap(teamId string, channelId string, offset int, limit int, asAdmin bool) (map[string]*model.User, *model.AppError) {
	users, err := a.GetUsersNotInChannel(teamId, channelId, offset, limit)
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

func (a *App) GetUsersNotInChannelPage(teamId string, channelId string, page int, perPage int, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersNotInChannel(teamId, channelId, page*perPage, perPage)
	if err != nil {
		return nil, err
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersWithoutTeamPage(page int, perPage int, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersWithoutTeam(page*perPage, perPage)
	if err != nil {
		return nil, err
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersWithoutTeam(offset int, limit int) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetProfilesWithoutTeam(offset, limit)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.User), nil
}

// GetUsersPermittedToTeam returns the users who are permitted to join a team based on group constraints. If the
// given team is not group-constrained then an empty slice will be returned.
func (a *App) GetUsersPermittedToTeam(teamID string) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetUsersPermittedToTeam(teamID)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.User), nil
}

// GetUsersPermittedToChannel returns the users who are permitted to join a channel based on group constraints. If
// the given channel is not group-constrained then an empty slice will be returned.
func (a *App) GetUsersPermittedToChannel(channelID string) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetUsersPermittedToChannel(channelID)
	if result.Err != nil {
		return nil, result.Err
	}
	return result.Data.([]*model.User), nil
}

func (a *App) GetUsersByIds(userIds []string, asAdmin bool) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetProfileByIds(userIds, true)
	if result.Err != nil {
		return nil, result.Err
	}
	return a.sanitizeProfiles(result.Data.([]*model.User), asAdmin), nil
}

func (a *App) GetUsersByUsernames(usernames []string, asAdmin bool) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().GetProfilesByUsernames(usernames, "")
	if result.Err != nil {
		return nil, result.Err
	}
	return a.sanitizeProfiles(result.Data.([]*model.User), asAdmin), nil
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

	mfaService := mfa.New(a, a.Srv.Store)
	secret, img, err := mfaService.GenerateSecret(user)
	if err != nil {
		return nil, err
	}

	mfaSecret := &model.MfaSecret{Secret: secret, QRCode: b64.StdEncoding.EncodeToString(img)}
	return mfaSecret, nil
}

func (a *App) ActivateMfa(userId, token string) *model.AppError {
	result := <-a.Srv.Store.User().Get(userId)
	if result.Err != nil {
		return result.Err
	}
	user := result.Data.(*model.User)

	if len(user.AuthService) > 0 && user.AuthService != model.USER_AUTH_SERVICE_LDAP {
		return model.NewAppError("ActivateMfa", "api.user.activate_mfa.email_and_ldap_only.app_error", nil, "", http.StatusBadRequest)
	}

	mfaService := mfa.New(a, a.Srv.Store)
	if err := mfaService.Activate(user, token); err != nil {
		return err
	}

	return nil
}

func (a *App) DeactivateMfa(userId string) *model.AppError {
	mfaService := mfa.New(a, a.Srv.Store)
	if err := mfaService.Deactivate(userId); err != nil {
		return err
	}

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
	draw.Draw(dstImg, dstImg.Bounds(), &image.Uniform{color}, image.ZP, draw.Src)
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

	<-a.Srv.Store.User().ResetLastPictureUpdate(user.Id)

	a.InvalidateCacheForUser(user.Id)

	updatedUser, appErr := a.GetUser(user.Id)
	if appErr != nil {
		mlog.Error(fmt.Sprintf("Error in getting users profile for id=%v forcing logout", user.Id), mlog.String("user_id", user.Id))
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
	if config.Width*config.Height > model.MaxImageSize {
		return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.too_large.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	file.Seek(0, 0)

	return a.SetProfileImageFromFile(userId, file)
}

func (a *App) SetProfileImageFromFile(userId string, file io.Reader) *model.AppError {

	// Decode image into Image object
	img, _, err := image.Decode(file)
	if err != nil {
		return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.decode.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	orientation, _ := getImageOrientation(file)
	img = makeImageUpright(img, orientation)

	// Scale profile image
	profileWidthAndHeight := 128
	img = imaging.Fill(img, profileWidthAndHeight, profileWidthAndHeight, imaging.Center, imaging.Lanczos)

	buf := new(bytes.Buffer)
	err = png.Encode(buf, img)
	if err != nil {
		return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.encode.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	path := "users/" + userId + "/profile.png"

	if _, err := a.WriteFile(buf, path); err != nil {
		return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.upload_profile.app_error", nil, "", http.StatusInternalServerError)
	}

	<-a.Srv.Store.User().UpdateLastPictureUpdate(userId)

	a.InvalidateCacheForUser(userId)

	user, userErr := a.GetUser(userId)
	if userErr != nil {
		mlog.Error(fmt.Sprintf("Error in getting users profile for id=%v forcing logout", userId), mlog.String("user_id", userId))
		return nil
	}

	options := a.Config().GetSanitizeOptions()
	user.SanitizeProfile(options)

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_UPDATED, "", "", "", nil)
	message.Add("user", user)
	a.Publish(message)

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

func (a *App) userDeactivated(user *model.User) *model.AppError {
	if err := a.RevokeAllSessions(user.Id); err != nil {
		return err
	}

	a.SetStatusOffline(user.Id, false)

	if *a.Config().ServiceSettings.DisableBotsWhenOwnerIsDeactivated {
		a.disableUserBots(user.Id)
	}

	return nil
}

func (a *App) invalidateUserChannelMembersCaches(user *model.User) *model.AppError {
	teamsForUser, err := a.GetTeamsForUser(user.Id)
	if err != nil {
		return err
	}

	for _, team := range teamsForUser {
		channelsForUser, err := a.GetChannelsForUser(team.Id, user.Id, false)
		if err != nil {
			return err
		}

		for _, channel := range *channelsForUser {
			a.InvalidateCacheForChannelMembers(channel.Id)
		}
	}

	return nil
}

func (a *App) UpdateActive(user *model.User, active bool) (*model.User, *model.AppError) {
	if active {
		user.DeleteAt = 0
	} else {
		user.DeleteAt = model.GetMillis()
	}

	result := <-a.Srv.Store.User().Update(user, true)
	if result.Err != nil {
		return nil, result.Err
	}
	ruser := result.Data.([2]*model.User)[0]

	if !active {
		if err := a.userDeactivated(ruser); err != nil {
			return nil, err
		}
	}

	a.invalidateUserChannelMembersCaches(user)

	a.sendUpdatedUserEvent(*ruser)

	return ruser, nil
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

		if result := <-a.Srv.Store.User().UpdatePassword(userId, password); result.Err != nil {
			return nil, result.Err
		}
	} else {
		userAuth.Password = ""

		if result := <-a.Srv.Store.User().UpdateAuthData(userId, userAuth.AuthService, userAuth.AuthData, "", false); result.Err != nil {
			return nil, result.Err
		}
	}

	return userAuth, nil
}

func (a *App) sendUpdatedUserEvent(user model.User) {
	adminCopyOfUser := user.DeepCopy()
	a.SanitizeProfile(adminCopyOfUser, true)
	adminMessage := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_UPDATED, "", "", "", nil)
	adminMessage.Add("user", *adminCopyOfUser)
	adminMessage.Broadcast.ContainsSensitiveData = true
	a.Publish(adminMessage)

	a.SanitizeProfile(&user, false)
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_USER_UPDATED, "", "", "", nil)
	message.Add("user", user)
	message.Broadcast.ContainsSanitizedData = true
	a.Publish(message)
}

func (a *App) UpdateUser(user *model.User, sendNotifications bool) (*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().Get(user.Id)
	if result.Err != nil {
		return nil, result.Err
	}
	prev := result.Data.(*model.User)

	if !CheckUserDomain(user, *a.Config().TeamSettings.RestrictCreationToDomains) {
		if !prev.IsLDAPUser() && !prev.IsSAMLUser() && user.Email != prev.Email {
			return nil, model.NewAppError("UpdateUser", "api.user.create_user.accepted_domain.app_error", nil, "", http.StatusBadRequest)
		}
	}

	// Don't set new eMail on user account if email verification is required, this will be done as a post-verification action
	// to avoid users being able to set non-controlled eMails as their account email
	newEmail := ""
	if *a.Config().EmailSettings.RequireEmailVerification && prev.Email != user.Email {
		newEmail = user.Email

		_, err := a.GetUserByEmail(newEmail)
		if err == nil {
			return nil, model.NewAppError("UpdateUser", "store.sql_user.update.email_taken.app_error", nil, "user_id="+user.Id, http.StatusBadRequest)
		}

		user.Email = prev.Email
	}

	result = <-a.Srv.Store.User().Update(user, false)
	if result.Err != nil {
		return nil, result.Err
	}
	rusers := result.Data.([2]*model.User)

	if sendNotifications {
		if rusers[0].Email != rusers[1].Email || newEmail != "" {
			if *a.Config().EmailSettings.RequireEmailVerification {
				a.Srv.Go(func() {
					if err := a.SendEmailVerification(rusers[0], newEmail); err != nil {
						mlog.Error(err.Error())
					}
				})
			} else {
				a.Srv.Go(func() {
					if err := a.SendEmailChangeEmail(rusers[1].Email, rusers[0].Email, rusers[0].Locale, a.GetSiteURL()); err != nil {
						mlog.Error(err.Error())
					}
				})
			}
		}

		if rusers[0].Username != rusers[1].Username {
			a.Srv.Go(func() {
				if err := a.SendChangeUsernameEmail(rusers[1].Username, rusers[0].Username, rusers[0].Email, rusers[0].Locale, a.GetSiteURL()); err != nil {
					mlog.Error(err.Error())
				}
			})
		}
	}

	a.InvalidateCacheForUser(user.Id)

	esInterface := a.Elasticsearch
	if esInterface != nil && *a.Config().ElasticsearchSettings.EnableIndexing {
		a.Srv.Go(func() {
			if err := a.indexUser(user); err != nil {
				mlog.Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.Err(err))
			}
		})
	}

	return rusers[0], nil
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

	a.Srv.Go(func() {
		user, err := a.GetUser(userId)
		if err != nil {
			mlog.Error(err.Error())
			return
		}

		if err := a.SendMfaChangeEmail(user.Email, activate, user.Locale, a.GetSiteURL()); err != nil {
			mlog.Error(err.Error())
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

	if result := <-a.Srv.Store.User().UpdatePassword(user.Id, hashedPassword); result.Err != nil {
		return model.NewAppError("UpdatePassword", "api.user.update_password.failed.app_error", nil, result.Err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) UpdatePasswordSendEmail(user *model.User, newPassword, method string) *model.AppError {
	if err := a.UpdatePassword(user, newPassword); err != nil {
		return err
	}

	a.Srv.Go(func() {
		if err := a.SendPasswordChangeEmail(user.Email, method, user.Locale, a.GetSiteURL()); err != nil {
			mlog.Error(err.Error())
		}
	})

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
		mlog.Error(err.Error())
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

	return a.SendPasswordResetEmail(user.Email, token, user.Locale, siteURL)
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

	if result := <-a.Srv.Store.Token().Save(token); result.Err != nil {
		return nil, result.Err
	}

	return token, nil
}

func (a *App) GetPasswordRecoveryToken(token string) (*model.Token, *model.AppError) {
	result := <-a.Srv.Store.Token().GetByToken(token)
	if result.Err != nil {
		return nil, model.NewAppError("GetPasswordRecoveryToken", "api.user.reset_password.invalid_link.app_error", nil, result.Err.Error(), http.StatusBadRequest)
	}
	rtoken := result.Data.(*model.Token)
	if rtoken.Type != TOKEN_TYPE_PASSWORD_RECOVERY {
		return nil, model.NewAppError("GetPasswordRecoveryToken", "api.user.reset_password.broken_token.app_error", nil, "", http.StatusBadRequest)
	}
	return rtoken, nil
}

func (a *App) DeleteToken(token *model.Token) *model.AppError {
	if result := <-a.Srv.Store.Token().Delete(token.Token); result.Err != nil {
		return result.Err
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
	uchan := a.Srv.Store.User().Update(user, true)
	schan := a.Srv.Store.Session().UpdateRoles(user.Id, newRoles)

	result := <-uchan
	if result.Err != nil {
		return nil, result.Err
	}
	ruser := result.Data.([2]*model.User)[0]

	if result := <-schan; result.Err != nil {
		// soft error since the user roles were still updated
		mlog.Error(fmt.Sprint(result.Err))
	}

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
	mlog.Warn(fmt.Sprintf("Attempting to permanently delete account %v id=%v", user.Email, user.Id), mlog.String("user_id", user.Id))
	if user.IsInRole(model.SYSTEM_ADMIN_ROLE_ID) {
		mlog.Warn(fmt.Sprintf("You are deleting %v that is a system administrator.  You may need to set another account as the system administrator using the command line tools.", user.Email))
	}

	if _, err := a.UpdateActive(user, false); err != nil {
		return err
	}

	if result := <-a.Srv.Store.Session().PermanentDeleteSessionsByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.UserAccessToken().DeleteAllForUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.OAuth().PermanentDeleteAuthDataByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Webhook().PermanentDeleteIncomingByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Webhook().PermanentDeleteOutgoingByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Command().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Preference().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Channel().PermanentDeleteMembersByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Post().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	result := <-a.Srv.Store.FileInfo().GetForUser(user.Id)
	if result.Err != nil {
		mlog.Warn("Error getting file list for user from FileInfoStore")
	}

	infos := result.Data.([]*model.FileInfo)
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

	if result := <-a.Srv.Store.FileInfo().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.User().PermanentDelete(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Audit().PermanentDeleteByUser(user.Id); result.Err != nil {
		return result.Err
	}

	if result := <-a.Srv.Store.Team().RemoveAllMembersByUser(user.Id); result.Err != nil {
		return result.Err
	}

	mlog.Warn(fmt.Sprintf("Permanently deleted account %v id=%v", user.Email, user.Id), mlog.String("user_id", user.Id))

	esInterface := a.Elasticsearch
	if esInterface != nil && *a.Config().ElasticsearchSettings.EnableIndexing {
		a.Srv.Go(func() {
			if err := a.Elasticsearch.DeleteUser(user); err != nil {
				mlog.Error("Encountered error deleting user", mlog.String("user_id", user.Id), mlog.Err(err))
			}
		})
	}

	return nil
}

func (a *App) PermanentDeleteAllUsers() *model.AppError {
	result := <-a.Srv.Store.User().GetAll()
	if result.Err != nil {
		return result.Err
	}
	users := result.Data.([]*model.User)
	for _, user := range users {
		a.PermanentDeleteUser(user)
	}

	return nil
}

func (a *App) SendEmailVerification(user *model.User, newEmail string) *model.AppError {
	token, err := a.CreateVerifyEmailToken(user.Id, newEmail)
	if err != nil {
		return err
	}

	if _, err := a.GetStatus(user.Id); err != nil {
		return a.SendVerifyEmail(newEmail, user.Locale, a.GetSiteURL(), token.Token)
	}
	return a.SendEmailChangeVerifyEmail(newEmail, user.Locale, a.GetSiteURL(), token.Token)
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

	if err := a.VerifyUserEmail(tokenData.UserId, tokenData.Email); err != nil {
		return err
	}

	if user.Email != tokenData.Email {
		a.Srv.Go(func() {
			if err := a.SendEmailChangeEmail(user.Email, tokenData.Email, user.Locale, a.GetSiteURL()); err != nil {
				mlog.Error(err.Error())
			}
		})
	}

	if err := a.DeleteToken(token); err != nil {
		mlog.Error(err.Error())
	}

	return nil
}

func (a *App) CreateVerifyEmailToken(userId string, newEmail string) (*model.Token, *model.AppError) {
	tokenExtra := struct {
		UserId string
		Email  string
	}{
		userId,
		newEmail,
	}
	jsonData, err := json.Marshal(tokenExtra)

	if err != nil {
		return nil, model.NewAppError("CreateVerifyEmailToken", "api.user.create_email_token.error", nil, "", http.StatusInternalServerError)
	}

	token := model.NewToken(TOKEN_TYPE_VERIFY_EMAIL, string(jsonData))

	if result := <-a.Srv.Store.Token().Save(token); result.Err != nil {
		return nil, result.Err
	}

	return token, nil
}

func (a *App) GetVerifyEmailToken(token string) (*model.Token, *model.AppError) {
	result := <-a.Srv.Store.Token().GetByToken(token)
	if result.Err != nil {
		return nil, model.NewAppError("GetVerifyEmailToken", "api.user.verify_email.bad_link.app_error", nil, result.Err.Error(), http.StatusBadRequest)
	}
	rtoken := result.Data.(*model.Token)
	if rtoken.Type != TOKEN_TYPE_VERIFY_EMAIL {
		return nil, model.NewAppError("GetVerifyEmailToken", "api.user.verify_email.broken_token.app_error", nil, "", http.StatusBadRequest)
	}
	return rtoken, nil
}

// GetTotalUsersStats is used for the DM list total
func (a *App) GetTotalUsersStats() (*model.UsersStats, *model.AppError) {
	result := <-a.Srv.Store.User().Count(model.UserCountOptions{
		IncludeBotAccounts: true,
	})
	if result.Err != nil {
		return nil, result.Err
	}
	stats := &model.UsersStats{
		TotalUsersCount: result.Data.(int64),
	}
	return stats, nil
}

func (a *App) VerifyUserEmail(userId, email string) *model.AppError {
	err := (<-a.Srv.Store.User().VerifyEmail(userId, email)).Err

	if err != nil {
		return err
	}

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
	return a.SearchUsersInTeam(props.TeamId, props.Term, options)
}

func (a *App) SearchUsersInChannel(channelId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().SearchInChannel(channelId, term, options)
	if result.Err != nil {
		return nil, result.Err
	}
	users := result.Data.([]*model.User)

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersNotInChannel(teamId string, channelId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().SearchNotInChannel(teamId, channelId, term, options)
	if result.Err != nil {
		return nil, result.Err
	}
	users := result.Data.([]*model.User)

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersInTeam(teamId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	var result store.StoreResult

	esInterface := a.Elasticsearch
	license := a.License()
	if esInterface != nil && *a.Config().ElasticsearchSettings.EnableAutocomplete && license != nil && *license.Features.Elasticsearch {
		usersIds, err := a.Elasticsearch.SearchUsersInTeam(teamId, term, options)
		if err != nil {
			return nil, err
		}

		result = <-a.Srv.Store.User().GetProfileByIds(usersIds, false)
	} else {
		result = <-a.Srv.Store.User().Search(teamId, term, options)
	}

	if result.Err != nil {
		return nil, result.Err
	}
	users := result.Data.([]*model.User)

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersNotInTeam(notInTeamId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().SearchNotInTeam(notInTeamId, term, options)
	if result.Err != nil {
		return nil, result.Err
	}
	users := result.Data.([]*model.User)

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersWithoutTeam(term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	result := <-a.Srv.Store.User().SearchWithoutTeam(term, options)
	if result.Err != nil {
		return nil, result.Err
	}
	users := result.Data.([]*model.User)

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) AutocompleteUsersInChannel(teamId string, channelId string, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, *model.AppError) {
	var uchan, nuchan store.StoreChannel

	esInterface := a.Elasticsearch
	license := a.License()
	if esInterface != nil && *a.Config().ElasticsearchSettings.EnableAutocomplete && license != nil && *license.Features.Elasticsearch {
		uchanIds, nuchanIds, err := a.Elasticsearch.SearchUsersInChannel(teamId, channelId, term, options)
		if err != nil {
			return nil, err
		}
		uchan = a.Srv.Store.User().GetProfileByIds(uchanIds, false)
		nuchan = a.Srv.Store.User().GetProfileByIds(nuchanIds, false)
	} else {
		uchan = a.Srv.Store.User().SearchInChannel(channelId, term, options)
		nuchan = a.Srv.Store.User().SearchNotInChannel(teamId, channelId, term, options)
	}

	autocomplete := &model.UserAutocompleteInChannel{}

	result := <-uchan
	if result.Err != nil {
		return nil, result.Err
	}
	users := result.Data.([]*model.User)

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	autocomplete.InChannel = users

	result = <-nuchan
	if result.Err != nil {
		return nil, result.Err
	}
	users = result.Data.([]*model.User)

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	autocomplete.OutOfChannel = users

	return autocomplete, nil
}

func (a *App) AutocompleteUsersInTeam(teamId string, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInTeam, *model.AppError) {
	autocomplete := &model.UserAutocompleteInTeam{}
	var result store.StoreResult

	esInterface := a.Elasticsearch
	license := a.License()
	if esInterface != nil && *a.Config().ElasticsearchSettings.EnableAutocomplete && license != nil && *license.Features.Elasticsearch {
		usersIds, err := a.Elasticsearch.SearchUsersInTeam(teamId, term, options)
		if err != nil {
			return nil, err
		}

		result = <-a.Srv.Store.User().GetProfileByIds(usersIds, false)
	} else {
		result = <-a.Srv.Store.User().Search(teamId, term, options)
	}

	if result.Err != nil {
		return nil, result.Err
	}
	users := result.Data.([]*model.User)

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	autocomplete.InTeam = users

	return autocomplete, nil
}

func (a *App) UpdateOAuthUserAttrs(userData io.Reader, user *model.User, provider einterfaces.OauthProvider, service string) *model.AppError {
	oauthUser := provider.GetUserFromJson(userData)
	if oauthUser == nil {
		return model.NewAppError("UpdateOAuthUserAttrs", "api.user.update_oauth_user_attrs.get_user.app_error", map[string]interface{}{"Service": service}, "", http.StatusBadRequest)
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
		result := <-a.Srv.Store.User().Update(user, true)
		if result.Err != nil {
			return result.Err
		}

		user = result.Data.([2]*model.User)[0]
		a.InvalidateCacheForUser(user.Id)

		esInterface := a.Elasticsearch
		if esInterface != nil && *a.Config().ElasticsearchSettings.EnableIndexing {
			a.Srv.Go(func() {
				if err := a.indexUser(user); err != nil {
					mlog.Error("Encountered error indexing user", mlog.String("user_id", user.Id), mlog.Err(err))
				}
			})
		}
	}

	return nil
}

// UsersCanJoinTeam verifies that users can join a team based on group-constraints. If one or more users cannot join
// the team a model.InvalidTeamMembersError is returned containing the user ids of the denied users.
func (a *App) UsersCanJoinTeam(userIDs []string, team *model.Team) error {
	// all users are permitted in non-group-constrained teams, return without error
	if team.GroupConstrained == nil || !*team.GroupConstrained {
		return nil
	}

	permittedUsers, err := a.GetUsersPermittedToTeam(team.Id)
	if err != nil {
		return err
	}

	// possible if no groups associated or no group members in any of the associated groups
	if len(permittedUsers) == 0 {
		return &model.InvalidTeamMembersError{UserIDs: userIDs, Team: team}
	}

	var invalidMemberIDs []string

	for _, userID := range userIDs {
		userIsPermitted := false

		for _, pu := range permittedUsers {
			if pu.Id == userID {
				userIsPermitted = true
				break
			}
		}

		if !userIsPermitted {
			invalidMemberIDs = append(invalidMemberIDs, userID)
		}
	}

	if len(invalidMemberIDs) > 0 {
		return &model.InvalidTeamMembersError{UserIDs: invalidMemberIDs, Team: team}
	}

	return nil
}

// UsersCanJoinChannel verifies that users can join a channel based on group-constraints. If one or more users
// cannot join the channel a model.InvalidChannelMembersError is returned containing the user ids of the denied users.
func (a *App) UsersCanJoinChannel(userIDs []string, channel *model.Channel) error {
	// all users are permitted in non-group-constrained channel, return without error
	if channel.GroupConstrained == nil || !*channel.GroupConstrained {
		return nil
	}

	permittedUsers, err := a.GetUsersPermittedToChannel(channel.Id)
	if err != nil {
		return err
	}

	// possible if no groups associated or no group members in any of the associated groups
	if len(permittedUsers) == 0 {
		return &model.InvalidChannelMembersError{UserIDs: userIDs, Channel: channel}
	}

	var invalidMemberIDs []string

	for _, userID := range userIDs {
		userIsPermitted := false

		for _, pu := range permittedUsers {
			if pu.Id == userID {
				userIsPermitted = true
				break
			}
		}

		if !userIsPermitted {
			invalidMemberIDs = append(invalidMemberIDs, userID)
		}
	}

	if len(invalidMemberIDs) > 0 {
		return &model.InvalidChannelMembersError{UserIDs: invalidMemberIDs, Channel: channel}
	}

	return nil
}
