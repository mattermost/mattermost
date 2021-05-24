// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"context"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/mattermost/mattermost-server/v5/store"
)

type UserService struct {
	store  store.UserStore
	config func() *model.Config
}

func New(s store.UserStore, cfgFn func() *model.Config) *UserService {
	return &UserService{
		store:  s,
		config: cfgFn,
	}
}

// CreateUser creates a user
func (us *UserService) CreateUser(user *model.User, guest bool) (*model.User, error) {
	user.Roles = model.SYSTEM_USER_ROLE_ID
	if guest {
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
	if count <= 0 && user.Roles == "" {
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
