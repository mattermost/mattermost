// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
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

// DecodeJSONFromResponse decodes JSON from an HTTP response and returns the result.
// Handles 304 Not Modified responses and calls [BuildResponse] automatically.
func DecodeJSONFromResponse[T any](r *http.Response) (T, *Response, error) {
	var result T
	if r.StatusCode == http.StatusNotModified {
		return result, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&result); err != nil {
		return result, BuildResponse(r), fmt.Errorf("failed to decode JSON response: %w", err)
	}
	return result, BuildResponse(r), nil
}

// ReadBytesFromResponse reads all bytes from an HTTP response body and returns them.
// Handles 304 Not Modified responses and calls [BuildResponse] automatically.
func ReadBytesFromResponse(r *http.Response) ([]byte, *Response, error) {
	if r.StatusCode == http.StatusNotModified {
		return nil, BuildResponse(r), nil
	}
	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	return data, BuildResponse(r), nil
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

func (c *Client4) usersRoute() clientRoute {
	return newClientRoute("users")
}

func (c *Client4) reportsRoute() clientRoute {
	return newClientRoute("reports")
}

func (c *Client4) userRoute(userId string) clientRoute {
	// "me" is a special keyword in the API, not a user ID
	if userId == Me {
		return c.usersRoute().JoinSegment(Me)
	}
	return c.usersRoute().JoinId(userId)
}

func (c *Client4) userThreadsRoute(userID, teamID string) clientRoute {
	return c.userRoute(userID).JoinRoute(c.teamRoute(teamID)).JoinSegment("threads")
}

func (c *Client4) userThreadRoute(userId, teamId, threadId string) clientRoute {
	return c.userThreadsRoute(userId, teamId).JoinId(threadId)
}

func (c *Client4) userCategoryRoute(userID, teamID string) clientRoute {
	return c.userRoute(userID).JoinRoute(c.teamRoute(teamID)).JoinSegments("channels", "categories")
}

func (c *Client4) userAccessTokensRoute() clientRoute {
	return c.usersRoute().JoinSegment("tokens")
}

func (c *Client4) userAccessTokenRoute(tokenId string) clientRoute {
	return c.usersRoute().JoinSegment("tokens").JoinId(tokenId)
}

func (c *Client4) userByUsernameRoute(userName string) clientRoute {
	return c.usersRoute().JoinSegment("username").JoinUsername(userName)
}

func (c *Client4) userByEmailRoute(email string) clientRoute {
	return c.usersRoute().JoinSegment("email").JoinEmail(email)
}

func (c *Client4) botsRoute() clientRoute {
	return newClientRoute("bots")
}

func (c *Client4) botRoute(botUserId string) clientRoute {
	return c.botsRoute().JoinId(botUserId)
}

func (c *Client4) teamsRoute() clientRoute {
	return newClientRoute("teams")
}

func (c *Client4) teamRoute(teamId string) clientRoute {
	return c.teamsRoute().JoinId(teamId)
}

func (c *Client4) teamAutoCompleteCommandsRoute(teamId string) clientRoute {
	return c.teamsRoute().JoinId(teamId).JoinSegments("commands", "autocomplete")
}

func (c *Client4) teamByNameRoute(teamName string) clientRoute {
	return c.teamsRoute().JoinSegment("name").JoinTeamname(teamName)
}

func (c *Client4) teamMemberRoute(teamId, userId string) clientRoute {
	return c.teamRoute(teamId).JoinSegment("members").JoinId(userId)
}

func (c *Client4) teamMembersRoute(teamId string) clientRoute {
	return c.teamRoute(teamId).JoinSegment("members")
}

func (c *Client4) teamStatsRoute(teamId string) clientRoute {
	return c.teamRoute(teamId).JoinSegment("stats")
}

func (c *Client4) teamImportRoute(teamId string) clientRoute {
	return c.teamRoute(teamId).JoinSegment("import")
}

func (c *Client4) channelsRoute() clientRoute {
	return newClientRoute("channels")
}

func (c *Client4) channelsForTeamRoute(teamId string) clientRoute {
	return c.teamRoute(teamId).JoinSegment("channels")
}

func (c *Client4) channelRoute(channelId string) clientRoute {
	return c.channelsRoute().JoinId(channelId)
}

func (c *Client4) channelByNameRoute(channelName, teamId string) clientRoute {
	return c.teamRoute(teamId).JoinSegments("channels", "name").JoinChannelname(channelName)
}

func (c *Client4) channelsForTeamForUserRoute(teamId, userId string) clientRoute {
	return c.userRoute(userId).JoinRoute(c.teamRoute(teamId)).JoinSegment("channels")
}

func (c *Client4) channelByNameForTeamNameRoute(channelName, teamName string) clientRoute {
	return c.teamByNameRoute(teamName).JoinSegments("channels", "name").JoinChannelname(channelName)
}

func (c *Client4) channelMembersRoute(channelId string) clientRoute {
	return c.channelRoute(channelId).JoinSegment("members")
}

func (c *Client4) channelMemberRoute(channelId, userId string) clientRoute {
	return c.channelMembersRoute(channelId).JoinId(userId)
}

func (c *Client4) postsRoute() clientRoute {
	return newClientRoute("posts")
}

func (c *Client4) contentFlaggingRoute() clientRoute {
	return newClientRoute("content_flagging")
}

func (c *Client4) postsEphemeralRoute() clientRoute {
	return newClientRoute("posts").JoinSegment("ephemeral")
}

func (c *Client4) configRoute() clientRoute {
	return newClientRoute("config")
}

func (c *Client4) licenseRoute() clientRoute {
	return newClientRoute("license")
}

func (c *Client4) postRoute(postId string) clientRoute {
	return c.postsRoute().JoinId(postId)
}

func (c *Client4) filesRoute() clientRoute {
	return newClientRoute("files")
}

func (c *Client4) fileRoute(fileId string) clientRoute {
	return c.filesRoute().JoinId(fileId)
}

func (c *Client4) uploadsRoute() clientRoute {
	return newClientRoute("uploads")
}

func (c *Client4) uploadRoute(uploadId string) clientRoute {
	return c.uploadsRoute().JoinId(uploadId)
}

func (c *Client4) pluginsRoute() clientRoute {
	return newClientRoute("plugins")
}

func (c *Client4) pluginRoute(pluginId string) clientRoute {
	return c.pluginsRoute().JoinId(pluginId)
}

func (c *Client4) systemRoute() clientRoute {
	return newClientRoute("system")
}

func (c *Client4) cloudRoute() clientRoute {
	return newClientRoute("cloud")
}

func (c *Client4) testEmailRoute() clientRoute {
	return newClientRoute("email").JoinSegment("test")
}

func (c *Client4) testNotificationRoute() clientRoute {
	return newClientRoute("notifications").JoinSegment("test")
}

func (c *Client4) usageRoute() clientRoute {
	return newClientRoute("usage")
}

func (c *Client4) testSiteURLRoute() clientRoute {
	return newClientRoute("site_url").JoinSegment("test")
}

func (c *Client4) testS3Route() clientRoute {
	return newClientRoute("file").JoinSegment("s3_test")
}

func (c *Client4) databaseRoute() clientRoute {
	return newClientRoute("database")
}

func (c *Client4) cacheRoute() clientRoute {
	return newClientRoute("caches")
}

func (c *Client4) clusterRoute() clientRoute {
	return newClientRoute("cluster")
}

func (c *Client4) incomingWebhooksRoute() clientRoute {
	return newClientRoute("hooks").JoinSegment("incoming")
}

func (c *Client4) incomingWebhookRoute(hookID string) clientRoute {
	return c.incomingWebhooksRoute().JoinId(hookID)
}

func (c *Client4) complianceReportsRoute() clientRoute {
	return newClientRoute("compliance").JoinSegment("reports")
}

func (c *Client4) complianceReportRoute(reportId string) clientRoute {
	return c.complianceReportsRoute().JoinId(reportId)
}

func (c *Client4) complianceReportDownloadRoute(reportId string) clientRoute {
	return c.complianceReportsRoute().JoinId(reportId).JoinSegment("download")
}

func (c *Client4) outgoingWebhooksRoute() clientRoute {
	return newClientRoute("hooks").JoinSegment("outgoing")
}

func (c *Client4) outgoingWebhookRoute(hookID string) clientRoute {
	return c.outgoingWebhooksRoute().JoinId(hookID)
}

func (c *Client4) preferencesRoute(userId string) clientRoute {
	return c.userRoute(userId).JoinSegment("preferences")
}

func (c *Client4) userStatusRoute(userId string) clientRoute {
	return c.userRoute(userId).JoinSegment("status")
}

func (c *Client4) userStatusesRoute() clientRoute {
	return c.usersRoute().JoinSegment("status")
}

func (c *Client4) samlRoute() clientRoute {
	return newClientRoute("saml")
}

func (c *Client4) ldapRoute() clientRoute {
	return newClientRoute("ldap")
}

func (c *Client4) brandRoute() clientRoute {
	return newClientRoute("brand")
}

func (c *Client4) dataRetentionRoute() clientRoute {
	return newClientRoute("data_retention")
}

func (c *Client4) dataRetentionPolicyRoute(policyID string) clientRoute {
	return c.dataRetentionRoute().JoinSegment("policies").JoinId(policyID)
}

func (c *Client4) elasticsearchRoute() clientRoute {
	return newClientRoute("elasticsearch")
}

func (c *Client4) commandsRoute() clientRoute {
	return newClientRoute("commands")
}

func (c *Client4) commandRoute(commandId string) clientRoute {
	return c.commandsRoute().JoinId(commandId)
}

func (c *Client4) commandMoveRoute(commandId string) clientRoute {
	return c.commandsRoute().JoinId(commandId).JoinSegment("move")
}

func (c *Client4) draftsRoute() clientRoute {
	return newClientRoute("drafts")
}

func (c *Client4) emojisRoute() clientRoute {
	return newClientRoute("emoji")
}

func (c *Client4) emojiRoute(emojiId string) clientRoute {
	return c.emojisRoute().JoinId(emojiId)
}

func (c *Client4) emojiByNameRoute(name string) clientRoute {
	return c.emojisRoute().JoinSegment("name").JoinEmojiname(name)
}

func (c *Client4) reactionsRoute() clientRoute {
	return newClientRoute("reactions")
}

func (c *Client4) oAuthRoute() clientRoute {
	return newClientRoute("oauth")
}

func (c *Client4) oAuthAppsRoute() clientRoute {
	return c.oAuthRoute().JoinSegment("apps")
}

func (c *Client4) oAuthAppRoute(appId string) clientRoute {
	return c.oAuthAppsRoute().JoinId(appId)
}

func (c *Client4) oAuthRegisterRoute() clientRoute {
	return c.oAuthAppsRoute().JoinSegment("register")
}

func (c *Client4) outgoingOAuthConnectionsRoute() clientRoute {
	return c.oAuthRoute().JoinSegment("outgoing_connections")
}

func (c *Client4) outgoingOAuthConnectionRoute(id string) clientRoute {
	return c.outgoingOAuthConnectionsRoute().JoinId(id)
}

func (c *Client4) jobsRoute() clientRoute {
	return newClientRoute("jobs")
}

func (c *Client4) rolesRoute() clientRoute {
	return newClientRoute("roles")
}

func (c *Client4) schemesRoute() clientRoute {
	return newClientRoute("schemes")
}

func (c *Client4) schemeRoute(id string) clientRoute {
	return c.schemesRoute().JoinId(id)
}

func (c *Client4) analyticsRoute() clientRoute {
	return newClientRoute("analytics")
}

func (c *Client4) timezonesRoute() clientRoute {
	return c.systemRoute().JoinSegment("timezones")
}

func (c *Client4) channelSchemeRoute(channelId string) clientRoute {
	return c.channelsRoute().JoinId(channelId).JoinSegment("scheme")
}

func (c *Client4) teamSchemeRoute(teamId string) clientRoute {
	return c.teamsRoute().JoinId(teamId).JoinSegment("scheme")
}

func (c *Client4) totalUsersStatsRoute() clientRoute {
	return c.usersRoute().JoinSegment("stats")
}

func (c *Client4) redirectLocationRoute() clientRoute {
	return newClientRoute("redirect_location")
}

func (c *Client4) serverBusyRoute() clientRoute {
	return newClientRoute("server_busy")
}

func (c *Client4) userTermsOfServiceRoute(userId string) clientRoute {
	return c.userRoute(userId).JoinSegment("terms_of_service")
}

func (c *Client4) termsOfServiceRoute() clientRoute {
	return newClientRoute("terms_of_service")
}

func (c *Client4) groupsRoute() clientRoute {
	return newClientRoute("groups")
}

func (c *Client4) publishUserTypingRoute(userId string) clientRoute {
	return c.userRoute(userId).JoinSegment("typing")
}

func (c *Client4) groupRoute(groupID string) clientRoute {
	return c.groupsRoute().JoinId(groupID)
}

func (c *Client4) groupSyncablesRoute(groupID string, syncableType GroupSyncableType) clientRoute {
	syncTypeElem := strings.ToLower(syncableType.String()) + "s"
	return c.groupRoute(groupID).JoinSegment(syncTypeElem)
}

func (c *Client4) groupSyncableRoute(groupID, syncableID string, syncableType GroupSyncableType) clientRoute {
	return c.groupSyncablesRoute(groupID, syncableType).JoinId(syncableID)
}

func (c *Client4) importsRoute() clientRoute {
	return newClientRoute("imports")
}

func (c *Client4) exportsRoute() clientRoute {
	return newClientRoute("exports")
}

func (c *Client4) exportRoute(name string) clientRoute {
	return c.exportsRoute().JoinSegment(name)
}

func (c *Client4) importRoute(name string) clientRoute {
	return c.importsRoute().JoinSegment(name)
}

func (c *Client4) remoteClusterRoute() clientRoute {
	return newClientRoute("remotecluster")
}

func (c *Client4) sharedChannelRemotesRoute(remoteId string) clientRoute {
	return c.remoteClusterRoute().JoinId(remoteId).JoinSegment("sharedchannelremotes")
}

func (c *Client4) channelRemoteRoute(remoteId, channelId string) clientRoute {
	return c.remoteClusterRoute().JoinId(remoteId).JoinSegment("channels").JoinId(channelId)
}

func (c *Client4) sharedChannelsRoute() clientRoute {
	return newClientRoute("sharedchannels")
}

func (c *Client4) ipFiltersRoute() clientRoute {
	return newClientRoute("ip_filtering")
}

func (c *Client4) permissionsRoute() clientRoute {
	return newClientRoute("permissions")
}

func (c *Client4) limitsRoute() clientRoute {
	return newClientRoute("limits")
}

func (c *Client4) customProfileAttributesRoute() clientRoute {
	return newClientRoute("custom_profile_attributes")
}

func (c *Client4) bookmarksRoute(channelId string) clientRoute {
	return c.channelRoute(channelId).JoinSegment("bookmarks")
}

func (c *Client4) bookmarkRoute(channelId, bookmarkId string) clientRoute {
	return c.bookmarksRoute(channelId).JoinId(bookmarkId)
}

func (c *Client4) clientPerfMetricsRoute() clientRoute {
	return newClientRoute("client_perf")
}

func (c *Client4) userCustomProfileAttributesRoute(userID string) clientRoute {
	return c.userRoute(userID).JoinSegment("custom_profile_attributes")
}

func (c *Client4) customProfileAttributeFieldsRoute() clientRoute {
	return c.customProfileAttributesRoute().JoinSegment("fields")
}

func (c *Client4) customProfileAttributeFieldRoute(fieldID string) clientRoute {
	return c.customProfileAttributeFieldsRoute().JoinId(fieldID)
}

func (c *Client4) customProfileAttributeValuesRoute() clientRoute {
	return c.customProfileAttributesRoute().JoinSegment("values")
}

func (c *Client4) accessControlPoliciesRoute() clientRoute {
	return newClientRoute("access_control_policies")
}

func (c *Client4) celRoute() clientRoute {
	return c.accessControlPoliciesRoute().JoinSegment("cel")
}

func (c *Client4) accessControlPolicyRoute(policyID string) clientRoute {
	return c.accessControlPoliciesRoute().JoinSegment(url.PathEscape(policyID))
}

// Returns the HTTP response or any error that occurred during the request.
func (c *Client4) DoAPIGet(ctx context.Context, url string, etag string) (*http.Response, error) {
	return c.doAPIRequest(ctx, http.MethodGet, c.APIURL+url, "", etag)
}

// DoAPIPost makes a POST request to the specified URL with optional string data.
// Returns the HTTP response or any error that occurred during the request.
func (c *Client4) DoAPIPost(ctx context.Context, url, data string) (*http.Response, error) {
	return c.doAPIRequest(ctx, http.MethodPost, c.APIURL+url, data, "")
}

// DoAPIPostJSON marshals the provided data to JSON and makes a POST request to the specified URL.
// Returns the HTTP response or any error that occurred during marshaling or request.
func (c *Client4) DoAPIPostJSON(ctx context.Context, url string, data any) (*http.Response, error) {
	buf, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return c.doAPIRequestBytes(ctx, http.MethodPost, c.APIURL+url, buf, "")
}

// DoAPIPut makes a PUT request to the specified URL with optional string data.
// Returns the HTTP response or any error that occurred during the request.
func (c *Client4) DoAPIPut(ctx context.Context, url, data string) (*http.Response, error) {
	return c.doAPIRequest(ctx, http.MethodPut, c.APIURL+url, data, "")
}

// DoAPIPutJSON marshals the provided data to JSON and makes a PUT request to the specified URL.
// Returns the HTTP response or any error that occurred during marshaling or request.
func (c *Client4) DoAPIPutJSON(ctx context.Context, url string, data any) (*http.Response, error) {
	buf, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return c.doAPIRequestBytes(ctx, http.MethodPut, c.APIURL+url, buf, "")
}

// DoAPIPatchJSON marshals the provided data to JSON and makes a PATCH request to the specified URL.
// Returns the HTTP response or any error that occurred during marshaling or request.
func (c *Client4) DoAPIPatchJSON(ctx context.Context, url string, data any) (*http.Response, error) {
	buf, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return c.doAPIRequestBytes(ctx, http.MethodPatch, c.APIURL+url, buf, "")
}

// DoAPIDelete makes a DELETE request to the specified URL.
// Returns the HTTP response or any error that occurred during the request.
func (c *Client4) DoAPIDelete(ctx context.Context, url string) (*http.Response, error) {
	return c.doAPIRequest(ctx, http.MethodDelete, c.APIURL+url, "", "")
}

// DoAPIDeleteJSON marshals the provided data to JSON and makes a DELETE request to the specified URL.
// Returns the HTTP response or any error that occurred during marshaling or request.
func (c *Client4) DoAPIDeleteJSON(ctx context.Context, url string, data any) (*http.Response, error) {
	buf, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	return c.doAPIRequestBytes(ctx, http.MethodDelete, c.APIURL+url, buf, "")
}

// DoAPIRequestWithHeaders makes an HTTP request with the specified method, URL, and custom headers.
// Returns the HTTP response or any error that occurred during the request.
func (c *Client4) DoAPIRequestWithHeaders(ctx context.Context, method, url, data string, headers map[string]string) (*http.Response, error) {
	return c.doAPIRequestReader(ctx, method, url, "", strings.NewReader(data), headers)
}

func (c *Client4) doAPIRequest(ctx context.Context, method, url, data, etag string) (*http.Response, error) {
	return c.doAPIRequestReader(ctx, method, url, "", strings.NewReader(data), map[string]string{HeaderEtagClient: etag})
}

func (c *Client4) doAPIRequestBytes(ctx context.Context, method, url string, data []byte, etag string) (*http.Response, error) {
	return c.doAPIRequestReader(ctx, method, url, "", bytes.NewReader(data), map[string]string{HeaderEtagClient: etag})
}

// doAPIRequestReader makes an HTTP request using an io.Reader for the request body and custom headers.
// This is the most flexible DoAPI method, supporting streaming data and custom headers.
// Returns the HTTP response or any error that occurred during the request.
func (c *Client4) doAPIRequestReader(ctx context.Context, method, url, contentType string, data io.Reader, headers map[string]string) (*http.Response, error) {
	rq, err := http.NewRequestWithContext(ctx, method, url, data)
	if err != nil {
		return nil, err
	}

	for k, v := range headers {
		rq.Header.Set(k, v)
	}

	if c.AuthToken != "" {
		rq.Header.Set(HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	if contentType != "" {
		rq.Header.Set("Content-Type", contentType)
	}

	if len(c.HTTPHeader) > 0 {
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

func (c *Client4) DoUploadFile(ctx context.Context, url string, data []byte, contentType string) (*FileUploadResponse, *Response, error) {
	r, err := c.doAPIRequestReader(ctx, http.MethodPost, c.APIURL+url, contentType, bytes.NewReader(data), nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*FileUploadResponse](r)
}

// Authentication Section

// LoginById authenticates a user by user id and password.
func (c *Client4) LoginById(ctx context.Context, id string, password string) (*User, *Response, error) {
	m := make(map[string]string)
	m["id"] = id
	m["password"] = password
	return c.login(ctx, m)
}

// Login authenticates a user by login id, which can be username, email or some sort
// of SSO identifier based on server configuration, and a password.
func (c *Client4) Login(ctx context.Context, loginId string, password string) (*User, *Response, error) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	return c.login(ctx, m)
}

// LoginByLdap authenticates a user by LDAP id and password.
func (c *Client4) LoginByLdap(ctx context.Context, loginId string, password string) (*User, *Response, error) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["ldap_only"] = c.boolString(true)
	return c.login(ctx, m)
}

// LoginWithDevice authenticates a user by login id (username, email or some sort
// of SSO identifier based on configuration), password and attaches a device id to
// the session.
func (c *Client4) LoginWithDevice(ctx context.Context, loginId string, password string, deviceId string) (*User, *Response, error) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["device_id"] = deviceId
	return c.login(ctx, m)
}

// LoginWithMFA logs a user in with a MFA token
func (c *Client4) LoginWithMFA(ctx context.Context, loginId, password, mfaToken string) (*User, *Response, error) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["token"] = mfaToken
	return c.login(ctx, m)
}

func (c *Client4) login(ctx context.Context, m map[string]string) (*User, *Response, error) {
	r, err := c.DoAPIPostJSON(ctx, "/users/login", m)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	c.AuthToken = r.Header.Get(HeaderToken)
	c.AuthType = HeaderBearer

	return DecodeJSONFromResponse[*User](r)
}

func (c *Client4) LoginWithDesktopToken(ctx context.Context, token, deviceId string) (*User, *Response, error) {
	m := make(map[string]string)
	m["token"] = token
	m["deviceId"] = deviceId
	r, err := c.DoAPIPostJSON(ctx, "/users/login/desktop_token", m)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	c.AuthToken = r.Header.Get(HeaderToken)
	c.AuthType = HeaderBearer

	return DecodeJSONFromResponse[*User](r)
}

// Logout terminates the current user's session.
func (c *Client4) Logout(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIPost(ctx, "/users/logout", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	c.AuthToken = ""
	c.AuthType = HeaderBearer
	return BuildResponse(r), nil
}

// SwitchAccountType changes a user's login type from one type to another.
func (c *Client4) SwitchAccountType(ctx context.Context, switchRequest *SwitchRequest) (string, *Response, error) {
	route, err := c.usersRoute().JoinSegments("login", "switch").String()
	if err != nil {
		return "", nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, switchRequest)
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	result, resp, err := DecodeJSONFromResponse[map[string]string](r)
	if err != nil {
		return "", resp, err
	}
	return result["follow_link"], resp, nil
}

// User Section

// CreateUser creates a user in the system based on the provided user struct.
func (c *Client4) CreateUser(ctx context.Context, user *User) (*User, *Response, error) {
	route, err := c.usersRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, user)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*User](r)
}

// CreateUserWithToken creates a user in the system based on the provided tokenId.
func (c *Client4) CreateUserWithToken(ctx context.Context, user *User, tokenId string) (*User, *Response, error) {
	if tokenId == "" {
		return nil, nil, errors.New("token ID is required")
	}

	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	values := url.Values{}
	values.Set("t", tokenId)
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIPostJSON(ctx, routeURL.String(), user)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*User](r)
}

// CreateUserWithInviteId creates a user in the system based on the provided invited id.
func (c *Client4) CreateUserWithInviteId(ctx context.Context, user *User, inviteId string) (*User, *Response, error) {
	if inviteId == "" {
		return nil, nil, errors.New("invite ID is required")
	}

	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	values := url.Values{}
	values.Set("iid", inviteId)
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIPostJSON(ctx, routeURL.String(), user)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*User](r)
}

// GetMe returns the logged in user.
func (c *Client4) GetMe(ctx context.Context, etag string) (*User, *Response, error) {
	route, err := c.userRoute(Me).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*User](r)
}

// GetUser returns a user based on the provided user id string.
func (c *Client4) GetUser(ctx context.Context, userId, etag string) (*User, *Response, error) {
	route, err := c.userRoute(userId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*User](r)
}

// GetUserByUsername returns a user based on the provided user name string.
func (c *Client4) GetUserByUsername(ctx context.Context, userName, etag string) (*User, *Response, error) {
	route, err := c.userByUsernameRoute(userName).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*User](r)
}

// GetUserByEmail returns a user based on the provided user email string.
func (c *Client4) GetUserByEmail(ctx context.Context, email, etag string) (*User, *Response, error) {
	route, err := c.userByEmailRoute(email).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*User](r)
}

// AutocompleteUsersInTeam returns the users on a team based on search term.
func (c *Client4) AutocompleteUsersInTeam(ctx context.Context, teamId string, username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	values := url.Values{}
	values.Set("in_team", teamId)
	values.Set("name", username)
	values.Set("limit", strconv.Itoa(limit))
	routeURL, err := c.usersRoute().JoinSegment("autocomplete").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UserAutocomplete](r)
}

// AutocompleteUsersInChannel returns the users in a channel based on search term.
func (c *Client4) AutocompleteUsersInChannel(ctx context.Context, teamId string, channelId string, username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	values := url.Values{}
	values.Set("in_team", teamId)
	values.Set("in_channel", channelId)
	values.Set("name", username)
	values.Set("limit", strconv.Itoa(limit))
	routeURL, err := c.usersRoute().JoinSegment("autocomplete").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UserAutocomplete](r)
}

// AutocompleteUsers returns the users in the system based on search term.
func (c *Client4) AutocompleteUsers(ctx context.Context, username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	values := url.Values{}
	values.Set("name", username)
	values.Set("limit", strconv.Itoa(limit))
	routeURL, err := c.usersRoute().JoinSegment("autocomplete").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UserAutocomplete](r)
}

