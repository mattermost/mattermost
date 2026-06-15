// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"bytes"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
)

// erroringReadCloseSeeker is a filestore.ReadCloseSeeker whose Read always
// fails, simulating an attachment whose backing store opens successfully but
// errors partway through the read (e.g. an object-store connection drop).
type erroringReadCloseSeeker struct{}

func (erroringReadCloseSeeker) Read(_ []byte) (int, error) {
	return 0, errors.New("simulated mid-read failure")
}
func (erroringReadCloseSeeker) Close() error                       { return nil }
func (erroringReadCloseSeeker) Seek(_ int64, _ int) (int64, error) { return 0, nil }

// failingReaderBackend wraps a real FileBackend but returns a reader that
// fails on read for a single configured path. All other paths are served by
// the embedded backend.
type failingReaderBackend struct {
	filestore.FileBackend
	failPath string
}

func (b *failingReaderBackend) Reader(path string) (filestore.ReadCloseSeeker, error) {
	if path == b.failPath {
		return erroringReadCloseSeeker{}, nil
	}
	return b.FileBackend.Reader(path)
}

// TestGenerateEmailAttachmentReadFailure is a regression test for MM-69249.
//
// When a channel export has two or more attachments and an earlier attachment's
// io.Copy fails mid-read, the SetCopyFunc callback used to return that error.
// gomail stores the error in its messageWriter, which then hands a nil part
// writer to the next attachment, and writing that attachment dereferenced the
// nil writer -> panic that crashed the whole MessageExportWorker job.
//
// The fix swallows the copy error (logs a warning, counts it, returns nil) so
// gomail's writer is never poisoned. This test must not panic and the readable
// attachment must still be present in the output.
func TestGenerateEmailAttachmentReadFailure(t *testing.T) {
	templatesDir, ok := fileutils.FindDir("templates")
	require.True(t, ok)

	templatesContainer, err := templates.New(templatesDir)
	require.NoError(t, err)
	require.NotNil(t, templatesContainer)

	rctx := request.TestContext(t)

	tempDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		assert.NoError(t, os.RemoveAll(tempDir))
	})

	localBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
		DriverName: model.ImageDriverLocal,
		Directory:  tempDir,
	})
	require.NoError(t, err)

	// The first attachment fails mid-read; the second is fully readable. The
	// second attachment must be large enough to drive a write into the base64
	// encoder so the (previously nil) writer is exercised.
	const failPath = "attachments/fail.txt"
	const okPath = "attachments/ok.txt"
	okContent := strings.Repeat("second-attachment-content ", 64)
	_, err = localBackend.WriteFile(strings.NewReader(okContent), okPath)
	require.NoError(t, err)

	backend := &failingReaderBackend{FileBackend: localBackend, failPath: failPath}

	channelExport := &ChannelExport{
		ChannelId:          "channel-id",
		ChannelName:        "channel-name",
		ChannelDisplayName: "channel-display-name",
		ChannelType:        model.ChannelTypeDirect,
		StartTime:          1,
		EndTime:            100_000,
		Participants: []ParticipantRow{
			{JoinExport: shared.JoinExport{UserId: "id-test1", Username: "test1", UserEmail: "test1@test.com"}},
		},
		uploadedFiles: []*model.FileInfo{
			{Name: "fail.txt", Path: failPath},
			{Name: "ok.txt", Path: okPath},
		},
	}

	var buf bytes.Buffer
	var warnings int
	var genErr error
	require.NotPanics(t, func() {
		warnings, genErr = generateEmail(rctx, backend, channelExport, templatesContainer, &buf)
	}, "generateEmail must not panic when an attachment read fails (MM-69249)")

	require.NoError(t, genErr)
	assert.Equal(t, 1, warnings, "the failed attachment should be reported as a single warning")

	// The readable second attachment must still be included in the export.
	assert.Contains(t, buf.String(), "ok.txt", "the readable attachment should still be written")
	assert.Greater(t, buf.Len(), 0, "the email should still be generated")
}
