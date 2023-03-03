// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"path"
	"path/filepath"
	"strings"

	"github.com/krolaw/zipstream"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/utils"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

const (
	archiveVersion  = 2
	legacyFileBegin = "{\"version\":1"
)

var (
	errBlockIsNotABoard = errors.New("block is not a board")
)

// ImportArchive imports an archive containing zero or more boards, plus all
// associated content, including cards, content blocks, views, and images.
//
// Archives are ZIP files containing a `version.json` file and zero or more
// directories, each containing a `board.jsonl` and zero or more image files.
func (a *App) ImportArchive(r io.Reader, opt model.ImportArchiveOptions) error {
	// peek at the first bytes to see if this is a legacy archive format
	br := bufio.NewReader(r)
	peek, err := br.Peek(len(legacyFileBegin))
	if err == nil && string(peek) == legacyFileBegin {
		a.logger.Debug("importing legacy archive")
		_, errImport := a.ImportBoardJSONL(br, opt)

		go func() {
			if err := a.UpdateCardLimitTimestamp(); err != nil {
				a.logger.Error(
					"UpdateCardLimitTimestamp failed after importing a legacy file",
					mlog.Err(err),
				)
			}
		}()

		return errImport
	}

	a.logger.Debug("importing archive")
	zr := zipstream.NewReader(br)

	boardMap := make(map[string]string) // maps old board ids to new

	for {
		hdr, err := zr.Next()
		if err != nil {
			if errors.Is(err, io.EOF) {
				a.logger.Debug("import archive - done", mlog.Int("boards_imported", len(boardMap)))
				return nil
			}
			return err
		}

		dir, filename := filepath.Split(hdr.Name)
		dir = path.Clean(dir)

		switch filename {
		case "version.json":
			ver, errVer := parseVersionFile(zr)
			if errVer != nil {
				return errVer
			}
			if ver != archiveVersion {
				return model.NewErrUnsupportedArchiveVersion(ver, archiveVersion)
			}
		case "board.jsonl":
			boardID, err := a.ImportBoardJSONL(zr, opt)
			if err != nil {
				return fmt.Errorf("cannot import board %s: %w", dir, err)
			}
			boardMap[dir] = boardID
		default:
			// import file/image;  dir is the old board id
			boardID, ok := boardMap[dir]
			if !ok {
				a.logger.Warn("skipping orphan image in archive",
					mlog.String("dir", dir),
					mlog.String("filename", filename),
				)
				continue
			}
			// save file with original filename so it matches name in image block.
			filePath := filepath.Join(opt.TeamID, boardID, filename)
			_, err := a.filesBackend.WriteFile(zr, filePath)
			if err != nil {
				return fmt.Errorf("cannot import file %s for board %s: %w", filename, dir, err)
			}
		}

		a.logger.Trace("import archive file",
			mlog.String("dir", dir),
			mlog.String("filename", filename),
		)

		go func() {
			if err := a.UpdateCardLimitTimestamp(); err != nil {
				a.logger.Error(
					"UpdateCardLimitTimestamp failed after importing an archive",
					mlog.Err(err),
				)
			}
		}()
	}
}

