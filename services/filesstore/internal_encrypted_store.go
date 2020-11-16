package filesstore

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

var (
	globalStore                        store.Store
	errorInternalEncryptedFileNotExist = errors.New("Internal encrypted file is not exist")
	errorInvalidFilePath               = errors.New("Invalid file path")
)

func SetGlobalStore(store store.Store) {
	globalStore = store
}

type InternalEncryptedFileBackend struct {
	Addr       string
	localStore FileBackend
}

func (b *InternalEncryptedFileBackend) download(path string) (*DownloadResponse, error) {
	fileInfo, err := b.fileInfo(path)
	if err != nil {
		return nil, err
	}

	if fileInfo == nil {
		errMsg := "Fileinfo is not exist."
		mlog.Error(errMsg, mlog.String("path", path))
		return nil, &model.AppError{
			DetailedError: errMsg,
			StatusCode:    http.StatusInternalServerError,
		}
	}

	var internalFileID string
	pathInfo := b.parsePath(path)
	switch pathInfo.fileType {
	case "file":
		internalFileID = fileInfo.InternalFileID
	case "thumb":
		internalFileID = fileInfo.InternalThumbnailID
	case "preview":
		internalFileID = fileInfo.InternalPreviewID
	}

	if fileInfo.InternalFileID == "" {
		return nil, errorInternalEncryptedFileNotExist
	}

	res, err := http.Get(b.Addr + "/fileManager/services/rest/filedownload/fileDownNow?fileId=" + internalFileID)
	if err != nil {
		errMsg := "Fail to call internal encrypted server api. " + err.Error()
		mlog.Error(errMsg, mlog.String("path", path))
		return nil, &model.AppError{
			DetailedError: errMsg,
			StatusCode:    http.StatusInternalServerError,
		}
	}

	fileBytes, err := ioutil.ReadAll(res.Body)
	if err != nil {
		errMsg := "Fail to read response body. " + err.Error()
		mlog.Error(errMsg, mlog.String("path", path))
		return nil, &model.AppError{
			DetailedError: errMsg,
			StatusCode:    http.StatusInternalServerError,
		}
	}

	return &DownloadResponse{bytes: fileBytes}, nil
}

func (b *InternalEncryptedFileBackend) upload(fr io.Reader, path string) (int64, error) {
	pathInfo := b.parsePath(path)
	if pathInfo.fileInfoId == "" {
		return 0, errorInvalidFilePath
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", pathInfo.filename)
	if err != nil {
		errMsg := "Fail to create form. " + err.Error()
		mlog.Error(errMsg)
		return 0, &model.AppError{
			DetailedError: errMsg,
			StatusCode:    http.StatusInternalServerError,
		}
	}
	written, err := io.Copy(part, fr)
	if err != nil {
		errMsg := "Fail to copy file stream. " + err.Error()
		mlog.Error(errMsg)
		return 0, &model.AppError{
			DetailedError: errMsg,
			StatusCode:    http.StatusInternalServerError,
		}
	}
	mlog.Info("Written: " + strconv.FormatInt(written, 10))

	writer.WriteField("fullPath", "IM")
	writer.WriteField("fileName", pathInfo.filename)
	writer.Close()

	res, err := http.Post(
		b.Addr+"/fileManager/services/rest/filedownload/uploadFile",
		writer.FormDataContentType(),
		body,
	)
	if err != nil {
		errMsg := "Fail to call internal encrypted server api. " + err.Error()
		mlog.Error(errMsg, mlog.String("path", path))
		return 0, &model.AppError{
			DetailedError: errMsg,
			StatusCode:    http.StatusInternalServerError,
		}
	}

	var resp UploadResponse
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		errMsg := "Fail to parse response data to json" + err.Error()
		mlog.Error(errMsg)
		return 0, &model.AppError{
			DetailedError: errMsg,
			StatusCode:    http.StatusInternalServerError,
		}
	}

	if !resp.Ret {
		errMsg := "Fail to upload file to internal encrypted server." + resp.ErrMsg
		mlog.Error(errMsg, mlog.String("path", path))
		return 0, &model.AppError{
			DetailedError: errMsg,
			StatusCode:    http.StatusInternalServerError,
		}
	}

	if resp.FileID == "" {
		errMsg := "Internal encrypted server fileID is empty"
		mlog.Error(errMsg, mlog.String("path", path))
		return 0, &model.AppError{
			DetailedError: errMsg,
			StatusCode:    http.StatusInternalServerError,
		}
	}

	fileInfo, _ := b.fileInfo(path)
	if fileInfo == nil {
		fileInfo = &model.FileInfo{
			Id:        pathInfo.fileInfoId,
			CreatorId: pathInfo.userId,
			Extension: pathInfo.extension,
		}
	}

	switch pathInfo.fileType {
	case "preview":
		fileInfo.InternalPreviewID = resp.FileID
		fileInfo.PreviewPath = path
		fileInfo.HasPreviewImage = true
	case "thumb":
		fileInfo.InternalThumbnailID = resp.FileID
		fileInfo.ThumbnailPath = path
	case "file":
		fileInfo.InternalFileID = resp.FileID
		fileInfo.Path = path
		fileInfo.Name = pathInfo.filename
	}

	if _, err := globalStore.FileInfo().Save(fileInfo); err != nil {
		errMsg := "Fail to save FileInfo." + err.Error()
		mlog.Error(errMsg, mlog.String("path", path), mlog.String("InternalFileID", resp.FileID))
		return 0, &model.AppError{
			DetailedError: errMsg,
			StatusCode:    http.StatusInternalServerError,
		}
	}

	return written, nil

}

