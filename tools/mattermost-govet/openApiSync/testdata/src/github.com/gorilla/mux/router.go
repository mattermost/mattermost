// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mux

import "net/http"

type Router struct {
}

func (*Router) PathPrefix(_ string) *Router {
	return &Router{}
}
func (*Router) Subrouter() *Router {
	return &Router{}
}
func (*Router) Handle(_ string, h http.Handler) *Router {
	return &Router{}
}
func (*Router) Methods(_ ...string) *Router {
	return &Router{}
}
