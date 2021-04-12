// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"os/user"
	"strings"
)

type Supervisor struct {
	cfg    Config
	srv    *http.Server
	logger *log.Logger
	cmds   map[string]*exec.Cmd
	client *http.Client
}

func newSupervisor(cfg Config) (*Supervisor, error) {
	sup := &Supervisor{
		cfg:    cfg,
		logger: log.New(os.Stderr, "[supervisor] ", log.LstdFlags|log.Lshortfile),
		cmds:   make(map[string]*exec.Cmd),
	}

	// Initialize commands for all apps.
	for _, app := range sup.cfg.AppSettings {
		cmd := exec.CommandContext(context.Background(), app.Command, app.Args...)
		cmd.Dir = app.CommandDir
		cmd.Stderr = os.Stderr
		cmd.Stdout = os.Stdout
		currentUser, err := user.Current()
		if err != nil {
			return nil, err
		}
		cmd.Env = append(cmd.Env, []string{"USER=" + currentUser.Name, "HOME=" + currentUser.HomeDir}...)
		sup.cmds[app.Name] = cmd
	}

	return sup, nil
}

func (s *Supervisor) Start() error {
	// Start the apps
	for name, cmd := range s.cmds {
		s.logger.Printf("Starting %s\n", name)
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("error trying to start %q: %v", cmd.Path, err)
		}
	}

	return nil
}

func (s *Supervisor) Stop() error {
	// Stop the apps.
	for name, cmd := range s.cmds {
		s.logger.Printf("Shutting down %s\n", name)
		// TODO: Interrupt on windows does not work.
		if err := cmd.Process.Signal(os.Interrupt); err != nil {
			s.logger.Printf("error trying to interrupt %q: %v", cmd.Path, err)
			// We need to try to shut down other apps too, so we have to continue
			continue
		}
		if err := cmd.Wait(); err != nil {
			s.logger.Printf("error waiting for %q to exit: %v", cmd.Path, err)
			continue
		}
	}
	return nil
}

func (s *Supervisor) handleRequestAndRedirect(res http.ResponseWriter, req *http.Request) {
	routePrefix := ""
	if paths := strings.Split(req.URL.Path, "/"); len(paths) > 1 {
		routePrefix = paths[1]
	}

	if routePrefix == "" {
		routePrefix = s.cfg.ServiceSettings.DefaultRoutePrefix
		req.URL.Path = routePrefix + "/" + req.URL.Path
	}

	for _, app := range s.cfg.AppSettings {
		if app.RoutePrefix == routePrefix {
			// parse the url
			url, _ := url.Parse(app.Host)

			// create the reverse proxy
			proxy := httputil.NewSingleHostReverseProxy(url)

			// Update the headers to allow for SSL redirection
			req.URL.Host = url.Host
			req.URL.Scheme = url.Scheme
			req.Header.Set("X-Forwarded-Host", req.Header.Get("Host"))
			req.Host = url.Host

			// Note that ServeHttp is non blocking and uses a go routine under the hood
			proxy.ServeHTTP(res, req)
		}
	}
}
