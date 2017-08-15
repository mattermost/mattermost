package rpcplugin

import (
	"context"
	"fmt"
	"path/filepath"
	"sync/atomic"
	"time"

	"github.com/mattermost/platform/plugin"
)

// Supervisor implements a plugin.Supervisor that launches the plugin in a separate process and
// communicates via RPC.
//
// If the plugin unexpectedly exists, the supervisor will relaunch it after a short delay.
type Supervisor struct {
	executable string
	hooks      atomic.Value
	done       chan bool
	cancel     context.CancelFunc
}

var _ plugin.Supervisor = (*Supervisor)(nil)

// Starts the plugin. This method will block until the plugin is successfully launched for the first
// time and will return an error if the plugin cannot be launched at all.
func (s *Supervisor) Start() error {
	ctx, cancel := context.WithCancel(context.Background())
	s.done = make(chan bool, 1)
	start := make(chan error, 1)
	go s.run(ctx, start)

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

func (s *Supervisor) run(ctx context.Context, start chan<- error) {
	defer func() {
		s.done <- true
	}()
	done := ctx.Done()
	for {
		s.runPlugin(ctx, start)
		select {
		case <-done:
			return
		default:
			start = nil
			time.Sleep(time.Second)
		}
	}
}

func (s *Supervisor) runPlugin(ctx context.Context, start chan<- error) error {
	p, ipc, err := NewProcess(ctx, s.executable)
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

	hooks, err := ConnectMain(muxer)
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

func SupervisorProvider(bundle *plugin.BundleInfo) (plugin.Supervisor, error) {
	if bundle.Manifest == nil {
		return nil, fmt.Errorf("no manifest available")
	} else if bundle.Manifest.Backend == nil || bundle.Manifest.Backend.Executable == "" {
		return nil, fmt.Errorf("no backend executable specified")
	}
	return &Supervisor{
		executable: filepath.Join(bundle.Path, bundle.Manifest.Backend.Executable),
	}, nil
}
