// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"archive/zip"
	"bytes"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
)

func TestGlobalRelayExport(t *testing.T) {
	templatesDir, ok := fileutils.FindDir("templates")
	require.True(t, ok)

	templatesContainer, err := templates.New(templatesDir)
	require.NotNil(t, templatesContainer)
	require.NoError(t, err)

	tempDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(tempDir)
		assert.NoError(t, err)
	})

	rctx := request.TestContext(t)

	config := filestore.FileBackendSettings{
		DriverName: model.ImageDriverLocal,
		Directory:  tempDir,
	}

	fileBackend, err := filestore.NewFileBackend(config)
	assert.NoError(t, err)

	chanTypeDirect := model.ChannelTypeDirect
	csvExportTests := []struct {
		name             string
		cmhs             map[string][]*model.ChannelMemberHistoryResult
		posts            []*model.MessageExport
		attachments      map[string][]*model.FileInfo
		expectedHeaders  []string
		expectedTexts    []string
		expectedHTMLs    []string
		expectedFiles    int
		expectedWarnings int
	}{
		{
			name:             "empty",
			cmhs:             map[string][]*model.ChannelMemberHistoryResult{},
			posts:            []*model.MessageExport{},
			attachments:      map[string][]*model.FileInfo{},
			expectedHeaders:  []string{},
			expectedTexts:    []string{},
			expectedHTMLs:    []string{},
			expectedFiles:    0,
			expectedWarnings: 0,
		},
		{
			name: "posts",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, UserId: "test1", UserEmail: "test1@test.com", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
					{
						JoinTime: 8, UserId: "test2", UserEmail: "test2@test.com", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
					},
					{
						JoinTime: 400, UserId: "test3", UserEmail: "test3@test.com", Username: "test3",
					},
				},
			},
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					PostRootId:         model.NewPointer("post-root-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100000)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
			},
			attachments: map[string][]*model.FileInfo{},
			expectedHeaders: []string{
				"MIME-Version: 1.0",
				"X-Mattermost-ChannelType: direct",
				"Content-Transfer-Encoding: 8bit",
				"Precedence: bulk",
				"X-GlobalRelay-MsgType: Mattermost",
				"X-Mattermost-ChannelID: channel-id",
				"X-Mattermost-ChannelName: channel-display-name",
				"Auto-Submitted: auto-generated",
				"Date: Thu, 01 Jan 1970 00:01:40 +0000",
				"From: test1@test.com",
				"To: test1@test.com,test2@test.com",
				"Subject: Mattermost Compliance Export: channel-display-name",
			},

			expectedTexts: []string{
				strings.Join([]string{
					"* Channel: channel-display-name",
					"* Started: 1970-01-01T00:00:00Z",
					"* Ended: 1970-01-01T00:01:40Z",
					"* Duration: 2 minutes",
				}, "\r\n"),
				strings.Join([]string{
					"--------",
					"Messages",
					"--------",
					"",
					"* 1970-01-01T00:00:00Z @test1 user (test1@test.com): message",
					"* 1970-01-01T00:01:40Z @test1 user (test1@test.com): message",
				}, "\r\n"),
			},

			expectedHTMLs: []string{
				strings.Join([]string{
					"    <ul>",
					"        <li><span class=3D\"bold\">Channel:&nbsp;</span>channel-display-name<=",
					"/li>",
					"        <li><span class=3D\"bold\">Started:&nbsp;</span>1970-01-01T00:00:00Z<=",
					"/li>",
					"        <li><span class=3D\"bold\">Ended:&nbsp;</span>1970-01-01T00:01:40Z</l=",
					"i>",
					"        <li><span class=3D\"bold\">Duration:&nbsp;</span>2 minutes</li>",
					"    </ul>",
				}, "\r\n"),
				strings.Join([]string{
					"<tr>",
					"    <td class=3D\"username\">@test</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test1@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">2</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test2</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test2@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test3</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test3@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
				}, "\r\n"),

				strings.Join([]string{
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:00:00Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
					"",
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:01:40Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
				}, "\r\n"),
			},
			expectedFiles:    1,
			expectedWarnings: 0,
		},
		{
			name: "posts with attachments",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, UserId: "test1", UserEmail: "test1@test.com", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
					{
						JoinTime: 8, UserId: "test2", UserEmail: "test2@test.com", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
					},
					{
						JoinTime: 400, UserId: "test3", UserEmail: "test3@test.com", Username: "test3",
					},
				},
			},
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id-1"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{"test1"},
				},
				{
					PostId:             model.NewPointer("post-id-2"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					PostRootId:         model.NewPointer("post-id-1"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100000)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
			},
			attachments: map[string][]*model.FileInfo{
				"post-id-1": {
					{
						Name:     "test1-attachment",
						Id:       "test1-attachment",
						Path:     "test1-attachment",
						CreateAt: 1,
					},
				},
			},
			expectedHeaders: []string{
				"MIME-Version: 1.0",
				"X-Mattermost-ChannelType: direct",
				"Content-Transfer-Encoding: 8bit",
				"Precedence: bulk",
				"X-GlobalRelay-MsgType: Mattermost",
				"X-Mattermost-ChannelID: channel-id",
				"X-Mattermost-ChannelName: channel-display-name",
				"Auto-Submitted: auto-generated",
				"Date: Thu, 01 Jan 1970 00:01:40 +0000",
				"From: test1@test.com",
				"To: test1@test.com,test2@test.com",
				"Subject: Mattermost Compliance Export: channel-display-name",
			},

			expectedTexts: []string{
				strings.Join([]string{
					"* Channel: channel-display-name",
					"* Started: 1970-01-01T00:00:00Z",
					"* Ended: 1970-01-01T00:01:40Z",
					"* Duration: 2 minutes",
				}, "\r\n"),
				strings.Join([]string{
					"--------",
					"Messages",
					"--------",
					"",
					"* 1970-01-01T00:00:00Z @test1 user (test1@test.com): message",
					"* 1970-01-01T00:00:00Z @test1 user (test1@test.com): Uploaded file test1-at=",
					"tachment",
					"* 1970-01-01T00:01:40Z @test1 user (test1@test.com): message",
				}, "\r\n"),
				strings.Join([]string{
					"Content-Disposition: attachment; filename=\"test1-attachment\"",
					"Content-Transfer-Encoding: base64",
					"Content-Type: application/octet-stream; name=\"test1-attachment\"",
				}, "\r\n"),
			},

			expectedHTMLs: []string{
				strings.Join([]string{
					"    <ul>",
					"        <li><span class=3D\"bold\">Channel:&nbsp;</span>channel-display-name<=",
					"/li>",
					"        <li><span class=3D\"bold\">Started:&nbsp;</span>1970-01-01T00:00:00Z<=",
					"/li>",
					"        <li><span class=3D\"bold\">Ended:&nbsp;</span>1970-01-01T00:01:40Z</l=",
					"i>",
					"        <li><span class=3D\"bold\">Duration:&nbsp;</span>2 minutes</li>",
					"    </ul>",
				}, "\r\n"),
				strings.Join([]string{
					"<tr>",
					"    <td class=3D\"username\">@test</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test1@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">2</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test2</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test2@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test3</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test3@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
				}, "\r\n"),

				strings.Join([]string{
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:00:00Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
					"",
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:00:00Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">Uploaded file test1-attachment</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
					"",
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:01:40Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
				}, "\r\n"),
			},
			expectedFiles:    1,
			expectedWarnings: 0,
		},
		{
			name: "posts with deleted attachments",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, UserId: "test1", UserEmail: "test1@test.com", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
					{
						JoinTime: 8, UserId: "test2", UserEmail: "test2@test.com", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
					},
					{
						JoinTime: 400, UserId: "test3", UserEmail: "test3@test.com", Username: "test3",
					},
				},
			},
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id-1"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{"test1"},
				},
				{
					PostId:             model.NewPointer("post-id-2"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					PostRootId:         model.NewPointer("post-id-1"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100000)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
			},
			attachments: map[string][]*model.FileInfo{
				"post-id-1": {
					{
						Name:     "test1-attachment",
						Id:       "test1-attachment",
						Path:     "test1-attachment",
						DeleteAt: 200000,
					},
				},
			},
			expectedHeaders: []string{
				"MIME-Version: 1.0",
				"X-Mattermost-ChannelType: direct",
				"Content-Transfer-Encoding: 8bit",
				"Precedence: bulk",
				"X-GlobalRelay-MsgType: Mattermost",
				"X-Mattermost-ChannelID: channel-id",
				"X-Mattermost-ChannelName: channel-display-name",
				"Auto-Submitted: auto-generated",
				"Date: Thu, 01 Jan 1970 00:01:40 +0000",
				"From: test1@test.com",
				"To: test1@test.com,test2@test.com",
				"Subject: Mattermost Compliance Export: channel-display-name",
			},

			expectedTexts: []string{
				strings.Join([]string{
					"* Channel: channel-display-name",
					"* Started: 1970-01-01T00:00:00Z",
					"* Ended: 1970-01-01T00:01:40Z",
					"* Duration: 2 minutes",
				}, "\r\n"),
				strings.Join([]string{
					"--------",
					"Messages",
					"--------",
					"",
					"* 1970-01-01T00:00:00Z @test1 user (test1@test.com): message",
					"* 1970-01-01T00:01:40Z @test1 user (test1@test.com): message",
					"* 1970-01-01T00:03:20Z @test1 user (test1@test.com): Deleted file test1-att=",
					"achment",
				}, "\r\n"),
				strings.Join([]string{
					"Content-Disposition: attachment; filename=\"test1-attachment\"",
					"Content-Transfer-Encoding: base64",
					"Content-Type: application/octet-stream; name=\"test1-attachment\"",
				}, "\r\n"),
			},

			expectedHTMLs: []string{
				strings.Join([]string{
					"    <ul>",
					"        <li><span class=3D\"bold\">Channel:&nbsp;</span>channel-display-name<=",
					"/li>",
					"        <li><span class=3D\"bold\">Started:&nbsp;</span>1970-01-01T00:00:00Z<=",
					"/li>",
					"        <li><span class=3D\"bold\">Ended:&nbsp;</span>1970-01-01T00:01:40Z</l=",
					"i>",
					"        <li><span class=3D\"bold\">Duration:&nbsp;</span>2 minutes</li>",
					"    </ul>",
				}, "\r\n"),
				strings.Join([]string{
					"<tr>",
					"    <td class=3D\"username\">@test</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test1@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">2</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test2</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test2@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test3</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test3@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
				}, "\r\n"),

				strings.Join([]string{
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:00:00Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
					"",
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:01:40Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
					"",
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:03:20Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">Deleted file test1-attachment</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
				}, "\r\n"),
			},
			expectedFiles:    1,
			expectedWarnings: 0,
		},
		{
			name: "posts with missing attachments",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, UserId: "test1", UserEmail: "test1@test.com", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
					{
						JoinTime: 8, UserId: "test2", UserEmail: "test2@test.com", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
					},
					{
						JoinTime: 400, UserId: "test3", UserEmail: "test3@test.com", Username: "test3",
					},
				},
			},
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id-1"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{"test1"},
				},
				{
					PostId:             model.NewPointer("post-id-2"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					PostRootId:         model.NewPointer("post-id-1"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100000)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
			},
			attachments: map[string][]*model.FileInfo{
				"post-id-1": {
					{
						Name:     "test1-attachment",
						Id:       "test1-attachment",
						Path:     "test1-attachment",
						CreateAt: 1,
					},
				},
			},
			expectedHeaders: []string{
				"MIME-Version: 1.0",
				"X-Mattermost-ChannelType: direct",
				"Content-Transfer-Encoding: 8bit",
				"Precedence: bulk",
				"X-GlobalRelay-MsgType: Mattermost",
				"X-Mattermost-ChannelID: channel-id",
				"X-Mattermost-ChannelName: channel-display-name",
				"Auto-Submitted: auto-generated",
				"Date: Thu, 01 Jan 1970 00:01:40 +0000",
				"From: test1@test.com",
				"To: test1@test.com,test2@test.com",
				"Subject: Mattermost Compliance Export: channel-display-name",
			},

			expectedTexts: []string{
				strings.Join([]string{
					"* Channel: channel-display-name",
					"* Started: 1970-01-01T00:00:00Z",
					"* Ended: 1970-01-01T00:01:40Z",
					"* Duration: 2 minutes",
				}, "\r\n"),
				strings.Join([]string{
					"--------",
					"Messages",
					"--------",
					"",
					"* 1970-01-01T00:00:00Z @test1 user (test1@test.com): message",
					"* 1970-01-01T00:00:00Z @test1 user (test1@test.com): Uploaded file test1-at=",
					"tachment",
					"* 1970-01-01T00:01:40Z @test1 user (test1@test.com): message",
				}, "\r\n"),
				strings.Join([]string{
					"Content-Disposition: attachment; filename=\"test1-attachment\"",
					"Content-Transfer-Encoding: base64",
					"Content-Type: application/octet-stream; name=\"test1-attachment\"",
				}, "\r\n"),
			},

			expectedHTMLs: []string{
				strings.Join([]string{
					"    <ul>",
					"        <li><span class=3D\"bold\">Channel:&nbsp;</span>channel-display-name<=",
					"/li>",
					"        <li><span class=3D\"bold\">Started:&nbsp;</span>1970-01-01T00:00:00Z<=",
					"/li>",
					"        <li><span class=3D\"bold\">Ended:&nbsp;</span>1970-01-01T00:01:40Z</l=",
					"i>",
					"        <li><span class=3D\"bold\">Duration:&nbsp;</span>2 minutes</li>",
					"    </ul>",
				}, "\r\n"),
				strings.Join([]string{
					"<tr>",
					"    <td class=3D\"username\">@test</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test1@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">2</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test2</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test2@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test3</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test3@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
				}, "\r\n"),

				strings.Join([]string{
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:00:00Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
					"",
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:00:00Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">Uploaded file test1-attachment</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
					"",
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:01:40Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
				}, "\r\n"),
			},
			expectedFiles:    1,
			expectedWarnings: 1,
		},
		{
			name: "posts with override_username property",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, UserId: "test1", UserEmail: "test1@test.com", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
					{
						JoinTime: 8, UserId: "test2", UserEmail: "test2@test.com", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
					},
					{
						JoinTime: 400, UserId: "test3", UserEmail: "test3@test.com", Username: "test3",
					},
				},
			},
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					PostRootId:         model.NewPointer("post-root-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100000)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{\"from_webhook\":\"true\",\"html\":\"<b>Test HTML</b>\",\"override_username\":\"test_username_override\",\"webhook_display_name\":\"Test Bot\"}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
			},
			attachments: map[string][]*model.FileInfo{},
			expectedHeaders: []string{
				"MIME-Version: 1.0",
				"X-Mattermost-ChannelType: direct",
				"Content-Transfer-Encoding: 8bit",
				"Precedence: bulk",
				"X-GlobalRelay-MsgType: Mattermost",
				"X-Mattermost-ChannelID: channel-id",
				"X-Mattermost-ChannelName: channel-display-name",
				"Auto-Submitted: auto-generated",
				"Date: Thu, 01 Jan 1970 00:01:40 +0000",
				"From: test1@test.com",
				"To: test1@test.com,test2@test.com",
				"Subject: Mattermost Compliance Export: channel-display-name",
			},

			expectedTexts: []string{
				strings.Join([]string{
					"* Channel: channel-display-name",
					"* Started: 1970-01-01T00:00:00Z",
					"* Ended: 1970-01-01T00:01:40Z",
					"* Duration: 2 minutes",
				}, "\r\n"),
				strings.Join([]string{
					"--------",
					"Messages",
					"--------",
					"",
					"* 1970-01-01T00:00:00Z @test1 user (test1@test.com): message",
					"* 1970-01-01T00:01:40Z @test1 @test_username_override user (test1@test.com): message",
				}, "\r\n"),
			},

			expectedHTMLs: []string{
				strings.Join([]string{
					"    <ul>",
					"        <li><span class=3D\"bold\">Channel:&nbsp;</span>channel-display-name<=",
					"/li>",
					"        <li><span class=3D\"bold\">Started:&nbsp;</span>1970-01-01T00:00:00Z<=",
					"/li>",
					"        <li><span class=3D\"bold\">Ended:&nbsp;</span>1970-01-01T00:01:40Z</l=",
					"i>",
					"        <li><span class=3D\"bold\">Duration:&nbsp;</span>2 minutes</li>",
					"    </ul>",
				}, "\r\n"),
				strings.Join([]string{
					"<tr>",
					"    <td class=3D\"username\">@test</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test1@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">2</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test2</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test2@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test3</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test3@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
				}, "\r\n"),

				strings.Join([]string{
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:00:00Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
					"",
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:01:40Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\">@test_username_override</span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
				}, "\r\n"),
			},
		},
		{
			name: "posts with webhook_display_name property",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, UserId: "test1", UserEmail: "test1@test.com", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
					{
						JoinTime: 8, UserId: "test2", UserEmail: "test2@test.com", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
					},
					{
						JoinTime: 400, UserId: "test3", UserEmail: "test3@test.com", Username: "test3",
					},
				},
			},
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					PostRootId:         model.NewPointer("post-root-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100000)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{\"from_webhook\":\"true\",\"webhook_display_name\":\"Test Bot\"}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
			},
			attachments: map[string][]*model.FileInfo{},
			expectedHeaders: []string{
				"MIME-Version: 1.0",
				"X-Mattermost-ChannelType: direct",
				"Content-Transfer-Encoding: 8bit",
				"Precedence: bulk",
				"X-GlobalRelay-MsgType: Mattermost",
				"X-Mattermost-ChannelID: channel-id",
				"X-Mattermost-ChannelName: channel-display-name",
				"Auto-Submitted: auto-generated",
				"Date: Thu, 01 Jan 1970 00:01:40 +0000",
				"From: test1@test.com",
				"To: test1@test.com,test2@test.com",
				"Subject: Mattermost Compliance Export: channel-display-name",
			},

			expectedTexts: []string{
				strings.Join([]string{
					"* Channel: channel-display-name",
					"* Started: 1970-01-01T00:00:00Z",
					"* Ended: 1970-01-01T00:01:40Z",
					"* Duration: 2 minutes",
				}, "\r\n"),
				strings.Join([]string{
					"--------",
					"Messages",
					"--------",
					"",
					"* 1970-01-01T00:00:00Z @test1 user (test1@test.com): message",
					"* 1970-01-01T00:01:40Z @test1 @Test Bot user (test1@test.com): message",
				}, "\r\n"),
			},

			expectedHTMLs: []string{
				strings.Join([]string{
					"    <ul>",
					"        <li><span class=3D\"bold\">Channel:&nbsp;</span>channel-display-name<=",
					"/li>",
					"        <li><span class=3D\"bold\">Started:&nbsp;</span>1970-01-01T00:00:00Z<=",
					"/li>",
					"        <li><span class=3D\"bold\">Ended:&nbsp;</span>1970-01-01T00:01:40Z</l=",
					"i>",
					"        <li><span class=3D\"bold\">Duration:&nbsp;</span>2 minutes</li>",
					"    </ul>",
				}, "\r\n"),
				strings.Join([]string{
					"<tr>",
					"    <td class=3D\"username\">@test</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test1@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">2</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test2</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test2@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test3</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test3@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
				}, "\r\n"),

				strings.Join([]string{
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:00:00Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
					"",
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:01:40Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\">@Test Bot</span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
				}, "\r\n"),
			},
		},
		{
			name: "post with permalink preview",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, UserId: "test1", UserEmail: "test1@test.com", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
					{
						JoinTime: 8, UserId: "test2", UserEmail: "test2@test.com", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
					},
					{
						JoinTime: 400, UserId: "test3", UserEmail: "test3@test.com", Username: "test3",
					},
				},
			},
			posts: []*model.MessageExport{
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer(`{"previewed_post":"o4w39mc1ff8y5fite4b8hacy1x"}`),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					PostRootId:         model.NewPointer("post-root-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100000)),
					PostMessage:        model.NewPointer("message"),
					PostProps:          model.NewPointer("{}"),
					PostType:           model.NewPointer(""),
					UserEmail:          model.NewPointer("test1@test.com"),
					UserId:             model.NewPointer("test1"),
					Username:           model.NewPointer("test1"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
			},
			attachments: map[string][]*model.FileInfo{},
			expectedHeaders: []string{
				"MIME-Version: 1.0",
				"X-Mattermost-ChannelType: direct",
				"Content-Transfer-Encoding: 8bit",
				"Precedence: bulk",
				"X-GlobalRelay-MsgType: Mattermost",
				"X-Mattermost-ChannelID: channel-id",
				"X-Mattermost-ChannelName: channel-display-name",
				"Auto-Submitted: auto-generated",
				"Date: Thu, 01 Jan 1970 00:01:40 +0000",
				"From: test1@test.com",
				"To: test1@test.com,test2@test.com",
				"Subject: Mattermost Compliance Export: channel-display-name",
			},

			expectedTexts: []string{
				strings.Join([]string{
					"* Channel: channel-display-name",
					"* Started: 1970-01-01T00:00:00Z",
					"* Ended: 1970-01-01T00:01:40Z",
					"* Duration: 2 minutes",
				}, "\r\n"),
				strings.Join([]string{
					"--------",
					"Messages",
					"--------",
					"",
					"* 1970-01-01T00:00:00Z @test1 user (test1@test.com): message o4w39mc1ff8y5f=",
					"ite4b8hacy1x",
					"* 1970-01-01T00:01:40Z @test1 user (test1@test.com): message",
				}, "\r\n"),
			},

			expectedHTMLs: []string{
				strings.Join([]string{
					"    <ul>",
					"        <li><span class=3D\"bold\">Channel:&nbsp;</span>channel-display-name<=",
					"/li>",
					"        <li><span class=3D\"bold\">Started:&nbsp;</span>1970-01-01T00:00:00Z<=",
					"/li>",
					"        <li><span class=3D\"bold\">Ended:&nbsp;</span>1970-01-01T00:01:40Z</l=",
					"i>",
					"        <li><span class=3D\"bold\">Duration:&nbsp;</span>2 minutes</li>",
					"    </ul>",
				}, "\r\n"),
				strings.Join([]string{
					"<tr>",
					"    <td class=3D\"username\">@test</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test1@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">2</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test2</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test2@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
					"",
					"<tr>",
					"    <td class=3D\"username\">@test3</td>",
					"    <td class=3D\"usertype\">user</td>",
					"    <td class=3D\"email\">test3@test.com</td>",
					"    <td class=3D\"joined\">1970-01-01T00:00:00Z</td>",
					"    <td class=3D\"left\">1970-01-01T00:01:40Z</td>",
					"    <td class=3D\"duration\">2 minutes</td>",
					"    <td class=3D\"messages\">0</td>",
					"</tr>",
				}, "\r\n"),

				strings.Join([]string{
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:00:00Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\">o4w39mc1ff8y5fite4b8hacy1x</span>",
					"</li>",
					"",
					"<li class=3D\"message\">",
					"    <span class=3D\"sent_time\">1970-01-01T00:01:40Z</span>",
					"    <span class=3D\"username\">@test1</span>",
					"    <span class=3D\"postusername\"></span>",
					"    <span class=3D\"usertype\">user</span>",
					"    <span class=3D\"email\">(test1@test.com):</span>",
					"    <span class=3D\"message\">message</span>",
					"    <span class=3D\"previews_post\"></span>",
					"</li>",
				}, "\r\n"),
			},
			expectedFiles:    1,
			expectedWarnings: 0,
		},
	}

	for _, tt := range csvExportTests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			if len(tt.attachments) > 0 {
				for post_id, attachments := range tt.attachments {
					call := mockStore.FileInfoStore.On("GetForPost", post_id, true, true, false)
					call.Run(func(args mock.Arguments) {
						call.Return(attachments, nil)
					})
					if tt.expectedWarnings == 0 {
						_, err = fileBackend.WriteFile(bytes.NewReader([]byte{}), attachments[0].Path)
						require.NoError(t, err)

						t.Cleanup(func() {
							err = fileBackend.RemoveFile(attachments[0].Path)
							assert.NoError(t, err)
						})
					}
				}
			}

			if len(tt.cmhs) > 0 {
				for channelId, cmhs := range tt.cmhs {
					mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), int64(100000), []string{channelId}).Return(cmhs, nil)
				}
			}

			dest, err := os.CreateTemp("", "")
			assert.NoError(t, err)
			defer os.Remove(dest.Name())

			_, warningCount, err := GlobalRelayExport(rctx, tt.posts, mockStore, fileBackend, dest, templatesContainer)
			assert.NoError(t, err)
			assert.Equal(t, tt.expectedWarnings, warningCount)

			_, err = dest.Seek(0, 0)
			assert.NoError(t, err)

			destInfo, err := dest.Stat()
			assert.NoError(t, err)

			zipFile, err := zip.NewReader(dest, destInfo.Size())
			assert.NoError(t, err)

			if tt.expectedFiles > 0 {
				firstFile, err := zipFile.File[0].Open()
				assert.NoError(t, err)

				data, err := io.ReadAll(firstFile)
				assert.NoError(t, err)

				t.Run("headers", func(t *testing.T) {
					for _, expectedHeader := range tt.expectedHeaders {
						assert.Contains(t, string(data), expectedHeader)
					}
				})

				t.Run("text-version", func(t *testing.T) {
					for _, expectedText := range tt.expectedTexts {
						assert.Contains(t, string(data), expectedText)
					}
				})

				t.Run("html-version", func(t *testing.T) {
					for _, expectedHTML := range tt.expectedHTMLs {
						assert.Contains(t, string(data), expectedHTML)
					}
				})
			}
		})
	}
}
