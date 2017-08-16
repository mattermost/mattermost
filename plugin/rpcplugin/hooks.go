package rpcplugin

import (
	"io"
	"net/rpc"

	"github.com/mattermost/platform/plugin"
)

type LocalHooks struct {
	hooks     plugin.Hooks
	muxer     *Muxer
	remoteAPI *RemoteAPI
}

func (h *LocalHooks) OnActivate(args int64, reply *struct{}) error {
	stream := h.muxer.Connect(args)
	if h.remoteAPI != nil {
		h.remoteAPI.Close()
	}
	h.remoteAPI = ConnectAPI(stream, h.muxer)
	return h.hooks.OnActivate(h.remoteAPI)
}

func (h *LocalHooks) OnDeactivate(args, reply *struct{}) error {
	err := h.hooks.OnDeactivate()
	if h.remoteAPI != nil {
		h.remoteAPI.Close()
		h.remoteAPI = nil
	}
	return err
}

type RemoteHooks struct {
	client    *rpc.Client
	muxer     *Muxer
	apiCloser io.Closer
}

func ServeHooks(hooks plugin.Hooks, conn io.ReadWriteCloser, muxer *Muxer) {
	server := rpc.NewServer()
	server.Register(&LocalHooks{
		hooks: hooks,
		muxer: muxer,
	})
	server.ServeConn(conn)
}

var _ plugin.Hooks = (*RemoteHooks)(nil)

func (h *RemoteHooks) OnActivate(api plugin.API) error {
	id, stream := h.muxer.Serve()
	if h.apiCloser != nil {
		h.apiCloser.Close()
	}
	h.apiCloser = stream
	go ServeAPI(api, stream, h.muxer)
	return h.client.Call("LocalHooks.OnActivate", id, nil)
}

func (h *RemoteHooks) OnDeactivate() error {
	return h.client.Call("LocalHooks.OnDeactivate", struct{}{}, nil)
}

func (h *RemoteHooks) Close() error {
	if h.apiCloser != nil {
		h.apiCloser.Close()
	}
	return h.client.Close()
}

func ConnectHooks(conn io.ReadWriteCloser, muxer *Muxer) *RemoteHooks {
	return &RemoteHooks{
		client: rpc.NewClient(conn),
		muxer:  muxer,
	}
}
