// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
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

func (c *Client4) GetUserByUsernameRoute(userName string) string {
	return fmt.Sprintf(c.GetUsersRoute()+"/username/%v", userName)
}

func (c *Client4) GetUserByEmailRoute(email string) string {
	return fmt.Sprintf(c.GetUsersRoute()+"/email/%v", email)
}

func (c *Client4) GetTeamsRoute() string {
	return fmt.Sprintf("/teams")
}

func (c *Client4) GetTeamRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamsRoute()+"/%v", teamId)
}

func (c *Client4) GetTeamByNameRoute(teamName string) string {
	return fmt.Sprintf(c.GetTeamsRoute()+"/name/%v", teamName)
}

func (c *Client4) GetTeamMemberRoute(teamId, userId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId)+"/members/%v", userId)
}

func (c *Client4) GetTeamMembersRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId) + "/members")
}

func (c *Client4) GetTeamStatsRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId) + "/stats")
}

func (c *Client4) GetChannelsRoute() string {
	return fmt.Sprintf("/channels")
}

func (c *Client4) GetChannelRoute(channelId string) string {
	return fmt.Sprintf(c.GetChannelsRoute()+"/%v", channelId)
}

func (c *Client4) GetChannelByNameRoute(channelName, teamId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId)+"/channels/name/%v", channelName)
}

func (c *Client4) GetChannelByNameForTeamNameRoute(channelName, teamName string) string {
	return fmt.Sprintf(c.GetTeamByNameRoute(teamName)+"/channels/name/%v", channelName)
}

func (c *Client4) GetChannelMembersRoute(channelId string) string {
	return fmt.Sprintf(c.GetChannelRoute(channelId) + "/members")
}

func (c *Client4) GetChannelMemberRoute(channelId, userId string) string {
	return fmt.Sprintf(c.GetChannelMembersRoute(channelId)+"/%v", userId)
}

func (c *Client4) GetPostsRoute() string {
	return fmt.Sprintf("/posts")
}

func (c *Client4) GetPostRoute(postId string) string {
	return fmt.Sprintf(c.GetPostsRoute()+"/%v", postId)
}

func (c *Client4) GetFilesRoute() string {
	return fmt.Sprintf("/files")
}

func (c *Client4) GetFileRoute(fileId string) string {
	return fmt.Sprintf(c.GetFilesRoute()+"/%v", fileId)
}

func (c *Client4) GetSystemRoute() string {
	return fmt.Sprintf("/system")
}

func (c *Client4) GetIncomingWebhooksRoute() string {
	return fmt.Sprintf("/hooks/incoming")
}

