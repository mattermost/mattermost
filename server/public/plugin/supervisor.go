// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	plugin "github.com/hashicorp/go-plugin"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type supervisor struct {
	lock         sync.RWMutex
	pluginID     string
	appDriver    AppDriver
	client       *plugin.Client
	hooks        Hooks
	implemented  [TotalHooksID]bool
	hooksClient  *hooksRPCClient
	isReattached bool
}

type driverForPlugin struct {
	AppDriver
	pluginID string
}

func (d *driverForPlugin) Conn(isMaster bool) (string, error) {
	return d.AppDriver.ConnWithPluginID(isMaster, d.pluginID)
}

func WithExecutableFromManifest(pluginInfo *model.BundleInfo) func(*supervisor, *plugin.ClientConfig) error {
	return func(_ *supervisor, clientConfig *plugin.ClientConfig) error {
		executable := pluginInfo.Manifest.GetExecutableForRuntime(runtime.GOOS, runtime.GOARCH)
		if executable == "" {
			return fmt.Errorf("backend executable not found for environment: %s/%s", runtime.GOOS, runtime.GOARCH)
		}

		executable = filepath.Clean(filepath.Join(".", executable))
		if strings.HasPrefix(executable, "..") {
			return fmt.Errorf("invalid backend executable: %s", executable)
		}

		executable = filepath.Join(pluginInfo.Path, executable)

		cmd := exec.Command(executable)

		// This doesn't add more security than before
		// but removes the SecureConfig is nil warning.
		// https://mattermost.atlassian.net/browse/MM-49167
		pluginChecksum, err := getPluginExecutableChecksum(executable)
		if err != nil {
			return errors.Wrapf(err, "unable to generate plugin checksum")
		}

		clientConfig.Cmd = cmd
		clientConfig.SecureConfig = &plugin.SecureConfig{
			Checksum: pluginChecksum,
			Hash:     sha256.New(),
		}

		return nil
	}
}

func WithReattachConfig(pluginReattachConfig *model.PluginReattachConfig) func(*supervisor, *plugin.ClientConfig) error {
	return func(sup *supervisor, clientConfig *plugin.ClientConfig) error {
		clientConfig.Reattach = pluginReattachConfig.ToHashicorpPluginReattachmentConfig()
		sup.isReattached = true

		return nil
	}
}

func newSupervisor(pluginInfo *model.BundleInfo, apiImpl API, driver AppDriver, parentLogger *mlog.Logger, metrics metricsInterface, opts ...func(*supervisor, *plugin.ClientConfig) error) (retSupervisor *supervisor, retErr error) {
	sup := supervisor{
		pluginID: pluginInfo.Manifest.Id,
	}
	if driver != nil {
		sup.appDriver = &driverForPlugin{AppDriver: driver, pluginID: pluginInfo.Manifest.Id}
	}

	defer func() {
		if retErr != nil {
			sup.Shutdown()
		}
	}()

	wrappedLogger := pluginInfo.WrapLogger(parentLogger)

	hclogAdaptedLogger := &hclogAdapter{
		wrappedLogger: wrappedLogger,
		extrasKey:     "wrapped_extras",
	}

	pluginMap := map[string]plugin.Plugin{
		"hooks": &hooksPlugin{
			log:        wrappedLogger,
			driverImpl: sup.appDriver,
			apiImpl:    &apiTimerLayer{pluginInfo.Manifest.Id, apiImpl, metrics},
		},
	}

	clientConfig := &plugin.ClientConfig{
		HandshakeConfig: handshake,
		Plugins:         pluginMap,
		SyncStdout:      wrappedLogger.With(mlog.String("source", "plugin_stdout")).StdLogWriter(),
		SyncStderr:      wrappedLogger.With(mlog.String("source", "plugin_stderr")).StdLogWriter(),
		Logger:          hclogAdaptedLogger,
		StartTimeout:    time.Second * 3,
	}
	for _, opt := range opts {
		err := opt(&sup, clientConfig)
		if err != nil {
			return nil, errors.Wrap(err, "failed to apply option")
		}
	}

	sup.client = plugin.NewClient(clientConfig)

	rpcClient, err := sup.client.Client()
	if err != nil {
		return nil, err
	}

	raw, err := rpcClient.Dispense("hooks")
	if err != nil {
		return nil, err
	}

	c, ok := raw.(*hooksRPCClient)
	if ok {
		sup.hooksClient = c
	}

	sup.hooks = &hooksTimerLayer{pluginInfo.Manifest.Id, raw.(Hooks), metrics}

	impl, err := sup.hooks.Implemented()
	if err != nil {
		return nil, err
	}
	for _, hookName := range impl {
		if hookId, ok := hookNameToId[hookName]; ok {
			sup.implemented[hookId] = true
		}
	}

	return &sup, nil
}

func (sup *supervisor) Shutdown() {
	sup.lock.RLock()
	defer sup.lock.RUnlock()
	if sup.client != nil {
		// For reattached plugins, Kill() is mostly a no-op, so manually clean up the
		// underlying rpcClient. This might be something to upstream unless we're doing
		// something else wrong.
		if sup.isReattached {
			rpcClient, err := sup.client.Client()
			if err != nil {
				mlog.Warn("Failed to obtain rpcClient on Shutdown")
			} else {
				if err = rpcClient.Close(); err != nil {
					mlog.Warn("Failed to close rpcClient on Shutdown")
				}
			}
		}

		sup.client.Kill()
	}

	// Wait for API RPC server and DB RPC server to exit.
	// And then shutdown conns.
	if sup.hooksClient != nil {
		sup.hooksClient.doneWg.Wait()
		if sup.appDriver != nil {
			sup.appDriver.ShutdownConns(sup.pluginID)
		}
	}
}

func (sup *supervisor) Hooks() Hooks {
	sup.lock.RLock()
	defer sup.lock.RUnlock()
	return sup.hooks
}

// PerformHealthCheck checks the plugin through an an RPC ping.
func (sup *supervisor) PerformHealthCheck() error {
	// No need for a lock here because Ping is read-locked.
	if pingErr := sup.Ping(); pingErr != nil {
		for pingFails := 1; pingFails < HealthCheckPingFailLimit; pingFails++ {
			pingErr = sup.Ping()
			if pingErr == nil {
				break
			}
		}
		if pingErr != nil {
			return fmt.Errorf("plugin RPC connection is not responding")
		}
	}

	return nil
}

// Ping checks that the RPC connection with the plugin is alive and healthy.
func (sup *supervisor) Ping() error {
	sup.lock.RLock()
	defer sup.lock.RUnlock()
	client, err := sup.client.Client()
	if err != nil {
		return err
	}

	return client.Ping()
}

func (sup *supervisor) Implements(hookId int) bool {
	sup.lock.RLock()
	defer sup.lock.RUnlock()
	return sup.implemented[hookId]
}

func getPluginExecutableChecksum(executablePath string) ([]byte, error) {
	pathHash := sha256.New()
	file, err := os.Open(executablePath)

	if err != nil {
		return nil, err
	}

	defer file.Close()

	_, err = io.Copy(pathHash, file)
	if err != nil {
		return nil, err
	}

	return pathHash.Sum(nil), nil
}
