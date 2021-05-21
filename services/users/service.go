// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"context"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/mattermost/mattermost-server/v5/store"
)

type ConfigFn func() *model.Config

type UserService struct {
	store  store.UserStore
	config ConfigFn
}

func New(s store.UserStore, cfgFn ConfigFn) *UserService {
	return &UserService{
		store:  s,
		config: cfgFn,
	}
}

// CreateUser creates a user
func (us *UserService) CreateUser(user *model.User) (*model.User, *model.AppError) {
	// TODO: Are guest users are specific to chat or they are applicable for the whole suite?

	if !user.IsLDAPUser() && !user.IsSAMLUser() && !user.IsGuest() && !CheckUserDomain(user, *us.config().TeamSettings.RestrictCreationToDomains) {
		return nil, model.NewAppError("CreateUser", "api.user.create_user.accepted_domain.app_error", nil, "", http.StatusBadRequest)
	}

	if !user.IsLDAPUser() && !user.IsSAMLUser() && user.IsGuest() && !CheckUserDomain(user, *us.config().GuestAccountsSettings.RestrictCreationToDomains) {
		return nil, model.NewAppError("CreateUser", "api.user.create_user.accepted_domain.app_error", nil, "", http.StatusBadRequest)
	}

	// Below is a special case where the first user in the entire
	// system is granted the system_admin role
	count, err := us.store.Count(model.UserCountOptions{IncludeDeleted: true})
	if err != nil {
		return nil, model.NewAppError("createUserOrGuest", "app.user.get_total_users_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if count <= 0 && user.Roles == "" {
		user.Roles = model.SYSTEM_ADMIN_ROLE_ID + " " + model.SYSTEM_USER_ROLE_ID
	}

	if _, ok := i18n.GetSupportedLocales()[user.Locale]; !ok {
		user.Locale = *us.config().LocalizationSettings.DefaultClientLocale
	}

	ruser, appErr := us.createUser(user)
	if appErr != nil {
		return nil, appErr
	}

	return ruser, nil
}

func (us *UserService) createUser(user *model.User) (*model.User, *model.AppError) {
	user.MakeNonNil()

	if err := us.IsPasswordValid(user.Password); user.AuthService == "" && err != nil {
		return nil, err
	}

	ruser, nErr := us.store.Save(user)
	if nErr != nil {
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
		if err := us.VerifyUserEmail(ruser.Id, user.Email); err != nil {
			mlog.Warn("Failed to set email verified", mlog.Err(err))
		}
	}

	// Determine whether to send the created user a welcome email
	ruser.DisableWelcomeEmail = user.DisableWelcomeEmail
	ruser.Sanitize(map[string]bool{})

	return ruser, nil
}

func (us *UserService) VerifyUserEmail(userID, email string) *model.AppError {
	if _, err := us.store.VerifyEmail(userID, email); err != nil {
		return model.NewAppError("VerifyUserEmail", "app.user.verify_email.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (us *UserService) GetUser(userID string) (*model.User, *model.AppError) {
	user, err := us.store.Get(context.Background(), userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUser", MissingAccountError, nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetUser", "app.user.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return user, nil
}
