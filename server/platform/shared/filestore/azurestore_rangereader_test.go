// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/stretchr/testify/require"
)

// trackingReadCloser wraps a Reader and records whether Close was called.
type trackingReadCloser struct {
	io.Reader
	closed bool
}

func (t *trackingReadCloser) Close() error {
	t.closed = true
	return nil
}

// fakeDownloader serves bytes from an in-memory blob, records every
// DownloadStream call's Range, and hands out trackingReadClosers so tests
// can assert close-on-Seek behavior. An optional err short-circuits responses.
type fakeDownloader struct {
	data   []byte
	calls  []blob.HTTPRange
	bodies []*trackingReadCloser
	err    error
}

func (f *fakeDownloader) DownloadStream(_ context.Context, opts *blob.DownloadStreamOptions) (blob.DownloadStreamResponse, error) {
	if f.err != nil {
		return blob.DownloadStreamResponse{}, f.err
	}
	var rng blob.HTTPRange
	if opts != nil {
		rng = opts.Range
	}
	f.calls = append(f.calls, rng)

	start := min(max(rng.Offset, 0), int64(len(f.data)))
	end := int64(len(f.data))
	if rng.Count > 0 && start+rng.Count < end {
		end = start + rng.Count
	}
	body := &trackingReadCloser{Reader: bytes.NewReader(f.data[start:end])}
	f.bodies = append(f.bodies, body)

	return blob.DownloadStreamResponse{
		DownloadResponse: blob.DownloadResponse{Body: body},
	}, nil
}

// newTestReader returns an azureRangeReader wired to the given fake, with a
// long-lived timer so it never fires during the test. Caller must Close it.
func newTestReader(t *testing.T, fake *fakeDownloader, size int64) *azureRangeReader {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	timer := time.AfterFunc(time.Hour, cancel)
	return &azureRangeReader{
		ctx:        ctx,
		cancel:     cancel,
		timer:      timer,
		blobClient: fake,
		size:       size,
	}
}

func TestRead(t *testing.T) {
	t.Run("returns EOF at end of blob without downloading", func(t *testing.T) {
		fake := &fakeDownloader{data: []byte("hello")}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		_, err := r.Seek(0, io.SeekEnd)
		require.NoError(t, err)

		n, err := r.Read(make([]byte, 4))
		require.Equal(t, 0, n)
		require.Equal(t, io.EOF, err)
		require.Empty(t, fake.calls, "no download should be issued past end of blob")
	})

	t.Run("opens stream at current offset", func(t *testing.T) {
		fake := &fakeDownloader{data: []byte("hello world")}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		_, err := r.Seek(6, io.SeekStart)
		require.NoError(t, err)

		buf := make([]byte, 5)
		n, err := io.ReadFull(r, buf)
		require.NoError(t, err)
		require.Equal(t, 5, n)
		require.Equal(t, "world", string(buf))

		require.Len(t, fake.calls, 1)
		require.Equal(t, blob.HTTPRange{Offset: 6, Count: 0}, fake.calls[0])
	})

	t.Run("sequential reads reuse the open stream", func(t *testing.T) {
		fake := &fakeDownloader{data: []byte("abcdefghij")}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		buf := make([]byte, 4)
		_, err := io.ReadFull(r, buf)
		require.NoError(t, err)
		require.Equal(t, "abcd", string(buf))

		_, err = io.ReadFull(r, buf)
		require.NoError(t, err)
		require.Equal(t, "efgh", string(buf))

		require.Len(t, fake.calls, 1, "sequential reads must reuse the open stream")
	})

	t.Run("propagates download errors", func(t *testing.T) {
		wantErr := errors.New("boom")
		fake := &fakeDownloader{data: []byte("xyz"), err: wantErr}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		_, err := r.Read(make([]byte, 1))
		require.ErrorIs(t, err, wantErr)
	})

	t.Run("surfaces truncation when stream EOFs before the blob ends", func(t *testing.T) {
		// Promised size is larger than what the fake actually serves,
		// so the body eventually returns io.EOF while r.offset < r.size.
		// bytes.Reader returns its content + nil first, then 0 + EOF on
		// the next call, so we drain the bytes before the truncation
		// is observable.
		fake := &fakeDownloader{data: []byte("hello")}
		r := newTestReader(t, fake, int64(len(fake.data))+10)
		defer r.Close()

		buf := make([]byte, 16)
		n, err := r.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 5, n)

		// Second call hits EOF from the body before we've reached r.size,
		// so the reader must surface that as a truncation.
		n, err = r.Read(buf)
		require.Equal(t, 0, n)
		require.ErrorIs(t, err, io.ErrUnexpectedEOF)
		require.Nil(t, r.body, "body must be released after a truncation error")
	})
}

