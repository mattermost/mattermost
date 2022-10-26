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
func (s *SuiteService) createUserWithOptions(user *model.User, opts UserCreateOptions) (*model.User, error) {
	if opts.FromImport {
		return s.createUserFromUser(user)
	}

	user.Roles = model.SystemUserRoleId
	if opts.Guest {
		user.Roles = model.SystemGuestRoleId
	}

	if !user.IsLDAPUser() && !user.IsSAMLUser() && !user.IsGuest() && !CheckUserDomain(user, *s.platform.Config().TeamSettings.RestrictCreationToDomains) {
		return nil, AcceptedDomainError
	}

	if !user.IsLDAPUser() && !user.IsSAMLUser() && user.IsGuest() && !CheckUserDomain(user, *s.platform.Config().GuestAccountsSettings.RestrictCreationToDomains) {
		return nil, AcceptedDomainError
	}

	// Below is a special case where the first user in the entire
	// system is granted the system_admin role
	if ok, err := s.platform.Store.User().IsEmpty(true); err != nil {
		return nil, errors.Wrap(UserStoreIsEmptyError, err.Error())
	} else if ok {
		user.Roles = model.SystemAdminRoleId + " " + model.SystemUserRoleId
	}

	if _, ok := i18n.GetSupportedLocales()[user.Locale]; !ok {
		user.Locale = *s.platform.Config().LocalizationSettings.DefaultClientLocale
	}

	return s.createUserFromUser(user)
}

func (s *SuiteService) createUserFromUser(user *model.User) (*model.User, error) {
	user.MakeNonNil()

	if err := s.isPasswordValid(user.Password); user.AuthService == "" && err != nil {
		return nil, err
	}

	ruser, err := s.platform.Store.User().Save(user)
	if err != nil {
		return nil, err
	}

	if user.EmailVerified {
		if err := s.verifyUserEmail(ruser.Id, user.Email); err != nil {
			mlog.Warn("Failed to set email verified", mlog.Err(err))
		}
	}

	// Determine whether to send the created user a welcome email
	ruser.DisableWelcomeEmail = user.DisableWelcomeEmail
	ruser.Sanitize(map[string]bool{})

	return ruser, nil
}

func (s *SuiteService) verifyUserEmail(userID, email string) error {
	if _, err := s.platform.Store.User().VerifyEmail(userID, email); err != nil {
		return VerifyUserError
	}

	return nil
}

func (s *SuiteService) getUser(userID string) (*model.User, error) {
	return s.platform.Store.User().Get(context.Background(), userID)
}

func (s *SuiteService) getUsers(userIDs []string) ([]*model.User, error) {
	return s.platform.Store.User().GetMany(context.Background(), userIDs)
}

func (s *SuiteService) getUserByUsername(username string) (*model.User, error) {
	return s.platform.Store.User().GetByUsername(username)
}

func (s *SuiteService) getUserByEmail(email string) (*model.User, error) {
	return s.platform.Store.User().GetByEmail(email)
}

func (s *SuiteService) getUserByAuth(authData *string, authService string) (*model.User, error) {
	return s.platform.Store.User().GetByAuth(authData, authService)
}

func (s *SuiteService) getUsersFromProfiles(options *model.UserGetOptions) ([]*model.User, error) {
	return s.platform.Store.User().GetAllProfiles(options)
}

func (s *SuiteService) getUsersByUsernames(usernames []string, options *model.UserGetOptions) ([]*model.User, error) {
	return s.platform.Store.User().GetProfilesByUsernames(usernames, options.ViewRestrictions)
}

func (s *SuiteService) getUsersPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, error) {
	users, err := s.GetUsersFromProfiles(options)
	if err != nil {
		return nil, err
	}

	return s.SanitizeProfiles(users, asAdmin), nil
}

func (s *SuiteService) getUsersEtag(restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", s.platform.Store.User().GetEtagForAllProfiles(), s.platform.Config().PrivacySettings.ShowFullName, s.platform.Config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (s *SuiteService) getUsersByIds(userIDs []string, options *store.UserGetByIdsOpts) ([]*model.User, error) {
	allowFromCache := options.ViewRestrictions == nil

	users, err := s.platform.Store.User().GetProfileByIds(context.Background(), userIDs, options, allowFromCache)
	if err != nil {
		return nil, err
	}

	return s.SanitizeProfiles(users, options.IsAdmin), nil
}