func (c *Client4) GetPreferencesRoute(userId string) string {
	return fmt.Sprintf(c.GetUserRoute(userId) + "/preferences")
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

func (c *Client4) DoApiDelete(url string) (*http.Response, *AppError) {
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

func (c *Client4) DoUploadFile(url string, data []byte, contentType string) (*FileUploadResponse, *Response) {
	rq, _ := http.NewRequest("POST", c.ApiUrl+url, bytes.NewReader(data))
	rq.Header.Set("Content-Type", contentType)
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, &Response{Error: NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)}
	} else if rp.StatusCode >= 300 {
		return nil, &Response{StatusCode: rp.StatusCode, Error: AppErrorFromJson(rp.Body)}
	} else {
		defer closeBody(rp)
		return FileUploadResponseFromJson(rp.Body), BuildResponse(rp)
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

// GetUserByUsername returns a user based on the provided user name string.
func (c *Client4) GetUserByUsername(userName, etag string) (*User, *Response) {
	if r, err := c.DoApiGet(c.GetUserByUsernameRoute(userName), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// GetUserByEmail returns a user based on the provided user email string.
func (c *Client4) GetUserByEmail(email, etag string) (*User, *Response) {
	if r, err := c.DoApiGet(c.GetUserByEmailRoute(email), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// GetProfileImage gets user's profile image. Must be logged in or be a system administrator.
func (c *Client4) GetProfileImage(userId, etag string) ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/image", etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else if data, err := ioutil.ReadAll(r.Body); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: NewAppError("GetProfileImage", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)}
	} else {
		return data, BuildResponse(r)
	}
}

// GetUsers returns a page of users on the system. Page counting starts at 0.
func (c *Client4) GetUsers(page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersInChannel returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetUsersInChannel(channelId string, page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?in_channel=%v&page=%v&per_page=%v", channelId, page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersNotInChannel returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetUsersNotInChannel(teamId, channelId string, page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?in_team=%v&not_in_channel=%v&page=%v&per_page=%v", teamId, channelId, page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersByIds returns a list of users based on the provided user ids.
func (c *Client4) GetUsersByIds(userIds []string) ([]*User, *Response) {
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/ids", ArrayToJson(userIds)); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
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

// PatchUser partially updates a user in the system. Any missing fields are not updated.
func (c *Client4) PatchUser(userId string, patch *UserPatch) (*User, *Response) {
	if r, err := c.DoApiPut(c.GetUserRoute(userId)+"/patch", patch.ToJson()); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateUserPassword updates a user's password. Must be logged in as the user or be a system administrator.
func (c *Client4) UpdateUserPassword(userId, currentPassword, newPassword string) (bool, *Response) {
	requestBody := map[string]string{"current_password": currentPassword, "new_password": newPassword}
	if r, err := c.DoApiPut(c.GetUserRoute(userId)+"/password", MapToJson(requestBody)); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// UpdateUserRoles updates a user's roles in the system. A user can have "system_user" and "system_admin" roles.
func (c *Client4) UpdateUserRoles(userId, roles string) (bool, *Response) {
	requestBody := map[string]string{"roles": roles}
	if r, err := c.DoApiPut(c.GetUserRoute(userId)+"/roles", MapToJson(requestBody)); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// DeleteUser deactivates a user in the system based on the provided user id string.
func (c *Client4) DeleteUser(userId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetUserRoute(userId)); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// SendPasswordResetEmail will send a link for password resetting to a user with the
// provided email.
func (c *Client4) SendPasswordResetEmail(email string) (bool, *Response) {
	requestBody := map[string]string{"email": email}
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/password/reset/send", MapToJson(requestBody)); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// ResetPassword uses a recovery code to update reset a user's password.
func (c *Client4) ResetPassword(code, newPassword string) (bool, *Response) {
	requestBody := map[string]string{"code": code, "new_password": newPassword}
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/password/reset", MapToJson(requestBody)); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetSessions returns a list of sessions based on the provided user id string.
func (c *Client4) GetSessions(userId, etag string) ([]*Session, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/sessions", etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return SessionsFromJson(r.Body), BuildResponse(r)
	}
}

// RevokeSession revokes a user session based on the provided user id and session id strings.
func (c *Client4) RevokeSession(userId, sessionId string) (bool, *Response) {
	requestBody := map[string]string{"session_id": sessionId}
	if r, err := c.DoApiPost(c.GetUserRoute(userId)+"/sessions/revoke", MapToJson(requestBody)); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// getTeamsUnreadForUser will return an array with TeamUnread objects that contain the amount of
// unread messages and mentions the current user has for the teams it belongs to.
// An optional team ID can be set to exclude that team from the results. Must be authenticated.
func (c *Client4) GetTeamsUnreadForUser(userId, teamIdToExclude string) ([]*TeamUnread, *Response) {
	optional := ""
	if teamIdToExclude != "" {
		optional += fmt.Sprintf("?exclude_team=%s", url.QueryEscape(teamIdToExclude))
	}

	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/teams/unread"+optional, ""); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return TeamsUnreadFromJson(r.Body), BuildResponse(r)
	}
}

// GetAudits returns a list of audit based on the provided user id string.
func (c *Client4) GetAudits(userId string, page int, perPage int, etag string) (Audits, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/audits"+query, etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return AuditsFromJson(r.Body), BuildResponse(r)
	}
}

// Verify user email user id and hash strings.
func (c *Client4) VerifyUserEmail(userId, hashId string) (bool, *Response) {
	requestBody := map[string]string{"uid": userId, "hid": hashId}
	if r, err := c.DoApiPost(c.GetUserRoute(userId)+"/email/verify", MapToJson(requestBody)); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// SetProfileImage sets profile image of the user
func (c *Client4) SetProfileImage(userId string, data []byte) (bool, *Response) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("image", "profile.png"); err != nil {
		return false, &Response{Error: NewAppError("SetProfileImage", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return false, &Response{Error: NewAppError("SetProfileImage", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	if err := writer.Close(); err != nil {
		return false, &Response{Error: NewAppError("SetProfileImage", "model.client.set_profile_user.writer.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	rq, _ := http.NewRequest("POST", c.ApiUrl+c.GetUserRoute(userId)+"/image", bytes.NewReader(body.Bytes()))
	rq.Header.Set("Content-Type", writer.FormDataContentType())
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		// set to http.StatusForbidden(403)
		return false, &Response{StatusCode: http.StatusForbidden, Error: NewAppError(c.GetUserRoute(userId)+"/image", "model.client.connecting.app_error", nil, err.Error(), 403)}
	} else if rp.StatusCode >= 300 {
		return false, &Response{StatusCode: rp.StatusCode, Error: AppErrorFromJson(rp.Body)}
	} else {
		defer closeBody(rp)
		return CheckStatusOK(rp), BuildResponse(rp)
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

// GetTeam returns a team based on the provided team id string.
func (c *Client4) GetTeam(teamId, etag string) (*Team, *Response) {
	if r, err := c.DoApiGet(c.GetTeamRoute(teamId), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return TeamFromJson(r.Body), BuildResponse(r)
	}
}

// GetAllTeams returns all teams based on permissions.
func (c *Client4) GetAllTeams(etag string, page int, perPage int) ([]*Team, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetTeamsRoute()+query, etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return TeamListFromJson(r.Body), BuildResponse(r)
	}
}

// GetTeamByName returns a team based on the provided team name string.
func (c *Client4) GetTeamByName(name, etag string) (*Team, *Response) {
	if r, err := c.DoApiGet(c.GetTeamByNameRoute(name), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return TeamFromJson(r.Body), BuildResponse(r)
	}
}

// GetTeamsForUser returns a list of teams a user is on. Must be logged in as the user
// or be a system administrator.
func (c *Client4) GetTeamsForUser(userId, etag string) ([]*Team, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/teams", etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return TeamListFromJson(r.Body), BuildResponse(r)
	}
}

// GetTeamMember returns a team member based on the provided team and user id strings.
func (c *Client4) GetTeamMember(teamId, userId, etag string) (*TeamMember, *Response) {
	if r, err := c.DoApiGet(c.GetTeamMemberRoute(teamId, userId), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return TeamMemberFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateTeamMemberRoles will update the roles on a team for a user
func (c *Client4) UpdateTeamMemberRoles(teamId, userId, newRoles string) (bool, *Response) {
	requestBody := map[string]string{"roles": newRoles}
	if r, err := c.DoApiPut(c.GetTeamMemberRoute(teamId, userId)+"/roles", MapToJson(requestBody)); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetTeamMembers returns team members based on the provided team id string.
func (c *Client4) GetTeamMembers(teamId string, page int, perPage int, etag string) ([]*TeamMember, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetTeamMembersRoute(teamId)+query, etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return TeamMembersFromJson(r.Body), BuildResponse(r)
	}
}

// GetTeamStats returns a team stats based on the team id string.
// Must be authenticated.
func (c *Client4) GetTeamStats(teamId, etag string) (*TeamStats, *Response) {
	if r, err := c.DoApiGet(c.GetTeamStatsRoute(teamId), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return TeamStatsFromJson(r.Body), BuildResponse(r)
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

// CreateDirectChannel creates a direct message channel based on the two user
// ids provided.
func (c *Client4) CreateDirectChannel(userId1, userId2 string) (*Channel, *Response) {
	requestBody := []string{userId1, userId2}
	if r, err := c.DoApiPost(c.GetChannelsRoute()+"/direct", ArrayToJson(requestBody)); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannel returns a channel based on the provided channel id string.
func (c *Client4) GetChannel(channelId, etag string) (*Channel, *Response) {
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelByName returns a channel based on the provided channel name and team id strings.
func (c *Client4) GetChannelByName(channelName, teamId string, etag string) (*Channel, *Response) {
	if r, err := c.DoApiGet(c.GetChannelByNameRoute(channelName, teamId), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelByNameForTeamName returns a channel based on the provided channel name and team name strings.
func (c *Client4) GetChannelByNameForTeamName(channelName, teamName string, etag string) (*Channel, *Response) {
	if r, err := c.DoApiGet(c.GetChannelByNameForTeamNameRoute(channelName, teamName), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelMembers gets a page of channel members.
func (c *Client4) GetChannelMembers(channelId string, page, perPage int, etag string) (*ChannelMembers, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetChannelMembersRoute(channelId)+query, etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return ChannelMembersFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelMember gets a channel member.
func (c *Client4) GetChannelMember(channelId, userId, etag string) (*ChannelMember, *Response) {
	if r, err := c.DoApiGet(c.GetChannelMemberRoute(channelId, userId), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return ChannelMemberFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelMembersForUser gets all the channel members for a user on a team.
func (c *Client4) GetChannelMembersForUser(userId, teamId, etag string) (*ChannelMembers, *Response) {
	if r, err := c.DoApiGet(fmt.Sprintf(c.GetUserRoute(userId)+"/teams/%v/channels/members", teamId), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return ChannelMembersFromJson(r.Body), BuildResponse(r)
	}
}

// ViewChannel performs a view action for a user. Synonymous with switching channels or marking channels as read by a user.
func (c *Client4) ViewChannel(userId string, view *ChannelView) (bool, *Response) {
	url := fmt.Sprintf(c.GetChannelsRoute()+"/members/%v/view", userId)
	if r, err := c.DoApiPost(url, view.ToJson()); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// UpdateChannelRoles will update the roles on a channel for a user.
func (c *Client4) UpdateChannelRoles(channelId, userId, roles string) (bool, *Response) {
	requestBody := map[string]string{"roles": roles}
	if r, err := c.DoApiPut(c.GetChannelMemberRoute(channelId, userId)+"/roles", MapToJson(requestBody)); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// RemoveUserFromChannel will delete the channel member object for a user, effectively removing the user from a channel.
func (c *Client4) RemoveUserFromChannel(channelId, userId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetChannelMemberRoute(channelId, userId)); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// Post Section

// CreatePost creates a post based on the provided post struct.
func (c *Client4) CreatePost(post *Post) (*Post, *Response) {
	if r, err := c.DoApiPost(c.GetPostsRoute(), post.ToJson()); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return PostFromJson(r.Body), BuildResponse(r)
	}
}

// UpdatePost updates a post based on the provided post struct.
func (c *Client4) UpdatePost(postId string, post *Post) (*Post, *Response) {
	if r, err := c.DoApiPut(c.GetPostRoute(postId), post.ToJson()); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return PostFromJson(r.Body), BuildResponse(r)
	}
}

// GetPost gets a single post.
func (c *Client4) GetPost(postId string, etag string) (*Post, *Response) {
	if r, err := c.DoApiGet(c.GetPostRoute(postId), etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return PostFromJson(r.Body), BuildResponse(r)
	}
}

// DeletePost deletes a post from the provided post id string.
func (c *Client4) DeletePost(postId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetPostRoute(postId)); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetPostThread gets a post with all the other posts in the same thread.
func (c *Client4) GetPostThread(postId string, etag string) (*PostList, *Response) {
	if r, err := c.DoApiGet(c.GetPostRoute(postId)+"/thread", etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// GetPostsForChannel gets a page of posts with an array for ordering for a channel.
func (c *Client4) GetPostsForChannel(channelId string, page, perPage int, etag string) (*PostList, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/posts"+query, etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// SearchPosts returns any posts with matching terms string.
func (c *Client4) SearchPosts(teamId string, terms string, isOrSearch bool) (*PostList, *Response) {
	requestBody := map[string]string{"terms": terms, "is_or_search": strconv.FormatBool(isOrSearch)}
	if r, err := c.DoApiPost(c.GetTeamRoute(teamId)+"/posts/search", MapToJson(requestBody)); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// File Section

// UploadFile will upload a file to a channel, to be later attached to a post.
func (c *Client4) UploadFile(data []byte, channelId string, filename string) (*FileUploadResponse, *Response) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("files", filename); err != nil {
		return nil, &Response{Error: NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.file.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, &Response{Error: NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.file.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	if part, err := writer.CreateFormField("channel_id"); err != nil {
		return nil, &Response{Error: NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.channel_id.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else if _, err = io.Copy(part, strings.NewReader(channelId)); err != nil {
		return nil, &Response{Error: NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.channel_id.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	if err := writer.Close(); err != nil {
		return nil, &Response{Error: NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.writer.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	return c.DoUploadFile(c.GetFilesRoute(), body.Bytes(), writer.FormDataContentType())
}

// GetFile gets the bytes for a file by id.
func (c *Client4) GetFile(fileId string) ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId), ""); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else if data, err := ioutil.ReadAll(r.Body); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: NewAppError("GetFile", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)}
	} else {
		return data, BuildResponse(r)
	}
}

// GetFileThumbnail gets the bytes for a file by id.
func (c *Client4) GetFileThumbnail(fileId string) ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/thumbnail", ""); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else if data, err := ioutil.ReadAll(r.Body); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: NewAppError("GetFileThumbnail", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)}
	} else {
		return data, BuildResponse(r)
	}
}

// GetFileInfosForPost gets all the file info objects attached to a post.
func (c *Client4) GetFileInfosForPost(postId string, etag string) ([]*FileInfo, *Response) {
	if r, err := c.DoApiGet(c.GetPostRoute(postId)+"/files/info", etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return FileInfosFromJson(r.Body), BuildResponse(r)
	}
}

// General Section

// GetPing will ping the server and to see if it is up and running.
func (c *Client4) GetPing() (bool, *Response) {
	if r, err := c.DoApiGet(c.GetSystemRoute()+"/ping", ""); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// Webhooks Section

// CreateIncomingWebhook creates an incoming webhook for a channel.
func (c *Client4) CreateIncomingWebhook(hook *IncomingWebhook) (*IncomingWebhook, *Response) {
	if r, err := c.DoApiPost(c.GetIncomingWebhooksRoute(), hook.ToJson()); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return IncomingWebhookFromJson(r.Body), BuildResponse(r)
	}
}

// GetIncomingWebhooks returns a page of incoming webhooks on the system. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooks(page int, perPage int, etag string) ([]*IncomingWebhook, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetIncomingWebhooksRoute()+query, etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return IncomingWebhookListFromJson(r.Body), BuildResponse(r)
	}
}

// GetIncomingWebhooksForTeam returns a page of incoming webhooks for a team. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooksForTeam(teamId string, page int, perPage int, etag string) ([]*IncomingWebhook, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v&team_id=%v", page, perPage, teamId)
	if r, err := c.DoApiGet(c.GetIncomingWebhooksRoute()+query, etag); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return IncomingWebhookListFromJson(r.Body), BuildResponse(r)
	}
}

// Preferences Section

// GetPreferences returns the user's preferences
func (c *Client4) GetPreferences(userId string) (Preferences, *Response) {
	if r, err := c.DoApiGet(c.GetPreferencesRoute(userId), ""); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		preferences, _ := PreferencesFromJson(r.Body)
		defer closeBody(r)
		return preferences, BuildResponse(r)
	}
}

// UpdatePreferences saves the user's preferences
func (c *Client4) UpdatePreferences(userId string, preferences *Preferences) (bool, *Response) {
	if r, err := c.DoApiPut(c.GetPreferencesRoute(userId), preferences.ToJson()); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return true, BuildResponse(r)
	}
}

// DeletePreferences deletes the user's preferences
func (c *Client4) DeletePreferences(userId string, preferences *Preferences) (bool, *Response) {
	if r, err := c.DoApiPost(c.GetPreferencesRoute(userId)+"/delete", preferences.ToJson()); err != nil {
		return false, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return true, BuildResponse(r)
	}
}

// GetPreferencesByCategory returns the user's preferences from the provided category string
func (c *Client4) GetPreferencesByCategory(userId string, category string) (Preferences, *Response) {
	url := fmt.Sprintf(c.GetPreferencesRoute(userId)+"/%s", category)
	if r, err := c.DoApiGet(url, ""); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		preferences, _ := PreferencesFromJson(r.Body)
		defer closeBody(r)
		return preferences, BuildResponse(r)
	}
}

// GetPreferenceByCategoryAndName returns the user's preferences from the provided category and preference name string
func (c *Client4) GetPreferenceByCategoryAndName(userId string, category string, preferenceName string) (*Preference, *Response) {
	url := fmt.Sprintf(c.GetPreferencesRoute(userId)+"/%s/name/%v", category, preferenceName)
	if r, err := c.DoApiGet(url, ""); err != nil {
		return nil, &Response{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return PreferenceFromJson(r.Body), BuildResponse(r)
	}
}
