// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate mockgen --build_flags= -copyright_file=../../copyright.txt -destination=mocks/mockservicesapi.go -package mocks . ServicesAPI

package model

import (
	"database/sql"

	"github.com/gorilla/mux"

	mm_model "github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	botUsername    = "boards"
	botDisplayname = "Boards"
	botDescription = "Created by Boards plugin."
)

func GetDefaultFocalboardBot() *mm_model.Bot {
	return &mm_model.Bot{
		Username:    botUsername,
		DisplayName: botDisplayname,
		Description: botDescription,
		OwnerId:     SystemUserID,
	}
}

type ServicesAPI interface {
	// Channels service
	GetDirectChannel(userID1, userID2 string) (*mm_model.Channel, error)
	GetDirectChannelOrCreate(userID1, userID2 string) (*mm_model.Channel, error)
	GetChannelByID(channelID string) (*mm_model.Channel, error)
	GetChannelMember(channelID string, userID string) (*mm_model.ChannelMember, error)
	GetChannelsForTeamForUser(teamID string, userID string, includeDeleted bool) (mm_model.ChannelList, error)

	// Post service
	CreatePost(post *mm_model.Post) (*mm_model.Post, error)

	// User service
	GetUserByID(userID string) (*mm_model.User, error)
	GetUserByUsername(name string) (*mm_model.User, error)
	GetUserByEmail(email string) (*mm_model.User, error)
	UpdateUser(user *mm_model.User) (*mm_model.User, error)
	GetUsersFromProfiles(options *mm_model.UserGetOptions) ([]*mm_model.User, error)

	// Team service
	GetTeamMember(teamID string, userID string) (*mm_model.TeamMember, error)
	CreateMember(teamID string, userID string) (*mm_model.TeamMember, error)

	// Permissions service
	HasPermissionTo(userID string, permission *mm_model.Permission) bool
	HasPermissionToTeam(userID, teamID string, permission *mm_model.Permission) bool
	HasPermissionToChannel(askingUserID string, channelID string, permission *mm_model.Permission) bool

	// Bot service
	EnsureBot(bot *mm_model.Bot) (string, error)

	// License service
	GetLicense() *mm_model.License

	// FileInfoStore service
	GetFileInfo(fileID string) (*mm_model.FileInfo, error)

	// Cluster service
	PublishWebSocketEvent(event string, payload map[string]interface{}, broadcast *mm_model.WebsocketBroadcast)
	PublishPluginClusterEvent(ev mm_model.PluginClusterEvent, opts mm_model.PluginClusterEventSendOptions) error

	// Cloud service
	GetCloudLimits() (*mm_model.ProductLimits, error)

	// Config service
	GetConfig() *mm_model.Config

	// Logger service
	GetLogger() mlog.LoggerIFace

	// KVStore service
	KVSetWithOptions(key string, value []byte, options mm_model.PluginKVSetOptions) (bool, error)

	// Store service
	GetMasterDB() (*sql.DB, error)

	// System service
	GetDiagnosticID() string

	// Router service
	RegisterRouter(sub *mux.Router)

	// Preferences services
	GetPreferencesForUser(userID string) (mm_model.Preferences, error)
	UpdatePreferencesForUser(userID string, preferences mm_model.Preferences) error
	DeletePreferencesForUser(userID string, preferences mm_model.Preferences) error
}
