// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const (
	HeaderRequestId                 = "X-Request-ID"
	HeaderVersionId                 = "X-Version-ID"
	HeaderClusterId                 = "X-Cluster-ID"
	HeaderEtagServer                = "ETag"
	HeaderEtagClient                = "If-None-Match"
	HeaderForwarded                 = "X-Forwarded-For"
	HeaderRealIP                    = "X-Real-IP"
	HeaderForwardedProto            = "X-Forwarded-Proto"
	HeaderToken                     = "token"
	HeaderCsrfToken                 = "X-CSRF-Token"
	HeaderBearer                    = "BEARER"
	HeaderAuth                      = "Authorization"
	HeaderCloudToken                = "X-Cloud-Token"
	HeaderRemoteclusterToken        = "X-RemoteCluster-Token"
	HeaderRemoteclusterId           = "X-RemoteCluster-Id"
	HeaderRequestedWith             = "X-Requested-With"
	HeaderRequestedWithXML          = "XMLHttpRequest"
	HeaderFirstInaccessiblePostTime = "First-Inaccessible-Post-Time"
	HeaderFirstInaccessibleFileTime = "First-Inaccessible-File-Time"
	HeaderRange                     = "Range"
	STATUS                          = "status"
	StatusOk                        = "OK"
	StatusFail                      = "FAIL"
	StatusUnhealthy                 = "UNHEALTHY"
	StatusRemove                    = "REMOVE"
	ConnectionId                    = "Connection-Id"

	ClientDir = "client"

	APIURLSuffixV1 = "/api/v1"
	APIURLSuffixV4 = "/api/v4"
	APIURLSuffixV5 = "/api/v5"
	APIURLSuffix   = APIURLSuffixV4
)

type Response struct {
	StatusCode    int
	RequestId     string
	Etag          string
	ServerVersion string
	Header        http.Header
}

type Client4 struct {
	URL        string       // The location of the server, for example  "http://localhost:8065"
	APIURL     string       // The api location of the server, for example "http://localhost:8065/api/v4"
	HTTPClient *http.Client // The http client
	AuthToken  string
	AuthType   string
	HTTPHeader map[string]string // Headers to be copied over for each request

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
		_, _ = io.Copy(io.Discard, r.Body)
		_ = r.Body.Close()
	}
}

func NewAPIv4Client(url string) *Client4 {
	url = strings.TrimRight(url, "/")
	return &Client4{url, url + APIURLSuffix, &http.Client{}, "", "", map[string]string{}, "", ""}
}

func NewAPIv4SocketClient(socketPath string) *Client4 {
	tr := &http.Transport{
		Dial: func(network, addr string) (net.Conn, error) {
			return net.Dial("unix", socketPath)
		},
	}

	client := NewAPIv4Client("http://_")
	client.HTTPClient = &http.Client{Transport: tr}

	return client
}

