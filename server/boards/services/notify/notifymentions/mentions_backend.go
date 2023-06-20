// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package notifymentions

import (
	"errors"
	"fmt"
	"sync"

	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost/server/v8/boards/model"
	"github.com/mattermost/mattermost/server/v8/boards/services/notify"
	"github.com/mattermost/mattermost/server/v8/boards/services/permissions"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	backendName = "notifyMentions"
)

var (
	ErrMentionPermission = errors.New("mention not permitted")
)

type MentionListener interface {
	OnMention(userID string, evt notify.BlockChangeEvent)
}

type BackendParams struct {
	AppAPI      AppAPI
	Permissions permissions.PermissionsService
	Delivery    MentionDelivery
	Logger      mlog.LoggerIFace
}

// Backend provides the notification backend for @mentions.
type Backend struct {
	appAPI      AppAPI
	permissions permissions.PermissionsService
	delivery    MentionDelivery
	logger      mlog.LoggerIFace

	mux       sync.RWMutex
	listeners []MentionListener
}

func New(params BackendParams) *Backend {
	return &Backend{
		appAPI:      params.AppAPI,
		permissions: params.Permissions,
		delivery:    params.Delivery,
		logger:      params.Logger,
	}
}

func (b *Backend) Start() error {
	return nil
}

func (b *Backend) ShutDown() error {
	_ = b.logger.Flush()
	return nil
}

func (b *Backend) Name() string {
	return backendName
}

func (b *Backend) AddListener(l MentionListener) {
	b.mux.Lock()
	defer b.mux.Unlock()
	b.listeners = append(b.listeners, l)
	b.logger.Debug("Mention listener added.", mlog.Int("listener_count", len(b.listeners)))
}

func (b *Backend) RemoveListener(l MentionListener) {
	b.mux.Lock()
	defer b.mux.Unlock()
	list := make([]MentionListener, 0, len(b.listeners))
	for _, listener := range b.listeners {
		if listener != l {
			list = append(list, listener)
		}
	}
	b.listeners = list
	b.logger.Debug("Mention listener removed.", mlog.Int("listener_count", len(b.listeners)))
}

func (b *Backend) BlockChanged(evt notify.BlockChangeEvent) error {
	if evt.Board == nil || evt.Card == nil {
		return nil
	}

	if evt.Action == notify.Delete {
		return nil
	}

	switch evt.BlockChanged.Type {
	case model.TypeText, model.TypeComment, model.TypeImage:
	default:
		return nil
	}

	mentions := extractMentions(evt.BlockChanged)
	if len(mentions) == 0 {
		return nil
	}

	oldMentions := extractMentions(evt.BlockOld)
	merr := merror.New()

	b.mux.RLock()
	listeners := make([]MentionListener, len(b.listeners))
	copy(listeners, b.listeners)
	b.mux.RUnlock()

	for username := range mentions {
		if _, exists := oldMentions[username]; exists {
			// the mention already existed; no need to notify again
			continue
		}

		extract := extractText(evt.BlockChanged.Title, username, newLimits())

		userID, err := b.deliverMentionNotification(username, extract, evt)
		if err != nil {
			if errors.Is(err, ErrMentionPermission) {
				b.logger.Debug("Cannot deliver notification", mlog.String("user", username), mlog.Err(err))
			} else {
				merr.Append(fmt.Errorf("cannot deliver notification for @%s: %w", username, err))
			}
		}

		if userID == "" {
			// was a `@` followed by something other than a username.
			continue
		}

		b.logger.Debug("Mention notification delivered",
			mlog.String("user", username),
			mlog.Int("listener_count", len(listeners)),
		)

		for _, listener := range listeners {
			safeCallListener(listener, userID, evt, b.logger)
		}
	}
	return merr.ErrorOrNil()
}

func safeCallListener(listener MentionListener, userID string, evt notify.BlockChangeEvent, logger mlog.LoggerIFace) {
	// don't let panicky listeners stop notifications
	defer func() {
		if r := recover(); r != nil {
			logger.Error("panic calling @mention notification listener", mlog.Any("err", r))
		}
	}()
	listener.OnMention(userID, evt)
}

