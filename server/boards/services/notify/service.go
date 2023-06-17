// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notify

import (
	"sync"

	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost/server/v8/boards/model"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type Action string

const (
	Add    Action = "add"
	Update Action = "update"
	Delete Action = "delete"
)

type BlockChangeEvent struct {
	Action       Action
	TeamID       string
	Board        *model.Board
	Card         *model.Block
	BlockChanged *model.Block
	BlockOld     *model.Block
	ModifiedBy   *model.BoardMember
}

// Backend provides an interface for sending notifications.
type Backend interface {
	Start() error
	ShutDown() error
	BlockChanged(evt BlockChangeEvent) error
	Name() string
}

// Service is a service that sends notifications based on block activity using one or more backends.
type Service struct {
	mux      sync.RWMutex
	backends []Backend
	logger   mlog.LoggerIFace
}

// New creates a notification service with one or more Backends capable of sending notifications.
func New(logger mlog.LoggerIFace, backends ...Backend) (*Service, error) {
	notify := &Service{
		backends: make([]Backend, 0, len(backends)),
		logger:   logger,
	}

	merr := merror.New()
	for _, backend := range backends {
		if err := notify.AddBackend(backend); err != nil {
			merr.Append(err)
		} else {
			logger.Info("Initialized notification backend", mlog.String("name", backend.Name()))
		}
	}
	return notify, merr.ErrorOrNil()
}

// AddBackend adds a backend to the list that will be informed of any block changes.
func (s *Service) AddBackend(backend Backend) error {
	if err := backend.Start(); err != nil {
		return err
	}
	s.mux.Lock()
	defer s.mux.Unlock()
	s.backends = append(s.backends, backend)
	return nil
}

// Shutdown calls shutdown for all backends.
func (s *Service) Shutdown() error {
	s.mux.Lock()
	defer s.mux.Unlock()

	merr := merror.New()
	for _, backend := range s.backends {
		if err := backend.ShutDown(); err != nil {
			merr.Append(err)
		}
	}
	s.backends = nil
	return merr.ErrorOrNil()
}

// BlockChanged should be called whenever a block is added/updated/deleted.
// All backends are informed of the event.
func (s *Service) BlockChanged(evt BlockChangeEvent) {
	s.mux.RLock()
	defer s.mux.RUnlock()

	for _, backend := range s.backends {
		if err := backend.BlockChanged(evt); err != nil {
			s.logger.Error("Error delivering notification",
				mlog.String("backend", backend.Name()),
				mlog.String("action", string(evt.Action)),
				mlog.String("block_id", evt.BlockChanged.ID),
				mlog.Err(err),
			)
		}
	}
}