func (s *SuiteService) getUsersInTeam(options *model.UserGetOptions) ([]*model.User, error) {
	return s.platform.Store.User().GetProfiles(options)
}

func (s *SuiteService) getUsersNotInTeam(teamID string, groupConstrained bool, offset int, limit int, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	return s.platform.Store.User().GetProfilesNotInTeam(teamID, groupConstrained, offset, limit, viewRestrictions)
}

func (s *SuiteService) getUsersInTeamPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, error) {
	users, err := s.GetUsersInTeam(options)
	if err != nil {
		return nil, err
	}

	return s.SanitizeProfiles(users, asAdmin), nil
}

func (s *SuiteService) getUsersNotInTeamPage(teamID string, groupConstrained bool, page int, perPage int, asAdmin bool, viewRestrictions *model.ViewUsersRestrictions) ([]*model.User, error) {
	users, err := s.GetUsersNotInTeam(teamID, groupConstrained, page*perPage, perPage, viewRestrictions)
	if err != nil {
		return nil, err
	}

	return s.SanitizeProfiles(users, asAdmin), nil
}

func (s *SuiteService) getUsersInTeamEtag(teamID string, restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", s.platform.Store.User().GetEtagForProfiles(teamID), s.platform.Config().PrivacySettings.ShowFullName, s.platform.Config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (s *SuiteService) getUsersNotInTeamEtag(teamID string, restrictionsHash string) string {
	return fmt.Sprintf("%v.%v.%v.%v", s.platform.Store.User().GetEtagForProfilesNotInTeam(teamID), s.platform.Config().PrivacySettings.ShowFullName, s.platform.Config().PrivacySettings.ShowEmailAddress, restrictionsHash)
}

func (s *SuiteService) getUsersWithoutTeamPage(options *model.UserGetOptions, asAdmin bool) ([]*model.User, error) {
	users, err := s.GetUsersWithoutTeam(options)
	if err != nil {
		return nil, err
	}

	return s.SanitizeProfiles(users, asAdmin), nil
}

func (s *SuiteService) getUsersWithoutTeam(options *model.UserGetOptions) ([]*model.User, error) {
	users, err := s.platform.Store.User().GetProfilesWithoutTeam(options)
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (s *SuiteService) updateUser(user *model.User, allowRoleUpdate bool) (*model.UserUpdate, error) {
	return s.platform.Store.User().Update(user, allowRoleUpdate)
}

func (s *SuiteService) updateUserNotifyProps(userID string, props map[string]string) error {
	return s.platform.Store.User().UpdateNotifyProps(userID, props)
}

func (s *SuiteService) deactivateAllGuests() ([]string, error) {
	users, err := s.platform.Store.User().DeactivateGuests()
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (s *SuiteService) InvalidateCacheForUser(userID string) {
	s.platform.Store.User().InvalidateProfilesInChannelCacheByUser(userID)
	s.platform.Store.User().InvalidateProfileCacheForUser(userID)

	if c := s.platform.Cluster(); c != nil {
		msg := &model.ClusterMessage{
			Event:    model.ClusterEventInvalidateCacheForUser,
			SendType: model.ClusterSendBestEffort,
			Data:     []byte(userID),
		}
		c.SendClusterMessage(msg)
	}
}

func (s *SuiteService) generateMfaSecret(user *model.User) (*model.MfaSecret, error) {
	secret, img, err := mfa.New(s.platform.Store.User()).GenerateSecret(*s.platform.Config().ServiceSettings.SiteURL, user.Email, user.Id)
	if err != nil {
		return nil, err
	}

	// Make sure the old secret is not cached on any cluster nodes.
	s.InvalidateCacheForUser(user.Id)

	mfaSecret := &model.MfaSecret{Secret: secret, QRCode: base64.StdEncoding.EncodeToString(img)}
	return mfaSecret, nil
}

func (s *SuiteService) activateMfa(user *model.User, token string) error {
	return mfa.New(s.platform.Store.User()).Activate(user.MfaSecret, user.Id, token)
}

func (s *SuiteService) deactivateMfa(user *model.User) error {
	return mfa.New(s.platform.Store.User()).Deactivate(user.Id)
}

func (s *SuiteService) promoteGuestToUser(user *model.User) error {
	return s.platform.Store.User().PromoteGuestToUser(user.Id)
}

func (s *SuiteService) demoteUserToGuest(user *model.User) (*model.User, error) {
	return s.platform.Store.User().DemoteUserToGuest(user.Id)
}
