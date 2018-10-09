// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package testutils

import (
	"github.com/mattermost/mattermost-server/services/httpservice"
	"net/http"
	"net/http/httptest"
)

type MockedHTTPService struct {
	Server *httptest.Server
}

func MakeMockedHTTPService(handler http.Handler) *MockedHTTPService {
	return &MockedHTTPService{
		Server: httptest.NewServer(handler),
	}
}

func (h *MockedHTTPService) MakeClient(trustURLs bool) *httpservice.Client {
	return &httpservice.Client{Client: h.Server.Client()}
}

func (h *MockedHTTPService) Close() {
	h.Server.CloseClientConnections()
	h.Server.Close()
}
