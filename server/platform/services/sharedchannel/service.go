// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

const (
	TopicSync                    = "sharedchannel_sync"
	TopicChannelInvite           = "sharedchannel_invite"
	TopicUploadCreate            = "sharedchannel_upload"
	TopicChannelMembership       = "sharedchannel_membership"
	TopicGlobalUserSync          = "sharedchannel_global_user_sync"
	MaxRetries                   = 3
	MaxUsersPerSync              = 25
	NotifyRemoteOfflineThreshold = time.Second * 10
	NotifyMinimumDelay           = time.Second * 2
	MaxUpsertRetries             = 25
	ProfileImageSyncTimeout      = time.Second * 5
	UnshareMessage               = "This channel is no longer shared."
	// Default value for MaxMembersPerBatch is defined in config.go as ConnectedWorkspacesSettingsDefaultMemberSyncBatchSize
)

// Mocks can be re-generated with `make sharedchannel-mocks`.
type ServerIface interface {
	Config() *model.Config
	IsLeader() bool
	AddClusterLeaderChangedListener(listener func()) string
	RemoveClusterLeaderChangedListener(id string)
	GetStore() store.Store
	Log() *mlog.Logger
	GetRemoteClusterService() remotecluster.RemoteClusterServiceIFace
	GetMetrics() einterfaces.MetricsInterface
}

type PlatformIface interface {
	InvalidateCacheForUser(userID string)
	InvalidateCacheForChannel(channel *model.Channel)
}

type AppIface interface {
	SendEphemeralPost(c request.CTX, userId string, post *model.Post) *model.Post
	CreateChannelWithUser(c request.CTX, channel *model.Channel, userId string) (*model.Channel, *model.AppError)
	GetOrCreateDirectChannel(c request.CTX, userId, otherUserId string, channelOptions ...model.ChannelOption) (*model.Channel, *model.AppError)
	CreateGroupChannel(c request.CTX, userIDs []string, creatorId string, channelOptions ...model.ChannelOption) (*model.Channel, *model.AppError)
	UserCanSeeOtherUser(c request.CTX, userID string, otherUserId string) (bool, *model.AppError)
	AddUserToChannel(c request.CTX, user *model.User, channel *model.Channel, skipTeamMemberIntegrityCheck bool) (*model.ChannelMember, *model.AppError)
	AddUserToTeamByTeamId(c request.CTX, teamId string, user *model.User) *model.AppError
	RemoveUserFromChannel(c request.CTX, userID string, removerUserId string, channel *model.Channel) *model.AppError
	PermanentDeleteChannel(c request.CTX, channel *model.Channel) *model.AppError
	CreatePost(c request.CTX, post *model.Post, channel *model.Channel, flags model.CreatePostFlags) (savedPost *model.Post, err *model.AppError)
	UpdatePost(c request.CTX, post *model.Post, updatePostOptions *model.UpdatePostOptions) (*model.Post, *model.AppError)
	DeletePost(c request.CTX, postID, deleteByID string) (*model.Post, *model.AppError)
	SaveReactionForPost(c request.CTX, reaction *model.Reaction) (*model.Reaction, *model.AppError)
	DeleteReactionForPost(c request.CTX, reaction *model.Reaction) *model.AppError
	SaveAndBroadcastStatus(status *model.Status)
	PatchChannelModerationsForChannel(c request.CTX, channel *model.Channel, channelModerationsPatch []*model.ChannelModerationPatch) ([]*model.ChannelModeration, *model.AppError)
	CreateUploadSession(c request.CTX, us *model.UploadSession) (*model.UploadSession, *model.AppError)
	FileReader(path string) (filestore.ReadCloseSeeker, *model.AppError)
	MentionsToTeamMembers(c request.CTX, message, teamID string) model.UserMentionMap
	GetProfileImage(user *model.User) ([]byte, bool, *model.AppError)
	NotifySharedChannelUserUpdate(user *model.User)
	OnSharedChannelsSyncMsg(msg *model.SyncMsg, rc *model.RemoteCluster) (model.SyncResponse, error)
	OnSharedChannelsAttachmentSyncMsg(fi *model.FileInfo, post *model.Post, rc *model.RemoteCluster) error
	OnSharedChannelsProfileImageSyncMsg(user *model.User, rc *model.RemoteCluster) error
	Publish(message *model.WebSocketEvent)
	SaveAcknowledgementForPostWithModel(c request.CTX, acknowledgement *model.PostAcknowledgement) (*model.PostAcknowledgement, *model.AppError)
	DeleteAcknowledgementForPostWithModel(c request.CTX, acknowledgement *model.PostAcknowledgement) *model.AppError
	SaveAcknowledgementsForPost(c request.CTX, postID string, userIDs []string) ([]*model.PostAcknowledgement, *model.AppError)
	GetAcknowledgementsForPost(postID string) ([]*model.PostAcknowledgement, *model.AppError)
	PreparePostForClient(c request.CTX, post *model.Post, isNewPost, includeDeleted, includePriority bool) *model.Post
}