// GetDefaultProfileImage gets the default user's profile image. Must be logged in.
func (c *Client4) GetDefaultProfileImage(ctx context.Context, userId string) ([]byte, *Response, error) {
	route, err := c.userRoute(userId).JoinSegments("image", "default").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// GetProfileImage gets user's profile image. Must be logged in.
func (c *Client4) GetProfileImage(ctx context.Context, userId, etag string) ([]byte, *Response, error) {
	route, err := c.userRoute(userId).JoinSegment("image").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// GetUsers returns a page of users on the system. Page counting starts at 0.
func (c *Client4) GetUsers(ctx context.Context, page int, perPage int, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersWithCustomQueryParameters returns a page of users on the system. Page counting starts at 0.
func (c *Client4) GetUsersWithCustomQueryParameters(ctx context.Context, page int, perPage int, queryParameters, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode() + "&" + queryParameters
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetUsersInTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("in_team", teamId)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetNewUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetNewUsersInTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("sort", "create_at")
	values.Set("in_team", teamId)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetRecentlyActiveUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetRecentlyActiveUsersInTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("sort", "last_activity_at")
	values.Set("in_team", teamId)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetActiveUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetActiveUsersInTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("active", "true")
	values.Set("in_team", teamId)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersNotInTeam returns a page of users who are not in a team. Page counting starts at 0.
func (c *Client4) GetUsersNotInTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("not_in_team", teamId)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersInChannel returns a page of users in a channel. Page counting starts at 0.
func (c *Client4) GetUsersInChannel(ctx context.Context, channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("in_channel", channelId)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersInChannelByStatus returns a page of users in a channel. Page counting starts at 0. Sorted by Status
func (c *Client4) GetUsersInChannelByStatus(ctx context.Context, channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("in_channel", channelId)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("sort", "status")
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersNotInChannel returns a page of users not in a channel. Page counting starts at 0.
func (c *Client4) GetUsersNotInChannel(ctx context.Context, teamId, channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	options := &GetUsersNotInChannelOptions{
		TeamID:   teamId,
		Page:     page,
		Limit:    perPage,
		Etag:     etag,
		CursorID: "",
	}
	return c.GetUsersNotInChannelWithOptions(ctx, channelId, options)
}

// GetUsersNotInChannelWithOptionsStruct returns a page of users not in a channel using the options struct.
func (c *Client4) GetUsersNotInChannelWithOptions(ctx context.Context, channelId string, options *GetUsersNotInChannelOptions) ([]*User, *Response, error) {
	values := url.Values{}
	if options != nil {
		values.Set("in_team", options.TeamID)
		values.Set("not_in_channel", channelId)
		values.Set("page", strconv.Itoa(options.Page))
		values.Set("per_page", strconv.Itoa(options.Limit))
		values.Set("cursor_id", options.CursorID)
	}
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), options.Etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersWithoutTeam returns a page of users on the system that aren't on any teams. Page counting starts at 0.
func (c *Client4) GetUsersWithoutTeam(ctx context.Context, page int, perPage int, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("without_team", "1")
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersInGroup returns a page of users in a group. Page counting starts at 0.
func (c *Client4) GetUsersInGroup(ctx context.Context, groupID string, page int, perPage int, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("in_group", groupID)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersInGroup returns a page of users in a group. Page counting starts at 0.
func (c *Client4) GetUsersInGroupByDisplayName(ctx context.Context, groupID string, page int, perPage int, etag string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("sort", "display_name")
	values.Set("in_group", groupID)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersByIds returns a list of users based on the provided user ids.
func (c *Client4) GetUsersByIds(ctx context.Context, userIds []string) ([]*User, *Response, error) {
	route, err := c.usersRoute().JoinSegment("ids").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, userIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersByIds returns a list of users based on the provided user ids.
func (c *Client4) GetUsersByIdsWithOptions(ctx context.Context, userIds []string, options *UserGetByIdsOptions) ([]*User, *Response, error) {
	v := url.Values{}
	if options.Since != 0 {
		v.Set("since", fmt.Sprintf("%d", options.Since))
	}

	routeURL, err := c.usersRoute().JoinSegment("ids").URL()
	if err != nil {
		return nil, nil, err
	}
	if len(v) > 0 {
		routeURL.RawQuery = v.Encode()
	}

	r, err := c.DoAPIPostJSON(ctx, routeURL.String(), userIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersByUsernames returns a list of users based on the provided usernames.
func (c *Client4) GetUsersByUsernames(ctx context.Context, usernames []string) ([]*User, *Response, error) {
	route, err := c.usersRoute().JoinSegment("usernames").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, usernames)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// GetUsersByGroupChannelIds returns a map with channel ids as keys
// and a list of users as values based on the provided user ids.
func (c *Client4) GetUsersByGroupChannelIds(ctx context.Context, groupChannelIds []string) (map[string][]*User, *Response, error) {
	route, err := c.usersRoute().JoinSegment("group_channels").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, groupChannelIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string][]*User](r)
}

// SearchUsers returns a list of users based on some search criteria.
func (c *Client4) SearchUsers(ctx context.Context, search *UserSearch) ([]*User, *Response, error) {
	route, err := c.usersRoute().JoinSegment("search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, search)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// UpdateUser updates a user in the system based on the provided user struct.
func (c *Client4) UpdateUser(ctx context.Context, user *User) (*User, *Response, error) {
	route, err := c.userRoute(user.Id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, user)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*User](r)
}

// PatchUser partially updates a user in the system. Any missing fields are not updated.
func (c *Client4) PatchUser(ctx context.Context, userId string, patch *UserPatch) (*User, *Response, error) {
	route, err := c.userRoute(userId).JoinSegment("patch").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*User](r)
}

// UpdateUserAuth updates a user AuthData (uthData, authService and password) in the system.
func (c *Client4) UpdateUserAuth(ctx context.Context, userId string, userAuth *UserAuth) (*UserAuth, *Response, error) {
	route, err := c.userRoute(userId).JoinSegment("auth").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, userAuth)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UserAuth](r)
}

// UpdateUserMfa activates multi-factor authentication for a user if activate
// is true and a valid code is provided. If activate is false, then code is not
// required and multi-factor authentication is disabled for the user.
func (c *Client4) UpdateUserMfa(ctx context.Context, userId, code string, activate bool) (*Response, error) {
	requestBody := make(map[string]any)
	requestBody["activate"] = activate
	requestBody["code"] = code

	route, err := c.userRoute(userId).JoinSegment("mfa").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GenerateMfaSecret will generate a new MFA secret for a user and return it as a string and
// as a base64 encoded image QR code.
func (c *Client4) GenerateMfaSecret(ctx context.Context, userId string) (*MfaSecret, *Response, error) {
	route, err := c.userRoute(userId).JoinSegments("mfa", "generate").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*MfaSecret](r)
}

// UpdateUserPassword updates a user's password. Must be logged in as the user or be a system administrator.
func (c *Client4) UpdateUserPassword(ctx context.Context, userId, currentPassword, newPassword string) (*Response, error) {
	requestBody := map[string]string{"current_password": currentPassword, "new_password": newPassword}
	route, err := c.userRoute(userId).JoinSegment("password").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateUserHashedPassword updates a user's password with an already-hashed password. Must be a system administrator.
func (c *Client4) UpdateUserHashedPassword(ctx context.Context, userId, newHashedPassword string) (*Response, error) {
	requestBody := map[string]string{"already_hashed": "true", "new_password": newHashedPassword}
	route, err := c.userRoute(userId).JoinSegment("password").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PromoteGuestToUser convert a guest into a regular user
func (c *Client4) PromoteGuestToUser(ctx context.Context, guestId string) (*Response, error) {
	route, err := c.userRoute(guestId).JoinSegment("promote").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DemoteUserToGuest convert a regular user into a guest
func (c *Client4) DemoteUserToGuest(ctx context.Context, guestId string) (*Response, error) {
	route, err := c.userRoute(guestId).JoinSegment("demote").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateUserRoles updates a user's roles in the system. A user can have "system_user" and "system_admin" roles.
func (c *Client4) UpdateUserRoles(ctx context.Context, userId, roles string) (*Response, error) {
	requestBody := map[string]string{"roles": roles}
	route, err := c.userRoute(userId).JoinSegment("roles").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateUserActive updates status of a user whether active or not.
func (c *Client4) UpdateUserActive(ctx context.Context, userId string, active bool) (*Response, error) {
	requestBody := make(map[string]any)
	requestBody["active"] = active
	route, err := c.userRoute(userId).JoinSegment("active").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

// ResetFailedAttempts resets the number of failed attempts for a user.
func (c *Client4) ResetFailedAttempts(ctx context.Context, userId string) (*Response, error) {
	route, err := c.userRoute(userId).JoinSegment("reset_failed_attempts").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteUser deactivates a user in the system based on the provided user id string.
func (c *Client4) DeleteUser(ctx context.Context, userId string) (*Response, error) {
	route, err := c.userRoute(userId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PermanentDeleteUser deletes a user in the system based on the provided user id string.
func (c *Client4) PermanentDeleteUser(ctx context.Context, userId string) (*Response, error) {
	routeURL, err := c.userRoute(userId).URL()
	if err != nil {
		return nil, err
	}
	routeURL.RawQuery = "permanent=" + c.boolString(true)
	r, err := c.DoAPIDelete(ctx, routeURL.String())
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ConvertUserToBot converts a user to a bot user.
func (c *Client4) ConvertUserToBot(ctx context.Context, userId string) (*Bot, *Response, error) {
	route, err := c.userRoute(userId).JoinSegment("convert_to_bot").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Bot](r)
}

// ConvertBotToUser converts a bot user to a user.
func (c *Client4) ConvertBotToUser(ctx context.Context, userId string, userPatch *UserPatch, setSystemAdmin bool) (*User, *Response, error) {
	var query string
	if setSystemAdmin {
		query = "?set_system_admin=true"
	}
	route, err := c.botRoute(userId).JoinSegment("convert_to_user").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route+query, userPatch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*User](r)
}

// PermanentDeleteAll permanently deletes all users in the system. This is a local only endpoint
func (c *Client4) PermanentDeleteAllUsers(ctx context.Context) (*Response, error) {
	route, err := c.usersRoute().String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SendPasswordResetEmail will send a link for password resetting to a user with the
// provided email.
func (c *Client4) SendPasswordResetEmail(ctx context.Context, email string) (*Response, error) {
	requestBody := map[string]string{"email": email}
	route, err := c.usersRoute().JoinSegments("password", "reset", "send").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ResetPassword uses a recovery code to update reset a user's password.
func (c *Client4) ResetPassword(ctx context.Context, token, newPassword string) (*Response, error) {
	requestBody := map[string]string{"token": token, "new_password": newPassword}
	route, err := c.usersRoute().JoinSegments("password", "reset").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetSessions returns a list of sessions based on the provided user id string.
func (c *Client4) GetSessions(ctx context.Context, userId, etag string) ([]*Session, *Response, error) {
	route, err := c.userRoute(userId).JoinSegment("sessions").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Session](r)
}

// RevokeSession revokes a user session based on the provided user id and session id strings.
func (c *Client4) RevokeSession(ctx context.Context, userId, sessionId string) (*Response, error) {
	requestBody := map[string]string{"session_id": sessionId}
	route, err := c.userRoute(userId).JoinSegments("sessions", "revoke").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RevokeAllSessions revokes all sessions for the provided user id string.
func (c *Client4) RevokeAllSessions(ctx context.Context, userId string) (*Response, error) {
	route, err := c.userRoute(userId).JoinSegments("sessions", "revoke", "all").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RevokeAllSessions revokes all sessions for all the users.
func (c *Client4) RevokeSessionsFromAllUsers(ctx context.Context) (*Response, error) {
	route, err := c.usersRoute().JoinSegments("sessions", "revoke", "all").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AttachDeviceProps attaches a mobile device ID to the current session and other props.
func (c *Client4) AttachDeviceProps(ctx context.Context, newProps map[string]string) (*Response, error) {
	route, err := c.usersRoute().JoinSegments("sessions", "device").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, newProps)
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
func (c *Client4) GetTeamsUnreadForUser(ctx context.Context, userId, teamIdToExclude string, includeCollapsedThreads bool) ([]*TeamUnread, *Response, error) {
	values := url.Values{}
	if teamIdToExclude != "" {
		values.Set("exclude_team", teamIdToExclude)
	}
	values.Set("include_collapsed_threads", c.boolString(includeCollapsedThreads))
	routeURL, err := c.userRoute(userId).JoinSegments("teams", "unread").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*TeamUnread](r)
}

// GetUserAudits returns a list of audit based on the provided user id string.
func (c *Client4) GetUserAudits(ctx context.Context, userId string, page int, perPage int, etag string) (Audits, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.userRoute(userId).JoinSegment("audits").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[Audits](r)
}

// VerifyUserEmail will verify a user's email using the supplied token.
func (c *Client4) VerifyUserEmail(ctx context.Context, token string) (*Response, error) {
	requestBody := map[string]string{"token": token}
	route, err := c.usersRoute().JoinSegments("email", "verify").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// VerifyUserEmailWithoutToken will verify a user's email by its Id. (Requires manage system role)
func (c *Client4) VerifyUserEmailWithoutToken(ctx context.Context, userId string) (*User, *Response, error) {
	route, err := c.userRoute(userId).JoinSegments("email", "verify", "member").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*User](r)
}

// SendVerificationEmail will send an email to the user with the provided email address, if
// that user exists. The email will contain a link that can be used to verify the user's
// email address.
func (c *Client4) SendVerificationEmail(ctx context.Context, email string) (*Response, error) {
	requestBody := map[string]string{"email": email}
	route, err := c.usersRoute().JoinSegments("email", "verify", "send").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SetDefaultProfileImage resets the profile image to a default generated one.
func (c *Client4) SetDefaultProfileImage(ctx context.Context, userId string) (*Response, error) {
	route, err := c.userRoute(userId).JoinSegment("image").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	return BuildResponse(r), nil
}

// SetProfileImage sets profile image of the user.
func (c *Client4) SetProfileImage(ctx context.Context, userId string, data []byte) (*Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", "profile.png")
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, fmt.Errorf("failed to copy data to form file: %w", err)
	}

	if err = writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	route, err := c.userRoute(userId).JoinSegment("image").String()
	if err != nil {
		return nil, err
	}
	r, err := c.doAPIRequestReader(ctx, http.MethodPost, c.APIURL+route, writer.FormDataContentType(), body, nil)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

// CreateUserAccessToken will generate a user access token that can be used in place
// of a session token to access the REST API. Must have the 'create_user_access_token'
// permission and if generating for another user, must have the 'edit_other_users'
// permission. A non-blank description is required.
func (c *Client4) CreateUserAccessToken(ctx context.Context, userId, description string) (*UserAccessToken, *Response, error) {
	requestBody := map[string]string{"description": description}
	route, err := c.userRoute(userId).JoinSegment("tokens").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UserAccessToken](r)
}

// GetUserAccessTokens will get a page of access tokens' id, description, is_active
// and the user_id in the system. The actual token will not be returned. Must have
// the 'manage_system' permission.
func (c *Client4) GetUserAccessTokens(ctx context.Context, page int, perPage int) ([]*UserAccessToken, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.userAccessTokensRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*UserAccessToken](r)
}

// GetUserAccessToken will get a user access tokens' id, description, is_active
// and the user_id of the user it is for. The actual token will not be returned.
// Must have the 'read_user_access_token' permission and if getting for another
// user, must have the 'edit_other_users' permission.
func (c *Client4) GetUserAccessToken(ctx context.Context, tokenId string) (*UserAccessToken, *Response, error) {
	route, err := c.userAccessTokenRoute(tokenId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UserAccessToken](r)
}

// GetUserAccessTokensForUser will get a paged list of user access tokens showing id,
// description and user_id for each. The actual tokens will not be returned. Must have
// the 'read_user_access_token' permission and if getting for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) GetUserAccessTokensForUser(ctx context.Context, userId string, page, perPage int) ([]*UserAccessToken, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.userRoute(userId).JoinSegment("tokens").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*UserAccessToken](r)
}

// RevokeUserAccessToken will revoke a user access token by id. Must have the
// 'revoke_user_access_token' permission and if revoking for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) RevokeUserAccessToken(ctx context.Context, tokenId string) (*Response, error) {
	requestBody := map[string]string{"token_id": tokenId}
	route, err := c.usersRoute().JoinSegments("tokens", "revoke").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SearchUserAccessTokens returns user access tokens matching the provided search term.
func (c *Client4) SearchUserAccessTokens(ctx context.Context, search *UserAccessTokenSearch) ([]*UserAccessToken, *Response, error) {
	route, err := c.usersRoute().JoinSegments("tokens", "search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, search)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*UserAccessToken](r)
}

// DisableUserAccessToken will disable a user access token by id. Must have the
// 'revoke_user_access_token' permission and if disabling for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) DisableUserAccessToken(ctx context.Context, tokenId string) (*Response, error) {
	requestBody := map[string]string{"token_id": tokenId}
	route, err := c.usersRoute().JoinSegments("tokens", "disable").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// EnableUserAccessToken will enable a user access token by id. Must have the
// 'create_user_access_token' permission and if enabling for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) EnableUserAccessToken(ctx context.Context, tokenId string) (*Response, error) {
	requestBody := map[string]string{"token_id": tokenId}
	route, err := c.usersRoute().JoinSegments("tokens", "enable").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetUsersForReporting(ctx context.Context, options *UserReportOptions) ([]*UserReport, *Response, error) {
	values := url.Values{}
	if options.Direction != "" {
		values.Set("direction", options.Direction)
	}
	if options.SortColumn != "" {
		values.Set("sort_column", options.SortColumn)
	}
	if options.PageSize > 0 {
		values.Set("page_size", strconv.Itoa(options.PageSize))
	}
	if options.Team != "" {
		values.Set("team_filter", options.Team)
	}
	if options.HideActive {
		values.Set("hide_active", "true")
	}
	if options.HideInactive {
		values.Set("hide_inactive", "true")
	}
	if options.SortDesc {
		values.Set("sort_direction", "desc")
	}
	if options.FromColumnValue != "" {
		values.Set("from_column_value", options.FromColumnValue)
	}
	if options.FromId != "" {
		values.Set("from_id", options.FromId)
	}
	if options.Role != "" {
		values.Set("role_filter", options.Role)
	}
	if options.HasNoTeam {
		values.Set("has_no_team", "true")
	}
	if options.DateRange != "" {
		values.Set("date_range", options.DateRange)
	}

	routeURL, err := c.reportsRoute().JoinSegment("users").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*UserReport](r)
}

// Bots section

// CreateBot creates a bot in the system based on the provided bot struct.
func (c *Client4) CreateBot(ctx context.Context, bot *Bot) (*Bot, *Response, error) {
	route, err := c.botsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, bot)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Bot](r)
}

// PatchBot partially updates a bot. Any missing fields are not updated.
func (c *Client4) PatchBot(ctx context.Context, userId string, patch *BotPatch) (*Bot, *Response, error) {
	route, err := c.botRoute(userId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Bot](r)
}

// GetBot fetches the given, undeleted bot.
func (c *Client4) GetBot(ctx context.Context, userId string, etag string) (*Bot, *Response, error) {
	route, err := c.botRoute(userId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Bot](r)
}

// GetBotIncludeDeleted fetches the given bot, even if it is deleted.
func (c *Client4) GetBotIncludeDeleted(ctx context.Context, userId string, etag string) (*Bot, *Response, error) {
	routeURL, err := c.botRoute(userId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = "include_deleted=" + c.boolString(true)
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Bot](r)
}

// GetBots fetches the given page of bots, excluding deleted.
func (c *Client4) GetBots(ctx context.Context, page, perPage int, etag string) ([]*Bot, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.botsRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[BotList](r)
}

// GetBotsIncludeDeleted fetches the given page of bots, including deleted.
func (c *Client4) GetBotsIncludeDeleted(ctx context.Context, page, perPage int, etag string) ([]*Bot, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("include_deleted", c.boolString(true))
	routeURL, err := c.botsRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[BotList](r)
}

// GetBotsOrphaned fetches the given page of bots, only including orphaned bots.
func (c *Client4) GetBotsOrphaned(ctx context.Context, page, perPage int, etag string) ([]*Bot, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("only_orphaned", c.boolString(true))
	routeURL, err := c.botsRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[BotList](r)
}

// DisableBot disables the given bot in the system.
func (c *Client4) DisableBot(ctx context.Context, botUserId string) (*Bot, *Response, error) {
	route, err := c.botRoute(botUserId).JoinSegment("disable").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Bot](r)
}

// EnableBot disables the given bot in the system.
func (c *Client4) EnableBot(ctx context.Context, botUserId string) (*Bot, *Response, error) {
	route, err := c.botRoute(botUserId).JoinSegment("enable").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Bot](r)
}

// AssignBot assigns the given bot to the given user
func (c *Client4) AssignBot(ctx context.Context, botUserId, newOwnerId string) (*Bot, *Response, error) {
	route, err := c.botRoute(botUserId).JoinSegment("assign").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route+newOwnerId, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Bot](r)
}

// Team Section

// CreateTeam creates a team in the system based on the provided team struct.
func (c *Client4) CreateTeam(ctx context.Context, team *Team) (*Team, *Response, error) {
	route, err := c.teamsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, team)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Team](r)
}

// GetTeam returns a team based on the provided team id string.
func (c *Client4) GetTeam(ctx context.Context, teamId, etag string) (*Team, *Response, error) {
	route, err := c.teamRoute(teamId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Team](r)
}

// GetTeamAsContentReviewer returns a team based on the provided team id string, fetching it as a Content Reviewer for a flagged post.
func (c *Client4) GetTeamAsContentReviewer(ctx context.Context, teamId, etag, flaggedPostId string) (*Team, *Response, error) {
	values := url.Values{}
	values.Set("as_content_reviewer", c.boolString(true))
	values.Set("flagged_post_id", flaggedPostId)

	routeURL, err := c.teamRoute(teamId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	route := routeURL.String()
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Team](r)
}

// GetAllTeams returns all teams based on permissions.
func (c *Client4) GetAllTeams(ctx context.Context, etag string, page int, perPage int) ([]*Team, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.teamsRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Team](r)
}

// GetAllTeamsWithTotalCount returns all teams based on permissions.
func (c *Client4) GetAllTeamsWithTotalCount(ctx context.Context, etag string, page int, perPage int) ([]*Team, int64, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("include_total_count", c.boolString(true))
	routeURL, err := c.teamsRoute().URL()
	if err != nil {
		return nil, 0, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)
	listWithCount, resp, err := DecodeJSONFromResponse[TeamsWithCount](r)
	if err != nil {
		return nil, 0, resp, err
	}
	return listWithCount.Teams, listWithCount.TotalCount, resp, nil
}

// GetAllTeamsExcludePolicyConstrained returns all teams which are not part of a data retention policy.
// Must be a system administrator.
func (c *Client4) GetAllTeamsExcludePolicyConstrained(ctx context.Context, etag string, page int, perPage int) ([]*Team, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("exclude_policy_constrained", c.boolString(true))
	routeURL, err := c.teamsRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Team](r)
}

// GetTeamByName returns a team based on the provided team name string.
func (c *Client4) GetTeamByName(ctx context.Context, name, etag string) (*Team, *Response, error) {
	route, err := c.teamByNameRoute(name).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Team](r)
}

// SearchTeams returns teams matching the provided search term.
func (c *Client4) SearchTeams(ctx context.Context, search *TeamSearch) ([]*Team, *Response, error) {
	route, err := c.teamsRoute().JoinSegment("search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, search)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Team](r)
}

// SearchTeamsPaged returns a page of teams and the total count matching the provided search term.
func (c *Client4) SearchTeamsPaged(ctx context.Context, search *TeamSearch) ([]*Team, int64, *Response, error) {
	if search.Page == nil {
		search.Page = NewPointer(0)
	}
	if search.PerPage == nil {
		search.PerPage = NewPointer(100)
	}
	route, err := c.teamsRoute().JoinSegment("search").String()
	if err != nil {
		return nil, 0, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, search)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)
	listWithCount, resp, err := DecodeJSONFromResponse[TeamsWithCount](r)
	if err != nil {
		return nil, 0, resp, err
	}
	return listWithCount.Teams, listWithCount.TotalCount, resp, nil
}

// TeamExists returns true or false if the team exist or not.
func (c *Client4) TeamExists(ctx context.Context, name, etag string) (bool, *Response, error) {
	route, err := c.teamByNameRoute(name).JoinSegment("exists").String()
	if err != nil {
		return false, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapBoolFromJSON(r.Body)["exists"], BuildResponse(r), nil
}

// GetTeamsForUser returns a list of teams a user is on. Must be logged in as the user
// or be a system administrator.
func (c *Client4) GetTeamsForUser(ctx context.Context, userId, etag string) ([]*Team, *Response, error) {
	route, err := c.userRoute(userId).JoinSegment("teams").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Team](r)
}

// GetTeamMember returns a team member based on the provided team and user id strings.
func (c *Client4) GetTeamMember(ctx context.Context, teamId, userId, etag string) (*TeamMember, *Response, error) {
	route, err := c.teamMemberRoute(teamId, userId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*TeamMember](r)
}

// UpdateTeamMemberRoles will update the roles on a team for a user.
func (c *Client4) UpdateTeamMemberRoles(ctx context.Context, teamId, userId, newRoles string) (*Response, error) {
	requestBody := map[string]string{"roles": newRoles}
	route, err := c.teamMemberRoute(teamId, userId).JoinSegment("roles").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateTeamMemberSchemeRoles will update the scheme-derived roles on a team for a user.
func (c *Client4) UpdateTeamMemberSchemeRoles(ctx context.Context, teamId string, userId string, schemeRoles *SchemeRoles) (*Response, error) {
	route, err := c.teamMemberRoute(teamId, userId).JoinSegment("schemeRoles").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, schemeRoles)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateTeam will update a team.
func (c *Client4) UpdateTeam(ctx context.Context, team *Team) (*Team, *Response, error) {
	route, err := c.teamRoute(team.Id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, team)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Team](r)
}

// PatchTeam partially updates a team. Any missing fields are not updated.
func (c *Client4) PatchTeam(ctx context.Context, teamId string, patch *TeamPatch) (*Team, *Response, error) {
	route, err := c.teamRoute(teamId).JoinSegment("patch").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Team](r)
}

// RestoreTeam restores a previously deleted team.
func (c *Client4) RestoreTeam(ctx context.Context, teamId string) (*Team, *Response, error) {
	route, err := c.teamRoute(teamId).JoinSegment("restore").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Team](r)
}

// RegenerateTeamInviteId requests a new invite ID to be generated.
func (c *Client4) RegenerateTeamInviteId(ctx context.Context, teamId string) (*Team, *Response, error) {
	route, err := c.teamRoute(teamId).JoinSegment("regenerate_invite_id").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Team](r)
}

// SoftDeleteTeam deletes the team softly (archive only, not permanent delete).
func (c *Client4) SoftDeleteTeam(ctx context.Context, teamId string) (*Response, error) {
	route, err := c.teamRoute(teamId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PermanentDeleteTeam deletes the team, should only be used when needed for
// compliance and the like.
func (c *Client4) PermanentDeleteTeam(ctx context.Context, teamId string) (*Response, error) {
	routeURL, err := c.teamRoute(teamId).URL()
	if err != nil {
		return nil, err
	}
	routeURL.RawQuery = "permanent=" + c.boolString(true)
	r, err := c.DoAPIDelete(ctx, routeURL.String())
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateTeamPrivacy modifies the team type (model.TeamOpen <--> model.TeamInvite) and sets
// the corresponding AllowOpenInvite appropriately.
func (c *Client4) UpdateTeamPrivacy(ctx context.Context, teamId string, privacy string) (*Team, *Response, error) {
	requestBody := map[string]string{"privacy": privacy}
	route, err := c.teamRoute(teamId).JoinSegment("privacy").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, requestBody)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Team](r)
}

// GetTeamMembers returns team members based on the provided team id string.
func (c *Client4) GetTeamMembers(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*TeamMember, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.teamMembersRoute(teamId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*TeamMember](r)
}

// GetTeamMembersWithoutDeletedUsers returns team members based on the provided team id string. Additional parameters of sort and exclude_deleted_users accepted as well
// Could not add it to above function due to it be a breaking change.
func (c *Client4) GetTeamMembersSortAndWithoutDeletedUsers(ctx context.Context, teamId string, page int, perPage int, sort string, excludeDeletedUsers bool, etag string) ([]*TeamMember, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("sort", sort)
	values.Set("exclude_deleted_users", c.boolString(excludeDeletedUsers))
	routeURL, err := c.teamMembersRoute(teamId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*TeamMember](r)
}

// GetTeamMembersForUser returns the team members for a user.
func (c *Client4) GetTeamMembersForUser(ctx context.Context, userId string, etag string) ([]*TeamMember, *Response, error) {
	route, err := c.userRoute(userId).JoinSegments("teams", "members").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*TeamMember](r)
}

// GetTeamMembersByIds will return an array of team members based on the
// team id and a list of user ids provided. Must be authenticated.
func (c *Client4) GetTeamMembersByIds(ctx context.Context, teamId string, userIds []string) ([]*TeamMember, *Response, error) {
	r, err := c.DoAPIPostJSON(ctx, fmt.Sprintf("/teams/%v/members/ids", teamId), userIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*TeamMember](r)
}

// AddTeamMember adds user to a team and return a team member.
func (c *Client4) AddTeamMember(ctx context.Context, teamId, userId string) (*TeamMember, *Response, error) {
	member := &TeamMember{TeamId: teamId, UserId: userId}
	route, err := c.teamMembersRoute(teamId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, member)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*TeamMember](r)
}

// AddTeamMemberFromInvite adds a user to a team and return a team member using an invite id
// or an invite token/data pair.
func (c *Client4) AddTeamMemberFromInvite(ctx context.Context, token, inviteId string) (*TeamMember, *Response, error) {
	values := url.Values{}
	values.Set("invite_id", inviteId)
	values.Set("token", token)
	routeURL, err := c.teamsRoute().JoinSegments("members", "invite").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIPost(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*TeamMember](r)
}

// AddTeamMembers adds a number of users to a team and returns the team members.
func (c *Client4) AddTeamMembers(ctx context.Context, teamId string, userIds []string) ([]*TeamMember, *Response, error) {
	var members []*TeamMember
	for _, userId := range userIds {
		member := &TeamMember{TeamId: teamId, UserId: userId}
		members = append(members, member)
	}
	route, err := c.teamMembersRoute(teamId).JoinSegment("batch").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, members)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*TeamMember](r)
}

// AddTeamMembers adds a number of users to a team and returns the team members.
func (c *Client4) AddTeamMembersGracefully(ctx context.Context, teamId string, userIds []string) ([]*TeamMemberWithError, *Response, error) {
	var members []*TeamMember
	for _, userId := range userIds {
		member := &TeamMember{TeamId: teamId, UserId: userId}
		members = append(members, member)
	}
	routeURL, err := c.teamMembersRoute(teamId).JoinSegment("batch").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = "graceful=" + c.boolString(true)
	r, err := c.DoAPIPostJSON(ctx, routeURL.String(), members)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*TeamMemberWithError](r)
}

// RemoveTeamMember will remove a user from a team.
func (c *Client4) RemoveTeamMember(ctx context.Context, teamId, userId string) (*Response, error) {
	route, err := c.teamMemberRoute(teamId, userId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTeamStats returns a team stats based on the team id string.
// Must be authenticated.
func (c *Client4) GetTeamStats(ctx context.Context, teamId, etag string) (*TeamStats, *Response, error) {
	route, err := c.teamStatsRoute(teamId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*TeamStats](r)
}

// GetTotalUsersStats returns a total system user stats.
// Must be authenticated.
func (c *Client4) GetTotalUsersStats(ctx context.Context, etag string) (*UsersStats, *Response, error) {
	route, err := c.totalUsersStatsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UsersStats](r)
}

// GetTeamUnread will return a TeamUnread object that contains the amount of
// unread messages and mentions the user has for the specified team.
// Must be authenticated.
func (c *Client4) GetTeamUnread(ctx context.Context, teamId, userId string) (*TeamUnread, *Response, error) {
	route, err := c.userRoute(userId).JoinRoute(c.teamRoute(teamId)).JoinSegment("unread").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*TeamUnread](r)
}

// ImportTeam will import an exported team from other app into a existing team.
func (c *Client4) ImportTeam(ctx context.Context, data []byte, filesize int, importFrom, filename, teamId string) (map[string]string, *Response, error) {
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

	if _, err = io.Copy(part, strings.NewReader(importFrom)); err != nil {
		return nil, nil, err
	}

	if err = writer.Close(); err != nil {
		return nil, nil, err
	}

	route, err := c.teamImportRoute(teamId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.doAPIRequestReader(ctx, http.MethodPost, c.APIURL+route, writer.FormDataContentType(), body, nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]string](r)
}

// InviteUsersToTeam invite users by email to the team.
func (c *Client4) InviteUsersToTeam(ctx context.Context, teamId string, userEmails []string) (*Response, error) {
	route, err := c.teamRoute(teamId).JoinSegments("invite", "email").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, userEmails)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// InviteGuestsToTeam invite guest by email to some channels in a team.
func (c *Client4) InviteGuestsToTeam(ctx context.Context, teamId string, userEmails []string, channels []string, message string) (*Response, error) {
	guestsInvite := GuestsInvite{
		Emails:   userEmails,
		Channels: channels,
		Message:  message,
	}
	route, err := c.teamRoute(teamId).JoinSegments("invite-guests", "email").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, guestsInvite)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// InviteUsersToTeam invite users by email to the team.
func (c *Client4) InviteUsersToTeamGracefully(ctx context.Context, teamId string, userEmails []string) ([]*EmailInviteWithError, *Response, error) {
	routeURL, err := c.teamRoute(teamId).JoinSegments("invite", "email").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = "graceful=" + c.boolString(true)
	r, err := c.DoAPIPostJSON(ctx, routeURL.String(), userEmails)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*EmailInviteWithError](r)
}

