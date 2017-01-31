// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"fmt"
	"net/http"
	"strings"
)

type Response struct {
	StatusCode    int
	Error         *AppError
	RequestId     string
	Etag          string
	ServerVersion string
}

type Client4 struct {
	Url        string       // The location of the server, for example  "http://localhost:8065"
	ApiUrl     string       // The api location of the server, for example "http://localhost:8065/api/v4"
	HttpClient *http.Client // The http client
	AuthToken  string
	AuthType   string
}

func NewAPIv4Client(url string) *Client4 {
	return &Client4{url, url + API_URL_SUFFIX, &http.Client{}, "", ""}
}

func BuildResponse(r *http.Response) *Response {
	return &Response{
		StatusCode:    r.StatusCode,
		RequestId:     r.Header.Get(HEADER_REQUEST_ID),
		Etag:          r.Header.Get(HEADER_ETAG_SERVER),
		ServerVersion: r.Header.Get(HEADER_VERSION_ID),
	}
}

func (c *Client4) SetOAuthToken(token string) {
	c.AuthToken = token
	c.AuthType = HEADER_TOKEN
}

func (c *Client4) ClearOAuthToken() {
	c.AuthToken = ""
	c.AuthType = HEADER_BEARER
}

func (c *Client4) GetUsersRoute() string {
	return fmt.Sprintf("/users")
}

func (c *Client4) GetUserRoute(userId string) string {
	return fmt.Sprintf(c.GetUsersRoute()+"/%v", userId)
}

func (c *Client4) GetTeamsRoute() string {
	return fmt.Sprintf("/teams")
}

func (c *Client4) GetChannelsRoute() string {
	return fmt.Sprintf("/channels")
}

func (c *Client4) GetChannelRoute(channelId string) string {
	return fmt.Sprintf(c.GetChannelsRoute()+"/%v", channelId)
}

func (c *Client4) GetTeamRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamsRoute()+"/%v", teamId)
}

func (c *Client4) DoApiGet(url string, etag string) (*http.Response, *AppError) {
	return c.DoApiRequest(http.MethodGet, url, "", etag)
}

func (c *Client4) DoApiPost(url string, data string) (*http.Response, *AppError) {
	return c.DoApiRequest(http.MethodPost, url, data, "")
}

func (c *Client4) DoApiPut(url string, data string) (*http.Response, *AppError) {
	return c.DoApiRequest(http.MethodPut, url, data, "")
}

func (c *Client4) DoApiDelete(url string, data string) (*http.Response, *AppError) {
	return c.DoApiRequest(http.MethodDelete, url, "", "")
}

func (c *Client4) DoApiRequest(method, url, data, etag string) (*http.Response, *AppError) {
	rq, _ := http.NewRequest(method, c.ApiUrl+url, strings.NewReader(data))
	rq.Close = true

	if len(etag) > 0 {
		rq.Header.Set(HEADER_ETAG_CLIENT, etag)
	}

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewLocAppError(url, "model.client.connecting.app_error", nil, err.Error())
	} else if rp.StatusCode == 304 {
		return rp, nil
	} else if rp.StatusCode >= 300 {
		defer closeBody(rp)
		return rp, AppErrorFromJson(rp.Body)
	} else {
		return rp, nil
	}
}

// CheckStatusOK is a convenience function for checking the standard OK response
// from the web service.
func CheckStatusOK(r *http.Response) bool {
	m := MapFromJson(r.Body)
	defer closeBody(r)

	if m != nil && m[STATUS] == STATUS_OK {
		return true
	}

	return false
}

// Authentication Section

// LoginById authenticates a user by user id and password.
func (c *Client4) LoginById(id string, password string) (*User, *Response) {
	m := make(map[string]string)
	m["id"] = id
	m["password"] = password
	return c.login(m)
}

// Login authenticates a user by login id, which can be username, email or some sort
// of SSO identifier based on server configuration, and a password.
func (c *Client4) Login(loginId string, password string) (*User, *Response) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	return c.login(m)
}

// LoginByLdap authenticates a user by LDAP id and password.
func (c *Client4) LoginByLdap(loginId string, password string) (*User, *Response) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["ldap_only"] = "true"
	return c.login(m)
}

// LoginWithDevice authenticates a user by login id (username, email or some sort
// of SSO identifier based on configuration), password and attaches a device id to
// the session.
func (c *Client4) LoginWithDevice(loginId string, password string, deviceId string) (*User, *Response) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["device_id"] = deviceId
	return c.login(m)
}

func (c *Client4) login(m map[string]string) (*User, *Response) {
	if r, err := c.DoApiPost("/users/login", MapToJson(m)); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		c.AuthToken = r.Header.Get(HEADER_TOKEN)
		c.AuthType = HEADER_BEARER
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// Logout terminates the current user's session.
func (c *Client4) Logout() (bool, *Response) {
	if r, err := c.DoApiPost("/users/logout", ""); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		c.AuthToken = ""
		c.AuthType = HEADER_BEARER

		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// User Section

// CreateUser creates a user in the system based on the provided user struct.
func (c *Client4) CreateUser(user *User) (*User, *Response) {
	if r, err := c.DoApiPost(c.GetUsersRoute(), user.ToJson()); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// GetUser returns a user based on the provided user id string.
func (c *Client4) GetUser(userId, etag string) (*User, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateUser updates a user in the system based on the provided user struct.
func (c *Client4) UpdateUser(user *User) (*User, *Response) {
	if r, err := c.DoApiPut(c.GetUserRoute(user.Id), user.ToJson()); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// Team Section

// CreateTeam creates a team in the system based on the provided team struct.
func (c *Client4) CreateTeam(team *Team) (*Team, *Response) {
	if r, err := c.DoApiPost(c.GetTeamsRoute(), team.ToJson()); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return TeamFromJson(r.Body), BuildResponse(r)
	}
}

// Channel Section

// CreateChannel creates a channel based on the provided channel struct.
func (c *Client4) CreateChannel(channel *Channel) (*Channel, *Response) {
	if r, err := c.DoApiPost(c.GetChannelsRoute(), channel.ToJson()); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// Post Section
// to be filled in..
