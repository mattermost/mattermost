package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"oktel-bot/internal/i18n"
	"oktel-bot/internal/mattermost"
	"oktel-bot/internal/model"
	"oktel-bot/internal/service"
)

type AttendanceHandler struct {
	svc         *service.AttendanceService
	mm          *mattermost.Client
	botURL      string
	blockMobile bool
}

func NewAttendanceHandler(svc *service.AttendanceService, mm *mattermost.Client, botURL string, blockMobile bool) *AttendanceHandler {
	return &AttendanceHandler{svc: svc, mm: mm, botURL: botURL, blockMobile: blockMobile}
}

// isMobileRequest checks the X-Mattermost-Is-Mobile header injected by the Mattermost server.
func (h *AttendanceHandler) isMobileRequest(r *http.Request) bool {
	return h.blockMobile && r.Header.Get("X-Mattermost-Is-Mobile") == "true"
}

func (h *AttendanceHandler) denyMobileSlash(ctx context.Context, w http.ResponseWriter) {
	writeJSON(w, SlashResponse{
		ResponseType: "ephemeral",
		Text:         i18n.T(ctx, "attendance.err.mobile_blocked"),
	})
}

func (h *AttendanceHandler) denyMobileAction(ctx context.Context, w http.ResponseWriter) {
	writeJSON(w, ActionResponse{EphemeralText: i18n.T(ctx, "attendance.err.mobile_blocked")})
}

func (h *AttendanceHandler) denyMobileDialog(ctx context.Context, w http.ResponseWriter) {
	writeJSON(w, map[string]string{"error": i18n.T(ctx, "attendance.err.mobile_blocked")})
}

// SlashCommand is the Mattermost slash command request.
type SlashCommand struct {
	Token       string `json:"token" schema:"token"`
	TeamID      string `json:"team_id" schema:"team_id"`
	ChannelID   string `json:"channel_id" schema:"channel_id"`
	ChannelName string `json:"channel_name" schema:"channel_name"`
	UserID      string `json:"user_id" schema:"user_id"`
	UserName    string `json:"user_name" schema:"user_name"`
	Command     string `json:"command" schema:"command"`
	Text        string `json:"text" schema:"text"`
	TriggerID   string `json:"trigger_id" schema:"trigger_id"`
	ResponseURL string `json:"response_url" schema:"response_url"`
}

// ActionRequest is the Mattermost interactive action request.
type ActionRequest struct {
	UserID    string         `json:"user_id"`
	UserName  string         `json:"user_name"`
	ChannelID string         `json:"channel_id"`
	PostID    string         `json:"post_id"`
	TriggerID string         `json:"trigger_id"`
	Type      string         `json:"type"`
	Context   map[string]any `json:"context"`
}

// DialogSubmission is the Mattermost dialog submission.
type DialogSubmission struct {
	Type       string            `json:"type"`
	CallbackID string            `json:"callback_id"`
	UserID     string            `json:"user_id"`
	UserName   string            `json:"user_name"`
	ChannelID  string            `json:"channel_id"`
	TeamID     string            `json:"team_id"`
	Submission map[string]string `json:"submission"`
	Cancelled  bool              `json:"cancelled"`
}

// SlashResponse is the response to a slash command.
type SlashResponse struct {
	ResponseType string                  `json:"response_type"` // "ephemeral" or "in_channel"
	Text         string                  `json:"text,omitempty"`
	Attachments  []mattermost.Attachment `json:"attachments,omitempty"`
}

// ActionResponse is the response to an interactive action.
type ActionResponse struct {
	Update        *ActionUpdate `json:"update,omitempty"`
	EphemeralText string        `json:"ephemeral_text,omitempty"`
}

// ActionUpdate updates the original post.
type ActionUpdate struct {
	Message string            `json:"message,omitempty"`
	Props   *mattermost.Props `json:"props,omitempty"`
}

// localeCtx fetches the user's locale from Mattermost and returns a context with locale set.
func (h *AttendanceHandler) localeCtx(ctx context.Context, userID string) context.Context {
	user, err := h.mm.GetUser(userID)
	if err != nil {
		log.Printf("i18n: GetUser(%s) failed: %v", userID, err)
		return ctx
	}
	if user.Locale == "" {
		return ctx
	}
	return i18n.WithLocale(ctx, user.Locale)
}

