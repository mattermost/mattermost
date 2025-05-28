// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/pkg/errors"

	"golang.org/x/sync/errgroup"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/email"
	"github.com/mattermost/mattermost/server/v8/channels/app/imaging"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mfa"
)

const (
	TokenTypePasswordRecovery  = "password_recovery"
	TokenTypeVerifyEmail       = "verify_email"
	TokenTypeTeamInvitation    = "team_invitation"
	TokenTypeGuestInvitation   = "guest_invitation"
	TokenTypeCWSAccess         = "cws_access_token"
	PasswordRecoverExpiryTime  = 1000 * 60 * 60 * 24 // 24 hours
	InvitationExpiryTime       = 1000 * 60 * 60 * 48 // 48 hours
	ImageProfilePixelDimension = 128
)

func (a *App) CreateUserWithToken(c request.CTX, user *model.User, token *model.Token) (*model.User, *model.AppError) {
	if err := a.IsUserSignUpAllowed(); err != nil {
		return nil, err
	}

	if token.Type != TokenTypeTeamInvitation && token.Type != TokenTypeGuestInvitation {
		return nil, model.NewAppError("CreateUserWithToken", "api.user.create_user.signup_link_invalid.app_error", nil, "", http.StatusBadRequest)
	}

	if model.GetMillis()-token.CreateAt >= InvitationExpiryTime {
		if appErr := a.DeleteToken(token); appErr != nil {
			c.Logger().Warn("Error while deleting expired signup-invite token", mlog.Err(appErr))
		}
		return nil, model.NewAppError("CreateUserWithToken", "api.user.create_user.signup_link_expired.app_error", nil, "", http.StatusBadRequest)
	}

	tokenData := model.MapFromJSON(strings.NewReader(token.Extra))

	team, nErr := a.Srv().Store().Team().Get(tokenData["teamId"])
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("CreateUserWithToken", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("CreateUserWithToken", "app.team.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	// find the sender id and grab the channels in order to validate
	// the sender id still belongs to team and to private channels
	senderId := tokenData["senderId"]
	channelIds := strings.Split(tokenData["channels"], " ")

	// filter the channels the original inviter has still permissions over
	channelIds = a.ValidateUserPermissionsOnChannels(c, senderId, channelIds)

	channels, nErr := a.Srv().Store().Channel().GetChannelsByIds(channelIds, false)
	if nErr != nil {
		return nil, model.NewAppError("CreateUserWithToken", "app.channel.get_channels_by_ids.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	emailFromToken := tokenData["email"]
	if emailFromToken != user.Email {
		return nil, model.NewAppError("CreateUserWithToken", "api.user.create_user.bad_token_email_data.app_error", nil, "", http.StatusBadRequest)
	}

	user.Email = tokenData["email"]
	user.EmailVerified = true

	var ruser *model.User
	var err *model.AppError
	if token.Type == TokenTypeTeamInvitation {
		ruser, err = a.CreateUser(c, user)
	} else {
		ruser, err = a.CreateGuest(c, user)
	}
	if err != nil {
		return nil, err
	}

	if _, err := a.JoinUserToTeam(c, team, ruser, ""); err != nil {
		return nil, err
	}

	if appErr := a.AddDirectChannels(c, team.Id, ruser); appErr != nil {
		return nil, appErr
	}

	if token.Type == TokenTypeGuestInvitation || (token.Type == TokenTypeTeamInvitation && len(channels) > 0) {
		for _, channel := range channels {
			_, err := a.AddChannelMember(c, ruser.Id, channel, ChannelMemberOpts{})
			if err != nil {
				c.Logger().Warn("Failed to add channel member", mlog.Err(err))
			}
		}
	}

	if err := a.DeleteToken(token); err != nil {
		c.Logger().Warn("Error while deleting token", mlog.Err(err))
	}

	return ruser, nil
}

func (a *App) CreateUserWithInviteId(c request.CTX, user *model.User, inviteId, redirect string) (*model.User, *model.AppError) {
	if err := a.IsUserSignUpAllowed(); err != nil {
		return nil, err
	}

	team, nErr := a.Srv().Store().Team().GetByInviteId(inviteId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("CreateUserWithInviteId", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("CreateUserWithInviteId", "app.team.get_by_invite_id.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if team.IsGroupConstrained() {
		return nil, model.NewAppError("CreateUserWithInviteId", "app.team.invite_id.group_constrained.error", nil, "", http.StatusForbidden)
	}

	if !users.CheckUserDomain(user, team.AllowedDomains) {
		return nil, model.NewAppError("CreateUserWithInviteId", "api.team.invite_members.invalid_email.app_error", map[string]any{"Addresses": team.AllowedDomains}, "", http.StatusForbidden)
	}

	user.EmailVerified = false

	ruser, err := a.CreateUser(c, user)
	if err != nil {
		return nil, err
	}

	if _, err := a.JoinUserToTeam(c, team, ruser, ""); err != nil {
		return nil, err
	}

	if appErr := a.AddDirectChannels(c, team.Id, ruser); appErr != nil {
		return nil, appErr
	}

	if err := a.Srv().EmailService.SendWelcomeEmail(ruser.Id, ruser.Email, ruser.EmailVerified, ruser.DisableWelcomeEmail, ruser.Locale, a.GetSiteURL(), redirect); err != nil {
		c.Logger().Warn("Failed to send welcome email on create user with inviteId", mlog.Err(err))
	}

	return ruser, nil
}

func (a *App) CreateUserAsAdmin(c request.CTX, user *model.User, redirect string) (*model.User, *model.AppError) {
	ruser, err := a.CreateUser(c, user)
	if err != nil {
		return nil, err
	}

	if err := a.Srv().EmailService.SendWelcomeEmail(ruser.Id, ruser.Email, ruser.EmailVerified, ruser.DisableWelcomeEmail, ruser.Locale, a.GetSiteURL(), redirect); err != nil {
		c.Logger().Warn("Failed to send welcome email to the new user, created by system admin", mlog.Err(err))
	}

	return ruser, nil
}

func (a *App) CreateUserFromSignup(c request.CTX, user *model.User, redirect string) (*model.User, *model.AppError) {
	if err := a.IsUserSignUpAllowed(); err != nil {
		return nil, err
	}

	if !a.IsFirstUserAccount() && !*a.Config().TeamSettings.EnableOpenServer {
		err := model.NewAppError("CreateUserFromSignup", "api.user.create_user.no_open_server", nil, "email="+user.Email, http.StatusForbidden)
		return nil, err
	}

	user.EmailVerified = false

	ruser, err := a.CreateUser(c, user)
	if err != nil {
		return nil, err
	}

	if err := a.Srv().EmailService.SendWelcomeEmail(ruser.Id, ruser.Email, ruser.EmailVerified, ruser.DisableWelcomeEmail, ruser.Locale, a.GetSiteURL(), redirect); err != nil {
		c.Logger().Warn("Failed to send welcome email on create user from signup", mlog.Err(err))
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
	return a.ch.srv.platform.IsFirstUserAccount()
}

// CreateUser creates a user and sets several fields of the returned User struct to
// their zero values.
func (a *App) CreateUser(c request.CTX, user *model.User) (*model.User, *model.AppError) {
	return a.createUserOrGuest(c, user, false)
}

// CreateGuest creates a guest and sets several fields of the returned User struct to
// their zero values.
func (a *App) CreateGuest(c request.CTX, user *model.User) (*model.User, *model.AppError) {
	return a.createUserOrGuest(c, user, true)
}

func (a *App) createUserOrGuest(c request.CTX, user *model.User, guest bool) (*model.User, *model.AppError) {
	exceeded, limitErr := a.isHardUserLimitExceeded()
	if limitErr != nil {
		return nil, limitErr
	}

	if exceeded {
		return nil, model.NewAppError("createUserOrGuest", "api.user.create_user.user_limits.exceeded", nil, "", http.StatusBadRequest)
	}

	if err := a.isUniqueToGroupNames(user.Username); err != nil {
		err.Where = "createUserOrGuest"
		return nil, err
	}

	ruser, nErr := a.ch.srv.userService.CreateUser(c, user, users.UserCreateOptions{Guest: guest})
	if nErr != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		var nfErr *users.ErrInvalidPassword
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		case errors.Is(nErr, users.AcceptedDomainError):
			return nil, model.NewAppError("createUserOrGuest", "api.user.create_user.accepted_domain.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("createUserOrGuest", nfErr.Id(), map[string]any{"Min": *a.Config().PasswordSettings.MinimumLength}, "", http.StatusBadRequest)
		case errors.Is(nErr, users.UserStoreIsEmptyError):
			return nil, model.NewAppError("createUserOrGuest", "app.user.store_is_empty.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		case errors.As(nErr, &invErr):
			switch invErr.Field {
			case "email":
				return nil, model.NewAppError("createUserOrGuest", "app.user.save.email_exists.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			case "username":
				return nil, model.NewAppError("createUserOrGuest", "app.user.save.username_exists.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			default:
				return nil, model.NewAppError("createUserOrGuest", "app.user.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
			}
		default:
			return nil, model.NewAppError("createUserOrGuest", "app.user.save.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	// We always invalidate the user because we actually need to invalidate
	// in case the user's EmailVerified is true, but we also always need to invalidate
	// the GetAllProfiles cache.
	// To have a proper fix would mean duplicating the invalidation of GetAllProfiles
	// everywhere else. Therefore, to keep things simple we always invalidate both caches here.
	// The performance penalty for invalidating the UserById cache is nil because the user was just created.
	a.InvalidateCacheForUser(ruser.Id)

	if user.EmailVerified {
		nUser, err := a.ch.srv.userService.GetUser(ruser.Id)
		if err != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(err, &nfErr):
				return nil, model.NewAppError("createUserOrGuest", MissingAccountError, nil, "", http.StatusNotFound).Wrap(err)
			default:
				return nil, model.NewAppError("createUserOrGuest", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}

		a.sendUpdatedUserEvent(nUser)
	}

	recommendedNextStepsPref := model.Preference{UserId: ruser.Id, Category: model.PreferenceCategoryRecommendedNextSteps, Name: model.PreferenceNameRecommendedNextStepsHide, Value: "false"}
	tutorialStepPref := model.Preference{UserId: ruser.Id, Category: model.PreferenceCategoryTutorialSteps, Name: ruser.Id, Value: "0"}
	gmASdmPref := model.Preference{UserId: ruser.Id, Category: model.PreferenceCategorySystemNotice, Name: "GMasDM", Value: "true"}

	preferences := model.Preferences{recommendedNextStepsPref, tutorialStepPref, gmASdmPref}
	if err := a.Srv().Store().Preference().Save(preferences); err != nil {
		c.Logger().Warn("Encountered error saving user preferences", mlog.Err(err))
	}

	go a.UpdateViewedProductNoticesForNewUser(ruser.Id)

	// This message goes to everyone, so the teamID, channelID and userID are irrelevant
	message := model.NewWebSocketEvent(model.WebsocketEventNewUser, "", "", "", nil, "")
	message.Add("user_id", ruser.Id)
	a.Publish(message)

	pluginContext := pluginContext(c)
	a.Srv().Go(func() {
		a.ch.RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
			hooks.UserHasBeenCreated(pluginContext, ruser)
			return true
		}, plugin.UserHasBeenCreatedID)
	})

	userLimits, limitErr := a.GetServerLimits()
	if limitErr != nil {
		// we don't want to break the create user flow just because of this.
		// So, we log the error, not return
		c.Logger().Error("Error fetching user limits in createUserOrGuest", mlog.Err(limitErr))
	} else {
		if userLimits.ActiveUserCount > userLimits.MaxUsersLimit {
			c.Logger().Warn("ERROR_SAFETY_LIMITS_EXCEEDED: Created user exceeds the total activated users limit.", mlog.Int("user_limit", userLimits.MaxUsersLimit))
		}
	}

	return ruser, nil
}

func (a *App) CreateOAuthUser(c request.CTX, service string, userData io.Reader, teamID string, tokenUser *model.User) (*model.User, *model.AppError) {
	if !*a.Config().TeamSettings.EnableUserCreation {
		return nil, model.NewAppError("CreateOAuthUser", "api.user.create_user.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	provider, e := a.getSSOProvider(service)
	if e != nil {
		return nil, e
	}
	user, err1 := provider.GetUserFromJSON(c, userData, tokenUser)
	if err1 != nil {
		return nil, model.NewAppError("CreateOAuthUser", "api.user.create_oauth_user.create.app_error", map[string]any{"Service": service}, "", http.StatusInternalServerError).Wrap(err1)
	}
	if user.AuthService == "" {
		user.AuthService = service
	}

	found := true
	count := 0
	for found {
		if found = a.ch.srv.userService.IsUsernameTaken(user.Username); found {
			user.Username = user.Username + strconv.Itoa(count)
			count++
		}
	}

	userByAuth, _ := a.ch.srv.userService.GetUserByAuth(user.AuthData, service)
	if userByAuth != nil {
		return userByAuth, nil
	}

	userByEmail, _ := a.ch.srv.userService.GetUserByEmail(user.Email)
	if userByEmail != nil {
		if userByEmail.AuthService == "" {
			return nil, model.NewAppError("CreateOAuthUser", "api.user.create_oauth_user.already_attached.app_error", map[string]any{"Service": service, "Auth": model.UserAuthServiceEmail}, "email="+user.Email, http.StatusBadRequest)
		}
		if provider.IsSameUser(c, userByEmail, user) {
			if _, err := a.Srv().Store().User().UpdateAuthData(userByEmail.Id, user.AuthService, user.AuthData, "", false); err != nil {
				// if the user is not updated, write a warning to the log, but don't prevent user login
				c.Logger().Warn("Error attempting to update user AuthData", mlog.Err(err))
			}
			return userByEmail, nil
		}
		return nil, model.NewAppError("CreateOAuthUser", "api.user.create_oauth_user.already_attached.app_error", map[string]any{"Service": service, "Auth": userByEmail.AuthService}, "email="+user.Email+" authData="+*user.AuthData, http.StatusBadRequest)
	}

	user.EmailVerified = true

	ruser, err := a.CreateUser(c, user)
	if err != nil {
		return nil, err
	}

	if teamID != "" {
		err = a.AddUserToTeamByTeamId(c, teamID, user)
		if err != nil {
			return nil, err
		}

		err = a.AddDirectChannels(c, teamID, user)
		if err != nil {
			c.Logger().Warn("Failed to add direct channels", mlog.Err(err))
		}
	}

	return ruser, nil
}

func (a *App) GetUser(userID string) (*model.User, *model.AppError) {
	user, err := a.ch.srv.userService.GetUser(userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUser", MissingAccountError, nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetUser", "app.user.get_by_username.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return user, nil
}

func (a *App) GetUsers(userIDs []string) ([]*model.User, *model.AppError) {
	users, err := a.ch.srv.userService.GetUsers(userIDs)
	if err != nil {
		return nil, model.NewAppError("GetUsers", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func (a *App) GetUserByUsername(username string) (*model.User, *model.AppError) {
	result, err := a.ch.srv.userService.GetUserByUsername(username)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUserByUsername", "app.user.get_by_username.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetUserByUsername", "app.user.get_by_username.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return result, nil
}

func (a *App) GetUserByEmail(email string) (*model.User, *model.AppError) {
	user, err := a.ch.srv.userService.GetUserByEmail(email)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUserByEmail", MissingAccountError, nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetUserByEmail", MissingAccountError, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return user, nil
}

func (a *App) GetUserByRemoteID(remoteID string) (*model.User, *model.AppError) {
	user, err := a.ch.srv.userService.GetUserByRemoteID(remoteID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUserByRemoteID", MissingAccountError, nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetUserByRemoteID", MissingAccountError, nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return user, nil
}

func (a *App) GetUserByAuth(authData *string, authService string) (*model.User, *model.AppError) {
	user, err := a.ch.srv.userService.GetUserByAuth(authData, authService)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("GetUserByAuth", MissingAuthAccountError, nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUserByAuth", MissingAuthAccountError, nil, "", http.StatusInternalServerError).Wrap(err)
		default:
			return nil, model.NewAppError("GetUserByAuth", "app.user.get_by_auth.other.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return user, nil
}

func (a *App) GetUsersFromProfiles(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	users, err := a.ch.srv.userService.GetUsersFromProfiles(options)
	if err != nil {
		return nil, model.NewAppError("GetUsers", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func (a *App) GetUsersPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.ch.srv.userService.GetUsersPage(options, asAdmin)
	if err != nil {
		return nil, model.NewAppError("GetUsersPage", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func (a *App) GetUsersEtag(restrictionsHash string) string {
	return a.ch.srv.userService.GetUsersEtag(restrictionsHash)
}

func (a *App) GetUsersInTeam(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	users, err := a.ch.srv.userService.GetUsersInTeam(options)
	if err != nil {
		return nil, model.NewAppError("GetUsersInTeam", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func (a *App) GetUsersNotInTeam(teamID string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.ch.srv.userService.GetUsersNotInTeam(teamID, groupConstrained, offset, limit, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetUsersNotInTeam", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func (a *App) GetUsersInTeamPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.ch.srv.userService.GetUsersInTeamPage(options, asAdmin)
	if err != nil {
		return nil, model.NewAppError("GetUsersInTeamPage", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersNotInTeamPage(teamID string, groupConstrained bool, page int, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.ch.srv.userService.GetUsersNotInTeamPage(teamID, groupConstrained, page*perPage, perPage, asAdmin, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetUsersNotInTeamPage", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersInTeamEtag(teamID string, restrictionsHash string) string {
	return a.ch.srv.userService.GetUsersInTeamEtag(teamID, restrictionsHash)
}

func (a *App) GetUsersNotInTeamEtag(teamID string, restrictionsHash string) string {
	return a.ch.srv.userService.GetUsersNotInTeamEtag(teamID, restrictionsHash)
}

func (a *App) GetUsersInChannel(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store().User().GetProfilesInChannel(options)
	if err != nil {
		return nil, model.NewAppError("GetUsersInChannel", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func (a *App) GetUsersInChannelByStatus(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store().User().GetProfilesInChannelByStatus(options)
	if err != nil {
		return nil, model.NewAppError("GetUsersInChannelByStatus", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func (a *App) GetUsersInChannelByAdmin(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store().User().GetProfilesInChannelByAdmin(options)
	if err != nil {
		return nil, model.NewAppError("GetUsersInChannelByAdmin", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

func (a *App) GetUsersInChannelPageByAdmin(options *model.UserGetOptions, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersInChannelByAdmin(options)
	if err != nil {
		return nil, err
	}
	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersNotInChannel(teamID string, channelID string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store().User().GetProfilesNotInChannel(teamID, channelID, groupConstrained, offset, limit, viewRestrictions)
	if err != nil {
		return nil, model.NewAppError("GetUsersNotInChannel", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func (a *App) GetUsersNotInChannelMap(teamID string, channelID string, groupConstrained bool, offset int, limit int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) (map[string]*model.User, *model.AppError) {
	users, err := a.GetUsersNotInChannel(teamID, channelID, groupConstrained, offset, limit, viewRestrictions)
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

func (a *App) GetUsersNotInChannelPage(teamID string, channelID string, groupConstrained bool, page int, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.GetUsersNotInChannel(teamID, channelID, groupConstrained, page*perPage, perPage, viewRestrictions)
	if err != nil {
		return nil, err
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersWithoutTeamPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, *model.AppError) {
	users, err := a.ch.srv.userService.GetUsersWithoutTeamPage(options, asAdmin)
	if err != nil {
		return nil, model.NewAppError("GetUsersWithoutTeamPage", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) GetUsersWithoutTeam(options *model.UserGetOptions) ([]*model.User, *model.AppError) {
	users, err := a.ch.srv.userService.GetUsersWithoutTeam(options)
	if err != nil {
		return nil, model.NewAppError("GetUsersWithoutTeam", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

// GetTeamGroupUsers returns the users who are associated to the team via GroupTeams and GroupMembers.
func (a *App) GetTeamGroupUsers(teamID string) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store().User().GetTeamGroupUsers(teamID)
	if err != nil {
		return nil, model.NewAppError("GetTeamGroupUsers", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

// GetChannelGroupUsers returns the users who are associated to the channel via GroupChannels and GroupMembers.
func (a *App) GetChannelGroupUsers(channelID string) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store().User().GetChannelGroupUsers(channelID)
	if err != nil {
		return nil, model.NewAppError("GetChannelGroupUsers", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func (a *App) GetUsersByIds(userIDs []string, options *store.UserGetByIdsOpts) ([]*model.User, *model.AppError) {
	users, err := a.ch.srv.userService.GetUsersByIds(userIDs, options)
	if err != nil {
		return nil, model.NewAppError("GetUsersByIds", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func (a *App) GetUsersByGroupChannelIds(c request.CTX, channelIDs []string, asAdmin bool) (map[string][]*model.User, *model.AppError) {
	usersByChannelId, err := a.Srv().Store().User().GetProfileByGroupChannelIdsForUser(c.Session().UserId, channelIDs)
	if err != nil {
		return nil, model.NewAppError("GetUsersByGroupChannelIds", "app.user.get_profile_by_group_channel_ids_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for channelID, userList := range usersByChannelId {
		usersByChannelId[channelID] = a.sanitizeProfiles(userList, asAdmin)
	}

	return usersByChannelId, nil
}

func (a *App) GetUsersByUsernames(usernames []string, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, *model.AppError) {
	users, err := a.ch.srv.userService.GetUsersByUsernames(usernames, &model.UserGetOptions{ViewRestrictions: viewRestrictions})
	if err != nil {
		return nil, model.NewAppError("GetUsersByUsernames", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return a.sanitizeProfiles(users, asAdmin), nil
}

func (a *App) sanitizeProfiles(users []*model.User, asAdmin bool) []*model.User {
	for _, u := range users {
		a.SanitizeProfile(u, asAdmin)
	}

	return users
}

func (a *App) GenerateMfaSecret(userID string) (*model.MfaSecret, *model.AppError) {
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return nil, appErr
	}

	if !*a.Config().ServiceSettings.EnableMultifactorAuthentication {
		return nil, model.NewAppError("GenerateMfaSecret", "mfa.mfa_disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	mfaSecret, err := a.ch.srv.userService.GenerateMfaSecret(user)
	if err != nil {
		return nil, model.NewAppError("GenerateMfaSecret", "mfa.generate_qr_code.create_code.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return mfaSecret, nil
}

func (a *App) ActivateMfa(userID, token string) *model.AppError {
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return appErr
	}

	if user.AuthService != "" && user.AuthService != model.UserAuthServiceLdap {
		return model.NewAppError("ActivateMfa", "api.user.activate_mfa.email_and_ldap_only.app_error", nil, "", http.StatusBadRequest)
	}

	if !*a.Config().ServiceSettings.EnableMultifactorAuthentication {
		return model.NewAppError("ActivateMfa", "mfa.mfa_disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if err := a.ch.srv.userService.ActivateMfa(user, token); err != nil {
		switch {
		case errors.Is(err, mfa.InvalidToken):
			return model.NewAppError("ActivateMfa", "mfa.activate.bad_token.app_error", nil, "", http.StatusUnauthorized)
		default:
			return model.NewAppError("ActivateMfa", "mfa.activate.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	// Make sure old MFA status is not cached locally or in cluster nodes.
	a.InvalidateCacheForUser(userID)

	return nil
}

func (a *App) DeactivateMfa(userID string) *model.AppError {
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return appErr
	}

	if err := a.ch.srv.userService.DeactivateMfa(user); err != nil {
		return model.NewAppError("DeactivateMfa", "mfa.deactivate.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Make sure old MFA status is not cached locally or in cluster nodes.
	a.InvalidateCacheForUser(userID)

	return nil
}

// GetProfileImagePaths returns the paths to the profile images for the given user IDs if such a profile image exists.
func (a *App) GetProfileImagePath(user *model.User) (string, *model.AppError) {
	path := getProfileImagePath(user.Id)
	exist, err := a.ch.srv.FileBackend().FileExists(path)
	if err != nil {
		return "", model.NewAppError(
			"GetProfileImagePath",
			"api.user.get_profile_image_path.app_error",
			nil,
			"",
			http.StatusInternalServerError,
		).Wrap(err)
	}
	if !exist {
		return "", nil
	}
	return path, nil
}

func (a *App) GetProfileImage(user *model.User) ([]byte, bool, *model.AppError) {
	return a.ch.srv.GetProfileImage(user)
}

func (a *App) GetDefaultProfileImage(user *model.User) ([]byte, *model.AppError) {
	return a.ch.srv.GetDefaultProfileImage(user)
}

func (a *App) UpdateDefaultProfileImage(c request.CTX, user *model.User) *model.AppError {
	img, appErr := a.GetDefaultProfileImage(user)
	if appErr != nil {
		return appErr
	}

	path := getProfileImagePath(user.Id)
	if _, err := a.WriteFile(bytes.NewReader(img), path); err != nil {
		return err
	}

	if err := a.Srv().Store().User().ResetLastPictureUpdate(user.Id); err != nil {
		c.Logger().Warn("Failed to reset last picture update", mlog.Err(err))
	}

	a.InvalidateCacheForUser(user.Id)

	return nil
}

func (a *App) SetDefaultProfileImage(c request.CTX, user *model.User) *model.AppError {
	if err := a.UpdateDefaultProfileImage(c, user); err != nil {
		c.Logger().Error("Failed to update default profile image for user", mlog.String("user_id", user.Id), mlog.Err(err))
		return err
	}

	updatedUser, appErr := a.GetUser(user.Id)
	if appErr != nil {
		c.Logger().Warn("Error in getting users profile forcing logout", mlog.String("user_id", user.Id), mlog.Err(appErr))
		return nil
	}

	options := a.Config().GetSanitizeOptions()
	updatedUser.SanitizeProfile(options, false)

	message := model.NewWebSocketEvent(model.WebsocketEventUserUpdated, "", "", "", nil, "")
	message.Add("user", updatedUser)
	a.Publish(message)

	return nil
}

func (a *App) SetProfileImage(c request.CTX, userID string, imageData *multipart.FileHeader) *model.AppError {
	file, err := imageData.Open()
	if err != nil {
		return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.open.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	defer file.Close()
	return a.SetProfileImageFromMultiPartFile(c, userID, file)
}

func (a *App) SetProfileImageFromMultiPartFile(c request.CTX, userID string, file multipart.File) *model.AppError {
	if limitErr := checkImageLimits(file, *a.Config().FileSettings.MaxImageResolution); limitErr != nil {
		return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.check_image_limits.app_error", nil, "", http.StatusBadRequest).Wrap(limitErr)
	}

	return a.SetProfileImageFromFile(c, userID, file)
}

func (a *App) AdjustImage(rctx request.CTX, file io.ReadSeeker) (*bytes.Buffer, *model.AppError) {
	// Decode image into Image object
	img, format, err := a.ch.imgDecoder.Decode(file)
	if err != nil {
		return nil, model.NewAppError("SetProfileImage", "api.user.upload_profile_user.decode.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	orientation, err := imaging.GetImageOrientation(file, format)
	if err != nil {
		rctx.Logger().Warn("Failed to get image orientation", mlog.Err(err))
	}

	img = imaging.MakeImageUpright(img, orientation)

	// Scale profile image
	profileWidthAndHeight := 128
	img = imaging.FillCenter(img, profileWidthAndHeight, profileWidthAndHeight)

	buf := new(bytes.Buffer)
	err = a.ch.imgEncoder.EncodePNG(buf, img)
	if err != nil {
		return nil, model.NewAppError("SetProfileImage", "api.user.upload_profile_user.encode.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return buf, nil
}

func (a *App) SetProfileImageFromFile(c request.CTX, userID string, file io.ReadSeeker) *model.AppError {
	buf, err := a.AdjustImage(c, file)
	if err != nil {
		return err
	}

	path := getProfileImagePath(userID)
	if storedData, err := a.ReadFile(path); err == nil && bytes.Equal(storedData, buf.Bytes()) {
		return nil
	}

	if _, err := a.WriteFile(buf, path); err != nil {
		return model.NewAppError("SetProfileImage", "api.user.upload_profile_user.upload_profile.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().User().UpdateLastPictureUpdate(userID); err != nil {
		c.Logger().Warn("Error with updating last picture update", mlog.Err(err))
	}
	a.invalidateUserCacheAndPublish(c, userID)
	a.onUserProfileChange(userID)

	return nil
}

func (a *App) UpdatePasswordAsUser(c request.CTX, userID, currentPassword, newPassword string) *model.AppError {
	user, err := a.GetUser(userID)
	if err != nil {
		return err
	}

	if user == nil {
		return model.NewAppError("updatePassword", "api.user.update_password.valid_account.app_error", nil, "", http.StatusBadRequest)
	}

	if user.AuthData != nil && *user.AuthData != "" {
		return model.NewAppError("updatePassword", "api.user.update_password.oauth.app_error", nil, "auth_service="+user.AuthService, http.StatusBadRequest)
	}

	if err := a.DoubleCheckPassword(c, user, currentPassword); err != nil {
		if err.Id == "api.user.check_user_password.invalid.app_error" {
			err = model.NewAppError("updatePassword", "api.user.update_password.incorrect.app_error", nil, "", http.StatusBadRequest)
		}
		return err
	}

	T := i18n.GetUserTranslations(user.Locale)

	return a.UpdatePasswordSendEmail(c, user, newPassword, T("api.user.update_password.menu"))
}

func (a *App) userDeactivated(c request.CTX, userID string) *model.AppError {
	a.SetStatusOffline(userID, false)

	user, err := a.GetUser(userID)
	if err != nil {
		return err
	}

	// when disable a user, userDeactivated is called for the user and the
	// bots the user owns. Only notify once, when the user is the owner, not the
	// owners bots
	if !user.IsBot {
		if appErr := a.notifySysadminsBotOwnerDeactivated(c, userID); appErr != nil {
			c.Logger().Warn("Error while notifying the system admin that the owner of bot accounts got disabled", mlog.Err(appErr))
		}
	}

	if *a.Config().ServiceSettings.DisableBotsWhenOwnerIsDeactivated {
		if appErr := a.disableUserBots(c, userID); appErr != nil {
			c.Logger().Warn("Error while disabling all bots owned by the deactivated user", mlog.Err(appErr))
		}
	}

	if nErr := a.Srv().Store().OAuth().RemoveAuthDataByUserId(userID); nErr != nil {
		c.Logger().Warn("unable to remove auth data by user id", mlog.Err(nErr))
	}

	return nil
}

func (a *App) invalidateUserChannelMembersCaches(c request.CTX, userID string) *model.AppError {
	teamsForUser, err := a.GetTeamsForUser(userID)
	if err != nil {
		return err
	}

	for _, team := range teamsForUser {
		channelsForUser, err := a.GetChannelsForTeamForUser(c, team.Id, userID, &model.ChannelSearchOpts{
			IncludeDeleted: false,
			LastDeleteAt:   0,
		})
		if err != nil {
			return err
		}

		for _, channel := range channelsForUser {
			a.invalidateCacheForChannelMembers(channel.Id)
		}
	}

	return nil
}

func (a *App) UpdateActive(c request.CTX, user *model.User, active bool) (*model.User, *model.AppError) {
	if active {
		exceeded, appErr := a.isHardUserLimitExceeded()
		if appErr != nil {
			return nil, appErr
		}

		if exceeded {
			return nil, model.NewAppError("UpdateActive", "app.user.update_active.user_limit.exceeded", nil, "", http.StatusBadRequest)
		}
	}

	user.UpdateAt = model.GetMillis()
	if active {
		user.DeleteAt = 0
	} else {
		user.DeleteAt = user.UpdateAt
	}

	userUpdate, err := a.ch.srv.userService.UpdateUser(c, user, true)
	if err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateActive", "app.user.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateActive", "app.user.update.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	ruser := userUpdate.New
	a.InvalidateCacheForUser(user.Id)

	if !active {
		if err := a.RevokeAllSessions(c, ruser.Id); err != nil {
			return nil, err
		}
		if err := a.userDeactivated(c, ruser.Id); err != nil {
			return nil, err
		}
	}

	if appErr := a.invalidateUserChannelMembersCaches(c, user.Id); appErr != nil {
		c.Logger().Warn("Error while invalidating user channel members caches", mlog.Err(appErr))
	}
	a.sendUpdatedUserEvent(ruser)

	if !active && user.DeleteAt != 0 {
		a.Srv().Go(func() {
			pluginContext := pluginContext(c)
			a.ch.RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
				hooks.UserHasBeenDeactivated(pluginContext, user)
				return true
			}, plugin.UserHasBeenDeactivatedID)
		})
	}

	if active {
		userLimits, appErr := a.GetServerLimits()
		if appErr != nil {
			c.Logger().Error("Error fetching user limits in UpdateActive", mlog.Err(appErr))
		} else {
			if userLimits.ActiveUserCount > userLimits.MaxUsersLimit {
				c.Logger().Warn("ERROR_SAFETY_LIMITS_EXCEEDED: Activated user exceeds the total active user limit.", mlog.Int("user_limit", userLimits.MaxUsersLimit))
			}
		}
	}

	return ruser, nil
}

func (a *App) DeactivateGuests(c request.CTX) *model.AppError {
	userIDs, err := a.ch.srv.userService.DeactivateAllGuests()
	if err != nil {
		return model.NewAppError("DeactivateGuests", "app.user.update_active_for_multiple_users.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, userID := range userIDs {
		if err := a.Srv().Platform().RevokeAllSessions(c, userID); err != nil {
			return model.NewAppError("DeactivateGuests", "app.user.update_active_for_multiple_users.updating.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	for _, userID := range userIDs {
		if err := a.userDeactivated(c, userID); err != nil {
			return err
		}
	}

	a.Srv().Store().Channel().ClearCaches()
	a.Srv().Store().User().ClearCaches()

	message := model.NewWebSocketEvent(model.WebsocketEventGuestsDeactivated, "", "", "", nil, "")
	a.Publish(message)

	return nil
}

func (a *App) GetSanitizeOptions(asAdmin bool) map[string]bool {
	return a.ch.srv.userService.GetSanitizeOptions(asAdmin)
}

func (a *App) SanitizeProfile(user *model.User, asAdmin bool) {
	options := a.ch.srv.userService.GetSanitizeOptions(asAdmin)

	user.SanitizeProfile(options, asAdmin)
}

func (a *App) UpdateUserAsUser(c request.CTX, user *model.User, asAdmin bool) (*model.User, *model.AppError) {
	updatedUser, err := a.UpdateUser(c, user, true)
	if err != nil {
		return nil, err
	}

	return updatedUser, nil
}

// CheckProviderAttributes returns the empty string if the patch can be applied without
// overriding attributes set by the user's login provider; otherwise, the name of the offending
// field is returned.
func (a *App) CheckProviderAttributes(c request.CTX, user *model.User, patch *model.UserPatch) string {
	tryingToChange := func(userValue *string, patchValue *string) bool {
		return patchValue != nil && *patchValue != *userValue
	}

	// If any login provider is used, then the username may not be changed
	if user.AuthService != "" && tryingToChange(&user.Username, patch.Username) {
		return "username"
	}

	LdapSettings := &a.Config().LdapSettings
	SamlSettings := &a.Config().SamlSettings

	conflictField := ""
	if a.Ldap() != nil &&
		(user.IsLDAPUser() || (user.IsSAMLUser() && *SamlSettings.EnableSyncWithLdap)) {
		conflictField = a.Ldap().CheckProviderAttributes(c, LdapSettings, user, patch)
	} else if a.Saml() != nil && user.IsSAMLUser() {
		conflictField = a.Saml().CheckProviderAttributes(c, SamlSettings, user, patch)
	} else if user.IsOAuthUser() {
		if tryingToChange(&user.FirstName, patch.FirstName) || tryingToChange(&user.LastName, patch.LastName) {
			conflictField = "full name"
		}
	}

	return conflictField
}

func (a *App) PatchUser(c request.CTX, userID string, patch *model.UserPatch, asAdmin bool) (*model.User, *model.AppError) {
	user, err := a.GetUser(userID)
	if err != nil {
		return nil, err
	}

	user.Patch(patch)

	updatedUser, err := a.UpdateUser(c, user, true)
	if err != nil {
		return nil, err
	}

	return updatedUser, nil
}

func (a *App) UpdateUserAuth(c request.CTX, userID string, userAuth *model.UserAuth) (*model.UserAuth, *model.AppError) {
	if _, err := a.Srv().Store().User().UpdateAuthData(userID, userAuth.AuthService, userAuth.AuthData, "", false); err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateUserAuth", "app.user.update_auth_data.email_exists.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateUserAuth", "app.user.update_auth_data.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.InvalidateCacheForUser(userID)

	return userAuth, nil
}

func (a *App) sendUpdatedUserEvent(user *model.User) {
	// exclude event creator user from admin, member user broadcast
	omitUsers := make(map[string]bool, 1)
	omitUsers[user.Id] = true

	// First, creating a base copy to avoid race conditions
	// from setting the binaryParamKey in userstore.Update.
	user = user.DeepCopy()
	// declare admin and unsanitized copy of user
	adminCopyOfUser := user.DeepCopy()
	unsanitizedCopyOfUser := user.DeepCopy()

	a.SanitizeProfile(adminCopyOfUser, true)
	adminMessage := model.NewWebSocketEvent(model.WebsocketEventUserUpdated, "", "", "", omitUsers, "")
	adminMessage.Add("user", adminCopyOfUser)
	adminMessage.GetBroadcast().ContainsSensitiveData = true
	a.Publish(adminMessage)

	a.SanitizeProfile(user, false)
	message := model.NewWebSocketEvent(model.WebsocketEventUserUpdated, "", "", "", omitUsers, "")
	message.Add("user", user)
	message.GetBroadcast().ContainsSanitizedData = true
	a.Publish(message)

	// send unsanitized user to event creator
	sourceUserMessage := model.NewWebSocketEvent(model.WebsocketEventUserUpdated, "", "", unsanitizedCopyOfUser.Id, nil, "")
	sourceUserMessage.Add("user", unsanitizedCopyOfUser)
	a.Publish(sourceUserMessage)
}

func (a *App) isUniqueToGroupNames(val string) *model.AppError {
	if val == "" {
		return nil
	}
	var notFoundErr *store.ErrNotFound
	group, err := a.Srv().Store().Group().GetByName(val, model.GroupSearchOpts{})
	if err != nil && !errors.As(err, &notFoundErr) {
		return model.NewAppError("isUniqueToGroupNames", "app.user.save.groupname.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if group != nil {
		return model.NewAppError("isUniqueToGroupNames", "app.user.save.username_exists.app_error", nil, fmt.Sprintf("group name %s exists", val), http.StatusBadRequest)
	}
	return nil
}

func (a *App) UpdateUser(c request.CTX, user *model.User, sendNotifications bool) (*model.User, *model.AppError) {
	prev, err := a.ch.srv.userService.GetUser(user.Id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateUser", MissingAccountError, nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateUser", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if prev.CreateAt != user.CreateAt {
		user.CreateAt = prev.CreateAt
	}

	if user.Username != prev.Username {
		if err := a.isUniqueToGroupNames(user.Username); err != nil {
			err.Where = "UpdateUser"
			return nil, err
		}
	}

	var newEmail string
	if user.Email != prev.Email {
		if !users.CheckUserDomain(user, *a.Config().TeamSettings.RestrictCreationToDomains) {
			if !prev.IsGuest() && !prev.IsLDAPUser() && !prev.IsSAMLUser() {
				return nil, model.NewAppError("UpdateUser", "api.user.update_user.accepted_domain.app_error", nil, "", http.StatusBadRequest)
			}
		}

		if !users.CheckUserDomain(user, *a.Config().GuestAccountsSettings.RestrictCreationToDomains) {
			if prev.IsGuest() && !prev.IsLDAPUser() && !prev.IsSAMLUser() {
				return nil, model.NewAppError("UpdateUser", "api.user.update_user.accepted_guest_domain.app_error", nil, "", http.StatusBadRequest)
			}
		}

		if *a.Config().EmailSettings.RequireEmailVerification {
			newEmail = user.Email
			// Don't set new eMail on user account if email verification is required, this will be done as a post-verification action
			// to avoid users being able to set non-controlled eMails as their account email
			if _, appErr := a.GetUserByEmail(newEmail); appErr == nil {
				return nil, model.NewAppError("UpdateUser", "app.user.save.email_exists.app_error", nil, "user_id="+user.Id, http.StatusBadRequest)
			}

			//  When a bot is created, prev.Email will be an autogenerated faked email,
			//  which will not match a CLI email input during bot to user conversions.
			//  To update a bot users email, do not set the email to the faked email
			//  stored in prev.Email.  Allow using the email defined in the CLI
			if !user.IsBot {
				user.Email = prev.Email
			}
		}
	}

	userUpdate, err := a.ch.srv.userService.UpdateUser(c, user, false)
	if err != nil {
		var appErr *model.AppError
		var invErr *store.ErrInvalidInput
		var conErr *store.ErrConflict
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateUser", "app.user.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		case errors.As(err, &conErr):
			if conErr.Resource == "Username" {
				return nil, model.NewAppError("UpdateUser", "app.user.save.username_exists.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			}
			return nil, model.NewAppError("UpdateUser", "app.user.save.email_exists.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateUser", "app.user.update.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	newUser := userUpdate.New

	if (newUser.Username != userUpdate.Old.Username) && (newUser.LastPictureUpdate <= 0) {
		// When a username is updated and the profile is still using a default profile picture, generate a new one based on their username
		if err := a.UpdateDefaultProfileImage(c, newUser); err != nil {
			c.Logger().Warn("Error with updating default profile image", mlog.Err(err))
		}

		tempUser, getUserErr := a.GetUser(user.Id)
		if getUserErr != nil {
			c.Logger().Warn("Error when retrieving user after profile picture update, avatar may fail to update automatically on client applications.", mlog.Err(getUserErr))
		} else {
			newUser = tempUser
		}
	}

	if sendNotifications {
		if newUser.Email != userUpdate.Old.Email || newEmail != "" {
			if *a.Config().EmailSettings.RequireEmailVerification {
				a.Srv().Go(func() {
					if err := a.SendEmailVerification(newUser, newEmail, ""); err != nil {
						c.Logger().Error("Failed to send email verification", mlog.Err(err))
					}
				})
			} else {
				a.Srv().Go(func() {
					if err := a.Srv().EmailService.SendEmailChangeEmail(userUpdate.Old.Email, newUser.Email, newUser.Locale, a.GetSiteURL()); err != nil {
						c.Logger().Error("Failed to send email change email", mlog.Err(err))
					}
				})
			}
		}

		if newUser.Username != userUpdate.Old.Username {
			a.Srv().Go(func() {
				if err := a.Srv().EmailService.SendChangeUsernameEmail(newUser.Username, newUser.Email, newUser.Locale, a.GetSiteURL()); err != nil {
					c.Logger().Error("Failed to send change username email", mlog.Err(err))
				}
			})
		}
		a.sendUpdatedUserEvent(newUser)
	}

	a.InvalidateCacheForUser(user.Id)
	a.onUserProfileChange(user.Id)

	newUser.Sanitize(map[string]bool{})

	return newUser, nil
}

func (a *App) UpdateUserActive(c request.CTX, userID string, active bool) *model.AppError {
	user, err := a.GetUser(userID)
	if err != nil {
		return err
	}
	if _, err = a.UpdateActive(c, user, active); err != nil {
		return err
	}

	return nil
}

func (a *App) updateUserNotifyProps(userID string, props map[string]string) *model.AppError {
	err := a.ch.srv.userService.UpdateUserNotifyProps(userID, props)
	if err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return appErr
		default:
			return model.NewAppError("UpdateUser", "app.user.update.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	a.InvalidateCacheForUser(userID)
	a.onUserProfileChange(userID)

	return nil
}

func (a *App) UpdateMfa(c request.CTX, activate bool, userID, token string) *model.AppError {
	if activate {
		if err := a.ActivateMfa(userID, token); err != nil {
			return err
		}
	} else {
		if err := a.DeactivateMfa(userID); err != nil {
			return err
		}
	}

	a.Srv().Go(func() {
		user, err := a.GetUser(userID)
		if err != nil {
			c.Logger().Error("Failed to get user", mlog.Err(err))
			return
		}

		if err := a.Srv().EmailService.SendMfaChangeEmail(user.Email, activate, user.Locale, a.GetSiteURL()); err != nil {
			c.Logger().Error("Failed to send mfa change email", mlog.Err(err))
		}
	})

	return nil
}

func (a *App) UpdatePasswordByUserIdSendEmail(c request.CTX, userID, newPassword, method string) *model.AppError {
	user, err := a.GetUser(userID)
	if err != nil {
		return err
	}

	return a.UpdatePasswordSendEmail(c, user, newPassword, method)
}

func (a *App) UpdatePassword(rctx request.CTX, user *model.User, newPassword string) *model.AppError {
	if err := a.IsPasswordValid(rctx, newPassword); err != nil {
		return err
	}

	// remote/synthetic users cannot update password via any mechanism
	if user.IsRemote() {
		return model.NewAppError("UpdatePassword", "api.user.update_password.failed.app_error", nil, "", http.StatusInternalServerError)
	}

	hashedPassword, err := model.HashPassword(newPassword)
	if err != nil {
		// can't be password length (checked in IsPasswordValid)
		return model.NewAppError("UpdatePassword", "api.user.update_password.password_hash.app_error", nil, "user_id="+user.Id, http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().User().UpdatePassword(user.Id, hashedPassword); err != nil {
		return model.NewAppError("UpdatePassword", "api.user.update_password.failed.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.InvalidateCacheForUser(user.Id)

	if *a.Config().ServiceSettings.TerminateSessionsOnPasswordChange {
		// Get currently active sessions if request is user-initiated to retain it
		currentSession := ""
		if rctx.Session() != nil && rctx.Session().UserId == user.Id {
			currentSession = rctx.Session().Id
		}

		sessions, err := a.GetSessions(rctx, user.Id)
		if err != nil {
			return model.NewAppError("UpdatePassword", "api.user.update_password.failed.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		// Revoke all but current session
		for _, session := range sessions {
			if session.Id == currentSession {
				continue
			}

			err := a.RevokeSessionById(rctx, session.Id)
			if err != nil {
				return model.NewAppError("UpdatePassword", "api.user.update_password.failed.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	}

	return nil
}

func (a *App) UpdatePasswordSendEmail(c request.CTX, user *model.User, newPassword, method string) *model.AppError {
	if err := a.UpdatePassword(c, user, newPassword); err != nil {
		return err
	}

	a.Srv().Go(func() {
		if err := a.Srv().EmailService.SendPasswordChangeEmail(user.Email, method, user.Locale, a.GetSiteURL()); err != nil {
			c.Logger().Error("Failed to send password change email", mlog.Err(err))
		}
	})

	return nil
}

func (a *App) UpdateHashedPasswordByUserId(userID, newHashedPassword string) *model.AppError {
	user, err := a.GetUser(userID)
	if err != nil {
		return err
	}

	return a.UpdateHashedPassword(user, newHashedPassword)
}

func (a *App) UpdateHashedPassword(user *model.User, newHashedPassword string) *model.AppError {
	// remote/synthetic users cannot update password via any mechanism
	if user.IsRemote() {
		return model.NewAppError("UpdatePassword", "api.user.update_password.failed.app_error", nil, "", http.StatusInternalServerError)
	}

	if err := a.Srv().Store().User().UpdatePassword(user.Id, newHashedPassword); err != nil {
		return model.NewAppError("UpdatePassword", "api.user.update_password.failed.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.InvalidateCacheForUser(user.Id)

	return nil
}

func (a *App) ResetPasswordFromToken(c request.CTX, userSuppliedTokenString, newPassword string) *model.AppError {
	return a.resetPasswordFromToken(c, userSuppliedTokenString, newPassword, model.GetMillis())
}

func (a *App) resetPasswordFromToken(c request.CTX, userSuppliedTokenString, newPassword string, nowMilli int64) *model.AppError {
	token, err := a.GetPasswordRecoveryToken(userSuppliedTokenString)
	if err != nil {
		return err
	}
	if nowMilli-token.CreateAt >= PasswordRecoverExpiryTime {
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

	// don't allow password reset for remote/synthetic users
	if user.IsRemote() {
		return model.NewAppError("resetPassword", "api.user.reset_password.broken_token.app_error", nil, "", http.StatusBadRequest)
	}

	T := i18n.GetUserTranslations(user.Locale)

	if err := a.UpdatePasswordSendEmail(c, user, newPassword, T("api.user.reset_password.method")); err != nil {
		return err
	}

	if err := a.DeleteToken(token); err != nil {
		c.Logger().Warn("Failed to delete token", mlog.Err(err))
	}

	return nil
}

func (a *App) SendPasswordReset(rctx request.CTX, email string, siteURL string) (bool, *model.AppError) {
	user, err := a.GetUserByEmail(email)
	if err != nil {
		return false, nil
	}

	// don't allow password reset for remote/synthetic users
	if user.IsRemote() {
		return false, model.NewAppError("SendPasswordReset", "api.user.send_password_reset.send.app_error", nil, "userId="+user.Id, http.StatusBadRequest)
	}

	if user.AuthData != nil && *user.AuthData != "" {
		return false, model.NewAppError("SendPasswordReset", "api.user.send_password_reset.sso.app_error", nil, "userId="+user.Id, http.StatusBadRequest)
	}

	token, err := a.CreatePasswordRecoveryToken(rctx, user.Id, user.Email)
	if err != nil {
		return false, err
	}

	result, eErr := a.Srv().EmailService.SendPasswordResetEmail(user.Email, token, user.Locale, siteURL)
	if eErr != nil {
		return result, model.NewAppError("SendPasswordReset", "api.user.send_password_reset.send.app_error", nil, "", http.StatusInternalServerError).Wrap(eErr)
	}

	return result, nil
}

func (a *App) CreatePasswordRecoveryToken(rctx request.CTX, userID, email string) (*model.Token, *model.AppError) {
	tokenExtra := struct {
		UserId string
		Email  string
	}{
		userID,
		email,
	}
	jsonData, err := json.Marshal(tokenExtra)
	if err != nil {
		return nil, model.NewAppError("CreatePasswordRecoveryToken", "api.user.create_password_token.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// remove any previously created tokens for user
	appErr := a.InvalidatePasswordRecoveryTokensForUser(userID)
	if appErr != nil {
		rctx.Logger().Warn("Error while deleting additional user tokens.", mlog.Err(err))
	}

	token := model.NewToken(TokenTypePasswordRecovery, string(jsonData))
	if err := a.Srv().Store().Token().Save(token); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreatePasswordRecoveryToken", "app.recover.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return token, nil
}

func (a *App) InvalidatePasswordRecoveryTokensForUser(userID string) *model.AppError {
	tokens, err := a.Srv().Store().Token().GetAllTokensByType(TokenTypePasswordRecovery)
	if err != nil {
		return model.NewAppError("InvalidatePasswordRecoveryTokensForUser", "api.user.invalidate_password_recovery_tokens.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var appErr *model.AppError
	for _, token := range tokens {
		tokenExtra := struct {
			UserId string
			Email  string
		}{}
		if err := json.Unmarshal([]byte(token.Extra), &tokenExtra); err != nil {
			appErr = model.NewAppError("InvalidatePasswordRecoveryTokensForUser", "api.user.invalidate_password_recovery_tokens_parse.error", nil, "", http.StatusInternalServerError).Wrap(err)
			continue
		}

		if tokenExtra.UserId != userID {
			continue
		}

		if err := a.Srv().Store().Token().Delete(token.Token); err != nil {
			appErr = model.NewAppError("InvalidatePasswordRecoveryTokensForUser", "api.user.invalidate_password_recovery_tokens_delete.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return appErr
}

func (a *App) GetPasswordRecoveryToken(token string) (*model.Token, *model.AppError) {
	rtoken, err := a.Srv().Store().Token().GetByToken(token)
	if err != nil {
		return nil, model.NewAppError("GetPasswordRecoveryToken", "api.user.reset_password.invalid_link.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	if rtoken.Type != TokenTypePasswordRecovery {
		return nil, model.NewAppError("GetPasswordRecoveryToken", "api.user.reset_password.broken_token.app_error", nil, "", http.StatusBadRequest)
	}
	return rtoken, nil
}

func (a *App) GetTokenById(token string) (*model.Token, *model.AppError) {
	rtoken, err := a.Srv().Store().Token().GetByToken(token)
	if err != nil {
		var status int

		switch err.(type) {
		case *store.ErrNotFound:
			status = http.StatusNotFound
		default:
			status = http.StatusInternalServerError
		}

		return nil, model.NewAppError("GetTokenById", "api.user.create_user.signup_link_invalid.app_error", nil, "", status).Wrap(err)
	}

	return rtoken, nil
}

func (a *App) DeleteToken(token *model.Token) *model.AppError {
	err := a.Srv().Store().Token().Delete(token.Token)
	if err != nil {
		return model.NewAppError("DeleteToken", "app.recover.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (a *App) UpdateUserRoles(c request.CTX, userID string, newRoles string, sendWebSocketEvent bool) (*model.User, *model.AppError) {
	user, err := a.GetUser(userID)
	if err != nil {
		err.StatusCode = http.StatusBadRequest
		return nil, err
	}

	return a.UpdateUserRolesWithUser(c, user, newRoles, sendWebSocketEvent)
}

func (a *App) UpdateUserRolesWithUser(c request.CTX, user *model.User, newRoles string, sendWebSocketEvent bool) (*model.User, *model.AppError) {
	if err := a.CheckRolesExist(strings.Fields(newRoles)); err != nil {
		return nil, err
	}

	if user.IsSystemAdmin() && !strings.Contains(newRoles, model.SystemAdminRoleId) {
		// if user being updated is SysAdmin, make sure its not the last one.
		options := model.UserCountOptions{
			IncludeBotAccounts: false,
			Roles:              []string{model.SystemAdminRoleId},
		}
		count, err := a.Srv().Store().User().Count(options)
		if err != nil {
			return nil, model.NewAppError("UpdateUserRoles", "app.user.update.countAdmins.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		if count <= 1 {
			return nil, model.NewAppError("UpdateUserRoles", "app.user.update.lastAdmin.app_error", nil, "", http.StatusBadRequest)
		}
	}

	user.Roles = newRoles
	uchan := make(chan store.StoreResult[*model.UserUpdate], 1)
	go func() {
		userUpdate, err := a.Srv().Store().User().Update(c, user, true)
		uchan <- store.StoreResult[*model.UserUpdate]{Data: userUpdate, NErr: err}
		close(uchan)
	}()

	schan := make(chan store.StoreResult[string], 1)
	go func() {
		id, err := a.Srv().Store().Session().UpdateRoles(user.Id, newRoles)
		schan <- store.StoreResult[string]{Data: id, NErr: err}
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
			return nil, model.NewAppError("UpdateUserRoles", "app.user.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(result.NErr)
		default:
			return nil, model.NewAppError("UpdateUserRoles", "app.user.update.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
	}
	ruser := result.Data.New

	if result := <-schan; result.NErr != nil {
		// soft error since the user roles were still updated
		c.Logger().Warn("Failed during updating user roles", mlog.Err(result.NErr))
	}

	a.InvalidateCacheForUser(user.Id)
	a.ClearSessionCacheForUser(user.Id)

	if sendWebSocketEvent {
		message := model.NewWebSocketEvent(model.WebsocketEventUserRoleUpdated, "", "", user.Id, nil, "")
		message.Add("user_id", user.Id)
		message.Add("roles", newRoles)
		a.Publish(message)
	}

	return ruser, nil
}

func (a *App) PermanentDeleteUser(rctx request.CTX, user *model.User) *model.AppError {
	rctx.Logger().Warn("Attempting to permanently delete account", mlog.String("user_id", user.Id), mlog.String("user_email", user.Email))
	if user.IsInRole(model.SystemAdminRoleId) {
		rctx.Logger().Warn("You are deleting a user that is a system administrator.  You may need to set another account as the system administrator using the command line tools.", mlog.String("user_email", user.Email))
	}

	if _, err := a.UpdateActive(rctx, user, false); err != nil {
		return err
	}

	if err := a.Srv().Store().Session().PermanentDeleteSessionsByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.session.permanent_delete_sessions_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().UserAccessToken().DeleteAllForUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.user_access_token.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().OAuth().PermanentDeleteAuthDataByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.oauth.permanent_delete_auth_data_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Webhook().PermanentDeleteIncomingByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.webhooks.permanent_delete_incoming_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Webhook().PermanentDeleteOutgoingByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.webhooks.permanent_delete_outgoing_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Command().PermanentDeleteByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.user.permanentdeleteuser.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Preference().PermanentDeleteByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.preference.permanent_delete_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Channel().PermanentDeleteMembersByUser(rctx, user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.channel.permanent_delete_members_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Group().PermanentDeleteMembersByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.group.permanent_delete_members_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Post().PermanentDeleteByUser(rctx, user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.post.permanent_delete_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Reaction().PermanentDeleteByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.reaction.permanent_delete_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().ScheduledPost().PermanentDeleteByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.scheduled_post.permanent_delete_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Draft().PermanentDeleteByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.drafts.permanent_delete_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Bot().PermanentDelete(user.Id); err != nil {
		var invErr *store.ErrInvalidInput
		switch {
		case errors.As(err, &invErr):
			return model.NewAppError("PermanentDeleteUser", "app.bot.permenent_delete.bad_id", map[string]any{"user_id": invErr.Value}, "", http.StatusBadRequest).Wrap(err)
		default: // last fallback in case it doesn't map to an existing app error.
			return model.NewAppError("PermanentDeleteUser", "app.bot.permanent_delete.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	infos, err := a.Srv().Store().FileInfo().GetForUser(user.Id)
	if err != nil {
		rctx.Logger().Warn("Error getting file list for user from FileInfoStore", mlog.Err(err))
	}

	a.RemoveFilesFromFileStore(rctx, infos)

	// delete directory containing user's profile image
	profileImageDirectory := getProfileImageDirectory(user.Id)
	profileImagePath := getProfileImagePath(user.Id)
	resProfileImageExists, errProfileImageExists := a.FileExists(profileImagePath)

	fileHandlingErrorsFound := false

	if errProfileImageExists != nil {
		fileHandlingErrorsFound = true
		rctx.Logger().Warn(
			"Error checking existence of profile image.",
			mlog.String("path", profileImagePath),
			mlog.Err(errProfileImageExists),
		)
	}

	if resProfileImageExists {
		errRemoveDirectory := a.RemoveDirectory(profileImageDirectory)

		if errRemoveDirectory != nil {
			fileHandlingErrorsFound = true
			rctx.Logger().Warn(
				"Unable to remove profile image directory",
				mlog.String("path", profileImageDirectory),
				mlog.Err(errRemoveDirectory),
			)
		}
	}

	if _, err := a.Srv().Store().FileInfo().PermanentDeleteByUser(rctx, user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.file_info.permanent_delete_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().User().PermanentDelete(rctx, user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.user.permanent_delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Audit().PermanentDeleteByUser(user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.audit.permanent_delete_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if err := a.Srv().Store().Team().RemoveAllMembersByUser(rctx, user.Id); err != nil {
		return model.NewAppError("PermanentDeleteUser", "app.team.remove_member.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.InvalidateCacheForUser(user.Id)

	if fileHandlingErrorsFound {
		return model.NewAppError("PermanentDeleteUser", "app.file_info.permanent_delete_by_user.app_error", nil, "Couldn't delete profile image of the user.", http.StatusAccepted)
	}

	rctx.Logger().Warn("Permanently deleted account", mlog.String("user_email", user.Email), mlog.String("user_id", user.Id))

	return nil
}

func (a *App) PermanentDeleteAllUsers(c request.CTX) *model.AppError {
	users, err := a.Srv().Store().User().GetAll()
	if err != nil {
		return model.NewAppError("PermanentDeleteAllUsers", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for _, user := range users {
		if appErr := a.PermanentDeleteUser(c, user); appErr != nil {
			c.Logger().Warn("Error while deleting user", mlog.Err(appErr))
		}
	}

	return nil
}

func (a *App) SendEmailVerification(user *model.User, newEmail, redirect string) *model.AppError {
	token, err := a.Srv().EmailService.CreateVerifyEmailToken(user.Id, newEmail)
	if err != nil {
		switch {
		case errors.Is(err, email.CreateEmailTokenError):
			return model.NewAppError("CreateVerifyEmailToken", "api.user.create_email_token.error", nil, "", http.StatusInternalServerError)
		default:
			return model.NewAppError("CreateVerifyEmailToken", "app.recover.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if _, err := a.GetStatus(user.Id); err != nil {
		if err.StatusCode != http.StatusNotFound {
			return err
		}
		eErr := a.Srv().EmailService.SendVerifyEmail(newEmail, user.Locale, a.GetSiteURL(), token.Token, redirect)
		if eErr != nil {
			return model.NewAppError("SendVerifyEmail", "api.user.send_verify_email_and_forget.failed.error", nil, "", http.StatusInternalServerError).Wrap(eErr)
		}

		return nil
	}

	if err := a.Srv().EmailService.SendEmailChangeVerifyEmail(newEmail, user.Locale, a.GetSiteURL(), token.Token); err != nil {
		return model.NewAppError("sendEmailChangeVerifyEmail", "api.user.send_email_change_verify_email_and_forget.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) VerifyEmailFromToken(c request.CTX, userSuppliedTokenString string) *model.AppError {
	token, err := a.GetVerifyEmailToken(userSuppliedTokenString)
	if err != nil {
		return err
	}
	if model.GetMillis()-token.CreateAt >= PasswordRecoverExpiryTime {
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
			if err := a.Srv().EmailService.SendEmailChangeEmail(user.Email, tokenData.Email, user.Locale, a.GetSiteURL()); err != nil {
				c.Logger().Error("Failed to send email change email", mlog.Err(err))
			}
		})
	}

	if err := a.DeleteToken(token); err != nil {
		c.Logger().Warn("Failed to delete token", mlog.Err(err))
	}

	return nil
}

func (a *App) GetVerifyEmailToken(token string) (*model.Token, *model.AppError) {
	rtoken, err := a.Srv().Store().Token().GetByToken(token)
	if err != nil {
		return nil, model.NewAppError("GetVerifyEmailToken", "api.user.verify_email.bad_link.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	if rtoken.Type != TokenTypeVerifyEmail {
		return nil, model.NewAppError("GetVerifyEmailToken", "api.user.verify_email.broken_token.app_error", nil, "", http.StatusBadRequest)
	}
	return rtoken, nil
}

// GetTotalUsersStats is used for the DM list total
func (a *App) GetTotalUsersStats(viewRestrictions *model.ViewUsersRestrictions) (*model.UsersStats, *model.AppError) {
	count, err := a.Srv().Store().User().Count(model.UserCountOptions{
		IncludeBotAccounts: true,
		ViewRestrictions:   viewRestrictions,
	})
	if err != nil {
		return nil, model.NewAppError("GetTotalUsersStats", "app.user.get_total_users_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	stats := &model.UsersStats{
		TotalUsersCount: count,
	}
	return stats, nil
}

// GetFilteredUsersStats is used to get a count of users based on the set of filters supported by UserCountOptions.
func (a *App) GetFilteredUsersStats(options *model.UserCountOptions) (*model.UsersStats, *model.AppError) {
	count, err := a.Srv().Store().User().Count(*options)
	if err != nil {
		return nil, model.NewAppError("GetFilteredUsersStats", "app.user.get_total_users_count.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	stats := &model.UsersStats{
		TotalUsersCount: count,
	}
	return stats, nil
}

func (a *App) VerifyUserEmail(userID, email string) *model.AppError {
	if _, err := a.Srv().Store().User().VerifyEmail(userID, email); err != nil {
		return model.NewAppError("VerifyUserEmail", "app.user.verify_email.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.InvalidateCacheForUser(userID)

	user, err := a.GetUser(userID)
	if err != nil {
		return err
	}

	a.sendUpdatedUserEvent(user)

	return nil
}

func (a *App) SearchUsers(rctx request.CTX, props *model.UserSearch, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
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
	if props.NotInGroupId != "" {
		return a.SearchUsersNotInGroup(props.NotInGroupId, props.Term, options)
	}
	return a.SearchUsersInTeam(rctx, props.TeamId, props.Term, options)
}

func (a *App) SearchUsersInChannel(channelID string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)
	users, err := a.Srv().Store().User().SearchInChannel(channelID, term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersInChannel", "app.user.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersNotInChannel(teamID string, channelID string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)

	ctx := request.EmptyContext(a.Log())
	if ok, err := a.ChannelAccessControlled(ctx, channelID); err != nil {
		return nil, err
	} else if ok {
		acs := a.Srv().Channels().AccessControl
		if acs != nil {
			users, _, appErr := acs.QueryUsersForResource(ctx, channelID, "*", model.SubjectSearchOptions{
				Term:   term,
				TeamID: teamID,
				Limit:  options.Limit,
			})
			if appErr != nil {
				return nil, appErr
			}

			return users, nil
		}
	}

	users, err := a.Srv().Store().User().SearchNotInChannel(teamID, channelID, term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersNotInChannel", "app.user.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersInTeam(rctx request.CTX, teamID, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)

	users, err := a.Srv().Store().User().Search(rctx, teamID, term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersInTeam", "app.user.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersNotInTeam(notInTeamId string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)
	users, err := a.Srv().Store().User().SearchNotInTeam(notInTeamId, term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersNotInTeam", "app.user.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersWithoutTeam(term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)
	users, err := a.Srv().Store().User().SearchWithoutTeam(term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersWithoutTeam", "app.user.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersInGroup(groupID string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)
	users, err := a.Srv().Store().User().SearchInGroup(groupID, term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersInGroup", "app.user.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) SearchUsersNotInGroup(groupID string, term string, options *model.UserSearchOptions) ([]*model.User, *model.AppError) {
	term = strings.TrimSpace(term)
	users, err := a.Srv().Store().User().SearchNotInGroup(groupID, term, options)
	if err != nil {
		return nil, model.NewAppError("SearchUsersNotInGroup", "app.user.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return users, nil
}

func (a *App) AutocompleteUsersInChannel(rctx request.CTX, teamID string, channelID string, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInChannel, *model.AppError) {
	term = strings.TrimSpace(term)

	autocomplete, err := a.Srv().Store().User().AutocompleteUsersInChannel(rctx, teamID, channelID, term, options)
	if err != nil {
		return nil, model.NewAppError("AutocompleteUsersInChannel", "app.user.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, user := range autocomplete.InChannel {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	for _, user := range autocomplete.OutOfChannel {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	return autocomplete, nil
}

func (a *App) AutocompleteUsersInTeam(rctx request.CTX, teamID string, term string, options *model.UserSearchOptions) (*model.UserAutocompleteInTeam, *model.AppError) {
	term = strings.TrimSpace(term)

	users, err := a.Srv().Store().User().Search(rctx, teamID, term, options)
	if err != nil {
		return nil, model.NewAppError("AutocompleteUsersInTeam", "app.user.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, user := range users {
		a.SanitizeProfile(user, options.IsAdmin)
	}

	autocomplete := &model.UserAutocompleteInTeam{}
	autocomplete.InTeam = users
	return autocomplete, nil
}

func (a *App) UpdateOAuthUserAttrs(c request.CTX, userData io.Reader, user *model.User, provider einterfaces.OAuthProvider, service string, tokenUser *model.User) *model.AppError {
	oauthUser, err1 := provider.GetUserFromJSON(c, userData, tokenUser)
	if err1 != nil {
		return model.NewAppError("UpdateOAuthUserAttrs", "api.user.update_oauth_user_attrs.get_user.app_error", map[string]any{"Service": service}, "", http.StatusBadRequest).Wrap(err1)
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
		users, err := a.Srv().Store().User().Update(c, user, true)
		if err != nil {
			var appErr *model.AppError
			var invErr *store.ErrInvalidInput
			switch {
			case errors.As(err, &appErr):
				return appErr
			case errors.As(err, &invErr):
				return model.NewAppError("UpdateOAuthUserAttrs", "app.user.update.find.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			default:
				return model.NewAppError("UpdateOAuthUserAttrs", "app.user.update.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}

		user = users.New
		a.InvalidateCacheForUser(user.Id)
	}

	return nil
}

func (a *App) RestrictUsersGetByPermissions(c request.CTX, userID string, options *model.UserGetOptions) (*model.UserGetOptions, *model.AppError) {
	restrictions, err := a.GetViewUsersRestrictions(c, userID)
	if err != nil {
		return nil, err
	}

	options.ViewRestrictions = restrictions
	return options, nil
}

// FilterNonGroupTeamMembers returns the subset of the given user IDs of the users who are not members of groups
// associated to the team excluding bots.
func (a *App) FilterNonGroupTeamMembers(userIDs []string, team *model.Team) ([]string, error) {
	teamGroupUsers, err := a.GetTeamGroupUsers(team.Id)
	if err != nil {
		return nil, err
	}
	return a.filterNonGroupUsers(userIDs, teamGroupUsers)
}

// FilterNonGroupChannelMembers returns the subset of the given user IDs of the users who are not members of groups
// associated to the channel excluding bots
func (a *App) FilterNonGroupChannelMembers(userIDs []string, channel *model.Channel) ([]string, error) {
	channelGroupUsers, err := a.GetChannelGroupUsers(channel.Id)
	if err != nil {
		return nil, err
	}
	return a.filterNonGroupUsers(userIDs, channelGroupUsers)
}

// filterNonGroupUsers is a helper function that takes a list of user ids and a list of users
// and returns the list of normal users present in userIDs but not in groupUsers.
func (a *App) filterNonGroupUsers(userIDs []string, groupUsers []*model.User) ([]string, error) {
	nonMemberIds := []string{}
	users, err := a.Srv().Store().User().GetProfileByIds(context.Background(), userIDs, nil, false)
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

func (a *App) RestrictUsersSearchByPermissions(c request.CTX, userID string, options *model.UserSearchOptions) (*model.UserSearchOptions, *model.AppError) {
	restrictions, err := a.GetViewUsersRestrictions(c, userID)
	if err != nil {
		return nil, err
	}

	options.ViewRestrictions = restrictions
	return options, nil
}

func (a *App) UserCanSeeOtherUser(c request.CTX, userID string, otherUserId string) (bool, *model.AppError) {
	if userID == otherUserId {
		return true, nil
	}

	restrictions, err := a.GetViewUsersRestrictions(c, userID)
	if err != nil {
		return false, err
	}

	if restrictions == nil {
		return true, nil
	}

	if len(restrictions.Teams) > 0 {
		result, err := a.Srv().Store().Team().UserBelongsToTeams(otherUserId, restrictions.Teams)
		if err != nil {
			return false, model.NewAppError("UserCanSeeOtherUser", "app.team.user_belongs_to_teams.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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

func (a *App) userBelongsToChannels(userID string, channelIDs []string) (bool, *model.AppError) {
	belongs, err := a.Srv().Store().Channel().UserBelongsToChannels(userID, channelIDs)
	if err != nil {
		return false, model.NewAppError("userBelongsToChannels", "app.channel.user_belongs_to_channels.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return belongs, nil
}

func (a *App) GetViewUsersRestrictions(c request.CTX, userID string) (*model.ViewUsersRestrictions, *model.AppError) {
	if a.HasPermissionTo(userID, model.PermissionViewMembers) {
		return nil, nil
	}

	teamIDs, nErr := a.Srv().Store().Team().GetUserTeamIds(userID, true)
	if nErr != nil {
		return nil, model.NewAppError("GetViewUsersRestrictions", "app.team.get_user_team_ids.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	teamIDsWithPermission := []string{}
	for _, teamID := range teamIDs {
		if a.HasPermissionToTeam(c, userID, teamID, model.PermissionViewMembers) {
			teamIDsWithPermission = append(teamIDsWithPermission, teamID)
		}
	}

	userChannelMembers, err := a.Srv().Store().Channel().GetAllChannelMembersForUser(c, userID, true, true)
	if err != nil {
		return nil, model.NewAppError("GetViewUsersRestrictions", "app.channel.get_channels.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	channelIDs := []string{}
	for channelID := range userChannelMembers {
		channelIDs = append(channelIDs, channelID)
	}

	return &model.ViewUsersRestrictions{Teams: teamIDsWithPermission, Channels: channelIDs}, nil
}

// PromoteGuestToUser Convert user's roles and all his membership's roles from
// guest roles to regular user roles.
func (a *App) PromoteGuestToUser(c request.CTX, user *model.User, requestorId string) *model.AppError {
	nErr := a.ch.srv.userService.PromoteGuestToUser(user)
	a.InvalidateCacheForUser(user.Id)
	if nErr != nil {
		return model.NewAppError("PromoteGuestToUser", "app.user.promote_guest.user_update.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	userTeams, nErr := a.Srv().Store().Team().GetTeamsByUserId(user.Id)
	if nErr != nil {
		return model.NewAppError("PromoteGuestToUser", "app.team.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	for _, team := range userTeams {
		// Soft error if there is an issue joining the default channels
		if err := a.JoinDefaultChannels(c, team.Id, user, false, requestorId); err != nil {
			c.Logger().Warn("Failed to join default channels", mlog.String("user_id", user.Id), mlog.String("team_id", team.Id), mlog.String("requestor_id", requestorId), mlog.Err(err))
		}
	}

	promotedUser, err := a.GetUser(user.Id)
	if err != nil {
		c.Logger().Warn("Failed to get user on promote guest to user", mlog.Err(err))
	} else {
		a.sendUpdatedUserEvent(promotedUser)
		if uErr := a.ch.srv.platform.UpdateSessionsIsGuest(c, promotedUser, promotedUser.IsGuest()); uErr != nil {
			c.Logger().Warn("Unable to update user sessions", mlog.String("user_id", promotedUser.Id), mlog.Err(uErr))
		}
	}

	teamMembers, err := a.GetTeamMembersForUser(c, user.Id, "", true)
	if err != nil {
		c.Logger().Warn("Failed to get team members for user on promote guest to user", mlog.Err(err))
	}

	for _, member := range teamMembers {
		if appErr := a.sendUpdatedTeamMemberEvent(member); appErr != nil {
			c.Logger().Warn("Error while sending updated team member event", mlog.Err(appErr))
		}

		channelMembers, appErr := a.GetChannelMembersForUser(c, member.TeamId, user.Id)
		if appErr != nil {
			c.Logger().Warn("Failed to get channel members for user on promote guest to user", mlog.Err(appErr))
		}

		for _, member := range channelMembers {
			a.invalidateCacheForChannelMembers(member.ChannelId)

			evt := model.NewWebSocketEvent(model.WebsocketEventChannelMemberUpdated, "", "", user.Id, nil, "")
			memberJSON, jsonErr := json.Marshal(member)
			if jsonErr != nil {
				return model.NewAppError("PromoteGuestToUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
			}
			evt.Add("channelMember", string(memberJSON))
			a.Publish(evt)
		}
	}

	a.ClearSessionCacheForUser(user.Id)
	return nil
}

// DemoteUserToGuest Convert user's roles and all his membership's roles from
// regular user roles to guest roles.
func (a *App) DemoteUserToGuest(c request.CTX, user *model.User) *model.AppError {
	demotedUser, nErr := a.ch.srv.userService.DemoteUserToGuest(user)
	a.InvalidateCacheForUser(user.Id)
	if nErr != nil {
		return model.NewAppError("DemoteUserToGuest", "app.user.demote_user_to_guest.user_update.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	a.sendUpdatedUserEvent(demotedUser)
	if uErr := a.ch.srv.platform.UpdateSessionsIsGuest(c, demotedUser, demotedUser.IsGuest()); uErr != nil {
		c.Logger().Warn("Unable to update user sessions", mlog.String("user_id", demotedUser.Id), mlog.Err(uErr))
	}

	teamMembers, err := a.GetTeamMembersForUser(c, user.Id, "", true)
	if err != nil {
		c.Logger().Warn("Failed to get team members for users on demote user to guest", mlog.Err(err))
	}

	for _, member := range teamMembers {
		if appErr := a.sendUpdatedTeamMemberEvent(member); appErr != nil {
			c.Logger().Warn("Error while sending updated team member event", mlog.Err(appErr))
		}

		channelMembers, appErr := a.GetChannelMembersForUser(c, member.TeamId, user.Id)
		if appErr != nil {
			c.Logger().Warn("Failed to get channel members for users on demote user to guest", mlog.Err(appErr))
			continue
		}

		for _, member := range channelMembers {
			a.invalidateCacheForChannelMembers(member.ChannelId)

			evt := model.NewWebSocketEvent(model.WebsocketEventChannelMemberUpdated, "", "", user.Id, nil, "")
			memberJSON, jsonErr := json.Marshal(member)
			if jsonErr != nil {
				return model.NewAppError("DemoteUserToGuest", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
			}
			evt.Add("channelMember", string(memberJSON))
			a.Publish(evt)
		}
	}

	a.ClearSessionCacheForUser(user.Id)
	return nil
}

func (a *App) PublishUserTyping(userID, channelID, parentId string) *model.AppError {
	omitUsers := make(map[string]bool, 1)
	omitUsers[userID] = true

	event := model.NewWebSocketEvent(model.WebsocketEventTyping, "", channelID, "", omitUsers, "")
	event.Add("parent_id", parentId)
	event.Add("user_id", userID)
	a.Publish(event)

	return nil
}

// invalidateUserCacheAndPublish Invalidates cache for a user and publishes user updated event
func (a *App) invalidateUserCacheAndPublish(rctx request.CTX, userID string) {
	a.InvalidateCacheForUser(userID)

	user, userErr := a.GetUser(userID)
	if userErr != nil {
		rctx.Logger().Error("Error in getting users profile", mlog.String("user_id", userID), mlog.Err(userErr))
		return
	}

	options := a.Config().GetSanitizeOptions()
	user.SanitizeProfile(options, false)

	message := model.NewWebSocketEvent(model.WebsocketEventUserUpdated, "", "", "", nil, "")
	message.Add("user", user)
	a.Publish(message)
}

// GetKnownUsers returns the list of user ids of users with any direct
// relationship with a user. That means any user sharing any channel, including
// direct and group channels.
func (a *App) GetKnownUsers(userID string) ([]string, *model.AppError) {
	users, err := a.Srv().Store().User().GetKnownUsers(userID)
	if err != nil {
		return nil, model.NewAppError("GetKnownUsers", "app.user.get_known_users.get_users.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

// ConvertBotToUser converts a bot to user.
func (a *App) ConvertBotToUser(c request.CTX, bot *model.Bot, userPatch *model.UserPatch, sysadmin bool) (*model.User, *model.AppError) {
	user, nErr := a.Srv().Store().User().Get(c.Context(), bot.UserId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("ConvertBotToUser", MissingAccountError, nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("ConvertBotToUser", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	if sysadmin && !user.IsInRole(model.SystemAdminRoleId) {
		_, appErr := a.UpdateUserRoles(c,
			user.Id,
			fmt.Sprintf("%s %s", user.Roles, model.SystemAdminRoleId),
			false)
		if appErr != nil {
			return nil, appErr
		}
	}

	user.Patch(userPatch)

	user, err := a.UpdateUser(c, user, false)
	if err != nil {
		return nil, err
	}

	err = a.UpdatePassword(c, user, *userPatch.Password)
	if err != nil {
		return nil, err
	}

	appErr := a.Srv().Store().Bot().PermanentDelete(bot.UserId)
	if appErr != nil {
		return nil, model.NewAppError("ConvertBotToUser", "app.user.convert_bot_to_user.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	return user, nil
}

func (a *App) GetThreadsForUser(userID, teamID string, options model.GetUserThreadsOpts) (*model.Threads, *model.AppError) {
	var result model.Threads
	var eg errgroup.Group
	postPriorityIsEnabled := a.IsPostPriorityEnabled()
	if postPriorityIsEnabled {
		options.IncludeIsUrgent = true
	}

	if !options.ThreadsOnly {
		eg.Go(func() error {
			totalUnreadThreads, err := a.Srv().Store().Thread().GetTotalUnreadThreads(userID, teamID, options)
			if err != nil {
				return errors.Wrapf(err, "failed to count unread threads for user id=%s", userID)
			}
			result.TotalUnreadThreads = totalUnreadThreads

			return nil
		})

		// Unread is a legacy flag that caused GetTotalThreads to compute the same value as
		// GetTotalUnreadThreads. If unspecified, do this work normally; otherwise, skip,
		// and send back duplicate values down below.
		if !options.Unread {
			eg.Go(func() error {
				totalCount, err := a.Srv().Store().Thread().GetTotalThreads(userID, teamID, options)
				if err != nil {
					return errors.Wrapf(err, "failed to count threads for user id=%s", userID)
				}
				result.Total = totalCount

				return nil
			})
		}

		eg.Go(func() error {
			totalUnreadMentions, err := a.Srv().Store().Thread().GetTotalUnreadMentions(userID, teamID, options)
			if err != nil {
				return errors.Wrapf(err, "failed to count threads for user id=%s", userID)
			}
			result.TotalUnreadMentions = totalUnreadMentions

			return nil
		})

		if postPriorityIsEnabled {
			eg.Go(func() error {
				totalUnreadUrgentMentions, err := a.Srv().Store().Thread().GetTotalUnreadUrgentMentions(userID, teamID, options)
				if err != nil {
					return errors.Wrapf(err, "failed to count urgent mentioned threads for user id=%s", userID)
				}
				result.TotalUnreadUrgentMentions = totalUnreadUrgentMentions

				return nil
			})
		}
	}

	if !options.TotalsOnly {
		eg.Go(func() error {
			threads, err := a.Srv().Store().Thread().GetThreadsForUser(userID, teamID, options)
			if err != nil {
				return errors.Wrapf(err, "failed to get threads for user id=%s", userID)
			}
			result.Threads = threads

			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return nil, model.NewAppError("GetThreadsForUser", "app.user.get_threads_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if options.Unread {
		result.Total = result.TotalUnreadThreads
	}

	for _, thread := range result.Threads {
		a.sanitizeProfiles(thread.Participants, false)
		thread.Post.SanitizeProps()
	}

	return &result, nil
}

func (a *App) GetThreadMembershipForUser(userId, threadId string) (*model.ThreadMembership, *model.AppError) {
	threadMembership, nErr := a.Srv().Store().Thread().GetMembershipForUser(userId, threadId)
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("GetThreadMembershipForUser", "app.user.get_thread_membership_for_user.not_found", nil, "", http.StatusNotFound).Wrap(nErr)
		default:
			return nil, model.NewAppError("GetThreadMembershipForUser", "app.user.get_thread_membership_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}
	return threadMembership, nil
}

func (a *App) GetThreadForUser(threadMembership *model.ThreadMembership, extended bool) (*model.ThreadResponse, *model.AppError) {
	thread, nErr := a.Srv().Store().Thread().GetThreadForUser(threadMembership, extended, a.IsPostPriorityEnabled())
	if nErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("GetThreadForUser", "app.user.get_threads_for_user.not_found", nil, "thread not found/followed", http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetThreadForUser", "app.user.get_threads_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	a.sanitizeProfiles(thread.Participants, false)
	thread.Post.SanitizeProps()
	return thread, nil
}

func (a *App) UpdateThreadsReadForUser(userID, teamID string) *model.AppError {
	nErr := a.Srv().Store().Thread().MarkAllAsReadByTeam(userID, teamID)
	if nErr != nil {
		return model.NewAppError("UpdateThreadsReadForUser", "app.user.update_threads_read_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	message := model.NewWebSocketEvent(model.WebsocketEventThreadReadChanged, teamID, "", userID, nil, "")
	a.Publish(message)
	return nil
}

func (a *App) UpdateThreadFollowForUser(userID, teamID, threadID string, state bool) *model.AppError {
	opts := store.ThreadMembershipOpts{
		Following:             state,
		IncrementMentions:     false,
		UpdateFollowing:       true,
		UpdateViewedTimestamp: state,
		UpdateParticipants:    false,
	}
	_, err := a.Srv().Store().Thread().MaintainMembership(userID, threadID, opts)
	if err != nil {
		return model.NewAppError("UpdateThreadFollowForUser", "app.user.update_thread_follow_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	thread, err := a.Srv().Store().Thread().Get(threadID)
	if err != nil {
		return model.NewAppError("UpdateThreadFollowForUser", "app.user.update_thread_follow_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	replyCount := int64(0)
	if thread != nil {
		replyCount = thread.ReplyCount
	}
	message := model.NewWebSocketEvent(model.WebsocketEventThreadFollowChanged, teamID, "", userID, nil, "")
	message.Add("thread_id", threadID)
	message.Add("state", state)
	message.Add("reply_count", replyCount)
	a.Publish(message)
	return nil
}

func (a *App) UpdateThreadFollowForUserFromChannelAdd(c request.CTX, userID, teamID, threadID string) *model.AppError {
	opts := store.ThreadMembershipOpts{
		Following:             true,
		IncrementMentions:     false,
		UpdateFollowing:       true,
		UpdateViewedTimestamp: false,
		UpdateParticipants:    false,
	}
	tm, err := a.Srv().Store().Thread().MaintainMembership(userID, threadID, opts)
	if err != nil {
		return model.NewAppError("UpdateThreadFollowForUserFromChannelAdd", "app.user.update_thread_follow_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	post, appErr := a.GetSinglePost(c, threadID, false)
	if appErr != nil {
		return appErr
	}
	user, appErr := a.GetUser(userID)
	if appErr != nil {
		return appErr
	}
	tm.UnreadMentions, appErr = a.countThreadMentions(c, user, post, teamID, post.CreateAt-1)
	if appErr != nil {
		return appErr
	}
	tm.LastViewed = post.CreateAt - 1
	_, err = a.Srv().Store().Thread().UpdateMembership(tm)
	if err != nil {
		return model.NewAppError("UpdateThreadFollowForUserFromChannelAdd", "app.user.update_thread_follow_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventThreadUpdated, teamID, "", userID, nil, "")
	userThread, err := a.Srv().Store().Thread().GetThreadForUser(tm, true, a.IsPostPriorityEnabled())
	if err != nil {
		var errNotFound *store.ErrNotFound
		if errors.As(err, &errNotFound) {
			return nil
		}
		return model.NewAppError("UpdateThreadFollowForUserFromChannelAdd", "app.user.update_thread_follow_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	a.sanitizeProfiles(userThread.Participants, false)
	userThread.Post.SanitizeProps()
	sanitizedPost, appErr := a.SanitizePostMetadataForUser(c, userThread.Post, userID)
	if appErr != nil {
		return appErr
	}
	userThread.Post = sanitizedPost

	payload, jsonErr := json.Marshal(userThread)
	if jsonErr != nil {
		return model.NewAppError("UpdateThreadFollowForUserFromChannelAdd", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("thread", string(payload))
	message.Add("previous_unread_replies", int64(0))
	message.Add("previous_unread_mentions", int64(0))

	a.Publish(message)
	return nil
}

func (a *App) UpdateThreadReadForUserByPost(c request.CTX, currentSessionId, userID, teamID, threadID, postID string) (*model.ThreadResponse, *model.AppError) {
	post, err := a.GetSinglePost(c, postID, false)
	if err != nil {
		return nil, err
	}

	if post.RootId != threadID && postID != threadID {
		return nil, model.NewAppError("UpdateThreadReadForUser", "app.user.update_thread_read_for_user_by_post.app_error", nil, "", http.StatusBadRequest)
	}

	return a.UpdateThreadReadForUser(c, currentSessionId, userID, teamID, threadID, post.CreateAt-1)
}

func (a *App) UpdateThreadReadForUser(c request.CTX, currentSessionId, userID, teamID, threadID string, timestamp int64) (*model.ThreadResponse, *model.AppError) {
	user, err := a.GetUser(userID)
	if err != nil {
		return nil, err
	}

	// If the thread doesn't have a membership, we shouldn't try to mark it as unread
	membership, err := a.GetThreadMembershipForUser(userID, threadID)
	if err != nil {
		return nil, err
	}

	previousUnreadMentions := membership.UnreadMentions
	previousUnreadReplies, nErr := a.Srv().Store().Thread().GetThreadUnreadReplyCount(membership)
	if nErr != nil {
		return nil, model.NewAppError("UpdateThreadReadForUser", "app.user.update_thread_read_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	post, err := a.GetSinglePost(c, threadID, false)
	if err != nil {
		return nil, err
	}
	membership.UnreadMentions, err = a.countThreadMentions(c, user, post, teamID, timestamp)
	if err != nil {
		return nil, err
	}
	_, nErr = a.Srv().Store().Thread().UpdateMembership(membership)
	if nErr != nil {
		return nil, model.NewAppError("UpdateThreadReadForUser", "app.user.update_thread_read_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	membership.LastViewed = timestamp

	nErr = a.Srv().Store().Thread().MarkAsRead(userID, threadID, timestamp)
	if nErr != nil {
		return nil, model.NewAppError("UpdateThreadReadForUser", "app.user.update_thread_read_for_user.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	thread, err := a.GetThreadForUser(membership, false)
	if err != nil {
		return nil, err
	}

	// Clear if user has read the messages
	if thread.UnreadReplies == 0 && a.IsCRTEnabledForUser(c, userID) {
		a.clearPushNotification(currentSessionId, userID, post.ChannelId, threadID)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventThreadReadChanged, teamID, "", userID, nil, "")
	message.Add("thread_id", threadID)
	message.Add("timestamp", timestamp)
	message.Add("unread_mentions", membership.UnreadMentions)
	message.Add("unread_replies", thread.UnreadReplies)
	message.Add("previous_unread_mentions", previousUnreadMentions)
	message.Add("previous_unread_replies", previousUnreadReplies)
	message.Add("channel_id", post.ChannelId)
	a.Publish(message)
	return thread, nil
}

func (a *App) GetUsersWithInvalidEmails(page int, perPage int) ([]*model.User, *model.AppError) {
	users, err := a.Srv().Store().User().GetUsersWithInvalidEmails(page, perPage, *a.Config().TeamSettings.RestrictCreationToDomains)
	if err != nil {
		return nil, model.NewAppError("GetUsersPage", "app.user.get_profiles.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return users, nil
}

func getProfileImagePath(userID string) string {
	return filepath.Join("users", userID, "profile.png")
}

func getProfileImageDirectory(userID string) string {
	return filepath.Join("users", userID)
}

func (a *App) UserIsFirstAdmin(rctx request.CTX, user *model.User) bool {
	if !user.IsSystemAdmin() {
		return false
	}

	systemAdminUsers, errServer := a.Srv().Store().User().GetSystemAdminProfiles()
	if errServer != nil {
		rctx.Logger().Warn("Failed to get system admins to check for first admin from Mattermost.")
		return false
	}

	for _, systemAdminUser := range systemAdminUsers {
		systemAdminUser := systemAdminUser

		if systemAdminUser.CreateAt < user.CreateAt {
			return false
		}
	}

	return true
}

func (a *App) ResetPasswordFailedAttempts(c request.CTX, user *model.User) *model.AppError {
	err := a.Srv().Store().User().UpdateFailedPasswordAttempts(user.Id, 0)
	if err != nil {
		return model.NewAppError("ResetPasswordFailedAttempts", "app.user.reset_password_failed_attempts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}
