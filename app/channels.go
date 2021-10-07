// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See ENTERPRISE-LICENSE.txt and SOURCE-CODE-LICENSE.txt for license information.

package app

// Channels contains all channels related state.
type Channels struct {
	s *Server
}

func init() {
	RegisterProduct("channels", func(s *Server) (Product, error) {
		return NewChannels(s)
	})
}

func NewChannels(s *Server) (*Channels, error) {
	return &Channels{
		s: s,
	}, nil
}

func (c *Channels) Start() error {
	return nil
}

func (c *Channels) Stop() error {
	return nil
}
