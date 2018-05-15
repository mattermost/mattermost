// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package rpcplugin

import (
	"bytes"
	"io"
	"io/ioutil"
	"net/http"
	"net/rpc"
	"reflect"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type LocalHooks struct {
	hooks     interface{}
	muxer     *Muxer
	remoteAPI *RemoteAPI
}

// Implemented replies with the names of the hooks that are implemented.
func (h *LocalHooks) Implemented(args struct{}, reply *[]string) error {
	ifaceType := reflect.TypeOf((*plugin.Hooks)(nil)).Elem()
	implType := reflect.TypeOf(h.hooks)
	selfType := reflect.TypeOf(h)
	var methods []string
	for i := 0; i < ifaceType.NumMethod(); i++ {
		method := ifaceType.Method(i)
		if m, ok := implType.MethodByName(method.Name); !ok {
			continue
		} else if m.Type.NumIn() != method.Type.NumIn()+1 {
			continue
		} else if m.Type.NumOut() != method.Type.NumOut() {
			continue
		} else {
			match := true
			for j := 0; j < method.Type.NumIn(); j++ {
				if m.Type.In(j+1) != method.Type.In(j) {
					match = false
					break
				}
			}
			for j := 0; j < method.Type.NumOut(); j++ {
				if m.Type.Out(j) != method.Type.Out(j) {
					match = false
					break
				}
			}
			if !match {
				continue
			}
		}
		if _, ok := selfType.MethodByName(method.Name); !ok {
			continue
		}
		methods = append(methods, method.Name)
	}
	*reply = methods
	return nil
}

func (h *LocalHooks) OnActivate(args int64, reply *struct{}) error {
	if h.remoteAPI != nil {
		h.remoteAPI.Close()
		h.remoteAPI = nil
	}
	if hook, ok := h.hooks.(interface {
		OnActivate(plugin.API) error
	}); ok {
		stream := h.muxer.Connect(args)
		h.remoteAPI = ConnectAPI(stream, h.muxer)
		return hook.OnActivate(h.remoteAPI)
	}
	return nil
}

func (h *LocalHooks) OnDeactivate(args, reply *struct{}) (err error) {
	if hook, ok := h.hooks.(interface {
		OnDeactivate() error
	}); ok {
		err = hook.OnDeactivate()
	}
	if h.remoteAPI != nil {
		h.remoteAPI.Close()
		h.remoteAPI = nil
	}
	return
}

func (h *LocalHooks) OnConfigurationChange(args, reply *struct{}) error {
	if hook, ok := h.hooks.(interface {
		OnConfigurationChange() error
	}); ok {
		return hook.OnConfigurationChange()
	}
	return nil
}

type ServeHTTPArgs struct {
	ResponseWriterStream int64
	Request              *http.Request
	RequestBodyStream    int64
}

func (h *LocalHooks) ServeHTTP(args ServeHTTPArgs, reply *struct{}) error {
	w := ConnectHTTPResponseWriter(h.muxer.Connect(args.ResponseWriterStream))
	defer w.Close()

	r := args.Request
	if args.RequestBodyStream != 0 {
		r.Body = ConnectIOReader(h.muxer.Connect(args.RequestBodyStream))
	} else {
		r.Body = ioutil.NopCloser(&bytes.Buffer{})
	}
	defer r.Body.Close()

	if hook, ok := h.hooks.(http.Handler); ok {
		hook.ServeHTTP(w, r)
	} else {
		http.NotFound(w, r)
	}

	return nil
}

type HooksExecuteCommandReply struct {
	Response *model.CommandResponse
	Error    *model.AppError
}

func (h *LocalHooks) ExecuteCommand(args *model.CommandArgs, reply *HooksExecuteCommandReply) error {
	if hook, ok := h.hooks.(interface {
		ExecuteCommand(*model.CommandArgs) (*model.CommandResponse, *model.AppError)
	}); ok {
		reply.Response, reply.Error = hook.ExecuteCommand(args)
	}
	return nil
}

type MessageWillBeReply struct {
	Post            *model.Post
	RejectionReason string
}

type MessageUpdatedArgs struct {
	NewPost *model.Post
	OldPost *model.Post
}

func (h *LocalHooks) MessageWillBePosted(args *model.Post, reply *MessageWillBeReply) error {
	if hook, ok := h.hooks.(interface {
		MessageWillBePosted(*model.Post) (*model.Post, string)
	}); ok {
		reply.Post, reply.RejectionReason = hook.MessageWillBePosted(args)
	}
	return nil
}

func (h *LocalHooks) MessageWillBeUpdated(args *MessageUpdatedArgs, reply *MessageWillBeReply) error {
	if hook, ok := h.hooks.(interface {
		MessageWillBeUpdated(*model.Post, *model.Post) (*model.Post, string)
	}); ok {
		reply.Post, reply.RejectionReason = hook.MessageWillBeUpdated(args.NewPost, args.OldPost)
	}
	return nil
}

func (h *LocalHooks) MessageHasBeenPosted(args *model.Post, reply *struct{}) error {
	if hook, ok := h.hooks.(interface {
		MessageHasBeenPosted(*model.Post)
	}); ok {
		hook.MessageHasBeenPosted(args)
	}
	return nil
}

func (h *LocalHooks) MessageHasBeenUpdated(args *MessageUpdatedArgs, reply *struct{}) error {
	if hook, ok := h.hooks.(interface {
		MessageHasBeenUpdated(*model.Post, *model.Post)
	}); ok {
		hook.MessageHasBeenUpdated(args.NewPost, args.OldPost)
	}
	return nil
}

func ServeHooks(hooks interface{}, conn io.ReadWriteCloser, muxer *Muxer) {
	server := rpc.NewServer()
	server.Register(&LocalHooks{
		hooks: hooks,
		muxer: muxer,
	})
	server.ServeConn(conn)
}

// These assignments are part of the wire protocol. You can add more, but should not change existing
// assignments.
const (
	remoteOnActivate            = 0
	remoteOnDeactivate          = 1
	remoteServeHTTP             = 2
	remoteOnConfigurationChange = 3
	remoteExecuteCommand        = 4
	remoteMessageWillBePosted   = 5
	remoteMessageWillBeUpdated  = 6
	remoteMessageHasBeenPosted  = 7
	remoteMessageHasBeenUpdated = 8
	maxRemoteHookCount          = iota
)

type RemoteHooks struct {
	client      *rpc.Client
	muxer       *Muxer
	apiCloser   io.Closer
	implemented [maxRemoteHookCount]bool
	pluginId    string
}

var _ plugin.Hooks = (*RemoteHooks)(nil)

func (h *RemoteHooks) Implemented() (impl []string, err error) {
	err = h.client.Call("LocalHooks.Implemented", struct{}{}, &impl)
	return
}

func (h *RemoteHooks) OnActivate(api plugin.API) error {
	if h.apiCloser != nil {
		h.apiCloser.Close()
		h.apiCloser = nil
	}
	if !h.implemented[remoteOnActivate] {
		return nil
	}
	id, stream := h.muxer.Serve()
	h.apiCloser = stream
	go ServeAPI(api, stream, h.muxer)
	return h.client.Call("LocalHooks.OnActivate", id, nil)
}

func (h *RemoteHooks) OnDeactivate() error {
	if !h.implemented[remoteOnDeactivate] {
		return nil
	}
	return h.client.Call("LocalHooks.OnDeactivate", struct{}{}, nil)
}

func (h *RemoteHooks) OnConfigurationChange() error {
	if !h.implemented[remoteOnConfigurationChange] {
		return nil
	}
	return h.client.Call("LocalHooks.OnConfigurationChange", struct{}{}, nil)
}

func (h *RemoteHooks) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !h.implemented[remoteServeHTTP] {
		http.NotFound(w, r)
		return
	}

	responseWriterStream, stream := h.muxer.Serve()
	defer stream.Close()
	go ServeHTTPResponseWriter(w, stream)

	requestBodyStream := int64(0)
	if r.Body != nil {
		rid, rstream := h.muxer.Serve()
		defer rstream.Close()
		go ServeIOReader(r.Body, rstream)
		requestBodyStream = rid
	}

	forwardedRequest := &http.Request{
		Method:     r.Method,
		URL:        r.URL,
		Proto:      r.Proto,
		ProtoMajor: r.ProtoMajor,
		ProtoMinor: r.ProtoMinor,
		Header:     r.Header,
		Host:       r.Host,
		RemoteAddr: r.RemoteAddr,
		RequestURI: r.RequestURI,
	}

	if err := h.client.Call("LocalHooks.ServeHTTP", ServeHTTPArgs{
		ResponseWriterStream: responseWriterStream,
		Request:              forwardedRequest,
		RequestBodyStream:    requestBodyStream,
	}, nil); err != nil {
		mlog.Error("Plugin failed to ServeHTTP", mlog.String("plugin_id", h.pluginId), mlog.Err(err))
		http.Error(w, "500 internal server error", http.StatusInternalServerError)
	}
}

