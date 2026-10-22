// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"context"
	"io"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	pkgerr "github.com/pkg/errors"
)

// blobDownloader is the subset of *blob.Client used by azureRangeReader.
// Defined as an interface so tests can substitute a fake without standing up
// a real Azure client.
type blobDownloader interface {
	DownloadStream(ctx context.Context, opts *blob.DownloadStreamOptions) (blob.DownloadStreamResponse, error)
}

// azureRangeReader is a seekable reader over an Azure blob, backed by HTTP
// Range requests. A stream is opened lazily on the first Read at the current
// offset; Seek closes any open stream so the next Read re-opens it from the
// new offset. The context is cancelled either by Close or by a timer set to
// the backend's configured timeout, matching the S3 driver's behavior.
//
// Callers constructing this struct directly must set ctx, cancel and timer;
// the methods below assume all three are non-nil.
type azureRangeReader struct {
	ctx        context.Context
	cancel     context.CancelFunc
	timer      *time.Timer
	blobClient blobDownloader
	size       int64
	offset     int64
	body       io.ReadCloser
}

// Compile-time guarantees that azureRangeReader satisfies the interfaces the
// app layer relies on. zip.NewReader requires io.ReaderAt for archive
// readers (e.g. the bulk-import worker), and the import worker also
// type-asserts to a CancelTimeout interface for long-running operations.
var (
	_ ReadCloseSeeker = (*azureRangeReader)(nil)
	_ io.ReaderAt     = (*azureRangeReader)(nil)
)

func (r *azureRangeReader) Read(p []byte) (int, error) {
	if r.offset >= r.size {
		return 0, io.EOF
	}
	if r.body == nil {
		resp, err := r.blobClient.DownloadStream(r.ctx, &blob.DownloadStreamOptions{
			Range: blob.HTTPRange{Offset: r.offset, Count: 0},
		})
		if err != nil {
			return 0, pkgerr.Wrap(err, "failed to open azure range stream")
		}
		r.body = resp.Body
	}
	n, err := r.body.Read(p)
	r.offset += int64(n)
	if err == nil {
		return n, nil
	}
	// Close+drop the body so the caller (or a retry) doesn't read more
	// from a half-consumed stream, and so Close stays idempotent.
	r.body.Close()
	r.body = nil
	if err == io.EOF && r.offset < r.size {
		// The remote stream ended before we reached the blob's content
		// length. Surface that as a truncation rather than a clean EOF
		// so the caller doesn't accept a partial blob as complete.
		return n, io.ErrUnexpectedEOF
	}
	return n, err
}

func (r *azureRangeReader) Seek(offset int64, whence int) (int64, error) {
	var abs int64
	switch whence {
	case io.SeekStart:
		abs = offset
	case io.SeekCurrent:
		abs = r.offset + offset
	case io.SeekEnd:
		abs = r.size + offset
	default:
		return 0, pkgerr.Errorf("invalid whence: %d", whence)
	}
	if abs < 0 {
		return 0, pkgerr.Errorf("negative position: %d", abs)
	}
	if abs == r.offset {
		return abs, nil
	}
	if r.body != nil {
		r.body.Close()
		r.body = nil
	}
	r.offset = abs
	return abs, nil
}

// ReadAt reads len(p) bytes starting at offset off. Each call issues a
// dedicated ranged DownloadStream - calls do not affect the cursor that Read
// uses, matching the io.ReaderAt contract. This is what the bulk-import
// worker needs to feed zip.NewReader on Azure-backed deployments.
func (r *azureRangeReader) ReadAt(p []byte, off int64) (int, error) {
	if off < 0 {
		return 0, pkgerr.Errorf("negative offset: %d", off)
	}
	if off >= r.size {
		return 0, io.EOF
	}
	count := int64(len(p))
	if remaining := r.size - off; count > remaining {
		count = remaining
	}
	resp, err := r.blobClient.DownloadStream(r.ctx, &blob.DownloadStreamOptions{
		Range: blob.HTTPRange{Offset: off, Count: count},
	})
	if err != nil {
		return 0, pkgerr.Wrap(err, "failed to open azure range stream")
	}
	defer resp.Body.Close()
	n, err := io.ReadFull(resp.Body, p[:count])
	// io.ReadFull returns ErrUnexpectedEOF when the stream terminates
	// before count bytes arrive. Only collapse it to io.EOF when we
	// actually filled the buffer and consumed the blob to the end -
	// otherwise it is a real truncation that needs to surface so
	// callers like zip.NewReader do not accept partial content.
	if err == io.ErrUnexpectedEOF && int64(n) == count && off+int64(n) == r.size {
		return n, io.EOF
	}
	if err == nil && off+int64(n) == r.size {
		return n, io.EOF
	}
	return n, err
}

// CancelTimeout stops the timer that bounds this reader's lifetime, so
// long-running consumers (e.g. the bulk-import worker, which can run far
// past the default per-operation timeout) can opt out of the automatic
// cancellation. Returns false if the timer has already fired.
func (r *azureRangeReader) CancelTimeout() bool {
	return r.timer.Stop()
}

func (r *azureRangeReader) Close() error {
	if r.timer != nil {
		r.timer.Stop()
	}
	r.cancel()
	if r.body != nil {
		return r.body.Close()
	}
	return nil
}
