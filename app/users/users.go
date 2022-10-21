// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"context"
	"encoding/base64"
	"fmt"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mfa"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"

	"github.com/pkg/errors"
)

type UserCreateOptions struct {
	Guest      bool
	FromImport bool
}

// CreateUser creates a user
func (us *UserService) CreateUser(user *model.User, opts UserCreateOptions) (*model.User, error) {
	if opts.FromImport {
		return us.createUser(user)
	}

	user.Roles = model.SystemUserRoleId
	if opts.Guest {
		user.Roles = model.SystemGuestRoleId
	}

	if !user.IsLDAPUser() && !user.IsSAMLUser() && !user.IsGuest() && !CheckUserDomain(user, *us.config().TeamSettings.RestrictCreationToDomains) {
		return nil, AcceptedDomainError
	}

	if !user.IsLDAPUser() && !user.IsSAMLUser() && user.IsGuest() && !CheckUserDomain(user, *us.config().GuestAccountsSettings.RestrictCreationToDomains) {
		return nil, AcceptedDomainError
	}

	// Below is a special case where the first user in the entire
	// system is granted the system_admin role
	if ok, err := us.store.IsEmpty(true); err != nil {
		return nil, errors.Wrap(UserStoreIsEmptyError, err.Error())
	} else if ok {
		user.Roles = model.SystemAdminRoleId + " " + model.SystemUserRoleId
	}

	if _, ok := i18n.GetSupportedLocales()[user.Locale]; !ok {
		user.Locale = *us.config().LocalizationSettings.DefaultClientLocale
	}

	return us.createUser(user)
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

func (us *UserService) GetUsers(userIDs []string) ([]*model.User, error) {
	return us.store.GetMany(context.Background(), userIDs)
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

func (us *UserService) GetUsersFromProfiles(options *model.UserGetOptions) ([]*model.User, int64, error) {
	return us.store.GetAllProfiles(options)
}

func (us *UserService) GetUsersByUsernames(usernames []string, options *model.UserGetOptions) ([]*model.User, error) {
	return us.store.GetProfilesByUsernames(usernames, options.ViewRestrictions)
}

func (us *UserService) GetUsersPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, int64, error) {
	users, totalCount, err := us.GetUsersFromProfiles(options)
	if err != nil {
		return nil, 0, err
	}

	return us.sanitizeProfiles(users, asAdmin), totalCount, nil
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

func (us *UserService) UpdateUser(user *model.User, allowRoleUpdate bool) (*model.UserUpdate, error) {
	return us.store.Update(user, allowRoleUpdate)
}

func (us *UserService) UpdateUserNotifyProps(userID string, props map[string]string) error {
	return us.store.UpdateNotifyProps(userID, props)
}

func (us *UserService) DeactivateAllGuests() ([]string, error) {
	users, err := us.store.DeactivateGuests()
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (us *UserService) InvalidateCacheForUser(userID string) {
	us.store.InvalidateProfilesInChannelCacheByUser(userID)
	us.store.InvalidateProfileCacheForUser(userID)

	if us.cluster != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventInvalidateCacheForUser,
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(userID),
		}
		us.cluster.SendClusterMessage(msg)
	}
}

func (us *UserService) GenerateMfaSecret(user *model.User) (*model.MfaSecret, error) {
	secret, img, err := mfa.New(us.store).GenerateSecret(*us.config().ServiceSettings.SiteURL, user.Email, user.Id)
	if err != nil {
		return nil, err
	}

	// Make sure the old secret is not cached on any cluster nodes.
	us.InvalidateCacheForUser(user.Id)

	mfaSecret := &model.MfaSecret{Secret: secret, QRCode: base64.StdEncoding.EncodeToString(img)}
	return mfaSecret, nil
}

func (us *UserService) ActivateMfa(user *model.User, token string) error {
	return mfa.New(us.store).Activate(user.MfaSecret, user.Id, token)
}

func (us *UserService) DeactivateMfa(user *model.User) error {
	return mfa.New(us.store).Deactivate(user.Id)
}

func (us *UserService) PromoteGuestToUser(user *model.User) error {
	return us.store.PromoteGuestToUser(user.Id)
}

func (us *UserService) DemoteUserToGuest(user *model.User) (*model.User, error) {
	return us.store.DemoteUserToGuest(user.Id)
}