func (b *Backend) deliverMentionNotification(username string, extract string, evt notify.BlockChangeEvent) (string, error) {
	mentionedUser, err := b.delivery.UserByUsername(username)
	if err != nil {
		if model.IsErrNotFound(err) {
			// not really an error; could just be someone typed "@sometext"
			return "", nil
		}
		return "", fmt.Errorf("cannot lookup mentioned user: %w", err)
	}

	if evt.ModifiedBy == nil {
		return "", fmt.Errorf("invalid user cannot mention: %w", ErrMentionPermission)
	}

	if evt.Board.Type == model.BoardTypeOpen {
		// public board rules:
		//    - admin, editor, commenter: can mention anyone on team (mentioned users are automatically added to board)
		//    - guest: can mention board members
		switch {
		case evt.ModifiedBy.SchemeAdmin, evt.ModifiedBy.SchemeEditor, evt.ModifiedBy.SchemeCommenter:
			if !b.permissions.HasPermissionToTeam(mentionedUser.Id, evt.TeamID, model.PermissionViewTeam) {
				return "", fmt.Errorf("%s cannot mention non-team member %s : %w", evt.ModifiedBy.UserID, mentionedUser.Id, ErrMentionPermission)
			}
			// add mentioned user to board (if not already a member)
			member, err := b.appAPI.GetMemberForBoard(evt.Board.ID, mentionedUser.Id)
			if member == nil || model.IsErrNotFound(err) {
				// create memberships based on minimum board role
				newBoardMember := &model.BoardMember{
					UserID:  mentionedUser.Id,
					BoardID: evt.Board.ID,
					SchemeViewer: evt.Board.MinimumRole == model.BoardRoleViewer ||
						evt.Board.MinimumRole == model.BoardRoleCommenter ||
						evt.Board.MinimumRole == model.BoardRoleEditor,
					SchemeCommenter: evt.Board.MinimumRole == model.BoardRoleCommenter ||
						evt.Board.MinimumRole == model.BoardRoleEditor,
					SchemeEditor: evt.Board.MinimumRole == model.BoardRoleEditor,
				}
				if _, err = b.appAPI.AddMemberToBoard(newBoardMember); err != nil {
					return "", fmt.Errorf("cannot add mentioned user %s to board %s: %w", mentionedUser.Id, evt.Board.ID, err)
				}
				b.logger.Debug("auto-added mentioned user to board",
					mlog.String("user_id", mentionedUser.Id),
					mlog.String("board_id", evt.Board.ID),
					mlog.String("board_type", string(evt.Board.Type)),
				)
			} else {
				b.logger.Debug("skipping auto-add mentioned user to board; already a member",
					mlog.String("user_id", mentionedUser.Id),
					mlog.String("board_id", evt.Board.ID),
					mlog.String("board_type", string(evt.Board.Type)),
				)
			}
		case evt.ModifiedBy.SchemeViewer:
			// viewer should not have gotten this far since they cannot add text to a card
			return "", fmt.Errorf("%s (viewer) cannot mention user %s: %w", evt.ModifiedBy.UserID, mentionedUser.Id, ErrMentionPermission)
		default:
			// this is a guest
			if !b.permissions.HasPermissionToBoard(mentionedUser.Id, evt.Board.ID, model.PermissionViewBoard) {
				return "", fmt.Errorf("%s cannot mention non-board member %s : %w", evt.ModifiedBy.UserID, mentionedUser.Id, ErrMentionPermission)
			}
		}
	} else {
		// private board rules:
		//    - admin, editor, commenter, guest: can mention board members
		switch {
		case evt.ModifiedBy.SchemeViewer:
			// viewer should not have gotten this far since they cannot add text to a card
			return "", fmt.Errorf("%s (viewer) cannot mention user %s: %w", evt.ModifiedBy.UserID, mentionedUser.Id, ErrMentionPermission)
		default:
			// everyone else can mention board members
			if !b.permissions.HasPermissionToBoard(mentionedUser.Id, evt.Board.ID, model.PermissionViewBoard) {
				return "", fmt.Errorf("%s cannot mention non-board member %s : %w", evt.ModifiedBy.UserID, mentionedUser.Id, ErrMentionPermission)
			}
		}
	}

	return b.delivery.MentionDeliver(mentionedUser, extract, evt)
}
