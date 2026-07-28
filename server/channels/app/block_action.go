// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// blockActionUpstreamResponse is the combined shape integrations may return for
// do-block-action execute (post-action side effects + client proxy fields).
type blockActionUpstreamResponse struct {
	Update           *model.Post       `json:"update"`
	EphemeralText    string            `json:"ephemeral_text"`
	SkipSlackParsing bool              `json:"skip_slack_parsing"`
	GotoLocation     string            `json:"goto_location"`
	Error            string            `json:"error"`
	Errors           map[string]string `json:"errors"`
	Type             string            `json:"type"`
	MmBlocks         []any              `json:"mm_blocks"`
	MmBlocksActions  json.RawMessage    `json:"mm_blocks_actions"`
	BlockDialog      *model.BlockDialog `json:"block_dialog"`
	KeepDialogOpen   bool               `json:"keep_dialog_open"`
}

// DoBlockAction resolves an mm_blocks action from post_id/action_id/cookie,
// calls the upstream integration synchronously, and returns a unified client response.
// Legacy attachment post actions use DoPostActionWithCookie.
func (a *App) DoBlockAction(
	rctx request.CTX,
	userID string,
	req *model.DoBlockActionRequest,
	mmBlocksCookie *model.MmBlocksActionCookie,
) (*model.DoBlockActionResponse, *model.AppError) {
	if req == nil {
		return nil, model.NewAppError("DoBlockAction", "api.context.invalid_body_param.app_error", map[string]any{"Name": "do_block_action"}, "", http.StatusBadRequest)
	}
	if req.PostId == "" && mmBlocksCookie == nil {
		return nil, model.NewAppError("DoBlockAction", "api.context.invalid_url_param.app_error", map[string]any{"Name": "post_id"}, "", http.StatusBadRequest)
	}
	if req.ActionId == "" {
		return nil, model.NewAppError("DoBlockAction", "api.context.invalid_body_param.app_error", map[string]any{"Name": "action_id"}, "", http.StatusBadRequest)
	}

	actionContext := model.NormalizeBlockActionContext(req.Context)
	if actionContext == "" {
		return nil, model.NewAppError("DoBlockAction", "api.context.invalid_body_param.app_error", map[string]any{"Name": "context"}, "", http.StatusBadRequest)
	}

	subtype := model.NormalizeBlockActionSubtype(req.Subtype)
	if subtype == "" {
		return nil, model.NewAppError("DoBlockAction", "api.context.invalid_body_param.app_error", map[string]any{"Name": "subtype"}, "", http.StatusBadRequest)
	}

	if err := model.ValidateActionQuery(req.Query); err != nil {
		return nil, model.NewAppError("DoBlockAction", "api.post.do_action.query.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	if err := model.ValidateActionFormValues(req.FormValues); err != nil {
		return nil, model.NewAppError("DoBlockAction", "api.post.do_action.form_values.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	if appErr := a.validateFormValuesFileOwnership(rctx, userID, req.FormValues); appErr != nil {
		return nil, appErr
	}

	setup, gotoURL, appErr := a.resolvePostActionSetup(
		rctx,
		req.PostId,
		req.ActionId,
		userID,
		nil,
		mmBlocksCookie,
		req.Query,
		req.IntegrationFormat,
	)
	if appErr != nil {
		return nil, appErr
	}
	if gotoURL != "" {
		return &model.DoBlockActionResponse{
			GotoLocation: gotoURL,
		}, nil
	}

	upstreamRequest := setup.upstreamRequest

	if len(req.FormValues) > 0 {
		if upstreamRequest.Context == nil {
			upstreamRequest.Context = map[string]any{}
		}
		upstreamRequest.Context[model.PostActionContextFormValuesKey] = req.FormValues
	}

	if req.SelectedOption != "" {
		if upstreamRequest.Context == nil {
			upstreamRequest.Context = map[string]any{}
		}
		upstreamRequest.Context["selected_option"] = req.SelectedOption
		upstreamRequest.DataSource = setup.datasource
	}

	if subtype == model.BlockActionSubtypeLookup {
		if !model.IsValidLookupURL(setup.upstreamURL) {
			return nil, model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "invalid URL", http.StatusBadRequest)
		}
		upstreamRequest.Type = "dialog_lookup"
	}

	var clientTriggerId string
	if subtype == model.BlockActionSubtypeExecute {
		var genErr *model.AppError
		clientTriggerId, _, genErr = upstreamRequest.GenerateTriggerId(a.AsymmetricSigningKey())
		if genErr != nil {
			return nil, genErr
		}
	}

	requestJSON, err := json.Marshal(upstreamRequest)
	if err != nil {
		return nil, model.NewAppError("DoBlockAction", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	rctx.Logger().Info("DoBlockAction POST request, through DoActionRequest",
		mlog.String("url", setup.upstreamURL),
		mlog.String("subtype", subtype),
		mlog.String("user_id", upstreamRequest.UserId),
		mlog.String("post_id", upstreamRequest.PostId),
		mlog.String("channel_id", upstreamRequest.ChannelId),
		mlog.String("team_id", upstreamRequest.TeamId),
	)

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*a.Config().ServiceSettings.OutgoingIntegrationRequestsTimeout)*time.Second)
	defer cancel()
	resp, appErr := a.DoActionRequest(rctx.WithContext(ctx), setup.upstreamURL, requestJSON)
	if appErr != nil {
		if resp != nil && resp.Body != nil {
			_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, MaxIntegrationResponseSize))
			_ = resp.Body.Close()
		}
		return nil, appErr
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(io.LimitReader(resp.Body, MaxIntegrationResponseSize))
	if err != nil {
		return nil, model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	out := &model.DoBlockActionResponse{
		TriggerId: clientTriggerId,
	}

	if subtype == model.BlockActionSubtypeLookup {
		var lookupResp model.LookupDialogResponse
		if len(respBytes) > 0 {
			if err = json.Unmarshal(respBytes, &lookupResp); err != nil {
				return nil, model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			}
		}
		out.Items = lookupResp.Items
		return out, nil
	}

	// execute
	var upstream blockActionUpstreamResponse
	if len(respBytes) > 0 {
		if err = json.Unmarshal(respBytes, &upstream); err != nil {
			return nil, model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}

	if upstream.Update != nil && req.PostId != "" {
		if appErr = a.applyPostActionUpdate(rctx, setup, req.PostId, userID, upstream.Update); appErr != nil {
			return nil, appErr
		}
	}

	if upstream.EphemeralText != "" {
		ephemeralPost := &model.Post{
			Message:   upstream.EphemeralText,
			ChannelId: upstreamRequest.ChannelId,
			RootId:    setup.rootPostId,
			UserId:    userID,
		}
		if !upstream.SkipSlackParsing {
			ephemeralPost.Message = model.ParseSlackLinksToMarkdown(upstream.EphemeralText)
		}
		for key, value := range setup.retain {
			ephemeralPost.AddProp(key, value)
		}
		a.SendEphemeralPost(rctx, userID, ephemeralPost)
	}

	out.GotoLocation = upstream.GotoLocation
	out.Error = upstream.Error
	out.Errors = upstream.Errors
	out.Type = upstream.Type
	if actionContext == model.BlockActionContextDialog {
		out.KeepDialogOpen = upstream.KeepDialogOpen
	}

	switch upstream.Type {
	case model.BlockActionResponseTypeDialog:
		if upstream.BlockDialog == nil {
			return nil, model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "block_dialog required for type dialog", http.StatusBadRequest)
		}
		dialog, dialogErr := a.prepareDoBlockActionBlockDialog(setup, upstream.BlockDialog)
		if dialogErr != nil {
			return nil, dialogErr
		}
		out.BlockDialog = dialog
		out.MmBlocksActions = ""
		out.Type = model.BlockActionResponseTypeDialog
		return out, nil

	case model.BlockActionResponseTypeRefresh:
		if actionContext == model.BlockActionContextDialog {
			if upstream.BlockDialog == nil {
				return nil, model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "block_dialog required for type refresh in dialog context", http.StatusBadRequest)
			}
			dialog, dialogErr := a.prepareDoBlockActionBlockDialog(setup, upstream.BlockDialog)
			if dialogErr != nil {
				return nil, dialogErr
			}
			out.BlockDialog = dialog
			out.MmBlocksActions = ""
			out.Type = model.BlockActionResponseTypeRefresh
			return out, nil
		}

		// Post context: refresh via mm_blocks / mm_blocks_actions.
		out.MmBlocks = upstream.MmBlocks
		if len(upstream.MmBlocksActions) > 0 && string(upstream.MmBlocksActions) != "null" {
			encrypted, encErr := a.encryptDoBlockActionMmBlocksActions(setup, req.PostId, upstream.MmBlocks, upstream.MmBlocksActions)
			if encErr != nil {
				return nil, encErr
			}
			out.MmBlocksActions = encrypted
		}
		out.Type = model.BlockActionResponseTypeRefresh
		return out, nil
	}

	return out, nil
}

