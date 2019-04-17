// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils/fileutils"
	"github.com/mattermost/mattermost-server/utils/testutils"
)

var testDir = ""

func init() {
	testDir, _ = fileutils.FindDir("tests")
}

func checkCond(tb testing.TB, cond bool, text string) {
	if !cond {
		tb.Error(text)
	}
}

func checkEq(tb testing.TB, v1, v2 interface{}, text string) {
	checkCond(tb, fmt.Sprintf("%+v", v1) == fmt.Sprintf("%+v", v2), text)
}

func checkNeq(tb testing.TB, v1, v2 interface{}, text string) {
	checkCond(tb, fmt.Sprintf("%+v", v1) != fmt.Sprintf("%+v", v2), text)
}

type zeroReader struct {
	limit, read int
}

func (z *zeroReader) Read(b []byte) (int, error) {
	for i := range b {
		if z.read == z.limit {
			return i, io.EOF
		}
		b[i] = 0
		z.read++
	}

	return len(b), nil
}

// File Section
var quoteEscaper = strings.NewReplacer("\\", "\\\\", `"`, "\\\"")

func escapeQuotes(s string) string {
	return quoteEscaper.Replace(s)
}

type UploadOpener func() (io.ReadCloser, int64, error)

func NewUploadOpenerReader(in io.Reader) UploadOpener {
	return func() (io.ReadCloser, int64, error) {
		rc, ok := in.(io.ReadCloser)
		if ok {
			return rc, -1, nil
		} else {
			return ioutil.NopCloser(in), -1, nil
		}
	}
}

func NewUploadOpenerFile(path string) UploadOpener {
	return func() (io.ReadCloser, int64, error) {
		fi, err := os.Stat(path)
		if err != nil {
			return nil, 0, err
		}
		f, err := os.Open(path)
		if err != nil {
			return nil, 0, err
		}
		return f, fi.Size(), nil
	}
}