func (h *RemoteHooks) ExecuteCommand(args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	if !h.implemented[remoteExecuteCommand] {
		return nil, model.NewAppError("RemoteHooks.ExecuteCommand", "plugin.rpcplugin.invocation.error", nil, "err=ExecuteCommand hook not implemented", http.StatusInternalServerError)
	}
	var reply HooksExecuteCommandReply
	if err := h.client.Call("LocalHooks.ExecuteCommand", args, &reply); err != nil {
		return nil, model.NewAppError("RemoteHooks.ExecuteCommand", "plugin.rpcplugin.invocation.error", nil, "err="+err.Error(), http.StatusInternalServerError)
	}
	return reply.Response, reply.Error
}

func (h *RemoteHooks) MessageWillBePosted(args *model.Post) (*model.Post, string) {
	if !h.implemented[remoteMessageWillBePosted] {
		return args, ""
	}
	var reply MessageWillBeReply
	if err := h.client.Call("LocalHooks.MessageWillBePosted", args, &reply); err != nil {
		return nil, ""
	}
	return reply.Post, reply.RejectionReason
}

func (h *RemoteHooks) MessageWillBeUpdated(newPost, oldPost *model.Post) (*model.Post, string) {
	if !h.implemented[remoteMessageWillBeUpdated] {
		return newPost, ""
	}
	var reply MessageWillBeReply
	args := &MessageUpdatedArgs{
		NewPost: newPost,
		OldPost: oldPost,
	}
	if err := h.client.Call("LocalHooks.MessageWillBeUpdated", args, &reply); err != nil {
		return nil, ""
	}
	return reply.Post, reply.RejectionReason
}

