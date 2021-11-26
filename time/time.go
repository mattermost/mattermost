// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package time

import (
	"github.com/gorilla/mux"

	mmApp "github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/model"

	"github.com/mattermost/mattermost-server/v6/time/api"
)

// Time contains all time related state.
type Time struct {
	srv    *mmApp.Server
	router *mux.Router
}

func init() {
	mmApp.RegisterProduct("time", func(s *mmApp.Server, r *mux.Router) (mmApp.Product, error) {
		return NewTime(s, r)
	})
}

func NewTime(s *mmApp.Server, r *mux.Router) (*Time, error) {
	ti := &Time{
		srv:    s,
		router: r,
	}

	api.Init(r, s)

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