// testUploadFile and testUploadFiles have been "staged" here, eventually they
// should move back to being model.Client4 methods, once the specifics of the
// public API are sorted out.
func testUploadFile(c *model.Client4, url string, body io.Reader, contentType string,
	contentLength int64) (*model.FileUploadResponse, *model.Response) {
	rq, _ := http.NewRequest("POST", c.ApiUrl+c.GetFilesRoute()+url, body)
	if contentLength != 0 {
		rq.ContentLength = contentLength
	}
	rq.Header.Set("Content-Type", contentType)

	if len(c.AuthToken) > 0 {
		rq.Header.Set(model.HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	rp, err := c.HttpClient.Do(rq)
	if err != nil || rp == nil {
		return nil, model.BuildErrorResponse(rp, model.NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0))
	}
	defer closeBody(rp)

	if rp.StatusCode >= 300 {
		return nil, model.BuildErrorResponse(rp, model.AppErrorFromJson(rp.Body))
	}

	return model.FileUploadResponseFromJson(rp.Body), model.BuildResponse(rp)
}

func testUploadFiles(
	c *model.Client4,
	channelId string,
	names []string,
	openers []UploadOpener,
	contentLengths []int64,
	clientIds []string,
	useMultipart,
	useChunkedInSimplePost bool,
) (
	fileUploadResponse *model.FileUploadResponse,
	response *model.Response,
) {
	// Do not check len(clientIds), leave it entirely to the user to
	// provide. The server will error out if it does not match the number
	// of files, but it's not critical here.
	if len(names) == 0 || len(openers) == 0 || len(names) != len(openers) {
		return nil, &model.Response{
			Error: model.NewAppError("testUploadFiles",
				"model.client.upload_post_attachment.file.app_error",
				nil, "Empty or mismatched file data", http.StatusBadRequest),
		}
	}

	// emergencyResponse is a convenience wrapper to return an error response
	emergencyResponse := func(err error, errCode string) *model.Response {
		return &model.Response{
			Error: model.NewAppError("testUploadFiles",
				"model.client."+errCode+".app_error",
				nil, err.Error(), http.StatusBadRequest),
		}
	}

	// For multipart, start writing the request as a goroutine, and pipe
	// multipart.Writer into it, otherwise generate a new request each
	// time.
	pipeReader, pipeWriter := io.Pipe()
	mw := multipart.NewWriter(pipeWriter)

	if useMultipart {
		fileUploadResponseChannel := make(chan *model.FileUploadResponse)
		responseChannel := make(chan *model.Response)
		closedMultipart := false

		go func() {
			fur, resp := testUploadFile(c, "", pipeReader, mw.FormDataContentType(), -1)
			responseChannel <- resp
			fileUploadResponseChannel <- fur
		}()

		defer func() {
			for {
				select {
				// Premature response, before the entire
				// multipart was sent
				case response = <-responseChannel:
					// Guaranteed to be there
					fileUploadResponse = <-fileUploadResponseChannel
					if !closedMultipart {
						_ = mw.Close()
						_ = pipeWriter.Close()
						closedMultipart = true
					}
					return

				// Normal response, after the multipart was sent.
				default:
					if !closedMultipart {
						err := mw.Close()
						if err != nil {
							fileUploadResponse = nil
							response = emergencyResponse(err, "upload_post_attachment.writer")
							return
						}
						err = pipeWriter.Close()
						if err != nil {
							fileUploadResponse = nil
							response = emergencyResponse(err, "upload_post_attachment.writer")
							return
						}
						closedMultipart = true
					}
				}
			}
		}()

		err := mw.WriteField("channel_id", channelId)
		if err != nil {
			return nil, emergencyResponse(err, "upload_post_attachment.channel_id")
		}
	} else {
		fileUploadResponse = &model.FileUploadResponse{}
	}

	data := make([]byte, 512)

	upload := func(i int, f io.ReadCloser) *model.Response {
		var cl int64
		defer f.Close()

		if len(contentLengths) > i {
			cl = contentLengths[i]
		}

		n, err := f.Read(data)
		if err != nil && err != io.EOF {
			return emergencyResponse(err, "upload_post_attachment")
		}
		ct := http.DetectContentType(data[:n])
		reader := io.MultiReader(bytes.NewReader(data[:n]), f)

		if useMultipart {
			if len(clientIds) > i {
				err := mw.WriteField("client_ids", clientIds[i])
				if err != nil {
					return emergencyResponse(err, "upload_post_attachment.file")
				}
			}

			h := make(textproto.MIMEHeader)
			h.Set("Content-Disposition",
				fmt.Sprintf(`form-data; name="files"; filename="%s"`, escapeQuotes(names[i])))
			h.Set("Content-Type", ct)

			// If we error here, writing to mw, the deferred handler
			part, err := mw.CreatePart(h)
			if err != nil {
				return emergencyResponse(err, "upload_post_attachment.writer")
			}

			_, err = io.Copy(part, reader)
			if err != nil {
				return emergencyResponse(err, "upload_post_attachment.writer")
			}
		} else {
			postURL := fmt.Sprintf("?channel_id=%v", url.QueryEscape(channelId)) +
				fmt.Sprintf("&filename=%v", url.QueryEscape(names[i]))
			if len(clientIds) > i {
				postURL += fmt.Sprintf("&client_id=%v", url.QueryEscape(clientIds[i]))
			}
			if useChunkedInSimplePost {
				cl = -1
			}
			fur, resp := testUploadFile(c, postURL, reader, ct, cl)
			if resp.Error != nil {
				return resp
			}
			fileUploadResponse.FileInfos = append(fileUploadResponse.FileInfos, fur.FileInfos[0])
			if len(clientIds) > 0 {
				if len(fur.ClientIds) > 0 {
					fileUploadResponse.ClientIds = append(fileUploadResponse.ClientIds, fur.ClientIds[0])
				} else {
					fileUploadResponse.ClientIds = append(fileUploadResponse.ClientIds, "")
				}
			}
			response = resp
		}

		return nil
	}

	for i, open := range openers {
		f, _, err := open()
		if err != nil {
			return nil, emergencyResponse(err, "upload_post_attachment")
		}

		resp := upload(i, f)
		if resp != nil && resp.Error != nil {
			return nil, resp
		}
	}

	// In case of a simple POST, the return values have been set by upload(),
	// otherwise we finished writing the multipart, and the return values will
	// be set in defer
	return fileUploadResponse, response
}

func TestUploadFiles(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	channel := th.BasicChannel
	date := time.Now().Format("20060102")

	// Get better error messages
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableDeveloper = true })

	op := func(name string) UploadOpener {
		return NewUploadOpenerFile(filepath.Join(testDir, name))
	}

	tests := []struct {
		title     string
		client    *model.Client4
		openers   []UploadOpener
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
			openers:               []UploadOpener{NewUploadOpenerFile(filepath.Join(testDir, "test-search.md"))},
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
			names:                  []string{"50Mb-stream"},
			openers:                []UploadOpener{NewUploadOpenerReader(&zeroReader{limit: 50 * 1024 * 1024})},
			setupConfig: func(a *app.App) func(a *app.App) {
				maxFileSize := *a.Config().FileSettings.MaxFileSize
				a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize = 50 * 1024 * 1024 })
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
			names:                 []string{"50Mb-stream"},
			openers:               []UploadOpener{NewUploadOpenerReader(&zeroReader{limit: 50 * 1024 * 1024})},
			skipSuccessValidation: true,
			checkResponse:         CheckRequestEntityTooLargeStatus,
			setupConfig: func(a *app.App) func(a *app.App) {
				maxFileSize := *a.Config().FileSettings.MaxFileSize
				a.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize = 100 * 1024 })
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

			// Set the default values and title
			client := th.Client
			if tc.client != nil {
				client = tc.client
			}
			channelId := channel.Id
			if tc.channelId != "" {
				channelId = tc.channelId
			}
			if tc.checkResponse == nil {
				tc.checkResponse = CheckNoError
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

			// Apply any necessary config changes
			var restoreConfig func(a *app.App)
			if tc.setupConfig != nil {
				restoreConfig = tc.setupConfig(th.App)
			}

			t.Run(title, func(t *testing.T) {
				if len(tc.openers) == 0 {
					for _, name := range tc.names {
						tc.openers = append(tc.openers, op(name))
					}
				}
				fileResp, resp := testUploadFiles(client, channelId, tc.names,
					tc.openers, nil, tc.clientIds, useMultipart,
					tc.useChunkedInSimplePost)
				tc.checkResponse(t, resp)
				if tc.skipSuccessValidation {
					return
				}

				if fileResp == nil || len(fileResp.FileInfos) == 0 || len(fileResp.FileInfos) != len(tc.names) {
					t.Fatal("Empty or mismatched actual or expected FileInfos")
				}

				for i, ri := range fileResp.FileInfos {
					// The returned file info from the upload call will be missing some fields that will be stored in the database
					checkEq(t, ri.CreatorId, tc.expectedCreatorId, "File should be assigned to user")
					checkEq(t, ri.PostId, "", "File shouldn't have a post Id")
					checkEq(t, ri.Path, "", "File path should not be set on returned info")
					checkEq(t, ri.ThumbnailPath, "", "File thumbnail path should not be set on returned info")
					checkEq(t, ri.PreviewPath, "", "File preview path should not be set on returned info")
					if len(tc.clientIds) > i {
						checkCond(t, len(fileResp.ClientIds) == len(tc.clientIds),
							fmt.Sprintf("Wrong number of clientIds returned, expected %v, got %v", len(tc.clientIds), len(fileResp.ClientIds)))
						checkEq(t, fileResp.ClientIds[i], tc.clientIds[i],
							fmt.Sprintf("Wrong clientId returned, expected %v, got %v", tc.clientIds[i], fileResp.ClientIds[i]))
					}

					var dbInfo *model.FileInfo
					result := <-th.App.Srv.Store.FileInfo().Get(ri.Id)
					if result.Err != nil {
						t.Error(result.Err)
					} else {
						dbInfo = result.Data.(*model.FileInfo)
					}
					checkEq(t, dbInfo.Id, ri.Id, "File id from response should match one stored in database")
					checkEq(t, dbInfo.CreatorId, tc.expectedCreatorId, "F ile should be assigned to user")
					checkEq(t, dbInfo.PostId, "", "File shouldn't have a post")
					checkNeq(t, dbInfo.Path, "", "File path should be set in database")
					_, fname := filepath.Split(dbInfo.Path)
					ext := filepath.Ext(fname)
					name := fname[:len(fname)-len(ext)]
					expectedDir := fmt.Sprintf("%v/teams/%v/channels/%v/users/%s/%s", date, FILE_TEAM_ID, channel.Id, ri.CreatorId, ri.Id)
					expectedPath := fmt.Sprintf("%s/%s", expectedDir, fname)
					checkEq(t, dbInfo.Path, expectedPath,
						fmt.Sprintf("File %v saved to:%q, expected:%q", dbInfo.Name, dbInfo.Path, expectedPath))

					if tc.expectImage {
						expectedThumbnailPath := fmt.Sprintf("%s/%s_thumb.jpg", expectedDir, name)
						expectedPreviewPath := fmt.Sprintf("%s/%s_preview.jpg", expectedDir, name)
						checkEq(t, dbInfo.ThumbnailPath, expectedThumbnailPath,
							fmt.Sprintf("Thumbnail for %v saved to:%q, expected:%q", dbInfo.Name, dbInfo.ThumbnailPath, expectedThumbnailPath))
						checkEq(t, dbInfo.PreviewPath, expectedPreviewPath,
							fmt.Sprintf("Preview for %v saved to:%q, expected:%q", dbInfo.Name, dbInfo.PreviewPath, expectedPreviewPath))

						checkCond(t,
							dbInfo.HasPreviewImage == tc.expectedImageHasPreview[i],
							fmt.Sprintf("Image: HasPreviewImage should be set for %s", dbInfo.Name))
						checkCond(t,
							dbInfo.Width == tc.expectedImageWidths[i] && dbInfo.Height == tc.expectedImageHeights[i],
							fmt.Sprintf("Image dimensions: expected %dwx%dh, got %vwx%dh",
								tc.expectedImageWidths[i], tc.expectedImageHeights[i],
								dbInfo.Width, dbInfo.Height))
					}

					/*if !tc.skipPayloadValidation {
						compare := func(get func(string) ([]byte, *model.Response), name string) {
							data, resp := get(ri.Id)
							if resp.Error != nil {
								t.Fatal(resp.Error)
							}

							expected, err := ioutil.ReadFile(filepath.Join(testDir, name))
							if err != nil {
								t.Fatal(err)
							}

							if bytes.Compare(data, expected) != 0 {
								tf, err := ioutil.TempFile("", fmt.Sprintf("test_%v_*_%s", i, name))
								if err != nil {
									t.Fatal(err)
								}
								io.Copy(tf, bytes.NewReader(data))
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
					}*/

					th.cleanupTestFile(dbInfo)
				}
			})

			if restoreConfig != nil {
				restoreConfig(th.App)
			}
		}
	}
}

