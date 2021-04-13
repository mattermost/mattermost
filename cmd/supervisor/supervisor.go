// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"os/user"
	"runtime/debug"
	"strings"
	"time"
)

type Supervisor struct {
	cfg     Config
	srv     *http.Server
	logger  *log.Logger
	cmds    map[string]*exec.Cmd              // map of app name to the command
	proxies map[string]*httputil.ReverseProxy // map of app route prefix to the proxy
}

func newSupervisor(cfg Config) (*Supervisor, error) {
	sup := &Supervisor{
		cfg:     cfg,
		logger:  log.New(os.Stderr, "[supervisor] ", log.LstdFlags|log.Lshortfile),
		cmds:    make(map[string]*exec.Cmd),
		proxies: make(map[string]*httputil.ReverseProxy),
	}

	server := &http.Server{
		Addr:         cfg.ServiceSettings.Host,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  30 * time.Second,
		TLSConfig: &tls.Config{
			MinVersion:               tls.VersionTLS12,
			PreferServerCipherSuites: true,
			CurvePreferences: []tls.CurveID{
				tls.CurveP256,
			},
		},
	}
	sup.srv = server
	sup.srv.Handler = sup.withRecovery(http.HandlerFunc(sup.handleRequestAndRedirect))

	// Initialize commands and proxies for all apps.
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

		// parse the url
		url, err := url.Parse(app.Host)
		if err != nil {
			return nil, err
		}

		// create the reverse proxy
		proxy := httputil.NewSingleHostReverseProxy(url)
		sup.proxies[app.RoutePrefix] = proxy
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

	// Start HTTP server
	s.logger.Println("Starting HTTP Server..")
	var err error
	if s.cfg.ServiceSettings.TLSCertFile != "" && s.cfg.ServiceSettings.TLSKeyFile != "" {
		err = s.srv.ListenAndServeTLS(s.cfg.ServiceSettings.TLSCertFile, s.cfg.ServiceSettings.TLSKeyFile)
	} else {
		err = s.srv.ListenAndServe()
	}
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}

	return nil
}

func (s *Supervisor) Stop() error {
	// Stop HTTP Server.
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := s.srv.Shutdown(ctx); err != nil {
		return fmt.Errorf("error trying to shutdown HTTP server: %v", err)
	}

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

func (s *Supervisor) handleRequestAndRedirect(w http.ResponseWriter, req *http.Request) {
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
			url, _ := url.Parse(app.Host) // Any error will already be handled during
			// initialization.
			// Update the headers to allow for SSL redirection
			req.URL.Host = url.Host
			req.URL.Scheme = url.Scheme
			req.Header.Set("X-Forwarded-Host", req.Header.Get("Host"))
			req.Host = url.Host

			// Note that ServeHTTP is non blocking and uses a go routine under the hood
			s.proxies[app.RoutePrefix].ServeHTTP(w, req)
		}
	}
}

func (s *Supervisor) withRecovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if x := recover(); x != nil {
				s.logger.Printf("recovered from a panic: URL: %s, %v %v",
					r.URL.String(), x, string(debug.Stack()))
			}
		}()
		next.ServeHTTP(w, r)
	})
}
