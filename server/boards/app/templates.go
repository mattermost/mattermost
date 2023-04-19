// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/server/v8/boards/assets"
	"github.com/mattermost/mattermost-server/server/v8/boards/model"

	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

const (
	defaultTemplateVersion = 6 // bump this number to force default templates to be re-imported
)

func (a *App) InitTemplates() error {
	_, err := a.initializeTemplates()
	return err
}

// initializeTemplates imports default templates if the boards table is empty.
func (a *App) initializeTemplates() (bool, error) {
	boards, err := a.store.GetTemplateBoards(model.GlobalTeamID, "")
	if err != nil {
		return false, fmt.Errorf("cannot initialize templates: %w", err)
	}

	a.logger.Debug("Fetched template boards", mlog.Int("count", len(boards)))

	isNeeded, reason := a.isInitializationNeeded(boards)
	if !isNeeded {
		a.logger.Debug("Template import not needed, skipping")
		return false, nil
	}

	a.logger.Debug("Importing new default templates",
		mlog.String("reason", reason),
		mlog.Int("size", len(assets.DefaultTemplatesArchive)),
	)

	// Remove in case of newer Templates
	if err = a.store.RemoveDefaultTemplates(boards); err != nil {
		return false, fmt.Errorf("cannot remove old template boards: %w", err)
	}

	r := bytes.NewReader(assets.DefaultTemplatesArchive)

	opt := model.ImportArchiveOptions{
		TeamID:        model.GlobalTeamID,
		ModifiedBy:    model.SystemUserID,
		BlockModifier: fixTemplateBlock,
		BoardModifier: fixTemplateBoard,
	}
	if err = a.ImportArchive(r, opt); err != nil {
		return false, fmt.Errorf("cannot initialize global templates for team %s: %w", model.GlobalTeamID, err)
	}
	return true, nil
}

// isInitializationNeeded returns true if the blocks table contains no default templates,
// or contains at least one default template with an old version number.
func (a *App) isInitializationNeeded(boards []*model.Board) (bool, string) {
	if len(boards) == 0 {
		return true, "no default templates found"
	}

	// look for any built-in template boards with the wrong version number (or no version #).
	for _, board := range boards {
		// if not built-in board...skip
		if board.CreatedBy != model.SystemUserID {
			continue
		}
		if board.TemplateVersion < defaultTemplateVersion {
			return true, "template_version too old"
		}
	}
	return false, ""
}

// fixTemplateBlock fixes a block to be inserted as part of a template.
func fixTemplateBlock(block *model.Block, cache map[string]interface{}) bool {
	// cache contains ids of skipped boards. Ensure their children are skipped as well.
	if _, ok := cache[block.BoardID]; ok {
		cache[block.ID] = struct{}{}
		return false
	}

	if _, ok := cache[block.ParentID]; ok {
		cache[block.ID] = struct{}{}
		return false
	}
	return true
}

// fixTemplateBoard fixes a board to be inserted as part of a template.
func fixTemplateBoard(board *model.Board, cache map[string]interface{}) bool {
	// filter out template blocks; we only want the non-template
	// blocks which we will turn into default template blocks.
	if board.IsTemplate {
		cache[board.ID] = struct{}{}
		return false
	}

	// remove '(NEW)' from title & force template flag
	board.Title = strings.ReplaceAll(board.Title, "(NEW)", "")
	board.IsTemplate = true
	board.TemplateVersion = defaultTemplateVersion
	board.Type = model.BoardTypeOpen
	return true
}
