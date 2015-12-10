// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	l4g "code.google.com/p/log4go"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	HEADER_REQUEST_ID             = "X-Request-ID"
	HEADER_VERSION_ID             = "X-Version-ID"
	HEADER_ETAG_SERVER            = "ETag"
	HEADER_ETAG_CLIENT            = "If-None-Match"
	HEADER_FORWARDED              = "X-Forwarded-For"
	HEADER_REAL_IP                = "X-Real-IP"
	HEADER_FORWARDED_PROTO        = "X-Forwarded-Proto"
	HEADER_TOKEN                  = "token"
	HEADER_BEARER                 = "BEARER"
	HEADER_AUTH                   = "Authorization"
	HEADER_MM_SESSION_TOKEN_INDEX = "X-MM-TokenIndex"
	SESSION_TOKEN_INDEX           = "session_token_index"
	API_URL_SUFFIX                = "/api/v1"
)

type Result struct {
	RequestId string
	Etag      string
	Data      interface{}
}

type Client struct {
	Url        string       // The location of the server like "http://localhost:8065"
	ApiUrl     string       // The api location of the server like "http://localhost:8065/api/v1"
	HttpClient *http.Client // The http client
	AuthToken  string
	AuthType   string
}

// NewClient constructs a new client with convienence methods for talking to
// the server.
func NewClient(url string) *Client {
	return &Client{url, url + API_URL_SUFFIX, &http.Client{}, "", ""}
}

func (c *Client) DoPost(url, data, contentType string, T goi18n.TranslateFunc) (*http.Response, *AppError) {
	rq, _ := http.NewRequest("POST", c.Url+url, strings.NewReader(data))
	rq.Header.Set("Content-Type", contentType)

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, T("We encountered an error while connecting to the server"), err.Error())
	} else if rp.StatusCode >= 300 {
		return nil, AppErrorFromJson(rp.Body)
	} else {
		return rp, nil
	}
}

func (c *Client) DoApiPost(url string, data string, T goi18n.TranslateFunc) (*http.Response, *AppError) {
	rq, _ := http.NewRequest("POST", c.ApiUrl+url, strings.NewReader(data))

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, T("We encountered an error while connecting to the server"), err.Error())
	} else if rp.StatusCode >= 300 {
		return nil, AppErrorFromJson(rp.Body)
	} else {
		return rp, nil
	}
}

func (c *Client) DoApiGet(url string, data string, etag string, T goi18n.TranslateFunc) (*http.Response, *AppError) {
	rq, _ := http.NewRequest("GET", c.ApiUrl+url, strings.NewReader(data))

	if len(etag) > 0 {
		rq.Header.Set(HEADER_ETAG_CLIENT, etag)
	}

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, T("We encountered an error while connecting to the server"), err.Error())
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
		l4g.Close()
		time.Sleep(time.Second)
		panic(err)
	}

	return result
}

func (c *Client) SignupTeam(email string, displayName string, T goi18n.TranslateFunc) (*Result, *AppError) {
	m := make(map[string]string)
	m["email"] = email
	m["display_name"] = displayName
	if r, err := c.DoApiPost("/teams/signup", MapToJson(m), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateTeamFromSignup(teamSignup *TeamSignup, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/teams/create_from_signup", teamSignup.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamSignupFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateTeam(team *Team, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/teams/create", team.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamFromJson(r.Body)}, nil
	}
}

func (c *Client) GetAllTeams(T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/teams/all", "", "", T); err != nil {
		return nil, err
	} else {

		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamMapFromJson(r.Body)}, nil
	}
}

func (c *Client) FindTeamByName(name string, allServers bool, T goi18n.TranslateFunc) (*Result, *AppError) {
	m := make(map[string]string)
	m["name"] = name
	m["all"] = fmt.Sprintf("%v", allServers)
	if r, err := c.DoApiPost("/teams/find_team_by_name", MapToJson(m), T); err != nil {
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

func (c *Client) FindTeams(email string, T goi18n.TranslateFunc) (*Result, *AppError) {
	m := make(map[string]string)
	m["email"] = email
	if r, err := c.DoApiPost("/teams/find_teams", MapToJson(m), T); err != nil {
		return nil, err
	} else {

		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamMapFromJson(r.Body)}, nil
	}
}

func (c *Client) FindTeamsSendEmail(email string, T goi18n.TranslateFunc) (*Result, *AppError) {
	m := make(map[string]string)
	m["email"] = email
	if r, err := c.DoApiPost("/teams/email_teams", MapToJson(m), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ArrayFromJson(r.Body)}, nil
	}
}

