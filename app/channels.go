// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync/atomic"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/imageproxy"
	"github.com/pkg/errors"
)

// Channels contains all channels related state.
type Channels struct {
	srv *Server

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
	return &Channels{
		srv:        s,
		imageProxy: imageproxy.MakeImageProxy(s, s.httpService, s.Log),
	}, nil
}

func (ch *Channels) Start() error {
	if err := ch.ensureAsymmetricSigningKey(); err != nil {
		return errors.Wrapf(err, "unable to ensure asymmetric signing key")
	}
	return nil
}

func (*Channels) Stop() error {
	return nil
}
