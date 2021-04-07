// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"time"
)

type Supervisor struct {
	cfg    Config
	srv    *http.Server
	logger *log.Logger
	cmds   []*exec.Cmd
	client *http.Client
}

func newSupervisor(cfg Config) *Supervisor {
	sup := &Supervisor{
		cfg:    cfg,
		logger: log.New(os.Stderr, "[supervisor] ", log.LstdFlags|log.Lshortfile),
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
	sup.srv.Handler = sup.withRecovery(sup.handler())

	client := &http.Client{
		Transport: &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			DialContext:           sup.dialer,
			ForceAttemptHTTP2:     true,
			MaxConnsPerHost:       100,
			MaxIdleConns:          50,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: 30 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
	}
	sup.client = client

	// Initialize commands for all apps.
	for _, app := range sup.cfg.AppSettings {
		cmd := exec.CommandContext(context.Background(), app.BinaryPath, app.Args...)
		cmd.Stderr = os.Stderr
		cmd.Stdout = os.Stdout
		sup.cmds = append(sup.cmds, cmd)
	}

	return sup
}

func (s *Supervisor) dialer(ctx context.Context, network, addr string) (net.Conn, error) {
	dialer := net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}

	return dialer.DialContext(ctx, "unix", s.findSocket(host))
}

func (s *Supervisor) findSocket(routePrefix string) string {
	for _, app := range s.cfg.AppSettings {
		if app.RoutePrefix == routePrefix {
			return app.SocketPath
		}
	}
	return s.cfg.ServiceSettings.DefaultRoutePrefix
}

func (s *Supervisor) Start() error {
	// Start the apps
	for _, cmd := range s.cmds {
		s.logger.Printf("Starting %s\n", cmd.Path)
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
	return err
}

func (s *Supervisor) Stop() error {
	// Stop HTTP Server.
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := s.srv.Shutdown(ctx); err != nil {
		return fmt.Errorf("error trying to shutdown HTTP server: %v", err)
	}

	// Stop the apps.
	for _, cmd := range s.cmds {
		s.logger.Printf("Shutting down %s\n", cmd.Path)
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
