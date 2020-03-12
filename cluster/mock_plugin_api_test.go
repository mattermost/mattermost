package cluster

import (
	"bytes"
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
)

type mockPluginAPI struct {
	t *testing.T

	lock      sync.Mutex
	keyValues map[string][]byte
	failing   bool
}

func newMockPluginAPI(t *testing.T) *mockPluginAPI {
	return &mockPluginAPI{
		t:         t,
		keyValues: make(map[string][]byte),
	}
}

func (pluginAPI *mockPluginAPI) setFailing(failing bool) {
	pluginAPI.lock.Lock()
	defer pluginAPI.lock.Unlock()

	pluginAPI.failing = failing
}

func (pluginAPI *mockPluginAPI) clear() {
	pluginAPI.lock.Lock()
	defer pluginAPI.lock.Unlock()

	for k := range pluginAPI.keyValues {
		delete(pluginAPI.keyValues, k)
	}
}

func (pluginAPI *mockPluginAPI) KVGet(key string) ([]byte, *model.AppError) {
	pluginAPI.lock.Lock()
	defer pluginAPI.lock.Unlock()

	if pluginAPI.failing {
		return nil, &model.AppError{Message: "fake error"}
	}

	return pluginAPI.keyValues[key], nil
}

func (pluginAPI *mockPluginAPI) KVSetWithOptions(key string, value []byte, options model.PluginKVSetOptions) (bool, *model.AppError) {
	pluginAPI.lock.Lock()
	defer pluginAPI.lock.Unlock()

	if pluginAPI.failing {
		return false, &model.AppError{Message: "fake error"}
	}

	if options.Atomic {
		if actualValue := pluginAPI.keyValues[key]; !bytes.Equal(actualValue, options.OldValue) {
			return false, nil
		}
	}

	if value == nil {
		delete(pluginAPI.keyValues, key)
	} else {
		pluginAPI.keyValues[key] = value
	}

	return true, nil
}

func (pluginAPI *mockPluginAPI) LogError(msg string, keyValuePairs ...interface{}) {
	if pluginAPI.t == nil {
		return
	}

	pluginAPI.t.Helper()

	params := []interface{}{msg}
	params = append(params, keyValuePairs...)

	pluginAPI.t.Log(params...)
}
