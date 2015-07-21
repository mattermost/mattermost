// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	HEADER_REQUEST_ID      = "X-Request-ID"
	HEADER_VERSION_ID      = "X-Version-ID"
	HEADER_ETAG_SERVER     = "ETag"
	HEADER_ETAG_CLIENT     = "If-None-Match"
	HEADER_FORWARDED       = "X-Forwarded-For"
	HEADER_FORWARDED_PROTO = "X-Forwarded-Proto"
	HEADER_TOKEN           = "token"
	HEADER_AUTH            = "Authorization"
)

type Result struct {
	RequestId string
	Etag      string
	Data      interface{}
}

type Client struct {
	Url        string       // The location of the server like "http://localhost/api/v1"
	HttpClient *http.Client // The http client
	AuthToken  string
}

// NewClient constructs a new client with convienence methods for talking to
// the server.
func NewClient(url string) *Client {
	return &Client{url, &http.Client{}, ""}
}

func (c *Client) DoPost(url string, data string) (*http.Response, *AppError) {
	rq, _ := http.NewRequest("POST", c.Url+url, strings.NewReader(data))

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, "We encountered an error while connecting to the server", err.Error())
	} else if rp.StatusCode >= 300 {
		return nil, AppErrorFromJson(rp.Body)
	} else {
		return rp, nil
	}
}

func (c *Client) DoGet(url string, data string, etag string) (*http.Response, *AppError) {
	rq, _ := http.NewRequest("GET", c.Url+url, strings.NewReader(data))

	if len(etag) > 0 {
		rq.Header.Set(HEADER_ETAG_CLIENT, etag)
	}

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, "We encountered an error while connecting to the server", err.Error())
	} else if rp.StatusCode == 304 {
		return rp, nil
	} else if rp.StatusCode >= 300 {
		return rp, AppErrorFromJson(rp.Body)
	} else {
		return rp, nil
	}
}

func getCookie(name string, resp *http.Response) *http.Cookie {
	for _, cookie := range resp.Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}

	return nil
}

func (c *Client) Must(result *Result, err *AppError) *Result {
	if err != nil {
		time.Sleep(time.Second)
		panic(err)
	}

	return result
}

func (c *Client) SignupTeam(email string, displayName string) (*Result, *AppError) {
	m := make(map[string]string)
	m["email"] = email
	m["display_name"] = displayName
	if r, err := c.DoPost("/teams/signup", MapToJson(m)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateTeamFromSignup(teamSignup *TeamSignup) (*Result, *AppError) {
	if r, err := c.DoPost("/teams/create_from_signup", teamSignup.ToJson()); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamSignupFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateTeam(team *Team) (*Result, *AppError) {
	if r, err := c.DoPost("/teams/create", team.ToJson()); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamFromJson(r.Body)}, nil
	}
}

func (c *Client) FindTeamByName(name string, allServers bool) (*Result, *AppError) {
	m := make(map[string]string)
	m["name"] = name
	m["all"] = fmt.Sprintf("%v", allServers)
	if r, err := c.DoPost("/teams/find_team_by_name", MapToJson(m)); err != nil {
		return nil, err
	} else {
		val := false
		if body, _ := ioutil.ReadAll(r.Body); string(body) == "true" {
			val = true
		}

		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), val}, nil
	}
}

func (c *Client) FindTeams(email string) (*Result, *AppError) {
	m := make(map[string]string)
	m["email"] = email
	if r, err := c.DoPost("/teams/find_teams", MapToJson(m)); err != nil {
		return nil, err
	} else {

		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ArrayFromJson(r.Body)}, nil
	}
}

func (c *Client) FindTeamsSendEmail(email string) (*Result, *AppError) {
	m := make(map[string]string)
	m["email"] = email
	if r, err := c.DoPost("/teams/email_teams", MapToJson(m)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ArrayFromJson(r.Body)}, nil
	}
}