func BuildResponse(r *http.Response) *Response {
	if r == nil {
		return nil
	}

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

func (c *Client4) usersRoute() string {
	return "/users"
}

func (c *Client4) userRoute(userId string) string {
	return fmt.Sprintf(c.usersRoute()+"/%v", userId)
}

func (c *Client4) userThreadsRoute(userID, teamID string) string {
	return c.userRoute(userID) + c.teamRoute(teamID) + "/threads"
}

func (c *Client4) userThreadRoute(userId, teamId, threadId string) string {
	return c.userThreadsRoute(userId, teamId) + "/" + threadId
}

func (c *Client4) userCategoryRoute(userID, teamID string) string {
	return c.userRoute(userID) + c.teamRoute(teamID) + "/channels/categories"
}

func (c *Client4) userAccessTokensRoute() string {
	return fmt.Sprintf(c.usersRoute() + "/tokens")
}

func (c *Client4) userAccessTokenRoute(tokenId string) string {
	return fmt.Sprintf(c.usersRoute()+"/tokens/%v", tokenId)
}

func (c *Client4) userByUsernameRoute(userName string) string {
	return fmt.Sprintf(c.usersRoute()+"/username/%v", userName)
}

func (c *Client4) userByEmailRoute(email string) string {
	return fmt.Sprintf(c.usersRoute()+"/email/%v", email)
}

func (c *Client4) botsRoute() string {
	return "/bots"
}

func (c *Client4) botRoute(botUserId string) string {
	return fmt.Sprintf("%s/%s", c.botsRoute(), botUserId)
}

func (c *Client4) teamsRoute() string {
	return "/teams"
}

func (c *Client4) teamRoute(teamId string) string {
	return fmt.Sprintf(c.teamsRoute()+"/%v", teamId)
}

func (c *Client4) teamAutoCompleteCommandsRoute(teamId string) string {
	return fmt.Sprintf(c.teamsRoute()+"/%v/commands/autocomplete", teamId)
}

func (c *Client4) teamByNameRoute(teamName string) string {
	return fmt.Sprintf(c.teamsRoute()+"/name/%v", teamName)
}

func (c *Client4) teamMemberRoute(teamId, userId string) string {
	return fmt.Sprintf(c.teamRoute(teamId)+"/members/%v", userId)
}

func (c *Client4) teamMembersRoute(teamId string) string {
	return fmt.Sprintf(c.teamRoute(teamId) + "/members")
}

func (c *Client4) teamStatsRoute(teamId string) string {
	return fmt.Sprintf(c.teamRoute(teamId) + "/stats")
}

func (c *Client4) teamImportRoute(teamId string) string {
	return fmt.Sprintf(c.teamRoute(teamId) + "/import")
}

func (c *Client4) channelsRoute() string {
	return "/channels"
}

func (c *Client4) channelsForTeamRoute(teamId string) string {
	return fmt.Sprintf(c.teamRoute(teamId) + "/channels")
}

func (c *Client4) channelRoute(channelId string) string {
	return fmt.Sprintf(c.channelsRoute()+"/%v", channelId)
}

func (c *Client4) channelByNameRoute(channelName, teamId string) string {
	return fmt.Sprintf(c.teamRoute(teamId)+"/channels/name/%v", channelName)
}

func (c *Client4) channelsForTeamForUserRoute(teamId, userId string, includeDeleted bool) string {
	route := fmt.Sprintf(c.userRoute(userId) + c.teamRoute(teamId) + "/channels")
	if includeDeleted {
		query := fmt.Sprintf("?include_deleted=%v", includeDeleted)
		return route + query
	}
	return route
}

func (c *Client4) channelByNameForTeamNameRoute(channelName, teamName string) string {
	return fmt.Sprintf(c.teamByNameRoute(teamName)+"/channels/name/%v", channelName)
}

func (c *Client4) channelMembersRoute(channelId string) string {
	return fmt.Sprintf(c.channelRoute(channelId) + "/members")
}

func (c *Client4) channelMemberRoute(channelId, userId string) string {
	return fmt.Sprintf(c.channelMembersRoute(channelId)+"/%v", userId)
}

func (c *Client4) postsRoute() string {
	return "/posts"
}

func (c *Client4) postsEphemeralRoute() string {
	return "/posts/ephemeral"
}

func (c *Client4) configRoute() string {
	return "/config"
}

func (c *Client4) licenseRoute() string {
	return "/license"
}

func (c *Client4) postRoute(postId string) string {
	return fmt.Sprintf(c.postsRoute()+"/%v", postId)
}

func (c *Client4) filesRoute() string {
	return "/files"
}

func (c *Client4) fileRoute(fileId string) string {
	return fmt.Sprintf(c.filesRoute()+"/%v", fileId)
}

func (c *Client4) uploadsRoute() string {
	return "/uploads"
}

func (c *Client4) uploadRoute(uploadId string) string {
	return fmt.Sprintf("%s/%s", c.uploadsRoute(), uploadId)
}

func (c *Client4) pluginsRoute() string {
	return "/plugins"
}

func (c *Client4) pluginRoute(pluginId string) string {
	return fmt.Sprintf(c.pluginsRoute()+"/%v", pluginId)
}

func (c *Client4) systemRoute() string {
	return "/system"
}

func (c *Client4) cloudRoute() string {
	return "/cloud"
}

func (c *Client4) hostedCustomerRoute() string {
	return "/hosted_customer"
}

func (c *Client4) testEmailRoute() string {
	return "/email/test"
}

func (c *Client4) usageRoute() string {
	return "/usage"
}

func (c *Client4) testSiteURLRoute() string {
	return "/site_url/test"
}

func (c *Client4) testS3Route() string {
	return "/file/s3_test"
}

func (c *Client4) databaseRoute() string {
	return "/database"
}

func (c *Client4) cacheRoute() string {
	return "/caches"
}

func (c *Client4) clusterRoute() string {
	return "/cluster"
}

func (c *Client4) incomingWebhooksRoute() string {
	return "/hooks/incoming"
}

func (c *Client4) incomingWebhookRoute(hookID string) string {
	return fmt.Sprintf(c.incomingWebhooksRoute()+"/%v", hookID)
}

func (c *Client4) complianceReportsRoute() string {
	return "/compliance/reports"
}

func (c *Client4) complianceReportRoute(reportId string) string {
	return fmt.Sprintf("%s/%s", c.complianceReportsRoute(), reportId)
}

func (c *Client4) complianceReportDownloadRoute(reportId string) string {
	return fmt.Sprintf("%s/%s/download", c.complianceReportsRoute(), reportId)
}

func (c *Client4) outgoingWebhooksRoute() string {
	return "/hooks/outgoing"
}

func (c *Client4) outgoingWebhookRoute(hookID string) string {
	return fmt.Sprintf(c.outgoingWebhooksRoute()+"/%v", hookID)
}

func (c *Client4) preferencesRoute(userId string) string {
	return fmt.Sprintf(c.userRoute(userId) + "/preferences")
}

func (c *Client4) userStatusRoute(userId string) string {
	return fmt.Sprintf(c.userRoute(userId) + "/status")
}

func (c *Client4) userStatusesRoute() string {
	return fmt.Sprintf(c.usersRoute() + "/status")
}

func (c *Client4) samlRoute() string {
	return "/saml"
}

func (c *Client4) ldapRoute() string {
	return "/ldap"
}

func (c *Client4) brandRoute() string {
	return "/brand"
}

func (c *Client4) dataRetentionRoute() string {
	return "/data_retention"
}

func (c *Client4) dataRetentionPolicyRoute(policyID string) string {
	return fmt.Sprintf(c.dataRetentionRoute()+"/policies/%v", policyID)
}

func (c *Client4) elasticsearchRoute() string {
	return "/elasticsearch"
}

func (c *Client4) bleveRoute() string {
	return "/bleve"
}

func (c *Client4) commandsRoute() string {
	return "/commands"
}

func (c *Client4) commandRoute(commandId string) string {
	return fmt.Sprintf(c.commandsRoute()+"/%v", commandId)
}

func (c *Client4) commandMoveRoute(commandId string) string {
	return fmt.Sprintf(c.commandsRoute()+"/%v/move", commandId)
}

func (c *Client4) draftsRoute() string {
	return "/drafts"
}

func (c *Client4) emojisRoute() string {
	return "/emoji"
}

func (c *Client4) emojiRoute(emojiId string) string {
	return fmt.Sprintf(c.emojisRoute()+"/%v", emojiId)
}

func (c *Client4) emojiByNameRoute(name string) string {
	return fmt.Sprintf(c.emojisRoute()+"/name/%v", name)
}

func (c *Client4) reactionsRoute() string {
	return "/reactions"
}

func (c *Client4) oAuthAppsRoute() string {
	return "/oauth/apps"
}

func (c *Client4) oAuthAppRoute(appId string) string {
	return fmt.Sprintf("/oauth/apps/%v", appId)
}

func (c *Client4) openGraphRoute() string {
	return "/opengraph"
}

func (c *Client4) jobsRoute() string {
	return "/jobs"
}

func (c *Client4) rolesRoute() string {
	return "/roles"
}

func (c *Client4) schemesRoute() string {
	return "/schemes"
}

func (c *Client4) schemeRoute(id string) string {
	return c.schemesRoute() + fmt.Sprintf("/%v", id)
}

func (c *Client4) analyticsRoute() string {
	return "/analytics"
}

func (c *Client4) timezonesRoute() string {
	return fmt.Sprintf(c.systemRoute() + "/timezones")
}

func (c *Client4) channelSchemeRoute(channelId string) string {
	return fmt.Sprintf(c.channelsRoute()+"/%v/scheme", channelId)
}

func (c *Client4) teamSchemeRoute(teamId string) string {
	return fmt.Sprintf(c.teamsRoute()+"/%v/scheme", teamId)
}

func (c *Client4) totalUsersStatsRoute() string {
	return fmt.Sprintf(c.usersRoute() + "/stats")
}

func (c *Client4) redirectLocationRoute() string {
	return "/redirect_location"
}

func (c *Client4) serverBusyRoute() string {
	return "/server_busy"
}

func (c *Client4) userTermsOfServiceRoute(userId string) string {
	return c.userRoute(userId) + "/terms_of_service"
}

func (c *Client4) termsOfServiceRoute() string {
	return "/terms_of_service"
}

func (c *Client4) groupsRoute() string {
	return "/groups"
}

func (c *Client4) publishUserTypingRoute(userId string) string {
	return c.userRoute(userId) + "/typing"
}

func (c *Client4) groupRoute(groupID string) string {
	return fmt.Sprintf("%s/%s", c.groupsRoute(), groupID)
}

func (c *Client4) groupSyncableRoute(groupID, syncableID string, syncableType GroupSyncableType) string {
	return fmt.Sprintf("%s/%ss/%s", c.groupRoute(groupID), strings.ToLower(syncableType.String()), syncableID)
}

func (c *Client4) groupSyncablesRoute(groupID string, syncableType GroupSyncableType) string {
	return fmt.Sprintf("%s/%ss", c.groupRoute(groupID), strings.ToLower(syncableType.String()))
}

func (c *Client4) importsRoute() string {
	return "/imports"
}

func (c *Client4) exportsRoute() string {
	return "/exports"
}

func (c *Client4) exportRoute(name string) string {
	return fmt.Sprintf(c.exportsRoute()+"/%v", name)
}

func (c *Client4) sharedChannelsRoute() string {
	return "/sharedchannels"
}

func (c *Client4) permissionsRoute() string {
	return "/permissions"
}

func (c *Client4) DoAPIGet(url string, etag string) (*http.Response, error) {
	return c.DoAPIRequest(http.MethodGet, c.APIURL+url, "", etag)
}

func (c *Client4) DoAPIPost(url string, data string) (*http.Response, error) {
	return c.DoAPIRequest(http.MethodPost, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIDeleteBytes(url string, data []byte) (*http.Response, error) {
	return c.DoAPIRequestBytes(http.MethodDelete, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIPatchBytes(url string, data []byte) (*http.Response, error) {
	return c.DoAPIRequestBytes(http.MethodPatch, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIPostBytes(url string, data []byte) (*http.Response, error) {
	return c.DoAPIRequestBytes(http.MethodPost, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIPut(url string, data string) (*http.Response, error) {
	return c.DoAPIRequest(http.MethodPut, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIPutBytes(url string, data []byte) (*http.Response, error) {
	return c.DoAPIRequestBytes(http.MethodPut, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIDelete(url string) (*http.Response, error) {
	return c.DoAPIRequest(http.MethodDelete, c.APIURL+url, "", "")
}

func (c *Client4) DoAPIRequest(method, url, data, etag string) (*http.Response, error) {
	return c.DoAPIRequestReader(method, url, strings.NewReader(data), map[string]string{HeaderEtagClient: etag})
}

func (c *Client4) DoAPIRequestWithHeaders(method, url, data string, headers map[string]string) (*http.Response, error) {
	return c.DoAPIRequestReader(method, url, strings.NewReader(data), headers)
}

func (c *Client4) DoAPIRequestBytes(method, url string, data []byte, etag string) (*http.Response, error) {
	return c.DoAPIRequestReader(method, url, bytes.NewReader(data), map[string]string{HeaderEtagClient: etag})
}

func (c *Client4) DoAPIRequestReader(method, url string, data io.Reader, headers map[string]string) (*http.Response, error) {
	rq, err := http.NewRequest(method, url, data)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		rq.Header.Set(k, v)
	}

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	if c.HTTPHeader != nil && len(c.HTTPHeader) > 0 {
		for k, v := range c.HTTPHeader {
			rq.Header.Set(k, v)
		}
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return rp, err
	}

	if rp.StatusCode == 304 {
		return rp, nil
	}

	if rp.StatusCode >= 300 {
		defer closeBody(rp)
		return rp, AppErrorFromJSON(rp.Body)
	}

	return rp, nil
}

func (c *Client4) DoUploadFile(url string, data []byte, contentType string) (*FileUploadResponse, *Response, error) {
	return c.doUploadFile(url, bytes.NewReader(data), contentType, 0)
}

func (c *Client4) doUploadFile(url string, body io.Reader, contentType string, contentLength int64) (*FileUploadResponse, *Response, error) {
	rq, err := http.NewRequest("POST", c.APIURL+url, body)
	if err != nil {
		return nil, nil, err
	}
	if contentLength != 0 {
		rq.ContentLength = contentLength
	}
	rq.Header.Set("Content-Type", contentType)

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return nil, BuildResponse(rp), err
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJSON(rp.Body)
	}

	var res FileUploadResponse
	if err := json.NewDecoder(rp.Body).Decode(&res); err != nil {
		return nil, nil, NewAppError("doUploadFile", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &res, BuildResponse(rp), nil
}

func (c *Client4) DoEmojiUploadFile(url string, data []byte, contentType string) (*Emoji, *Response, error) {
	rq, err := http.NewRequest("POST", c.APIURL+url, bytes.NewReader(data))
	if err != nil {
		return nil, nil, err
	}
	rq.Header.Set("Content-Type", contentType)

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return nil, BuildResponse(rp), err
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJSON(rp.Body)
	}

	var e Emoji
	if err := json.NewDecoder(rp.Body).Decode(&e); err != nil {
		return nil, nil, NewAppError("DoEmojiUploadFile", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &e, BuildResponse(rp), nil
}

func (c *Client4) DoUploadImportTeam(url string, data []byte, contentType string) (map[string]string, *Response, error) {
	rq, err := http.NewRequest("POST", c.APIURL+url, bytes.NewReader(data))
	if err != nil {
		return nil, nil, err
	}
	rq.Header.Set("Content-Type", contentType)

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return nil, BuildResponse(rp), err
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJSON(rp.Body)
	}

	return MapFromJSON(rp.Body), BuildResponse(rp), nil
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
	r, err := c.DoAPIPost("/users/login", MapToJSON(m))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	c.AuthToken = r.Header.Get(HeaderToken)
	c.AuthType = HeaderBearer

	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		return nil, nil, NewAppError("login", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &user, BuildResponse(r), nil
}

// Logout terminates the current user's session.
func (c *Client4) Logout() (*Response, error) {
	r, err := c.DoAPIPost("/users/logout", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	c.AuthToken = ""
	c.AuthType = HeaderBearer
	return BuildResponse(r), nil
}

// SwitchAccountType changes a user's login type from one type to another.
func (c *Client4) SwitchAccountType(switchRequest *SwitchRequest) (string, *Response, error) {
	buf, err := json.Marshal(switchRequest)
	if err != nil {
		return "", BuildResponse(nil), NewAppError("SwitchAccountType", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.usersRoute()+"/login/switch", buf)
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["follow_link"], BuildResponse(r), nil
}

// User Section

// CreateUser creates a user in the system based on the provided user struct.
func (c *Client4) CreateUser(user *User) (*User, *Response, error) {
	userJSON, err := json.Marshal(user)
	if err != nil {
		return nil, nil, NewAppError("CreateUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPost(c.usersRoute(), string(userJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("CreateUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// CreateUserWithToken creates a user in the system based on the provided tokenId.
func (c *Client4) CreateUserWithToken(user *User, tokenId string) (*User, *Response, error) {
	if tokenId == "" {
		return nil, nil, NewAppError("MissingHashOrData", "api.user.create_user.missing_token.app_error", nil, "", http.StatusBadRequest)
	}

	query := "?t=" + tokenId
	buf, err := json.Marshal(user)
	if err != nil {
		return nil, nil, NewAppError("CreateUserWithToken", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.usersRoute()+query, buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("CreateUserWithToken", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// CreateUserWithInviteId creates a user in the system based on the provided invited id.
func (c *Client4) CreateUserWithInviteId(user *User, inviteId string) (*User, *Response, error) {
	if inviteId == "" {
		return nil, nil, NewAppError("MissingInviteId", "api.user.create_user.missing_invite_id.app_error", nil, "", http.StatusBadRequest)
	}

	query := "?iid=" + url.QueryEscape(inviteId)
	buf, err := json.Marshal(user)
	if err != nil {
		return nil, nil, NewAppError("CreateUserWithInviteId", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.usersRoute()+query, buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("CreateUserWithInviteId", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// GetMe returns the logged in user.
func (c *Client4) GetMe(etag string) (*User, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(Me), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u User
	if r.StatusCode == http.StatusNotModified {
		return &u, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("GetMe", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// GetUser returns a user based on the provided user id string.
func (c *Client4) GetUser(userId, etag string) (*User, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u User
	if r.StatusCode == http.StatusNotModified {
		return &u, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("GetUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// GetUserByUsername returns a user based on the provided user name string.
func (c *Client4) GetUserByUsername(userName, etag string) (*User, *Response, error) {
	r, err := c.DoAPIGet(c.userByUsernameRoute(userName), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u User
	if r.StatusCode == http.StatusNotModified {
		return &u, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("GetUserByUsername", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// GetUserByEmail returns a user based on the provided user email string.
func (c *Client4) GetUserByEmail(email, etag string) (*User, *Response, error) {
	r, err := c.DoAPIGet(c.userByEmailRoute(email), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u User
	if r.StatusCode == http.StatusNotModified {
		return &u, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("GetUserByEmail", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// AutocompleteUsersInTeam returns the users on a team based on search term.
func (c *Client4) AutocompleteUsersInTeam(teamId string, username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&name=%v&limit=%d", teamId, username, limit)
	r, err := c.DoAPIGet(c.usersRoute()+"/autocomplete"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u UserAutocomplete
	if r.StatusCode == http.StatusNotModified {
		return &u, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("AutocompleteUsersInTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// AutocompleteUsersInChannel returns the users in a channel based on search term.
func (c *Client4) AutocompleteUsersInChannel(teamId string, channelId string, username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&in_channel=%v&name=%v&limit=%d", teamId, channelId, username, limit)
	r, err := c.DoAPIGet(c.usersRoute()+"/autocomplete"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u UserAutocomplete
	if r.StatusCode == http.StatusNotModified {
		return &u, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("AutocompleteUsersInChannel", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// AutocompleteUsers returns the users in the system based on search term.
func (c *Client4) AutocompleteUsers(username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	query := fmt.Sprintf("?name=%v&limit=%d", username, limit)
	r, err := c.DoAPIGet(c.usersRoute()+"/autocomplete"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u UserAutocomplete
	if r.StatusCode == http.StatusNotModified {
		return &u, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("AutocompleteUsers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// GetDefaultProfileImage gets the default user's profile image. Must be logged in.
func (c *Client4) GetDefaultProfileImage(userId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userId)+"/image/default", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetDefaultProfileImage", "model.client.read_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}

	return data, BuildResponse(r), nil
}

// GetProfileImage gets user's profile image. Must be logged in.
func (c *Client4) GetProfileImage(userId, etag string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userId)+"/image", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetProfileImage", "model.client.read_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return data, BuildResponse(r), nil
}

// GetUsers returns a page of users on the system. Page counting starts at 0.
func (c *Client4) GetUsers(page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersInTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetNewUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetNewUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?sort=create_at&in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetNewUsersInTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetRecentlyActiveUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetRecentlyActiveUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?sort=last_activity_at&in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetRecentlyActiveUsersInTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetActiveUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetActiveUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?active=true&in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetActiveUsersInTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersNotInTeam returns a page of users who are not in a team. Page counting starts at 0.
func (c *Client4) GetUsersNotInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?not_in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersNotInTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersInChannel returns a page of users in a channel. Page counting starts at 0.
func (c *Client4) GetUsersInChannel(channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_channel=%v&page=%v&per_page=%v", channelId, page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersInChannel", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersInChannelByStatus returns a page of users in a channel. Page counting starts at 0. Sorted by Status
func (c *Client4) GetUsersInChannelByStatus(channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_channel=%v&page=%v&per_page=%v&sort=status", channelId, page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersInChannelByStatus", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersNotInChannel returns a page of users not in a channel. Page counting starts at 0.
func (c *Client4) GetUsersNotInChannel(teamId, channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&not_in_channel=%v&page=%v&per_page=%v", teamId, channelId, page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersNotInChannel", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersWithoutTeam returns a page of users on the system that aren't on any teams. Page counting starts at 0.
func (c *Client4) GetUsersWithoutTeam(page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?without_team=1&page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersWithoutTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersInGroup returns a page of users in a group. Page counting starts at 0.
func (c *Client4) GetUsersInGroup(groupID string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_group=%v&page=%v&per_page=%v", groupID, page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersInGroup", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersByIds returns a list of users based on the provided user ids.
func (c *Client4) GetUsersByIds(userIds []string) ([]*User, *Response, error) {
	r, err := c.DoAPIPost(c.usersRoute()+"/ids", ArrayToJSON(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersByIds", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersByIds returns a list of users based on the provided user ids.
func (c *Client4) GetUsersByIdsWithOptions(userIds []string, options *UserGetByIdsOptions) ([]*User, *Response, error) {
	v := url.Values{}
	if options.Since != 0 {
		v.Set("since", fmt.Sprintf("%d", options.Since))
	}

	url := c.usersRoute() + "/ids"
	if len(v) > 0 {
		url += "?" + v.Encode()
	}

	r, err := c.DoAPIPost(url, ArrayToJSON(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersByIdsWithOptions", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersByUsernames returns a list of users based on the provided usernames.
func (c *Client4) GetUsersByUsernames(usernames []string) ([]*User, *Response, error) {
	r, err := c.DoAPIPost(c.usersRoute()+"/usernames", ArrayToJSON(usernames))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersByUsernames", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersByGroupChannelIds returns a map with channel ids as keys
// and a list of users as values based on the provided user ids.
func (c *Client4) GetUsersByGroupChannelIds(groupChannelIds []string) (map[string][]*User, *Response, error) {
	r, err := c.DoAPIPost(c.usersRoute()+"/group_channels", ArrayToJSON(groupChannelIds))
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
		return nil, nil, NewAppError("SearchUsers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.usersRoute()+"/search", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("SearchUsers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// UpdateUser updates a user in the system based on the provided user struct.
func (c *Client4) UpdateUser(user *User) (*User, *Response, error) {
	buf, err := json.Marshal(user)
	if err != nil {
		return nil, nil, NewAppError("UpdateUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.userRoute(user.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("UpdateUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// PatchUser partially updates a user in the system. Any missing fields are not updated.
func (c *Client4) PatchUser(userId string, patch *UserPatch) (*User, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.userRoute(userId)+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("PatchUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// UpdateUserAuth updates a user AuthData (uthData, authService and password) in the system.
func (c *Client4) UpdateUserAuth(userId string, userAuth *UserAuth) (*UserAuth, *Response, error) {
	buf, err := json.Marshal(userAuth)
	if err != nil {
		return nil, nil, NewAppError("UpdateUserAuth", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.userRoute(userId)+"/auth", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var ua UserAuth
	if err := json.NewDecoder(r.Body).Decode(&ua); err != nil {
		return nil, nil, NewAppError("UpdateUserAuth", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &ua, BuildResponse(r), nil
}

// UpdateUserMfa activates multi-factor authentication for a user if activate
// is true and a valid code is provided. If activate is false, then code is not
// required and multi-factor authentication is disabled for the user.
func (c *Client4) UpdateUserMfa(userId, code string, activate bool) (*Response, error) {
	requestBody := make(map[string]any)
	requestBody["activate"] = activate
	requestBody["code"] = code

	r, err := c.DoAPIPut(c.userRoute(userId)+"/mfa", StringInterfaceToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GenerateMfaSecret will generate a new MFA secret for a user and return it as a string and
// as a base64 encoded image QR code.
func (c *Client4) GenerateMfaSecret(userId string) (*MfaSecret, *Response, error) {
	r, err := c.DoAPIPost(c.userRoute(userId)+"/mfa/generate", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var secret MfaSecret
	if err := json.NewDecoder(r.Body).Decode(&secret); err != nil {
		return nil, nil, NewAppError("GenerateMfaSecret", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &secret, BuildResponse(r), nil
}

// UpdateUserPassword updates a user's password. Must be logged in as the user or be a system administrator.
func (c *Client4) UpdateUserPassword(userId, currentPassword, newPassword string) (*Response, error) {
	requestBody := map[string]string{"current_password": currentPassword, "new_password": newPassword}
	r, err := c.DoAPIPut(c.userRoute(userId)+"/password", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateUserHashedPassword updates a user's password with an already-hashed password. Must be a system administrator.
func (c *Client4) UpdateUserHashedPassword(userId, newHashedPassword string) (*Response, error) {
	requestBody := map[string]string{"already_hashed": "true", "new_password": newHashedPassword}
	r, err := c.DoAPIPut(c.userRoute(userId)+"/password", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PromoteGuestToUser convert a guest into a regular user
func (c *Client4) PromoteGuestToUser(guestId string) (*Response, error) {
	r, err := c.DoAPIPost(c.userRoute(guestId)+"/promote", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DemoteUserToGuest convert a regular user into a guest
func (c *Client4) DemoteUserToGuest(guestId string) (*Response, error) {
	r, err := c.DoAPIPost(c.userRoute(guestId)+"/demote", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateUserRoles updates a user's roles in the system. A user can have "system_user" and "system_admin" roles.
func (c *Client4) UpdateUserRoles(userId, roles string) (*Response, error) {
	requestBody := map[string]string{"roles": roles}
	r, err := c.DoAPIPut(c.userRoute(userId)+"/roles", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateUserActive updates status of a user whether active or not.
func (c *Client4) UpdateUserActive(userId string, active bool) (*Response, error) {
	requestBody := make(map[string]any)
	requestBody["active"] = active
	r, err := c.DoAPIPut(c.userRoute(userId)+"/active", StringInterfaceToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

// DeleteUser deactivates a user in the system based on the provided user id string.
func (c *Client4) DeleteUser(userId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.userRoute(userId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PermanentDeleteUser deletes a user in the system based on the provided user id string.
func (c *Client4) PermanentDeleteUser(userId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.userRoute(userId) + "?permanent=" + c.boolString(true))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ConvertUserToBot converts a user to a bot user.
func (c *Client4) ConvertUserToBot(userId string) (*Bot, *Response, error) {
	r, err := c.DoAPIPost(c.userRoute(userId)+"/convert_to_bot", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("ConvertUserToBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
		return nil, nil, NewAppError("ConvertBotToUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.botRoute(userId)+"/convert_to_user"+query, buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("ConvertBotToUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// PermanentDeleteAll permanently deletes all users in the system. This is a local only endpoint
func (c *Client4) PermanentDeleteAllUsers() (*Response, error) {
	r, err := c.DoAPIDelete(c.usersRoute())
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SendPasswordResetEmail will send a link for password resetting to a user with the
// provided email.
func (c *Client4) SendPasswordResetEmail(email string) (*Response, error) {
	requestBody := map[string]string{"email": email}
	r, err := c.DoAPIPost(c.usersRoute()+"/password/reset/send", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ResetPassword uses a recovery code to update reset a user's password.
func (c *Client4) ResetPassword(token, newPassword string) (*Response, error) {
	requestBody := map[string]string{"token": token, "new_password": newPassword}
	r, err := c.DoAPIPost(c.usersRoute()+"/password/reset", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetSessions returns a list of sessions based on the provided user id string.
func (c *Client4) GetSessions(userId, etag string) ([]*Session, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userId)+"/sessions", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Session
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetSessions", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// RevokeSession revokes a user session based on the provided user id and session id strings.
func (c *Client4) RevokeSession(userId, sessionId string) (*Response, error) {
	requestBody := map[string]string{"session_id": sessionId}
	r, err := c.DoAPIPost(c.userRoute(userId)+"/sessions/revoke", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RevokeAllSessions revokes all sessions for the provided user id string.
func (c *Client4) RevokeAllSessions(userId string) (*Response, error) {
	r, err := c.DoAPIPost(c.userRoute(userId)+"/sessions/revoke/all", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RevokeAllSessions revokes all sessions for all the users.
func (c *Client4) RevokeSessionsFromAllUsers() (*Response, error) {
	r, err := c.DoAPIPost(c.usersRoute()+"/sessions/revoke/all", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AttachDeviceId attaches a mobile device ID to the current session.
func (c *Client4) AttachDeviceId(deviceId string) (*Response, error) {
	requestBody := map[string]string{"device_id": deviceId}
	r, err := c.DoAPIPut(c.usersRoute()+"/sessions/device", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
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

	r, err := c.DoAPIGet(c.userRoute(userId)+"/teams/unread?"+query.Encode(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var list []*TeamUnread
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetTeamsUnreadForUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUserAudits returns a list of audit based on the provided user id string.
func (c *Client4) GetUserAudits(userId string, page int, perPage int, etag string) (Audits, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.userRoute(userId)+"/audits"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var audits Audits
	err = json.NewDecoder(r.Body).Decode(&audits)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetUserAudits", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return audits, BuildResponse(r), nil
}

// VerifyUserEmail will verify a user's email using the supplied token.
func (c *Client4) VerifyUserEmail(token string) (*Response, error) {
	requestBody := map[string]string{"token": token}
	r, err := c.DoAPIPost(c.usersRoute()+"/email/verify", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// VerifyUserEmailWithoutToken will verify a user's email by its Id. (Requires manage system role)
func (c *Client4) VerifyUserEmailWithoutToken(userId string) (*User, *Response, error) {
	r, err := c.DoAPIPost(c.userRoute(userId)+"/email/verify/member", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("VerifyUserEmailWithoutToken", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// SendVerificationEmail will send an email to the user with the provided email address, if
// that user exists. The email will contain a link that can be used to verify the user's
// email address.
func (c *Client4) SendVerificationEmail(email string) (*Response, error) {
	requestBody := map[string]string{"email": email}
	r, err := c.DoAPIPost(c.usersRoute()+"/email/verify/send", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SetDefaultProfileImage resets the profile image to a default generated one.
func (c *Client4) SetDefaultProfileImage(userId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.userRoute(userId) + "/image")
	if err != nil {
		return BuildResponse(r), err
	}
	return BuildResponse(r), nil
}

// SetProfileImage sets profile image of the user.
func (c *Client4) SetProfileImage(userId string, data []byte) (*Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", "profile.png")
	if err != nil {
		return nil, NewAppError("SetProfileImage", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, NewAppError("SetProfileImage", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if err = writer.Close(); err != nil {
		return nil, NewAppError("SetProfileImage", "model.client.set_profile_user.writer.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	rq, err := http.NewRequest("POST", c.APIURL+c.userRoute(userId)+"/image", bytes.NewReader(body.Bytes()))
	if err != nil {
		return nil, err
	}
	rq.Header.Set("Content-Type", writer.FormDataContentType())

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return BuildResponse(rp), err
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return BuildResponse(rp), AppErrorFromJSON(rp.Body)
	}

	return BuildResponse(rp), nil
}

// CreateUserAccessToken will generate a user access token that can be used in place
// of a session token to access the REST API. Must have the 'create_user_access_token'
// permission and if generating for another user, must have the 'edit_other_users'
// permission. A non-blank description is required.
func (c *Client4) CreateUserAccessToken(userId, description string) (*UserAccessToken, *Response, error) {
	requestBody := map[string]string{"description": description}
	r, err := c.DoAPIPost(c.userRoute(userId)+"/tokens", MapToJSON(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var uat UserAccessToken
	if err := json.NewDecoder(r.Body).Decode(&uat); err != nil {
		return nil, nil, NewAppError("CreateUserAccessToken", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &uat, BuildResponse(r), nil
}

// GetUserAccessTokens will get a page of access tokens' id, description, is_active
// and the user_id in the system. The actual token will not be returned. Must have
// the 'manage_system' permission.
func (c *Client4) GetUserAccessTokens(page int, perPage int) ([]*UserAccessToken, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.userAccessTokensRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*UserAccessToken
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUserAccessTokens", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUserAccessToken will get a user access tokens' id, description, is_active
// and the user_id of the user it is for. The actual token will not be returned.
// Must have the 'read_user_access_token' permission and if getting for another
// user, must have the 'edit_other_users' permission.
func (c *Client4) GetUserAccessToken(tokenId string) (*UserAccessToken, *Response, error) {
	r, err := c.DoAPIGet(c.userAccessTokenRoute(tokenId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var uat UserAccessToken
	if err := json.NewDecoder(r.Body).Decode(&uat); err != nil {
		return nil, nil, NewAppError("GetUserAccessToken", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &uat, BuildResponse(r), nil
}

// GetUserAccessTokensForUser will get a paged list of user access tokens showing id,
// description and user_id for each. The actual tokens will not be returned. Must have
// the 'read_user_access_token' permission and if getting for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) GetUserAccessTokensForUser(userId string, page, perPage int) ([]*UserAccessToken, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.userRoute(userId)+"/tokens"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*UserAccessToken
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUserAccessTokensForUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// RevokeUserAccessToken will revoke a user access token by id. Must have the
// 'revoke_user_access_token' permission and if revoking for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) RevokeUserAccessToken(tokenId string) (*Response, error) {
	requestBody := map[string]string{"token_id": tokenId}
	r, err := c.DoAPIPost(c.usersRoute()+"/tokens/revoke", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SearchUserAccessTokens returns user access tokens matching the provided search term.
func (c *Client4) SearchUserAccessTokens(search *UserAccessTokenSearch) ([]*UserAccessToken, *Response, error) {
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchUserAccessTokens", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.usersRoute()+"/tokens/search", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*UserAccessToken
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("SearchUserAccessTokens", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// DisableUserAccessToken will disable a user access token by id. Must have the
// 'revoke_user_access_token' permission and if disabling for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) DisableUserAccessToken(tokenId string) (*Response, error) {
	requestBody := map[string]string{"token_id": tokenId}
	r, err := c.DoAPIPost(c.usersRoute()+"/tokens/disable", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// EnableUserAccessToken will enable a user access token by id. Must have the
// 'create_user_access_token' permission and if enabling for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) EnableUserAccessToken(tokenId string) (*Response, error) {
	requestBody := map[string]string{"token_id": tokenId}
	r, err := c.DoAPIPost(c.usersRoute()+"/tokens/enable", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Bots section

// CreateBot creates a bot in the system based on the provided bot struct.
func (c *Client4) CreateBot(bot *Bot) (*Bot, *Response, error) {
	buf, err := json.Marshal(bot)
	if err != nil {
		return nil, nil, NewAppError("CreateBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.botsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var resp *Bot
	err = json.NewDecoder(r.Body).Decode(&resp)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("CreateBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return resp, BuildResponse(r), nil
}

// PatchBot partially updates a bot. Any missing fields are not updated.
func (c *Client4) PatchBot(userId string, patch *BotPatch) (*Bot, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.botRoute(userId), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("PatchBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return bot, BuildResponse(r), nil
}

// GetBot fetches the given, undeleted bot.
func (c *Client4) GetBot(userId string, etag string) (*Bot, *Response, error) {
	r, err := c.DoAPIGet(c.botRoute(userId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return bot, BuildResponse(r), nil
}

// GetBotIncludeDeleted fetches the given bot, even if it is deleted.
func (c *Client4) GetBotIncludeDeleted(userId string, etag string) (*Bot, *Response, error) {
	r, err := c.DoAPIGet(c.botRoute(userId)+"?include_deleted="+c.boolString(true), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBotIncludeDeleted", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return bot, BuildResponse(r), nil
}

// GetBots fetches the given page of bots, excluding deleted.
func (c *Client4) GetBots(page, perPage int, etag string) ([]*Bot, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.botsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bots BotList
	err = json.NewDecoder(r.Body).Decode(&bots)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBots", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return bots, BuildResponse(r), nil
}

// GetBotsIncludeDeleted fetches the given page of bots, including deleted.
func (c *Client4) GetBotsIncludeDeleted(page, perPage int, etag string) ([]*Bot, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_deleted="+c.boolString(true), page, perPage)
	r, err := c.DoAPIGet(c.botsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bots BotList
	err = json.NewDecoder(r.Body).Decode(&bots)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBotsIncludeDeleted", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return bots, BuildResponse(r), nil
}

// GetBotsOrphaned fetches the given page of bots, only including orphaned bots.
func (c *Client4) GetBotsOrphaned(page, perPage int, etag string) ([]*Bot, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&only_orphaned="+c.boolString(true), page, perPage)
	r, err := c.DoAPIGet(c.botsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bots BotList
	err = json.NewDecoder(r.Body).Decode(&bots)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBotsOrphaned", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return bots, BuildResponse(r), nil
}

// DisableBot disables the given bot in the system.
func (c *Client4) DisableBot(botUserId string) (*Bot, *Response, error) {
	r, err := c.DoAPIPostBytes(c.botRoute(botUserId)+"/disable", nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("DisableBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return bot, BuildResponse(r), nil
}

// EnableBot disables the given bot in the system.
func (c *Client4) EnableBot(botUserId string) (*Bot, *Response, error) {
	r, err := c.DoAPIPostBytes(c.botRoute(botUserId)+"/enable", nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("EnableBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return bot, BuildResponse(r), nil
}

// AssignBot assigns the given bot to the given user
func (c *Client4) AssignBot(botUserId, newOwnerId string) (*Bot, *Response, error) {
	r, err := c.DoAPIPostBytes(c.botRoute(botUserId)+"/assign/"+newOwnerId, nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var bot *Bot
	err = json.NewDecoder(r.Body).Decode(&bot)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("AssignBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return bot, BuildResponse(r), nil
}

// Team Section

// CreateTeam creates a team in the system based on the provided team struct.
func (c *Client4) CreateTeam(team *Team) (*Team, *Response, error) {
	buf, err := json.Marshal(team)
	if err != nil {
		return nil, nil, NewAppError("CreateTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.teamsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var t Team
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		return nil, nil, NewAppError("CreateTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &t, BuildResponse(r), nil
}

// GetTeam returns a team based on the provided team id string.
func (c *Client4) GetTeam(teamId, etag string) (*Team, *Response, error) {
	r, err := c.DoAPIGet(c.teamRoute(teamId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var t Team
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		return nil, nil, NewAppError("GetTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &t, BuildResponse(r), nil
}

// GetAllTeams returns all teams based on permissions.
func (c *Client4) GetAllTeams(etag string, page int, perPage int) ([]*Team, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.teamsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Team
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetAllTeams", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetAllTeamsWithTotalCount returns all teams based on permissions.
func (c *Client4) GetAllTeamsWithTotalCount(etag string, page int, perPage int) ([]*Team, int64, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_total_count="+c.boolString(true), page, perPage)
	r, err := c.DoAPIGet(c.teamsRoute()+query, etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)
	var listWithCount TeamsWithCount
	if err := json.NewDecoder(r.Body).Decode(&listWithCount); err != nil {
		return nil, 0, nil, NewAppError("GetAllTeamsWithTotalCount", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return listWithCount.Teams, listWithCount.TotalCount, BuildResponse(r), nil
}

// GetAllTeamsExcludePolicyConstrained returns all teams which are not part of a data retention policy.
// Must be a system administrator.
func (c *Client4) GetAllTeamsExcludePolicyConstrained(etag string, page int, perPage int) ([]*Team, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&exclude_policy_constrained=%v", page, perPage, true)
	r, err := c.DoAPIGet(c.teamsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Team
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetAllTeamsExcludePolicyConstrained", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetTeamByName returns a team based on the provided team name string.
func (c *Client4) GetTeamByName(name, etag string) (*Team, *Response, error) {
	r, err := c.DoAPIGet(c.teamByNameRoute(name), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var t Team
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		return nil, nil, NewAppError("GetTeamByName", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &t, BuildResponse(r), nil
}

// SearchTeams returns teams matching the provided search term.
func (c *Client4) SearchTeams(search *TeamSearch) ([]*Team, *Response, error) {
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchTeams", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.teamsRoute()+"/search", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Team
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("SearchTeams", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
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
		return nil, 0, BuildResponse(nil), NewAppError("SearchTeamsPaged", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.teamsRoute()+"/search", buf)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)
	var listWithCount TeamsWithCount
	if err := json.NewDecoder(r.Body).Decode(&listWithCount); err != nil {
		return nil, 0, nil, NewAppError("GetAllTeamsWithTotalCount", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return listWithCount.Teams, listWithCount.TotalCount, BuildResponse(r), nil
}

// TeamExists returns true or false if the team exist or not.
func (c *Client4) TeamExists(name, etag string) (bool, *Response, error) {
	r, err := c.DoAPIGet(c.teamByNameRoute(name)+"/exists", etag)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapBoolFromJSON(r.Body)["exists"], BuildResponse(r), nil
}

// GetTeamsForUser returns a list of teams a user is on. Must be logged in as the user
// or be a system administrator.
func (c *Client4) GetTeamsForUser(userId, etag string) ([]*Team, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userId)+"/teams", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Team
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetTeamsForUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetTeamMember returns a team member based on the provided team and user id strings.
func (c *Client4) GetTeamMember(teamId, userId, etag string) (*TeamMember, *Response, error) {
	r, err := c.DoAPIGet(c.teamMemberRoute(teamId, userId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tm TeamMember
	if r.StatusCode == http.StatusNotModified {
		return &tm, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&tm); err != nil {
		return nil, nil, NewAppError("GetTeamMember", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &tm, BuildResponse(r), nil
}

// UpdateTeamMemberRoles will update the roles on a team for a user.
func (c *Client4) UpdateTeamMemberRoles(teamId, userId, newRoles string) (*Response, error) {
	requestBody := map[string]string{"roles": newRoles}
	r, err := c.DoAPIPut(c.teamMemberRoute(teamId, userId)+"/roles", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateTeamMemberSchemeRoles will update the scheme-derived roles on a team for a user.
func (c *Client4) UpdateTeamMemberSchemeRoles(teamId string, userId string, schemeRoles *SchemeRoles) (*Response, error) {
	buf, err := json.Marshal(schemeRoles)
	if err != nil {
		return nil, NewAppError("UpdateTeamMemberSchemeRoles", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.teamMemberRoute(teamId, userId)+"/schemeRoles", buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateTeam will update a team.
func (c *Client4) UpdateTeam(team *Team) (*Team, *Response, error) {
	buf, err := json.Marshal(team)
	if err != nil {
		return nil, nil, NewAppError("UpdateTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.teamRoute(team.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var t Team
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		return nil, nil, NewAppError("UpdateTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &t, BuildResponse(r), nil
}

// PatchTeam partially updates a team. Any missing fields are not updated.
func (c *Client4) PatchTeam(teamId string, patch *TeamPatch) (*Team, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.teamRoute(teamId)+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var t Team
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		return nil, nil, NewAppError("PatchTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &t, BuildResponse(r), nil
}

// RestoreTeam restores a previously deleted team.
func (c *Client4) RestoreTeam(teamId string) (*Team, *Response, error) {
	r, err := c.DoAPIPost(c.teamRoute(teamId)+"/restore", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var t Team
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		return nil, nil, NewAppError("RestoreTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &t, BuildResponse(r), nil
}

// RegenerateTeamInviteId requests a new invite ID to be generated.
func (c *Client4) RegenerateTeamInviteId(teamId string) (*Team, *Response, error) {
	r, err := c.DoAPIPost(c.teamRoute(teamId)+"/regenerate_invite_id", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var t Team
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		return nil, nil, NewAppError("RegenerateTeamInviteId", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &t, BuildResponse(r), nil
}

// SoftDeleteTeam deletes the team softly (archive only, not permanent delete).
func (c *Client4) SoftDeleteTeam(teamId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.teamRoute(teamId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PermanentDeleteTeam deletes the team, should only be used when needed for
// compliance and the like.
func (c *Client4) PermanentDeleteTeam(teamId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.teamRoute(teamId) + "?permanent=" + c.boolString(true))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateTeamPrivacy modifies the team type (model.TeamOpen <--> model.TeamInvite) and sets
// the corresponding AllowOpenInvite appropriately.
func (c *Client4) UpdateTeamPrivacy(teamId string, privacy string) (*Team, *Response, error) {
	requestBody := map[string]string{"privacy": privacy}
	r, err := c.DoAPIPut(c.teamRoute(teamId)+"/privacy", MapToJSON(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var t Team
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		return nil, nil, NewAppError("UpdateTeamPrivacy", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &t, BuildResponse(r), nil
}

// GetTeamMembers returns team members based on the provided team id string.
func (c *Client4) GetTeamMembers(teamId string, page int, perPage int, etag string) ([]*TeamMember, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.teamMembersRoute(teamId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tms []*TeamMember
	if r.StatusCode == http.StatusNotModified {
		return tms, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&tms); err != nil {
		return nil, nil, NewAppError("GetTeamMembers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return tms, BuildResponse(r), nil
}

// GetTeamMembersWithoutDeletedUsers returns team members based on the provided team id string. Additional parameters of sort and exclude_deleted_users accepted as well
// Could not add it to above function due to it be a breaking change.
func (c *Client4) GetTeamMembersSortAndWithoutDeletedUsers(teamId string, page int, perPage int, sort string, excludeDeletedUsers bool, etag string) ([]*TeamMember, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&sort=%v&exclude_deleted_users=%v", page, perPage, sort, excludeDeletedUsers)
	r, err := c.DoAPIGet(c.teamMembersRoute(teamId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tms []*TeamMember
	if r.StatusCode == http.StatusNotModified {
		return tms, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&tms); err != nil {
		return nil, nil, NewAppError("GetTeamMembersSortAndWithoutDeletedUsers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return tms, BuildResponse(r), nil
}

// GetTeamMembersForUser returns the team members for a user.
func (c *Client4) GetTeamMembersForUser(userId string, etag string) ([]*TeamMember, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userId)+"/teams/members", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tms []*TeamMember
	if r.StatusCode == http.StatusNotModified {
		return tms, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&tms); err != nil {
		return nil, nil, NewAppError("GetTeamMembersForUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return tms, BuildResponse(r), nil
}

// GetTeamMembersByIds will return an array of team members based on the
// team id and a list of user ids provided. Must be authenticated.
func (c *Client4) GetTeamMembersByIds(teamId string, userIds []string) ([]*TeamMember, *Response, error) {
	r, err := c.DoAPIPost(fmt.Sprintf("/teams/%v/members/ids", teamId), ArrayToJSON(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tms []*TeamMember
	if err := json.NewDecoder(r.Body).Decode(&tms); err != nil {
		return nil, nil, NewAppError("GetTeamMembersByIds", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return tms, BuildResponse(r), nil
}

// AddTeamMember adds user to a team and return a team member.
func (c *Client4) AddTeamMember(teamId, userId string) (*TeamMember, *Response, error) {
	member := &TeamMember{TeamId: teamId, UserId: userId}
	buf, err := json.Marshal(member)
	if err != nil {
		return nil, nil, NewAppError("AddTeamMember", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.teamMembersRoute(teamId), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tm TeamMember
	if err := json.NewDecoder(r.Body).Decode(&tm); err != nil {
		return nil, nil, NewAppError("AddTeamMember", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &tm, BuildResponse(r), nil
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

	r, err := c.DoAPIPost(c.teamsRoute()+"/members/invite"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tm TeamMember
	if err := json.NewDecoder(r.Body).Decode(&tm); err != nil {
		return nil, nil, NewAppError("AddTeamMemberFromInvite", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &tm, BuildResponse(r), nil
}

// AddTeamMembers adds a number of users to a team and returns the team members.
func (c *Client4) AddTeamMembers(teamId string, userIds []string) ([]*TeamMember, *Response, error) {
	var members []*TeamMember
	for _, userId := range userIds {
		member := &TeamMember{TeamId: teamId, UserId: userId}
		members = append(members, member)
	}
	js, err := json.Marshal(members)
	if err != nil {
		return nil, nil, NewAppError("AddTeamMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.teamMembersRoute(teamId)+"/batch", string(js))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tms []*TeamMember
	if err := json.NewDecoder(r.Body).Decode(&tms); err != nil {
		return nil, nil, NewAppError("AddTeamMembers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return tms, BuildResponse(r), nil
}

// AddTeamMembers adds a number of users to a team and returns the team members.
func (c *Client4) AddTeamMembersGracefully(teamId string, userIds []string) ([]*TeamMemberWithError, *Response, error) {
	var members []*TeamMember
	for _, userId := range userIds {
		member := &TeamMember{TeamId: teamId, UserId: userId}
		members = append(members, member)
	}
	js, err := json.Marshal(members)
	if err != nil {
		return nil, nil, NewAppError("AddTeamMembersGracefully", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPost(c.teamMembersRoute(teamId)+"/batch?graceful="+c.boolString(true), string(js))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tms []*TeamMemberWithError
	if err := json.NewDecoder(r.Body).Decode(&tms); err != nil {
		return nil, nil, NewAppError("AddTeamMembersGracefully", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return tms, BuildResponse(r), nil
}

// RemoveTeamMember will remove a user from a team.
func (c *Client4) RemoveTeamMember(teamId, userId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.teamMemberRoute(teamId, userId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTeamStats returns a team stats based on the team id string.
// Must be authenticated.
func (c *Client4) GetTeamStats(teamId, etag string) (*TeamStats, *Response, error) {
	r, err := c.DoAPIGet(c.teamStatsRoute(teamId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var ts TeamStats
	if err := json.NewDecoder(r.Body).Decode(&ts); err != nil {
		return nil, nil, NewAppError("GetTeamStats", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &ts, BuildResponse(r), nil
}

// GetTotalUsersStats returns a total system user stats.
// Must be authenticated.
func (c *Client4) GetTotalUsersStats(etag string) (*UsersStats, *Response, error) {
	r, err := c.DoAPIGet(c.totalUsersStatsRoute(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var stats UsersStats
	if err := json.NewDecoder(r.Body).Decode(&stats); err != nil {
		return nil, nil, NewAppError("GetTotalUsersStats", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &stats, BuildResponse(r), nil
}

// GetTeamUnread will return a TeamUnread object that contains the amount of
// unread messages and mentions the user has for the specified team.
// Must be authenticated.
func (c *Client4) GetTeamUnread(teamId, userId string) (*TeamUnread, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userId)+c.teamRoute(teamId)+"/unread", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tu TeamUnread
	if err := json.NewDecoder(r.Body).Decode(&tu); err != nil {
		return nil, nil, NewAppError("GetTeamUnread", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &tu, BuildResponse(r), nil
}

// ImportTeam will import an exported team from other app into a existing team.
func (c *Client4) ImportTeam(data []byte, filesize int, importFrom, filename, teamId string) (map[string]string, *Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, nil, err
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, nil, err
	}

	part, err = writer.CreateFormField("filesize")
	if err != nil {
		return nil, nil, err
	}

	if _, err = io.Copy(part, strings.NewReader(strconv.Itoa(filesize))); err != nil {
		return nil, nil, err
	}

	part, err = writer.CreateFormField("importFrom")
	if err != nil {
		return nil, nil, err
	}

	if _, err := io.Copy(part, strings.NewReader(importFrom)); err != nil {
		return nil, nil, err
	}

	if err := writer.Close(); err != nil {
		return nil, nil, err
	}

	return c.DoUploadImportTeam(c.teamImportRoute(teamId), body.Bytes(), writer.FormDataContentType())
}

// InviteUsersToTeam invite users by email to the team.
func (c *Client4) InviteUsersToTeam(teamId string, userEmails []string) (*Response, error) {
	r, err := c.DoAPIPost(c.teamRoute(teamId)+"/invite/email", ArrayToJSON(userEmails))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// InviteGuestsToTeam invite guest by email to some channels in a team.
func (c *Client4) InviteGuestsToTeam(teamId string, userEmails []string, channels []string, message string) (*Response, error) {
	guestsInvite := GuestsInvite{
		Emails:   userEmails,
		Channels: channels,
		Message:  message,
	}
	buf, err := json.Marshal(guestsInvite)
	if err != nil {
		return nil, NewAppError("InviteGuestsToTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.teamRoute(teamId)+"/invite-guests/email", buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// InviteUsersToTeam invite users by email to the team.
func (c *Client4) InviteUsersToTeamGracefully(teamId string, userEmails []string) ([]*EmailInviteWithError, *Response, error) {
	r, err := c.DoAPIPost(c.teamRoute(teamId)+"/invite/email?graceful="+c.boolString(true), ArrayToJSON(userEmails))

	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*EmailInviteWithError
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("InviteUsersToTeamGracefully", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// InviteUsersToTeam invite users by email to the team.
func (c *Client4) InviteUsersToTeamAndChannelsGracefully(teamId string, userEmails []string, channelIds []string, message string) ([]*EmailInviteWithError, *Response, error) {
	memberInvite := MemberInvite{
		Emails:     userEmails,
		ChannelIds: channelIds,
		Message:    message,
	}
	buf, err := json.Marshal(memberInvite)
	if err != nil {
		return nil, nil, NewAppError("InviteMembersToTeamAndChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.teamRoute(teamId)+"/invite/email?graceful="+c.boolString(true), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*EmailInviteWithError
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("InviteUsersToTeamGracefully", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
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
		return nil, nil, NewAppError("InviteGuestsToTeamGracefully", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.teamRoute(teamId)+"/invite-guests/email?graceful="+c.boolString(true), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*EmailInviteWithError
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("InviteGuestsToTeamGracefully", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// InvalidateEmailInvites will invalidate active email invitations that have not been accepted by the user.
func (c *Client4) InvalidateEmailInvites() (*Response, error) {
	r, err := c.DoAPIDelete(c.teamsRoute() + "/invites/email")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTeamInviteInfo returns a team object from an invite id containing sanitized information.
func (c *Client4) GetTeamInviteInfo(inviteId string) (*Team, *Response, error) {
	r, err := c.DoAPIGet(c.teamsRoute()+"/invite/"+inviteId, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var t Team
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		return nil, nil, NewAppError("GetTeamInviteInfo", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &t, BuildResponse(r), nil
}

// SetTeamIcon sets team icon of the team.
func (c *Client4) SetTeamIcon(teamId string, data []byte) (*Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", "teamIcon.png")
	if err != nil {
		return nil, NewAppError("SetTeamIcon", "model.client.set_team_icon.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, NewAppError("SetTeamIcon", "model.client.set_team_icon.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if err = writer.Close(); err != nil {
		return nil, NewAppError("SetTeamIcon", "model.client.set_team_icon.writer.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	rq, err := http.NewRequest("POST", c.APIURL+c.teamRoute(teamId)+"/image", bytes.NewReader(body.Bytes()))
	if err != nil {
		return nil, err
	}
	rq.Header.Set("Content-Type", writer.FormDataContentType())

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return BuildResponse(rp), err
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return BuildResponse(rp), AppErrorFromJSON(rp.Body)
	}

	return BuildResponse(rp), nil
}

// GetTeamIcon gets the team icon of the team.
func (c *Client4) GetTeamIcon(teamId, etag string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.teamRoute(teamId)+"/image", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetTeamIcon", "model.client.get_team_icon.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return data, BuildResponse(r), nil
}

// RemoveTeamIcon updates LastTeamIconUpdate to 0 which indicates team icon is removed.
func (c *Client4) RemoveTeamIcon(teamId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.teamRoute(teamId) + "/image")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Channel Section

// GetAllChannels get all the channels. Must be a system administrator.
func (c *Client4) GetAllChannels(page int, perPage int, etag string) (ChannelListWithTeamData, *Response, error) {
	return c.getAllChannels(page, perPage, etag, ChannelSearchOpts{})
}

// GetAllChannelsIncludeDeleted get all the channels. Must be a system administrator.
func (c *Client4) GetAllChannelsIncludeDeleted(page int, perPage int, etag string) (ChannelListWithTeamData, *Response, error) {
	return c.getAllChannels(page, perPage, etag, ChannelSearchOpts{IncludeDeleted: true})
}

// GetAllChannelsExcludePolicyConstrained gets all channels which are not part of a data retention policy.
// Must be a system administrator.
func (c *Client4) GetAllChannelsExcludePolicyConstrained(page, perPage int, etag string) (ChannelListWithTeamData, *Response, error) {
	return c.getAllChannels(page, perPage, etag, ChannelSearchOpts{ExcludePolicyConstrained: true})
}

func (c *Client4) getAllChannels(page int, perPage int, etag string, opts ChannelSearchOpts) (ChannelListWithTeamData, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_deleted=%v&exclude_policy_constrained=%v",
		page, perPage, opts.IncludeDeleted, opts.ExcludePolicyConstrained)
	r, err := c.DoAPIGet(c.channelsRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelListWithTeamData
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("getAllChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetAllChannelsWithCount get all the channels including the total count. Must be a system administrator.
func (c *Client4) GetAllChannelsWithCount(page int, perPage int, etag string) (ChannelListWithTeamData, int64, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_total_count="+c.boolString(true), page, perPage)
	r, err := c.DoAPIGet(c.channelsRoute()+query, etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)

	var cwc *ChannelsWithCount
	err = json.NewDecoder(r.Body).Decode(&cwc)
	if err != nil {
		return nil, 0, BuildResponse(r), NewAppError("GetAllChannelsWithCount", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return cwc.Channels, cwc.TotalCount, BuildResponse(r), nil
}

// CreateChannel creates a channel based on the provided channel struct.
func (c *Client4) CreateChannel(channel *Channel) (*Channel, *Response, error) {
	channelJSON, err := json.Marshal(channel)
	if err != nil {
		return nil, nil, NewAppError("CreateChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.channelsRoute(), string(channelJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("CreateChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// UpdateChannel updates a channel based on the provided channel struct.
func (c *Client4) UpdateChannel(channel *Channel) (*Channel, *Response, error) {
	channelJSON, err := json.Marshal(channel)
	if err != nil {
		return nil, nil, NewAppError("UpdateChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPut(c.channelRoute(channel.Id), string(channelJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("UpdateChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// PatchChannel partially updates a channel. Any missing fields are not updated.
func (c *Client4) PatchChannel(channelId string, patch *ChannelPatch) (*Channel, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.channelRoute(channelId)+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("PatchChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// UpdateChannelPrivacy updates channel privacy
func (c *Client4) UpdateChannelPrivacy(channelId string, privacy ChannelType) (*Channel, *Response, error) {
	requestBody := map[string]string{"privacy": string(privacy)}
	r, err := c.DoAPIPut(c.channelRoute(channelId)+"/privacy", MapToJSON(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("UpdateChannelPrivacy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// RestoreChannel restores a previously deleted channel. Any missing fields are not updated.
func (c *Client4) RestoreChannel(channelId string) (*Channel, *Response, error) {
	r, err := c.DoAPIPost(c.channelRoute(channelId)+"/restore", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("RestoreChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// CreateDirectChannel creates a direct message channel based on the two user
// ids provided.
func (c *Client4) CreateDirectChannel(userId1, userId2 string) (*Channel, *Response, error) {
	requestBody := []string{userId1, userId2}
	r, err := c.DoAPIPost(c.channelsRoute()+"/direct", ArrayToJSON(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("CreateDirectChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// CreateGroupChannel creates a group message channel based on userIds provided.
func (c *Client4) CreateGroupChannel(userIds []string) (*Channel, *Response, error) {
	r, err := c.DoAPIPost(c.channelsRoute()+"/group", ArrayToJSON(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("CreateGroupChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannel returns a channel based on the provided channel id string.
func (c *Client4) GetChannel(channelId, etag string) (*Channel, *Response, error) {
	r, err := c.DoAPIGet(c.channelRoute(channelId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelStats returns statistics for a channel.
func (c *Client4) GetChannelStats(channelId string, etag string) (*ChannelStats, *Response, error) {
	r, err := c.DoAPIGet(c.channelRoute(channelId)+"/stats", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var stats ChannelStats
	if err := json.NewDecoder(r.Body).Decode(&stats); err != nil {
		return nil, nil, NewAppError("GetChannelStats", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &stats, BuildResponse(r), nil
}

// GetChannelMembersTimezones gets a list of timezones for a channel.
func (c *Client4) GetChannelMembersTimezones(channelId string) ([]string, *Response, error) {
	r, err := c.DoAPIGet(c.channelRoute(channelId)+"/timezones", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJSON(r.Body), BuildResponse(r), nil
}

// GetPinnedPosts gets a list of pinned posts.
func (c *Client4) GetPinnedPosts(channelId string, etag string) (*PostList, *Response, error) {
	r, err := c.DoAPIGet(c.channelRoute(channelId)+"/pinned", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}

	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetPinnedPosts", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
}

// GetPrivateChannelsForTeam returns a list of private channels based on the provided team id string.
func (c *Client4) GetPrivateChannelsForTeam(teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	query := fmt.Sprintf("/private?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.channelsForTeamRoute(teamId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetPrivateChannelsForTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetPublicChannelsForTeam returns a list of public channels based on the provided team id string.
func (c *Client4) GetPublicChannelsForTeam(teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.channelsForTeamRoute(teamId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetPublicChannelsForTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetDeletedChannelsForTeam returns a list of public channels based on the provided team id string.
func (c *Client4) GetDeletedChannelsForTeam(teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	query := fmt.Sprintf("/deleted?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.channelsForTeamRoute(teamId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetDeletedChannelsForTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetPublicChannelsByIdsForTeam returns a list of public channels based on provided team id string.
func (c *Client4) GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) ([]*Channel, *Response, error) {
	r, err := c.DoAPIPost(c.channelsForTeamRoute(teamId)+"/ids", ArrayToJSON(channelIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetPublicChannelsByIdsForTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelsForTeamForUser returns a list channels of on a team for a user.
func (c *Client4) GetChannelsForTeamForUser(teamId, userId string, includeDeleted bool, etag string) ([]*Channel, *Response, error) {
	r, err := c.DoAPIGet(c.channelsForTeamForUserRoute(teamId, userId, includeDeleted), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelsForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelsForTeamAndUserWithLastDeleteAt returns a list channels of a team for a user, additionally filtered with lastDeleteAt. This does not have any effect if includeDeleted is set to false.
func (c *Client4) GetChannelsForTeamAndUserWithLastDeleteAt(teamId, userId string, includeDeleted bool, lastDeleteAt int, etag string) ([]*Channel, *Response, error) {
	route := fmt.Sprintf(c.userRoute(userId) + c.teamRoute(teamId) + "/channels")
	route += fmt.Sprintf("?include_deleted=%v&last_delete_at=%d", includeDeleted, lastDeleteAt)
	r, err := c.DoAPIGet(route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelsForTeamAndUserWithLastDeleteAt", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelsForUserWithLastDeleteAt returns a list channels for a user, additionally filtered with lastDeleteAt.
func (c *Client4) GetChannelsForUserWithLastDeleteAt(userID string, lastDeleteAt int) ([]*Channel, *Response, error) {
	route := fmt.Sprintf(c.userRoute(userID) + "/channels")
	route += fmt.Sprintf("?last_delete_at=%d", lastDeleteAt)
	r, err := c.DoAPIGet(route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelsForUserWithLastDeleteAt", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// SearchChannels returns the channels on a team matching the provided search term.
func (c *Client4) SearchChannels(teamId string, search *ChannelSearch) ([]*Channel, *Response, error) {
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.channelsForTeamRoute(teamId)+"/search", string(searchJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("SearchChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// SearchArchivedChannels returns the archived channels on a team matching the provided search term.
func (c *Client4) SearchArchivedChannels(teamId string, search *ChannelSearch) ([]*Channel, *Response, error) {
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchArchivedChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.channelsForTeamRoute(teamId)+"/search_archived", string(searchJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("SearchArchivedChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// SearchAllChannels search in all the channels. Must be a system administrator.
func (c *Client4) SearchAllChannels(search *ChannelSearch) (ChannelListWithTeamData, *Response, error) {
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchAllChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.channelsRoute()+"/search", string(searchJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelListWithTeamData
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("SearchAllChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// SearchAllChannelsForUser search in all the channels for a regular user.
func (c *Client4) SearchAllChannelsForUser(term string) (ChannelListWithTeamData, *Response, error) {
	search := &ChannelSearch{
		Term: term,
	}
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchAllChannelsForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.channelsRoute()+"/search?system_console=false", string(searchJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelListWithTeamData
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("SearchAllChannelsForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// SearchAllChannelsPaged searches all the channels and returns the results paged with the total count.
func (c *Client4) SearchAllChannelsPaged(search *ChannelSearch) (*ChannelsWithCount, *Response, error) {
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchAllChannelsPaged", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.channelsRoute()+"/search", string(searchJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cwc *ChannelsWithCount
	err = json.NewDecoder(r.Body).Decode(&cwc)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetAllChannelsWithCount", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return cwc, BuildResponse(r), nil
}

// SearchGroupChannels returns the group channels of the user whose members' usernames match the search term.
func (c *Client4) SearchGroupChannels(search *ChannelSearch) ([]*Channel, *Response, error) {
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchGroupChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.channelsRoute()+"/group/search", string(searchJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("SearchGroupChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// DeleteChannel deletes channel based on the provided channel id string.
func (c *Client4) DeleteChannel(channelId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.channelRoute(channelId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PermanentDeleteChannel deletes a channel based on the provided channel id string.
func (c *Client4) PermanentDeleteChannel(channelId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.channelRoute(channelId) + "?permanent=" + c.boolString(true))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// MoveChannel moves the channel to the destination team.
func (c *Client4) MoveChannel(channelId, teamId string, force bool) (*Channel, *Response, error) {
	requestBody := map[string]any{
		"team_id": teamId,
		"force":   force,
	}
	r, err := c.DoAPIPost(c.channelRoute(channelId)+"/move", StringInterfaceToJSON(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("MoveChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelByName returns a channel based on the provided channel name and team id strings.
func (c *Client4) GetChannelByName(channelName, teamId string, etag string) (*Channel, *Response, error) {
	r, err := c.DoAPIGet(c.channelByNameRoute(channelName, teamId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelByName", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelByNameIncludeDeleted returns a channel based on the provided channel name and team id strings. Other then GetChannelByName it will also return deleted channels.
func (c *Client4) GetChannelByNameIncludeDeleted(channelName, teamId string, etag string) (*Channel, *Response, error) {
	r, err := c.DoAPIGet(c.channelByNameRoute(channelName, teamId)+"?include_deleted="+c.boolString(true), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelByNameIncludeDeleted", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelByNameForTeamName returns a channel based on the provided channel name and team name strings.
func (c *Client4) GetChannelByNameForTeamName(channelName, teamName string, etag string) (*Channel, *Response, error) {
	r, err := c.DoAPIGet(c.channelByNameForTeamNameRoute(channelName, teamName), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelByNameForTeamName", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelByNameForTeamNameIncludeDeleted returns a channel based on the provided channel name and team name strings. Other then GetChannelByNameForTeamName it will also return deleted channels.
func (c *Client4) GetChannelByNameForTeamNameIncludeDeleted(channelName, teamName string, etag string) (*Channel, *Response, error) {
	r, err := c.DoAPIGet(c.channelByNameForTeamNameRoute(channelName, teamName)+"?include_deleted="+c.boolString(true), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *Channel
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelByNameForTeamNameIncludeDeleted", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelMembers gets a page of channel members specific to a channel.
func (c *Client4) GetChannelMembers(channelId string, page, perPage int, etag string) (ChannelMembers, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.channelMembersRoute(channelId)+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelMembers
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelMembersWithTeamData gets a page of all channel members for a user.
func (c *Client4) GetChannelMembersWithTeamData(userID string, page, perPage int) (ChannelMembersWithTeamData, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.userRoute(userID)+"/channel_members"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelMembersWithTeamData
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelMembersWithTeamData", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelMembersByIds gets the channel members in a channel for a list of user ids.
func (c *Client4) GetChannelMembersByIds(channelId string, userIds []string) (ChannelMembers, *Response, error) {
	r, err := c.DoAPIPost(c.channelMembersRoute(channelId)+"/ids", ArrayToJSON(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelMembers
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelMembersByIds", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelMember gets a channel member.
func (c *Client4) GetChannelMember(channelId, userId, etag string) (*ChannelMember, *Response, error) {
	r, err := c.DoAPIGet(c.channelMemberRoute(channelId, userId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelMember
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelMember", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelMembersForUser gets all the channel members for a user on a team.
func (c *Client4) GetChannelMembersForUser(userId, teamId, etag string) (ChannelMembers, *Response, error) {
	r, err := c.DoAPIGet(fmt.Sprintf(c.userRoute(userId)+"/teams/%v/channels/members", teamId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelMembers
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelMembersForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// ViewChannel performs a view action for a user. Synonymous with switching channels or marking channels as read by a user.
func (c *Client4) ViewChannel(userId string, view *ChannelView) (*ChannelViewResponse, *Response, error) {
	url := fmt.Sprintf(c.channelsRoute()+"/members/%v/view", userId)
	buf, err := json.Marshal(view)
	if err != nil {
		return nil, nil, NewAppError("ViewChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(url, buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelViewResponse
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("ViewChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelUnread will return a ChannelUnread object that contains the number of
// unread messages and mentions for a user.
func (c *Client4) GetChannelUnread(channelId, userId string) (*ChannelUnread, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userId)+c.channelRoute(channelId)+"/unread", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelUnread
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelUnread", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// UpdateChannelRoles will update the roles on a channel for a user.
func (c *Client4) UpdateChannelRoles(channelId, userId, roles string) (*Response, error) {
	requestBody := map[string]string{"roles": roles}
	r, err := c.DoAPIPut(c.channelMemberRoute(channelId, userId)+"/roles", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateChannelMemberSchemeRoles will update the scheme-derived roles on a channel for a user.
func (c *Client4) UpdateChannelMemberSchemeRoles(channelId string, userId string, schemeRoles *SchemeRoles) (*Response, error) {
	buf, err := json.Marshal(schemeRoles)
	if err != nil {
		return nil, NewAppError("UpdateChannelMemberSchemeRoles", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.channelMemberRoute(channelId, userId)+"/schemeRoles", buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateChannelNotifyProps will update the notification properties on a channel for a user.
func (c *Client4) UpdateChannelNotifyProps(channelId, userId string, props map[string]string) (*Response, error) {
	r, err := c.DoAPIPut(c.channelMemberRoute(channelId, userId)+"/notify_props", MapToJSON(props))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AddChannelMember adds user to channel and return a channel member.
func (c *Client4) AddChannelMember(channelId, userId string) (*ChannelMember, *Response, error) {
	requestBody := map[string]string{"user_id": userId}
	r, err := c.DoAPIPost(c.channelMembersRoute(channelId)+"", MapToJSON(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelMember
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("AddChannelMember", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// AddChannelMemberWithRootId adds user to channel and return a channel member. Post add to channel message has the postRootId.
func (c *Client4) AddChannelMemberWithRootId(channelId, userId, postRootId string) (*ChannelMember, *Response, error) {
	requestBody := map[string]string{"user_id": userId, "post_root_id": postRootId}
	r, err := c.DoAPIPost(c.channelMembersRoute(channelId)+"", MapToJSON(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelMember
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("AddChannelMemberWithRootId", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// RemoveUserFromChannel will delete the channel member object for a user, effectively removing the user from a channel.
func (c *Client4) RemoveUserFromChannel(channelId, userId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.channelMemberRoute(channelId, userId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AutocompleteChannelsForTeam will return an ordered list of channels autocomplete suggestions.
func (c *Client4) AutocompleteChannelsForTeam(teamId, name string) (ChannelList, *Response, error) {
	query := fmt.Sprintf("?name=%v", name)
	r, err := c.DoAPIGet(c.channelsForTeamRoute(teamId)+"/autocomplete"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelList
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("AutocompleteChannelsForTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// AutocompleteChannelsForTeamForSearch will return an ordered list of your channels autocomplete suggestions.
func (c *Client4) AutocompleteChannelsForTeamForSearch(teamId, name string) (ChannelList, *Response, error) {
	query := fmt.Sprintf("?name=%v", name)
	r, err := c.DoAPIGet(c.channelsForTeamRoute(teamId)+"/search_autocomplete"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelList
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("AutocompleteChannelsForTeamForSearch", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetTopChannelsForTeamSince will return an ordered list of the top channels in a given team.
func (c *Client4) GetTopChannelsForTeamSince(teamId string, timeRange string, page int, perPage int) (*TopChannelList, *Response, error) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v", timeRange, page, perPage)
	r, err := c.DoAPIGet(c.teamRoute(teamId)+"/top/channels"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var topChannels *TopChannelList
	if err := json.NewDecoder(r.Body).Decode(&topChannels); err != nil {
		return nil, nil, NewAppError("GetTopChannelsForTeamSince", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topChannels, BuildResponse(r), nil
}

// GetTopChannelsForUserSince will return an ordered list of your top channels in a given team.
func (c *Client4) GetTopChannelsForUserSince(teamId string, timeRange string, page int, perPage int) (*TopChannelList, *Response, error) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v", timeRange, page, perPage)

	if teamId != "" {
		query += fmt.Sprintf("&team_id=%v", teamId)
	}

	r, err := c.DoAPIGet(c.usersRoute()+"/me/top/channels"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var topChannels *TopChannelList
	if err := json.NewDecoder(r.Body).Decode(&topChannels); err != nil {
		return nil, nil, NewAppError("GetTopChannelsForUserSince", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topChannels, BuildResponse(r), nil
}

// GetTopInactiveChannelsForTeamSince will return an ordered list of the top channels in a given team.
func (c *Client4) GetTopInactiveChannelsForTeamSince(teamId string, timeRange string, page int, perPage int) (*TopInactiveChannelList, *Response, error) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v", timeRange, page, perPage)
	r, err := c.DoAPIGet(c.teamRoute(teamId)+"/top/inactive_channels"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var topInactiveChannels *TopInactiveChannelList
	if jsonErr := json.NewDecoder(r.Body).Decode(&topInactiveChannels); jsonErr != nil {
		return nil, nil, NewAppError("GetTopInactiveChannelsForTeamSince", "api.unmarshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
	}
	return topInactiveChannels, BuildResponse(r), nil
}

// GetTopInactiveChannelsForUserSince will return an ordered list of your top channels in a given team.
func (c *Client4) GetTopInactiveChannelsForUserSince(teamId string, timeRange string, page int, perPage int) (*TopInactiveChannelList, *Response, error) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v", timeRange, page, perPage)

	if teamId != "" {
		query += fmt.Sprintf("&team_id=%v", teamId)
	}

	r, err := c.DoAPIGet(c.usersRoute()+"/me/top/inactive_channels"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var topInactiveChannels *TopInactiveChannelList
	if jsonErr := json.NewDecoder(r.Body).Decode(&topInactiveChannels); jsonErr != nil {
		return nil, nil, NewAppError("GetTopInactiveChannelsForUserSince", "api.unmarshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
	}
	return topInactiveChannels, BuildResponse(r), nil
}

// Post Section

// CreatePost creates a post based on the provided post struct.
func (c *Client4) CreatePost(post *Post) (*Post, *Response, error) {
	postJSON, err := json.Marshal(post)
	if err != nil {
		return nil, nil, NewAppError("CreatePost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.postsRoute(), string(postJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var p Post
	if r.StatusCode == http.StatusNotModified {
		return &p, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return nil, nil, NewAppError("CreatePost", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &p, BuildResponse(r), nil
}

// CreatePostEphemeral creates a ephemeral post based on the provided post struct which is send to the given user id.
func (c *Client4) CreatePostEphemeral(post *PostEphemeral) (*Post, *Response, error) {
	postJSON, err := json.Marshal(post)
	if err != nil {
		return nil, nil, NewAppError("CreatePostEphemeral", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.postsEphemeralRoute(), string(postJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var p Post
	if r.StatusCode == http.StatusNotModified {
		return &p, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return nil, nil, NewAppError("CreatePostEphemeral", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &p, BuildResponse(r), nil
}

// UpdatePost updates a post based on the provided post struct.
func (c *Client4) UpdatePost(postId string, post *Post) (*Post, *Response, error) {
	postJSON, err := json.Marshal(post)
	if err != nil {
		return nil, nil, NewAppError("UpdatePost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPut(c.postRoute(postId), string(postJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var p Post
	if r.StatusCode == http.StatusNotModified {
		return &p, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return nil, nil, NewAppError("UpdatePost", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &p, BuildResponse(r), nil
}

// PatchPost partially updates a post. Any missing fields are not updated.
func (c *Client4) PatchPost(postId string, patch *PostPatch) (*Post, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchPost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.postRoute(postId)+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var p Post
	if r.StatusCode == http.StatusNotModified {
		return &p, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return nil, nil, NewAppError("PatchPost", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &p, BuildResponse(r), nil
}

// SetPostUnread marks channel where post belongs as unread on the time of the provided post.
func (c *Client4) SetPostUnread(userId string, postId string, collapsedThreadsSupported bool) (*Response, error) {
	b, err := json.Marshal(map[string]bool{"collapsed_threads_supported": collapsedThreadsSupported})
	if err != nil {
		return nil, NewAppError("SetPostUnread", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.userRoute(userId)+c.postRoute(postId)+"/set_unread", b)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SetPostReminder creates a post reminder for a given post at a specified time.
// The time needs to be in UTC epoch in seconds. It is always truncated to a
// 5 minute resolution minimum.
func (c *Client4) SetPostReminder(reminder *PostReminder) (*Response, error) {
	b, err := json.Marshal(reminder)
	if err != nil {
		return nil, NewAppError("SetPostReminder", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPostBytes(c.userRoute(reminder.UserId)+c.postRoute(reminder.PostId)+"/reminder", b)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PinPost pin a post based on provided post id string.
func (c *Client4) PinPost(postId string) (*Response, error) {
	r, err := c.DoAPIPost(c.postRoute(postId)+"/pin", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UnpinPost unpin a post based on provided post id string.
func (c *Client4) UnpinPost(postId string) (*Response, error) {
	r, err := c.DoAPIPost(c.postRoute(postId)+"/unpin", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetPost gets a single post.
func (c *Client4) GetPost(postId string, etag string) (*Post, *Response, error) {
	r, err := c.DoAPIGet(c.postRoute(postId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var post Post
	if r.StatusCode == http.StatusNotModified {
		return &post, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&post); err != nil {
		return nil, nil, NewAppError("GetPost", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &post, BuildResponse(r), nil
}

// GetPostIncludeDeleted gets a single post, including deleted.
func (c *Client4) GetPostIncludeDeleted(postId string, etag string) (*Post, *Response, error) {
	r, err := c.DoAPIGet(c.postRoute(postId)+"?include_deleted="+c.boolString(true), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var post Post
	if r.StatusCode == http.StatusNotModified {
		return &post, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&post); err != nil {
		return nil, nil, NewAppError("GetPostIncludeDeleted", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &post, BuildResponse(r), nil
}

// DeletePost deletes a post from the provided post id string.
func (c *Client4) DeletePost(postId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.postRoute(postId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetPostThread gets a post with all the other posts in the same thread.
func (c *Client4) GetPostThread(postId string, etag string, collapsedThreads bool) (*PostList, *Response, error) {
	url := c.postRoute(postId) + "/thread"
	if collapsedThreads {
		url += "?collapsedThreads=true"
	}
	r, err := c.DoAPIGet(url, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetPostThread", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
}

// GetPostThreadWithOpts gets a post with all the other posts in the same thread.
func (c *Client4) GetPostThreadWithOpts(postID string, etag string, opts GetPostsOptions) (*PostList, *Response, error) {
	urlVal := c.postRoute(postID) + "/thread"

	values := url.Values{}
	if opts.CollapsedThreads {
		values.Set("collapsedThreads", "true")
	}
	if opts.CollapsedThreadsExtended {
		values.Set("collapsedThreadsExtended", "true")
	}
	if opts.SkipFetchThreads {
		values.Set("skipFetchThreads", "true")
	}
	if opts.PerPage != 0 {
		values.Set("perPage", strconv.Itoa(opts.PerPage))
	}
	if opts.FromPost != "" {
		values.Set("fromPost", opts.FromPost)
	}
	if opts.FromCreateAt != 0 {
		values.Set("fromCreateAt", strconv.FormatInt(opts.FromCreateAt, 10))
	}
	if opts.Direction != "" {
		values.Set("direction", opts.Direction)
	}
	urlVal += "?" + values.Encode()

	r, err := c.DoAPIGet(urlVal, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetPostThread", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
}

// GetPostsForChannel gets a page of posts with an array for ordering for a channel.
func (c *Client4) GetPostsForChannel(channelId string, page, perPage int, etag string, collapsedThreads bool, includeDeleted bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}

	if includeDeleted {
		query += "&include_deleted=true"
	}
	r, err := c.DoAPIGet(c.channelRoute(channelId)+"/posts"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetPostsForChannel", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
}

// GetPostsByIds gets a list of posts by taking an array of post ids
func (c *Client4) GetPostsByIds(postIds []string) ([]*Post, *Response, error) {
	js, err := json.Marshal(postIds)
	if err != nil {
		return nil, nil, NewAppError("SearchFilesWithParams", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.postsRoute()+"/ids", string(js))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Post
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetPostsByIds", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetFlaggedPostsForUser returns flagged posts of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUser(userId string, page int, perPage int) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.userRoute(userId)+"/posts/flagged"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetFlaggedPostsForUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
}

// GetFlaggedPostsForUserInTeam returns flagged posts in team of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUserInTeam(userId string, teamId string, page int, perPage int) (*PostList, *Response, error) {
	if !IsValidId(teamId) {
		return nil, nil, NewAppError("GetFlaggedPostsForUserInTeam", "model.client.get_flagged_posts_in_team.missing_parameter.app_error", nil, "", http.StatusBadRequest)
	}

	query := fmt.Sprintf("?team_id=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(c.userRoute(userId)+"/posts/flagged"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetFlaggedPostsForUserInTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
}

// GetFlaggedPostsForUserInChannel returns flagged posts in channel of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUserInChannel(userId string, channelId string, page int, perPage int) (*PostList, *Response, error) {
	if !IsValidId(channelId) {
		return nil, nil, NewAppError("GetFlaggedPostsForUserInChannel", "model.client.get_flagged_posts_in_channel.missing_parameter.app_error", nil, "", http.StatusBadRequest)
	}

	query := fmt.Sprintf("?channel_id=%v&page=%v&per_page=%v", channelId, page, perPage)
	r, err := c.DoAPIGet(c.userRoute(userId)+"/posts/flagged"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetFlaggedPostsForUserInChannel", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
}

// GetPostsSince gets posts created after a specified time as Unix time in milliseconds.
func (c *Client4) GetPostsSince(channelId string, time int64, collapsedThreads bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?since=%v", time)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	r, err := c.DoAPIGet(c.channelRoute(channelId)+"/posts"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetPostsSince", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
}

// GetPostsAfter gets a page of posts that were posted after the post provided.
func (c *Client4) GetPostsAfter(channelId, postId string, page, perPage int, etag string, collapsedThreads bool, includeDeleted bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&after=%v", page, perPage, postId)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	if includeDeleted {
		query += "&include_deleted=true"
	}
	r, err := c.DoAPIGet(c.channelRoute(channelId)+"/posts"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetPostsAfter", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
}

// GetPostsBefore gets a page of posts that were posted before the post provided.
func (c *Client4) GetPostsBefore(channelId, postId string, page, perPage int, etag string, collapsedThreads bool, includeDeleted bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&before=%v", page, perPage, postId)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	if includeDeleted {
		query += "&include_deleted=true"
	}
	r, err := c.DoAPIGet(c.channelRoute(channelId)+"/posts"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetPostsBefore", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
}

// GetPostsAroundLastUnread gets a list of posts around last unread post by a user in a channel.
func (c *Client4) GetPostsAroundLastUnread(userId, channelId string, limitBefore, limitAfter int, collapsedThreads bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?limit_before=%v&limit_after=%v", limitBefore, limitAfter)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	r, err := c.DoAPIGet(c.userRoute(userId)+c.channelRoute(channelId)+"/posts/unread"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetPostsAroundLastUnread", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
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
	js, err := json.Marshal(params)
	if err != nil {
		return nil, nil, NewAppError("SearchFilesWithParams", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.teamRoute(teamId)+"/files/search", string(js))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var list FileInfoList
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("SearchFilesWithParams", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
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
	js, err := json.Marshal(params)
	if err != nil {
		return nil, nil, NewAppError("SearchFilesWithParams", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	var route string
	if teamId == "" {
		route = c.postsRoute() + "/search"
	} else {
		route = c.teamRoute(teamId) + "/posts/search"
	}
	r, err := c.DoAPIPost(route, string(js))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PostList
	if r.StatusCode == http.StatusNotModified {
		return &list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("SearchFilesWithParams", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &list, BuildResponse(r), nil
}

// SearchPostsWithMatches returns any posts with matching terms string, including.
func (c *Client4) SearchPostsWithMatches(teamId string, terms string, isOrSearch bool) (*PostSearchResults, *Response, error) {
	requestBody := map[string]any{"terms": terms, "is_or_search": isOrSearch}
	var route string
	if teamId == "" {
		route = c.postsRoute() + "/search"
	} else {
		route = c.teamRoute(teamId) + "/posts/search"
	}
	r, err := c.DoAPIPost(route, StringInterfaceToJSON(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var psr PostSearchResults
	if err := json.NewDecoder(r.Body).Decode(&psr); err != nil {
		return nil, nil, NewAppError("SearchPostsWithMatches", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &psr, BuildResponse(r), nil
}

// DoPostAction performs a post action.
func (c *Client4) DoPostAction(postId, actionId string) (*Response, error) {
	r, err := c.DoAPIPost(c.postRoute(postId)+"/actions/"+actionId, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DoPostActionWithCookie performs a post action with extra arguments
func (c *Client4) DoPostActionWithCookie(postId, actionId, selected, cookieStr string) (*Response, error) {
	var body []byte
	if selected != "" || cookieStr != "" {
		var err error
		body, err = json.Marshal(DoPostActionRequest{
			SelectedOption: selected,
			Cookie:         cookieStr,
		})
		if err != nil {
			return nil, NewAppError("DoPostActionWithCookie", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	r, err := c.DoAPIPost(c.postRoute(postId)+"/actions/"+actionId, string(body))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTopThreadsForTeamSince will return an ordered list of the top channels in a given team.
func (c *Client4) GetTopThreadsForTeamSince(teamId string, timeRange string, page int, perPage int) (*TopThreadList, *Response, error) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v", timeRange, page, perPage)
	r, err := c.DoAPIGet(c.teamRoute(teamId)+"/top/threads"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var topThreads *TopThreadList
	if err := json.NewDecoder(r.Body).Decode(&topThreads); err != nil {
		return nil, nil, NewAppError("GetTopThreadsForTeamSince", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topThreads, BuildResponse(r), nil
}

// GetTopThreadsForUserSince will return an ordered list of your top channels in a given team.
func (c *Client4) GetTopThreadsForUserSince(teamId string, timeRange string, page int, perPage int) (*TopThreadList, *Response, error) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v", timeRange, page, perPage)

	if teamId != "" {
		query += fmt.Sprintf("&team_id=%v", teamId)
	}

	r, err := c.DoAPIGet(c.usersRoute()+"/me/top/threads"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var topThreads *TopThreadList
	if err := json.NewDecoder(r.Body).Decode(&topThreads); err != nil {
		return nil, nil, NewAppError("GetTopThreadsForUserSince", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topThreads, BuildResponse(r), nil
}

// OpenInteractiveDialog sends a WebSocket event to a user's clients to
// open interactive dialogs, based on the provided trigger ID and other
// provided data. Used with interactive message buttons, menus and
// slash commands.
func (c *Client4) OpenInteractiveDialog(request OpenDialogRequest) (*Response, error) {
	b, err := json.Marshal(request)
	if err != nil {
		return nil, NewAppError("OpenInteractiveDialog", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost("/actions/dialogs/open", string(b))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SubmitInteractiveDialog will submit the provided dialog data to the integration
// configured by the URL. Used with the interactive dialogs integration feature.
func (c *Client4) SubmitInteractiveDialog(request SubmitDialogRequest) (*SubmitDialogResponse, *Response, error) {
	b, err := json.Marshal(request)
	if err != nil {
		return nil, nil, NewAppError("SubmitInteractiveDialog", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost("/actions/dialogs/submit", string(b))
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
		return nil, nil, err
	}

	_, err = io.Copy(part, strings.NewReader(channelId))
	if err != nil {
		return nil, nil, err
	}

	part, err = writer.CreateFormFile("files", filename)
	if err != nil {
		return nil, nil, err
	}
	_, err = io.Copy(part, bytes.NewBuffer(data))
	if err != nil {
		return nil, nil, err
	}

	err = writer.Close()
	if err != nil {
		return nil, nil, err
	}

	return c.DoUploadFile(c.filesRoute(), body.Bytes(), writer.FormDataContentType())
}

// UploadFileAsRequestBody will upload a file to a channel as the body of a request, to be later attached
// to a post. This method is functionally equivalent to Client4.UploadFile.
func (c *Client4) UploadFileAsRequestBody(data []byte, channelId string, filename string) (*FileUploadResponse, *Response, error) {
	return c.DoUploadFile(c.filesRoute()+fmt.Sprintf("?channel_id=%v&filename=%v", url.QueryEscape(channelId), url.QueryEscape(filename)), data, http.DetectContentType(data))
}

// GetFile gets the bytes for a file by id.
func (c *Client4) GetFile(fileId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.fileRoute(fileId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetFile", "model.client.read_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return data, BuildResponse(r), nil
}

// DownloadFile gets the bytes for a file by id, optionally adding headers to force the browser to download it.
func (c *Client4) DownloadFile(fileId string, download bool) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.fileRoute(fileId)+fmt.Sprintf("?download=%v", download), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("DownloadFile", "model.client.read_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return data, BuildResponse(r), nil
}

// GetFileThumbnail gets the bytes for a file by id.
func (c *Client4) GetFileThumbnail(fileId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.fileRoute(fileId)+"/thumbnail", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetFileThumbnail", "model.client.read_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return data, BuildResponse(r), nil
}

// DownloadFileThumbnail gets the bytes for a file by id, optionally adding headers to force the browser to download it.
func (c *Client4) DownloadFileThumbnail(fileId string, download bool) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.fileRoute(fileId)+fmt.Sprintf("/thumbnail?download=%v", download), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("DownloadFileThumbnail", "model.client.read_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return data, BuildResponse(r), nil
}

// GetFileLink gets the public link of a file by id.
func (c *Client4) GetFileLink(fileId string) (string, *Response, error) {
	r, err := c.DoAPIGet(c.fileRoute(fileId)+"/link", "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["link"], BuildResponse(r), nil
}

// GetFilePreview gets the bytes for a file by id.
func (c *Client4) GetFilePreview(fileId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.fileRoute(fileId)+"/preview", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetFilePreview", "model.client.read_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return data, BuildResponse(r), nil
}

// DownloadFilePreview gets the bytes for a file by id.
func (c *Client4) DownloadFilePreview(fileId string, download bool) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.fileRoute(fileId)+fmt.Sprintf("/preview?download=%v", download), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("DownloadFilePreview", "model.client.read_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return data, BuildResponse(r), nil
}

// GetFileInfo gets all the file info objects.
func (c *Client4) GetFileInfo(fileId string) (*FileInfo, *Response, error) {
	r, err := c.DoAPIGet(c.fileRoute(fileId)+"/info", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var fi FileInfo
	if err := json.NewDecoder(r.Body).Decode(&fi); err != nil {
		return nil, nil, NewAppError("GetFileInfo", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &fi, BuildResponse(r), nil
}

// GetFileInfosForPost gets all the file info objects attached to a post.
func (c *Client4) GetFileInfosForPost(postId string, etag string) ([]*FileInfo, *Response, error) {
	r, err := c.DoAPIGet(c.postRoute(postId)+"/files/info", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var list []*FileInfo
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetFileInfosForPost", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetFileInfosForPost gets all the file info objects attached to a post, including deleted
func (c *Client4) GetFileInfosForPostIncludeDeleted(postId string, etag string) ([]*FileInfo, *Response, error) {
	r, err := c.DoAPIGet(c.postRoute(postId)+"/files/info"+"?include_deleted="+c.boolString(true), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var list []*FileInfo
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetFileInfosForPostIncludeDeleted", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// General/System Section

// GenerateSupportPacket downloads the generated support packet
func (c *Client4) GenerateSupportPacket() ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.systemRoute()+"/support_packet", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetFile", "model.client.read_job_result_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return data, BuildResponse(r), nil
}

// GetPing will return ok if the running goRoutines are below the threshold and unhealthy for above.
func (c *Client4) GetPing() (string, *Response, error) {
	r, err := c.DoAPIGet(c.systemRoute()+"/ping", "")
	if r != nil && r.StatusCode == 500 {
		defer r.Body.Close()
		return StatusUnhealthy, BuildResponse(r), err
	}
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["status"], BuildResponse(r), nil
}

// GetPingWithServerStatus will return ok if several basic server health checks
// all pass successfully.
func (c *Client4) GetPingWithServerStatus() (string, *Response, error) {
	r, err := c.DoAPIGet(c.systemRoute()+"/ping?get_server_status="+c.boolString(true), "")
	if r != nil && r.StatusCode == 500 {
		defer r.Body.Close()
		return StatusUnhealthy, BuildResponse(r), err
	}
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["status"], BuildResponse(r), nil
}

// GetPingWithFullServerStatus will return the full status if several basic server
// health checks all pass successfully.
func (c *Client4) GetPingWithFullServerStatus() (map[string]string, *Response, error) {
	r, err := c.DoAPIGet(c.systemRoute()+"/ping?get_server_status="+c.boolString(true), "")
	if r != nil && r.StatusCode == 500 {
		defer r.Body.Close()
		return map[string]string{"status": StatusUnhealthy}, BuildResponse(r), err
	}
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body), BuildResponse(r), nil
}

// TestEmail will attempt to connect to the configured SMTP server.
func (c *Client4) TestEmail(config *Config) (*Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return nil, NewAppError("TestEmail", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.testEmailRoute(), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// TestSiteURL will test the validity of a site URL.
func (c *Client4) TestSiteURL(siteURL string) (*Response, error) {
	requestBody := make(map[string]string)
	requestBody["site_url"] = siteURL
	r, err := c.DoAPIPost(c.testSiteURLRoute(), MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// TestS3Connection will attempt to connect to the AWS S3.
func (c *Client4) TestS3Connection(config *Config) (*Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return nil, NewAppError("TestS3Connection", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.testS3Route(), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetConfig will retrieve the server config with some sanitized items.
func (c *Client4) GetConfig() (*Config, *Response, error) {
	r, err := c.DoAPIGet(c.configRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cfg *Config
	d := json.NewDecoder(r.Body)
	return cfg, BuildResponse(r), d.Decode(&cfg)
}

// ReloadConfig will reload the server configuration.
func (c *Client4) ReloadConfig() (*Response, error) {
	r, err := c.DoAPIPost(c.configRoute()+"/reload", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetOldClientConfig will retrieve the parts of the server configuration needed by the
// client, formatted in the old format.
func (c *Client4) GetOldClientConfig(etag string) (map[string]string, *Response, error) {
	r, err := c.DoAPIGet(c.configRoute()+"/client?format=old", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body), BuildResponse(r), nil
}

// GetEnvironmentConfig will retrieve a map mirroring the server configuration where fields
// are set to true if the corresponding config setting is set through an environment variable.
// Settings that haven't been set through environment variables will be missing from the map.
func (c *Client4) GetEnvironmentConfig() (map[string]any, *Response, error) {
	r, err := c.DoAPIGet(c.configRoute()+"/environment", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return StringInterfaceFromJSON(r.Body), BuildResponse(r), nil
}

// GetOldClientLicense will retrieve the parts of the server license needed by the
// client, formatted in the old format.
func (c *Client4) GetOldClientLicense(etag string) (map[string]string, *Response, error) {
	r, err := c.DoAPIGet(c.licenseRoute()+"/client?format=old", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body), BuildResponse(r), nil
}

// DatabaseRecycle will recycle the connections. Discard current connection and get new one.
func (c *Client4) DatabaseRecycle() (*Response, error) {
	r, err := c.DoAPIPost(c.databaseRoute()+"/recycle", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// InvalidateCaches will purge the cache and can affect the performance while is cleaning.
func (c *Client4) InvalidateCaches() (*Response, error) {
	r, err := c.DoAPIPost(c.cacheRoute()+"/invalidate", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateConfig will update the server configuration.
func (c *Client4) UpdateConfig(config *Config) (*Config, *Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return nil, nil, NewAppError("UpdateConfig", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.configRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cfg *Config
	d := json.NewDecoder(r.Body)
	return cfg, BuildResponse(r), d.Decode(&cfg)
}

// MigrateConfig will migrate existing config to the new one.
// DEPRECATED: The config migrate API has been moved to be a purely
// mmctl --local endpoint. This method will be removed in a
// future major release.
func (c *Client4) MigrateConfig(from, to string) (*Response, error) {
	m := make(map[string]string, 2)
	m["from"] = from
	m["to"] = to
	r, err := c.DoAPIPost(c.configRoute()+"/migrate", MapToJSON(m))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UploadLicenseFile will add a license file to the system.
func (c *Client4) UploadLicenseFile(data []byte) (*Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("license", "test-license.mattermost-license")
	if err != nil {
		return nil, NewAppError("UploadLicenseFile", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, NewAppError("UploadLicenseFile", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if err = writer.Close(); err != nil {
		return nil, NewAppError("UploadLicenseFile", "model.client.set_profile_user.writer.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	rq, err := http.NewRequest("POST", c.APIURL+c.licenseRoute(), bytes.NewReader(body.Bytes()))
	if err != nil {
		return nil, err
	}
	rq.Header.Set("Content-Type", writer.FormDataContentType())

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return BuildResponse(rp), err
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return BuildResponse(rp), AppErrorFromJSON(rp.Body)
	}

	return BuildResponse(rp), nil
}

// RemoveLicenseFile will remove the server license it exists. Note that this will
// disable all enterprise features.
func (c *Client4) RemoveLicenseFile() (*Response, error) {
	r, err := c.DoAPIDelete(c.licenseRoute())
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetAnalyticsOld will retrieve analytics using the old format. New format is not
// available but the "/analytics" endpoint is reserved for it. The "name" argument is optional
// and defaults to "standard". The "teamId" argument is optional and will limit results
// to a specific team.
func (c *Client4) GetAnalyticsOld(name, teamId string) (AnalyticsRows, *Response, error) {
	query := fmt.Sprintf("?name=%v&team_id=%v", name, teamId)
	r, err := c.DoAPIGet(c.analyticsRoute()+"/old"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var rows AnalyticsRows
	err = json.NewDecoder(r.Body).Decode(&rows)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetAnalyticsOld", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return rows, BuildResponse(r), nil
}

// Webhooks Section

// CreateIncomingWebhook creates an incoming webhook for a channel.
func (c *Client4) CreateIncomingWebhook(hook *IncomingWebhook) (*IncomingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("CreateIncomingWebhook", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.incomingWebhooksRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var iw IncomingWebhook
	if err := json.NewDecoder(r.Body).Decode(&iw); err != nil {
		return nil, nil, NewAppError("CreateIncomingWebhook", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &iw, BuildResponse(r), nil
}

// UpdateIncomingWebhook updates an incoming webhook for a channel.
func (c *Client4) UpdateIncomingWebhook(hook *IncomingWebhook) (*IncomingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("UpdateIncomingWebhook", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.incomingWebhookRoute(hook.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var iw IncomingWebhook
	if err := json.NewDecoder(r.Body).Decode(&iw); err != nil {
		return nil, nil, NewAppError("UpdateIncomingWebhook", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &iw, BuildResponse(r), nil
}

// GetIncomingWebhooks returns a page of incoming webhooks on the system. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooks(page int, perPage int, etag string) ([]*IncomingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.incomingWebhooksRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var iwl []*IncomingWebhook
	if r.StatusCode == http.StatusNotModified {
		return iwl, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&iwl); err != nil {
		return nil, nil, NewAppError("GetIncomingWebhooks", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return iwl, BuildResponse(r), nil
}

// GetIncomingWebhooksForTeam returns a page of incoming webhooks for a team. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooksForTeam(teamId string, page int, perPage int, etag string) ([]*IncomingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&team_id=%v", page, perPage, teamId)
	r, err := c.DoAPIGet(c.incomingWebhooksRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var iwl []*IncomingWebhook
	if r.StatusCode == http.StatusNotModified {
		return iwl, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&iwl); err != nil {
		return nil, nil, NewAppError("GetIncomingWebhooksForTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return iwl, BuildResponse(r), nil
}

// GetIncomingWebhook returns an Incoming webhook given the hook ID.
func (c *Client4) GetIncomingWebhook(hookID string, etag string) (*IncomingWebhook, *Response, error) {
	r, err := c.DoAPIGet(c.incomingWebhookRoute(hookID), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var iw IncomingWebhook
	if r.StatusCode == http.StatusNotModified {
		return &iw, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&iw); err != nil {
		return nil, nil, NewAppError("GetIncomingWebhook", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &iw, BuildResponse(r), nil
}

// DeleteIncomingWebhook deletes and Incoming Webhook given the hook ID.
func (c *Client4) DeleteIncomingWebhook(hookID string) (*Response, error) {
	r, err := c.DoAPIDelete(c.incomingWebhookRoute(hookID))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// CreateOutgoingWebhook creates an outgoing webhook for a team or channel.
func (c *Client4) CreateOutgoingWebhook(hook *OutgoingWebhook) (*OutgoingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("CreateOutgoingWebhook", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.outgoingWebhooksRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var ow OutgoingWebhook
	if err := json.NewDecoder(r.Body).Decode(&ow); err != nil {
		return nil, nil, NewAppError("CreateOutgoingWebhook", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &ow, BuildResponse(r), nil
}

// UpdateOutgoingWebhook creates an outgoing webhook for a team or channel.
func (c *Client4) UpdateOutgoingWebhook(hook *OutgoingWebhook) (*OutgoingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("UpdateOutgoingWebhook", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.outgoingWebhookRoute(hook.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var ow OutgoingWebhook
	if err := json.NewDecoder(r.Body).Decode(&ow); err != nil {
		return nil, nil, NewAppError("UpdateOutgoingWebhook", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &ow, BuildResponse(r), nil
}

// GetOutgoingWebhooks returns a page of outgoing webhooks on the system. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooks(page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.outgoingWebhooksRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var owl []*OutgoingWebhook
	if r.StatusCode == http.StatusNotModified {
		return owl, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&owl); err != nil {
		return nil, nil, NewAppError("GetOutgoingWebhooks", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return owl, BuildResponse(r), nil
}

// GetOutgoingWebhook outgoing webhooks on the system requested by Hook Id.
func (c *Client4) GetOutgoingWebhook(hookId string) (*OutgoingWebhook, *Response, error) {
	r, err := c.DoAPIGet(c.outgoingWebhookRoute(hookId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var ow OutgoingWebhook
	if err := json.NewDecoder(r.Body).Decode(&ow); err != nil {
		return nil, nil, NewAppError("GetOutgoingWebhook", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &ow, BuildResponse(r), nil
}

// GetOutgoingWebhooksForChannel returns a page of outgoing webhooks for a channel. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooksForChannel(channelId string, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&channel_id=%v", page, perPage, channelId)
	r, err := c.DoAPIGet(c.outgoingWebhooksRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var owl []*OutgoingWebhook
	if r.StatusCode == http.StatusNotModified {
		return owl, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&owl); err != nil {
		return nil, nil, NewAppError("GetOutgoingWebhooksForChannel", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return owl, BuildResponse(r), nil
}

// GetOutgoingWebhooksForTeam returns a page of outgoing webhooks for a team. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooksForTeam(teamId string, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&team_id=%v", page, perPage, teamId)
	r, err := c.DoAPIGet(c.outgoingWebhooksRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var owl []*OutgoingWebhook
	if r.StatusCode == http.StatusNotModified {
		return owl, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&owl); err != nil {
		return nil, nil, NewAppError("GetOutgoingWebhooksForTeam", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return owl, BuildResponse(r), nil
}

// RegenOutgoingHookToken regenerate the outgoing webhook token.
func (c *Client4) RegenOutgoingHookToken(hookId string) (*OutgoingWebhook, *Response, error) {
	r, err := c.DoAPIPost(c.outgoingWebhookRoute(hookId)+"/regen_token", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var ow OutgoingWebhook
	if err := json.NewDecoder(r.Body).Decode(&ow); err != nil {
		return nil, nil, NewAppError("RegenOutgoingHookToken", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &ow, BuildResponse(r), nil
}

// DeleteOutgoingWebhook delete the outgoing webhook on the system requested by Hook Id.
func (c *Client4) DeleteOutgoingWebhook(hookId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.outgoingWebhookRoute(hookId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Preferences Section

// GetPreferences returns the user's preferences.
func (c *Client4) GetPreferences(userId string) (Preferences, *Response, error) {
	r, err := c.DoAPIGet(c.preferencesRoute(userId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var prefs Preferences
	if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
		return nil, nil, NewAppError("GetPreferences", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return prefs, BuildResponse(r), nil
}

// UpdatePreferences saves the user's preferences.
func (c *Client4) UpdatePreferences(userId string, preferences Preferences) (*Response, error) {
	buf, err := json.Marshal(preferences)
	if err != nil {
		return nil, NewAppError("UpdatePreferences", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.preferencesRoute(userId), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeletePreferences deletes the user's preferences.
func (c *Client4) DeletePreferences(userId string, preferences Preferences) (*Response, error) {
	buf, err := json.Marshal(preferences)
	if err != nil {
		return nil, NewAppError("DeletePreferences", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.preferencesRoute(userId)+"/delete", buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetPreferencesByCategory returns the user's preferences from the provided category string.
func (c *Client4) GetPreferencesByCategory(userId string, category string) (Preferences, *Response, error) {
	url := fmt.Sprintf(c.preferencesRoute(userId)+"/%s", category)
	r, err := c.DoAPIGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var prefs Preferences
	if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
		return nil, nil, NewAppError("GetPreferencesByCategory", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return prefs, BuildResponse(r), nil
}

// GetPreferenceByCategoryAndName returns the user's preferences from the provided category and preference name string.
func (c *Client4) GetPreferenceByCategoryAndName(userId string, category string, preferenceName string) (*Preference, *Response, error) {
	url := fmt.Sprintf(c.preferencesRoute(userId)+"/%s/name/%v", category, preferenceName)
	r, err := c.DoAPIGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var pref Preference
	if err := json.NewDecoder(r.Body).Decode(&pref); err != nil {
		return nil, nil, NewAppError("GetPreferenceByCategoryAndName", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &pref, BuildResponse(r), nil
}

// SAML Section

// GetSamlMetadata returns metadata for the SAML configuration.
func (c *Client4) GetSamlMetadata() (string, *Response, error) {
	r, err := c.DoAPIGet(c.samlRoute()+"/metadata", "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)

	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(r.Body)
	if err != nil {
		return "", BuildResponse(r), err
	}

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
func (c *Client4) UploadSamlIdpCertificate(data []byte, filename string) (*Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return nil, NewAppError("UploadSamlIdpCertificate", "model.client.upload_saml_cert.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	_, resp, err := c.DoUploadFile(c.samlRoute()+"/certificate/idp", body, writer.FormDataContentType())
	return resp, err
}

// UploadSamlPublicCertificate will upload a public certificate for SAML and set the config to use it.
// The filename parameter is deprecated and ignored: the server will pick a hard-coded filename when writing to disk.
func (c *Client4) UploadSamlPublicCertificate(data []byte, filename string) (*Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return nil, NewAppError("UploadSamlPublicCertificate", "model.client.upload_saml_cert.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	_, resp, err := c.DoUploadFile(c.samlRoute()+"/certificate/public", body, writer.FormDataContentType())
	return resp, err
}

// UploadSamlPrivateCertificate will upload a private key for SAML and set the config to use it.
// The filename parameter is deprecated and ignored: the server will pick a hard-coded filename when writing to disk.
func (c *Client4) UploadSamlPrivateCertificate(data []byte, filename string) (*Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return nil, NewAppError("UploadSamlPrivateCertificate", "model.client.upload_saml_cert.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	_, resp, err := c.DoUploadFile(c.samlRoute()+"/certificate/private", body, writer.FormDataContentType())
	return resp, err
}

// DeleteSamlIdpCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlIdpCertificate() (*Response, error) {
	r, err := c.DoAPIDelete(c.samlRoute() + "/certificate/idp")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteSamlPublicCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlPublicCertificate() (*Response, error) {
	r, err := c.DoAPIDelete(c.samlRoute() + "/certificate/public")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteSamlPrivateCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlPrivateCertificate() (*Response, error) {
	r, err := c.DoAPIDelete(c.samlRoute() + "/certificate/private")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetSamlCertificateStatus returns metadata for the SAML configuration.
func (c *Client4) GetSamlCertificateStatus() (*SamlCertificateStatus, *Response, error) {
	r, err := c.DoAPIGet(c.samlRoute()+"/certificate/status", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var status SamlCertificateStatus
	if err := json.NewDecoder(r.Body).Decode(&status); err != nil {
		return nil, nil, NewAppError("GetSamlCertificateStatus", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &status, BuildResponse(r), nil
}

func (c *Client4) GetSamlMetadataFromIdp(samlMetadataURL string) (*SamlMetadataResponse, *Response, error) {
	requestBody := make(map[string]string)
	requestBody["saml_metadata_url"] = samlMetadataURL
	r, err := c.DoAPIPost(c.samlRoute()+"/metadatafromidp", MapToJSON(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	var resp SamlMetadataResponse
	if err := json.NewDecoder(r.Body).Decode(&resp); err != nil {
		return nil, nil, NewAppError("GetSamlMetadataFromIdp", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &resp, BuildResponse(r), nil
}

// ResetSamlAuthDataToEmail resets the AuthData field of SAML users to their Email.
func (c *Client4) ResetSamlAuthDataToEmail(includeDeleted bool, dryRun bool, userIDs []string) (int64, *Response, error) {
	params := map[string]any{
		"include_deleted": includeDeleted,
		"dry_run":         dryRun,
		"user_ids":        userIDs,
	}
	b, err := json.Marshal(params)
	if err != nil {
		return 0, nil, NewAppError("ResetSamlAuthDataToEmail", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.samlRoute()+"/reset_auth_data", b)
	if err != nil {
		return 0, BuildResponse(r), err
	}
	defer closeBody(r)
	respBody := map[string]int64{}
	err = json.NewDecoder(r.Body).Decode(&respBody)
	if err != nil {
		return 0, BuildResponse(r), NewAppError("Api4.ResetSamlAuthDataToEmail", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return respBody["num_affected"], BuildResponse(r), nil
}

// Compliance Section

// CreateComplianceReport creates an incoming webhook for a channel.
func (c *Client4) CreateComplianceReport(report *Compliance) (*Compliance, *Response, error) {
	buf, err := json.Marshal(report)
	if err != nil {
		return nil, nil, NewAppError("CreateComplianceReport", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.complianceReportsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var comp Compliance
	if err := json.NewDecoder(r.Body).Decode(&comp); err != nil {
		return nil, nil, NewAppError("CreateComplianceReport", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &comp, BuildResponse(r), nil
}

// GetComplianceReports returns list of compliance reports.
func (c *Client4) GetComplianceReports(page, perPage int) (Compliances, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.complianceReportsRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var comp Compliances
	if err := json.NewDecoder(r.Body).Decode(&comp); err != nil {
		return nil, nil, NewAppError("GetComplianceReports", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return comp, BuildResponse(r), nil
}

// GetComplianceReport returns a compliance report.
func (c *Client4) GetComplianceReport(reportId string) (*Compliance, *Response, error) {
	r, err := c.DoAPIGet(c.complianceReportRoute(reportId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var comp Compliance
	if err := json.NewDecoder(r.Body).Decode(&comp); err != nil {
		return nil, nil, NewAppError("GetComplianceReport", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &comp, BuildResponse(r), nil
}

// DownloadComplianceReport returns a full compliance report as a file.
func (c *Client4) DownloadComplianceReport(reportId string) ([]byte, *Response, error) {
	rq, err := http.NewRequest("GET", c.APIURL+c.complianceReportDownloadRoute(reportId), nil)
	if err != nil {
		return nil, nil, err
	}

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, "BEARER "+c.AuthToken)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return nil, BuildResponse(rp), err
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJSON(rp.Body)
	}

	data, err := io.ReadAll(rp.Body)
	if err != nil {
		return nil, BuildResponse(rp), NewAppError("DownloadComplianceReport", "model.client.read_file.app_error", nil, "", rp.StatusCode).Wrap(err)
	}

	return data, BuildResponse(rp), nil
}

// Cluster Section

// GetClusterStatus returns the status of all the configured cluster nodes.
func (c *Client4) GetClusterStatus() ([]*ClusterInfo, *Response, error) {
	r, err := c.DoAPIGet(c.clusterRoute()+"/status", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*ClusterInfo
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetClusterStatus", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// LDAP Section

// SyncLdap will force a sync with the configured LDAP server.
// If includeRemovedMembers is true, then group members who left or were removed from a
// synced team/channel will be re-joined; otherwise, they will be excluded.
func (c *Client4) SyncLdap(includeRemovedMembers bool) (*Response, error) {
	reqBody, err := json.Marshal(map[string]any{
		"include_removed_members": includeRemovedMembers,
	})
	if err != nil {
		return nil, NewAppError("SyncLdap", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.ldapRoute()+"/sync", reqBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// TestLdap will attempt to connect to the configured LDAP server and return OK if configured
// correctly.
func (c *Client4) TestLdap() (*Response, error) {
	r, err := c.DoAPIPost(c.ldapRoute()+"/test", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetLdapGroups retrieves the immediate child groups of the given parent group.
func (c *Client4) GetLdapGroups() ([]*Group, *Response, error) {
	path := fmt.Sprintf("%s/groups", c.ldapRoute())

	r, err := c.DoAPIGet(path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData := struct {
		Count  int      `json:"count"`
		Groups []*Group `json:"groups"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&responseData); err != nil {
		return nil, BuildResponse(r), NewAppError("Api4.GetLdapGroups", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	for i := range responseData.Groups {
		responseData.Groups[i].DisplayName = *responseData.Groups[i].Name
	}

	return responseData.Groups, BuildResponse(r), nil
}

// LinkLdapGroup creates or undeletes a Mattermost group and associates it to the given LDAP group DN.
func (c *Client4) LinkLdapGroup(dn string) (*Group, *Response, error) {
	path := fmt.Sprintf("%s/groups/%s/link", c.ldapRoute(), dn)

	r, err := c.DoAPIPost(path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var g Group
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		return nil, nil, NewAppError("LinkLdapGroup", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &g, BuildResponse(r), nil
}

// UnlinkLdapGroup deletes the Mattermost group associated with the given LDAP group DN.
func (c *Client4) UnlinkLdapGroup(dn string) (*Group, *Response, error) {
	path := fmt.Sprintf("%s/groups/%s/link", c.ldapRoute(), dn)

	r, err := c.DoAPIDelete(path)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var g Group
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		return nil, nil, NewAppError("UnlinkLdapGroup", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &g, BuildResponse(r), nil
}

// MigrateIdLdap migrates the LDAP enabled users to given attribute
func (c *Client4) MigrateIdLdap(toAttribute string) (*Response, error) {
	r, err := c.DoAPIPost(c.ldapRoute()+"/migrateid", MapToJSON(map[string]string{
		"toAttribute": toAttribute,
	}))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetGroupsByChannel retrieves the Mattermost Groups associated with a given channel
func (c *Client4) GetGroupsByChannel(channelId string, opts GroupSearchOpts) ([]*GroupWithSchemeAdmin, int, *Response, error) {
	path := fmt.Sprintf("%s/groups?q=%v&include_member_count=%v&filter_allow_reference=%v", c.channelRoute(channelId), opts.Q, opts.IncludeMemberCount, opts.FilterAllowReference)
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoAPIGet(path, "")
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData := struct {
		Groups []*GroupWithSchemeAdmin `json:"groups"`
		Count  int                     `json:"total_group_count"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&responseData); err != nil {
		return nil, 0, BuildResponse(r), NewAppError("Api4.GetGroupsByChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return responseData.Groups, responseData.Count, BuildResponse(r), nil
}

// GetGroupsByTeam retrieves the Mattermost Groups associated with a given team
func (c *Client4) GetGroupsByTeam(teamId string, opts GroupSearchOpts) ([]*GroupWithSchemeAdmin, int, *Response, error) {
	path := fmt.Sprintf("%s/groups?q=%v&include_member_count=%v&filter_allow_reference=%v", c.teamRoute(teamId), opts.Q, opts.IncludeMemberCount, opts.FilterAllowReference)
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoAPIGet(path, "")
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData := struct {
		Groups []*GroupWithSchemeAdmin `json:"groups"`
		Count  int                     `json:"total_group_count"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&responseData); err != nil {
		return nil, 0, BuildResponse(r), NewAppError("Api4.GetGroupsByTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return responseData.Groups, responseData.Count, BuildResponse(r), nil
}

// GetGroupsAssociatedToChannelsByTeam retrieves the Mattermost Groups associated with channels in a given team
func (c *Client4) GetGroupsAssociatedToChannelsByTeam(teamId string, opts GroupSearchOpts) (map[string][]*GroupWithSchemeAdmin, *Response, error) {
	path := fmt.Sprintf("%s/groups_by_channels?q=%v&filter_allow_reference=%v", c.teamRoute(teamId), opts.Q, opts.FilterAllowReference)
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoAPIGet(path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData := struct {
		GroupsAssociatedToChannels map[string][]*GroupWithSchemeAdmin `json:"groups"`
	}{}
	if err := json.NewDecoder(r.Body).Decode(&responseData); err != nil {
		return nil, BuildResponse(r), NewAppError("Api4.GetGroupsAssociatedToChannelsByTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return responseData.GroupsAssociatedToChannels, BuildResponse(r), nil
}

// GetGroups retrieves Mattermost Groups
func (c *Client4) GetGroups(opts GroupSearchOpts) ([]*Group, *Response, error) {
	path := fmt.Sprintf(
		"%s?include_member_count=%v&not_associated_to_team=%v&not_associated_to_channel=%v&filter_allow_reference=%v&q=%v&filter_parent_team_permitted=%v&group_source=%v&include_channel_member_count=%v&include_timezones=%v",
		c.groupsRoute(),
		opts.IncludeMemberCount,
		opts.NotAssociatedToTeam,
		opts.NotAssociatedToChannel,
		opts.FilterAllowReference,
		opts.Q,
		opts.FilterParentTeamPermitted,
		opts.Source,
		opts.IncludeChannelMemberCount,
		opts.IncludeTimezones,
	)
	if opts.Since > 0 {
		path = fmt.Sprintf("%s&since=%v", path, opts.Since)
	}
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoAPIGet(path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var list []*Group
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetGroups", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetGroupsByUserId retrieves Mattermost Groups for a user
func (c *Client4) GetGroupsByUserId(userId string) ([]*Group, *Response, error) {
	path := fmt.Sprintf(
		"%s/%v/groups",
		c.usersRoute(),
		userId,
	)

	r, err := c.DoAPIGet(path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Group
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetGroupsByUserId", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

func (c *Client4) MigrateAuthToLdap(fromAuthService string, matchField string, force bool) (*Response, error) {
	r, err := c.DoAPIPost(c.usersRoute()+"/migrate_auth/ldap", StringInterfaceToJSON(map[string]any{
		"from":        fromAuthService,
		"force":       force,
		"match_field": matchField,
	}))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) MigrateAuthToSaml(fromAuthService string, usersMap map[string]string, auto bool) (*Response, error) {
	r, err := c.DoAPIPost(c.usersRoute()+"/migrate_auth/saml", StringInterfaceToJSON(map[string]any{
		"from":    fromAuthService,
		"auto":    auto,
		"matches": usersMap,
	}))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UploadLdapPublicCertificate will upload a public certificate for LDAP and set the config to use it.
func (c *Client4) UploadLdapPublicCertificate(data []byte) (*Response, error) {
	body, writer, err := fileToMultipart(data, LdapPublicCertificateName)
	if err != nil {
		return nil, NewAppError("UploadLdapPublicCertificate", "model.client.upload_ldap_cert.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	_, resp, err := c.DoUploadFile(c.ldapRoute()+"/certificate/public", body, writer.FormDataContentType())
	return resp, err
}

// UploadLdapPrivateCertificate will upload a private key for LDAP and set the config to use it.
func (c *Client4) UploadLdapPrivateCertificate(data []byte) (*Response, error) {
	body, writer, err := fileToMultipart(data, LdapPrivateKeyName)
	if err != nil {
		return nil, NewAppError("UploadLdapPrivateCertificate", "model.client.upload_Ldap_cert.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	_, resp, err := c.DoUploadFile(c.ldapRoute()+"/certificate/private", body, writer.FormDataContentType())
	return resp, err
}

// DeleteLdapPublicCertificate deletes the LDAP IDP certificate from the server and updates the config to not use it and disable LDAP.
func (c *Client4) DeleteLdapPublicCertificate() (*Response, error) {
	r, err := c.DoAPIDelete(c.ldapRoute() + "/certificate/public")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteLDAPPrivateCertificate deletes the LDAP IDP certificate from the server and updates the config to not use it and disable LDAP.
func (c *Client4) DeleteLdapPrivateCertificate() (*Response, error) {
	r, err := c.DoAPIDelete(c.ldapRoute() + "/certificate/private")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Audits Section

// GetAudits returns a list of audits for the whole system.
func (c *Client4) GetAudits(page int, perPage int, etag string) (Audits, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet("/audits"+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var audits Audits
	err = json.NewDecoder(r.Body).Decode(&audits)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetAudits", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return audits, BuildResponse(r), nil
}

// Brand Section

// GetBrandImage retrieves the previously uploaded brand image.
func (c *Client4) GetBrandImage() ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.brandRoute()+"/image", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	if r.StatusCode >= 300 {
		return nil, BuildResponse(r), AppErrorFromJSON(r.Body)
	}

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetBrandImage", "model.client.read_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}

	return data, BuildResponse(r), nil
}

// DeleteBrandImage deletes the brand image for the system.
func (c *Client4) DeleteBrandImage() (*Response, error) {
	r, err := c.DoAPIDelete(c.brandRoute() + "/image")
	if err != nil {
		return BuildResponse(r), err
	}
	return BuildResponse(r), nil
}

// UploadBrandImage sets the brand image for the system.
func (c *Client4) UploadBrandImage(data []byte) (*Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", "brand.png")
	if err != nil {
		return nil, NewAppError("UploadBrandImage", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, NewAppError("UploadBrandImage", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if err = writer.Close(); err != nil {
		return nil, NewAppError("UploadBrandImage", "model.client.set_profile_user.writer.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	rq, err := http.NewRequest("POST", c.APIURL+c.brandRoute()+"/image", bytes.NewReader(body.Bytes()))
	if err != nil {
		return nil, err
	}
	rq.Header.Set("Content-Type", writer.FormDataContentType())

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return BuildResponse(rp), err
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return BuildResponse(rp), AppErrorFromJSON(rp.Body)
	}

	return BuildResponse(rp), nil
}

// Logs Section

// GetLogs page of logs as a string array.
func (c *Client4) GetLogs(page, perPage int) ([]string, *Response, error) {
	query := fmt.Sprintf("?page=%v&logs_per_page=%v", page, perPage)
	r, err := c.DoAPIGet("/logs"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJSON(r.Body), BuildResponse(r), nil
}

// PostLog is a convenience Web Service call so clients can log messages into
// the server-side logs. For example we typically log javascript error messages
// into the server-side. It returns the log message if the logging was successful.
func (c *Client4) PostLog(message map[string]string) (map[string]string, *Response, error) {
	r, err := c.DoAPIPost("/logs", MapToJSON(message))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body), BuildResponse(r), nil
}

// OAuth Section

// CreateOAuthApp will register a new OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) CreateOAuthApp(app *OAuthApp) (*OAuthApp, *Response, error) {
	buf, err := json.Marshal(app)
	if err != nil {
		return nil, nil, NewAppError("CreateOAuthApp", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.oAuthAppsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var oapp OAuthApp
	if err := json.NewDecoder(r.Body).Decode(&oapp); err != nil {
		return nil, nil, NewAppError("CreateOAuthApp", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &oapp, BuildResponse(r), nil
}

// UpdateOAuthApp updates a page of registered OAuth 2.0 client applications with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) UpdateOAuthApp(app *OAuthApp) (*OAuthApp, *Response, error) {
	buf, err := json.Marshal(app)
	if err != nil {
		return nil, nil, NewAppError("UpdateOAuthApp", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.oAuthAppRoute(app.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var oapp OAuthApp
	if err := json.NewDecoder(r.Body).Decode(&oapp); err != nil {
		return nil, nil, NewAppError("UpdateOAuthApp", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &oapp, BuildResponse(r), nil
}

// GetOAuthApps gets a page of registered OAuth 2.0 client applications with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthApps(page, perPage int) ([]*OAuthApp, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.oAuthAppsRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*OAuthApp
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetOAuthApps", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetOAuthApp gets a registered OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthApp(appId string) (*OAuthApp, *Response, error) {
	r, err := c.DoAPIGet(c.oAuthAppRoute(appId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var oapp OAuthApp
	if err := json.NewDecoder(r.Body).Decode(&oapp); err != nil {
		return nil, nil, NewAppError("GetOAuthApp", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &oapp, BuildResponse(r), nil
}

// GetOAuthAppInfo gets a sanitized version of a registered OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthAppInfo(appId string) (*OAuthApp, *Response, error) {
	r, err := c.DoAPIGet(c.oAuthAppRoute(appId)+"/info", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var oapp OAuthApp
	if err := json.NewDecoder(r.Body).Decode(&oapp); err != nil {
		return nil, nil, NewAppError("GetOAuthAppInfo", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &oapp, BuildResponse(r), nil
}

// DeleteOAuthApp deletes a registered OAuth 2.0 client application.
func (c *Client4) DeleteOAuthApp(appId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.oAuthAppRoute(appId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RegenerateOAuthAppSecret regenerates the client secret for a registered OAuth 2.0 client application.
func (c *Client4) RegenerateOAuthAppSecret(appId string) (*OAuthApp, *Response, error) {
	r, err := c.DoAPIPost(c.oAuthAppRoute(appId)+"/regen_secret", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var oapp OAuthApp
	if err := json.NewDecoder(r.Body).Decode(&oapp); err != nil {
		return nil, nil, NewAppError("RegenerateOAuthAppSecret", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &oapp, BuildResponse(r), nil
}

// GetAuthorizedOAuthAppsForUser gets a page of OAuth 2.0 client applications the user has authorized to use access their account.
func (c *Client4) GetAuthorizedOAuthAppsForUser(userId string, page, perPage int) ([]*OAuthApp, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.userRoute(userId)+"/oauth/apps/authorized"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*OAuthApp
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetAuthorizedOAuthAppsForUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// AuthorizeOAuthApp will authorize an OAuth 2.0 client application to access a user's account and provide a redirect link to follow.
func (c *Client4) AuthorizeOAuthApp(authRequest *AuthorizeRequest) (string, *Response, error) {
	buf, err := json.Marshal(authRequest)
	if err != nil {
		return "", BuildResponse(nil), NewAppError("AuthorizeOAuthApp", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIRequestBytes(http.MethodPost, c.URL+"/oauth/authorize", buf, "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["redirect"], BuildResponse(r), nil
}

// DeauthorizeOAuthApp will deauthorize an OAuth 2.0 client application from accessing a user's account.
func (c *Client4) DeauthorizeOAuthApp(appId string) (*Response, error) {
	requestData := map[string]string{"client_id": appId}
	r, err := c.DoAPIRequest(http.MethodPost, c.URL+"/oauth/deauthorize", MapToJSON(requestData), "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetOAuthAccessToken is a test helper function for the OAuth access token endpoint.
func (c *Client4) GetOAuthAccessToken(data url.Values) (*AccessResponse, *Response, error) {
	url := c.URL + "/oauth/access_token"
	rq, err := http.NewRequest(http.MethodPost, url, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, nil, err
	}
	rq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return nil, BuildResponse(rp), err
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJSON(rp.Body)
	}

	var ar *AccessResponse
	err = json.NewDecoder(rp.Body).Decode(&ar)
	if err != nil {
		return nil, BuildResponse(rp), NewAppError(url, "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return ar, BuildResponse(rp), nil
}

// Elasticsearch Section

// TestElasticsearch will attempt to connect to the configured Elasticsearch server and return OK if configured.
// correctly.
func (c *Client4) TestElasticsearch() (*Response, error) {
	r, err := c.DoAPIPost(c.elasticsearchRoute()+"/test", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PurgeElasticsearchIndexes immediately deletes all Elasticsearch indexes.
func (c *Client4) PurgeElasticsearchIndexes() (*Response, error) {
	r, err := c.DoAPIPost(c.elasticsearchRoute()+"/purge_indexes", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Bleve Section

// PurgeBleveIndexes immediately deletes all Bleve indexes.
func (c *Client4) PurgeBleveIndexes() (*Response, error) {
	r, err := c.DoAPIPost(c.bleveRoute()+"/purge_indexes", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Data Retention Section

// GetDataRetentionPolicy will get the current global data retention policy details.
func (c *Client4) GetDataRetentionPolicy() (*GlobalRetentionPolicy, *Response, error) {
	r, err := c.DoAPIGet(c.dataRetentionRoute()+"/policy", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var p GlobalRetentionPolicy
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return nil, nil, NewAppError("GetDataRetentionPolicy", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &p, BuildResponse(r), nil
}

// GetDataRetentionPolicyByID will get the details for the granular data retention policy with the specified ID.
func (c *Client4) GetDataRetentionPolicyByID(policyID string) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	r, err := c.DoAPIGet(c.dataRetentionPolicyRoute(policyID), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var p RetentionPolicyWithTeamAndChannelCounts
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return nil, nil, NewAppError("GetDataRetentionPolicyByID", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &p, BuildResponse(r), nil
}

// GetDataRetentionPoliciesCount will get the total number of granular data retention policies.
func (c *Client4) GetDataRetentionPoliciesCount() (int64, *Response, error) {
	type CountBody struct {
		TotalCount int64 `json:"total_count"`
	}
	r, err := c.DoAPIGet(c.dataRetentionRoute()+"/policies_count", "")
	if err != nil {
		return 0, BuildResponse(r), err
	}
	var countObj CountBody
	err = json.NewDecoder(r.Body).Decode(&countObj)
	if err != nil {
		return 0, nil, NewAppError("Client4.GetDataRetentionPoliciesCount", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return countObj.TotalCount, BuildResponse(r), nil
}

// GetDataRetentionPolicies will get the current granular data retention policies' details.
func (c *Client4) GetDataRetentionPolicies(page, perPage int) (*RetentionPolicyWithTeamAndChannelCountsList, *Response, error) {
	query := fmt.Sprintf("?page=%d&per_page=%d", page, perPage)
	r, err := c.DoAPIGet(c.dataRetentionRoute()+"/policies"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var p RetentionPolicyWithTeamAndChannelCountsList
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return nil, nil, NewAppError("GetDataRetentionPolicies", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &p, BuildResponse(r), nil
}

// CreateDataRetentionPolicy will create a new granular data retention policy which will be applied to
// the specified teams and channels. The Id field of `policy` must be empty.
func (c *Client4) CreateDataRetentionPolicy(policy *RetentionPolicyWithTeamAndChannelIDs) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	policyJSON, err := json.Marshal(policy)
	if err != nil {
		return nil, nil, NewAppError("CreateDataRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.dataRetentionRoute()+"/policies", policyJSON)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var p RetentionPolicyWithTeamAndChannelCounts
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return nil, nil, NewAppError("CreateDataRetentionPolicy", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &p, BuildResponse(r), nil
}

// DeleteDataRetentionPolicy will delete the granular data retention policy with the specified ID.
func (c *Client4) DeleteDataRetentionPolicy(policyID string) (*Response, error) {
	r, err := c.DoAPIDelete(c.dataRetentionPolicyRoute(policyID))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PatchDataRetentionPolicy will patch the granular data retention policy with the specified ID.
// The Id field of `patch` must be non-empty.
func (c *Client4) PatchDataRetentionPolicy(patch *RetentionPolicyWithTeamAndChannelIDs) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	patchJSON, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchDataRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPatchBytes(c.dataRetentionPolicyRoute(patch.ID), patchJSON)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var p RetentionPolicyWithTeamAndChannelCounts
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return nil, nil, NewAppError("PatchDataRetentionPolicy", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &p, BuildResponse(r), nil
}

// GetTeamsForRetentionPolicy will get the teams to which the specified policy is currently applied.
func (c *Client4) GetTeamsForRetentionPolicy(policyID string, page, perPage int) (*TeamsWithCount, *Response, error) {
	query := fmt.Sprintf("?page=%d&per_page=%d", page, perPage)
	r, err := c.DoAPIGet(c.dataRetentionPolicyRoute(policyID)+"/teams"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var teams *TeamsWithCount
	err = json.NewDecoder(r.Body).Decode(&teams)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetTeamsForRetentionPolicy", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return teams, BuildResponse(r), nil
}

// SearchTeamsForRetentionPolicy will search the teams to which the specified policy is currently applied.
func (c *Client4) SearchTeamsForRetentionPolicy(policyID string, term string) ([]*Team, *Response, error) {
	body, err := json.Marshal(map[string]any{"term": term})
	if err != nil {
		return nil, nil, NewAppError("SearchTeamsForRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.dataRetentionPolicyRoute(policyID)+"/teams/search", body)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var teams []*Team
	err = json.NewDecoder(r.Body).Decode(&teams)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.SearchTeamsForRetentionPolicy", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return teams, BuildResponse(r), nil
}

// AddTeamsToRetentionPolicy will add the specified teams to the granular data retention policy
// with the specified ID.
func (c *Client4) AddTeamsToRetentionPolicy(policyID string, teamIDs []string) (*Response, error) {
	body, err := json.Marshal(teamIDs)
	if err != nil {
		return nil, NewAppError("AddTeamsToRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.dataRetentionPolicyRoute(policyID)+"/teams", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveTeamsFromRetentionPolicy will remove the specified teams from the granular data retention policy
// with the specified ID.
func (c *Client4) RemoveTeamsFromRetentionPolicy(policyID string, teamIDs []string) (*Response, error) {
	body, err := json.Marshal(teamIDs)
	if err != nil {
		return nil, NewAppError("RemoveTeamsFromRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIDeleteBytes(c.dataRetentionPolicyRoute(policyID)+"/teams", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetChannelsForRetentionPolicy will get the channels to which the specified policy is currently applied.
func (c *Client4) GetChannelsForRetentionPolicy(policyID string, page, perPage int) (*ChannelsWithCount, *Response, error) {
	query := fmt.Sprintf("?page=%d&per_page=%d", page, perPage)
	r, err := c.DoAPIGet(c.dataRetentionPolicyRoute(policyID)+"/channels"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var channels *ChannelsWithCount
	err = json.NewDecoder(r.Body).Decode(&channels)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetChannelsForRetentionPolicy", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return channels, BuildResponse(r), nil
}

// SearchChannelsForRetentionPolicy will search the channels to which the specified policy is currently applied.
func (c *Client4) SearchChannelsForRetentionPolicy(policyID string, term string) (ChannelListWithTeamData, *Response, error) {
	body, err := json.Marshal(map[string]any{"term": term})
	if err != nil {
		return nil, nil, NewAppError("SearchChannelsForRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.dataRetentionPolicyRoute(policyID)+"/channels/search", body)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var channels ChannelListWithTeamData
	err = json.NewDecoder(r.Body).Decode(&channels)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.SearchChannelsForRetentionPolicy", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return channels, BuildResponse(r), nil
}

// AddChannelsToRetentionPolicy will add the specified channels to the granular data retention policy
// with the specified ID.
func (c *Client4) AddChannelsToRetentionPolicy(policyID string, channelIDs []string) (*Response, error) {
	body, err := json.Marshal(channelIDs)
	if err != nil {
		return nil, NewAppError("AddChannelsToRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.dataRetentionPolicyRoute(policyID)+"/channels", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveChannelsFromRetentionPolicy will remove the specified channels from the granular data retention policy
// with the specified ID.
func (c *Client4) RemoveChannelsFromRetentionPolicy(policyID string, channelIDs []string) (*Response, error) {
	body, err := json.Marshal(channelIDs)
	if err != nil {
		return nil, NewAppError("RemoveChannelsFromRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIDeleteBytes(c.dataRetentionPolicyRoute(policyID)+"/channels", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTeamPoliciesForUser will get the data retention policies for the teams to which a user belongs.
func (c *Client4) GetTeamPoliciesForUser(userID string, offset, limit int) (*RetentionPolicyForTeamList, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userID)+"/data_retention/team_policies", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var teams RetentionPolicyForTeamList
	err = json.NewDecoder(r.Body).Decode(&teams)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetTeamPoliciesForUser", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return &teams, BuildResponse(r), nil
}

// GetChannelPoliciesForUser will get the data retention policies for the channels to which a user belongs.
func (c *Client4) GetChannelPoliciesForUser(userID string, offset, limit int) (*RetentionPolicyForChannelList, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userID)+"/data_retention/channel_policies", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	var channels RetentionPolicyForChannelList
	err = json.NewDecoder(r.Body).Decode(&channels)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetChannelPoliciesForUser", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return &channels, BuildResponse(r), nil
}

// Drafts Sections

// UpsertDraft will create a new draft or update a draft if it already exists
func (c *Client4) UpsertDraft(draft *Draft) (*Draft, *Response, error) {
	buf, err := json.Marshal(draft)
	if err != nil {
		return nil, nil, NewAppError("UpsertDraft", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPostBytes(c.draftsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var df Draft
	err = json.NewDecoder(r.Body).Decode(&df)
	if err != nil {
		return nil, nil, NewAppError("UpsertDraft", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &df, BuildResponse(r), err
}

// GetDrafts will get all drafts for a user
func (c *Client4) GetDrafts(userId, teamId string) ([]*Draft, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userId)+c.teamRoute(teamId)+"/drafts", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var drafts []*Draft
	err = json.NewDecoder(r.Body).Decode(&drafts)
	if err != nil {
		return nil, nil, NewAppError("GetDrafts", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return drafts, BuildResponse(r), nil
}

func (c *Client4) DeleteDraft(userId, channelId, rootId string) (*Draft, *Response, error) {
	r, err := c.DoAPIDelete(c.userRoute(userId) + c.channelRoute(channelId) + "/drafts")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var df *Draft
	err = json.NewDecoder(r.Body).Decode(&df)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("DeleteDraft", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return df, BuildResponse(r), nil
}

// Commands Section

// CreateCommand will create a new command if the user have the right permissions.
func (c *Client4) CreateCommand(cmd *Command) (*Command, *Response, error) {
	buf, err := json.Marshal(cmd)
	if err != nil {
		return nil, nil, NewAppError("CreateCommand", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.commandsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var command Command
	if err := json.NewDecoder(r.Body).Decode(&command); err != nil {
		return nil, nil, NewAppError("CreateCommand", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &command, BuildResponse(r), nil
}

// UpdateCommand updates a command based on the provided Command struct.
func (c *Client4) UpdateCommand(cmd *Command) (*Command, *Response, error) {
	buf, err := json.Marshal(cmd)
	if err != nil {
		return nil, nil, NewAppError("UpdateCommand", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.commandRoute(cmd.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var command Command
	if err := json.NewDecoder(r.Body).Decode(&command); err != nil {
		return nil, nil, NewAppError("UpdateCommand", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &command, BuildResponse(r), nil
}

// MoveCommand moves a command to a different team.
func (c *Client4) MoveCommand(teamId string, commandId string) (*Response, error) {
	cmr := CommandMoveRequest{TeamId: teamId}
	buf, err := json.Marshal(cmr)
	if err != nil {
		return nil, NewAppError("MoveCommand", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.commandMoveRoute(commandId), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteCommand deletes a command based on the provided command id string.
func (c *Client4) DeleteCommand(commandId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.commandRoute(commandId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ListCommands will retrieve a list of commands available in the team.
func (c *Client4) ListCommands(teamId string, customOnly bool) ([]*Command, *Response, error) {
	query := fmt.Sprintf("?team_id=%v&custom_only=%v", teamId, customOnly)
	r, err := c.DoAPIGet(c.commandsRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var list []*Command
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("ListCommands", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// ListCommandAutocompleteSuggestions will retrieve a list of suggestions for a userInput.
func (c *Client4) ListCommandAutocompleteSuggestions(userInput, teamId string) ([]AutocompleteSuggestion, *Response, error) {
	query := fmt.Sprintf("/commands/autocomplete_suggestions?user_input=%v", userInput)
	r, err := c.DoAPIGet(c.teamRoute(teamId)+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []AutocompleteSuggestion
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("ListCommandAutocompleteSuggestions", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetCommandById will retrieve a command by id.
func (c *Client4) GetCommandById(cmdId string) (*Command, *Response, error) {
	url := fmt.Sprintf("%s/%s", c.commandsRoute(), cmdId)
	r, err := c.DoAPIGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var command Command
	if err := json.NewDecoder(r.Body).Decode(&command); err != nil {
		return nil, nil, NewAppError("GetCommandById", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &command, BuildResponse(r), nil
}

// ExecuteCommand executes a given slash command.
func (c *Client4) ExecuteCommand(channelId, command string) (*CommandResponse, *Response, error) {
	commandArgs := &CommandArgs{
		ChannelId: channelId,
		Command:   command,
	}
	buf, err := json.Marshal(commandArgs)
	if err != nil {
		return nil, nil, NewAppError("ExecuteCommand", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.commandsRoute()+"/execute", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	response, err := CommandResponseFromJSON(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("ExecuteCommand", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
		return nil, nil, NewAppError("ExecuteCommandWithTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.commandsRoute()+"/execute", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	response, err := CommandResponseFromJSON(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("ExecuteCommandWithTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return response, BuildResponse(r), nil
}

// ListAutocompleteCommands will retrieve a list of commands available in the team.
func (c *Client4) ListAutocompleteCommands(teamId string) ([]*Command, *Response, error) {
	r, err := c.DoAPIGet(c.teamAutoCompleteCommandsRoute(teamId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Command
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("ListAutocompleteCommands", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// RegenCommandToken will create a new token if the user have the right permissions.
func (c *Client4) RegenCommandToken(commandId string) (string, *Response, error) {
	r, err := c.DoAPIPut(c.commandRoute(commandId)+"/regen_token", "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["token"], BuildResponse(r), nil
}

// Status Section

// GetUserStatus returns a user based on the provided user id string.
func (c *Client4) GetUserStatus(userId, etag string) (*Status, *Response, error) {
	r, err := c.DoAPIGet(c.userStatusRoute(userId), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var s Status
	if r.StatusCode == http.StatusNotModified {
		return &s, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		return nil, nil, NewAppError("GetUserStatus", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &s, BuildResponse(r), nil
}

// GetUsersStatusesByIds returns a list of users status based on the provided user ids.
func (c *Client4) GetUsersStatusesByIds(userIds []string) ([]*Status, *Response, error) {
	r, err := c.DoAPIPost(c.userStatusesRoute()+"/ids", ArrayToJSON(userIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Status
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersStatusesByIds", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// UpdateUserStatus sets a user's status based on the provided user id string.
func (c *Client4) UpdateUserStatus(userId string, userStatus *Status) (*Status, *Response, error) {
	buf, err := json.Marshal(userStatus)
	if err != nil {
		return nil, nil, NewAppError("UpdateUserStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.userStatusRoute(userId), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var s Status
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		return nil, nil, NewAppError("UpdateUserStatus", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &s, BuildResponse(r), nil
}

// UpdateUserCustomStatus sets a user's custom status based on the provided user id string.
// The returned CustomStatus object is the same as the one passed, and it should be just
// ignored. It's only kept to maintain compatibility.
func (c *Client4) UpdateUserCustomStatus(userId string, userCustomStatus *CustomStatus) (*CustomStatus, *Response, error) {
	buf, err := json.Marshal(userCustomStatus)
	if err != nil {
		return nil, nil, NewAppError("UpdateUserCustomStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.userStatusRoute(userId)+"/custom", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	// This is returning the same status which was passed.
	// The API was incorrectly designed to return a status returned from the server,
	// but the server doesn't return anything except an OK.
	return userCustomStatus, BuildResponse(r), nil
}

// RemoveUserCustomStatus remove a user's custom status based on the provided user id string.
func (c *Client4) RemoveUserCustomStatus(userId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.userStatusRoute(userId) + "/custom")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveRecentUserCustomStatus remove a recent user's custom status based on the provided user id string.
func (c *Client4) RemoveRecentUserCustomStatus(userId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.userStatusRoute(userId) + "/custom/recent")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
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
		return nil, nil, err
	}

	_, err = io.Copy(part, bytes.NewBuffer(image))
	if err != nil {
		return nil, nil, err
	}

	emojiJSON, err := json.Marshal(emoji)
	if err != nil {
		return nil, nil, NewAppError("CreateEmoji", "api.marshal_error", nil, "", 0).Wrap(err)
	}

	if err := writer.WriteField("emoji", string(emojiJSON)); err != nil {
		return nil, nil, err
	}

	if err := writer.Close(); err != nil {
		return nil, nil, err
	}

	return c.DoEmojiUploadFile(c.emojisRoute(), body.Bytes(), writer.FormDataContentType())
}

// GetEmojiList returns a page of custom emoji on the system.
func (c *Client4) GetEmojiList(page, perPage int) ([]*Emoji, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.emojisRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var list []*Emoji
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetEmojiList", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetSortedEmojiList returns a page of custom emoji on the system sorted based on the sort
// parameter, blank for no sorting and "name" to sort by emoji names.
func (c *Client4) GetSortedEmojiList(page, perPage int, sort string) ([]*Emoji, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&sort=%v", page, perPage, sort)
	r, err := c.DoAPIGet(c.emojisRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Emoji
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetSortedEmojiList", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// DeleteEmoji delete an custom emoji on the provided emoji id string.
func (c *Client4) DeleteEmoji(emojiId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.emojiRoute(emojiId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetEmoji returns a custom emoji based on the emojiId string.
func (c *Client4) GetEmoji(emojiId string) (*Emoji, *Response, error) {
	r, err := c.DoAPIGet(c.emojiRoute(emojiId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var e Emoji
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		return nil, nil, NewAppError("GetEmoji", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &e, BuildResponse(r), nil
}

// GetEmojiByName returns a custom emoji based on the name string.
func (c *Client4) GetEmojiByName(name string) (*Emoji, *Response, error) {
	r, err := c.DoAPIGet(c.emojiByNameRoute(name), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var e Emoji
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		return nil, nil, NewAppError("GetEmojiByName", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &e, BuildResponse(r), nil
}

// GetEmojiImage returns the emoji image.
func (c *Client4) GetEmojiImage(emojiId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.emojiRoute(emojiId)+"/image", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetEmojiImage", "model.client.read_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}

	return data, BuildResponse(r), nil
}

// SearchEmoji returns a list of emoji matching some search criteria.
func (c *Client4) SearchEmoji(search *EmojiSearch) ([]*Emoji, *Response, error) {
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchEmoji", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.emojisRoute()+"/search", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Emoji
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("SearchEmoji", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// AutocompleteEmoji returns a list of emoji starting with or matching name.
func (c *Client4) AutocompleteEmoji(name string, etag string) ([]*Emoji, *Response, error) {
	query := fmt.Sprintf("?name=%v", name)
	r, err := c.DoAPIGet(c.emojisRoute()+"/autocomplete"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Emoji
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("AutocompleteEmoji", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// Reaction Section

// SaveReaction saves an emoji reaction for a post. Returns the saved reaction if successful, otherwise an error will be returned.
func (c *Client4) SaveReaction(reaction *Reaction) (*Reaction, *Response, error) {
	buf, err := json.Marshal(reaction)
	if err != nil {
		return nil, nil, NewAppError("SaveReaction", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.reactionsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var re Reaction
	if err := json.NewDecoder(r.Body).Decode(&re); err != nil {
		return nil, nil, NewAppError("SaveReaction", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &re, BuildResponse(r), nil
}

// GetReactions returns a list of reactions to a post.
func (c *Client4) GetReactions(postId string) ([]*Reaction, *Response, error) {
	r, err := c.DoAPIGet(c.postRoute(postId)+"/reactions", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Reaction
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetReactions", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// DeleteReaction deletes reaction of a user in a post.
func (c *Client4) DeleteReaction(reaction *Reaction) (*Response, error) {
	r, err := c.DoAPIDelete(c.userRoute(reaction.UserId) + c.postRoute(reaction.PostId) + fmt.Sprintf("/reactions/%v", reaction.EmojiName))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// FetchBulkReactions returns a map of postIds and corresponding reactions
func (c *Client4) GetBulkReactions(postIds []string) (map[string][]*Reaction, *Response, error) {
	r, err := c.DoAPIPost(c.postsRoute()+"/ids/reactions", ArrayToJSON(postIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	reactions := map[string][]*Reaction{}
	if err := json.NewDecoder(r.Body).Decode(&reactions); err != nil {
		return nil, nil, NewAppError("GetBulkReactions", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return reactions, BuildResponse(r), nil
}

func (c *Client4) GetTopReactionsForTeamSince(teamId string, timeRange string, page int, perPage int) (*TopReactionList, *Response, error) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v", timeRange, page, perPage)
	r, err := c.DoAPIGet(c.teamRoute(teamId)+"/top/reactions"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var topReactions *TopReactionList
	if err := json.NewDecoder(r.Body).Decode(&topReactions); err != nil {
		return nil, nil, NewAppError("GetTopReactionsForTeamSince", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topReactions, BuildResponse(r), nil
}

func (c *Client4) GetTopReactionsForUserSince(teamId string, timeRange string, page int, perPage int) (*TopReactionList, *Response, error) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v", timeRange, page, perPage)

	if teamId != "" {
		query += fmt.Sprintf("&team_id=%v", teamId)
	}

	r, err := c.DoAPIGet(c.usersRoute()+"/me/top/reactions"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var topReactions *TopReactionList
	if err := json.NewDecoder(r.Body).Decode(&topReactions); err != nil {
		return nil, nil, NewAppError("GetTopReactionsForUserSince", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return topReactions, BuildResponse(r), nil
}

func (c *Client4) GetTopDMsForUserSince(timeRange string, page int, perPage int) (*TopDMList, *Response, error) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v", timeRange, page, perPage)

	r, err := c.DoAPIGet(c.usersRoute()+"/me/top/dms"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var topDMs *TopDMList
	if jsonErr := json.NewDecoder(r.Body).Decode(&topDMs); jsonErr != nil {
		return nil, nil, NewAppError("GetTopReactionsForUserSince", "api.unmarshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
	}
	return topDMs, BuildResponse(r), nil
}

// Timezone Section

// GetSupportedTimezone returns a page of supported timezones on the system.
func (c *Client4) GetSupportedTimezone() ([]string, *Response, error) {
	r, err := c.DoAPIGet(c.timezonesRoute(), "")
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

	r, err := c.DoAPIPost(c.openGraphRoute(), MapToJSON(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body), BuildResponse(r), nil
}

// Jobs Section

// GetJob gets a single job.
func (c *Client4) GetJob(id string) (*Job, *Response, error) {
	r, err := c.DoAPIGet(c.jobsRoute()+fmt.Sprintf("/%v", id), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var j Job
	if err := json.NewDecoder(r.Body).Decode(&j); err != nil {
		return nil, nil, NewAppError("GetJob", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &j, BuildResponse(r), nil
}

// GetJobs gets all jobs, sorted with the job that was created most recently first.
func (c *Client4) GetJobs(page int, perPage int) ([]*Job, *Response, error) {
	r, err := c.DoAPIGet(c.jobsRoute()+fmt.Sprintf("?page=%v&per_page=%v", page, perPage), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Job
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetJobs", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetJobsByType gets all jobs of a given type, sorted with the job that was created most recently first.
func (c *Client4) GetJobsByType(jobType string, page int, perPage int) ([]*Job, *Response, error) {
	r, err := c.DoAPIGet(c.jobsRoute()+fmt.Sprintf("/type/%v?page=%v&per_page=%v", jobType, page, perPage), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Job
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetJobsByType", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// CreateJob creates a job based on the provided job struct.
func (c *Client4) CreateJob(job *Job) (*Job, *Response, error) {
	buf, err := json.Marshal(job)
	if err != nil {
		return nil, nil, NewAppError("CreateJob", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.jobsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var j Job
	if err := json.NewDecoder(r.Body).Decode(&j); err != nil {
		return nil, nil, NewAppError("CreateJob", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &j, BuildResponse(r), nil
}

// CancelJob requests the cancellation of the job with the provided Id.
func (c *Client4) CancelJob(jobId string) (*Response, error) {
	r, err := c.DoAPIPost(c.jobsRoute()+fmt.Sprintf("/%v/cancel", jobId), "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DownloadJob downloads the results of the job
func (c *Client4) DownloadJob(jobId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(c.jobsRoute()+fmt.Sprintf("/%v/download", jobId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetFile", "model.client.read_job_result_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return data, BuildResponse(r), nil
}

// Roles Section

// GetAllRoles returns a list of all the roles.
func (c *Client4) GetAllRoles() ([]*Role, *Response, error) {
	r, err := c.DoAPIGet(c.rolesRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Role
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetAllRoles", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetRole gets a single role by ID.
func (c *Client4) GetRole(id string) (*Role, *Response, error) {
	r, err := c.DoAPIGet(c.rolesRoute()+fmt.Sprintf("/%v", id), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var role Role
	if err := json.NewDecoder(r.Body).Decode(&role); err != nil {
		return nil, nil, NewAppError("GetRole", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &role, BuildResponse(r), nil
}

// GetRoleByName gets a single role by Name.
func (c *Client4) GetRoleByName(name string) (*Role, *Response, error) {
	r, err := c.DoAPIGet(c.rolesRoute()+fmt.Sprintf("/name/%v", name), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var role Role
	if err := json.NewDecoder(r.Body).Decode(&role); err != nil {
		return nil, nil, NewAppError("GetRoleByName", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &role, BuildResponse(r), nil
}

// GetRolesByNames returns a list of roles based on the provided role names.
func (c *Client4) GetRolesByNames(roleNames []string) ([]*Role, *Response, error) {
	r, err := c.DoAPIPost(c.rolesRoute()+"/names", ArrayToJSON(roleNames))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Role
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetRolesByNames", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// PatchRole partially updates a role in the system. Any missing fields are not updated.
func (c *Client4) PatchRole(roleId string, patch *RolePatch) (*Role, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchRole", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.rolesRoute()+fmt.Sprintf("/%v/patch", roleId), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var role Role
	if err := json.NewDecoder(r.Body).Decode(&role); err != nil {
		return nil, nil, NewAppError("PatchRole", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &role, BuildResponse(r), nil
}

// Schemes Section

// CreateScheme creates a new Scheme.
func (c *Client4) CreateScheme(scheme *Scheme) (*Scheme, *Response, error) {
	buf, err := json.Marshal(scheme)
	if err != nil {
		return nil, nil, NewAppError("CreateScheme", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.schemesRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var s Scheme
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		return nil, nil, NewAppError("CreateScheme", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &s, BuildResponse(r), nil
}

// GetScheme gets a single scheme by ID.
func (c *Client4) GetScheme(id string) (*Scheme, *Response, error) {
	r, err := c.DoAPIGet(c.schemeRoute(id), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var s Scheme
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		return nil, nil, NewAppError("GetScheme", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &s, BuildResponse(r), nil
}

// GetSchemes ets all schemes, sorted with the most recently created first, optionally filtered by scope.
func (c *Client4) GetSchemes(scope string, page int, perPage int) ([]*Scheme, *Response, error) {
	r, err := c.DoAPIGet(c.schemesRoute()+fmt.Sprintf("?scope=%v&page=%v&per_page=%v", scope, page, perPage), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Scheme
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetSchemes", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// DeleteScheme deletes a single scheme by ID.
func (c *Client4) DeleteScheme(id string) (*Response, error) {
	r, err := c.DoAPIDelete(c.schemeRoute(id))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PatchScheme partially updates a scheme in the system. Any missing fields are not updated.
func (c *Client4) PatchScheme(id string, patch *SchemePatch) (*Scheme, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchScheme", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.schemeRoute(id)+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var s Scheme
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		return nil, nil, NewAppError("PatchScheme", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &s, BuildResponse(r), nil
}

// GetTeamsForScheme gets the teams using this scheme, sorted alphabetically by display name.
func (c *Client4) GetTeamsForScheme(schemeId string, page int, perPage int) ([]*Team, *Response, error) {
	r, err := c.DoAPIGet(c.schemeRoute(schemeId)+fmt.Sprintf("/teams?page=%v&per_page=%v", page, perPage), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Team
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetTeamsForScheme", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetChannelsForScheme gets the channels using this scheme, sorted alphabetically by display name.
func (c *Client4) GetChannelsForScheme(schemeId string, page int, perPage int) (ChannelList, *Response, error) {
	r, err := c.DoAPIGet(c.schemeRoute(schemeId)+fmt.Sprintf("/channels?page=%v&per_page=%v", page, perPage), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelList
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelsForScheme", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
			return nil, nil, err
		}
	}

	part, err := writer.CreateFormFile("plugin", "plugin.tar.gz")
	if err != nil {
		return nil, nil, err
	}

	if _, err = io.Copy(part, file); err != nil {
		return nil, nil, err
	}

	if err = writer.Close(); err != nil {
		return nil, nil, err
	}

	rq, err := http.NewRequest("POST", c.APIURL+c.pluginsRoute(), body)
	if err != nil {
		return nil, nil, err
	}
	rq.Header.Set("Content-Type", writer.FormDataContentType())

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HTTPClient.Do(rq)
	if err != nil {
		return nil, BuildResponse(rp), err
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, BuildResponse(rp), AppErrorFromJSON(rp.Body)
	}

	var m Manifest
	if err := json.NewDecoder(rp.Body).Decode(&m); err != nil {
		return nil, nil, NewAppError("uploadPlugin", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &m, BuildResponse(rp), nil
}

func (c *Client4) InstallPluginFromURL(downloadURL string, force bool) (*Manifest, *Response, error) {
	forceStr := c.boolString(force)

	url := fmt.Sprintf("%s?plugin_download_url=%s&force=%s", c.pluginsRoute()+"/install_from_url", url.QueryEscape(downloadURL), forceStr)
	r, err := c.DoAPIPost(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var m Manifest
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		return nil, nil, NewAppError("InstallPluginFromUrl", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &m, BuildResponse(r), nil
}

// InstallMarketplacePlugin will install marketplace plugin.
func (c *Client4) InstallMarketplacePlugin(request *InstallMarketplacePluginRequest) (*Manifest, *Response, error) {
	buf, err := json.Marshal(request)
	if err != nil {
		return nil, nil, NewAppError("InstallMarketplacePlugin", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.pluginsRoute()+"/marketplace", string(buf))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var m Manifest
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		return nil, nil, NewAppError("InstallMarketplacePlugin", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &m, BuildResponse(r), nil
}

// GetPlugins will return a list of plugin manifests for currently active plugins.
func (c *Client4) GetPlugins() (*PluginsResponse, *Response, error) {
	r, err := c.DoAPIGet(c.pluginsRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var resp PluginsResponse
	if err := json.NewDecoder(r.Body).Decode(&resp); err != nil {
		return nil, nil, NewAppError("GetPlugins", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &resp, BuildResponse(r), nil
}

// GetPluginStatuses will return the plugins installed on any server in the cluster, for reporting
// to the administrator via the system console.
func (c *Client4) GetPluginStatuses() (PluginStatuses, *Response, error) {
	r, err := c.DoAPIGet(c.pluginsRoute()+"/statuses", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list PluginStatuses
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetPluginStatuses", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// RemovePlugin will disable and delete a plugin.
func (c *Client4) RemovePlugin(id string) (*Response, error) {
	r, err := c.DoAPIDelete(c.pluginRoute(id))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetWebappPlugins will return a list of plugins that the webapp should download.
func (c *Client4) GetWebappPlugins() ([]*Manifest, *Response, error) {
	r, err := c.DoAPIGet(c.pluginsRoute()+"/webapp", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var list []*Manifest
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetWebappPlugins", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// EnablePlugin will enable an plugin installed.
func (c *Client4) EnablePlugin(id string) (*Response, error) {
	r, err := c.DoAPIPost(c.pluginRoute(id)+"/enable", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DisablePlugin will disable an enabled plugin.
func (c *Client4) DisablePlugin(id string) (*Response, error) {
	r, err := c.DoAPIPost(c.pluginRoute(id)+"/disable", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetMarketplacePlugins will return a list of plugins that an admin can install.
func (c *Client4) GetMarketplacePlugins(filter *MarketplacePluginFilter) ([]*MarketplacePlugin, *Response, error) {
	route := c.pluginsRoute() + "/marketplace"
	u, err := url.Parse(route)
	if err != nil {
		return nil, nil, err
	}

	filter.ApplyToURL(u)

	r, err := c.DoAPIGet(u.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	plugins, err := MarketplacePluginsFromReader(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError(route, "model.client.parse_plugins.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return plugins, BuildResponse(r), nil
}

// UpdateChannelScheme will update a channel's scheme.
func (c *Client4) UpdateChannelScheme(channelId, schemeId string) (*Response, error) {
	sip := &SchemeIDPatch{SchemeID: &schemeId}
	buf, err := json.Marshal(sip)
	if err != nil {
		return nil, NewAppError("UpdateChannelScheme", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.channelSchemeRoute(channelId), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateTeamScheme will update a team's scheme.
func (c *Client4) UpdateTeamScheme(teamId, schemeId string) (*Response, error) {
	sip := &SchemeIDPatch{SchemeID: &schemeId}
	buf, err := json.Marshal(sip)
	if err != nil {
		return nil, NewAppError("UpdateTeamScheme", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.teamSchemeRoute(teamId), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetRedirectLocation retrieves the value of the 'Location' header of an HTTP response for a given URL.
func (c *Client4) GetRedirectLocation(urlParam, etag string) (string, *Response, error) {
	url := fmt.Sprintf("%s?url=%s", c.redirectLocationRoute(), url.QueryEscape(urlParam))
	r, err := c.DoAPIGet(url, etag)
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["location"], BuildResponse(r), nil
}

// SetServerBusy will mark the server as busy, which disables non-critical services for `secs` seconds.
func (c *Client4) SetServerBusy(secs int) (*Response, error) {
	url := fmt.Sprintf("%s?seconds=%d", c.serverBusyRoute(), secs)
	r, err := c.DoAPIPost(url, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ClearServerBusy will mark the server as not busy.
func (c *Client4) ClearServerBusy() (*Response, error) {
	r, err := c.DoAPIDelete(c.serverBusyRoute())
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetServerBusy returns the current ServerBusyState including the time when a server marked busy
// will automatically have the flag cleared.
func (c *Client4) GetServerBusy() (*ServerBusyState, *Response, error) {
	r, err := c.DoAPIGet(c.serverBusyRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var sbs ServerBusyState
	if err := json.NewDecoder(r.Body).Decode(&sbs); err != nil {
		return nil, nil, NewAppError("GetServerBusy", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &sbs, BuildResponse(r), nil
}

// RegisterTermsOfServiceAction saves action performed by a user against a specific terms of service.
func (c *Client4) RegisterTermsOfServiceAction(userId, termsOfServiceId string, accepted bool) (*Response, error) {
	url := c.userTermsOfServiceRoute(userId)
	data := map[string]any{"termsOfServiceId": termsOfServiceId, "accepted": accepted}
	r, err := c.DoAPIPost(url, StringInterfaceToJSON(data))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTermsOfService fetches the latest terms of service
func (c *Client4) GetTermsOfService(etag string) (*TermsOfService, *Response, error) {
	url := c.termsOfServiceRoute()
	r, err := c.DoAPIGet(url, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tos TermsOfService
	if err := json.NewDecoder(r.Body).Decode(&tos); err != nil {
		return nil, nil, NewAppError("GetTermsOfService", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &tos, BuildResponse(r), nil
}

// GetUserTermsOfService fetches user's latest terms of service action if the latest action was for acceptance.
func (c *Client4) GetUserTermsOfService(userId, etag string) (*UserTermsOfService, *Response, error) {
	url := c.userTermsOfServiceRoute(userId)
	r, err := c.DoAPIGet(url, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var u UserTermsOfService
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		return nil, nil, NewAppError("GetUserTermsOfService", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &u, BuildResponse(r), nil
}

// CreateTermsOfService creates new terms of service.
func (c *Client4) CreateTermsOfService(text, userId string) (*TermsOfService, *Response, error) {
	url := c.termsOfServiceRoute()
	data := map[string]any{"text": text}
	r, err := c.DoAPIPost(url, StringInterfaceToJSON(data))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var tos TermsOfService
	if err := json.NewDecoder(r.Body).Decode(&tos); err != nil {
		return nil, nil, NewAppError("CreateTermsOfService", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &tos, BuildResponse(r), nil
}

func (c *Client4) GetGroup(groupID, etag string) (*Group, *Response, error) {
	r, err := c.DoAPIGet(c.groupRoute(groupID), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var g Group
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		return nil, nil, NewAppError("GetGroup", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &g, BuildResponse(r), nil
}

func (c *Client4) CreateGroup(group *Group) (*Group, *Response, error) {
	groupJSON, err := json.Marshal(group)
	if err != nil {
		return nil, nil, NewAppError("CreateGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes("/groups", groupJSON)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var p Group
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return nil, nil, NewAppError("CreateGroup", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &p, BuildResponse(r), nil
}

func (c *Client4) DeleteGroup(groupID string) (*Group, *Response, error) {
	r, err := c.DoAPIDelete(c.groupRoute(groupID))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var p Group
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return nil, nil, NewAppError("DeleteGroup", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &p, BuildResponse(r), nil
}

func (c *Client4) RestoreGroup(groupID string, etag string) (*Group, *Response, error) {
	r, err := c.DoAPIPost(c.groupRoute(groupID)+"/restore", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var p Group
	if jsonErr := json.NewDecoder(r.Body).Decode(&p); jsonErr != nil {
		return nil, nil, NewAppError("DeleteGroup", "api.unmarshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
	}
	return &p, BuildResponse(r), nil
}

func (c *Client4) PatchGroup(groupID string, patch *GroupPatch) (*Group, *Response, error) {
	payload, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPut(c.groupRoute(groupID)+"/patch", string(payload))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var g Group
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		return nil, nil, NewAppError("PatchGroup", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &g, BuildResponse(r), nil
}

func (c *Client4) UpsertGroupMembers(groupID string, userIds *GroupModifyMembers) ([]*GroupMember, *Response, error) {
	payload, err := json.Marshal(userIds)
	if err != nil {
		return nil, nil, NewAppError("UpsertGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.groupRoute(groupID)+"/members", payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var g []*GroupMember
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		return nil, nil, NewAppError("UpsertGroupMembers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return g, BuildResponse(r), nil
}

func (c *Client4) DeleteGroupMembers(groupID string, userIds *GroupModifyMembers) ([]*GroupMember, *Response, error) {
	payload, err := json.Marshal(userIds)
	if err != nil {
		return nil, nil, NewAppError("DeleteGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIDeleteBytes(c.groupRoute(groupID)+"/members", payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var g []*GroupMember
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		return nil, nil, NewAppError("DeleteGroupMembers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return g, BuildResponse(r), nil
}

func (c *Client4) LinkGroupSyncable(groupID, syncableID string, syncableType GroupSyncableType, patch *GroupSyncablePatch) (*GroupSyncable, *Response, error) {
	payload, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("LinkGroupSyncable", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	url := fmt.Sprintf("%s/link", c.groupSyncableRoute(groupID, syncableID, syncableType))
	r, err := c.DoAPIPost(url, string(payload))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var gs GroupSyncable
	if err := json.NewDecoder(r.Body).Decode(&gs); err != nil {
		return nil, nil, NewAppError("LinkGroupSyncable", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &gs, BuildResponse(r), nil
}

func (c *Client4) UnlinkGroupSyncable(groupID, syncableID string, syncableType GroupSyncableType) (*Response, error) {
	url := fmt.Sprintf("%s/link", c.groupSyncableRoute(groupID, syncableID, syncableType))
	r, err := c.DoAPIDelete(url)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetGroupSyncable(groupID, syncableID string, syncableType GroupSyncableType, etag string) (*GroupSyncable, *Response, error) {
	r, err := c.DoAPIGet(c.groupSyncableRoute(groupID, syncableID, syncableType), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var gs GroupSyncable
	if err := json.NewDecoder(r.Body).Decode(&gs); err != nil {
		return nil, nil, NewAppError("GetGroupSyncable", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &gs, BuildResponse(r), nil
}

func (c *Client4) GetGroupSyncables(groupID string, syncableType GroupSyncableType, etag string) ([]*GroupSyncable, *Response, error) {
	r, err := c.DoAPIGet(c.groupSyncablesRoute(groupID, syncableType), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*GroupSyncable
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetGroupSyncables", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

func (c *Client4) PatchGroupSyncable(groupID, syncableID string, syncableType GroupSyncableType, patch *GroupSyncablePatch) (*GroupSyncable, *Response, error) {
	payload, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchGroupSyncable", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPut(c.groupSyncableRoute(groupID, syncableID, syncableType)+"/patch", string(payload))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var gs GroupSyncable
	if err := json.NewDecoder(r.Body).Decode(&gs); err != nil {
		return nil, nil, NewAppError("PatchGroupSyncable", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &gs, BuildResponse(r), nil
}

func (c *Client4) TeamMembersMinusGroupMembers(teamID string, groupIDs []string, page, perPage int, etag string) ([]*UserWithGroups, int64, *Response, error) {
	groupIDStr := strings.Join(groupIDs, ",")
	query := fmt.Sprintf("?group_ids=%s&page=%d&per_page=%d", groupIDStr, page, perPage)
	r, err := c.DoAPIGet(c.teamRoute(teamID)+"/members_minus_group_members"+query, etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)

	var ugc UsersWithGroupsAndCount
	if err := json.NewDecoder(r.Body).Decode(&ugc); err != nil {
		return nil, 0, nil, NewAppError("TeamMembersMinusGroupMembers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ugc.Users, ugc.Count, BuildResponse(r), nil
}

func (c *Client4) ChannelMembersMinusGroupMembers(channelID string, groupIDs []string, page, perPage int, etag string) ([]*UserWithGroups, int64, *Response, error) {
	groupIDStr := strings.Join(groupIDs, ",")
	query := fmt.Sprintf("?group_ids=%s&page=%d&per_page=%d", groupIDStr, page, perPage)
	r, err := c.DoAPIGet(c.channelRoute(channelID)+"/members_minus_group_members"+query, etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)
	var ugc UsersWithGroupsAndCount
	if err := json.NewDecoder(r.Body).Decode(&ugc); err != nil {
		return nil, 0, nil, NewAppError("ChannelMembersMinusGroupMembers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ugc.Users, ugc.Count, BuildResponse(r), nil
}

func (c *Client4) PatchConfig(config *Config) (*Config, *Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return nil, nil, NewAppError("PatchConfig", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.configRoute()+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cfg *Config
	d := json.NewDecoder(r.Body)
	return cfg, BuildResponse(r), d.Decode(&cfg)
}

func (c *Client4) GetChannelModerations(channelID string, etag string) ([]*ChannelModeration, *Response, error) {
	r, err := c.DoAPIGet(c.channelRoute(channelID)+"/moderations", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*ChannelModeration
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelModerations", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

func (c *Client4) PatchChannelModerations(channelID string, patch []*ChannelModerationPatch) ([]*ChannelModeration, *Response, error) {
	payload, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchChannelModerations", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPut(c.channelRoute(channelID)+"/moderations/patch", string(payload))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*ChannelModeration
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("PatchChannelModerations", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

func (c *Client4) GetKnownUsers() ([]string, *Response, error) {
	r, err := c.DoAPIGet(c.usersRoute()+"/known", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var userIds []string
	json.NewDecoder(r.Body).Decode(&userIds)
	return userIds, BuildResponse(r), nil
}

// PublishUserTyping publishes a user is typing websocket event based on the provided TypingRequest.
func (c *Client4) PublishUserTyping(userID string, typingRequest TypingRequest) (*Response, error) {
	buf, err := json.Marshal(typingRequest)
	if err != nil {
		return nil, NewAppError("PublishUserTyping", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.publishUserTypingRoute(userID), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetChannelMemberCountsByGroup(channelID string, includeTimezones bool, etag string) ([]*ChannelMemberCountByGroup, *Response, error) {
	r, err := c.DoAPIGet(c.channelRoute(channelID)+"/member_counts_by_group?include_timezones="+strconv.FormatBool(includeTimezones), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*ChannelMemberCountByGroup
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GetChannelMemberCountsByGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// RequestTrialLicense will request a trial license and install it in the server
func (c *Client4) RequestTrialLicense(users int) (*Response, error) {
	b, err := json.Marshal(map[string]any{"users": users, "terms_accepted": true})
	if err != nil {
		return nil, NewAppError("RequestTrialLicense", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost("/trial-license", string(b))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetGroupStats retrieves stats for a Mattermost Group
func (c *Client4) GetGroupStats(groupID string) (*GroupStats, *Response, error) {
	r, err := c.DoAPIGet(c.groupRoute(groupID)+"/stats", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var gs GroupStats
	if err := json.NewDecoder(r.Body).Decode(&gs); err != nil {
		return nil, nil, NewAppError("GetGroupStats", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &gs, BuildResponse(r), nil
}

func (c *Client4) GetSidebarCategoriesForTeamForUser(userID, teamID, etag string) (*OrderedSidebarCategories, *Response, error) {
	route := c.userCategoryRoute(userID, teamID)
	r, err := c.DoAPIGet(route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}

	var cat *OrderedSidebarCategories
	err = json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.GetSidebarCategoriesForTeamForUser", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return cat, BuildResponse(r), nil
}

func (c *Client4) CreateSidebarCategoryForTeamForUser(userID, teamID string, category *SidebarCategoryWithChannels) (*SidebarCategoryWithChannels, *Response, error) {
	payload, err := json.Marshal(category)
	if err != nil {
		return nil, nil, NewAppError("CreateSidebarCategoryForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	route := c.userCategoryRoute(userID, teamID)
	r, err := c.DoAPIPostBytes(route, payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var cat *SidebarCategoryWithChannels
	err = json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.CreateSidebarCategoryForTeamForUser", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}
	return cat, BuildResponse(r), nil
}

func (c *Client4) UpdateSidebarCategoriesForTeamForUser(userID, teamID string, categories []*SidebarCategoryWithChannels) ([]*SidebarCategoryWithChannels, *Response, error) {
	payload, err := json.Marshal(categories)
	if err != nil {
		return nil, nil, NewAppError("UpdateSidebarCategoriesForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	route := c.userCategoryRoute(userID, teamID)

	r, err := c.DoAPIPutBytes(route, payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cat []*SidebarCategoryWithChannels
	err = json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.UpdateSidebarCategoriesForTeamForUser", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}

	return cat, BuildResponse(r), nil
}

func (c *Client4) GetSidebarCategoryOrderForTeamForUser(userID, teamID, etag string) ([]string, *Response, error) {
	route := c.userCategoryRoute(userID, teamID) + "/order"
	r, err := c.DoAPIGet(route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJSON(r.Body), BuildResponse(r), nil
}

func (c *Client4) UpdateSidebarCategoryOrderForTeamForUser(userID, teamID string, order []string) ([]string, *Response, error) {
	payload, err := json.Marshal(order)
	if err != nil {
		return nil, nil, NewAppError("UpdateSidebarCategoryOrderForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	route := c.userCategoryRoute(userID, teamID) + "/order"
	r, err := c.DoAPIPutBytes(route, payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJSON(r.Body), BuildResponse(r), nil
}

func (c *Client4) GetSidebarCategoryForTeamForUser(userID, teamID, categoryID, etag string) (*SidebarCategoryWithChannels, *Response, error) {
	route := c.userCategoryRoute(userID, teamID) + "/" + categoryID
	r, err := c.DoAPIGet(route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var cat *SidebarCategoryWithChannels
	err = json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.UpdateSidebarCategoriesForTeamForUser", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}

	return cat, BuildResponse(r), nil
}

func (c *Client4) UpdateSidebarCategoryForTeamForUser(userID, teamID, categoryID string, category *SidebarCategoryWithChannels) (*SidebarCategoryWithChannels, *Response, error) {
	payload, err := json.Marshal(category)
	if err != nil {
		return nil, nil, NewAppError("UpdateSidebarCategoryForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	route := c.userCategoryRoute(userID, teamID) + "/" + categoryID
	r, err := c.DoAPIPutBytes(route, payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var cat *SidebarCategoryWithChannels
	err = json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("Client4.UpdateSidebarCategoriesForTeamForUser", "model.utils.decode_json.app_error", nil, "", r.StatusCode).Wrap(err)
	}

	return cat, BuildResponse(r), nil
}

// CheckIntegrity performs a database integrity check.
func (c *Client4) CheckIntegrity() ([]IntegrityCheckResult, *Response, error) {
	r, err := c.DoAPIPost("/integrity", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var results []IntegrityCheckResult
	if err := json.NewDecoder(r.Body).Decode(&results); err != nil {
		return nil, BuildResponse(r), NewAppError("Api4.CheckIntegrity", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return results, BuildResponse(r), nil
}

func (c *Client4) GetNotices(lastViewed int64, teamId string, client NoticeClientType, clientVersion, locale, etag string) (NoticeMessages, *Response, error) {
	url := fmt.Sprintf("/system/notices/%s?lastViewed=%d&client=%s&clientVersion=%s&locale=%s", teamId, lastViewed, client, clientVersion, locale)
	r, err := c.DoAPIGet(url, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	notices, err := UnmarshalProductNoticeMessages(r.Body)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	return notices, BuildResponse(r), nil
}

func (c *Client4) MarkNoticesViewed(ids []string) (*Response, error) {
	r, err := c.DoAPIPut("/system/notices/view", ArrayToJSON(ids))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) CompleteOnboarding(request *CompleteOnboardingRequest) (*Response, error) {
	buf, err := json.Marshal(request)
	if err != nil {
		return nil, NewAppError("CompleteOnboarding", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(c.systemRoute()+"/onboarding/complete", string(buf))
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
		return nil, nil, NewAppError("CreateUpload", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.uploadsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var s UploadSession
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		return nil, nil, NewAppError("CreateUpload", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &s, BuildResponse(r), nil
}

// GetUpload returns the upload session for the specified uploadId.
func (c *Client4) GetUpload(uploadId string) (*UploadSession, *Response, error) {
	r, err := c.DoAPIGet(c.uploadRoute(uploadId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var s UploadSession
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		return nil, nil, NewAppError("GetUpload", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &s, BuildResponse(r), nil
}

// GetUploadsForUser returns the upload sessions created by the specified
// userId.
func (c *Client4) GetUploadsForUser(userId string) ([]*UploadSession, *Response, error) {
	r, err := c.DoAPIGet(c.userRoute(userId)+"/uploads", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*UploadSession
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUploadsForUser", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// UploadData performs an upload. On success it returns
// a FileInfo object.
func (c *Client4) UploadData(uploadId string, data io.Reader) (*FileInfo, *Response, error) {
	url := c.uploadRoute(uploadId)
	r, err := c.DoAPIRequestReader("POST", c.APIURL+url, data, nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var fi FileInfo
	if r.StatusCode == http.StatusNoContent {
		return nil, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&fi); err != nil {
		return nil, nil, NewAppError("UploadData", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &fi, BuildResponse(r), nil
}

func (c *Client4) UpdatePassword(userId, currentPassword, newPassword string) (*Response, error) {
	requestBody := map[string]string{"current_password": currentPassword, "new_password": newPassword}
	r, err := c.DoAPIPut(c.userRoute(userId)+"/password", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Cloud Section

func (c *Client4) GetCloudProducts() ([]*Product, *Response, error) {
	r, err := c.DoAPIGet(c.cloudRoute()+"/products", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cloudProducts []*Product
	json.NewDecoder(r.Body).Decode(&cloudProducts)

	return cloudProducts, BuildResponse(r), nil
}

func (c *Client4) GetSelfHostedProducts() ([]*Product, *Response, error) {
	r, err := c.DoAPIGet(c.cloudRoute()+"/products/selfhosted", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var products []*Product
	json.NewDecoder(r.Body).Decode(&products)

	return products, BuildResponse(r), nil
}

func (c *Client4) GetProductLimits() (*ProductLimits, *Response, error) {
	r, err := c.DoAPIGet(c.cloudRoute()+"/limits", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var productLimits *ProductLimits
	json.NewDecoder(r.Body).Decode(&productLimits)

	return productLimits, BuildResponse(r), nil
}

func (c *Client4) CreateCustomerPayment() (*StripeSetupIntent, *Response, error) {
	r, err := c.DoAPIPost(c.cloudRoute()+"/payment", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var setupIntent *StripeSetupIntent
	json.NewDecoder(r.Body).Decode(&setupIntent)

	return setupIntent, BuildResponse(r), nil
}

func (c *Client4) ConfirmCustomerPayment(confirmRequest *ConfirmPaymentMethodRequest) (*Response, error) {
	json, err := json.Marshal(confirmRequest)
	if err != nil {
		return nil, NewAppError("ConfirmCustomerPayment", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.cloudRoute()+"/payment/confirm", json)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) RequestCloudTrial(cloudTrialRequest *StartCloudTrialRequest) (*Subscription, *Response, error) {
	payload, err := json.Marshal(cloudTrialRequest)
	if err != nil {
		return nil, nil, NewAppError("RequestCloudTrial", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.cloudRoute()+"/request-trial", payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var subscription *Subscription
	json.NewDecoder(r.Body).Decode(&subscription)

	return subscription, BuildResponse(r), nil
}

func (c *Client4) ValidateWorkspaceBusinessEmail() (*Response, error) {
	r, err := c.DoAPIPost(c.cloudRoute()+"/validate-workspace-business-email", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) NotifyAdmin(nr *NotifyAdminToUpgradeRequest) (int, error) {
	nrJSON, err := json.Marshal(nr)
	if err != nil {
		return 0, err
	}

	r, err := c.DoAPIPost("/users/notify-admin", string(nrJSON))
	if err != nil {
		return r.StatusCode, err
	}

	closeBody(r)

	return r.StatusCode, nil
}

func (c *Client4) TriggerNotifyAdmin(nr *NotifyAdminToUpgradeRequest) (int, error) {
	nrJSON, err := json.Marshal(nr)
	if err != nil {
		return 0, err
	}

	r, err := c.DoAPIPost("/users/trigger-notify-admin-posts", string(nrJSON))
	if err != nil {
		return r.StatusCode, err
	}

	closeBody(r)

	return r.StatusCode, nil
}

func (c *Client4) ValidateBusinessEmail(email *ValidateBusinessEmailRequest) (*Response, error) {
	payload, _ := json.Marshal(email)
	r, err := c.DoAPIPostBytes(c.cloudRoute()+"/validate-business-email", payload)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) GetCloudCustomer() (*CloudCustomer, *Response, error) {
	r, err := c.DoAPIGet(c.cloudRoute()+"/customer", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cloudCustomer *CloudCustomer
	json.NewDecoder(r.Body).Decode(&cloudCustomer)

	return cloudCustomer, BuildResponse(r), nil
}

func (c *Client4) GetExpandStats(licenseId string) (*SubscriptionExpandStats, *Response, error) {
	r, err := c.DoAPIGet(fmt.Sprintf("%s%s?licenseID=%s", c.cloudRoute(), "/subscription/expand", licenseId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var subscriptionExpandable *SubscriptionExpandStats
	json.NewDecoder(r.Body).Decode(&subscriptionExpandable)

	return subscriptionExpandable, BuildResponse(r), nil
}

func (c *Client4) GetSubscription() (*Subscription, *Response, error) {
	r, err := c.DoAPIGet(c.cloudRoute()+"/subscription", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var subscription *Subscription
	json.NewDecoder(r.Body).Decode(&subscription)

	return subscription, BuildResponse(r), nil
}

func (c *Client4) GetInvoicesForSubscription() ([]*Invoice, *Response, error) {
	r, err := c.DoAPIGet(c.cloudRoute()+"/subscription/invoices", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var invoices []*Invoice
	json.NewDecoder(r.Body).Decode(&invoices)

	return invoices, BuildResponse(r), nil
}

func (c *Client4) UpdateCloudCustomer(customerInfo *CloudCustomerInfo) (*CloudCustomer, *Response, error) {
	customerBytes, err := json.Marshal(customerInfo)
	if err != nil {
		return nil, nil, NewAppError("UpdateCloudCustomer", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.cloudRoute()+"/customer", customerBytes)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var customer *CloudCustomer
	json.NewDecoder(r.Body).Decode(&customer)

	return customer, BuildResponse(r), nil
}

func (c *Client4) UpdateCloudCustomerAddress(address *Address) (*CloudCustomer, *Response, error) {
	addressBytes, err := json.Marshal(address)
	if err != nil {
		return nil, nil, NewAppError("UpdateCloudCustomerAddress", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(c.cloudRoute()+"/customer/address", addressBytes)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var customer *CloudCustomer
	json.NewDecoder(r.Body).Decode(&customer)

	return customer, BuildResponse(r), nil
}

func (c *Client4) BootstrapSelfHostedSignup(req BootstrapSelfHostedSignupRequest) (*BootstrapSelfHostedSignupResponse, *Response, error) {
	reqBytes, err := json.Marshal(req)
	if err != nil {
		return nil, nil, NewAppError("BootstrapSelfHostedSignup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(c.hostedCustomerRoute()+"/bootstrap", reqBytes)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var res *BootstrapSelfHostedSignupResponse
	json.NewDecoder(r.Body).Decode(&res)

	return res, BuildResponse(r), nil
}

func (c *Client4) ListImports() ([]string, *Response, error) {
	r, err := c.DoAPIGet(c.importsRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJSON(r.Body), BuildResponse(r), nil
}

func (c *Client4) ListExports() ([]string, *Response, error) {
	r, err := c.DoAPIGet(c.exportsRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ArrayFromJSON(r.Body), BuildResponse(r), nil
}

func (c *Client4) DeleteExport(name string) (*Response, error) {
	r, err := c.DoAPIDelete(c.exportRoute(name))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) DownloadExport(name string, wr io.Writer, offset int64) (int64, *Response, error) {
	var headers map[string]string
	if offset > 0 {
		headers = map[string]string{
			HeaderRange: fmt.Sprintf("bytes=%d-", offset),
		}
	}
	r, err := c.DoAPIRequestWithHeaders(http.MethodGet, c.APIURL+c.exportRoute(name), "", headers)
	if err != nil {
		return 0, BuildResponse(r), err
	}
	defer closeBody(r)
	n, err := io.Copy(wr, r.Body)
	if err != nil {
		return n, BuildResponse(r), NewAppError("DownloadExport", "model.client.copy.app_error", nil, "", r.StatusCode).Wrap(err)
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
		v.Set("per_page", fmt.Sprintf("%d", options.PageSize))
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
	if options.ThreadsOnly {
		v.Set("threadsOnly", "true")
	}
	if options.TotalsOnly {
		v.Set("totalsOnly", "true")
	}
	url := c.userThreadsRoute(userId, teamId)
	if len(v) > 0 {
		url += "?" + v.Encode()
	}

	r, err := c.DoAPIGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var threads Threads
	json.NewDecoder(r.Body).Decode(&threads)

	return &threads, BuildResponse(r), nil
}

func (c *Client4) GetUserThread(userId, teamId, threadId string, extended bool) (*ThreadResponse, *Response, error) {
	url := c.userThreadRoute(userId, teamId, threadId)
	if extended {
		url += "?extended=true"
	}
	r, err := c.DoAPIGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var thread ThreadResponse
	json.NewDecoder(r.Body).Decode(&thread)

	return &thread, BuildResponse(r), nil
}

func (c *Client4) UpdateThreadsReadForUser(userId, teamId string) (*Response, error) {
	r, err := c.DoAPIPut(fmt.Sprintf("%s/read", c.userThreadsRoute(userId, teamId)), "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) SetThreadUnreadByPostId(userId, teamId, threadId, postId string) (*ThreadResponse, *Response, error) {
	r, err := c.DoAPIPost(fmt.Sprintf("%s/set_unread/%s", c.userThreadRoute(userId, teamId, threadId), postId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var thread ThreadResponse
	json.NewDecoder(r.Body).Decode(&thread)

	return &thread, BuildResponse(r), nil
}

func (c *Client4) UpdateThreadReadForUser(userId, teamId, threadId string, timestamp int64) (*ThreadResponse, *Response, error) {
	r, err := c.DoAPIPut(fmt.Sprintf("%s/read/%d", c.userThreadRoute(userId, teamId, threadId), timestamp), "")
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
		r, err = c.DoAPIPut(c.userThreadRoute(userId, teamId, threadId)+"/following", "")
	} else {
		r, err = c.DoAPIDelete(c.userThreadRoute(userId, teamId, threadId) + "/following")
	}
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) GetAllSharedChannels(teamID string, page, perPage int) ([]*SharedChannel, *Response, error) {
	url := fmt.Sprintf("%s/%s?page=%d&per_page=%d", c.sharedChannelsRoute(), teamID, page, perPage)
	r, err := c.DoAPIGet(url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var channels []*SharedChannel
	json.NewDecoder(r.Body).Decode(&channels)

	return channels, BuildResponse(r), nil
}

func (c *Client4) GetRemoteClusterInfo(remoteID string) (RemoteClusterInfo, *Response, error) {
	url := fmt.Sprintf("%s/remote_info/%s", c.sharedChannelsRoute(), remoteID)
	r, err := c.DoAPIGet(url, "")
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
	url := fmt.Sprintf("%s/ancillary?subsection_permissions=%s", c.permissionsRoute(), strings.Join(subsectionPermissions, ","))
	r, err := c.DoAPIGet(url, "")
	if err != nil {
		return returnedPermissions, BuildResponse(r), err
	}
	defer closeBody(r)

	json.NewDecoder(r.Body).Decode(&returnedPermissions)
	return returnedPermissions, BuildResponse(r), nil
}

func (c *Client4) GetUsersWithInvalidEmails(page, perPage int) ([]*User, *Response, error) {
	query := fmt.Sprintf("/invalid_emails?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(c.usersRoute()+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

func (c *Client4) GetAppliedSchemaMigrations() ([]AppliedMigration, *Response, error) {
	r, err := c.DoAPIGet(c.systemRoute()+"/schema/version", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []AppliedMigration
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// Usage Section

// GetPostsUsage returns rounded off total usage of posts for the instance
func (c *Client4) GetPostsUsage() (*PostsUsage, *Response, error) {
	r, err := c.DoAPIGet(c.usageRoute()+"/posts", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var usage *PostsUsage
	err = json.NewDecoder(r.Body).Decode(&usage)
	return usage, BuildResponse(r), err
}

// GetStorageUsage returns the file storage usage for the instance,
// rounded down the most signigicant digit
func (c *Client4) GetStorageUsage() (*StorageUsage, *Response, error) {
	r, err := c.DoAPIGet(c.usageRoute()+"/storage", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var usage *StorageUsage
	err = json.NewDecoder(r.Body).Decode(&usage)
	return usage, BuildResponse(r), err
}

// GetTeamsUsage returns total usage of teams for the instance
func (c *Client4) GetTeamsUsage() (*TeamsUsage, *Response, error) {
	r, err := c.DoAPIGet(c.usageRoute()+"/teams", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var usage *TeamsUsage
	err = json.NewDecoder(r.Body).Decode(&usage)
	return usage, BuildResponse(r), err
}

func (c *Client4) GetNewTeamMembersSince(teamID string, timeRange string, page int, perPage int) (*NewTeamMembersList, *Response, error) {
	query := fmt.Sprintf("?time_range=%v&page=%v&per_page=%v", timeRange, page, perPage)
	r, err := c.DoAPIGet(c.teamRoute(teamID)+"/top/team_members"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var newTeamMembersList *NewTeamMembersList
	if jsonErr := json.NewDecoder(r.Body).Decode(&newTeamMembersList); jsonErr != nil {
		return nil, nil, NewAppError("GetNewTeamMembersSince", "api.unmarshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
	}
	return newTeamMembersList, BuildResponse(r), nil
}

func (c *Client4) AcknowledgePost(postId, userId string) (*PostAcknowledgement, *Response, error) {
	r, err := c.DoAPIPost(c.userRoute(userId)+c.postRoute(postId)+"/ack", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var ack *PostAcknowledgement
	if jsonErr := json.NewDecoder(r.Body).Decode(&ack); jsonErr != nil {
		return nil, nil, NewAppError("AcknowledgePost", "api.unmarshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
	}
	return ack, BuildResponse(r), nil
}

func (c *Client4) UnacknowledgePost(postId, userId string) (*Response, error) {
	r, err := c.DoAPIDelete(c.userRoute(userId) + c.postRoute(postId) + "/ack")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) AddUserToGroupSyncables(userID string) (*Response, error) {
	r, err := c.DoAPIPost(c.ldapRoute()+"/users/"+userID+"/group_sync_memberships", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Worktemplates sections

func (c *Client4) worktemplatesRoute() string {
	return "/worktemplates"
}

// GetWorktemplateCategories returns categories of worktemplates
func (c *Client4) GetWorktemplateCategories() ([]*WorkTemplateCategory, *Response, error) {
	r, err := c.DoAPIGet(c.worktemplatesRoute()+"/categories", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var categories []*WorkTemplateCategory
	err = json.NewDecoder(r.Body).Decode(&categories)
	return categories, BuildResponse(r), err
}

func (c *Client4) GetWorkTemplatesByCategory(category string) ([]*WorkTemplate, *Response, error) {
	r, err := c.DoAPIGet(c.worktemplatesRoute()+"/categories/"+category+"/templates", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var templates []*WorkTemplate
	err = json.NewDecoder(r.Body).Decode(&templates)
	return templates, BuildResponse(r), err
}
