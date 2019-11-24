package pluginapi

import (
	"bytes"
	"io"
	"io/ioutil"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// FileService provides features to deal with post attachments.
type FileService struct {
	api plugin.API
}

// Get gets content of a file by id.
//
// @tag File minimum server version: 5.8
func (f *FileService) Get(id string) (content io.Reader, err error) {
	contentBytes, aerr := f.api.GetFile(id)
	if aerr != nil {
		return nil, normalizeAppErr(aerr)
	}
	return bytes.NewReader(contentBytes), nil
}

// GetByPath reads a file by its path on the dist.
//
// @tag File Minimum server version: 5.3
func (f *FileService) GetByPath(path string) (content io.Reader, err error) {
	contentBytes, aerr := f.api.ReadFile(path)
	if aerr != nil {
		return nil, normalizeAppErr(aerr)
	}
	return bytes.NewReader(contentBytes), nil
}

// GetInfo gets a file's info by id.
//
// @tag File minimum server version: 5.3
func (f *FileService) GetInfo(id string) (*model.FileInfo, error) {
	info, aerr := f.api.GetFileInfo(id)
	return info, normalizeAppErr(aerr)
}

// GetLink gets the public link of a file by id.
//
// @tag File minimum server version: 5.6
func (f *FileService) GetLink(id string) (link string, err error) {
	link, aerr := f.api.GetFileLink(id)
	return link, normalizeAppErr(aerr)
}

// Upload uploads a file to a channel to be later attached to a post.
//
// @tag File @tag Channel minimum server version: 5.6
func (f *FileService) Upload(content io.Reader, fileName, channelID string) (*model.FileInfo, error) {
	contentBytes, err := ioutil.ReadAll(content)
	if err != nil {
		return nil, err
	}
	info, aerr := f.api.UploadFile(contentBytes, channelID, fileName)
	return info, normalizeAppErr(aerr)
}

// CopyInfos duplicates the FileInfo objects referenced by the given file ids, recording
// the given user id as the new creator and returning the new set of file ids.
//
// the duplicate FileInfo objects are not initially linked to a post, but may now be passed
// on creation of a post.
// use this API to duplicate a post and its file attachments without actually duplicating
// the uploaded files.
//
// @tag File @tag User minimum server version: 5.2
func (f *FileService) CopyInfos(ids []string, userID string) (newIDs []string, err error) {
	newIDs, aerr := f.api.CopyFileInfos(userID, ids)
	return newIDs, normalizeAppErr(aerr)
}
