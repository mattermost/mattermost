package plugin

import (
	"io/ioutil"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/require"
)

func TestRecoverFromWrongHttpCode(t *testing.T) {
	dir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	backend := filepath.Join(dir, "backend.exe")
	utils.CompileGo(t, `
		package main

		import (
			"fmt"
			"net/http"
			"github.com/mattermost/mattermost-server/plugin"
		)

		type Plugin struct {
			plugin.MattermostPlugin
		}

		func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			fmt.Fprint(w, "Hello, world!")
			w.WriteHeader(999)
		}

		func main() {
			plugin.ClientMain(&Plugin{})
		}
	`, backend)

	err = ioutil.WriteFile(filepath.Join(dir, "plugin.json"), []byte(`{"id": "foo", "backend": {"executable": "backend.exe"}}`), 0600)
	require.NoError(t, err)

	bundle := model.BundleInfoForPath(dir)
	log := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		ConsoleLevel:  "error",
		EnableFile:    false,
	})

	supervisor, err := newSupervisor(bundle, log, nil)
	require.Nil(t, err)
	require.NotNil(t, supervisor)

	err = supervisor.PerformHealthCheck()
	require.Nil(t, err)

	r := httptest.NewRequest("GET", "/foo", nil)
	w := httptest.NewRecorder()
	supervisor.hooks.ServeHTTP(nil, w, r)

	err = supervisor.PerformHealthCheck()
	require.Nil(t, err)
}
