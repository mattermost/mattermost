package rpcplugin

import (
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

type APITeamReply struct {
	Team  *model.Team
	Error *model.AppError
}

func (api *LocalAPI) GetTeamByName(args string, reply *APITeamReply) error {
	team, err := api.api.GetTeamByName(args)
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

func (api *LocalAPI) GetUserByUsername(args string, reply *APIUserReply) error {
	user, err := api.api.GetUserByUsername(args)
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

type APIChannelReply struct {
	Channel *model.Channel
	Error   *model.AppError
}

func (api *LocalAPI) GetChannelByName(args *APIGetChannelByNameArgs, reply *APIChannelReply) error {
	channel, err := api.api.GetChannelByName(args.Name, args.TeamId)
	*reply = APIChannelReply{
		Channel: channel,
		Error:   err,
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

func ServeAPI(api plugin.API, conn io.ReadWriteCloser, muxer *Muxer) {
	server := rpc.NewServer()
	server.Register(&LocalAPI{
		api:   api,
		muxer: muxer,
	})
	server.ServeConn(conn)
}

type RemoteAPI struct {
	client *rpc.Client
	muxer  *Muxer
}

var _ plugin.API = (*RemoteAPI)(nil)

func (api *RemoteAPI) LoadPluginConfiguration(dest interface{}) error {
	var config []byte
	if err := api.client.Call("LocalAPI.LoadPluginConfiguration", struct{}{}, &config); err != nil {
		return err
	}
	return json.Unmarshal(config, dest)
}

func (api *RemoteAPI) GetTeamByName(name string) (*model.Team, *model.AppError) {
	var reply APITeamReply
	if err := api.client.Call("LocalAPI.GetTeamByName", name, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetTeamByName", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Team, reply.Error
}

func (api *RemoteAPI) GetUserByUsername(name string) (*model.User, *model.AppError) {
	var reply APIUserReply
	if err := api.client.Call("LocalAPI.GetUserByUsername", name, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.GetUserByUsername", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.User, reply.Error
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

func (api *RemoteAPI) CreatePost(post *model.Post) (*model.Post, *model.AppError) {
	var reply APIPostReply
	if err := api.client.Call("LocalAPI.CreatePost", post, &reply); err != nil {
		return nil, model.NewAppError("RemoteAPI.CreatePost", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Post, reply.Error
}

func (h *RemoteAPI) Close() error {
	return h.client.Close()
}

func ConnectAPI(conn io.ReadWriteCloser, muxer *Muxer) *RemoteAPI {
	return &RemoteAPI{
		client: rpc.NewClient(conn),
		muxer:  muxer,
	}
}
