// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"

	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"

	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

var (
	newline = []byte{'\n'}
)

func (a *App) ExportArchive(w io.Writer, opt model.ExportArchiveOptions) (errs error) {
	boards, err := a.getBoardsForArchive(opt.BoardIDs)
	if err != nil {
		return err
	}

	merr := merror.New()
	defer func() {
		errs = merr.ErrorOrNil()
	}()

	// wrap the writer in a zip.
	zw := zip.NewWriter(w)
	defer func() {
		merr.Append(zw.Close())
	}()

	if err := a.writeArchiveVersion(zw); err != nil {
		merr.Append(err)
		return
	}

	for _, board := range boards {
		if err := a.writeArchiveBoard(zw, board, opt); err != nil {
			merr.Append(fmt.Errorf("cannot export board %s: %w", board.ID, err))
			return
		}
	}
	return nil
}

// writeArchiveVersion writes a version file to the zip.
func (a *App) writeArchiveVersion(zw *zip.Writer) error {
	archiveHeader := model.ArchiveHeader{
		Version: archiveVersion,
		Date:    model.GetMillis(),
	}
	b, _ := json.Marshal(&archiveHeader)

	w, err := zw.Create("version.json")
	if err != nil {
		return fmt.Errorf("cannot write archive header: %w", err)
	}

	if _, err := w.Write(b); err != nil {
		return fmt.Errorf("cannot write archive header: %w", err)
	}
	return nil
}

// writeArchiveBoard writes a single board to the archive in a zip directory.
func (a *App) writeArchiveBoard(zw *zip.Writer, board model.Board, opt model.ExportArchiveOptions) error {
	// create a directory per board
	w, err := zw.Create(board.ID + "/board.jsonl")
	if err != nil {
		return err
	}

	// write the board block first
	if err = a.writeArchiveBoardLine(w, board); err != nil {
		return err
	}

	var files []string
	// write the board's blocks
	// TODO: paginate this
	blocks, err := a.GetBlocksForBoard(board.ID)
	if err != nil {
		return err
	}

	for _, block := range blocks {
		if err = a.writeArchiveBlockLine(w, block); err != nil {
			return err
		}
		if block.Type == model.TypeImage {
			filename, err2 := extractImageFilename(block)
			if err2 != nil {
				return err
			}
			files = append(files, filename)
		}
	}

	boardMembers, err := a.GetMembersForBoard(board.ID)
	if err != nil {
		return err
	}

	for _, boardMember := range boardMembers {
		if err = a.writeArchiveBoardMemberLine(w, boardMember); err != nil {
			return err
		}
	}

	// write the files
	for _, filename := range files {
		if err := a.writeArchiveFile(zw, filename, board.ID, opt); err != nil {
			return fmt.Errorf("cannot write file %s to archive: %w", filename, err)
		}
	}
	return nil
}

// writeArchiveBoardMemberLine writes a single boardMember to the archive.
func (a *App) writeArchiveBoardMemberLine(w io.Writer, boardMember *model.BoardMember) error {
	bm, err := json.Marshal(&boardMember)
	if err != nil {
		return err
	}
	line := model.ArchiveLine{
		Type: "boardMember",
		Data: bm,
	}

	bm, err = json.Marshal(&line)
	if err != nil {
		return err
	}

	_, err = w.Write(bm)
	if err != nil {
		return err
	}

	_, err = w.Write(newline)
	return err
}

// writeArchiveBlockLine writes a single block to the archive.
func (a *App) writeArchiveBlockLine(w io.Writer, block *model.Block) error {
	b, err := json.Marshal(&block)
	if err != nil {
		return err
	}
	line := model.ArchiveLine{
		Type: "block",
		Data: b,
	}

	b, err = json.Marshal(&line)
	if err != nil {
		return err
	}

	_, err = w.Write(b)
	if err != nil {
		return err
	}

	// jsonl files need a newline
	_, err = w.Write(newline)
	return err
}

// writeArchiveBlockLine writes a single block to the archive.
func (a *App) writeArchiveBoardLine(w io.Writer, board model.Board) error {
	b, err := json.Marshal(&board)
	if err != nil {
		return err
	}
	line := model.ArchiveLine{
		Type: "board",
		Data: b,
	}

	b, err = json.Marshal(&line)
	if err != nil {
		return err
	}

	_, err = w.Write(b)
	if err != nil {
		return err
	}

	// jsonl files need a newline
	_, err = w.Write(newline)
	return err
}

// writeArchiveFile writes a single file to the archive.
func (a *App) writeArchiveFile(zw *zip.Writer, filename string, boardID string, opt model.ExportArchiveOptions) error {
	dest, err := zw.Create(boardID + "/" + filename)
	if err != nil {
		return err
	}

	src, err := a.GetFileReader(opt.TeamID, boardID, filename)
	if err != nil {
		// just log this; image file is missing but we'll still export an equivalent board
		a.logger.Error("image file missing for export",
			mlog.String("filename", filename),
			mlog.String("team_id", opt.TeamID),
			mlog.String("board_id", boardID),
		)
		return nil
	}
	defer src.Close()

	_, err = io.Copy(dest, src)
	return err
}

// getBoardsForArchive fetches all the specified boards.
func (a *App) getBoardsForArchive(boardIDs []string) ([]model.Board, error) {
	boards := make([]model.Board, 0, len(boardIDs))

	for _, id := range boardIDs {
		b, err := a.GetBoard(id)
		if err != nil {
			return nil, fmt.Errorf("could not fetch board %s: %w", id, err)
		}

		boards = append(boards, *b)
	}
	return boards, nil
}

func extractImageFilename(imageBlock *model.Block) (string, error) {
	f, ok := imageBlock.Fields["fileId"]
	if !ok {
		return "", model.ErrInvalidImageBlock
	}

	filename, ok := f.(string)
	if !ok {
		return "", model.ErrInvalidImageBlock
	}
	return filename, nil
}
