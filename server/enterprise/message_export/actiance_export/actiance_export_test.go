// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package actiance_export

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

type MyReporter struct {
	mock.Mock
}

func (mr *MyReporter) ReportProgressMessage(message string) {
	mr.Called(message)
}

func TestActianceExport(t *testing.T) {
	t.Run("no dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(exportTempDir)
			assert.NoError(t, err)
		})

		fileBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		runTestActianceExport(t, fileBackend, fileBackend)
	})

	t.Run("using dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(exportTempDir)
			assert.NoError(t, err)
		})

		exportBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		attachmentTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(attachmentTempDir)
			assert.NoError(t, err)
		})

		attachmentBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  attachmentTempDir,
		})

		runTestActianceExport(t, exportBackend, attachmentBackend)
	})
}

func runTestActianceExport(t *testing.T, exportBackend filestore.FileBackend, attachmentBackend filestore.FileBackend) {
	rctx := request.TestContext(t)
	rctx = rctx.WithT(i18n.IdentityTfunc()).(*request.Context)

	chanTypeDirect := model.ChannelTypeDirect
	actianceExportTests := []struct {
		name          string
		jobEndTime    int64
		activity      []string
		channels      model.ChannelList
		cmhs          map[string][]*model.ChannelMemberHistoryResult
		posts         []*model.MessageExport
		attachments   map[string][]*model.FileInfo
		expectedData  string
		expectedFiles int
	}{
		{
			name:        "empty",
			jobEndTime:  30,
			cmhs:        map[string][]*model.ChannelMemberHistoryResult{},
			posts:       []*model.MessageExport{},
			attachments: map[string][]*model.FileInfo{},
			expectedData: strings.Join([]string{
				xml.Header,
				"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"></FileDump>",
			}, ""),
			activity:      []string{},
			expectedFiles: 2,
		},
		{
			name:       "posts",
			jobEndTime: 500,
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{JoinTime: 0, ChannelId: "channel-id", UserId: "test", UserEmail: "test@email", Username: "testname", LeaveTime: model.NewPointer(int64(400))},
					{JoinTime: 8, ChannelId: "channel-id", UserId: "test2", UserEmail: "test2@email", Username: "test2name", LeaveTime: model.NewPointer(int64(80))},
					{JoinTime: 400, ChannelId: "channel-id", UserId: "test3", UserEmail: "test3@email", Username: "test3name"},
					{JoinTime: 10, ChannelId: "channel-id", UserId: "test_bot", UserEmail: "test_bot@email", Username: "test_botname", IsBot: true, LeaveTime: model.NewPointer(int64(20))},
				},
			},
			activity: []string{"channel-id"},
			channels: model.ChannelList{{
				TeamId:      "team-id",
				Id:          "channel-id",
				Name:        "channel-name",
				DisplayName: "channel-display-name",
				Type:        model.ChannelTypeDirect,
			}},
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
					PostUpdateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
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
					PostUpdateAt:       model.NewPointer(int64(2)),
					PostDeleteAt:       model.NewPointer(int64(2)),
					PostMessage:        model.NewPointer("edit message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
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
					PostUpdateAt:       model.NewPointer(int64(4)),
					PostDeleteAt:       model.NewPointer(int64(4)),
					PostMessage:        model.NewPointer("message2"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
					PostProps:          model.NewPointer("{\"deleteBy\":\"fy8j97gwii84bk4zxprbpc9d9w\"}"),
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
					PostCreateAt:       model.NewPointer(int64(100)),
					PostUpdateAt:       model.NewPointer(int64(100)),
					PostMessage:        model.NewPointer("message3"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
			},
			attachments: map[string][]*model.FileInfo{},
			expectedData: strings.Join([]string{
				xml.Header,
				"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n",
				"  <Conversation Perspective=\"channel-display-name\">\n",
				"    <RoomID>direct - channel-name - channel-id</RoomID>\n",
				"    <StartTimeUTC>1</StartTimeUTC>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>0</DateTimeUTC>\n",
				"      <CorporateEmailID>test@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test2@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>8</DateTimeUTC>\n",
				"      <CorporateEmailID>test2@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test_bot@email</LoginName>\n",
				"      <UserType>bot</UserType>\n",
				"      <DateTimeUTC>10</DateTimeUTC>\n",
				"      <CorporateEmailID>test_bot@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test3@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>400</DateTimeUTC>\n",
				"      <CorporateEmailID>test3@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <Content>message</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <Content>edit message</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <Content>message2</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>4</DateTimeUTC>\n",
				"      <Content>delete message2</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>100</DateTimeUTC>\n",
				"      <Content>message3</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test_bot@email</LoginName>\n",
				"      <UserType>bot</UserType>\n",
				"      <DateTimeUTC>20</DateTimeUTC>\n",
				"      <CorporateEmailID>test_bot@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test2@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>80</DateTimeUTC>\n",
				"      <CorporateEmailID>test2@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>400</DateTimeUTC>\n",
				"      <CorporateEmailID>test@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test3@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>500</DateTimeUTC>\n",
				"      <CorporateEmailID>test3@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>500</DateTimeUTC>\n",
				"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <EndTimeUTC>500</EndTimeUTC>\n",
				"  </Conversation>\n",
				"</FileDump>",
			}, ""),
			expectedFiles: 2,
		},
		{
			name:       "post with permalink preview",
			jobEndTime: 600,
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{JoinTime: 0, ChannelId: "channel-id", UserId: "test", UserEmail: "test@email", Username: "test", LeaveTime: model.NewPointer(int64(400))},
				},
			},
			activity: []string{"channel-id"},
			channels: model.ChannelList{{
				TeamId:      "team-id",
				Id:          "channel-id",
				Name:        "channel-name",
				DisplayName: "channel-display-name",
				Type:        model.ChannelTypeDirect,
			}},
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
					PostUpdateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
					PostProps:          model.NewPointer(`{"previewed_post":"n4w39mc1ff8y5fite4b8hacy1w"}`),
				},
				{
					PostId:             model.NewPointer("post-id"),
					PostOriginalId:     model.NewPointer("post-original-id"),
					TeamId:             model.NewPointer("team-id"),
					TeamName:           model.NewPointer("team-name"),
					TeamDisplayName:    model.NewPointer("team-display-name"),
					ChannelId:          model.NewPointer("channel-id"),
					ChannelName:        model.NewPointer("channel-name"),
					ChannelDisplayName: model.NewPointer("channel-display-name"),
					PostCreateAt:       model.NewPointer(int64(100)),
					PostUpdateAt:       model.NewPointer(int64(100)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
					PostProps:          model.NewPointer(`{"disable_group_highlight":true}`),
				},
			},
			attachments: map[string][]*model.FileInfo{},
			expectedData: strings.Join([]string{
				xml.Header,
				"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n",
				"  <Conversation Perspective=\"channel-display-name\">\n",
				"    <RoomID>direct - channel-name - channel-id</RoomID>\n",
				"    <StartTimeUTC>1</StartTimeUTC>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>0</DateTimeUTC>\n",
				"      <CorporateEmailID>test@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <Content>message</Content>\n",
				"      <PreviewsPost>n4w39mc1ff8y5fite4b8hacy1w</PreviewsPost>\n",
				"    </Message>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>100</DateTimeUTC>\n",
				"      <Content>message</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>400</DateTimeUTC>\n",
				"      <CorporateEmailID>test@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>600</DateTimeUTC>\n",
				"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <EndTimeUTC>600</EndTimeUTC>\n",
				"  </Conversation>\n",
				"</FileDump>",
			}, ""),
			expectedFiles: 0,
		},
		{
			name:       "posts with attachments",
			jobEndTime: 700,
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, ChannelId: "channel-id", UserId: "test", UserEmail: "test@email", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
					{
						JoinTime: 8, ChannelId: "channel-id", UserId: "test2", UserEmail: "test2@email", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
					},
					{
						JoinTime: 400, ChannelId: "channel-id", UserId: "test3", UserEmail: "test3@email", Username: "test3",
					},
				},
			},
			activity: []string{"channel-id"},
			channels: model.ChannelList{{
				TeamId:      "team-id",
				Id:          "channel-id",
				Name:        "channel-name",
				DisplayName: "channel-display-name",
				Type:        model.ChannelTypeDirect,
			}},
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
					PostUpdateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
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
					PostCreateAt:       model.NewPointer(int64(100)),
					PostUpdateAt:       model.NewPointer(int64(100)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
			},
			attachments: map[string][]*model.FileInfo{
				"post-id-1": {
					{
						Name: "test1-attachment",
						Id:   "test1-attachment",
						Path: "test1-attachment",
					},
				},
			},
			expectedData: strings.Join([]string{
				xml.Header,
				"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n",
				"  <Conversation Perspective=\"channel-display-name\">\n",
				"    <RoomID>direct - channel-name - channel-id</RoomID>\n",
				"    <StartTimeUTC>1</StartTimeUTC>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>0</DateTimeUTC>\n",
				"      <CorporateEmailID>test@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test2@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>8</DateTimeUTC>\n",
				"      <CorporateEmailID>test2@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test3@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>400</DateTimeUTC>\n",
				"      <CorporateEmailID>test3@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <Content>message</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <FileTransferStarted>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <UserFileName>test1-attachment</UserFileName>\n",
				"      <FileName>test1-attachment</FileName>\n",
				"    </FileTransferStarted>\n",
				"    <FileTransferEnded>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <UserFileName>test1-attachment</UserFileName>\n",
				"      <FileName>test1-attachment</FileName>\n",
				"      <Status>Completed</Status>\n",
				"    </FileTransferEnded>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>100</DateTimeUTC>\n",
				"      <Content>message</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test2@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>80</DateTimeUTC>\n",
				"      <CorporateEmailID>test2@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>400</DateTimeUTC>\n",
				"      <CorporateEmailID>test@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test3@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>700</DateTimeUTC>\n",
				"      <CorporateEmailID>test3@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>700</DateTimeUTC>\n",
				"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <EndTimeUTC>700</EndTimeUTC>\n",
				"  </Conversation>\n",
				"</FileDump>",
			}, ""),
			expectedFiles: 3,
		},
		{
			name:       "joins and leaves after last post, one batch",
			jobEndTime: 500,
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{JoinTime: 0, ChannelId: "channel-id", UserId: "test", UserEmail: "test@email", Username: "testname", LeaveTime: model.NewPointer(int64(400))},
					{JoinTime: 8, ChannelId: "channel-id", UserId: "test2", UserEmail: "test2@email", Username: "test2name", LeaveTime: model.NewPointer(int64(80))},
					{JoinTime: 400, ChannelId: "channel-id", UserId: "test3", UserEmail: "test3@email", Username: "test3name"},
					{JoinTime: 450, ChannelId: "channel-id", UserId: "test4", UserEmail: "test4@email", Username: "test4name", LeaveTime: model.NewPointer(int64(460))},
					{JoinTime: 10, ChannelId: "channel-id", UserId: "test_bot", UserEmail: "test_bot@email", Username: "test_botname", IsBot: true, LeaveTime: model.NewPointer(int64(20))},
				},
			},
			activity: []string{"channel-id"},
			channels: model.ChannelList{{
				TeamId:      "team-id",
				Id:          "channel-id",
				Name:        "channel-name",
				DisplayName: "channel-display-name",
				Type:        model.ChannelTypeDirect,
			}},
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
					PostUpdateAt:       model.NewPointer(int64(1)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
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
					PostUpdateAt:       model.NewPointer(int64(2)),
					PostDeleteAt:       model.NewPointer(int64(2)),
					PostMessage:        model.NewPointer("edit message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
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
					PostUpdateAt:       model.NewPointer(int64(4)),
					PostDeleteAt:       model.NewPointer(int64(4)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
					PostProps:          model.NewPointer("{\"deleteBy\":\"fy8j97gwii84bk4zxprbpc9d9w\"}"),
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
					PostCreateAt:       model.NewPointer(int64(100)),
					PostUpdateAt:       model.NewPointer(int64(100)),
					PostMessage:        model.NewPointer("message"),
					UserEmail:          model.NewPointer("test@test.com"),
					UserId:             model.NewPointer("user-id"),
					Username:           model.NewPointer("username"),
					ChannelType:        &chanTypeDirect,
					PostFileIds:        []string{},
				},
			},
			attachments: map[string][]*model.FileInfo{},
			expectedData: strings.Join([]string{
				xml.Header,
				"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n",
				"  <Conversation Perspective=\"channel-display-name\">\n",
				"    <RoomID>direct - channel-name - channel-id</RoomID>\n",
				"    <StartTimeUTC>1</StartTimeUTC>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>0</DateTimeUTC>\n",
				"      <CorporateEmailID>test@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test2@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>8</DateTimeUTC>\n",
				"      <CorporateEmailID>test2@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test_bot@email</LoginName>\n",
				"      <UserType>bot</UserType>\n",
				"      <DateTimeUTC>10</DateTimeUTC>\n",
				"      <CorporateEmailID>test_bot@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test3@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>400</DateTimeUTC>\n",
				"      <CorporateEmailID>test3@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test4@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>450</DateTimeUTC>\n",
				"      <CorporateEmailID>test4@email</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <Content>message</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <Content>edit message</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>1</DateTimeUTC>\n",
				"      <Content>message</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>4</DateTimeUTC>\n",
				"      <Content>delete message</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <Message>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>100</DateTimeUTC>\n",
				"      <Content>message</Content>\n",
				"      <PreviewsPost></PreviewsPost>\n",
				"    </Message>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test_bot@email</LoginName>\n",
				"      <UserType>bot</UserType>\n",
				"      <DateTimeUTC>20</DateTimeUTC>\n",
				"      <CorporateEmailID>test_bot@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test2@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>80</DateTimeUTC>\n",
				"      <CorporateEmailID>test2@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>400</DateTimeUTC>\n",
				"      <CorporateEmailID>test@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test4@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>460</DateTimeUTC>\n",
				"      <CorporateEmailID>test4@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test3@email</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>500</DateTimeUTC>\n",
				"      <CorporateEmailID>test3@email</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>500</DateTimeUTC>\n",
				"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <EndTimeUTC>500</EndTimeUTC>\n",
				"  </Conversation>\n",
				"</FileDump>",
			}, ""),
			expectedFiles: 2,
		},
	}

	for _, tt := range actianceExportTests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			if len(tt.attachments) > 0 {
				for post_id, attachments := range tt.attachments {
					call := mockStore.FileInfoStore.On("GetForPost", post_id, true, true, false)
					call.Run(func(args mock.Arguments) {
						call.Return(attachments, nil)
					})
					_, err := attachmentBackend.WriteFile(bytes.NewReader([]byte{}), attachments[0].Path)
					require.NoError(t, err)

					t.Cleanup(func() {
						err = attachmentBackend.RemoveFile(attachments[0].Path)
						require.NoError(t, err)
					})
				}
			}

			if len(tt.cmhs) > 0 {
				for channelId, cmhs := range tt.cmhs {
					mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), tt.jobEndTime, []string{channelId}).
						Return(cmhs, nil)
				}
			}

			if tt.activity != nil {
				mockStore.ChannelMemberHistoryStore.On("GetChannelsWithActivityDuring", mock.Anything, mock.Anything).
					Return(tt.activity, nil)
			}

			if tt.channels != nil {
				mockStore.ChannelStore.On("GetMany", tt.activity, true).
					Return(tt.channels, nil)
			}

			myMockReporter := MyReporter{}
			defer myMockReporter.AssertExpectations(t)
			if len(tt.activity) > 0 {
				myMockReporter.On("ReportProgressMessage", "ent.message_export.actiance_export.calculate_channel_exports.channel_message")
			}
			if len(tt.cmhs) > 0 {
				myMockReporter.On("ReportProgressMessage", "ent.message_export.actiance_export.calculate_channel_exports.activity_message")
			}

			channelMetadata, channelMemberHistories, err := shared.CalculateChannelExports(rctx,
				shared.ChannelExportsParams{
					Store:                   mockStore,
					ExportPeriodStartTime:   1,
					ExportPeriodEndTime:     tt.jobEndTime,
					ChannelBatchSize:        100,
					ChannelHistoryBatchSize: 100,
					ReportProgressMessage:   myMockReporter.ReportProgressMessage,
				})
			assert.NoError(t, err)

			exportFileName := path.Join("export", "jobName", "jobName-batch001.zip")
			res, err := ActianceExport(rctx, Params{
				ChannelMetadata:        channelMetadata,
				Posts:                  tt.posts,
				ChannelMemberHistories: channelMemberHistories,
				BatchPath:              exportFileName,
				BatchStartTime:         1,
				BatchEndTime:           tt.jobEndTime,
				Db:                     mockStore,
				FileAttachmentBackend:  attachmentBackend,
				ExportBackend:          exportBackend,
			})
			assert.NoError(t, err)
			assert.Equal(t, 0, res.NumWarnings)

			zipBytes, err := exportBackend.ReadFile(exportFileName)
			assert.NoError(t, err)
			zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
			assert.NoError(t, err)
			actiancexml, err := zipReader.File[0].Open()
			require.NoError(t, err)
			defer actiancexml.Close()
			xmlData, err := io.ReadAll(actiancexml)
			assert.NoError(t, err)

			assert.Equal(t, tt.expectedData, string(xmlData))

			t.Cleanup(func() {
				err = exportBackend.RemoveFile(exportFileName)
				assert.NoError(t, err)
			})
		})
	}
}

