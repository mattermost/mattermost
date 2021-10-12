// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "github.com/mattermost/mattermost-server/v6/services/httpservice"

// Channels contains all channels related state.
type Channels struct {
	srv *Server

	httpService httpservice.HTTPService
}

func init() {
	RegisterProduct("channels", func(s *Server) (Product, error) {
		return NewChannels(s)
	})
}

func NewChannels(s *Server) (*Channels, error) {
	return &Channels{
		srv:         s,
		httpService: httpservice.MakeHTTPService(s),
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