func (h *RemoteHooks) MessageHasBeenPosted(args *model.Post) {
	if !h.implemented[remoteMessageHasBeenPosted] {
		return
	}
	if err := h.client.Call("LocalHooks.MessageHasBeenPosted", args, nil); err != nil {
		return
	}
}

func (h *RemoteHooks) MessageHasBeenUpdated(newPost, oldPost *model.Post) {
	if !h.implemented[remoteMessageHasBeenUpdated] {
		return
	}
	args := &MessageUpdatedArgs{
		NewPost: newPost,
		OldPost: oldPost,
	}
	if err := h.client.Call("LocalHooks.MessageHasBeenUpdated", args, nil); err != nil {
		return
	}
}

func (h *RemoteHooks) Close() error {
	if h.apiCloser != nil {
		h.apiCloser.Close()
		h.apiCloser = nil
	}
	return h.client.Close()
}

func ConnectHooks(conn io.ReadWriteCloser, muxer *Muxer, pluginId string) (*RemoteHooks, error) {
	remote := &RemoteHooks{
		client:   rpc.NewClient(conn),
		muxer:    muxer,
		pluginId: pluginId,
	}
	implemented, err := remote.Implemented()
	if err != nil {
		remote.Close()
		return nil, err
	}
	for _, method := range implemented {
		switch method {
		case "OnActivate":
			remote.implemented[remoteOnActivate] = true
		case "OnDeactivate":
			remote.implemented[remoteOnDeactivate] = true
		case "OnConfigurationChange":
			remote.implemented[remoteOnConfigurationChange] = true
		case "ServeHTTP":
			remote.implemented[remoteServeHTTP] = true
		case "ExecuteCommand":
			remote.implemented[remoteExecuteCommand] = true
		case "MessageWillBePosted":
			remote.implemented[remoteMessageWillBePosted] = true
		case "MessageWillBeUpdated":
			remote.implemented[remoteMessageWillBeUpdated] = true
		case "MessageHasBeenPosted":
			remote.implemented[remoteMessageHasBeenPosted] = true
		case "MessageHasBeenUpdated":
			remote.implemented[remoteMessageHasBeenUpdated] = true
		}
	}
	return remote, nil
}