func (a *App) prepareDoBlockActionBlockDialog(setup *postActionSetup, dialog *model.BlockDialog) (*model.BlockDialog, *model.AppError) {
	if dialog == nil {
		return nil, model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "block_dialog required for type dialog", http.StatusBadRequest)
	}
	if err := dialog.IsValid(); err != nil {
		return nil, model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	if err := model.ValidateBlockDialogMmBlocksActions(dialog); err != nil {
		return nil, model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if dialog.Actions != nil {
		encReq := model.OpenDialogRequest{
			BlockDialog: dialog,
		}
		if encErr := a.encryptOpenDialogMmBlocksActions(&encReq); encErr != nil {
			return nil, encErr
		}
		dialog = encReq.BlockDialog
	}

	return dialog, nil
}

func (a *App) encryptDoBlockActionMmBlocksActions(setup *postActionSetup, postID string, mmBlocks []any, rawActions json.RawMessage) (string, *model.AppError) {
	var actionsMap map[string]any
	if err := json.Unmarshal(rawActions, &actionsMap); err != nil {
		return "", model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "mm_blocks_actions must be an object", http.StatusBadRequest).Wrap(err)
	}
	if len(actionsMap) == 0 {
		return "", model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "mm_blocks_actions must be a non-empty object", http.StatusBadRequest)
	}
	// Same URL/shape/pairing checks as post create and block_dialog refresh —
	// do not mint cookies for callbacks that would be rejected at rest.
	if err := model.ValidateMmBlocksActionsForWebhook(mmBlocks, actionsMap); err != nil {
		return "", model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	channelID := setup.upstreamRequest.ChannelId
	if channelID == "" {
		channelID = setup.ephemeralChannelID
	}
	rootID := postID
	if setup.rootPostId != "" {
		rootID = setup.rootPostId
	}

	cookie, err := model.EncryptMmBlocksActionsCookie(
		actionsMap,
		postID,
		rootID,
		channelID,
		setup.retain,
		setup.remove,
		a.PostActionCookieSecret(),
	)
	if err != nil {
		return "", model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "mm_blocks_actions must be an object", http.StatusBadRequest).Wrap(err)
	}
	if cookie == "" {
		return "", model.NewAppError("DoBlockAction", "api.post.do_action.action_integration.app_error", nil, "failed to encrypt mm_blocks_actions", http.StatusInternalServerError)
	}
	return cookie, nil
}

