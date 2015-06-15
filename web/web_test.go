// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
	"testing"
	"time"
)

var ApiClient *model.Client
var URL string

func Setup() {
	if api.Srv == nil {
		utils.LoadConfig("config.json")
		api.NewServer()
		api.StartServer()
		api.InitApi()
		InitWeb()
		URL = "http://localhost:" + utils.Cfg.ServiceSettings.Port
		ApiClient = model.NewClient(URL + "/api/v1")
	}
}

func TearDown() {
	if api.Srv != nil {
		api.StopServer()
	}
}

func TestStatic(t *testing.T) {
	Setup()

	resp, _ := http.Get(URL + "/static/images/favicon.ico")

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("couldn't get static files %v", resp.StatusCode)
	}
}

func TestZZWebTearDown(t *testing.T) {
	// *IMPORTANT*
	// This should be the last function in any test file
	// that calls Setup()
	// Should be in the last file too sorted by name
	time.Sleep(2 * time.Second)
	TearDown()
}
