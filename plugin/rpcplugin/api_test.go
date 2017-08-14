package rpcplugin

import (
	"encoding/json"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/platform/plugin"
	"github.com/mattermost/platform/plugin/plugintest"
)

func testAPIRPC(api plugin.API, f func(plugin.API)) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()

	c1 := NewMuxer(NewReadWriteCloser(r1, w2), false)
	defer c1.Close()

	c2 := NewMuxer(NewReadWriteCloser(r2, w1), true)
	defer c2.Close()

	id, server := c1.Serve()
	go ServeAPI(api, server, c1)

	remote := ConnectAPI(c2.Connect(id), c2)
	defer remote.Close()

	f(remote)
}

func TestAPI(t *testing.T) {
	var api plugintest.API
	defer api.AssertExpectations(t)

	type Config struct {
		Foo string
		Bar struct {
			Baz string
		}
	}

	api.On("LoadPluginConfiguration", mock.MatchedBy(func(x interface{}) bool { return true })).Run(func(args mock.Arguments) {
		dest := args.Get(0).(interface{})
		json.Unmarshal([]byte(`{"Foo": "foo", "Bar": {"Baz": "baz"}}`), dest)
	}).Return(nil)

	testAPIRPC(&api, func(remote plugin.API) {
		var config Config
		assert.NoError(t, remote.LoadPluginConfiguration(&config))

		assert.Equal(t, "foo", config.Foo)
		assert.Equal(t, "baz", config.Bar.Baz)
	})
}
