// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	mm_model "github.com/mattermost/mattermost-server/server/v8/model"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

const emptyString = "empty"

var errEmptyFilename = errors.New("IsFileArchived: empty filename not allowed")
var ErrFileNotFound = errors.New("file not found")

func (a *App) SaveFile(reader io.Reader, teamID, boardID, filename string, asTemplate bool) (string, error) {
	// NOTE: File extension includes the dot
	fileExtension := strings.ToLower(filepath.Ext(filename))
	if fileExtension == ".jpeg" {
		fileExtension = ".jpg"
	}

	createdFilename := utils.NewID(utils.IDTypeNone)
	newFileName := fmt.Sprintf(`%s%s`, createdFilename, fileExtension)
	filePath := filepath.Join(utils.GetBaseFilePath(), newFileName)

	// if saving a file for a template, save using the "old method" that is /teamID/boardID/fileName
	// this will prevent template files from being deleted by DataRetention,
	// which deletes all files inside the "date" subdirectory
	if asTemplate {
		filePath = filepath.Join(teamID, boardID, filename)
		newFileName = filename
	}

	fileSize, appErr := a.filesBackend.WriteFile(reader, filePath)
	if appErr != nil {
		return "", fmt.Errorf("unable to store the file in the files storage: %w", appErr)
	}

	now := utils.GetMillis()

	fileInfo := &mm_model.FileInfo{
		Id:              createdFilename[1:],
		CreatorId:       "boards",
		PostId:          emptyString,
		ChannelId:       emptyString,
		CreateAt:        now,
		UpdateAt:        now,
		DeleteAt:        0,
		Path:            filePath,
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
	return newFileName, nil
}

func (a *App) GetFileInfo(filename string) (*mm_model.FileInfo, error) {
	if filename == "" {
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

func (a *App) GetFile(teamID, rootID, fileName string) (*mm_model.FileInfo, filestore.ReadCloseSeeker, error) {
	fileInfo, filePath, err := a.GetFilePath(teamID, rootID, fileName)
	if err != nil {
		a.logger.Error(fmt.Sprintf("GetFile: Failed to GetFilePath. Team: %s, board: %s, filename: %s, error: %e", teamID, rootID, fileName, err))
		return nil, nil, err
	}

	exists, err := a.filesBackend.FileExists(filePath)
	if err != nil {
		a.logger.Error(fmt.Sprintf("GetFile: Failed to check if file exists as path. Path: %s, error: %e", filePath, err))
		return nil, nil, err
	}
	if !exists {
		return nil, nil, ErrFileNotFound
	}

	reader, err := a.filesBackend.Reader(filePath)
	if err != nil {
		a.logger.Error(fmt.Sprintf("GetFile: Failed to get file reader of existing file at path: %s, error: %e", filePath, err))
		return nil, nil, err
	}
	return fileInfo, reader, nil
}

func (a *App) GetFilePath(teamID, rootID, fileName string) (*mm_model.FileInfo, string, error) {
	fileInfo, err := a.GetFileInfo(fileName)
	if err != nil && !model.IsErrNotFound(err) {
		return nil, "", err
	}

	var filePath string

	if fileInfo != nil && fileInfo.Path != "" {
		filePath = fileInfo.Path
	} else {
		filePath = filepath.Join(teamID, rootID, fileName)
	}

	return fileInfo, filePath, nil
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

func (a *App) CopyAndUpdateCardFiles(boardID, userID string, blocks []*model.Block, asTemplate bool) error {
	if err := a.CopyCardFiles(boardID, blocks, asTemplate); err != nil {
		a.logger.Error("Could not copy files while duplicating board", mlog.String("BoardID", boardID), mlog.Err(err))
	}

	// blocks now has updated file ids for any blocks containing files.  We need to update the database for them.
	blockIDs := make([]string, 0)
	blockPatches := make([]model.BlockPatch, 0)
	for _, block := range blocks {
		if block.Type == model.TypeImage || block.Type == model.TypeAttachment {
			fieldName := "fileId"
			if fileID, ok := block.Fields[fieldName]; ok {
				blockIDs = append(blockIDs, block.ID)
				blockPatches = append(blockPatches, model.BlockPatch{
					UpdatedFields: map[string]interface{}{
						fieldName: fileID,
					},
					DeletedFields: []string{"attachmentId"},
				})
			}
		}
	}
	a.logger.Debug("Duplicate boards patching file IDs", mlog.Int("count", len(blockIDs)))

	if len(blockIDs) != 0 {
		patches := &model.BlockPatchBatch{
			BlockIDs:     blockIDs,
			BlockPatches: blockPatches,
		}
		if err := a.store.PatchBlocks(patches, userID); err != nil {
			return fmt.Errorf("could not patch file IDs while duplicating board %s: %w", boardID, err)
		}
	}

	return nil
}

func (a *App) CopyCardFiles(sourceBoardID string, copiedBlocks []*model.Block, asTemplate bool) error {
	// Images attached in cards have a path comprising the card's board ID.
	// When we create a template from this board, we need to copy the files
	// with the new board ID in path.
	// Not doing so causing images in templates (and boards created from this
	// template) to fail to load.

	// look up ID of source sourceBoard, which may be different than the blocks.
	sourceBoard, err := a.GetBoard(sourceBoardID)
	if err != nil || sourceBoard == nil {
		return fmt.Errorf("cannot fetch source board %s for CopyCardFiles: %w", sourceBoardID, err)
	}

	var destBoard *model.Board

	for _, block := range copiedBlocks {
		if block.Type != model.TypeImage && block.Type != model.TypeAttachment {
			continue
		}

		fileId, isOk := block.Fields["fileId"].(string)
		if !isOk {
			fileId, isOk = block.Fields["attachmentId"].(string)
			if !isOk {
				continue
			}
		}

		// create unique filename
		ext := filepath.Ext(fileId)
		fileInfoID := utils.NewID(utils.IDTypeNone)
		destFilename := fileInfoID + ext

		if destBoard == nil || block.BoardID != destBoard.ID {
			destBoard = sourceBoard
			if block.BoardID != destBoard.ID {
				destBoard, err = a.GetBoard(block.BoardID)
				if err != nil {
					return fmt.Errorf("cannot fetch destination board %s for CopyCardFiles: %w", sourceBoardID, err)
				}
			}
		}

		// GetFilePath will retrieve the correct path
		// depending on whether FileInfo table is used for the file.
		fileInfo, sourceFilePath, err := a.GetFilePath(sourceBoard.TeamID, sourceBoard.ID, fileId)
		if err != nil {
			return fmt.Errorf("cannot fetch destination board %s for CopyCardFiles: %w", sourceBoardID, err)
		}

		destinationFilePath := filepath.Join(utils.GetBaseFilePath(), destFilename)
		// Global Templates are handled via Import, if user-defined templates
		// are to be stored by team. Won't be deleted by Data Retention
		if asTemplate {
			destinationFilePath = filepath.Join(destBoard.TeamID, destBoard.ID, destFilename)
		}
		if fileInfo == nil {
			ext = filepath.Ext(sourceFilePath)
			now := utils.GetMillis()
			fileInfo = &mm_model.FileInfo{
				Id:              fileInfoID[1:],
				CreatorId:       "boards",
				PostId:          emptyString,
				ChannelId:       emptyString,
				CreateAt:        now,
				UpdateAt:        now,
				DeleteAt:        0,
				Path:            destinationFilePath,
				ThumbnailPath:   emptyString,
				PreviewPath:     emptyString,
				Name:            destFilename,
				Extension:       ext,
				Size:            0,
				MimeType:        emptyString,
				Width:           0,
				Height:          0,
				HasPreviewImage: false,
				MiniPreview:     nil,
				Content:         "",
				RemoteId:        nil,
			}
		} else {
			fileInfo.Id = fileInfoID[1:]
			fileInfo.Path = destinationFilePath
		}
		err = a.store.SaveFileInfo(fileInfo)
		if err != nil {
			return fmt.Errorf("CopyCardFiles: cannot create fileinfo: %w", err)
		}

		a.logger.Debug(
			"Copying card file",
			mlog.String("sourceFilePath", sourceFilePath),
			mlog.String("destinationFilePath", destinationFilePath),
		)

		if err := a.filesBackend.CopyFile(sourceFilePath, destinationFilePath); err != nil {
			a.logger.Error(
				"CopyCardFiles failed to copy file",
				mlog.String("sourceFilePath", sourceFilePath),
				mlog.String("destinationFilePath", destinationFilePath),
				mlog.Err(err),
			)
		}
		block.Fields["fileId"] = destFilename
	}

	return nil
}