func TestActianceExportMultipleBatches(t *testing.T) {
	t.Run("no dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(exportTempDir)
			assert.NoError(t, err)
		})

		fileBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		runTestActianceExportMultipleBatches(t, fileBackend, fileBackend)
	})

	t.Run("using dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(exportTempDir)
			assert.NoError(t, err)
		})

		exportBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		attachmentTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(attachmentTempDir)
			assert.NoError(t, err)
		})

		attachmentBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  attachmentTempDir,
		})

		runTestActianceExportMultipleBatches(t, exportBackend, attachmentBackend)
	})
}

func runTestActianceExportMultipleBatches(t *testing.T, exportBackend filestore.FileBackend, attachmentBackend filestore.FileBackend) {
	rctx := request.TestContext(t)
	rctx = rctx.WithT(i18n.IdentityTfunc()).(*request.Context)

	chanTypeDirect := model.ChannelTypeDirect
	actianceMultiBatchExportTests := []struct {
		name          string
		jobStartTime  int64
		jobEndTime    int64
		numBatches    int
		activity      []string
		channels      model.ChannelList
		cmhs          map[string][]*model.ChannelMemberHistoryResult
		posts         [][]*model.MessageExport
		attachments   map[string][]*model.FileInfo
		expectedData  []string
		expectedFiles int
	}{
		{
			name:         "joins and leaves after last post, and before second batch, two batches",
			jobStartTime: 1,
			jobEndTime:   500,
			numBatches:   2,
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					// will be included in both batches:
					{JoinTime: 0, ChannelId: "channel-id", UserId: "test", UserEmail: "test@email", Username: "testname", LeaveTime: model.NewPointer(int64(400))},
					// Only first batch:
					{JoinTime: 2, ChannelId: "channel-id", UserId: "testA", UserEmail: "testA@email", Username: "testAname", LeaveTime: model.NewPointer(int64(3))},
					// Only second batch:
					{JoinTime: 8, ChannelId: "channel-id", UserId: "test2", UserEmail: "test2@email", Username: "test2name", LeaveTime: model.NewPointer(int64(80))},
					{JoinTime: 10, ChannelId: "channel-id", UserId: "test_bot", UserEmail: "test_bot@email", Username: "test_botname", IsBot: true, LeaveTime: model.NewPointer(int64(20))},
					{JoinTime: 400, ChannelId: "channel-id", UserId: "test3", UserEmail: "test3@email", Username: "test3name"},
					{JoinTime: 450, ChannelId: "channel-id", UserId: "test4", UserEmail: "test4@email", Username: "test4name", LeaveTime: model.NewPointer(int64(460))},
				},
			},
			activity: []string{"channel-id"},
			channels: model.ChannelList{{
				TeamId:      "team-id",
				Id:          "channel-id",
				Name:        "channel-name",
				DisplayName: "channel-display-name",
				Type:        model.ChannelTypeDirect,
			}},
			posts: [][]*model.MessageExport{
				{
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
						PostUpdateAt:       model.NewPointer(int64(1)),
						PostMessage:        model.NewPointer("message"),
						UserEmail:          model.NewPointer("test@test.com"),
						UserId:             model.NewPointer("user-id"),
						Username:           model.NewPointer("username"),
						ChannelType:        &chanTypeDirect,
						PostFileIds:        []string{},
					},
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
						PostUpdateAt:       model.NewPointer(int64(4)),
						PostDeleteAt:       model.NewPointer(int64(4)),
						PostMessage:        model.NewPointer("edit message"),
						UserEmail:          model.NewPointer("test@test.com"),
						UserId:             model.NewPointer("user-id"),
						Username:           model.NewPointer("username"),
						ChannelType:        &chanTypeDirect,
						PostFileIds:        []string{},
					},
				},
				{
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
						PostUpdateAt:       model.NewPointer(int64(5)),
						PostDeleteAt:       model.NewPointer(int64(5)),
						PostMessage:        model.NewPointer("message2"),
						UserEmail:          model.NewPointer("test@test.com"),
						UserId:             model.NewPointer("user-id"),
						Username:           model.NewPointer("username"),
						ChannelType:        &chanTypeDirect,
						PostFileIds:        []string{},
						PostProps:          model.NewPointer("{\"deleteBy\":\"fy8j97gwii84bk4zxprbpc9d9w\"}"),
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
						PostCreateAt:       model.NewPointer(int64(100)),
						PostUpdateAt:       model.NewPointer(int64(100)),
						PostMessage:        model.NewPointer("message3"),
						UserEmail:          model.NewPointer("test@test.com"),
						UserId:             model.NewPointer("user-id"),
						Username:           model.NewPointer("username"),
						ChannelType:        &chanTypeDirect,
						PostFileIds:        []string{},
					},
				}},
			attachments: map[string][]*model.FileInfo{},
			expectedData: []string{
				strings.Join([]string{
					xml.Header,
					"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n",
					"  <Conversation Perspective=\"channel-display-name\">\n",
					"    <RoomID>direct - channel-name - channel-id</RoomID>\n",
					"    <StartTimeUTC>1</StartTimeUTC>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>0</DateTimeUTC>\n",
					"      <CorporateEmailID>test@email</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>testA@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>2</DateTimeUTC>\n",
					"      <CorporateEmailID>testA@email</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <Message>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <Content>message</Content>\n",
					"      <PreviewsPost></PreviewsPost>\n",
					"    </Message>\n",
					"    <Message>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <Content>edit message</Content>\n",
					"      <PreviewsPost></PreviewsPost>\n",
					"    </Message>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>testA@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>3</DateTimeUTC>\n",
					"      <CorporateEmailID>testA@email</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>4</DateTimeUTC>\n",
					"      <CorporateEmailID>test@email</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>4</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <EndTimeUTC>4</EndTimeUTC>\n",
					"  </Conversation>\n",
					"</FileDump>",
				}, ""),
				strings.Join([]string{
					xml.Header,
					"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n",
					"  <Conversation Perspective=\"channel-display-name\">\n",
					"    <RoomID>direct - channel-name - channel-id</RoomID>\n",
					"    <StartTimeUTC>4</StartTimeUTC>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>0</DateTimeUTC>\n",
					"      <CorporateEmailID>test@email</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>4</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test2@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>8</DateTimeUTC>\n",
					"      <CorporateEmailID>test2@email</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test_bot@email</LoginName>\n",
					"      <UserType>bot</UserType>\n",
					"      <DateTimeUTC>10</DateTimeUTC>\n",
					"      <CorporateEmailID>test_bot@email</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test3@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>400</DateTimeUTC>\n",
					"      <CorporateEmailID>test3@email</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test4@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>450</DateTimeUTC>\n",
					"      <CorporateEmailID>test4@email</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <Message>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <Content>message2</Content>\n",
					"      <PreviewsPost></PreviewsPost>\n",
					"    </Message>\n",
					"    <Message>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>5</DateTimeUTC>\n",
					"      <Content>delete message2</Content>\n",
					"      <PreviewsPost></PreviewsPost>\n",
					"    </Message>\n",
					"    <Message>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>100</DateTimeUTC>\n",
					"      <Content>message3</Content>\n",
					"      <PreviewsPost></PreviewsPost>\n",
					"    </Message>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test_bot@email</LoginName>\n",
					"      <UserType>bot</UserType>\n",
					"      <DateTimeUTC>20</DateTimeUTC>\n",
					"      <CorporateEmailID>test_bot@email</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test2@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>80</DateTimeUTC>\n",
					"      <CorporateEmailID>test2@email</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>400</DateTimeUTC>\n",
					"      <CorporateEmailID>test@email</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test4@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>460</DateTimeUTC>\n",
					"      <CorporateEmailID>test4@email</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test3@email</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>500</DateTimeUTC>\n",
					"      <CorporateEmailID>test3@email</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>500</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <EndTimeUTC>500</EndTimeUTC>\n",
					"  </Conversation>\n",
					"</FileDump>",
				}, ""),
			},
			expectedFiles: 2,
		},
	}

	for _, tt := range actianceMultiBatchExportTests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			if len(tt.attachments) > 0 {
				for post_id, attachments := range tt.attachments {
					call := mockStore.FileInfoStore.On("GetForPost", post_id, true, true, false)
					call.Run(func(args mock.Arguments) {
						call.Return(attachments, nil)
					})
					_, err := attachmentBackend.WriteFile(bytes.NewReader([]byte{}), attachments[0].Path)
					require.NoError(t, err)

					t.Cleanup(func() {
						err = attachmentBackend.RemoveFile(attachments[0].Path)
						require.NoError(t, err)
					})
				}
			}

			if len(tt.cmhs) > 0 {
				for channelId, cmhs := range tt.cmhs {
					mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), tt.jobEndTime, []string{channelId}).
						Return(cmhs, nil)
				}
			}

			if tt.activity != nil {
				mockStore.ChannelMemberHistoryStore.On("GetChannelsWithActivityDuring", mock.Anything, mock.Anything).
					Return(tt.activity, nil)
			}

			if tt.channels != nil {
				mockStore.ChannelStore.On("GetMany", tt.activity, true).
					Return(tt.channels, nil)
			}

			myMockReporter := MyReporter{}
			defer myMockReporter.AssertExpectations(t)
			if len(tt.activity) > 0 {
				myMockReporter.On("ReportProgressMessage", "ent.message_export.actiance_export.calculate_channel_exports.channel_message")
			}
			if len(tt.cmhs) > 0 {
				myMockReporter.On("ReportProgressMessage", "ent.message_export.actiance_export.calculate_channel_exports.activity_message")
			}

			channelMetadata, channelMemberHistories, err := shared.CalculateChannelExports(rctx,
				shared.ChannelExportsParams{
					Store:                   mockStore,
					ExportPeriodStartTime:   1,
					ExportPeriodEndTime:     tt.jobEndTime,
					ChannelBatchSize:        100,
					ChannelHistoryBatchSize: 100,
					ReportProgressMessage:   myMockReporter.ReportProgressMessage,
				})
			assert.NoError(t, err)

			batchStartTime := int64(1)

			for batch := 0; batch < tt.numBatches; batch++ {
				var batchEndTime int64
				if batch == tt.numBatches-1 {
					batchEndTime = tt.jobEndTime
				} else {
					batchEndTime = *tt.posts[batch][len(tt.posts[batch])-1].PostUpdateAt
				}
				exportFileName := path.Join("export", "jobName",
					fmt.Sprintf("jobName-batch00%d.zip", batch+1))

				res, err := ActianceExport(rctx, Params{
					ChannelMetadata:        channelMetadata,
					Posts:                  tt.posts[batch],
					ChannelMemberHistories: channelMemberHistories,
					BatchPath:              exportFileName,
					BatchStartTime:         batchStartTime,
					BatchEndTime:           batchEndTime,
					Db:                     mockStore,
					FileAttachmentBackend:  attachmentBackend,
					ExportBackend:          exportBackend,
				})
				assert.NoError(t, err)
				assert.Equal(t, 0, res.NumWarnings)

				zipBytes, err := exportBackend.ReadFile(exportFileName)
				assert.NoError(t, err)
				zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
				assert.NoError(t, err)
				actiancexml, err := zipReader.File[0].Open()
				require.NoError(t, err)
				xmlData, err := io.ReadAll(actiancexml)
				actiancexml.Close()
				assert.NoError(t, err)

				assert.Equal(t, tt.expectedData[batch], string(xmlData), fmt.Sprintf("batch %v", batch))

				batchStartTime = *tt.posts[batch][len(tt.posts[batch])-1].PostUpdateAt

				t.Cleanup(func() {
					err = exportBackend.RemoveFile(exportFileName)
					assert.NoError(t, err)
				})
			}
		})
	}
}

