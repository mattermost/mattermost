package app

import (
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	mmModel "github.com/mattermost/mattermost-server/v6/model"

	"github.com/mattermost/mattermost-server/v6/boards/utils"
	"github.com/mattermost/mattermost-server/v6/platform/shared/filestore"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

const emptyString = "empty"

var errEmptyFilename = errors.New("IsFileArchived: empty filename not allowed")
var ErrFileNotFound = errors.New("file not found")

func (a *App) SaveFile(reader io.Reader, teamID, rootID, filename string) (string, error) {
	// NOTE: File extension includes the dot
	fileExtension := strings.ToLower(filepath.Ext(filename))
	if fileExtension == ".jpeg" {
		fileExtension = ".jpg"
	}

	createdFilename := utils.NewID(utils.IDTypeNone)
	fullFilename := fmt.Sprintf(`%s%s`, createdFilename, fileExtension)
	filePath := filepath.Join(teamID, rootID, fullFilename)

	fileSize, appErr := a.filesBackend.WriteFile(reader, filePath)
	if appErr != nil {
		return "", fmt.Errorf("unable to store the file in the files storage: %w", appErr)
	}

	now := utils.GetMillis()

	fileInfo := &mmModel.FileInfo{
		Id:              createdFilename[1:],
		CreatorId:       "boards",
		PostId:          emptyString,
		ChannelId:       emptyString,
		CreateAt:        now,
		UpdateAt:        now,
		DeleteAt:        0,
		Path:            emptyString,
		ThumbnailPath:   emptyString,
		PreviewPath:     emptyString,
		Name:            filename,
		Extension:       fileExtension,
		Size:            fileSize,
		MimeType:        emptyString,
		Width:           0,
		Height:          0,
		HasPreviewImage: false,
		MiniPreview:     nil,
		Content:         "",
		RemoteId:        nil,
	}
	err := a.store.SaveFileInfo(fileInfo)
	if err != nil {
		return "", err
	}

	return fullFilename, nil
}

func (a *App) GetFileInfo(filename string) (*mmModel.FileInfo, error) {
	if len(filename) == 0 {
		return nil, errEmptyFilename
	}

	// filename is in the format 7<some-alphanumeric-string>.<extension>
	// we want to extract the <some-alphanumeric-string> part of this as this
	// will be the fileinfo id.
	parts := strings.Split(filename, ".")
	fileInfoID := parts[0][1:]
	fileInfo, err := a.store.GetFileInfo(fileInfoID)
	if err != nil {
		return nil, err
	}

	return fileInfo, nil
}

func (a *App) GetFileReader(teamID, rootID, filename string) (filestore.ReadCloseSeeker, error) {
	filePath := filepath.Join(teamID, rootID, filename)
	exists, err := a.filesBackend.FileExists(filePath)
	if err != nil {
		return nil, err
	}
	// FIXUP: Check the deprecated old location
	if teamID == "0" && !exists {
		oldExists, err2 := a.filesBackend.FileExists(filename)
		if err2 != nil {
			return nil, err2
		}
		if oldExists {
			err2 := a.filesBackend.MoveFile(filename, filePath)
			if err2 != nil {
				a.logger.Error("ERROR moving file",
					mlog.String("old", filename),
					mlog.String("new", filePath),
					mlog.Err(err2),
				)
			} else {
				a.logger.Debug("Moved file",
					mlog.String("old", filename),
					mlog.String("new", filePath),
				)
			}
		}
	} else if !exists {
		return nil, ErrFileNotFound
	}

	reader, err := a.filesBackend.Reader(filePath)
	if err != nil {
		return nil, err
	}

	return reader, nil
}

func (a *App) MoveFile(channelID, teamID, boardID, filename string) error {
	oldPath := filepath.Join(channelID, boardID, filename)
	newPath := filepath.Join(teamID, boardID, filename)
	err := a.filesBackend.MoveFile(oldPath, newPath)
	if err != nil {
		a.logger.Error("ERROR moving file",
			mlog.String("old", oldPath),
			mlog.String("new", newPath),
			mlog.Err(err),
		)
		return err
	}
	return nil
}
