package rpcplugin

import (
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/platform/plugin"
	"github.com/mattermost/platform/plugin/plugintest"
)

func testHooksRPC(hooks plugin.Hooks, f func(plugin.Hooks)) {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()

	c1 := NewMuxer(NewReadWriteCloser(r1, w2), false)
	defer c1.Close()

	c2 := NewMuxer(NewReadWriteCloser(r2, w1), true)
	defer c2.Close()

	id, server := c1.Serve()
	go ServeHooks(hooks, server, c1)

	remote := ConnectHooks(c2.Connect(id), c2)
	defer remote.Close()

	f(remote)
}

func TestHooks(t *testing.T) {
	var api plugintest.API
	var hooks plugintest.Hooks
	defer hooks.AssertExpectations(t)

	testHooksRPC(&hooks, func(remote plugin.Hooks) {
		hooks.On("OnActivate", mock.AnythingOfType("*rpcplugin.RemoteAPI")).Return(nil)
		assert.NoError(t, remote.OnActivate(&api))

		hooks.On("OnDeactivate").Return(nil)
		assert.NoError(t, remote.OnDeactivate())
	})
}

func BenchmarkOnDeactivate(b *testing.B) {
	var hooks plugintest.Hooks
	hooks.On("OnDeactivate").Return(nil)

	testHooksRPC(&hooks, func(remote plugin.Hooks) {
		b.ResetTimer()
		for n := 0; n < b.N; n++ {
			remote.OnDeactivate()
		}
		b.StopTimer()
	})
}