// InviteUsersToTeam invite users by email to the team.
func (c *Client4) InviteUsersToTeamAndChannelsGracefully(ctx context.Context, teamId string, userEmails []string, channelIds []string, message string) ([]*EmailInviteWithError, *Response, error) {
	memberInvite := MemberInvite{
		Emails:     userEmails,
		ChannelIds: channelIds,
		Message:    message,
	}
	routeURL, err := c.teamRoute(teamId).JoinSegments("invite", "email").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = "graceful=" + c.boolString(true)
	r, err := c.DoAPIPostJSON(ctx, routeURL.String(), memberInvite)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*EmailInviteWithError](r)
}

// InviteGuestsToTeam invite guest by email to some channels in a team.
func (c *Client4) InviteGuestsToTeamGracefully(ctx context.Context, teamId string, userEmails []string, channels []string, message string) ([]*EmailInviteWithError, *Response, error) {
	guestsInvite := GuestsInvite{
		Emails:   userEmails,
		Channels: channels,
		Message:  message,
	}
	routeURL, err := c.teamRoute(teamId).JoinSegments("invite-guests", "email").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = "graceful=" + c.boolString(true)
	r, err := c.DoAPIPostJSON(ctx, routeURL.String(), guestsInvite)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*EmailInviteWithError](r)
}

// InvalidateEmailInvites will invalidate active email invitations that have not been accepted by the user.
func (c *Client4) InvalidateEmailInvites(ctx context.Context) (*Response, error) {
	route, err := c.teamsRoute().JoinSegments("invites", "email").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTeamInviteInfo returns a team object from an invite id containing sanitized information.
func (c *Client4) GetTeamInviteInfo(ctx context.Context, inviteId string) (*Team, *Response, error) {
	route, err := c.teamsRoute().JoinSegment("invite").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route+inviteId, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Team](r)
}

// SetTeamIcon sets team icon of the team.
func (c *Client4) SetTeamIcon(ctx context.Context, teamId string, data []byte) (*Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", "teamIcon.png")
	if err != nil {
		return nil, fmt.Errorf("failed to create form file for team icon: %w", err)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, fmt.Errorf("failed to copy data to team icon form file: %w", err)
	}

	if err = writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer for team icon: %w", err)
	}

	route, err := c.teamRoute(teamId).JoinSegment("image").String()
	if err != nil {
		return nil, err
	}
	r, err := c.doAPIRequestReader(ctx, http.MethodPost, c.APIURL+route, writer.FormDataContentType(), body, nil)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTeamIcon gets the team icon of the team.
func (c *Client4) GetTeamIcon(ctx context.Context, teamId, etag string) ([]byte, *Response, error) {
	route, err := c.teamRoute(teamId).JoinSegment("image").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// RemoveTeamIcon updates LastTeamIconUpdate to 0 which indicates team icon is removed.
func (c *Client4) RemoveTeamIcon(ctx context.Context, teamId string) (*Response, error) {
	route, err := c.teamRoute(teamId).JoinSegment("image").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Channel Section

// GetAllChannels get all the channels. Must be a system administrator.
func (c *Client4) GetAllChannels(ctx context.Context, page int, perPage int, etag string) (ChannelListWithTeamData, *Response, error) {
	return c.getAllChannels(ctx, page, perPage, etag, ChannelSearchOpts{})
}

// GetAllChannelsIncludeDeleted get all the channels. Must be a system administrator.
func (c *Client4) GetAllChannelsIncludeDeleted(ctx context.Context, page int, perPage int, etag string) (ChannelListWithTeamData, *Response, error) {
	return c.getAllChannels(ctx, page, perPage, etag, ChannelSearchOpts{IncludeDeleted: true})
}

// GetAllChannelsExcludePolicyConstrained gets all channels which are not part of a data retention policy.
// Must be a system administrator.
func (c *Client4) GetAllChannelsExcludePolicyConstrained(ctx context.Context, page, perPage int, etag string) (ChannelListWithTeamData, *Response, error) {
	return c.getAllChannels(ctx, page, perPage, etag, ChannelSearchOpts{ExcludePolicyConstrained: true})
}

func (c *Client4) getAllChannels(ctx context.Context, page int, perPage int, etag string, opts ChannelSearchOpts) (ChannelListWithTeamData, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("include_deleted", c.boolString(opts.IncludeDeleted))
	values.Set("exclude_policy_constrained", c.boolString(opts.ExcludePolicyConstrained))
	routeURL, err := c.channelsRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[ChannelListWithTeamData](r)
}

// GetAllChannelsWithCount get all the channels including the total count. Must be a system administrator.
func (c *Client4) GetAllChannelsWithCount(ctx context.Context, page int, perPage int, etag string) (ChannelListWithTeamData, int64, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("include_total_count", c.boolString(true))
	routeURL, err := c.channelsRoute().URL()
	if err != nil {
		return nil, 0, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)

	cwc, resp, err := DecodeJSONFromResponse[*ChannelsWithCount](r)
	if err != nil {
		return nil, 0, resp, err
	}
	return cwc.Channels, cwc.TotalCount, resp, nil
}

// CreateChannel creates a channel based on the provided channel struct.
func (c *Client4) CreateChannel(ctx context.Context, channel *Channel) (*Channel, *Response, error) {
	route, err := c.channelsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, channel)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// UpdateChannel updates a channel based on the provided channel struct.
func (c *Client4) UpdateChannel(ctx context.Context, channel *Channel) (*Channel, *Response, error) {
	route, err := c.channelRoute(channel.Id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, channel)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// PatchChannel partially updates a channel. Any missing fields are not updated.
func (c *Client4) PatchChannel(ctx context.Context, channelId string, patch *ChannelPatch) (*Channel, *Response, error) {
	route, err := c.channelRoute(channelId).JoinSegment("patch").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// UpdateChannelPrivacy updates channel privacy
func (c *Client4) UpdateChannelPrivacy(ctx context.Context, channelId string, privacy ChannelType) (*Channel, *Response, error) {
	requestBody := map[string]string{"privacy": string(privacy)}
	route, err := c.channelRoute(channelId).JoinSegment("privacy").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, requestBody)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// RestoreChannel restores a previously deleted channel. Any missing fields are not updated.
func (c *Client4) RestoreChannel(ctx context.Context, channelId string) (*Channel, *Response, error) {
	route, err := c.channelRoute(channelId).JoinSegment("restore").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// CreateDirectChannel creates a direct message channel based on the two user
// ids provided.
func (c *Client4) CreateDirectChannel(ctx context.Context, userId1, userId2 string) (*Channel, *Response, error) {
	requestBody := []string{userId1, userId2}
	route, err := c.channelsRoute().JoinSegment("direct").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// CreateGroupChannel creates a group message channel based on userIds provided.
func (c *Client4) CreateGroupChannel(ctx context.Context, userIds []string) (*Channel, *Response, error) {
	route, err := c.channelsRoute().JoinSegment("group").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, userIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// GetChannel returns a channel based on the provided channel id string.
func (c *Client4) GetChannel(ctx context.Context, channelId, etag string) (*Channel, *Response, error) {
	route, err := c.channelRoute(channelId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// GetChannelAsContentReviewer returns a channel based on the provided channel id string, fetching it as a Content Reviewer for a flagged post.
func (c *Client4) GetChannelAsContentReviewer(ctx context.Context, channelId, etag, flaggedPostId string) (*Channel, *Response, error) {
	values := url.Values{}
	values.Set("as_content_reviewer", c.boolString(true))
	values.Set("flagged_post_id", flaggedPostId)

	routeURL, err := c.channelRoute(channelId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	route := routeURL.String()
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// GetChannelStats returns statistics for a channel.
func (c *Client4) GetChannelStats(ctx context.Context, channelId string, etag string, excludeFilesCount bool) (*ChannelStats, *Response, error) {
	values := url.Values{}
	values.Set("exclude_files_count", c.boolString(excludeFilesCount))
	routeURL, err := c.channelRoute(channelId).JoinSegment("stats").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	route := routeURL.String()
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelStats](r)
}

// GetChannelsMemberCount get channel member count for a given array of channel ids
func (c *Client4) GetChannelsMemberCount(ctx context.Context, channelIDs []string) (map[string]int64, *Response, error) {
	route, err := c.channelsRoute().JoinSegments("stats", "member_count").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, channelIDs)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]int64](r)
}

// GetChannelMembersTimezones gets a list of timezones for a channel.
func (c *Client4) GetChannelMembersTimezones(ctx context.Context, channelId string) ([]string, *Response, error) {
	route, err := c.channelRoute(channelId).JoinSegment("timezones").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]string](r)
}

// GetPinnedPosts gets a list of pinned posts.
func (c *Client4) GetPinnedPosts(ctx context.Context, channelId string, etag string) (*PostList, *Response, error) {
	route, err := c.channelRoute(channelId).JoinSegment("pinned").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

// GetPrivateChannelsForTeam returns a list of private channels based on the provided team id string.
func (c *Client4) GetPrivateChannelsForTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.channelsForTeamRoute(teamId).JoinSegment("private").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Channel](r)
}

// GetPublicChannelsForTeam returns a list of public channels based on the provided team id string.
func (c *Client4) GetPublicChannelsForTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.channelsForTeamRoute(teamId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Channel](r)
}

// GetDeletedChannelsForTeam returns a list of public channels based on the provided team id string.
func (c *Client4) GetDeletedChannelsForTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.channelsForTeamRoute(teamId).JoinSegment("deleted").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Channel](r)
}

// GetPublicChannelsByIdsForTeam returns a list of public channels based on provided team id string.
func (c *Client4) GetPublicChannelsByIdsForTeam(ctx context.Context, teamId string, channelIds []string) ([]*Channel, *Response, error) {
	route, err := c.channelsForTeamRoute(teamId).JoinSegment("ids").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, channelIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Channel](r)
}

// GetChannelsForTeamForUser returns a list channels of on a team for a user.
func (c *Client4) GetChannelsForTeamForUser(ctx context.Context, teamId, userId string, includeDeleted bool, etag string) ([]*Channel, *Response, error) {
	values := url.Values{}
	values.Set("include_deleted", c.boolString(includeDeleted))
	routeURL, err := c.channelsForTeamForUserRoute(teamId, userId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Channel](r)
}

// GetChannelsForTeamAndUserWithLastDeleteAt returns a list channels of a team for a user, additionally filtered with lastDeleteAt. This does not have any effect if includeDeleted is set to false.
func (c *Client4) GetChannelsForTeamAndUserWithLastDeleteAt(ctx context.Context, teamId, userId string, includeDeleted bool, lastDeleteAt int, etag string) ([]*Channel, *Response, error) {
	values := url.Values{}
	values.Set("include_deleted", c.boolString(includeDeleted))
	values.Set("last_delete_at", strconv.Itoa(lastDeleteAt))
	routeURL, err := c.userRoute(userId).JoinRoute(c.teamRoute(teamId)).JoinSegment("channels").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	route := routeURL.String()
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Channel](r)
}

// GetChannelsForUserWithLastDeleteAt returns a list channels for a user, additionally filtered with lastDeleteAt.
func (c *Client4) GetChannelsForUserWithLastDeleteAt(ctx context.Context, userID string, lastDeleteAt int) ([]*Channel, *Response, error) {
	values := url.Values{}
	values.Set("last_delete_at", strconv.Itoa(lastDeleteAt))
	routeURL, err := c.userRoute(userID).JoinSegment("channels").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	route := routeURL.String()
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Channel](r)
}

