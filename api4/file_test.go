// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"math/rand"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
	"github.com/mattermost/mattermost-server/v5/utils/testutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testDir = ""

func init() {
	testDir, _ = fileutils.FindDir("tests")
}

// File Section
var quoteEscaper = strings.NewReplacer("\\", "\\\\", `"`, "\\\"")

func escapeQuotes(s string) string {
	return quoteEscaper.Replace(s)
}

func randomBytes(t *testing.T, n int) []byte {
	bb := make([]byte, n)
	_, err := rand.Read(bb)
	require.NoError(t, err)
	return bb
}

func fileBytes(t *testing.T, path string) []byte {
	path = filepath.Join(testDir, path)
	f, err := os.Open(path)
	require.NoError(t, err)
	defer f.Close()
	bb, err := ioutil.ReadAll(f)
	require.NoError(t, err)
	return bb
}

func testDoUploadFileRequest(t testing.TB, c *model.Client4, url string, blob []byte, contentType string,
	contentLength int64) (*model.FileUploadResponse, *model.Response) {
	req, err := http.NewRequest("POST", c.ApiUrl+c.GetFilesRoute()+url, bytes.NewReader(blob))
	require.Nil(t, err)

	if contentLength != 0 {
		req.ContentLength = contentLength
	}
	req.Header.Set("Content-Type", contentType)
	if len(c.AuthToken) > 0 {
		req.Header.Set(model.HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	resp, err := c.HttpClient.Do(req)
	require.Nil(t, err)
	require.NotNil(t, resp)
	defer closeBody(resp)

	if resp.StatusCode >= 300 {
		return nil, model.BuildErrorResponse(resp, model.AppErrorFromJson(resp.Body))
	}

	return model.FileUploadResponseFromJson(resp.Body), model.BuildResponse(resp)
}

func testUploadFilesPost(
	t testing.TB,
	c *model.Client4,
	channelId string,
	names []string,
	blobs [][]byte,
	clientIds []string,
	useChunked bool,
) (*model.FileUploadResponse, *model.Response) {

	// Do not check len(clientIds), leave it entirely to the user to
	// provide. The server will error out if it does not match the number
	// of files, but it's not critical here.
	require.NotEmpty(t, names)
	require.NotEmpty(t, blobs)
	require.Equal(t, len(names), len(blobs))

	fileUploadResponse := &model.FileUploadResponse{}
	for i, blob := range blobs {
		var cl int64
		if useChunked {
			cl = -1
		} else {
			cl = int64(len(blob))
		}
		ct := http.DetectContentType(blob)

		postURL := fmt.Sprintf("?channel_id=%v", url.QueryEscape(channelId)) +
			fmt.Sprintf("&filename=%v", url.QueryEscape(names[i]))
		if len(clientIds) > i {
			postURL += fmt.Sprintf("&client_id=%v", url.QueryEscape(clientIds[i]))
		}

		fur, resp := testDoUploadFileRequest(t, c, postURL, blob, ct, cl)
		if resp.Error != nil {
			return nil, resp
		}

		fileUploadResponse.FileInfos = append(fileUploadResponse.FileInfos, fur.FileInfos[0])
		if len(clientIds) > 0 {
			if len(fur.ClientIds) > 0 {
				fileUploadResponse.ClientIds = append(fileUploadResponse.ClientIds, fur.ClientIds[0])
			} else {
				fileUploadResponse.ClientIds = append(fileUploadResponse.ClientIds, "")
			}
		}
	}

	return fileUploadResponse, nil
}

func testUploadFilesMultipart(
	t testing.TB,
	c *model.Client4,
	channelId string,
	names []string,
	blobs [][]byte,
	clientIds []string,
) (
	fileUploadResponse *model.FileUploadResponse,
	response *model.Response,
) {
	// Do not check len(clientIds), leave it entirely to the user to
	// provide. The server will error out if it does not match the number
	// of files, but it's not critical here.
	require.NotEmpty(t, names)
	require.NotEmpty(t, blobs)
	require.Equal(t, len(names), len(blobs))

	mwBody := &bytes.Buffer{}
	mw := multipart.NewWriter(mwBody)

	err := mw.WriteField("channel_id", channelId)
	require.Nil(t, err)

	for i, blob := range blobs {
		ct := http.DetectContentType(blob)
		if len(clientIds) > i {
			err = mw.WriteField("client_ids", clientIds[i])
			require.Nil(t, err)
		}

		h := textproto.MIMEHeader{}
		h.Set("Content-Disposition",
			fmt.Sprintf(`form-data; name="files"; filename="%s"`, escapeQuotes(names[i])))
		h.Set("Content-Type", ct)

		// If we error here, writing to mw, the deferred handler
		part, err := mw.CreatePart(h)
		require.Nil(t, err)

		_, err = io.Copy(part, bytes.NewReader(blob))
		require.Nil(t, err)
	}

	require.NoError(t, mw.Close())
	return testDoUploadFileRequest(t, c, "", mwBody.Bytes(), mw.FormDataContentType(), -1)
}

func TestUploadFiles(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	channel := th.BasicChannel
	date := time.Now().Format("20060102")

	// Get better error messages
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = true })

	tests := []struct {
		title     string
		client    *model.Client4
		blobs     [][]byte
		names     []string
		clientIds []string

		skipSuccessValidation       bool
		skipPayloadValidation       bool
		skipSimplePost              bool
		skipMultipart               bool
		channelId                   string
		useChunkedInSimplePost      bool
		expectedCreatorId           string
		expectedPayloadNames        []string
		expectImage                 bool
		expectedImageWidths         []int
		expectedImageHeights        []int
		expectedImageThumbnailNames []string
		expectedImagePreviewNames   []string
		expectedImageHasPreview     []bool
		setupConfig                 func(a *app.App) func(a *app.App)
		checkResponse               func(t *testing.T, resp *model.Response)
	}{
		// Upload a bunch of files, mixed images and non-images
		{
			title:             "Happy",
			names:             []string{"test.png", "testgif.gif", "testplugin.tar.gz", "test-search.md", "test.tiff"},
			expectedCreatorId: th.BasicUser.Id,
		},
		// Upload a bunch of files, with clientIds
		{
			title:             "Happy client_ids",
			names:             []string{"test.png", "testgif.gif", "testplugin.tar.gz", "test-search.md", "test.tiff"},
			clientIds:         []string{"1", "2", "3", "4", "5"},
			expectedCreatorId: th.BasicUser.Id,
		},
		// Upload a bunch of images. testgif.gif is an animated GIF,
		// so it does not have HasPreviewImage set.
		{
			title:                   "Happy images",
			names:                   []string{"test.png", "testgif.gif"},
			expectImage:             true,
			expectedCreatorId:       th.BasicUser.Id,
			expectedImageWidths:     []int{408, 118},
			expectedImageHeights:    []int{336, 118},
			expectedImageHasPreview: []bool{true, false},
		},
		{
			title:                 "Happy invalid image",
			names:                 []string{"testgif.gif"},
			blobs:                 [][]byte{fileBytes(t, "test-search.md")},
			skipPayloadValidation: true,
			expectedCreatorId:     th.BasicUser.Id,
		},
		// Simple POST, chunked encoding
		{
			title:                   "Happy image chunked post",
			skipMultipart:           true,
			useChunkedInSimplePost:  true,
			names:                   []string{"test.png"},
			expectImage:             true,
			expectedImageWidths:     []int{408},
			expectedImageHeights:    []int{336},
			expectedImageHasPreview: []bool{true},
			expectedCreatorId:       th.BasicUser.Id,
		},
		// Image thumbnail and preview: size and orientation. Note that
		// the expected image dimensions remain the same regardless of the
		// orientation - what we save in FileInfo is used by the
		// clients to size UI elements, so the dimensions are "actual".
		{
			title:                       "Happy image thumbnail/preview 1",
			names:                       []string{"orientation_test_1.jpeg"},
			expectedImageThumbnailNames: []string{"orientation_test_1_expected_thumb.jpeg"},
			expectedImagePreviewNames:   []string{"orientation_test_1_expected_preview.jpeg"},
			expectImage:                 true,
			expectedImageWidths:         []int{2860},
			expectedImageHeights:        []int{1578},
			expectedImageHasPreview:     []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		{
			title:                       "Happy image thumbnail/preview 2",
			names:                       []string{"orientation_test_2.jpeg"},
			expectedImageThumbnailNames: []string{"orientation_test_2_expected_thumb.jpeg"},
			expectedImagePreviewNames:   []string{"orientation_test_2_expected_preview.jpeg"},
			expectImage:                 true,
			expectedImageWidths:         []int{2860},
			expectedImageHeights:        []int{1578},
			expectedImageHasPreview:     []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		{
			title:                       "Happy image thumbnail/preview 3",
			names:                       []string{"orientation_test_3.jpeg"},
			expectedImageThumbnailNames: []string{"orientation_test_3_expected_thumb.jpeg"},
			expectedImagePreviewNames:   []string{"orientation_test_3_expected_preview.jpeg"},
			expectImage:                 true,
			expectedImageWidths:         []int{2860},
			expectedImageHeights:        []int{1578},
			expectedImageHasPreview:     []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		{
			title:                       "Happy image thumbnail/preview 4",
			names:                       []string{"orientation_test_4.jpeg"},
			expectedImageThumbnailNames: []string{"orientation_test_4_expected_thumb.jpeg"},
			expectedImagePreviewNames:   []string{"orientation_test_4_expected_preview.jpeg"},
			expectImage:                 true,
			expectedImageWidths:         []int{2860},
			expectedImageHeights:        []int{1578},
			expectedImageHasPreview:     []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		{
			title:                       "Happy image thumbnail/preview 5",
			names:                       []string{"orientation_test_5.jpeg"},
			expectedImageThumbnailNames: []string{"orientation_test_5_expected_thumb.jpeg"},
			expectedImagePreviewNames:   []string{"orientation_test_5_expected_preview.jpeg"},
			expectImage:                 true,
			expectedImageWidths:         []int{2860},
			expectedImageHeights:        []int{1578},
			expectedImageHasPreview:     []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		{
			title:                       "Happy image thumbnail/preview 6",
			names:                       []string{"orientation_test_6.jpeg"},
			expectedImageThumbnailNames: []string{"orientation_test_6_expected_thumb.jpeg"},
			expectedImagePreviewNames:   []string{"orientation_test_6_expected_preview.jpeg"},
			expectImage:                 true,
			expectedImageWidths:         []int{2860},
			expectedImageHeights:        []int{1578},
			expectedImageHasPreview:     []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		{
			title:                       "Happy image thumbnail/preview 7",
			names:                       []string{"orientation_test_7.jpeg"},
			expectedImageThumbnailNames: []string{"orientation_test_7_expected_thumb.jpeg"},
			expectedImagePreviewNames:   []string{"orientation_test_7_expected_preview.jpeg"},
			expectImage:                 true,
			expectedImageWidths:         []int{2860},
			expectedImageHeights:        []int{1578},
			expectedImageHasPreview:     []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		{
			title:                       "Happy image thumbnail/preview 8",
			names:                       []string{"orientation_test_8.jpeg"},
			expectedImageThumbnailNames: []string{"orientation_test_8_expected_thumb.jpeg"},
			expectedImagePreviewNames:   []string{"orientation_test_8_expected_preview.jpeg"},
			expectImage:                 true,
			expectedImageWidths:         []int{2860},
			expectedImageHeights:        []int{1578},
			expectedImageHasPreview:     []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		// TIFF preview test
		{
			title:                       "Happy image thumbnail/preview 9",
			names:                       []string{"test.tiff"},
			expectedImageThumbnailNames: []string{"test_expected_thumb.tiff"},
			expectedImagePreviewNames:   []string{"test_expected_preview.tiff"},
			expectImage:                 true,
			expectedImageWidths:         []int{701},
			expectedImageHeights:        []int{701},
			expectedImageHasPreview:     []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		{
			title:             "Happy admin",
			client:            th.SystemAdminClient,
			names:             []string{"test.png"},
			expectedCreatorId: th.SystemAdminUser.Id,
		},
		{
			title:                  "Happy stream",
			useChunkedInSimplePost: true,
			skipPayloadValidation:  true,
			names:                  []string{"1Mb-stream"},
			blobs:                  [][]byte{randomBytes(t, 1024*1024)},
			setupConfig: func(a *app.App) func(a *app.App) {
				maxFileSize := *a.Config().FileSettings.MaxFileSize
				a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize = 1024 * 1024 })
				return func(a *app.App) {
					a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize = maxFileSize })
				}
			},
			expectedCreatorId: th.BasicUser.Id,
		},
		// Error cases
		{
			title:                 "Error channel_id does not exist",
			channelId:             model.NewId(),
			names:                 []string{"test.png"},
			skipSuccessValidation: true,
			checkResponse:         CheckForbiddenStatus,
		},
		{
			// on simple post this uploads the last file
			// successfully, without a ClientId
			title:                 "Error too few client_ids",
			skipSimplePost:        true,
			names:                 []string{"test.png", "testplugin.tar.gz", "test-search.md"},
			clientIds:             []string{"1", "4"},
			skipSuccessValidation: true,
			checkResponse:         CheckBadRequestStatus,
		},
		{
			title:                 "Error invalid channel_id",
			channelId:             "../../junk",
			names:                 []string{"test.png"},
			skipSuccessValidation: true,
			checkResponse:         CheckBadRequestStatus,
		},
		{
			title:                 "Error admin channel_id does not exist",
			client:                th.SystemAdminClient,
			channelId:             model.NewId(),
			names:                 []string{"test.png"},
			skipSuccessValidation: true,
			checkResponse:         CheckForbiddenStatus,
		},
		{
			title:                 "Error admin invalid channel_id",
			client:                th.SystemAdminClient,
			channelId:             "../../junk",
			names:                 []string{"test.png"},
			skipSuccessValidation: true,
			checkResponse:         CheckBadRequestStatus,
		},
		{
			title:                 "Error admin disabled uploads",
			client:                th.SystemAdminClient,
			names:                 []string{"test.png"},
			skipSuccessValidation: true,
			checkResponse:         CheckNotImplementedStatus,
			setupConfig: func(a *app.App) func(a *app.App) {
				enableFileAttachments := *a.Config().FileSettings.EnableFileAttachments
				a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = false })
				return func(a *app.App) {
					a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = enableFileAttachments })
				}
			},
		},
		{
			title:                 "Error file too large",
			names:                 []string{"test.png"},
			skipSuccessValidation: true,
			checkResponse:         CheckRequestEntityTooLargeStatus,
			setupConfig: func(a *app.App) func(a *app.App) {
				maxFileSize := *a.Config().FileSettings.MaxFileSize
				a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize = 279590 })
				return func(a *app.App) {
					a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize = maxFileSize })
				}
			},
		},
		// File too large (chunked, simple POST only, multipart would've been redundant with above)
		{
			title:                  "File too large chunked",
			useChunkedInSimplePost: true,
			skipMultipart:          true,
			names:                  []string{"test.png"},
			skipSuccessValidation:  true,
			checkResponse:          CheckRequestEntityTooLargeStatus,
			setupConfig: func(a *app.App) func(a *app.App) {
				maxFileSize := *a.Config().FileSettings.MaxFileSize
				a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize = 279590 })
				return func(a *app.App) {
					a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize = maxFileSize })
				}
			},
		},
		{
			title:                 "Error stream too large",
			skipPayloadValidation: true,
			names:                 []string{"1Mb-stream"},
			blobs:                 [][]byte{randomBytes(t, 1024*1024)},
			skipSuccessValidation: true,
			checkResponse:         CheckRequestEntityTooLargeStatus,
			setupConfig: func(a *app.App) func(a *app.App) {
				maxFileSize := *a.Config().FileSettings.MaxFileSize
				a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize = 10 * 1024 })
				return func(a *app.App) {
					a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize = maxFileSize })
				}
			},
		},
	}

	for _, useMultipart := range []bool{true, false} {
		for _, tc := range tests {
			if tc.skipMultipart && useMultipart || tc.skipSimplePost && !useMultipart {
				continue
			}

			title := ""
			if useMultipart {
				title = "multipart "
			} else {
				title = "simple "
			}
			if tc.title != "" {
				title += tc.title + " "
			}
			title += fmt.Sprintf("%v", tc.names)

			t.Run(title, func(t *testing.T) {
				// Apply any necessary config changes
				if tc.setupConfig != nil {
					restoreConfig := tc.setupConfig(th.App)
					if restoreConfig != nil {
						defer restoreConfig(th.App)
					}
				}

				// Set the default values
				client := th.Client
				if tc.client != nil {
					client = tc.client
				}
				channelId := channel.Id
				if tc.channelId != "" {
					channelId = tc.channelId
				}

				blobs := tc.blobs
				if len(blobs) == 0 {
					for _, name := range tc.names {
						blobs = append(blobs, fileBytes(t, name))
					}
				}

				var fileResp *model.FileUploadResponse
				var resp *model.Response
				if useMultipart {
					fileResp, resp = testUploadFilesMultipart(t, client, channelId, tc.names, blobs, tc.clientIds)
				} else {
					fileResp, resp = testUploadFilesPost(t, client, channelId, tc.names, blobs, tc.clientIds, tc.useChunkedInSimplePost)
				}

				if tc.checkResponse != nil {
					tc.checkResponse(t, resp)
				} else {
					if resp != nil {
						require.Nil(t, resp.Error)
					}
				}
				if tc.skipSuccessValidation {
					return
				}

				require.NotNil(t, fileResp, "Nil fileResp")
				require.NotEqual(t, 0, len(fileResp.FileInfos), "Empty FileInfos")
				require.Equal(t, len(tc.names), len(fileResp.FileInfos), "Mismatched actual or expected FileInfos")

				for i, ri := range fileResp.FileInfos {
					// The returned file info from the upload call will be missing some fields that will be stored in the database
					assert.Equal(t, ri.CreatorId, tc.expectedCreatorId, "File should be assigned to user")
					assert.Equal(t, ri.PostId, "", "File shouldn't have a post Id")
					assert.Equal(t, ri.Path, "", "File path should not be set on returned info")
					assert.Equal(t, ri.ThumbnailPath, "", "File thumbnail path should not be set on returned info")
					assert.Equal(t, ri.PreviewPath, "", "File preview path should not be set on returned info")
					if len(tc.clientIds) > i {
						assert.True(t, len(fileResp.ClientIds) == len(tc.clientIds),
							fmt.Sprintf("Wrong number of clientIds returned, expected %v, got %v", len(tc.clientIds), len(fileResp.ClientIds)))
						assert.Equal(t, fileResp.ClientIds[i], tc.clientIds[i],
							fmt.Sprintf("Wrong clientId returned, expected %v, got %v", tc.clientIds[i], fileResp.ClientIds[i]))
					}

					dbInfo, err := th.App.Srv.Store.FileInfo().Get(ri.Id)
					require.Nil(t, err)
					assert.Equal(t, dbInfo.Id, ri.Id, "File id from response should match one stored in database")
					assert.Equal(t, dbInfo.CreatorId, tc.expectedCreatorId, "F ile should be assigned to user")
					assert.Equal(t, dbInfo.PostId, "", "File shouldn't have a post")
					assert.NotEqual(t, dbInfo.Path, "", "File path should be set in database")
					_, fname := filepath.Split(dbInfo.Path)
					ext := filepath.Ext(fname)
					name := fname[:len(fname)-len(ext)]
					expectedDir := fmt.Sprintf("%v/teams/%v/channels/%v/users/%s/%s", date, FILE_TEAM_ID, channel.Id, ri.CreatorId, ri.Id)
					expectedPath := fmt.Sprintf("%s/%s", expectedDir, fname)
					assert.Equal(t, dbInfo.Path, expectedPath,
						fmt.Sprintf("File %v saved to:%q, expected:%q", dbInfo.Name, dbInfo.Path, expectedPath))

					if tc.expectImage {
						expectedThumbnailPath := fmt.Sprintf("%s/%s_thumb.jpg", expectedDir, name)
						expectedPreviewPath := fmt.Sprintf("%s/%s_preview.jpg", expectedDir, name)
						assert.Equal(t, dbInfo.ThumbnailPath, expectedThumbnailPath,
							fmt.Sprintf("Thumbnail for %v saved to:%q, expected:%q", dbInfo.Name, dbInfo.ThumbnailPath, expectedThumbnailPath))
						assert.Equal(t, dbInfo.PreviewPath, expectedPreviewPath,
							fmt.Sprintf("Preview for %v saved to:%q, expected:%q", dbInfo.Name, dbInfo.PreviewPath, expectedPreviewPath))

						assert.True(t,
							dbInfo.HasPreviewImage == tc.expectedImageHasPreview[i],
							fmt.Sprintf("Image: HasPreviewImage should be set for %s", dbInfo.Name))
						assert.True(t,
							dbInfo.Width == tc.expectedImageWidths[i] && dbInfo.Height == tc.expectedImageHeights[i],
							fmt.Sprintf("Image dimensions: expected %dwx%dh, got %vwx%dh",
								tc.expectedImageWidths[i], tc.expectedImageHeights[i],
								dbInfo.Width, dbInfo.Height))
					}

					if !tc.skipPayloadValidation {
						compare := func(get func(string) ([]byte, *model.Response), name string) {
							data, resp := get(ri.Id)
							require.NotNil(t, resp)
							require.Nil(t, resp.Error)

							expected, err := ioutil.ReadFile(filepath.Join(testDir, name))
							require.Nil(t, err)
							if !bytes.Equal(data, expected) {
								tf, err := ioutil.TempFile("", fmt.Sprintf("test_%v_*_%s", i, name))
								require.Nil(t, err)
								_, _ = io.Copy(tf, bytes.NewReader(data))
								tf.Close()
								t.Errorf("Actual data mismatched %s, written to %q", name, tf.Name())
							}
						}
						if len(tc.expectedPayloadNames) == 0 {
							tc.expectedPayloadNames = tc.names
						}

						compare(client.GetFile, tc.expectedPayloadNames[i])
						if len(tc.expectedImageThumbnailNames) > i {
							compare(client.GetFileThumbnail, tc.expectedImageThumbnailNames[i])
						}
						if len(tc.expectedImageThumbnailNames) > i {
							compare(client.GetFilePreview, tc.expectedImagePreviewNames[i])
						}
					}

					th.cleanupTestFile(dbInfo)
				}
			})

		}
	}
}

