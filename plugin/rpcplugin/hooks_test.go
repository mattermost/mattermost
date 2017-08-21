package rpcplugin

import (
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/platform/plugin"
	"github.com/mattermost/platform/plugin/plugintest"
)

func testHooksRPC(hooks interface{}, f func(*RemoteHooks)) error {
	r1, w1 := io.Pipe()
	r2, w2 := io.Pipe()

	c1 := NewMuxer(NewReadWriteCloser(r1, w2), false)
	defer c1.Close()

	c2 := NewMuxer(NewReadWriteCloser(r2, w1), true)
	defer c2.Close()

	id, server := c1.Serve()
	go ServeHooks(hooks, server, c1)

	remote, err := ConnectHooks(c2.Connect(id), c2)
	if err != nil {
		return err
	}
	defer remote.Close()

	f(remote)
	return nil
}

func TestHooks(t *testing.T) {
	var api plugintest.API
	var hooks plugintest.Hooks
	defer hooks.AssertExpectations(t)

	assert.NoError(t, testHooksRPC(&hooks, func(remote *RemoteHooks) {
		hooks.On("OnActivate", mock.AnythingOfType("*rpcplugin.RemoteAPI")).Return(nil)
		assert.NoError(t, remote.OnActivate(&api))

		hooks.On("OnDeactivate").Return(nil)
		assert.NoError(t, remote.OnDeactivate())
	}))
}

type testHooks struct {
	mock.Mock
}

func (h *testHooks) OnActivate(api plugin.API) error {
	return h.Called(api).Error(0)
}

func TestHooks_PartiallyImplemented(t *testing.T) {
	var api plugintest.API
	var hooks testHooks
	defer hooks.AssertExpectations(t)

	assert.NoError(t, testHooksRPC(&hooks, func(remote *RemoteHooks) {
		implemented, err := remote.Implemented()
		assert.NoError(t, err)
		assert.Equal(t, []string{"OnActivate"}, implemented)

		hooks.On("OnActivate", mock.AnythingOfType("*rpcplugin.RemoteAPI")).Return(nil)
		assert.NoError(t, remote.OnActivate(&api))

		assert.NoError(t, remote.OnDeactivate())
	}))
}

func BenchmarkOnDeactivate(b *testing.B) {
	var hooks plugintest.Hooks
	hooks.On("OnDeactivate").Return(nil)

	if err := testHooksRPC(&hooks, func(remote *RemoteHooks) {
		b.ResetTimer()
		for n := 0; n < b.N; n++ {
			remote.OnDeactivate()
		}
		b.StopTimer()
	}); err != nil {
		b.Fatal(err.Error())
	}
}

func BenchmarkOnDeactivate_Unimplemented(b *testing.B) {
	var hooks testHooks

	if err := testHooksRPC(&hooks, func(remote *RemoteHooks) {
		b.ResetTimer()
		for n := 0; n < b.N; n++ {
			remote.OnDeactivate()
		}
		b.StopTimer()
	}); err != nil {
		b.Fatal(err.Error())
	}
}
