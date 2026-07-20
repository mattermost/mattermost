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

	channel.DisplayName = strings.TrimSpace(channel.DisplayName)
	if appErr := channel.IsValidBoard(); appErr != nil {
		return nil, appErr
	}

	// Look up boards property fields by name
	boardsGroup, appErr := a.GetPropertyGroup(rctx, model.BoardsPropertyGroupName)
	if appErr != nil {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.internal_error", nil, "boards property group not found", http.StatusInternalServerError).Wrap(appErr)
	}

	assigneeField, appErr := a.GetPropertyFieldByNameForObjectType(rctx, boardsGroup.ID, "", model.PropertyFieldObjectTypePost, model.BoardsPropertyFieldAssignee)
	if appErr != nil {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.internal_error", nil, "assignee property field not found", http.StatusInternalServerError).Wrap(appErr)
	}

	statusField, appErr := a.GetPropertyFieldByNameForObjectType(rctx, boardsGroup.ID, "", model.PropertyFieldObjectTypePost, model.BoardsPropertyFieldStatus)
	if appErr != nil {
		return nil, model.NewAppError("CreateBoardChannel", "app.channel.create_board_channel.internal_error", nil, "status property field not found", http.StatusInternalServerError).Wrap(appErr)
	}

	// Set linked properties on channel
	if channel.Props == nil {
		channel.Props = make(map[string]any)
	}
	channel.Props[model.ChannelPropsBoardLinkedProperties] = []string{statusField.ID, assigneeField.ID}

	view, appErr := buildBoardKanbanView(channel.CreatorId, statusField)
	if appErr != nil {
		return nil, appErr
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

// buildBoardKanbanView constructs the default kanban view for a new board
// channel, with one column per option on the boards "status" property field.
func buildBoardKanbanView(creatorID string, statusField *model.PropertyField) (*model.View, *model.AppError) {
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

	return &model.View{
		CreatorId: creatorID,
		Type:      model.ViewTypeKanban,
		Title:     "Board",
		Props:     viewProps,
	}, nil
}