func TestGetFile(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, resp := Client.UploadFile(sent, channel.Id, "test.png")
	CheckNoError(t, resp)

	fileId := fileResp.FileInfos[0].Id

	data, resp := Client.GetFile(fileId)
	CheckNoError(t, resp)
	require.NotEqual(t, 0, len(data), "should not be empty")

	for i := range data {
		require.Equal(t, sent[i], data[i], "received file didn't match sent one")
	}

	_, resp = Client.GetFile("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFile(model.NewId())
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetFile(fileId)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetFile(fileId)
	CheckNoError(t, resp)
}

func TestGetFileHeaders(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	testHeaders := func(data []byte, filename string, expectedContentType string, getInline bool) func(*testing.T) {
		return func(t *testing.T) {
			fileResp, resp := Client.UploadFile(data, channel.Id, filename)
			CheckNoError(t, resp)

			fileId := fileResp.FileInfos[0].Id

			_, resp = Client.GetFile(fileId)
			CheckNoError(t, resp)

			CheckStartsWith(t, resp.Header.Get("Content-Type"), expectedContentType, "returned incorrect Content-Type")

			if getInline {
				CheckStartsWith(t, resp.Header.Get("Content-Disposition"), "inline", "returned incorrect Content-Disposition")
			} else {
				CheckStartsWith(t, resp.Header.Get("Content-Disposition"), "attachment", "returned incorrect Content-Disposition")
			}

			_, resp = Client.DownloadFile(fileId, true)
			CheckNoError(t, resp)

			CheckStartsWith(t, resp.Header.Get("Content-Type"), expectedContentType, "returned incorrect Content-Type")
			CheckStartsWith(t, resp.Header.Get("Content-Disposition"), "attachment", "returned incorrect Content-Disposition")
		}
	}

	data := []byte("ABC")

	t.Run("png", testHeaders(data, "test.png", "image/png", true))
	t.Run("gif", testHeaders(data, "test.gif", "image/gif", true))
	t.Run("mp4", testHeaders(data, "test.mp4", "video/mp4", true))
	t.Run("mp3", testHeaders(data, "test.mp3", "audio/mpeg", true))
	t.Run("pdf", testHeaders(data, "test.pdf", "application/pdf", false))
	t.Run("txt", testHeaders(data, "test.txt", "text/plain", false))
	t.Run("html", testHeaders(data, "test.html", "text/plain", false))
	t.Run("js", testHeaders(data, "test.js", "text/plain", false))
	t.Run("go", testHeaders(data, "test.go", "application/octet-stream", false))
	t.Run("zip", testHeaders(data, "test.zip", "application/zip", false))
	// Not every platform can recognize these
	//t.Run("exe", testHeaders(data, "test.exe", "application/x-ms", false))
	t.Run("no extension", testHeaders(data, "test", "application/octet-stream", false))
	t.Run("no extension 2", testHeaders([]byte("<html></html>"), "test", "application/octet-stream", false))
}

func TestGetFileThumbnail(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, resp := Client.UploadFile(sent, channel.Id, "test.png")
	CheckNoError(t, resp)

	fileId := fileResp.FileInfos[0].Id

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	data, resp := Client.GetFileThumbnail(fileId)
	CheckNoError(t, resp)
	require.NotEqual(t, 0, len(data), "should not be empty")

	_, resp = Client.GetFileThumbnail("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFileThumbnail(model.NewId())
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetFileThumbnail(fileId)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	Client.Login(otherUser.Email, otherUser.Password)
	_, resp = Client.GetFileThumbnail(fileId)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = th.SystemAdminClient.GetFileThumbnail(fileId)
	CheckNoError(t, resp)
}

func TestGetFileLink(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewRandomString(32) })

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, uploadResp := Client.UploadFile(data, channel.Id, "test.png")
	CheckNoError(t, uploadResp)

	fileId := fileResp.FileInfos[0].Id

	_, resp := Client.GetFileLink(fileId)
	CheckBadRequestStatus(t, resp)

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	err = th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id, th.BasicUser.Id)
	require.Nil(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = false })
	_, resp = Client.GetFileLink(fileId)
	CheckNotImplementedStatus(t, resp)

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	link, resp := Client.GetFileLink(fileId)
	CheckNoError(t, resp)
	require.NotEqual(t, "", link, "should've received public link")

	_, resp = Client.GetFileLink("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFileLink(model.NewId())
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetFileLink(fileId)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	Client.Login(otherUser.Email, otherUser.Password)
	_, resp = Client.GetFileLink(fileId)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = th.SystemAdminClient.GetFileLink(fileId)
	CheckNoError(t, resp)

	fileInfo, err := th.App.Srv.Store.FileInfo().Get(fileId)
	require.Nil(t, err)
	th.cleanupTestFile(fileInfo)
}