// ImportBoardJSONL imports a JSONL file containing blocks for one board. The resulting
// board id is returned.
func (a *App) ImportBoardJSONL(r io.Reader, opt model.ImportArchiveOptions) (string, error) {
	// TODO: Stream this once `model.GenerateBlockIDs` can take a stream of blocks.
	//       We don't want to load the whole file in memory, even though it's a single board.
	boardsAndBlocks := &model.BoardsAndBlocks{
		Blocks: make([]*model.Block, 0, 10),
		Boards: make([]*model.Board, 0, 10),
	}
	lineReader := bufio.NewReader(r)

	userID := opt.ModifiedBy
	if userID == model.SingleUser {
		userID = ""
	}
	now := utils.GetMillis()
	var boardID string
	var boardMembers []*model.BoardMember

	lineNum := 1
	firstLine := true
	for {
		line, errRead := readLine(lineReader)
		if len(line) != 0 {
			var skip bool
			if firstLine {
				// first line might be a header tag (old archive format)
				if strings.HasPrefix(string(line), legacyFileBegin) {
					skip = true
				}
			}

			if !skip {
				var archiveLine model.ArchiveLine
				if err := json.Unmarshal(line, &archiveLine); err != nil {
					return "", fmt.Errorf("error parsing archive line %d: %w", lineNum, err)
				}

				// first line must be a board
				if firstLine && archiveLine.Type == "block" {
					archiveLine.Type = "board_block"
				}

				switch archiveLine.Type {
				case "board":
					var board model.Board
					if err2 := json.Unmarshal(archiveLine.Data, &board); err2 != nil {
						return "", fmt.Errorf("invalid board in archive line %d: %w", lineNum, err2)
					}
					board.ModifiedBy = userID
					board.UpdateAt = now
					board.TeamID = opt.TeamID
					boardsAndBlocks.Boards = append(boardsAndBlocks.Boards, &board)
					boardID = board.ID
				case "board_block":
					// legacy archives encoded boards as blocks; we need to convert them to real boards.
					var block *model.Block
					if err2 := json.Unmarshal(archiveLine.Data, &block); err2 != nil {
						return "", fmt.Errorf("invalid board block in archive line %d: %w", lineNum, err2)
					}
					block.ModifiedBy = userID
					block.UpdateAt = now
					board, err := a.blockToBoard(block, opt)
					if err != nil {
						return "", fmt.Errorf("cannot convert archive line %d to block: %w", lineNum, err)
					}
					boardsAndBlocks.Boards = append(boardsAndBlocks.Boards, board)
					boardID = board.ID
				case "block":
					var block *model.Block
					if err2 := json.Unmarshal(archiveLine.Data, &block); err2 != nil {
						return "", fmt.Errorf("invalid block in archive line %d: %w", lineNum, err2)
					}
					block.ModifiedBy = userID
					block.UpdateAt = now
					block.BoardID = boardID
					boardsAndBlocks.Blocks = append(boardsAndBlocks.Blocks, block)
				case "boardMember":
					var boardMember *model.BoardMember
					if err2 := json.Unmarshal(archiveLine.Data, &boardMember); err2 != nil {
						return "", fmt.Errorf("invalid board Member in archive line %d: %w", lineNum, err2)
					}
					boardMembers = append(boardMembers, boardMember)
				default:
					return "", model.NewErrUnsupportedArchiveLineType(lineNum, archiveLine.Type)
				}
				firstLine = false
			}
		}

		if errRead != nil {
			if errors.Is(errRead, io.EOF) {
				break
			}
			return "", fmt.Errorf("error reading archive line %d: %w", lineNum, errRead)
		}
		lineNum++
	}

	// loop to remove the people how are not part of the team and system
	for i := len(boardMembers) - 1; i >= 0; i-- {
		if _, err := a.GetUser(boardMembers[i].UserID); err != nil {
			boardMembers = append(boardMembers[:i], boardMembers[i+1:]...)
		}
	}

	a.fixBoardsandBlocks(boardsAndBlocks, opt)

	var err error
	boardsAndBlocks, err = model.GenerateBoardsAndBlocksIDs(boardsAndBlocks, a.logger)
	if err != nil {
		return "", fmt.Errorf("error generating archive block IDs: %w", err)
	}

	boardsAndBlocks, err = a.CreateBoardsAndBlocks(boardsAndBlocks, opt.ModifiedBy, false)
	if err != nil {
		return "", fmt.Errorf("error inserting archive blocks: %w", err)
	}

	// add users to all the new boards (if not the fake system user).
	for _, board := range boardsAndBlocks.Boards {
		// make sure an admin user gets added
		adminMember := &model.BoardMember{
			BoardID:     board.ID,
			UserID:      opt.ModifiedBy,
			SchemeAdmin: true,
		}
		if _, err2 := a.AddMemberToBoard(adminMember); err2 != nil {
			return "", fmt.Errorf("cannot add adminMember to board: %w", err2)
		}
		for _, boardMember := range boardMembers {
			bm := &model.BoardMember{
				BoardID:         board.ID,
				UserID:          boardMember.UserID,
				Roles:           boardMember.Roles,
				MinimumRole:     boardMember.MinimumRole,
				SchemeAdmin:     boardMember.SchemeAdmin,
				SchemeEditor:    boardMember.SchemeEditor,
				SchemeCommenter: boardMember.SchemeCommenter,
				SchemeViewer:    boardMember.SchemeViewer,
				Synthetic:       boardMember.Synthetic,
			}
			if _, err2 := a.AddMemberToBoard(bm); err2 != nil {
				return "", fmt.Errorf("cannot add member to board: %w", err2)
			}
		}
	}

	// find new board id
	for _, board := range boardsAndBlocks.Boards {
		return board.ID, nil
	}
	return "", fmt.Errorf("missing board in archive: %w", model.ErrInvalidBoardBlock)
}

