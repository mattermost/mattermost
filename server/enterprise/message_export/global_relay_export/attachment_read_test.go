// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
)

// --- fault-injection helpers ------------------------------------------------

// scriptedReader serves data[pos:], honouring Seek so a resumed read (re-open + Seek past
// the bytes already streamed) continues from the right offset, exactly like the S3/local
// backends. When failAfter >= 0 it returns an error once pos reaches that offset, modelling
// a transient read failure mid-stream (e.g. an S3 timeout). failAfter == 0 fails immediately
// with no progress; failAfter < 0 reads cleanly to EOF.
type scriptedReader struct {
	data      []byte
	pos       int
	failAfter int
}

var _ filestore.ReadCloseSeeker = (*scriptedReader)(nil)

func (r *scriptedReader) Read(p []byte) (int, error) {
	if r.failAfter >= 0 && r.pos >= r.failAfter {
		return 0, errors.New("simulated transient S3 read failure mid-stream")
	}
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	end := len(r.data)
	if r.failAfter >= 0 && r.failAfter < end {
		end = r.failAfter
	}
	n := copy(p, r.data[r.pos:end])
	r.pos += n
	return n, nil
}

func (r *scriptedReader) Close() error { return nil }

func (r *scriptedReader) Seek(offset int64, whence int) (int64, error) {
	if whence != io.SeekStart {
		return 0, fmt.Errorf("scriptedReader: unsupported whence %d", whence)
	}
	r.pos = int(offset)
	return offset, nil
}

// scriptedBackend is a filestore.FileBackend whose Reader is driven by a per-path factory.
// generateEmail exercises Reader plus FileExists (consulted on a read failure to tell a
// genuinely-missing object apart from a transient read error); the rest of the embedded
// interface is nil and unused.
type scriptedBackend struct {
	filestore.FileBackend
	readers map[string]func() (filestore.ReadCloseSeeker, error)
	// missing lists paths that FileExists should report as absent, modelling an object that
	// opens lazily (S3/MinIO) but no longer exists. Paths not listed report as present.
	missing map[string]bool
}

func (b *scriptedBackend) Reader(path string) (filestore.ReadCloseSeeker, error) {
	if fn, ok := b.readers[path]; ok {
		return fn()
	}
	return nil, fmt.Errorf("scriptedBackend: no reader registered for %q", path)
}

func (b *scriptedBackend) FileExists(path string) (bool, error) {
	return !b.missing[path], nil
}

// scriptedReaderFactory returns a Reader factory that fails at the given offsets on
// successive opens: the i-th open uses failAt[i] (see scriptedReader.failAfter). Opens past
// the end of failAt read cleanly to EOF. The same data is served every open, so a resumed
// read reconstructs the full content.
func scriptedReaderFactory(data []byte, failAt ...int) func() (filestore.ReadCloseSeeker, error) {
	var call int
	return func() (filestore.ReadCloseSeeker, error) {
		failAfter := -1
		if call < len(failAt) {
			failAfter = failAt[call]
		}
		call++
		return &scriptedReader{data: data, failAfter: failAfter}, nil
	}
}

// healthyReader serves the given content cleanly in a single uninterrupted read.
func healthyReader(content []byte) func() (filestore.ReadCloseSeeker, error) {
	return scriptedReaderFactory(content)
}

// openFails models a file that cannot be opened at all (e.g. deleted from the store).
func openFails() (filestore.ReadCloseSeeker, error) {
	return nil, errors.New("file does not exist")
}

// assertAttachmentPresent checks that content was written into the email as an attachment.
// gomail stores attachments base64-encoded, and MIME wraps that base64 across lines, so we
// drop the line breaks and look for the unwrapped encoding — letting content be any length.
func assertAttachmentPresent(t *testing.T, out *bytes.Buffer, content []byte, msg string) {
	t.Helper()
	unwrapped := strings.NewReplacer("\r", "", "\n", "").Replace(out.String())
	require.Contains(t, unwrapped, base64.StdEncoding.EncodeToString(content), msg)
}

