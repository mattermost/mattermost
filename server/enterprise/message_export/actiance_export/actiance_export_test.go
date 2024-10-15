// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package actiance_export

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"io"
	"os"
	"path"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

func TestActianceExport(t *testing.T) {
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

	chanTypeDirect := model.ChannelTypeDirect
	csvExportTests := []struct {
		name          string
		cmhs          map[string][]*model.ChannelMemberHistoryResult
		posts         []*model.MessageExport
		attachments   map[string][]*model.FileInfo
		expectedData  string
		expectedFiles int
	}{
		{
			name:        "empty",
			cmhs:        map[string][]*model.ChannelMemberHistoryResult{},
			posts:       []*model.MessageExport{},
			attachments: map[string][]*model.FileInfo{},
			expectedData: strings.Join([]string{
				xml.Header,
				"<FileDump xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"></FileDump>",
			}, ""),
			expectedFiles: 2,
		},
		{
			name: "posts",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{JoinTime: 0, UserId: "test", UserEmail: "test", Username: "test", LeaveTime: model.NewPointer(int64(400))},
					{JoinTime: 8, UserId: "test2", UserEmail: "test2", Username: "test2", LeaveTime: model.NewPointer(int64(80))},
					{JoinTime: 400, UserId: "test3", UserEmail: "test3", Username: "test3"},
					{JoinTime: 10, UserId: "test_bot", UserEmail: "test_bot", Username: "test_bot", IsBot: true, LeaveTime: model.NewPointer(int64(20))},
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
				"      <LoginName>test</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>0</DateTimeUTC>\n",
				"      <CorporateEmailID>test</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test2</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>8</DateTimeUTC>\n",
				"      <CorporateEmailID>test2</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test_bot</LoginName>\n",
				"      <UserType>bot</UserType>\n",
				"      <DateTimeUTC>10</DateTimeUTC>\n",
				"      <CorporateEmailID>test_bot</CorporateEmailID>\n",
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
				"      <LoginName>test_bot</LoginName>\n",
				"      <UserType>bot</UserType>\n",
				"      <DateTimeUTC>20</DateTimeUTC>\n",
				"      <CorporateEmailID>test_bot</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test2</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>80</DateTimeUTC>\n",
				"      <CorporateEmailID>test2</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>100</DateTimeUTC>\n",
				"      <CorporateEmailID>test</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>100</DateTimeUTC>\n",
				"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <EndTimeUTC>100</EndTimeUTC>\n",
				"  </Conversation>\n",
				"</FileDump>",
			}, ""),
			expectedFiles: 2,
		},
		{
			name: "post with permalink preview",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{JoinTime: 0, UserId: "test", UserEmail: "test", Username: "test", LeaveTime: model.NewPointer(int64(400))},
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
				"      <LoginName>test</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>0</DateTimeUTC>\n",
				"      <CorporateEmailID>test</CorporateEmailID>\n",
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
				"      <LoginName>test</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>100</DateTimeUTC>\n",
				"      <CorporateEmailID>test</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>100</DateTimeUTC>\n",
				"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <EndTimeUTC>100</EndTimeUTC>\n",
				"  </Conversation>\n",
				"</FileDump>",
			}, ""),
			expectedFiles: 0,
		},
		{
			name: "posts with attachments",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{
						JoinTime: 0, UserId: "test", UserEmail: "test", Username: "test", LeaveTime: model.NewPointer(int64(400)),
					},
					{
						JoinTime: 8, UserId: "test2", UserEmail: "test2", Username: "test2", LeaveTime: model.NewPointer(int64(80)),
					},
					{
						JoinTime: 400, UserId: "test3", UserEmail: "test3", Username: "test3",
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
				"      <LoginName>test</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>0</DateTimeUTC>\n",
				"      <CorporateEmailID>test</CorporateEmailID>\n",
				"    </ParticipantEntered>\n",
				"    <ParticipantEntered>\n",
				"      <LoginName>test2</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>8</DateTimeUTC>\n",
				"      <CorporateEmailID>test2</CorporateEmailID>\n",
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
				"      <LoginName>test2</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>80</DateTimeUTC>\n",
				"      <CorporateEmailID>test2</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>100</DateTimeUTC>\n",
				"      <CorporateEmailID>test</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <ParticipantLeft>\n",
				"      <LoginName>test@test.com</LoginName>\n",
				"      <UserType>user</UserType>\n",
				"      <DateTimeUTC>100</DateTimeUTC>\n",
				"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
				"    </ParticipantLeft>\n",
				"    <EndTimeUTC>100</EndTimeUTC>\n",
				"  </Conversation>\n",
				"</FileDump>",
			}, ""),
			expectedFiles: 3,
		},
	}

	for _, tt := range csvExportTests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			if len(tt.attachments) > 0 {
				for post_id, attachments := range tt.attachments {
					attachments := attachments // TODO: Remove once go1.22 is used
					call := mockStore.FileInfoStore.On("GetForPost", post_id, true, true, false)
					call.Run(func(args mock.Arguments) {
						call.Return(attachments, nil)
					})
					_, err = fileBackend.WriteFile(bytes.NewReader([]byte{}), attachments[0].Path)
					require.NoError(t, err)

					t.Cleanup(func() {
						err = fileBackend.RemoveFile(attachments[0].Path)
						require.NoError(t, err)
					})
				}
			}

			if len(tt.cmhs) > 0 {
				for channelId, cmhs := range tt.cmhs {
					mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), int64(100), channelId).Return(cmhs, nil)
				}
			}

			exportFileName := path.Join("export", "jobName", "jobName-batch001.zip")
			warnings, appErr := ActianceExport(rctx, tt.posts, mockStore, fileBackend, exportFileName)
			assert.Nil(t, appErr)
			assert.Equal(t, int64(0), warnings)

			zipBytes, err := fileBackend.ReadFile(exportFileName)
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
				err = fileBackend.RemoveFile(exportFileName)
				assert.NoError(t, err)
			})
		})
	}
}

