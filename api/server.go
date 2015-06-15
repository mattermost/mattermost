// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"github.com/braintree/manners"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"net/http"
	"time"
)

type Server struct {
	Server *manners.GracefulServer
	Store  store.Store
	Router *mux.Router
}

var Srv *Server

func NewServer() {

	l4g.Info("Server is initializing...")

	Srv = &Server{}
	Srv.Server = manners.NewServer()
	Srv.Store = store.NewSqlStore()
	store.RedisClient()

	Srv.Router = mux.NewRouter()
	Srv.Router.NotFoundHandler = http.HandlerFunc(Handle404)
}

func StartServer() {
	l4g.Info("Starting Server...")

	l4g.Info("Server is listening on " + utils.Cfg.ServiceSettings.Port)
	go func() {
		err := Srv.Server.ListenAndServe(":"+utils.Cfg.ServiceSettings.Port, Srv.Router)
		if err != nil {
			l4g.Critical("Error starting server, err:%v", err)
			time.Sleep(time.Second)
			panic("Error starting server " + err.Error())
		}
	}()
}

func StopServer() {

	l4g.Info("Stopping Server...")

	Srv.Server.Shutdown <- true
	Srv.Store.Close()
	store.RedisClose()

	l4g.Info("Server stopped")
}