func (c *Client) InviteMembers(invites *Invites, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/teams/invite_members", invites.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), InvitesFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateTeam(team *Team, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/teams/update", team.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateUser(user *User, hash string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/create", user.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateUserFromSignup(user *User, data string, hash string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/create?d="+data+"&h="+hash, user.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) GetUser(id string, etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/"+id, "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) GetMe(etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/me", "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) GetProfiles(teamId string, etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/profiles/"+teamId, "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserMapFromJson(r.Body)}, nil
	}
}

func (c *Client) LoginById(id string, password string, T goi18n.TranslateFunc) (*Result, *AppError) {
	m := make(map[string]string)
	m["id"] = id
	m["password"] = password
	return c.login(m, T)
}

func (c *Client) LoginByEmail(name string, email string, password string, T goi18n.TranslateFunc) (*Result, *AppError) {
	m := make(map[string]string)
	m["name"] = name
	m["email"] = email
	m["password"] = password
	return c.login(m, T)
}

func (c *Client) LoginByEmailWithDevice(name string, email string, password string, deviceId string, T goi18n.TranslateFunc) (*Result, *AppError) {
	m := make(map[string]string)
	m["name"] = name
	m["email"] = email
	m["password"] = password
	m["device_id"] = deviceId
	return c.login(m, T)
}

func (c *Client) login(m map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/login", MapToJson(m), T); err != nil {
		return nil, err
	} else {
		c.AuthToken = r.Header.Get(HEADER_TOKEN)
		c.AuthType = HEADER_BEARER
		sessionToken := getCookie(SESSION_COOKIE_TOKEN, r)

		if c.AuthToken != sessionToken.Value {
			NewAppError("/users/login", T("Authentication tokens didn't match"), "")
		}

		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) Logout(T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/logout", "", T); err != nil {
		return nil, err
	} else {
		c.AuthToken = ""
		c.AuthType = HEADER_BEARER

		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) SetOAuthToken(token string) {
	c.AuthToken = token
	c.AuthType = HEADER_TOKEN
}

func (c *Client) ClearOAuthToken() {
	c.AuthToken = ""
	c.AuthType = HEADER_BEARER
}

func (c *Client) RevokeSession(sessionAltId string, T goi18n.TranslateFunc) (*Result, *AppError) {
	m := make(map[string]string)
	m["id"] = sessionAltId

	if r, err := c.DoApiPost("/users/revoke_session", MapToJson(m), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetSessions(id string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/"+id+"/sessions", "", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), SessionsFromJson(r.Body)}, nil
	}
}

func (c *Client) Command(channelId string, command string, suggest bool, T goi18n.TranslateFunc) (*Result, *AppError) {
	m := make(map[string]string)
	m["command"] = command
	m["channelId"] = channelId
	m["suggest"] = strconv.FormatBool(suggest)
	if r, err := c.DoApiPost("/command", MapToJson(m), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), CommandFromJson(r.Body)}, nil
	}
}

func (c *Client) GetAudits(id string, etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/"+id+"/audits", "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), AuditsFromJson(r.Body)}, nil
	}
}

func (c *Client) GetLogs(T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/admin/logs", "", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ArrayFromJson(r.Body)}, nil
	}
}

func (c *Client) GetClientProperties(T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/admin/client_props", "", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetConfig(T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/admin/config", "", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ConfigFromJson(r.Body)}, nil
	}
}

func (c *Client) SaveConfig(config *Config, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/admin/save_config", config.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ConfigFromJson(r.Body)}, nil
	}
}