func TestGetFile(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	fileId := ""
	var sent []byte
	var err error
	if sent, err = testutils.ReadTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		fileResp, resp := Client.UploadFile(sent, channel.Id, "test.png")
		CheckNoError(t, resp)

		fileId = fileResp.FileInfos[0].Id
	}

	data, resp := Client.GetFile(fileId)
	CheckNoError(t, resp)

	if len(data) == 0 {
		t.Fatal("should not be empty")
	}

	for i := range data {
		if data[i] != sent[i] {
			t.Fatal("received file didn't match sent one")
		}
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
	th := Setup().InitBasic()
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

			if contentType := resp.Header.Get("Content-Type"); !strings.HasPrefix(contentType, expectedContentType) {
				t.Fatal("returned incorrect Content-Type", contentType)
			}

			if getInline {
				if contentDisposition := resp.Header.Get("Content-Disposition"); !strings.HasPrefix(contentDisposition, "inline") {
					t.Fatal("returned incorrect Content-Disposition", contentDisposition)
				}
			} else {
				if contentDisposition := resp.Header.Get("Content-Disposition"); !strings.HasPrefix(contentDisposition, "attachment") {
					t.Fatal("returned incorrect Content-Disposition", contentDisposition)
				}
			}

			_, resp = Client.DownloadFile(fileId, true)
			CheckNoError(t, resp)

			if contentType := resp.Header.Get("Content-Type"); !strings.HasPrefix(contentType, expectedContentType) {
				t.Fatal("returned incorrect Content-Type", contentType)
			}

			if contentDisposition := resp.Header.Get("Content-Disposition"); !strings.HasPrefix(contentDisposition, "attachment") {
				t.Fatal("returned incorrect Content-Disposition", contentDisposition)
			}
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
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	fileId := ""
	var sent []byte
	var err error
	if sent, err = testutils.ReadTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		fileResp, resp := Client.UploadFile(sent, channel.Id, "test.png")
		CheckNoError(t, resp)

		fileId = fileResp.FileInfos[0].Id
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	data, resp := Client.GetFileThumbnail(fileId)
	CheckNoError(t, resp)

	if len(data) == 0 {
		t.Fatal("should not be empty")
	}

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
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewRandomString(32) })

	fileId := ""
	if data, err := testutils.ReadTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		fileResp, resp := Client.UploadFile(data, channel.Id, "test.png")
		CheckNoError(t, resp)

		fileId = fileResp.FileInfos[0].Id
	}

	_, resp := Client.GetFileLink(fileId)
	CheckBadRequestStatus(t, resp)

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id, th.BasicUser.Id))

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = false })
	_, resp = Client.GetFileLink(fileId)
	CheckNotImplementedStatus(t, resp)

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	link, resp := Client.GetFileLink(fileId)
	CheckNoError(t, resp)

	if link == "" {
		t.Fatal("should've received public link")
	}

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

	if result := <-th.App.Srv.Store.FileInfo().Get(fileId); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		th.cleanupTestFile(result.Data.(*model.FileInfo))
	}
}

