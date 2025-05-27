// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
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
	bb, err := io.ReadAll(f)
	require.NoError(t, err)
	return bb
}

func testDoUploadFileRequest(tb testing.TB, c *model.Client4, url string, blob []byte, contentType string,
	contentLength int64,
) (*model.FileUploadResponse, *model.Response, error) {
	req, err := http.NewRequest("POST", c.APIURL+"/files"+url, bytes.NewReader(blob))
	require.NoError(tb, err)

	if contentLength != 0 {
		req.ContentLength = contentLength
	}
	req.Header.Set("Content-Type", contentType)
	if c.AuthToken != "" {
		req.Header.Set(model.HeaderAuth, c.AuthType+" "+c.AuthToken)
	}

	resp, err := c.HTTPClient.Do(req)
	require.NoError(tb, err)
	require.NotNil(tb, resp)
	defer closeBody(resp)

	if resp.StatusCode >= 300 {
		return nil, model.BuildResponse(resp), model.AppErrorFromJSON(resp.Body)
	}

	var res model.FileUploadResponse
	if jsonErr := json.NewDecoder(resp.Body).Decode(&res); jsonErr != nil {
		return nil, nil, model.NewAppError("doUploadFile", "api.unmarshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	return &res, model.BuildResponse(resp), nil
}

func testUploadFilesPost(
	tb testing.TB,
	c *model.Client4,
	channelId string,
	names []string,
	blobs [][]byte,
	clientIds []string,
	useChunked bool,
	isBookmark bool,
) (*model.FileUploadResponse, *model.Response, error) {
	// Do not check len(clientIds), leave it entirely to the user to
	// provide. The server will error out if it does not match the number
	// of files, but it's not critical here.
	require.NotEmpty(tb, names)
	require.NotEmpty(tb, blobs)
	require.Equal(tb, len(names), len(blobs))

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

		if isBookmark {
			postURL += "&bookmark=true"
		}

		fur, resp, err := testDoUploadFileRequest(tb, c, postURL, blob, ct, cl)
		if err != nil {
			return nil, resp, err
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

	return fileUploadResponse, nil, nil
}

func testUploadFilesMultipart(
	tb testing.TB,
	c *model.Client4,
	channelId string,
	names []string,
	blobs [][]byte,
	clientIds []string,
	isBookmark bool,
) (
	*model.FileUploadResponse,
	*model.Response,
	error,
) {
	// Do not check len(clientIds), leave it entirely to the user to
	// provide. The server will error out if it does not match the number
	// of files, but it's not critical here.
	require.NotEmpty(tb, names)
	require.NotEmpty(tb, blobs)
	require.Equal(tb, len(names), len(blobs))

	mwBody := &bytes.Buffer{}
	mw := multipart.NewWriter(mwBody)

	err := mw.WriteField("channel_id", channelId)
	require.NoError(tb, err)

	for i, blob := range blobs {
		ct := http.DetectContentType(blob)
		if len(clientIds) > i {
			err = mw.WriteField("client_ids", clientIds[i])
			require.NoError(tb, err)
		}

		h := textproto.MIMEHeader{}
		h.Set("Content-Disposition",
			fmt.Sprintf(`form-data; name="files"; filename="%s"`, escapeQuotes(names[i])))
		h.Set("Content-Type", ct)

		// If we error here, writing to mw, the deferred handler
		var part io.Writer
		part, err = mw.CreatePart(h)
		require.NoError(tb, err)

		_, err = io.Copy(part, bytes.NewReader(blob))
		require.NoError(tb, err)
	}

	require.NoError(tb, mw.Close())
	url := ""
	if isBookmark {
		url += "?bookmark=true"
	}
	fur, resp, err := testDoUploadFileRequest(tb, c, url, mwBody.Bytes(), mw.FormDataContentType(), -1)
	if err != nil {
		return nil, resp, err
	}

	return fur, resp, nil
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
		expectedImageMiniPreview    []bool
		setupConfig                 func(a *app.App) func(a *app.App)
		checkResponse               func(tb testing.TB, resp *model.Response)
		uploadAsBookmark            bool
	}{
		// Upload a bunch of files, mixed images and non-images
		{
			title:                    "Happy",
			names:                    []string{"test.png", "testgif.gif", "testplugin.tar.gz", "test-search.md", "test.tiff"},
			expectedCreatorId:        th.BasicUser.Id,
			expectedImageMiniPreview: []bool{true, true, false, false, true},
		},
		// Upload a bunch of files, with clientIds
		{
			title:                    "Happy client_ids",
			names:                    []string{"test.png", "testgif.gif", "testplugin.tar.gz", "test-search.md", "test.tiff"},
			clientIds:                []string{"1", "2", "3", "4", "5"},
			expectedImageMiniPreview: []bool{true, true, false, false, true},
			expectedCreatorId:        th.BasicUser.Id,
		},
		// Upload a bunch of images. testgif.gif is an animated GIF,
		// so it does not have HasPreviewImage set.
		{
			title:                    "Happy images",
			names:                    []string{"test.png", "testgif.gif"},
			expectImage:              true,
			expectedCreatorId:        th.BasicUser.Id,
			expectedImageWidths:      []int{408, 118},
			expectedImageHeights:     []int{336, 118},
			expectedImageHasPreview:  []bool{true, false},
			expectedImageMiniPreview: []bool{true, true},
		},
		{
			title:                    "Happy invalid image",
			names:                    []string{"testgif.gif"},
			blobs:                    [][]byte{fileBytes(t, "test-search.md")},
			skipPayloadValidation:    true,
			expectedCreatorId:        th.BasicUser.Id,
			expectedImageMiniPreview: []bool{false},
		},
		// Simple POST, chunked encoding
		{
			title:                    "Happy image chunked post",
			skipMultipart:            true,
			useChunkedInSimplePost:   true,
			names:                    []string{"test.png"},
			expectImage:              true,
			expectedImageWidths:      []int{408},
			expectedImageHeights:     []int{336},
			expectedImageHasPreview:  []bool{true},
			expectedCreatorId:        th.BasicUser.Id,
			expectedImageMiniPreview: []bool{true},
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
			expectedImageMiniPreview:    []bool{true},
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
			expectedImageMiniPreview:    []bool{true},
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
			expectedImageMiniPreview:    []bool{true},
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
			expectedImageMiniPreview:    []bool{true},
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
			expectedImageMiniPreview:    []bool{true},
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
			expectedImageMiniPreview:    []bool{true},
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
			expectedImageMiniPreview:    []bool{true},
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
			expectedImageMiniPreview:    []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		// 5MB+ JPEG
		{
			title:                       "Happy image thumbnail/preview 5MB+",
			names:                       []string{"orientation_test_9.jpeg"},
			expectedImageThumbnailNames: []string{"orientation_test_9_expected_thumb.jpeg"},
			expectedImagePreviewNames:   []string{"orientation_test_9_expected_preview.jpeg"},
			expectImage:                 true,
			expectedImageWidths:         []int{4000},
			expectedImageHeights:        []int{2667},
			expectedImageHasPreview:     []bool{true},
			expectedImageMiniPreview:    []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		// TIFF preview test
		{
			title:                       "Happy image thumbnail/preview 9",
			names:                       []string{"test.tiff"},
			expectedImageThumbnailNames: []string{"test_expected_tiff_thumb.jpeg"},
			expectedImagePreviewNames:   []string{"test_expected_tiff_preview.jpeg"},
			expectImage:                 true,
			expectedImageWidths:         []int{701},
			expectedImageHeights:        []int{701},
			expectedImageHasPreview:     []bool{true},
			expectedImageMiniPreview:    []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		// Extremely wide image test
		{
			title:                       "Happy image thumbnail/preview 10",
			names:                       []string{"10000x1.png"},
			expectedImageThumbnailNames: []string{"10000x1_expected_thumb.png"},
			expectedImagePreviewNames:   []string{"10000x1_expected_preview.png"},
			expectImage:                 true,
			expectedImageWidths:         []int{10000},
			expectedImageHeights:        []int{1},
			expectedImageHasPreview:     []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		// Extremely high image test
		{
			title:                       "Happy image thumbnail/preview 11",
			names:                       []string{"1x10000.png"},
			expectedImageThumbnailNames: []string{"1x10000_expected_thumb.png"},
			expectedImagePreviewNames:   []string{"1x10000_expected_preview.png"},
			expectImage:                 true,
			expectedImageWidths:         []int{1},
			expectedImageHeights:        []int{10000},
			expectedImageHasPreview:     []bool{true},
			expectedCreatorId:           th.BasicUser.Id,
		},
		// animated GIF
		{
			title:                       "Happy image thumbnail/preview 12",
			names:                       []string{"testgif.gif"},
			expectedImageThumbnailNames: []string{"testgif_expected_thumbnail.jpg"},
			expectedImagePreviewNames:   []string{"testgif_expected_preview.jpg"},
			expectImage:                 true,
			expectedImageWidths:         []int{118},
			expectedImageHeights:        []int{118},
			expectedImageHasPreview:     []bool{false},
			expectedCreatorId:           th.BasicUser.Id,
		},
		{
			title:                    "Happy admin",
			client:                   th.SystemAdminClient,
			names:                    []string{"test.png"},
			expectedImageMiniPreview: []bool{true},
			expectedCreatorId:        th.SystemAdminUser.Id,
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
			expectedImageMiniPreview: []bool{false},
			expectedCreatorId:        th.BasicUser.Id,
		},
		// Webp image test
		{
			title:                    "Webp image",
			names:                    []string{"testwebp.webp"},
			expectImage:              true,
			expectedImageWidths:      []int{128},
			expectedImageHeights:     []int{256},
			expectedImageHasPreview:  []bool{true},
			expectedCreatorId:        th.BasicUser.Id,
			expectedImageMiniPreview: []bool{true},
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
			title:                    "Error too few client_ids",
			skipSimplePost:           true,
			names:                    []string{"test.png", "testplugin.tar.gz", "test-search.md"},
			clientIds:                []string{"1", "4"},
			expectedImageMiniPreview: []bool{true, false, false},
			skipSuccessValidation:    true,
			checkResponse:            CheckBadRequestStatus,
		},
		{
			title:                    "Error invalid channel_id",
			channelId:                "../../junk",
			names:                    []string{"test.png"},
			expectedImageMiniPreview: []bool{true},
			skipSuccessValidation:    true,
			checkResponse:            CheckBadRequestStatus,
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
			checkResponse:         CheckForbiddenStatus,
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
			title:                    "File too large chunked",
			useChunkedInSimplePost:   true,
			skipMultipart:            true,
			names:                    []string{"test.png"},
			skipSuccessValidation:    true,
			checkResponse:            CheckRequestEntityTooLargeStatus,
			expectedImageMiniPreview: []bool{false},
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

		{
			title:                 "Error image too large",
			names:                 []string{"test.png"},
			skipSuccessValidation: true,
			checkResponse:         CheckBadRequestStatus,
			setupConfig: func(a *app.App) func(a *app.App) {
				maxResSize := *a.Config().FileSettings.MaxImageResolution
				a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxImageResolution = 90000 })
				return func(a *app.App) {
					a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxImageResolution = maxResSize })
				}
			},
		},
		{
			title:                       "Bookmark images",
			names:                       []string{"orientation_test_5.jpeg"},
			expectedImageThumbnailNames: []string{"orientation_test_5_expected_thumb.jpeg"},
			expectedImagePreviewNames:   []string{"orientation_test_5_expected_preview.jpeg"},
			channelId:                   channel.Id,
			expectImage:                 true,
			expectedCreatorId:           model.BookmarkFileOwner,
			expectedImageWidths:         []int{2860},
			expectedImageHeights:        []int{1578},
			expectedImageHasPreview:     []bool{true},
			expectedImageMiniPreview:    []bool{true},
			uploadAsBookmark:            true,
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
				var err error
				if useMultipart {
					fileResp, resp, err = testUploadFilesMultipart(t, client, channelId, tc.names, blobs, tc.clientIds, tc.uploadAsBookmark)
				} else {
					fileResp, resp, err = testUploadFilesPost(t, client, channelId, tc.names, blobs, tc.clientIds, tc.useChunkedInSimplePost, tc.uploadAsBookmark)
				}

				if tc.checkResponse != nil {
					tc.checkResponse(t, resp)
				} else {
					require.NoError(t, err)
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
					if len(tc.expectedImageMiniPreview) == len(fileResp.FileInfos) {
						assert.Equal(t, ri.MiniPreview != nil, tc.expectedImageMiniPreview[i], "File: %s mini preview state unexpected", tc.names[i])
					}
					if len(tc.clientIds) > i {
						assert.True(t, len(fileResp.ClientIds) == len(tc.clientIds),
							fmt.Sprintf("Wrong number of clientIds returned, expected %v, got %v", len(tc.clientIds), len(fileResp.ClientIds)))
						assert.Equal(t, fileResp.ClientIds[i], tc.clientIds[i],
							fmt.Sprintf("Wrong clientId returned, expected %v, got %v", tc.clientIds[i], fileResp.ClientIds[i]))
					}

					dbInfo, err := th.App.Srv().Store().FileInfo().Get(ri.Id)
					require.NoError(t, err)
					assert.Equal(t, dbInfo.Id, ri.Id, "File id from response should match one stored in database")
					assert.Equal(t, dbInfo.CreatorId, tc.expectedCreatorId, "F ile should be assigned to user")
					assert.Equal(t, dbInfo.PostId, "", "File shouldn't have a post")
					assert.NotEqual(t, dbInfo.Path, "", "File path should be set in database")
					_, fname := filepath.Split(dbInfo.Path)
					ext := filepath.Ext(fname)
					name := fname[:len(fname)-len(ext)]
					expectedDir := fmt.Sprintf("%v/teams/%v/channels/%v/users/%s/%s", date, FileTeamId, channel.Id, ri.CreatorId, ri.Id)
					if tc.uploadAsBookmark {
						expectedDir = fmt.Sprintf("%v/teams/%v/channels/%v/%s", model.BookmarkFileOwner, FileTeamId, channel.Id, ri.Id)
					}
					expectedPath := fmt.Sprintf("%s/%s", expectedDir, fname)
					assert.Equal(t, dbInfo.Path, expectedPath,
						fmt.Sprintf("File %v saved to:%q, expected:%q", dbInfo.Name, dbInfo.Path, expectedPath))

					if tc.expectImage {
						// We convert all other image types to jpeg, except pngs.
						if ext != ".png" {
							ext = ".jpg"
						}
						expectedThumbnailPath := fmt.Sprintf("%s/%s_thumb%s", expectedDir, name, ext)
						expectedPreviewPath := fmt.Sprintf("%s/%s_preview%s", expectedDir, name, ext)
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
						compare := func(get func(context.Context, string) ([]byte, *model.Response, error), name string) {
							var data []byte
							data, _, err = get(context.Background(), ri.Id)
							require.NoError(t, err)

							var expected []byte
							expected, err = os.ReadFile(filepath.Join(testDir, name))
							require.NoError(t, err)
							if !bytes.Equal(data, expected) {
								var tf *os.File
								tf, err = os.CreateTemp("", fmt.Sprintf("test_%v_*_%s", i, name))
								require.NoError(t, err)
								defer tf.Close()
								_, err = io.Copy(tf, bytes.NewReader(data))
								require.NoError(t, err)
								t.Errorf("Actual data mismatched %s, written to %q - expected %d bytes, got %d.", name, tf.Name(), len(expected), len(data))
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

					err = th.cleanupTestFile(dbInfo)
					require.NoError(t, err)
				}
			})
		}
	}
}

func TestGetFile(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, _, err := client.UploadFile(context.Background(), sent, channel.Id, "test.png")
	require.NoError(t, err)

	fileId := fileResp.FileInfos[0].Id

	data, _, err := client.GetFile(context.Background(), fileId)
	require.NoError(t, err)
	require.NotEqual(t, 0, len(data), "should not be empty")

	for i := range data {
		require.Equal(t, sent[i], data[i], "received file didn't match sent one")
	}

	_, resp, err := client.GetFile(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetFile(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetFile(context.Background(), fileId)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetFileAsSystemAdmin(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	t.Run("public channel without membership", func(t *testing.T) {
		publicChannel := th.CreateChannelWithClient(th.Client, model.ChannelTypeOpen)
		fileResp, _, err := th.Client.UploadFile(context.Background(), sent, publicChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFile(context.Background(), fileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("public channel with membership", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel()
		th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
		th.AddUserToChannel(th.SystemAdminUser, publicChannel)
		fileResp, _, err := th.Client.UploadFile(context.Background(), sent, publicChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFile(context.Background(), fileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("private channel without membership", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
		privateFileResp, _, err := th.Client.UploadFile(context.Background(), sent, privateChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFile(context.Background(), privateFileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("private channel with membership", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
		th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
		th.AddUserToChannel(th.SystemAdminUser, privateChannel)
		fileResp, _, err := th.Client.UploadFile(context.Background(), sent, privateChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFile(context.Background(), fileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("direct message without membership", func(t *testing.T) {
		dmChannel := th.CreateDmChannel(th.BasicUser2)
		dmFileResp, _, err := th.Client.UploadFile(context.Background(), sent, dmChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFile(context.Background(), dmFileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("direct message with membership", func(t *testing.T) {
		dmChannel, _, err := th.SystemAdminClient.CreateDirectChannel(context.Background(), th.SystemAdminUser.Id, th.BasicUser.Id)
		require.NoError(t, err)
		fileResp, _, err := th.Client.UploadFile(context.Background(), sent, dmChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFile(context.Background(), fileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("group message without membership", func(t *testing.T) {
		user3 := th.CreateUser()
		gmChannel, _, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id, user3.Id})
		require.NoError(t, err)
		gmFileResp, _, err := th.Client.UploadFile(context.Background(), sent, gmChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFile(context.Background(), gmFileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("group message with membership", func(t *testing.T) {
		user3 := th.CreateUser()
		gmChannel, _, err := th.SystemAdminClient.CreateGroupChannel(context.Background(), []string{th.SystemAdminUser.Id, th.BasicUser.Id, user3.Id})
		require.NoError(t, err)
		fileResp, _, err := th.Client.UploadFile(context.Background(), sent, gmChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFile(context.Background(), fileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})
}

func TestGetFileHeaders(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	CheckStartsWith := func(tb testing.TB, value, prefix, message string) {
		tb.Helper()

		require.True(tb, strings.HasPrefix(value, prefix), fmt.Sprintf("%s: %s", message, value))
	}

	testHeaders := func(data []byte, filename string, expectedContentType string, getInline bool, loadFile bool) func(*testing.T) {
		return func(t *testing.T) {
			if loadFile {
				var err error
				data, err = testutils.ReadTestFile(filename)
				require.NoError(t, err)
			}

			fileResp, _, err := client.UploadFile(context.Background(), data, channel.Id, filename)
			require.NoError(t, err)

			fileId := fileResp.FileInfos[0].Id

			_, resp, err := client.GetFile(context.Background(), fileId)
			require.NoError(t, err)

			CheckStartsWith(t, resp.Header.Get("Content-Type"), expectedContentType, "returned incorrect Content-Type")

			if getInline {
				CheckStartsWith(t, resp.Header.Get("Content-Disposition"), "inline", "returned incorrect Content-Disposition")
			} else {
				CheckStartsWith(t, resp.Header.Get("Content-Disposition"), "attachment", "returned incorrect Content-Disposition")
			}

			_, resp, err = client.DownloadFile(context.Background(), fileId, true)
			require.NoError(t, err)

			CheckStartsWith(t, resp.Header.Get("Content-Type"), expectedContentType, "returned incorrect Content-Type")
			CheckStartsWith(t, resp.Header.Get("Content-Disposition"), "attachment", "returned incorrect Content-Disposition")
		}
	}

	data := []byte("ABC")

	t.Run("png", testHeaders(data, "test.png", "image/png", true, true))
	t.Run("gif", testHeaders(data, "testgif.gif", "image/gif", true, true))
	t.Run("mp4", testHeaders(data, "test.mp4", "video/mp4", true, false))
	t.Run("mp3", testHeaders(data, "test.mp3", "audio/mpeg", true, false))
	t.Run("pdf", testHeaders(data, "test.pdf", "application/pdf", false, false))
	t.Run("txt", testHeaders(data, "test.txt", "text/plain", false, false))
	t.Run("html", testHeaders(data, "test.html", "text/plain", false, false))
	t.Run("js", testHeaders(data, "test.js", "text/plain", false, false))
	// *.go are categorized differently by different platforms
	// t.Run("go", testHeaders(data, "test.go", "text/x-go; charset=utf-8", false, false))
	t.Run("zip", testHeaders(data, "test.zip", "application/zip", false, false))
	// Not every platform can recognize these
	// t.Run("exe", testHeaders(data, "test.exe", "application/x-ms", false))
	t.Run("no extension", testHeaders(data, "test", "application/octet-stream", false, false))
	t.Run("no extension 2", testHeaders([]byte("<html></html>"), "test", "application/octet-stream", false, false))
}

func TestGetFileThumbnail(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, _, err := client.UploadFile(context.Background(), sent, channel.Id, "test.png")
	require.NoError(t, err)

	fileId := fileResp.FileInfos[0].Id

	data, _, err := client.GetFileThumbnail(context.Background(), fileId)
	require.NoError(t, err)
	require.NotEqual(t, 0, len(data), "should not be empty")

	_, resp, err := client.GetFileThumbnail(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetFileThumbnail(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetFileThumbnail(context.Background(), fileId)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	_, _, err = client.Login(context.Background(), otherUser.Email, otherUser.Password)
	require.NoError(t, err)
	_, resp, err = client.GetFileThumbnail(context.Background(), fileId)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.GetFileThumbnail(context.Background(), fileId)
	require.NoError(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestGetFileThumbnailAsSystemAdmin(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	t.Run("public channel without membership", func(t *testing.T) {
		th.LinkUserToTeam(th.BasicUser, th.BasicTeam)
		publicChannel := th.CreateChannelWithClient(th.Client, model.ChannelTypeOpen)
		fileResp, _, err := th.Client.UploadFile(context.Background(), sent, publicChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFileThumbnail(context.Background(), fileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("public channel with membership", func(t *testing.T) {
		th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
		publicChannel := th.CreateChannelWithClient(th.Client, model.ChannelTypeOpen)
		th.AddUserToChannel(th.SystemAdminUser, publicChannel)
		fileResp, _, err := th.Client.UploadFile(context.Background(), sent, publicChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFileThumbnail(context.Background(), fileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("private channel without membership", func(t *testing.T) {
		th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
		privateChannel := th.CreatePrivateChannel()
		privateFileResp, _, err := th.Client.UploadFile(context.Background(), sent, privateChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFileThumbnail(context.Background(), privateFileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("private channel with membership", func(t *testing.T) {
		th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
		privateChannel := th.CreatePrivateChannel()
		th.AddUserToChannel(th.SystemAdminUser, privateChannel)
		privateFileResp, _, err := th.Client.UploadFile(context.Background(), sent, privateChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFileThumbnail(context.Background(), privateFileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("direct message without membership", func(t *testing.T) {
		dmChannel := th.CreateDmChannel(th.BasicUser2)
		dmFileResp, _, err := th.Client.UploadFile(context.Background(), sent, dmChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFileThumbnail(context.Background(), dmFileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("direct message with membership", func(t *testing.T) {
		dmChannel, _, err := th.SystemAdminClient.CreateDirectChannel(context.Background(), th.SystemAdminUser.Id, th.BasicUser.Id)
		require.NoError(t, err)
		dmFileResp, _, err := th.Client.UploadFile(context.Background(), sent, dmChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFileThumbnail(context.Background(), dmFileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("group message without membership", func(t *testing.T) {
		user3 := th.CreateUser()
		gmChannel, _, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id, user3.Id})
		require.NoError(t, err)
		gmFileResp, _, err := th.Client.UploadFile(context.Background(), sent, gmChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFileThumbnail(context.Background(), gmFileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})

	t.Run("group message with membership", func(t *testing.T) {
		user3 := th.CreateUser()
		gmChannel, _, err := th.SystemAdminClient.CreateGroupChannel(context.Background(), []string{th.SystemAdminUser.Id, th.BasicUser.Id, user3.Id})
		require.NoError(t, err)
		gmFileResp, _, err := th.Client.UploadFile(context.Background(), sent, gmChannel.Id, "test.png")
		require.NoError(t, err)
		_, _, err = th.SystemAdminClient.GetFileThumbnail(context.Background(), gmFileResp.FileInfos[0].Id)
		require.NoError(t, err)
	})
}

func TestGetFileLink(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewRandomString(32) })

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, _, err := client.UploadFile(context.Background(), data, channel.Id, "test.png")
	require.NoError(t, err)

	fileId := fileResp.FileInfos[0].Id

	_, resp, err := client.GetFileLink(context.Background(), fileId)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	err = th.App.Srv().Store().FileInfo().AttachToPost(th.Context, fileId, th.BasicPost.Id, th.BasicPost.ChannelId, th.BasicUser.Id)
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = false })
	_, resp, err = client.GetFileLink(context.Background(), fileId)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	link, _, err := client.GetFileLink(context.Background(), fileId)
	require.NoError(t, err)
	require.NotEqual(t, "", link, "should've received public link")

	_, resp, err = client.GetFileLink(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetFileLink(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetFileLink(context.Background(), fileId)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	_, _, err = client.Login(context.Background(), otherUser.Email, otherUser.Password)
	require.NoError(t, err)
	_, resp, err = client.GetFileLink(context.Background(), fileId)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.GetFileLink(context.Background(), fileId)
	require.NoError(t, err)

	fileInfo, err := th.App.Srv().Store().FileInfo().Get(fileId)
	require.NoError(t, err)
	err = th.cleanupTestFile(fileInfo)
	require.NoError(t, err)
}

func TestGetFilePreview(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, _, err := client.UploadFile(context.Background(), sent, channel.Id, "test.png")
	require.NoError(t, err)
	fileId := fileResp.FileInfos[0].Id

	data, _, err := client.GetFilePreview(context.Background(), fileId)
	require.NoError(t, err)
	require.NotEqual(t, 0, len(data), "should not be empty")

	_, resp, err := client.GetFilePreview(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetFilePreview(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetFilePreview(context.Background(), fileId)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	_, _, err = client.Login(context.Background(), otherUser.Email, otherUser.Password)
	require.NoError(t, err)
	_, resp, err = client.GetFilePreview(context.Background(), fileId)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.GetFilePreview(context.Background(), fileId)
	require.NoError(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestGetFileInfo(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	user := th.BasicUser
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	sent, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, _, err := client.UploadFile(context.Background(), sent, channel.Id, "test.png")
	require.NoError(t, err)
	fileId := fileResp.FileInfos[0].Id

	info, _, err := client.GetFileInfo(context.Background(), fileId)
	require.NoError(t, err)

	require.Equal(t, fileId, info.Id, "got incorrect file")
	require.Equal(t, user.Id, info.CreatorId, "file should be assigned to user")
	require.Equal(t, "", info.PostId, "file shouldn't have a post")
	require.Equal(t, "", info.Path, "file path shouldn't have been returned to client")
	require.Equal(t, "", info.ThumbnailPath, "file thumbnail path shouldn't have been returned to client")
	require.Equal(t, "", info.PreviewPath, "file preview path shouldn't have been returned to client")
	require.Equal(t, "image/png", info.MimeType, "mime type should've been image/png")

	_, resp, err := client.GetFileInfo(context.Background(), "junk")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.GetFileInfo(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetFileInfo(context.Background(), fileId)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	_, _, err = client.Login(context.Background(), otherUser.Email, otherUser.Password)
	require.NoError(t, err)
	_, resp, err = client.GetFileInfo(context.Background(), fileId)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = th.SystemAdminClient.GetFileInfo(context.Background(), fileId)
	require.NoError(t, err)
	CheckForbiddenStatus(t, resp)
}

func TestGetPublicFile(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client
	channel := th.BasicChannel

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewRandomString(32) })

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	fileResp, _, err := client.UploadFile(context.Background(), data, channel.Id, "test.png")
	require.NoError(t, err)

	fileId := fileResp.FileInfos[0].Id

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	err = th.App.Srv().Store().FileInfo().AttachToPost(th.Context, fileId, th.BasicPost.Id, th.BasicPost.ChannelId, th.BasicUser.Id)
	require.NoError(t, err)

	info, err := th.App.Srv().Store().FileInfo().Get(fileId)
	require.NoError(t, err)
	link := th.App.GeneratePublicLink(client.URL, info)

	resp, err := http.Get(link)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, "failed to get image with public link")

	resp, err = http.Head(link)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, "failed to respond to HEAD request")

	resp, err = http.Get(link[:strings.LastIndex(link, "?")])
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should've failed to get image with public link without hash", resp.Status)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = false })

	resp, err = http.Get(link)
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode, "should've failed to get image with disabled public link")

	// test after the salt has changed
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewRandomString(32) })

	resp, err = http.Get(link)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should've failed to get image with public link after salt changed")

	resp, err = http.Get(link)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should've failed to get image with public link after salt changed")

	err = th.cleanupTestFile(info)
	require.NoError(t, err)
	link = th.App.GeneratePublicLink(client.URL, info)
	resp, err = http.Get(link)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode, "should've failed to get file after it is deleted")
}

func TestSearchFilesInTeam(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	experimentalViewArchivedChannels := *th.App.Config().TeamSettings.ExperimentalViewArchivedChannels
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.TeamSettings.ExperimentalViewArchivedChannels = &experimentalViewArchivedChannels
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.ExperimentalViewArchivedChannels = true
	})
	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	th.LoginBasic()
	client := th.Client

	filename := "search for fileInfo1"
	fileInfo1, appErr := th.App.UploadFile(th.Context, data, th.BasicChannel.Id, filename)
	require.Nil(t, appErr)
	err = th.App.Srv().Store().FileInfo().AttachToPost(th.Context, fileInfo1.Id, th.BasicPost.Id, th.BasicPost.ChannelId, th.BasicUser.Id)
	require.NoError(t, err)

	filename = "search for fileInfo2"
	fileInfo2, appErr := th.App.UploadFile(th.Context, data, th.BasicChannel.Id, filename)
	require.Nil(t, appErr)
	err = th.App.Srv().Store().FileInfo().AttachToPost(th.Context, fileInfo2.Id, th.BasicPost.Id, th.BasicPost.ChannelId, th.BasicUser.Id)
	require.NoError(t, err)

	filename = "tagged search for fileInfo3"
	fileInfo3, appErr := th.App.UploadFile(th.Context, data, th.BasicChannel.Id, filename)
	require.Nil(t, appErr)
	err = th.App.Srv().Store().FileInfo().AttachToPost(th.Context, fileInfo3.Id, th.BasicPost.Id, th.BasicPost.ChannelId, th.BasicUser.Id)
	require.NoError(t, err)

	filename = "tagged for fileInfo4"
	fileInfo4, appErr := th.App.UploadFile(th.Context, data, th.BasicChannel.Id, filename)
	require.Nil(t, appErr)
	err = th.App.Srv().Store().FileInfo().AttachToPost(th.Context, fileInfo4.Id, th.BasicPost.Id, th.BasicPost.ChannelId, th.BasicUser.Id)
	require.NoError(t, err)

	archivedChannel := th.CreatePublicChannel()
	fileInfo5, appErr := th.App.UploadFile(th.Context, data, archivedChannel.Id, "tagged for fileInfo3")
	require.Nil(t, appErr)
	post := &model.Post{ChannelId: archivedChannel.Id, Message: model.NewId() + "a"}
	rpost, _, err := client.CreatePost(context.Background(), post)
	require.NoError(t, err)
	err = th.App.Srv().Store().FileInfo().AttachToPost(th.Context, fileInfo5.Id, rpost.Id, rpost.ChannelId, th.BasicUser.Id)
	require.NoError(t, err)
	_, err = th.Client.DeleteChannel(context.Background(), archivedChannel.Id)
	require.NoError(t, err)

	terms := "search"
	isOrSearch := false
	timezoneOffset := 5
	searchParams := model.SearchParameter{
		Terms:          &terms,
		IsOrSearch:     &isOrSearch,
		TimeZoneOffset: &timezoneOffset,
	}
	fileInfos, _, err := client.SearchFilesWithParams(context.Background(), th.BasicTeam.Id, &searchParams)
	require.NoError(t, err)
	require.Len(t, fileInfos.Order, 3, "wrong search")

	terms = "search"
	page := 0
	perPage := 2
	searchParams = model.SearchParameter{
		Terms:          &terms,
		IsOrSearch:     &isOrSearch,
		TimeZoneOffset: &timezoneOffset,
		Page:           &page,
		PerPage:        &perPage,
	}
	fileInfos2, _, err := client.SearchFilesWithParams(context.Background(), th.BasicTeam.Id, &searchParams)
	require.NoError(t, err)
	// We don't support paging for DB search yet, modify this when we do.
	require.Len(t, fileInfos2.Order, 3, "Wrong number of fileInfos")
	assert.Equal(t, fileInfos.Order[0], fileInfos2.Order[0])
	assert.Equal(t, fileInfos.Order[1], fileInfos2.Order[1])

	page = 1
	searchParams = model.SearchParameter{
		Terms:          &terms,
		IsOrSearch:     &isOrSearch,
		TimeZoneOffset: &timezoneOffset,
		Page:           &page,
		PerPage:        &perPage,
	}
	fileInfos2, _, err = client.SearchFilesWithParams(context.Background(), th.BasicTeam.Id, &searchParams)
	require.NoError(t, err)
	// We don't support paging for DB search yet, modify this when we do.
	require.Empty(t, fileInfos2.Order, "Wrong number of fileInfos")

	fileInfos, _, err = client.SearchFiles(context.Background(), th.BasicTeam.Id, "search", false)
	require.NoError(t, err)
	require.Len(t, fileInfos.Order, 3, "wrong search")

	fileInfos, _, err = client.SearchFiles(context.Background(), th.BasicTeam.Id, "fileInfo2", false)
	require.NoError(t, err)
	require.Len(t, fileInfos.Order, 1, "wrong number of fileInfos")
	require.Equal(t, fileInfo2.Id, fileInfos.Order[0], "wrong search")

	terms = "tagged"
	includeDeletedChannels := true
	searchParams = model.SearchParameter{
		Terms:                  &terms,
		IsOrSearch:             &isOrSearch,
		TimeZoneOffset:         &timezoneOffset,
		IncludeDeletedChannels: &includeDeletedChannels,
	}
	fileInfos, _, err = client.SearchFilesWithParams(context.Background(), th.BasicTeam.Id, &searchParams)
	require.NoError(t, err)
	require.Len(t, fileInfos.Order, 3, "wrong search")

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.ExperimentalViewArchivedChannels = false
	})

	fileInfos, _, err = client.SearchFilesWithParams(context.Background(), th.BasicTeam.Id, &searchParams)
	require.NoError(t, err)
	require.Len(t, fileInfos.Order, 2, "wrong search")

	fileInfos, _, _ = client.SearchFiles(context.Background(), th.BasicTeam.Id, "*", false)
	require.Empty(t, fileInfos.Order, "searching for just * shouldn't return any results")

	fileInfos, _, err = client.SearchFiles(context.Background(), th.BasicTeam.Id, "fileInfo1 fileInfo2", true)
	require.NoError(t, err)
	require.Len(t, fileInfos.Order, 2, "wrong search results")

	_, resp, err := client.SearchFiles(context.Background(), "junk", "#sgtitlereview", false)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, resp, err = client.SearchFiles(context.Background(), model.NewId(), "#sgtitlereview", false)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = client.SearchFiles(context.Background(), th.BasicTeam.Id, "", false)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.SearchFiles(context.Background(), th.BasicTeam.Id, "#sgtitlereview", false)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestSearchFilesAcrossTeams(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	experimentalViewArchivedChannels := *th.App.Config().TeamSettings.ExperimentalViewArchivedChannels
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.TeamSettings.ExperimentalViewArchivedChannels = &experimentalViewArchivedChannels
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.TeamSettings.ExperimentalViewArchivedChannels = true
	})
	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	th.LoginBasic()
	client := th.Client

	var teams [2]*model.Team
	var channels [2]*model.Channel
	for i := 0; i < 2; i++ {
		teams[i] = th.CreateTeam()
		channels[i] = th.CreateChannelWithClientAndTeam(th.Client, model.ChannelTypeOpen, teams[i].Id)

		th.LinkUserToTeam(th.BasicUser, teams[i])
		th.AddUserToChannel(th.BasicUser, channels[i])

		filename := "search for fileInfo"
		fileInfo, appErr := th.App.UploadFile(th.Context, data, th.BasicChannel.Id, filename)
		require.Nil(t, appErr)

		th.CreatePostInChannelWithFiles(channels[i], fileInfo)
	}

	terms := "search"

	// BasicUser should have access to all the files
	fileInfos, _, err := client.SearchFilesAcrossTeams(context.Background(), terms, false)
	require.NoError(t, err)
	require.Len(t, fileInfos.Order, 2, "wrong search")

	// a new user that only belongs to the first team should only get one result
	newUser := th.CreateUser()
	th.LinkUserToTeam(newUser, teams[0])
	th.AddUserToChannel(newUser, channels[0])
	th.UnlinkUserFromTeam(th.BasicUser, teams[1])

	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)
	_, _, err = th.Client.Login(context.Background(), newUser.Email, newUser.Password)
	require.NoError(t, err)

	fileInfos, _, err = client.SearchFilesAcrossTeams(context.Background(), terms, false)
	require.NoError(t, err)
	require.Len(t, fileInfos.Order, 1, "wrong search")
	require.Equal(t, fileInfos.FileInfos[fileInfos.Order[0]].ChannelId, channels[0].Id, "wrong search")
}