// errNotFound allows checking against Store.ErrNotFound errors without making Store a dependency.
type errNotFound interface {
	IsErrNotFound() bool
}

// Service provides shared channel synchronization.
type Service struct {
	server       ServerIface
	platform     PlatformIface
	app          AppIface
	changeSignal chan struct{}

	// everything below guarded by `mux`
	mux              sync.RWMutex
	active           bool
	leaderListenerId string

	connectionStateListenerId string
	done                      chan struct{}
	tasks                     map[string]syncTask
	syncTopicListenerId       string
	inviteTopicListenerId     string
	uploadTopicListenerId     string
	globalSyncTopicListenerId string
	siteURL                   *url.URL
}

// NewSharedChannelService creates a RemoteClusterService instance.
func NewSharedChannelService(server ServerIface, platform PlatformIface, app AppIface) (*Service, error) {
	service := &Service{
		server:       server,
		platform:     platform,
		app:          app,
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}
	parsed, err := url.Parse(*server.Config().ServiceSettings.SiteURL)
	if err != nil {
		return nil, fmt.Errorf("unable to parse SiteURL: %w", err)
	}
	service.siteURL = parsed
	return service, nil
}

// Start is called by the server on server start-up.
func (scs *Service) Start() error {
	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil || !rcs.Active() {
		return errors.New("Shared Channel Service cannot activate: requires Remote Cluster Service")
	}

	scs.mux.Lock()
	scs.leaderListenerId = scs.server.AddClusterLeaderChangedListener(scs.onClusterLeaderChange)
	scs.syncTopicListenerId = rcs.AddTopicListener(TopicSync, scs.onReceiveSyncMessage)
	scs.inviteTopicListenerId = rcs.AddTopicListener(TopicChannelInvite, scs.onReceiveChannelInvite)
	scs.uploadTopicListenerId = rcs.AddTopicListener(TopicUploadCreate, scs.onReceiveUploadCreate)
	scs.globalSyncTopicListenerId = rcs.AddTopicListener(TopicGlobalUserSync, scs.onReceiveSyncMessage)
	scs.connectionStateListenerId = rcs.AddConnectionStateListener(scs.onConnectionStateChange)
	scs.mux.Unlock()

	rcs.AddTopicListener(TopicChannelMembership, scs.onReceiveSyncMessage)

	scs.onClusterLeaderChange()

	return nil
}