func TestMultipleActianceExport(t *testing.T) {
	t.Run("no dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(exportTempDir)
			assert.NoError(t, err)
		})

		fileBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		runTestMultipleActianceExport(t, fileBackend, fileBackend)
	})

	t.Run("using dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(exportTempDir)
			assert.NoError(t, err)
		})

		exportBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		attachmentTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(attachmentTempDir)
			assert.NoError(t, err)
		})

		attachmentBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  attachmentTempDir,
		})

		runTestMultipleActianceExport(t, exportBackend, attachmentBackend)
	})
}

func runTestMultipleActianceExport(t *testing.T, exportBackend filestore.FileBackend, attachmentBackend filestore.FileBackend) {
	rctx := request.TestContext(t)
	rctx = rctx.WithT(i18n.IdentityTfunc()).(*request.Context)

	chanTypeDirect := model.ChannelTypeDirect
	multActianceExportTests := []struct {
		name          string
		jobEndTime    int64
		activity      []string
		channels      model.ChannelList
		cmhs          map[string][]*model.ChannelMemberHistoryResult
		posts         map[string][]*model.MessageExport
		attachments   map[string][]*model.FileInfo
		expectedData  map[string]string
		expectedFiles int
	}{
		{
			name:       "post,export,delete,export",
			jobEndTime: 500,
			activity:   []string{"channel-id"},
			channels: model.ChannelList{{
				TeamId:      "team-id",
				Id:          "channel-id",
				Name:        "channel-name",
				DisplayName: "channel-display-name",
				Type:        model.ChannelTypeDirect,
			}},
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{JoinTime: 0, ChannelId: "channel-id", UserId: "user-id", UserEmail: "test@test.com", Username: "username", LeaveTime: model.NewPointer(int64(400))},
				},
			},
			posts: map[string][]*model.MessageExport{
				"step1": {
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
						PostUpdateAt:       model.NewPointer(int64(1)),
						PostMessage:        model.NewPointer("message"),
						UserEmail:          model.NewPointer("test@test.com"),
						UserId:             model.NewPointer("user-id"),
						Username:           model.NewPointer("username"),
						ChannelType:        &chanTypeDirect,
						PostFileIds:        []string{},
					},
				},
				"step2": {
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
						PostUpdateAt:       model.NewPointer(int64(2)),
						PostDeleteAt:       model.NewPointer(int64(2)),
						PostMessage:        model.NewPointer("message"),
						UserEmail:          model.NewPointer("test@test.com"),
						UserId:             model.NewPointer("user-id"),
						Username:           model.NewPointer("username"),
						ChannelType:        &chanTypeDirect,
						PostFileIds:        []string{},
						PostProps:          model.NewPointer("{\"deleteBy\":\"fy8j97gwii84bk4zxprbpc9d9w\"}"),
					},
				},
			},
			expectedData: map[string]string{
				"step1": strings.Join([]string{
					xml.Header,
					"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n",
					"  <Conversation Perspective=\"channel-display-name\">\n",
					"    <RoomID>direct - channel-name - channel-id</RoomID>\n",
					"    <StartTimeUTC>1</StartTimeUTC>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>0</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <Message>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <Content>message</Content>\n",
					"      <PreviewsPost></PreviewsPost>\n",
					"    </Message>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>400</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <EndTimeUTC>500</EndTimeUTC>\n",
					"  </Conversation>\n",
					"</FileDump>",
				}, ""),
				"step2": strings.Join([]string{
					xml.Header,
					"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n",
					"  <Conversation Perspective=\"channel-display-name\">\n",
					"    <RoomID>direct - channel-name - channel-id</RoomID>\n",
					"    <StartTimeUTC>1</StartTimeUTC>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>0</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <Message>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <Content>message</Content>\n",
					"      <PreviewsPost></PreviewsPost>\n",
					"    </Message>\n",
					"    <Message>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>2</DateTimeUTC>\n",
					"      <Content>delete message</Content>\n",
					"      <PreviewsPost></PreviewsPost>\n",
					"    </Message>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>400</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <EndTimeUTC>500</EndTimeUTC>\n",
					"  </Conversation>\n",
					"</FileDump>",
				}, ""),
			},
			expectedFiles: 2,
		},
		{
			name:       "post,export,edit,export",
			jobEndTime: 600,
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{JoinTime: 0, ChannelId: "channel-id", UserId: "user-id", UserEmail: "test@test.com", Username: "username", LeaveTime: model.NewPointer(int64(450))},
				},
			},
			activity: []string{"channel-id"},
			channels: model.ChannelList{{
				TeamId:      "team-id",
				Id:          "channel-id",
				Name:        "channel-name",
				DisplayName: "channel-display-name",
				Type:        model.ChannelTypeDirect,
			}},
			posts: map[string][]*model.MessageExport{
				"step1": {
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
						PostUpdateAt:       model.NewPointer(int64(1)),
						PostMessage:        model.NewPointer("message"),
						UserEmail:          model.NewPointer("test@test.com"),
						UserId:             model.NewPointer("user-id"),
						Username:           model.NewPointer("username"),
						ChannelType:        &chanTypeDirect,
						PostFileIds:        []string{},
					},
				},
				"step2": {
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
						PostUpdateAt:       model.NewPointer(int64(2)),
						PostDeleteAt:       model.NewPointer(int64(2)),
						PostMessage:        model.NewPointer("edit message"),
						UserEmail:          model.NewPointer("test@test.com"),
						UserId:             model.NewPointer("user-id"),
						Username:           model.NewPointer("username"),
						ChannelType:        &chanTypeDirect,
						PostFileIds:        []string{},
					},
				},
			},
			expectedData: map[string]string{
				"step1": strings.Join([]string{
					xml.Header,
					"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n",
					"  <Conversation Perspective=\"channel-display-name\">\n",
					"    <RoomID>direct - channel-name - channel-id</RoomID>\n",
					"    <StartTimeUTC>1</StartTimeUTC>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>0</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <Message>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <Content>message</Content>\n",
					"      <PreviewsPost></PreviewsPost>\n",
					"    </Message>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>450</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <EndTimeUTC>600</EndTimeUTC>\n",
					"  </Conversation>\n",
					"</FileDump>",
				}, ""),
				"step2": strings.Join([]string{
					xml.Header,
					"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n",
					"  <Conversation Perspective=\"channel-display-name\">\n",
					"    <RoomID>direct - channel-name - channel-id</RoomID>\n",
					"    <StartTimeUTC>1</StartTimeUTC>\n",
					"    <ParticipantEntered>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>0</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantEntered>\n",
					"    <Message>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <Content>edit message</Content>\n",
					"      <PreviewsPost></PreviewsPost>\n",
					"    </Message>\n",
					"    <ParticipantLeft>\n",
					"      <LoginName>test@test.com</LoginName>\n",
					"      <UserType>user</UserType>\n",
					"      <DateTimeUTC>450</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <EndTimeUTC>600</EndTimeUTC>\n",
					"  </Conversation>\n",
					"</FileDump>",
				}, ""),
			},
			expectedFiles: 2,
		},
	}

	for _, tt := range multActianceExportTests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			if len(tt.cmhs) > 0 {
				for channelId, cmhs := range tt.cmhs {
					mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), tt.jobEndTime, []string{channelId}).
						Return(cmhs, nil)
				}
			}

			if tt.activity != nil {
				mockStore.ChannelMemberHistoryStore.On("GetChannelsWithActivityDuring", mock.Anything, mock.Anything).
					Return(tt.activity, nil)
			}

			if tt.channels != nil {
				mockStore.ChannelStore.On("GetMany", tt.activity, true).
					Return(tt.channels, nil)
			}

			myMockReporter := MyReporter{}
			defer myMockReporter.AssertExpectations(t)
			if len(tt.activity) > 0 {
				myMockReporter.On("ReportProgressMessage", "ent.message_export.actiance_export.calculate_channel_exports.channel_message")
			}
			if len(tt.cmhs) > 0 {
				myMockReporter.On("ReportProgressMessage", "ent.message_export.actiance_export.calculate_channel_exports.activity_message")
			}

			channelMetadata, channelMemberHistories, err := shared.CalculateChannelExports(rctx,
				shared.ChannelExportsParams{
					Store:                   mockStore,
					ExportPeriodStartTime:   1,
					ExportPeriodEndTime:     tt.jobEndTime,
					ChannelBatchSize:        100,
					ChannelHistoryBatchSize: 100,
					ReportProgressMessage:   myMockReporter.ReportProgressMessage,
				})
			assert.NoError(t, err)

			exportFileName := path.Join("export", "jobName", "jobName-batch001.zip")
			res, err := ActianceExport(rctx, Params{
				ChannelMetadata:        channelMetadata,
				Posts:                  tt.posts["step1"],
				ChannelMemberHistories: channelMemberHistories,
				BatchPath:              exportFileName,
				BatchStartTime:         1,
				BatchEndTime:           tt.jobEndTime,
				Db:                     mockStore,
				FileAttachmentBackend:  attachmentBackend,
				ExportBackend:          exportBackend,
			})

			assert.NoError(t, err)
			assert.Equal(t, 0, res.NumWarnings)

			zipBytes, err := exportBackend.ReadFile(exportFileName)
			assert.NoError(t, err)
			zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
			assert.NoError(t, err)
			actiancexml, err := zipReader.File[0].Open()
			require.NoError(t, err)
			defer actiancexml.Close()
			xmlData, err := io.ReadAll(actiancexml)
			assert.NoError(t, err)

			assert.Equal(t, tt.expectedData["step1"], string(xmlData))

			res, err = ActianceExport(rctx, Params{
				ChannelMetadata:        channelMetadata,
				Posts:                  tt.posts["step2"],
				ChannelMemberHistories: channelMemberHistories,
				BatchPath:              exportFileName,
				BatchStartTime:         1,
				BatchEndTime:           tt.jobEndTime,
				Db:                     mockStore,
				FileAttachmentBackend:  attachmentBackend,
				ExportBackend:          exportBackend,
			})
			assert.NoError(t, err)
			assert.Equal(t, 0, res.NumWarnings)

			zipBytes, err = exportBackend.ReadFile(exportFileName)
			assert.NoError(t, err)
			zipReader, err = zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
			assert.NoError(t, err)
			actiancexml, err = zipReader.File[0].Open()
			require.NoError(t, err)
			defer actiancexml.Close()
			xmlData, err = io.ReadAll(actiancexml)
			assert.NoError(t, err)

			assert.Equal(t, tt.expectedData["step2"], string(xmlData))

			t.Cleanup(func() {
				err = exportBackend.RemoveFile(exportFileName)
				assert.NoError(t, err)
			})
		})
	}
}