func TestGetFilePreview(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	fileId := ""
	var sent []byte
	var err error
	if sent, err = testutils.ReadTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		fileResp, resp := Client.UploadFile(sent, channel.Id, "test.png")
		CheckNoError(t, resp)

		fileId = fileResp.FileInfos[0].Id
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	data, resp := Client.GetFilePreview(fileId)
	CheckNoError(t, resp)

	if len(data) == 0 {
		t.Fatal("should not be empty")
	}

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
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	user := th.BasicUser
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	fileId := ""
	var sent []byte
	var err error
	if sent, err = testutils.ReadTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		fileResp, resp := Client.UploadFile(sent, channel.Id, "test.png")
		CheckNoError(t, resp)

		fileId = fileResp.FileInfos[0].Id
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	info, resp := Client.GetFileInfo(fileId)
	CheckNoError(t, resp)

	if err != nil {
		t.Fatal(err)
	} else if info.Id != fileId {
		t.Fatal("got incorrect file")
	} else if info.CreatorId != user.Id {
		t.Fatal("file should be assigned to user")
	} else if info.PostId != "" {
		t.Fatal("file shouldn't have a post")
	} else if info.Path != "" {
		t.Fatal("file path shouldn't have been returned to client")
	} else if info.ThumbnailPath != "" {
		t.Fatal("file thumbnail path shouldn't have been returned to client")
	} else if info.PreviewPath != "" {
		t.Fatal("file preview path shouldn't have been returned to client")
	} else if info.MimeType != "image/png" {
		t.Fatal("mime type should've been image/png")
	}

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
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewRandomString(32) })

	fileId := ""
	if data, err := testutils.ReadTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		fileResp, resp := Client.UploadFile(data, channel.Id, "test.png")
		CheckNoError(t, resp)

		fileId = fileResp.FileInfos[0].Id
	}

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id, th.BasicUser.Id))

	result := <-th.App.Srv.Store.FileInfo().Get(fileId)
	info := result.Data.(*model.FileInfo)
	link := th.App.GeneratePublicLink(Client.Url, info)

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	if resp, err := http.Get(link); err != nil || resp.StatusCode != http.StatusOK {
		t.Log(link)
		t.Fatal("failed to get image with public link", err)
	}

	if resp, err := http.Get(link[:strings.LastIndex(link, "?")]); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link without hash", resp.Status)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = false })
	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusNotImplemented {
		t.Fatal("should've failed to get image with disabled public link")
	}

	// test after the salt has changed
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewRandomString(32) })

	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link after salt changed")
	}

	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link after salt changed")
	}

	if err := th.cleanupTestFile(store.Must(th.App.Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo)); err != nil {
		t.Fatal(err)
	}

	th.cleanupTestFile(info)
}