func (c *Client) TestEmail(config *Config, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/admin/test_email", config.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetAnalytics(teamId, name string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/admin/analytics/"+teamId+"/"+name, "", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), AnalyticsRowsFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateChannel(channel *Channel, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/create", channel.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateDirectChannel(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/create_direct", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateChannel(channel *Channel, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/update", channel.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateChannelHeader(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/update_header", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateChannelPurpose(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/update_purpose", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateNotifyProps(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/update_notify_props", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetChannels(etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/channels/", "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetChannel(id, etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/channels/"+id+"/", "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelDataFromJson(r.Body)}, nil
	}
}

func (c *Client) GetMoreChannels(etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/channels/more", "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetChannelCounts(etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/channels/counts", "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelCountsFromJson(r.Body)}, nil
	}
}

func (c *Client) JoinChannel(id string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/"+id+"/join", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) LeaveChannel(id string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/"+id+"/leave", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) DeleteChannel(id string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/"+id+"/delete", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) AddChannelMember(id, user_id string, T goi18n.TranslateFunc) (*Result, *AppError) {
	data := make(map[string]string)
	data["user_id"] = user_id
	if r, err := c.DoApiPost("/channels/"+id+"/add", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) RemoveChannelMember(id, user_id string, T goi18n.TranslateFunc) (*Result, *AppError) {
	data := make(map[string]string)
	data["user_id"] = user_id
	if r, err := c.DoApiPost("/channels/"+id+"/remove", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) UpdateLastViewedAt(channelId string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/"+channelId+"/update_last_viewed_at", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) GetChannelExtraInfo(id string, etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/channels/"+id+"/extra_info", "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelExtraFromJson(r.Body)}, nil
	}
}

func (c *Client) CreatePost(post *Post, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/"+post.ChannelId+"/create", post.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdatePost(post *Post, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/channels/"+post.ChannelId+"/update", post.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPosts(channelId string, offset int, limit int, etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/channels/%v/posts/%v/%v", channelId, offset, limit), "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPostsSince(channelId string, time int64, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/channels/%v/posts/%v", channelId, time), "", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPostsBefore(channelId string, postid string, offset int, limit int, etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/channels/%v/post/%v/before/%v/%v", channelId, postid, offset, limit), "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPostsAfter(channelId string, postid string, offset int, limit int, etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/channels/%v/post/%v/after/%v/%v", channelId, postid, offset, limit), "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPost(channelId string, postId string, etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/channels/%v/post/%v", channelId, postId), "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) DeletePost(channelId string, postId string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost(fmt.Sprintf("/channels/%v/post/%v/delete", channelId, postId), "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) SearchPosts(terms string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/posts/search?terms="+url.QueryEscape(terms), "", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) UploadFile(url string, data []byte, contentType string, T goi18n.TranslateFunc) (*Result, *AppError) {
	rq, _ := http.NewRequest("POST", c.ApiUrl+url, bytes.NewReader(data))
	rq.Header.Set("Content-Type", contentType)

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, T("We encountered an error while connecting to the server"), err.Error())
	} else if rp.StatusCode >= 300 {
		return nil, AppErrorFromJson(rp.Body)
	} else {
		return &Result{rp.Header.Get(HEADER_REQUEST_ID),
			rp.Header.Get(HEADER_ETAG_SERVER), FileUploadResponseFromJson(rp.Body)}, nil
	}
}

func (c *Client) GetFile(url string, isFullUrl bool, T goi18n.TranslateFunc) (*Result, *AppError) {
	var rq *http.Request
	if isFullUrl {
		rq, _ = http.NewRequest("GET", url, nil)
	} else {
		rq, _ = http.NewRequest("GET", c.ApiUrl+"/files/get"+url, nil)
	}

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, T("We encountered an error while connecting to the server"), err.Error())
	} else if rp.StatusCode >= 300 {
		return nil, AppErrorFromJson(rp.Body)
	} else {
		return &Result{rp.Header.Get(HEADER_REQUEST_ID),
			rp.Header.Get(HEADER_ETAG_SERVER), rp.Body}, nil
	}
}

func (c *Client) GetFileInfo(url string, T goi18n.TranslateFunc) (*Result, *AppError) {
	var rq *http.Request
	rq, _ = http.NewRequest("GET", c.ApiUrl+"/files/get_info"+url, nil)

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, T("We encountered an error while connecting to the server"), err.Error())
	} else if rp.StatusCode >= 300 {
		return nil, AppErrorFromJson(rp.Body)
	} else {
		return &Result{rp.Header.Get(HEADER_REQUEST_ID),
			rp.Header.Get(HEADER_ETAG_SERVER), MapFromJson(rp.Body)}, nil
	}
}

