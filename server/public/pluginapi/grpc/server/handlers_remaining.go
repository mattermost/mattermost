// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
)

// =============================================================================
// Licensing & System Information
// =============================================================================

func (s *APIServer) GetLicense(ctx context.Context, req *pb.GetLicenseRequest) (*pb.GetLicenseResponse, error) {
	license := s.impl.GetLicense()
	return &pb.GetLicenseResponse{
		LicenseJson: licenseToJSON(license),
	}, nil
}

func (s *APIServer) GetSystemInstallDate(ctx context.Context, req *pb.GetSystemInstallDateRequest) (*pb.GetSystemInstallDateResponse, error) {
	installDate, appErr := s.impl.GetSystemInstallDate()
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetSystemInstallDateResponse{
		InstallDate: installDate,
	}, nil
}

func (s *APIServer) GetDiagnosticId(ctx context.Context, req *pb.GetDiagnosticIdRequest) (*pb.GetDiagnosticIdResponse, error) {
	diagnosticId := s.impl.GetDiagnosticId()
	return &pb.GetDiagnosticIdResponse{
		DiagnosticId: diagnosticId,
	}, nil
}

func (s *APIServer) GetTelemetryId(ctx context.Context, req *pb.GetTelemetryIdRequest) (*pb.GetTelemetryIdResponse, error) {
	telemetryId := s.impl.GetTelemetryId()
	return &pb.GetTelemetryIdResponse{
		TelemetryId: telemetryId,
	}, nil
}

// =============================================================================
// Configuration
// =============================================================================

func (s *APIServer) LoadPluginConfiguration(ctx context.Context, req *pb.LoadPluginConfigurationRequest) (*pb.LoadPluginConfigurationResponse, error) {
	// LoadPluginConfiguration loads the plugin's configuration into a dest struct.
	// The proto has no input fields; it returns the configuration JSON.
	var configMap map[string]interface{}
	err := s.impl.LoadPluginConfiguration(&configMap)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to load plugin configuration: %v", err)
	}

	// Re-marshal the populated config back to JSON
	resultJSON, jsonErr := json.Marshal(configMap)
	if jsonErr != nil {
		return nil, status.Errorf(codes.Internal, "failed to marshal result: %v", jsonErr)
	}

	return &pb.LoadPluginConfigurationResponse{
		ConfigJson: resultJSON,
	}, nil
}

func (s *APIServer) GetConfig(ctx context.Context, req *pb.GetConfigRequest) (*pb.GetConfigResponse, error) {
	config := s.impl.GetConfig()
	if config == nil {
		return &pb.GetConfigResponse{}, nil
	}

	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to marshal config: %v", err)
	}

	return &pb.GetConfigResponse{
		ConfigJson: configJSON,
	}, nil
}

func (s *APIServer) GetUnsanitizedConfig(ctx context.Context, req *pb.GetUnsanitizedConfigRequest) (*pb.GetUnsanitizedConfigResponse, error) {
	config := s.impl.GetUnsanitizedConfig()
	if config == nil {
		return &pb.GetUnsanitizedConfigResponse{}, nil
	}

	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to marshal config: %v", err)
	}

	return &pb.GetUnsanitizedConfigResponse{
		ConfigJson: configJSON,
	}, nil
}

func (s *APIServer) SaveConfig(ctx context.Context, req *pb.SaveConfigRequest) (*pb.SaveConfigResponse, error) {
	configJSON := req.GetConfigJson()
	if len(configJSON) == 0 {
		return nil, status.Error(codes.InvalidArgument, "config_json is required")
	}

	var config model.Config
	if err := json.Unmarshal(configJSON, &config); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "failed to unmarshal config: %v", err)
	}

	appErr := s.impl.SaveConfig(&config)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.SaveConfigResponse{}, nil
}

func (s *APIServer) GetPluginConfig(ctx context.Context, req *pb.GetPluginConfigRequest) (*pb.GetPluginConfigResponse, error) {
	config := s.impl.GetPluginConfig()
	if config == nil {
		return &pb.GetPluginConfigResponse{}, nil
	}

	// Convert map[string]interface{} to structpb.Struct
	pbStruct, err := structpb.NewStruct(config)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert config to struct: %v", err)
	}

	return &pb.GetPluginConfigResponse{
		Config: pbStruct,
	}, nil
}