// HandleDiemDanh handles /diemdanh slash command (attendance check-in/out/break).
func (h *AttendanceHandler) HandleDiemDanh(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := h.localeCtx(r.Context(), r.FormValue("user_id"))

	if h.isMobileRequest(r) {
		h.denyMobileSlash(ctx, w)
		return
	}

	channelName := r.FormValue("channel_name")
	if !strings.HasPrefix(channelName, "attendance") {
		writeJSON(w, SlashResponse{
			ResponseType: "ephemeral",
			Text:         i18n.T(ctx, "attendance.channel_error"),
		})
		return
	}

	writeJSON(w, SlashResponse{
		ResponseType: "ephemeral",
		Attachments: []mattermost.Attachment{
			{
				Actions: []mattermost.Action{
					{Name: i18n.T(ctx, "attendance.btn.checkin"), Type: "button", Integration: mattermost.Integration{
						URL:     h.botURL + "/api/attendance/checkin",
						Context: map[string]any{"action": "checkin"},
					}},
					{Name: i18n.T(ctx, "attendance.btn.checkout"), Type: "button", Integration: mattermost.Integration{
						URL:     h.botURL + "/api/attendance/checkout",
						Context: map[string]any{"action": "checkout"},
					}},
					{Name: i18n.T(ctx, "attendance.btn.rest"), Type: "button", Integration: mattermost.Integration{
						URL:     h.botURL + "/api/attendance/break-start",
						Context: map[string]any{"reason": "nghi_ngoi"},
					}},
					{Name: i18n.T(ctx, "attendance.btn.eat"), Type: "button", Integration: mattermost.Integration{
						URL:     h.botURL + "/api/attendance/break-start",
						Context: map[string]any{"reason": "di_an"},
					}},
					{Name: i18n.T(ctx, "attendance.btn.restroom_s"), Type: "button", Integration: mattermost.Integration{
						URL:     h.botURL + "/api/attendance/break-start",
						Context: map[string]any{"reason": "tieu_tien"},
					}},
					{Name: i18n.T(ctx, "attendance.btn.restroom_l"), Type: "button", Integration: mattermost.Integration{
						URL:     h.botURL + "/api/attendance/break-start",
						Context: map[string]any{"reason": "dai_tien"},
					}},
					{Name: i18n.T(ctx, "attendance.btn.smoke"), Type: "button", Integration: mattermost.Integration{
						URL:     h.botURL + "/api/attendance/break-start",
						Context: map[string]any{"reason": "hut_thuoc"},
					}},
					{Name: i18n.T(ctx, "attendance.btn.back_seat"), Type: "button", Integration: mattermost.Integration{
						URL:     h.botURL + "/api/attendance/break-end",
						Context: map[string]any{"action": "break-end"},
					}},
				},
			},
		},
	})
}

// HandleXinPhep handles /xinphep slash command (leave/late/early requests).
func (h *AttendanceHandler) HandleXinPhep(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := h.localeCtx(r.Context(), r.FormValue("user_id"))

	channelName := r.FormValue("channel_name")
	if !strings.HasPrefix(channelName, "attendance") {
		writeJSON(w, SlashResponse{
			ResponseType: "ephemeral",
			Text:         i18n.T(ctx, "attendance.channel_error"),
		})
		return
	}

	writeJSON(w, SlashResponse{
		ResponseType: "ephemeral",
		Attachments: []mattermost.Attachment{
			{
				Actions: []mattermost.Action{
					{Name: i18n.T(ctx, "attendance.btn.leave"), Type: "button", Integration: mattermost.Integration{
						URL:     h.botURL + "/api/attendance/leave-form",
						Context: map[string]any{"action": "leave-form"},
					}},
					{Name: i18n.T(ctx, "attendance.btn.late"), Type: "button", Integration: mattermost.Integration{
						URL:     h.botURL + "/api/attendance/late-form",
						Context: map[string]any{"action": "late-form"},
					}},
					{Name: i18n.T(ctx, "attendance.btn.early"), Type: "button", Integration: mattermost.Integration{
						URL:     h.botURL + "/api/attendance/early-form",
						Context: map[string]any{"action": "early-form"},
					}},
				},
			},
		},
	})
}

