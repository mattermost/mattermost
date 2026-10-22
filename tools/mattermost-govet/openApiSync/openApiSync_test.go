// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package openApiSync

import (
	"net/http"
	"testing"

	v3high "github.com/pb33f/libopenapi/datamodel/high/v3"
	"golang.org/x/tools/go/analysis/analysistest"
)

func Test(t *testing.T) {
	testdata := analysistest.TestData()
	specFile = analysistest.TestData() + "/spec.yaml"
	analysistest.Run(t, testdata, Analyzer, "api")
}

func TestCleanRegexp(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"/api/v4/users/{user_id:[0-9]+}", "/api/v4/users/{user_id}"},
		{"/api/v4/users/{username:[A-Za-z0-9\\_\\-\\.]+}", "/api/v4/users/{username}"},
		{"/api/v4/jobs/type/{job_type:[A-Za-z0-9_-]+}", "/api/v4/jobs/type/{job_type}"},
		// Literal-value constraints (e.g., {websocket:websocket}) are stripped like any other.
		{"/api/v4/{websocket:websocket}", "/api/v4/{websocket}"},
		// Group-alternation patterns must be left intact for splitHandlerByGroup.
		{"/api/v4/groups/{group_id}/{syncable_type:teams|channels}/{syncable_id}/link", "/api/v4/groups/{group_id}/{syncable_type:teams|channels}/{syncable_id}/link"},
		// No constraint — unchanged.
		{"/api/v4/users/{user_id}/posts", "/api/v4/users/{user_id}/posts"},
		// Multiple constrained params in one path.
		{"/api/v4/users/{user_id:[0-9]+}/posts/{post_id:[0-9]+}", "/api/v4/users/{user_id}/posts/{post_id}"},
	}
	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			if got := cleanRegexp(tc.input); got != tc.want {
				t.Errorf("cleanRegexp(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

func TestMatchesTemplate(t *testing.T) {
	tests := []struct {
		specPath    string
		handlerPath string
		want        bool
	}{
		// Exact match.
		{
			"/api/v4/groups/{group_id}/teams/{syncable_id}/link",
			"/api/v4/groups/{group_id}/teams/{syncable_id}/link",
			true,
		},
		// Spec param matches handler literal segment.
		{
			"/api/v4/groups/{group_id}/{syncable_type}/{syncable_id}/link",
			"/api/v4/groups/{group_id}/channels/{syncable_id}/link",
			true,
		},
		// Spec literal does not match a different handler literal.
		{
			"/api/v4/groups/{group_id}/teams/{syncable_id}/link",
			"/api/v4/groups/{group_id}/channels/{syncable_id}/link",
			false,
		},
		// Spec param matches handler param name.
		{
			"/api/v4/users/{user_id}",
			"/api/v4/users/{user_id}",
			true,
		},
		// Spec param matches handler literal "me".
		{
			"/api/v4/users/{user_id}",
			"/api/v4/users/me",
			true,
		},
		// Different path lengths.
		{
			"/api/v4/users/{user_id}/posts",
			"/api/v4/users/{user_id}",
			false,
		},
		// Completely different paths.
		{
			"/api/v4/teams/{team_id}",
			"/api/v4/users/{user_id}",
			false,
		},
	}
	for _, tc := range tests {
		t.Run(tc.specPath+"~"+tc.handlerPath, func(t *testing.T) {
			if got := matchesTemplate(tc.specPath, tc.handlerPath); got != tc.want {
				t.Errorf("matchesTemplate(%q, %q) = %v, want %v", tc.specPath, tc.handlerPath, got, tc.want)
			}
		})
	}
}

func TestGetOperation(t *testing.T) {
	get := &v3high.Operation{}
	post := &v3high.Operation{}
	put := &v3high.Operation{}
	patch := &v3high.Operation{}
	del := &v3high.Operation{}
	head := &v3high.Operation{}
	opts := &v3high.Operation{}
	trace := &v3high.Operation{}

	pathItem := &v3high.PathItem{
		Get:     get,
		Post:    post,
		Put:     put,
		Patch:   patch,
		Delete:  del,
		Head:    head,
		Options: opts,
		Trace:   trace,
	}

	tests := []struct {
		method string
		want   *v3high.Operation
	}{
		{http.MethodGet, get},
		{http.MethodPost, post},
		{http.MethodPut, put},
		{http.MethodPatch, patch},
		{http.MethodDelete, del},
		{http.MethodHead, head},
		{http.MethodOptions, opts},
		{http.MethodTrace, trace},
		{"get", get},   // case-insensitive
		{"post", post}, // case-insensitive
		{"UNKNOWN", nil},
	}
	for _, tc := range tests {
		t.Run(tc.method, func(t *testing.T) {
			if got := getOperation(pathItem, tc.method); got != tc.want {
				t.Errorf("getOperation(pathItem, %q) = %v, want %v", tc.method, got, tc.want)
			}
		})
	}
}