func newChannelExport(files ...*model.FileInfo) *ChannelExport {
	return &ChannelExport{
		ChannelId:          "channelid1234567890123456",
		ChannelName:        "test-channel",
		ChannelDisplayName: "Test Channel",
		ChannelType:        model.ChannelTypeDirect,
		Participants: []ParticipantRow{
			{JoinExport: shared.JoinExport{UserId: "userid", UserEmail: "participant@example.com"}},
		},
		uploadedFiles: files,
	}
}

// runGenerateEmail calls generateEmail inside a testing/synctest bubble so the exponential
// backoff between read retries uses a fake clock and the retries don't actually sleep. Any
// panic is recovered so a regression (e.g. the MM-69242 nil-pointer that crashes the whole
// server) shows up as a clear test failure rather than crashing the test binary.
func runGenerateEmail(t *testing.T, backend filestore.FileBackend, ce *ChannelExport) (warnings int, out *bytes.Buffer, genErr error) {
	t.Helper()
	return runGenerateEmailCtx(context.Background(), t, backend, ce)
}

// runGenerateEmailCtx is runGenerateEmail with a caller-supplied context, used to exercise
// job cancellation mid-retry.
func runGenerateEmailCtx(ctx context.Context, t *testing.T, backend filestore.FileBackend, ce *ChannelExport) (warnings int, out *bytes.Buffer, genErr error) {
	t.Helper()
	templatesDir, ok := fileutils.FindDir("templates")
	require.True(t, ok, "could not locate the server templates dir")
	templatesContainer, err := templates.New(templatesDir)
	require.NoError(t, err)
	require.NotNil(t, templatesContainer)

	// The logger (and its async logr goroutine) is created OUTSIDE the bubble so it
	// isn't tracked as a bubble goroutine.
	rctx := request.TestContext(t).WithContext(ctx)
	out = &bytes.Buffer{}

	synctest.Test(t, func(t *testing.T) {
		var recovered any
		func() {
			defer func() { recovered = recover() }()
			warnings, genErr = generateEmail(rctx, backend, ce, templatesContainer, out)
		}()
		if recovered != nil {
			t.Fatalf("MM-69242 regression: generateEmail panicked (in production this crashes "+
				"the entire server): %v", recovered)
		}
	})

	return warnings, out, genErr
}

// --- tests ------------------------------------------------------------------

// A transient read failure that clears within the retry budget must not fail the export:
// the attachment is resumed on a later attempt and its full content lands in the email.
func TestGenerateEmail_TransientReadRecoversOnRetry(t *testing.T) {
	flakyContent := []byte("flaky attachment content that must survive a mid-stream failure and resume")
	healthyContent := []byte("healthy attachment content")
	ce := newChannelExport(
		&model.FileInfo{Id: "file1", Name: "flaky.bin", Path: "data/flaky.bin"},
		&model.FileInfo{Id: "file2", Name: "healthy.bin", Path: "data/healthy.bin"},
	)
	backend := &scriptedBackend{readers: map[string]func() (filestore.ReadCloseSeeker, error){
		// First open fails after 20 bytes; the retry re-opens, seeks to 20, and finishes —
		// proving the resume reconstructs the full content, not just non-empty output.
		"data/flaky.bin":   scriptedReaderFactory(flakyContent, 20),
		"data/healthy.bin": healthyReader(healthyContent),
	}}

	warnings, out, genErr := runGenerateEmail(t, backend, ce)

	require.NoError(t, genErr, "a transient failure that clears within the retry budget should succeed")
	require.Equal(t, 0, warnings)
	assertAttachmentPresent(t, out, healthyContent, "the healthy attachment's content should be in the email")
	assertAttachmentPresent(t, out, flakyContent, "the resumed attachment's full content should be in the email")
}