// HandleCheckIn opens the check-in dialog with optional photo upload.
func (h *AttendanceHandler) HandleCheckIn(w http.ResponseWriter, r *http.Request) {
	var req ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := h.localeCtx(r.Context(), req.UserID)

	if h.isMobileRequest(r) {
		h.denyMobileAction(ctx, w)
		return
	}

	err := h.mm.OpenDialog(&mattermost.DialogRequest{
		TriggerID: req.TriggerID,
		URL:       h.botURL + "/api/attendance/checkin-submit",
		Dialog: mattermost.Dialog{
			Title:       i18n.T(ctx, "attendance.dialog.checkin_title"),
			SubmitLabel: i18n.T(ctx, "attendance.dialog.checkin_submit"),
			Elements: []mattermost.DialogElement{
				{
					DisplayName: i18n.T(ctx, "attendance.field.photo"),
					Name:        "photo",
					Type:        "file",
					Optional:    true,
					HelpText:    i18n.T(ctx, "attendance.helptext.photo"),
					Accept:      "image/*",
				},
			},
		},
	})
	if err != nil {
		log.Printf("ERROR open check-in dialog: %v", err)
		writeJSON(w, ActionResponse{EphemeralText: i18n.T(ctx, "attendance.err.open_form")})
		return
	}
	writeJSON(w, ActionResponse{})
}

// HandleCheckInSubmit processes the check-in dialog submission.
func (h *AttendanceHandler) HandleCheckInSubmit(w http.ResponseWriter, r *http.Request) {
	var sub DialogSubmission
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if sub.Cancelled {
		w.WriteHeader(http.StatusOK)
		return
	}

	username := sub.UserName
	ctx := h.localeCtx(r.Context(), sub.UserID)

	if h.isMobileRequest(r) {
		h.denyMobileDialog(ctx, w)
		return
	}

	if username == "" {
		user, err := h.mm.GetUser(sub.UserID)
		if err == nil {
			username = user.Username
		}
	}

	fileID := sub.Submission["photo"]

	result, err := h.svc.CheckIn(ctx, sub.UserID, username, sub.ChannelID, fileID)
	if err != nil {
		log.Printf("ERROR check-in: %v", err)
		writeJSON(w, map[string]string{"error": err.Error()})
		return
	}
	_ = result

	w.WriteHeader(http.StatusOK)
}

// HandleBreakStart handles a direct break-start button click (no dialog).
// The break reason is passed via req.Context["reason"] as a key (e.g. "di_an").
func (h *AttendanceHandler) HandleBreakStart(w http.ResponseWriter, r *http.Request) {
	var req ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := h.localeCtx(r.Context(), req.UserID)

	if h.isMobileRequest(r) {
		h.denyMobileAction(ctx, w)
		return
	}

	reasonKey, _ := req.Context["reason"].(string)

	msg, err := h.svc.BreakStart(ctx, req.UserID, req.UserName, reasonKey)
	if err != nil {
		writeJSON(w, ActionResponse{EphemeralText: err.Error()})
		return
	}
	writeJSON(w, ActionResponse{EphemeralText: msg})
}

// HandleBreakEnd handles the break end button.
func (h *AttendanceHandler) HandleBreakEnd(w http.ResponseWriter, r *http.Request) {
	var req ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := h.localeCtx(r.Context(), req.UserID)

	if h.isMobileRequest(r) {
		h.denyMobileAction(ctx, w)
		return
	}

	msg, err := h.svc.BreakEnd(ctx, req.UserID, req.UserName)
	if err != nil {
		writeJSON(w, ActionResponse{EphemeralText: err.Error()})
		return
	}
	writeJSON(w, ActionResponse{EphemeralText: msg})
}

// HandleCheckOut handles the check-out button.
func (h *AttendanceHandler) HandleCheckOut(w http.ResponseWriter, r *http.Request) {
	var req ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := h.localeCtx(r.Context(), req.UserID)

	if h.isMobileRequest(r) {
		h.denyMobileAction(ctx, w)
		return
	}

	msg, err := h.svc.CheckOut(ctx, req.UserID, req.UserName)
	if err != nil {
		writeJSON(w, ActionResponse{EphemeralText: err.Error()})
		return
	}
	writeJSON(w, ActionResponse{EphemeralText: msg})
}

