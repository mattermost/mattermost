// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"io"
	"net/http"
	"runtime/debug"
	"strings"
)

func (s *Supervisor) handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		routePrefix := ""
		if paths := strings.Split(r.URL.Path, "/"); len(paths) > 1 {
			routePrefix = paths[1]
		}

		// Wiping out RequestURI because it's an error for a client
		// to do that.
		r.RequestURI = ""
		r.URL.Scheme = "http"

		// Check prefix
		// and appropriately route to the right host.
		for _, app := range s.cfg.AppSettings {
			if app.RoutePrefix == routePrefix {
				r.URL.Host = routePrefix
				r.Host = routePrefix

				resp, err := s.client.Do(r)
				if err != nil {
					s.logger.Println(err)
					return
				}
				defer resp.Body.Close()

				// We copy over the response headers
				for key, value := range resp.Header {
					w.Header().Set(key, strings.Join(value, ", "))
				}

				_, err = io.Copy(w, resp.Body)
				if err != nil {
					s.logger.Println("failed to copy response body", err)
				}
				return
			}
		}

		// Did not match any prefix.
		// By default route all requests to Chat.
		// http.Redirect(w, r, "/"+s.cfg.ServiceSettings.DefaultRoutePrefix, http.StatusFound)

		r.URL.Host = s.cfg.ServiceSettings.DefaultRoutePrefix
		r.Host = s.cfg.ServiceSettings.DefaultRoutePrefix
		resp, err := s.client.Do(r)
		if err != nil {
			s.logger.Println(err)
			return
		}
		defer resp.Body.Close()

		// We copy over the response headers
		for key, value := range resp.Header {
			w.Header().Set(key, strings.Join(value, ", "))
		}

		_, err = io.Copy(w, resp.Body)
		if err != nil {
			s.logger.Println("failed to copy response body", err)
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
