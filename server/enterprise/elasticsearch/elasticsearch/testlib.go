// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package elasticsearch

import (
	"io"
	"testing"
	"time"

	"github.com/elastic/go-elasticsearch/v8"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// mockFileBackend implements model.FileBackend for testing
type mockFileBackend struct{}

func (m *mockFileBackend) DriverName() string                                       { return "" }
func (m *mockFileBackend) TestConnection() error                                    { return nil }
func (m *mockFileBackend) Reader(path string) (model.ReadCloseSeeker, error)        { return nil, nil }
func (m *mockFileBackend) ReadFile(path string) ([]byte, error)                     { return nil, nil }
func (m *mockFileBackend) FileExists(path string) (bool, error)                     { return false, nil }
func (m *mockFileBackend) FileSize(path string) (int64, error)                      { return 0, nil }
func (m *mockFileBackend) CopyFile(oldPath, newPath string) error                   { return nil }
func (m *mockFileBackend) MoveFile(oldPath, newPath string) error                   { return nil }
func (m *mockFileBackend) WriteFile(fr io.Reader, path string) (int64, error)       { return 0, nil }
func (m *mockFileBackend) AppendFile(fr io.Reader, path string) (int64, error)      { return 0, nil }
func (m *mockFileBackend) RemoveFile(path string) error                             { return nil }
func (m *mockFileBackend) FileModTime(path string) (time.Time, error)               { return time.Time{}, nil }
func (m *mockFileBackend) ListDirectory(path string) ([]string, error)              { return nil, nil }
func (m *mockFileBackend) ListDirectoryRecursively(path string) ([]string, error)   { return nil, nil }
func (m *mockFileBackend) RemoveDirectory(path string) error                        { return nil }
func (m *mockFileBackend) ZipReader(path string, deflate bool) (io.ReadCloser, error) { return nil, nil }

func createTestClient(t *testing.T, rctx request.CTX, cfg *model.Config, fileStore model.FileBackend) *elasticsearch.TypedClient {
	t.Helper()

	if fileStore == nil {
		// Create a mock FileBackend using a struct that implements model.FileBackend
		fileStore = &mockFileBackend{}
	}

	client, err := createTypedClient(rctx.Logger(), cfg, fileStore, true)
	require.Nil(t, err)
	return client
}
