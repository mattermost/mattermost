package rpcplugin

import (
	"encoding/json"
	"io"
	"net/rpc"

	"github.com/mattermost/platform/plugin"
)

type LocalAPI struct {
	api   plugin.API
	muxer *Muxer
}

func (h *LocalAPI) LoadPluginConfiguration(args struct{}, reply *[]byte) error {
	var config interface{}
	if err := h.api.LoadPluginConfiguration(&config); err != nil {
		return err
	}
	b, err := json.Marshal(config)
	if err != nil {
		return err
	}
	*reply = b
	return nil
}

type RemoteAPI struct {
	client *rpc.Client
	muxer  *Muxer
}

func ServeAPI(api plugin.API, conn io.ReadWriteCloser, muxer *Muxer) {
	server := rpc.NewServer()
	server.Register(&LocalAPI{
		api:   api,
		muxer: muxer,
	})
	server.ServeConn(conn)
}

var _ plugin.API = (*RemoteAPI)(nil)

func (h *RemoteAPI) LoadPluginConfiguration(dest interface{}) error {
	var config []byte
	if err := h.client.Call("LocalAPI.LoadPluginConfiguration", struct{}{}, &config); err != nil {
		return err
	}
	return json.Unmarshal(config, dest)
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
