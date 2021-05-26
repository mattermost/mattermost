// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"context"
	"fmt"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/mattermost/mattermost-server/v5/store"
)

type UserService struct {
	store  store.UserStore
	config func() *model.Config
}

type UserCreateOptions struct {
	Guest      bool
	FromImport bool
}

func New(s store.UserStore, cfgFn func() *model.Config) *UserService {
	return &UserService{
		store:  s,
		config: cfgFn,
	}
}

// CreateUser creates a user
func (us *UserService) CreateUser(user *model.User, opts UserCreateOptions) (*model.User, error) {
	user.Roles = model.SYSTEM_USER_ROLE_ID
	if opts.Guest {
		user.Roles = model.SYSTEM_GUEST_ROLE_ID
	}

	if !user.IsLDAPUser() && !user.IsSAMLUser() && !user.IsGuest() && !checkUserDomain(user, *us.config().TeamSettings.RestrictCreationToDomains) {
		return nil, AcceptedDomainError
	}

	if !user.IsLDAPUser() && !user.IsSAMLUser() && user.IsGuest() && !checkUserDomain(user, *us.config().GuestAccountsSettings.RestrictCreationToDomains) {
		return nil, AcceptedDomainError
	}

	// Below is a special case where the first user in the entire
	// system is granted the system_admin role
	count, err := us.store.Count(model.UserCountOptions{IncludeDeleted: true})
	if err != nil {
		return nil, UserCountError
	}
	if count <= 0 && !opts.FromImport {
		user.Roles = model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID
	}

	if _, ok := i18n.GetSupportedLocales()[user.Locale]; !ok {
		user.Locale = *us.config().LocalizationSettings.DefaultClientLocale
	}

	ruser, err := us.createUser(user)
	if err != nil {
		return nil, err
	}

	return ruser, nil
}

func (us *UserService) createUser(user *model.User) (*model.User, error) {
	user.MakeNonNil()

	if err := us.isPasswordValid(user.Password); user.AuthService == "" && err != nil {
		return nil, err
	}

	ruser, err := us.store.Save(user)
	if err != nil {
		return nil, err
	}

	if user.EmailVerified {
		if err := us.verifyUserEmail(ruser.Id, user.Email); err != nil {
			mlog.Warn("Failed to set email verified", mlog.Err(err))
		}
	}

	// Determine whether to send the created user a welcome email
	ruser.DisableWelcomeEmail = user.DisableWelcomeEmail
	ruser.Sanitize(map[string]bool{})

	return ruser, nil
}

func (us *UserService) verifyUserEmail(userID, email string) error {
	if _, err := us.store.VerifyEmail(userID, email); err != nil {
		return VerifyUserError
	}

	return nil
}

func (us *UserService) GetUser(userID string) (*model.User, error) {
	return us.store.Get(context.Background(), userID)
}

func (us *UserService) GetUserByUsername(username string) (*model.User, error) {
	return us.store.GetByUsername(username)
}

func (us *UserService) GetUserByEmail(email string) (*model.User, error) {
	return us.store.GetByEmail(email)
}

func (us *UserService) GetUserByAuth(authData *string, authService string) (*model.User, error) {
	return us.store.GetByAuth(authData, authService)
}

func (us *UserService) GetUsers(options *model.UserGetOptions) ([]*model.User, error) {
	return us.store.GetAllProfiles(options)
}

func (us *UserService) GetUsersPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, error) {
	users, err := us.GetUsers(options)
	if err != nil {
		return nil, err
	}

	return us.sanitizeProfiles(users, asAdmin), nil
}

func (us *UserService) GetUsersEtag(restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", us.store.GetEtagForAllProfiles(), us.config().PrivacySettings.ShowFullName, us.config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (us *UserService) GetUsersByIds(userIDs []string, options *store.UserGetByIdsOpts) ([]*model.User, error) {
	allowFromCache := options.ViewRestrictions == nil

	users, err := us.store.GetProfileByIds(context.Background(), userIDs, options, allowFromCache)
	if err != nil {
		return nil, err
	}

	return us.sanitizeProfiles(users, options.IsAdmin), nil
}

func (us *UserService) GetUsersInTeam(options *model.UserGetOptions) ([]*model.User, error) {
	return us.store.GetProfiles(options)
}

func (us *UserService) GetUsersNotInTeam(teamID string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	return us.store.GetProfilesNotInTeam(teamID, groupConstrained, offset, limit, viewRestrictions)
}

func (us *UserService) GetUsersInTeamPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, error) {
	users, err := us.GetUsersInTeam(options)
	if err != nil {
		return nil, err
	}

	return us.sanitizeProfiles(users, asAdmin), nil
}

func (us *UserService) GetUsersNotInTeamPage(teamID string, groupConstrained bool, page int, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	users, err := us.GetUsersNotInTeam(teamID, groupConstrained, page*perPage, perPage, viewRestrictions)
	if err != nil {
		return nil, err
	}

	return us.sanitizeProfiles(users, asAdmin), nil
}

func (us *UserService) GetUsersInTeamEtag(teamID string, restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", us.store.GetEtagForProfiles(teamID), us.config().PrivacySettings.ShowFullName, us.config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (us *UserService) GetUsersNotInTeamEtag(teamID string, restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", us.store.GetEtagForProfilesNotInTeam(teamID), us.config().PrivacySettings.ShowFullName, us.config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (us *UserService) GetUsersWithoutTeamPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, error) {
	users, err := us.GetUsersWithoutTeam(options)
	if err != nil {
		return nil, err
	}

	return us.sanitizeProfiles(users, asAdmin), nil
}

func (us *UserService) GetUsersWithoutTeam(options *model.UserGetOptions) ([]*model.User, error) {
	users, err := us.store.GetProfilesWithoutTeam(options)
	if err != nil {
		return nil, err
	}

	return users, nil
}
