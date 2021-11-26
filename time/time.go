// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package time

import (
	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"
)

// Time contains all time related state.
type Time struct {
	srv *app.Server
}

func init() {
	app.RegisterProduct("time", func(s *app.Server) (app.Product, error) {
		return NewTime(s)
	})
}

func NewTime(s *app.Server) (*Time, error) {
	ti := &Time{
		srv: s,
	}

	return ti, nil
}

func (ti *Time) Start() error {
	return nil
}

func (ti *Time) Stop() error {
	return nil
}

func (ti *Time) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return ti.srv.AddConfigListener(listener)
}

func (ti *Time) RemoveConfigListener(id string) {
	ti.srv.RemoveConfigListener(id)
}