// SearchChannels returns the channels on a team matching the provided search term.
func (c *Client4) SearchChannels(ctx context.Context, teamId string, search *ChannelSearch) ([]*Channel, *Response, error) {
	route, err := c.channelsForTeamRoute(teamId).JoinSegment("search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, search)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Channel](r)
}

// SearchAllChannels search in all the channels. Must be a system administrator.
func (c *Client4) SearchAllChannels(ctx context.Context, search *ChannelSearch) (ChannelListWithTeamData, *Response, error) {
	route, err := c.channelsRoute().JoinSegment("search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, search)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[ChannelListWithTeamData](r)
}

// SearchAllChannelsForUser search in all the channels for a regular user.
func (c *Client4) SearchAllChannelsForUser(ctx context.Context, term string) (ChannelListWithTeamData, *Response, error) {
	search := &ChannelSearch{
		Term: term,
	}
	route, err := c.channelsRoute().JoinSegment("search?system_console=false").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, search)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[ChannelListWithTeamData](r)
}

// SearchAllChannelsPaged searches all the channels and returns the results paged with the total count.
func (c *Client4) SearchAllChannelsPaged(ctx context.Context, search *ChannelSearch) (*ChannelsWithCount, *Response, error) {
	route, err := c.channelsRoute().JoinSegment("search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, search)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelsWithCount](r)
}

// SearchGroupChannels returns the group channels of the user whose members' usernames match the search term.
func (c *Client4) SearchGroupChannels(ctx context.Context, search *ChannelSearch) ([]*Channel, *Response, error) {
	route, err := c.channelsRoute().JoinSegments("group", "search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, search)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Channel](r)
}

// DeleteChannel deletes channel based on the provided channel id string.
func (c *Client4) DeleteChannel(ctx context.Context, channelId string) (*Response, error) {
	route, err := c.channelRoute(channelId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PermanentDeleteChannel deletes a channel based on the provided channel id string.
func (c *Client4) PermanentDeleteChannel(ctx context.Context, channelId string) (*Response, error) {
	routeURL, err := c.channelRoute(channelId).URL()
	if err != nil {
		return nil, err
	}
	routeURL.RawQuery = "permanent=" + c.boolString(true)
	r, err := c.DoAPIDelete(ctx, routeURL.String())
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// MoveChannel moves the channel to the destination team.
func (c *Client4) MoveChannel(ctx context.Context, channelId, teamId string, force bool) (*Channel, *Response, error) {
	requestBody := map[string]any{
		"team_id": teamId,
		"force":   force,
	}
	route, err := c.channelRoute(channelId).JoinSegment("move").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// GetChannelByName returns a channel based on the provided channel name and team id strings.
func (c *Client4) GetChannelByName(ctx context.Context, channelName, teamId string, etag string) (*Channel, *Response, error) {
	route, err := c.channelByNameRoute(channelName, teamId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// GetChannelByNameIncludeDeleted returns a channel based on the provided channel name and team id strings. Other then GetChannelByName it will also return deleted channels.
func (c *Client4) GetChannelByNameIncludeDeleted(ctx context.Context, channelName, teamId string, etag string) (*Channel, *Response, error) {
	routeURL, err := c.channelByNameRoute(channelName, teamId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = "include_deleted=" + c.boolString(true)
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// GetChannelByNameForTeamName returns a channel based on the provided channel name and team name strings.
func (c *Client4) GetChannelByNameForTeamName(ctx context.Context, channelName, teamName string, etag string) (*Channel, *Response, error) {
	route, err := c.channelByNameForTeamNameRoute(channelName, teamName).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// GetChannelByNameForTeamNameIncludeDeleted returns a channel based on the provided channel name and team name strings. Other then GetChannelByNameForTeamName it will also return deleted channels.
func (c *Client4) GetChannelByNameForTeamNameIncludeDeleted(ctx context.Context, channelName, teamName string, etag string) (*Channel, *Response, error) {
	routeURL, err := c.channelByNameForTeamNameRoute(channelName, teamName).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = "include_deleted=" + c.boolString(true)
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Channel](r)
}

// GetChannelMembers gets a page of channel members specific to a channel.
func (c *Client4) GetChannelMembers(ctx context.Context, channelId string, page, perPage int, etag string) (ChannelMembers, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.channelMembersRoute(channelId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[ChannelMembers](r)
}

// GetChannelMembersWithTeamData gets a page of all channel members for a user.
func (c *Client4) GetChannelMembersWithTeamData(ctx context.Context, userID string, page, perPage int) (ChannelMembersWithTeamData, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.userRoute(userID).JoinSegment("channel_members").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch ChannelMembersWithTeamData

	// Check if we need to handle NDJSON format (when page is -1)
	if page == -1 {
		// Process NDJSON format (each JSON object on new line)
		contentType := r.Header.Get("Content-Type")
		if contentType == "application/x-ndjson" {
			scanner := bufio.NewScanner(r.Body)
			ch = ChannelMembersWithTeamData{}

			for scanner.Scan() {
				line := scanner.Text()
				if line == "" {
					continue
				}

				var member ChannelMemberWithTeamData
				if err = json.Unmarshal([]byte(line), &member); err != nil {
					return nil, BuildResponse(r), fmt.Errorf("failed to unmarshal channel member data: %w", err)
				}
				ch = append(ch, member)
			}

			if err = scanner.Err(); err != nil {
				return nil, BuildResponse(r), fmt.Errorf("scanner error while reading channel members: %w", err)
			}

			return ch, BuildResponse(r), nil
		}
	}

	// Standard JSON format
	return DecodeJSONFromResponse[ChannelMembersWithTeamData](r)
}

// GetChannelMembersByIds gets the channel members in a channel for a list of user ids.
func (c *Client4) GetChannelMembersByIds(ctx context.Context, channelId string, userIds []string) (ChannelMembers, *Response, error) {
	route, err := c.channelMembersRoute(channelId).JoinSegment("ids").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, userIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[ChannelMembers](r)
}

// GetChannelMember gets a channel member.
func (c *Client4) GetChannelMember(ctx context.Context, channelId, userId, etag string) (*ChannelMember, *Response, error) {
	route, err := c.channelMemberRoute(channelId, userId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelMember](r)
}

// GetChannelMembersForUser gets all the channel members for a user on a team.
func (c *Client4) GetChannelMembersForUser(ctx context.Context, userId, teamId, etag string) (ChannelMembers, *Response, error) {
	route, err := c.userRoute(userId).JoinSegment("teams").JoinId(fmt.Sprintf("%v", teamId)).JoinSegments("channels", "members").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[ChannelMembers](r)
}

// ViewChannel performs a view action for a user. Synonymous with switching channels or marking channels as read by a user.
func (c *Client4) ViewChannel(ctx context.Context, userId string, view *ChannelView) (*ChannelViewResponse, *Response, error) {
	url, err := c.channelsRoute().JoinSegment("members").JoinId(fmt.Sprintf("%v", userId)).JoinSegment("view").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, url, view)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelViewResponse](r)
}

// ReadMultipleChannels performs a view action on several channels at the same time for a user.
func (c *Client4) ReadMultipleChannels(ctx context.Context, userId string, channelIds []string) (*ChannelViewResponse, *Response, error) {
	url, err := c.channelsRoute().JoinSegment("members").JoinId(fmt.Sprintf("%v", userId)).JoinSegment("mark_read").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, url, channelIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelViewResponse](r)
}

// GetChannelUnread will return a ChannelUnread object that contains the number of
// unread messages and mentions for a user.
func (c *Client4) GetChannelUnread(ctx context.Context, channelId, userId string) (*ChannelUnread, *Response, error) {
	route, err := c.userRoute(userId).JoinRoute(c.channelRoute(channelId)).JoinSegment("unread").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelUnread](r)
}

// UpdateChannelRoles will update the roles on a channel for a user.
func (c *Client4) UpdateChannelRoles(ctx context.Context, channelId, userId, roles string) (*Response, error) {
	requestBody := map[string]string{"roles": roles}
	route, err := c.channelMemberRoute(channelId, userId).JoinSegment("roles").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateChannelMemberSchemeRoles will update the scheme-derived roles on a channel for a user.
func (c *Client4) UpdateChannelMemberSchemeRoles(ctx context.Context, channelId string, userId string, schemeRoles *SchemeRoles) (*Response, error) {
	route, err := c.channelMemberRoute(channelId, userId).JoinSegment("schemeRoles").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, schemeRoles)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateChannelNotifyProps will update the notification properties on a channel for a user.
func (c *Client4) UpdateChannelNotifyProps(ctx context.Context, channelId, userId string, props map[string]string) (*Response, error) {
	route, err := c.channelMemberRoute(channelId, userId).JoinSegment("notify_props").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, props)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AddChannelMember adds user to channel and return a channel member.
func (c *Client4) AddChannelMember(ctx context.Context, channelId, userId string) (*ChannelMember, *Response, error) {
	requestBody := map[string]string{"user_id": userId}
	route, err := c.channelMembersRoute(channelId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelMember](r)
}

// AddChannelMembers adds users to a channel and return an array of channel members.
func (c *Client4) AddChannelMembers(ctx context.Context, channelId, postRootId string, userIds []string) ([]*ChannelMember, *Response, error) {
	requestBody := map[string]any{"user_ids": userIds, "post_root_id": postRootId}
	route, err := c.channelMembersRoute(channelId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*ChannelMember](r)
}

// AddChannelMemberWithRootId adds user to channel and return a channel member. Post add to channel message has the postRootId.
func (c *Client4) AddChannelMemberWithRootId(ctx context.Context, channelId, userId, postRootId string) (*ChannelMember, *Response, error) {
	requestBody := map[string]string{"user_id": userId, "post_root_id": postRootId}
	route, err := c.channelMembersRoute(channelId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelMember](r)
}

// RemoveUserFromChannel will delete the channel member object for a user, effectively removing the user from a channel.
func (c *Client4) RemoveUserFromChannel(ctx context.Context, channelId, userId string) (*Response, error) {
	route, err := c.channelMemberRoute(channelId, userId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AutocompleteChannelsForTeam will return an ordered list of channels autocomplete suggestions.
func (c *Client4) AutocompleteChannelsForTeam(ctx context.Context, teamId, name string) (ChannelList, *Response, error) {
	values := url.Values{}
	values.Set("name", name)
	routeURL, err := c.channelsForTeamRoute(teamId).JoinSegment("autocomplete").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[ChannelList](r)
}

// AutocompleteChannelsForTeamForSearch will return an ordered list of your channels autocomplete suggestions.
func (c *Client4) AutocompleteChannelsForTeamForSearch(ctx context.Context, teamId, name string) (ChannelList, *Response, error) {
	values := url.Values{}
	values.Set("name", name)
	routeURL, err := c.channelsForTeamRoute(teamId).JoinSegment("search_autocomplete").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[ChannelList](r)
}

// Post Section

// CreatePost creates a post based on the provided post struct.
func (c *Client4) CreatePost(ctx context.Context, post *Post) (*Post, *Response, error) {
	route, err := c.postsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, post)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Post](r)
}

// CreatePostEphemeral creates a ephemeral post based on the provided post struct which is send to the given user id.
func (c *Client4) CreatePostEphemeral(ctx context.Context, post *PostEphemeral) (*Post, *Response, error) {
	route, err := c.postsEphemeralRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, post)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Post](r)
}

// UpdatePost updates a post based on the provided post struct.
func (c *Client4) UpdatePost(ctx context.Context, postId string, post *Post) (*Post, *Response, error) {
	route, err := c.postRoute(postId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, post)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Post](r)
}

// PatchPost partially updates a post. Any missing fields are not updated.
func (c *Client4) PatchPost(ctx context.Context, postId string, patch *PostPatch) (*Post, *Response, error) {
	route, err := c.postRoute(postId).JoinSegment("patch").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Post](r)
}

// SetPostUnread marks channel where post belongs as unread on the time of the provided post.
func (c *Client4) SetPostUnread(ctx context.Context, userId string, postId string, collapsedThreadsSupported bool) (*Response, error) {
	reqData := map[string]bool{"collapsed_threads_supported": collapsedThreadsSupported}
	route, err := c.userRoute(userId).JoinRoute(c.postRoute(postId)).JoinSegment("set_unread").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, reqData)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SetPostReminder creates a post reminder for a given post at a specified time.
// The time needs to be in UTC epoch in seconds. It is always truncated to a
// 5 minute resolution minimum.
func (c *Client4) SetPostReminder(ctx context.Context, reminder *PostReminder) (*Response, error) {
	route, err := c.userRoute(reminder.UserId).JoinRoute(c.postRoute(reminder.PostId)).JoinSegment("reminder").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, reminder)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PinPost pin a post based on provided post id string.
func (c *Client4) PinPost(ctx context.Context, postId string) (*Response, error) {
	route, err := c.postRoute(postId).JoinSegment("pin").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UnpinPost unpin a post based on provided post id string.
func (c *Client4) UnpinPost(ctx context.Context, postId string) (*Response, error) {
	route, err := c.postRoute(postId).JoinSegment("unpin").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetPost gets a single post.
func (c *Client4) GetPost(ctx context.Context, postId string, etag string) (*Post, *Response, error) {
	route, err := c.postRoute(postId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Post](r)
}

// GetPostIncludeDeleted gets a single post, including deleted.
func (c *Client4) GetPostIncludeDeleted(ctx context.Context, postId string, etag string) (*Post, *Response, error) {
	routeURL, err := c.postRoute(postId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = "include_deleted=" + c.boolString(true)
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Post](r)
}

// DeletePost deletes a post from the provided post id string.
func (c *Client4) DeletePost(ctx context.Context, postId string) (*Response, error) {
	route, err := c.postRoute(postId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PermanentDeletePost permanently deletes a post and its files from the provided post id string.
func (c *Client4) PermanentDeletePost(ctx context.Context, postId string) (*Response, error) {
	routeURL, err := c.postRoute(postId).URL()
	if err != nil {
		return nil, err
	}
	routeURL.RawQuery = "permanent=" + c.boolString(true)
	r, err := c.DoAPIDelete(ctx, routeURL.String())
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetPostThread gets a post with all the other posts in the same thread.
func (c *Client4) GetPostThread(ctx context.Context, postId string, etag string, collapsedThreads bool) (*PostList, *Response, error) {
	values := url.Values{}
	values.Set("collapsedThreads", c.boolString(collapsedThreads))
	routeURL, err := c.postRoute(postId).JoinSegment("thread").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

// GetPostThreadWithOpts gets a post with all the other posts in the same thread.
func (c *Client4) GetPostThreadWithOpts(ctx context.Context, postID string, etag string, opts GetPostsOptions) (*PostList, *Response, error) {
	urlVal, err := c.postRoute(postID).JoinSegment("thread").String()
	if err != nil {
		return nil, nil, err
	}

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
	if opts.UpdatesOnly {
		values.Set("updatesOnly", "true")
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
	if opts.FromUpdateAt != 0 {
		values.Set("fromUpdateAt", strconv.FormatInt(opts.FromUpdateAt, 10))
	}
	if opts.Direction != "" {
		values.Set("direction", opts.Direction)
	}
	urlVal += "?" + values.Encode()

	r, err := c.DoAPIGet(ctx, urlVal, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

// GetPostsForChannel gets a page of posts with an array for ordering for a channel.
func (c *Client4) GetPostsForChannel(ctx context.Context, channelId string, page, perPage int, etag string, collapsedThreads bool, includeDeleted bool) (*PostList, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("collapsedThreads", c.boolString(collapsedThreads))
	values.Set("include_deleted", c.boolString(includeDeleted))
	routeURL, err := c.channelRoute(channelId).JoinSegment("posts").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

// GetPostsByIds gets a list of posts by taking an array of post ids
func (c *Client4) GetPostsByIds(ctx context.Context, postIds []string) ([]*Post, *Response, error) {
	route, err := c.postsRoute().JoinSegment("ids").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, postIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Post](r)
}

// GetEditHistoryForPost gets a list of posts by taking a post ids
func (c *Client4) GetEditHistoryForPost(ctx context.Context, postId string) ([]*Post, *Response, error) {
	js, err := json.Marshal(postId)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to marshal edit history request: %w", err)
	}
	route, err := c.postRoute(postId).JoinSegment("edit_history").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, string(js))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Post](r)
}

// GetFlaggedPostsForUser returns flagged posts of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUser(ctx context.Context, userId string, page int, perPage int) (*PostList, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.userRoute(userId).JoinSegments("posts", "flagged").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

// GetFlaggedPostsForUserInTeam returns flagged posts in team of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUserInTeam(ctx context.Context, userId string, teamId string, page int, perPage int) (*PostList, *Response, error) {
	if !IsValidId(teamId) {
		return nil, nil, errors.New("teamId is invalid")
	}

	values := url.Values{}
	values.Set("team_id", teamId)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.userRoute(userId).JoinSegments("posts", "flagged").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

// GetFlaggedPostsForUserInChannel returns flagged posts in channel of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUserInChannel(ctx context.Context, userId string, channelId string, page int, perPage int) (*PostList, *Response, error) {
	if !IsValidId(channelId) {
		return nil, nil, errors.New("channelId is invalid")
	}

	values := url.Values{}
	values.Set("channel_id", channelId)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.userRoute(userId).JoinSegments("posts", "flagged").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

// GetPostsSince gets posts created after a specified time as Unix time in milliseconds.
func (c *Client4) GetPostsSince(ctx context.Context, channelId string, time int64, collapsedThreads bool) (*PostList, *Response, error) {
	values := url.Values{}
	values.Set("since", strconv.FormatInt(time, 10))
	values.Set("collapsedThreads", c.boolString(collapsedThreads))
	routeURL, err := c.channelRoute(channelId).JoinSegment("posts").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

// GetPostsAfter gets a page of posts that were posted after the post provided.
func (c *Client4) GetPostsAfter(ctx context.Context, channelId, postId string, page, perPage int, etag string, collapsedThreads bool, includeDeleted bool) (*PostList, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("after", postId)
	values.Set("collapsedThreads", c.boolString(collapsedThreads))
	values.Set("include_deleted", c.boolString(includeDeleted))
	routeURL, err := c.channelRoute(channelId).JoinSegment("posts").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

// GetPostsBefore gets a page of posts that were posted before the post provided.
func (c *Client4) GetPostsBefore(ctx context.Context, channelId, postId string, page, perPage int, etag string, collapsedThreads bool, includeDeleted bool) (*PostList, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("before", postId)
	values.Set("collapsedThreads", c.boolString(collapsedThreads))
	values.Set("include_deleted", c.boolString(includeDeleted))
	routeURL, err := c.channelRoute(channelId).JoinSegment("posts").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

// MoveThread moves a thread based on provided post id, and channel id string.
func (c *Client4) MoveThread(ctx context.Context, postId string, params *MoveThreadParams) (*Response, error) {
	route, err := c.postRoute(postId).JoinSegment("move").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, params)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetPostsAroundLastUnread gets a list of posts around last unread post by a user in a channel.
func (c *Client4) GetPostsAroundLastUnread(ctx context.Context, userId, channelId string, limitBefore, limitAfter int, collapsedThreads bool) (*PostList, *Response, error) {
	values := url.Values{}
	values.Set("limit_before", strconv.Itoa(limitBefore))
	values.Set("limit_after", strconv.Itoa(limitAfter))
	values.Set("collapsedThreads", c.boolString(collapsedThreads))
	routeURL, err := c.userRoute(userId).JoinRoute(c.channelRoute(channelId)).JoinSegments("posts", "unread").URL()

	if err != nil {
		return nil, nil, err
	}

	routeURL.RawQuery = values.Encode()

	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

func (c *Client4) CreateScheduledPost(ctx context.Context, scheduledPost *ScheduledPost) (*ScheduledPost, *Response, error) {
	route, err := c.postsRoute().JoinSegment("schedule").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, scheduledPost)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ScheduledPost](r)
}

func (c *Client4) GetUserScheduledPosts(ctx context.Context, teamId string, includeDirectChannels bool) (map[string][]*ScheduledPost, *Response, error) {
	values := url.Values{}
	values.Set("includeDirectChannels", fmt.Sprintf("%t", includeDirectChannels))
	routeURL, err := c.postsRoute().JoinSegments("scheduled", "team").JoinId(teamId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string][]*ScheduledPost](r)
}

func (c *Client4) UpdateScheduledPost(ctx context.Context, scheduledPost *ScheduledPost) (*ScheduledPost, *Response, error) {
	route, err := c.postsRoute().JoinSegment("schedule").JoinId(scheduledPost.Id).String()
	if err != nil {
		return nil, nil, err
	}

	r, err := c.DoAPIPutJSON(ctx, route, scheduledPost)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ScheduledPost](r)
}

func (c *Client4) DeleteScheduledPost(ctx context.Context, scheduledPostId string) (*ScheduledPost, *Response, error) {
	route, err := c.postsRoute().JoinSegment("schedule").JoinId(scheduledPostId).String()
	if err != nil {
		return nil, nil, err
	}

	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	return DecodeJSONFromResponse[*ScheduledPost](r)
}

func (c *Client4) FlagPostForContentReview(ctx context.Context, postId string, flagRequest *FlagContentRequest) (*Response, error) {
	route, err := c.contentFlaggingRoute().JoinSegment("post").JoinId(postId).JoinSegment("flag").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, flagRequest)
	if err != nil {
		return BuildResponse(r), err
	}

	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetContentFlaggedPost(ctx context.Context, postId string) (*Post, *Response, error) {
	route, err := c.contentFlaggingRoute().JoinSegment("post").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route+postId, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	return DecodeJSONFromResponse[*Post](r)
}

func (c *Client4) GetFlaggingConfiguration(ctx context.Context) (*ContentFlaggingReportingConfig, *Response, error) {
	route, err := c.contentFlaggingRoute().JoinSegments("flag", "config").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ContentFlaggingReportingConfig](r)
}

func (c *Client4) GetTeamPostFlaggingFeatureStatus(ctx context.Context, teamId string) (map[string]bool, *Response, error) {
	route, err := c.contentFlaggingRoute().JoinSegment("team").JoinId(teamId).JoinSegment("status").String()
	if err != nil {
		return nil, nil, err
	}

	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]bool](r)
}

func (c *Client4) SaveContentFlaggingSettings(ctx context.Context, config *ContentFlaggingSettingsRequest) (*Response, error) {
	route, err := c.contentFlaggingRoute().JoinSegment("config").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, config)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetContentFlaggingSettings(ctx context.Context) (*ContentFlaggingSettingsRequest, *Response, error) {
	route, err := c.contentFlaggingRoute().JoinSegment("config").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ContentFlaggingSettingsRequest](r)
}

func (c *Client4) AssignContentFlaggingReviewer(ctx context.Context, postId, reviewerId string) (*Response, error) {
	route, err := c.contentFlaggingRoute().JoinSegment("post").JoinId(postId).JoinSegment("assign").JoinId(reviewerId).String()
	if err != nil {
		return BuildResponse(nil), err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}

	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) SearchContentFlaggingReviewers(ctx context.Context, teamID, term string) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("term", term)
	routeURL, err := c.contentFlaggingRoute().JoinSegment("team").JoinId(teamID).JoinSegments("reviewers", "search").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

// SearchFiles returns any posts with matching terms string.
func (c *Client4) SearchFiles(ctx context.Context, teamId string, terms string, isOrSearch bool) (*FileInfoList, *Response, error) {
	params := SearchParameter{
		Terms:      &terms,
		IsOrSearch: &isOrSearch,
	}
	return c.SearchFilesWithParams(ctx, teamId, &params)
}

// SearchFilesWithParams returns any posts with matching terms string.
func (c *Client4) SearchFilesWithParams(ctx context.Context, teamId string, params *SearchParameter) (*FileInfoList, *Response, error) {
	route, err := c.teamRoute(teamId).JoinSegments("files", "search").String()
	if err != nil {
		return nil, nil, err
	}
	if teamId == "" {
		route, err = c.filesRoute().JoinSegment("search").String()
		if err != nil {
			return nil, nil, err
		}
	}
	r, err := c.DoAPIPostJSON(ctx, route, params)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*FileInfoList](r)
}

// SearchFilesAcrossTeams returns any posts with matching terms string.
func (c *Client4) SearchFilesAcrossTeams(ctx context.Context, terms string, isOrSearch bool) (*FileInfoList, *Response, error) {
	params := SearchParameter{
		Terms:      &terms,
		IsOrSearch: &isOrSearch,
	}
	return c.SearchFilesWithParams(ctx, "", &params)
}

// SearchPosts returns any posts with matching terms string.
func (c *Client4) SearchPosts(ctx context.Context, teamId string, terms string, isOrSearch bool) (*PostList, *Response, error) {
	params := SearchParameter{
		Terms:      &terms,
		IsOrSearch: &isOrSearch,
	}
	return c.SearchPostsWithParams(ctx, teamId, &params)
}

// SearchPostsWithParams returns any posts with matching terms string.
func (c *Client4) SearchPostsWithParams(ctx context.Context, teamId string, params *SearchParameter) (*PostList, *Response, error) {
	var route string
	if teamId == "" {
		var err error
		route, err = c.postsRoute().JoinSegment("search").String()
		if err != nil {
			return nil, nil, err
		}
	} else {
		var err error
		route, err = c.teamRoute(teamId).JoinSegments("posts", "search").String()
		if err != nil {
			return nil, nil, err
		}
	}
	r, err := c.DoAPIPostJSON(ctx, route, params)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostList](r)
}

// SearchPostsWithMatches returns any posts with matching terms string, including.
func (c *Client4) SearchPostsWithMatches(ctx context.Context, teamId string, terms string, isOrSearch bool) (*PostSearchResults, *Response, error) {
	requestBody := map[string]any{"terms": terms, "is_or_search": isOrSearch}
	var route string
	if teamId == "" {
		var err error
		route, err = c.postsRoute().JoinSegment("search").String()
		if err != nil {
			return nil, nil, err
		}
	} else {
		var err error
		route, err = c.teamRoute(teamId).JoinSegments("posts", "search").String()
		if err != nil {
			return nil, nil, err
		}
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostSearchResults](r)
}

// DoPostAction performs a post action.
func (c *Client4) DoPostAction(ctx context.Context, postId, actionId string) (*Response, error) {
	route, err := c.postRoute(postId).JoinSegment("actions").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route+actionId, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DoPostActionWithCookie performs a post action with extra arguments
func (c *Client4) DoPostActionWithCookie(ctx context.Context, postId, actionId, selected, cookieStr string) (*Response, error) {
	if selected == "" && cookieStr == "" {
		route, err := c.postRoute(postId).JoinSegment("actions").String()
		if err != nil {
			return nil, err
		}
		r, err := c.DoAPIPost(ctx, route+actionId, "")
		if err != nil {
			return BuildResponse(r), err
		}
		defer closeBody(r)
		return BuildResponse(r), nil
	}

	req := DoPostActionRequest{
		SelectedOption: selected,
		Cookie:         cookieStr,
	}
	route, err := c.postRoute(postId).JoinSegment("actions").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route+actionId, req)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// OpenInteractiveDialog sends a WebSocket event to a user's clients to
// open interactive dialogs, based on the provided trigger ID and other
// provided data. Used with interactive message buttons, menus and
// slash commands.
func (c *Client4) OpenInteractiveDialog(ctx context.Context, request OpenDialogRequest) (*Response, error) {
	r, err := c.DoAPIPostJSON(ctx, "/actions/dialogs/open", request)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SubmitInteractiveDialog will submit the provided dialog data to the integration
// configured by the URL. Used with the interactive dialogs integration feature.
func (c *Client4) SubmitInteractiveDialog(ctx context.Context, request SubmitDialogRequest) (*SubmitDialogResponse, *Response, error) {
	r, err := c.DoAPIPostJSON(ctx, "/actions/dialogs/submit", request)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*SubmitDialogResponse](r)
}

// LookupInteractiveDialog will perform a lookup request for dynamic select elements
// in interactive dialogs. Used to fetch options for dynamic select fields.
func (c *Client4) LookupInteractiveDialog(ctx context.Context, request SubmitDialogRequest) (*LookupDialogResponse, *Response, error) {
	r, err := c.DoAPIPostJSON(ctx, "/actions/dialogs/lookup", request)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	return DecodeJSONFromResponse[*LookupDialogResponse](r)
}

// UploadFile will upload a file to a channel using a multipart request, to be later attached to a post.
// This method is functionally equivalent to Client4.UploadFileAsRequestBody.
func (c *Client4) UploadFile(ctx context.Context, data []byte, channelId string, filename string) (*FileUploadResponse, *Response, error) {
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

	route, err := c.filesRoute().String()
	if err != nil {
		return nil, nil, err
	}
	return c.DoUploadFile(ctx, route, body.Bytes(), writer.FormDataContentType())
}

// UploadFileAsRequestBody will upload a file to a channel as the body of a request, to be later attached
// to a post. This method is functionally equivalent to Client4.UploadFile.
func (c *Client4) UploadFileAsRequestBody(ctx context.Context, data []byte, channelId string, filename string) (*FileUploadResponse, *Response, error) {
	values := url.Values{}
	values.Set("channel_id", channelId)
	values.Set("filename", filename)
	routeURL, err := c.filesRoute().URL()
	if err != nil {
		return nil, nil, err
	}

	routeURL.RawQuery = values.Encode()

	return c.DoUploadFile(ctx, routeURL.String(), data, http.DetectContentType(data))
}

// GetFile gets the bytes for a file by id.
func (c *Client4) GetFile(ctx context.Context, fileId string) ([]byte, *Response, error) {
	route, err := c.fileRoute(fileId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// DownloadFile gets the bytes for a file by id, optionally adding headers to force the browser to download it.
func (c *Client4) DownloadFile(ctx context.Context, fileId string, download bool) ([]byte, *Response, error) {
	values := url.Values{}
	values.Set("download", c.boolString(download))
	routeURL, err := c.fileRoute(fileId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// GetFileThumbnail gets the bytes for a file by id.
func (c *Client4) GetFileThumbnail(ctx context.Context, fileId string) ([]byte, *Response, error) {
	route, err := c.fileRoute(fileId).JoinSegment("thumbnail").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// DownloadFileThumbnail gets the bytes for a file by id, optionally adding headers to force the browser to download it.
func (c *Client4) DownloadFileThumbnail(ctx context.Context, fileId string, download bool) ([]byte, *Response, error) {
	values := url.Values{}
	values.Set("download", c.boolString(download))
	routeURL, err := c.fileRoute(fileId).JoinSegment("thumbnail").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// GetFileLink gets the public link of a file by id.
func (c *Client4) GetFileLink(ctx context.Context, fileId string) (string, *Response, error) {
	route, err := c.fileRoute(fileId).JoinSegment("link").String()
	if err != nil {
		return "", nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	result, resp, err := DecodeJSONFromResponse[map[string]string](r)
	if err != nil {
		return "", resp, err
	}
	return result["link"], resp, nil
}

// GetFilePreview gets the bytes for a file by id.
func (c *Client4) GetFilePreview(ctx context.Context, fileId string) ([]byte, *Response, error) {
	route, err := c.fileRoute(fileId).JoinSegment("preview").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// DownloadFilePreview gets the bytes for a file by id.
func (c *Client4) DownloadFilePreview(ctx context.Context, fileId string, download bool) ([]byte, *Response, error) {
	values := url.Values{}
	values.Set("download", c.boolString(download))
	routeURL, err := c.fileRoute(fileId).JoinSegment("preview").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// GetFileInfo gets all the file info objects.
func (c *Client4) GetFileInfo(ctx context.Context, fileId string) (*FileInfo, *Response, error) {
	route, err := c.fileRoute(fileId).JoinSegment("info").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*FileInfo](r)
}

// GetFileInfosForPost gets all the file info objects attached to a post.
func (c *Client4) GetFileInfosForPost(ctx context.Context, postId string, etag string) ([]*FileInfo, *Response, error) {
	route, err := c.postRoute(postId).JoinSegments("files", "info").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*FileInfo](r)
}

// GetFileInfosForPost gets all the file info objects attached to a post, including deleted
func (c *Client4) GetFileInfosForPostIncludeDeleted(ctx context.Context, postId string, etag string) ([]*FileInfo, *Response, error) {
	routeURL, err := c.postRoute(postId).JoinSegments("files", "info").URL()
	if err != nil {
		return nil, nil, err
	}

	routeURL.RawQuery = "include_deleted=" + c.boolString(true)

	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*FileInfo](r)
}

// General/System Section

// GenerateSupportPacket generates and downloads a Support Packet.
// It returns a ReadCloser to the packet and the filename. The caller needs to close the ReadCloser.
func (c *Client4) GenerateSupportPacket(ctx context.Context) (io.ReadCloser, string, *Response, error) {
	route, err := c.systemRoute().JoinSegment("support_packet").String()
	if err != nil {
		return nil, "", nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, "", BuildResponse(r), err
	}

	_, params, err := mime.ParseMediaType(r.Header.Get("Content-Disposition"))
	if err != nil {
		return nil, "", BuildResponse(r), fmt.Errorf("could not parse Content-Disposition header: %w", err)
	}

	return r.Body, params["filename"], BuildResponse(r), nil
}

// GetPing will return ok if the running goRoutines are below the threshold and unhealthy for above.
// DEPRECATED: Use GetPingWithOptions method instead.
func (c *Client4) GetPing(ctx context.Context) (string, *Response, error) {
	ping, resp, err := c.GetPingWithOptions(ctx, SystemPingOptions{})
	status := ""
	if ping != nil {
		status = ping["status"].(string)
	}
	return status, resp, err
}

// GetPingWithServerStatus will return ok if several basic server health checks
// all pass successfully.
// DEPRECATED: Use GetPingWithOptions method instead.
func (c *Client4) GetPingWithServerStatus(ctx context.Context) (string, *Response, error) {
	ping, resp, err := c.GetPingWithOptions(ctx, SystemPingOptions{FullStatus: true})
	status := ""
	if ping != nil {
		status = ping["status"].(string)
	}
	return status, resp, err
}

// GetPingWithFullServerStatus will return the full status if several basic server
// health checks all pass successfully.
// DEPRECATED: Use GetPingWithOptions method instead.
func (c *Client4) GetPingWithFullServerStatus(ctx context.Context) (map[string]any, *Response, error) {
	return c.GetPingWithOptions(ctx, SystemPingOptions{FullStatus: true})
}

// GetPingWithOptions will return the status according to the options
func (c *Client4) GetPingWithOptions(ctx context.Context, options SystemPingOptions) (map[string]any, *Response, error) {
	pingURL, err := c.systemRoute().JoinSegment("ping").URL()
	if err != nil {
		return nil, nil, fmt.Errorf("could not parse query: %w", err)
	}
	values := pingURL.Query()
	values.Set("get_server_status", c.boolString(options.FullStatus))
	values.Set("use_rest_semantics", c.boolString(options.RESTSemantics))
	pingURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, pingURL.String(), "")
	if r != nil && r.StatusCode == 500 {
		defer r.Body.Close()
		return map[string]any{"status": StatusUnhealthy}, BuildResponse(r), err
	}
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]any](r)
}

func (c *Client4) GetServerLimits(ctx context.Context) (*ServerLimits, *Response, error) {
	route, err := c.limitsRoute().JoinSegment("server").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ServerLimits](r)
}

// TestEmail will attempt to connect to the configured SMTP server.
func (c *Client4) TestEmail(ctx context.Context, config *Config) (*Response, error) {
	route, err := c.testEmailRoute().String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, config)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) TestNotifications(ctx context.Context) (*Response, error) {
	route, err := c.testNotificationRoute().String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// TestSiteURL will test the validity of a site URL.
func (c *Client4) TestSiteURL(ctx context.Context, siteURL string) (*Response, error) {
	requestBody := make(map[string]string)
	requestBody["site_url"] = siteURL
	route, err := c.testSiteURLRoute().String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// TestS3Connection will attempt to connect to the AWS S3.
func (c *Client4) TestS3Connection(ctx context.Context, config *Config) (*Response, error) {
	route, err := c.testS3Route().String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, config)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetConfig will retrieve the server config with some sanitized items.
func (c *Client4) GetConfig(ctx context.Context) (*Config, *Response, error) {
	route, err := c.configRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Config](r)
}

// GetConfig will retrieve the server config with some sanitized items.
func (c *Client4) GetConfigWithOptions(ctx context.Context, options GetConfigOptions) (map[string]any, *Response, error) {
	v := url.Values{}
	if options.RemoveDefaults {
		v.Set("remove_defaults", "true")
	}
	if options.RemoveMasked {
		v.Set("remove_masked", "true")
	}
	routeURL, err := c.configRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	if len(v) > 0 {
		routeURL.RawQuery = v.Encode()
	}

	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]any](r)
}

// ReloadConfig will reload the server configuration.
func (c *Client4) ReloadConfig(ctx context.Context) (*Response, error) {
	route, err := c.configRoute().JoinSegment("reload").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetClientConfig will retrieve the parts of the server configuration needed by the client.
func (c *Client4) GetClientConfig(ctx context.Context, etag string) (map[string]string, *Response, error) {
	route, err := c.configRoute().JoinSegment("client").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]string](r)
}

// GetEnvironmentConfig will retrieve a map mirroring the server configuration where fields
// are set to true if the corresponding config setting is set through an environment variable.
// Settings that haven't been set through environment variables will be missing from the map.
func (c *Client4) GetEnvironmentConfig(ctx context.Context) (map[string]any, *Response, error) {
	route, err := c.configRoute().JoinSegment("environment").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return StringInterfaceFromJSON(r.Body), BuildResponse(r), nil
}

// GetOldClientLicense will retrieve the parts of the server license needed by the
// client, formatted in the old format.
func (c *Client4) GetOldClientLicense(ctx context.Context, etag string) (map[string]string, *Response, error) {
	route, err := c.licenseRoute().JoinSegment("client?format=old").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]string](r)
}

// DatabaseRecycle will recycle the connections. Discard current connection and get new one.
func (c *Client4) DatabaseRecycle(ctx context.Context) (*Response, error) {
	route, err := c.databaseRoute().JoinSegment("recycle").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// InvalidateCaches will purge the cache and can affect the performance while is cleaning.
func (c *Client4) InvalidateCaches(ctx context.Context) (*Response, error) {
	route, err := c.cacheRoute().JoinSegment("invalidate").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateConfig will update the server configuration.
func (c *Client4) UpdateConfig(ctx context.Context, config *Config) (*Config, *Response, error) {
	route, err := c.configRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, config)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Config](r)
}

// MigrateConfig will migrate existing config to the new one.
// DEPRECATED: The config migrate API has been moved to be a purely
// mmctl --local endpoint. This method will be removed in a
// future major release.
func (c *Client4) MigrateConfig(ctx context.Context, from, to string) (*Response, error) {
	m := make(map[string]string, 2)
	m["from"] = from
	m["to"] = to
	route, err := c.configRoute().JoinSegment("migrate").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, m)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UploadLicenseFile will add a license file to the system.
func (c *Client4) UploadLicenseFile(ctx context.Context, data []byte) (*Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("license", "test-license.mattermost-license")
	if err != nil {
		return nil, fmt.Errorf("failed to create form file for license upload: %w", err)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, fmt.Errorf("failed to copy license data to form file: %w", err)
	}

	if err = writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer for license upload: %w", err)
	}

	route, err := c.licenseRoute().String()
	if err != nil {
		return nil, err
	}
	r, err := c.doAPIRequestReader(ctx, http.MethodPost, c.APIURL+route, writer.FormDataContentType(), body, nil)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveLicenseFile will remove the server license it exists. Note that this will
// disable all enterprise features.
func (c *Client4) RemoveLicenseFile(ctx context.Context) (*Response, error) {
	route, err := c.licenseRoute().String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetLicenseLoadMetric retrieves the license load metric from the server.
// The load is calculated as (monthly active users / licensed users) * 1000.
func (c *Client4) GetLicenseLoadMetric(ctx context.Context) (map[string]int, *Response, error) {
	route, err := c.licenseRoute().JoinSegment("load_metric").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]int](r)
}

// GetAnalyticsOld will retrieve analytics using the old format. New format is not
// available but the "/analytics" endpoint is reserved for it. The "name" argument is optional
// and defaults to "standard". The "teamId" argument is optional and will limit results
// to a specific team.
func (c *Client4) GetAnalyticsOld(ctx context.Context, name, teamId string) (AnalyticsRows, *Response, error) {
	values := url.Values{}
	values.Set("name", name)
	values.Set("team_id", teamId)
	routeURL, err := c.analyticsRoute().JoinSegment("old").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[AnalyticsRows](r)
}

// Webhooks Section

// CreateIncomingWebhook creates an incoming webhook for a channel.
func (c *Client4) CreateIncomingWebhook(ctx context.Context, hook *IncomingWebhook) (*IncomingWebhook, *Response, error) {
	route, err := c.incomingWebhooksRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, hook)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*IncomingWebhook](r)
}

