// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	plugin "github.com/hashicorp/go-plugin"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

type supervisor struct {
	client      *plugin.Client
	hooks       Hooks
	implemented [TotalHooksId]bool
	pid         int
}

func newSupervisor(pluginInfo *model.BundleInfo, parentLogger *mlog.Logger, apiImpl API) (retSupervisor *supervisor, retErr error) {
	sup := supervisor{}
	defer func() {
		if retErr != nil {
			sup.Shutdown()
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

	cmd := exec.Command(executable)

	sup.client = plugin.NewClient(&plugin.ClientConfig{
		HandshakeConfig: handshake,
		Plugins:         pluginMap,
		Cmd:             cmd,
		SyncStdout:      wrappedLogger.With(mlog.String("source", "plugin_stdout")).StdLogWriter(),
		SyncStderr:      wrappedLogger.With(mlog.String("source", "plugin_stderr")).StdLogWriter(),
		Logger:          hclogAdaptedLogger,
		StartTimeout:    time.Second * 3,
	})

	rpcClient, err := sup.client.Client()
	if err != nil {
		return nil, err
	}

	sup.pid = cmd.Process.Pid

	raw, err := rpcClient.Dispense("hooks")
	if err != nil {
		return nil, err
	}

	sup.hooks = raw.(Hooks)

	impl, err := sup.hooks.Implemented()
	if err != nil {
		return nil, err
	}
	for _, hookName := range impl {
		if hookId, ok := hookNameToId[hookName]; ok {
			sup.implemented[hookId] = true
		}
	}

	err = sup.Hooks().OnActivate()
	if err != nil {
		return nil, err
	}

	return &sup, nil
}

func (sup *supervisor) Shutdown() {
	if sup.client != nil {
		sup.client.Kill()
	}
}

func (sup *supervisor) Hooks() Hooks {
	return sup.hooks
}

// PerformHealthCheck checks the plugin through a process check, an RPC ping, and a HealthCheck hook call.
func (sup *supervisor) PerformHealthCheck() error {
	if procErr := sup.CheckProcess(); procErr != nil {
		mlog.Debug(fmt.Sprintf("Error checking plugin process, error: %s", procErr.Error()))
		return errors.New("Plugin process not found, or not responding")
	}

	if pingErr := sup.Ping(); pingErr != nil {
		for pingFails := 1; pingFails < HEALTH_CHECK_PING_FAIL_LIMIT; pingFails++ {
			pingErr = sup.Ping()
			if pingErr == nil {
				break
			}
		}
		if pingErr != nil {
			mlog.Debug(fmt.Sprintf("Error pinging plugin, error: %s", pingErr.Error()))
			return fmt.Errorf("Plugin RPC connection is not responding")
		}
	}

	return nil
}

// Ping checks that the RPC connection with the plugin is alive and healthy.
func (sup *supervisor) Ping() error {
	client, err := sup.client.Client()

	if err != nil {
		return err
	}

	return client.Ping()
}

// CheckProcess checks if the plugin process's PID exists and can respond to a signal.
func (sup *supervisor) CheckProcess() error {
	process, err := os.FindProcess(sup.pid)
	if err != nil {
		return err
	}

	err = process.Signal(syscall.Signal(0))
	if err != nil {
		return err
	}

	return nil
}

func (sup *supervisor) Implements(hookId int) bool {
	return sup.implemented[hookId]
}
