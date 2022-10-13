// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

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
func (us *SuiteService) createUserWithOptions(user *model.User, opts UserCreateOptions) (*model.User, error) {
	if opts.FromImport {
		return us.createUserFromUser(user)
	}

	user.Roles = model.SystemUserRoleId
	if opts.Guest {
		user.Roles = model.SystemGuestRoleId
	}

	if !user.IsLDAPUser() && !user.IsSAMLUser() && !user.IsGuest() && !CheckUserDomain(user, *us.platform.Config().TeamSettings.RestrictCreationToDomains) {
		return nil, AcceptedDomainError
	}

	if !user.IsLDAPUser() && !user.IsSAMLUser() && user.IsGuest() && !CheckUserDomain(user, *us.platform.Config().GuestAccountsSettings.RestrictCreationToDomains) {
		return nil, AcceptedDomainError
	}

	// Below is a special case where the first user in the entire
	// system is granted the system_admin role
	if ok, err := us.platform.Store.User().IsEmpty(true); err != nil {
		return nil, errors.Wrap(UserStoreIsEmptyError, err.Error())
	} else if ok {
		user.Roles = model.SystemAdminRoleId + " " + model.SystemUserRoleId
	}

	if _, ok := i18n.GetSupportedLocales()[user.Locale]; !ok {
		user.Locale = *us.platform.Config().LocalizationSettings.DefaultClientLocale
	}

	return us.createUserFromUser(user)
}

func (us *SuiteService) createUserFromUser(user *model.User) (*model.User, error) {
	user.MakeNonNil()

	if err := us.isPasswordValid(user.Password); user.AuthService == "" && err != nil {
		return nil, err
	}

	ruser, err := us.platform.Store.User().Save(user)
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

func (us *SuiteService) verifyUserEmail(userID, email string) error {
	if _, err := us.platform.Store.User().VerifyEmail(userID, email); err != nil {
		return VerifyUserError
	}

	return nil
}

func (us *SuiteService) getUser(userID string) (*model.User, error) {
	return us.platform.Store.User().Get(context.Background(), userID)
}

func (us *SuiteService) getUsers(userIDs []string) ([]*model.User, error) {
	return us.platform.Store.User().GetMany(context.Background(), userIDs)
}

func (us *SuiteService) getUserByUsername(username string) (*model.User, error) {
	return us.platform.Store.User().GetByUsername(username)
}

func (us *SuiteService) getUserByEmail(email string) (*model.User, error) {
	return us.platform.Store.User().GetByEmail(email)
}

func (us *SuiteService) getUserByAuth(authData *string, authService string) (*model.User, error) {
	return us.platform.Store.User().GetByAuth(authData, authService)
}

func (us *SuiteService) getUsersFromProfiles(options *model.UserGetOptions) ([]*model.User, error) {
	return us.platform.Store.User().GetAllProfiles(options)
}

func (us *SuiteService) getUsersByUsernames(usernames []string, options *model.UserGetOptions) ([]*model.User, error) {
	return us.platform.Store.User().GetProfilesByUsernames(usernames, options.ViewRestrictions)
}

func (us *SuiteService) getUsersPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, error) {
	users, err := us.GetUsersFromProfiles(options)
	if err != nil {
		return nil, err
	}

	return us.sanitizeProfiles(users, asAdmin), nil
}

func (us *SuiteService) getUsersEtag(restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", us.platform.Store.User().GetEtagForAllProfiles(), us.platform.Config().PrivacySettings.ShowFullName, us.platform.Config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (us *SuiteService) getUsersByIds(userIDs []string, options *store.UserGetByIdsOpts) ([]*model.User, error) {
	allowFromCache := options.ViewRestrictions == nil

	users, err := us.platform.Store.User().GetProfileByIds(context.Background(), userIDs, options, allowFromCache)
	if err != nil {
		return nil, err
	}

	return us.sanitizeProfiles(users, options.IsAdmin), nil
}

