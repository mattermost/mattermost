// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) CreateBoardChannel(rctx request.CTX, channel *model.Channel) (*model.Channel, *model.AppError) {
	// Validate feature flag
	if !a.Config().FeatureFlags.IntegratedBoards {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.boards_not_enabled.app_error", nil, "The Integrated Boards feature is not enabled.", http.StatusForbidden)
	}

	// Validate channel type
	if !channel.IsBoard() {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.invalid_type.app_error", nil, "", http.StatusBadRequest)
	}

	// Validate team
	if channel.TeamId == "" {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.no_team.app_error", nil, "", http.StatusBadRequest)
	}

	// Validate display name
	channel.DisplayName = strings.TrimSpace(channel.DisplayName)
	if channel.DisplayName == "" {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.no_display_name.app_error", nil, "", http.StatusBadRequest)
	}

	// Look up boards property fields by name
	boardsGroup, err := a.Srv().PropertyService().GetPropertyGroup(model.BoardsPropertyGroupName)
	if err != nil {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.internal_error", nil, "boards property group not found", http.StatusInternalServerError).Wrap(err)
	}

	assigneeField, err := a.Srv().PropertyService().GetPropertyFieldByName(rctx, boardsGroup.ID, "", model.BoardsPropertyFieldAssignee)
	if err != nil {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.internal_error", nil, "assignee property field not found", http.StatusInternalServerError).Wrap(err)
	}

	statusField, err := a.Srv().PropertyService().GetPropertyFieldByName(rctx, boardsGroup.ID, "", model.BoardsPropertyFieldStatus)
	if err != nil {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.internal_error", nil, "status property field not found", http.StatusInternalServerError).Wrap(err)
	}

	// Set linked properties on channel
	if channel.Props == nil {
		channel.Props = make(map[string]any)
	}
	channel.Props[model.ChannelPropsBoardLinkedProperties] = []string{statusField.ID, assigneeField.ID}

	// Build kanban column config from status field options
	statusOptions, ok := statusField.Attrs["options"].([]any)
	if !ok || len(statusOptions) == 0 {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.internal_error", nil, "status field has no options", http.StatusInternalServerError)
	}
	var columns []model.KanbanColumn
	for _, opt := range statusOptions {
		optMap, ok := opt.(map[string]any)
		if !ok {
			continue
		}
		optID, _ := optMap["id"].(string)
		optName, _ := optMap["name"].(string)
		if optID != "" && optName != "" {
			columns = append(columns, model.KanbanColumn{
				ID:        model.NewId(),
				Name:      optName,
				OptionIDs: []string{optID},
			})
		}
	}

	kanbanProps := &model.KanbanProps{
		GroupBy: model.KanbanGroupBy{
			FieldID: statusField.ID,
			Columns: columns,
		},
	}

	viewProps, err := kanbanProps.ToProps()
	if err != nil {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.internal_error", nil, "failed to serialize kanban props", http.StatusInternalServerError).Wrap(err)
	}

	view := &model.View{
		CreatorId: channel.CreatorId,
		Type:      model.ViewTypeKanban,
		Title:     "Board",
		Props:     viewProps,
	}

	// Atomically save channel + view
	sc, savedView, nErr := a.Srv().Store().Channel().SaveBoardChannel(rctx, channel, *a.Config().TeamSettings.MaxChannelsPerTeam, view)
	if nErr != nil {
		var appError *model.AppError
		var invErr *store.ErrInvalidInput
		var cErr *store.ErrConflict
		var ltErr *store.ErrLimitExceeded
		switch {
		case errors.As(nErr, &invErr):
			return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.invalid.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &cErr):
			return nil, model.NewAppError("CreateBoardChannel", "store.sql_channel.save_channel.exists.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &ltErr):
			return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.limit.app_error", nil, "", http.StatusBadRequest).Wrap(nErr)
		case errors.As(nErr, &appError):
			return nil, appError
		default:
			return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	// Add creator as admin member
	user, nErr := a.Srv().Store().User().Get(rctx.Context(), channel.CreatorId)
	if nErr != nil {
		return nil, model.NewAppError("CreateBoardChannel", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	cm := &model.ChannelMember{
		ChannelId:   sc.Id,
		UserId:      user.Id,
		SchemeGuest: user.IsGuest(),
		SchemeUser:  !user.IsGuest(),
		SchemeAdmin: true,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
	}

	if _, nErr := a.Srv().Store().Channel().SaveMember(rctx, cm); nErr != nil {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.save_member.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	if err := a.Srv().Store().ChannelMemberHistory().LogJoinEvent(channel.CreatorId, sc.Id, model.GetMillis()); err != nil {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel_member_history.log_join_event.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.Srv().Platform().InvalidateChannelCacheForUser(channel.CreatorId)

	// Publish board_created event (NOT channel_created)
	boardMessage := model.NewWebSocketEvent(model.WebsocketEventBoardCreated, "", "", channel.CreatorId, nil, "")
	boardMessage.Add("channel_id", sc.Id)
	boardMessage.Add("team_id", sc.TeamId)
	a.Publish(boardMessage)

	// Publish view_created event
	a.publishViewEvent(rctx, model.WebsocketEventViewCreated, savedView, "")

	// Do NOT add to sidebar categories — boards don't appear in sidebar

	return sc, nil
}