// UpdateIncomingWebhook updates an incoming webhook for a channel.
func (c *Client4) UpdateIncomingWebhook(ctx context.Context, hook *IncomingWebhook) (*IncomingWebhook, *Response, error) {
	route, err := c.incomingWebhookRoute(hook.Id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, hook)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*IncomingWebhook](r)
}

// GetIncomingWebhooks returns a page of incoming webhooks on the system. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooks(ctx context.Context, page int, perPage int, etag string) ([]*IncomingWebhook, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.incomingWebhooksRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*IncomingWebhook](r)
}

// GetIncomingWebhooksWithCount returns a page of incoming webhooks on the system including the total count. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooksWithCount(ctx context.Context, page int, perPage int, etag string) (*IncomingWebhooksWithCount, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("include_total_count", c.boolString(true))
	routeURL, err := c.incomingWebhooksRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*IncomingWebhooksWithCount](r)
}

// GetIncomingWebhooksForTeam returns a page of incoming webhooks for a team. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooksForTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*IncomingWebhook, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("team_id", teamId)
	routeURL, err := c.incomingWebhooksRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*IncomingWebhook](r)
}

// GetIncomingWebhook returns an Incoming webhook given the hook ID.
func (c *Client4) GetIncomingWebhook(ctx context.Context, hookID string, etag string) (*IncomingWebhook, *Response, error) {
	route, err := c.incomingWebhookRoute(hookID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*IncomingWebhook](r)
}

// DeleteIncomingWebhook deletes and Incoming Webhook given the hook ID.
func (c *Client4) DeleteIncomingWebhook(ctx context.Context, hookID string) (*Response, error) {
	route, err := c.incomingWebhookRoute(hookID).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// CreateOutgoingWebhook creates an outgoing webhook for a team or channel.
func (c *Client4) CreateOutgoingWebhook(ctx context.Context, hook *OutgoingWebhook) (*OutgoingWebhook, *Response, error) {
	route, err := c.outgoingWebhooksRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, hook)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OutgoingWebhook](r)
}

// UpdateOutgoingWebhook creates an outgoing webhook for a team or channel.
func (c *Client4) UpdateOutgoingWebhook(ctx context.Context, hook *OutgoingWebhook) (*OutgoingWebhook, *Response, error) {
	route, err := c.outgoingWebhookRoute(hook.Id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, hook)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OutgoingWebhook](r)
}

// GetOutgoingWebhooks returns a page of outgoing webhooks on the system. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooks(ctx context.Context, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.outgoingWebhooksRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*OutgoingWebhook](r)
}

// GetOutgoingWebhook outgoing webhooks on the system requested by Hook Id.
func (c *Client4) GetOutgoingWebhook(ctx context.Context, hookId string) (*OutgoingWebhook, *Response, error) {
	route, err := c.outgoingWebhookRoute(hookId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OutgoingWebhook](r)
}

// GetOutgoingWebhooksForChannel returns a page of outgoing webhooks for a channel. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooksForChannel(ctx context.Context, channelId string, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("channel_id", channelId)
	routeURL, err := c.outgoingWebhooksRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*OutgoingWebhook](r)
}

// GetOutgoingWebhooksForTeam returns a page of outgoing webhooks for a team. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooksForTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("team_id", teamId)
	routeURL, err := c.outgoingWebhooksRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*OutgoingWebhook](r)
}

// RegenOutgoingHookToken regenerate the outgoing webhook token.
func (c *Client4) RegenOutgoingHookToken(ctx context.Context, hookId string) (*OutgoingWebhook, *Response, error) {
	route, err := c.outgoingWebhookRoute(hookId).JoinSegment("regen_token").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OutgoingWebhook](r)
}

// DeleteOutgoingWebhook delete the outgoing webhook on the system requested by Hook Id.
func (c *Client4) DeleteOutgoingWebhook(ctx context.Context, hookId string) (*Response, error) {
	route, err := c.outgoingWebhookRoute(hookId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Preferences Section

// GetPreferences returns the user's preferences.
func (c *Client4) GetPreferences(ctx context.Context, userId string) (Preferences, *Response, error) {
	route, err := c.preferencesRoute(userId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[Preferences](r)
}

// UpdatePreferences saves the user's preferences.
func (c *Client4) UpdatePreferences(ctx context.Context, userId string, preferences Preferences) (*Response, error) {
	route, err := c.preferencesRoute(userId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, preferences)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeletePreferences deletes the user's preferences.
func (c *Client4) DeletePreferences(ctx context.Context, userId string, preferences Preferences) (*Response, error) {
	route, err := c.preferencesRoute(userId).JoinSegment("delete").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, preferences)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetPreferencesByCategory returns the user's preferences from the provided category string.
func (c *Client4) GetPreferencesByCategory(ctx context.Context, userId string, category string) (Preferences, *Response, error) {
	url, err := c.preferencesRoute(userId).JoinId(category).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[Preferences](r)
}

// GetPreferenceByCategoryAndName returns the user's preferences from the provided category and preference name string.
func (c *Client4) GetPreferenceByCategoryAndName(ctx context.Context, userId string, category string, preferenceName string) (*Preference, *Response, error) {
	url, err := c.preferencesRoute(userId).JoinSegment(category).JoinSegment("name").JoinSegment(preferenceName).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Preference](r)
}

// SAML Section

// GetSamlMetadata returns metadata for the SAML configuration.
func (c *Client4) GetSamlMetadata(ctx context.Context) (string, *Response, error) {
	route, err := c.samlRoute().JoinSegment("metadata").String()
	if err != nil {
		return "", nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
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

	if err = writer.Close(); err != nil {
		return nil, nil, err
	}

	return body.Bytes(), writer, nil
}

// UploadSamlIdpCertificate will upload an IDP certificate for SAML and set the config to use it.
// The filename parameter is deprecated and ignored: the server will pick a hard-coded filename when writing to disk.
func (c *Client4) UploadSamlIdpCertificate(ctx context.Context, data []byte, filename string) (*Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare SAML IDP certificate for upload: %w", err)
	}

	route, err := c.samlRoute().JoinSegments("certificate", "idp").String()
	if err != nil {
		return nil, err
	}

	_, resp, err := c.DoUploadFile(ctx, route, body, writer.FormDataContentType())
	return resp, err
}

// UploadSamlPublicCertificate will upload a public certificate for SAML and set the config to use it.
// The filename parameter is deprecated and ignored: the server will pick a hard-coded filename when writing to disk.
func (c *Client4) UploadSamlPublicCertificate(ctx context.Context, data []byte, filename string) (*Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare SAML public certificate for upload: %w", err)
	}

	route, err := c.samlRoute().JoinSegments("certificate", "public").String()
	if err != nil {
		return nil, err
	}

	_, resp, err := c.DoUploadFile(ctx, route, body, writer.FormDataContentType())
	return resp, err
}

// UploadSamlPrivateCertificate will upload a private key for SAML and set the config to use it.
// The filename parameter is deprecated and ignored: the server will pick a hard-coded filename when writing to disk.
func (c *Client4) UploadSamlPrivateCertificate(ctx context.Context, data []byte, filename string) (*Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare SAML private certificate for upload: %w", err)
	}

	route, err := c.samlRoute().JoinSegments("certificate", "private").String()
	if err != nil {
		return nil, err
	}

	_, resp, err := c.DoUploadFile(ctx, route, body, writer.FormDataContentType())
	return resp, err
}

// DeleteSamlIdpCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlIdpCertificate(ctx context.Context) (*Response, error) {
	route, err := c.samlRoute().JoinSegments("certificate", "idp").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteSamlPublicCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlPublicCertificate(ctx context.Context) (*Response, error) {
	route, err := c.samlRoute().JoinSegments("certificate", "public").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteSamlPrivateCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlPrivateCertificate(ctx context.Context) (*Response, error) {
	route, err := c.samlRoute().JoinSegments("certificate", "private").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetSamlCertificateStatus returns metadata for the SAML configuration.
func (c *Client4) GetSamlCertificateStatus(ctx context.Context) (*SamlCertificateStatus, *Response, error) {
	route, err := c.samlRoute().JoinSegments("certificate", "status").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*SamlCertificateStatus](r)
}

func (c *Client4) GetSamlMetadataFromIdp(ctx context.Context, samlMetadataURL string) (*SamlMetadataResponse, *Response, error) {
	requestBody := make(map[string]string)
	requestBody["saml_metadata_url"] = samlMetadataURL
	route, err := c.samlRoute().JoinSegment("metadatafromidp").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, requestBody)
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	return DecodeJSONFromResponse[*SamlMetadataResponse](r)
}

// ResetSamlAuthDataToEmail resets the AuthData field of SAML users to their Email.
func (c *Client4) ResetSamlAuthDataToEmail(ctx context.Context, includeDeleted bool, dryRun bool, userIDs []string) (int64, *Response, error) {
	params := map[string]any{
		"include_deleted": includeDeleted,
		"dry_run":         dryRun,
		"user_ids":        userIDs,
	}
	route, err := c.samlRoute().JoinSegment("reset_auth_data").String()
	if err != nil {
		return 0, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, params)
	if err != nil {
		return 0, BuildResponse(r), err
	}
	defer closeBody(r)
	respBody, resp, err := DecodeJSONFromResponse[map[string]int64](r)
	if err != nil {
		return 0, resp, err
	}
	return respBody["num_affected"], resp, nil
}

// Compliance Section

// CreateComplianceReport creates an incoming webhook for a channel.
func (c *Client4) CreateComplianceReport(ctx context.Context, report *Compliance) (*Compliance, *Response, error) {
	route, err := c.complianceReportsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, report)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Compliance](r)
}

// GetComplianceReports returns list of compliance reports.
func (c *Client4) GetComplianceReports(ctx context.Context, page, perPage int) (Compliances, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.complianceReportsRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[Compliances](r)
}

// GetComplianceReport returns a compliance report.
func (c *Client4) GetComplianceReport(ctx context.Context, reportId string) (*Compliance, *Response, error) {
	route, err := c.complianceReportRoute(reportId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Compliance](r)
}

// DownloadComplianceReport returns a full compliance report as a file.
func (c *Client4) DownloadComplianceReport(ctx context.Context, reportId string) ([]byte, *Response, error) {
	route, err := c.complianceReportDownloadRoute(reportId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// Cluster Section

// GetClusterStatus returns the status of all the configured cluster nodes.
func (c *Client4) GetClusterStatus(ctx context.Context) ([]*ClusterInfo, *Response, error) {
	route, err := c.clusterRoute().JoinSegment("status").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*ClusterInfo](r)
}

// LDAP Section

// SyncLdap starts a run of the LDAP sync job.
func (c *Client4) SyncLdap(ctx context.Context) (*Response, error) {
	route, err := c.ldapRoute().JoinSegment("sync").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// TestLdap will attempt to connect to the configured LDAP server and return OK if configured
// correctly.
func (c *Client4) TestLdap(ctx context.Context) (*Response, error) {
	route, err := c.ldapRoute().JoinSegment("test").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetLdapGroups retrieves the immediate child groups of the given parent group.
func (c *Client4) GetLdapGroups(ctx context.Context) ([]*Group, *Response, error) {
	path, err := c.ldapRoute().JoinSegment("groups").String()
	if err != nil {
		return nil, nil, err
	}

	r, err := c.DoAPIGet(ctx, path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData, resp, err := DecodeJSONFromResponse[struct {
		Count  int      `json:"count"`
		Groups []*Group `json:"groups"`
	}](r)
	if err != nil {
		return nil, BuildResponse(r), fmt.Errorf("failed to decode LDAP groups response: %w", err)
	}
	for i := range responseData.Groups {
		responseData.Groups[i].DisplayName = *responseData.Groups[i].Name
	}

	return responseData.Groups, resp, nil
}

// LinkLdapGroup creates or undeletes a Mattermost group and associates it to the given LDAP group DN.
func (c *Client4) LinkLdapGroup(ctx context.Context, dn string) (*Group, *Response, error) {
	path, err := c.ldapRoute().JoinSegment("groups").JoinSegment(dn).JoinSegment("link").String()
	if err != nil {
		return nil, BuildResponse(nil), err
	}

	r, err := c.DoAPIPost(ctx, path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Group](r)
}

// UnlinkLdapGroup deletes the Mattermost group associated with the given LDAP group DN.
func (c *Client4) UnlinkLdapGroup(ctx context.Context, dn string) (*Group, *Response, error) {
	path, err := c.ldapRoute().JoinSegment("groups").JoinSegment(dn).JoinSegment("link").String()
	if err != nil {
		return nil, BuildResponse(nil), err
	}

	r, err := c.DoAPIDelete(ctx, path)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Group](r)
}

// MigrateIdLdap migrates the LDAP enabled users to given attribute
func (c *Client4) MigrateIdLdap(ctx context.Context, toAttribute string) (*Response, error) {
	route, err := c.ldapRoute().JoinSegment("migrateid").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, map[string]string{
		"toAttribute": toAttribute,
	})
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetGroupsByNames(ctx context.Context, names []string) ([]*Group, *Response, error) {
	path, err := c.groupsRoute().JoinSegment("names").String()
	if err != nil {
		return nil, nil, err
	}

	r, err := c.DoAPIPostJSON(ctx, path, names)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Group](r)
}

// GetGroupsByChannel retrieves the Mattermost Groups associated with a given channel
func (c *Client4) GetGroupsByChannel(ctx context.Context, channelId string, opts GroupSearchOpts) ([]*GroupWithSchemeAdmin, int, *Response, error) {
	values := url.Values{}
	values.Set("q", opts.Q)
	values.Set("include_member_count", c.boolString(opts.IncludeMemberCount))
	values.Set("filter_allow_reference", c.boolString(opts.FilterAllowReference))
	if opts.PageOpts != nil {
		values.Set("page", strconv.Itoa(opts.PageOpts.Page))
		values.Set("per_page", strconv.Itoa(opts.PageOpts.PerPage))
	}
	pathURL, err := c.channelRoute(channelId).JoinSegment("groups").URL()
	if err != nil {
		return nil, 0, nil, err
	}
	pathURL.RawQuery = values.Encode()
	path := pathURL.String()
	r, err := c.DoAPIGet(ctx, path, "")
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData, resp, err := DecodeJSONFromResponse[struct {
		Groups []*GroupWithSchemeAdmin `json:"groups"`
		Count  int                     `json:"total_group_count"`
	}](r)
	if err != nil {
		return nil, 0, BuildResponse(r), fmt.Errorf("failed to decode groups by channel response: %w", err)
	}

	return responseData.Groups, responseData.Count, resp, nil
}

// GetGroupsByTeam retrieves the Mattermost Groups associated with a given team
func (c *Client4) GetGroupsByTeam(ctx context.Context, teamId string, opts GroupSearchOpts) ([]*GroupWithSchemeAdmin, int, *Response, error) {
	values := url.Values{}
	values.Set("q", opts.Q)
	values.Set("include_member_count", c.boolString(opts.IncludeMemberCount))
	values.Set("filter_allow_reference", c.boolString(opts.FilterAllowReference))
	if opts.PageOpts != nil {
		values.Set("page", strconv.Itoa(opts.PageOpts.Page))
		values.Set("per_page", strconv.Itoa(opts.PageOpts.PerPage))
	}
	pathURL, err := c.teamRoute(teamId).JoinSegment("groups").URL()
	if err != nil {
		return nil, 0, nil, err
	}
	pathURL.RawQuery = values.Encode()
	path := pathURL.String()

	r, err := c.DoAPIGet(ctx, path, "")
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData, resp, err := DecodeJSONFromResponse[struct {
		Groups []*GroupWithSchemeAdmin `json:"groups"`
		Count  int                     `json:"total_group_count"`
	}](r)
	if err != nil {
		return nil, 0, BuildResponse(r), fmt.Errorf("failed to decode groups by team response: %w", err)
	}

	return responseData.Groups, responseData.Count, resp, nil
}

// GetGroupsAssociatedToChannelsByTeam retrieves the Mattermost Groups associated with channels in a given team
func (c *Client4) GetGroupsAssociatedToChannelsByTeam(ctx context.Context, teamId string, opts GroupSearchOpts) (map[string][]*GroupWithSchemeAdmin, *Response, error) {
	values := url.Values{}
	values.Set("q", opts.Q)
	values.Set("filter_allow_reference", c.boolString(opts.FilterAllowReference))
	if opts.PageOpts != nil {
		values.Set("page", strconv.Itoa(opts.PageOpts.Page))
		values.Set("per_page", strconv.Itoa(opts.PageOpts.PerPage))
	}
	pathURL, err := c.teamRoute(teamId).JoinSegment("groups_by_channels").URL()
	if err != nil {
		return nil, nil, err
	}
	pathURL.RawQuery = values.Encode()
	path := pathURL.String()
	r, err := c.DoAPIGet(ctx, path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	responseData, resp, err := DecodeJSONFromResponse[struct {
		GroupsAssociatedToChannels map[string][]*GroupWithSchemeAdmin `json:"groups"`
	}](r)
	if err != nil {
		return nil, BuildResponse(r), fmt.Errorf("failed to decode groups associated to channels by team response: %w", err)
	}

	return responseData.GroupsAssociatedToChannels, resp, nil
}

// GetGroups retrieves Mattermost Groups
func (c *Client4) GetGroups(ctx context.Context, opts GroupSearchOpts) ([]*Group, *Response, error) {
	routeURL, err := c.groupsRoute().URL()
	if err != nil {
		return nil, BuildResponse(nil), err
	}
	values := url.Values{}
	values.Set("include_member_count", fmt.Sprintf("%v", opts.IncludeMemberCount))
	values.Set("not_associated_to_team", opts.NotAssociatedToTeam)
	values.Set("not_associated_to_channel", opts.NotAssociatedToChannel)
	values.Set("filter_allow_reference", fmt.Sprintf("%v", opts.FilterAllowReference))
	values.Set("q", opts.Q)
	values.Set("filter_parent_team_permitted", fmt.Sprintf("%v", opts.FilterParentTeamPermitted))
	values.Set("group_source", string(opts.Source))
	values.Set("include_channel_member_count", opts.IncludeChannelMemberCount)
	values.Set("include_timezones", fmt.Sprintf("%v", opts.IncludeTimezones))
	values.Set("include_archived", fmt.Sprintf("%v", opts.IncludeArchived))
	values.Set("filter_archived", fmt.Sprintf("%v", opts.FilterArchived))
	values.Set("only_syncable_sources", fmt.Sprintf("%v", opts.OnlySyncableSources))
	if opts.Since > 0 {
		values.Set("since", fmt.Sprintf("%v", opts.Since))
	}
	if opts.PageOpts != nil {
		values.Set("page", fmt.Sprintf("%v", opts.PageOpts.Page))
		values.Set("per_page", fmt.Sprintf("%v", opts.PageOpts.PerPage))
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Group](r)
}

// GetGroupsByUserId retrieves Mattermost Groups for a user
func (c *Client4) GetGroupsByUserId(ctx context.Context, userId string) ([]*Group, *Response, error) {
	path, err := c.usersRoute().JoinId(userId).JoinSegment("groups").String()
	if err != nil {
		return nil, BuildResponse(nil), err
	}

	r, err := c.DoAPIGet(ctx, path, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Group](r)
}

func (c *Client4) MigrateAuthToLdap(ctx context.Context, fromAuthService string, matchField string, force bool) (*Response, error) {
	route, err := c.usersRoute().JoinSegments("migrate_auth", "ldap").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, map[string]any{
		"from":        fromAuthService,
		"force":       force,
		"match_field": matchField,
	})
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) MigrateAuthToSaml(ctx context.Context, fromAuthService string, usersMap map[string]string, auto bool) (*Response, error) {
	route, err := c.usersRoute().JoinSegments("migrate_auth", "saml").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, map[string]any{
		"from":    fromAuthService,
		"auto":    auto,
		"matches": usersMap,
	})
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UploadLdapPublicCertificate will upload a public certificate for LDAP and set the config to use it.
func (c *Client4) UploadLdapPublicCertificate(ctx context.Context, data []byte) (*Response, error) {
	body, writer, err := fileToMultipart(data, LdapPublicCertificateName)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare LDAP public certificate for upload: %w", err)
	}

	route, err := c.ldapRoute().JoinSegments("certificate", "public").String()
	if err != nil {
		return nil, err
	}

	_, resp, err := c.DoUploadFile(ctx, route, body, writer.FormDataContentType())
	return resp, err
}

// UploadLdapPrivateCertificate will upload a private key for LDAP and set the config to use it.
func (c *Client4) UploadLdapPrivateCertificate(ctx context.Context, data []byte) (*Response, error) {
	body, writer, err := fileToMultipart(data, LdapPrivateKeyName)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare LDAP private certificate for upload: %w", err)
	}

	route, err := c.ldapRoute().JoinSegments("certificate", "private").String()
	if err != nil {
		return nil, err
	}

	_, resp, err := c.DoUploadFile(ctx, route, body, writer.FormDataContentType())
	return resp, err
}

