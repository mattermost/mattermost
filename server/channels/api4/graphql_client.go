// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
)

// graphQLClient is an internal test client to run the tests.
// When the API matures, we will expose it to the model package.
type graphQLClient struct {
	URL        string       // The location of the server, for example  "http://localhost:8065"
	APIURL     string       // The api location of the server, for example "http://localhost:8065/api/v4"
	httpClient *http.Client // The http client
	authToken  string
	authType   string
	httpHeader map[string]string // Headers to be copied over for each request
}

func newGraphQLClient(url string) *graphQLClient {
	url = strings.TrimRight(url, "/")
	return &graphQLClient{url, url + model.APIURLSuffix, &http.Client{}, "", "", map[string]string{}}
}

func (c *graphQLClient) login(loginId string, password string) (*model.User, *model.Response, error) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password

	r, err := c.doAPIRequest(http.MethodPost, c.APIURL+"/users/login", strings.NewReader(model.MapToJSON(m)), map[string]string{model.HeaderEtagClient: ""})

	if err != nil {
		return nil, model.BuildResponse(r), err
	}
	defer closeBody(r)
	c.authToken = r.Header.Get(model.HeaderToken)
	c.authType = model.HeaderBearer

	var user model.User
	if jsonErr := json.NewDecoder(r.Body).Decode(&user); jsonErr != nil {
		return nil, nil, model.NewAppError("login", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	return &user, model.BuildResponse(r), nil
}

func (c *graphQLClient) doAPIRequest(method, url string, data io.Reader, headers map[string]string) (*http.Response, error) {
	rq, err := c.prepareRequest(method, url, data, headers)
	if err != nil {
		return nil, err
	}

	rp, err := c.httpClient.Do(rq)
	if err != nil {
		return rp, err
	}

	return rp, nil
}

func (c *graphQLClient) prepareRequest(method, url string, data io.Reader, headers map[string]string) (*http.Request, error) {
	rq, err := http.NewRequest(method, url, data)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		rq.Header.Set(k, v)
	}

	if c.authToken != "" {
		rq.Header.Set(model.HeaderAuth, c.authType+" "+c.authToken)
	}

	if c.httpHeader != nil && len(c.httpHeader) > 0 {
		for k, v := range c.httpHeader {
			rq.Header.Set(k, v)
		}
	}

	return rq, nil
}
