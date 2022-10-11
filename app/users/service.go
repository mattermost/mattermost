// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"errors"

	"github.com/mattermost/mattermost-server/v6/app/request"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

type UserService struct {
	store        store.UserStore
	sessionStore store.SessionStore
	oAuthStore   store.OAuthStore
	metrics      einterfaces.MetricsInterface
	cluster      einterfaces.ClusterInterface
	config       func() *model.Config
	license      func(request.CTX) *model.License
	ctx          request.CTX
}

// ServiceConfig is used to initialize the UserService.
type ServiceConfig struct {
	// Mandatory fields
	UserStore    store.UserStore
	SessionStore store.SessionStore
	OAuthStore   store.OAuthStore
	ConfigFn     func() *model.Config
	LicenseFn    func(request.CTX) *model.License
	// Optional fields
	Metrics einterfaces.MetricsInterface
	Cluster einterfaces.ClusterInterface
	Context request.CTX
}

func New(c ServiceConfig) (*UserService, error) {
	if err := c.validate(); err != nil {
		return nil, err
	}

	return &UserService{
		store:        c.UserStore,
		sessionStore: c.SessionStore,
		oAuthStore:   c.OAuthStore,
		config:       c.ConfigFn,
		license:      c.LicenseFn,
		metrics:      c.Metrics,
		cluster:      c.Cluster,
	}, nil
}

func (c *ServiceConfig) validate() error {
	if c.ConfigFn == nil || c.UserStore == nil || c.SessionStore == nil || c.OAuthStore == nil || c.LicenseFn == nil {
		return errors.New("required parameters are not provided")
	}

	return nil
}
