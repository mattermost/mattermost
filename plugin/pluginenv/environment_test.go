package pluginenv

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
)

type MockProvider struct {
	mock.Mock
}

func (m *MockProvider) API(manifest *model.Manifest) (plugin.API, error) {
	ret := m.Called()
	if ret.Get(0) == nil {
		return nil, ret.Error(1)
	}
	return ret.Get(0).(plugin.API), ret.Error(1)
}

func (m *MockProvider) Supervisor(bundle *model.BundleInfo) (plugin.Supervisor, error) {
	ret := m.Called()
	if ret.Get(0) == nil {
		return nil, ret.Error(1)
	}
	return ret.Get(0).(plugin.Supervisor), ret.Error(1)
}

type MockSupervisor struct {
	mock.Mock
}

func (m *MockSupervisor) Start(api plugin.API) error {
	return m.Called(api).Error(0)
}

func (m *MockSupervisor) Stop() error {
	return m.Called().Error(0)
}

func (m *MockSupervisor) Hooks() plugin.Hooks {
	return m.Called().Get(0).(plugin.Hooks)
}

func initTmpDir(t *testing.T, files map[string]string) string {
	success := false
	dir, err := ioutil.TempDir("", "mm-plugin-test")
	require.NoError(t, err)
	defer func() {
		if !success {
			os.RemoveAll(dir)
		}
	}()

	for name, contents := range files {
		path := filepath.Join(dir, name)
		parent := filepath.Dir(path)
		require.NoError(t, os.MkdirAll(parent, 0700))
		f, err := os.Create(path)
		require.NoError(t, err)
		_, err = f.WriteString(contents)
		f.Close()
		require.NoError(t, err)
	}

	success = true
	return dir
}

func TestNew_MissingOptions(t *testing.T) {
	dir := initTmpDir(t, map[string]string{
		"foo/plugin.json": `{"id": "foo"}`,
	})
	defer os.RemoveAll(dir)

	var provider MockProvider
	defer provider.AssertExpectations(t)

	env, err := New(
		APIProvider(provider.API),
	)
	assert.Nil(t, env)
	assert.Error(t, err)
}

func TestEnvironment(t *testing.T) {
	dir := initTmpDir(t, map[string]string{
		".foo/plugin.json": `{"id": "foo"}`,
		"foo/bar":          "asdf",
		"foo/plugin.json":  `{"id": "foo", "backend": {}}`,
		"bar/zxc":          "qwer",
		"baz/plugin.yaml":  "id: baz",
		"bad/plugin.json":  "asd",
		"qwe":              "asd",
	})
	defer os.RemoveAll(dir)

	webappDir := "notarealdirectory"

	var provider MockProvider
	defer provider.AssertExpectations(t)

	env, err := New(
		SearchPath(dir),
		WebappPath(webappDir),
		APIProvider(provider.API),
		SupervisorProvider(provider.Supervisor),
	)
	require.NoError(t, err)
	defer env.Shutdown()

	plugins, err := env.Plugins()
	assert.NoError(t, err)
	assert.Len(t, plugins, 3)

	activePlugins := env.ActivePlugins()
	assert.Len(t, activePlugins, 0)

	assert.Error(t, env.ActivatePlugin("x"))

	var api struct{ plugin.API }
	var supervisor MockSupervisor
	defer supervisor.AssertExpectations(t)
	var hooks plugintest.Hooks
	defer hooks.AssertExpectations(t)

	provider.On("API").Return(&api, nil)
	provider.On("Supervisor").Return(&supervisor, nil)

	supervisor.On("Start", &api).Return(nil)
	supervisor.On("Stop").Return(nil)
	supervisor.On("Hooks").Return(&hooks)

	assert.NoError(t, env.ActivatePlugin("foo"))
	assert.Equal(t, env.ActivePluginIds(), []string{"foo"})
	activePlugins = env.ActivePlugins()
	assert.Len(t, activePlugins, 1)
	assert.Error(t, env.ActivatePlugin("foo"))
	assert.True(t, env.IsPluginActive("foo"))

	hooks.On("OnDeactivate").Return(nil)
	assert.NoError(t, env.DeactivatePlugin("foo"))
	assert.Error(t, env.DeactivatePlugin("foo"))
	assert.False(t, env.IsPluginActive("foo"))

	assert.NoError(t, env.ActivatePlugin("foo"))
	assert.Equal(t, env.ActivePluginIds(), []string{"foo"})

	assert.Equal(t, env.SearchPath(), dir)
	assert.Equal(t, env.WebappPath(), webappDir)

	assert.Empty(t, env.Shutdown())
}