// validateFormValuesFileOwnership scans form_values for ID-shaped tokens that
// resolve to real files and enforces creator ownership (parity with
// SubmitInteractiveDialog's defense-in-depth scan).
func (a *App) validateFormValuesFileOwnership(rctx request.CTX, userID string, formValues map[string]any) *model.AppError {
	if len(formValues) == 0 {
		return nil
	}

	const maxSubmissionScanDepth = 100
	candidateFileIDs := make([]string, 0)
	seenCandidate := make(map[string]bool)
	scanLimitExceeded := false
	var collectIDs func(v any, depth int)
	collectIDs = func(v any, depth int) {
		if depth > maxSubmissionScanDepth || scanLimitExceeded {
			return
		}
		switch typed := v.(type) {
		case string:
			for tok := range strings.SplitSeq(typed, ",") {
				tok = strings.TrimSpace(tok)
				if tok == "" || seenCandidate[tok] || !model.IsValidId(tok) {
					continue
				}
				if len(candidateFileIDs) >= model.MaxDialogSubmissionIDShapedTokenScan {
					scanLimitExceeded = true
					return
				}
				seenCandidate[tok] = true
				candidateFileIDs = append(candidateFileIDs, tok)
			}
		case []any:
			for _, e := range typed {
				if scanLimitExceeded {
					return
				}
				collectIDs(e, depth+1)
			}
		case []string:
			for _, e := range typed {
				if scanLimitExceeded {
					return
				}
				collectIDs(e, depth+1)
			}
		case map[string]any:
			for _, e := range typed {
				if scanLimitExceeded {
					return
				}
				collectIDs(e, depth+1)
			}
		}
	}
	for _, raw := range formValues {
		if scanLimitExceeded {
			break
		}
		collectIDs(raw, 0)
	}

	if scanLimitExceeded {
		return model.NewAppError("DoBlockAction", "app.submit_interactive_dialog.too_many_submission_ids",
			map[string]any{"Max": model.MaxDialogSubmissionIDShapedTokenScan}, "", http.StatusBadRequest)
	}
	if len(candidateFileIDs) == 0 {
		return nil
	}

	submissionFiles, nErr := a.Srv().Store().FileInfo().GetByIds(candidateFileIDs, false, false, false)
	if nErr != nil {
		// Transient store error: fail closed for DoBlockAction (unlike the
		// dialog defense-in-depth soft path) because form_values is the only
		// file channel on this endpoint.
		return model.NewAppError("DoBlockAction", "app.submit_interactive_dialog.get_file_info_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}
	for _, fileInfo := range submissionFiles {
		if fileInfo.CreatorId != userID {
			return model.NewAppError("DoBlockAction", "app.submit_interactive_dialog.file_not_owned", map[string]any{"FileId": fileInfo.Id}, "", http.StatusForbidden)
		}
	}
	if len(submissionFiles) > model.MaxDialogFileIds {
		return model.NewAppError("DoBlockAction", "app.submit_interactive_dialog.too_many_file_ids",
			map[string]any{"Max": model.MaxDialogFileIds}, "", http.StatusBadRequest)
	}
	return nil
}