func (c *Client) GetPublicLink(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/files/get_public_link", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateUser(user *User, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/update", user.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateUserRoles(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/update_roles", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateActive(userId string, active bool, T goi18n.TranslateFunc) (*Result, *AppError) {
	data := make(map[string]string)
	data["user_id"] = userId
	data["active"] = strconv.FormatBool(active)
	if r, err := c.DoApiPost("/users/update_active", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateUserNotify(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/update_notify", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateUserPassword(userId, currentPassword, newPassword string, T goi18n.TranslateFunc) (*Result, *AppError) {
	data := make(map[string]string)
	data["current_password"] = currentPassword
	data["new_password"] = newPassword
	data["user_id"] = userId

	if r, err := c.DoApiPost("/users/newpassword", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) SendPasswordReset(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/send_password_reset", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) ResetPassword(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/reset_password", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetStatuses(data []string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/status", ArrayToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetMyTeam(etag string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/teams/me", "", etag, T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamFromJson(r.Body)}, nil
	}
}

func (c *Client) RegisterApp(app *OAuthApp, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/oauth/register", app.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OAuthAppFromJson(r.Body)}, nil
	}
}

func (c *Client) AllowOAuth(rspType, clientId, redirect, scope, state string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/oauth/allow?response_type="+rspType+"&client_id="+clientId+"&redirect_uri="+url.QueryEscape(redirect)+"&scope="+scope+"&state="+url.QueryEscape(state), "", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetAccessToken(data url.Values, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoPost("/oauth/access_token", data.Encode(), "application/x-www-form-urlencoded", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), AccessResponseFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateIncomingWebhook(hook *IncomingWebhook, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/hooks/incoming/create", hook.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), IncomingWebhookFromJson(r.Body)}, nil
	}
}

func (c *Client) PostToWebhook(id, payload string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoPost("/hooks/"+id, payload, "application/x-www-form-urlencoded", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) DeleteIncomingWebhook(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/hooks/incoming/delete", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) ListIncomingWebhooks(T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/hooks/incoming/list", "", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), IncomingWebhookListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetAllPreferences(T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/preferences/", "", "", T); err != nil {
		return nil, err
	} else {
		preferences, _ := PreferencesFromJson(r.Body)
		return &Result{r.Header.Get(HEADER_REQUEST_ID), r.Header.Get(HEADER_ETAG_SERVER), preferences}, nil
	}
}

func (c *Client) SetPreferences(preferences *Preferences, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/preferences/save", preferences.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), preferences}, nil
	}
}

func (c *Client) GetPreference(category string, name string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/preferences/"+category+"/"+name, "", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID), r.Header.Get(HEADER_ETAG_SERVER), PreferenceFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPreferenceCategory(category string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/preferences/"+category, "", "", T); err != nil {
		return nil, err
	} else {
		preferences, _ := PreferencesFromJson(r.Body)
		return &Result{r.Header.Get(HEADER_REQUEST_ID), r.Header.Get(HEADER_ETAG_SERVER), preferences}, nil
	}
}

func (c *Client) CreateOutgoingWebhook(hook *OutgoingWebhook, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/hooks/outgoing/create", hook.ToJson(), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OutgoingWebhookFromJson(r.Body)}, nil
	}
}

func (c *Client) DeleteOutgoingWebhook(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/hooks/outgoing/delete", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) ListOutgoingWebhooks(T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiGet("/hooks/outgoing/list", "", "", T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OutgoingWebhookListFromJson(r.Body)}, nil
	}
}

func (c *Client) RegenOutgoingWebhookToken(data map[string]string, T goi18n.TranslateFunc) (*Result, *AppError) {
	if r, err := c.DoApiPost("/hooks/outgoing/regen_token", MapToJson(data), T); err != nil {
		return nil, err
	} else {
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OutgoingWebhookFromJson(r.Body)}, nil
	}
}

func (c *Client) MockSession(sessionToken string) {
	c.AuthToken = sessionToken
	c.AuthType = HEADER_BEARER
}