func TestEnvironment_DuplicatePluginError(t *testing.T) {
	dir := initTmpDir(t, map[string]string{
		"foo/plugin.json":  `{"id": "foo"}`,
		"foo2/plugin.json": `{"id": "foo"}`,
	})
	defer os.RemoveAll(dir)

	var provider MockProvider
	defer provider.AssertExpectations(t)

	env, err := New(
		SearchPath(dir),
		APIProvider(provider.API),
		SupervisorProvider(provider.Supervisor),
	)
	require.NoError(t, err)
	defer env.Shutdown()

	assert.Error(t, env.ActivatePlugin("foo"))
	assert.Empty(t, env.ActivePluginIds())
}

func TestEnvironment_BadSearchPathError(t *testing.T) {
	var provider MockProvider
	defer provider.AssertExpectations(t)

	env, err := New(
		SearchPath("thissearchpathshouldnotexist!"),
		APIProvider(provider.API),
		SupervisorProvider(provider.Supervisor),
	)
	require.NoError(t, err)
	defer env.Shutdown()

	assert.Error(t, env.ActivatePlugin("foo"))
	assert.Empty(t, env.ActivePluginIds())
}

func TestEnvironment_ActivatePluginErrors(t *testing.T) {
	dir := initTmpDir(t, map[string]string{
		"foo/plugin.json": `{"id": "foo", "backend": {}}`,
	})
	defer os.RemoveAll(dir)

	var provider MockProvider

	env, err := New(
		SearchPath(dir),
		APIProvider(provider.API),
		SupervisorProvider(provider.Supervisor),
	)
	require.NoError(t, err)
	defer env.Shutdown()

	var api struct{ plugin.API }
	var supervisor MockSupervisor
	var hooks plugintest.Hooks

	for name, setup := range map[string]func(){
		"SupervisorProviderError": func() {
			provider.On("Supervisor").Return(nil, fmt.Errorf("test error"))
		},
		"APIProviderError": func() {
			provider.On("API").Return(plugin.API(nil), fmt.Errorf("test error"))
			provider.On("Supervisor").Return(&supervisor, nil)
		},
		"SupervisorError": func() {
			provider.On("API").Return(&api, nil)
			provider.On("Supervisor").Return(&supervisor, nil)

			supervisor.On("Start", &api).Return(fmt.Errorf("test error"))
		},
	} {
		t.Run(name, func(t *testing.T) {
			supervisor.Mock = mock.Mock{}
			hooks.Mock = mock.Mock{}
			provider.Mock = mock.Mock{}
			setup()
			assert.Error(t, env.ActivatePlugin("foo"))
			assert.Empty(t, env.ActivePluginIds())
			supervisor.AssertExpectations(t)
			hooks.AssertExpectations(t)
			provider.AssertExpectations(t)
		})
	}
}

func TestEnvironment_ShutdownError(t *testing.T) {
	dir := initTmpDir(t, map[string]string{
		"foo/plugin.json": `{"id": "foo", "backend": {}}`,
	})
	defer os.RemoveAll(dir)

	var provider MockProvider
	defer provider.AssertExpectations(t)

	env, err := New(
		SearchPath(dir),
		APIProvider(provider.API),
		SupervisorProvider(provider.Supervisor),
	)
	require.NoError(t, err)
	defer env.Shutdown()

	var api struct{ plugin.API }
	var supervisor MockSupervisor
	defer supervisor.AssertExpectations(t)
	var hooks plugintest.Hooks
	defer hooks.AssertExpectations(t)

	provider.On("API").Return(&api, nil)
	provider.On("Supervisor").Return(&supervisor, nil)

	supervisor.On("Start", &api).Return(nil)
	supervisor.On("Stop").Return(fmt.Errorf("test error"))
	supervisor.On("Hooks").Return(&hooks)

	hooks.On("OnDeactivate").Return(fmt.Errorf("test error"))

	assert.NoError(t, env.ActivatePlugin("foo"))
	assert.Equal(t, env.ActivePluginIds(), []string{"foo"})
	assert.Len(t, env.Shutdown(), 2)
}

