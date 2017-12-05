package rpcplugin

import (
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
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

		hooks.On("OnConfigurationChange").Return(nil)
		assert.NoError(t, remote.OnConfigurationChange())

		hooks.On("ServeHTTP", mock.AnythingOfType("*rpcplugin.RemoteHTTPResponseWriter"), mock.AnythingOfType("*http.Request")).Run(func(args mock.Arguments) {
			w := args.Get(0).(http.ResponseWriter)
			r := args.Get(1).(*http.Request)
			assert.Equal(t, "/foo", r.URL.Path)
			assert.Equal(t, "POST", r.Method)
			body, err := ioutil.ReadAll(r.Body)
			assert.NoError(t, err)
			assert.Equal(t, "asdf", string(body))
			assert.Equal(t, "header", r.Header.Get("Test-Header"))
			w.Write([]byte("bar"))
		})

		w := httptest.NewRecorder()
		r, err := http.NewRequest("POST", "/foo", strings.NewReader("asdf"))
		r.Header.Set("Test-Header", "header")
		assert.NoError(t, err)
		remote.ServeHTTP(w, r)

		resp := w.Result()
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		body, err := ioutil.ReadAll(resp.Body)
		assert.NoError(t, err)
		assert.Equal(t, "bar", string(body))

		hooks.On("ExecuteCommand", &model.CommandArgs{
			Command: "/foo",
		}).Return(&model.CommandResponse{
			Text: "bar",
		}, nil)
		commandResponse, appErr := hooks.ExecuteCommand(&model.CommandArgs{
			Command: "/foo",
		})
		assert.Equal(t, "bar", commandResponse.Text)
		assert.Nil(t, appErr)
	}))
}

func TestHooks_Concurrency(t *testing.T) {
	var hooks plugintest.Hooks
	defer hooks.AssertExpectations(t)

	assert.NoError(t, testHooksRPC(&hooks, func(remote *RemoteHooks) {
		ch := make(chan bool)

		hooks.On("ServeHTTP", mock.AnythingOfType("*rpcplugin.RemoteHTTPResponseWriter"), mock.AnythingOfType("*http.Request")).Run(func(args mock.Arguments) {
			r := args.Get(1).(*http.Request)
			if r.URL.Path == "/1" {
				<-ch
			} else {
				ch <- true
			}
		})

		rec := httptest.NewRecorder()

		wg := sync.WaitGroup{}
		wg.Add(2)

		go func() {
			req, err := http.NewRequest("GET", "/1", nil)
			require.NoError(t, err)
			remote.ServeHTTP(rec, req)
			wg.Done()
		}()

		go func() {
			req, err := http.NewRequest("GET", "/2", nil)
			require.NoError(t, err)
			remote.ServeHTTP(rec, req)
			wg.Done()
		}()

		wg.Wait()
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

type benchmarkHooks struct{}

func (*benchmarkHooks) OnDeactivate() error { return nil }

func (*benchmarkHooks) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ioutil.ReadAll(r.Body)
	w.Header().Set("Foo-Header", "foo")
	http.Error(w, "foo", http.StatusBadRequest)
}

func BenchmarkHooks_OnDeactivate(b *testing.B) {
	var hooks benchmarkHooks

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

func BenchmarkHooks_ServeHTTP(b *testing.B) {
	var hooks benchmarkHooks

	if err := testHooksRPC(&hooks, func(remote *RemoteHooks) {
		b.ResetTimer()
		for n := 0; n < b.N; n++ {
			w := httptest.NewRecorder()
			r, _ := http.NewRequest("POST", "/foo", strings.NewReader("12345678901234567890"))
			remote.ServeHTTP(w, r)
		}
		b.StopTimer()
	}); err != nil {
		b.Fatal(err.Error())
	}
}

func BenchmarkHooks_Unimplemented(b *testing.B) {
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
