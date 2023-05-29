// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate mockgen --build_flags= -destination=mocks/mockservicesapi.go -package mocks . ServicesAPI

package playbooks

import (
	"database/sql"

	"github.com/gorilla/mux"

	mm_model "github.com/mattermost/mattermost-server/server/public/model"
)

const (
	botUsername    = "playbooks"
	botDisplayname = "Playbooks"
	botDescription = "Playbooks bot."
	ownerID        = "playbooks"
)

var PlaybooksBot = &mm_model.Bot{
	Username:    botUsername,
	DisplayName: botDisplayname,
	Description: botDescription,
	OwnerId:     ownerID,
}

type ServicesAPI interface {
	// Channels service
	GetDirectChannel(userID1, userID2 string) (*mm_model.Channel, error)
	GetChannelByID(channelID string) (*mm_model.Channel, error)
	GetChannelMember(channelID string, userID string) (*mm_model.ChannelMember, error)
	GetChannelsForTeamForUser(teamID string, userID string, includeDeleted bool) (mm_model.ChannelList, error)
	GetChannelSidebarCategories(userID, teamID string) (*mm_model.OrderedSidebarCategories, error)
	GetChannelMembers(channelID string, page, perPage int) (mm_model.ChannelMembers, error)
	CreateChannelSidebarCategory(userID, teamID string, newCategory *mm_model.SidebarCategoryWithChannels) (*mm_model.SidebarCategoryWithChannels, error)
	UpdateChannelSidebarCategories(userID, teamID string, categories []*mm_model.SidebarCategoryWithChannels) ([]*mm_model.SidebarCategoryWithChannels, error)
	CreateChannel(channel *mm_model.Channel) error
	AddMemberToChannel(channelID, userID string) (*mm_model.ChannelMember, error)
	AddUserToChannel(channelID, userID, asUserID string) (*mm_model.ChannelMember, error)
	UpdateChannelMemberRoles(channelID, userID, newRoles string) (*mm_model.ChannelMember, error)
	DeleteChannelMember(channelID, userID string) error
	AddChannelMember(channelID, userID string) (*mm_model.ChannelMember, error)
	GetDirectChannelOrCreate(userID1, userID2 string) (*mm_model.Channel, error)

	// Post service
	CreatePost(post *mm_model.Post) (*mm_model.Post, error)
	GetPostsByIds(postIDs []string) ([]*mm_model.Post, error)
	SendEphemeralPost(userID string, post *mm_model.Post)
	GetPost(postID string) (*mm_model.Post, error)
	DeletePost(postID string) (*mm_model.Post, error)
	UpdatePost(post *mm_model.Post) (*mm_model.Post, error)

	// User service
	GetUserByID(userID string) (*mm_model.User, error)
	GetUserByUsername(name string) (*mm_model.User, error)
	GetUserByEmail(email string) (*mm_model.User, error)
	UpdateUser(user *mm_model.User) (*mm_model.User, error)
	GetUsersFromProfiles(options *mm_model.UserGetOptions) ([]*mm_model.User, error)

	// Team service
	GetTeamMember(teamID string, userID string) (*mm_model.TeamMember, error)
	CreateMember(teamID string, userID string) (*mm_model.TeamMember, error)
	GetGroup(groupID string) (*mm_model.Group, error)
	GetTeam(teamID string) (*mm_model.Team, error)
	GetGroupMemberUsers(groupID string, page, perPage int) ([]*mm_model.User, error)

	// Permissions service
	HasPermissionTo(userID string, permission *mm_model.Permission) bool
	HasPermissionToTeam(userID, teamID string, permission *mm_model.Permission) bool
	HasPermissionToChannel(askingUserID string, channelID string, permission *mm_model.Permission) bool
	RolesGrantPermission(roleNames []string, permissionID string) bool

	// Bot service
	EnsureBot(bot *mm_model.Bot) (string, error)

	// License service
	GetLicense() *mm_model.License
	RequestTrialLicense(requesterID string, users int, termsAccepted bool, receiveEmailsAccepted bool) error

	// FileInfoStore service
	GetFileInfo(fileID string) (*mm_model.FileInfo, error)

	// Cluster service
	PublishWebSocketEvent(event string, payload map[string]interface{}, broadcast *mm_model.WebsocketBroadcast)
	PublishPluginClusterEvent(ev mm_model.PluginClusterEvent, opts mm_model.PluginClusterEventSendOptions) error

	// Cloud service
	GetCloudLimits() (*mm_model.ProductLimits, error)

	// Config service
	GetConfig() *mm_model.Config
	LoadPluginConfiguration(dest any) error
	SavePluginConfig(pluginConfig map[string]any) error

	// KVStore service
	KVSetWithOptions(key string, value []byte, options mm_model.PluginKVSetOptions) (bool, error)
	Get(key string, o interface{}) error
	KVGet(key string) ([]byte, error)
	KVDelete(key string) error
	KVList(page, count int) ([]string, error)

	// Store service
	GetMasterDB() (*sql.DB, error)
	DriverName() string

	// System service
	GetDiagnosticID() string
	GetServerVersion() string

	// Router service
	RegisterRouter(sub *mux.Router)

	// Preferences services
	GetPreferencesForUser(userID string) (mm_model.Preferences, error)
	UpdatePreferencesForUser(userID string, preferences mm_model.Preferences) error
	DeletePreferencesForUser(userID string, preferences mm_model.Preferences) error

	// Session service
	GetSession(sessionID string) (*mm_model.Session, error)

	// Frontend service
	OpenInteractiveDialog(dialog mm_model.OpenDialogRequest) error

	// Command service
	Execute(command *mm_model.CommandArgs) (*mm_model.CommandResponse, error)
	RegisterCommand(command *mm_model.Command) error

	// Threads service
	RegisterCollectionAndTopic(collectionType, topicType string) error

	IsEnterpriseReady() bool
}
