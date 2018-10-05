// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/hashicorp/go-plugin"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

type supervisor struct {
	client      *plugin.Client
	hooks       Hooks
	implemented [TotalHooksId]bool
}

func newSupervisor(pluginInfo *model.BundleInfo, parentLogger *mlog.Logger, apiImpl API) (retSupervisor *supervisor, retErr error) {
	supervisor := supervisor{}
	defer func() {
		if retErr != nil {
			supervisor.Shutdown()
		}
	}()

	wrappedLogger := pluginInfo.WrapLogger(parentLogger)

	hclogAdaptedLogger := &hclogAdapter{
		wrappedLogger: wrappedLogger.WithCallerSkip(1),
		extrasKey:     "wrapped_extras",
	}

	pluginMap := map[string]plugin.Plugin{
		"hooks": &hooksPlugin{
			log:     wrappedLogger,
			apiImpl: apiImpl,
		},
	}

	executable := filepath.Clean(filepath.Join(
		".",
		pluginInfo.Manifest.GetExecutableForRuntime(runtime.GOOS, runtime.GOARCH),
	))
	if strings.HasPrefix(executable, "..") {
		return nil, fmt.Errorf("invalid backend executable")
	}
	executable = filepath.Join(pluginInfo.Path, executable)

	supervisor.client = plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig: handshake,
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
			if hookId, ok := hookNameToId[hookName]; ok {
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

func (sup *supervisor) Shutdown() {
	if sup.client != nil {
		sup.client.Kill()
	}
}

func (sup *supervisor) Hooks() Hooks {
	return sup.hooks
}

func (sup *supervisor) Implements(hookId int) bool {
	return sup.implemented[hookId]
}
