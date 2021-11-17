// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"
	"sync/atomic"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/services/imageproxy"
	"github.com/pkg/errors"
)

// Channels contains all channels related state.
type Channels struct {
	srv *Server

	pluginCommandsLock     sync.RWMutex
	pluginCommands         []*PluginCommand
	pluginsLock            sync.RWMutex
	pluginsEnvironment     *plugin.Environment
	pluginConfigListenerID string

	imageProxy *imageproxy.ImageProxy

	asymmetricSigningKey atomic.Value
	clientConfig         atomic.Value
	clientConfigHash     atomic.Value
	limitedClientConfig  atomic.Value

	// cached counts that are used during notice condition validation
	cachedPostCount   int64
	cachedUserCount   int64
	cachedDBMSVersion string
	// previously fetched notices
	cachedNotices model.ProductNotices
}

func init() {
	RegisterProduct("channels", func(s *Server) (Product, error) {
		return NewChannels(s)
	})
}

func NewChannels(s *Server) (*Channels, error) {
	ch := &Channels{
		srv:        s,
		imageProxy: imageproxy.MakeImageProxy(s, s.httpService, s.Log),
	}
	// Setup routes.
	pluginsRoute := ch.srv.Router.PathPrefix("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	pluginsRoute.HandleFunc("", ch.ServePluginRequest)
	pluginsRoute.HandleFunc("/public/{public_file:.*}", ch.ServePluginPublicRequest)
	pluginsRoute.HandleFunc("/{anything:.*}", ch.ServePluginRequest)

	return ch, nil
}

func (ch *Channels) Start() error {
	// Start plugins
	ctx := request.EmptyContext()
	ch.initPlugins(ctx, *ch.srv.Config().PluginSettings.Directory, *ch.srv.Config().PluginSettings.ClientDirectory)

	ch.AddConfigListener(func(prevCfg, cfg *model.Config) {
		if *cfg.PluginSettings.Enable {
			ch.initPlugins(ctx, *cfg.PluginSettings.Directory, *ch.srv.Config().PluginSettings.ClientDirectory)
		} else {
			ch.ShutDownPlugins()
		}
	})

	if err := ch.ensureAsymmetricSigningKey(); err != nil {
		return errors.Wrapf(err, "unable to ensure asymmetric signing key")
	}
	return nil
}

func (ch *Channels) Stop() error {
	ch.ShutDownPlugins()
	return nil
}

func (ch *Channels) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return ch.srv.AddConfigListener(listener)
}

func (ch *Channels) RemoveConfigListener(id string) {
	ch.srv.RemoveConfigListener(id)
}