// Shutdown is called by the server on server shutdown.
func (scs *Service) Shutdown() error {
	rcs := scs.server.GetRemoteClusterService()
	if rcs == nil || !rcs.Active() {
		return errors.New("Shared Channel Service cannot shutdown: requires Remote Cluster Service")
	}

	scs.mux.Lock()
	id := scs.leaderListenerId
	rcs.RemoveTopicListener(scs.syncTopicListenerId)
	scs.syncTopicListenerId = ""
	rcs.RemoveTopicListener(scs.inviteTopicListenerId)
	scs.inviteTopicListenerId = ""
	rcs.RemoveConnectionStateListener(scs.connectionStateListenerId)
	scs.connectionStateListenerId = ""
	scs.mux.Unlock()

	scs.server.RemoveClusterLeaderChangedListener(id)
	scs.pause()
	return nil
}

// Active determines whether the service is active on the node or not.
func (scs *Service) Active() bool {
	scs.mux.Lock()
	defer scs.mux.Unlock()

	return scs.active
}

func (scs *Service) sendEphemeralPost(channelId string, userId string, text string) {
	ephemeral := &model.Post{
		ChannelId: channelId,
		Message:   text,
		CreateAt:  model.GetMillis(),
	}
	scs.app.SendEphemeralPost(request.EmptyContext(scs.server.Log()), userId, ephemeral)
}

// onClusterLeaderChange is called whenever the cluster leader may have changed.
func (scs *Service) onClusterLeaderChange() {
	if scs.server.IsLeader() {
		scs.resume()
	} else {
		scs.pause()
	}
}

func (scs *Service) resume() {
	scs.mux.Lock()
	defer scs.mux.Unlock()

	if scs.active {
		return // already active
	}

	scs.active = true
	scs.done = make(chan struct{})

	go scs.syncLoop(scs.done)

	scs.server.Log().Debug("Shared Channel Service active")
}

func (scs *Service) pause() {
	scs.mux.Lock()
	defer scs.mux.Unlock()

	if !scs.active {
		return // already inactive
	}

	scs.active = false
	close(scs.done)
	scs.done = nil

	scs.server.Log().Debug("Shared Channel Service inactive")
}

// GetMemberSyncBatchSize returns the configured batch size for member synchronization
func (scs *Service) GetMemberSyncBatchSize() int {
	if scs.server.Config().ConnectedWorkspacesSettings.MemberSyncBatchSize != nil {
		return *scs.server.Config().ConnectedWorkspacesSettings.MemberSyncBatchSize
	}
	return model.ConnectedWorkspacesSettingsDefaultMemberSyncBatchSize
}

// Makes the remote channel to be read-only(announcement mode, only admins can create posts and reactions).
func (scs *Service) makeChannelReadOnly(channel *model.Channel) *model.AppError {
	createPostPermission := model.ChannelModeratedPermissionsMap[model.PermissionCreatePost.Id]
	createReactionPermission := model.ChannelModeratedPermissionsMap[model.PermissionAddReaction.Id]
	updateMap := model.ChannelModeratedRolesPatch{
		Guests:  model.NewPointer(false),
		Members: model.NewPointer(false),
	}

	readonlyChannelModerations := []*model.ChannelModerationPatch{
		{
			Name:  &createPostPermission,
			Roles: &updateMap,
		},
		{
			Name:  &createReactionPermission,
			Roles: &updateMap,
		},
	}

	_, err := scs.app.PatchChannelModerationsForChannel(request.EmptyContext(scs.server.Log()), channel, readonlyChannelModerations)
	return err
}

// onConnectionStateChange is called whenever the connection state of a remote cluster changes,
// for example when one comes back online.
func (scs *Service) onConnectionStateChange(rc *model.RemoteCluster, online bool) {
	if online {
		// when a previously offline remote comes back online force a sync.
		scs.SendPendingInvitesForRemote(rc)
		scs.ForceSyncForRemote(rc)

		// Schedule global user sync if feature is enabled
		scs.scheduleGlobalUserSync(rc)
	}

	scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Remote cluster connection status changed",
		mlog.String("remote", rc.DisplayName),
		mlog.String("remoteId", rc.RemoteId),
		mlog.Bool("online", online),
	)
}

