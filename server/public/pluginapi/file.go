package pluginapi

import (
	"bytes"
	"io"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// FileService exposes methods to manipulate files, most often as post attachments.
type FileService struct {
	api plugin.API
}

// Get gets content of a file by id.
//
// Minimum server version: 5.8
func (f *FileService) Get(id string) (io.Reader, error) {
	contentBytes, appErr := f.api.GetFile(id)
	if appErr != nil {
		return nil, normalizeAppErr(appErr)
	}

	return bytes.NewReader(contentBytes), nil
}

// GetByPath reads a file by its path on the dist.
//
// Minimum server version: 5.3
func (f *FileService) GetByPath(path string) (io.Reader, error) {
	contentBytes, appErr := f.api.ReadFile(path)
	if appErr != nil {
		return nil, normalizeAppErr(appErr)
	}

	return bytes.NewReader(contentBytes), nil
}

// GetInfo gets a file's info by id.
//
// Minimum server version: 5.3
func (f *FileService) GetInfo(id string) (*model.FileInfo, error) {
	info, appErr := f.api.GetFileInfo(id)

	return info, normalizeAppErr(appErr)
}

// SetSearchableContent update the File Info searchable text for full text search
//
// Minimum server version: 9.1
func (f *FileService) SetSearchableContent(id string, content string) error {
	appErr := f.api.SetFileSearchableContent(id, content)
	return normalizeAppErr(appErr)
}

// GetLink gets the public link of a file by id.
//
// Minimum server version: 5.6
func (f *FileService) GetLink(id string) (string, error) {
	link, appErr := f.api.GetFileLink(id)

	return link, normalizeAppErr(appErr)
}

// Upload uploads a file to a channel to be later attached to a post.
//
// Minimum server version: 5.6
func (f *FileService) Upload(content io.Reader, fileName, channelID string) (*model.FileInfo, error) {
	contentBytes, err := io.ReadAll(content)
	if err != nil {
		return nil, err
	}

	info, appErr := f.api.UploadFile(contentBytes, channelID, fileName)

	return info, normalizeAppErr(appErr)
}

// CopyInfos duplicates the FileInfo objects referenced by the given file ids, recording
// the given user id as the new creator and returning the new set of file ids.
//
// The duplicate FileInfo objects are not initially linked to a post, but may now be passed
// on creation of a post.
// Use this API to duplicate a post and its file attachments without actually duplicating
// the uploaded files.
//
// Minimum server version: 5.2
func (f *FileService) CopyInfos(ids []string, userID string) ([]string, error) {
	newIDs, appErr := f.api.CopyFileInfos(userID, ids)

	return newIDs, normalizeAppErr(appErr)
}