// A read failure that persists past the retry budget fails the batch (so the job retries)
// instead of shipping an incomplete export — and, critically, never panics. The healthy
// attachment after the failing one is exactly what triggered the MM-69242 nil-deref.
func TestGenerateEmail_PersistentReadFailsBatch(t *testing.T) {
	ce := newChannelExport(
		&model.FileInfo{Id: "file1", Name: "fails.bin", Path: "data/fails.bin"},
		&model.FileInfo{Id: "file2", Name: "healthy.bin", Path: "data/healthy.bin"},
	)
	backend := &scriptedBackend{readers: map[string]func() (filestore.ReadCloseSeeker, error){
		// Fails immediately (no progress) on every attempt, exhausting the stall budget.
		"data/fails.bin":   scriptedReaderFactory(make([]byte, 200), 0, 0, 0),
		"data/healthy.bin": healthyReader([]byte("healthy attachment content")),
	}}

	warnings, _, genErr := runGenerateEmail(t, backend, ce)

	require.Error(t, genErr, "a persistent attachment read failure should fail the batch (so the job retries)")
	require.Equal(t, 0, warnings, "a read failure is an error, not a skipped/missing-file warning")
}

// A genuinely missing attachment (cannot be opened) keeps the prior MM-62493 behavior:
// warn, increment the warning count, skip it, and do not fail the batch.
func TestGenerateEmail_MissingAttachmentSkipped(t *testing.T) {
	healthyContent := []byte("healthy attachment content")
	ce := newChannelExport(
		&model.FileInfo{Id: "file1", Name: "missing.bin", Path: "data/missing.bin"},
		&model.FileInfo{Id: "file2", Name: "healthy.bin", Path: "data/healthy.bin"},
	)
	backend := &scriptedBackend{readers: map[string]func() (filestore.ReadCloseSeeker, error){
		"data/missing.bin": openFails,
		"data/healthy.bin": healthyReader(healthyContent),
	}}

	warnings, out, genErr := runGenerateEmail(t, backend, ce)

	require.NoError(t, genErr, "a missing file should be skipped, not fail the batch")
	require.Equal(t, 1, warnings, "the missing file should be counted as a warning")
	assertAttachmentPresent(t, out, healthyContent, "the surviving attachment should still be exported")
}

// On S3/MinIO a deleted object is not detected when the reader is opened (minio-go's
// GetObject is lazy); the "no such key" only surfaces as a read error on the first Read. Such
// a file must be treated as missing — skipped with a warning, batch not failed and not
// retried — exactly like a local-backend open failure (MM-62493). Modeled
// here by a reader that opens but fails its first read, with FileExists reporting it absent.
func TestGenerateEmail_ReadNotFoundSkipped(t *testing.T) {
	healthyContent := []byte("healthy attachment content")
	ce := newChannelExport(
		&model.FileInfo{Id: "file1", Name: "s3missing.bin", Path: "data/s3missing.bin"},
		&model.FileInfo{Id: "file2", Name: "healthy.bin", Path: "data/healthy.bin"},
	)
	backend := &scriptedBackend{
		readers: map[string]func() (filestore.ReadCloseSeeker, error){
			"data/s3missing.bin": scriptedReaderFactory(make([]byte, 200), 0), // opens, first read fails
			"data/healthy.bin":   healthyReader(healthyContent),
		},
		missing: map[string]bool{"data/s3missing.bin": true}, // FileExists reports it gone
	}

	warnings, out, genErr := runGenerateEmail(t, backend, ce)

	require.NoError(t, genErr, "a read-time not-found must be skipped, not fail the batch")
	require.Equal(t, 1, warnings, "the missing file should be counted as a warning")
	assertAttachmentPresent(t, out, healthyContent, "the surviving attachment should still be exported")
}

// A job cancelled while a read is backing off must abort promptly with the context error
// (not sleep through the backoff, not panic).
func TestGenerateEmail_ContextCancelledDuringRetry(t *testing.T) {
	ce := newChannelExport(
		&model.FileInfo{Id: "file1", Name: "fails.bin", Path: "data/fails.bin"},
	)
	backend := &scriptedBackend{readers: map[string]func() (filestore.ReadCloseSeeker, error){
		"data/fails.bin": scriptedReaderFactory(make([]byte, 200), 0, 0, 0),
	}}

	// Cancelled before the first backoff: the retry loop hits the first read failure, then
	// the cancellation wins the backoff select immediately.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	warnings, _, genErr := runGenerateEmailCtx(ctx, t, backend, ce)

	require.Error(t, genErr, "a cancelled job should fail rather than ship a partial export")
	require.ErrorIs(t, genErr, context.Canceled)
	require.Equal(t, 0, warnings)
}