func (scs *Service) notifyClientsForSharedChannelConverted(channel *model.Channel) {
	scs.platform.InvalidateCacheForChannel(channel)
	messageWs := model.NewWebSocketEvent(model.WebsocketEventChannelUpdated, "", channel.Id, "", nil, "")
	channelJSON, err := json.Marshal(channel)
	if err != nil {
		scs.server.Log().Log(mlog.LvlSharedChannelServiceWarn, "Cannot marshal channel to notify clients",
			mlog.String("channel_id", channel.Id),
			mlog.Err(err),
		)
		return
	}
	messageWs.Add("channel", string(channelJSON))

	scs.app.Publish(messageWs)
}

func (scs *Service) notifyClientsForSharedChannelUpdate(channel *model.Channel) {
	messageWs := model.NewWebSocketEvent(model.WebsocketEventChannelUpdated, channel.TeamId, "", "", nil, "")
	messageWs.Add("channel_id", channel.Id)
	scs.app.Publish(messageWs)
}

// postUnshareNotification posts a system message to notify users that the channel is no longer shared.
func (scs *Service) postUnshareNotification(channelID string, creatorID string, channel *model.Channel, rc *model.RemoteCluster) {
	post := &model.Post{
		UserId:    creatorID,
		ChannelId: channelID,
		Message:   UnshareMessage,
		Type:      model.PostTypeSystemGeneric,
	}

	logger := scs.server.Log()
	_, appErr := scs.app.CreatePost(request.EmptyContext(logger), post, channel, model.CreatePostFlags{})

	if appErr != nil {
		scs.server.Log().Log(
			mlog.LvlSharedChannelServiceError,
			"Error creating unshare notification post",
			mlog.String("channel_id", channelID),
			mlog.String("remote_id", rc.RemoteId),
			mlog.String("remote_name", rc.Name),
			mlog.Err(appErr),
		)
	}
}

// IsRemoteClusterDirectlyConnected checks if a remote cluster has a direct connection to the current server
func (scs *Service) IsRemoteClusterDirectlyConnected(remoteId string) bool {
	if remoteId == "" {
		scs.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()), "IsRemoteClusterDirectlyConnected: Empty remoteId - returning true (local)")
		return true // Local server is always "directly connected"
	}

	scs.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()), fmt.Sprintf("IsRemoteClusterDirectlyConnected: Checking remote cluster %s", remoteId))

	// Check if the remote cluster exists and confirmed
	rc, err := scs.server.GetStore().RemoteCluster().Get(remoteId, false)
	if err != nil {
		scs.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()), fmt.Sprintf("IsRemoteClusterDirectlyConnected: Error getting remote cluster %s: %v - returning false", remoteId, err))
		return false
	}

	isConfirmed := rc.IsConfirmed()
	scs.PostDebugToTownSquare(request.EmptyContext(scs.server.Log()), fmt.Sprintf("IsRemoteClusterDirectlyConnected: Remote cluster %s - Name: %s, SiteURL: %s, IsConfirmed: %v", remoteId, rc.Name, rc.SiteURL, isConfirmed))

	return isConfirmed
}

// OnReceiveSyncMessageForTesting is a wrapper to expose onReceiveSyncMessage for testing purposes
// isGlobalUserSyncEnabled checks if the global user sync feature is enabled
func (scs *Service) isGlobalUserSyncEnabled() bool {
	cfg := scs.server.Config()

	return cfg.FeatureFlags.EnableSyncAllUsersForRemoteCluster ||
		(cfg.ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen != nil && *cfg.ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen)
}

// scheduleGlobalUserSync schedules a task to sync all users with a remote cluster
func (scs *Service) scheduleGlobalUserSync(rc *model.RemoteCluster) {
	if !scs.isGlobalUserSyncEnabled() {
		return
	}

	// Schedule the sync task
	go func() {
		// Create a special sync task with empty channelID
		// This empty channelID is a deliberate marker for a global user sync task
		task := newSyncTask("", "", rc.RemoteId, nil, nil)
		task.schedule = time.Now().Add(NotifyMinimumDelay)
		scs.addTask(task)

		scs.server.Log().Log(mlog.LvlSharedChannelServiceDebug, "Scheduled global user sync task for remote",
			mlog.String("remote", rc.DisplayName),
			mlog.String("remoteId", rc.RemoteId),
		)
	}()
}

