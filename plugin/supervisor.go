// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/hashicorp/go-plugin"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

type Supervisor struct {
	pluginId    string
	client      *plugin.Client
	hooks       Hooks
	implemented [TotalHooksId]bool
}

func NewSupervisor(pluginInfo *model.BundleInfo, parentLogger *mlog.Logger, apiImpl API) (*Supervisor, error) {
	supervisor := Supervisor{}

	wrappedLogger := pluginInfo.WrapLogger(parentLogger)

	hclogAdaptedLogger := &HclogAdapter{
		wrappedLogger: wrappedLogger.WithCallerSkip(1),
		extrasKey:     "wrapped_extras",
	}

	pluginMap := map[string]plugin.Plugin{
		"hooks": &HooksPlugin{
			log:     wrappedLogger,
			apiImpl: apiImpl,
		},
	}

	executable := filepath.Clean(filepath.Join(".", pluginInfo.Manifest.Backend.Executable))
	if strings.HasPrefix(executable, "..") {
		return nil, fmt.Errorf("invalid backend executable")
	}
	executable = filepath.Join(pluginInfo.Path, executable)

	supervisor.client = plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig: Handshake,
		Plugins:         pluginMap,
		Cmd:             exec.Command(executable),
		SyncStdout:      wrappedLogger.With(mlog.String("source", "plugin_stdout")).StdLogWriter(),
		SyncStderr:      wrappedLogger.With(mlog.String("source", "plugin_stderr")).StdLogWriter(),
		Logger:          hclogAdaptedLogger,
		StartTimeout:    time.Second * 3,
	})

	rpcClient, err := supervisor.client.Client()
	if err != nil {
		return nil, err
	}

	raw, err := rpcClient.Dispense("hooks")
	if err != nil {
		return nil, err
	}

	supervisor.hooks = raw.(Hooks)

	if impl, err := supervisor.hooks.Implemented(); err != nil {
		return nil, err
	} else {
		for _, hookName := range impl {
			if hookId, ok := HookNameToId[hookName]; ok {
				supervisor.implemented[hookId] = true
			}
		}
	}

	err = supervisor.Hooks().OnActivate()
	if err != nil {
		return nil, err
	}

	return &supervisor, nil
}

func (sup *Supervisor) Shutdown() {
	sup.client.Kill()
}

func (sup *Supervisor) Hooks() Hooks {
	return sup.hooks
}

func (sup *Supervisor) Implements(hookId int) bool {
	return sup.implemented[hookId]
}