func (b *InternalEncryptedFileBackend) TestConnection() *model.AppError {
	return b.localStore.TestConnection()
}

func (b *InternalEncryptedFileBackend) Reader(path string) (ReadCloseSeeker, *model.AppError) {
	resp, err := b.download(path)
	if err != nil {
		if err == errorInternalEncryptedFileNotExist {
			mlog.Warn("Internal encrypted file server is not supported. Call localStore.", mlog.String("method", "Reader"), mlog.String("path", path))
			return b.localStore.Reader(path)
		}
		if err == errorInvalidFilePath {
			mlog.Warn("Internal encrypted file server is not supported. Call localStore.", mlog.String("method", "Reader"), mlog.String("path", path))
			return b.localStore.Reader(path)
		}
		appError, ok := err.(*model.AppError)
		if ok {
			appError.Where = "Reader"
			appError.Message = "Encountered an error reading from internal encrypted file storage."
			return nil, appError
		}
		return nil, model.NewAppError("Reader", "api.file.reader.reading_local.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return resp, nil
}

func (b *InternalEncryptedFileBackend) ReadFile(path string) ([]byte, *model.AppError) {
	resp, err := b.download(path)
	if err != nil {
		if err == errorInternalEncryptedFileNotExist {
			mlog.Warn("Internal encrypted file server is not supported. Call localStore.", mlog.String("method", "ReadFile"), mlog.String("path", path))
			return b.localStore.ReadFile(path)
		}
		if err == errorInvalidFilePath {
			mlog.Warn("Internal encrypted file server is not supported. Call localStore.", mlog.String("method", "ReadFile"), mlog.String("path", path))
			return b.localStore.ReadFile(path)
		}
		appError, ok := err.(*model.AppError)
		if ok {
			appError.Where = "ReadFile"
			appError.Message = "Encountered an error reading from internal encrypted file storage."
			return nil, appError
		}
		return nil, model.NewAppError("ReadFile", "api.file.read_file.reading_local.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return resp.bytes, nil
}

func (b *InternalEncryptedFileBackend) FileExists(path string) (bool, *model.AppError) {
	fileInfo, _ := b.fileInfo(path)
	if fileInfo != nil && fileInfo.InternalFileID != "" {
		return true, nil

	}
	return b.localStore.FileExists(path)
}

func (b *InternalEncryptedFileBackend) CopyFile(oldPath, newPath string) *model.AppError {
	return nil
}

func (b *InternalEncryptedFileBackend) MoveFile(oldPath, newPath string) *model.AppError {
	return nil
}

func (b *InternalEncryptedFileBackend) WriteFile(fr io.Reader, path string) (int64, *model.AppError) {
	written, err := b.upload(fr, path)
	if err != nil {
		if err == errorInternalEncryptedFileNotExist {
			return b.localStore.WriteFile(fr, path)
		}
		if err == errorInvalidFilePath {
			return b.localStore.WriteFile(fr, path)
		}
		appError, ok := err.(*model.AppError)
		if ok {
			appError.Where = "WriteFile"
			appError.Message = "Encountered an error writing to internal encrypted file storage."
			return 0, appError
		}
		return 0, model.NewAppError("WriteFile", "api.file.write_file_locally.writing.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return written, nil
}

func (b *InternalEncryptedFileBackend) AppendFile(fr io.Reader, path string) (int64, *model.AppError) {
	return 0, nil
}

func (b *InternalEncryptedFileBackend) RemoveFile(path string) *model.AppError {
	return nil
}

func (b *InternalEncryptedFileBackend) ListDirectory(path string) (*[]string, *model.AppError) {
	return new([]string), nil
}

func (b *InternalEncryptedFileBackend) RemoveDirectory(path string) *model.AppError {
	return nil
}

type pathInfo struct {
	date, teamId, channelId, userId, fileInfoId, filename, extension, fileType string
}

func (b *InternalEncryptedFileBackend) parsePath(path string) pathInfo {
	/*
		app/file.go 879L
		{date}/teams/{TeamId}/channels/{ChannelId}/users/{UserId}/{fileinfoId}/fileName
	*/

	paths := strings.Split(path, "/")
	if len(paths) < 8 {
		mlog.Warn("Cannot parse path info", mlog.String("path", path))
		return pathInfo{}
	}

	info := pathInfo{
		date:       paths[0],
		teamId:     paths[2],
		channelId:  paths[4],
		userId:     paths[6],
		fileInfoId: paths[7],
		filename:   paths[8],
	}

	part := strings.Split(info.filename, ".")
	info.extension = part[len(part)-1]

	switch {
	case strings.HasSuffix(part[len(part)-2], "preview"):
		info.fileType = "preview"
	case strings.HasSuffix(part[len(part)-2], "thumb"):
		info.fileType = "thumb"
	default:
		info.fileType = "file"
	}
	return info
}

func (b *InternalEncryptedFileBackend) fileInfo(path string) (*model.FileInfo, error) {
	pathInfo := b.parsePath(path)

	fileInfo, err := globalStore.FileInfo().Get(pathInfo.fileInfoId)
	if err != nil {
		errMsg := "Fail to get fileinfo. " + err.Error()
		mlog.Warn(errMsg, mlog.String("fileInfoId", pathInfo.fileInfoId), mlog.String("path", path), mlog.String("fileName", pathInfo.filename))
		return nil, &model.AppError{
			DetailedError: errMsg,
			StatusCode:    http.StatusInternalServerError,
		}
	}

	return fileInfo, nil
}

type UploadResponse struct {
	Ret      bool   `json:"ret"`
	FileName string `json:"fileName"`
	FileSize string `json:"fileSize"`
	FileType string `json:"fileType"`
	FileID   string `json:"fileID"`
	ErrMsg   string `json:"errMsg"`
}

type DownloadResponse struct {
	bytes       []byte
	bytesReader *bytes.Reader `json:"-"`
}

func (r *DownloadResponse) Read(p []byte) (n int, err error) {
	if r.bytesReader == nil {
		r.bytesReader = bytes.NewReader(r.bytes)
	}
	return r.bytesReader.Read(p)
}

func (r *DownloadResponse) Close() error {
	return nil
}
func (r *DownloadResponse) Seek(offset int64, whence int) (int64, error) {
	if r.bytesReader == nil {
		r.bytesReader = bytes.NewReader(r.bytes)
	}
	return r.bytesReader.Seek(offset, whence)
}