func TestPostToAttachmentsEntries(t *testing.T) {
	chanTypeDirect := model.ChannelTypeDirect
	tt := []struct {
		name                       string
		post                       model.MessageExport
		attachments                []*model.FileInfo
		expectedStarts             []any
		expectedStops              []any
		expectedFileInfos          []*model.FileInfo
		expectedDeleteFileMessages []any
		expectError                bool
	}{
		{
			name: "no-attachments",
			post: model.MessageExport{
				ChannelId:          model.NewPointer("Test"),
				ChannelDisplayName: model.NewPointer("Test"),
				PostCreateAt:       model.NewPointer(int64(1)),
				PostMessage:        model.NewPointer("Some message"),
				UserEmail:          model.NewPointer("test@test.com"),
				UserId:             model.NewPointer("test"),
				Username:           model.NewPointer("test"),
				ChannelType:        &chanTypeDirect,
			},
			attachments:                nil,
			expectedStarts:             nil,
			expectedStops:              nil,
			expectedFileInfos:          nil,
			expectedDeleteFileMessages: nil,
			expectError:                false,
		},
		{
			name: "one-attachment",
			post: model.MessageExport{
				PostId:             model.NewPointer("test"),
				ChannelId:          model.NewPointer("Test"),
				ChannelDisplayName: model.NewPointer("Test"),
				PostCreateAt:       model.NewPointer(int64(1)),
				PostMessage:        model.NewPointer("Some message"),
				UserEmail:          model.NewPointer("test@test.com"),
				UserId:             model.NewPointer("test"),
				Username:           model.NewPointer("test"),
				ChannelType:        &chanTypeDirect,
				PostFileIds:        []string{"12345"},
			},
			attachments: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt"},
			},
			expectedStarts: []any{
				&FileUploadStartExport{UserEmail: "test@test.com", UploadStartTime: 1, Filename: "test", FilePath: "filename.txt"},
			},
			expectedStops: []any{
				&FileUploadStopExport{UserEmail: "test@test.com", UploadStopTime: 1, Filename: "test", FilePath: "filename.txt", Status: "Completed"},
			},
			expectedFileInfos: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt"},
			},
			expectedDeleteFileMessages: nil,
			expectError:                false,
		},
		{
			name: "two-attachment",
			post: model.MessageExport{
				PostId:             model.NewPointer("test"),
				ChannelId:          model.NewPointer("Test"),
				ChannelDisplayName: model.NewPointer("Test"),
				PostCreateAt:       model.NewPointer(int64(1)),
				PostMessage:        model.NewPointer("Some message"),
				UserEmail:          model.NewPointer("test@test.com"),
				UserId:             model.NewPointer("test"),
				Username:           model.NewPointer("test"),
				ChannelType:        &chanTypeDirect,
				PostFileIds:        []string{"12345", "54321"},
			},
			attachments: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt"},
				{Name: "test2", Id: "54321", Path: "filename2.txt"},
			},
			expectedStarts: []any{
				&FileUploadStartExport{UserEmail: "test@test.com", UploadStartTime: 1, Filename: "test", FilePath: "filename.txt"},
				&FileUploadStartExport{UserEmail: "test@test.com", UploadStartTime: 1, Filename: "test2", FilePath: "filename2.txt"},
			},
			expectedStops: []any{
				&FileUploadStopExport{UserEmail: "test@test.com", UploadStopTime: 1, Filename: "test", FilePath: "filename.txt", Status: "Completed"},
				&FileUploadStopExport{UserEmail: "test@test.com", UploadStopTime: 1, Filename: "test2", FilePath: "filename2.txt", Status: "Completed"},
			},
			expectedFileInfos: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt"},
				{Name: "test2", Id: "54321", Path: "filename2.txt"},
			},
			expectedDeleteFileMessages: nil,
			expectError:                false,
		},
		{
			name: "one-attachment-deleted",
			post: model.MessageExport{
				PostId:             model.NewPointer("test"),
				ChannelId:          model.NewPointer("Test"),
				ChannelDisplayName: model.NewPointer("Test"),
				PostCreateAt:       model.NewPointer(int64(1)),
				PostDeleteAt:       model.NewPointer(int64(2)),
				PostMessage:        model.NewPointer("Some message"),
				UserEmail:          model.NewPointer("test@test.com"),
				UserId:             model.NewPointer("test"),
				Username:           model.NewPointer("test"),
				ChannelType:        &chanTypeDirect,
				PostFileIds:        []string{"12345", "54321"},
			},
			attachments: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt", DeleteAt: 2},
			},
			expectedStarts: []any{
				&FileUploadStartExport{UserEmail: "test@test.com", UploadStartTime: 1, Filename: "test", FilePath: "filename.txt"},
			},
			expectedStops: []any{
				&FileUploadStopExport{UserEmail: "test@test.com", UploadStopTime: 1, Filename: "test", FilePath: "filename.txt", Status: "Completed"},
			},
			expectedFileInfos: []*model.FileInfo{
				{Name: "test", Id: "12345", Path: "filename.txt", DeleteAt: 2},
			},
			expectedDeleteFileMessages: []any{
				&PostExport{UserEmail: "test@test.com", UserType: "user", PostTime: 2, Message: "delete " + "filename.txt"},
			},
			expectError: false,
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			if len(tc.attachments) > 0 {
				call := mockStore.FileInfoStore.On("GetForPost", *tc.post.PostId, true, true, false)
				call.Run(func(args mock.Arguments) {
					call.Return(tc.attachments, nil)
				})
			}
			uploadStarts, uploadStops, files, deleteFileMessages, err := postToAttachmentsEntries(&tc.post, mockStore)
			if tc.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tc.expectedStarts, uploadStarts)
			assert.Equal(t, tc.expectedStops, uploadStops)
			assert.Equal(t, tc.expectedFileInfos, files)
			assert.Equal(t, tc.expectedDeleteFileMessages, deleteFileMessages)
		})
	}
}