// HasPendingTasksForTesting returns true if there are pending sync tasks in the queue
func (scs *Service) HasPendingTasksForTesting() bool {
	scs.mux.RLock()
	defer scs.mux.RUnlock()
	return len(scs.tasks) > 0
}

// HandleSyncAllUsersForTesting exposes syncAllUsers for testing
func (scs *Service) HandleSyncAllUsersForTesting(rc *model.RemoteCluster) error {
	return scs.syncAllUsers(rc)
}

// OnReceiveSyncMessageForTesting exposes onReceiveSyncMessage for testing
func (scs *Service) OnReceiveSyncMessageForTesting(msg model.RemoteClusterMsg, rc *model.RemoteCluster, response *remotecluster.Response) error {
	return scs.onReceiveSyncMessage(msg, rc, response)
}

// HandleChannelNotSharedErrorForTesting is a wrapper to expose handleChannelNotSharedError for testing purposes
func (scs *Service) HandleChannelNotSharedErrorForTesting(msg *model.SyncMsg, rc *model.RemoteCluster) {
	scs.handleChannelNotSharedError(msg, rc)
}

// PostDebugToTownSquare posts a debug message to the town square channel
func (scs *Service) PostDebugToTownSquare(c request.CTX, message string) {
	// For interface compatibility, use empty channel ID and find a user
	scs.postDebugToTownSquareWithContext(c, "", "", message)
}

// postDebugToTownSquareWithContext is the internal method with full context
func (scs *Service) postDebugToTownSquareWithContext(c request.CTX, channelId, userId, message string) {
	// Include the original channel ID in the message for context if provided
	debugMessage := message
	if channelId != "" {
		debugMessage = fmt.Sprintf("[SharedChannel:%s] %s", channelId, message)
	}

	// Create the post asynchronously to avoid recursive notification calls
	go func() {
		// Get the first available team's town-square channel
		teams, terr := scs.server.GetStore().Team().GetAll()
		if terr != nil || len(teams) == 0 {
			scs.server.Log().Warn("Failed to find any team for debug message", mlog.Err(terr))
			return
		}

		// Find town-square channel
		var townSquare *model.Channel
		var err error
		for _, team := range teams {
			townSquare, err = scs.server.GetStore().Channel().GetByName(team.Id, model.DefaultChannelName, false)
			if err == nil {
				break
			}
		}

		if townSquare == nil {
			scs.server.Log().Warn("Failed to find town square channel for debug message")
			return
		}

		// If no user ID provided, find one
		if userId == "" {
			// Get any admin user to post the message
			admins, err := scs.server.GetStore().User().GetSystemAdminProfiles()
			if err != nil || len(admins) == 0 {
				scs.server.Log().Warn("Failed to find admin user for debug message", mlog.Err(err))
				return
			}
			// Get the first admin user ID from the map
			for uid := range admins {
				userId = uid
				break
			}
		}

		post := &model.Post{
			ChannelId: townSquare.Id,
			Message:   debugMessage,
			Type:      model.PostTypeSystemGeneric,
			UserId:    userId,
			CreateAt:  model.GetMillis(),
		}

		// Create a new context for the async operation
		asyncCtx := request.EmptyContext(scs.server.Log())
		_, appErr := scs.app.CreatePost(asyncCtx, post, townSquare, model.CreatePostFlags{})
		if appErr != nil {
			scs.server.Log().Warn("Failed to post debug message to town square",
				mlog.String("channel_id", townSquare.Id),
				mlog.Err(appErr))
		}
	}()
}
