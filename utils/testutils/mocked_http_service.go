// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package testutils

import (
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

func (h *MockedHTTPService) MakeClient(trustURLs bool) *http.Client {
	return h.Server.Client()
}

func (h *MockedHTTPService) Close() {
	h.Server.CloseClientConnections()
	h.Server.Close()
}