func TestGetFilePreview(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, resp := Client.UploadFile(sent, channel.Id, "test.png")
	CheckNoError(t, resp)
	fileId := fileResp.FileInfos[0].Id

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	data, resp := Client.GetFilePreview(fileId)
	CheckNoError(t, resp)
	require.NotEqual(t, 0, len(data), "should not be empty")

	_, resp = Client.GetFilePreview("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFilePreview(model.NewId())
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetFilePreview(fileId)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	Client.Login(otherUser.Email, otherUser.Password)
	_, resp = Client.GetFilePreview(fileId)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = th.SystemAdminClient.GetFilePreview(fileId)
	CheckNoError(t, resp)
}

func TestGetFileInfo(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	user := th.BasicUser
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, resp := Client.UploadFile(sent, channel.Id, "test.png")
	CheckNoError(t, resp)
	fileId := fileResp.FileInfos[0].Id

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	info, resp := Client.GetFileInfo(fileId)
	CheckNoError(t, resp)

	require.NoError(t, err)
	require.Equal(t, fileId, info.Id, "got incorrect file")
	require.Equal(t, user.Id, info.CreatorId, "file should be assigned to user")
	require.Equal(t, "", info.PostId, "file shouldn't have a post")
	require.Equal(t, "", info.Path, "file path shouldn't have been returned to client")
	require.Equal(t, "", info.ThumbnailPath, "file thumbnail path shouldn't have been returned to client")
	require.Equal(t, "", info.PreviewPath, "file preview path shouldn't have been returned to client")
	require.Equal(t, "image/png", info.MimeType, "mime type should've been image/png")

	_, resp = Client.GetFileInfo("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFileInfo(model.NewId())
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetFileInfo(fileId)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	Client.Login(otherUser.Email, otherUser.Password)
	_, resp = Client.GetFileInfo(fileId)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = th.SystemAdminClient.GetFileInfo(fileId)
	CheckNoError(t, resp)
}

func TestGetPublicFile(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewRandomString(32) })

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, httpResp := Client.UploadFile(data, channel.Id, "test.png")
	CheckNoError(t, httpResp)

	fileId := fileResp.FileInfos[0].Id

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	err = th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id, th.BasicUser.Id)
	require.Nil(t, err)

	info, err := th.App.Srv.Store.FileInfo().Get(fileId)
	require.Nil(t, err)
	link := th.App.GeneratePublicLink(Client.Url, info)

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	resp, err := http.Get(link)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, "failed to get image with public link")

	resp, err = http.Get(link[:strings.LastIndex(link, "?")])
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should've failed to get image with public link without hash", resp.Status)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = false })

	resp, err = http.Get(link)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotImplemented, resp.StatusCode, "should've failed to get image with disabled public link")

	// test after the salt has changed
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewRandomString(32) })

	resp, err = http.Get(link)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should've failed to get image with public link after salt changed")

	resp, err = http.Get(link)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should've failed to get image with public link after salt changed")

	fileInfo, err := th.App.Srv.Store.FileInfo().Get(fileId)
	require.Nil(t, err)
	require.Nil(t, th.cleanupTestFile(fileInfo))
	th.cleanupTestFile(info)
}
