// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	HeaderRequestId          = "X-Request-ID"
	HeaderVersionId          = "X-Version-ID"
	HeaderClusterId          = "X-Cluster-ID"
	HeaderEtagServer         = "ETag"
	HeaderEtagClient         = "If-None-Match"
	HeaderForwarded          = "X-Forwarded-For"
	HeaderRealIp             = "X-Real-IP"
	HeaderForwardedProto     = "X-Forwarded-Proto"
	HeaderToken              = "token"
	HeaderCsrfToken          = "X-CSRF-Token"
	HeaderBearer             = "BEARER"
	HeaderAuth               = "Authorization"
	HeaderCloudToken         = "X-Cloud-Token"
	HeaderRemoteclusterToken = "X-RemoteCluster-Token"
	HeaderRemoteclusterId    = "X-RemoteCluster-Id"
	HeaderRequestedWith      = "X-Requested-With"
	HeaderRequestedWithXml   = "XMLHttpRequest"
	HeaderRange              = "Range"
	STATUS                   = "status"
	StatusOk                 = "OK"
	StatusFail               = "FAIL"
	StatusUnhealthy          = "UNHEALTHY"
	StatusRemove             = "REMOVE"

	ClientDir = "client"

	ApiUrlSuffixV1 = "/api/v1"
	ApiUrlSuffixV4 = "/api/v4"
	ApiUrlSuffix   = ApiUrlSuffixV4
)

type Response struct {
	StatusCode    int
	RequestId     string
	Etag          string
	ServerVersion string
	Header        http.Header
}

type Client4 struct {
	Url        string       // The location of the server, for example  "http://localhost:8065"
	ApiUrl     string       // The api location of the server, for example "http://localhost:8065/api/v4"
	HttpClient *http.Client // The http client
	AuthToken  string
	AuthType   string
	HttpHeader map[string]string // Headers to be copied over for each request

	// TrueString is the string value sent to the server for true boolean query parameters.
	trueString string

	// FalseString is the string value sent to the server for false boolean query parameters.
	falseString string
}

// SetBoolString is a helper method for overriding how true and false query string parameters are
// sent to the server.
//
// This method is only exposed for testing. It is never necessary to configure these values
// in production.
func (c *Client4) SetBoolString(value bool, valueStr string) {
	if value {
		c.trueString = valueStr
	} else {
		c.falseString = valueStr
	}
}

// boolString builds the query string parameter for boolean values.
func (c *Client4) boolString(value bool) string {
	if value && c.trueString != "" {
		return c.trueString
	} else if !value && c.falseString != "" {
		return c.falseString
	}

	if value {
		return "true"
	}
	return "false"
}

func closeBody(r *http.Response) {
	if r.Body != nil {
		_, _ = io.Copy(ioutil.Discard, r.Body)
		_ = r.Body.Close()
	}
}

// Must is a convenience function used for testing.
func (c *Client4) Must(result interface{}, _ *Response, err error) interface{} {
	if err != nil {
		time.Sleep(time.Second)
		panic(err)
	}

	return result
}

func NewAPIv4Client(url string) *Client4 {
	url = strings.TrimRight(url, "/")
	return &Client4{url, url + ApiUrlSuffix, &http.Client{}, "", "", map[string]string{}, "", ""}
}

func NewAPIv4SocketClient(socketPath string) *Client4 {
	tr := &http.Transport{
		Dial: func(network, addr string) (net.Conn, error) {
			return net.Dial("unix", socketPath)
		},
	}

	client := NewAPIv4Client("http://_")
	client.HttpClient = &http.Client{Transport: tr}

	return client
}

func BuildResponse(r *http.Response) *Response {
	return &Response{
		StatusCode:    r.StatusCode,
		RequestId:     r.Header.Get(HeaderRequestId),
		Etag:          r.Header.Get(HeaderEtagServer),
		ServerVersion: r.Header.Get(HeaderVersionId),
		Header:        r.Header,
	}
}

func (c *Client4) SetToken(token string) {
	c.AuthToken = token
	c.AuthType = HeaderBearer
}

// MockSession is deprecated in favour of SetToken
func (c *Client4) MockSession(token string) {
	c.SetToken(token)
}

func (c *Client4) SetOAuthToken(token string) {
	c.AuthToken = token
	c.AuthType = HeaderToken
}

func (c *Client4) ClearOAuthToken() {
	c.AuthToken = ""
	c.AuthType = HeaderBearer
}

func (c *Client4) GetUsersRoute() string {
	return "/users"
}

func (c *Client4) GetUserRoute(userId string) string {
	return fmt.Sprintf(c.GetUsersRoute()+"/%v", userId)
}

func (c *Client4) GetUserThreadsRoute(userID, teamID string) string {
	return c.GetUserRoute(userID) + c.GetTeamRoute(teamID) + "/threads"
}

func (c *Client4) GetUserThreadRoute(userId, teamId, threadId string) string {
	return c.GetUserThreadsRoute(userId, teamId) + "/" + threadId
}

func (c *Client4) GetUserCategoryRoute(userID, teamID string) string {
	return c.GetUserRoute(userID) + c.GetTeamRoute(teamID) + "/channels/categories"
}

func (c *Client4) GetUserAccessTokensRoute() string {
	return fmt.Sprintf(c.GetUsersRoute() + "/tokens")
}

func (c *Client4) GetUserAccessTokenRoute(tokenId string) string {
	return fmt.Sprintf(c.GetUsersRoute()+"/tokens/%v", tokenId)
}

func (c *Client4) GetUserByUsernameRoute(userName string) string {
	return fmt.Sprintf(c.GetUsersRoute()+"/username/%v", userName)
}

func (c *Client4) GetUserByEmailRoute(email string) string {
	return fmt.Sprintf(c.GetUsersRoute()+"/email/%v", email)
}

func (c *Client4) GetBotsRoute() string {
	return "/bots"
}

func (c *Client4) GetBotRoute(botUserId string) string {
	return fmt.Sprintf("%s/%s", c.GetBotsRoute(), botUserId)
}

func (c *Client4) GetTeamsRoute() string {
	return "/teams"
}

func (c *Client4) GetTeamRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamsRoute()+"/%v", teamId)
}

func (c *Client4) GetTeamAutoCompleteCommandsRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamsRoute()+"/%v/commands/autocomplete", teamId)
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

func (c *Client4) GetTeamImportRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId) + "/import")
}

func (c *Client4) GetChannelsRoute() string {
	return "/channels"
}

func (c *Client4) GetChannelsForTeamRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId) + "/channels")
}

func (c *Client4) GetChannelRoute(channelId string) string {
	return fmt.Sprintf(c.GetChannelsRoute()+"/%v", channelId)
}

func (c *Client4) GetChannelByNameRoute(channelName, teamId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId)+"/channels/name/%v", channelName)
}

func (c *Client4) GetChannelsForTeamForUserRoute(teamId, userId string, includeDeleted bool) string {
	route := fmt.Sprintf(c.GetUserRoute(userId) + c.GetTeamRoute(teamId) + "/channels")
	if includeDeleted {
		query := fmt.Sprintf("?include_deleted=%v", includeDeleted)
		return route + query
	}
	return route
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
	return "/posts"
}

func (c *Client4) GetPostsEphemeralRoute() string {
	return "/posts/ephemeral"
}

func (c *Client4) GetConfigRoute() string {
	return "/config"
}

func (c *Client4) GetLicenseRoute() string {
	return "/license"
}

func (c *Client4) GetPostRoute(postId string) string {
	return fmt.Sprintf(c.GetPostsRoute()+"/%v", postId)
}

func (c *Client4) GetFilesRoute() string {
	return "/files"
}

func (c *Client4) GetFileRoute(fileId string) string {
	return fmt.Sprintf(c.GetFilesRoute()+"/%v", fileId)
}

func (c *Client4) GetUploadsRoute() string {
	return "/uploads"
}

func (c *Client4) GetUploadRoute(uploadId string) string {
	return fmt.Sprintf("%s/%s", c.GetUploadsRoute(), uploadId)
}

func (c *Client4) GetPluginsRoute() string {
	return "/plugins"
}

func (c *Client4) GetPluginRoute(pluginId string) string {
	return fmt.Sprintf(c.GetPluginsRoute()+"/%v", pluginId)
}

func (c *Client4) GetSystemRoute() string {
	return "/system"
}

func (c *Client4) GetCloudRoute() string {
	return "/cloud"
}

func (c *Client4) GetTestEmailRoute() string {
	return "/email/test"
}

func (c *Client4) GetTestSiteURLRoute() string {
	return "/site_url/test"
}

func (c *Client4) GetTestS3Route() string {
	return "/file/s3_test"
}

func (c *Client4) GetDatabaseRoute() string {
	return "/database"
}

func (c *Client4) GetCacheRoute() string {
	return "/caches"
}

func (c *Client4) GetClusterRoute() string {
	return "/cluster"
}

func (c *Client4) GetIncomingWebhooksRoute() string {
	return "/hooks/incoming"
}

func (c *Client4) GetIncomingWebhookRoute(hookID string) string {
	return fmt.Sprintf(c.GetIncomingWebhooksRoute()+"/%v", hookID)
}

func (c *Client4) GetComplianceReportsRoute() string {
	return "/compliance/reports"
}

func (c *Client4) GetComplianceReportRoute(reportId string) string {
	return fmt.Sprintf("%s/%s", c.GetComplianceReportsRoute(), reportId)
}

func (c *Client4) GetComplianceReportDownloadRoute(reportId string) string {
	return fmt.Sprintf("%s/%s/download", c.GetComplianceReportsRoute(), reportId)
}

func (c *Client4) GetOutgoingWebhooksRoute() string {
	return "/hooks/outgoing"
}

func (c *Client4) GetOutgoingWebhookRoute(hookID string) string {
	return fmt.Sprintf(c.GetOutgoingWebhooksRoute()+"/%v", hookID)
}

func (c *Client4) GetPreferencesRoute(userId string) string {
	return fmt.Sprintf(c.GetUserRoute(userId) + "/preferences")
}

func (c *Client4) GetUserStatusRoute(userId string) string {
	return fmt.Sprintf(c.GetUserRoute(userId) + "/status")
}

func (c *Client4) GetUserStatusesRoute() string {
	return fmt.Sprintf(c.GetUsersRoute() + "/status")
}

func (c *Client4) GetSamlRoute() string {
	return "/saml"
}

func (c *Client4) GetLdapRoute() string {
	return "/ldap"
}

func (c *Client4) GetBrandRoute() string {
	return "/brand"
}

func (c *Client4) GetDataRetentionRoute() string {
	return "/data_retention"
}

func (c *Client4) GetDataRetentionPolicyRoute(policyID string) string {
	return fmt.Sprintf(c.GetDataRetentionRoute()+"/policies/%v", policyID)
}

func (c *Client4) GetElasticsearchRoute() string {
	return "/elasticsearch"
}

func (c *Client4) GetBleveRoute() string {
	return "/bleve"
}

func (c *Client4) GetCommandsRoute() string {
	return "/commands"
}

func (c *Client4) GetCommandRoute(commandId string) string {
	return fmt.Sprintf(c.GetCommandsRoute()+"/%v", commandId)
}

func (c *Client4) GetCommandMoveRoute(commandId string) string {
	return fmt.Sprintf(c.GetCommandsRoute()+"/%v/move", commandId)
}

func (c *Client4) GetEmojisRoute() string {
	return "/emoji"
}

func (c *Client4) GetEmojiRoute(emojiId string) string {
	return fmt.Sprintf(c.GetEmojisRoute()+"/%v", emojiId)
}

func (c *Client4) GetEmojiByNameRoute(name string) string {
	return fmt.Sprintf(c.GetEmojisRoute()+"/name/%v", name)
}

func (c *Client4) GetReactionsRoute() string {
	return "/reactions"
}

func (c *Client4) GetOAuthAppsRoute() string {
	return "/oauth/apps"
}

func (c *Client4) GetOAuthAppRoute(appId string) string {
	return fmt.Sprintf("/oauth/apps/%v", appId)
}

func (c *Client4) GetOpenGraphRoute() string {
	return "/opengraph"
}

func (c *Client4) GetJobsRoute() string {
	return "/jobs"
}

func (c *Client4) GetRolesRoute() string {
	return "/roles"
}

func (c *Client4) GetSchemesRoute() string {
	return "/schemes"
}

func (c *Client4) GetSchemeRoute(id string) string {
	return c.GetSchemesRoute() + fmt.Sprintf("/%v", id)
}

func (c *Client4) GetAnalyticsRoute() string {
	return "/analytics"
}

func (c *Client4) GetTimezonesRoute() string {
	return fmt.Sprintf(c.GetSystemRoute() + "/timezones")
}

func (c *Client4) GetChannelSchemeRoute(channelId string) string {
	return fmt.Sprintf(c.GetChannelsRoute()+"/%v/scheme", channelId)
}

func (c *Client4) GetTeamSchemeRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamsRoute()+"/%v/scheme", teamId)
}

func (c *Client4) GetTotalUsersStatsRoute() string {
	return fmt.Sprintf(c.GetUsersRoute() + "/stats")
}

func (c *Client4) GetRedirectLocationRoute() string {
	return "/redirect_location"
}

func (c *Client4) GetServerBusyRoute() string {
	return "/server_busy"
}

func (c *Client4) GetUserTermsOfServiceRoute(userId string) string {
	return c.GetUserRoute(userId) + "/terms_of_service"
}

func (c *Client4) GetTermsOfServiceRoute() string {
	return "/terms_of_service"
}

func (c *Client4) GetGroupsRoute() string {
	return "/groups"
}

func (c *Client4) GetPublishUserTypingRoute(userId string) string {
	return c.GetUserRoute(userId) + "/typing"
}

func (c *Client4) GetGroupRoute(groupID string) string {
	return fmt.Sprintf("%s/%s", c.GetGroupsRoute(), groupID)
}

func (c *Client4) GetGroupSyncableRoute(groupID, syncableID string, syncableType GroupSyncableType) string {
	return fmt.Sprintf("%s/%ss/%s", c.GetGroupRoute(groupID), strings.ToLower(syncableType.String()), syncableID)
}

func (c *Client4) GetGroupSyncablesRoute(groupID string, syncableType GroupSyncableType) string {
	return fmt.Sprintf("%s/%ss", c.GetGroupRoute(groupID), strings.ToLower(syncableType.String()))
}

func (c *Client4) GetImportsRoute() string {
	return "/imports"
}

func (c *Client4) GetExportsRoute() string {
	return "/exports"
}

func (c *Client4) GetExportRoute(name string) string {
	return fmt.Sprintf(c.GetExportsRoute()+"/%v", name)
}

func (c *Client4) GetRemoteClusterRoute() string {
	return "/remotecluster"
}

func (c *Client4) GetSharedChannelsRoute() string {
	return "/sharedchannels"
}

func (c *Client4) GetPermissionsRoute() string {
	return "/permissions"
}

func (c *Client4) DoApiGet(url string, etag string) (*http.Response, error) {
	return c.DoApiRequest(http.MethodGet, c.ApiUrl+url, "", etag)
}

func (c *Client4) DoApiPost(url string, data string) (*http.Response, error) {
	return c.DoApiRequest(http.MethodPost, c.ApiUrl+url, data, "")
}

func (c *Client4) doApiDeleteBytes(url string, data []byte) (*http.Response, error) {
	return c.doApiRequestBytes(http.MethodDelete, c.ApiUrl+url, data, "")
}

func (c *Client4) doApiPatchBytes(url string, data []byte) (*http.Response, error) {
	return c.doApiRequestBytes(http.MethodPatch, c.ApiUrl+url, data, "")
}

func (c *Client4) doApiPostBytes(url string, data []byte) (*http.Response, error) {
	return c.doApiRequestBytes(http.MethodPost, c.ApiUrl+url, data, "")
}

func (c *Client4) DoApiPut(url string, data string) (*http.Response, error) {
	return c.DoApiRequest(http.MethodPut, c.ApiUrl+url, data, "")
}

func (c *Client4) doApiPutBytes(url string, data []byte) (*http.Response, error) {
	return c.doApiRequestBytes(http.MethodPut, c.ApiUrl+url, data, "")
}

func (c *Client4) DoApiDelete(url string) (*http.Response, error) {
	return c.DoApiRequest(http.MethodDelete, c.ApiUrl+url, "", "")
}

func (c *Client4) DoApiRequest(method, url, data, etag string) (*http.Response, error) {
	return c.doApiRequestReader(method, url, strings.NewReader(data), map[string]string{HeaderEtagClient: etag})
}

func (c *Client4) DoApiRequestWithHeaders(method, url, data string, headers map[string]string) (*http.Response, error) {
	return c.doApiRequestReader(method, url, strings.NewReader(data), headers)
}

func (c *Client4) doApiRequestBytes(method, url string, data []byte, etag string) (*http.Response, error) {
	return c.doApiRequestReader(method, url, bytes.NewReader(data), map[string]string{HeaderEtagClient: etag})
}

func (c *Client4) doApiRequestReader(method, url string, data io.Reader, headers map[string]string) (*http.Response, error) {
	rq, err := http.NewRequest(method, url, data)
	if err != nil {
		return nil, NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	for k, v := range headers {
		rq.Header.Set(k, v)
	}

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	if c.HttpHeader != nil && len(c.HttpHeader) > 0 {
		for k, v := range c.HttpHeader {
			rq.Header.Set(k, v)
		}
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return nil, NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)
	}

	if rp.StatusCode == 304 {
		return rp, nil
	}

	if rp.StatusCode >= 300 {
		defer closeBody(rp)
		return rp, AppErrorFromJson(rp.Body)
	}

	return rp, nil
}

func (c *Client4) DoUploadFile(url string, data []byte, contentType string) (*FileUploadResponse, *Response, error) {
	return c.doUploadFile(url, bytes.NewReader(data), contentType, 0)
}

func (c *Client4) doUploadFile(url string, body io.Reader, contentType string, contentLength int64) (*FileUploadResponse, *Response, error) {
	rq, err := http.NewRequest("POST", c.ApiUrl+url, body)
	if err != nil {
		return nil, nil, nil
	}
	if contentLength != 0 {
		rq.ContentLength = contentLength
	}
	rq.Header.Set("Content-Type", contentType)

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return nil, BuildResponse(rp), NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJson(rp.Body)
	}

	return FileUploadResponseFromJson(rp.Body), BuildResponse(rp), nil
}

func (c *Client4) DoEmojiUploadFile(url string, data []byte, contentType string) (*Emoji, *Response, error) {
	rq, err := http.NewRequest("POST", c.ApiUrl+url, bytes.NewReader(data))
	if err != nil {
		return nil, nil, nil
	}
	rq.Header.Set("Content-Type", contentType)

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return nil, BuildResponse(rp), NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJson(rp.Body)
	}

	return EmojiFromJson(rp.Body), BuildResponse(rp), nil
}

func (c *Client4) DoUploadImportTeam(url string, data []byte, contentType string) (map[string]string, *Response, error) {
	rq, err := http.NewRequest("POST", c.ApiUrl+url, bytes.NewReader(data))
	if err != nil {
		return nil, nil, nil
	}
	rq.Header.Set("Content-Type", contentType)

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return nil, BuildResponse(rp), NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJson(rp.Body)
	}

	return MapFromJson(rp.Body), BuildResponse(rp), nil
}

// CheckStatusOK is a convenience function for checking the standard OK response
// from the web service.
func CheckStatusOK(r *http.Response) bool {
	m := MapFromJson(r.Body)
	defer closeBody(r)

	if m != nil && m[STATUS] == StatusOk {
		return true
	}

	return false
}

// Authentication Section

// LoginById authenticates a user by user id and password.
func (c *Client4) LoginById(id string, password string) (*User, *Response, error) {
	m := make(map[string]string)
	m["id"] = id
	m["password"] = password
	return c.login(m)
}

// Login authenticates a user by login id, which can be username, email or some sort
// of SSO identifier based on server configuration, and a password.
func (c *Client4) Login(loginId string, password string) (*User, *Response, error) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	return c.login(m)
}

// LoginByLdap authenticates a user by LDAP id and password.
func (c *Client4) LoginByLdap(loginId string, password string) (*User, *Response, error) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["ldap_only"] = c.boolString(true)
	return c.login(m)
}

// LoginWithDevice authenticates a user by login id (username, email or some sort
// of SSO identifier based on configuration), password and attaches a device id to
// the session.
func (c *Client4) LoginWithDevice(loginId string, password string, deviceId string) (*User, *Response, error) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["device_id"] = deviceId
	return c.login(m)
}

// LoginWithMFA logs a user in with a MFA token
func (c *Client4) LoginWithMFA(loginId, password, mfaToken string) (*User, *Response, error) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["token"] = mfaToken
	return c.login(m)
}

func (c *Client4) login(m map[string]string) (*User, *Response, error) {
	r, err := c.DoApiPost("/users/login", MapToJson(m))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	c.AuthToken = r.Header.Get(HeaderToken)
	c.AuthType = HeaderBearer
	return UserFromJson(r.Body), BuildResponse(r), nil
}

