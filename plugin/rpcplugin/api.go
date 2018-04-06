// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package rpcplugin

import (
	"encoding/gob"
	"encoding/json"
	"io"
	"net/http"
	"net/rpc"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type LocalAPI struct {
	api   plugin.API
	muxer *Muxer
}

func (api *LocalAPI) LoadPluginConfiguration(args struct{}, reply *[]byte) error {
	var config interface{}
	if err := api.api.LoadPluginConfiguration(&config); err != nil {
		return err
	}
	b, err := json.Marshal(config)
	if err != nil {
		return err
	}
	*reply = b
	return nil
}

func (api *LocalAPI) RegisterCommand(args *model.Command, reply *APITeamReply) error {
	return api.api.RegisterCommand(args)
}

func (api *LocalAPI) UnregisterCommand(args *APIUnregisterCommandArgs, reply *APITeamReply) error {
	return api.api.UnregisterCommand(args.TeamId, args.Trigger)
}

type APIErrorReply struct {
	Error *model.AppError
}

type APITeamReply struct {
	Team  *model.Team
	Error *model.AppError
}

func (api *LocalAPI) CreateTeam(args *model.Team, reply *APITeamReply) error {
	team, err := api.api.CreateTeam(args)
	*reply = APITeamReply{
		Team:  team,
		Error: err,
	}
	return nil
}

func (api *LocalAPI) DeleteTeam(args string, reply *APIErrorReply) error {
	*reply = APIErrorReply{
		Error: api.api.DeleteTeam(args),
	}
	return nil
}

func (api *LocalAPI) GetTeam(args string, reply *APITeamReply) error {
	team, err := api.api.GetTeam(args)
	*reply = APITeamReply{
		Team:  team,
		Error: err,
	}
	return nil
}

func (api *LocalAPI) GetTeamByName(args string, reply *APITeamReply) error {
	team, err := api.api.GetTeamByName(args)
	*reply = APITeamReply{
		Team:  team,
		Error: err,
	}
	return nil
}

func (api *LocalAPI) UpdateTeam(args *model.Team, reply *APITeamReply) error {
	team, err := api.api.UpdateTeam(args)
	*reply = APITeamReply{
		Team:  team,
		Error: err,
	}
	return nil
}

type APIUserReply struct {
	User  *model.User
	Error *model.AppError
}

func (api *LocalAPI) CreateUser(args *model.User, reply *APIUserReply) error {
	user, err := api.api.CreateUser(args)
	*reply = APIUserReply{
		User:  user,
		Error: err,
	}
	return nil
}

func (api *LocalAPI) DeleteUser(args string, reply *APIErrorReply) error {
	*reply = APIErrorReply{
		Error: api.api.DeleteUser(args),
	}
	return nil
}

func (api *LocalAPI) GetUser(args string, reply *APIUserReply) error {
	user, err := api.api.GetUser(args)
	*reply = APIUserReply{
		User:  user,
		Error: err,
	}
	return nil
}

func (api *LocalAPI) GetUserByEmail(args string, reply *APIUserReply) error {
	user, err := api.api.GetUserByEmail(args)
	*reply = APIUserReply{
		User:  user,
		Error: err,
	}
	return nil
}

func (api *LocalAPI) GetUserByUsername(args string, reply *APIUserReply) error {
	user, err := api.api.GetUserByUsername(args)
	*reply = APIUserReply{
		User:  user,
		Error: err,
	}
	return nil
}

func (api *LocalAPI) UpdateUser(args *model.User, reply *APIUserReply) error {
	user, err := api.api.UpdateUser(args)
	*reply = APIUserReply{
		User:  user,
		Error: err,
	}
	return nil
}

type APIGetChannelByNameArgs struct {
	Name   string
	TeamId string
}

type APIGetDirectChannelArgs struct {
	UserId1 string
	UserId2 string
}

type APIGetGroupChannelArgs struct {
	UserIds []string
}

type APIAddChannelMemberArgs struct {
	ChannelId string
	UserId    string
}

type APIGetChannelMemberArgs struct {
	ChannelId string
	UserId    string
}

type APIUpdateChannelMemberRolesArgs struct {
	ChannelId string
	UserId    string
	NewRoles  string
}

type APIUpdateChannelMemberNotificationsArgs struct {
	ChannelId     string
	UserId        string
	Notifications map[string]string
}

type APIDeleteChannelMemberArgs struct {
	ChannelId string
	UserId    string
}

type APIChannelReply struct {
	Channel *model.Channel
	Error   *model.AppError
}

type APIChannelMemberReply struct {
	ChannelMember *model.ChannelMember
	Error         *model.AppError
}

func (api *LocalAPI) CreateChannel(args *model.Channel, reply *APIChannelReply) error {
	channel, err := api.api.CreateChannel(args)
	*reply = APIChannelReply{
		Channel: channel,
		Error:   err,
	}
	return nil
}

func (api *LocalAPI) DeleteChannel(args string, reply *APIErrorReply) error {
	*reply = APIErrorReply{
		Error: api.api.DeleteChannel(args),
	}
	return nil
}

func (api *LocalAPI) GetChannel(args string, reply *APIChannelReply) error {
	channel, err := api.api.GetChannel(args)
	*reply = APIChannelReply{
		Channel: channel,
		Error:   err,
	}
	return nil
}

func (api *LocalAPI) GetChannelByName(args *APIGetChannelByNameArgs, reply *APIChannelReply) error {
	channel, err := api.api.GetChannelByName(args.Name, args.TeamId)
	*reply = APIChannelReply{
		Channel: channel,
		Error:   err,
	}
	return nil
}

func (api *LocalAPI) GetDirectChannel(args *APIGetDirectChannelArgs, reply *APIChannelReply) error {
	channel, err := api.api.GetDirectChannel(args.UserId1, args.UserId2)
	*reply = APIChannelReply{
		Channel: channel,
		Error:   err,
	}
	return nil
}

func (api *LocalAPI) GetGroupChannel(args *APIGetGroupChannelArgs, reply *APIChannelReply) error {
	channel, err := api.api.GetGroupChannel(args.UserIds)
	*reply = APIChannelReply{
		Channel: channel,
		Error:   err,
	}
	return nil
}

func (api *LocalAPI) UpdateChannel(args *model.Channel, reply *APIChannelReply) error {
	channel, err := api.api.UpdateChannel(args)
	*reply = APIChannelReply{
		Channel: channel,
		Error:   err,
	}
	return nil
}

func (api *LocalAPI) AddChannelMember(args *APIAddChannelMemberArgs, reply *APIChannelMemberReply) error {
	member, err := api.api.AddChannelMember(args.ChannelId, args.UserId)
	*reply = APIChannelMemberReply{
		ChannelMember: member,
		Error:         err,
	}
	return nil
}

func (api *LocalAPI) GetChannelMember(args *APIGetChannelMemberArgs, reply *APIChannelMemberReply) error {
	member, err := api.api.GetChannelMember(args.ChannelId, args.UserId)
	*reply = APIChannelMemberReply{
		ChannelMember: member,
		Error:         err,
	}
	return nil
}

func (api *LocalAPI) UpdateChannelMemberRoles(args *APIUpdateChannelMemberRolesArgs, reply *APIChannelMemberReply) error {
	member, err := api.api.UpdateChannelMemberRoles(args.ChannelId, args.UserId, args.NewRoles)
	*reply = APIChannelMemberReply{
		ChannelMember: member,
		Error:         err,
	}
	return nil
}

func (api *LocalAPI) UpdateChannelMemberNotifications(args *APIUpdateChannelMemberNotificationsArgs, reply *APIChannelMemberReply) error {
	member, err := api.api.UpdateChannelMemberNotifications(args.ChannelId, args.UserId, args.Notifications)
	*reply = APIChannelMemberReply{
		ChannelMember: member,
		Error:         err,
	}
	return nil
}

func (api *LocalAPI) DeleteChannelMember(args *APIDeleteChannelMemberArgs, reply *APIErrorReply) error {
	err := api.api.DeleteChannelMember(args.ChannelId, args.UserId)
	*reply = APIErrorReply{
		Error: err,
	}
	return nil
}

type APIPostReply struct {
	Post  *model.Post
	Error *model.AppError
}

func (api *LocalAPI) CreatePost(args *model.Post, reply *APIPostReply) error {
	post, err := api.api.CreatePost(args)
	*reply = APIPostReply{
		Post:  post,
		Error: err,
	}
	return nil
}

func (api *LocalAPI) DeletePost(args string, reply *APIErrorReply) error {
	*reply = APIErrorReply{
		Error: api.api.DeletePost(args),
	}
	return nil
}

func (api *LocalAPI) GetPost(args string, reply *APIPostReply) error {
	post, err := api.api.GetPost(args)
	*reply = APIPostReply{
		Post:  post,
		Error: err,
	}
	return nil
}

func (api *LocalAPI) UpdatePost(args *model.Post, reply *APIPostReply) error {
	post, err := api.api.UpdatePost(args)
	*reply = APIPostReply{
		Post:  post,
		Error: err,
	}
	return nil
}

type APIKeyValueStoreReply struct {
	Value []byte
	Error *model.AppError
}

type APIKeyValueStoreSetArgs struct {
	Key   string
	Value []byte
}

func (api *LocalAPI) KeyValueStoreSet(args *APIKeyValueStoreSetArgs, reply *APIErrorReply) error {
	err := api.api.KeyValueStore().Set(args.Key, args.Value)
	*reply = APIErrorReply{
		Error: err,
	}
	return nil
}

func (api *LocalAPI) KeyValueStoreGet(args string, reply *APIKeyValueStoreReply) error {
	v, err := api.api.KeyValueStore().Get(args)
	*reply = APIKeyValueStoreReply{
		Value: v,
		Error: err,
	}
	return nil
}

func (api *LocalAPI) KeyValueStoreDelete(args string, reply *APIErrorReply) error {
	err := api.api.KeyValueStore().Delete(args)
	*reply = APIErrorReply{
		Error: err,
	}
	return nil
}

func ServeAPI(api plugin.API, conn io.ReadWriteCloser, muxer *Muxer) {
	server := rpc.NewServer()
	server.Register(&LocalAPI{
		api:   api,
		muxer: muxer,
	})
	server.ServeConn(conn)
}

type RemoteAPI struct {
	client        *rpc.Client
	muxer         *Muxer
	keyValueStore *RemoteKeyValueStore
}

type RemoteKeyValueStore struct {
	api *RemoteAPI
}

var _ plugin.API = (*RemoteAPI)(nil)
var _ plugin.KeyValueStore = (*RemoteKeyValueStore)(nil)

func (api *RemoteAPI) LoadPluginConfiguration(dest interface{}) error {
	var config []byte
	if err := api.client.Call("LocalAPI.LoadPluginConfiguration", struct{}{}, &config); err != nil {
		return err
	}
	return json.Unmarshal(config, dest)
}

func (api *RemoteAPI) RegisterCommand(command *model.Command) error {
	return api.client.Call("LocalAPI.RegisterCommand", command, nil)
}

type APIUnregisterCommandArgs struct {
	TeamId  string
	Trigger string
}

func (api *RemoteAPI) UnregisterCommand(teamId, trigger string) error {
	return api.client.Call("LocalAPI.UnregisterCommand", &APIUnregisterCommandArgs{
		TeamId:  teamId,
		Trigger: trigger,
	}, nil)
}

func (api *RemoteAPI) CreateUser(user *model.User) (*model.User, *model.AppError) {
	var reply APIUserReply
	if err := api.client.Call("LocalAPI.CreateUser", user, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.CreateUser", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.User, reply.Error
}

func (api *RemoteAPI) DeleteUser(userId string) *model.AppError {
	var reply APIErrorReply
	if err := api.client.Call("LocalAPI.DeleteUser", userId, &reply); err != nil {
		return model.NewAppError("RemoteAPI.DeleteUser", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Error
}

func (api *RemoteAPI) GetUser(userId string) (*model.User, *model.AppError) {
	var reply APIUserReply
	if err := api.client.Call("LocalAPI.GetUser", userId, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetUser", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.User, reply.Error
}

func (api *RemoteAPI) GetUserByEmail(email string) (*model.User, *model.AppError) {
	var reply APIUserReply
	if err := api.client.Call("LocalAPI.GetUserByEmail", email, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetUserByEmail", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.User, reply.Error
}

func (api *RemoteAPI) GetUserByUsername(name string) (*model.User, *model.AppError) {
	var reply APIUserReply
	if err := api.client.Call("LocalAPI.GetUserByUsername", name, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetUserByUsername", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.User, reply.Error
}

func (api *RemoteAPI) UpdateUser(user *model.User) (*model.User, *model.AppError) {
	var reply APIUserReply
	if err := api.client.Call("LocalAPI.UpdateUser", user, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.UpdateUser", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.User, reply.Error
}

func (api *RemoteAPI) CreateTeam(team *model.Team) (*model.Team, *model.AppError) {
	var reply APITeamReply
	if err := api.client.Call("LocalAPI.CreateTeam", team, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.CreateTeam", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Team, reply.Error
}

func (api *RemoteAPI) DeleteTeam(teamId string) *model.AppError {
	var reply APIErrorReply
	if err := api.client.Call("LocalAPI.DeleteTeam", teamId, &reply); err != nil {
		return model.NewAppError("RemoteAPI.DeleteTeam", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Error
}

func (api *RemoteAPI) GetTeam(teamId string) (*model.Team, *model.AppError) {
	var reply APITeamReply
	if err := api.client.Call("LocalAPI.GetTeam", teamId, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetTeam", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Team, reply.Error
}

func (api *RemoteAPI) GetTeamByName(name string) (*model.Team, *model.AppError) {
	var reply APITeamReply
	if err := api.client.Call("LocalAPI.GetTeamByName", name, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetTeamByName", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Team, reply.Error
}

func (api *RemoteAPI) UpdateTeam(team *model.Team) (*model.Team, *model.AppError) {
	var reply APITeamReply
	if err := api.client.Call("LocalAPI.UpdateTeam", team, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.UpdateTeam", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Team, reply.Error
}

func (api *RemoteAPI) CreateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	var reply APIChannelReply
	if err := api.client.Call("LocalAPI.CreateChannel", channel, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.CreateChannel", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Channel, reply.Error
}

func (api *RemoteAPI) DeleteChannel(channelId string) *model.AppError {
	var reply APIErrorReply
	if err := api.client.Call("LocalAPI.DeleteChannel", channelId, &reply); err != nil {
		return model.NewAppError("RemoteAPI.DeleteChannel", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Error
}

func (api *RemoteAPI) GetChannel(channelId string) (*model.Channel, *model.AppError) {
	var reply APIChannelReply
	if err := api.client.Call("LocalAPI.GetChannel", channelId, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetChannel", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Channel, reply.Error
}

func (api *RemoteAPI) GetChannelByName(name, teamId string) (*model.Channel, *model.AppError) {
	var reply APIChannelReply
	if err := api.client.Call("LocalAPI.GetChannelByName", &APIGetChannelByNameArgs{
		Name:   name,
		TeamId: teamId,
	}, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetChannelByName", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Channel, reply.Error
}

func (api *RemoteAPI) GetDirectChannel(userId1, userId2 string) (*model.Channel, *model.AppError) {
	var reply APIChannelReply
	if err := api.client.Call("LocalAPI.GetDirectChannel", &APIGetDirectChannelArgs{
		UserId1: userId1,
		UserId2: userId2,
	}, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetDirectChannel", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Channel, reply.Error
}

func (api *RemoteAPI) GetGroupChannel(userIds []string) (*model.Channel, *model.AppError) {
	var reply APIChannelReply
	if err := api.client.Call("LocalAPI.GetGroupChannel", &APIGetGroupChannelArgs{
		UserIds: userIds,
	}, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetGroupChannel", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Channel, reply.Error
}

func (api *RemoteAPI) UpdateChannel(channel *model.Channel) (*model.Channel, *model.AppError) {
	var reply APIChannelReply
	if err := api.client.Call("LocalAPI.UpdateChannel", channel, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.UpdateChannel", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Channel, reply.Error
}

func (api *RemoteAPI) AddChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError) {
	var reply APIChannelMemberReply
	if err := api.client.Call("LocalAPI.AddChannelMember", &APIAddChannelMemberArgs{
		ChannelId: channelId,
		UserId:    userId,
	}, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.AddChannelMember", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.ChannelMember, reply.Error
}

func (api *RemoteAPI) GetChannelMember(channelId, userId string) (*model.ChannelMember, *model.AppError) {
	var reply APIChannelMemberReply
	if err := api.client.Call("LocalAPI.GetChannelMember", &APIGetChannelMemberArgs{
		ChannelId: channelId,
		UserId:    userId,
	}, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetChannelMember", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.ChannelMember, reply.Error
}

func (api *RemoteAPI) UpdateChannelMemberRoles(channelId, userId, newRoles string) (*model.ChannelMember, *model.AppError) {
	var reply APIChannelMemberReply
	if err := api.client.Call("LocalAPI.UpdateChannelMemberRoles", &APIUpdateChannelMemberRolesArgs{
		ChannelId: channelId,
		UserId:    userId,
		NewRoles:  newRoles,
	}, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.UpdateChannelMemberRoles", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.ChannelMember, reply.Error
}

func (api *RemoteAPI) UpdateChannelMemberNotifications(channelId, userId string, notifications map[string]string) (*model.ChannelMember, *model.AppError) {
	var reply APIChannelMemberReply
	if err := api.client.Call("LocalAPI.UpdateChannelMemberNotifications", &APIUpdateChannelMemberNotificationsArgs{
		ChannelId:     channelId,
		UserId:        userId,
		Notifications: notifications,
	}, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.UpdateChannelMemberNotifications", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.ChannelMember, reply.Error
}

func (api *RemoteAPI) DeleteChannelMember(channelId, userId string) *model.AppError {
	var reply APIErrorReply
	if err := api.client.Call("LocalAPI.DeleteChannelMember", &APIDeleteChannelMemberArgs{
		ChannelId: channelId,
		UserId:    userId,
	}, &reply); err != nil {
		return model.NewAppError("RemoteAPI.DeleteChannelMember", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Error
}

func (api *RemoteAPI) CreatePost(post *model.Post) (*model.Post, *model.AppError) {
	var reply APIPostReply
	if err := api.client.Call("LocalAPI.CreatePost", post, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.CreatePost", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Post, reply.Error
}

func (api *RemoteAPI) DeletePost(postId string) *model.AppError {
	var reply APIErrorReply
	if err := api.client.Call("LocalAPI.DeletePost", postId, &reply); err != nil {
		return model.NewAppError("RemoteAPI.DeletePost", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Error
}

func (api *RemoteAPI) GetPost(postId string) (*model.Post, *model.AppError) {
	var reply APIPostReply
	if err := api.client.Call("LocalAPI.GetPost", postId, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetPost", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Post, reply.Error
}

func (api *RemoteAPI) UpdatePost(post *model.Post) (*model.Post, *model.AppError) {
	var reply APIPostReply
	if err := api.client.Call("LocalAPI.UpdatePost", post, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.UpdatePost", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Post, reply.Error
}

func (api *RemoteAPI) KeyValueStore() plugin.KeyValueStore {
	return api.keyValueStore
}

func (s *RemoteKeyValueStore) Set(key string, value []byte) *model.AppError {
	var reply APIErrorReply
	if err := s.api.client.Call("LocalAPI.KeyValueStoreSet", &APIKeyValueStoreSetArgs{Key: key, Value: value}, &reply); err != nil {
		return model.NewAppError("RemoteAPI.KeyValueStoreSet", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Error
}

func (s *RemoteKeyValueStore) Get(key string) ([]byte, *model.AppError) {
	var reply APIKeyValueStoreReply
	if err := s.api.client.Call("LocalAPI.KeyValueStoreGet", key, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.KeyValueStoreGet", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Value, reply.Error
}

func (s *RemoteKeyValueStore) Delete(key string) *model.AppError {
	var reply APIErrorReply
	if err := s.api.client.Call("LocalAPI.KeyValueStoreDelete", key, &reply); err != nil {
		return model.NewAppError("RemoteAPI.KeyValueStoreDelete", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Error
}

func (h *RemoteAPI) Close() error {
	return h.client.Close()
}

func ConnectAPI(conn io.ReadWriteCloser, muxer *Muxer) *RemoteAPI {
	remoteKeyValueStore := &RemoteKeyValueStore{}
	remoteApi := &RemoteAPI{
		client:        rpc.NewClient(conn),
		muxer:         muxer,
		keyValueStore: remoteKeyValueStore,
	}

	remoteKeyValueStore.api = remoteApi

	return remoteApi
}

func init() {
	gob.Register([]*model.SlackAttachment{})
	gob.Register([]interface{}{})
	gob.Register(map[string]interface{}{})
}