func TestReadAt(t *testing.T) {
	t.Run("reads at the given offset without disturbing the cursor", func(t *testing.T) {
		fake := &fakeDownloader{data: []byte("abcdefghij")}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		// Advance the streaming cursor first.
		_, err := io.ReadFull(r, make([]byte, 3))
		require.NoError(t, err)
		require.Equal(t, int64(3), r.offset)

		buf := make([]byte, 4)
		n, err := r.ReadAt(buf, 5)
		require.NoError(t, err)
		require.Equal(t, 4, n)
		require.Equal(t, "fghi", string(buf))
		require.Equal(t, int64(3), r.offset, "ReadAt must not touch the streaming offset")
	})

	t.Run("returns io.EOF when the read lands exactly at the end of the blob", func(t *testing.T) {
		fake := &fakeDownloader{data: []byte("abcdefghij")}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		buf := make([]byte, 3)
		n, err := r.ReadAt(buf, 7)
		require.Equal(t, io.EOF, err)
		require.Equal(t, 3, n)
		require.Equal(t, "hij", string(buf))
	})

	t.Run("returns io.EOF when off is past the size", func(t *testing.T) {
		fake := &fakeDownloader{data: []byte("abcdefghij")}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		n, err := r.ReadAt(make([]byte, 4), 100)
		require.Equal(t, 0, n)
		require.Equal(t, io.EOF, err)
		require.Empty(t, fake.calls, "no download should be issued past end of blob")
	})

	t.Run("rejects negative offsets", func(t *testing.T) {
		r := newTestReader(t, &fakeDownloader{}, 10)
		defer r.Close()

		_, err := r.ReadAt(make([]byte, 1), -1)
		require.Error(t, err)
	})

	t.Run("propagates download errors", func(t *testing.T) {
		wantErr := errors.New("boom")
		fake := &fakeDownloader{data: []byte("xyz"), err: wantErr}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		_, err := r.ReadAt(make([]byte, 1), 0)
		require.ErrorIs(t, err, wantErr)
	})

	t.Run("surfaces truncation when stream falls short of the requested count", func(t *testing.T) {
		// Promised size exceeds the fake's actual data so ReadFull
		// sees the body terminate before count bytes arrived. That
		// must surface as ErrUnexpectedEOF, not a clean EOF.
		fake := &fakeDownloader{data: []byte("hello")}
		r := newTestReader(t, fake, int64(len(fake.data))+5)
		defer r.Close()

		buf := make([]byte, 10)
		n, err := r.ReadAt(buf, 0)
		require.Equal(t, 5, n)
		require.ErrorIs(t, err, io.ErrUnexpectedEOF)
	})
}

func TestCancelTimeout(t *testing.T) {
	fake := &fakeDownloader{data: []byte("abc")}
	r := newTestReader(t, fake, int64(len(fake.data)))
	defer r.Close()

	require.True(t, r.CancelTimeout(), "first stop should succeed")
	require.False(t, r.CancelTimeout(), "second stop must report the timer was already stopped")
}

func TestSeek(t *testing.T) {
	t.Run("absolute from start", func(t *testing.T) {
		fake := &fakeDownloader{data: bytes.Repeat([]byte("x"), 32)}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		pos, err := r.Seek(10, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(10), pos)
	})

	t.Run("relative to current position", func(t *testing.T) {
		fake := &fakeDownloader{data: bytes.Repeat([]byte("x"), 32)}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		_, err := r.Seek(10, io.SeekStart)
		require.NoError(t, err)

		pos, err := r.Seek(5, io.SeekCurrent)
		require.NoError(t, err)
		require.Equal(t, int64(15), pos)
	})

	t.Run("relative to end", func(t *testing.T) {
		fake := &fakeDownloader{data: bytes.Repeat([]byte("x"), 32)}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		pos, err := r.Seek(-4, io.SeekEnd)
		require.NoError(t, err)
		require.Equal(t, int64(28), pos)
	})

	t.Run("rejects invalid whence", func(t *testing.T) {
		r := newTestReader(t, &fakeDownloader{}, 0)
		defer r.Close()

		_, err := r.Seek(0, 99)
		require.Error(t, err)
	})

	t.Run("rejects negative absolute position", func(t *testing.T) {
		r := newTestReader(t, &fakeDownloader{}, 10)
		defer r.Close()

		_, err := r.Seek(-1, io.SeekStart)
		require.Error(t, err)

		_, err = r.Seek(-20, io.SeekEnd)
		require.Error(t, err)
	})

	t.Run("same offset leaves the open stream untouched", func(t *testing.T) {
		fake := &fakeDownloader{data: []byte("abcdefgh")}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		_, err := io.ReadFull(r, make([]byte, 3))
		require.NoError(t, err)
		require.Len(t, fake.bodies, 1)
		openBody := fake.bodies[0]

		pos, err := r.Seek(3, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(3), pos)
		require.False(t, openBody.closed, "same-offset seek must not close the open stream")

		_, err = io.ReadFull(r, make([]byte, 3))
		require.NoError(t, err)
		require.Len(t, fake.calls, 1, "same-offset seek must not trigger a new download")
	})

	t.Run("different offset closes the open stream and the next read reopens", func(t *testing.T) {
		fake := &fakeDownloader{data: []byte("abcdefghij")}
		r := newTestReader(t, fake, int64(len(fake.data)))
		defer r.Close()

		_, err := io.ReadFull(r, make([]byte, 2))
		require.NoError(t, err)
		require.Len(t, fake.bodies, 1)
		firstBody := fake.bodies[0]

		_, err = r.Seek(7, io.SeekStart)
		require.NoError(t, err)
		require.True(t, firstBody.closed, "seek to a new offset must close the open stream")

		buf := make([]byte, 3)
		_, err = io.ReadFull(r, buf)
		require.NoError(t, err)
		require.Equal(t, "hij", string(buf))

		require.Len(t, fake.calls, 2)
		require.Equal(t, int64(7), fake.calls[1].Offset)
	})
}

func TestClose(t *testing.T) {
	t.Run("cancels context and closes the open body", func(t *testing.T) {
		fake := &fakeDownloader{data: []byte("abcdef")}
		r := newTestReader(t, fake, int64(len(fake.data)))

		_, err := io.ReadFull(r, make([]byte, 3))
		require.NoError(t, err)
		require.Len(t, fake.bodies, 1)

		require.NoError(t, r.Close())
		require.True(t, fake.bodies[0].closed)
		require.ErrorIs(t, r.ctx.Err(), context.Canceled)
	})

	t.Run("works when no stream was opened", func(t *testing.T) {
		r := newTestReader(t, &fakeDownloader{}, 10)
		require.NoError(t, r.Close())
		require.ErrorIs(t, r.ctx.Err(), context.Canceled)
	})
}
