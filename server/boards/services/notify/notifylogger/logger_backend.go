// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifylogger

import (
	"github.com/mattermost/mattermost-server/server/v7/boards/services/notify"

	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

const (
	backendName = "notifyLogger"
)

type Backend struct {
	logger mlog.LoggerIFace
	level  mlog.Level
}

func New(logger mlog.LoggerIFace, level mlog.Level) *Backend {
	return &Backend{
		logger: logger,
		level:  level,
	}
}

func (b *Backend) Start() error {
	return nil
}

func (b *Backend) ShutDown() error {
	_ = b.logger.Flush()
	return nil
}

func (b *Backend) BlockChanged(evt notify.BlockChangeEvent) error {
	var board string
	var card string

	if evt.Board != nil {
		board = evt.Board.Title
	}
	if evt.Card != nil {
		card = evt.Card.Title
	}

	b.logger.Log(b.level, "Block change event",
		mlog.String("action", string(evt.Action)),
		mlog.String("board", board),
		mlog.String("card", card),
		mlog.String("block_id", evt.BlockChanged.ID),
	)
	return nil
}

func (b *Backend) Name() string {
	return backendName
}