func (s *APIServer) SavePluginConfig(ctx context.Context, req *pb.SavePluginConfigRequest) (*pb.SavePluginConfigResponse, error) {
	config := req.GetConfig()
	if config == nil {
		return nil, status.Error(codes.InvalidArgument, "config is required")
	}

	appErr := s.impl.SavePluginConfig(config.AsMap())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.SavePluginConfigResponse{}, nil
}

// =============================================================================
// Plugin Management
// =============================================================================

func (s *APIServer) GetBundlePath(ctx context.Context, req *pb.GetBundlePathRequest) (*pb.GetBundlePathResponse, error) {
	path, err := s.impl.GetBundlePath()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get bundle path: %v", err)
	}
	return &pb.GetBundlePathResponse{
		Path: path,
	}, nil
}

func (s *APIServer) GetPlugins(ctx context.Context, req *pb.GetPluginsRequest) (*pb.GetPluginsResponse, error) {
	plugins, appErr := s.impl.GetPlugins()
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	// GetPlugins returns []*model.Manifest directly
	return &pb.GetPluginsResponse{
		Manifests: manifestsToProto(plugins),
	}, nil
}

func (s *APIServer) EnablePlugin(ctx context.Context, req *pb.EnablePluginRequest) (*pb.EnablePluginResponse, error) {
	appErr := s.impl.EnablePlugin(req.GetId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.EnablePluginResponse{}, nil
}

func (s *APIServer) DisablePlugin(ctx context.Context, req *pb.DisablePluginRequest) (*pb.DisablePluginResponse, error) {
	appErr := s.impl.DisablePlugin(req.GetId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.DisablePluginResponse{}, nil
}

func (s *APIServer) RemovePlugin(ctx context.Context, req *pb.RemovePluginRequest) (*pb.RemovePluginResponse, error) {
	appErr := s.impl.RemovePlugin(req.GetId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.RemovePluginResponse{}, nil
}

func (s *APIServer) GetPluginStatus(ctx context.Context, req *pb.GetPluginStatusRequest) (*pb.GetPluginStatusResponse, error) {
	pluginStatus, appErr := s.impl.GetPluginStatus(req.GetId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetPluginStatusResponse{
		Status: pluginStatusToProto(pluginStatus),
	}, nil
}

func (s *APIServer) InstallPlugin(ctx context.Context, req *pb.InstallPluginRequest) (*pb.InstallPluginResponse, error) {
	file := bytes.NewReader(req.GetFileData())
	manifest, appErr := s.impl.InstallPlugin(file, req.GetReplace())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.InstallPluginResponse{
		Manifest: manifestToProto(manifest),
	}, nil
}

// =============================================================================
// Logging
// =============================================================================

func (s *APIServer) LogDebug(ctx context.Context, req *pb.LogDebugRequest) (*pb.LogDebugResponse, error) {
	s.impl.LogDebug(req.GetMsg(), flattenKeyValuePairs(req.GetKeyValuePairs())...)
	return &pb.LogDebugResponse{}, nil
}

func (s *APIServer) LogInfo(ctx context.Context, req *pb.LogInfoRequest) (*pb.LogInfoResponse, error) {
	s.impl.LogInfo(req.GetMsg(), flattenKeyValuePairs(req.GetKeyValuePairs())...)
	return &pb.LogInfoResponse{}, nil
}

func (s *APIServer) LogWarn(ctx context.Context, req *pb.LogWarnRequest) (*pb.LogWarnResponse, error) {
	s.impl.LogWarn(req.GetMsg(), flattenKeyValuePairs(req.GetKeyValuePairs())...)
	return &pb.LogWarnResponse{}, nil
}

func (s *APIServer) LogError(ctx context.Context, req *pb.LogErrorRequest) (*pb.LogErrorResponse, error) {
	s.impl.LogError(req.GetMsg(), flattenKeyValuePairs(req.GetKeyValuePairs())...)
	return &pb.LogErrorResponse{}, nil
}

// flattenKeyValuePairs converts KeyValuePair slice to a flattened slice of key-value pairs.
func flattenKeyValuePairs(kv []*pb.KeyValuePair) []interface{} {
	if kv == nil {
		return nil
	}
	result := make([]interface{}, 0, len(kv)*2)
	for _, pair := range kv {
		result = append(result, pair.GetKey(), pair.GetValue())
	}
	return result
}

// =============================================================================
// Command Handlers
// =============================================================================

func (s *APIServer) RegisterCommand(ctx context.Context, req *pb.RegisterCommandRequest) (*pb.RegisterCommandResponse, error) {
	cmd := commandFromProto(req.GetCommand())
	if cmd == nil {
		return nil, status.Error(codes.InvalidArgument, "command is required")
	}

	err := s.impl.RegisterCommand(cmd)
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.RegisterCommandResponse{}, nil
}

func (s *APIServer) UnregisterCommand(ctx context.Context, req *pb.UnregisterCommandRequest) (*pb.UnregisterCommandResponse, error) {
	err := s.impl.UnregisterCommand(req.GetTeamId(), req.GetTrigger())
	if err != nil {
		return nil, ErrorToStatus(err)
	}
	return &pb.UnregisterCommandResponse{}, nil
}

func (s *APIServer) ExecuteSlashCommand(ctx context.Context, req *pb.ExecuteSlashCommandRequest) (*pb.ExecuteSlashCommandResponse, error) {
	args := commandArgsFromProto(req.GetCommandArgs())
	if args == nil {
		return nil, status.Error(codes.InvalidArgument, "command_args is required")
	}

	resp, err := s.impl.ExecuteSlashCommand(args)
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.ExecuteSlashCommandResponse{
		Response: commandResponseToProto(resp),
	}, nil
}

func (s *APIServer) CreateCommand(ctx context.Context, req *pb.CreateCommandRequest) (*pb.CreateCommandResponse, error) {
	cmd := commandFromProto(req.GetCmd())
	if cmd == nil {
		return nil, status.Error(codes.InvalidArgument, "command is required")
	}

	result, err := s.impl.CreateCommand(cmd)
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.CreateCommandResponse{
		Command: commandToProto(result),
	}, nil
}

func (s *APIServer) ListCommands(ctx context.Context, req *pb.ListCommandsRequest) (*pb.ListCommandsResponse, error) {
	commands, err := s.impl.ListCommands(req.GetTeamId())
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.ListCommandsResponse{
		Commands: commandsToProto(commands),
	}, nil
}

func (s *APIServer) ListCustomCommands(ctx context.Context, req *pb.ListCustomCommandsRequest) (*pb.ListCustomCommandsResponse, error) {
	commands, err := s.impl.ListCustomCommands(req.GetTeamId())
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.ListCustomCommandsResponse{
		Commands: commandsToProto(commands),
	}, nil
}

func (s *APIServer) ListPluginCommands(ctx context.Context, req *pb.ListPluginCommandsRequest) (*pb.ListPluginCommandsResponse, error) {
	commands, err := s.impl.ListPluginCommands(req.GetTeamId())
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.ListPluginCommandsResponse{
		Commands: commandsToProto(commands),
	}, nil
}

func (s *APIServer) ListBuiltInCommands(ctx context.Context, req *pb.ListBuiltInCommandsRequest) (*pb.ListBuiltInCommandsResponse, error) {
	commands, err := s.impl.ListBuiltInCommands()
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.ListBuiltInCommandsResponse{
		Commands: commandsToProto(commands),
	}, nil
}

func (s *APIServer) GetCommand(ctx context.Context, req *pb.GetCommandRequest) (*pb.GetCommandResponse, error) {
	cmd, err := s.impl.GetCommand(req.GetCommandId())
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.GetCommandResponse{
		Command: commandToProto(cmd),
	}, nil
}

func (s *APIServer) UpdateCommand(ctx context.Context, req *pb.UpdateCommandRequest) (*pb.UpdateCommandResponse, error) {
	cmd := commandFromProto(req.GetUpdatedCmd())
	if cmd == nil {
		return nil, status.Error(codes.InvalidArgument, "command is required")
	}

	result, err := s.impl.UpdateCommand(req.GetCommandId(), cmd)
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.UpdateCommandResponse{
		Command: commandToProto(result),
	}, nil
}

func (s *APIServer) DeleteCommand(ctx context.Context, req *pb.DeleteCommandRequest) (*pb.DeleteCommandResponse, error) {
	err := s.impl.DeleteCommand(req.GetCommandId())
	if err != nil {
		return nil, ErrorToStatus(err)
	}
	return &pb.DeleteCommandResponse{}, nil
}

// =============================================================================
// Bot Handlers
// =============================================================================

func (s *APIServer) CreateBot(ctx context.Context, req *pb.CreateBotRequest) (*pb.CreateBotResponse, error) {
	bot := botFromProto(req.GetBot())
	if bot == nil {
		return nil, status.Error(codes.InvalidArgument, "bot is required")
	}

	result, appErr := s.impl.CreateBot(bot)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.CreateBotResponse{
		Bot: botToProto(result),
	}, nil
}

func (s *APIServer) PatchBot(ctx context.Context, req *pb.PatchBotRequest) (*pb.PatchBotResponse, error) {
	patch := botPatchFromProto(req.GetBotPatch())
	if patch == nil {
		return nil, status.Error(codes.InvalidArgument, "patch is required")
	}

	result, appErr := s.impl.PatchBot(req.GetBotUserId(), patch)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.PatchBotResponse{
		Bot: botToProto(result),
	}, nil
}

func (s *APIServer) GetBot(ctx context.Context, req *pb.GetBotRequest) (*pb.GetBotResponse, error) {
	bot, appErr := s.impl.GetBot(req.GetBotUserId(), req.GetIncludeDeleted())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.GetBotResponse{
		Bot: botToProto(bot),
	}, nil
}

func (s *APIServer) GetBots(ctx context.Context, req *pb.GetBotsRequest) (*pb.GetBotsResponse, error) {
	opts := botGetOptionsFromProto(req.GetOptions())
	if opts == nil {
		opts = &model.BotGetOptions{}
	}

	bots, appErr := s.impl.GetBots(opts)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.GetBotsResponse{
		Bots: botsToProto(bots),
	}, nil
}

func (s *APIServer) UpdateBotActive(ctx context.Context, req *pb.UpdateBotActiveRequest) (*pb.UpdateBotActiveResponse, error) {
	bot, appErr := s.impl.UpdateBotActive(req.GetBotUserId(), req.GetActive())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.UpdateBotActiveResponse{
		Bot: botToProto(bot),
	}, nil
}

func (s *APIServer) PermanentDeleteBot(ctx context.Context, req *pb.PermanentDeleteBotRequest) (*pb.PermanentDeleteBotResponse, error) {
	appErr := s.impl.PermanentDeleteBot(req.GetBotUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.PermanentDeleteBotResponse{}, nil
}

func (s *APIServer) EnsureBotUser(ctx context.Context, req *pb.EnsureBotUserRequest) (*pb.EnsureBotUserResponse, error) {
	bot := botFromProto(req.GetBot())
	if bot == nil {
		return nil, status.Error(codes.InvalidArgument, "bot is required")
	}

	botUserId, err := s.impl.EnsureBotUser(bot)
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.EnsureBotUserResponse{
		BotUserId: botUserId,
	}, nil
}

// =============================================================================
// Emoji Handlers
// =============================================================================

func (s *APIServer) GetEmoji(ctx context.Context, req *pb.GetEmojiRequest) (*pb.GetEmojiResponse, error) {
	emoji, appErr := s.impl.GetEmoji(req.GetEmojiId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetEmojiResponse{
		Emoji: emojiToProto(emoji),
	}, nil
}

func (s *APIServer) GetEmojiByName(ctx context.Context, req *pb.GetEmojiByNameRequest) (*pb.GetEmojiByNameResponse, error) {
	emoji, appErr := s.impl.GetEmojiByName(req.GetName())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetEmojiByNameResponse{
		Emoji: emojiToProto(emoji),
	}, nil
}

func (s *APIServer) GetEmojiImage(ctx context.Context, req *pb.GetEmojiImageRequest) (*pb.GetEmojiImageResponse, error) {
	data, contentType, appErr := s.impl.GetEmojiImage(req.GetEmojiId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetEmojiImageResponse{
		Image:       data,
		ContentType: contentType,
	}, nil
}

func (s *APIServer) GetEmojiList(ctx context.Context, req *pb.GetEmojiListRequest) (*pb.GetEmojiListResponse, error) {
	emojis, appErr := s.impl.GetEmojiList(req.GetSortBy(), int(req.GetPage()), int(req.GetPerPage()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetEmojiListResponse{
		Emojis: emojisToProto(emojis),
	}, nil
}

// =============================================================================
// OAuth Handlers
// =============================================================================

func (s *APIServer) CreateOAuthApp(ctx context.Context, req *pb.CreateOAuthAppRequest) (*pb.CreateOAuthAppResponse, error) {
	app := oauthAppFromProto(req.GetApp())
	if app == nil {
		return nil, status.Error(codes.InvalidArgument, "app is required")
	}

	result, appErr := s.impl.CreateOAuthApp(app)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.CreateOAuthAppResponse{
		App: oauthAppToProto(result),
	}, nil
}

func (s *APIServer) GetOAuthApp(ctx context.Context, req *pb.GetOAuthAppRequest) (*pb.GetOAuthAppResponse, error) {
	app, appErr := s.impl.GetOAuthApp(req.GetAppId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.GetOAuthAppResponse{
		App: oauthAppToProto(app),
	}, nil
}

func (s *APIServer) UpdateOAuthApp(ctx context.Context, req *pb.UpdateOAuthAppRequest) (*pb.UpdateOAuthAppResponse, error) {
	app := oauthAppFromProto(req.GetApp())
	if app == nil {
		return nil, status.Error(codes.InvalidArgument, "app is required")
	}

	result, appErr := s.impl.UpdateOAuthApp(app)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.UpdateOAuthAppResponse{
		App: oauthAppToProto(result),
	}, nil
}

func (s *APIServer) DeleteOAuthApp(ctx context.Context, req *pb.DeleteOAuthAppRequest) (*pb.DeleteOAuthAppResponse, error) {
	appErr := s.impl.DeleteOAuthApp(req.GetAppId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.DeleteOAuthAppResponse{}, nil
}

// =============================================================================
// Group Handlers
// =============================================================================

func (s *APIServer) GetGroup(ctx context.Context, req *pb.GetGroupRequest) (*pb.GetGroupResponse, error) {
	group, appErr := s.impl.GetGroup(req.GetGroupId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetGroupResponse{
		Group: groupToProto(group),
	}, nil
}

func (s *APIServer) GetGroupByName(ctx context.Context, req *pb.GetGroupByNameRequest) (*pb.GetGroupByNameResponse, error) {
	group, appErr := s.impl.GetGroupByName(req.GetName())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetGroupByNameResponse{
		Group: groupToProto(group),
	}, nil
}

func (s *APIServer) GetGroupMemberUsers(ctx context.Context, req *pb.GetGroupMemberUsersRequest) (*pb.GetGroupMemberUsersResponse, error) {
	users, appErr := s.impl.GetGroupMemberUsers(req.GetGroupId(), int(req.GetPage()), int(req.GetPerPage()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetGroupMemberUsersResponse{
		Users: usersToProto(users),
	}, nil
}

func (s *APIServer) GetGroupsBySource(ctx context.Context, req *pb.GetGroupsBySourceRequest) (*pb.GetGroupsBySourceResponse, error) {
	groups, appErr := s.impl.GetGroupsBySource(model.GroupSource(req.GetGroupSource()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetGroupsBySourceResponse{
		Groups: groupsToProto(groups),
	}, nil
}

func (s *APIServer) GetGroupsForUser(ctx context.Context, req *pb.GetGroupsForUserRequest) (*pb.GetGroupsForUserResponse, error) {
	groups, appErr := s.impl.GetGroupsForUser(req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.GetGroupsForUserResponse{
		Groups: groupsToProto(groups),
	}, nil
}

func (s *APIServer) CreateGroup(ctx context.Context, req *pb.CreateGroupRequest) (*pb.CreateGroupResponse, error) {
	group := groupFromProto(req.GetGroup())
	if group == nil {
		return nil, status.Error(codes.InvalidArgument, "group is required")
	}

	result, appErr := s.impl.CreateGroup(group)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.CreateGroupResponse{
		Group: groupToProto(result),
	}, nil
}

func (s *APIServer) DeleteGroup(ctx context.Context, req *pb.DeleteGroupRequest) (*pb.DeleteGroupResponse, error) {
	group, appErr := s.impl.DeleteGroup(req.GetGroupId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.DeleteGroupResponse{
		Group: groupToProto(group),
	}, nil
}

// Note: GetGroupChannel is already defined in handlers_channel.go

func (s *APIServer) UpsertGroupMember(ctx context.Context, req *pb.UpsertGroupMemberRequest) (*pb.UpsertGroupMemberResponse, error) {
	member, appErr := s.impl.UpsertGroupMember(req.GetGroupId(), req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.UpsertGroupMemberResponse{
		GroupMember: groupMemberToProto(member),
	}, nil
}

func (s *APIServer) DeleteGroupMember(ctx context.Context, req *pb.DeleteGroupMemberRequest) (*pb.DeleteGroupMemberResponse, error) {
	member, appErr := s.impl.DeleteGroupMember(req.GetGroupId(), req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.DeleteGroupMemberResponse{
		GroupMember: groupMemberToProto(member),
	}, nil
}

func (s *APIServer) UpsertGroupSyncable(ctx context.Context, req *pb.UpsertGroupSyncableRequest) (*pb.UpsertGroupSyncableResponse, error) {
	syncable := groupSyncableFromProto(req.GetGroupSyncable())
	if syncable == nil {
		return nil, status.Error(codes.InvalidArgument, "group_syncable is required")
	}

	result, appErr := s.impl.UpsertGroupSyncable(syncable)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.UpsertGroupSyncableResponse{
		GroupSyncable: groupSyncableToProto(result),
	}, nil
}

func (s *APIServer) GetGroupSyncable(ctx context.Context, req *pb.GetGroupSyncableRequest) (*pb.GetGroupSyncableResponse, error) {
	syncable, appErr := s.impl.GetGroupSyncable(req.GetGroupId(), req.GetSyncableId(), model.GroupSyncableType(req.GetSyncableType()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.GetGroupSyncableResponse{
		GroupSyncable: groupSyncableToProto(syncable),
	}, nil
}

func (s *APIServer) UpdateGroupSyncable(ctx context.Context, req *pb.UpdateGroupSyncableRequest) (*pb.UpdateGroupSyncableResponse, error) {
	syncable := groupSyncableFromProto(req.GetGroupSyncable())
	if syncable == nil {
		return nil, status.Error(codes.InvalidArgument, "group_syncable is required")
	}

	result, appErr := s.impl.UpdateGroupSyncable(syncable)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.UpdateGroupSyncableResponse{
		GroupSyncable: groupSyncableToProto(result),
	}, nil
}

func (s *APIServer) DeleteGroupSyncable(ctx context.Context, req *pb.DeleteGroupSyncableRequest) (*pb.DeleteGroupSyncableResponse, error) {
	syncable, appErr := s.impl.DeleteGroupSyncable(req.GetGroupId(), req.GetSyncableId(), model.GroupSyncableType(req.GetSyncableType()))
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.DeleteGroupSyncableResponse{
		GroupSyncable: groupSyncableToProto(syncable),
	}, nil
}

// =============================================================================
// Shared Channel Handlers
// =============================================================================

func (s *APIServer) ShareChannel(ctx context.Context, req *pb.ShareChannelRequest) (*pb.ShareChannelResponse, error) {
	sc := sharedChannelFromProto(req.GetSharedChannel())
	if sc == nil {
		return nil, status.Error(codes.InvalidArgument, "shared_channel is required")
	}

	result, err := s.impl.ShareChannel(sc)
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.ShareChannelResponse{
		SharedChannel: sharedChannelToProto(result),
	}, nil
}

func (s *APIServer) UpdateSharedChannel(ctx context.Context, req *pb.UpdateSharedChannelRequest) (*pb.UpdateSharedChannelResponse, error) {
	sc := sharedChannelFromProto(req.GetSharedChannel())
	if sc == nil {
		return nil, status.Error(codes.InvalidArgument, "shared_channel is required")
	}

	result, err := s.impl.UpdateSharedChannel(sc)
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.UpdateSharedChannelResponse{
		SharedChannel: sharedChannelToProto(result),
	}, nil
}

func (s *APIServer) UnshareChannel(ctx context.Context, req *pb.UnshareChannelRequest) (*pb.UnshareChannelResponse, error) {
	unshared, err := s.impl.UnshareChannel(req.GetChannelId())
	if err != nil {
		return nil, ErrorToStatus(err)
	}
	return &pb.UnshareChannelResponse{
		Unshared: unshared,
	}, nil
}

func (s *APIServer) UpdateSharedChannelCursor(ctx context.Context, req *pb.UpdateSharedChannelCursorRequest) (*pb.UpdateSharedChannelCursorResponse, error) {
	err := s.impl.UpdateSharedChannelCursor(req.GetChannelId(), req.GetRemoteId(), getPostsSinceForSyncCursorFromProto(req.GetCursor()))
	if err != nil {
		return nil, ErrorToStatus(err)
	}
	return &pb.UpdateSharedChannelCursorResponse{}, nil
}

func (s *APIServer) SyncSharedChannel(ctx context.Context, req *pb.SyncSharedChannelRequest) (*pb.SyncSharedChannelResponse, error) {
	err := s.impl.SyncSharedChannel(req.GetChannelId())
	if err != nil {
		return nil, ErrorToStatus(err)
	}
	return &pb.SyncSharedChannelResponse{}, nil
}

func (s *APIServer) RegisterPluginForSharedChannels(ctx context.Context, req *pb.RegisterPluginForSharedChannelsRequest) (*pb.RegisterPluginForSharedChannelsResponse, error) {
	opts := registerPluginOptsFromProto(req.GetOpts())
	remoteId, err := s.impl.RegisterPluginForSharedChannels(opts)
	if err != nil {
		return nil, ErrorToStatus(err)
	}
	return &pb.RegisterPluginForSharedChannelsResponse{
		RemoteId: remoteId,
	}, nil
}

func (s *APIServer) UnregisterPluginForSharedChannels(ctx context.Context, req *pb.UnregisterPluginForSharedChannelsRequest) (*pb.UnregisterPluginForSharedChannelsResponse, error) {
	err := s.impl.UnregisterPluginForSharedChannels(req.GetPluginId())
	if err != nil {
		return nil, ErrorToStatus(err)
	}
	return &pb.UnregisterPluginForSharedChannelsResponse{}, nil
}

// =============================================================================
// WebSocket Handlers
// =============================================================================

func (s *APIServer) PublishWebSocketEvent(ctx context.Context, req *pb.PublishWebSocketEventRequest) (*pb.PublishWebSocketEventResponse, error) {
	broadcast := websocketBroadcastFromProto(req.GetBroadcast())

	// Convert structpb.Struct to map[string]interface{}
	var payload map[string]interface{}
	if req.GetPayload() != nil {
		payload = req.GetPayload().AsMap()
	}

	s.impl.PublishWebSocketEvent(req.GetEvent(), payload, broadcast)
	return &pb.PublishWebSocketEventResponse{}, nil
}

// =============================================================================
// Cluster Handlers
// =============================================================================

func (s *APIServer) PublishPluginClusterEvent(ctx context.Context, req *pb.PublishPluginClusterEventRequest) (*pb.PublishPluginClusterEventResponse, error) {
	event := pluginClusterEventFromProto(req.GetEvent())
	opts := pluginClusterEventSendOptionsFromProto(req.GetOpts())

	err := s.impl.PublishPluginClusterEvent(event, opts)
	if err != nil {
		return nil, ErrorToStatus(err)
	}
	return &pb.PublishPluginClusterEventResponse{}, nil
}

// =============================================================================
// Interactive Dialog Handlers
// =============================================================================

func (s *APIServer) OpenInteractiveDialog(ctx context.Context, req *pb.OpenInteractiveDialogRequest) (*pb.OpenInteractiveDialogResponse, error) {
	dialogReq := openDialogRequestFromProto(req)
	appErr := s.impl.OpenInteractiveDialog(dialogReq)
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.OpenInteractiveDialogResponse{}, nil
}

// =============================================================================
// Upload Session Handlers
// =============================================================================

func (s *APIServer) CreateUploadSession(ctx context.Context, req *pb.CreateUploadSessionRequest) (*pb.CreateUploadSessionResponse, error) {
	us := uploadSessionFromProto(req.GetUploadSession())
	if us == nil {
		return nil, status.Error(codes.InvalidArgument, "upload_session is required")
	}

	result, err := s.impl.CreateUploadSession(us)
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.CreateUploadSessionResponse{
		UploadSession: uploadSessionToProto(result),
	}, nil
}

func (s *APIServer) UploadData(ctx context.Context, req *pb.UploadDataRequest) (*pb.UploadDataResponse, error) {
	us := uploadSessionFromProto(req.GetUploadSession())
	if us == nil {
		return nil, status.Error(codes.InvalidArgument, "upload_session is required")
	}

	rd := bytes.NewReader(req.GetData())
	fileInfo, err := s.impl.UploadData(us, rd)
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.UploadDataResponse{
		FileInfo: fileInfoToProto(fileInfo),
	}, nil
}

func (s *APIServer) GetUploadSession(ctx context.Context, req *pb.GetUploadSessionRequest) (*pb.GetUploadSessionResponse, error) {
	us, err := s.impl.GetUploadSession(req.GetUploadId())
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	return &pb.GetUploadSessionResponse{
		UploadSession: uploadSessionToProto(us),
	}, nil
}

// =============================================================================
// Push Notification Handlers
// =============================================================================

func (s *APIServer) SendPushNotification(ctx context.Context, req *pb.SendPushNotificationRequest) (*pb.SendPushNotificationResponse, error) {
	notification := pushNotificationFromProto(req.GetNotification())
	if notification == nil {
		return nil, status.Error(codes.InvalidArgument, "notification is required")
	}

	appErr := s.impl.SendPushNotification(notification, req.GetUserId())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}

	return &pb.SendPushNotificationResponse{}, nil
}

// =============================================================================
// Mail Handlers
// =============================================================================

func (s *APIServer) SendMail(ctx context.Context, req *pb.SendMailRequest) (*pb.SendMailResponse, error) {
	appErr := s.impl.SendMail(req.GetTo(), req.GetSubject(), req.GetHtmlBody())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.SendMailResponse{}, nil
}

// =============================================================================
// Plugin HTTP Handler
// =============================================================================

func (s *APIServer) PluginHTTP(ctx context.Context, req *pb.PluginHTTPRequest) (*pb.PluginHTTPResponse, error) {
	httpReq, err := http.NewRequest(req.GetMethod(), req.GetUrl(), bytes.NewReader(req.GetBody()))
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "failed to create request: %v", err)
	}

	// Copy headers
	for k, v := range req.GetHeaders() {
		httpReq.Header.Set(k, v)
	}

	resp := s.impl.PluginHTTP(httpReq)
	if resp == nil {
		return nil, status.Error(codes.Internal, "nil response from PluginHTTP")
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to read response body: %v", err)
	}

	// Convert response headers
	headers := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			headers[k] = strings.Join(v, ", ")
		}
	}

	return &pb.PluginHTTPResponse{
		StatusCode: int32(resp.StatusCode),
		Headers:    headers,
		Body:       body,
	}, nil
}

// =============================================================================
// Trial License Handlers
// =============================================================================

func (s *APIServer) RequestTrialLicense(ctx context.Context, req *pb.RequestTrialLicenseRequest) (*pb.RequestTrialLicenseResponse, error) {
	appErr := s.impl.RequestTrialLicense(req.GetRequesterId(), int(req.GetUsers()), req.GetTermsAccepted(), req.GetReceiveEmailsAccepted())
	if appErr != nil {
		return nil, AppErrorToStatus(appErr)
	}
	return &pb.RequestTrialLicenseResponse{}, nil
}

// =============================================================================
// Permissions Handlers
// =============================================================================

func (s *APIServer) RolesGrantPermission(ctx context.Context, req *pb.RolesGrantPermissionRequest) (*pb.RolesGrantPermissionResponse, error) {
	result := s.impl.RolesGrantPermission(req.GetRoleNames(), req.GetPermissionId())
	return &pb.RolesGrantPermissionResponse{
		HasPermission: result,
	}, nil
}

// =============================================================================
// Cloud Handlers
// =============================================================================

func (s *APIServer) GetCloudLimits(ctx context.Context, req *pb.GetCloudLimitsRequest) (*pb.GetCloudLimitsResponse, error) {
	limits, err := s.impl.GetCloudLimits()
	if err != nil {
		return nil, ErrorToStatus(err)
	}

	if limits == nil {
		return &pb.GetCloudLimitsResponse{}, nil
	}

	// Convert to JSON for transport (ProductLimits is complex)
	limitsJSON, jsonErr := json.Marshal(limits)
	if jsonErr != nil {
		return nil, status.Errorf(codes.Internal, "failed to marshal limits: %v", jsonErr)
	}

	return &pb.GetCloudLimitsResponse{
		LimitsJson: limitsJSON,
	}, nil
}

// =============================================================================
// Collection and Topic Handlers
// =============================================================================

func (s *APIServer) RegisterCollectionAndTopic(ctx context.Context, req *pb.RegisterCollectionAndTopicRequest) (*pb.RegisterCollectionAndTopicResponse, error) {
	err := s.impl.RegisterCollectionAndTopic(req.GetCollectionType(), req.GetTopicType())
	if err != nil {
		return nil, ErrorToStatus(err)
	}
	return &pb.RegisterCollectionAndTopicResponse{}, nil
}

// Note: CreateDefaultMemberships is not currently defined in the proto.
// GetPreferencesForUser, UpdatePreferencesForUser, DeletePreferencesForUser,
// CreateUserAccessToken, and RevokeUserAccessToken are already defined in handlers_user.go

// =============================================================================
// GetPluginID Handler
// =============================================================================

func (s *APIServer) GetPluginID(ctx context.Context, req *pb.GetPluginIDRequest) (*pb.GetPluginIDResponse, error) {
	// Note: This method doesn't exist in the API interface directly.
	// It would typically be provided by the plugin supervisor context.
	// Return unimplemented for now.
	return nil, status.Error(codes.Unimplemented, "GetPluginID not yet implemented")
}