func (us *SuiteService) getUsersInTeam(options *model.UserGetOptions) ([]*model.User, error) {
	return us.platform.Store.User().GetProfiles(options)
}

func (us *SuiteService) getUsersNotInTeam(teamID string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	return us.platform.Store.User().GetProfilesNotInTeam(teamID, groupConstrained, offset, limit, viewRestrictions)
}

func (us *SuiteService) getUsersInTeamPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, error) {
	users, err := us.GetUsersInTeam(options)
	if err != nil {
		return nil, err
	}

	return us.sanitizeProfiles(users, asAdmin), nil
}

func (us *SuiteService) getUsersNotInTeamPage(teamID string, groupConstrained bool, page int, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	users, err := us.GetUsersNotInTeam(teamID, groupConstrained, page*perPage, perPage, viewRestrictions)
	if err != nil {
		return nil, err
	}

	return us.sanitizeProfiles(users, asAdmin), nil
}

func (us *SuiteService) getUsersInTeamEtag(teamID string, restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", us.platform.Store.User().GetEtagForProfiles(teamID), us.platform.Config().PrivacySettings.ShowFullName, us.platform.Config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (us *SuiteService) getUsersNotInTeamEtag(teamID string, restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", us.platform.Store.User().GetEtagForProfilesNotInTeam(teamID), us.platform.Config().PrivacySettings.ShowFullName, us.platform.Config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (us *SuiteService) getUsersWithoutTeamPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, error) {
	users, err := us.GetUsersWithoutTeam(options)
	if err != nil {
		return nil, err
	}

	return us.sanitizeProfiles(users, asAdmin), nil
}

func (us *SuiteService) getUsersWithoutTeam(options *model.UserGetOptions) ([]*model.User, error) {
	users, err := us.platform.Store.User().GetProfilesWithoutTeam(options)
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (us *SuiteService) updateUser(user *model.User, allowRoleUpdate bool) (*model.UserUpdate, error) {
	return us.platform.Store.User().Update(user, allowRoleUpdate)
}

func (us *SuiteService) updateUserNotifyProps(userID string, props map[string]string) error {
	return us.platform.Store.User().UpdateNotifyProps(userID, props)
}

func (us *SuiteService) deactivateAllGuests() ([]string, error) {
	users, err := us.platform.Store.User().DeactivateGuests()
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (us *SuiteService) InvalidateCacheForUser(userID string) {
	us.platform.Store.User().InvalidateProfilesInChannelCacheByUser(userID)
	us.platform.Store.User().InvalidateProfileCacheForUser(userID)

	if c := us.platform.Cluster(); c != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventInvalidateCacheForUser,
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(userID),
		}
		c.SendClusterMessage(msg)
	}
}

func (us *SuiteService) generateMfaSecret(user *model.User) (*model.MfaSecret, error) {
	secret, img, err := mfa.New(us.platform.Store.User()).GenerateSecret(*us.platform.Config().ServiceSettings.SiteURL, user.Email, user.Id)
	if err != nil {
		return nil, err
	}

	// Make sure the old secret is not cached on any cluster nodes.
	us.InvalidateCacheForUser(user.Id)

	mfaSecret := &model.MfaSecret{Secret: secret, QRCode: base64.StdEncoding.EncodeToString(img)}
	return mfaSecret, nil
}

func (us *SuiteService) activateMfa(user *model.User, token string) error {
	return mfa.New(us.platform.Store.User()).Activate(user.MfaSecret, user.Id, token)
}

func (us *SuiteService) deactivateMfa(user *model.User) error {
	return mfa.New(us.platform.Store.User()).Deactivate(user.Id)
}

func (us *SuiteService) promoteGuestToUser(user *model.User) error {
	return us.platform.Store.User().PromoteGuestToUser(user.Id)
}

func (us *SuiteService) demoteUserToGuest(user *model.User) (*model.User, error) {
	return us.platform.Store.User().DemoteUserToGuest(user.Id)
}