func (c *Client) InviteMembers(invites *Invites) (*Result, *AppError) {
	if r, err := c.DoPost("/teams/invite_members", invites.ToJson()); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), InvitesFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateTeamDisplayName(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoPost("/teams/update_name", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateValetFeature(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoPost("/teams/update_valet_feature", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateUser(user *User, hash string) (*Result, *AppError) {
	if r, err := c.DoPost("/users/create", user.ToJson()); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateUserFromSignup(user *User, data string, hash string) (*Result, *AppError) {
	if r, err := c.DoPost("/users/create?d="+data+"&h="+hash, user.ToJson()); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) GetUser(id string, etag string) (*Result, *AppError) {
	if r, err := c.DoGet("/users/"+id, "", etag); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) GetMe(etag string) (*Result, *AppError) {
	if r, err := c.DoGet("/users/me", "", etag); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) GetProfiles(teamId string, etag string) (*Result, *AppError) {
	if r, err := c.DoGet("/users/profiles", "", etag); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserMapFromJson(r.Body)}, nil
	}
}

func (c *Client) LoginById(id string, password string) (*Result, *AppError) {
	m := make(map[string]string)
	m["id"] = id
	m["password"] = password
	return c.login(m)
}

func (c *Client) LoginByEmail(name string, email string, password string) (*Result, *AppError) {
	m := make(map[string]string)
	m["name"] = name
	m["email"] = email
	m["password"] = password
	return c.login(m)
}

func (c *Client) LoginByEmailWithDevice(name string, email string, password string, deviceId string) (*Result, *AppError) {
	m := make(map[string]string)
	m["name"] = name
	m["email"] = email
	m["password"] = password
	m["device_id"] = deviceId
	return c.login(m)
}

func (c *Client) login(m map[string]string) (*Result, *AppError) {
	if r, err := c.DoPost("/users/login", MapToJson(m)); err != nil {
		return nil, err
	} else {
		c.AuthToken = r.Header.Get(HEADER_TOKEN)
		sessionId := getCookie(SESSION_TOKEN, r)

		if c.AuthToken != sessionId.Value {
			NewAppError("/users/login", "Authentication tokens didn't match", "")
		}

		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) Logout() (*Result, *AppError) {
	if r, err := c.DoPost("/users/logout", ""); err != nil {
		return nil, err
	} else {
		c.AuthToken = ""

		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) RevokeSession(sessionAltId string) (*Result, *AppError) {
	m := make(map[string]string)
	m["id"] = sessionAltId

	if r, err := c.DoPost("/users/revoke_session", MapToJson(m)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetSessions(id string) (*Result, *AppError) {
	if r, err := c.DoGet("/users/"+id+"/sessions", "", ""); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), SessionsFromJson(r.Body)}, nil
	}
}

func (c *Client) Command(channelId string, command string, suggest bool) (*Result, *AppError) {
	m := make(map[string]string)
	m["command"] = command
	m["channelId"] = channelId
	m["suggest"] = strconv.FormatBool(suggest)
	if r, err := c.DoPost("/command", MapToJson(m)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), CommandFromJson(r.Body)}, nil
	}
}

func (c *Client) GetAudits(id string, etag string) (*Result, *AppError) {
	if r, err := c.DoGet("/users/"+id+"/audits", "", etag); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), AuditsFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateChannel(channel *Channel) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/create", channel.ToJson()); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateDirectChannel(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/create_direct", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateChannel(channel *Channel) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/update", channel.ToJson()); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateChannelDesc(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/update_desc", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateNotifyLevel(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/update_notify_level", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetChannels(etag string) (*Result, *AppError) {
	if r, err := c.DoGet("/channels/", "", etag); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetMoreChannels(etag string) (*Result, *AppError) {
	if r, err := c.DoGet("/channels/more", "", etag); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelListFromJson(r.Body)}, nil
	}
}

func (c *Client) JoinChannel(id string) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/"+id+"/join", ""); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) LeaveChannel(id string) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/"+id+"/leave", ""); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) DeleteChannel(id string) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/"+id+"/delete", ""); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) AddChannelMember(id, user_id string) (*Result, *AppError) {
	data := make(map[string]string)
	data["user_id"] = user_id
	if r, err := c.DoPost("/channels/"+id+"/add", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) RemoveChannelMember(id, user_id string) (*Result, *AppError) {
	data := make(map[string]string)
	data["user_id"] = user_id
	if r, err := c.DoPost("/channels/"+id+"/remove", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) UpdateLastViewedAt(channelId string) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/"+channelId+"/update_last_viewed_at", ""); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) GetChannelExtraInfo(id string) (*Result, *AppError) {
	if r, err := c.DoGet("/channels/"+id+"/extra_info", "", ""); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelExtraFromJson(r.Body)}, nil
	}
}