func TestWriteExportWarnings(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(tempDir)
		assert.NoError(t, err)
	})

	config := filestore.FileBackendSettings{
		DriverName: model.ImageDriverLocal,
		Directory:  tempDir,
	}

	fileBackend, err := filestore.NewFileBackend(config)
	assert.NoError(t, err)

	rctx := request.TestContext(t)

	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	// Do not create the files, we want them to error
	uploadedFiles := []*model.FileInfo{
		{Name: "test", Id: "12345", Path: "missing.txt"},
		{Name: "test2", Id: "54321", Path: "missing.txt"},
	}
	export := &RootNode{
		XMLNS:    XMLNS,
		Channels: []ChannelExport{},
	}

	exportFileName := path.Join("export", "jobName", "jobName-batch001.zip")
	warnings, err := writeExport(rctx, export, uploadedFiles, fileBackend, fileBackend, exportFileName)
	assert.NoError(t, err)
	assert.Equal(t, 2, warnings)

	err = fileBackend.RemoveFile(exportFileName)
	require.NoError(t, err)
}

func Test_channelHasActivity(t *testing.T) {
	tests := []struct {
		name      string
		cmhs      []*model.ChannelMemberHistoryResult
		startTime int64
		endTime   int64
		want      bool
	}{
		{
			name:      "no activity",
			cmhs:      nil,
			startTime: 1000,
			endTime:   2000,
			want:      false,
		},
		{
			name: "no activity in bounds (but activity out of bounds)",
			cmhs: []*model.ChannelMemberHistoryResult{
				{
					ChannelId:    "channelid",
					UserId:       "testid",
					JoinTime:     900,
					LeaveTime:    nil,
					UserEmail:    "testemail@email.com",
					Username:     "test_username",
					IsBot:        false,
					UserDeleteAt: 0,
				},
				{
					ChannelId:    "channelid",
					UserId:       "testid2",
					JoinTime:     2100,
					LeaveTime:    nil,
					UserEmail:    "testemail@email.com",
					Username:     "test_username",
					IsBot:        false,
					UserDeleteAt: 0,
				},
			},
			startTime: 1000,
			endTime:   2000,
			want:      false,
		},
		{
			name: "join on lower bounds",
			cmhs: []*model.ChannelMemberHistoryResult{
				{
					ChannelId:    "channelid",
					UserId:       "testid",
					JoinTime:     1000,
					LeaveTime:    nil,
					UserEmail:    "testemail@email.com",
					Username:     "test_username",
					IsBot:        false,
					UserDeleteAt: 0,
				},
			},
			startTime: 1000,
			endTime:   2000,
			want:      true,
		},
		{
			name: "join within bounds",
			cmhs: []*model.ChannelMemberHistoryResult{
				{
					ChannelId:    "channelid",
					UserId:       "testid",
					JoinTime:     1500,
					LeaveTime:    nil,
					UserEmail:    "testemail@email.com",
					Username:     "test_username",
					IsBot:        false,
					UserDeleteAt: 0,
				},
			},
			startTime: 1000,
			endTime:   2000,
			want:      true,
		},
		{
			name: "join on upper bounds",
			cmhs: []*model.ChannelMemberHistoryResult{
				{
					ChannelId:    "channelid",
					UserId:       "testid",
					JoinTime:     2000,
					LeaveTime:    nil,
					UserEmail:    "testemail@email.com",
					Username:     "test_username",
					IsBot:        false,
					UserDeleteAt: 0,
				},
			},
			startTime: 1000,
			endTime:   2000,
			want:      true,
		},
		{
			name: "leave on lower bounds",
			cmhs: []*model.ChannelMemberHistoryResult{
				{
					ChannelId:    "channelid",
					UserId:       "testid",
					JoinTime:     100,
					LeaveTime:    model.NewPointer[int64](1000),
					UserEmail:    "testemail@email.com",
					Username:     "test_username",
					IsBot:        false,
					UserDeleteAt: 0,
				},
			},
			startTime: 1000,
			endTime:   2000,
			want:      true,
		},
		{
			name: "leave within bounds",
			cmhs: []*model.ChannelMemberHistoryResult{
				{
					ChannelId:    "channelid",
					UserId:       "testid",
					JoinTime:     100,
					LeaveTime:    model.NewPointer[int64](1500),
					UserEmail:    "testemail@email.com",
					Username:     "test_username",
					IsBot:        false,
					UserDeleteAt: 0,
				},
			},
			startTime: 1000,
			endTime:   2000,
			want:      true,
		},
		{
			name: "leave on upper bounds",
			cmhs: []*model.ChannelMemberHistoryResult{
				{
					ChannelId:    "channelid",
					UserId:       "testid",
					JoinTime:     100,
					LeaveTime:    model.NewPointer[int64](2000),
					UserEmail:    "testemail@email.com",
					Username:     "test_username",
					IsBot:        false,
					UserDeleteAt: 0,
				},
			},
			startTime: 1000,
			endTime:   2000,
			want:      true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, channelHasActivity(tt.cmhs, tt.startTime, tt.endTime), "channelHasActivity(%v, %v, %v)", tt.cmhs, tt.startTime, tt.endTime)
		})
	}
}