// fixBoardsandBlocks allows the caller of `ImportArchive` to modify or filters boards and blocks being
// imported via callbacks.
func (a *App) fixBoardsandBlocks(boardsAndBlocks *model.BoardsAndBlocks, opt model.ImportArchiveOptions) {
	if opt.BlockModifier == nil && opt.BoardModifier == nil {
		return
	}

	modInfoCache := make(map[string]interface{})
	modBoards := make([]*model.Board, 0, len(boardsAndBlocks.Boards))
	modBlocks := make([]*model.Block, 0, len(boardsAndBlocks.Blocks))

	for _, board := range boardsAndBlocks.Boards {
		b := *board
		if opt.BoardModifier != nil && !opt.BoardModifier(&b, modInfoCache) {
			a.logger.Debug("skipping insert board per board modifier",
				mlog.String("boardID", board.ID),
			)
			continue
		}
		modBoards = append(modBoards, &b)
	}

	for _, block := range boardsAndBlocks.Blocks {
		b := block
		if opt.BlockModifier != nil && !opt.BlockModifier(b, modInfoCache) {
			a.logger.Debug("skipping insert block per block modifier",
				mlog.String("blockID", block.ID),
			)
			continue
		}
		modBlocks = append(modBlocks, b)
	}

	boardsAndBlocks.Boards = modBoards
	boardsAndBlocks.Blocks = modBlocks
}

// blockToBoard converts a `model.Block` to `model.Board`. Legacy archive formats encode boards as blocks
// and need conversion during import.
func (a *App) blockToBoard(block *model.Block, opt model.ImportArchiveOptions) (*model.Board, error) {
	if block.Type != model.TypeBoard {
		return nil, errBlockIsNotABoard
	}

	board := &model.Board{
		ID:             block.ID,
		TeamID:         opt.TeamID,
		CreatedBy:      block.CreatedBy,
		ModifiedBy:     block.ModifiedBy,
		Type:           model.BoardTypePrivate,
		Title:          block.Title,
		CreateAt:       block.CreateAt,
		UpdateAt:       block.UpdateAt,
		DeleteAt:       block.DeleteAt,
		Properties:     make(map[string]interface{}),
		CardProperties: make([]map[string]interface{}, 0),
	}

	if icon, ok := stringValue(block.Fields, "icon"); ok {
		board.Icon = icon
	}
	if description, ok := stringValue(block.Fields, "description"); ok {
		board.Description = description
	}
	if showDescription, ok := boolValue(block.Fields, "showDescription"); ok {
		board.ShowDescription = showDescription
	}
	if isTemplate, ok := boolValue(block.Fields, "isTemplate"); ok {
		board.IsTemplate = isTemplate
	}
	if templateVer, ok := intValue(block.Fields, "templateVer"); ok {
		board.TemplateVersion = templateVer
	}
	if properties, ok := mapValue(block.Fields, "properties"); ok {
		board.Properties = properties
	}
	if cardProperties, ok := arrayMapsValue(block.Fields, "cardProperties"); ok {
		board.CardProperties = cardProperties
	}
	return board, nil
}

func stringValue(m map[string]interface{}, key string) (string, bool) {
	v, ok := m[key]
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	if !ok {
		return "", false
	}
	return s, true
}

func boolValue(m map[string]interface{}, key string) (bool, bool) {
	v, ok := m[key]
	if !ok {
		return false, false
	}
	b, ok := v.(bool)
	if !ok {
		return false, false
	}
	return b, true
}

func intValue(m map[string]interface{}, key string) (int, bool) {
	v, ok := m[key]
	if !ok {
		return 0, false
	}
	i, ok := v.(int)
	if !ok {
		return 0, false
	}
	return i, true
}

func mapValue(m map[string]interface{}, key string) (map[string]interface{}, bool) {
	v, ok := m[key]
	if !ok {
		return nil, false
	}
	mm, ok := v.(map[string]interface{})
	if !ok {
		return nil, false
	}
	return mm, true
}

func arrayMapsValue(m map[string]interface{}, key string) ([]map[string]interface{}, bool) {
	v, ok := m[key]
	if !ok {
		return nil, false
	}
	ai, ok := v.([]interface{})
	if !ok {
		return nil, false
	}

	arr := make([]map[string]interface{}, 0, len(ai))
	for _, mi := range ai {
		mm, ok := mi.(map[string]interface{})
		if !ok {
			return nil, false
		}
		arr = append(arr, mm)
	}
	return arr, true
}

func parseVersionFile(r io.Reader) (int, error) {
	file, err := io.ReadAll(r)
	if err != nil {
		return 0, fmt.Errorf("cannot read version.json: %w", err)
	}

	var header model.ArchiveHeader
	if err := json.Unmarshal(file, &header); err != nil {
		return 0, fmt.Errorf("cannot parse version.json: %w", err)
	}
	return header.Version, nil
}

func readLine(r *bufio.Reader) ([]byte, error) {
	line, err := r.ReadBytes('\n')
	line = bytes.TrimSpace(line)
	return line, err
}