// HandleLeaveForm opens the leave request dialog.
func (h *AttendanceHandler) HandleLeaveForm(w http.ResponseWriter, r *http.Request) {
	var req ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := h.localeCtx(r.Context(), req.UserID)

	err := h.mm.OpenDialog(&mattermost.DialogRequest{
		TriggerID: req.TriggerID,
		URL:       h.botURL + "/api/attendance/leave",
		Dialog: mattermost.Dialog{
			Title:       i18n.T(ctx, "attendance.dialog.leave_title"),
			SubmitLabel: i18n.T(ctx, "attendance.dialog.submit"),
			Elements: []mattermost.DialogElement{
				{
					DisplayName: i18n.T(ctx, "attendance.field.date1"),
					Name:        "date1",
					Type:        "text",
					SubType:     "date",
				},
				{
					DisplayName: i18n.T(ctx, "attendance.field.date2"),
					Name:        "date2",
					Type:        "text",
					SubType:     "date",
					Optional:    true,
				},
				{
					DisplayName: i18n.T(ctx, "attendance.field.date3"),
					Name:        "date3",
					Type:        "text",
					SubType:     "date",
					Optional:    true,
				},
				{
					DisplayName: i18n.T(ctx, "attendance.field.reason"),
					Name:        "reason",
					Type:        "textarea",
					Placeholder: i18n.T(ctx, "attendance.placeholder.reason"),
				},
			},
		},
	})
	if err != nil {
		log.Printf("ERROR open dialog: %v", err)
		writeJSON(w, ActionResponse{EphemeralText: i18n.T(ctx, "attendance.err.open_form")})
		return
	}
	writeJSON(w, ActionResponse{})
}