// DeleteLdapPublicCertificate deletes the LDAP IDP certificate from the server and updates the config to not use it and disable LDAP.
func (c *Client4) DeleteLdapPublicCertificate(ctx context.Context) (*Response, error) {
	route, err := c.ldapRoute().JoinSegments("certificate", "public").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteLDAPPrivateCertificate deletes the LDAP IDP certificate from the server and updates the config to not use it and disable LDAP.
func (c *Client4) DeleteLdapPrivateCertificate(ctx context.Context) (*Response, error) {
	route, err := c.ldapRoute().JoinSegments("certificate", "private").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Audits Section

// GetAudits returns a list of audits for the whole system.
func (c *Client4) GetAudits(ctx context.Context, page int, perPage int, etag string) (Audits, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	r, err := c.DoAPIGet(ctx, "/audits?"+values.Encode(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[Audits](r)
}

// Brand Section

// GetBrandImage retrieves the previously uploaded brand image.
func (c *Client4) GetBrandImage(ctx context.Context) ([]byte, *Response, error) {
	route, err := c.brandRoute().JoinSegment("image").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	if r.StatusCode >= 300 {
		return nil, BuildResponse(r), AppErrorFromJSON(r.Body)
	}

	return ReadBytesFromResponse(r)
}

// DeleteBrandImage deletes the brand image for the system.
func (c *Client4) DeleteBrandImage(ctx context.Context) (*Response, error) {
	route, err := c.brandRoute().JoinSegment("image").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	return BuildResponse(r), nil
}

// UploadBrandImage sets the brand image for the system.
func (c *Client4) UploadBrandImage(ctx context.Context, data []byte) (*Response, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", "brand.png")
	if err != nil {
		return nil, fmt.Errorf("failed to create form file for brand image upload: %w", err)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, fmt.Errorf("failed to copy brand image data to form file: %w", err)
	}

	if err = writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer for brand image upload: %w", err)
	}

	route, err := c.brandRoute().JoinSegment("image").String()
	if err != nil {
		return nil, err
	}
	r, err := c.doAPIRequestReader(ctx, http.MethodPost, c.APIURL+route, writer.FormDataContentType(), body, nil)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Logs Section

// GetLogs page of logs as a string array.
func (c *Client4) GetLogs(ctx context.Context, page, perPage int) ([]string, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("logs_per_page", strconv.Itoa(perPage))
	r, err := c.DoAPIGet(ctx, "/logs?"+values.Encode(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]string](r)
}

// Download logs as mattermost.log file
func (c *Client4) DownloadLogs(ctx context.Context) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, "/logs/download", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	return ReadBytesFromResponse(r)
}

// PostLog is a convenience Web Service call so clients can log messages into
// the server-side logs. For example we typically log javascript error messages
// into the server-side. It returns the log message if the logging was successful.
func (c *Client4) PostLog(ctx context.Context, message map[string]string) (map[string]string, *Response, error) {
	r, err := c.DoAPIPostJSON(ctx, "/logs", message)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]string](r)
}

// OAuth Section

// CreateOAuthApp will register a new OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) CreateOAuthApp(ctx context.Context, app *OAuthApp) (*OAuthApp, *Response, error) {
	route, err := c.oAuthAppsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, app)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OAuthApp](r)
}

// UpdateOAuthApp updates a page of registered OAuth 2.0 client applications with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) UpdateOAuthApp(ctx context.Context, app *OAuthApp) (*OAuthApp, *Response, error) {
	route, err := c.oAuthAppRoute(app.Id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, app)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OAuthApp](r)
}

// GetOAuthApps gets a page of registered OAuth 2.0 client applications with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthApps(ctx context.Context, page, perPage int) ([]*OAuthApp, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.oAuthAppsRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*OAuthApp](r)
}

// GetOAuthApp gets a registered OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthApp(ctx context.Context, appId string) (*OAuthApp, *Response, error) {
	route, err := c.oAuthAppRoute(appId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OAuthApp](r)
}

// GetOAuthAppInfo gets a sanitized version of a registered OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthAppInfo(ctx context.Context, appId string) (*OAuthApp, *Response, error) {
	route, err := c.oAuthAppRoute(appId).JoinSegment("info").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OAuthApp](r)
}

// DeleteOAuthApp deletes a registered OAuth 2.0 client application.
func (c *Client4) DeleteOAuthApp(ctx context.Context, appId string) (*Response, error) {
	route, err := c.oAuthAppRoute(appId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RegenerateOAuthAppSecret regenerates the client secret for a registered OAuth 2.0 client application.
func (c *Client4) RegenerateOAuthAppSecret(ctx context.Context, appId string) (*OAuthApp, *Response, error) {
	route, err := c.oAuthAppRoute(appId).JoinSegment("regen_secret").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OAuthApp](r)
}

// RegisterOAuthClient registers a new OAuth 2.0 client using Dynamic Client Registration (DCR).
func (c *Client4) RegisterOAuthClient(ctx context.Context, request *ClientRegistrationRequest) (*ClientRegistrationResponse, *Response, error) {
	route, err := c.oAuthRegisterRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, request)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var response ClientRegistrationResponse
	if err := json.NewDecoder(r.Body).Decode(&response); err != nil {
		return nil, nil, NewAppError("RegisterOAuthClient", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &response, BuildResponse(r), nil
}

// GetAuthorizedOAuthAppsForUser gets a page of OAuth 2.0 client applications the user has authorized to use access their account.
func (c *Client4) GetAuthorizedOAuthAppsForUser(ctx context.Context, userId string, page, perPage int) ([]*OAuthApp, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.userRoute(userId).JoinSegments("oauth", "apps", "authorized").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*OAuthApp](r)
}

// AuthorizeOAuthApp will authorize an OAuth 2.0 client application to access a user's account and provide a redirect link to follow.
func (c *Client4) AuthorizeOAuthApp(ctx context.Context, authRequest *AuthorizeRequest) (string, *Response, error) {
	buf, err := json.Marshal(authRequest)
	if err != nil {
		return "", nil, err
	}
	// The request doesn't go to the /api/v4 subpath, so we can't use the usual helper methods
	r, err := c.doAPIRequestBytes(ctx, http.MethodPost, c.URL+"/oauth/authorize", buf, "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)

	result, resp, err := DecodeJSONFromResponse[map[string]string](r)
	if err != nil {
		return "", resp, err
	}
	return result["redirect"], resp, nil
}

// DeauthorizeOAuthApp will deauthorize an OAuth 2.0 client application from accessing a user's account.
func (c *Client4) DeauthorizeOAuthApp(ctx context.Context, appId string) (*Response, error) {
	requestData := map[string]string{"client_id": appId}
	buf, err := json.Marshal(requestData)
	if err != nil {
		return nil, err
	}
	// The request doesn't go to the /api/v4 subpath, so we can't use the usual helper methods
	r, err := c.doAPIRequestBytes(ctx, http.MethodPost, c.URL+"/oauth/deauthorize", buf, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetOAuthAccessToken is a test helper function for the OAuth access token endpoint.
func (c *Client4) GetOAuthAccessToken(ctx context.Context, data url.Values) (*AccessResponse, *Response, error) {
	// The request doesn't go to the /api/v4 subpath, so we can't use the usual helper methods
	r, err := c.doAPIRequestReader(ctx, http.MethodPost, c.URL+"/oauth/access_token", "application/x-www-form-urlencoded", strings.NewReader(data.Encode()), nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	return DecodeJSONFromResponse[*AccessResponse](r)
}

// OutgoingOAuthConnection section

// GetOutgoingOAuthConnections retrieves the outgoing OAuth connections.
func (c *Client4) GetOutgoingOAuthConnections(ctx context.Context, filters OutgoingOAuthConnectionGetConnectionsFilter) ([]*OutgoingOAuthConnection, *Response, error) {
	routeURL, err := c.outgoingOAuthConnectionsRoute().URL()
	if err != nil {
		return nil, nil, err
	}

	routeURL.RawQuery = filters.ToURLValues().Encode()

	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*OutgoingOAuthConnection](r)
}

// GetOutgoingOAuthConnection retrieves the outgoing OAuth connection with the given ID.
func (c *Client4) GetOutgoingOAuthConnection(ctx context.Context, id string) (*OutgoingOAuthConnection, *Response, error) {
	route, err := c.outgoingOAuthConnectionRoute(id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OutgoingOAuthConnection](r)
}

// DeleteOutgoingOAuthConnection deletes the outgoing OAuth connection with the given ID.
func (c *Client4) DeleteOutgoingOAuthConnection(ctx context.Context, id string) (*Response, error) {
	route, err := c.outgoingOAuthConnectionRoute(id).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateOutgoingOAuthConnection updates the outgoing OAuth connection with the given ID.
func (c *Client4) UpdateOutgoingOAuthConnection(ctx context.Context, connection *OutgoingOAuthConnection) (*OutgoingOAuthConnection, *Response, error) {
	route, err := c.outgoingOAuthConnectionRoute(connection.Id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, connection)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OutgoingOAuthConnection](r)
}

// CreateOutgoingOAuthConnection creates a new outgoing OAuth connection.
func (c *Client4) CreateOutgoingOAuthConnection(ctx context.Context, connection *OutgoingOAuthConnection) (*OutgoingOAuthConnection, *Response, error) {
	route, err := c.outgoingOAuthConnectionsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, connection)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*OutgoingOAuthConnection](r)
}

// Elasticsearch Section

// TestElasticsearch will attempt to connect to the configured Elasticsearch server and return OK if configured.
// correctly.
func (c *Client4) TestElasticsearch(ctx context.Context) (*Response, error) {
	route, err := c.elasticsearchRoute().JoinSegment("test").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PurgeElasticsearchIndexes immediately deletes all Elasticsearch indexes.
func (c *Client4) PurgeElasticsearchIndexes(ctx context.Context) (*Response, error) {
	route, err := c.elasticsearchRoute().JoinSegment("purge_indexes").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Data Retention Section

// GetDataRetentionPolicy will get the current global data retention policy details.
func (c *Client4) GetDataRetentionPolicy(ctx context.Context) (*GlobalRetentionPolicy, *Response, error) {
	route, err := c.dataRetentionRoute().JoinSegment("policy").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*GlobalRetentionPolicy](r)
}

// GetDataRetentionPolicyByID will get the details for the granular data retention policy with the specified ID.
func (c *Client4) GetDataRetentionPolicyByID(ctx context.Context, policyID string) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	route, err := c.dataRetentionPolicyRoute(policyID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*RetentionPolicyWithTeamAndChannelCounts](r)
}

// GetDataRetentionPoliciesCount will get the total number of granular data retention policies.
func (c *Client4) GetDataRetentionPoliciesCount(ctx context.Context) (int64, *Response, error) {
	type CountBody struct {
		TotalCount int64 `json:"total_count"`
	}
	route, err := c.dataRetentionRoute().JoinSegment("policies_count").String()
	if err != nil {
		return 0, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return 0, BuildResponse(r), err
	}
	countObj, resp, err := DecodeJSONFromResponse[CountBody](r)
	if err != nil {
		return 0, resp, err
	}
	return countObj.TotalCount, resp, nil
}

// GetDataRetentionPolicies will get the current granular data retention policies' details.
func (c *Client4) GetDataRetentionPolicies(ctx context.Context, page, perPage int) (*RetentionPolicyWithTeamAndChannelCountsList, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.dataRetentionRoute().JoinSegment("policies").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*RetentionPolicyWithTeamAndChannelCountsList](r)
}

// CreateDataRetentionPolicy will create a new granular data retention policy which will be applied to
// the specified teams and channels. The Id field of `policy` must be empty.
func (c *Client4) CreateDataRetentionPolicy(ctx context.Context, policy *RetentionPolicyWithTeamAndChannelIDs) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	route, err := c.dataRetentionRoute().JoinSegment("policies").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, policy)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*RetentionPolicyWithTeamAndChannelCounts](r)
}

// DeleteDataRetentionPolicy will delete the granular data retention policy with the specified ID.
func (c *Client4) DeleteDataRetentionPolicy(ctx context.Context, policyID string) (*Response, error) {
	route, err := c.dataRetentionPolicyRoute(policyID).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PatchDataRetentionPolicy will patch the granular data retention policy with the specified ID.
// The Id field of `patch` must be non-empty.
func (c *Client4) PatchDataRetentionPolicy(ctx context.Context, patch *RetentionPolicyWithTeamAndChannelIDs) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	route, err := c.dataRetentionPolicyRoute(patch.ID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPatchJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*RetentionPolicyWithTeamAndChannelCounts](r)
}

// GetTeamsForRetentionPolicy will get the teams to which the specified policy is currently applied.
func (c *Client4) GetTeamsForRetentionPolicy(ctx context.Context, policyID string, page, perPage int) (*TeamsWithCount, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.dataRetentionPolicyRoute(policyID).JoinSegment("teams").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	return DecodeJSONFromResponse[*TeamsWithCount](r)
}

// SearchTeamsForRetentionPolicy will search the teams to which the specified policy is currently applied.
func (c *Client4) SearchTeamsForRetentionPolicy(ctx context.Context, policyID string, term string) ([]*Team, *Response, error) {
	route, err := c.dataRetentionPolicyRoute(policyID).JoinSegments("teams", "search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, map[string]any{"term": term})
	if err != nil {
		return nil, BuildResponse(r), err
	}
	return DecodeJSONFromResponse[[]*Team](r)
}

// AddTeamsToRetentionPolicy will add the specified teams to the granular data retention policy
// with the specified ID.
func (c *Client4) AddTeamsToRetentionPolicy(ctx context.Context, policyID string, teamIDs []string) (*Response, error) {
	route, err := c.dataRetentionPolicyRoute(policyID).JoinSegment("teams").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, teamIDs)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveTeamsFromRetentionPolicy will remove the specified teams from the granular data retention policy
// with the specified ID.
func (c *Client4) RemoveTeamsFromRetentionPolicy(ctx context.Context, policyID string, teamIDs []string) (*Response, error) {
	route, err := c.dataRetentionPolicyRoute(policyID).JoinSegment("teams").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDeleteJSON(ctx, route, teamIDs)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetChannelsForRetentionPolicy will get the channels to which the specified policy is currently applied.
func (c *Client4) GetChannelsForRetentionPolicy(ctx context.Context, policyID string, page, perPage int) (*ChannelsWithCount, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.dataRetentionPolicyRoute(policyID).JoinSegment("channels").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	return DecodeJSONFromResponse[*ChannelsWithCount](r)
}

// SearchChannelsForRetentionPolicy will search the channels to which the specified policy is currently applied.
func (c *Client4) SearchChannelsForRetentionPolicy(ctx context.Context, policyID string, term string) (ChannelListWithTeamData, *Response, error) {
	route, err := c.dataRetentionPolicyRoute(policyID).JoinSegments("channels", "search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, map[string]any{"term": term})
	if err != nil {
		return nil, BuildResponse(r), err
	}
	return DecodeJSONFromResponse[ChannelListWithTeamData](r)
}

// AddChannelsToRetentionPolicy will add the specified channels to the granular data retention policy
// with the specified ID.
func (c *Client4) AddChannelsToRetentionPolicy(ctx context.Context, policyID string, channelIDs []string) (*Response, error) {
	route, err := c.dataRetentionPolicyRoute(policyID).JoinSegment("channels").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, channelIDs)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveChannelsFromRetentionPolicy will remove the specified channels from the granular data retention policy
// with the specified ID.
func (c *Client4) RemoveChannelsFromRetentionPolicy(ctx context.Context, policyID string, channelIDs []string) (*Response, error) {
	route, err := c.dataRetentionPolicyRoute(policyID).JoinSegment("channels").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDeleteJSON(ctx, route, channelIDs)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTeamPoliciesForUser will get the data retention policies for the teams to which a user belongs.
func (c *Client4) GetTeamPoliciesForUser(ctx context.Context, userID string, offset, limit int) (*RetentionPolicyForTeamList, *Response, error) {
	route, err := c.userRoute(userID).JoinSegments("data_retention", "team_policies").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	return DecodeJSONFromResponse[*RetentionPolicyForTeamList](r)
}

// GetChannelPoliciesForUser will get the data retention policies for the channels to which a user belongs.
func (c *Client4) GetChannelPoliciesForUser(ctx context.Context, userID string, offset, limit int) (*RetentionPolicyForChannelList, *Response, error) {
	route, err := c.userRoute(userID).JoinSegments("data_retention", "channel_policies").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	return DecodeJSONFromResponse[*RetentionPolicyForChannelList](r)
}

// Drafts Sections

// UpsertDraft will create a new draft or update a draft if it already exists
func (c *Client4) UpsertDraft(ctx context.Context, draft *Draft) (*Draft, *Response, error) {
	route, err := c.draftsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, draft)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Draft](r)
}

// GetDrafts will get all drafts for a user
func (c *Client4) GetDrafts(ctx context.Context, userId, teamId string) ([]*Draft, *Response, error) {
	route, err := c.userRoute(userId).JoinRoute(c.teamRoute(teamId)).JoinSegment("drafts").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Draft](r)
}

func (c *Client4) DeleteDraft(ctx context.Context, userId, channelId, rootId string) (*Draft, *Response, error) {
	route, err := c.userRoute(userId).JoinRoute(c.channelRoute(channelId)).JoinSegment("drafts").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Draft](r)
}

// Commands Section

// CreateCommand will create a new command if the user have the right permissions.
func (c *Client4) CreateCommand(ctx context.Context, cmd *Command) (*Command, *Response, error) {
	route, err := c.commandsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, cmd)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Command](r)
}

// UpdateCommand updates a command based on the provided Command struct.
func (c *Client4) UpdateCommand(ctx context.Context, cmd *Command) (*Command, *Response, error) {
	route, err := c.commandRoute(cmd.Id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, cmd)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Command](r)
}

// MoveCommand moves a command to a different team.
func (c *Client4) MoveCommand(ctx context.Context, teamId string, commandId string) (*Response, error) {
	cmr := CommandMoveRequest{TeamId: teamId}
	route, err := c.commandMoveRoute(commandId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, cmr)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteCommand deletes a command based on the provided command id string.
func (c *Client4) DeleteCommand(ctx context.Context, commandId string) (*Response, error) {
	route, err := c.commandRoute(commandId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ListCommands will retrieve a list of commands available in the team.
func (c *Client4) ListCommands(ctx context.Context, teamId string, customOnly bool) ([]*Command, *Response, error) {
	values := url.Values{}
	values.Set("team_id", teamId)
	values.Set("custom_only", c.boolString(customOnly))
	routeURL, err := c.commandsRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Command](r)
}

// ListCommandAutocompleteSuggestions will retrieve a list of suggestions for a userInput.
func (c *Client4) ListCommandAutocompleteSuggestions(ctx context.Context, userInput, teamId string) ([]AutocompleteSuggestion, *Response, error) {
	values := url.Values{}
	values.Set("user_input", userInput)
	routeURL, err := c.teamRoute(teamId).JoinSegments("commands", "autocomplete_suggestions").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]AutocompleteSuggestion](r)
}

// GetCommandById will retrieve a command by id.
func (c *Client4) GetCommandById(ctx context.Context, cmdId string) (*Command, *Response, error) {
	url, err := c.commandsRoute().JoinId(cmdId).String()
	if err != nil {
		return nil, BuildResponse(nil), err
	}
	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Command](r)
}

// ExecuteCommand executes a given slash command.
func (c *Client4) ExecuteCommand(ctx context.Context, channelId, command string) (*CommandResponse, *Response, error) {
	commandArgs := &CommandArgs{
		ChannelId: channelId,
		Command:   command,
	}
	route, err := c.commandsRoute().JoinSegment("execute").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, commandArgs)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	response, err := CommandResponseFromJSON(r.Body)
	if err != nil {
		return nil, BuildResponse(r), fmt.Errorf("failed to decode command response: %w", err)
	}
	return response, BuildResponse(r), nil
}

// ExecuteCommandWithTeam executes a given slash command against the specified team.
// Use this when executing slash commands in a DM/GM, since the team id cannot be inferred in that case.
func (c *Client4) ExecuteCommandWithTeam(ctx context.Context, channelId, teamId, command string) (*CommandResponse, *Response, error) {
	commandArgs := &CommandArgs{
		ChannelId: channelId,
		TeamId:    teamId,
		Command:   command,
	}
	route, err := c.commandsRoute().JoinSegment("execute").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, commandArgs)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	response, err := CommandResponseFromJSON(r.Body)
	if err != nil {
		return nil, BuildResponse(r), fmt.Errorf("failed to decode command response: %w", err)
	}
	return response, BuildResponse(r), nil
}

// ListAutocompleteCommands will retrieve a list of commands available in the team.
func (c *Client4) ListAutocompleteCommands(ctx context.Context, teamId string) ([]*Command, *Response, error) {
	route, err := c.teamAutoCompleteCommandsRoute(teamId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Command](r)
}

// RegenCommandToken will create a new token if the user have the right permissions.
func (c *Client4) RegenCommandToken(ctx context.Context, commandId string) (string, *Response, error) {
	route, err := c.commandRoute(commandId).JoinSegment("regen_token").String()
	if err != nil {
		return "", nil, err
	}
	r, err := c.DoAPIPut(ctx, route, "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	result, resp, err := DecodeJSONFromResponse[map[string]string](r)
	if err != nil {
		return "", resp, err
	}
	return result["token"], resp, nil
}

// Status Section

// GetUserStatus returns a user based on the provided user id string.
func (c *Client4) GetUserStatus(ctx context.Context, userId, etag string) (*Status, *Response, error) {
	route, err := c.userStatusRoute(userId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Status](r)
}

// GetUsersStatusesByIds returns a list of users status based on the provided user ids.
func (c *Client4) GetUsersStatusesByIds(ctx context.Context, userIds []string) ([]*Status, *Response, error) {
	route, err := c.userStatusesRoute().JoinSegment("ids").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, userIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Status](r)
}

// UpdateUserStatus sets a user's status based on the provided user id string.
func (c *Client4) UpdateUserStatus(ctx context.Context, userId string, userStatus *Status) (*Status, *Response, error) {
	route, err := c.userStatusRoute(userId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, userStatus)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Status](r)
}

// UpdateUserCustomStatus sets a user's custom status based on the provided user id string.
// The returned CustomStatus object is the same as the one passed, and it should be just
// ignored. It's only kept to maintain compatibility.
func (c *Client4) UpdateUserCustomStatus(ctx context.Context, userId string, userCustomStatus *CustomStatus) (*CustomStatus, *Response, error) {
	route, err := c.userStatusRoute(userId).JoinSegment("custom").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, userCustomStatus)
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
func (c *Client4) RemoveUserCustomStatus(ctx context.Context, userId string) (*Response, error) {
	route, err := c.userStatusRoute(userId).JoinSegment("custom").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveRecentUserCustomStatus remove a recent user's custom status based on the provided user id string.
func (c *Client4) RemoveRecentUserCustomStatus(ctx context.Context, userId string) (*Response, error) {
	route, err := c.userStatusRoute(userId).JoinSegments("custom", "recent").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
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
func (c *Client4) CreateEmoji(ctx context.Context, emoji *Emoji, image []byte, filename string) (*Emoji, *Response, error) {
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
		return nil, nil, fmt.Errorf("failed to marshal emoji data: %w", err)
	}

	if err = writer.WriteField("emoji", string(emojiJSON)); err != nil {
		return nil, nil, err
	}

	if err = writer.Close(); err != nil {
		return nil, nil, err
	}

	route, err := c.emojisRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.doAPIRequestReader(ctx, http.MethodPost, c.APIURL+route, writer.FormDataContentType(), body, nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Emoji](r)
}

// GetEmojiList returns a page of custom emoji on the system.
func (c *Client4) GetEmojiList(ctx context.Context, page, perPage int) ([]*Emoji, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.emojisRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Emoji](r)
}

// GetSortedEmojiList returns a page of custom emoji on the system sorted based on the sort
// parameter, blank for no sorting and "name" to sort by emoji names.
func (c *Client4) GetSortedEmojiList(ctx context.Context, page, perPage int, sort string) ([]*Emoji, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("sort", sort)
	routeURL, err := c.emojisRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Emoji](r)
}

// GetEmojisByNames takes an array of custom emoji names and returns an array of those emojis.
func (c *Client4) GetEmojisByNames(ctx context.Context, names []string) ([]*Emoji, *Response, error) {
	route, err := c.emojisRoute().JoinSegment("names").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, names)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Emoji](r)
}

// DeleteEmoji delete an custom emoji on the provided emoji id string.
func (c *Client4) DeleteEmoji(ctx context.Context, emojiId string) (*Response, error) {
	route, err := c.emojiRoute(emojiId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetEmoji returns a custom emoji based on the emojiId string.
func (c *Client4) GetEmoji(ctx context.Context, emojiId string) (*Emoji, *Response, error) {
	route, err := c.emojiRoute(emojiId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Emoji](r)
}

// GetEmojiByName returns a custom emoji based on the name string.
func (c *Client4) GetEmojiByName(ctx context.Context, name string) (*Emoji, *Response, error) {
	route, err := c.emojiByNameRoute(name).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Emoji](r)
}

// GetEmojiImage returns the emoji image.
func (c *Client4) GetEmojiImage(ctx context.Context, emojiId string) ([]byte, *Response, error) {
	route, err := c.emojiRoute(emojiId).JoinSegment("image").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// SearchEmoji returns a list of emoji matching some search criteria.
func (c *Client4) SearchEmoji(ctx context.Context, search *EmojiSearch) ([]*Emoji, *Response, error) {
	route, err := c.emojisRoute().JoinSegment("search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, search)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Emoji](r)
}

// AutocompleteEmoji returns a list of emoji starting with or matching name.
func (c *Client4) AutocompleteEmoji(ctx context.Context, name string, etag string) ([]*Emoji, *Response, error) {
	values := url.Values{}
	values.Set("name", name)
	routeURL, err := c.emojisRoute().JoinSegment("autocomplete").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Emoji](r)
}

// Reaction Section

// SaveReaction saves an emoji reaction for a post. Returns the saved reaction if successful, otherwise an error will be returned.
func (c *Client4) SaveReaction(ctx context.Context, reaction *Reaction) (*Reaction, *Response, error) {
	route, err := c.reactionsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, reaction)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Reaction](r)
}