func TestEnvironment_ConcurrentHookInvocations(t *testing.T) {
	dir := initTmpDir(t, map[string]string{
		"foo/plugin.json": `{"id": "foo", "backend": {}}`,
	})
	defer os.RemoveAll(dir)

	var provider MockProvider
	defer provider.AssertExpectations(t)

	var api struct{ plugin.API }
	var supervisor MockSupervisor
	defer supervisor.AssertExpectations(t)
	var hooks plugintest.Hooks
	defer hooks.AssertExpectations(t)

	env, err := New(
		SearchPath(dir),
		APIProvider(provider.API),
		SupervisorProvider(provider.Supervisor),
	)
	require.NoError(t, err)
	defer env.Shutdown()

	provider.On("API").Return(&api, nil)
	provider.On("Supervisor").Return(&supervisor, nil)

	supervisor.On("Start", &api).Return(nil)
	supervisor.On("Stop").Return(nil)
	supervisor.On("Hooks").Return(&hooks)

	ch := make(chan bool)

	hooks.On("OnDeactivate").Return(nil)
	hooks.On("ServeHTTP", mock.AnythingOfType("*httptest.ResponseRecorder"), mock.AnythingOfType("*http.Request")).Run(func(args mock.Arguments) {
		r := args.Get(1).(*http.Request)
		if r.URL.Path == "/1" {
			<-ch
		} else {
			ch <- true
		}
	})

	assert.NoError(t, env.ActivatePlugin("foo"))

	rec := httptest.NewRecorder()

	wg := sync.WaitGroup{}
	wg.Add(2)

	go func() {
		req, err := http.NewRequest("GET", "/1", nil)
		require.NoError(t, err)
		env.Hooks().ServeHTTP(rec, req.WithContext(context.WithValue(context.Background(), "plugin_id", "foo")))
		wg.Done()
	}()

	go func() {
		req, err := http.NewRequest("GET", "/2", nil)
		require.NoError(t, err)
		env.Hooks().ServeHTTP(rec, req.WithContext(context.WithValue(context.Background(), "plugin_id", "foo")))
		wg.Done()
	}()

	wg.Wait()
}

func TestEnvironment_HooksForPlugins(t *testing.T) {
	dir := initTmpDir(t, map[string]string{
		"foo/plugin.json": `{"id": "foo", "backend": {}}`,
	})
	defer os.RemoveAll(dir)

	var provider MockProvider
	defer provider.AssertExpectations(t)

	env, err := New(
		SearchPath(dir),
		APIProvider(provider.API),
		SupervisorProvider(provider.Supervisor),
	)
	require.NoError(t, err)
	defer env.Shutdown()

	var api struct{ plugin.API }
	var supervisor MockSupervisor
	defer supervisor.AssertExpectations(t)
	var hooks plugintest.Hooks
	defer hooks.AssertExpectations(t)

	provider.On("API").Return(&api, nil)
	provider.On("Supervisor").Return(&supervisor, nil)

	supervisor.On("Start", &api).Return(nil)
	supervisor.On("Stop").Return(nil)
	supervisor.On("Hooks").Return(&hooks)

	hooks.On("OnDeactivate").Return(nil)
	hooks.On("ExecuteCommand", mock.AnythingOfType("*model.CommandArgs")).Return(&model.CommandResponse{
		Text: "bar",
	}, nil)

	assert.NoError(t, env.ActivatePlugin("foo"))
	assert.Equal(t, env.ActivePluginIds(), []string{"foo"})

	resp, appErr, err := env.HooksForPlugin("foo").ExecuteCommand(&model.CommandArgs{
		Command: "/foo",
	})
	assert.Equal(t, "bar", resp.Text)
	assert.Nil(t, appErr)
	assert.NoError(t, err)

	assert.Empty(t, env.Shutdown())
}