// HandleLeaveSubmit processes the leave request dialog submission.
func (h *AttendanceHandler) HandleLeaveSubmit(w http.ResponseWriter, r *http.Request) {
	var sub DialogSubmission
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if sub.Cancelled {
		w.WriteHeader(http.StatusOK)
		return
	}

	ctx := h.localeCtx(r.Context(), sub.UserID)

	// Collect dates from individual fields
	var dates []string
	for _, key := range []string{"date1", "date2", "date3"} {
		if d := strings.TrimSpace(sub.Submission[key]); d != "" {
			dates = append(dates, d)
		}
	}

	err := h.svc.CreateLeaveRequest(
		ctx,
		sub.UserID,
		sub.UserName,
		sub.ChannelID,
		model.LeaveTypeAnnual,
		dates,
		sub.Submission["reason"],
		"",
	)
	if err != nil {
		log.Printf("ERROR create leave request: %v", err)
		writeJSON(w, map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
}

// HandleLateArrivalForm opens the late arrival request dialog.
func (h *AttendanceHandler) HandleLateArrivalForm(w http.ResponseWriter, r *http.Request) {
	var req ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := h.localeCtx(r.Context(), req.UserID)

	err := h.mm.OpenDialog(&mattermost.DialogRequest{
		TriggerID: req.TriggerID,
		URL:       h.botURL + "/api/attendance/late",
		Dialog: mattermost.Dialog{
			Title:       i18n.T(ctx, "attendance.dialog.late_title"),
			SubmitLabel: i18n.T(ctx, "attendance.dialog.submit"),
			Elements: []mattermost.DialogElement{
				{
					DisplayName: i18n.T(ctx, "attendance.field.date"),
					Name:        "date",
					Type:        "text",
					SubType:     "date",
					Placeholder: i18n.T(ctx, "attendance.placeholder.dates"),
				},
				{
					DisplayName: i18n.T(ctx, "attendance.field.arrival_time"),
					Name:        "time",
					Type:        "text",
					Placeholder: i18n.T(ctx, "attendance.placeholder.time_in"),
				},
				{
					DisplayName: i18n.T(ctx, "attendance.field.reason"),
					Name:        "reason",
					Type:        "textarea",
					Placeholder: i18n.T(ctx, "attendance.placeholder.reason"),
				},
			},
		},
	})
	if err != nil {
		log.Printf("ERROR open late arrival dialog: %v", err)
		writeJSON(w, ActionResponse{EphemeralText: i18n.T(ctx, "attendance.err.open_form")})
		return
	}
	writeJSON(w, ActionResponse{})
}

// HandleLateArrivalSubmit processes the late arrival dialog submission.
func (h *AttendanceHandler) HandleLateArrivalSubmit(w http.ResponseWriter, r *http.Request) {
	var sub DialogSubmission
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if sub.Cancelled {
		w.WriteHeader(http.StatusOK)
		return
	}

	ctx := h.localeCtx(r.Context(), sub.UserID)

	err := h.svc.CreateLeaveRequest(
		ctx,
		sub.UserID,
		sub.UserName,
		sub.ChannelID,
		model.LeaveTypeLateArrival,
		[]string{sub.Submission["date"]},
		sub.Submission["reason"],
		sub.Submission["time"],
	)
	if err != nil {
		log.Printf("ERROR create late arrival request: %v", err)
		writeJSON(w, map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
}

// HandleEarlyDepartureForm opens the early departure request dialog.
func (h *AttendanceHandler) HandleEarlyDepartureForm(w http.ResponseWriter, r *http.Request) {
	var req ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := h.localeCtx(r.Context(), req.UserID)

	err := h.mm.OpenDialog(&mattermost.DialogRequest{
		TriggerID: req.TriggerID,
		URL:       h.botURL + "/api/attendance/early",
		Dialog: mattermost.Dialog{
			Title:       i18n.T(ctx, "attendance.dialog.early_title"),
			SubmitLabel: i18n.T(ctx, "attendance.dialog.submit"),
			Elements: []mattermost.DialogElement{
				{
					DisplayName: i18n.T(ctx, "attendance.field.date"),
					Name:        "date",
					Type:        "text",
					SubType:     "date",
					Placeholder: i18n.T(ctx, "attendance.placeholder.dates"),
				},
				{
					DisplayName: i18n.T(ctx, "attendance.field.departure_time"),
					Name:        "time",
					Type:        "text",
					Placeholder: i18n.T(ctx, "attendance.placeholder.time_out"),
				},
				{
					DisplayName: i18n.T(ctx, "attendance.field.reason"),
					Name:        "reason",
					Type:        "textarea",
					Placeholder: i18n.T(ctx, "attendance.placeholder.reason"),
				},
			},
		},
	})
	if err != nil {
		log.Printf("ERROR open early departure dialog: %v", err)
		writeJSON(w, ActionResponse{EphemeralText: i18n.T(ctx, "attendance.err.open_form")})
		return
	}
	writeJSON(w, ActionResponse{})
}

// HandleEarlyDepartureSubmit processes the early departure dialog submission.
func (h *AttendanceHandler) HandleEarlyDepartureSubmit(w http.ResponseWriter, r *http.Request) {
	var sub DialogSubmission
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if sub.Cancelled {
		w.WriteHeader(http.StatusOK)
		return
	}

	ctx := h.localeCtx(r.Context(), sub.UserID)

	err := h.svc.CreateLeaveRequest(
		ctx,
		sub.UserID,
		sub.UserName,
		sub.ChannelID,
		model.LeaveTypeEarlyDeparture,
		[]string{sub.Submission["date"]},
		sub.Submission["reason"],
		sub.Submission["time"],
	)
	if err != nil {
		log.Printf("ERROR create early departure request: %v", err)
		writeJSON(w, map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
}

// HandleApprove handles the approve button click.
func (h *AttendanceHandler) HandleApprove(w http.ResponseWriter, r *http.Request) {
	var req ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := h.localeCtx(r.Context(), req.UserID)

	requestID, _ := req.Context["request_id"].(string)
	if requestID == "" {
		writeJSON(w, ActionResponse{EphemeralText: i18n.T(ctx, "attendance.err.missing_id")})
		return
	}

	result, err := h.svc.ApproveLeave(ctx, requestID, req.UserID, req.UserName)
	if err != nil {
		writeJSON(w, ActionResponse{EphemeralText: err.Error()})
		return
	}

	writeJSON(w, ActionResponse{
		Update: &ActionUpdate{
			Props: &mattermost.Props{
				MessageKey:  result.MessageKey,
				MessageData: result.MessageData,
				Attachments: []mattermost.Attachment{},
			},
		},
	})
}

// HandleReject opens a dialog asking for the rejection reason.
func (h *AttendanceHandler) HandleReject(w http.ResponseWriter, r *http.Request) {
	var req ActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	ctx := h.localeCtx(r.Context(), req.UserID)

	requestID, _ := req.Context["request_id"].(string)
	if requestID == "" {
		writeJSON(w, ActionResponse{EphemeralText: i18n.T(ctx, "attendance.err.missing_id")})
		return
	}

	err := h.mm.OpenDialog(&mattermost.DialogRequest{
		TriggerID: req.TriggerID,
		URL:       h.botURL + "/api/attendance/reject-submit",
		Dialog: mattermost.Dialog{
			CallbackID:  requestID,
			Title:       i18n.T(ctx, "attendance.dialog.reject_title"),
			SubmitLabel: i18n.T(ctx, "attendance.dialog.reject_submit"),
			Elements: []mattermost.DialogElement{
				{
					DisplayName: i18n.T(ctx, "attendance.field.reason"),
					Name:        "reason",
					Type:        "textarea",
					Placeholder: i18n.T(ctx, "attendance.placeholder.reject"),
				},
			},
		},
	})
	if err != nil {
		log.Printf("ERROR open reject dialog: %v", err)
		writeJSON(w, ActionResponse{EphemeralText: i18n.T(ctx, "attendance.err.open_form")})
		return
	}
	writeJSON(w, ActionResponse{})
}

// HandleRejectSubmit processes the reject dialog submission.
func (h *AttendanceHandler) HandleRejectSubmit(w http.ResponseWriter, r *http.Request) {
	var sub DialogSubmission
	if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if sub.Cancelled {
		w.WriteHeader(http.StatusOK)
		return
	}

	requestID := sub.CallbackID
	if requestID == "" {
		writeJSON(w, map[string]string{"error": "Missing request ID"})
		return
	}

	ctx := h.localeCtx(r.Context(), sub.UserID)

	username := sub.UserName
	if username == "" {
		user, err := h.mm.GetUser(sub.UserID)
		if err == nil {
			username = user.Username
		}
	}

	err := h.svc.RejectLeave(ctx, requestID, sub.UserID, username, sub.Submission["reason"])
	if err != nil {
		log.Printf("ERROR reject leave: %v", err)
		writeJSON(w, map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
}

// RegisterRoutes registers all attendance routes on the given mux.
func (h *AttendanceHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/diemdanh", h.HandleDiemDanh)
	mux.HandleFunc("POST /api/xinphep", h.HandleXinPhep)
	mux.HandleFunc("POST /api/attendance/checkin", h.HandleCheckIn)
	mux.HandleFunc("POST /api/attendance/checkin-submit", h.HandleCheckInSubmit)
	mux.HandleFunc("POST /api/attendance/break-start", h.HandleBreakStart)
	mux.HandleFunc("POST /api/attendance/break-end", h.HandleBreakEnd)
	mux.HandleFunc("POST /api/attendance/checkout", h.HandleCheckOut)
	mux.HandleFunc("POST /api/attendance/leave-form", h.HandleLeaveForm)
	mux.HandleFunc("POST /api/attendance/leave", h.HandleLeaveSubmit)
	mux.HandleFunc("POST /api/attendance/late-form", h.HandleLateArrivalForm)
	mux.HandleFunc("POST /api/attendance/late", h.HandleLateArrivalSubmit)
	mux.HandleFunc("POST /api/attendance/early-form", h.HandleEarlyDepartureForm)
	mux.HandleFunc("POST /api/attendance/early", h.HandleEarlyDepartureSubmit)
	mux.HandleFunc("POST /api/attendance/approve", h.HandleApprove)
	mux.HandleFunc("POST /api/attendance/reject", h.HandleReject)
	mux.HandleFunc("POST /api/attendance/reject-submit", h.HandleRejectSubmit)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("ERROR encoding response: %v", err)
	}
}
