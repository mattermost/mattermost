// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	mm_model "github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/utils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

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
	if asTemplate {
		newFileName = filename
	}
	filePath := getDestinationFilePath(asTemplate, teamID, boardID, newFileName)

	fileSize, appErr := a.filesBackend.WriteFile(reader, filePath)
	if appErr != nil {
		return "", fmt.Errorf("unable to store the file in the files storage: %w", appErr)
	}

	fileInfo := model.NewFileInfo(filename)
	fileInfo.Id = getFileInfoID(createdFilename)
	fileInfo.Path = filePath
	fileInfo.Size = fileSize
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
	fileInfoID := getFileInfoID(strings.Split(filename, ".")[0])
	fileInfo, err := a.store.GetFileInfo(fileInfoID)
	if err != nil {
		return nil, err
	}

	return fileInfo, nil
}

func (a *App) GetFile(teamID, rootID, fileName string) (*mm_model.FileInfo, filestore.ReadCloseSeeker, error) {
	fileInfo, filePath, err := a.GetFilePath(teamID, rootID, fileName)
	if err != nil {
		a.logger.Error("GetFile: Failed to GetFilePath.", mlog.String("Team", teamID), mlog.String("board", rootID), mlog.String("filename", fileName), mlog.Err(err))
		return nil, nil, err
	}

	exists, err := a.filesBackend.FileExists(filePath)
	if err != nil {
		a.logger.Error("GetFile: Failed to check if file exists as path. ", mlog.String("Path", filePath), mlog.Err(err))
		return nil, nil, err
	}
	if !exists {
		return nil, nil, ErrFileNotFound
	}

	reader, err := a.filesBackend.Reader(filePath)
	if err != nil {
		a.logger.Error("GetFile: Failed to get file reader of existing file at path", mlog.String("Path", filePath), mlog.Err(err))
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

func getDestinationFilePath(isTemplate bool, teamID, boardID, filename string) string {
	// if saving a file for a template, save using the "old method" that is /teamID/boardID/fileName
	// this will prevent template files from being deleted by DataRetention,
	// which deletes all files inside the "date" subdirectory
	if isTemplate {
		return filepath.Join(teamID, boardID, filename)
	}
	return filepath.Join(utils.GetBaseFilePath(), filename)
}

func getFileInfoID(fileName string) string {
	// Boards ids are 27 characters long with a prefix character.
	// removing the prefix, returns the 26 character uuid
	return fileName[1:]
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
	newFileNames, err := a.CopyCardFiles(boardID, blocks, asTemplate)
	if err != nil {
		a.logger.Error("Could not copy files while duplicating board", mlog.String("BoardID", boardID), mlog.Err(err))
	}

	// blocks now has updated file ids for any blocks containing files.  We need to update the database for them.
	blockIDs := make([]string, 0)
	blockPatches := make([]model.BlockPatch, 0)
	for _, block := range blocks {
		if block.Type == model.TypeImage || block.Type == model.TypeAttachment {
			if fileID, ok := block.Fields["fileId"].(string); ok {
				blockIDs = append(blockIDs, block.ID)
				blockPatches = append(blockPatches, model.BlockPatch{
					UpdatedFields: map[string]interface{}{
						"fileId": newFileNames[fileID],
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

func (a *App) CopyCardFiles(sourceBoardID string, copiedBlocks []*model.Block, asTemplate bool) (map[string]string, error) {
	// Images attached in cards have a path comprising the card's board ID.
	// When we create a template from this board, we need to copy the files
	// with the new board ID in path.
	// Not doing so causing images in templates (and boards created from this
	// template) to fail to load.

	// look up ID of source sourceBoard, which may be different than the blocks.
	sourceBoard, err := a.GetBoard(sourceBoardID)
	if err != nil || sourceBoard == nil {
		return nil, fmt.Errorf("cannot fetch source board %s for CopyCardFiles: %w", sourceBoardID, err)
	}

	var destBoard *model.Board
	newFileNames := make(map[string]string)
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
					return nil, fmt.Errorf("cannot fetch destination board %s for CopyCardFiles: %w", sourceBoardID, err)
				}
			}
		}

		// GetFilePath will retrieve the correct path
		// depending on whether FileInfo table is used for the file.
		fileInfo, sourceFilePath, err := a.GetFilePath(sourceBoard.TeamID, sourceBoard.ID, fileId)
		if err != nil {
			return nil, fmt.Errorf("cannot fetch destination board %s for CopyCardFiles: %w", sourceBoardID, err)
		}
		destinationFilePath := getDestinationFilePath(asTemplate, destBoard.TeamID, destBoard.ID, destFilename)

		if fileInfo == nil {
			fileInfo = model.NewFileInfo(destFilename)
		}
		fileInfo.Id = getFileInfoID(fileInfoID)
		fileInfo.Path = destinationFilePath
		err = a.store.SaveFileInfo(fileInfo)
		if err != nil {
			return nil, fmt.Errorf("CopyCardFiles: cannot create fileinfo: %w", err)
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
		newFileNames[fileId] = destFilename
	}

	return newFileNames, nil
}