// GetReactions returns a list of reactions to a post.
func (c *Client4) GetReactions(ctx context.Context, postId string) ([]*Reaction, *Response, error) {
	route, err := c.postRoute(postId).JoinSegment("reactions").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Reaction](r)
}

// DeleteReaction deletes reaction of a user in a post.
func (c *Client4) DeleteReaction(ctx context.Context, reaction *Reaction) (*Response, error) {
	route, err := c.userRoute(reaction.UserId).JoinRoute(c.postRoute(reaction.PostId)).JoinSegment("reactions").JoinEmojiname(reaction.EmojiName).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// FetchBulkReactions returns a map of postIds and corresponding reactions
func (c *Client4) GetBulkReactions(ctx context.Context, postIds []string) (map[string][]*Reaction, *Response, error) {
	route, err := c.postsRoute().JoinSegments("ids", "reactions").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, postIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string][]*Reaction](r)
}

// Timezone Section

// GetSupportedTimezone returns a page of supported timezones on the system.
func (c *Client4) GetSupportedTimezone(ctx context.Context) ([]string, *Response, error) {
	route, err := c.timezonesRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]string](r)
}

// Jobs Section

// GetJob gets a single job.
func (c *Client4) GetJob(ctx context.Context, id string) (*Job, *Response, error) {
	route, err := c.jobsRoute().JoinId(id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Job](r)
}

// GetJobs gets all jobs, sorted with the job that was created most recently first.
func (c *Client4) GetJobs(ctx context.Context, jobType string, status string, page int, perPage int) ([]*Job, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	values.Set("job_type", jobType)
	values.Set("status", status)
	routeURL, err := c.jobsRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Job](r)
}

// GetJobsByType gets all jobs of a given type, sorted with the job that was created most recently first.
func (c *Client4) GetJobsByType(ctx context.Context, jobType string, page int, perPage int) ([]*Job, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.jobsRoute().JoinSegment("type").JoinId(jobType).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Job](r)
}

// CreateJob creates a job based on the provided job struct.
func (c *Client4) CreateJob(ctx context.Context, job *Job) (*Job, *Response, error) {
	route, err := c.jobsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, job)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Job](r)
}

// CancelJob requests the cancellation of the job with the provided Id.
func (c *Client4) CancelJob(ctx context.Context, jobId string) (*Response, error) {
	route, err := c.jobsRoute().JoinId(jobId).JoinSegment("cancel").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DownloadJob downloads the results of the job
func (c *Client4) DownloadJob(ctx context.Context, jobId string) ([]byte, *Response, error) {
	route, err := c.jobsRoute().JoinId(jobId).JoinSegment("download").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return ReadBytesFromResponse(r)
}

// UpdateJobStatus updates the status of a job
func (c *Client4) UpdateJobStatus(ctx context.Context, jobId string, status string, force bool) (*Response, error) {
	route, err := c.jobsRoute().JoinId(jobId).JoinSegment("status").String()
	if err != nil {
		return nil, err
	}
	data := map[string]any{
		"status": status,
		"force":  force,
	}
	r, err := c.DoAPIPatchJSON(ctx, route, data)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Roles Section

// GetAllRoles returns a list of all the roles.
func (c *Client4) GetAllRoles(ctx context.Context) ([]*Role, *Response, error) {
	route, err := c.rolesRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Role](r)
}

// GetRole gets a single role by ID.
func (c *Client4) GetRole(ctx context.Context, id string) (*Role, *Response, error) {
	route, err := c.rolesRoute().JoinId(id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Role](r)
}

// GetRoleByName gets a single role by Name.
func (c *Client4) GetRoleByName(ctx context.Context, name string) (*Role, *Response, error) {
	route, err := c.rolesRoute().JoinSegment("name").JoinSegment(name).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Role](r)
}

// GetRolesByNames returns a list of roles based on the provided role names.
func (c *Client4) GetRolesByNames(ctx context.Context, roleNames []string) ([]*Role, *Response, error) {
	route, err := c.rolesRoute().JoinSegment("names").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, roleNames)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Role](r)
}

// PatchRole partially updates a role in the system. Any missing fields are not updated.
func (c *Client4) PatchRole(ctx context.Context, roleId string, patch *RolePatch) (*Role, *Response, error) {
	route, err := c.rolesRoute().JoinId(roleId).JoinSegment("patch").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Role](r)
}

// Schemes Section

// CreateScheme creates a new Scheme.
func (c *Client4) CreateScheme(ctx context.Context, scheme *Scheme) (*Scheme, *Response, error) {
	route, err := c.schemesRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, scheme)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Scheme](r)
}

// GetScheme gets a single scheme by ID.
func (c *Client4) GetScheme(ctx context.Context, id string) (*Scheme, *Response, error) {
	route, err := c.schemeRoute(id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Scheme](r)
}

// GetSchemes ets all schemes, sorted with the most recently created first, optionally filtered by scope.
func (c *Client4) GetSchemes(ctx context.Context, scope string, page int, perPage int) ([]*Scheme, *Response, error) {
	values := url.Values{}
	values.Set("scope", scope)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.schemesRoute().URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Scheme](r)
}

// DeleteScheme deletes a single scheme by ID.
func (c *Client4) DeleteScheme(ctx context.Context, id string) (*Response, error) {
	route, err := c.schemeRoute(id).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PatchScheme partially updates a scheme in the system. Any missing fields are not updated.
func (c *Client4) PatchScheme(ctx context.Context, id string, patch *SchemePatch) (*Scheme, *Response, error) {
	route, err := c.schemeRoute(id).JoinSegment("patch").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Scheme](r)
}

// GetTeamsForScheme gets the teams using this scheme, sorted alphabetically by display name.
func (c *Client4) GetTeamsForScheme(ctx context.Context, schemeId string, page int, perPage int) ([]*Team, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.schemeRoute(schemeId).JoinSegment("teams").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Team](r)
}

// GetChannelsForScheme gets the channels using this scheme, sorted alphabetically by display name.
func (c *Client4) GetChannelsForScheme(ctx context.Context, schemeId string, page int, perPage int) (ChannelList, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.schemeRoute(schemeId).JoinSegment("channels").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[ChannelList](r)
}

// Plugin Section

// UploadPlugin takes an io.Reader stream pointing to the contents of a .tar.gz plugin.
func (c *Client4) UploadPlugin(ctx context.Context, file io.Reader) (*Manifest, *Response, error) {
	return c.uploadPlugin(ctx, file, false)
}

func (c *Client4) UploadPluginForced(ctx context.Context, file io.Reader) (*Manifest, *Response, error) {
	return c.uploadPlugin(ctx, file, true)
}

func (c *Client4) uploadPlugin(ctx context.Context, file io.Reader, force bool) (*Manifest, *Response, error) {
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

	route, err := c.pluginsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.doAPIRequestReader(ctx, http.MethodPost, c.APIURL+route, writer.FormDataContentType(), body, nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}

	return DecodeJSONFromResponse[*Manifest](r)
}

func (c *Client4) InstallPluginFromURL(ctx context.Context, downloadURL string, force bool) (*Manifest, *Response, error) {
	values := url.Values{}
	values.Set("plugin_download_url", downloadURL)
	values.Set("force", c.boolString(force))
	urlVal, err := c.pluginsRoute().JoinSegment("install_from_url").URL()
	if err != nil {
		return nil, nil, err
	}
	urlVal.RawQuery = values.Encode()
	url := urlVal.String()
	r, err := c.DoAPIPost(ctx, url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Manifest](r)
}

// InstallMarketplacePlugin will install marketplace plugin.
func (c *Client4) InstallMarketplacePlugin(ctx context.Context, request *InstallMarketplacePluginRequest) (*Manifest, *Response, error) {
	route, err := c.pluginsRoute().JoinSegment("marketplace").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, request)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Manifest](r)
}

// ReattachPlugin asks the server to reattach to a plugin launched by another process.
//
// Only available in local mode, and currently only used for testing.
func (c *Client4) ReattachPlugin(ctx context.Context, request *PluginReattachRequest) (*Response, error) {
	route, err := c.pluginsRoute().JoinSegment("reattach").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, request)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

// DetachPlugin detaches a previously reattached plugin.
//
// Only available in local mode, and currently only used for testing.
func (c *Client4) DetachPlugin(ctx context.Context, pluginID string) (*Response, error) {
	route, err := c.pluginRoute(pluginID).JoinSegment("detach").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

// GetPlugins will return a list of plugin manifests for currently active plugins.
func (c *Client4) GetPlugins(ctx context.Context) (*PluginsResponse, *Response, error) {
	route, err := c.pluginsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PluginsResponse](r)
}

// GetPluginStatuses will return the plugins installed on any server in the cluster, for reporting
// to the administrator via the system console.
func (c *Client4) GetPluginStatuses(ctx context.Context) (PluginStatuses, *Response, error) {
	route, err := c.pluginsRoute().JoinSegment("statuses").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[PluginStatuses](r)
}

// RemovePlugin will disable and delete a plugin.
func (c *Client4) RemovePlugin(ctx context.Context, id string) (*Response, error) {
	route, err := c.pluginRoute(id).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetWebappPlugins will return a list of plugins that the webapp should download.
func (c *Client4) GetWebappPlugins(ctx context.Context) ([]*Manifest, *Response, error) {
	route, err := c.pluginsRoute().JoinSegment("webapp").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Manifest](r)
}

// EnablePlugin will enable an plugin installed.
func (c *Client4) EnablePlugin(ctx context.Context, id string) (*Response, error) {
	route, err := c.pluginRoute(id).JoinSegment("enable").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DisablePlugin will disable an enabled plugin.
func (c *Client4) DisablePlugin(ctx context.Context, id string) (*Response, error) {
	route, err := c.pluginRoute(id).JoinSegment("disable").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetMarketplacePlugins will return a list of plugins that an admin can install.
func (c *Client4) GetMarketplacePlugins(ctx context.Context, filter *MarketplacePluginFilter) ([]*MarketplacePlugin, *Response, error) {
	route, err := c.pluginsRoute().JoinSegment("marketplace").String()
	if err != nil {
		return nil, nil, err
	}
	u, err := url.Parse(route)
	if err != nil {
		return nil, nil, err
	}

	filter.ApplyToURL(u)

	r, err := c.DoAPIGet(ctx, u.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	plugins, err := MarketplacePluginsFromReader(r.Body)
	if err != nil {
		return nil, BuildResponse(r), fmt.Errorf("failed to parse marketplace plugins response: %w", err)
	}

	return plugins, BuildResponse(r), nil
}

// UpdateChannelScheme will update a channel's scheme.
func (c *Client4) UpdateChannelScheme(ctx context.Context, channelId, schemeId string) (*Response, error) {
	sip := &SchemeIDPatch{SchemeID: &schemeId}
	route, err := c.channelSchemeRoute(channelId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, sip)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateTeamScheme will update a team's scheme.
func (c *Client4) UpdateTeamScheme(ctx context.Context, teamId, schemeId string) (*Response, error) {
	sip := &SchemeIDPatch{SchemeID: &schemeId}
	route, err := c.teamSchemeRoute(teamId).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, sip)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetRedirectLocation retrieves the value of the 'Location' header of an HTTP response for a given URL.
func (c *Client4) GetRedirectLocation(ctx context.Context, urlParam, etag string) (string, *Response, error) {
	values := url.Values{}
	values.Set("url", urlParam)
	urlVal, err := c.redirectLocationRoute().URL()
	if err != nil {
		return "", nil, err
	}

	urlVal.RawQuery = values.Encode()

	url := urlVal.String()
	r, err := c.DoAPIGet(ctx, url, etag)
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	result, resp, err := DecodeJSONFromResponse[map[string]string](r)
	if err != nil {
		return "", resp, err
	}
	return result["location"], resp, nil
}

// SetServerBusy will mark the server as busy, which disables non-critical services for `secs` seconds.
func (c *Client4) SetServerBusy(ctx context.Context, secs int) (*Response, error) {
	values := url.Values{}
	values.Set("seconds", strconv.Itoa(secs))
	urlVal, err := c.serverBusyRoute().URL()
	if err != nil {
		return nil, err
	}

	urlVal.RawQuery = values.Encode()

	url := urlVal.String()
	r, err := c.DoAPIPost(ctx, url, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ClearServerBusy will mark the server as not busy.
func (c *Client4) ClearServerBusy(ctx context.Context) (*Response, error) {
	route, err := c.serverBusyRoute().String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetServerBusy returns the current ServerBusyState including the time when a server marked busy
// will automatically have the flag cleared.
func (c *Client4) GetServerBusy(ctx context.Context) (*ServerBusyState, *Response, error) {
	route, err := c.serverBusyRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ServerBusyState](r)
}

// RegisterTermsOfServiceAction saves action performed by a user against a specific terms of service.
func (c *Client4) RegisterTermsOfServiceAction(ctx context.Context, userId, termsOfServiceId string, accepted bool) (*Response, error) {
	route, err := c.userTermsOfServiceRoute(userId).String()
	if err != nil {
		return nil, err
	}
	data := map[string]any{"termsOfServiceId": termsOfServiceId, "accepted": accepted}
	r, err := c.DoAPIPostJSON(ctx, route, data)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTermsOfService fetches the latest terms of service
func (c *Client4) GetTermsOfService(ctx context.Context, etag string) (*TermsOfService, *Response, error) {
	route, err := c.termsOfServiceRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*TermsOfService](r)
}

// GetUserTermsOfService fetches user's latest terms of service action if the latest action was for acceptance.
func (c *Client4) GetUserTermsOfService(ctx context.Context, userId, etag string) (*UserTermsOfService, *Response, error) {
	route, err := c.userTermsOfServiceRoute(userId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UserTermsOfService](r)
}

// CreateTermsOfService creates new terms of service.
func (c *Client4) CreateTermsOfService(ctx context.Context, text, userId string) (*TermsOfService, *Response, error) {
	route, err := c.termsOfServiceRoute().String()
	if err != nil {
		return nil, nil, err
	}
	data := map[string]any{"text": text}
	r, err := c.DoAPIPostJSON(ctx, route, data)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*TermsOfService](r)
}

func (c *Client4) GetGroup(ctx context.Context, groupID, etag string) (*Group, *Response, error) {
	route, err := c.groupRoute(groupID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Group](r)
}

func (c *Client4) CreateGroup(ctx context.Context, group *Group) (*Group, *Response, error) {
	r, err := c.DoAPIPostJSON(ctx, "/groups", group)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Group](r)
}

func (c *Client4) DeleteGroup(ctx context.Context, groupID string) (*Group, *Response, error) {
	route, err := c.groupRoute(groupID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Group](r)
}

func (c *Client4) RestoreGroup(ctx context.Context, groupID string, etag string) (*Group, *Response, error) {
	route, err := c.groupRoute(groupID).JoinSegment("restore").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Group](r)
}

func (c *Client4) PatchGroup(ctx context.Context, groupID string, patch *GroupPatch) (*Group, *Response, error) {
	route, err := c.groupRoute(groupID).JoinSegment("patch").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Group](r)
}

func (c *Client4) GetGroupMembers(ctx context.Context, groupID string) (*GroupMemberList, *Response, error) {
	route, err := c.groupRoute(groupID).JoinSegment("members").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*GroupMemberList](r)
}

func (c *Client4) UpsertGroupMembers(ctx context.Context, groupID string, userIds *GroupModifyMembers) ([]*GroupMember, *Response, error) {
	route, err := c.groupRoute(groupID).JoinSegment("members").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, userIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*GroupMember](r)
}

func (c *Client4) DeleteGroupMembers(ctx context.Context, groupID string, userIds *GroupModifyMembers) ([]*GroupMember, *Response, error) {
	route, err := c.groupRoute(groupID).JoinSegment("members").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIDeleteJSON(ctx, route, userIds)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*GroupMember](r)
}

func (c *Client4) LinkGroupSyncable(ctx context.Context, groupID, syncableID string, syncableType GroupSyncableType, patch *GroupSyncablePatch) (*GroupSyncable, *Response, error) {
	url, err := c.groupSyncableRoute(groupID, syncableID, syncableType).JoinSegment("link").String()
	if err != nil {
		return nil, BuildResponse(nil), err
	}
	r, err := c.DoAPIPostJSON(ctx, url, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*GroupSyncable](r)
}

func (c *Client4) UnlinkGroupSyncable(ctx context.Context, groupID, syncableID string, syncableType GroupSyncableType) (*Response, error) {
	url, err := c.groupSyncableRoute(groupID, syncableID, syncableType).JoinSegment("link").String()
	if err != nil {
		return BuildResponse(nil), err
	}
	r, err := c.DoAPIDelete(ctx, url)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetGroupSyncable(ctx context.Context, groupID, syncableID string, syncableType GroupSyncableType, etag string) (*GroupSyncable, *Response, error) {
	route, err := c.groupSyncableRoute(groupID, syncableID, syncableType).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*GroupSyncable](r)
}

func (c *Client4) GetGroupSyncables(ctx context.Context, groupID string, syncableType GroupSyncableType, etag string) ([]*GroupSyncable, *Response, error) {
	route, err := c.groupSyncablesRoute(groupID, syncableType).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*GroupSyncable](r)
}

func (c *Client4) PatchGroupSyncable(ctx context.Context, groupID, syncableID string, syncableType GroupSyncableType, patch *GroupSyncablePatch) (*GroupSyncable, *Response, error) {
	route, err := c.groupSyncableRoute(groupID, syncableID, syncableType).JoinSegment("patch").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*GroupSyncable](r)
}

func (c *Client4) TeamMembersMinusGroupMembers(ctx context.Context, teamID string, groupIDs []string, page, perPage int, etag string) ([]*UserWithGroups, int64, *Response, error) {
	groupIDStr := strings.Join(groupIDs, ",")
	values := url.Values{}
	values.Set("group_ids", groupIDStr)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.teamRoute(teamID).JoinSegment("members_minus_group_members").URL()
	if err != nil {
		return nil, 0, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)

	ugc, resp, err := DecodeJSONFromResponse[UsersWithGroupsAndCount](r)
	if err != nil {
		return nil, 0, nil, err
	}
	return ugc.Users, ugc.Count, resp, nil
}

func (c *Client4) ChannelMembersMinusGroupMembers(ctx context.Context, channelID string, groupIDs []string, page, perPage int, etag string) ([]*UserWithGroups, int64, *Response, error) {
	groupIDStr := strings.Join(groupIDs, ",")
	values := url.Values{}
	values.Set("group_ids", groupIDStr)
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.channelRoute(channelID).JoinSegment("members_minus_group_members").URL()
	if err != nil {
		return nil, 0, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, 0, BuildResponse(r), err
	}
	defer closeBody(r)
	ugc, resp, err := DecodeJSONFromResponse[UsersWithGroupsAndCount](r)
	if err != nil {
		return nil, 0, nil, err
	}
	return ugc.Users, ugc.Count, resp, nil
}

func (c *Client4) PatchConfig(ctx context.Context, config *Config) (*Config, *Response, error) {
	route, err := c.configRoute().JoinSegment("patch").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, config)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Config](r)
}

func (c *Client4) GetChannelModerations(ctx context.Context, channelID string, etag string) ([]*ChannelModeration, *Response, error) {
	route, err := c.channelRoute(channelID).JoinSegment("moderations").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*ChannelModeration](r)
}

func (c *Client4) PatchChannelModerations(ctx context.Context, channelID string, patch []*ChannelModerationPatch) ([]*ChannelModeration, *Response, error) {
	route, err := c.channelRoute(channelID).JoinSegments("moderations", "patch").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*ChannelModeration](r)
}

func (c *Client4) GetKnownUsers(ctx context.Context) ([]string, *Response, error) {
	route, err := c.usersRoute().JoinSegment("known").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]string](r)
}

// PublishUserTyping publishes a user is typing websocket event based on the provided TypingRequest.
func (c *Client4) PublishUserTyping(ctx context.Context, userID string, typingRequest TypingRequest) (*Response, error) {
	route, err := c.publishUserTypingRoute(userID).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, typingRequest)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetChannelMemberCountsByGroup(ctx context.Context, channelID string, includeTimezones bool, etag string) ([]*ChannelMemberCountByGroup, *Response, error) {
	values := url.Values{}
	values.Set("include_timezones", c.boolString(includeTimezones))
	routeURL, err := c.channelRoute(channelID).JoinSegment("member_counts_by_group").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*ChannelMemberCountByGroup](r)
}

func (c *Client4) RequestTrialLicenseWithExtraFields(ctx context.Context, trialRequest *TrialLicenseRequest) (*Response, error) {
	r, err := c.DoAPIPostJSON(ctx, "/trial-license", trialRequest)
	if err != nil {
		return BuildResponse(r), err
	}

	defer closeBody(r)
	return BuildResponse(r), nil
}

// RequestTrialLicense will request a trial license and install it in the server
// DEPRECATED - USE RequestTrialLicenseWithExtraFields (this method remains for backwards compatibility)
func (c *Client4) RequestTrialLicense(ctx context.Context, users int) (*Response, error) {
	reqData := map[string]any{"users": users, "terms_accepted": true}
	r, err := c.DoAPIPostJSON(ctx, "/trial-license", reqData)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetGroupStats retrieves stats for a Mattermost Group
func (c *Client4) GetGroupStats(ctx context.Context, groupID string) (*GroupStats, *Response, error) {
	route, err := c.groupRoute(groupID).JoinSegment("stats").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*GroupStats](r)
}

func (c *Client4) GetSidebarCategoriesForTeamForUser(ctx context.Context, userID, teamID, etag string) (*OrderedSidebarCategories, *Response, error) {
	route, err := c.userCategoryRoute(userID, teamID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}

	return DecodeJSONFromResponse[*OrderedSidebarCategories](r)
}

func (c *Client4) CreateSidebarCategoryForTeamForUser(ctx context.Context, userID, teamID string, category *SidebarCategoryWithChannels) (*SidebarCategoryWithChannels, *Response, error) {
	route, err := c.userCategoryRoute(userID, teamID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, category)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*SidebarCategoryWithChannels](r)
}

func (c *Client4) UpdateSidebarCategoriesForTeamForUser(ctx context.Context, userID, teamID string, categories []*SidebarCategoryWithChannels) ([]*SidebarCategoryWithChannels, *Response, error) {
	route, err := c.userCategoryRoute(userID, teamID).String()
	if err != nil {
		return nil, nil, err
	}

	r, err := c.DoAPIPutJSON(ctx, route, categories)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*SidebarCategoryWithChannels](r)
}

func (c *Client4) GetSidebarCategoryOrderForTeamForUser(ctx context.Context, userID, teamID, etag string) ([]string, *Response, error) {
	route, err := c.userCategoryRoute(userID, teamID).JoinSegment("order").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]string](r)
}

func (c *Client4) UpdateSidebarCategoryOrderForTeamForUser(ctx context.Context, userID, teamID string, order []string) ([]string, *Response, error) {
	route, err := c.userCategoryRoute(userID, teamID).JoinSegment("order").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, order)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]string](r)
}

func (c *Client4) GetSidebarCategoryForTeamForUser(ctx context.Context, userID, teamID, categoryID, etag string) (*SidebarCategoryWithChannels, *Response, error) {
	route, err := c.userCategoryRoute(userID, teamID).JoinId(categoryID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*SidebarCategoryWithChannels](r)
}

func (c *Client4) UpdateSidebarCategoryForTeamForUser(ctx context.Context, userID, teamID, categoryID string, category *SidebarCategoryWithChannels) (*SidebarCategoryWithChannels, *Response, error) {
	route, err := c.userCategoryRoute(userID, teamID).JoinId(categoryID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, category)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*SidebarCategoryWithChannels](r)
}

// DeleteSidebarCategoryForTeamForUser deletes a sidebar category for a user in a team.
func (c *Client4) DeleteSidebarCategoryForTeamForUser(ctx context.Context, userId string, teamId string, categoryId string) (*Response, error) {
	url, err := c.userCategoryRoute(userId, teamId).JoinId(categoryId).String()
	if err != nil {
		return BuildResponse(nil), err
	}
	r, err := c.DoAPIDelete(ctx, url)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// CheckIntegrity performs a database integrity check.
func (c *Client4) CheckIntegrity(ctx context.Context) ([]IntegrityCheckResult, *Response, error) {
	r, err := c.DoAPIPost(ctx, "/integrity", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]IntegrityCheckResult](r)
}

func (c *Client4) GetNotices(ctx context.Context, lastViewed int64, teamId string, client NoticeClientType, clientVersion, locale, etag string) (NoticeMessages, *Response, error) {
	values := url.Values{}
	values.Set("lastViewed", strconv.FormatInt(lastViewed, 10))
	values.Set("client", string(client))
	values.Set("clientVersion", clientVersion)
	values.Set("locale", locale)
	url := "/system/notices/" + teamId + "?" + values.Encode()
	r, err := c.DoAPIGet(ctx, url, etag)
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

func (c *Client4) MarkNoticesViewed(ctx context.Context, ids []string) (*Response, error) {
	r, err := c.DoAPIPutJSON(ctx, "/system/notices/view", ids)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) CompleteOnboarding(ctx context.Context, request *CompleteOnboardingRequest) (*Response, error) {
	route, err := c.systemRoute().JoinSegments("onboarding", "complete").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, request)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

// CreateUpload creates a new upload session.
func (c *Client4) CreateUpload(ctx context.Context, us *UploadSession) (*UploadSession, *Response, error) {
	route, err := c.uploadsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, us)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UploadSession](r)
}

// GetUpload returns the upload session for the specified uploadId.
func (c *Client4) GetUpload(ctx context.Context, uploadId string) (*UploadSession, *Response, error) {
	route, err := c.uploadRoute(uploadId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UploadSession](r)
}

// GetUploadsForUser returns the upload sessions created by the specified
// userId.
func (c *Client4) GetUploadsForUser(ctx context.Context, userId string) ([]*UploadSession, *Response, error) {
	route, err := c.userRoute(userId).JoinSegment("uploads").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*UploadSession](r)
}

// UploadData performs an upload. On success it returns
// a FileInfo object.
func (c *Client4) UploadData(ctx context.Context, uploadId string, data io.Reader) (*FileInfo, *Response, error) {
	route, err := c.uploadRoute(uploadId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.doAPIRequestReader(ctx, http.MethodPost, c.APIURL+route, "", data, nil)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	if r.StatusCode == http.StatusNoContent {
		return nil, BuildResponse(r), nil
	}
	return DecodeJSONFromResponse[*FileInfo](r)
}

func (c *Client4) UpdatePassword(ctx context.Context, userId, currentPassword, newPassword string) (*Response, error) {
	requestBody := map[string]string{"current_password": currentPassword, "new_password": newPassword}
	route, err := c.userRoute(userId).JoinSegment("password").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, requestBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Cloud Section

func (c *Client4) GetCloudProducts(ctx context.Context) ([]*Product, *Response, error) {
	route, err := c.cloudRoute().JoinSegment("products").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Product](r)
}

func (c *Client4) GetSelfHostedProducts(ctx context.Context) ([]*Product, *Response, error) {
	route, err := c.cloudRoute().JoinSegments("products", "selfhosted").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Product](r)
}

