package importexport

import (
	"io"
	"mime/multipart"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
)

type ExporterAppIface interface {
	GetPreferencesForUser(userId string) (model.Preferences, *model.AppError)
	GetPreferenceByCategoryForUser(userId string, category string) (model.Preferences, *model.AppError)
	GetEmojiList(page, perPage int, sort string) ([]*model.Emoji, *model.AppError)
}

type ImporterAppIface interface {
	CreateScheme(scheme *model.Scheme) (*model.Scheme, *model.AppError)
	UpdateScheme(scheme *model.Scheme) (*model.Scheme, *model.AppError)
	GetSchemeByName(name string) (*model.Scheme, *model.AppError)
	CreateRole(role *model.Role) (*model.Role, *model.AppError)
	UpdateRole(role *model.Role) (*model.Role, *model.AppError)
	GetRoleByName(name string) (*model.Role, *model.AppError)
	CreateTeam(team *model.Team) (*model.Team, *model.AppError)
	CreateChannel(channel *model.Channel, addMember bool) (*model.Channel, *model.AppError)
	UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError)
	UpdateUser(user *model.User, sendNotifications bool) (*model.User, *model.AppError)
	UpdateUserRoles(userId string, newRoles string, sendWebSocketEvent bool) (*model.User, *model.AppError)
	UpdateUserNotifyProps(userId string, props map[string]string) (*model.User, *model.AppError)
	UpdatePassword(user *model.User, newPassword string) *model.AppError
	VerifyUserEmail(userId, email string) *model.AppError
	SetProfileImageFromMultiPartFile(userId string, file multipart.File) *model.AppError
	UserIsInAdminRoleGroup(userID, syncableID string, syncableType model.GroupSyncableType) (bool, *model.AppError)
	UpdateTeamMemberRoles(teamId string, userId string, newRoles string) (*model.TeamMember, *model.AppError)
	UpdateTeamMemberSchemeRoles(teamId string, userId string, isSchemeGuest bool, isSchemeUser bool, isSchemeAdmin bool) (*model.TeamMember, *model.AppError)
	UpdateChannelMemberRoles(channelId string, userId string, newRoles string) (*model.ChannelMember, *model.AppError)
	UpdateChannelMemberSchemeRoles(channelId string, userId string, isSchemeGuest bool, isSchemeUser bool, isSchemeAdmin bool) (*model.ChannelMember, *model.AppError)
	MaxPostSize() int
	GetFileInfosForPost(postId string, fromMaster bool) ([]*model.FileInfo, *model.AppError)
	GetFile(fileId string) ([]byte, *model.AppError)
	DoUploadFile(now time.Time, rawTeamId string, rawChannelId string, rawUserId string, rawFilename string, data []byte) (*model.FileInfo, *model.AppError)
	HandleImages(previewPathList []string, thumbnailPathList []string, fileData [][]byte)
	GetOrCreateDirectChannel(userId, otherUserId string) (*model.Channel, *model.AppError)
	WriteFile(fr io.Reader, path string) (int64, *model.AppError)
	CreateGroupChannel(userIds []string, creatorId string) (*model.Channel, *model.AppError)
	CreateUser(user *model.User) (*model.User, *model.AppError)
	UpdateTeamUnsanitized(team *model.Team) (*model.Team, *model.AppError)
}
