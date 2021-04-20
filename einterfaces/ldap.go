// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"bytes"
	"io"

	"github.com/mattermost/mattermost-server/v5/model"
)

type LdapInterface interface {
	DoLogin(LdapAppInterface, string, string) (*model.User, *model.AppError)
	GetUser(string) (*model.User, *model.AppError)
	GetUserAttributes(string, []string) (map[string]string, *model.AppError)
	CheckPassword(string, string) *model.AppError
	CheckPasswordAuthData(string, string) *model.AppError
	CheckProviderAttributes(*model.LdapSettings, *model.User, *model.UserPatch) string
	SwitchToLdap(LdapAppInterface, string, string, string) *model.AppError
	StartSynchronizeJob(bool) (*model.Job, *model.AppError)
	RunTest() *model.AppError
	GetAllLdapUsers() ([]*model.User, *model.AppError)
	MigrateIDAttribute(LdapAppInterface, string) error
	GetGroup(string) (*model.Group, *model.AppError)
	GetAllGroupsPage(LdapAppInterface, int, int, model.LdapGroupSearchOpts) ([]*model.Group, int, *model.AppError)
	FirstLoginSync(LdapAppInterface, *model.User, string, string, string) *model.AppError
	UpdateProfilePictureIfNecessary(LdapAppInterface, model.User, model.Session)
	GetADLdapIdFromSAMLId(string) string
	GetSAMLIdFromADLdapId(string) string
	GetVendorNameAndVendorVersion() (string, string)
}

type LdapAppInterface interface {
	InvalidateCacheForUser(userID string)
	GetGroupByRemoteID(string, model.GroupSource) (*model.Group, *model.AppError)
	GetGroupSyncables(string, model.GroupSyncableType) ([]*model.GroupSyncable, *model.AppError)
	UpsertGroupMember(string, string) (*model.GroupMember, *model.AppError)
	CreateDefaultMemberships(int64) error
	GetUser(string) (*model.User, *model.AppError)
	GetProfileImage(*model.User) ([]byte, bool, *model.AppError)
	SetProfileImageFromFile(string, io.Reader) *model.AppError
	SessionIsRegistered(model.Session) bool
	PromoteGuestToUser(*model.User, string) *model.AppError
	DemoteUserToGuest(*model.User) *model.AppError
	UpdateUserRoles(string, string, bool) (*model.User, *model.AppError)
	CreateUser(*model.User) (*model.User, *model.AppError)
	CreateGuest(*model.User) (*model.User, *model.AppError)
	AdjustImage(file io.Reader) (*bytes.Buffer, *model.AppError)
	ClearChannelMembersCache(string)
	ClearTeamMembersCache(string)
	UpdateActive(*model.User, bool) (*model.User, *model.AppError)
	DeleteGroup(groupID string) (*model.Group, *model.AppError)
	UpdateGroup(group *model.Group) (*model.Group, *model.AppError)
	GetGroupMemberUsers(groupID string) ([]*model.User, *model.AppError)
	DeleteGroupMember(groupID string, userID string) (*model.GroupMember, *model.AppError)
	DeleteGroupConstrainedMemberships() error
	GetAllTeamsPage(offset int, limit int) ([]*model.Team, *model.AppError)
	SyncSyncableRoles(syncableID string, syncableType model.GroupSyncableType) *model.AppError
	GetAllChannels(page, perPage int, opts model.ChannelSearchOpts) (*model.ChannelListWithTeamData, *model.AppError)
}
