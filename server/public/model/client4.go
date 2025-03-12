// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"bytes"
	"context"
	"encoding/json"
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

func (c *Client4) ArrayFromJSON(data io.Reader) []string {
	var objmap []string
	json.NewDecoder(data).Decode(&objmap)
	if objmap == nil {
		return make([]string, 0)
	}
	return objmap
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

func (c *Client4) reportsRoute() string {
	return "/reports"
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
	return c.usersRoute() + "/tokens"
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
	return c.teamRoute(teamId) + "/members"
}

func (c *Client4) teamStatsRoute(teamId string) string {
	return c.teamRoute(teamId) + "/stats"
}

func (c *Client4) teamImportRoute(teamId string) string {
	return c.teamRoute(teamId) + "/import"
}

func (c *Client4) channelsRoute() string {
	return "/channels"
}

func (c *Client4) channelsForTeamRoute(teamId string) string {
	return c.teamRoute(teamId) + "/channels"
}

func (c *Client4) channelRoute(channelId string) string {
	return fmt.Sprintf(c.channelsRoute()+"/%v", channelId)
}

func (c *Client4) channelByNameRoute(channelName, teamId string) string {
	return fmt.Sprintf(c.teamRoute(teamId)+"/channels/name/%v", channelName)
}

func (c *Client4) channelsForTeamForUserRoute(teamId, userId string, includeDeleted bool) string {
	route := c.userRoute(userId) + c.teamRoute(teamId) + "/channels"
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
	return c.channelRoute(channelId) + "/members"
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

func (c *Client4) testEmailRoute() string {
	return "/email/test"
}

func (c *Client4) testNotificationRoute() string {
	return "/notifications/test"
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
	return c.userRoute(userId) + "/preferences"
}

func (c *Client4) userStatusRoute(userId string) string {
	return c.userRoute(userId) + "/status"
}

func (c *Client4) userStatusesRoute() string {
	return c.usersRoute() + "/status"
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

func (c *Client4) outgoingOAuthConnectionsRoute() string {
	return "/oauth/outgoing_connections"
}

func (c *Client4) outgoingOAuthConnectionRoute(id string) string {
	return fmt.Sprintf("%s/%s", c.outgoingOAuthConnectionsRoute(), id)
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
	return c.systemRoute() + "/timezones"
}

func (c *Client4) channelSchemeRoute(channelId string) string {
	return fmt.Sprintf(c.channelsRoute()+"/%v/scheme", channelId)
}

func (c *Client4) teamSchemeRoute(teamId string) string {
	return fmt.Sprintf(c.teamsRoute()+"/%v/scheme", teamId)
}

func (c *Client4) totalUsersStatsRoute() string {
	return c.usersRoute() + "/stats"
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

func (c *Client4) remoteClusterRoute() string {
	return "/remotecluster"
}

func (c *Client4) sharedChannelRemotesRoute(remoteId string) string {
	return fmt.Sprintf("%s/%s/sharedchannelremotes", c.remoteClusterRoute(), remoteId)
}

func (c *Client4) channelRemoteRoute(remoteId, channelId string) string {
	return fmt.Sprintf("%s/%s/channels/%s", c.remoteClusterRoute(), remoteId, channelId)
}

func (c *Client4) sharedChannelsRoute() string {
	return "/sharedchannels"
}

func (c *Client4) ipFiltersRoute() string {
	return "/ip_filtering"
}

func (c *Client4) permissionsRoute() string {
	return "/permissions"
}

func (c *Client4) limitsRoute() string {
	return "/limits"
}

func (c *Client4) customProfileAttributesRoute() string {
	return "/custom_profile_attributes"
}

func (c *Client4) userCustomProfileAttributesRoute(userID string) string {
	return fmt.Sprintf("%s/%s", c.userRoute(userID), c.customProfileAttributesRoute())
}

func (c *Client4) customProfileAttributeFieldsRoute() string {
	return fmt.Sprintf("%s/fields", c.customProfileAttributesRoute())
}

func (c *Client4) customProfileAttributeFieldRoute(fieldID string) string {
	return fmt.Sprintf("%s/%s", c.customProfileAttributeFieldsRoute(), fieldID)
}

func (c *Client4) customProfileAttributeValuesRoute() string {
	return fmt.Sprintf("%s/values", c.customProfileAttributesRoute())
}

func (c *Client4) GetServerLimits(ctx context.Context) (*ServerLimits, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.limitsRoute()+"/users", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var serverLimits ServerLimits
	if r.StatusCode == http.StatusNotModified {
		return &serverLimits, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&serverLimits); err != nil {
		return nil, nil, NewAppError("GetServerLimits", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &serverLimits, BuildResponse(r), nil
}

func (c *Client4) CreateScheduledPost(ctx context.Context, scheduledPost *ScheduledPost) (*ScheduledPost, *Response, error) {
	buf, err := json.Marshal(scheduledPost)
	if err != nil {
		return nil, nil, NewAppError("CreateScheduledPost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPost(ctx, c.postsRoute()+"/schedule", string(buf))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var createdScheduledPost ScheduledPost
	if err := json.NewDecoder(r.Body).Decode(&createdScheduledPost); err != nil {
		return nil, nil, NewAppError("CreateScheduledPost", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &createdScheduledPost, BuildResponse(r), nil
}

func (c *Client4) GetUserScheduledPosts(ctx context.Context, teamId string, includeDirectChannels bool) (map[string][]*ScheduledPost, *Response, error) {
	query := url.Values{}
	query.Set("includeDirectChannels", fmt.Sprintf("%t", includeDirectChannels))

	r, err := c.DoAPIGet(ctx, c.postsRoute()+"/scheduled/team/"+teamId+"?"+query.Encode(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var scheduledPostsByTeam map[string][]*ScheduledPost
	if err := json.NewDecoder(r.Body).Decode(&scheduledPostsByTeam); err != nil {
		return nil, nil, NewAppError("GetUserScheduledPosts", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return scheduledPostsByTeam, BuildResponse(r), nil
}

func (c *Client4) UpdateScheduledPost(ctx context.Context, scheduledPost *ScheduledPost) (*ScheduledPost, *Response, error) {
	buf, err := json.Marshal(scheduledPost)
	if err != nil {
		return nil, nil, NewAppError("UpdateScheduledPost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPut(ctx, c.postsRoute()+"/schedule/"+scheduledPost.Id, string(buf))
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	var updatedScheduledPost ScheduledPost
	if err := json.NewDecoder(r.Body).Decode(&updatedScheduledPost); err != nil {
		return nil, nil, NewAppError("UpdateScheduledPost", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &updatedScheduledPost, BuildResponse(r), nil
}

func (c *Client4) DeleteScheduledPost(ctx context.Context, scheduledPostId string) (*ScheduledPost, *Response, error) {
	r, err := c.DoAPIDelete(ctx, c.postsRoute()+"/schedule/"+scheduledPostId)
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	var deletedScheduledPost ScheduledPost
	if err := json.NewDecoder(r.Body).Decode(&deletedScheduledPost); err != nil {
		return nil, nil, NewAppError("DeleteScheduledPost", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &deletedScheduledPost, BuildResponse(r), nil
}

func (c *Client4) bookmarksRoute(channelId string) string {
	return c.channelRoute(channelId) + "/bookmarks"
}

func (c *Client4) bookmarkRoute(channelId, bookmarkId string) string {
	return fmt.Sprintf(c.bookmarksRoute(channelId)+"/%v", bookmarkId)
}

func (c *Client4) clientPerfMetricsRoute() string {
	return "/client_perf"
}

func (c *Client4) DoAPIGet(ctx context.Context, url string, etag string) (*http.Response, error) {
	return c.DoAPIRequest(ctx, http.MethodGet, c.APIURL+url, "", etag)
}

func (c *Client4) DoAPIPost(ctx context.Context, url string, data string) (*http.Response, error) {
	return c.DoAPIRequest(ctx, http.MethodPost, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIDeleteBytes(ctx context.Context, url string, data []byte) (*http.Response, error) {
	return c.DoAPIRequestBytes(ctx, http.MethodDelete, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIPatchBytes(ctx context.Context, url string, data []byte) (*http.Response, error) {
	return c.DoAPIRequestBytes(ctx, http.MethodPatch, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIPostBytes(ctx context.Context, url string, data []byte) (*http.Response, error) {
	return c.DoAPIRequestBytes(ctx, http.MethodPost, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIPut(ctx context.Context, url string, data string) (*http.Response, error) {
	return c.DoAPIRequest(ctx, http.MethodPut, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIPutBytes(ctx context.Context, url string, data []byte) (*http.Response, error) {
	return c.DoAPIRequestBytes(ctx, http.MethodPut, c.APIURL+url, data, "")
}

func (c *Client4) DoAPIDelete(ctx context.Context, url string) (*http.Response, error) {
	return c.DoAPIRequest(ctx, http.MethodDelete, c.APIURL+url, "", "")
}

func (c *Client4) DoAPIRequest(ctx context.Context, method, url, data, etag string) (*http.Response, error) {
	return c.DoAPIRequestReader(ctx, method, url, strings.NewReader(data), map[string]string{HeaderEtagClient: etag})
}

func (c *Client4) DoAPIRequestWithHeaders(ctx context.Context, method, url, data string, headers map[string]string) (*http.Response, error) {
	return c.DoAPIRequestReader(ctx, method, url, strings.NewReader(data), headers)
}

func (c *Client4) DoAPIRequestBytes(ctx context.Context, method, url string, data []byte, etag string) (*http.Response, error) {
	return c.DoAPIRequestReader(ctx, method, url, bytes.NewReader(data), map[string]string{HeaderEtagClient: etag})
}

func (c *Client4) DoAPIRequestReader(ctx context.Context, method, url string, data io.Reader, headers map[string]string) (*http.Response, error) {
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

func (c *Client4) DoUploadFile(ctx context.Context, url string, data []byte, contentType string) (*FileUploadResponse, *Response, error) {
	return c.doUploadFile(ctx, url, bytes.NewReader(data), contentType, 0)
}

func (c *Client4) doUploadFile(ctx context.Context, url string, body io.Reader, contentType string, contentLength int64) (*FileUploadResponse, *Response, error) {
	rq, err := http.NewRequestWithContext(ctx, "POST", c.APIURL+url, body)
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

func (c *Client4) DoEmojiUploadFile(ctx context.Context, url string, data []byte, contentType string) (*Emoji, *Response, error) {
	rq, err := http.NewRequestWithContext(ctx, "POST", c.APIURL+url, bytes.NewReader(data))
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

func (c *Client4) DoUploadImportTeam(ctx context.Context, url string, data []byte, contentType string) (map[string]string, *Response, error) {
	rq, err := http.NewRequestWithContext(ctx, "POST", c.APIURL+url, bytes.NewReader(data))
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
	r, err := c.DoAPIPost(ctx, "/users/login", MapToJSON(m))
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

func (c *Client4) LoginWithDesktopToken(ctx context.Context, token, deviceId string) (*User, *Response, error) {
	m := make(map[string]string)
	m["token"] = token
	m["deviceId"] = deviceId
	r, err := c.DoAPIPost(ctx, "/users/login/desktop_token", MapToJSON(m))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	c.AuthToken = r.Header.Get(HeaderToken)
	c.AuthType = HeaderBearer

	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		return nil, nil, NewAppError("loginWithDesktopToken", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &user, BuildResponse(r), nil
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
	buf, err := json.Marshal(switchRequest)
	if err != nil {
		return "", BuildResponse(nil), NewAppError("SwitchAccountType", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.usersRoute()+"/login/switch", buf)
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["follow_link"], BuildResponse(r), nil
}

// User Section

// CreateUser creates a user in the system based on the provided user struct.
func (c *Client4) CreateUser(ctx context.Context, user *User) (*User, *Response, error) {
	userJSON, err := json.Marshal(user)
	if err != nil {
		return nil, nil, NewAppError("CreateUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPost(ctx, c.usersRoute(), string(userJSON))
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
func (c *Client4) CreateUserWithToken(ctx context.Context, user *User, tokenId string) (*User, *Response, error) {
	if tokenId == "" {
		return nil, nil, NewAppError("MissingHashOrData", "api.user.create_user.missing_token.app_error", nil, "", http.StatusBadRequest)
	}

	query := "?t=" + tokenId
	buf, err := json.Marshal(user)
	if err != nil {
		return nil, nil, NewAppError("CreateUserWithToken", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.usersRoute()+query, buf)
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
func (c *Client4) CreateUserWithInviteId(ctx context.Context, user *User, inviteId string) (*User, *Response, error) {
	if inviteId == "" {
		return nil, nil, NewAppError("MissingInviteId", "api.user.create_user.missing_invite_id.app_error", nil, "", http.StatusBadRequest)
	}

	query := "?iid=" + url.QueryEscape(inviteId)
	buf, err := json.Marshal(user)
	if err != nil {
		return nil, nil, NewAppError("CreateUserWithInviteId", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.usersRoute()+query, buf)
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
func (c *Client4) GetMe(ctx context.Context, etag string) (*User, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(Me), etag)
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
func (c *Client4) GetUser(ctx context.Context, userId, etag string) (*User, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userId), etag)
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
func (c *Client4) GetUserByUsername(ctx context.Context, userName, etag string) (*User, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userByUsernameRoute(userName), etag)
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
func (c *Client4) GetUserByEmail(ctx context.Context, email, etag string) (*User, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userByEmailRoute(email), etag)
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
func (c *Client4) AutocompleteUsersInTeam(ctx context.Context, teamId string, username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&name=%v&limit=%d", teamId, username, limit)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+"/autocomplete"+query, etag)
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
func (c *Client4) AutocompleteUsersInChannel(ctx context.Context, teamId string, channelId string, username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&in_channel=%v&name=%v&limit=%d", teamId, channelId, username, limit)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+"/autocomplete"+query, etag)
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
func (c *Client4) AutocompleteUsers(ctx context.Context, username string, limit int, etag string) (*UserAutocomplete, *Response, error) {
	query := fmt.Sprintf("?name=%v&limit=%d", username, limit)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+"/autocomplete"+query, etag)
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
func (c *Client4) GetDefaultProfileImage(ctx context.Context, userId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/image/default", "")
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
func (c *Client4) GetProfileImage(ctx context.Context, userId, etag string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/image", etag)
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
func (c *Client4) GetUsers(ctx context.Context, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
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

// GetUsersWithCustomQueryParameters returns a page of users on the system. Page counting starts at 0.
func (c *Client4) GetUsersWithCustomQueryParameters(ctx context.Context, page int, perPage int, queryParameters, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&%v", page, perPage, queryParameters)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersWithCustomQueryParameters", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetUsersInTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
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
func (c *Client4) GetNewUsersInTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?sort=create_at&in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
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
func (c *Client4) GetRecentlyActiveUsersInTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?sort=last_activity_at&in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
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
func (c *Client4) GetActiveUsersInTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?active=true&in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
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
func (c *Client4) GetUsersNotInTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?not_in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
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
func (c *Client4) GetUsersInChannel(ctx context.Context, channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_channel=%v&page=%v&per_page=%v", channelId, page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
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
func (c *Client4) GetUsersInChannelByStatus(ctx context.Context, channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_channel=%v&page=%v&per_page=%v&sort=status", channelId, page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
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
func (c *Client4) GetUsersNotInChannel(ctx context.Context, teamId, channelId string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_team=%v&not_in_channel=%v&page=%v&per_page=%v", teamId, channelId, page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
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
func (c *Client4) GetUsersWithoutTeam(ctx context.Context, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?without_team=1&page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
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
func (c *Client4) GetUsersInGroup(ctx context.Context, groupID string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?in_group=%v&page=%v&per_page=%v", groupID, page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
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

// GetUsersInGroup returns a page of users in a group. Page counting starts at 0.
func (c *Client4) GetUsersInGroupByDisplayName(ctx context.Context, groupID string, page int, perPage int, etag string) ([]*User, *Response, error) {
	query := fmt.Sprintf("?sort=display_name&in_group=%v&page=%v&per_page=%v", groupID, page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*User
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersInGroupByDisplayName", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetUsersByIds returns a list of users based on the provided user ids.
func (c *Client4) GetUsersByIds(ctx context.Context, userIds []string) ([]*User, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/ids", ArrayToJSON(userIds))
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
func (c *Client4) GetUsersByIdsWithOptions(ctx context.Context, userIds []string, options *UserGetByIdsOptions) ([]*User, *Response, error) {
	v := url.Values{}
	if options.Since != 0 {
		v.Set("since", fmt.Sprintf("%d", options.Since))
	}

	url := c.usersRoute() + "/ids"
	if len(v) > 0 {
		url += "?" + v.Encode()
	}

	r, err := c.DoAPIPost(ctx, url, ArrayToJSON(userIds))
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
func (c *Client4) GetUsersByUsernames(ctx context.Context, usernames []string) ([]*User, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/usernames", ArrayToJSON(usernames))
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
func (c *Client4) GetUsersByGroupChannelIds(ctx context.Context, groupChannelIds []string) (map[string][]*User, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/group_channels", ArrayToJSON(groupChannelIds))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	usersByChannelId := map[string][]*User{}
	json.NewDecoder(r.Body).Decode(&usersByChannelId)
	return usersByChannelId, BuildResponse(r), nil
}

// SearchUsers returns a list of users based on some search criteria.
func (c *Client4) SearchUsers(ctx context.Context, search *UserSearch) ([]*User, *Response, error) {
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchUsers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.usersRoute()+"/search", buf)
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
func (c *Client4) UpdateUser(ctx context.Context, user *User) (*User, *Response, error) {
	buf, err := json.Marshal(user)
	if err != nil {
		return nil, nil, NewAppError("UpdateUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.userRoute(user.Id), buf)
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
func (c *Client4) PatchUser(ctx context.Context, userId string, patch *UserPatch) (*User, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.userRoute(userId)+"/patch", buf)
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
func (c *Client4) UpdateUserAuth(ctx context.Context, userId string, userAuth *UserAuth) (*UserAuth, *Response, error) {
	buf, err := json.Marshal(userAuth)
	if err != nil {
		return nil, nil, NewAppError("UpdateUserAuth", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.userRoute(userId)+"/auth", buf)
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
func (c *Client4) UpdateUserMfa(ctx context.Context, userId, code string, activate bool) (*Response, error) {
	requestBody := make(map[string]any)
	requestBody["activate"] = activate
	requestBody["code"] = code

	r, err := c.DoAPIPut(ctx, c.userRoute(userId)+"/mfa", StringInterfaceToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GenerateMfaSecret will generate a new MFA secret for a user and return it as a string and
// as a base64 encoded image QR code.
func (c *Client4) GenerateMfaSecret(ctx context.Context, userId string) (*MfaSecret, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.userRoute(userId)+"/mfa/generate", "")
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
func (c *Client4) UpdateUserPassword(ctx context.Context, userId, currentPassword, newPassword string) (*Response, error) {
	requestBody := map[string]string{"current_password": currentPassword, "new_password": newPassword}
	r, err := c.DoAPIPut(ctx, c.userRoute(userId)+"/password", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateUserHashedPassword updates a user's password with an already-hashed password. Must be a system administrator.
func (c *Client4) UpdateUserHashedPassword(ctx context.Context, userId, newHashedPassword string) (*Response, error) {
	requestBody := map[string]string{"already_hashed": "true", "new_password": newHashedPassword}
	r, err := c.DoAPIPut(ctx, c.userRoute(userId)+"/password", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PromoteGuestToUser convert a guest into a regular user
func (c *Client4) PromoteGuestToUser(ctx context.Context, guestId string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.userRoute(guestId)+"/promote", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DemoteUserToGuest convert a regular user into a guest
func (c *Client4) DemoteUserToGuest(ctx context.Context, guestId string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.userRoute(guestId)+"/demote", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateUserRoles updates a user's roles in the system. A user can have "system_user" and "system_admin" roles.
func (c *Client4) UpdateUserRoles(ctx context.Context, userId, roles string) (*Response, error) {
	requestBody := map[string]string{"roles": roles}
	r, err := c.DoAPIPut(ctx, c.userRoute(userId)+"/roles", MapToJSON(requestBody))
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
	r, err := c.DoAPIPut(ctx, c.userRoute(userId)+"/active", StringInterfaceToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

// ResetFailedAttempts resets the number of failed attempts for a user.
func (c *Client4) ResetFailedAttempts(ctx context.Context, userId string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.userRoute(userId)+"/reset_failed_attempts", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteUser deactivates a user in the system based on the provided user id string.
func (c *Client4) DeleteUser(ctx context.Context, userId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.userRoute(userId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PermanentDeleteUser deletes a user in the system based on the provided user id string.
func (c *Client4) PermanentDeleteUser(ctx context.Context, userId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.userRoute(userId)+"?permanent="+c.boolString(true))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ConvertUserToBot converts a user to a bot user.
func (c *Client4) ConvertUserToBot(ctx context.Context, userId string) (*Bot, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.userRoute(userId)+"/convert_to_bot", "")
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
func (c *Client4) ConvertBotToUser(ctx context.Context, userId string, userPatch *UserPatch, setSystemAdmin bool) (*User, *Response, error) {
	var query string
	if setSystemAdmin {
		query = "?set_system_admin=true"
	}
	buf, err := json.Marshal(userPatch)
	if err != nil {
		return nil, nil, NewAppError("ConvertBotToUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.botRoute(userId)+"/convert_to_user"+query, buf)
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
func (c *Client4) PermanentDeleteAllUsers(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.usersRoute())
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
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/password/reset/send", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ResetPassword uses a recovery code to update reset a user's password.
func (c *Client4) ResetPassword(ctx context.Context, token, newPassword string) (*Response, error) {
	requestBody := map[string]string{"token": token, "new_password": newPassword}
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/password/reset", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetSessions returns a list of sessions based on the provided user id string.
func (c *Client4) GetSessions(ctx context.Context, userId, etag string) ([]*Session, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/sessions", etag)
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
func (c *Client4) RevokeSession(ctx context.Context, userId, sessionId string) (*Response, error) {
	requestBody := map[string]string{"session_id": sessionId}
	r, err := c.DoAPIPost(ctx, c.userRoute(userId)+"/sessions/revoke", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RevokeAllSessions revokes all sessions for the provided user id string.
func (c *Client4) RevokeAllSessions(ctx context.Context, userId string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.userRoute(userId)+"/sessions/revoke/all", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RevokeAllSessions revokes all sessions for all the users.
func (c *Client4) RevokeSessionsFromAllUsers(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/sessions/revoke/all", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AttachDeviceProps attaches a mobile device ID to the current session and other props.
func (c *Client4) AttachDeviceProps(ctx context.Context, newProps map[string]string) (*Response, error) {
	r, err := c.DoAPIPut(ctx, c.usersRoute()+"/sessions/device", MapToJSON(newProps))
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
	query := url.Values{}

	if teamIdToExclude != "" {
		query.Set("exclude_team", teamIdToExclude)
	}

	if includeCollapsedThreads {
		query.Set("include_collapsed_threads", "true")
	}

	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/teams/unread?"+query.Encode(), "")
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
func (c *Client4) GetUserAudits(ctx context.Context, userId string, page int, perPage int, etag string) (Audits, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/audits"+query, etag)
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
func (c *Client4) VerifyUserEmail(ctx context.Context, token string) (*Response, error) {
	requestBody := map[string]string{"token": token}
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/email/verify", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// VerifyUserEmailWithoutToken will verify a user's email by its Id. (Requires manage system role)
func (c *Client4) VerifyUserEmailWithoutToken(ctx context.Context, userId string) (*User, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.userRoute(userId)+"/email/verify/member", "")
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
func (c *Client4) SendVerificationEmail(ctx context.Context, email string) (*Response, error) {
	requestBody := map[string]string{"email": email}
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/email/verify/send", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SetDefaultProfileImage resets the profile image to a default generated one.
func (c *Client4) SetDefaultProfileImage(ctx context.Context, userId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.userRoute(userId)+"/image")
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
		return nil, NewAppError("SetProfileImage", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, NewAppError("SetProfileImage", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if err = writer.Close(); err != nil {
		return nil, NewAppError("SetProfileImage", "model.client.set_profile_user.writer.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	rq, err := http.NewRequestWithContext(ctx, "POST", c.APIURL+c.userRoute(userId)+"/image", bytes.NewReader(body.Bytes()))
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
func (c *Client4) CreateUserAccessToken(ctx context.Context, userId, description string) (*UserAccessToken, *Response, error) {
	requestBody := map[string]string{"description": description}
	r, err := c.DoAPIPost(ctx, c.userRoute(userId)+"/tokens", MapToJSON(requestBody))
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
func (c *Client4) GetUserAccessTokens(ctx context.Context, page int, perPage int) ([]*UserAccessToken, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.userAccessTokensRoute()+query, "")
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
func (c *Client4) GetUserAccessToken(ctx context.Context, tokenId string) (*UserAccessToken, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userAccessTokenRoute(tokenId), "")
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
func (c *Client4) GetUserAccessTokensForUser(ctx context.Context, userId string, page, perPage int) ([]*UserAccessToken, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/tokens"+query, "")
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
func (c *Client4) RevokeUserAccessToken(ctx context.Context, tokenId string) (*Response, error) {
	requestBody := map[string]string{"token_id": tokenId}
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/tokens/revoke", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SearchUserAccessTokens returns user access tokens matching the provided search term.
func (c *Client4) SearchUserAccessTokens(ctx context.Context, search *UserAccessTokenSearch) ([]*UserAccessToken, *Response, error) {
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchUserAccessTokens", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.usersRoute()+"/tokens/search", buf)
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
func (c *Client4) DisableUserAccessToken(ctx context.Context, tokenId string) (*Response, error) {
	requestBody := map[string]string{"token_id": tokenId}
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/tokens/disable", MapToJSON(requestBody))
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
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/tokens/enable", MapToJSON(requestBody))
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

	r, err := c.DoAPIGet(ctx, c.reportsRoute()+"/users?"+values.Encode(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*UserReport
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetUsersForReporting", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// Bots section

// CreateBot creates a bot in the system based on the provided bot struct.
func (c *Client4) CreateBot(ctx context.Context, bot *Bot) (*Bot, *Response, error) {
	buf, err := json.Marshal(bot)
	if err != nil {
		return nil, nil, NewAppError("CreateBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.botsRoute(), buf)
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
func (c *Client4) PatchBot(ctx context.Context, userId string, patch *BotPatch) (*Bot, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchBot", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.botRoute(userId), buf)
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
func (c *Client4) GetBot(ctx context.Context, userId string, etag string) (*Bot, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.botRoute(userId), etag)
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
func (c *Client4) GetBotIncludeDeleted(ctx context.Context, userId string, etag string) (*Bot, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.botRoute(userId)+"?include_deleted="+c.boolString(true), etag)
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
func (c *Client4) GetBots(ctx context.Context, page, perPage int, etag string) ([]*Bot, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.botsRoute()+query, etag)
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
func (c *Client4) GetBotsIncludeDeleted(ctx context.Context, page, perPage int, etag string) ([]*Bot, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_deleted="+c.boolString(true), page, perPage)
	r, err := c.DoAPIGet(ctx, c.botsRoute()+query, etag)
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
func (c *Client4) GetBotsOrphaned(ctx context.Context, page, perPage int, etag string) ([]*Bot, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&only_orphaned="+c.boolString(true), page, perPage)
	r, err := c.DoAPIGet(ctx, c.botsRoute()+query, etag)
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
func (c *Client4) DisableBot(ctx context.Context, botUserId string) (*Bot, *Response, error) {
	r, err := c.DoAPIPostBytes(ctx, c.botRoute(botUserId)+"/disable", nil)
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
func (c *Client4) EnableBot(ctx context.Context, botUserId string) (*Bot, *Response, error) {
	r, err := c.DoAPIPostBytes(ctx, c.botRoute(botUserId)+"/enable", nil)
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
func (c *Client4) AssignBot(ctx context.Context, botUserId, newOwnerId string) (*Bot, *Response, error) {
	r, err := c.DoAPIPostBytes(ctx, c.botRoute(botUserId)+"/assign/"+newOwnerId, nil)
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
func (c *Client4) CreateTeam(ctx context.Context, team *Team) (*Team, *Response, error) {
	buf, err := json.Marshal(team)
	if err != nil {
		return nil, nil, NewAppError("CreateTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.teamsRoute(), buf)
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
func (c *Client4) GetTeam(ctx context.Context, teamId, etag string) (*Team, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.teamRoute(teamId), etag)
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
func (c *Client4) GetAllTeams(ctx context.Context, etag string, page int, perPage int) ([]*Team, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.teamsRoute()+query, etag)
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
func (c *Client4) GetAllTeamsWithTotalCount(ctx context.Context, etag string, page int, perPage int) ([]*Team, int64, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_total_count="+c.boolString(true), page, perPage)
	r, err := c.DoAPIGet(ctx, c.teamsRoute()+query, etag)
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
func (c *Client4) GetAllTeamsExcludePolicyConstrained(ctx context.Context, etag string, page int, perPage int) ([]*Team, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&exclude_policy_constrained=%v", page, perPage, true)
	r, err := c.DoAPIGet(ctx, c.teamsRoute()+query, etag)
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
func (c *Client4) GetTeamByName(ctx context.Context, name, etag string) (*Team, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.teamByNameRoute(name), etag)
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
func (c *Client4) SearchTeams(ctx context.Context, search *TeamSearch) ([]*Team, *Response, error) {
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchTeams", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.teamsRoute()+"/search", buf)
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
func (c *Client4) SearchTeamsPaged(ctx context.Context, search *TeamSearch) ([]*Team, int64, *Response, error) {
	if search.Page == nil {
		search.Page = NewPointer(0)
	}
	if search.PerPage == nil {
		search.PerPage = NewPointer(100)
	}
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, 0, BuildResponse(nil), NewAppError("SearchTeamsPaged", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.teamsRoute()+"/search", buf)
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
func (c *Client4) TeamExists(ctx context.Context, name, etag string) (bool, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.teamByNameRoute(name)+"/exists", etag)
	if err != nil {
		return false, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapBoolFromJSON(r.Body)["exists"], BuildResponse(r), nil
}

// GetTeamsForUser returns a list of teams a user is on. Must be logged in as the user
// or be a system administrator.
func (c *Client4) GetTeamsForUser(ctx context.Context, userId, etag string) ([]*Team, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/teams", etag)
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
func (c *Client4) GetTeamMember(ctx context.Context, teamId, userId, etag string) (*TeamMember, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.teamMemberRoute(teamId, userId), etag)
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
func (c *Client4) UpdateTeamMemberRoles(ctx context.Context, teamId, userId, newRoles string) (*Response, error) {
	requestBody := map[string]string{"roles": newRoles}
	r, err := c.DoAPIPut(ctx, c.teamMemberRoute(teamId, userId)+"/roles", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateTeamMemberSchemeRoles will update the scheme-derived roles on a team for a user.
func (c *Client4) UpdateTeamMemberSchemeRoles(ctx context.Context, teamId string, userId string, schemeRoles *SchemeRoles) (*Response, error) {
	buf, err := json.Marshal(schemeRoles)
	if err != nil {
		return nil, NewAppError("UpdateTeamMemberSchemeRoles", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.teamMemberRoute(teamId, userId)+"/schemeRoles", buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateTeam will update a team.
func (c *Client4) UpdateTeam(ctx context.Context, team *Team) (*Team, *Response, error) {
	buf, err := json.Marshal(team)
	if err != nil {
		return nil, nil, NewAppError("UpdateTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.teamRoute(team.Id), buf)
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
func (c *Client4) PatchTeam(ctx context.Context, teamId string, patch *TeamPatch) (*Team, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.teamRoute(teamId)+"/patch", buf)
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
func (c *Client4) RestoreTeam(ctx context.Context, teamId string) (*Team, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.teamRoute(teamId)+"/restore", "")
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
func (c *Client4) RegenerateTeamInviteId(ctx context.Context, teamId string) (*Team, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.teamRoute(teamId)+"/regenerate_invite_id", "")
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
func (c *Client4) SoftDeleteTeam(ctx context.Context, teamId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.teamRoute(teamId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PermanentDeleteTeam deletes the team, should only be used when needed for
// compliance and the like.
func (c *Client4) PermanentDeleteTeam(ctx context.Context, teamId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.teamRoute(teamId)+"?permanent="+c.boolString(true))
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
	r, err := c.DoAPIPut(ctx, c.teamRoute(teamId)+"/privacy", MapToJSON(requestBody))
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
func (c *Client4) GetTeamMembers(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*TeamMember, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.teamMembersRoute(teamId)+query, etag)
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
func (c *Client4) GetTeamMembersSortAndWithoutDeletedUsers(ctx context.Context, teamId string, page int, perPage int, sort string, excludeDeletedUsers bool, etag string) ([]*TeamMember, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&sort=%v&exclude_deleted_users=%v", page, perPage, sort, excludeDeletedUsers)
	r, err := c.DoAPIGet(ctx, c.teamMembersRoute(teamId)+query, etag)
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
func (c *Client4) GetTeamMembersForUser(ctx context.Context, userId string, etag string) ([]*TeamMember, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/teams/members", etag)
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
func (c *Client4) GetTeamMembersByIds(ctx context.Context, teamId string, userIds []string) ([]*TeamMember, *Response, error) {
	r, err := c.DoAPIPost(ctx, fmt.Sprintf("/teams/%v/members/ids", teamId), ArrayToJSON(userIds))
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
func (c *Client4) AddTeamMember(ctx context.Context, teamId, userId string) (*TeamMember, *Response, error) {
	member := &TeamMember{TeamId: teamId, UserId: userId}
	buf, err := json.Marshal(member)
	if err != nil {
		return nil, nil, NewAppError("AddTeamMember", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.teamMembersRoute(teamId), buf)
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
func (c *Client4) AddTeamMemberFromInvite(ctx context.Context, token, inviteId string) (*TeamMember, *Response, error) {
	var query string

	if inviteId != "" {
		query += fmt.Sprintf("?invite_id=%v", inviteId)
	}

	if token != "" {
		query += fmt.Sprintf("?token=%v", token)
	}

	r, err := c.DoAPIPost(ctx, c.teamsRoute()+"/members/invite"+query, "")
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
func (c *Client4) AddTeamMembers(ctx context.Context, teamId string, userIds []string) ([]*TeamMember, *Response, error) {
	var members []*TeamMember
	for _, userId := range userIds {
		member := &TeamMember{TeamId: teamId, UserId: userId}
		members = append(members, member)
	}
	js, err := json.Marshal(members)
	if err != nil {
		return nil, nil, NewAppError("AddTeamMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.teamMembersRoute(teamId)+"/batch", string(js))
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
func (c *Client4) AddTeamMembersGracefully(ctx context.Context, teamId string, userIds []string) ([]*TeamMemberWithError, *Response, error) {
	var members []*TeamMember
	for _, userId := range userIds {
		member := &TeamMember{TeamId: teamId, UserId: userId}
		members = append(members, member)
	}
	js, err := json.Marshal(members)
	if err != nil {
		return nil, nil, NewAppError("AddTeamMembersGracefully", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPost(ctx, c.teamMembersRoute(teamId)+"/batch?graceful="+c.boolString(true), string(js))
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
func (c *Client4) RemoveTeamMember(ctx context.Context, teamId, userId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.teamMemberRoute(teamId, userId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTeamStats returns a team stats based on the team id string.
// Must be authenticated.
func (c *Client4) GetTeamStats(ctx context.Context, teamId, etag string) (*TeamStats, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.teamStatsRoute(teamId), etag)
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
func (c *Client4) GetTotalUsersStats(ctx context.Context, etag string) (*UsersStats, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.totalUsersStatsRoute(), etag)
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
func (c *Client4) GetTeamUnread(ctx context.Context, teamId, userId string) (*TeamUnread, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+c.teamRoute(teamId)+"/unread", "")
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

	if _, err := io.Copy(part, strings.NewReader(importFrom)); err != nil {
		return nil, nil, err
	}

	if err := writer.Close(); err != nil {
		return nil, nil, err
	}

	return c.DoUploadImportTeam(ctx, c.teamImportRoute(teamId), body.Bytes(), writer.FormDataContentType())
}

// InviteUsersToTeam invite users by email to the team.
func (c *Client4) InviteUsersToTeam(ctx context.Context, teamId string, userEmails []string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.teamRoute(teamId)+"/invite/email", ArrayToJSON(userEmails))
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
	buf, err := json.Marshal(guestsInvite)
	if err != nil {
		return nil, NewAppError("InviteGuestsToTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.teamRoute(teamId)+"/invite-guests/email", buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// InviteUsersToTeam invite users by email to the team.
func (c *Client4) InviteUsersToTeamGracefully(ctx context.Context, teamId string, userEmails []string) ([]*EmailInviteWithError, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.teamRoute(teamId)+"/invite/email?graceful="+c.boolString(true), ArrayToJSON(userEmails))

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
func (c *Client4) InviteUsersToTeamAndChannelsGracefully(ctx context.Context, teamId string, userEmails []string, channelIds []string, message string) ([]*EmailInviteWithError, *Response, error) {
	memberInvite := MemberInvite{
		Emails:     userEmails,
		ChannelIds: channelIds,
		Message:    message,
	}
	buf, err := json.Marshal(memberInvite)
	if err != nil {
		return nil, nil, NewAppError("InviteMembersToTeamAndChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.teamRoute(teamId)+"/invite/email?graceful="+c.boolString(true), buf)
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
func (c *Client4) InviteGuestsToTeamGracefully(ctx context.Context, teamId string, userEmails []string, channels []string, message string) ([]*EmailInviteWithError, *Response, error) {
	guestsInvite := GuestsInvite{
		Emails:   userEmails,
		Channels: channels,
		Message:  message,
	}
	buf, err := json.Marshal(guestsInvite)
	if err != nil {
		return nil, nil, NewAppError("InviteGuestsToTeamGracefully", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.teamRoute(teamId)+"/invite-guests/email?graceful="+c.boolString(true), buf)
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
func (c *Client4) InvalidateEmailInvites(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.teamsRoute()+"/invites/email")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTeamInviteInfo returns a team object from an invite id containing sanitized information.
func (c *Client4) GetTeamInviteInfo(ctx context.Context, inviteId string) (*Team, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.teamsRoute()+"/invite/"+inviteId, "")
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
func (c *Client4) SetTeamIcon(ctx context.Context, teamId string, data []byte) (*Response, error) {
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

	rq, err := http.NewRequestWithContext(ctx, "POST", c.APIURL+c.teamRoute(teamId)+"/image", bytes.NewReader(body.Bytes()))
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
func (c *Client4) GetTeamIcon(ctx context.Context, teamId, etag string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.teamRoute(teamId)+"/image", etag)
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
func (c *Client4) RemoveTeamIcon(ctx context.Context, teamId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.teamRoute(teamId)+"/image")
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
	query := fmt.Sprintf("?page=%v&per_page=%v&include_deleted=%v&exclude_policy_constrained=%v",
		page, perPage, opts.IncludeDeleted, opts.ExcludePolicyConstrained)
	r, err := c.DoAPIGet(ctx, c.channelsRoute()+query, etag)
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
func (c *Client4) GetAllChannelsWithCount(ctx context.Context, page int, perPage int, etag string) (ChannelListWithTeamData, int64, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_total_count="+c.boolString(true), page, perPage)
	r, err := c.DoAPIGet(ctx, c.channelsRoute()+query, etag)
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
func (c *Client4) CreateChannel(ctx context.Context, channel *Channel) (*Channel, *Response, error) {
	channelJSON, err := json.Marshal(channel)
	if err != nil {
		return nil, nil, NewAppError("CreateChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.channelsRoute(), string(channelJSON))
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
func (c *Client4) UpdateChannel(ctx context.Context, channel *Channel) (*Channel, *Response, error) {
	channelJSON, err := json.Marshal(channel)
	if err != nil {
		return nil, nil, NewAppError("UpdateChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPut(ctx, c.channelRoute(channel.Id), string(channelJSON))
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
func (c *Client4) PatchChannel(ctx context.Context, channelId string, patch *ChannelPatch) (*Channel, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.channelRoute(channelId)+"/patch", buf)
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
func (c *Client4) UpdateChannelPrivacy(ctx context.Context, channelId string, privacy ChannelType) (*Channel, *Response, error) {
	requestBody := map[string]string{"privacy": string(privacy)}
	r, err := c.DoAPIPut(ctx, c.channelRoute(channelId)+"/privacy", MapToJSON(requestBody))
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
func (c *Client4) RestoreChannel(ctx context.Context, channelId string) (*Channel, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.channelRoute(channelId)+"/restore", "")
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
func (c *Client4) CreateDirectChannel(ctx context.Context, userId1, userId2 string) (*Channel, *Response, error) {
	requestBody := []string{userId1, userId2}
	r, err := c.DoAPIPost(ctx, c.channelsRoute()+"/direct", ArrayToJSON(requestBody))
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
func (c *Client4) CreateGroupChannel(ctx context.Context, userIds []string) (*Channel, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.channelsRoute()+"/group", ArrayToJSON(userIds))
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
func (c *Client4) GetChannel(ctx context.Context, channelId, etag string) (*Channel, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.channelRoute(channelId), etag)
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
func (c *Client4) GetChannelStats(ctx context.Context, channelId string, etag string, excludeFilesCount bool) (*ChannelStats, *Response, error) {
	route := c.channelRoute(channelId) + fmt.Sprintf("/stats?exclude_files_count=%v", excludeFilesCount)
	r, err := c.DoAPIGet(ctx, route, etag)
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

// GetChannelsMemberCount get channel member count for a given array of channel ids
func (c *Client4) GetChannelsMemberCount(ctx context.Context, channelIDs []string) (map[string]int64, *Response, error) {
	route := c.channelsRoute() + "/stats/member_count"
	r, err := c.DoAPIPost(ctx, route, ArrayToJSON(channelIDs))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var counts map[string]int64
	if err := json.NewDecoder(r.Body).Decode(&counts); err != nil {
		return nil, nil, NewAppError("GetChannelsMemberCount", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return counts, BuildResponse(r), nil
}

// GetChannelMembersTimezones gets a list of timezones for a channel.
func (c *Client4) GetChannelMembersTimezones(ctx context.Context, channelId string) ([]string, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.channelRoute(channelId)+"/timezones", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return c.ArrayFromJSON(r.Body), BuildResponse(r), nil
}

// GetPinnedPosts gets a list of pinned posts.
func (c *Client4) GetPinnedPosts(ctx context.Context, channelId string, etag string) (*PostList, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.channelRoute(channelId)+"/pinned", etag)
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
func (c *Client4) GetPrivateChannelsForTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	query := fmt.Sprintf("/private?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.channelsForTeamRoute(teamId)+query, etag)
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
func (c *Client4) GetPublicChannelsForTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.channelsForTeamRoute(teamId)+query, etag)
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
func (c *Client4) GetDeletedChannelsForTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*Channel, *Response, error) {
	query := fmt.Sprintf("/deleted?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.channelsForTeamRoute(teamId)+query, etag)
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
func (c *Client4) GetPublicChannelsByIdsForTeam(ctx context.Context, teamId string, channelIds []string) ([]*Channel, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.channelsForTeamRoute(teamId)+"/ids", ArrayToJSON(channelIds))
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
func (c *Client4) GetChannelsForTeamForUser(ctx context.Context, teamId, userId string, includeDeleted bool, etag string) ([]*Channel, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.channelsForTeamForUserRoute(teamId, userId, includeDeleted), etag)
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
func (c *Client4) GetChannelsForTeamAndUserWithLastDeleteAt(ctx context.Context, teamId, userId string, includeDeleted bool, lastDeleteAt int, etag string) ([]*Channel, *Response, error) {
	route := c.userRoute(userId) + c.teamRoute(teamId) + "/channels"
	route += fmt.Sprintf("?include_deleted=%v&last_delete_at=%d", includeDeleted, lastDeleteAt)
	r, err := c.DoAPIGet(ctx, route, etag)
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
func (c *Client4) GetChannelsForUserWithLastDeleteAt(ctx context.Context, userID string, lastDeleteAt int) ([]*Channel, *Response, error) {
	route := c.userRoute(userID) + "/channels"
	route += fmt.Sprintf("?last_delete_at=%d", lastDeleteAt)
	r, err := c.DoAPIGet(ctx, route, "")
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
func (c *Client4) SearchChannels(ctx context.Context, teamId string, search *ChannelSearch) ([]*Channel, *Response, error) {
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.channelsForTeamRoute(teamId)+"/search", string(searchJSON))
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
func (c *Client4) SearchArchivedChannels(ctx context.Context, teamId string, search *ChannelSearch) ([]*Channel, *Response, error) {
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchArchivedChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.channelsForTeamRoute(teamId)+"/search_archived", string(searchJSON))
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
func (c *Client4) SearchAllChannels(ctx context.Context, search *ChannelSearch) (ChannelListWithTeamData, *Response, error) {
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchAllChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.channelsRoute()+"/search", string(searchJSON))
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
func (c *Client4) SearchAllChannelsForUser(ctx context.Context, term string) (ChannelListWithTeamData, *Response, error) {
	search := &ChannelSearch{
		Term: term,
	}
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchAllChannelsForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.channelsRoute()+"/search?system_console=false", string(searchJSON))
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
func (c *Client4) SearchAllChannelsPaged(ctx context.Context, search *ChannelSearch) (*ChannelsWithCount, *Response, error) {
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchAllChannelsPaged", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.channelsRoute()+"/search", string(searchJSON))
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
func (c *Client4) SearchGroupChannels(ctx context.Context, search *ChannelSearch) ([]*Channel, *Response, error) {
	searchJSON, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchGroupChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.channelsRoute()+"/group/search", string(searchJSON))
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
func (c *Client4) DeleteChannel(ctx context.Context, channelId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.channelRoute(channelId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PermanentDeleteChannel deletes a channel based on the provided channel id string.
func (c *Client4) PermanentDeleteChannel(ctx context.Context, channelId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.channelRoute(channelId)+"?permanent="+c.boolString(true))
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
	r, err := c.DoAPIPost(ctx, c.channelRoute(channelId)+"/move", StringInterfaceToJSON(requestBody))
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
func (c *Client4) GetChannelByName(ctx context.Context, channelName, teamId string, etag string) (*Channel, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.channelByNameRoute(channelName, teamId), etag)
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
func (c *Client4) GetChannelByNameIncludeDeleted(ctx context.Context, channelName, teamId string, etag string) (*Channel, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.channelByNameRoute(channelName, teamId)+"?include_deleted="+c.boolString(true), etag)
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
func (c *Client4) GetChannelByNameForTeamName(ctx context.Context, channelName, teamName string, etag string) (*Channel, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.channelByNameForTeamNameRoute(channelName, teamName), etag)
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
func (c *Client4) GetChannelByNameForTeamNameIncludeDeleted(ctx context.Context, channelName, teamName string, etag string) (*Channel, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.channelByNameForTeamNameRoute(channelName, teamName)+"?include_deleted="+c.boolString(true), etag)
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
func (c *Client4) GetChannelMembers(ctx context.Context, channelId string, page, perPage int, etag string) (ChannelMembers, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.channelMembersRoute(channelId)+query, etag)
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
func (c *Client4) GetChannelMembersWithTeamData(ctx context.Context, userID string, page, perPage int) (ChannelMembersWithTeamData, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.userRoute(userID)+"/channel_members"+query, "")
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
func (c *Client4) GetChannelMembersByIds(ctx context.Context, channelId string, userIds []string) (ChannelMembers, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.channelMembersRoute(channelId)+"/ids", ArrayToJSON(userIds))
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
func (c *Client4) GetChannelMember(ctx context.Context, channelId, userId, etag string) (*ChannelMember, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.channelMemberRoute(channelId, userId), etag)
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
func (c *Client4) GetChannelMembersForUser(ctx context.Context, userId, teamId, etag string) (ChannelMembers, *Response, error) {
	r, err := c.DoAPIGet(ctx, fmt.Sprintf(c.userRoute(userId)+"/teams/%v/channels/members", teamId), etag)
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
func (c *Client4) ViewChannel(ctx context.Context, userId string, view *ChannelView) (*ChannelViewResponse, *Response, error) {
	url := fmt.Sprintf(c.channelsRoute()+"/members/%v/view", userId)
	buf, err := json.Marshal(view)
	if err != nil {
		return nil, nil, NewAppError("ViewChannel", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, url, buf)
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

// ReadMultipleChannels performs a view action on several channels at the same time for a user.
func (c *Client4) ReadMultipleChannels(ctx context.Context, userId string, channelIds []string) (*ChannelViewResponse, *Response, error) {
	url := fmt.Sprintf(c.channelsRoute()+"/members/%v/mark_read", userId)
	buf, err := json.Marshal(channelIds)
	if err != nil {
		return nil, nil, NewAppError("ReadMultipleChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, url, buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch *ChannelViewResponse
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("ReadMultipleChannels", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// GetChannelUnread will return a ChannelUnread object that contains the number of
// unread messages and mentions for a user.
func (c *Client4) GetChannelUnread(ctx context.Context, channelId, userId string) (*ChannelUnread, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+c.channelRoute(channelId)+"/unread", "")
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
func (c *Client4) UpdateChannelRoles(ctx context.Context, channelId, userId, roles string) (*Response, error) {
	requestBody := map[string]string{"roles": roles}
	r, err := c.DoAPIPut(ctx, c.channelMemberRoute(channelId, userId)+"/roles", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateChannelMemberSchemeRoles will update the scheme-derived roles on a channel for a user.
func (c *Client4) UpdateChannelMemberSchemeRoles(ctx context.Context, channelId string, userId string, schemeRoles *SchemeRoles) (*Response, error) {
	buf, err := json.Marshal(schemeRoles)
	if err != nil {
		return nil, NewAppError("UpdateChannelMemberSchemeRoles", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.channelMemberRoute(channelId, userId)+"/schemeRoles", buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateChannelNotifyProps will update the notification properties on a channel for a user.
func (c *Client4) UpdateChannelNotifyProps(ctx context.Context, channelId, userId string, props map[string]string) (*Response, error) {
	r, err := c.DoAPIPut(ctx, c.channelMemberRoute(channelId, userId)+"/notify_props", MapToJSON(props))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AddChannelMember adds user to channel and return a channel member.
func (c *Client4) AddChannelMember(ctx context.Context, channelId, userId string) (*ChannelMember, *Response, error) {
	requestBody := map[string]string{"user_id": userId}
	r, err := c.DoAPIPost(ctx, c.channelMembersRoute(channelId)+"", MapToJSON(requestBody))
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

// AddChannelMembers adds users to a channel and return an array of channel members.
func (c *Client4) AddChannelMembers(ctx context.Context, channelId, postRootId string, userIds []string) ([]*ChannelMember, *Response, error) {
	requestBody := map[string]any{"user_ids": userIds, "post_root_id": postRootId}
	r, err := c.DoAPIPost(ctx, c.channelMembersRoute(channelId)+"", StringInterfaceToJSON(requestBody))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var ch []*ChannelMember
	err = json.NewDecoder(r.Body).Decode(&ch)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("AddChannelMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return ch, BuildResponse(r), nil
}

// AddChannelMemberWithRootId adds user to channel and return a channel member. Post add to channel message has the postRootId.
func (c *Client4) AddChannelMemberWithRootId(ctx context.Context, channelId, userId, postRootId string) (*ChannelMember, *Response, error) {
	requestBody := map[string]string{"user_id": userId, "post_root_id": postRootId}
	r, err := c.DoAPIPost(ctx, c.channelMembersRoute(channelId)+"", MapToJSON(requestBody))
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
func (c *Client4) RemoveUserFromChannel(ctx context.Context, channelId, userId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.channelMemberRoute(channelId, userId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AutocompleteChannelsForTeam will return an ordered list of channels autocomplete suggestions.
func (c *Client4) AutocompleteChannelsForTeam(ctx context.Context, teamId, name string) (ChannelList, *Response, error) {
	query := fmt.Sprintf("?name=%v", name)
	r, err := c.DoAPIGet(ctx, c.channelsForTeamRoute(teamId)+"/autocomplete"+query, "")
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
func (c *Client4) AutocompleteChannelsForTeamForSearch(ctx context.Context, teamId, name string) (ChannelList, *Response, error) {
	query := fmt.Sprintf("?name=%v", name)
	r, err := c.DoAPIGet(ctx, c.channelsForTeamRoute(teamId)+"/search_autocomplete"+query, "")
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

// Post Section

// CreatePost creates a post based on the provided post struct.
func (c *Client4) CreatePost(ctx context.Context, post *Post) (*Post, *Response, error) {
	postJSON, err := json.Marshal(post)
	if err != nil {
		return nil, nil, NewAppError("CreatePost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.postsRoute(), string(postJSON))
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
func (c *Client4) CreatePostEphemeral(ctx context.Context, post *PostEphemeral) (*Post, *Response, error) {
	postJSON, err := json.Marshal(post)
	if err != nil {
		return nil, nil, NewAppError("CreatePostEphemeral", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.postsEphemeralRoute(), string(postJSON))
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
func (c *Client4) UpdatePost(ctx context.Context, postId string, post *Post) (*Post, *Response, error) {
	postJSON, err := json.Marshal(post)
	if err != nil {
		return nil, nil, NewAppError("UpdatePost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPut(ctx, c.postRoute(postId), string(postJSON))
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
func (c *Client4) PatchPost(ctx context.Context, postId string, patch *PostPatch) (*Post, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchPost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.postRoute(postId)+"/patch", buf)
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
func (c *Client4) SetPostUnread(ctx context.Context, userId string, postId string, collapsedThreadsSupported bool) (*Response, error) {
	b, err := json.Marshal(map[string]bool{"collapsed_threads_supported": collapsedThreadsSupported})
	if err != nil {
		return nil, NewAppError("SetPostUnread", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.userRoute(userId)+c.postRoute(postId)+"/set_unread", b)
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
	b, err := json.Marshal(reminder)
	if err != nil {
		return nil, NewAppError("SetPostReminder", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPostBytes(ctx, c.userRoute(reminder.UserId)+c.postRoute(reminder.PostId)+"/reminder", b)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PinPost pin a post based on provided post id string.
func (c *Client4) PinPost(ctx context.Context, postId string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.postRoute(postId)+"/pin", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UnpinPost unpin a post based on provided post id string.
func (c *Client4) UnpinPost(ctx context.Context, postId string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.postRoute(postId)+"/unpin", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetPost gets a single post.
func (c *Client4) GetPost(ctx context.Context, postId string, etag string) (*Post, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.postRoute(postId), etag)
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
func (c *Client4) GetPostIncludeDeleted(ctx context.Context, postId string, etag string) (*Post, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.postRoute(postId)+"?include_deleted="+c.boolString(true), etag)
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
func (c *Client4) DeletePost(ctx context.Context, postId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.postRoute(postId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PermanentDeletePost permanently deletes a post and its files from the provided post id string.
func (c *Client4) PermanentDeletePost(ctx context.Context, postId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.postRoute(postId)+"?permanent="+c.boolString(true))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetPostThread gets a post with all the other posts in the same thread.
func (c *Client4) GetPostThread(ctx context.Context, postId string, etag string, collapsedThreads bool) (*PostList, *Response, error) {
	url := c.postRoute(postId) + "/thread"
	if collapsedThreads {
		url += "?collapsedThreads=true"
	}
	r, err := c.DoAPIGet(ctx, url, etag)
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
func (c *Client4) GetPostThreadWithOpts(ctx context.Context, postID string, etag string, opts GetPostsOptions) (*PostList, *Response, error) {
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

	r, err := c.DoAPIGet(ctx, urlVal, etag)
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
func (c *Client4) GetPostsForChannel(ctx context.Context, channelId string, page, perPage int, etag string, collapsedThreads bool, includeDeleted bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}

	if includeDeleted {
		query += "&include_deleted=true"
	}
	r, err := c.DoAPIGet(ctx, c.channelRoute(channelId)+"/posts"+query, etag)
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
func (c *Client4) GetPostsByIds(ctx context.Context, postIds []string) ([]*Post, *Response, error) {
	js, err := json.Marshal(postIds)
	if err != nil {
		return nil, nil, NewAppError("SearchFilesWithParams", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.postsRoute()+"/ids", string(js))
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

// GetEditHistoryForPost gets a list of posts by taking a post ids
func (c *Client4) GetEditHistoryForPost(ctx context.Context, postId string) ([]*Post, *Response, error) {
	js, err := json.Marshal(postId)
	if err != nil {
		return nil, nil, NewAppError("GetEditHistoryForPost", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIGet(ctx, c.postRoute(postId)+"/edit_history", string(js))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var list []*Post
	if r.StatusCode == http.StatusNotModified {
		return list, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetEditHistoryForPost", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// GetFlaggedPostsForUser returns flagged posts of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUser(ctx context.Context, userId string, page int, perPage int) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/posts/flagged"+query, "")
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
func (c *Client4) GetFlaggedPostsForUserInTeam(ctx context.Context, userId string, teamId string, page int, perPage int) (*PostList, *Response, error) {
	if !IsValidId(teamId) {
		return nil, nil, NewAppError("GetFlaggedPostsForUserInTeam", "model.client.get_flagged_posts_in_team.missing_parameter.app_error", nil, "", http.StatusBadRequest)
	}

	query := fmt.Sprintf("?team_id=%v&page=%v&per_page=%v", teamId, page, perPage)
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/posts/flagged"+query, "")
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
func (c *Client4) GetFlaggedPostsForUserInChannel(ctx context.Context, userId string, channelId string, page int, perPage int) (*PostList, *Response, error) {
	if !IsValidId(channelId) {
		return nil, nil, NewAppError("GetFlaggedPostsForUserInChannel", "model.client.get_flagged_posts_in_channel.missing_parameter.app_error", nil, "", http.StatusBadRequest)
	}

	query := fmt.Sprintf("?channel_id=%v&page=%v&per_page=%v", channelId, page, perPage)
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/posts/flagged"+query, "")
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
func (c *Client4) GetPostsSince(ctx context.Context, channelId string, time int64, collapsedThreads bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?since=%v", time)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	r, err := c.DoAPIGet(ctx, c.channelRoute(channelId)+"/posts"+query, "")
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
func (c *Client4) GetPostsAfter(ctx context.Context, channelId, postId string, page, perPage int, etag string, collapsedThreads bool, includeDeleted bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&after=%v", page, perPage, postId)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	if includeDeleted {
		query += "&include_deleted=true"
	}
	r, err := c.DoAPIGet(ctx, c.channelRoute(channelId)+"/posts"+query, etag)
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
func (c *Client4) GetPostsBefore(ctx context.Context, channelId, postId string, page, perPage int, etag string, collapsedThreads bool, includeDeleted bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&before=%v", page, perPage, postId)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	if includeDeleted {
		query += "&include_deleted=true"
	}
	r, err := c.DoAPIGet(ctx, c.channelRoute(channelId)+"/posts"+query, etag)
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

// MoveThread moves a thread based on provided post id, and channel id string.
func (c *Client4) MoveThread(ctx context.Context, postId string, params *MoveThreadParams) (*Response, error) {
	js, err := json.Marshal(params)
	if err != nil {
		return nil, NewAppError("MoveThread", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPost(ctx, c.postRoute(postId)+"/move", string(js))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetPostsAroundLastUnread gets a list of posts around last unread post by a user in a channel.
func (c *Client4) GetPostsAroundLastUnread(ctx context.Context, userId, channelId string, limitBefore, limitAfter int, collapsedThreads bool) (*PostList, *Response, error) {
	query := fmt.Sprintf("?limit_before=%v&limit_after=%v", limitBefore, limitAfter)
	if collapsedThreads {
		query += "&collapsedThreads=true"
	}
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+c.channelRoute(channelId)+"/posts/unread"+query, "")
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
func (c *Client4) SearchFiles(ctx context.Context, teamId string, terms string, isOrSearch bool) (*FileInfoList, *Response, error) {
	params := SearchParameter{
		Terms:      &terms,
		IsOrSearch: &isOrSearch,
	}
	return c.SearchFilesWithParams(ctx, teamId, &params)
}

// SearchFilesWithParams returns any posts with matching terms string.
func (c *Client4) SearchFilesWithParams(ctx context.Context, teamId string, params *SearchParameter) (*FileInfoList, *Response, error) {
	js, err := json.Marshal(params)
	if err != nil {
		return nil, nil, NewAppError("SearchFilesWithParams", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	route := c.teamRoute(teamId) + "/files/search"
	if teamId == "" {
		route = c.filesRoute() + "/search"
	}
	r, err := c.DoAPIPost(ctx, route, string(js))
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
	r, err := c.DoAPIPost(ctx, route, string(js))
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
func (c *Client4) SearchPostsWithMatches(ctx context.Context, teamId string, terms string, isOrSearch bool) (*PostSearchResults, *Response, error) {
	requestBody := map[string]any{"terms": terms, "is_or_search": isOrSearch}
	var route string
	if teamId == "" {
		route = c.postsRoute() + "/search"
	} else {
		route = c.teamRoute(teamId) + "/posts/search"
	}
	r, err := c.DoAPIPost(ctx, route, StringInterfaceToJSON(requestBody))
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
func (c *Client4) DoPostAction(ctx context.Context, postId, actionId string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.postRoute(postId)+"/actions/"+actionId, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DoPostActionWithCookie performs a post action with extra arguments
func (c *Client4) DoPostActionWithCookie(ctx context.Context, postId, actionId, selected, cookieStr string) (*Response, error) {
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
	r, err := c.DoAPIPost(ctx, c.postRoute(postId)+"/actions/"+actionId, string(body))
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
	b, err := json.Marshal(request)
	if err != nil {
		return nil, NewAppError("OpenInteractiveDialog", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, "/actions/dialogs/open", string(b))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// SubmitInteractiveDialog will submit the provided dialog data to the integration
// configured by the URL. Used with the interactive dialogs integration feature.
func (c *Client4) SubmitInteractiveDialog(ctx context.Context, request SubmitDialogRequest) (*SubmitDialogResponse, *Response, error) {
	b, err := json.Marshal(request)
	if err != nil {
		return nil, nil, NewAppError("SubmitInteractiveDialog", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, "/actions/dialogs/submit", string(b))
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

	return c.DoUploadFile(ctx, c.filesRoute(), body.Bytes(), writer.FormDataContentType())
}

// UploadFileAsRequestBody will upload a file to a channel as the body of a request, to be later attached
// to a post. This method is functionally equivalent to Client4.UploadFile.
func (c *Client4) UploadFileAsRequestBody(ctx context.Context, data []byte, channelId string, filename string) (*FileUploadResponse, *Response, error) {
	return c.DoUploadFile(ctx, c.filesRoute()+fmt.Sprintf("?channel_id=%v&filename=%v", url.QueryEscape(channelId), url.QueryEscape(filename)), data, http.DetectContentType(data))
}

// GetFile gets the bytes for a file by id.
func (c *Client4) GetFile(ctx context.Context, fileId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.fileRoute(fileId), "")
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
func (c *Client4) DownloadFile(ctx context.Context, fileId string, download bool) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.fileRoute(fileId)+fmt.Sprintf("?download=%v", download), "")
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
func (c *Client4) GetFileThumbnail(ctx context.Context, fileId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.fileRoute(fileId)+"/thumbnail", "")
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
func (c *Client4) DownloadFileThumbnail(ctx context.Context, fileId string, download bool) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.fileRoute(fileId)+fmt.Sprintf("/thumbnail?download=%v", download), "")
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
func (c *Client4) GetFileLink(ctx context.Context, fileId string) (string, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.fileRoute(fileId)+"/link", "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["link"], BuildResponse(r), nil
}

// GetFilePreview gets the bytes for a file by id.
func (c *Client4) GetFilePreview(ctx context.Context, fileId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.fileRoute(fileId)+"/preview", "")
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
func (c *Client4) DownloadFilePreview(ctx context.Context, fileId string, download bool) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.fileRoute(fileId)+fmt.Sprintf("/preview?download=%v", download), "")
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
func (c *Client4) GetFileInfo(ctx context.Context, fileId string) (*FileInfo, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.fileRoute(fileId)+"/info", "")
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
func (c *Client4) GetFileInfosForPost(ctx context.Context, postId string, etag string) ([]*FileInfo, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.postRoute(postId)+"/files/info", etag)
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
func (c *Client4) GetFileInfosForPostIncludeDeleted(ctx context.Context, postId string, etag string) ([]*FileInfo, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.postRoute(postId)+"/files/info"+"?include_deleted="+c.boolString(true), etag)
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

// GenerateSupportPacket generates and downloads a Support Packet.
// It returns a ReadCloser to the packet and the filename. The caller needs to close the ReadCloser.
func (c *Client4) GenerateSupportPacket(ctx context.Context) (io.ReadCloser, string, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.systemRoute()+"/support_packet", "")
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
		status = ping["status"]
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
		status = ping["status"]
	}
	return status, resp, err
}

// GetPingWithFullServerStatus will return the full status if several basic server
// health checks all pass successfully.
// DEPRECATED: Use GetPingWithOptions method instead.
func (c *Client4) GetPingWithFullServerStatus(ctx context.Context) (map[string]string, *Response, error) {
	return c.GetPingWithOptions(ctx, SystemPingOptions{FullStatus: true})
}

// GetPingWithOptions will return the status according to the options
func (c *Client4) GetPingWithOptions(ctx context.Context, options SystemPingOptions) (map[string]string, *Response, error) {
	pingURL, err := url.Parse(c.systemRoute() + "/ping")
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
		return map[string]string{"status": StatusUnhealthy}, BuildResponse(r), err
	}
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body), BuildResponse(r), nil
}

// TestEmail will attempt to connect to the configured SMTP server.
func (c *Client4) TestEmail(ctx context.Context, config *Config) (*Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return nil, NewAppError("TestEmail", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.testEmailRoute(), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) TestNotifications(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.testNotificationRoute(), "")
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
	r, err := c.DoAPIPost(ctx, c.testSiteURLRoute(), MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// TestS3Connection will attempt to connect to the AWS S3.
func (c *Client4) TestS3Connection(ctx context.Context, config *Config) (*Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return nil, NewAppError("TestS3Connection", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.testS3Route(), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetConfig will retrieve the server config with some sanitized items.
func (c *Client4) GetConfig(ctx context.Context) (*Config, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.configRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cfg *Config
	d := json.NewDecoder(r.Body)
	return cfg, BuildResponse(r), d.Decode(&cfg)
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
	url := c.configRoute()
	if len(v) > 0 {
		url += "?" + v.Encode()
	}

	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cfg map[string]any
	return cfg, BuildResponse(r), json.NewDecoder(r.Body).Decode(&cfg)
}

// ReloadConfig will reload the server configuration.
func (c *Client4) ReloadConfig(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.configRoute()+"/reload", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetOldClientConfig will retrieve the parts of the server configuration needed by the
// client, formatted in the old format.
func (c *Client4) GetOldClientConfig(ctx context.Context, etag string) (map[string]string, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.configRoute()+"/client?format=old", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body), BuildResponse(r), nil
}

// GetEnvironmentConfig will retrieve a map mirroring the server configuration where fields
// are set to true if the corresponding config setting is set through an environment variable.
// Settings that haven't been set through environment variables will be missing from the map.
func (c *Client4) GetEnvironmentConfig(ctx context.Context) (map[string]any, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.configRoute()+"/environment", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return StringInterfaceFromJSON(r.Body), BuildResponse(r), nil
}

// GetOldClientLicense will retrieve the parts of the server license needed by the
// client, formatted in the old format.
func (c *Client4) GetOldClientLicense(ctx context.Context, etag string) (map[string]string, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.licenseRoute()+"/client?format=old", etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body), BuildResponse(r), nil
}

// DatabaseRecycle will recycle the connections. Discard current connection and get new one.
func (c *Client4) DatabaseRecycle(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.databaseRoute()+"/recycle", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// InvalidateCaches will purge the cache and can affect the performance while is cleaning.
func (c *Client4) InvalidateCaches(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.cacheRoute()+"/invalidate", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateConfig will update the server configuration.
func (c *Client4) UpdateConfig(ctx context.Context, config *Config) (*Config, *Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return nil, nil, NewAppError("UpdateConfig", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.configRoute(), buf)
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
func (c *Client4) MigrateConfig(ctx context.Context, from, to string) (*Response, error) {
	m := make(map[string]string, 2)
	m["from"] = from
	m["to"] = to
	r, err := c.DoAPIPost(ctx, c.configRoute()+"/migrate", MapToJSON(m))
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
		return nil, NewAppError("UploadLicenseFile", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, NewAppError("UploadLicenseFile", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if err = writer.Close(); err != nil {
		return nil, NewAppError("UploadLicenseFile", "model.client.set_profile_user.writer.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	rq, err := http.NewRequestWithContext(ctx, "POST", c.APIURL+c.licenseRoute(), bytes.NewReader(body.Bytes()))
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
func (c *Client4) RemoveLicenseFile(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.licenseRoute())
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
func (c *Client4) GetAnalyticsOld(ctx context.Context, name, teamId string) (AnalyticsRows, *Response, error) {
	query := fmt.Sprintf("?name=%v&team_id=%v", name, teamId)
	r, err := c.DoAPIGet(ctx, c.analyticsRoute()+"/old"+query, "")
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
func (c *Client4) CreateIncomingWebhook(ctx context.Context, hook *IncomingWebhook) (*IncomingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("CreateIncomingWebhook", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.incomingWebhooksRoute(), buf)
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
func (c *Client4) UpdateIncomingWebhook(ctx context.Context, hook *IncomingWebhook) (*IncomingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("UpdateIncomingWebhook", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.incomingWebhookRoute(hook.Id), buf)
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
func (c *Client4) GetIncomingWebhooks(ctx context.Context, page int, perPage int, etag string) ([]*IncomingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.incomingWebhooksRoute()+query, etag)
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

// GetIncomingWebhooksWithCount returns a page of incoming webhooks on the system including the total count. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooksWithCount(ctx context.Context, page int, perPage int, etag string) (*IncomingWebhooksWithCount, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&include_total_count="+c.boolString(true), page, perPage)
	r, err := c.DoAPIGet(ctx, c.incomingWebhooksRoute()+query, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var iwl *IncomingWebhooksWithCount
	if r.StatusCode == http.StatusNotModified {
		return iwl, BuildResponse(r), nil
	}
	if err := json.NewDecoder(r.Body).Decode(&iwl); err != nil {
		return nil, nil, NewAppError("GetIncomingWebhooksWithCount", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return iwl, BuildResponse(r), nil
}

// GetIncomingWebhooksForTeam returns a page of incoming webhooks for a team. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooksForTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*IncomingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&team_id=%v", page, perPage, teamId)
	r, err := c.DoAPIGet(ctx, c.incomingWebhooksRoute()+query, etag)
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
func (c *Client4) GetIncomingWebhook(ctx context.Context, hookID string, etag string) (*IncomingWebhook, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.incomingWebhookRoute(hookID), etag)
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
func (c *Client4) DeleteIncomingWebhook(ctx context.Context, hookID string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.incomingWebhookRoute(hookID))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// CreateOutgoingWebhook creates an outgoing webhook for a team or channel.
func (c *Client4) CreateOutgoingWebhook(ctx context.Context, hook *OutgoingWebhook) (*OutgoingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("CreateOutgoingWebhook", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.outgoingWebhooksRoute(), buf)
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
func (c *Client4) UpdateOutgoingWebhook(ctx context.Context, hook *OutgoingWebhook) (*OutgoingWebhook, *Response, error) {
	buf, err := json.Marshal(hook)
	if err != nil {
		return nil, nil, NewAppError("UpdateOutgoingWebhook", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.outgoingWebhookRoute(hook.Id), buf)
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
func (c *Client4) GetOutgoingWebhooks(ctx context.Context, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.outgoingWebhooksRoute()+query, etag)
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
func (c *Client4) GetOutgoingWebhook(ctx context.Context, hookId string) (*OutgoingWebhook, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.outgoingWebhookRoute(hookId), "")
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
func (c *Client4) GetOutgoingWebhooksForChannel(ctx context.Context, channelId string, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&channel_id=%v", page, perPage, channelId)
	r, err := c.DoAPIGet(ctx, c.outgoingWebhooksRoute()+query, etag)
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
func (c *Client4) GetOutgoingWebhooksForTeam(ctx context.Context, teamId string, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&team_id=%v", page, perPage, teamId)
	r, err := c.DoAPIGet(ctx, c.outgoingWebhooksRoute()+query, etag)
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
func (c *Client4) RegenOutgoingHookToken(ctx context.Context, hookId string) (*OutgoingWebhook, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.outgoingWebhookRoute(hookId)+"/regen_token", "")
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
func (c *Client4) DeleteOutgoingWebhook(ctx context.Context, hookId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.outgoingWebhookRoute(hookId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Preferences Section

// GetPreferences returns the user's preferences.
func (c *Client4) GetPreferences(ctx context.Context, userId string) (Preferences, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.preferencesRoute(userId), "")
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
func (c *Client4) UpdatePreferences(ctx context.Context, userId string, preferences Preferences) (*Response, error) {
	buf, err := json.Marshal(preferences)
	if err != nil {
		return nil, NewAppError("UpdatePreferences", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.preferencesRoute(userId), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeletePreferences deletes the user's preferences.
func (c *Client4) DeletePreferences(ctx context.Context, userId string, preferences Preferences) (*Response, error) {
	buf, err := json.Marshal(preferences)
	if err != nil {
		return nil, NewAppError("DeletePreferences", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.preferencesRoute(userId)+"/delete", buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetPreferencesByCategory returns the user's preferences from the provided category string.
func (c *Client4) GetPreferencesByCategory(ctx context.Context, userId string, category string) (Preferences, *Response, error) {
	url := fmt.Sprintf(c.preferencesRoute(userId)+"/%s", category)
	r, err := c.DoAPIGet(ctx, url, "")
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
func (c *Client4) GetPreferenceByCategoryAndName(ctx context.Context, userId string, category string, preferenceName string) (*Preference, *Response, error) {
	url := fmt.Sprintf(c.preferencesRoute(userId)+"/%s/name/%v", category, preferenceName)
	r, err := c.DoAPIGet(ctx, url, "")
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
func (c *Client4) GetSamlMetadata(ctx context.Context) (string, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.samlRoute()+"/metadata", "")
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
func (c *Client4) UploadSamlIdpCertificate(ctx context.Context, data []byte, filename string) (*Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return nil, NewAppError("UploadSamlIdpCertificate", "model.client.upload_saml_cert.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	_, resp, err := c.DoUploadFile(ctx, c.samlRoute()+"/certificate/idp", body, writer.FormDataContentType())
	return resp, err
}

// UploadSamlPublicCertificate will upload a public certificate for SAML and set the config to use it.
// The filename parameter is deprecated and ignored: the server will pick a hard-coded filename when writing to disk.
func (c *Client4) UploadSamlPublicCertificate(ctx context.Context, data []byte, filename string) (*Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return nil, NewAppError("UploadSamlPublicCertificate", "model.client.upload_saml_cert.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	_, resp, err := c.DoUploadFile(ctx, c.samlRoute()+"/certificate/public", body, writer.FormDataContentType())
	return resp, err
}

// UploadSamlPrivateCertificate will upload a private key for SAML and set the config to use it.
// The filename parameter is deprecated and ignored: the server will pick a hard-coded filename when writing to disk.
func (c *Client4) UploadSamlPrivateCertificate(ctx context.Context, data []byte, filename string) (*Response, error) {
	body, writer, err := fileToMultipart(data, filename)
	if err != nil {
		return nil, NewAppError("UploadSamlPrivateCertificate", "model.client.upload_saml_cert.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	_, resp, err := c.DoUploadFile(ctx, c.samlRoute()+"/certificate/private", body, writer.FormDataContentType())
	return resp, err
}

// DeleteSamlIdpCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlIdpCertificate(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.samlRoute()+"/certificate/idp")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteSamlPublicCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlPublicCertificate(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.samlRoute()+"/certificate/public")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteSamlPrivateCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlPrivateCertificate(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.samlRoute()+"/certificate/private")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetSamlCertificateStatus returns metadata for the SAML configuration.
func (c *Client4) GetSamlCertificateStatus(ctx context.Context) (*SamlCertificateStatus, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.samlRoute()+"/certificate/status", "")
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

func (c *Client4) GetSamlMetadataFromIdp(ctx context.Context, samlMetadataURL string) (*SamlMetadataResponse, *Response, error) {
	requestBody := make(map[string]string)
	requestBody["saml_metadata_url"] = samlMetadataURL
	r, err := c.DoAPIPost(ctx, c.samlRoute()+"/metadatafromidp", MapToJSON(requestBody))
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
func (c *Client4) ResetSamlAuthDataToEmail(ctx context.Context, includeDeleted bool, dryRun bool, userIDs []string) (int64, *Response, error) {
	params := map[string]any{
		"include_deleted": includeDeleted,
		"dry_run":         dryRun,
		"user_ids":        userIDs,
	}
	b, err := json.Marshal(params)
	if err != nil {
		return 0, nil, NewAppError("ResetSamlAuthDataToEmail", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.samlRoute()+"/reset_auth_data", b)
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
func (c *Client4) CreateComplianceReport(ctx context.Context, report *Compliance) (*Compliance, *Response, error) {
	buf, err := json.Marshal(report)
	if err != nil {
		return nil, nil, NewAppError("CreateComplianceReport", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.complianceReportsRoute(), buf)
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
func (c *Client4) GetComplianceReports(ctx context.Context, page, perPage int) (Compliances, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.complianceReportsRoute()+query, "")
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
func (c *Client4) GetComplianceReport(ctx context.Context, reportId string) (*Compliance, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.complianceReportRoute(reportId), "")
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
func (c *Client4) DownloadComplianceReport(ctx context.Context, reportId string) ([]byte, *Response, error) {
	rq, err := http.NewRequestWithContext(ctx, "GET", c.APIURL+c.complianceReportDownloadRoute(reportId), nil)
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
func (c *Client4) GetClusterStatus(ctx context.Context) ([]*ClusterInfo, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.clusterRoute()+"/status", "")
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
func (c *Client4) SyncLdap(ctx context.Context, includeRemovedMembers bool) (*Response, error) {
	reqBody, err := json.Marshal(map[string]any{
		"include_removed_members": includeRemovedMembers,
	})
	if err != nil {
		return nil, NewAppError("SyncLdap", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.ldapRoute()+"/sync", reqBody)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// TestLdap will attempt to connect to the configured LDAP server and return OK if configured
// correctly.
func (c *Client4) TestLdap(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.ldapRoute()+"/test", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetLdapGroups retrieves the immediate child groups of the given parent group.
func (c *Client4) GetLdapGroups(ctx context.Context) ([]*Group, *Response, error) {
	path := fmt.Sprintf("%s/groups", c.ldapRoute())

	r, err := c.DoAPIGet(ctx, path, "")
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
func (c *Client4) LinkLdapGroup(ctx context.Context, dn string) (*Group, *Response, error) {
	path := fmt.Sprintf("%s/groups/%s/link", c.ldapRoute(), dn)

	r, err := c.DoAPIPost(ctx, path, "")
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
func (c *Client4) UnlinkLdapGroup(ctx context.Context, dn string) (*Group, *Response, error) {
	path := fmt.Sprintf("%s/groups/%s/link", c.ldapRoute(), dn)

	r, err := c.DoAPIDelete(ctx, path)
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
func (c *Client4) MigrateIdLdap(ctx context.Context, toAttribute string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.ldapRoute()+"/migrateid", MapToJSON(map[string]string{
		"toAttribute": toAttribute,
	}))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetGroupsByChannel retrieves the Mattermost Groups associated with a given channel
func (c *Client4) GetGroupsByChannel(ctx context.Context, channelId string, opts GroupSearchOpts) ([]*GroupWithSchemeAdmin, int, *Response, error) {
	path := fmt.Sprintf("%s/groups?q=%v&include_member_count=%v&filter_allow_reference=%v", c.channelRoute(channelId), opts.Q, opts.IncludeMemberCount, opts.FilterAllowReference)
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoAPIGet(ctx, path, "")
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
func (c *Client4) GetGroupsByTeam(ctx context.Context, teamId string, opts GroupSearchOpts) ([]*GroupWithSchemeAdmin, int, *Response, error) {
	path := fmt.Sprintf("%s/groups?q=%v&include_member_count=%v&filter_allow_reference=%v", c.teamRoute(teamId), opts.Q, opts.IncludeMemberCount, opts.FilterAllowReference)
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoAPIGet(ctx, path, "")
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
func (c *Client4) GetGroupsAssociatedToChannelsByTeam(ctx context.Context, teamId string, opts GroupSearchOpts) (map[string][]*GroupWithSchemeAdmin, *Response, error) {
	path := fmt.Sprintf("%s/groups_by_channels?q=%v&filter_allow_reference=%v", c.teamRoute(teamId), opts.Q, opts.FilterAllowReference)
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoAPIGet(ctx, path, "")
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
func (c *Client4) GetGroups(ctx context.Context, opts GroupSearchOpts) ([]*Group, *Response, error) {
	path := fmt.Sprintf(
		"%s?include_member_count=%v&not_associated_to_team=%v&not_associated_to_channel=%v&filter_allow_reference=%v&q=%v&filter_parent_team_permitted=%v&group_source=%v&include_channel_member_count=%v&include_timezones=%v&include_archived=%v&filter_archived=%v",
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
		opts.IncludeArchived,
		opts.FilterArchived,
	)
	if opts.Since > 0 {
		path = fmt.Sprintf("%s&since=%v", path, opts.Since)
	}
	if opts.PageOpts != nil {
		path = fmt.Sprintf("%s&page=%v&per_page=%v", path, opts.PageOpts.Page, opts.PageOpts.PerPage)
	}
	r, err := c.DoAPIGet(ctx, path, "")
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
func (c *Client4) GetGroupsByUserId(ctx context.Context, userId string) ([]*Group, *Response, error) {
	path := fmt.Sprintf(
		"%s/%v/groups",
		c.usersRoute(),
		userId,
	)

	r, err := c.DoAPIGet(ctx, path, "")
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

func (c *Client4) MigrateAuthToLdap(ctx context.Context, fromAuthService string, matchField string, force bool) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/migrate_auth/ldap", StringInterfaceToJSON(map[string]any{
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

func (c *Client4) MigrateAuthToSaml(ctx context.Context, fromAuthService string, usersMap map[string]string, auto bool) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.usersRoute()+"/migrate_auth/saml", StringInterfaceToJSON(map[string]any{
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
func (c *Client4) UploadLdapPublicCertificate(ctx context.Context, data []byte) (*Response, error) {
	body, writer, err := fileToMultipart(data, LdapPublicCertificateName)
	if err != nil {
		return nil, NewAppError("UploadLdapPublicCertificate", "model.client.upload_ldap_cert.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	_, resp, err := c.DoUploadFile(ctx, c.ldapRoute()+"/certificate/public", body, writer.FormDataContentType())
	return resp, err
}

// UploadLdapPrivateCertificate will upload a private key for LDAP and set the config to use it.
func (c *Client4) UploadLdapPrivateCertificate(ctx context.Context, data []byte) (*Response, error) {
	body, writer, err := fileToMultipart(data, LdapPrivateKeyName)
	if err != nil {
		return nil, NewAppError("UploadLdapPrivateCertificate", "model.client.upload_Ldap_cert.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	_, resp, err := c.DoUploadFile(ctx, c.ldapRoute()+"/certificate/private", body, writer.FormDataContentType())
	return resp, err
}

// DeleteLdapPublicCertificate deletes the LDAP IDP certificate from the server and updates the config to not use it and disable LDAP.
func (c *Client4) DeleteLdapPublicCertificate(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.ldapRoute()+"/certificate/public")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteLDAPPrivateCertificate deletes the LDAP IDP certificate from the server and updates the config to not use it and disable LDAP.
func (c *Client4) DeleteLdapPrivateCertificate(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.ldapRoute()+"/certificate/private")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Audits Section

// GetAudits returns a list of audits for the whole system.
func (c *Client4) GetAudits(ctx context.Context, page int, perPage int, etag string) (Audits, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, "/audits"+query, etag)
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
func (c *Client4) GetBrandImage(ctx context.Context) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.brandRoute()+"/image", "")
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
func (c *Client4) DeleteBrandImage(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.brandRoute()+"/image")
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
		return nil, NewAppError("UploadBrandImage", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, NewAppError("UploadBrandImage", "model.client.set_profile_user.no_file.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if err = writer.Close(); err != nil {
		return nil, NewAppError("UploadBrandImage", "model.client.set_profile_user.writer.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	rq, err := http.NewRequestWithContext(ctx, "POST", c.APIURL+c.brandRoute()+"/image", bytes.NewReader(body.Bytes()))
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
func (c *Client4) GetLogs(ctx context.Context, page, perPage int) ([]string, *Response, error) {
	query := fmt.Sprintf("?page=%v&logs_per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, "/logs"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return c.ArrayFromJSON(r.Body), BuildResponse(r), nil
}

// Download logs as mattermost.log file
func (c *Client4) DownloadLogs(ctx context.Context) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, "/logs/download", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("DownloadLogs", "model.client.read_file.app_error", nil, "", r.StatusCode).Wrap(err)
	}

	return data, BuildResponse(r), nil
}

// PostLog is a convenience Web Service call so clients can log messages into
// the server-side logs. For example we typically log javascript error messages
// into the server-side. It returns the log message if the logging was successful.
func (c *Client4) PostLog(ctx context.Context, message map[string]string) (map[string]string, *Response, error) {
	r, err := c.DoAPIPost(ctx, "/logs", MapToJSON(message))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body), BuildResponse(r), nil
}

// OAuth Section

// CreateOAuthApp will register a new OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) CreateOAuthApp(ctx context.Context, app *OAuthApp) (*OAuthApp, *Response, error) {
	buf, err := json.Marshal(app)
	if err != nil {
		return nil, nil, NewAppError("CreateOAuthApp", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.oAuthAppsRoute(), buf)
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
func (c *Client4) UpdateOAuthApp(ctx context.Context, app *OAuthApp) (*OAuthApp, *Response, error) {
	buf, err := json.Marshal(app)
	if err != nil {
		return nil, nil, NewAppError("UpdateOAuthApp", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.oAuthAppRoute(app.Id), buf)
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
func (c *Client4) GetOAuthApps(ctx context.Context, page, perPage int) ([]*OAuthApp, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.oAuthAppsRoute()+query, "")
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
func (c *Client4) GetOAuthApp(ctx context.Context, appId string) (*OAuthApp, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.oAuthAppRoute(appId), "")
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
func (c *Client4) GetOAuthAppInfo(ctx context.Context, appId string) (*OAuthApp, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.oAuthAppRoute(appId)+"/info", "")
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
func (c *Client4) DeleteOAuthApp(ctx context.Context, appId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.oAuthAppRoute(appId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RegenerateOAuthAppSecret regenerates the client secret for a registered OAuth 2.0 client application.
func (c *Client4) RegenerateOAuthAppSecret(ctx context.Context, appId string) (*OAuthApp, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.oAuthAppRoute(appId)+"/regen_secret", "")
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
func (c *Client4) GetAuthorizedOAuthAppsForUser(ctx context.Context, userId string, page, perPage int) ([]*OAuthApp, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/oauth/apps/authorized"+query, "")
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
func (c *Client4) AuthorizeOAuthApp(ctx context.Context, authRequest *AuthorizeRequest) (string, *Response, error) {
	buf, err := json.Marshal(authRequest)
	if err != nil {
		return "", BuildResponse(nil), NewAppError("AuthorizeOAuthApp", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIRequestBytes(ctx, http.MethodPost, c.URL+"/oauth/authorize", buf, "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["redirect"], BuildResponse(r), nil
}

// DeauthorizeOAuthApp will deauthorize an OAuth 2.0 client application from accessing a user's account.
func (c *Client4) DeauthorizeOAuthApp(ctx context.Context, appId string) (*Response, error) {
	requestData := map[string]string{"client_id": appId}
	r, err := c.DoAPIRequest(ctx, http.MethodPost, c.URL+"/oauth/deauthorize", MapToJSON(requestData), "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetOAuthAccessToken is a test helper function for the OAuth access token endpoint.
func (c *Client4) GetOAuthAccessToken(ctx context.Context, data url.Values) (*AccessResponse, *Response, error) {
	url := c.URL + "/oauth/access_token"
	rq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(data.Encode()))
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

// OutgoingOAuthConnection section

// GetOutgoingOAuthConnections retrieves the outgoing OAuth connections.
func (c *Client4) GetOutgoingOAuthConnections(ctx context.Context, filters OutgoingOAuthConnectionGetConnectionsFilter) ([]*OutgoingOAuthConnection, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.outgoingOAuthConnectionsRoute()+"?"+filters.ToURLValues().Encode(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var connections []*OutgoingOAuthConnection
	if err := json.NewDecoder(r.Body).Decode(&connections); err != nil {
		return nil, nil, NewAppError("GetOutgoingOAuthConnections", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return connections, BuildResponse(r), nil
}

// GetOutgoingOAuthConnection retrieves the outgoing OAuth connection with the given ID.
func (c *Client4) GetOutgoingOAuthConnection(ctx context.Context, id string) (*OutgoingOAuthConnection, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.outgoingOAuthConnectionRoute(id), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var connection *OutgoingOAuthConnection
	if err := json.NewDecoder(r.Body).Decode(&connection); err != nil {
		return nil, nil, NewAppError("GetOutgoingOAuthConnection", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return connection, BuildResponse(r), nil
}

// DeleteOutgoingOAuthConnection deletes the outgoing OAuth connection with the given ID.
func (c *Client4) DeleteOutgoingOAuthConnection(ctx context.Context, id string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.outgoingOAuthConnectionRoute(id))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateOutgoingOAuthConnection updates the outgoing OAuth connection with the given ID.
func (c *Client4) UpdateOutgoingOAuthConnection(ctx context.Context, connection *OutgoingOAuthConnection) (*OutgoingOAuthConnection, *Response, error) {
	buf, err := json.Marshal(connection)
	if err != nil {
		return nil, nil, NewAppError("UpdateOutgoingOAuthConnection", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.outgoingOAuthConnectionRoute(connection.Id), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var resultConnection OutgoingOAuthConnection
	if err := json.NewDecoder(r.Body).Decode(&resultConnection); err != nil {
		return nil, nil, NewAppError("UpdateOutgoingOAuthConnection", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &resultConnection, BuildResponse(r), nil
}

// CreateOutgoingOAuthConnection creates a new outgoing OAuth connection.
func (c *Client4) CreateOutgoingOAuthConnection(ctx context.Context, connection *OutgoingOAuthConnection) (*OutgoingOAuthConnection, *Response, error) {
	buf, err := json.Marshal(connection)
	if err != nil {
		return nil, nil, NewAppError("CreateOutgoingOAuthConnection", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.outgoingOAuthConnectionsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var resultConnection OutgoingOAuthConnection
	if err := json.NewDecoder(r.Body).Decode(&resultConnection); err != nil {
		return nil, nil, NewAppError("CreateOutgoingOAuthConnection", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &resultConnection, BuildResponse(r), nil
}

// Elasticsearch Section

// TestElasticsearch will attempt to connect to the configured Elasticsearch server and return OK if configured.
// correctly.
func (c *Client4) TestElasticsearch(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.elasticsearchRoute()+"/test", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PurgeElasticsearchIndexes immediately deletes all Elasticsearch indexes.
func (c *Client4) PurgeElasticsearchIndexes(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.elasticsearchRoute()+"/purge_indexes", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Bleve Section

// PurgeBleveIndexes immediately deletes all Bleve indexes.
func (c *Client4) PurgeBleveIndexes(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.bleveRoute()+"/purge_indexes", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Data Retention Section

// GetDataRetentionPolicy will get the current global data retention policy details.
func (c *Client4) GetDataRetentionPolicy(ctx context.Context) (*GlobalRetentionPolicy, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.dataRetentionRoute()+"/policy", "")
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
func (c *Client4) GetDataRetentionPolicyByID(ctx context.Context, policyID string) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.dataRetentionPolicyRoute(policyID), "")
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
func (c *Client4) GetDataRetentionPoliciesCount(ctx context.Context) (int64, *Response, error) {
	type CountBody struct {
		TotalCount int64 `json:"total_count"`
	}
	r, err := c.DoAPIGet(ctx, c.dataRetentionRoute()+"/policies_count", "")
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
func (c *Client4) GetDataRetentionPolicies(ctx context.Context, page, perPage int) (*RetentionPolicyWithTeamAndChannelCountsList, *Response, error) {
	query := fmt.Sprintf("?page=%d&per_page=%d", page, perPage)
	r, err := c.DoAPIGet(ctx, c.dataRetentionRoute()+"/policies"+query, "")
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
func (c *Client4) CreateDataRetentionPolicy(ctx context.Context, policy *RetentionPolicyWithTeamAndChannelIDs) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	policyJSON, err := json.Marshal(policy)
	if err != nil {
		return nil, nil, NewAppError("CreateDataRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.dataRetentionRoute()+"/policies", policyJSON)
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
func (c *Client4) DeleteDataRetentionPolicy(ctx context.Context, policyID string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.dataRetentionPolicyRoute(policyID))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PatchDataRetentionPolicy will patch the granular data retention policy with the specified ID.
// The Id field of `patch` must be non-empty.
func (c *Client4) PatchDataRetentionPolicy(ctx context.Context, patch *RetentionPolicyWithTeamAndChannelIDs) (*RetentionPolicyWithTeamAndChannelCounts, *Response, error) {
	patchJSON, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchDataRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPatchBytes(ctx, c.dataRetentionPolicyRoute(patch.ID), patchJSON)
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
func (c *Client4) GetTeamsForRetentionPolicy(ctx context.Context, policyID string, page, perPage int) (*TeamsWithCount, *Response, error) {
	query := fmt.Sprintf("?page=%d&per_page=%d", page, perPage)
	r, err := c.DoAPIGet(ctx, c.dataRetentionPolicyRoute(policyID)+"/teams"+query, "")
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
func (c *Client4) SearchTeamsForRetentionPolicy(ctx context.Context, policyID string, term string) ([]*Team, *Response, error) {
	body, err := json.Marshal(map[string]any{"term": term})
	if err != nil {
		return nil, nil, NewAppError("SearchTeamsForRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.dataRetentionPolicyRoute(policyID)+"/teams/search", body)
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
func (c *Client4) AddTeamsToRetentionPolicy(ctx context.Context, policyID string, teamIDs []string) (*Response, error) {
	body, err := json.Marshal(teamIDs)
	if err != nil {
		return nil, NewAppError("AddTeamsToRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.dataRetentionPolicyRoute(policyID)+"/teams", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveTeamsFromRetentionPolicy will remove the specified teams from the granular data retention policy
// with the specified ID.
func (c *Client4) RemoveTeamsFromRetentionPolicy(ctx context.Context, policyID string, teamIDs []string) (*Response, error) {
	body, err := json.Marshal(teamIDs)
	if err != nil {
		return nil, NewAppError("RemoveTeamsFromRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIDeleteBytes(ctx, c.dataRetentionPolicyRoute(policyID)+"/teams", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetChannelsForRetentionPolicy will get the channels to which the specified policy is currently applied.
func (c *Client4) GetChannelsForRetentionPolicy(ctx context.Context, policyID string, page, perPage int) (*ChannelsWithCount, *Response, error) {
	query := fmt.Sprintf("?page=%d&per_page=%d", page, perPage)
	r, err := c.DoAPIGet(ctx, c.dataRetentionPolicyRoute(policyID)+"/channels"+query, "")
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
func (c *Client4) SearchChannelsForRetentionPolicy(ctx context.Context, policyID string, term string) (ChannelListWithTeamData, *Response, error) {
	body, err := json.Marshal(map[string]any{"term": term})
	if err != nil {
		return nil, nil, NewAppError("SearchChannelsForRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.dataRetentionPolicyRoute(policyID)+"/channels/search", body)
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
func (c *Client4) AddChannelsToRetentionPolicy(ctx context.Context, policyID string, channelIDs []string) (*Response, error) {
	body, err := json.Marshal(channelIDs)
	if err != nil {
		return nil, NewAppError("AddChannelsToRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.dataRetentionPolicyRoute(policyID)+"/channels", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveChannelsFromRetentionPolicy will remove the specified channels from the granular data retention policy
// with the specified ID.
func (c *Client4) RemoveChannelsFromRetentionPolicy(ctx context.Context, policyID string, channelIDs []string) (*Response, error) {
	body, err := json.Marshal(channelIDs)
	if err != nil {
		return nil, NewAppError("RemoveChannelsFromRetentionPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIDeleteBytes(ctx, c.dataRetentionPolicyRoute(policyID)+"/channels", body)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTeamPoliciesForUser will get the data retention policies for the teams to which a user belongs.
func (c *Client4) GetTeamPoliciesForUser(ctx context.Context, userID string, offset, limit int) (*RetentionPolicyForTeamList, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userID)+"/data_retention/team_policies", "")
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
func (c *Client4) GetChannelPoliciesForUser(ctx context.Context, userID string, offset, limit int) (*RetentionPolicyForChannelList, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userID)+"/data_retention/channel_policies", "")
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
func (c *Client4) UpsertDraft(ctx context.Context, draft *Draft) (*Draft, *Response, error) {
	buf, err := json.Marshal(draft)
	if err != nil {
		return nil, nil, NewAppError("UpsertDraft", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPostBytes(ctx, c.draftsRoute(), buf)
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
func (c *Client4) GetDrafts(ctx context.Context, userId, teamId string) ([]*Draft, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+c.teamRoute(teamId)+"/drafts", "")
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

func (c *Client4) DeleteDraft(ctx context.Context, userId, channelId, rootId string) (*Draft, *Response, error) {
	r, err := c.DoAPIDelete(ctx, c.userRoute(userId)+c.channelRoute(channelId)+"/drafts")
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
func (c *Client4) CreateCommand(ctx context.Context, cmd *Command) (*Command, *Response, error) {
	buf, err := json.Marshal(cmd)
	if err != nil {
		return nil, nil, NewAppError("CreateCommand", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.commandsRoute(), buf)
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
func (c *Client4) UpdateCommand(ctx context.Context, cmd *Command) (*Command, *Response, error) {
	buf, err := json.Marshal(cmd)
	if err != nil {
		return nil, nil, NewAppError("UpdateCommand", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.commandRoute(cmd.Id), buf)
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
func (c *Client4) MoveCommand(ctx context.Context, teamId string, commandId string) (*Response, error) {
	cmr := CommandMoveRequest{TeamId: teamId}
	buf, err := json.Marshal(cmr)
	if err != nil {
		return nil, NewAppError("MoveCommand", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.commandMoveRoute(commandId), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DeleteCommand deletes a command based on the provided command id string.
func (c *Client4) DeleteCommand(ctx context.Context, commandId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.commandRoute(commandId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ListCommands will retrieve a list of commands available in the team.
func (c *Client4) ListCommands(ctx context.Context, teamId string, customOnly bool) ([]*Command, *Response, error) {
	query := fmt.Sprintf("?team_id=%v&custom_only=%v", teamId, customOnly)
	r, err := c.DoAPIGet(ctx, c.commandsRoute()+query, "")
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
func (c *Client4) ListCommandAutocompleteSuggestions(ctx context.Context, userInput, teamId string) ([]AutocompleteSuggestion, *Response, error) {
	query := fmt.Sprintf("/commands/autocomplete_suggestions?user_input=%v", userInput)
	r, err := c.DoAPIGet(ctx, c.teamRoute(teamId)+query, "")
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
func (c *Client4) GetCommandById(ctx context.Context, cmdId string) (*Command, *Response, error) {
	url := fmt.Sprintf("%s/%s", c.commandsRoute(), cmdId)
	r, err := c.DoAPIGet(ctx, url, "")
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
func (c *Client4) ExecuteCommand(ctx context.Context, channelId, command string) (*CommandResponse, *Response, error) {
	commandArgs := &CommandArgs{
		ChannelId: channelId,
		Command:   command,
	}
	buf, err := json.Marshal(commandArgs)
	if err != nil {
		return nil, nil, NewAppError("ExecuteCommand", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.commandsRoute()+"/execute", buf)
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
func (c *Client4) ExecuteCommandWithTeam(ctx context.Context, channelId, teamId, command string) (*CommandResponse, *Response, error) {
	commandArgs := &CommandArgs{
		ChannelId: channelId,
		TeamId:    teamId,
		Command:   command,
	}
	buf, err := json.Marshal(commandArgs)
	if err != nil {
		return nil, nil, NewAppError("ExecuteCommandWithTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.commandsRoute()+"/execute", buf)
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
func (c *Client4) ListAutocompleteCommands(ctx context.Context, teamId string) ([]*Command, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.teamAutoCompleteCommandsRoute(teamId), "")
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
func (c *Client4) RegenCommandToken(ctx context.Context, commandId string) (string, *Response, error) {
	r, err := c.DoAPIPut(ctx, c.commandRoute(commandId)+"/regen_token", "")
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["token"], BuildResponse(r), nil
}

// Status Section

// GetUserStatus returns a user based on the provided user id string.
func (c *Client4) GetUserStatus(ctx context.Context, userId, etag string) (*Status, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userStatusRoute(userId), etag)
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
func (c *Client4) GetUsersStatusesByIds(ctx context.Context, userIds []string) ([]*Status, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.userStatusesRoute()+"/ids", ArrayToJSON(userIds))
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
func (c *Client4) UpdateUserStatus(ctx context.Context, userId string, userStatus *Status) (*Status, *Response, error) {
	buf, err := json.Marshal(userStatus)
	if err != nil {
		return nil, nil, NewAppError("UpdateUserStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.userStatusRoute(userId), buf)
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
func (c *Client4) UpdateUserCustomStatus(ctx context.Context, userId string, userCustomStatus *CustomStatus) (*CustomStatus, *Response, error) {
	buf, err := json.Marshal(userCustomStatus)
	if err != nil {
		return nil, nil, NewAppError("UpdateUserCustomStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.userStatusRoute(userId)+"/custom", buf)
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
	r, err := c.DoAPIDelete(ctx, c.userStatusRoute(userId)+"/custom")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// RemoveRecentUserCustomStatus remove a recent user's custom status based on the provided user id string.
func (c *Client4) RemoveRecentUserCustomStatus(ctx context.Context, userId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.userStatusRoute(userId)+"/custom/recent")
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
		return nil, nil, NewAppError("CreateEmoji", "api.marshal_error", nil, "", 0).Wrap(err)
	}

	if err := writer.WriteField("emoji", string(emojiJSON)); err != nil {
		return nil, nil, err
	}

	if err := writer.Close(); err != nil {
		return nil, nil, err
	}

	return c.DoEmojiUploadFile(ctx, c.emojisRoute(), body.Bytes(), writer.FormDataContentType())
}

// GetEmojiList returns a page of custom emoji on the system.
func (c *Client4) GetEmojiList(ctx context.Context, page, perPage int) ([]*Emoji, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.emojisRoute()+query, "")
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
func (c *Client4) GetSortedEmojiList(ctx context.Context, page, perPage int, sort string) ([]*Emoji, *Response, error) {
	query := fmt.Sprintf("?page=%v&per_page=%v&sort=%v", page, perPage, sort)
	r, err := c.DoAPIGet(ctx, c.emojisRoute()+query, "")
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

// GetEmojisByNames takes an array of custom emoji names and returns an array of those emojis.
func (c *Client4) GetEmojisByNames(ctx context.Context, names []string) ([]*Emoji, *Response, error) {
	buf, err := json.Marshal(names)
	if err != nil {
		return nil, nil, NewAppError("GetEmojisByNames", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPostBytes(ctx, c.emojisRoute()+"/names", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var list []*Emoji
	if err := json.NewDecoder(r.Body).Decode(&list); err != nil {
		return nil, nil, NewAppError("GetEmojisByNames", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return list, BuildResponse(r), nil
}

// DeleteEmoji delete an custom emoji on the provided emoji id string.
func (c *Client4) DeleteEmoji(ctx context.Context, emojiId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.emojiRoute(emojiId))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetEmoji returns a custom emoji based on the emojiId string.
func (c *Client4) GetEmoji(ctx context.Context, emojiId string) (*Emoji, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.emojiRoute(emojiId), "")
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
func (c *Client4) GetEmojiByName(ctx context.Context, name string) (*Emoji, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.emojiByNameRoute(name), "")
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
func (c *Client4) GetEmojiImage(ctx context.Context, emojiId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.emojiRoute(emojiId)+"/image", "")
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
func (c *Client4) SearchEmoji(ctx context.Context, search *EmojiSearch) ([]*Emoji, *Response, error) {
	buf, err := json.Marshal(search)
	if err != nil {
		return nil, nil, NewAppError("SearchEmoji", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.emojisRoute()+"/search", buf)
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
func (c *Client4) AutocompleteEmoji(ctx context.Context, name string, etag string) ([]*Emoji, *Response, error) {
	query := fmt.Sprintf("?name=%v", name)
	r, err := c.DoAPIGet(ctx, c.emojisRoute()+"/autocomplete"+query, "")
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
func (c *Client4) SaveReaction(ctx context.Context, reaction *Reaction) (*Reaction, *Response, error) {
	buf, err := json.Marshal(reaction)
	if err != nil {
		return nil, nil, NewAppError("SaveReaction", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.reactionsRoute(), buf)
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
func (c *Client4) GetReactions(ctx context.Context, postId string) ([]*Reaction, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.postRoute(postId)+"/reactions", "")
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
func (c *Client4) DeleteReaction(ctx context.Context, reaction *Reaction) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.userRoute(reaction.UserId)+c.postRoute(reaction.PostId)+fmt.Sprintf("/reactions/%v", reaction.EmojiName))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// FetchBulkReactions returns a map of postIds and corresponding reactions
func (c *Client4) GetBulkReactions(ctx context.Context, postIds []string) (map[string][]*Reaction, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.postsRoute()+"/ids/reactions", ArrayToJSON(postIds))
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

// Timezone Section

// GetSupportedTimezone returns a page of supported timezones on the system.
func (c *Client4) GetSupportedTimezone(ctx context.Context) ([]string, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.timezonesRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var timezones []string
	json.NewDecoder(r.Body).Decode(&timezones)
	return timezones, BuildResponse(r), nil
}

// Jobs Section

// GetJob gets a single job.
func (c *Client4) GetJob(ctx context.Context, id string) (*Job, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.jobsRoute()+fmt.Sprintf("/%v", id), "")
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
func (c *Client4) GetJobs(ctx context.Context, jobType string, status string, page int, perPage int) ([]*Job, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.jobsRoute()+fmt.Sprintf("?page=%v&per_page=%v&job_type=%v&status=%v", page, perPage, jobType, status), "")
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
func (c *Client4) GetJobsByType(ctx context.Context, jobType string, page int, perPage int) ([]*Job, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.jobsRoute()+fmt.Sprintf("/type/%v?page=%v&per_page=%v", jobType, page, perPage), "")
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
func (c *Client4) CreateJob(ctx context.Context, job *Job) (*Job, *Response, error) {
	buf, err := json.Marshal(job)
	if err != nil {
		return nil, nil, NewAppError("CreateJob", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.jobsRoute(), buf)
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
func (c *Client4) CancelJob(ctx context.Context, jobId string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.jobsRoute()+fmt.Sprintf("/%v/cancel", jobId), "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DownloadJob downloads the results of the job
func (c *Client4) DownloadJob(ctx context.Context, jobId string) ([]byte, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.jobsRoute()+fmt.Sprintf("/%v/download", jobId), "")
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

// UpdateJobStatus updates the status of a job
func (c *Client4) UpdateJobStatus(ctx context.Context, jobId string, status string, force bool) (*Response, error) {
	buf, err := json.Marshal(map[string]any{
		"status": status,
		"force":  force,
	})
	if err != nil {
		return nil, NewAppError("UpdateJobStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPatchBytes(ctx, c.jobsRoute()+fmt.Sprintf("/%v/status", jobId), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Roles Section

// GetAllRoles returns a list of all the roles.
func (c *Client4) GetAllRoles(ctx context.Context) ([]*Role, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.rolesRoute(), "")
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
func (c *Client4) GetRole(ctx context.Context, id string) (*Role, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.rolesRoute()+fmt.Sprintf("/%v", id), "")
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
func (c *Client4) GetRoleByName(ctx context.Context, name string) (*Role, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.rolesRoute()+fmt.Sprintf("/name/%v", name), "")
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
func (c *Client4) GetRolesByNames(ctx context.Context, roleNames []string) ([]*Role, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.rolesRoute()+"/names", ArrayToJSON(roleNames))
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
func (c *Client4) PatchRole(ctx context.Context, roleId string, patch *RolePatch) (*Role, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchRole", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.rolesRoute()+fmt.Sprintf("/%v/patch", roleId), buf)
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
func (c *Client4) CreateScheme(ctx context.Context, scheme *Scheme) (*Scheme, *Response, error) {
	buf, err := json.Marshal(scheme)
	if err != nil {
		return nil, nil, NewAppError("CreateScheme", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.schemesRoute(), buf)
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
func (c *Client4) GetScheme(ctx context.Context, id string) (*Scheme, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.schemeRoute(id), "")
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
func (c *Client4) GetSchemes(ctx context.Context, scope string, page int, perPage int) ([]*Scheme, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.schemesRoute()+fmt.Sprintf("?scope=%v&page=%v&per_page=%v", scope, page, perPage), "")
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
func (c *Client4) DeleteScheme(ctx context.Context, id string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.schemeRoute(id))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// PatchScheme partially updates a scheme in the system. Any missing fields are not updated.
func (c *Client4) PatchScheme(ctx context.Context, id string, patch *SchemePatch) (*Scheme, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchScheme", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.schemeRoute(id)+"/patch", buf)
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
func (c *Client4) GetTeamsForScheme(ctx context.Context, schemeId string, page int, perPage int) ([]*Team, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.schemeRoute(schemeId)+fmt.Sprintf("/teams?page=%v&per_page=%v", page, perPage), "")
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
func (c *Client4) GetChannelsForScheme(ctx context.Context, schemeId string, page int, perPage int) (ChannelList, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.schemeRoute(schemeId)+fmt.Sprintf("/channels?page=%v&per_page=%v", page, perPage), "")
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

	rq, err := http.NewRequestWithContext(ctx, "POST", c.APIURL+c.pluginsRoute(), body)
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

func (c *Client4) InstallPluginFromURL(ctx context.Context, downloadURL string, force bool) (*Manifest, *Response, error) {
	forceStr := c.boolString(force)

	url := fmt.Sprintf("%s?plugin_download_url=%s&force=%s", c.pluginsRoute()+"/install_from_url", url.QueryEscape(downloadURL), forceStr)
	r, err := c.DoAPIPost(ctx, url, "")
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
func (c *Client4) InstallMarketplacePlugin(ctx context.Context, request *InstallMarketplacePluginRequest) (*Manifest, *Response, error) {
	buf, err := json.Marshal(request)
	if err != nil {
		return nil, nil, NewAppError("InstallMarketplacePlugin", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.pluginsRoute()+"/marketplace", string(buf))
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

// ReattachPlugin asks the server to reattach to a plugin launched by another process.
//
// Only available in local mode, and currently only used for testing.
func (c *Client4) ReattachPlugin(ctx context.Context, request *PluginReattachRequest) (*Response, error) {
	buf, err := json.Marshal(request)
	if err != nil {
		return nil, NewAppError("ReattachPlugin", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.pluginsRoute()+"/reattach", string(buf))
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
	r, err := c.DoAPIPost(ctx, c.pluginRoute(pluginID)+"/detach", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

// GetPlugins will return a list of plugin manifests for currently active plugins.
func (c *Client4) GetPlugins(ctx context.Context) (*PluginsResponse, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.pluginsRoute(), "")
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
func (c *Client4) GetPluginStatuses(ctx context.Context) (PluginStatuses, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.pluginsRoute()+"/statuses", "")
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
func (c *Client4) RemovePlugin(ctx context.Context, id string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.pluginRoute(id))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetWebappPlugins will return a list of plugins that the webapp should download.
func (c *Client4) GetWebappPlugins(ctx context.Context) ([]*Manifest, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.pluginsRoute()+"/webapp", "")
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
func (c *Client4) EnablePlugin(ctx context.Context, id string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.pluginRoute(id)+"/enable", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// DisablePlugin will disable an enabled plugin.
func (c *Client4) DisablePlugin(ctx context.Context, id string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.pluginRoute(id)+"/disable", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetMarketplacePlugins will return a list of plugins that an admin can install.
func (c *Client4) GetMarketplacePlugins(ctx context.Context, filter *MarketplacePluginFilter) ([]*MarketplacePlugin, *Response, error) {
	route := c.pluginsRoute() + "/marketplace"
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
		return nil, BuildResponse(r), NewAppError(route, "model.client.parse_plugins.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return plugins, BuildResponse(r), nil
}

// UpdateChannelScheme will update a channel's scheme.
func (c *Client4) UpdateChannelScheme(ctx context.Context, channelId, schemeId string) (*Response, error) {
	sip := &SchemeIDPatch{SchemeID: &schemeId}
	buf, err := json.Marshal(sip)
	if err != nil {
		return nil, NewAppError("UpdateChannelScheme", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.channelSchemeRoute(channelId), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// UpdateTeamScheme will update a team's scheme.
func (c *Client4) UpdateTeamScheme(ctx context.Context, teamId, schemeId string) (*Response, error) {
	sip := &SchemeIDPatch{SchemeID: &schemeId}
	buf, err := json.Marshal(sip)
	if err != nil {
		return nil, NewAppError("UpdateTeamScheme", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.teamSchemeRoute(teamId), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetRedirectLocation retrieves the value of the 'Location' header of an HTTP response for a given URL.
func (c *Client4) GetRedirectLocation(ctx context.Context, urlParam, etag string) (string, *Response, error) {
	url := fmt.Sprintf("%s?url=%s", c.redirectLocationRoute(), url.QueryEscape(urlParam))
	r, err := c.DoAPIGet(ctx, url, etag)
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)
	return MapFromJSON(r.Body)["location"], BuildResponse(r), nil
}

// SetServerBusy will mark the server as busy, which disables non-critical services for `secs` seconds.
func (c *Client4) SetServerBusy(ctx context.Context, secs int) (*Response, error) {
	url := fmt.Sprintf("%s?seconds=%d", c.serverBusyRoute(), secs)
	r, err := c.DoAPIPost(ctx, url, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// ClearServerBusy will mark the server as not busy.
func (c *Client4) ClearServerBusy(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.serverBusyRoute())
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetServerBusy returns the current ServerBusyState including the time when a server marked busy
// will automatically have the flag cleared.
func (c *Client4) GetServerBusy(ctx context.Context) (*ServerBusyState, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.serverBusyRoute(), "")
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
func (c *Client4) RegisterTermsOfServiceAction(ctx context.Context, userId, termsOfServiceId string, accepted bool) (*Response, error) {
	url := c.userTermsOfServiceRoute(userId)
	data := map[string]any{"termsOfServiceId": termsOfServiceId, "accepted": accepted}
	r, err := c.DoAPIPost(ctx, url, StringInterfaceToJSON(data))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetTermsOfService fetches the latest terms of service
func (c *Client4) GetTermsOfService(ctx context.Context, etag string) (*TermsOfService, *Response, error) {
	url := c.termsOfServiceRoute()
	r, err := c.DoAPIGet(ctx, url, etag)
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
func (c *Client4) GetUserTermsOfService(ctx context.Context, userId, etag string) (*UserTermsOfService, *Response, error) {
	url := c.userTermsOfServiceRoute(userId)
	r, err := c.DoAPIGet(ctx, url, etag)
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
func (c *Client4) CreateTermsOfService(ctx context.Context, text, userId string) (*TermsOfService, *Response, error) {
	url := c.termsOfServiceRoute()
	data := map[string]any{"text": text}
	r, err := c.DoAPIPost(ctx, url, StringInterfaceToJSON(data))
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

func (c *Client4) GetGroup(ctx context.Context, groupID, etag string) (*Group, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.groupRoute(groupID), etag)
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

func (c *Client4) CreateGroup(ctx context.Context, group *Group) (*Group, *Response, error) {
	groupJSON, err := json.Marshal(group)
	if err != nil {
		return nil, nil, NewAppError("CreateGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, "/groups", groupJSON)
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

func (c *Client4) DeleteGroup(ctx context.Context, groupID string) (*Group, *Response, error) {
	r, err := c.DoAPIDelete(ctx, c.groupRoute(groupID))
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

func (c *Client4) RestoreGroup(ctx context.Context, groupID string, etag string) (*Group, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.groupRoute(groupID)+"/restore", "")
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

func (c *Client4) PatchGroup(ctx context.Context, groupID string, patch *GroupPatch) (*Group, *Response, error) {
	payload, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchGroup", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPut(ctx, c.groupRoute(groupID)+"/patch", string(payload))
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

func (c *Client4) GetGroupMembers(ctx context.Context, groupID string) (*GroupMemberList, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.groupRoute(groupID)+"/members", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var ml GroupMemberList
	if err := json.NewDecoder(r.Body).Decode(&ml); err != nil {
		return nil, nil, NewAppError("UpsertGroupMembers", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &ml, BuildResponse(r), nil
}

func (c *Client4) UpsertGroupMembers(ctx context.Context, groupID string, userIds *GroupModifyMembers) ([]*GroupMember, *Response, error) {
	payload, err := json.Marshal(userIds)
	if err != nil {
		return nil, nil, NewAppError("UpsertGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.groupRoute(groupID)+"/members", payload)
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

func (c *Client4) DeleteGroupMembers(ctx context.Context, groupID string, userIds *GroupModifyMembers) ([]*GroupMember, *Response, error) {
	payload, err := json.Marshal(userIds)
	if err != nil {
		return nil, nil, NewAppError("DeleteGroupMembers", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIDeleteBytes(ctx, c.groupRoute(groupID)+"/members", payload)
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

func (c *Client4) LinkGroupSyncable(ctx context.Context, groupID, syncableID string, syncableType GroupSyncableType, patch *GroupSyncablePatch) (*GroupSyncable, *Response, error) {
	payload, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("LinkGroupSyncable", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	url := fmt.Sprintf("%s/link", c.groupSyncableRoute(groupID, syncableID, syncableType))
	r, err := c.DoAPIPost(ctx, url, string(payload))
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

func (c *Client4) UnlinkGroupSyncable(ctx context.Context, groupID, syncableID string, syncableType GroupSyncableType) (*Response, error) {
	url := fmt.Sprintf("%s/link", c.groupSyncableRoute(groupID, syncableID, syncableType))
	r, err := c.DoAPIDelete(ctx, url)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetGroupSyncable(ctx context.Context, groupID, syncableID string, syncableType GroupSyncableType, etag string) (*GroupSyncable, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.groupSyncableRoute(groupID, syncableID, syncableType), etag)
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

func (c *Client4) GetGroupSyncables(ctx context.Context, groupID string, syncableType GroupSyncableType, etag string) ([]*GroupSyncable, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.groupSyncablesRoute(groupID, syncableType), etag)
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

func (c *Client4) PatchGroupSyncable(ctx context.Context, groupID, syncableID string, syncableType GroupSyncableType, patch *GroupSyncablePatch) (*GroupSyncable, *Response, error) {
	payload, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchGroupSyncable", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPut(ctx, c.groupSyncableRoute(groupID, syncableID, syncableType)+"/patch", string(payload))
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

func (c *Client4) TeamMembersMinusGroupMembers(ctx context.Context, teamID string, groupIDs []string, page, perPage int, etag string) ([]*UserWithGroups, int64, *Response, error) {
	groupIDStr := strings.Join(groupIDs, ",")
	query := fmt.Sprintf("?group_ids=%s&page=%d&per_page=%d", groupIDStr, page, perPage)
	r, err := c.DoAPIGet(ctx, c.teamRoute(teamID)+"/members_minus_group_members"+query, etag)
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

func (c *Client4) ChannelMembersMinusGroupMembers(ctx context.Context, channelID string, groupIDs []string, page, perPage int, etag string) ([]*UserWithGroups, int64, *Response, error) {
	groupIDStr := strings.Join(groupIDs, ",")
	query := fmt.Sprintf("?group_ids=%s&page=%d&per_page=%d", groupIDStr, page, perPage)
	r, err := c.DoAPIGet(ctx, c.channelRoute(channelID)+"/members_minus_group_members"+query, etag)
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

func (c *Client4) PatchConfig(ctx context.Context, config *Config) (*Config, *Response, error) {
	buf, err := json.Marshal(config)
	if err != nil {
		return nil, nil, NewAppError("PatchConfig", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.configRoute()+"/patch", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cfg *Config
	d := json.NewDecoder(r.Body)
	return cfg, BuildResponse(r), d.Decode(&cfg)
}

func (c *Client4) GetChannelModerations(ctx context.Context, channelID string, etag string) ([]*ChannelModeration, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.channelRoute(channelID)+"/moderations", etag)
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

func (c *Client4) PatchChannelModerations(ctx context.Context, channelID string, patch []*ChannelModerationPatch) ([]*ChannelModeration, *Response, error) {
	payload, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchChannelModerations", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPut(ctx, c.channelRoute(channelID)+"/moderations/patch", string(payload))
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

func (c *Client4) GetKnownUsers(ctx context.Context) ([]string, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.usersRoute()+"/known", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var userIds []string
	json.NewDecoder(r.Body).Decode(&userIds)
	return userIds, BuildResponse(r), nil
}

// PublishUserTyping publishes a user is typing websocket event based on the provided TypingRequest.
func (c *Client4) PublishUserTyping(ctx context.Context, userID string, typingRequest TypingRequest) (*Response, error) {
	buf, err := json.Marshal(typingRequest)
	if err != nil {
		return nil, NewAppError("PublishUserTyping", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.publishUserTypingRoute(userID), buf)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetChannelMemberCountsByGroup(ctx context.Context, channelID string, includeTimezones bool, etag string) ([]*ChannelMemberCountByGroup, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.channelRoute(channelID)+"/member_counts_by_group?include_timezones="+strconv.FormatBool(includeTimezones), etag)
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

func (c *Client4) RequestTrialLicenseWithExtraFields(ctx context.Context, trialRequest *TrialLicenseRequest) (*Response, error) {
	b, err := json.Marshal(trialRequest)
	if err != nil {
		return nil, NewAppError("RequestTrialLicense", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPost(ctx, "/trial-license", string(b))
	if err != nil {
		return BuildResponse(r), err
	}

	defer closeBody(r)
	return BuildResponse(r), nil
}

// RequestTrialLicense will request a trial license and install it in the server
// DEPRECATED - USE RequestTrialLicenseWithExtraFields (this method remains for backwards compatibility)
func (c *Client4) RequestTrialLicense(ctx context.Context, users int) (*Response, error) {
	b, err := json.Marshal(map[string]any{"users": users, "terms_accepted": true})
	if err != nil {
		return nil, NewAppError("RequestTrialLicense", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, "/trial-license", string(b))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// GetGroupStats retrieves stats for a Mattermost Group
func (c *Client4) GetGroupStats(ctx context.Context, groupID string) (*GroupStats, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.groupRoute(groupID)+"/stats", "")
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

func (c *Client4) GetSidebarCategoriesForTeamForUser(ctx context.Context, userID, teamID, etag string) (*OrderedSidebarCategories, *Response, error) {
	route := c.userCategoryRoute(userID, teamID)
	r, err := c.DoAPIGet(ctx, route, etag)
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

func (c *Client4) CreateSidebarCategoryForTeamForUser(ctx context.Context, userID, teamID string, category *SidebarCategoryWithChannels) (*SidebarCategoryWithChannels, *Response, error) {
	payload, err := json.Marshal(category)
	if err != nil {
		return nil, nil, NewAppError("CreateSidebarCategoryForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	route := c.userCategoryRoute(userID, teamID)
	r, err := c.DoAPIPostBytes(ctx, route, payload)
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

func (c *Client4) UpdateSidebarCategoriesForTeamForUser(ctx context.Context, userID, teamID string, categories []*SidebarCategoryWithChannels) ([]*SidebarCategoryWithChannels, *Response, error) {
	payload, err := json.Marshal(categories)
	if err != nil {
		return nil, nil, NewAppError("UpdateSidebarCategoriesForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	route := c.userCategoryRoute(userID, teamID)

	r, err := c.DoAPIPutBytes(ctx, route, payload)
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

func (c *Client4) GetSidebarCategoryOrderForTeamForUser(ctx context.Context, userID, teamID, etag string) ([]string, *Response, error) {
	route := c.userCategoryRoute(userID, teamID) + "/order"
	r, err := c.DoAPIGet(ctx, route, etag)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return c.ArrayFromJSON(r.Body), BuildResponse(r), nil
}

func (c *Client4) UpdateSidebarCategoryOrderForTeamForUser(ctx context.Context, userID, teamID string, order []string) ([]string, *Response, error) {
	payload, err := json.Marshal(order)
	if err != nil {
		return nil, nil, NewAppError("UpdateSidebarCategoryOrderForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	route := c.userCategoryRoute(userID, teamID) + "/order"
	r, err := c.DoAPIPutBytes(ctx, route, payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return c.ArrayFromJSON(r.Body), BuildResponse(r), nil
}

func (c *Client4) GetSidebarCategoryForTeamForUser(ctx context.Context, userID, teamID, categoryID, etag string) (*SidebarCategoryWithChannels, *Response, error) {
	route := c.userCategoryRoute(userID, teamID) + "/" + categoryID
	r, err := c.DoAPIGet(ctx, route, etag)
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

func (c *Client4) UpdateSidebarCategoryForTeamForUser(ctx context.Context, userID, teamID, categoryID string, category *SidebarCategoryWithChannels) (*SidebarCategoryWithChannels, *Response, error) {
	payload, err := json.Marshal(category)
	if err != nil {
		return nil, nil, NewAppError("UpdateSidebarCategoryForTeamForUser", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	route := c.userCategoryRoute(userID, teamID) + "/" + categoryID
	r, err := c.DoAPIPutBytes(ctx, route, payload)
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

// DeleteSidebarCategoryForTeamForUser deletes a sidebar category for a user in a team.
func (c *Client4) DeleteSidebarCategoryForTeamForUser(ctx context.Context, userId string, teamId string, categoryId string) (*Response, error) {
	url := fmt.Sprintf("%s/%s", c.userCategoryRoute(userId, teamId), categoryId)
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
	var results []IntegrityCheckResult
	if err := json.NewDecoder(r.Body).Decode(&results); err != nil {
		return nil, BuildResponse(r), NewAppError("Api4.CheckIntegrity", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return results, BuildResponse(r), nil
}

func (c *Client4) GetNotices(ctx context.Context, lastViewed int64, teamId string, client NoticeClientType, clientVersion, locale, etag string) (NoticeMessages, *Response, error) {
	url := fmt.Sprintf("/system/notices/%s?lastViewed=%d&client=%s&clientVersion=%s&locale=%s", teamId, lastViewed, client, clientVersion, locale)
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
	r, err := c.DoAPIPut(ctx, "/system/notices/view", ArrayToJSON(ids))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) CompleteOnboarding(ctx context.Context, request *CompleteOnboardingRequest) (*Response, error) {
	buf, err := json.Marshal(request)
	if err != nil {
		return nil, NewAppError("CompleteOnboarding", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPost(ctx, c.systemRoute()+"/onboarding/complete", string(buf))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

// CreateUpload creates a new upload session.
func (c *Client4) CreateUpload(ctx context.Context, us *UploadSession) (*UploadSession, *Response, error) {
	buf, err := json.Marshal(us)
	if err != nil {
		return nil, nil, NewAppError("CreateUpload", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.uploadsRoute(), buf)
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
func (c *Client4) GetUpload(ctx context.Context, uploadId string) (*UploadSession, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.uploadRoute(uploadId), "")
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
func (c *Client4) GetUploadsForUser(ctx context.Context, userId string) ([]*UploadSession, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userRoute(userId)+"/uploads", "")
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
func (c *Client4) UploadData(ctx context.Context, uploadId string, data io.Reader) (*FileInfo, *Response, error) {
	url := c.uploadRoute(uploadId)
	r, err := c.DoAPIRequestReader(ctx, "POST", c.APIURL+url, data, nil)
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

func (c *Client4) UpdatePassword(ctx context.Context, userId, currentPassword, newPassword string) (*Response, error) {
	requestBody := map[string]string{"current_password": currentPassword, "new_password": newPassword}
	r, err := c.DoAPIPut(ctx, c.userRoute(userId)+"/password", MapToJSON(requestBody))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// Cloud Section

func (c *Client4) GetCloudProducts(ctx context.Context) ([]*Product, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.cloudRoute()+"/products", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cloudProducts []*Product
	json.NewDecoder(r.Body).Decode(&cloudProducts)

	return cloudProducts, BuildResponse(r), nil
}

func (c *Client4) GetSelfHostedProducts(ctx context.Context) ([]*Product, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.cloudRoute()+"/products/selfhosted", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var products []*Product
	json.NewDecoder(r.Body).Decode(&products)

	return products, BuildResponse(r), nil
}

func (c *Client4) GetProductLimits(ctx context.Context) (*ProductLimits, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.cloudRoute()+"/limits", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var productLimits *ProductLimits
	json.NewDecoder(r.Body).Decode(&productLimits)

	return productLimits, BuildResponse(r), nil
}

func (c *Client4) GetIPFilters(ctx context.Context) (*AllowedIPRanges, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.ipFiltersRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)

	var allowedIPRanges *AllowedIPRanges
	json.NewDecoder(r.Body).Decode(&allowedIPRanges)
	return allowedIPRanges, BuildResponse(r), nil
}

func (c *Client4) ApplyIPFilters(ctx context.Context, allowedRanges *AllowedIPRanges) (*AllowedIPRanges, *Response, error) {
	payload, err := json.Marshal(allowedRanges)
	if err != nil {
		return nil, nil, NewAppError("ApplyIPFilters", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPostBytes(ctx, c.ipFiltersRoute(), payload)
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)

	var allowedIPRanges *AllowedIPRanges
	json.NewDecoder(r.Body).Decode(&allowedIPRanges)

	return allowedIPRanges, BuildResponse(r), nil
}

func (c *Client4) GetMyIP(ctx context.Context) (*GetIPAddressResponse, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.ipFiltersRoute()+"/my_ip", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)

	var response *GetIPAddressResponse
	json.NewDecoder(r.Body).Decode(&response)

	return response, BuildResponse(r), nil
}

func (c *Client4) ValidateWorkspaceBusinessEmail(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.cloudRoute()+"/validate-workspace-business-email", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) NotifyAdmin(ctx context.Context, nr *NotifyAdminToUpgradeRequest) (int, error) {
	nrJSON, err := json.Marshal(nr)
	if err != nil {
		return 0, err
	}

	r, err := c.DoAPIPost(ctx, "/users/notify-admin", string(nrJSON))
	if err != nil {
		return r.StatusCode, err
	}

	closeBody(r)

	return r.StatusCode, nil
}

func (c *Client4) TriggerNotifyAdmin(ctx context.Context, nr *NotifyAdminToUpgradeRequest) (int, error) {
	nrJSON, err := json.Marshal(nr)
	if err != nil {
		return 0, err
	}

	r, err := c.DoAPIPost(ctx, "/users/trigger-notify-admin-posts", string(nrJSON))
	if err != nil {
		return r.StatusCode, err
	}

	closeBody(r)

	return r.StatusCode, nil
}

func (c *Client4) ValidateBusinessEmail(ctx context.Context, email *ValidateBusinessEmailRequest) (*Response, error) {
	payload, _ := json.Marshal(email)
	r, err := c.DoAPIPostBytes(ctx, c.cloudRoute()+"/validate-business-email", payload)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) GetCloudCustomer(ctx context.Context) (*CloudCustomer, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.cloudRoute()+"/customer", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var cloudCustomer *CloudCustomer
	json.NewDecoder(r.Body).Decode(&cloudCustomer)

	return cloudCustomer, BuildResponse(r), nil
}

func (c *Client4) GetSubscription(ctx context.Context) (*Subscription, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.cloudRoute()+"/subscription", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var subscription *Subscription
	json.NewDecoder(r.Body).Decode(&subscription)

	return subscription, BuildResponse(r), nil
}

func (c *Client4) GetInvoicesForSubscription(ctx context.Context) ([]*Invoice, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.cloudRoute()+"/subscription/invoices", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var invoices []*Invoice
	json.NewDecoder(r.Body).Decode(&invoices)

	return invoices, BuildResponse(r), nil
}

func (c *Client4) UpdateCloudCustomer(ctx context.Context, customerInfo *CloudCustomerInfo) (*CloudCustomer, *Response, error) {
	customerBytes, err := json.Marshal(customerInfo)
	if err != nil {
		return nil, nil, NewAppError("UpdateCloudCustomer", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.cloudRoute()+"/customer", customerBytes)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var customer *CloudCustomer
	json.NewDecoder(r.Body).Decode(&customer)

	return customer, BuildResponse(r), nil
}

func (c *Client4) UpdateCloudCustomerAddress(ctx context.Context, address *Address) (*CloudCustomer, *Response, error) {
	addressBytes, err := json.Marshal(address)
	if err != nil {
		return nil, nil, NewAppError("UpdateCloudCustomerAddress", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPutBytes(ctx, c.cloudRoute()+"/customer/address", addressBytes)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var customer *CloudCustomer
	json.NewDecoder(r.Body).Decode(&customer)

	return customer, BuildResponse(r), nil
}

func (c *Client4) ListImports(ctx context.Context) ([]string, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.importsRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return c.ArrayFromJSON(r.Body), BuildResponse(r), nil
}

func (c *Client4) ListExports(ctx context.Context) ([]string, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.exportsRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return c.ArrayFromJSON(r.Body), BuildResponse(r), nil
}

func (c *Client4) DeleteExport(ctx context.Context, name string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.exportRoute(name))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) DownloadExport(ctx context.Context, name string, wr io.Writer, offset int64) (int64, *Response, error) {
	var headers map[string]string
	if offset > 0 {
		headers = map[string]string{
			HeaderRange: fmt.Sprintf("bytes=%d-", offset),
		}
	}
	r, err := c.DoAPIRequestWithHeaders(ctx, http.MethodGet, c.APIURL+c.exportRoute(name), "", headers)
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

func (c *Client4) GeneratePresignedURL(ctx context.Context, name string) (*PresignURLResponse, *Response, error) {
	r, err := c.DoAPIRequest(ctx, http.MethodPost, c.APIURL+c.exportRoute(name)+"/presign-url", "", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	res := &PresignURLResponse{}
	err = json.NewDecoder(r.Body).Decode(res)
	if err != nil {
		return nil, BuildResponse(r), NewAppError("GeneratePresignedURL", "model.client.json_decode.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return res, BuildResponse(r), nil
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
	url := c.userThreadsRoute(userId, teamId)
	if len(v) > 0 {
		url += "?" + v.Encode()
	}

	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var threads Threads
	json.NewDecoder(r.Body).Decode(&threads)

	return &threads, BuildResponse(r), nil
}

func (c *Client4) GetUserThread(ctx context.Context, userId, teamId, threadId string, extended bool) (*ThreadResponse, *Response, error) {
	url := c.userThreadRoute(userId, teamId, threadId)
	if extended {
		url += "?extended=true"
	}
	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var thread ThreadResponse
	json.NewDecoder(r.Body).Decode(&thread)

	return &thread, BuildResponse(r), nil
}

func (c *Client4) UpdateThreadsReadForUser(ctx context.Context, userId, teamId string) (*Response, error) {
	r, err := c.DoAPIPut(ctx, fmt.Sprintf("%s/read", c.userThreadsRoute(userId, teamId)), "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) SetThreadUnreadByPostId(ctx context.Context, userId, teamId, threadId, postId string) (*ThreadResponse, *Response, error) {
	r, err := c.DoAPIPost(ctx, fmt.Sprintf("%s/set_unread/%s", c.userThreadRoute(userId, teamId, threadId), postId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var thread ThreadResponse
	json.NewDecoder(r.Body).Decode(&thread)

	return &thread, BuildResponse(r), nil
}

func (c *Client4) UpdateThreadReadForUser(ctx context.Context, userId, teamId, threadId string, timestamp int64) (*ThreadResponse, *Response, error) {
	r, err := c.DoAPIPut(ctx, fmt.Sprintf("%s/read/%d", c.userThreadRoute(userId, teamId, threadId), timestamp), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var thread ThreadResponse
	json.NewDecoder(r.Body).Decode(&thread)

	return &thread, BuildResponse(r), nil
}

func (c *Client4) UpdateThreadFollowForUser(ctx context.Context, userId, teamId, threadId string, state bool) (*Response, error) {
	var err error
	var r *http.Response
	if state {
		r, err = c.DoAPIPut(ctx, c.userThreadRoute(userId, teamId, threadId)+"/following", "")
	} else {
		r, err = c.DoAPIDelete(ctx, c.userThreadRoute(userId, teamId, threadId)+"/following")
	}
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

func (c *Client4) GetAllSharedChannels(ctx context.Context, teamID string, page, perPage int) ([]*SharedChannel, *Response, error) {
	url := fmt.Sprintf("%s/%s?page=%d&per_page=%d", c.sharedChannelsRoute(), teamID, page, perPage)
	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var channels []*SharedChannel
	json.NewDecoder(r.Body).Decode(&channels)

	return channels, BuildResponse(r), nil
}

func (c *Client4) GetRemoteClusterInfo(ctx context.Context, remoteID string) (RemoteClusterInfo, *Response, error) {
	url := fmt.Sprintf("%s/remote_info/%s", c.sharedChannelsRoute(), remoteID)
	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return RemoteClusterInfo{}, BuildResponse(r), err
	}
	defer closeBody(r)

	var rci RemoteClusterInfo
	json.NewDecoder(r.Body).Decode(&rci)

	return rci, BuildResponse(r), nil
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
	url := c.remoteClusterRoute()
	if len(v) > 0 {
		url += "?" + v.Encode()
	}

	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var rcs []*RemoteCluster
	json.NewDecoder(r.Body).Decode(&rcs)

	return rcs, BuildResponse(r), nil
}

func (c *Client4) CreateRemoteCluster(ctx context.Context, rcWithPassword *RemoteClusterWithPassword) (*RemoteClusterWithInvite, *Response, error) {
	rcJSON, err := json.Marshal(rcWithPassword)
	if err != nil {
		return nil, nil, NewAppError("CreateRemoteCluster", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPost(ctx, c.remoteClusterRoute(), string(rcJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var rcWithInvite RemoteClusterWithInvite
	if err := json.NewDecoder(r.Body).Decode(&rcWithInvite); err != nil {
		return nil, nil, NewAppError("CreateRemoteCluster", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &rcWithInvite, BuildResponse(r), nil
}

func (c *Client4) RemoteClusterAcceptInvite(ctx context.Context, rcAcceptInvite *RemoteClusterAcceptInvite) (*RemoteCluster, *Response, error) {
	rcAcceptInviteJSON, err := json.Marshal(rcAcceptInvite)
	if err != nil {
		return nil, nil, NewAppError("RemoteClusterAcceptInvite", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	url := fmt.Sprintf("%s/accept_invite", c.remoteClusterRoute())
	r, err := c.DoAPIPost(ctx, url, string(rcAcceptInviteJSON))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var rc RemoteCluster
	if err := json.NewDecoder(r.Body).Decode(&rc); err != nil {
		return nil, nil, NewAppError("RemoteClusterAcceptInvite", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &rc, BuildResponse(r), nil
}

func (c *Client4) GenerateRemoteClusterInvite(ctx context.Context, remoteClusterId, password string) (string, *Response, error) {
	url := fmt.Sprintf("%s/%s/generate_invite", c.remoteClusterRoute(), remoteClusterId)
	r, err := c.DoAPIPost(ctx, url, MapToJSON(map[string]string{"password": password}))
	if err != nil {
		return "", BuildResponse(r), err
	}
	defer closeBody(r)

	var inviteCode string
	if err := json.NewDecoder(r.Body).Decode(&inviteCode); err != nil {
		return "", nil, NewAppError("GenerateRemoteClusterInvite", "api.unmarshall_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return inviteCode, BuildResponse(r), nil
}

func (c *Client4) GetRemoteCluster(ctx context.Context, remoteClusterId string) (*RemoteCluster, *Response, error) {
	r, err := c.DoAPIGet(ctx, fmt.Sprintf("%s/%s", c.remoteClusterRoute(), remoteClusterId), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var rc *RemoteCluster
	if err := json.NewDecoder(r.Body).Decode(&rc); err != nil {
		return nil, nil, NewAppError("GetRemoteCluster", "api.unmarshall_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return rc, BuildResponse(r), nil
}

func (c *Client4) PatchRemoteCluster(ctx context.Context, remoteClusterId string, patch *RemoteClusterPatch) (*RemoteCluster, *Response, error) {
	patchJSON, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchRemoteCluster", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	url := fmt.Sprintf("%s/%s", c.remoteClusterRoute(), remoteClusterId)
	r, err := c.DoAPIPatchBytes(ctx, url, patchJSON)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var rc RemoteCluster
	if err := json.NewDecoder(r.Body).Decode(&rc); err != nil {
		return nil, nil, NewAppError("PatchRemoteCluster", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &rc, BuildResponse(r), nil
}

func (c *Client4) DeleteRemoteCluster(ctx context.Context, remoteClusterId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, fmt.Sprintf("%s/%s", c.remoteClusterRoute(), remoteClusterId))
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
	url := c.sharedChannelRemotesRoute(remoteId)
	if len(v) > 0 {
		url += "?" + v.Encode()
	}

	r, err := c.DoAPIGet(ctx, url, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var scs []*SharedChannelRemote
	json.NewDecoder(r.Body).Decode(&scs)

	return scs, BuildResponse(r), nil
}

func (c *Client4) InviteRemoteClusterToChannel(ctx context.Context, remoteId, channelId string) (*Response, error) {
	url := fmt.Sprintf("%s/invite", c.channelRemoteRoute(remoteId, channelId))
	r, err := c.DoAPIPost(ctx, url, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) UninviteRemoteClusterToChannel(ctx context.Context, remoteId, channelId string) (*Response, error) {
	url := fmt.Sprintf("%s/uninvite", c.channelRemoteRoute(remoteId, channelId))
	r, err := c.DoAPIPost(ctx, url, "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) GetAncillaryPermissions(ctx context.Context, subsectionPermissions []string) ([]string, *Response, error) {
	var returnedPermissions []string
	url := fmt.Sprintf("%s/ancillary", c.permissionsRoute())
	r, err := c.DoAPIPost(ctx, url, ArrayToJSON(subsectionPermissions))
	if err != nil {
		return returnedPermissions, BuildResponse(r), err
	}
	defer closeBody(r)

	json.NewDecoder(r.Body).Decode(&returnedPermissions)
	return returnedPermissions, BuildResponse(r), nil
}

func (c *Client4) GetUsersWithInvalidEmails(ctx context.Context, page, perPage int) ([]*User, *Response, error) {
	query := fmt.Sprintf("/invalid_emails?page=%v&per_page=%v", page, perPage)
	r, err := c.DoAPIGet(ctx, c.usersRoute()+query, "")
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

func (c *Client4) GetAppliedSchemaMigrations(ctx context.Context) ([]AppliedMigration, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.systemRoute()+"/schema/version", "")
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
func (c *Client4) GetPostsUsage(ctx context.Context) (*PostsUsage, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.usageRoute()+"/posts", "")
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
func (c *Client4) GetStorageUsage(ctx context.Context) (*StorageUsage, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.usageRoute()+"/storage", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var usage *StorageUsage
	err = json.NewDecoder(r.Body).Decode(&usage)
	return usage, BuildResponse(r), err
}

// GetTeamsUsage returns total usage of teams for the instance
func (c *Client4) GetTeamsUsage(ctx context.Context) (*TeamsUsage, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.usageRoute()+"/teams", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var usage *TeamsUsage
	err = json.NewDecoder(r.Body).Decode(&usage)
	return usage, BuildResponse(r), err
}

func (c *Client4) GetPostInfo(ctx context.Context, postId string) (*PostInfo, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.postRoute(postId)+"/info", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var info *PostInfo
	if err = json.NewDecoder(r.Body).Decode(&info); err != nil {
		return nil, nil, NewAppError("GetPostInfo", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return info, BuildResponse(r), nil
}

func (c *Client4) AcknowledgePost(ctx context.Context, postId, userId string) (*PostAcknowledgement, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.userRoute(userId)+c.postRoute(postId)+"/ack", "")
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

func (c *Client4) UnacknowledgePost(ctx context.Context, postId, userId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.userRoute(userId)+c.postRoute(postId)+"/ack")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) AddUserToGroupSyncables(ctx context.Context, userID string) (*Response, error) {
	r, err := c.DoAPIPost(ctx, c.ldapRoute()+"/users/"+userID+"/group_sync_memberships", "")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) CheckCWSConnection(ctx context.Context, userId string) (*Response, error) {
	r, err := c.DoAPIGet(ctx, c.cloudRoute()+"/healthz", "")

	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)

	return BuildResponse(r), nil
}

// CreateChannelBookmark creates a channel bookmark based on the provided struct.
func (c *Client4) CreateChannelBookmark(ctx context.Context, channelBookmark *ChannelBookmark) (*ChannelBookmarkWithFileInfo, *Response, error) {
	channelBookmarkJSON, err := json.Marshal(channelBookmark)
	if err != nil {
		return nil, nil, NewAppError("CreateChannelBookmark", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.bookmarksRoute(channelBookmark.ChannelId), channelBookmarkJSON)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var cb ChannelBookmarkWithFileInfo
	if err := json.NewDecoder(r.Body).Decode(&cb); err != nil {
		return nil, nil, NewAppError("CreateChannelBookmark", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &cb, BuildResponse(r), nil
}

// UpdateChannelBookmark updates a channel bookmark based on the provided struct.
func (c *Client4) UpdateChannelBookmark(ctx context.Context, channelId, bookmarkId string, patch *ChannelBookmarkPatch) (*UpdateChannelBookmarkResponse, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("UpdateChannelBookmark", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPatchBytes(ctx, c.bookmarkRoute(channelId, bookmarkId), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var ucb UpdateChannelBookmarkResponse
	if err := json.NewDecoder(r.Body).Decode(&ucb); err != nil {
		return nil, nil, NewAppError("UpdateChannelBookmark", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &ucb, BuildResponse(r), nil
}

// UpdateChannelBookmarkSortOrder updates a channel bookmark's sort order based on the provided new index.
func (c *Client4) UpdateChannelBookmarkSortOrder(ctx context.Context, channelId, bookmarkId string, sortOrder int64) ([]*ChannelBookmarkWithFileInfo, *Response, error) {
	buf, err := json.Marshal(sortOrder)
	if err != nil {
		return nil, nil, NewAppError("UpdateChannelBookmarkSortOrder", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.bookmarkRoute(channelId, bookmarkId)+"/sort_order", buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var b []*ChannelBookmarkWithFileInfo
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		return nil, nil, NewAppError("UpdateChannelBookmarkSortOrder", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return b, BuildResponse(r), nil
}

// DeleteChannelBookmark deletes a channel bookmark.
func (c *Client4) DeleteChannelBookmark(ctx context.Context, channelId, bookmarkId string) (*ChannelBookmarkWithFileInfo, *Response, error) {
	r, err := c.DoAPIDelete(ctx, c.bookmarkRoute(channelId, bookmarkId))
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var b *ChannelBookmarkWithFileInfo
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		return nil, nil, NewAppError("DeleteChannelBookmark", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return b, BuildResponse(r), nil
}

func (c *Client4) ListChannelBookmarksForChannel(ctx context.Context, channelId string, since int64) ([]*ChannelBookmarkWithFileInfo, *Response, error) {
	query := fmt.Sprintf("?bookmarks_since=%v", since)
	r, err := c.DoAPIGet(ctx, c.bookmarksRoute(channelId)+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	var b []*ChannelBookmarkWithFileInfo
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		return nil, nil, NewAppError("ListChannelBookmarksForChannel", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return b, BuildResponse(r), nil
}

func (c *Client4) SubmitClientMetrics(ctx context.Context, report *PerformanceReport) (*Response, error) {
	buf, err := json.Marshal(report)
	if err != nil {
		return nil, NewAppError("SubmitClientMetrics", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	res, err := c.DoAPIPostBytes(ctx, c.clientPerfMetricsRoute(), buf)
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

	query := v.Encode()
	r, err := c.DoAPIGet(ctx, c.usersRoute()+"/stats/filtered?"+query, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var stats UsersStats
	if err := json.NewDecoder(r.Body).Decode(&stats); err != nil {
		return nil, nil, NewAppError("GetFilteredUsersStats", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &stats, BuildResponse(r), nil
}

func (c *Client4) RestorePostVersion(ctx context.Context, postId, versionId string) (*Post, *Response, error) {
	r, err := c.DoAPIPost(ctx, c.postRoute(postId)+"/restore/"+versionId, "")
	if err != nil {
		return nil, BuildResponse(r), err
	}

	defer closeBody(r)
	var restoredPost *Post
	if err := json.NewDecoder(r.Body).Decode(&restoredPost); err != nil {
		return nil, nil, NewAppError("RestorePostVersion", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return restoredPost, BuildResponse(r), nil
}

func (c *Client4) CreateCPAField(ctx context.Context, field *PropertyField) (*PropertyField, *Response, error) {
	buf, err := json.Marshal(field)
	if err != nil {
		return nil, nil, NewAppError("CreateCPAField", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPostBytes(ctx, c.customProfileAttributeFieldsRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var pf PropertyField
	if err := json.NewDecoder(r.Body).Decode(&pf); err != nil {
		return nil, nil, NewAppError("CreateCPAField", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &pf, BuildResponse(r), nil
}

func (c *Client4) ListCPAFields(ctx context.Context) ([]*PropertyField, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.customProfileAttributeFieldsRoute(), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var fields []*PropertyField
	if err := json.NewDecoder(r.Body).Decode(&fields); err != nil {
		return nil, nil, NewAppError("ListCPAFields", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, BuildResponse(r), nil
}

func (c *Client4) PatchCPAField(ctx context.Context, fieldID string, patch *PropertyFieldPatch) (*PropertyField, *Response, error) {
	buf, err := json.Marshal(patch)
	if err != nil {
		return nil, nil, NewAppError("PatchCPAField", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	r, err := c.DoAPIPatchBytes(ctx, c.customProfileAttributeFieldRoute(fieldID), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var pf PropertyField
	if err := json.NewDecoder(r.Body).Decode(&pf); err != nil {
		return nil, nil, NewAppError("PatchCPAField", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return &pf, BuildResponse(r), nil
}

func (c *Client4) DeleteCPAField(ctx context.Context, fieldID string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.customProfileAttributeFieldRoute(fieldID))
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

func (c *Client4) ListCPAValues(ctx context.Context, userID string) (map[string]json.RawMessage, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.userCustomProfileAttributesRoute(userID), "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	fields := make(map[string]json.RawMessage)
	if err := json.NewDecoder(r.Body).Decode(&fields); err != nil {
		return nil, nil, NewAppError("ListCPAValues", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return fields, BuildResponse(r), nil
}

func (c *Client4) PatchCPAValues(ctx context.Context, values map[string]json.RawMessage) (map[string]json.RawMessage, *Response, error) {
	buf, err := json.Marshal(values)
	if err != nil {
		return nil, nil, NewAppError("PatchCPAValues", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	r, err := c.DoAPIPatchBytes(ctx, c.customProfileAttributeValuesRoute(), buf)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)

	var patchedValues map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&patchedValues); err != nil {
		return nil, nil, NewAppError("PatchCPAValues", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return patchedValues, BuildResponse(r), nil
}