func (c *Client) CreatePost(post *Post) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/"+post.ChannelId+"/create", post.ToJson()); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateValetPost(post *Post) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/"+post.ChannelId+"/valet_create", post.ToJson()); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdatePost(post *Post) (*Result, *AppError) {
	if r, err := c.DoPost("/channels/"+post.ChannelId+"/update", post.ToJson()); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPosts(channelId string, offset int, limit int, etag string) (*Result, *AppError) {
	if r, err := c.DoGet(fmt.Sprintf("/channels/%v/posts/%v/%v", channelId, offset, limit), "", etag); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPost(channelId string, postId string, etag string) (*Result, *AppError) {
	if r, err := c.DoGet(fmt.Sprintf("/channels/%v/post/%v", channelId, postId), "", etag); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) DeletePost(channelId string, postId string) (*Result, *AppError) {
	if r, err := c.DoPost(fmt.Sprintf("/channels/%v/post/%v/delete", channelId, postId), ""); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) SearchPosts(terms string) (*Result, *AppError) {
	if r, err := c.DoGet("/posts/search?terms="+url.QueryEscape(terms), "", ""); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) UploadFile(url string, data []byte, contentType string) (*Result, *AppError) {
	rq, _ := http.NewRequest("POST", c.Url+url, bytes.NewReader(data))
	rq.Header.Set("Content-Type", contentType)

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, "We encountered an error while connecting to the server", err.Error())
	} else if rp.StatusCode >= 300 {
		return nil, AppErrorFromJson(rp.Body)
	} else {
		return &Result{rp.Header.Get(HEADER_REQUEST_ID),
			rp.Header.Get(HEADER_ETAG_SERVER), FileUploadResponseFromJson(rp.Body)}, nil
	}
}

func (c *Client) GetFile(url string, isFullUrl bool) (*Result, *AppError) {
	var rq *http.Request
	if isFullUrl {
		rq, _ = http.NewRequest("GET", url, nil)
	} else {
		rq, _ = http.NewRequest("GET", c.Url+url, nil)
	}

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, "We encountered an error while connecting to the server", err.Error())
	} else if rp.StatusCode >= 300 {
		return nil, AppErrorFromJson(rp.Body)
	} else {
		return &Result{rp.Header.Get(HEADER_REQUEST_ID),
			rp.Header.Get(HEADER_ETAG_SERVER), rp.Body}, nil
	}
}

func (c *Client) GetPublicLink(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoPost("/files/get_public_link", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateUser(user *User) (*Result, *AppError) {
	if r, err := c.DoPost("/users/update", user.ToJson()); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateUserRoles(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoPost("/users/update_roles", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateActive(userId string, active bool) (*Result, *AppError) {
	data := make(map[string]string)
	data["user_id"] = userId
	data["active"] = strconv.FormatBool(active)
	if r, err := c.DoPost("/users/update_active", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateUserNotify(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoPost("/users/update_notify", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateUserPassword(userId, currentPassword, newPassword string) (*Result, *AppError) {
	data := make(map[string]string)
	data["current_password"] = currentPassword
	data["new_password"] = newPassword
	data["user_id"] = userId

	if r, err := c.DoPost("/users/newpassword", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) SendPasswordReset(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoPost("/users/send_password_reset", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) ResetPassword(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoPost("/users/reset_password", MapToJson(data)); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetStatuses() (*Result, *AppError) {
	if r, err := c.DoGet("/users/status", "", ""); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetMyTeam(etag string) (*Result, *AppError) {
	if r, err := c.DoGet("/teams/me", "", etag); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamFromJson(r.Body)}, nil
	}
}

func (c *Client) MockSession(sessionToken string) {
	c.AuthToken = sessionToken
}