func TestMultipleActianceExport(t *testing.T) {
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

	chanTypeDirect := model.ChannelTypeDirect
	csvExportTests := []struct {
		name          string
		cmhs          map[string][]*model.ChannelMemberHistoryResult
		posts         map[string][]*model.MessageExport
		attachments   map[string][]*model.FileInfo
		expectedData  map[string]string
		expectedFiles int
	}{
		{
			name: "post,export,delete,export",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{JoinTime: 0, UserId: "user-id", UserEmail: "test@test.com", Username: "username", LeaveTime: model.NewPointer(int64(400))},
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
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <EndTimeUTC>1</EndTimeUTC>\n",
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
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <EndTimeUTC>1</EndTimeUTC>\n",
					"  </Conversation>\n",
					"</FileDump>",
				}, ""),
			},
			expectedFiles: 2,
		},
		{
			name: "post,export,edit,export",
			cmhs: map[string][]*model.ChannelMemberHistoryResult{
				"channel-id": {
					{JoinTime: 0, UserId: "user-id", UserEmail: "test@test.com", Username: "username", LeaveTime: model.NewPointer(int64(400))},
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
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <EndTimeUTC>1</EndTimeUTC>\n",
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
					"      <DateTimeUTC>1</DateTimeUTC>\n",
					"      <CorporateEmailID>test@test.com</CorporateEmailID>\n",
					"    </ParticipantLeft>\n",
					"    <EndTimeUTC>1</EndTimeUTC>\n",
					"  </Conversation>\n",
					"</FileDump>",
				}, ""),
			},
			expectedFiles: 2,
		},
	}

	for _, tt := range csvExportTests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			if len(tt.cmhs) > 0 {
				for channelId, cmhs := range tt.cmhs {
					mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), int64(1), channelId).Return(cmhs, nil)
				}
			}

			exportFileName := path.Join("export", "jobName", "jobName-batch001.zip")
			warnings, appErr := ActianceExport(rctx, tt.posts["step1"], mockStore, fileBackend, exportFileName)
			assert.Nil(t, appErr)
			assert.Equal(t, int64(0), warnings)

			zipBytes, err := fileBackend.ReadFile(exportFileName)
			assert.NoError(t, err)
			zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
			assert.NoError(t, err)
			actiancexml, err := zipReader.File[0].Open()
			require.NoError(t, err)
			defer actiancexml.Close()
			xmlData, err := io.ReadAll(actiancexml)
			assert.NoError(t, err)

			assert.Equal(t, tt.expectedData["step1"], string(xmlData))

			warnings, appErr = ActianceExport(rctx, tt.posts["step2"], mockStore, fileBackend, exportFileName)
			assert.Nil(t, appErr)
			assert.Equal(t, int64(0), warnings)

			zipBytes, err = fileBackend.ReadFile(exportFileName)
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
				err = fileBackend.RemoveFile(exportFileName)
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
			expectedDeleteFileMessages: []any{},
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
			expectedDeleteFileMessages: []any{},
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
				assert.NotNil(t, err)
			} else {
				assert.Nil(t, err)
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
	warnings, appErr := writeExport(rctx, export, uploadedFiles, fileBackend, exportFileName)
	assert.Nil(t, appErr)
	assert.Equal(t, int64(2), warnings)

	err = fileBackend.RemoveFile(exportFileName)
	require.NoError(t, err)
}