// Logout terminates the current user's session.
func (c *Client4) Logout() (bool, *Response, error) {
	r, err := c.DoApiPost("/users/logout", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	c.AuthToken = ""
	c.AuthType = HeaderBearer
	return CheckStatusOK(r), BuildResponse(r), nil
}

// SwitchAccountType changes a user's login type from one type to another.
func (c *Client4) SwitchAccountType(switchRequest *SwitchRequest) (string, *Response, error) {
	buf, err := json.Marshal(switchRequest)
	if err != nil {
		return "", BuildResponse(nil), NewAppError("SwitchAccountType", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetUsersRoute()+"/login/switch", buf)
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body)["follow_link"], BuildResponse(r), nil
}

// User Section

// CreateUser creates a user in the system based on the provided user struct.
func (c *Client4) CreateUser(user *User) (*User, *Response, error) {
	r, err := c.DoApiPost(c.GetUsersRoute(), user.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserFromJson(r.Body), BuildResponse(r), nil
}

// CreateUserWithToken creates a user in the system based on the provided tokenId.
func (c *Client4) CreateUserWithToken(user *User, tokenId string) (*User, *Response, error) {
	if tokenId == "" {
		err := NewAppError("MissingHashOrData", "api.user.create_user.missing_token.app_error", nil, "", http.StatusBadRequest)
		return nil, &Response{StatusCode: err.StatusCode}, err
	}

	query := fmt.Sprintf("?t=%v", tokenId)
	buf, err := json.Marshal(user)
	if err != nil {
		return nil, nil, NewAppError("CreateUserWithToken", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetUsersRoute()+query, buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	return UserFromJson(r.Body), BuildResponse(r), nil
}

// CreateUserWithInviteId creates a user in the system based on the provided invited id.
func (c *Client4) CreateUserWithInviteId(user *User, inviteId string) (*User, *Response, error) {
	if inviteId == "" {
		err := NewAppError("MissingInviteId", "api.user.create_user.missing_invite_id.app_error", nil, "", http.StatusBadRequest)
		return nil, &Response{StatusCode: err.StatusCode}, err
	}

	query := fmt.Sprintf("?iid=%v", url.QueryEscape(inviteId))
	buf, err := json.Marshal(user)
	if err != nil {
		return nil, nil, NewAppError("CreateUserWithInviteId", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetUsersRoute()+query, buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	return UserFromJson(r.Body), BuildResponse(r), nil
}

// GetMe returns the logged in user.
func (c *Client4) GetMe(etag string) (*User, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(Me), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserFromJson(r.Body), BuildResponse(r), nil
}

// GetUser returns a user based on the provided user id string.
func (c *Client4) GetUser(userId, etag string) (*User, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(userId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserFromJson(r.Body), BuildResponse(r), nil
}

// GetUserByUsername returns a user based on the provided user name string.
func (c *Client4) GetUserByUsername(userName, etag string) (*User, *Response, error) {
	r, err := c.DoApiGet(c.GetUserByUsernameRoute(userName), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserFromJson(r.Body), BuildResponse(r), nil
}

// GetUserByEmail returns a user based on the provided user email string.
func (c *Client4) GetUserByEmail(email, etag string) (*User, *Response, error) {
	r, err := c.DoApiGet(c.GetUserByEmailRoute(email), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserFromJson(r.Body), BuildResponse(r), nil
}

// AutocompleteUsersInTeam returns the users on a team based on search term.
func (c *Client4) AutocompleteUsersInTeam(teamId string, username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&name=%v&limit=%d", teamId, username, limit)
	r, err := c.DoApiGet(c.GetUsersRoute()+"/autocomplete"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserAutocompleteFromJson(r.Body), BuildResponse(r), nil
}

// AutocompleteUsersInChannel returns the users in a channel based on search term.
func (c *Client4) AutocompleteUsersInChannel(teamId string, channelId string, username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&in_channel=%v&name=%v&limit=%d", teamId, channelId, username, limit)
	r, err := c.DoApiGet(c.GetUsersRoute()+"/autocomplete"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserAutocompleteFromJson(r.Body), BuildResponse(r), nil
}

// AutocompleteUsers returns the users in the system based on search term.
func (c *Client4) AutocompleteUsers(username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	query := fmt.Sprintf("?name=%v&limit=%d", username, limit)
	r, err := c.DoApiGet(c.GetUsersRoute()+"/autocomplete"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserAutocompleteFromJson(r.Body), BuildResponse(r), nil
}

// GetDefaultProfileImage gets the default user's profile image. Must be logged in.
func (c *Client4) GetDefaultProfileImage(userId string) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/image/default", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetDefaultProfileImage", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)
	}

	return data, BuildResponse(r), nil
}

// GetProfileImage gets user's profile image. Must be logged in.
func (c *Client4) GetProfileImage(userId, etag string) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/image", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetProfileImage", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)
	}
	return data, BuildResponse(r), nil
}

// GetUsers returns a page of users on the system. Page counting starts at 0.
func (c *Client4) GetUsers(page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetUsersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoApiGet(c.GetUsersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetNewUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetNewUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?sort=create_at&in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoApiGet(c.GetUsersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetRecentlyActiveUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetRecentlyActiveUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?sort=last_activity_at&in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoApiGet(c.GetUsersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetActiveUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetActiveUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?active=true&in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoApiGet(c.GetUsersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersNotInTeam returns a page of users who are not in a team. Page counting starts at 0.
func (c *Client4) GetUsersNotInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?not_in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoApiGet(c.GetUsersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersInChannel returns a page of users in a channel. Page counting starts at 0.
func (c *Client4) GetUsersInChannel(channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_channel=%v&page=%v&per_page=%v", channelId, page, perPage)
	r, err := c.DoApiGet(c.GetUsersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersInChannelByStatus returns a page of users in a channel. Page counting starts at 0. Sorted by Status
func (c *Client4) GetUsersInChannelByStatus(channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_channel=%v&page=%v&per_page=%v&sort=status", channelId, page, perPage)
	r, err := c.DoApiGet(c.GetUsersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersNotInChannel returns a page of users not in a channel. Page counting starts at 0.
func (c *Client4) GetUsersNotInChannel(teamId, channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&not_in_channel=%v&page=%v&per_page=%v", teamId, channelId, page, perPage)
	r, err := c.DoApiGet(c.GetUsersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersWithoutTeam returns a page of users on the system that aren't on any teams. Page counting starts at 0.
func (c *Client4) GetUsersWithoutTeam(page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?without_team=1&page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetUsersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersInGroup returns a page of users in a group. Page counting starts at 0.
func (c *Client4) GetUsersInGroup(groupID string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_group=%v&page=%v&per_page=%v", groupID, page, perPage)
	r, err := c.DoApiGet(c.GetUsersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersByIds returns a list of users based on the provided user ids.
func (c *Client4) GetUsersByIds(userIds []string) ([]*User, *Response, error) {
	r, err := c.DoApiPost(c.GetUsersRoute()+"/ids", ArrayToJson(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersByIds returns a list of users based on the provided user ids.
func (c *Client4) GetUsersByIdsWithOptions(userIds []string, options *UserGetByIdsOptions) ([]*User, *Response, error) {
	v := url.Values{}
	if options.Since != 0 {
		v.Set("since", fmt.Sprintf("%d", options.Since))
	}

	url := c.GetUsersRoute() + "/ids"
	if len(v) > 0 {
		url += "?" + v.Encode()
	}

	r, err := c.DoApiPost(url, ArrayToJson(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersByUsernames returns a list of users based on the provided usernames.
func (c *Client4) GetUsersByUsernames(usernames []string) ([]*User, *Response, error) {
	r, err := c.DoApiPost(c.GetUsersRoute()+"/usernames", ArrayToJson(usernames))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersByGroupChannelIds returns a map with channel ids as keys
// and a list of users as values based on the provided user ids.
func (c *Client4) GetUsersByGroupChannelIds(groupChannelIds []string) (map[string][]*User, *Response, error) {
	r, err := c.DoApiPost(c.GetUsersRoute()+"/group_channels", ArrayToJson(groupChannelIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	usersByChannelId := map[string][]*User{}
	json.NewDecoder(r.Body).Decode(&usersByChannelId)
	return usersByChannelId, BuildResponse(r), nil
}

// SearchUsers returns a list of users based on some search criteria.
func (c *Client4) SearchUsers(search *UserSearch) ([]*User, *Response, error) {
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchUsers", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetUsersRoute()+"/search", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserListFromJson(r.Body), BuildResponse(r), nil
}

// UpdateUser updates a user in the system based on the provided user struct.
func (c *Client4) UpdateUser(user *User) (*User, *Response, error) {
	buf, err := json.Marshal(user)
	if err != nil {
		return nil, nil, NewAppError("UpdateUser", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetUserRoute(user.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserFromJson(r.Body), BuildResponse(r), nil
}

// PatchUser partially updates a user in the system. Any missing fields are not updated.
func (c *Client4) PatchUser(userId string, patch *UserPatch) (*User, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchUser", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetUserRoute(userId)+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserFromJson(r.Body), BuildResponse(r), nil
}

// UpdateUserAuth updates a user AuthData (uthData, authService and password) in the system.
func (c *Client4) UpdateUserAuth(userId string, userAuth *UserAuth) (*UserAuth, *Response, error) {
	buf, err := json.Marshal(userAuth)
	if err != nil {
		return nil, nil, NewAppError("UpdateUserAuth", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetUserRoute(userId)+"/auth", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserAuthFromJson(r.Body), BuildResponse(r), nil
}

// UpdateUserMfa activates multi-factor authentication for a user if activate
// is true and a valid code is provided. If activate is false, then code is not
// required and multi-factor authentication is disabled for the user.
func (c *Client4) UpdateUserMfa(userId, code string, activate bool) (bool, *Response, error) {
	requestBody := make(map[string]interface{})
	requestBody["activate"] = activate
	requestBody["code"] = code

	r, err := c.DoApiPut(c.GetUserRoute(userId)+"/mfa", StringInterfaceToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GenerateMfaSecret will generate a new MFA secret for a user and return it as a string and
// as a base64 encoded image QR code.
func (c *Client4) GenerateMfaSecret(userId string) (*MfaSecret, *Response, error) {
	r, err := c.DoApiPost(c.GetUserRoute(userId)+"/mfa/generate", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MfaSecretFromJson(r.Body), BuildResponse(r), nil
}

// UpdateUserPassword updates a user's password. Must be logged in as the user or be a system administrator.
func (c *Client4) UpdateUserPassword(userId, currentPassword, newPassword string) (bool, *Response, error) {
	requestBody := map[string]string{"current_password": currentPassword, "new_password": newPassword}
	r, err := c.DoApiPut(c.GetUserRoute(userId)+"/password", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UpdateUserHashedPassword updates a user's password with an already-hashed password. Must be a system administrator.
func (c *Client4) UpdateUserHashedPassword(userId, newHashedPassword string) (bool, *Response, error) {
	requestBody := map[string]string{"already_hashed": "true", "new_password": newHashedPassword}
	r, err := c.DoApiPut(c.GetUserRoute(userId)+"/password", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// PromoteGuestToUser convert a guest into a regular user
func (c *Client4) PromoteGuestToUser(guestId string) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetUserRoute(guestId)+"/promote", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// DemoteUserToGuest convert a regular user into a guest
func (c *Client4) DemoteUserToGuest(guestId string) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetUserRoute(guestId)+"/demote", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UpdateUserRoles updates a user's roles in the system. A user can have "system_user" and "system_admin" roles.
func (c *Client4) UpdateUserRoles(userId, roles string) (bool, *Response, error) {
	requestBody := map[string]string{"roles": roles}
	r, err := c.DoApiPut(c.GetUserRoute(userId)+"/roles", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UpdateUserActive updates status of a user whether active or not.
func (c *Client4) UpdateUserActive(userId string, active bool) (bool, *Response, error) {
	requestBody := make(map[string]interface{})
	requestBody["active"] = active
	r, err := c.DoApiPut(c.GetUserRoute(userId)+"/active", StringInterfaceToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)

	return CheckStatusOK(r), BuildResponse(r), nil
}

// DeleteUser deactivates a user in the system based on the provided user id string.
func (c *Client4) DeleteUser(userId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetUserRoute(userId))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// PermanentDeleteUser deletes a user in the system based on the provided user id string.
func (c *Client4) PermanentDeleteUser(userId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetUserRoute(userId) + "?permanent=" + c.boolString(true))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// ConvertUserToBot converts a user to a bot user.
func (c *Client4) ConvertUserToBot(userId string) (*Bot, *Response, error) {
	r, err := c.DoApiPost(c.GetUserRoute(userId)+"/convert_to_bot", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("ConvertUserToBot", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return bot, BuildResponse(r), nil
}

// ConvertBotToUser converts a bot user to a user.
func (c *Client4) ConvertBotToUser(userId string, userPatch *UserPatch, setSystemAdmin bool) (*User, *Response, error) {
	var query string
	if setSystemAdmin {
		query = "?set_system_admin=true"
	}
	buf, err := json.Marshal(userPatch)
	if err != nil {
		return nil, nil, NewAppError("ConvertBotToUser", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetBotRoute(userId)+"/convert_to_user"+query, buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserFromJson(r.Body), BuildResponse(r), nil
}

// PermanentDeleteAll permanently deletes all users in the system. This is a local only endpoint
func (c *Client4) PermanentDeleteAllUsers() (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetUsersRoute())
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// SendPasswordResetEmail will send a link for password resetting to a user with the
// provided email.
func (c *Client4) SendPasswordResetEmail(email string) (bool, *Response, error) {
	requestBody := map[string]string{"email": email}
	r, err := c.DoApiPost(c.GetUsersRoute()+"/password/reset/send", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// ResetPassword uses a recovery code to update reset a user's password.
func (c *Client4) ResetPassword(token, newPassword string) (bool, *Response, error) {
	requestBody := map[string]string{"token": token, "new_password": newPassword}
	r, err := c.DoApiPost(c.GetUsersRoute()+"/password/reset", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetSessions returns a list of sessions based on the provided user id string.
func (c *Client4) GetSessions(userId, etag string) ([]*Session, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/sessions", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return SessionsFromJson(r.Body), BuildResponse(r), nil
}

// RevokeSession revokes a user session based on the provided user id and session id strings.
func (c *Client4) RevokeSession(userId, sessionId string) (bool, *Response, error) {
	requestBody := map[string]string{"session_id": sessionId}
	r, err := c.DoApiPost(c.GetUserRoute(userId)+"/sessions/revoke", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// RevokeAllSessions revokes all sessions for the provided user id string.
func (c *Client4) RevokeAllSessions(userId string) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetUserRoute(userId)+"/sessions/revoke/all", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// RevokeAllSessions revokes all sessions for all the users.
func (c *Client4) RevokeSessionsFromAllUsers() (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetUsersRoute()+"/sessions/revoke/all", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// AttachDeviceId attaches a mobile device ID to the current session.
func (c *Client4) AttachDeviceId(deviceId string) (bool, *Response, error) {
	requestBody := map[string]string{"device_id": deviceId}
	r, err := c.DoApiPut(c.GetUsersRoute()+"/sessions/device", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetTeamsUnreadForUser will return an array with TeamUnread objects that contain the amount
// of unread messages and mentions the current user has for the teams it belongs to.
// An optional team ID can be set to exclude that team from the results.
// An optional boolean can be set to include collapsed thread unreads. Must be authenticated.
func (c *Client4) GetTeamsUnreadForUser(userId, teamIdToExclude string, includeCollapsedThreads bool) ([]*TeamUnread, *Response, error) {
	query := url.Values{}

	if teamIdToExclude != "" {
		query.Set("exclude_team", teamIdToExclude)
	}

	if includeCollapsedThreads {
		query.Set("include_collapsed_threads", "true")
	}

	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/teams/unread?"+query.Encode(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamsUnreadFromJson(r.Body), BuildResponse(r), nil
}

// GetUserAudits returns a list of audit based on the provided user id string.
func (c *Client4) GetUserAudits(userId string, page int, perPage int, etag string) (Audits, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/audits"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var audits Audits
	err = json.NewDecoder(r.Body).Decode(&audits)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetUserAudits", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return audits, BuildResponse(r), nil
}

// VerifyUserEmail will verify a user's email using the supplied token.
func (c *Client4) VerifyUserEmail(token string) (bool, *Response, error) {
	requestBody := map[string]string{"token": token}
	r, err := c.DoApiPost(c.GetUsersRoute()+"/email/verify", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// VerifyUserEmailWithoutToken will verify a user's email by its Id. (Requires manage system role)
func (c *Client4) VerifyUserEmailWithoutToken(userId string) (*User, *Response, error) {
	r, err := c.DoApiPost(c.GetUserRoute(userId)+"/email/verify/member", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserFromJson(r.Body), BuildResponse(r), nil
}

// SendVerificationEmail will send an email to the user with the provided email address, if
// that user exists. The email will contain a link that can be used to verify the user's
// email address.
func (c *Client4) SendVerificationEmail(email string) (bool, *Response, error) {
	requestBody := map[string]string{"email": email}
	r, err := c.DoApiPost(c.GetUsersRoute()+"/email/verify/send", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// SetDefaultProfileImage resets the profile image to a default generated one.
func (c *Client4) SetDefaultProfileImage(userId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetUserRoute(userId) + "/image")
	if err != nil {
		return false, BuildResponse(r), err
	}
	return CheckStatusOK(r), BuildResponse(r), nil
}

// SetProfileImage sets profile image of the user.
func (c *Client4) SetProfileImage(userId string, data []byte) (bool, *Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", "profile.png")
	if err != nil {
		return false, nil, NewAppError("SetProfileImage", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return false, nil, NewAppError("SetProfileImage", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if err = writer.Close(); err != nil {
		return false, nil, NewAppError("SetProfileImage", "model.client.set_profile_user.writer.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	rq, err := http.NewRequest("POST", c.ApiUrl+c.GetUserRoute(userId)+"/image", bytes.NewReader(body.Bytes()))
	if err != nil {
		return false, nil, NewAppError("SetProfileImage", "model.client.connecting.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	rq.Header.Set("Content-Type", writer.FormDataContentType())

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return false, &Response{StatusCode: http.StatusForbidden}, NewAppError(c.GetUserRoute(userId)+"/image", "model.client.connecting.app_error", nil, err.Error(), http.StatusForbidden)
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return false, BuildResponse(rp), AppErrorFromJson(rp.Body)
	}

	return CheckStatusOK(rp), BuildResponse(rp), nil
}

// CreateUserAccessToken will generate a user access token that can be used in place
// of a session token to access the REST API. Must have the 'create_user_access_token'
// permission and if generating for another user, must have the 'edit_other_users'
// permission. A non-blank description is required.
func (c *Client4) CreateUserAccessToken(userId, description string) (*UserAccessToken, *Response, error) {
	requestBody := map[string]string{"description": description}
	r, err := c.DoApiPost(c.GetUserRoute(userId)+"/tokens", MapToJson(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserAccessTokenFromJson(r.Body), BuildResponse(r), nil
}

// GetUserAccessTokens will get a page of access tokens' id, description, is_active
// and the user_id in the system. The actual token will not be returned. Must have
// the 'manage_system' permission.
func (c *Client4) GetUserAccessTokens(page int, perPage int) ([]*UserAccessToken, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetUserAccessTokensRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserAccessTokenListFromJson(r.Body), BuildResponse(r), nil
}

// GetUserAccessToken will get a user access tokens' id, description, is_active
// and the user_id of the user it is for. The actual token will not be returned.
// Must have the 'read_user_access_token' permission and if getting for another
// user, must have the 'edit_other_users' permission.
func (c *Client4) GetUserAccessToken(tokenId string) (*UserAccessToken, *Response, error) {
	r, err := c.DoApiGet(c.GetUserAccessTokenRoute(tokenId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserAccessTokenFromJson(r.Body), BuildResponse(r), nil
}

// GetUserAccessTokensForUser will get a paged list of user access tokens showing id,
// description and user_id for each. The actual tokens will not be returned. Must have
// the 'read_user_access_token' permission and if getting for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) GetUserAccessTokensForUser(userId string, page, perPage int) ([]*UserAccessToken, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/tokens"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserAccessTokenListFromJson(r.Body), BuildResponse(r), nil
}

// RevokeUserAccessToken will revoke a user access token by id. Must have the
// 'revoke_user_access_token' permission and if revoking for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) RevokeUserAccessToken(tokenId string) (bool, *Response, error) {
	requestBody := map[string]string{"token_id": tokenId}
	r, err := c.DoApiPost(c.GetUsersRoute()+"/tokens/revoke", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// SearchUserAccessTokens returns user access tokens matching the provided search term.
func (c *Client4) SearchUserAccessTokens(search *UserAccessTokenSearch) ([]*UserAccessToken, *Response, error) {
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchUserAccessTokens", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetUsersRoute()+"/tokens/search", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserAccessTokenListFromJson(r.Body), BuildResponse(r), nil
}

// DisableUserAccessToken will disable a user access token by id. Must have the
// 'revoke_user_access_token' permission and if disabling for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) DisableUserAccessToken(tokenId string) (bool, *Response, error) {
	requestBody := map[string]string{"token_id": tokenId}
	r, err := c.DoApiPost(c.GetUsersRoute()+"/tokens/disable", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// EnableUserAccessToken will enable a user access token by id. Must have the
// 'create_user_access_token' permission and if enabling for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) EnableUserAccessToken(tokenId string) (bool, *Response, error) {
	requestBody := map[string]string{"token_id": tokenId}
	r, err := c.DoApiPost(c.GetUsersRoute()+"/tokens/enable", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// Bots section

// CreateBot creates a bot in the system based on the provided bot struct.
func (c *Client4) CreateBot(bot *Bot) (*Bot, *Response, error) {
	r, err := c.doApiPostBytes(c.GetBotsRoute(), bot.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var resp *Bot
	err = json.NewDecoder(r.Body).Decode(&resp)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("CreateBot", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return resp, BuildResponse(r), nil
}

// PatchBot partially updates a bot. Any missing fields are not updated.
func (c *Client4) PatchBot(userId string, patch *BotPatch) (*Bot, *Response, error) {
	r, err := c.doApiPutBytes(c.GetBotRoute(userId), patch.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("PatchBot", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return bot, BuildResponse(r), nil
}

// GetBot fetches the given, undeleted bot.
func (c *Client4) GetBot(userId string, etag string) (*Bot, *Response, error) {
	r, err := c.DoApiGet(c.GetBotRoute(userId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBot", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return bot, BuildResponse(r), nil
}

// GetBotIncludeDeleted fetches the given bot, even if it is deleted.
func (c *Client4) GetBotIncludeDeleted(userId string, etag string) (*Bot, *Response, error) {
	r, err := c.DoApiGet(c.GetBotRoute(userId)+"?include_deleted="+c.boolString(true), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBotIncludeDeleted", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return bot, BuildResponse(r), nil
}

// GetBots fetches the given page of bots, excluding deleted.
func (c *Client4) GetBots(page, perPage int, etag string) ([]*Bot, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetBotsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bots BotList
	err = json.NewDecoder(r.Body).Decode(&bots)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBots", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return bots, BuildResponse(r), nil
}

// GetBotsIncludeDeleted fetches the given page of bots, including deleted.
func (c *Client4) GetBotsIncludeDeleted(page, perPage int, etag string) ([]*Bot, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_deleted="+c.boolString(true), page, perPage)
	r, err := c.DoApiGet(c.GetBotsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bots BotList
	err = json.NewDecoder(r.Body).Decode(&bots)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBotsIncludeDeleted", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return bots, BuildResponse(r), nil
}

// GetBotsOrphaned fetches the given page of bots, only including orphanded bots.
func (c *Client4) GetBotsOrphaned(page, perPage int, etag string) ([]*Bot, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&only_orphaned="+c.boolString(true), page, perPage)
	r, err := c.DoApiGet(c.GetBotsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bots BotList
	err = json.NewDecoder(r.Body).Decode(&bots)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBotsOrphaned", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return bots, BuildResponse(r), nil
}

// DisableBot disables the given bot in the system.
func (c *Client4) DisableBot(botUserId string) (*Bot, *Response, error) {
	r, err := c.doApiPostBytes(c.GetBotRoute(botUserId)+"/disable", nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("DisableBot", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return bot, BuildResponse(r), nil
}

// EnableBot disables the given bot in the system.
func (c *Client4) EnableBot(botUserId string) (*Bot, *Response, error) {
	r, err := c.doApiPostBytes(c.GetBotRoute(botUserId)+"/enable", nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("EnableBot", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return bot, BuildResponse(r), nil
}

// AssignBot assigns the given bot to the given user
func (c *Client4) AssignBot(botUserId, newOwnerId string) (*Bot, *Response, error) {
	r, err := c.doApiPostBytes(c.GetBotRoute(botUserId)+"/assign/"+newOwnerId, nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("AssignBot", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return bot, BuildResponse(r), nil
}

// SetBotIconImage sets LHS bot icon image.
func (c *Client4) SetBotIconImage(botUserId string, data []byte) (bool, *Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", "icon.svg")
	if err != nil {
		return false, nil, NewAppError("SetBotIconImage", "model.client.set_bot_icon_image.no_file.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return false, nil, NewAppError("SetBotIconImage", "model.client.set_bot_icon_image.no_file.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if err = writer.Close(); err != nil {
		return false, nil, NewAppError("SetBotIconImage", "model.client.set_bot_icon_image.writer.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	rq, err := http.NewRequest("POST", c.ApiUrl+c.GetBotRoute(botUserId)+"/icon", bytes.NewReader(body.Bytes()))
	if err != nil {
		return false, nil, NewAppError("SetBotIconImage", "model.client.connecting.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	rq.Header.Set("Content-Type", writer.FormDataContentType())

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return false, &Response{StatusCode: http.StatusForbidden}, NewAppError(c.GetBotRoute(botUserId)+"/icon", "model.client.connecting.app_error", nil, err.Error(), http.StatusForbidden)
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return false, BuildResponse(rp), AppErrorFromJson(rp.Body)
	}

	return CheckStatusOK(rp), BuildResponse(rp), nil
}

// GetBotIconImage gets LHS bot icon image. Must be logged in.
func (c *Client4) GetBotIconImage(botUserId string) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetBotRoute(botUserId)+"/icon", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBotIconImage", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)
	}
	return data, BuildResponse(r), nil
}

// DeleteBotIconImage deletes LHS bot icon image. Must be logged in.
func (c *Client4) DeleteBotIconImage(botUserId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetBotRoute(botUserId) + "/icon")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// Team Section

// CreateTeam creates a team in the system based on the provided team struct.
func (c *Client4) CreateTeam(team *Team) (*Team, *Response, error) {
	buf, err := json.Marshal(team)
	if err != nil {
		return nil, nil, NewAppError("CreateTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetTeamsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamFromJson(r.Body), BuildResponse(r), nil
}

// GetTeam returns a team based on the provided team id string.
func (c *Client4) GetTeam(teamId, etag string) (*Team, *Response, error) {
	r, err := c.DoApiGet(c.GetTeamRoute(teamId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamFromJson(r.Body), BuildResponse(r), nil
}

// GetAllTeams returns all teams based on permissions.
func (c *Client4) GetAllTeams(etag string, page int, perPage int) ([]*Team, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetTeamsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamListFromJson(r.Body), BuildResponse(r), nil
}

// GetAllTeamsWithTotalCount returns all teams based on permissions.
func (c *Client4) GetAllTeamsWithTotalCount(etag string, page int, perPage int) ([]*Team, int64, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_total_count="+c.boolString(true), page, perPage)
	r, err := c.DoApiGet(c.GetTeamsRoute()+query, etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)
	teamsListWithCount := TeamsWithCountFromJson(r.Body)
	return teamsListWithCount.Teams, teamsListWithCount.TotalCount, BuildResponse(r), nil
}

// GetAllTeamsExcludePolicyConstrained returns all teams which are not part of a data retention policy.
// Must be a system administrator.
func (c *Client4) GetAllTeamsExcludePolicyConstrained(etag string, page int, perPage int) ([]*Team, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&exclude_policy_constrained=%v", page, perPage, true)
	r, err := c.DoApiGet(c.GetTeamsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamListFromJson(r.Body), BuildResponse(r), nil
}

// GetTeamByName returns a team based on the provided team name string.
func (c *Client4) GetTeamByName(name, etag string) (*Team, *Response, error) {
	r, err := c.DoApiGet(c.GetTeamByNameRoute(name), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamFromJson(r.Body), BuildResponse(r), nil
}

// SearchTeams returns teams matching the provided search term.
func (c *Client4) SearchTeams(search *TeamSearch) ([]*Team, *Response, error) {
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchTeams", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetTeamsRoute()+"/search", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamListFromJson(r.Body), BuildResponse(r), nil
}

// SearchTeamsPaged returns a page of teams and the total count matching the provided search term.
func (c *Client4) SearchTeamsPaged(search *TeamSearch) ([]*Team, int64, *Response, error) {
	if search.Page == nil {
		search.Page = NewInt(0)
	}
	if search.PerPage == nil {
		search.PerPage = NewInt(100)
	}
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, 0, BuildResponse(nil), NewAppError("SearchTeamsPaged", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetTeamsRoute()+"/search", buf)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)
	twc := TeamsWithCountFromJson(r.Body)
	return twc.Teams, twc.TotalCount, BuildResponse(r), nil
}

// TeamExists returns true or false if the team exist or not.
func (c *Client4) TeamExists(name, etag string) (bool, *Response, error) {
	r, err := c.DoApiGet(c.GetTeamByNameRoute(name)+"/exists", etag)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapBoolFromJson(r.Body)["exists"], BuildResponse(r), nil
}

// GetTeamsForUser returns a list of teams a user is on. Must be logged in as the user
// or be a system administrator.
func (c *Client4) GetTeamsForUser(userId, etag string) ([]*Team, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/teams", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamListFromJson(r.Body), BuildResponse(r), nil
}

// GetTeamMember returns a team member based on the provided team and user id strings.
func (c *Client4) GetTeamMember(teamId, userId, etag string) (*TeamMember, *Response, error) {
	r, err := c.DoApiGet(c.GetTeamMemberRoute(teamId, userId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamMemberFromJson(r.Body), BuildResponse(r), nil
}

// UpdateTeamMemberRoles will update the roles on a team for a user.
func (c *Client4) UpdateTeamMemberRoles(teamId, userId, newRoles string) (bool, *Response, error) {
	requestBody := map[string]string{"roles": newRoles}
	r, err := c.DoApiPut(c.GetTeamMemberRoute(teamId, userId)+"/roles", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UpdateTeamMemberSchemeRoles will update the scheme-derived roles on a team for a user.
func (c *Client4) UpdateTeamMemberSchemeRoles(teamId string, userId string, schemeRoles *SchemeRoles) (bool, *Response, error) {
	buf, err := json.Marshal(schemeRoles)
	if err != nil {
		return false, nil, NewAppError("UpdateTeamMemberSchemeRoles", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetTeamMemberRoute(teamId, userId)+"/schemeRoles", buf)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UpdateTeam will update a team.
func (c *Client4) UpdateTeam(team *Team) (*Team, *Response, error) {
	buf, err := json.Marshal(team)
	if err != nil {
		return nil, nil, NewAppError("UpdateTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetTeamRoute(team.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamFromJson(r.Body), BuildResponse(r), nil
}

// PatchTeam partially updates a team. Any missing fields are not updated.
func (c *Client4) PatchTeam(teamId string, patch *TeamPatch) (*Team, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetTeamRoute(teamId)+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamFromJson(r.Body), BuildResponse(r), nil
}

// RestoreTeam restores a previously deleted team.
func (c *Client4) RestoreTeam(teamId string) (*Team, *Response, error) {
	r, err := c.DoApiPost(c.GetTeamRoute(teamId)+"/restore", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamFromJson(r.Body), BuildResponse(r), nil
}

// RegenerateTeamInviteId requests a new invite ID to be generated.
func (c *Client4) RegenerateTeamInviteId(teamId string) (*Team, *Response, error) {
	r, err := c.DoApiPost(c.GetTeamRoute(teamId)+"/regenerate_invite_id", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamFromJson(r.Body), BuildResponse(r), nil
}

// SoftDeleteTeam deletes the team softly (archive only, not permanent delete).
func (c *Client4) SoftDeleteTeam(teamId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetTeamRoute(teamId))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// PermanentDeleteTeam deletes the team, should only be used when needed for
// compliance and the like.
func (c *Client4) PermanentDeleteTeam(teamId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetTeamRoute(teamId) + "?permanent=" + c.boolString(true))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UpdateTeamPrivacy modifies the team type (model.TeamOpen <--> model.TeamInvite) and sets
// the corresponding AllowOpenInvite appropriately.
func (c *Client4) UpdateTeamPrivacy(teamId string, privacy string) (*Team, *Response, error) {
	requestBody := map[string]string{"privacy": privacy}
	r, err := c.DoApiPut(c.GetTeamRoute(teamId)+"/privacy", MapToJson(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamFromJson(r.Body), BuildResponse(r), nil
}

// GetTeamMembers returns team members based on the provided team id string.
func (c *Client4) GetTeamMembers(teamId string, page int, perPage int, etag string) ([]*TeamMember, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetTeamMembersRoute(teamId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamMembersFromJson(r.Body), BuildResponse(r), nil
}

// GetTeamMembersWithoutDeletedUsers returns team members based on the provided team id string. Additional parameters of sort and exclude_deleted_users accepted as well
// Could not add it to above function due to it be a breaking change.
func (c *Client4) GetTeamMembersSortAndWithoutDeletedUsers(teamId string, page int, perPage int, sort string, excludeDeletedUsers bool, etag string) ([]*TeamMember, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&sort=%v&exclude_deleted_users=%v", page, perPage, sort, excludeDeletedUsers)
	r, err := c.DoApiGet(c.GetTeamMembersRoute(teamId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamMembersFromJson(r.Body), BuildResponse(r), nil
}

// GetTeamMembersForUser returns the team members for a user.
func (c *Client4) GetTeamMembersForUser(userId string, etag string) ([]*TeamMember, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/teams/members", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamMembersFromJson(r.Body), BuildResponse(r), nil
}

// GetTeamMembersByIds will return an array of team members based on the
// team id and a list of user ids provided. Must be authenticated.
func (c *Client4) GetTeamMembersByIds(teamId string, userIds []string) ([]*TeamMember, *Response, error) {
	r, err := c.DoApiPost(fmt.Sprintf("/teams/%v/members/ids", teamId), ArrayToJson(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamMembersFromJson(r.Body), BuildResponse(r), nil
}

// AddTeamMember adds user to a team and return a team member.
func (c *Client4) AddTeamMember(teamId, userId string) (*TeamMember, *Response, error) {
	member := &TeamMember{TeamId: teamId, UserId: userId}
	buf, err := json.Marshal(member)
	if err != nil {
		return nil, nil, NewAppError("AddTeamMember", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetTeamMembersRoute(teamId), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamMemberFromJson(r.Body), BuildResponse(r), nil
}

// AddTeamMemberFromInvite adds a user to a team and return a team member using an invite id
// or an invite token/data pair.
func (c *Client4) AddTeamMemberFromInvite(token, inviteId string) (*TeamMember, *Response, error) {
	var query string

	if inviteId != "" {
		query += fmt.Sprintf("?invite_id=%v", inviteId)
	}

	if token != "" {
		query += fmt.Sprintf("?token=%v", token)
	}

	r, err := c.DoApiPost(c.GetTeamsRoute()+"/members/invite"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamMemberFromJson(r.Body), BuildResponse(r), nil
}

// AddTeamMembers adds a number of users to a team and returns the team members.
func (c *Client4) AddTeamMembers(teamId string, userIds []string) ([]*TeamMember, *Response, error) {
	var members []*TeamMember
	for _, userId := range userIds {
		member := &TeamMember{TeamId: teamId, UserId: userId}
		members = append(members, member)
	}

	r, err := c.DoApiPost(c.GetTeamMembersRoute(teamId)+"/batch", TeamMembersToJson(members))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamMembersFromJson(r.Body), BuildResponse(r), nil
}

// AddTeamMembers adds a number of users to a team and returns the team members.
func (c *Client4) AddTeamMembersGracefully(teamId string, userIds []string) ([]*TeamMemberWithError, *Response, error) {
	var members []*TeamMember
	for _, userId := range userIds {
		member := &TeamMember{TeamId: teamId, UserId: userId}
		members = append(members, member)
	}

	r, err := c.DoApiPost(c.GetTeamMembersRoute(teamId)+"/batch?graceful="+c.boolString(true), TeamMembersToJson(members))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamMembersWithErrorFromJson(r.Body), BuildResponse(r), nil
}

// RemoveTeamMember will remove a user from a team.
func (c *Client4) RemoveTeamMember(teamId, userId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetTeamMemberRoute(teamId, userId))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetTeamStats returns a team stats based on the team id string.
// Must be authenticated.
func (c *Client4) GetTeamStats(teamId, etag string) (*TeamStats, *Response, error) {
	r, err := c.DoApiGet(c.GetTeamStatsRoute(teamId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamStatsFromJson(r.Body), BuildResponse(r), nil
}

// GetTotalUsersStats returns a total system user stats.
// Must be authenticated.
func (c *Client4) GetTotalUsersStats(etag string) (*UsersStats, *Response, error) {
	r, err := c.DoApiGet(c.GetTotalUsersStatsRoute(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UsersStatsFromJson(r.Body), BuildResponse(r), nil
}

// GetTeamUnread will return a TeamUnread object that contains the amount of
// unread messages and mentions the user has for the specified team.
// Must be authenticated.
func (c *Client4) GetTeamUnread(teamId, userId string) (*TeamUnread, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(userId)+c.GetTeamRoute(teamId)+"/unread", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamUnreadFromJson(r.Body), BuildResponse(r), nil
}

// ImportTeam will import an exported team from other app into a existing team.
func (c *Client4) ImportTeam(data []byte, filesize int, importFrom, filename, teamId string) (map[string]string, *Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, nil, nil
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, nil, nil
	}

	part, err = writer.CreateFormField("filesize")
	if err != nil {
		return nil, nil, nil
	}

	if _, err = io.Copy(part, strings.NewReader(strconv.Itoa(filesize))); err != nil {
		return nil, nil, nil
	}

	part, err = writer.CreateFormField("importFrom")
	if err != nil {
		return nil, nil, nil
	}

	if _, err := io.Copy(part, strings.NewReader(importFrom)); err != nil {
		return nil, nil, nil
	}

	if err := writer.Close(); err != nil {
		return nil, nil, nil
	}

	return c.DoUploadImportTeam(c.GetTeamImportRoute(teamId), body.Bytes(), writer.FormDataContentType())
}

// InviteUsersToTeam invite users by email to the team.
func (c *Client4) InviteUsersToTeam(teamId string, userEmails []string) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetTeamRoute(teamId)+"/invite/email", ArrayToJson(userEmails))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// InviteGuestsToTeam invite guest by email to some channels in a team.
func (c *Client4) InviteGuestsToTeam(teamId string, userEmails []string, channels []string, message string) (bool, *Response, error) {
	guestsInvite := GuestsInvite{
		Emails:   userEmails,
		Channels: channels,
		Message:  message,
	}
	buf, err := json.Marshal(guestsInvite)
	if err != nil {
		return false, nil, NewAppError("InviteGuestsToTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetTeamRoute(teamId)+"/invite-guests/email", buf)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// InviteUsersToTeam invite users by email to the team.
func (c *Client4) InviteUsersToTeamGracefully(teamId string, userEmails []string) ([]*EmailInviteWithError, *Response, error) {
	r, err := c.DoApiPost(c.GetTeamRoute(teamId)+"/invite/email?graceful="+c.boolString(true), ArrayToJson(userEmails))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return EmailInviteWithErrorFromJson(r.Body), BuildResponse(r), nil
}

// InviteGuestsToTeam invite guest by email to some channels in a team.
func (c *Client4) InviteGuestsToTeamGracefully(teamId string, userEmails []string, channels []string, message string) ([]*EmailInviteWithError, *Response, error) {
	guestsInvite := GuestsInvite{
		Emails:   userEmails,
		Channels: channels,
		Message:  message,
	}
	buf, err := json.Marshal(guestsInvite)
	if err != nil {
		return nil, nil, NewAppError("InviteGuestsToTeamGracefully", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetTeamRoute(teamId)+"/invite-guests/email?graceful="+c.boolString(true), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return EmailInviteWithErrorFromJson(r.Body), BuildResponse(r), nil
}

// InvalidateEmailInvites will invalidate active email invitations that have not been accepted by the user.
func (c *Client4) InvalidateEmailInvites() (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetTeamsRoute() + "/invites/email")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetTeamInviteInfo returns a team object from an invite id containing sanitized information.
func (c *Client4) GetTeamInviteInfo(inviteId string) (*Team, *Response, error) {
	r, err := c.DoApiGet(c.GetTeamsRoute()+"/invite/"+inviteId, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamFromJson(r.Body), BuildResponse(r), nil
}

// SetTeamIcon sets team icon of the team.
func (c *Client4) SetTeamIcon(teamId string, data []byte) (bool, *Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", "teamIcon.png")
	if err != nil {
		return false, nil, NewAppError("SetTeamIcon", "model.client.set_team_icon.no_file.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return false, nil, NewAppError("SetTeamIcon", "model.client.set_team_icon.no_file.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if err = writer.Close(); err != nil {
		return false, nil, NewAppError("SetTeamIcon", "model.client.set_team_icon.writer.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	rq, err := http.NewRequest("POST", c.ApiUrl+c.GetTeamRoute(teamId)+"/image", bytes.NewReader(body.Bytes()))
	if err != nil {
		return false, nil, NewAppError("SetTeamIcon", "model.client.connecting.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	rq.Header.Set("Content-Type", writer.FormDataContentType())

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		// set to http.StatusForbidden(403)
		return false, &Response{StatusCode: http.StatusForbidden}, NewAppError(c.GetTeamRoute(teamId)+"/image", "model.client.connecting.app_error", nil, err.Error(), 403)
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return false, BuildResponse(rp), AppErrorFromJson(rp.Body)
	}

	return CheckStatusOK(rp), BuildResponse(rp), nil
}

// GetTeamIcon gets the team icon of the team.
func (c *Client4) GetTeamIcon(teamId, etag string) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetTeamRoute(teamId)+"/image", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetTeamIcon", "model.client.get_team_icon.app_error", nil, err.Error(), r.StatusCode)
	}
	return data, BuildResponse(r), nil
}

// RemoveTeamIcon updates LastTeamIconUpdate to 0 which indicates team icon is removed.
func (c *Client4) RemoveTeamIcon(teamId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetTeamRoute(teamId) + "/image")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// Channel Section

// GetAllChannels get all the channels. Must be a system administrator.
func (c *Client4) GetAllChannels(page int, perPage int, etag string) (*ChannelListWithTeamData, *Response, error) {
	return c.getAllChannels(page, perPage, etag, ChannelSearchOpts{})
}

// GetAllChannelsIncludeDeleted get all the channels. Must be a system administrator.
func (c *Client4) GetAllChannelsIncludeDeleted(page int, perPage int, etag string) (*ChannelListWithTeamData, *Response, error) {
	return c.getAllChannels(page, perPage, etag, ChannelSearchOpts{IncludeDeleted: true})
}

// GetAllChannelsExcludePolicyConstrained gets all channels which are not part of a data retention policy.
// Must be a system administrator.
func (c *Client4) GetAllChannelsExcludePolicyConstrained(page, perPage int, etag string) (*ChannelListWithTeamData, *Response, error) {
	return c.getAllChannels(page, perPage, etag, ChannelSearchOpts{ExcludePolicyConstrained: true})
}

func (c *Client4) getAllChannels(page int, perPage int, etag string, opts ChannelSearchOpts) (*ChannelListWithTeamData, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_deleted=%v&exclude_policy_constrained=%v",
		page, perPage, opts.IncludeDeleted, opts.ExcludePolicyConstrained)
	r, err := c.DoApiGet(c.GetChannelsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelListWithTeamData
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("getAllChannels", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetAllChannelsWithCount get all the channels including the total count. Must be a system administrator.
func (c *Client4) GetAllChannelsWithCount(page int, perPage int, etag string) (*ChannelListWithTeamData, int64, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_total_count="+c.boolString(true), page, perPage)
	r, err := c.DoApiGet(c.GetChannelsRoute()+query, etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)

	var cwc *ChannelsWithCount
	err = json.NewDecoder(r.Body).Decode(&cwc)
	if err != nil {
		return nil, 0, BuildResponse(r), NewAppError("GetAllChannelsWithCount", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return cwc.Channels, cwc.TotalCount, BuildResponse(r), nil
}

// CreateChannel creates a channel based on the provided channel struct.
func (c *Client4) CreateChannel(channel *Channel) (*Channel, *Response, error) {
	r, err := c.DoApiPost(c.GetChannelsRoute(), channel.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("CreateChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// UpdateChannel updates a channel based on the provided channel struct.
func (c *Client4) UpdateChannel(channel *Channel) (*Channel, *Response, error) {
	r, err := c.DoApiPut(c.GetChannelRoute(channel.Id), channel.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("UpdateChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// PatchChannel partially updates a channel. Any missing fields are not updated.
func (c *Client4) PatchChannel(channelId string, patch *ChannelPatch) (*Channel, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetChannelRoute(channelId)+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("PatchChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// ConvertChannelToPrivate converts public to private channel.
func (c *Client4) ConvertChannelToPrivate(channelId string) (*Channel, *Response, error) {
	r, err := c.DoApiPost(c.GetChannelRoute(channelId)+"/convert", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("ConvertChannelToPrivate", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// UpdateChannelPrivacy updates channel privacy
func (c *Client4) UpdateChannelPrivacy(channelId string, privacy ChannelType) (*Channel, *Response, error) {
	requestBody := map[string]string{"privacy": string(privacy)}
	r, err := c.DoApiPut(c.GetChannelRoute(channelId)+"/privacy", MapToJson(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("UpdateChannelPrivacy", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// RestoreChannel restores a previously deleted channel. Any missing fields are not updated.
func (c *Client4) RestoreChannel(channelId string) (*Channel, *Response, error) {
	r, err := c.DoApiPost(c.GetChannelRoute(channelId)+"/restore", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("RestoreChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// CreateDirectChannel creates a direct message channel based on the two user
// ids provided.
func (c *Client4) CreateDirectChannel(userId1, userId2 string) (*Channel, *Response, error) {
	requestBody := []string{userId1, userId2}
	r, err := c.DoApiPost(c.GetChannelsRoute()+"/direct", ArrayToJson(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("CreateDirectChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// CreateGroupChannel creates a group message channel based on userIds provided.
func (c *Client4) CreateGroupChannel(userIds []string) (*Channel, *Response, error) {
	r, err := c.DoApiPost(c.GetChannelsRoute()+"/group", ArrayToJson(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("CreateGroupChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannel returns a channel based on the provided channel id string.
func (c *Client4) GetChannel(channelId, etag string) (*Channel, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelRoute(channelId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelStats returns statistics for a channel.
func (c *Client4) GetChannelStats(channelId string, etag string) (*ChannelStats, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/stats", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ChannelStatsFromJson(r.Body), BuildResponse(r), nil
}

// GetChannelMembersTimezones gets a list of timezones for a channel.
func (c *Client4) GetChannelMembersTimezones(channelId string) ([]string, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/timezones", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJson(r.Body), BuildResponse(r), nil
}

// GetPinnedPosts gets a list of pinned posts.
func (c *Client4) GetPinnedPosts(channelId string, etag string) (*PostList, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/pinned", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostListFromJson(r.Body), BuildResponse(r), nil
}

// GetPrivateChannelsForTeam returns a list of private channels based on the provided team id string.
func (c *Client4) GetPrivateChannelsForTeam(teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	query := fmt.Sprintf("/private?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetChannelsForTeamRoute(teamId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetPrivateChannelsForTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetPublicChannelsForTeam returns a list of public channels based on the provided team id string.
func (c *Client4) GetPublicChannelsForTeam(teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetChannelsForTeamRoute(teamId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetPublicChannelsForTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetDeletedChannelsForTeam returns a list of public channels based on the provided team id string.
func (c *Client4) GetDeletedChannelsForTeam(teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	query := fmt.Sprintf("/deleted?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetChannelsForTeamRoute(teamId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetDeletedChannelsForTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetPublicChannelsByIdsForTeam returns a list of public channels based on provided team id string.
func (c *Client4) GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) ([]*Channel, *Response, error) {
	r, err := c.DoApiPost(c.GetChannelsForTeamRoute(teamId)+"/ids", ArrayToJson(channelIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetPublicChannelsByIdsForTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelsForTeamForUser returns a list channels of on a team for a user.
func (c *Client4) GetChannelsForTeamForUser(teamId, userId string, includeDeleted bool, etag string) ([]*Channel, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelsForTeamForUserRoute(teamId, userId, includeDeleted), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelsForTeamForUser", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelsForTeamAndUserWithLastDeleteAt returns a list channels of a team for a user, additionally filtered with lastDeleteAt. This does not have any effect if includeDeleted is set to false.
func (c *Client4) GetChannelsForTeamAndUserWithLastDeleteAt(teamId, userId string, includeDeleted bool, lastDeleteAt int, etag string) ([]*Channel, *Response, error) {
	route := fmt.Sprintf(c.GetUserRoute(userId) + c.GetTeamRoute(teamId) + "/channels")
	route += fmt.Sprintf("?include_deleted=%v&last_delete_at=%d", includeDeleted, lastDeleteAt)
	r, err := c.DoApiGet(route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelsForTeamAndUserWithLastDeleteAt", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// SearchChannels returns the channels on a team matching the provided search term.
func (c *Client4) SearchChannels(teamId string, search *ChannelSearch) ([]*Channel, *Response, error) {
	r, err := c.DoApiPost(c.GetChannelsForTeamRoute(teamId)+"/search", search.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("SearchChannels", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// SearchArchivedChannels returns the archived channels on a team matching the provided search term.
func (c *Client4) SearchArchivedChannels(teamId string, search *ChannelSearch) ([]*Channel, *Response, error) {
	r, err := c.DoApiPost(c.GetChannelsForTeamRoute(teamId)+"/search_archived", search.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("SearchArchivedChannels", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// SearchAllChannels search in all the channels. Must be a system administrator.
func (c *Client4) SearchAllChannels(search *ChannelSearch) (*ChannelListWithTeamData, *Response, error) {
	r, err := c.DoApiPost(c.GetChannelsRoute()+"/search", search.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelListWithTeamData
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("SearchAllChannels", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// SearchAllChannelsPaged searches all the channels and returns the results paged with the total count.
func (c *Client4) SearchAllChannelsPaged(search *ChannelSearch) (*ChannelsWithCount, *Response, error) {
	r, err := c.DoApiPost(c.GetChannelsRoute()+"/search", search.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cwc *ChannelsWithCount
	err = json.NewDecoder(r.Body).Decode(&cwc)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetAllChannelsWithCount", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return cwc, BuildResponse(r), nil
}

// SearchGroupChannels returns the group channels of the user whose members' usernames match the search term.
func (c *Client4) SearchGroupChannels(search *ChannelSearch) ([]*Channel, *Response, error) {
	r, err := c.DoApiPost(c.GetChannelsRoute()+"/group/search", search.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("SearchGroupChannels", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// DeleteChannel deletes channel based on the provided channel id string.
func (c *Client4) DeleteChannel(channelId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetChannelRoute(channelId))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// PermanentDeleteChannel deletes a channel based on the provided channel id string.
func (c *Client4) PermanentDeleteChannel(channelId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetChannelRoute(channelId) + "?permanent=" + c.boolString(true))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// MoveChannel moves the channel to the destination team.
func (c *Client4) MoveChannel(channelId, teamId string, force bool) (*Channel, *Response, error) {
	requestBody := map[string]interface{}{
		"team_id": teamId,
		"force":   force,
	}
	r, err := c.DoApiPost(c.GetChannelRoute(channelId)+"/move", StringInterfaceToJson(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("MoveChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelByName returns a channel based on the provided channel name and team id strings.
func (c *Client4) GetChannelByName(channelName, teamId string, etag string) (*Channel, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelByNameRoute(channelName, teamId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelByName", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelByNameIncludeDeleted returns a channel based on the provided channel name and team id strings. Other then GetChannelByName it will also return deleted channels.
func (c *Client4) GetChannelByNameIncludeDeleted(channelName, teamId string, etag string) (*Channel, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelByNameRoute(channelName, teamId)+"?include_deleted="+c.boolString(true), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelByNameIncludeDeleted", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelByNameForTeamName returns a channel based on the provided channel name and team name strings.
func (c *Client4) GetChannelByNameForTeamName(channelName, teamName string, etag string) (*Channel, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelByNameForTeamNameRoute(channelName, teamName), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelByNameForTeamName", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelByNameForTeamNameIncludeDeleted returns a channel based on the provided channel name and team name strings. Other then GetChannelByNameForTeamName it will also return deleted channels.
func (c *Client4) GetChannelByNameForTeamNameIncludeDeleted(channelName, teamName string, etag string) (*Channel, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelByNameForTeamNameRoute(channelName, teamName)+"?include_deleted="+c.boolString(true), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelByNameForTeamNameIncludeDeleted", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelMembers gets a page of channel members.
func (c *Client4) GetChannelMembers(channelId string, page, perPage int, etag string) (*ChannelMembers, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetChannelMembersRoute(channelId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelMembers
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelMembers", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelMembersByIds gets the channel members in a channel for a list of user ids.
func (c *Client4) GetChannelMembersByIds(channelId string, userIds []string) (*ChannelMembers, *Response, error) {
	r, err := c.DoApiPost(c.GetChannelMembersRoute(channelId)+"/ids", ArrayToJson(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelMembers
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelMembersByIds", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelMember gets a channel member.
func (c *Client4) GetChannelMember(channelId, userId, etag string) (*ChannelMember, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelMemberRoute(channelId, userId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelMember
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelMember", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelMembersForUser gets all the channel members for a user on a team.
func (c *Client4) GetChannelMembersForUser(userId, teamId, etag string) (*ChannelMembers, *Response, error) {
	r, err := c.DoApiGet(fmt.Sprintf(c.GetUserRoute(userId)+"/teams/%v/channels/members", teamId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelMembers
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelMembersForUser", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// ViewChannel performs a view action for a user. Synonymous with switching channels or marking channels as read by a user.
func (c *Client4) ViewChannel(userId string, view *ChannelView) (*ChannelViewResponse, *Response, error) {
	url := fmt.Sprintf(c.GetChannelsRoute()+"/members/%v/view", userId)
	buf, err := json.Marshal(view)
	if err != nil {
		return nil, nil, NewAppError("ViewChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(url, buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelViewResponse
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("ViewChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelUnread will return a ChannelUnread object that contains the number of
// unread messages and mentions for a user.
func (c *Client4) GetChannelUnread(channelId, userId string) (*ChannelUnread, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(userId)+c.GetChannelRoute(channelId)+"/unread", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelUnread
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelUnread", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// UpdateChannelRoles will update the roles on a channel for a user.
func (c *Client4) UpdateChannelRoles(channelId, userId, roles string) (bool, *Response, error) {
	requestBody := map[string]string{"roles": roles}
	r, err := c.DoApiPut(c.GetChannelMemberRoute(channelId, userId)+"/roles", MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UpdateChannelMemberSchemeRoles will update the scheme-derived roles on a channel for a user.
func (c *Client4) UpdateChannelMemberSchemeRoles(channelId string, userId string, schemeRoles *SchemeRoles) (bool, *Response, error) {
	buf, err := json.Marshal(schemeRoles)
	if err != nil {
		return false, nil, NewAppError("UpdateChannelMemberSchemeRoles", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetChannelMemberRoute(channelId, userId)+"/schemeRoles", buf)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UpdateChannelNotifyProps will update the notification properties on a channel for a user.
func (c *Client4) UpdateChannelNotifyProps(channelId, userId string, props map[string]string) (bool, *Response, error) {
	r, err := c.DoApiPut(c.GetChannelMemberRoute(channelId, userId)+"/notify_props", MapToJson(props))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// AddChannelMember adds user to channel and return a channel member.
func (c *Client4) AddChannelMember(channelId, userId string) (*ChannelMember, *Response, error) {
	requestBody := map[string]string{"user_id": userId}
	r, err := c.DoApiPost(c.GetChannelMembersRoute(channelId)+"", MapToJson(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelMember
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("AddChannelMember", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// AddChannelMemberWithRootId adds user to channel and return a channel member. Post add to channel message has the postRootId.
func (c *Client4) AddChannelMemberWithRootId(channelId, userId, postRootId string) (*ChannelMember, *Response, error) {
	requestBody := map[string]string{"user_id": userId, "post_root_id": postRootId}
	r, err := c.DoApiPost(c.GetChannelMembersRoute(channelId)+"", MapToJson(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelMember
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("AddChannelMemberWithRootId", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// RemoveUserFromChannel will delete the channel member object for a user, effectively removing the user from a channel.
func (c *Client4) RemoveUserFromChannel(channelId, userId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetChannelMemberRoute(channelId, userId))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// AutocompleteChannelsForTeam will return an ordered list of channels autocomplete suggestions.
func (c *Client4) AutocompleteChannelsForTeam(teamId, name string) (*ChannelList, *Response, error) {
	query := fmt.Sprintf("?name=%v", name)
	r, err := c.DoApiGet(c.GetChannelsForTeamRoute(teamId)+"/autocomplete"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelList
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("AutocompleteChannelsForTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// AutocompleteChannelsForTeamForSearch will return an ordered list of your channels autocomplete suggestions.
func (c *Client4) AutocompleteChannelsForTeamForSearch(teamId, name string) (*ChannelList, *Response, error) {
	query := fmt.Sprintf("?name=%v", name)
	r, err := c.DoApiGet(c.GetChannelsForTeamRoute(teamId)+"/search_autocomplete"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelList
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("AutocompleteChannelsForTeamForSearch", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// Post Section

// CreatePost creates a post based on the provided post struct.
func (c *Client4) CreatePost(post *Post) (*Post, *Response, error) {
	r, err := c.DoApiPost(c.GetPostsRoute(), post.ToUnsanitizedJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostFromJson(r.Body), BuildResponse(r), nil
}

// CreatePostEphemeral creates a ephemeral post based on the provided post struct which is send to the given user id.
func (c *Client4) CreatePostEphemeral(post *PostEphemeral) (*Post, *Response, error) {
	r, err := c.DoApiPost(c.GetPostsEphemeralRoute(), post.ToUnsanitizedJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostFromJson(r.Body), BuildResponse(r), nil
}

// UpdatePost updates a post based on the provided post struct.
func (c *Client4) UpdatePost(postId string, post *Post) (*Post, *Response, error) {
	r, err := c.DoApiPut(c.GetPostRoute(postId), post.ToUnsanitizedJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostFromJson(r.Body), BuildResponse(r), nil
}

// PatchPost partially updates a post. Any missing fields are not updated.
func (c *Client4) PatchPost(postId string, patch *PostPatch) (*Post, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchPost", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetPostRoute(postId)+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostFromJson(r.Body), BuildResponse(r), nil
}

// SetPostUnread marks channel where post belongs as unread on the time of the provided post.
func (c *Client4) SetPostUnread(userId string, postId string, collapsedThreadsSupported bool) (*Response, error) {
	b, err := json.Marshal(map[string]bool{"collapsed_threads_supported": collapsedThreadsSupported})
	if err != nil {
		return nil, NewAppError("SetPostUnread", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetUserRoute(userId)+c.GetPostRoute(postId)+"/set_unread", b)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PinPost pin a post based on provided post id string.
func (c *Client4) PinPost(postId string) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetPostRoute(postId)+"/pin", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UnpinPost unpin a post based on provided post id string.
func (c *Client4) UnpinPost(postId string) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetPostRoute(postId)+"/unpin", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetPost gets a single post.
func (c *Client4) GetPost(postId string, etag string) (*Post, *Response, error) {
	r, err := c.DoApiGet(c.GetPostRoute(postId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostFromJson(r.Body), BuildResponse(r), nil
}

// DeletePost deletes a post from the provided post id string.
func (c *Client4) DeletePost(postId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetPostRoute(postId))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetPostThread gets a post with all the other posts in the same thread.
func (c *Client4) GetPostThread(postId string, etag string, collapsedThreads bool) (*PostList, *Response, error) {
	url := c.GetPostRoute(postId) + "/thread"
	if collapsedThreads {
		url += "?collapsedThreads=true"
	}
	r, err := c.DoApiGet(url, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostListFromJson(r.Body), BuildResponse(r), nil
}

// GetPostsForChannel gets a page of posts with an array for ordering for a channel.
func (c *Client4) GetPostsForChannel(channelId string, page, perPage int, etag string, collapsedThreads bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/posts"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostListFromJson(r.Body), BuildResponse(r), nil
}

// GetFlaggedPostsForUser returns flagged posts of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUser(userId string, page int, perPage int) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/posts/flagged"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostListFromJson(r.Body), BuildResponse(r), nil
}

// GetFlaggedPostsForUserInTeam returns flagged posts in team of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUserInTeam(userId string, teamId string, page int, perPage int) (*PostList, *Response, error) {
	if !IsValidId(teamId) {
		return nil, &Response{StatusCode: http.StatusBadRequest}, NewAppError("GetFlaggedPostsForUserInTeam", "model.client.get_flagged_posts_in_team.missing_parameter.app_error", nil, "", http.StatusBadRequest)
	}

	query := fmt.Sprintf("?team_id=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/posts/flagged"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostListFromJson(r.Body), BuildResponse(r), nil
}

// GetFlaggedPostsForUserInChannel returns flagged posts in channel of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUserInChannel(userId string, channelId string, page int, perPage int) (*PostList, *Response, error) {
	if !IsValidId(channelId) {
		return nil, &Response{StatusCode: http.StatusBadRequest}, NewAppError("GetFlaggedPostsForUserInChannel", "model.client.get_flagged_posts_in_channel.missing_parameter.app_error", nil, "", http.StatusBadRequest)
	}

	query := fmt.Sprintf("?channel_id=%v&page=%v&per_page=%v", channelId, page, perPage)
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/posts/flagged"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostListFromJson(r.Body), BuildResponse(r), nil
}

// GetPostsSince gets posts created after a specified time as Unix time in milliseconds.
func (c *Client4) GetPostsSince(channelId string, time int64, collapsedThreads bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?since=%v", time)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/posts"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostListFromJson(r.Body), BuildResponse(r), nil
}

// GetPostsAfter gets a page of posts that were posted after the post provided.
func (c *Client4) GetPostsAfter(channelId, postId string, page, perPage int, etag string, collapsedThreads bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&after=%v", page, perPage, postId)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/posts"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostListFromJson(r.Body), BuildResponse(r), nil
}

// GetPostsBefore gets a page of posts that were posted before the post provided.
func (c *Client4) GetPostsBefore(channelId, postId string, page, perPage int, etag string, collapsedThreads bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&before=%v", page, perPage, postId)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/posts"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostListFromJson(r.Body), BuildResponse(r), nil
}

// GetPostsAroundLastUnread gets a list of posts around last unread post by a user in a channel.
func (c *Client4) GetPostsAroundLastUnread(userId, channelId string, limitBefore, limitAfter int, collapsedThreads bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?limit_before=%v&limit_after=%v", limitBefore, limitAfter)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	r, err := c.DoApiGet(c.GetUserRoute(userId)+c.GetChannelRoute(channelId)+"/posts/unread"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostListFromJson(r.Body), BuildResponse(r), nil
}

// SearchFiles returns any posts with matching terms string.
func (c *Client4) SearchFiles(teamId string, terms string, isOrSearch bool) (*FileInfoList, *Response, error) {
	params := SearchParameter{
		Terms:      &terms,
		IsOrSearch: &isOrSearch,
	}
	return c.SearchFilesWithParams(teamId, &params)
}

// SearchFilesWithParams returns any posts with matching terms string.
func (c *Client4) SearchFilesWithParams(teamId string, params *SearchParameter) (*FileInfoList, *Response, error) {
	r, err := c.DoApiPost(c.GetTeamRoute(teamId)+"/files/search", params.SearchParameterToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return FileInfoListFromJson(r.Body), BuildResponse(r), nil
}

// SearchPosts returns any posts with matching terms string.
func (c *Client4) SearchPosts(teamId string, terms string, isOrSearch bool) (*PostList, *Response, error) {
	params := SearchParameter{
		Terms:      &terms,
		IsOrSearch: &isOrSearch,
	}
	return c.SearchPostsWithParams(teamId, &params)
}

// SearchPostsWithParams returns any posts with matching terms string.
func (c *Client4) SearchPostsWithParams(teamId string, params *SearchParameter) (*PostList, *Response, error) {
	r, err := c.DoApiPost(c.GetTeamRoute(teamId)+"/posts/search", params.SearchParameterToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostListFromJson(r.Body), BuildResponse(r), nil
}

// SearchPostsWithMatches returns any posts with matching terms string, including.
func (c *Client4) SearchPostsWithMatches(teamId string, terms string, isOrSearch bool) (*PostSearchResults, *Response, error) {
	requestBody := map[string]interface{}{"terms": terms, "is_or_search": isOrSearch}
	r, err := c.DoApiPost(c.GetTeamRoute(teamId)+"/posts/search", StringInterfaceToJson(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PostSearchResultsFromJson(r.Body), BuildResponse(r), nil
}

// DoPostAction performs a post action.
func (c *Client4) DoPostAction(postId, actionId string) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetPostRoute(postId)+"/actions/"+actionId, "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// DoPostActionWithCookie performs a post action with extra arguments
func (c *Client4) DoPostActionWithCookie(postId, actionId, selected, cookieStr string) (bool, *Response, error) {
	var body []byte
	if selected != "" || cookieStr != "" {
		body, _ = json.Marshal(DoPostActionRequest{
			SelectedOption: selected,
			Cookie:         cookieStr,
		})
	}
	r, err := c.DoApiPost(c.GetPostRoute(postId)+"/actions/"+actionId, string(body))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// OpenInteractiveDialog sends a WebSocket event to a user's clients to
// open interactive dialogs, based on the provided trigger ID and other
// provided data. Used with interactive message buttons, menus and
// slash commands.
func (c *Client4) OpenInteractiveDialog(request OpenDialogRequest) (bool, *Response, error) {
	b, _ := json.Marshal(request)
	r, err := c.DoApiPost("/actions/dialogs/open", string(b))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// SubmitInteractiveDialog will submit the provided dialog data to the integration
// configured by the URL. Used with the interactive dialogs integration feature.
func (c *Client4) SubmitInteractiveDialog(request SubmitDialogRequest) (*SubmitDialogResponse, *Response, error) {
	b, _ := json.Marshal(request)
	r, err := c.DoApiPost("/actions/dialogs/submit", string(b))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var resp SubmitDialogResponse
	json.NewDecoder(r.Body).Decode(&resp)
	return &resp, BuildResponse(r), nil
}

// UploadFile will upload a file to a channel using a multipart request, to be later attached to a post.
// This method is functionally equivalent to Client4.UploadFileAsRequestBody.
func (c *Client4) UploadFile(data []byte, channelId string, filename string) (*FileUploadResponse, *Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormField("channel_id")
	if err != nil {
		return nil, nil, nil
	}

	_, err = io.Copy(part, strings.NewReader(channelId))
	if err != nil {
		return nil, nil, nil
	}

	part, err = writer.CreateFormFile("files", filename)
	if err != nil {
		return nil, nil, nil
	}
	_, err = io.Copy(part, bytes.NewBuffer(data))
	if err != nil {
		return nil, nil, nil
	}

	err = writer.Close()
	if err != nil {
		return nil, nil, nil
	}

	return c.DoUploadFile(c.GetFilesRoute(), body.Bytes(), writer.FormDataContentType())
}

// UploadFileAsRequestBody will upload a file to a channel as the body of a request, to be later attached
// to a post. This method is functionally equivalent to Client4.UploadFile.
func (c *Client4) UploadFileAsRequestBody(data []byte, channelId string, filename string) (*FileUploadResponse, *Response, error) {
	return c.DoUploadFile(c.GetFilesRoute()+fmt.Sprintf("?channel_id=%v&filename=%v", url.QueryEscape(channelId), url.QueryEscape(filename)), data, http.DetectContentType(data))
}

// GetFile gets the bytes for a file by id.
func (c *Client4) GetFile(fileId string) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetFileRoute(fileId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetFile", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)
	}
	return data, BuildResponse(r), nil
}

// DownloadFile gets the bytes for a file by id, optionally adding headers to force the browser to download it.
func (c *Client4) DownloadFile(fileId string, download bool) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetFileRoute(fileId)+fmt.Sprintf("?download=%v", download), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("DownloadFile", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)
	}
	return data, BuildResponse(r), nil
}

// GetFileThumbnail gets the bytes for a file by id.
func (c *Client4) GetFileThumbnail(fileId string) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/thumbnail", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetFileThumbnail", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)
	}
	return data, BuildResponse(r), nil
}

// DownloadFileThumbnail gets the bytes for a file by id, optionally adding headers to force the browser to download it.
func (c *Client4) DownloadFileThumbnail(fileId string, download bool) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetFileRoute(fileId)+fmt.Sprintf("/thumbnail?download=%v", download), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("DownloadFileThumbnail", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)
	}
	return data, BuildResponse(r), nil
}

// GetFileLink gets the public link of a file by id.
func (c *Client4) GetFileLink(fileId string) (string, *Response, error) {
	r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/link", "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body)["link"], BuildResponse(r), nil
}

// GetFilePreview gets the bytes for a file by id.
func (c *Client4) GetFilePreview(fileId string) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/preview", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetFilePreview", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)
	}
	return data, BuildResponse(r), nil
}

// DownloadFilePreview gets the bytes for a file by id.
func (c *Client4) DownloadFilePreview(fileId string, download bool) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetFileRoute(fileId)+fmt.Sprintf("/preview?download=%v", download), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("DownloadFilePreview", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)
	}
	return data, BuildResponse(r), nil
}

// GetFileInfo gets all the file info objects.
func (c *Client4) GetFileInfo(fileId string) (*FileInfo, *Response, error) {
	r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/info", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return FileInfoFromJson(r.Body), BuildResponse(r), nil
}

// GetFileInfosForPost gets all the file info objects attached to a post.
func (c *Client4) GetFileInfosForPost(postId string, etag string) ([]*FileInfo, *Response, error) {
	r, err := c.DoApiGet(c.GetPostRoute(postId)+"/files/info", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return FileInfosFromJson(r.Body), BuildResponse(r), nil
}

// General/System Section

// GenerateSupportPacket downloads the generated support packet
func (c *Client4) GenerateSupportPacket() ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetSystemRoute()+"/support_packet", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetFile", "model.client.read_job_result_file.app_error", nil, err.Error(), r.StatusCode)
	}
	return data, BuildResponse(r), nil
}

// GetPing will return ok if the running goRoutines are below the threshold and unhealthy for above.
func (c *Client4) GetPing() (string, *Response, error) {
	r, err := c.DoApiGet(c.GetSystemRoute()+"/ping", "")
	if r != nil && r.StatusCode == 500 {
		defer r.Body.Close()
		return StatusUnhealthy, BuildResponse(r), err
	}
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body)["status"], BuildResponse(r), nil
}

// GetPingWithServerStatus will return ok if several basic server health checks
// all pass successfully.
func (c *Client4) GetPingWithServerStatus() (string, *Response, error) {
	r, err := c.DoApiGet(c.GetSystemRoute()+"/ping?get_server_status="+c.boolString(true), "")
	if r != nil && r.StatusCode == 500 {
		defer r.Body.Close()
		return StatusUnhealthy, BuildResponse(r), err
	}
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body)["status"], BuildResponse(r), nil
}

// GetPingWithFullServerStatus will return the full status if several basic server
// health checks all pass successfully.
func (c *Client4) GetPingWithFullServerStatus() (map[string]string, *Response, error) {
	r, err := c.DoApiGet(c.GetSystemRoute()+"/ping?get_server_status="+c.boolString(true), "")
	if r != nil && r.StatusCode == 500 {
		defer r.Body.Close()
		return map[string]string{"status": StatusUnhealthy}, BuildResponse(r), err
	}
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body), BuildResponse(r), nil
}

// TestEmail will attempt to connect to the configured SMTP server.
func (c *Client4) TestEmail(config *Config) (bool, *Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return false, nil, NewAppError("TestEmail", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetTestEmailRoute(), buf)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// TestSiteURL will test the validity of a site URL.
func (c *Client4) TestSiteURL(siteURL string) (bool, *Response, error) {
	requestBody := make(map[string]string)
	requestBody["site_url"] = siteURL
	r, err := c.DoApiPost(c.GetTestSiteURLRoute(), MapToJson(requestBody))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// TestS3Connection will attempt to connect to the AWS S3.
func (c *Client4) TestS3Connection(config *Config) (bool, *Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return false, nil, NewAppError("TestS3Connection", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetTestS3Route(), buf)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetConfig will retrieve the server config with some sanitized items.
func (c *Client4) GetConfig() (*Config, *Response, error) {
	r, err := c.DoApiGet(c.GetConfigRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ConfigFromJson(r.Body), BuildResponse(r), nil
}

// ReloadConfig will reload the server configuration.
func (c *Client4) ReloadConfig() (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetConfigRoute()+"/reload", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetOldClientConfig will retrieve the parts of the server configuration needed by the
// client, formatted in the old format.
func (c *Client4) GetOldClientConfig(etag string) (map[string]string, *Response, error) {
	r, err := c.DoApiGet(c.GetConfigRoute()+"/client?format=old", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body), BuildResponse(r), nil
}

// GetEnvironmentConfig will retrieve a map mirroring the server configuration where fields
// are set to true if the corresponding config setting is set through an environment variable.
// Settings that haven't been set through environment variables will be missing from the map.
func (c *Client4) GetEnvironmentConfig() (map[string]interface{}, *Response, error) {
	r, err := c.DoApiGet(c.GetConfigRoute()+"/environment", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return StringInterfaceFromJson(r.Body), BuildResponse(r), nil
}

// GetOldClientLicense will retrieve the parts of the server license needed by the
// client, formatted in the old format.
func (c *Client4) GetOldClientLicense(etag string) (map[string]string, *Response, error) {
	r, err := c.DoApiGet(c.GetLicenseRoute()+"/client?format=old", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body), BuildResponse(r), nil
}

// DatabaseRecycle will recycle the connections. Discard current connection and get new one.
func (c *Client4) DatabaseRecycle() (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetDatabaseRoute()+"/recycle", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// InvalidateCaches will purge the cache and can affect the performance while is cleaning.
func (c *Client4) InvalidateCaches() (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetCacheRoute()+"/invalidate", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UpdateConfig will update the server configuration.
func (c *Client4) UpdateConfig(config *Config) (*Config, *Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return nil, nil, NewAppError("UpdateConfig", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetConfigRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ConfigFromJson(r.Body), BuildResponse(r), nil
}

// MigrateConfig will migrate existing config to the new one.
func (c *Client4) MigrateConfig(from, to string) (bool, *Response, error) {
	m := make(map[string]string, 2)
	m["from"] = from
	m["to"] = to
	r, err := c.DoApiPost(c.GetConfigRoute()+"/migrate", MapToJson(m))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return true, BuildResponse(r), nil
}

// UploadLicenseFile will add a license file to the system.
func (c *Client4) UploadLicenseFile(data []byte) (bool, *Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("license", "test-license.mattermost-license")
	if err != nil {
		return false, nil, NewAppError("UploadLicenseFile", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return false, nil, NewAppError("UploadLicenseFile", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if err = writer.Close(); err != nil {
		return false, nil, NewAppError("UploadLicenseFile", "model.client.set_profile_user.writer.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	rq, err := http.NewRequest("POST", c.ApiUrl+c.GetLicenseRoute(), bytes.NewReader(body.Bytes()))
	if err != nil {
		return false, nil, NewAppError("UploadLicenseFile", "model.client.connecting.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	rq.Header.Set("Content-Type", writer.FormDataContentType())

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return false, &Response{StatusCode: http.StatusForbidden}, NewAppError(c.GetLicenseRoute(), "model.client.connecting.app_error", nil, err.Error(), http.StatusForbidden)
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return false, BuildResponse(rp), AppErrorFromJson(rp.Body)
	}

	return CheckStatusOK(rp), BuildResponse(rp), nil
}

// RemoveLicenseFile will remove the server license it exists. Note that this will
// disable all enterprise features.
func (c *Client4) RemoveLicenseFile() (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetLicenseRoute())
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetAnalyticsOld will retrieve analytics using the old format. New format is not
// available but the "/analytics" endpoint is reserved for it. The "name" argument is optional
// and defaults to "standard". The "teamId" argument is optional and will limit results
// to a specific team.
func (c *Client4) GetAnalyticsOld(name, teamId string) (AnalyticsRows, *Response, error) {
	query := fmt.Sprintf("?name=%v&team_id=%v", name, teamId)
	r, err := c.DoApiGet(c.GetAnalyticsRoute()+"/old"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var rows AnalyticsRows
	err = json.NewDecoder(r.Body).Decode(&rows)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetAnalyticsOld", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return rows, BuildResponse(r), nil
}

// Webhooks Section

// CreateIncomingWebhook creates an incoming webhook for a channel.
func (c *Client4) CreateIncomingWebhook(hook *IncomingWebhook) (*IncomingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("CreateIncomingWebhook", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetIncomingWebhooksRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return IncomingWebhookFromJson(r.Body), BuildResponse(r), nil
}

// UpdateIncomingWebhook updates an incoming webhook for a channel.
func (c *Client4) UpdateIncomingWebhook(hook *IncomingWebhook) (*IncomingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("UpdateIncomingWebhook", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetIncomingWebhookRoute(hook.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return IncomingWebhookFromJson(r.Body), BuildResponse(r), nil
}

// GetIncomingWebhooks returns a page of incoming webhooks on the system. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooks(page int, perPage int, etag string) ([]*IncomingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetIncomingWebhooksRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return IncomingWebhookListFromJson(r.Body), BuildResponse(r), nil
}

// GetIncomingWebhooksForTeam returns a page of incoming webhooks for a team. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooksForTeam(teamId string, page int, perPage int, etag string) ([]*IncomingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&team_id=%v", page, perPage, teamId)
	r, err := c.DoApiGet(c.GetIncomingWebhooksRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return IncomingWebhookListFromJson(r.Body), BuildResponse(r), nil
}

// GetIncomingWebhook returns an Incoming webhook given the hook ID.
func (c *Client4) GetIncomingWebhook(hookID string, etag string) (*IncomingWebhook, *Response, error) {
	r, err := c.DoApiGet(c.GetIncomingWebhookRoute(hookID), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return IncomingWebhookFromJson(r.Body), BuildResponse(r), nil
}

// DeleteIncomingWebhook deletes and Incoming Webhook given the hook ID.
func (c *Client4) DeleteIncomingWebhook(hookID string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetIncomingWebhookRoute(hookID))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// CreateOutgoingWebhook creates an outgoing webhook for a team or channel.
func (c *Client4) CreateOutgoingWebhook(hook *OutgoingWebhook) (*OutgoingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("CreateOutgoingWebhook", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetOutgoingWebhooksRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OutgoingWebhookFromJson(r.Body), BuildResponse(r), nil
}

// UpdateOutgoingWebhook creates an outgoing webhook for a team or channel.
func (c *Client4) UpdateOutgoingWebhook(hook *OutgoingWebhook) (*OutgoingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("UpdateOutgoingWebhook", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetOutgoingWebhookRoute(hook.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OutgoingWebhookFromJson(r.Body), BuildResponse(r), nil
}

// GetOutgoingWebhooks returns a page of outgoing webhooks on the system. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooks(page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetOutgoingWebhooksRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OutgoingWebhookListFromJson(r.Body), BuildResponse(r), nil
}

// GetOutgoingWebhook outgoing webhooks on the system requested by Hook Id.
func (c *Client4) GetOutgoingWebhook(hookId string) (*OutgoingWebhook, *Response, error) {
	r, err := c.DoApiGet(c.GetOutgoingWebhookRoute(hookId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OutgoingWebhookFromJson(r.Body), BuildResponse(r), nil
}

// GetOutgoingWebhooksForChannel returns a page of outgoing webhooks for a channel. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooksForChannel(channelId string, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&channel_id=%v", page, perPage, channelId)
	r, err := c.DoApiGet(c.GetOutgoingWebhooksRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OutgoingWebhookListFromJson(r.Body), BuildResponse(r), nil
}

// GetOutgoingWebhooksForTeam returns a page of outgoing webhooks for a team. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooksForTeam(teamId string, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&team_id=%v", page, perPage, teamId)
	r, err := c.DoApiGet(c.GetOutgoingWebhooksRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OutgoingWebhookListFromJson(r.Body), BuildResponse(r), nil
}

// RegenOutgoingHookToken regenerate the outgoing webhook token.
func (c *Client4) RegenOutgoingHookToken(hookId string) (*OutgoingWebhook, *Response, error) {
	r, err := c.DoApiPost(c.GetOutgoingWebhookRoute(hookId)+"/regen_token", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OutgoingWebhookFromJson(r.Body), BuildResponse(r), nil
}

// DeleteOutgoingWebhook delete the outgoing webhook on the system requested by Hook Id.
func (c *Client4) DeleteOutgoingWebhook(hookId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetOutgoingWebhookRoute(hookId))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// Preferences Section

// GetPreferences returns the user's preferences.
func (c *Client4) GetPreferences(userId string) (Preferences, *Response, error) {
	r, err := c.DoApiGet(c.GetPreferencesRoute(userId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	preferences, _ := PreferencesFromJson(r.Body)
	return preferences, BuildResponse(r), nil
}

// UpdatePreferences saves the user's preferences.
func (c *Client4) UpdatePreferences(userId string, preferences *Preferences) (bool, *Response, error) {
	buf, err := json.Marshal(preferences)
	if err != nil {
		return false, nil, NewAppError("UpdatePreferences", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetPreferencesRoute(userId), buf)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return true, BuildResponse(r), nil
}

// DeletePreferences deletes the user's preferences.
func (c *Client4) DeletePreferences(userId string, preferences *Preferences) (bool, *Response, error) {
	buf, err := json.Marshal(preferences)
	if err != nil {
		return false, nil, NewAppError("DeletePreferences", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetPreferencesRoute(userId)+"/delete", buf)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return true, BuildResponse(r), nil
}

// GetPreferencesByCategory returns the user's preferences from the provided category string.
func (c *Client4) GetPreferencesByCategory(userId string, category string) (Preferences, *Response, error) {
	url := fmt.Sprintf(c.GetPreferencesRoute(userId)+"/%s", category)
	r, err := c.DoApiGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	preferences, _ := PreferencesFromJson(r.Body)
	return preferences, BuildResponse(r), nil
}

// GetPreferenceByCategoryAndName returns the user's preferences from the provided category and preference name string.
func (c *Client4) GetPreferenceByCategoryAndName(userId string, category string, preferenceName string) (*Preference, *Response, error) {
	url := fmt.Sprintf(c.GetPreferencesRoute(userId)+"/%s/name/%v", category, preferenceName)
	r, err := c.DoApiGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PreferenceFromJson(r.Body), BuildResponse(r), nil
}

// SAML Section

// GetSamlMetadata returns metadata for the SAML configuration.
func (c *Client4) GetSamlMetadata() (string, *Response, error) {
	r, err := c.DoApiGet(c.GetSamlRoute()+"/metadata", "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	buf := new(bytes.Buffer)
	_, _ = buf.ReadFrom(r.Body)
	return buf.String(), BuildResponse(r), nil
}

func fileToMultipart(data []byte, filename string) ([]byte, *multipart.Writer, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("certificate", filename)
	if err != nil {
		return nil, nil, err
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, nil, err
	}

	if err := writer.Close(); err != nil {
		return nil, nil, err
	}

	return body.Bytes(), writer, nil
}

// UploadSamlIdpCertificate will upload an IDP certificate for SAML and set the config to use it.
// The filename parameter is deprecated and ignored: the server will pick a hard-coded filename when writing to disk.
func (c *Client4) UploadSamlIdpCertificate(data []byte, filename string) (bool, *Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return false, nil, NewAppError("UploadSamlIdpCertificate", "model.client.upload_saml_cert.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	_, resp, err := c.DoUploadFile(c.GetSamlRoute()+"/certificate/idp", body, writer.FormDataContentType())
	return true, resp, err //TODO
}

// UploadSamlPublicCertificate will upload a public certificate for SAML and set the config to use it.
// The filename parameter is deprecated and ignored: the server will pick a hard-coded filename when writing to disk.
func (c *Client4) UploadSamlPublicCertificate(data []byte, filename string) (bool, *Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return false, nil, NewAppError("UploadSamlPublicCertificate", "model.client.upload_saml_cert.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	_, resp, err := c.DoUploadFile(c.GetSamlRoute()+"/certificate/public", body, writer.FormDataContentType())
	return true, resp, err //TODO
}

// UploadSamlPrivateCertificate will upload a private key for SAML and set the config to use it.
// The filename parameter is deprecated and ignored: the server will pick a hard-coded filename when writing to disk.
func (c *Client4) UploadSamlPrivateCertificate(data []byte, filename string) (bool, *Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return false, nil, NewAppError("UploadSamlPrivateCertificate", "model.client.upload_saml_cert.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	_, resp, err := c.DoUploadFile(c.GetSamlRoute()+"/certificate/private", body, writer.FormDataContentType())
	return true, resp, err //TODO
}

// DeleteSamlIdpCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlIdpCertificate() (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetSamlRoute() + "/certificate/idp")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// DeleteSamlPublicCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlPublicCertificate() (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetSamlRoute() + "/certificate/public")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// DeleteSamlPrivateCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlPrivateCertificate() (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetSamlRoute() + "/certificate/private")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetSamlCertificateStatus returns metadata for the SAML configuration.
func (c *Client4) GetSamlCertificateStatus() (*SamlCertificateStatus, *Response, error) {
	r, err := c.DoApiGet(c.GetSamlRoute()+"/certificate/status", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return SamlCertificateStatusFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) GetSamlMetadataFromIdp(samlMetadataURL string) (*SamlMetadataResponse, *Response, error) {
	requestBody := make(map[string]string)
	requestBody["saml_metadata_url"] = samlMetadataURL
	r, err := c.DoApiPost(c.GetSamlRoute()+"/metadatafromidp", MapToJson(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	return SamlMetadataResponseFromJson(r.Body), BuildResponse(r), nil
}

// ResetSamlAuthDataToEmail resets the AuthData field of SAML users to their Email.
func (c *Client4) ResetSamlAuthDataToEmail(includeDeleted bool, dryRun bool, userIDs []string) (int64, *Response, error) {
	params := map[string]interface{}{
		"include_deleted": includeDeleted,
		"dry_run":         dryRun,
		"user_ids":        userIDs,
	}
	b, _ := json.Marshal(params)
	r, err := c.doApiPostBytes(c.GetSamlRoute()+"/reset_auth_data", b)
	if err != nil {
		return 0, BuildResponse(r), err
	}
	defer closeBody(r)
	respBody := map[string]int64{}
	err = json.NewDecoder(r.Body).Decode(&respBody)
	if err != nil {
		return 0, BuildResponse(r), NewAppError("Api4.ResetSamlAuthDataToEmail", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return respBody["num_affected"], BuildResponse(r), nil
}

// Compliance Section

// CreateComplianceReport creates an incoming webhook for a channel.
func (c *Client4) CreateComplianceReport(report *Compliance) (*Compliance, *Response, error) {
	buf, err := json.Marshal(report)
	if err != nil {
		return nil, nil, NewAppError("CreateComplianceReport", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetComplianceReportsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ComplianceFromJson(r.Body), BuildResponse(r), nil
}

// GetComplianceReports returns list of compliance reports.
func (c *Client4) GetComplianceReports(page, perPage int) (Compliances, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetComplianceReportsRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return CompliancesFromJson(r.Body), BuildResponse(r), nil
}

// GetComplianceReport returns a compliance report.
func (c *Client4) GetComplianceReport(reportId string) (*Compliance, *Response, error) {
	r, err := c.DoApiGet(c.GetComplianceReportRoute(reportId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ComplianceFromJson(r.Body), BuildResponse(r), nil
}

// DownloadComplianceReport returns a full compliance report as a file.
func (c *Client4) DownloadComplianceReport(reportId string) ([]byte, *Response, error) {
	rq, err := http.NewRequest("GET", c.ApiUrl+c.GetComplianceReportDownloadRoute(reportId), nil)
	if err != nil {
		return nil, nil, nil
	}

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, "BEARER "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return nil, nil, nil
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJson(rp.Body)
	}

	data, err := ioutil.ReadAll(rp.Body)
	if err != nil {
		return nil, BuildResponse(rp), NewAppError("DownloadComplianceReport", "model.client.read_file.app_error", nil, err.Error(), rp.StatusCode)
	}

	return data, BuildResponse(rp), nil
}

// Cluster Section

// GetClusterStatus returns the status of all the configured cluster nodes.
func (c *Client4) GetClusterStatus() ([]*ClusterInfo, *Response, error) {
	r, err := c.DoApiGet(c.GetClusterRoute()+"/status", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ClusterInfosFromJson(r.Body), BuildResponse(r), nil
}

// LDAP Section

// SyncLdap will force a sync with the configured LDAP server.
// If includeRemovedMembers is true, then group members who left or were removed from a
// synced team/channel will be re-joined; otherwise, they will be excluded.
func (c *Client4) SyncLdap(includeRemovedMembers bool) (bool, *Response, error) {
	reqBody, _ := json.Marshal(map[string]interface{}{
		"include_removed_members": includeRemovedMembers,
	})
	r, err := c.doApiPostBytes(c.GetLdapRoute()+"/sync", reqBody)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// TestLdap will attempt to connect to the configured LDAP server and return OK if configured
// correctly.
func (c *Client4) TestLdap() (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetLdapRoute()+"/test", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetLdapGroups retrieves the immediate child groups of the given parent group.
func (c *Client4) GetLdapGroups() ([]*Group, *Response, error) {
	path := fmt.Sprintf("%s/groups", c.GetLdapRoute())

	r, err := c.DoApiGet(path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData := struct {
		Count  int      `json:"count"`
		Groups []*Group `json:"groups"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&responseData); err != nil {
		return nil, BuildResponse(r), NewAppError("Api4.GetLdapGroups", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	for i := range responseData.Groups {
		responseData.Groups[i].DisplayName = *responseData.Groups[i].Name
	}

	return responseData.Groups, BuildResponse(r), nil
}

// LinkLdapGroup creates or undeletes a Mattermost group and associates it to the given LDAP group DN.
func (c *Client4) LinkLdapGroup(dn string) (*Group, *Response, error) {
	path := fmt.Sprintf("%s/groups/%s/link", c.GetLdapRoute(), dn)

	r, err := c.DoApiPost(path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	return GroupFromJson(r.Body), BuildResponse(r), nil
}

// UnlinkLdapGroup deletes the Mattermost group associated with the given LDAP group DN.
func (c *Client4) UnlinkLdapGroup(dn string) (*Group, *Response, error) {
	path := fmt.Sprintf("%s/groups/%s/link", c.GetLdapRoute(), dn)

	r, err := c.DoApiDelete(path)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	return GroupFromJson(r.Body), BuildResponse(r), nil
}

// MigrateIdLdap migrates the LDAP enabled users to given attribute
func (c *Client4) MigrateIdLdap(toAttribute string) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetLdapRoute()+"/migrateid", MapToJson(map[string]string{
		"toAttribute": toAttribute,
	}))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetGroupsByChannel retrieves the Mattermost Groups associated with a given channel
func (c *Client4) GetGroupsByChannel(channelId string, opts GroupSearchOpts) ([]*GroupWithSchemeAdmin, int, *Response, error) {
	path := fmt.Sprintf("%s/groups?q=%v&include_member_count=%v&filter_allow_reference=%v", c.GetChannelRoute(channelId), opts.Q, opts.IncludeMemberCount, opts.FilterAllowReference)
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoApiGet(path, "")
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData := struct {
		Groups []*GroupWithSchemeAdmin `json:"groups"`
		Count  int                     `json:"total_group_count"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&responseData); err != nil {
		return nil, 0, BuildResponse(r), NewAppError("Api4.GetGroupsByChannel", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return responseData.Groups, responseData.Count, BuildResponse(r), nil
}

// GetGroupsByTeam retrieves the Mattermost Groups associated with a given team
func (c *Client4) GetGroupsByTeam(teamId string, opts GroupSearchOpts) ([]*GroupWithSchemeAdmin, int, *Response, error) {
	path := fmt.Sprintf("%s/groups?q=%v&include_member_count=%v&filter_allow_reference=%v", c.GetTeamRoute(teamId), opts.Q, opts.IncludeMemberCount, opts.FilterAllowReference)
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoApiGet(path, "")
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData := struct {
		Groups []*GroupWithSchemeAdmin `json:"groups"`
		Count  int                     `json:"total_group_count"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&responseData); err != nil {
		return nil, 0, BuildResponse(r), NewAppError("Api4.GetGroupsByTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return responseData.Groups, responseData.Count, BuildResponse(r), nil
}

// GetGroupsAssociatedToChannelsByTeam retrieves the Mattermost Groups associated with channels in a given team
func (c *Client4) GetGroupsAssociatedToChannelsByTeam(teamId string, opts GroupSearchOpts) (map[string][]*GroupWithSchemeAdmin, *Response, error) {
	path := fmt.Sprintf("%s/groups_by_channels?q=%v&filter_allow_reference=%v", c.GetTeamRoute(teamId), opts.Q, opts.FilterAllowReference)
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoApiGet(path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData := struct {
		GroupsAssociatedToChannels map[string][]*GroupWithSchemeAdmin `json:"groups"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&responseData); err != nil {
		return nil, BuildResponse(r), NewAppError("Api4.GetGroupsAssociatedToChannelsByTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return responseData.GroupsAssociatedToChannels, BuildResponse(r), nil
}

// GetGroups retrieves Mattermost Groups
func (c *Client4) GetGroups(opts GroupSearchOpts) ([]*Group, *Response, error) {
	path := fmt.Sprintf(
		"%s?include_member_count=%v&not_associated_to_team=%v&not_associated_to_channel=%v&filter_allow_reference=%v&q=%v&filter_parent_team_permitted=%v",
		c.GetGroupsRoute(),
		opts.IncludeMemberCount,
		opts.NotAssociatedToTeam,
		opts.NotAssociatedToChannel,
		opts.FilterAllowReference,
		opts.Q,
		opts.FilterParentTeamPermitted,
	)
	if opts.Since > 0 {
		path = fmt.Sprintf("%s&since=%v", path, opts.Since)
	}
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoApiGet(path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	return GroupsFromJson(r.Body), BuildResponse(r), nil
}

// GetGroupsByUserId retrieves Mattermost Groups for a user
func (c *Client4) GetGroupsByUserId(userId string) ([]*Group, *Response, error) {
	path := fmt.Sprintf(
		"%s/%v/groups",
		c.GetUsersRoute(),
		userId,
	)

	r, err := c.DoApiGet(path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return GroupsFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) MigrateAuthToLdap(fromAuthService string, matchField string, force bool) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetUsersRoute()+"/migrate_auth/ldap", StringInterfaceToJson(map[string]interface{}{
		"from":        fromAuthService,
		"force":       force,
		"match_field": matchField,
	}))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

func (c *Client4) MigrateAuthToSaml(fromAuthService string, usersMap map[string]string, auto bool) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetUsersRoute()+"/migrate_auth/saml", StringInterfaceToJson(map[string]interface{}{
		"from":    fromAuthService,
		"auto":    auto,
		"matches": usersMap,
	}))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UploadLdapPublicCertificate will upload a public certificate for LDAP and set the config to use it.
func (c *Client4) UploadLdapPublicCertificate(data []byte) (bool, *Response, error) {
	body, writer, err := fileToMultipart(data, LdapPublicCertificateName)
	if err != nil {
		return false, nil, NewAppError("UploadLdapPublicCertificate", "model.client.upload_ldap_cert.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	_, resp, err := c.DoUploadFile(c.GetLdapRoute()+"/certificate/public", body, writer.FormDataContentType())
	return true, resp, err //TODO
}

// UploadLdapPrivateCertificate will upload a private key for LDAP and set the config to use it.
func (c *Client4) UploadLdapPrivateCertificate(data []byte) (bool, *Response, error) {
	body, writer, err := fileToMultipart(data, LdapPrivateKeyName)
	if err != nil {
		return false, nil, NewAppError("UploadLdapPrivateCertificate", "model.client.upload_Ldap_cert.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	_, resp, err := c.DoUploadFile(c.GetLdapRoute()+"/certificate/private", body, writer.FormDataContentType())
	return true, resp, err //TODO
}

// DeleteLdapPublicCertificate deletes the LDAP IDP certificate from the server and updates the config to not use it and disable LDAP.
func (c *Client4) DeleteLdapPublicCertificate() (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetLdapRoute() + "/certificate/public")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// DeleteLDAPPrivateCertificate deletes the LDAP IDP certificate from the server and updates the config to not use it and disable LDAP.
func (c *Client4) DeleteLdapPrivateCertificate() (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetLdapRoute() + "/certificate/private")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// Audits Section

// GetAudits returns a list of audits for the whole system.
func (c *Client4) GetAudits(page int, perPage int, etag string) (Audits, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet("/audits"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var audits Audits
	err = json.NewDecoder(r.Body).Decode(&audits)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetAudits", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return audits, BuildResponse(r), nil
}

// Brand Section

// GetBrandImage retrieves the previously uploaded brand image.
func (c *Client4) GetBrandImage() ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetBrandRoute()+"/image", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	if r.StatusCode >= 300 {
		return nil, BuildResponse(r), AppErrorFromJson(r.Body)
	}

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBrandImage", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)
	}

	return data, BuildResponse(r), nil
}

// DeleteBrandImage deletes the brand image for the system.
func (c *Client4) DeleteBrandImage() (*Response, error) {
	r, err := c.DoApiDelete(c.GetBrandRoute() + "/image")
	if err != nil {
		return BuildResponse(r), err
	}
	return BuildResponse(r), nil
}

// UploadBrandImage sets the brand image for the system.
func (c *Client4) UploadBrandImage(data []byte) (bool, *Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", "brand.png")
	if err != nil {
		return false, nil, NewAppError("UploadBrandImage", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return false, nil, NewAppError("UploadBrandImage", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if err = writer.Close(); err != nil {
		return false, nil, NewAppError("UploadBrandImage", "model.client.set_profile_user.writer.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	rq, err := http.NewRequest("POST", c.ApiUrl+c.GetBrandRoute()+"/image", bytes.NewReader(body.Bytes()))
	if err != nil {
		return false, nil, NewAppError("UploadBrandImage", "model.client.connecting.app_error", nil, err.Error(), http.StatusBadRequest)
	}
	rq.Header.Set("Content-Type", writer.FormDataContentType())

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return false, &Response{StatusCode: http.StatusForbidden}, NewAppError(c.GetBrandRoute()+"/image", "model.client.connecting.app_error", nil, err.Error(), http.StatusForbidden)
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return false, BuildResponse(rp), AppErrorFromJson(rp.Body)
	}

	return CheckStatusOK(rp), BuildResponse(rp), nil
}

// Logs Section

// GetLogs page of logs as a string array.
func (c *Client4) GetLogs(page, perPage int) ([]string, *Response, error) {
	query := fmt.Sprintf("?page=%v&logs_per_page=%v", page, perPage)
	r, err := c.DoApiGet("/logs"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJson(r.Body), BuildResponse(r), nil
}

// PostLog is a convenience Web Service call so clients can log messages into
// the server-side logs. For example we typically log javascript error messages
// into the server-side. It returns the log message if the logging was successful.
func (c *Client4) PostLog(message map[string]string) (map[string]string, *Response, error) {
	r, err := c.DoApiPost("/logs", MapToJson(message))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body), BuildResponse(r), nil
}

// OAuth Section

// CreateOAuthApp will register a new OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) CreateOAuthApp(app *OAuthApp) (*OAuthApp, *Response, error) {
	buf, err := json.Marshal(app)
	if err != nil {
		return nil, nil, NewAppError("CreateOAuthApp", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetOAuthAppsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OAuthAppFromJson(r.Body), BuildResponse(r), nil
}

// UpdateOAuthApp updates a page of registered OAuth 2.0 client applications with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) UpdateOAuthApp(app *OAuthApp) (*OAuthApp, *Response, error) {
	buf, err := json.Marshal(app)
	if err != nil {
		return nil, nil, NewAppError("UpdateOAuthApp", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetOAuthAppRoute(app.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OAuthAppFromJson(r.Body), BuildResponse(r), nil
}

// GetOAuthApps gets a page of registered OAuth 2.0 client applications with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthApps(page, perPage int) ([]*OAuthApp, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetOAuthAppsRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OAuthAppListFromJson(r.Body), BuildResponse(r), nil
}

// GetOAuthApp gets a registered OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthApp(appId string) (*OAuthApp, *Response, error) {
	r, err := c.DoApiGet(c.GetOAuthAppRoute(appId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OAuthAppFromJson(r.Body), BuildResponse(r), nil
}

// GetOAuthAppInfo gets a sanitized version of a registered OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthAppInfo(appId string) (*OAuthApp, *Response, error) {
	r, err := c.DoApiGet(c.GetOAuthAppRoute(appId)+"/info", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OAuthAppFromJson(r.Body), BuildResponse(r), nil
}

// DeleteOAuthApp deletes a registered OAuth 2.0 client application.
func (c *Client4) DeleteOAuthApp(appId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetOAuthAppRoute(appId))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// RegenerateOAuthAppSecret regenerates the client secret for a registered OAuth 2.0 client application.
func (c *Client4) RegenerateOAuthAppSecret(appId string) (*OAuthApp, *Response, error) {
	r, err := c.DoApiPost(c.GetOAuthAppRoute(appId)+"/regen_secret", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OAuthAppFromJson(r.Body), BuildResponse(r), nil
}

// GetAuthorizedOAuthAppsForUser gets a page of OAuth 2.0 client applications the user has authorized to use access their account.
func (c *Client4) GetAuthorizedOAuthAppsForUser(userId string, page, perPage int) ([]*OAuthApp, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/oauth/apps/authorized"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return OAuthAppListFromJson(r.Body), BuildResponse(r), nil
}

// AuthorizeOAuthApp will authorize an OAuth 2.0 client application to access a user's account and provide a redirect link to follow.
func (c *Client4) AuthorizeOAuthApp(authRequest *AuthorizeRequest) (string, *Response, error) {
	buf, err := json.Marshal(authRequest)
	if err != nil {
		return "", BuildResponse(nil), NewAppError("AuthorizeOAuthApp", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiRequestBytes(http.MethodPost, c.Url+"/oauth/authorize", buf, "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body)["redirect"], BuildResponse(r), nil
}

// DeauthorizeOAuthApp will deauthorize an OAuth 2.0 client application from accessing a user's account.
func (c *Client4) DeauthorizeOAuthApp(appId string) (bool, *Response, error) {
	requestData := map[string]string{"client_id": appId}
	r, err := c.DoApiRequest(http.MethodPost, c.Url+"/oauth/deauthorize", MapToJson(requestData), "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetOAuthAccessToken is a test helper function for the OAuth access token endpoint.
func (c *Client4) GetOAuthAccessToken(data url.Values) (*AccessResponse, *Response, error) {
	url := c.Url + "/oauth/access_token"
	rq, err := http.NewRequest(http.MethodPost, url, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, nil, nil
	}
	rq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return nil, &Response{StatusCode: http.StatusForbidden}, NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 403)
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJson(rp.Body)
	}

	var ar *AccessResponse
	err = json.NewDecoder(rp.Body).Decode(&ar)
	if err != nil {
		return nil, BuildResponse(rp), NewAppError(url, "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return ar, BuildResponse(rp), nil
}

// Elasticsearch Section

// TestElasticsearch will attempt to connect to the configured Elasticsearch server and return OK if configured.
// correctly.
func (c *Client4) TestElasticsearch() (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetElasticsearchRoute()+"/test", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// PurgeElasticsearchIndexes immediately deletes all Elasticsearch indexes.
func (c *Client4) PurgeElasticsearchIndexes() (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetElasticsearchRoute()+"/purge_indexes", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// Bleve Section

// PurgeBleveIndexes immediately deletes all Bleve indexes.
func (c *Client4) PurgeBleveIndexes() (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetBleveRoute()+"/purge_indexes", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// Data Retention Section

// GetDataRetentionPolicy will get the current global data retention policy details.
func (c *Client4) GetDataRetentionPolicy() (*GlobalRetentionPolicy, *Response, error) {
	r, err := c.DoApiGet(c.GetDataRetentionRoute()+"/policy", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return GlobalRetentionPolicyFromJson(r.Body), BuildResponse(r), nil
}

// GetDataRetentionPolicyByID will get the details for the granular data retention policy with the specified ID.
func (c *Client4) GetDataRetentionPolicyByID(policyID string) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	r, err := c.DoApiGet(c.GetDataRetentionPolicyRoute(policyID), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	policy, err := RetentionPolicyWithTeamAndChannelCountsFromJson(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetDataRetentionPolicyByID", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return policy, BuildResponse(r), nil
}

// GetDataRetentionPoliciesCount will get the total number of granular data retention policies.
func (c *Client4) GetDataRetentionPoliciesCount() (int64, *Response, error) {
	type CountBody struct {
		TotalCount int64 `json:"total_count"`
	}
	r, err := c.DoApiGet(c.GetDataRetentionRoute()+"/policies_count", "")
	if err != nil {
		return 0, BuildResponse(r), err
	}
	var countObj CountBody
	err = json.NewDecoder(r.Body).Decode(&countObj)
	if err != nil {
		return 0, nil, NewAppError("Client4.GetDataRetentionPoliciesCount", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return countObj.TotalCount, BuildResponse(r), nil
}

// GetDataRetentionPolicies will get the current granular data retention policies' details.
func (c *Client4) GetDataRetentionPolicies(page, perPage int) (*RetentionPolicyWithTeamAndChannelCountsList, *Response, error) {
	query := fmt.Sprintf("?page=%d&per_page=%d", page, perPage)
	r, err := c.DoApiGet(c.GetDataRetentionRoute()+"/policies"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	policies, err := RetentionPolicyWithTeamAndChannelCountsListFromJson(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetDataRetentionPolicies", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return policies, BuildResponse(r), nil
}

// CreateDataRetentionPolicy will create a new granular data retention policy which will be applied to
// the specified teams and channels. The Id field of `policy` must be empty.
func (c *Client4) CreateDataRetentionPolicy(policy *RetentionPolicyWithTeamAndChannelIDs) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	r, err := c.doApiPostBytes(c.GetDataRetentionRoute()+"/policies", policy.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	newPolicy, err := RetentionPolicyWithTeamAndChannelCountsFromJson(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.CreateDataRetentionPolicy", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return newPolicy, BuildResponse(r), nil
}

// DeleteDataRetentionPolicy will delete the granular data retention policy with the specified ID.
func (c *Client4) DeleteDataRetentionPolicy(policyID string) (*Response, error) {
	r, err := c.DoApiDelete(c.GetDataRetentionPolicyRoute(policyID))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PatchDataRetentionPolicy will patch the granular data retention policy with the specified ID.
// The Id field of `patch` must be non-empty.
func (c *Client4) PatchDataRetentionPolicy(patch *RetentionPolicyWithTeamAndChannelIDs) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	r, err := c.doApiPatchBytes(c.GetDataRetentionPolicyRoute(patch.ID), patch.ToJson())
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	policy, err := RetentionPolicyWithTeamAndChannelCountsFromJson(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.PatchDataRetentionPolicy", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return policy, BuildResponse(r), nil
}

// GetTeamsForRetentionPolicy will get the teams to which the specified policy is currently applied.
func (c *Client4) GetTeamsForRetentionPolicy(policyID string, page, perPage int) (*TeamsWithCount, *Response, error) {
	query := fmt.Sprintf("?page=%d&per_page=%d", page, perPage)
	r, err := c.DoApiGet(c.GetDataRetentionPolicyRoute(policyID)+"/teams"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var teams *TeamsWithCount
	err = json.NewDecoder(r.Body).Decode(&teams)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetTeamsForRetentionPolicy", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return teams, BuildResponse(r), nil
}

// SearchTeamsForRetentionPolicy will search the teams to which the specified policy is currently applied.
func (c *Client4) SearchTeamsForRetentionPolicy(policyID string, term string) ([]*Team, *Response, error) {
	body, _ := json.Marshal(map[string]interface{}{"term": term})
	r, err := c.doApiPostBytes(c.GetDataRetentionPolicyRoute(policyID)+"/teams/search", body)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var teams []*Team
	err = json.NewDecoder(r.Body).Decode(&teams)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.SearchTeamsForRetentionPolicy", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return teams, BuildResponse(r), nil
}

// AddTeamsToRetentionPolicy will add the specified teams to the granular data retention policy
// with the specified ID.
func (c *Client4) AddTeamsToRetentionPolicy(policyID string, teamIDs []string) (*Response, error) {
	body, _ := json.Marshal(teamIDs)
	r, err := c.doApiPostBytes(c.GetDataRetentionPolicyRoute(policyID)+"/teams", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveTeamsFromRetentionPolicy will remove the specified teams from the granular data retention policy
// with the specified ID.
func (c *Client4) RemoveTeamsFromRetentionPolicy(policyID string, teamIDs []string) (*Response, error) {
	body, _ := json.Marshal(teamIDs)
	r, err := c.doApiDeleteBytes(c.GetDataRetentionPolicyRoute(policyID)+"/teams", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetChannelsForRetentionPolicy will get the channels to which the specified policy is currently applied.
func (c *Client4) GetChannelsForRetentionPolicy(policyID string, page, perPage int) (*ChannelsWithCount, *Response, error) {
	query := fmt.Sprintf("?page=%d&per_page=%d", page, perPage)
	r, err := c.DoApiGet(c.GetDataRetentionPolicyRoute(policyID)+"/channels"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var channels *ChannelsWithCount
	err = json.NewDecoder(r.Body).Decode(&channels)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetChannelsForRetentionPolicy", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return channels, BuildResponse(r), nil
}

// SearchChannelsForRetentionPolicy will search the channels to which the specified policy is currently applied.
func (c *Client4) SearchChannelsForRetentionPolicy(policyID string, term string) (ChannelListWithTeamData, *Response, error) {
	body, _ := json.Marshal(map[string]interface{}{"term": term})
	r, err := c.doApiPostBytes(c.GetDataRetentionPolicyRoute(policyID)+"/channels/search", body)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var channels ChannelListWithTeamData
	err = json.NewDecoder(r.Body).Decode(&channels)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.SearchChannelsForRetentionPolicy", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return channels, BuildResponse(r), nil
}

// AddChannelsToRetentionPolicy will add the specified channels to the granular data retention policy
// with the specified ID.
func (c *Client4) AddChannelsToRetentionPolicy(policyID string, channelIDs []string) (*Response, error) {
	body, _ := json.Marshal(channelIDs)
	r, err := c.doApiPostBytes(c.GetDataRetentionPolicyRoute(policyID)+"/channels", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveChannelsFromRetentionPolicy will remove the specified channels from the granular data retention policy
// with the specified ID.
func (c *Client4) RemoveChannelsFromRetentionPolicy(policyID string, channelIDs []string) (*Response, error) {
	body, _ := json.Marshal(channelIDs)
	r, err := c.doApiDeleteBytes(c.GetDataRetentionPolicyRoute(policyID)+"/channels", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTeamPoliciesForUser will get the data retention policies for the teams to which a user belongs.
func (c *Client4) GetTeamPoliciesForUser(userID string, offset, limit int) (*RetentionPolicyForTeamList, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(userID)+"/data_retention/team_policies", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var teams RetentionPolicyForTeamList
	err = json.NewDecoder(r.Body).Decode(&teams)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetTeamPoliciesForUser", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return &teams, BuildResponse(r), nil
}

// GetChannelPoliciesForUser will get the data retention policies for the channels to which a user belongs.
func (c *Client4) GetChannelPoliciesForUser(userID string, offset, limit int) (*RetentionPolicyForChannelList, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(userID)+"/data_retention/channel_policies", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var channels RetentionPolicyForChannelList
	err = json.NewDecoder(r.Body).Decode(&channels)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetChannelPoliciesForUser", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return &channels, BuildResponse(r), nil
}

// Commands Section

// CreateCommand will create a new command if the user have the right permissions.
func (c *Client4) CreateCommand(cmd *Command) (*Command, *Response, error) {
	buf, err := json.Marshal(cmd)
	if err != nil {
		return nil, nil, NewAppError("CreateCommand", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetCommandsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return CommandFromJson(r.Body), BuildResponse(r), nil
}

// UpdateCommand updates a command based on the provided Command struct.
func (c *Client4) UpdateCommand(cmd *Command) (*Command, *Response, error) {
	buf, err := json.Marshal(cmd)
	if err != nil {
		return nil, nil, NewAppError("UpdateCommand", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetCommandRoute(cmd.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return CommandFromJson(r.Body), BuildResponse(r), nil
}

// MoveCommand moves a command to a different team.
func (c *Client4) MoveCommand(teamId string, commandId string) (bool, *Response, error) {
	cmr := CommandMoveRequest{TeamId: teamId}
	buf, err := json.Marshal(cmr)
	if err != nil {
		return false, nil, NewAppError("MoveCommand", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetCommandMoveRoute(commandId), buf)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// DeleteCommand deletes a command based on the provided command id string.
func (c *Client4) DeleteCommand(commandId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetCommandRoute(commandId))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// ListCommands will retrieve a list of commands available in the team.
func (c *Client4) ListCommands(teamId string, customOnly bool) ([]*Command, *Response, error) {
	query := fmt.Sprintf("?team_id=%v&custom_only=%v", teamId, customOnly)
	r, err := c.DoApiGet(c.GetCommandsRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return CommandListFromJson(r.Body), BuildResponse(r), nil
}

// ListCommandAutocompleteSuggestions will retrieve a list of suggestions for a userInput.
func (c *Client4) ListCommandAutocompleteSuggestions(userInput, teamId string) ([]AutocompleteSuggestion, *Response, error) {
	query := fmt.Sprintf("/commands/autocomplete_suggestions?user_input=%v", userInput)
	r, err := c.DoApiGet(c.GetTeamRoute(teamId)+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return AutocompleteSuggestionsFromJSON(r.Body), BuildResponse(r), nil
}

// GetCommandById will retrieve a command by id.
func (c *Client4) GetCommandById(cmdId string) (*Command, *Response, error) {
	url := fmt.Sprintf("%s/%s", c.GetCommandsRoute(), cmdId)
	r, err := c.DoApiGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return CommandFromJson(r.Body), BuildResponse(r), nil
}

// ExecuteCommand executes a given slash command.
func (c *Client4) ExecuteCommand(channelId, command string) (*CommandResponse, *Response, error) {
	commandArgs := &CommandArgs{
		ChannelId: channelId,
		Command:   command,
	}
	buf, err := json.Marshal(commandArgs)
	if err != nil {
		return nil, nil, NewAppError("ExecuteCommand", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetCommandsRoute()+"/execute", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	response, err := CommandResponseFromJson(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("ExecuteCommand", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return response, BuildResponse(r), nil
}

// ExecuteCommandWithTeam executes a given slash command against the specified team.
// Use this when executing slash commands in a DM/GM, since the team id cannot be inferred in that case.
func (c *Client4) ExecuteCommandWithTeam(channelId, teamId, command string) (*CommandResponse, *Response, error) {
	commandArgs := &CommandArgs{
		ChannelId: channelId,
		TeamId:    teamId,
		Command:   command,
	}
	buf, err := json.Marshal(commandArgs)
	if err != nil {
		return nil, nil, NewAppError("ExecuteCommandWithTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetCommandsRoute()+"/execute", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	response, err := CommandResponseFromJson(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("ExecuteCommandWithTeam", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return response, BuildResponse(r), nil
}

// ListAutocompleteCommands will retrieve a list of commands available in the team.
func (c *Client4) ListAutocompleteCommands(teamId string) ([]*Command, *Response, error) {
	r, err := c.DoApiGet(c.GetTeamAutoCompleteCommandsRoute(teamId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return CommandListFromJson(r.Body), BuildResponse(r), nil
}

// RegenCommandToken will create a new token if the user have the right permissions.
func (c *Client4) RegenCommandToken(commandId string) (string, *Response, error) {
	r, err := c.DoApiPut(c.GetCommandRoute(commandId)+"/regen_token", "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body)["token"], BuildResponse(r), nil
}

// Status Section

// GetUserStatus returns a user based on the provided user id string.
func (c *Client4) GetUserStatus(userId, etag string) (*Status, *Response, error) {
	r, err := c.DoApiGet(c.GetUserStatusRoute(userId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return StatusFromJson(r.Body), BuildResponse(r), nil
}

// GetUsersStatusesByIds returns a list of users status based on the provided user ids.
func (c *Client4) GetUsersStatusesByIds(userIds []string) ([]*Status, *Response, error) {
	r, err := c.DoApiPost(c.GetUserStatusesRoute()+"/ids", ArrayToJson(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return StatusListFromJson(r.Body), BuildResponse(r), nil
}

// UpdateUserStatus sets a user's status based on the provided user id string.
func (c *Client4) UpdateUserStatus(userId string, userStatus *Status) (*Status, *Response, error) {
	buf, err := json.Marshal(userStatus)
	if err != nil {
		return nil, nil, NewAppError("UpdateUserStatus", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetUserStatusRoute(userId), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return StatusFromJson(r.Body), BuildResponse(r), nil
}

// Emoji Section

// CreateEmoji will save an emoji to the server if the current user has permission
// to do so. If successful, the provided emoji will be returned with its Id field
// filled in. Otherwise, an error will be returned.
func (c *Client4) CreateEmoji(emoji *Emoji, image []byte, filename string) (*Emoji, *Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", filename)
	if err != nil {
		return nil, &Response{StatusCode: http.StatusForbidden}, NewAppError("CreateEmoji", "model.client.create_emoji.image.app_error", nil, err.Error(), 0)
	}

	if _, err := io.Copy(part, bytes.NewBuffer(image)); err != nil {
		return nil, &Response{StatusCode: http.StatusForbidden}, NewAppError("CreateEmoji", "model.client.create_emoji.image.app_error", nil, err.Error(), 0)
	}

	if err := writer.WriteField("emoji", emoji.ToJson()); err != nil {
		return nil, &Response{StatusCode: http.StatusForbidden}, NewAppError("CreateEmoji", "model.client.create_emoji.emoji.app_error", nil, err.Error(), 0)
	}

	if err := writer.Close(); err != nil {
		return nil, &Response{StatusCode: http.StatusForbidden}, NewAppError("CreateEmoji", "model.client.create_emoji.writer.app_error", nil, err.Error(), 0)
	}

	return c.DoEmojiUploadFile(c.GetEmojisRoute(), body.Bytes(), writer.FormDataContentType())
}

// GetEmojiList returns a page of custom emoji on the system.
func (c *Client4) GetEmojiList(page, perPage int) ([]*Emoji, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoApiGet(c.GetEmojisRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return EmojiListFromJson(r.Body), BuildResponse(r), nil
}

// GetSortedEmojiList returns a page of custom emoji on the system sorted based on the sort
// parameter, blank for no sorting and "name" to sort by emoji names.
func (c *Client4) GetSortedEmojiList(page, perPage int, sort string) ([]*Emoji, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&sort=%v", page, perPage, sort)
	r, err := c.DoApiGet(c.GetEmojisRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return EmojiListFromJson(r.Body), BuildResponse(r), nil
}

// DeleteEmoji delete an custom emoji on the provided emoji id string.
func (c *Client4) DeleteEmoji(emojiId string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetEmojiRoute(emojiId))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetEmoji returns a custom emoji based on the emojiId string.
func (c *Client4) GetEmoji(emojiId string) (*Emoji, *Response, error) {
	r, err := c.DoApiGet(c.GetEmojiRoute(emojiId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return EmojiFromJson(r.Body), BuildResponse(r), nil
}

// GetEmojiByName returns a custom emoji based on the name string.
func (c *Client4) GetEmojiByName(name string) (*Emoji, *Response, error) {
	r, err := c.DoApiGet(c.GetEmojiByNameRoute(name), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return EmojiFromJson(r.Body), BuildResponse(r), nil
}

// GetEmojiImage returns the emoji image.
func (c *Client4) GetEmojiImage(emojiId string) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetEmojiRoute(emojiId)+"/image", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetEmojiImage", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode)
	}

	return data, BuildResponse(r), nil
}

// SearchEmoji returns a list of emoji matching some search criteria.
func (c *Client4) SearchEmoji(search *EmojiSearch) ([]*Emoji, *Response, error) {
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchEmoji", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetEmojisRoute()+"/search", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return EmojiListFromJson(r.Body), BuildResponse(r), nil
}

// AutocompleteEmoji returns a list of emoji starting with or matching name.
func (c *Client4) AutocompleteEmoji(name string, etag string) ([]*Emoji, *Response, error) {
	query := fmt.Sprintf("?name=%v", name)
	r, err := c.DoApiGet(c.GetEmojisRoute()+"/autocomplete"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return EmojiListFromJson(r.Body), BuildResponse(r), nil
}

// Reaction Section

// SaveReaction saves an emoji reaction for a post. Returns the saved reaction if successful, otherwise an error will be returned.
func (c *Client4) SaveReaction(reaction *Reaction) (*Reaction, *Response, error) {
	buf, err := json.Marshal(reaction)
	if err != nil {
		return nil, nil, NewAppError("SaveReaction", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetReactionsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReactionFromJson(r.Body), BuildResponse(r), nil
}

// GetReactions returns a list of reactions to a post.
func (c *Client4) GetReactions(postId string) ([]*Reaction, *Response, error) {
	r, err := c.DoApiGet(c.GetPostRoute(postId)+"/reactions", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReactionsFromJson(r.Body), BuildResponse(r), nil
}

// DeleteReaction deletes reaction of a user in a post.
func (c *Client4) DeleteReaction(reaction *Reaction) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetUserRoute(reaction.UserId) + c.GetPostRoute(reaction.PostId) + fmt.Sprintf("/reactions/%v", reaction.EmojiName))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// FetchBulkReactions returns a map of postIds and corresponding reactions
func (c *Client4) GetBulkReactions(postIds []string) (map[string][]*Reaction, *Response, error) {
	r, err := c.DoApiPost(c.GetPostsRoute()+"/ids/reactions", ArrayToJson(postIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapPostIdToReactionsFromJson(r.Body), BuildResponse(r), nil
}

// Timezone Section

// GetSupportedTimezone returns a page of supported timezones on the system.
func (c *Client4) GetSupportedTimezone() ([]string, *Response, error) {
	r, err := c.DoApiGet(c.GetTimezonesRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var timezones []string
	json.NewDecoder(r.Body).Decode(&timezones)
	return timezones, BuildResponse(r), nil
}

// Open Graph Metadata Section

// OpenGraph return the open graph metadata for a particular url if the site have the metadata.
func (c *Client4) OpenGraph(url string) (map[string]string, *Response, error) {
	requestBody := make(map[string]string)
	requestBody["url"] = url

	r, err := c.DoApiPost(c.GetOpenGraphRoute(), MapToJson(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body), BuildResponse(r), nil
}

// Jobs Section

// GetJob gets a single job.
func (c *Client4) GetJob(id string) (*Job, *Response, error) {
	r, err := c.DoApiGet(c.GetJobsRoute()+fmt.Sprintf("/%v", id), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return JobFromJson(r.Body), BuildResponse(r), nil
}

// GetJobs gets all jobs, sorted with the job that was created most recently first.
func (c *Client4) GetJobs(page int, perPage int) ([]*Job, *Response, error) {
	r, err := c.DoApiGet(c.GetJobsRoute()+fmt.Sprintf("?page=%v&per_page=%v", page, perPage), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return JobsFromJson(r.Body), BuildResponse(r), nil
}

// GetJobsByType gets all jobs of a given type, sorted with the job that was created most recently first.
func (c *Client4) GetJobsByType(jobType string, page int, perPage int) ([]*Job, *Response, error) {
	r, err := c.DoApiGet(c.GetJobsRoute()+fmt.Sprintf("/type/%v?page=%v&per_page=%v", jobType, page, perPage), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return JobsFromJson(r.Body), BuildResponse(r), nil
}

// CreateJob creates a job based on the provided job struct.
func (c *Client4) CreateJob(job *Job) (*Job, *Response, error) {
	buf, err := json.Marshal(job)
	if err != nil {
		return nil, nil, NewAppError("CreateJob", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetJobsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return JobFromJson(r.Body), BuildResponse(r), nil
}

// CancelJob requests the cancellation of the job with the provided Id.
func (c *Client4) CancelJob(jobId string) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetJobsRoute()+fmt.Sprintf("/%v/cancel", jobId), "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// DownloadJob downloads the results of the job
func (c *Client4) DownloadJob(jobId string) ([]byte, *Response, error) {
	r, err := c.DoApiGet(c.GetJobsRoute()+fmt.Sprintf("/%v/download", jobId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetFile", "model.client.read_job_result_file.app_error", nil, err.Error(), r.StatusCode)
	}
	return data, BuildResponse(r), nil
}

// Roles Section

// GetRole gets a single role by ID.
func (c *Client4) GetRole(id string) (*Role, *Response, error) {
	r, err := c.DoApiGet(c.GetRolesRoute()+fmt.Sprintf("/%v", id), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return RoleFromJson(r.Body), BuildResponse(r), nil
}

// GetRoleByName gets a single role by Name.
func (c *Client4) GetRoleByName(name string) (*Role, *Response, error) {
	r, err := c.DoApiGet(c.GetRolesRoute()+fmt.Sprintf("/name/%v", name), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return RoleFromJson(r.Body), BuildResponse(r), nil
}

// GetRolesByNames returns a list of roles based on the provided role names.
func (c *Client4) GetRolesByNames(roleNames []string) ([]*Role, *Response, error) {
	r, err := c.DoApiPost(c.GetRolesRoute()+"/names", ArrayToJson(roleNames))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return RoleListFromJson(r.Body), BuildResponse(r), nil
}

// PatchRole partially updates a role in the system. Any missing fields are not updated.
func (c *Client4) PatchRole(roleId string, patch *RolePatch) (*Role, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchRole", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetRolesRoute()+fmt.Sprintf("/%v/patch", roleId), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return RoleFromJson(r.Body), BuildResponse(r), nil
}

// Schemes Section

// CreateScheme creates a new Scheme.
func (c *Client4) CreateScheme(scheme *Scheme) (*Scheme, *Response, error) {
	buf, err := json.Marshal(scheme)
	if err != nil {
		return nil, nil, NewAppError("CreateScheme", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetSchemesRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return SchemeFromJson(r.Body), BuildResponse(r), nil
}

// GetScheme gets a single scheme by ID.
func (c *Client4) GetScheme(id string) (*Scheme, *Response, error) {
	r, err := c.DoApiGet(c.GetSchemeRoute(id), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return SchemeFromJson(r.Body), BuildResponse(r), nil
}

// GetSchemes gets all schemes, sorted with the most recently created first, optionally filtered by scope.
func (c *Client4) GetSchemes(scope string, page int, perPage int) ([]*Scheme, *Response, error) {
	r, err := c.DoApiGet(c.GetSchemesRoute()+fmt.Sprintf("?scope=%v&page=%v&per_page=%v", scope, page, perPage), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return SchemesFromJson(r.Body), BuildResponse(r), nil
}

// DeleteScheme deletes a single scheme by ID.
func (c *Client4) DeleteScheme(id string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetSchemeRoute(id))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// PatchScheme partially updates a scheme in the system. Any missing fields are not updated.
func (c *Client4) PatchScheme(id string, patch *SchemePatch) (*Scheme, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchScheme", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetSchemeRoute(id)+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return SchemeFromJson(r.Body), BuildResponse(r), nil
}

// GetTeamsForScheme gets the teams using this scheme, sorted alphabetically by display name.
func (c *Client4) GetTeamsForScheme(schemeId string, page int, perPage int) ([]*Team, *Response, error) {
	r, err := c.DoApiGet(c.GetSchemeRoute(schemeId)+fmt.Sprintf("/teams?page=%v&per_page=%v", page, perPage), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TeamListFromJson(r.Body), BuildResponse(r), nil
}

// GetChannelsForScheme gets the channels using this scheme, sorted alphabetically by display name.
func (c *Client4) GetChannelsForScheme(schemeId string, page int, perPage int) (ChannelList, *Response, error) {
	r, err := c.DoApiGet(c.GetSchemeRoute(schemeId)+fmt.Sprintf("/channels?page=%v&per_page=%v", page, perPage), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelList
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelsForScheme", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// Plugin Section

// UploadPlugin takes an io.Reader stream pointing to the contents of a .tar.gz plugin.
func (c *Client4) UploadPlugin(file io.Reader) (*Manifest, *Response, error) {
	return c.uploadPlugin(file, false)
}

func (c *Client4) UploadPluginForced(file io.Reader) (*Manifest, *Response, error) {
	return c.uploadPlugin(file, true)
}

func (c *Client4) uploadPlugin(file io.Reader, force bool) (*Manifest, *Response, error) {
	body := new(bytes.Buffer)
	writer := multipart.NewWriter(body)

	if force {
		err := writer.WriteField("force", c.boolString(true))
		if err != nil {
			return nil, nil, nil
		}
	}

	part, err := writer.CreateFormFile("plugin", "plugin.tar.gz")
	if err != nil {
		return nil, nil, nil
	}

	if _, err = io.Copy(part, file); err != nil {
		return nil, nil, nil
	}

	if err = writer.Close(); err != nil {
		return nil, nil, nil
	}

	rq, err := http.NewRequest("POST", c.ApiUrl+c.GetPluginsRoute(), body)
	if err != nil {
		return nil, nil, nil
	}
	rq.Header.Set("Content-Type", writer.FormDataContentType())

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return nil, BuildResponse(rp), NewAppError("UploadPlugin", "model.client.connecting.app_error", nil, err.Error(), 0)
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJson(rp.Body)
	}

	return ManifestFromJson(rp.Body), BuildResponse(rp), nil
}

func (c *Client4) InstallPluginFromUrl(downloadUrl string, force bool) (*Manifest, *Response, error) {
	forceStr := c.boolString(force)

	url := fmt.Sprintf("%s?plugin_download_url=%s&force=%s", c.GetPluginsRoute()+"/install_from_url", url.QueryEscape(downloadUrl), forceStr)
	r, err := c.DoApiPost(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ManifestFromJson(r.Body), BuildResponse(r), nil
}

// InstallMarketplacePlugin will install marketplace plugin.
func (c *Client4) InstallMarketplacePlugin(request *InstallMarketplacePluginRequest) (*Manifest, *Response, error) {
	json, err := request.ToJson()
	if err != nil {
		return nil, nil, nil
	}
	r, err := c.DoApiPost(c.GetPluginsRoute()+"/marketplace", json)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ManifestFromJson(r.Body), BuildResponse(r), nil
}

// GetPlugins will return a list of plugin manifests for currently active plugins.
func (c *Client4) GetPlugins() (*PluginsResponse, *Response, error) {
	r, err := c.DoApiGet(c.GetPluginsRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PluginsResponseFromJson(r.Body), BuildResponse(r), nil
}

// GetPluginStatuses will return the plugins installed on any server in the cluster, for reporting
// to the administrator via the system console.
func (c *Client4) GetPluginStatuses() (PluginStatuses, *Response, error) {
	r, err := c.DoApiGet(c.GetPluginsRoute()+"/statuses", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return PluginStatusesFromJson(r.Body), BuildResponse(r), nil
}

// RemovePlugin will disable and delete a plugin.
func (c *Client4) RemovePlugin(id string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetPluginRoute(id))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetWebappPlugins will return a list of plugins that the webapp should download.
func (c *Client4) GetWebappPlugins() ([]*Manifest, *Response, error) {
	r, err := c.DoApiGet(c.GetPluginsRoute()+"/webapp", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ManifestListFromJson(r.Body), BuildResponse(r), nil
}

// EnablePlugin will enable an plugin installed.
func (c *Client4) EnablePlugin(id string) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetPluginRoute(id)+"/enable", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// DisablePlugin will disable an enabled plugin.
func (c *Client4) DisablePlugin(id string) (bool, *Response, error) {
	r, err := c.DoApiPost(c.GetPluginRoute(id)+"/disable", "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetMarketplacePlugins will return a list of plugins that an admin can install.
func (c *Client4) GetMarketplacePlugins(filter *MarketplacePluginFilter) ([]*MarketplacePlugin, *Response, error) {
	route := c.GetPluginsRoute() + "/marketplace"
	u, err := url.Parse(route)
	if err != nil {
		return nil, nil, nil
	}

	filter.ApplyToURL(u)

	r, err := c.DoApiGet(u.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	plugins, err := MarketplacePluginsFromReader(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError(route, "model.client.parse_plugins.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	return plugins, BuildResponse(r), nil
}

// UpdateChannelScheme will update a channel's scheme.
func (c *Client4) UpdateChannelScheme(channelId, schemeId string) (bool, *Response, error) {
	sip := &SchemeIDPatch{SchemeID: &schemeId}
	buf, err := json.Marshal(sip)
	if err != nil {
		return false, nil, NewAppError("UpdateChannelScheme", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetChannelSchemeRoute(channelId), buf)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// UpdateTeamScheme will update a team's scheme.
func (c *Client4) UpdateTeamScheme(teamId, schemeId string) (bool, *Response, error) {
	sip := &SchemeIDPatch{SchemeID: &schemeId}
	buf, err := json.Marshal(sip)
	if err != nil {
		return false, nil, NewAppError("UpdateTeamScheme", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetTeamSchemeRoute(teamId), buf)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetRedirectLocation retrieves the value of the 'Location' header of an HTTP response for a given URL.
func (c *Client4) GetRedirectLocation(urlParam, etag string) (string, *Response, error) {
	url := fmt.Sprintf("%s?url=%s", c.GetRedirectLocationRoute(), url.QueryEscape(urlParam))
	r, err := c.DoApiGet(url, etag)
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJson(r.Body)["location"], BuildResponse(r), nil
}

// SetServerBusy will mark the server as busy, which disables non-critical services for `secs` seconds.
func (c *Client4) SetServerBusy(secs int) (bool, *Response, error) {
	url := fmt.Sprintf("%s?seconds=%d", c.GetServerBusyRoute(), secs)
	r, err := c.DoApiPost(url, "")
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// ClearServerBusy will mark the server as not busy.
func (c *Client4) ClearServerBusy() (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetServerBusyRoute())
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetServerBusy returns the current ServerBusyState including the time when a server marked busy
// will automatically have the flag cleared.
func (c *Client4) GetServerBusy() (*ServerBusyState, *Response, error) {
	r, err := c.DoApiGet(c.GetServerBusyRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	sbs := ServerBusyStateFromJson(r.Body)
	return sbs, BuildResponse(r), nil
}

// RegisterTermsOfServiceAction saves action performed by a user against a specific terms of service.
func (c *Client4) RegisterTermsOfServiceAction(userId, termsOfServiceId string, accepted bool) (*bool, *Response, error) {
	url := c.GetUserTermsOfServiceRoute(userId)
	data := map[string]interface{}{"termsOfServiceId": termsOfServiceId, "accepted": accepted}
	r, err := c.DoApiPost(url, StringInterfaceToJson(data))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return NewBool(CheckStatusOK(r)), BuildResponse(r), nil
}

// GetTermsOfService fetches the latest terms of service
func (c *Client4) GetTermsOfService(etag string) (*TermsOfService, *Response, error) {
	url := c.GetTermsOfServiceRoute()
	r, err := c.DoApiGet(url, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TermsOfServiceFromJson(r.Body), BuildResponse(r), nil
}

// GetUserTermsOfService fetches user's latest terms of service action if the latest action was for acceptance.
func (c *Client4) GetUserTermsOfService(userId, etag string) (*UserTermsOfService, *Response, error) {
	url := c.GetUserTermsOfServiceRoute(userId)
	r, err := c.DoApiGet(url, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UserTermsOfServiceFromJson(r.Body), BuildResponse(r), nil
}

// CreateTermsOfService creates new terms of service.
func (c *Client4) CreateTermsOfService(text, userId string) (*TermsOfService, *Response, error) {
	url := c.GetTermsOfServiceRoute()
	data := map[string]interface{}{"text": text}
	r, err := c.DoApiPost(url, StringInterfaceToJson(data))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return TermsOfServiceFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) GetGroup(groupID, etag string) (*Group, *Response, error) {
	r, err := c.DoApiGet(c.GetGroupRoute(groupID), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return GroupFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) PatchGroup(groupID string, patch *GroupPatch) (*Group, *Response, error) {
	payload, _ := json.Marshal(patch)
	r, err := c.DoApiPut(c.GetGroupRoute(groupID)+"/patch", string(payload))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return GroupFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) LinkGroupSyncable(groupID, syncableID string, syncableType GroupSyncableType, patch *GroupSyncablePatch) (*GroupSyncable, *Response, error) {
	payload, _ := json.Marshal(patch)
	url := fmt.Sprintf("%s/link", c.GetGroupSyncableRoute(groupID, syncableID, syncableType))
	r, err := c.DoApiPost(url, string(payload))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return GroupSyncableFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) UnlinkGroupSyncable(groupID, syncableID string, syncableType GroupSyncableType) (*Response, error) {
	url := fmt.Sprintf("%s/link", c.GetGroupSyncableRoute(groupID, syncableID, syncableType))
	r, err := c.DoApiDelete(url)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetGroupSyncable(groupID, syncableID string, syncableType GroupSyncableType, etag string) (*GroupSyncable, *Response, error) {
	r, err := c.DoApiGet(c.GetGroupSyncableRoute(groupID, syncableID, syncableType), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return GroupSyncableFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) GetGroupSyncables(groupID string, syncableType GroupSyncableType, etag string) ([]*GroupSyncable, *Response, error) {
	r, err := c.DoApiGet(c.GetGroupSyncablesRoute(groupID, syncableType), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return GroupSyncablesFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) PatchGroupSyncable(groupID, syncableID string, syncableType GroupSyncableType, patch *GroupSyncablePatch) (*GroupSyncable, *Response, error) {
	payload, _ := json.Marshal(patch)
	r, err := c.DoApiPut(c.GetGroupSyncableRoute(groupID, syncableID, syncableType)+"/patch", string(payload))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return GroupSyncableFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) TeamMembersMinusGroupMembers(teamID string, groupIDs []string, page, perPage int, etag string) ([]*UserWithGroups, int64, *Response, error) {
	groupIDStr := strings.Join(groupIDs, ",")
	query := fmt.Sprintf("?group_ids=%s&page=%d&per_page=%d", groupIDStr, page, perPage)
	r, err := c.DoApiGet(c.GetTeamRoute(teamID)+"/members_minus_group_members"+query, etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)
	ugc := UsersWithGroupsAndCountFromJson(r.Body)
	return ugc.Users, ugc.Count, BuildResponse(r), nil
}

func (c *Client4) ChannelMembersMinusGroupMembers(channelID string, groupIDs []string, page, perPage int, etag string) ([]*UserWithGroups, int64, *Response, error) {
	groupIDStr := strings.Join(groupIDs, ",")
	query := fmt.Sprintf("?group_ids=%s&page=%d&per_page=%d", groupIDStr, page, perPage)
	r, err := c.DoApiGet(c.GetChannelRoute(channelID)+"/members_minus_group_members"+query, etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)
	ugc := UsersWithGroupsAndCountFromJson(r.Body)
	return ugc.Users, ugc.Count, BuildResponse(r), nil
}

func (c *Client4) PatchConfig(config *Config) (*Config, *Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return nil, nil, NewAppError("PatchConfig", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPutBytes(c.GetConfigRoute()+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ConfigFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) GetChannelModerations(channelID string, etag string) ([]*ChannelModeration, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelRoute(channelID)+"/moderations", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*ChannelModeration
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelModerations", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

func (c *Client4) PatchChannelModerations(channelID string, patch []*ChannelModerationPatch) ([]*ChannelModeration, *Response, error) {
	payload, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchChannelModerations", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}

	r, err := c.DoApiPut(c.GetChannelRoute(channelID)+"/moderations/patch", string(payload))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*ChannelModeration
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("PatchChannelModerations", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

func (c *Client4) GetKnownUsers() ([]string, *Response, error) {
	r, err := c.DoApiGet(c.GetUsersRoute()+"/known", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var userIds []string
	json.NewDecoder(r.Body).Decode(&userIds)
	return userIds, BuildResponse(r), nil
}

// PublishUserTyping publishes a user is typing websocket event based on the provided TypingRequest.
func (c *Client4) PublishUserTyping(userID string, typingRequest TypingRequest) (bool, *Response, error) {
	buf, err := json.Marshal(typingRequest)
	if err != nil {
		return false, nil, NewAppError("PublishUserTyping", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetPublishUserTypingRoute(userID), buf)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

func (c *Client4) GetChannelMemberCountsByGroup(channelID string, includeTimezones bool, etag string) ([]*ChannelMemberCountByGroup, *Response, error) {
	r, err := c.DoApiGet(c.GetChannelRoute(channelID)+"/member_counts_by_group?include_timezones="+strconv.FormatBool(includeTimezones), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*ChannelMemberCountByGroup
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelMemberCountsByGroup", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return ch, BuildResponse(r), nil
}

// RequestTrialLicense will request a trial license and install it in the server
func (c *Client4) RequestTrialLicense(users int) (bool, *Response, error) {
	b, _ := json.Marshal(map[string]interface{}{"users": users, "terms_accepted": true})
	r, err := c.DoApiPost("/trial-license", string(b))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

// GetGroupStats retrieves stats for a Mattermost Group
func (c *Client4) GetGroupStats(groupID string) (*GroupStats, *Response, error) {
	r, err := c.DoApiGet(c.GetGroupRoute(groupID)+"/stats", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return GroupStatsFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) GetSidebarCategoriesForTeamForUser(userID, teamID, etag string) (*OrderedSidebarCategories, *Response, error) {
	route := c.GetUserCategoryRoute(userID, teamID)
	r, err := c.DoApiGet(route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}

	var cat *OrderedSidebarCategories
	err = json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetSidebarCategoriesForTeamForUser", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return cat, BuildResponse(r), nil
}

func (c *Client4) CreateSidebarCategoryForTeamForUser(userID, teamID string, category *SidebarCategoryWithChannels) (*SidebarCategoryWithChannels, *Response, error) {
	payload, _ := json.Marshal(category)
	route := c.GetUserCategoryRoute(userID, teamID)
	r, err := c.doApiPostBytes(route, payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var cat *SidebarCategoryWithChannels
	err = json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.CreateSidebarCategoryForTeamForUser", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}
	return cat, BuildResponse(r), nil
}

func (c *Client4) UpdateSidebarCategoriesForTeamForUser(userID, teamID string, categories []*SidebarCategoryWithChannels) ([]*SidebarCategoryWithChannels, *Response, error) {
	payload, _ := json.Marshal(categories)
	route := c.GetUserCategoryRoute(userID, teamID)

	r, err := c.doApiPutBytes(route, payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cat []*SidebarCategoryWithChannels
	err = json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.UpdateSidebarCategoriesForTeamForUser", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}

	return cat, BuildResponse(r), nil
}

func (c *Client4) GetSidebarCategoryOrderForTeamForUser(userID, teamID, etag string) ([]string, *Response, error) {
	route := c.GetUserCategoryRoute(userID, teamID) + "/order"
	r, err := c.DoApiGet(route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) UpdateSidebarCategoryOrderForTeamForUser(userID, teamID string, order []string) ([]string, *Response, error) {
	payload, _ := json.Marshal(order)
	route := c.GetUserCategoryRoute(userID, teamID) + "/order"
	r, err := c.doApiPutBytes(route, payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) GetSidebarCategoryForTeamForUser(userID, teamID, categoryID, etag string) (*SidebarCategoryWithChannels, *Response, error) {
	route := c.GetUserCategoryRoute(userID, teamID) + "/" + categoryID
	r, err := c.DoApiGet(route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var cat *SidebarCategoryWithChannels
	err = json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.UpdateSidebarCategoriesForTeamForUser", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}

	return cat, BuildResponse(r), nil
}

func (c *Client4) UpdateSidebarCategoryForTeamForUser(userID, teamID, categoryID string, category *SidebarCategoryWithChannels) (*SidebarCategoryWithChannels, *Response, error) {
	payload, _ := json.Marshal(category)
	route := c.GetUserCategoryRoute(userID, teamID) + "/" + categoryID
	r, err := c.doApiPutBytes(route, payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var cat *SidebarCategoryWithChannels
	err = json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.UpdateSidebarCategoriesForTeamForUser", "model.utils.decode_json.app_error", nil, err.Error(), r.StatusCode)
	}

	return cat, BuildResponse(r), nil
}

// CheckIntegrity performs a database integrity check.
func (c *Client4) CheckIntegrity() ([]IntegrityCheckResult, *Response, error) {
	r, err := c.DoApiPost("/integrity", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var results []IntegrityCheckResult
	if err := json.NewDecoder(r.Body).Decode(&results); err != nil {
		return nil, BuildResponse(r), NewAppError("Api4.CheckIntegrity", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return results, BuildResponse(r), nil
}

func (c *Client4) GetNotices(lastViewed int64, teamId string, client NoticeClientType, clientVersion, locale, etag string) (NoticeMessages, *Response, error) {
	url := fmt.Sprintf("/system/notices/%s?lastViewed=%d&client=%s&clientVersion=%s&locale=%s", teamId, lastViewed, client, clientVersion, locale)
	r, err := c.DoApiGet(url, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	notices, err := UnmarshalProductNoticeMessages(r.Body)
	if err != nil {
		return nil, &Response{StatusCode: http.StatusBadRequest}, NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), http.StatusForbidden)
	}
	return notices, BuildResponse(r), nil
}

func (c *Client4) MarkNoticesViewed(ids []string) (*Response, error) {
	r, err := c.DoApiPut("/system/notices/view", ArrayToJson(ids))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// CreateUpload creates a new upload session.
func (c *Client4) CreateUpload(us *UploadSession) (*UploadSession, *Response, error) {
	buf, err := json.Marshal(us)
	if err != nil {
		return nil, nil, NewAppError("CreateUpload", "api.marshal_error", nil, err.Error(), http.StatusInternalServerError)
	}
	r, err := c.doApiPostBytes(c.GetUploadsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UploadSessionFromJson(r.Body), BuildResponse(r), nil
}

// GetUpload returns the upload session for the specified uploadId.
func (c *Client4) GetUpload(uploadId string) (*UploadSession, *Response, error) {
	r, err := c.DoApiGet(c.GetUploadRoute(uploadId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UploadSessionFromJson(r.Body), BuildResponse(r), nil
}

// GetUploadsForUser returns the upload sessions created by the specified
// userId.
func (c *Client4) GetUploadsForUser(userId string) ([]*UploadSession, *Response, error) {
	r, err := c.DoApiGet(c.GetUserRoute(userId)+"/uploads", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return UploadSessionsFromJson(r.Body), BuildResponse(r), nil
}

// UploadData performs an upload. On success it returns
// a FileInfo object.
func (c *Client4) UploadData(uploadId string, data io.Reader) (*FileInfo, *Response, error) {
	url := c.GetUploadRoute(uploadId)
	r, err := c.doApiRequestReader("POST", c.ApiUrl+url, data, nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return FileInfoFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) UpdatePassword(userId, currentPassword, newPassword string) (*Response, error) {
	requestBody := map[string]string{"current_password": currentPassword, "new_password": newPassword}
	r, err := c.DoApiPut(c.GetUserRoute(userId)+"/password", MapToJson(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Cloud Section

func (c *Client4) GetCloudProducts() ([]*Product, *Response, error) {
	r, err := c.DoApiGet(c.GetCloudRoute()+"/products", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cloudProducts []*Product
	json.NewDecoder(r.Body).Decode(&cloudProducts)

	return cloudProducts, BuildResponse(r), nil
}

func (c *Client4) CreateCustomerPayment() (*StripeSetupIntent, *Response, error) {
	r, err := c.DoApiPost(c.GetCloudRoute()+"/payment", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var setupIntent *StripeSetupIntent
	json.NewDecoder(r.Body).Decode(&setupIntent)

	return setupIntent, BuildResponse(r), nil
}

func (c *Client4) ConfirmCustomerPayment(confirmRequest *ConfirmPaymentMethodRequest) (*Response, error) {
	json, _ := json.Marshal(confirmRequest)

	r, err := c.doApiPostBytes(c.GetCloudRoute()+"/payment/confirm", json)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) GetCloudCustomer() (*CloudCustomer, *Response, error) {
	r, err := c.DoApiGet(c.GetCloudRoute()+"/customer", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cloudCustomer *CloudCustomer
	json.NewDecoder(r.Body).Decode(&cloudCustomer)

	return cloudCustomer, BuildResponse(r), nil
}

func (c *Client4) GetSubscription() (*Subscription, *Response, error) {
	r, err := c.DoApiGet(c.GetCloudRoute()+"/subscription", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var subscription *Subscription
	json.NewDecoder(r.Body).Decode(&subscription)

	return subscription, BuildResponse(r), nil
}

func (c *Client4) GetSubscriptionStats() (*SubscriptionStats, *Response, error) {
	r, err := c.DoApiGet(c.GetCloudRoute()+"/subscription/stats", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var stats *SubscriptionStats
	json.NewDecoder(r.Body).Decode(&stats)
	return stats, BuildResponse(r), nil
}

func (c *Client4) GetInvoicesForSubscription() ([]*Invoice, *Response, error) {
	r, err := c.DoApiGet(c.GetCloudRoute()+"/subscription/invoices", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var invoices []*Invoice
	json.NewDecoder(r.Body).Decode(&invoices)

	return invoices, BuildResponse(r), nil
}

func (c *Client4) UpdateCloudCustomer(customerInfo *CloudCustomerInfo) (*CloudCustomer, *Response, error) {
	customerBytes, _ := json.Marshal(customerInfo)

	r, err := c.doApiPutBytes(c.GetCloudRoute()+"/customer", customerBytes)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var customer *CloudCustomer
	json.NewDecoder(r.Body).Decode(&customer)

	return customer, BuildResponse(r), nil
}

func (c *Client4) UpdateCloudCustomerAddress(address *Address) (*CloudCustomer, *Response, error) {
	addressBytes, _ := json.Marshal(address)

	r, err := c.doApiPutBytes(c.GetCloudRoute()+"/customer/address", addressBytes)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var customer *CloudCustomer
	json.NewDecoder(r.Body).Decode(&customer)

	return customer, BuildResponse(r), nil
}

func (c *Client4) ListImports() ([]string, *Response, error) {
	r, err := c.DoApiGet(c.GetImportsRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) ListExports() ([]string, *Response, error) {
	r, err := c.DoApiGet(c.GetExportsRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJson(r.Body), BuildResponse(r), nil
}

func (c *Client4) DeleteExport(name string) (bool, *Response, error) {
	r, err := c.DoApiDelete(c.GetExportRoute(name))
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return CheckStatusOK(r), BuildResponse(r), nil
}

func (c *Client4) DownloadExport(name string, wr io.Writer, offset int64) (int64, *Response, error) {
	var headers map[string]string
	if offset > 0 {
		headers = map[string]string{
			HeaderRange: fmt.Sprintf("bytes=%d-", offset),
		}
	}
	r, err := c.DoApiRequestWithHeaders(http.MethodGet, c.ApiUrl+c.GetExportRoute(name), "", headers)
	if err != nil {
		return 0, BuildResponse(r), err
	}
	defer closeBody(r)
	n, err := io.Copy(wr, r.Body)
	if err != nil {
		return n, BuildResponse(r), NewAppError("DownloadExport", "model.client.copy.app_error", nil, err.Error(), r.StatusCode)
	}
	return n, BuildResponse(r), nil
}

func (c *Client4) GetUserThreads(userId, teamId string, options GetUserThreadsOpts) (*Threads, *Response, error) {
	v := url.Values{}
	if options.Since != 0 {
		v.Set("since", fmt.Sprintf("%d", options.Since))
	}
	if options.Before != "" {
		v.Set("before", options.Before)
	}
	if options.After != "" {
		v.Set("after", options.After)
	}
	if options.PageSize != 0 {
		v.Set("pageSize", fmt.Sprintf("%d", options.PageSize))
	}
	if options.Extended {
		v.Set("extended", "true")
	}
	if options.Deleted {
		v.Set("deleted", "true")
	}
	if options.Unread {
		v.Set("unread", "true")
	}
	url := c.GetUserThreadsRoute(userId, teamId)
	if len(v) > 0 {
		url += "?" + v.Encode()
	}

	r, err := c.DoApiGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var threads Threads
	json.NewDecoder(r.Body).Decode(&threads)

	return &threads, BuildResponse(r), nil
}

func (c *Client4) GetUserThread(userId, teamId, threadId string, extended bool) (*ThreadResponse, *Response, error) {
	url := c.GetUserThreadRoute(userId, teamId, threadId)
	if extended {
		url += "?extended=true"
	}
	r, err := c.DoApiGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var thread ThreadResponse
	json.NewDecoder(r.Body).Decode(&thread)

	return &thread, BuildResponse(r), nil
}

func (c *Client4) UpdateThreadsReadForUser(userId, teamId string) (*Response, error) {
	r, err := c.DoApiPut(fmt.Sprintf("%s/read", c.GetUserThreadsRoute(userId, teamId)), "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) UpdateThreadReadForUser(userId, teamId, threadId string, timestamp int64) (*ThreadResponse, *Response, error) {
	r, err := c.DoApiPut(fmt.Sprintf("%s/read/%d", c.GetUserThreadRoute(userId, teamId, threadId), timestamp), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var thread ThreadResponse
	json.NewDecoder(r.Body).Decode(&thread)

	return &thread, BuildResponse(r), nil
}

func (c *Client4) UpdateThreadFollowForUser(userId, teamId, threadId string, state bool) (*Response, error) {
	var err error
	var r *http.Response
	if state {
		r, err = c.DoApiPut(c.GetUserThreadRoute(userId, teamId, threadId)+"/following", "")
	} else {
		r, err = c.DoApiDelete(c.GetUserThreadRoute(userId, teamId, threadId) + "/following")
	}
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) SendAdminUpgradeRequestEmail() (*Response, error) {
	r, err := c.DoApiPost(c.GetCloudRoute()+"/subscription/limitreached/invite", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) SendAdminUpgradeRequestEmailOnJoin() (*Response, error) {
	r, err := c.DoApiPost(c.GetCloudRoute()+"/subscription/limitreached/join", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) GetAllSharedChannels(teamID string, page, perPage int) ([]*SharedChannel, *Response, error) {
	url := fmt.Sprintf("%s/%s?page=%d&per_page=%d", c.GetSharedChannelsRoute(), teamID, page, perPage)
	r, err := c.DoApiGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var channels []*SharedChannel
	json.NewDecoder(r.Body).Decode(&channels)

	return channels, BuildResponse(r), nil
}

func (c *Client4) GetRemoteClusterInfo(remoteID string) (RemoteClusterInfo, *Response, error) {
	url := fmt.Sprintf("%s/remote_info/%s", c.GetSharedChannelsRoute(), remoteID)
	r, err := c.DoApiGet(url, "")
	if err != nil {
		return RemoteClusterInfo{}, BuildResponse(r), err
	}
	defer closeBody(r)

	var rci RemoteClusterInfo
	json.NewDecoder(r.Body).Decode(&rci)

	return rci, BuildResponse(r), nil
}

func (c *Client4) GetAncillaryPermissions(subsectionPermissions []string) ([]string, *Response, error) {
	var returnedPermissions []string
	url := fmt.Sprintf("%s/ancillary?subsection_permissions=%s", c.GetPermissionsRoute(), strings.Join(subsectionPermissions, ","))
	r, err := c.DoApiGet(url, "")
	if err != nil {
		return returnedPermissions, BuildResponse(r), err
	}
	defer closeBody(r)

	json.NewDecoder(r.Body).Decode(&returnedPermissions)
	return returnedPermissions, BuildResponse(r), nil
}
