// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v6/services/httpservice"
	"github.com/mattermost/mattermost-server/v6/services/imageproxy"
)

// Channels contains all channels related state.
type Channels struct {
	srv *Server

	httpService httpservice.HTTPService
	imageProxy  *imageproxy.ImageProxy
}

func init() {
	RegisterProduct("channels", func(s *Server) (Product, error) {
		return NewChannels(s)
	})
}

func NewChannels(s *Server) (*Channels, error) {
	httpSvc := httpservice.MakeHTTPService(s)
	return &Channels{
		srv:         s,
		httpService: httpSvc,
		imageProxy:  imageproxy.MakeImageProxy(s, httpSvc, s.Log),
	}, nil
}

func (c *Channels) Start() error {
	return nil
}

func (c *Channels) Stop() error {
	return nil
}

func (c *Channels) HTTPService() httpservice.HTTPService {
	return c.httpService
}
