// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"sync"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// CallerIDExtractor is a function type that extracts the caller ID from a request context.
// This avoids circular dependency between the properties and app packages.
type CallerIDExtractor func(rctx request.CTX) string

// RequestOptionsExtractor extracts the caller's per-call PropertyRequestOptions
// from a request context.
type RequestOptionsExtractor func(rctx request.CTX) model.PropertyRequestOptions

type PropertyService struct {
	groupStore              store.PropertyGroupStore
	fieldStore              store.PropertyFieldStore
	valueStore              store.PropertyValueStore
	hooks                   []PropertyHook
	callerIDExtractor       CallerIDExtractor
	requestOptionsExtractor RequestOptionsExtractor
	groupCache              sync.Map // name -> *model.PropertyGroup
	groupIDCache            sync.Map // id -> *model.PropertyGroup
}

type ServiceConfig struct {
	PropertyGroupStore      store.PropertyGroupStore
	PropertyFieldStore      store.PropertyFieldStore
	PropertyValueStore      store.PropertyValueStore
	CallerIDExtractor       CallerIDExtractor
	RequestOptionsExtractor RequestOptionsExtractor
}

func New(c ServiceConfig) (*PropertyService, error) {
	if err := c.validate(); err != nil {
		return nil, err
	}

	return &PropertyService{
		groupStore:              c.PropertyGroupStore,
		fieldStore:              c.PropertyFieldStore,
		valueStore:              c.PropertyValueStore,
		callerIDExtractor:       c.CallerIDExtractor,
		requestOptionsExtractor: c.RequestOptionsExtractor,
	}, nil
}

func (c *ServiceConfig) validate() error {
	if c.PropertyGroupStore == nil || c.PropertyFieldStore == nil || c.PropertyValueStore == nil {
		return errors.New("required parameters are not provided")
	}
	return nil
}

// extractCallerID gets the caller ID from a request context using the configured extractor.
func (ps *PropertyService) extractCallerID(rctx request.CTX) string {
	if ps.callerIDExtractor == nil || rctx == nil {
		return ""
	}
	return ps.callerIDExtractor(rctx)
}

// extractRequestOptions gets the caller's per-call options from a request context
// using the configured extractor.
func (ps *PropertyService) extractRequestOptions(rctx request.CTX) model.PropertyRequestOptions {
	if ps.requestOptionsExtractor == nil || rctx == nil {
		return model.PropertyRequestOptions{}
	}
	return ps.requestOptionsExtractor(rctx)
}
