package rpcplugin

import (
	"io"
	"net/rpc"
	"reflect"

	"github.com/mattermost/platform/plugin"
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

func ServeHooks(hooks interface{}, conn io.ReadWriteCloser, muxer *Muxer) {
	server := rpc.NewServer()
	server.Register(&LocalHooks{
		hooks: hooks,
		muxer: muxer,
	})
	server.ServeConn(conn)
}

const (
	remoteOnActivate = iota
	remoteOnDeactivate
	maxRemoteHookCount
)

type RemoteHooks struct {
	client      *rpc.Client
	muxer       *Muxer
	apiCloser   io.Closer
	implemented [maxRemoteHookCount]bool
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

func (h *RemoteHooks) Close() error {
	if h.apiCloser != nil {
		h.apiCloser.Close()
		h.apiCloser = nil
	}
	return h.client.Close()
}

func ConnectHooks(conn io.ReadWriteCloser, muxer *Muxer) (*RemoteHooks, error) {
	remote := &RemoteHooks{
		client: rpc.NewClient(conn),
		muxer:  muxer,
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
		}
	}
	return remote, nil
}
