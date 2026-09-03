// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"context"
	"errors"
	"testing"

	s3 "github.com/minio/minio-go/v7"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ensure the real S3 client satisfies the interface used by copyObjectWithClient.
var _ s3CopyClient = (*s3.Client)(nil)

// mockS3CopyClient is a minimal s3CopyClient that records which copy operation
// was invoked and lets StatObject's result be controlled per test.
type mockS3CopyClient struct {
	statInfo s3.ObjectInfo
	statErr  error

	copyCalled    bool
	composeCalled bool
}

func (m *mockS3CopyClient) StatObject(_ context.Context, _, _ string, _ s3.StatObjectOptions) (s3.ObjectInfo, error) {
	return m.statInfo, m.statErr
}

func (m *mockS3CopyClient) CopyObject(_ context.Context, _ s3.CopyDestOptions, _ s3.CopySrcOptions) (s3.UploadInfo, error) {
	m.copyCalled = true
	return s3.UploadInfo{}, nil
}

func (m *mockS3CopyClient) ComposeObject(_ context.Context, _ s3.CopyDestOptions, _ ...s3.CopySrcOptions) (s3.UploadInfo, error) {
	m.composeCalled = true
	return s3.UploadInfo{}, nil
}

var (
	testCopySrc = s3.CopySrcOptions{Bucket: "bucket", Object: "src"}
	testCopyDst = s3.CopyDestOptions{Bucket: "bucket", Object: "dst"}
)

func Test_copyObject_UsesCompose_ForLarge(t *testing.T) {
	mock := &mockS3CopyClient{statInfo: s3.ObjectInfo{Size: maxS3SingleCopySize + 1}}

	err := copyObjectWithClient(context.Background(), mock, testCopySrc, testCopyDst)

	require.NoError(t, err)
	assert.True(t, mock.composeCalled, "expected ComposeObject (multipart copy) for sources larger than 5GiB")
	assert.False(t, mock.copyCalled, "expected CopyObject not to be used for sources larger than 5GiB")
}

func Test_copyObject_UsesCopy_ForSmall(t *testing.T) {
	// A source exactly at the 5GiB limit must still use the single CopyObject.
	mock := &mockS3CopyClient{statInfo: s3.ObjectInfo{Size: maxS3SingleCopySize}}

	err := copyObjectWithClient(context.Background(), mock, testCopySrc, testCopyDst)

	require.NoError(t, err)
	assert.True(t, mock.copyCalled, "expected CopyObject for sources up to 5GiB")
	assert.False(t, mock.composeCalled, "expected ComposeObject not to be used for sources up to 5GiB")
}

func Test_copyObject_PropagatesStatError(t *testing.T) {
	statErr := errors.New("stat failed")
	mock := &mockS3CopyClient{statErr: statErr}

	err := copyObjectWithClient(context.Background(), mock, testCopySrc, testCopyDst)

	require.Error(t, err)
	assert.ErrorIs(t, err, statErr, "StatObject error must be propagated")
	assert.False(t, mock.copyCalled, "no copy should be attempted when StatObject fails")
	assert.False(t, mock.composeCalled, "no compose should be attempted when StatObject fails")
}