func (c *Client4) GetProductLimits(ctx context.Context) (*ProductLimits, *Response, error) {
	route, err := c.cloudRoute().JoinSegment("limits").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ProductLimits](r)
}

func (c *Client4) GetIPFilters(ctx context.Context) (*AllowedIPRanges, *Response, error) {
	route, err := c.ipFiltersRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	return DecodeJSONFromResponse[*AllowedIPRanges](r)
}

func (c *Client4) ApplyIPFilters(ctx context.Context, allowedRanges *AllowedIPRanges) (*AllowedIPRanges, *Response, error) {
	route, err := c.ipFiltersRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, allowedRanges)
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	return DecodeJSONFromResponse[*AllowedIPRanges](r)
}

func (c *Client4) GetMyIP(ctx context.Context) (*GetIPAddressResponse, *Response, error) {
	route, err := c.ipFiltersRoute().JoinSegment("my_ip").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	return DecodeJSONFromResponse[*GetIPAddressResponse](r)
}

func (c *Client4) ValidateWorkspaceBusinessEmail(ctx context.Context) (*Response, error) {
	route, err := c.cloudRoute().JoinSegment("validate-workspace-business-email").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) NotifyAdmin(ctx context.Context, nr *NotifyAdminToUpgradeRequest) (int, error) {
	r, err := c.DoAPIPostJSON(ctx, "/users/notify-admin", nr)
	if err != nil {
		return r.StatusCode, err
	}

	closeBody(r)

	return r.StatusCode, nil
}

func (c *Client4) TriggerNotifyAdmin(ctx context.Context, nr *NotifyAdminToUpgradeRequest) (int, error) {
	r, err := c.DoAPIPostJSON(ctx, "/users/trigger-notify-admin-posts", nr)
	if err != nil {
		return r.StatusCode, err
	}

	closeBody(r)

	return r.StatusCode, nil
}

func (c *Client4) ValidateBusinessEmail(ctx context.Context, email *ValidateBusinessEmailRequest) (*Response, error) {
	route, err := c.cloudRoute().JoinSegment("validate-business-email").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, email)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) GetCloudCustomer(ctx context.Context) (*CloudCustomer, *Response, error) {
	route, err := c.cloudRoute().JoinSegment("customer").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*CloudCustomer](r)
}

func (c *Client4) GetSubscription(ctx context.Context) (*Subscription, *Response, error) {
	route, err := c.cloudRoute().JoinSegment("subscription").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Subscription](r)
}

func (c *Client4) GetInvoicesForSubscription(ctx context.Context) ([]*Invoice, *Response, error) {
	route, err := c.cloudRoute().JoinSegments("subscription", "invoices").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*Invoice](r)
}

func (c *Client4) UpdateCloudCustomer(ctx context.Context, customerInfo *CloudCustomerInfo) (*CloudCustomer, *Response, error) {
	route, err := c.cloudRoute().JoinSegment("customer").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, customerInfo)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*CloudCustomer](r)
}

func (c *Client4) UpdateCloudCustomerAddress(ctx context.Context, address *Address) (*CloudCustomer, *Response, error) {
	route, err := c.cloudRoute().JoinSegments("customer", "address").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, address)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*CloudCustomer](r)
}

func (c *Client4) ListImports(ctx context.Context) ([]string, *Response, error) {
	route, err := c.importsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]string](r)
}

func (c *Client4) DeleteImport(ctx context.Context, name string) (*Response, error) {
	route, err := c.importRoute(name).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) ListExports(ctx context.Context) ([]string, *Response, error) {
	route, err := c.exportsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]string](r)
}

func (c *Client4) DeleteExport(ctx context.Context, name string) (*Response, error) {
	route, err := c.exportRoute(name).String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) DownloadExport(ctx context.Context, name string, wr io.Writer, offset int64) (int64, *Response, error) {
	route, err := c.exportRoute(name).String()
	if err != nil {
		return 0, nil, err
	}
	var headers map[string]string
	if offset > 0 {
		headers = map[string]string{
			HeaderRange: fmt.Sprintf("bytes=%d-", offset),
		}
	}
	r, err := c.DoAPIRequestWithHeaders(ctx, http.MethodGet, c.APIURL+route, "", headers)
	if err != nil {
		return 0, BuildResponse(r), err
	}
	defer closeBody(r)
	n, err := io.Copy(wr, r.Body)
	if err != nil {
		return n, BuildResponse(r), fmt.Errorf("failed to copy export data to writer: %w", err)
	}
	return n, BuildResponse(r), nil
}

func (c *Client4) GeneratePresignedURL(ctx context.Context, name string) (*PresignURLResponse, *Response, error) {
	route, err := c.exportRoute(name).JoinSegment("presign-url").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.doAPIRequest(ctx, http.MethodPost, c.APIURL+route, "", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PresignURLResponse](r)
}

func (c *Client4) GetUserThreads(ctx context.Context, userId, teamId string, options GetUserThreadsOpts) (*Threads, *Response, error) {
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
	if options.ExcludeDirect {
		v.Set("excludeDirect", fmt.Sprintf("%t", options.ExcludeDirect))
	}
	routeURL, err := c.userThreadsRoute(userId, teamId).URL()
	if err != nil {
		return nil, BuildResponse(nil), err
	}
	if len(v) > 0 {
		routeURL.RawQuery = v.Encode()
	}

	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*Threads](r)
}

func (c *Client4) DownloadComplianceExport(ctx context.Context, jobId string, wr io.Writer) (string, error) {
	route, err := c.jobsRoute().JoinId(jobId).JoinSegment("download").String()
	if err != nil {
		return "", err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return "", err
	}
	defer closeBody(r)

	// Try to get the filename from the Content-Disposition header
	var filename string
	if cd := r.Header.Get("Content-Disposition"); cd != "" {
		var params map[string]string
		if _, params, err = mime.ParseMediaType(cd); err == nil {
			if params["filename"] != "" {
				filename = params["filename"]
			}
		}
	}

	_, err = io.Copy(wr, r.Body)
	if err != nil {
		return filename, fmt.Errorf("failed to copy compliance export data to writer: %w", err)
	}
	return filename, nil
}

func (c *Client4) GetUserThread(ctx context.Context, userId, teamId, threadId string, extended bool) (*ThreadResponse, *Response, error) {
	routeURL, err := c.userThreadRoute(userId, teamId, threadId).URL()
	if err != nil {
		return nil, BuildResponse(nil), err
	}
	if extended {
		v := url.Values{}
		v.Set("extended", "true")
		routeURL.RawQuery = v.Encode()
	}
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ThreadResponse](r)
}

func (c *Client4) UpdateThreadsReadForUser(ctx context.Context, userId, teamId string) (*Response, error) {
	route, err := c.userThreadsRoute(userId, teamId).JoinSegment("read").String()
	if err != nil {
		return BuildResponse(nil), err
	}
	r, err := c.DoAPIPut(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) SetThreadUnreadByPostId(ctx context.Context, userId, teamId, threadId, postId string) (*ThreadResponse, *Response, error) {
	route, err := c.userThreadRoute(userId, teamId, threadId).JoinSegment("set_unread").JoinId(postId).String()
	if err != nil {
		return nil, BuildResponse(nil), err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ThreadResponse](r)
}

func (c *Client4) UpdateThreadReadForUser(ctx context.Context, userId, teamId, threadId string, timestamp int64) (*ThreadResponse, *Response, error) {
	route, err := c.userThreadRoute(userId, teamId, threadId).JoinSegment("read").JoinSegment(fmt.Sprintf("%d", timestamp)).String()
	if err != nil {
		return nil, BuildResponse(nil), err
	}
	r, err := c.DoAPIPut(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ThreadResponse](r)
}

func (c *Client4) UpdateThreadFollowForUser(ctx context.Context, userId, teamId, threadId string, state bool) (*Response, error) {
	route, err := c.userThreadRoute(userId, teamId, threadId).JoinSegment("following").String()
	if err != nil {
		return nil, err
	}
	var r *http.Response
	if state {
		r, err = c.DoAPIPut(ctx, route, "")
	} else {
		r, err = c.DoAPIDelete(ctx, route)
	}
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) GetAllSharedChannels(ctx context.Context, teamID string, page, perPage int) ([]*SharedChannel, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	urlVal, err := c.sharedChannelsRoute().JoinId(teamID).URL()
	if err != nil {
		return nil, nil, err
	}
	urlVal.RawQuery = values.Encode()
	url := urlVal.String()
	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*SharedChannel](r)
}

func (c *Client4) GetRemoteClusterInfo(ctx context.Context, remoteID string) (RemoteClusterInfo, *Response, error) {
	url, err := c.sharedChannelsRoute().JoinSegment("remote_info").JoinId(remoteID).String()
	if err != nil {
		return RemoteClusterInfo{}, BuildResponse(nil), err
	}
	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return RemoteClusterInfo{}, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[RemoteClusterInfo](r)
}

func (c *Client4) GetRemoteClusters(ctx context.Context, page, perPage int, filter RemoteClusterQueryFilter) ([]*RemoteCluster, *Response, error) {
	v := url.Values{}
	if page != 0 {
		v.Set("page", fmt.Sprintf("%d", page))
	}
	if perPage != 0 {
		v.Set("per_page", fmt.Sprintf("%d", perPage))
	}
	if filter.ExcludeOffline {
		v.Set("exclude_offline", "true")
	}
	if filter.InChannel != "" {
		v.Set("in_channel", filter.InChannel)
	}
	if filter.NotInChannel != "" {
		v.Set("not_in_channel", filter.NotInChannel)
	}
	if filter.Topic != "" {
		v.Set("topic", filter.Topic)
	}
	if filter.CreatorId != "" {
		v.Set("creator_id", filter.CreatorId)
	}
	if filter.OnlyConfirmed {
		v.Set("only_confirmed", "true")
	}
	if filter.PluginID != "" {
		v.Set("plugin_id", filter.PluginID)
	}
	if filter.OnlyPlugins {
		v.Set("only_plugins", "true")
	}
	if filter.ExcludePlugins {
		v.Set("exclude_plugins", "true")
	}
	if filter.IncludeDeleted {
		v.Set("include_deleted", "true")
	}
	routeURL, err := c.remoteClusterRoute().URL()
	if err != nil {
		return nil, BuildResponse(nil), err
	}
	if len(v) > 0 {
		routeURL.RawQuery = v.Encode()
	}

	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*RemoteCluster](r)
}

func (c *Client4) CreateRemoteCluster(ctx context.Context, rcWithPassword *RemoteClusterWithPassword) (*RemoteClusterWithInvite, *Response, error) {
	route, err := c.remoteClusterRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, rcWithPassword)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*RemoteClusterWithInvite](r)
}

func (c *Client4) RemoteClusterAcceptInvite(ctx context.Context, rcAcceptInvite *RemoteClusterAcceptInvite) (*RemoteCluster, *Response, error) {
	url, err := c.remoteClusterRoute().JoinSegment("accept_invite").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, url, rcAcceptInvite)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*RemoteCluster](r)
}

func (c *Client4) GenerateRemoteClusterInvite(ctx context.Context, remoteClusterId, password string) (string, *Response, error) {
	url, err := c.remoteClusterRoute().JoinId(remoteClusterId).JoinSegment("generate_invite").String()
	if err != nil {
		return "", BuildResponse(nil), err
	}
	r, err := c.DoAPIPostJSON(ctx, url, map[string]string{"password": password})
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[string](r)
}

func (c *Client4) GetRemoteCluster(ctx context.Context, remoteClusterId string) (*RemoteCluster, *Response, error) {
	route, err := c.remoteClusterRoute().JoinId(remoteClusterId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*RemoteCluster](r)
}

func (c *Client4) PatchRemoteCluster(ctx context.Context, remoteClusterId string, patch *RemoteClusterPatch) (*RemoteCluster, *Response, error) {
	url, err := c.remoteClusterRoute().JoinId(remoteClusterId).String()
	if err != nil {
		return nil, BuildResponse(nil), err
	}
	r, err := c.DoAPIPatchJSON(ctx, url, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*RemoteCluster](r)
}

func (c *Client4) DeleteRemoteCluster(ctx context.Context, remoteClusterId string) (*Response, error) {
	route, err := c.remoteClusterRoute().JoinId(remoteClusterId).String()
	if err != nil {
		return BuildResponse(nil), err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetSharedChannelRemotesByRemoteCluster(ctx context.Context, remoteId string, filter SharedChannelRemoteFilterOpts, page, perPage int) ([]*SharedChannelRemote, *Response, error) {
	v := url.Values{}
	if filter.IncludeUnconfirmed {
		v.Set("include_unconfirmed", "true")
	}
	if filter.ExcludeConfirmed {
		v.Set("exclude_confirmed", "true")
	}
	if filter.ExcludeHome {
		v.Set("exclude_home", "true")
	}
	if filter.ExcludeRemote {
		v.Set("exclude_remote", "true")
	}
	if filter.IncludeDeleted {
		v.Set("include_deleted", "true")
	}
	if page != 0 {
		v.Set("page", fmt.Sprintf("%d", page))
	}
	if perPage != 0 {
		v.Set("per_page", fmt.Sprintf("%d", perPage))
	}
	routeURL, err := c.sharedChannelRemotesRoute(remoteId).URL()
	if err != nil {
		return nil, BuildResponse(nil), err
	}
	if len(v) > 0 {
		routeURL.RawQuery = v.Encode()
	}

	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*SharedChannelRemote](r)
}

func (c *Client4) InviteRemoteClusterToChannel(ctx context.Context, remoteId, channelId string) (*Response, error) {
	url, err := c.channelRemoteRoute(remoteId, channelId).JoinSegment("invite").String()
	if err != nil {
		return BuildResponse(nil), err
	}
	r, err := c.DoAPIPost(ctx, url, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) UninviteRemoteClusterToChannel(ctx context.Context, remoteId, channelId string) (*Response, error) {
	url, err := c.channelRemoteRoute(remoteId, channelId).JoinSegment("uninvite").String()
	if err != nil {
		return BuildResponse(nil), err
	}
	r, err := c.DoAPIPost(ctx, url, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetAncillaryPermissions(ctx context.Context, subsectionPermissions []string) ([]string, *Response, error) {
	var returnedPermissions []string
	url, err := c.permissionsRoute().JoinSegment("ancillary").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, url, subsectionPermissions)
	if err != nil {
		return returnedPermissions, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]string](r)
}

func (c *Client4) GetUsersWithInvalidEmails(ctx context.Context, page, perPage int) ([]*User, *Response, error) {
	values := url.Values{}
	values.Set("page", strconv.Itoa(page))
	values.Set("per_page", strconv.Itoa(perPage))
	routeURL, err := c.usersRoute().JoinSegment("invalid_emails").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*User](r)
}

func (c *Client4) GetAppliedSchemaMigrations(ctx context.Context) ([]AppliedMigration, *Response, error) {
	route, err := c.systemRoute().JoinSegments("schema", "version").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]AppliedMigration](r)
}

// Usage Section

// GetPostsUsage returns rounded off total usage of posts for the instance
func (c *Client4) GetPostsUsage(ctx context.Context) (*PostsUsage, *Response, error) {
	route, err := c.usageRoute().JoinSegment("posts").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostsUsage](r)
}

// GetStorageUsage returns the file storage usage for the instance,
// rounded down the most signigicant digit
func (c *Client4) GetStorageUsage(ctx context.Context) (*StorageUsage, *Response, error) {
	route, err := c.usageRoute().JoinSegment("storage").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*StorageUsage](r)
}

// GetTeamsUsage returns total usage of teams for the instance
func (c *Client4) GetTeamsUsage(ctx context.Context) (*TeamsUsage, *Response, error) {
	route, err := c.usageRoute().JoinSegment("teams").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*TeamsUsage](r)
}

func (c *Client4) GetPostInfo(ctx context.Context, postId string) (*PostInfo, *Response, error) {
	route, err := c.postRoute(postId).JoinSegment("info").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostInfo](r)
}

func (c *Client4) AcknowledgePost(ctx context.Context, postId, userId string) (*PostAcknowledgement, *Response, error) {
	route, err := c.userRoute(userId).JoinRoute(c.postRoute(postId)).JoinSegment("ack").String()
	if err != nil {
		return nil, BuildResponse(nil), err
	}
	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PostAcknowledgement](r)
}

func (c *Client4) UnacknowledgePost(ctx context.Context, postId, userId string) (*Response, error) {
	route, err := c.userRoute(userId).JoinRoute(c.postRoute(postId)).JoinSegment("ack").String()
	if err != nil {
		return BuildResponse(nil), err
	}

	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) AddUserToGroupSyncables(ctx context.Context, userID string) (*Response, error) {
	route, err := c.ldapRoute().JoinSegment("users").JoinId(userID).JoinSegment("group_sync_memberships").String()
	if err != nil {
		return BuildResponse(nil), err
	}

	r, err := c.DoAPIPost(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) CheckCWSConnection(ctx context.Context, userId string) (*Response, error) {
	route, err := c.cloudRoute().JoinSegment("healthz").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

// CreateChannelBookmark creates a channel bookmark based on the provided struct.
func (c *Client4) CreateChannelBookmark(ctx context.Context, channelBookmark *ChannelBookmark) (*ChannelBookmarkWithFileInfo, *Response, error) {
	route, err := c.bookmarksRoute(channelBookmark.ChannelId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, channelBookmark)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelBookmarkWithFileInfo](r)
}

// UpdateChannelBookmark updates a channel bookmark based on the provided struct.
func (c *Client4) UpdateChannelBookmark(ctx context.Context, channelId, bookmarkId string, patch *ChannelBookmarkPatch) (*UpdateChannelBookmarkResponse, *Response, error) {
	route, err := c.bookmarkRoute(channelId, bookmarkId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPatchJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UpdateChannelBookmarkResponse](r)
}

// UpdateChannelBookmarkSortOrder updates a channel bookmark's sort order based on the provided new index.
func (c *Client4) UpdateChannelBookmarkSortOrder(ctx context.Context, channelId, bookmarkId string, sortOrder int64) ([]*ChannelBookmarkWithFileInfo, *Response, error) {
	route, err := c.bookmarkRoute(channelId, bookmarkId).JoinSegment("sort_order").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, sortOrder)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*ChannelBookmarkWithFileInfo](r)
}

// DeleteChannelBookmark deletes a channel bookmark.
func (c *Client4) DeleteChannelBookmark(ctx context.Context, channelId, bookmarkId string) (*ChannelBookmarkWithFileInfo, *Response, error) {
	route, err := c.bookmarkRoute(channelId, bookmarkId).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelBookmarkWithFileInfo](r)
}

func (c *Client4) ListChannelBookmarksForChannel(ctx context.Context, channelId string, since int64) ([]*ChannelBookmarkWithFileInfo, *Response, error) {
	values := url.Values{}
	values.Set("bookmarks_since", strconv.FormatInt(since, 10))
	routeURL, err := c.bookmarksRoute(channelId).URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*ChannelBookmarkWithFileInfo](r)
}

func (c *Client4) SubmitClientMetrics(ctx context.Context, report *PerformanceReport) (*Response, error) {
	route, err := c.clientPerfMetricsRoute().String()
	if err != nil {
		return BuildResponse(nil), err
	}
	res, err := c.DoAPIPostJSON(ctx, route, report)
	if err != nil {
		return BuildResponse(res), err
	}

	return BuildResponse(res), nil
}

func (c *Client4) GetFilteredUsersStats(ctx context.Context, options *UserCountOptions) (*UsersStats, *Response, error) {
	v := url.Values{}
	v.Set("in_team", options.TeamId)
	v.Set("in_channel", options.ChannelId)
	v.Set("include_deleted", strconv.FormatBool(options.IncludeDeleted))
	v.Set("include_bots", strconv.FormatBool(options.IncludeBotAccounts))
	v.Set("include_remote_users", strconv.FormatBool(options.IncludeRemoteUsers))

	if len(options.Roles) > 0 {
		v.Set("roles", strings.Join(options.Roles, ","))
	}
	if len(options.ChannelRoles) > 0 {
		v.Set("channel_roles", strings.Join(options.ChannelRoles, ","))
	}
	if len(options.TeamRoles) > 0 {
		v.Set("team_roles", strings.Join(options.TeamRoles, ","))
	}

	routeURL, err := c.usersRoute().JoinSegments("stats", "filtered").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = v.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*UsersStats](r)
}

func (c *Client4) RestorePostVersion(ctx context.Context, postId, versionId string) (*Post, *Response, error) {
	route, err := c.postRoute(postId).JoinSegment("restore").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPost(ctx, route+versionId, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	return DecodeJSONFromResponse[*Post](r)
}

func (c *Client4) CreateCPAField(ctx context.Context, field *PropertyField) (*PropertyField, *Response, error) {
	route, err := c.customProfileAttributeFieldsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, field)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PropertyField](r)
}

func (c *Client4) ListCPAFields(ctx context.Context) ([]*PropertyField, *Response, error) {
	route, err := c.customProfileAttributeFieldsRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*PropertyField](r)
}

func (c *Client4) PatchCPAField(ctx context.Context, fieldID string, patch *PropertyFieldPatch) (*PropertyField, *Response, error) {
	route, err := c.customProfileAttributeFieldRoute(fieldID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPatchJSON(ctx, route, patch)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*PropertyField](r)
}

func (c *Client4) DeleteCPAField(ctx context.Context, fieldID string) (*Response, error) {
	route, err := c.customProfileAttributeFieldRoute(fieldID).String()
	if err != nil {
		return BuildResponse(nil), err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) ListCPAValues(ctx context.Context, userID string) (map[string]json.RawMessage, *Response, error) {
	route, err := c.userCustomProfileAttributesRoute(userID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]json.RawMessage](r)
}

func (c *Client4) PatchCPAValues(ctx context.Context, values map[string]json.RawMessage) (map[string]json.RawMessage, *Response, error) {
	route, err := c.customProfileAttributeValuesRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPatchJSON(ctx, route, values)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]json.RawMessage](r)
}

func (c *Client4) PatchCPAValuesForUser(ctx context.Context, userID string, values map[string]json.RawMessage) (map[string]json.RawMessage, *Response, error) {
	route, err := c.userCustomProfileAttributesRoute(userID).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPatchJSON(ctx, route, values)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[map[string]json.RawMessage](r)
}

func (c *Client4) GetPostPropertyValues(ctx context.Context, postId string) ([]PropertyValue, *Response, error) {
	route, err := c.contentFlaggingRoute().JoinSegment("post").JoinId(postId).JoinSegment("field_values").String()
	if err != nil {
		return nil, nil, err
	}

	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]PropertyValue](r) // TODO: Fix!
}

// Access Control Policies Section

// CreateAccessControlPolicy creates a new access control policy.
func (c *Client4) CreateAccessControlPolicy(ctx context.Context, policy *AccessControlPolicy) (*AccessControlPolicy, *Response, error) {
	route, err := c.accessControlPoliciesRoute().String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPutJSON(ctx, route, policy)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*AccessControlPolicy](r)
}

func (c *Client4) GetAccessControlPolicy(ctx context.Context, id string) (*AccessControlPolicy, *Response, error) {
	route, err := c.accessControlPolicyRoute(id).String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIGet(ctx, route, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*AccessControlPolicy](r)
}

func (c *Client4) DeleteAccessControlPolicy(ctx context.Context, id string) (*Response, error) {
	route, err := c.accessControlPolicyRoute(id).String()
	if err != nil {
		return BuildResponse(nil), err
	}
	r, err := c.DoAPIDelete(ctx, route)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) CheckExpression(ctx context.Context, expression string, channelId ...string) ([]CELExpressionError, *Response, error) {
	checkExpressionRequest := struct {
		Expression string `json:"expression"`
		ChannelId  string `json:"channelId,omitempty"`
	}{
		Expression: expression,
	}
	if len(channelId) > 0 && channelId[0] != "" {
		checkExpressionRequest.ChannelId = channelId[0]
	}
	route, err := c.celRoute().JoinSegment("check").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, checkExpressionRequest)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]CELExpressionError](r)
}

func (c *Client4) TestExpression(ctx context.Context, params QueryExpressionParams) (*AccessControlPolicyTestResponse, *Response, error) {
	route, err := c.celRoute().JoinSegment("test").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, params)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*AccessControlPolicyTestResponse](r)
}

func (c *Client4) SearchAccessControlPolicies(ctx context.Context, options AccessControlPolicySearch) (*AccessControlPoliciesWithCount, *Response, error) {
	route, err := c.accessControlPoliciesRoute().JoinSegment("search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, options)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*AccessControlPoliciesWithCount](r)
}

func (c *Client4) AssignAccessControlPolicies(ctx context.Context, policyID string, resourceIDs []string) (*Response, error) {
	var assignments struct {
		ChannelIds []string `json:"channel_ids"`
	}
	assignments.ChannelIds = resourceIDs

	route, err := c.accessControlPolicyRoute(policyID).JoinSegment("assign").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, assignments)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) UnassignAccessControlPolicies(ctx context.Context, policyID string, resourceIDs []string) (*Response, error) {
	var unassignments struct {
		ChannelIds []string `json:"channel_ids"`
	}
	unassignments.ChannelIds = resourceIDs

	route, err := c.accessControlPolicyRoute(policyID).JoinSegment("unassign").String()
	if err != nil {
		return nil, err
	}
	r, err := c.DoAPIDeleteJSON(ctx, route, unassignments)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) GetChannelsForAccessControlPolicy(ctx context.Context, policyID string, after string, limit int) (*ChannelsWithCount, *Response, error) {
	values := url.Values{}
	values.Set("after", after)
	values.Set("limit", strconv.Itoa(limit))
	routeURL, err := c.accessControlPolicyRoute(policyID).JoinSegments("resources", "channels").URL()
	if err != nil {
		return nil, nil, err
	}
	routeURL.RawQuery = values.Encode()
	r, err := c.DoAPIGet(ctx, routeURL.String(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelsWithCount](r)
}

func (c *Client4) SearchChannelsForAccessControlPolicy(ctx context.Context, policyID string, options ChannelSearch) (*ChannelsWithCount, *Response, error) {
	route, err := c.accessControlPolicyRoute(policyID).JoinSegments("resources", "channels", "search").String()
	if err != nil {
		return nil, nil, err
	}
	r, err := c.DoAPIPostJSON(ctx, route, options)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*ChannelsWithCount](r)
}
