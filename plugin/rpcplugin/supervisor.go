// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package rpcplugin

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

const (
	MaxProcessRestarts = 3
)

// Supervisor implements a plugin.Supervisor that launches the plugin in a separate process and
// communicates via RPC.
//
// If the plugin unexpectedly exits, the supervisor will relaunch it after a short delay, but will
// only restart a plugin at most three times.
type Supervisor struct {
	hooks      atomic.Value
	done       chan bool
	cancel     context.CancelFunc
	newProcess func(context.Context) (Process, io.ReadWriteCloser, error)
	pluginId   string
	pluginErr  error
}

var _ plugin.Supervisor = (*Supervisor)(nil)

// Starts the plugin. This method will block until the plugin is successfully launched for the first
// time and will return an error if the plugin cannot be launched at all.
func (s *Supervisor) Start(api plugin.API) error {
	ctx, cancel := context.WithCancel(context.Background())
	s.done = make(chan bool, 1)
	start := make(chan error, 1)
	go s.run(ctx, start, api)

	select {
	case <-time.After(time.Second * 3):
		cancel()
		<-s.done
		return fmt.Errorf("timed out waiting for plugin")
	case err := <-start:
		s.cancel = cancel
		return err
	}
}

// Waits for the supervisor to stop (on demand or of its own accord), returning any error that
// triggered the supervisor to stop.
func (s *Supervisor) Wait() error {
	<-s.done
	return s.pluginErr
}

// Stops the plugin.
func (s *Supervisor) Stop() error {
	s.cancel()
	<-s.done
	return nil
}

// Returns the hooks used to communicate with the plugin. The hooks may change if the plugin is
// restarted, so the return value should not be cached.
func (s *Supervisor) Hooks() plugin.Hooks {
	return s.hooks.Load().(plugin.Hooks)
}

func (s *Supervisor) run(ctx context.Context, start chan<- error, api plugin.API) {
	defer func() {
		close(s.done)
	}()
	done := ctx.Done()
	for i := 0; i <= MaxProcessRestarts; i++ {
		s.runPlugin(ctx, start, api)
		select {
		case <-done:
			return
		default:
			start = nil
			if i < MaxProcessRestarts {
				mlog.Error("Plugin terminated unexpectedly", mlog.String("plugin_id", s.pluginId))
				time.Sleep(time.Duration((1 + i*i)) * time.Second)
			} else {
				s.pluginErr = fmt.Errorf("plugin terminated unexpectedly too many times")
				mlog.Error("Plugin shutdown", mlog.String("plugin_id", s.pluginId), mlog.Int("max_process_restarts", MaxProcessRestarts), mlog.Err(s.pluginErr))
			}
		}
	}
}

func (s *Supervisor) runPlugin(ctx context.Context, start chan<- error, api plugin.API) error {
	if start == nil {
		mlog.Debug("Restarting plugin", mlog.String("plugin_id", s.pluginId))
	}

	p, ipc, err := s.newProcess(ctx)
	if err != nil {
		if start != nil {
			start <- err
		}
		return err
	}

	muxer := NewMuxer(ipc, false)
	closeMuxer := make(chan bool, 1)
	muxerClosed := make(chan error, 1)
	go func() {
		select {
		case <-ctx.Done():
			break
		case <-closeMuxer:
			break
		}
		muxerClosed <- muxer.Close()
	}()

	hooks, err := ConnectMain(muxer, s.pluginId)
	if err == nil {
		err = hooks.OnActivate(api)
	}

	if err != nil {
		if start != nil {
			start <- err
		}
		closeMuxer <- true
		<-muxerClosed
		p.Wait()
		return err
	}

	s.hooks.Store(hooks)

	if start != nil {
		start <- nil
	}
	p.Wait()
	closeMuxer <- true
	<-muxerClosed

	return nil
}

func SupervisorProvider(bundle *model.BundleInfo) (plugin.Supervisor, error) {
	return SupervisorWithNewProcessFunc(bundle, func(ctx context.Context) (Process, io.ReadWriteCloser, error) {
		executable := filepath.Clean(filepath.Join(".", bundle.Manifest.Backend.Executable))
		if strings.HasPrefix(executable, "..") {
			return nil, nil, fmt.Errorf("invalid backend executable")
		}
		return NewProcess(ctx, filepath.Join(bundle.Path, executable))
	})
}

func SupervisorWithNewProcessFunc(bundle *model.BundleInfo, newProcess func(context.Context) (Process, io.ReadWriteCloser, error)) (plugin.Supervisor, error) {
	if bundle.Manifest == nil {
		return nil, fmt.Errorf("no manifest available")
	} else if bundle.Manifest.Backend == nil || bundle.Manifest.Backend.Executable == "" {
		return nil, fmt.Errorf("no backend executable specified")
	}
	executable := filepath.Clean(filepath.Join(".", bundle.Manifest.Backend.Executable))
	if strings.HasPrefix(executable, "..") {
		return nil, fmt.Errorf("invalid backend executable")
	}
	return &Supervisor{pluginId: bundle.Manifest.Id, newProcess: newProcess}, nil
}
