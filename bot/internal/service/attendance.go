package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"

	"oktel-bot/internal/i18n"
	"oktel-bot/internal/mattermost"
	"oktel-bot/internal/model"
	"oktel-bot/internal/store"
)

type AttendanceService struct {
	store  *store.AttendanceStore
	mm     *mattermost.Client
	botURL string // Bot service base URL for integration callbacks
}

func NewAttendanceService(store *store.AttendanceStore, mm *mattermost.Client, botURL string) *AttendanceService {
	return &AttendanceService{store: store, mm: mm, botURL: botURL}
}

// CheckInResult holds the result of a check-in operation.
type CheckInResult struct {
	Message string
	PostID  string
}

func (s *AttendanceService) CheckIn(ctx context.Context, userID, username, channelID, fileID string) (*CheckInResult, error) {
	now := time.Now()
	date := now.Format(time.DateOnly)

	record, err := s.store.GetTodayRecord(ctx, userID, date)
	if err != nil {
		return nil, fmt.Errorf("get today record: %w", err)
	}
	if record != nil {
		return nil, fmt.Errorf(i18n.T(ctx, "attendance.msg.already_checked_in", map[string]any{
			"Username": username, "Time": record.CheckIn.Format(time.TimeOnly),
		}))
	}

	// Get channel info to retrieve TeamID
	channelInfo, err := s.mm.GetChannel(channelID)
	if err != nil {
		return nil, fmt.Errorf("get channel info: %w", err)
	}

	record = &model.AttendanceRecord{
		UserID:    userID,
		Username:  username,
		TeamID:    channelInfo.TeamID,
		ChannelID: channelID,
		Date:      date,
		CheckIn:   &now,
		Status:    model.AttendanceStatusWorking,
	}
	if err := s.store.CreateRecord(ctx, record); err != nil {
		return nil, fmt.Errorf("create record: %w", err)
	}

	msg := "@" + username
	msgData := map[string]any{
		"Username": username,
	}
	if fileID != "" {
		msgData["FileID"] = fileID
		record.CheckInImageID = fileID
	}
	postReq := &mattermost.Post{
		ChannelID: channelID,
		Message:   msg,
		Props: mattermost.Props{
			MessageKey:  "attendance.msg.checked_in",
			MessageData: msgData,
		},
	}

	post, err := s.mm.CreatePost(postReq)
	if err != nil {
		return nil, fmt.Errorf("create post: %w", err)
	}

	record.PostID = post.ID
	if err := s.store.UpdateRecord(ctx, record); err != nil {
		return nil, fmt.Errorf("update record: %w", err)
	}

	return &CheckInResult{Message: fmt.Sprintf("%s checked in at %s", username, now.Format(time.TimeOnly)), PostID: post.ID}, nil
}

func (s *AttendanceService) BreakStart(ctx context.Context, userID, username, reason string) (string, error) {
	now := time.Now()
	date := now.Format(time.DateOnly)

	record, err := s.store.GetTodayRecord(ctx, userID, date)
	if err != nil {
		return "", err
	}
	if record == nil {
		return "", fmt.Errorf(i18n.T(ctx, "attendance.msg.not_checked_in", map[string]any{"Username": username}))
	}
	if record.Status == model.AttendanceStatusBreak {
		return "", fmt.Errorf(i18n.T(ctx, "attendance.msg.already_on_break", map[string]any{"Username": username}))
	}
	if record.Status != model.AttendanceStatusWorking {
		return "", fmt.Errorf(i18n.T(ctx, "attendance.msg.not_working", map[string]any{
			"Username": username, "Status": string(record.Status),
		}))
	}

	record.Breaks = append(record.Breaks, model.BreakRecord{
		Start:  now,
		Reason: reason,
	})
	record.Status = model.AttendanceStatusBreak
	if err := s.store.UpdateRecord(ctx, record); err != nil {
		return "", err
	}

	s.mm.CreatePost(&mattermost.Post{
		ChannelID: record.ChannelID,
		RootID:    record.PostID,
		Message:   "@" + username,
		Props: mattermost.Props{
			MessageKey: "attendance.msg.break_start",
			MessageData: map[string]any{
				"Username": username,
				"Reason":   reason,
			},
		},
	})
	return fmt.Sprintf("%s started break at %s", username, now.Format(time.TimeOnly)), nil
}

func (s *AttendanceService) BreakEnd(ctx context.Context, userID, username string) (string, error) {
	now := time.Now()
	date := now.Format(time.DateOnly)

	record, err := s.store.GetTodayRecord(ctx, userID, date)
	if err != nil {
		return "", err
	}
	if record == nil {
		return "", fmt.Errorf(i18n.T(ctx, "attendance.msg.not_checked_in", map[string]any{"Username": username}))
	}
	if record.Status != model.AttendanceStatusBreak {
		return "", fmt.Errorf(i18n.T(ctx, "attendance.msg.not_on_break", map[string]any{"Username": username}))
	}

	// Close the last open break
	last := &record.Breaks[len(record.Breaks)-1]
	last.End = &now
	breakDuration := now.Sub(last.Start)
	record.Status = model.AttendanceStatusWorking
	if err := s.store.UpdateRecord(ctx, record); err != nil {
		return "", err
	}

	displayReason := i18n.T(ctx, "attendance.break_reason."+last.Reason)
	fallbackData := map[string]any{
		"Username": username,
		"Reason":   displayReason,
		"Duration": formatDuration(ctx, breakDuration),
	}
	s.mm.CreatePost(&mattermost.Post{
		ChannelID: record.ChannelID,
		RootID:    record.PostID,
		Message:   i18n.T(ctx, "attendance.msg.break_end", fallbackData),
		Props: mattermost.Props{
			MessageKey: "attendance.msg.break_end",
			MessageData: map[string]any{
				"Username": username,
				"Reason":   last.Reason,
				"Duration": int(breakDuration.Round(time.Second).Seconds()),
			},
		},
	})
	return fmt.Sprintf("%s ended break at %s", username, now.Format(time.TimeOnly)), nil
}

func (s *AttendanceService) CheckOut(ctx context.Context, userID, username, fileID string) (string, error) {
	now := time.Now()
	date := now.Format(time.DateOnly)

	record, err := s.store.GetTodayRecord(ctx, userID, date)
	if err != nil {
		return "", err
	}
	if record == nil {
		return "", fmt.Errorf(i18n.T(ctx, "attendance.msg.not_checked_in", map[string]any{"Username": username}))
	}
	if record.Status == model.AttendanceStatusBreak {
		return "", fmt.Errorf(i18n.T(ctx, "attendance.err.must_end_break", map[string]any{"Username": username}))
	}
	if record.CheckOut != nil {
		return "", fmt.Errorf(i18n.T(ctx, "attendance.msg.already_checked_out", map[string]any{
			"Username": username, "Time": record.CheckOut.Format(time.TimeOnly),
		}))
	}

	record.CheckOut = &now
	record.Status = model.AttendanceStatusCompleted
	if fileID != "" {
		record.CheckOutImageID = fileID
	}
	if err := s.store.UpdateRecord(ctx, record); err != nil {
		return "", err
	}

	// Calculate total break time and build break details
	var totalBreak time.Duration
	var breakLines []string
	var breaksData []map[string]any
	for idx, b := range record.Breaks {
		end := now
		if b.End != nil {
			end = *b.End
		}
		dur := end.Sub(b.Start)
		totalBreak += dur
		displayReason := i18n.T(ctx, "attendance.break_reason."+b.Reason)
		breakLines = append(breakLines, fmt.Sprintf("%d. %s — %s",
			idx+1, displayReason, formatDuration(ctx, dur),
		))
		breaksData = append(breaksData, map[string]any{
			"Reason":   b.Reason,
			"Duration": int(dur.Round(time.Second).Seconds()),
		})
	}

	totalTime := now.Sub(*record.CheckIn)
	actualWork := totalTime - totalBreak

	breakList := ""
	if len(breakLines) > 0 {
		breakList = strings.Join(breakLines, "\n") + "\n"
	}

	// Fallback Message with pre-translated strings
	fallbackData := map[string]any{
		"Username":       username,
		"TotalTime":      formatDuration(ctx, totalTime),
		"ActualWorkTime": formatDuration(ctx, actualWork),
		"TotalBreakTime": formatDuration(ctx, totalBreak),
		"BreakCount":     len(record.Breaks),
		"BreakList":      breakList,
	}
	s.mm.CreatePost(&mattermost.Post{
		ChannelID: record.ChannelID,
		RootID:    record.PostID,
		Message:   i18n.T(ctx, "attendance.msg.checked_out", fallbackData),
		Props: mattermost.Props{
			MessageKey: "attendance.msg.checked_out",
			MessageData: map[string]any{
				"Username":        username,
				"TotalTime":       int(totalTime.Round(time.Second).Seconds()),
				"ActualWorkTime":  int(actualWork.Round(time.Second).Seconds()),
				"TotalBreakTime":  int(totalBreak.Round(time.Second).Seconds()),
				"BreakCount":      len(record.Breaks),
				"Breaks":          breaksData,
				"FileID":          fileID,
			},
		},
	})
	return fmt.Sprintf("%s checked out at %s", username, now.Format(time.TimeOnly)), nil
}

func (s *AttendanceService) CreateLeaveRequest(ctx context.Context, userID, username, channelID string, leaveType model.LeaveType, dates []string, reason, timeStr string) error {
	// Lookup username if not provided (dialog submissions may omit it)
	if username == "" {
		user, err := s.mm.GetUser(userID)
		if err != nil {
			return fmt.Errorf("get user info: %w", err)
		}
		username = user.Username
	}

	if err := validateDateList(ctx, dates); err != nil {
		return fmt.Errorf("validate dates: %w", err)
	}

	// Check for overlapping leave requests (pending or approved) on the same dates
	existing, err := s.store.FindLeaveRequestsByUserAndDates(ctx, userID, dates)
	if err != nil {
		return fmt.Errorf("check existing leaves: %w", err)
	}
	for _, e := range existing {
		if e.Type == leaveType && (e.Status == model.LeaveStatusPending || e.Status == model.LeaveStatusApproved) {
			overlap := findOverlap(dates, e.Dates)
			return fmt.Errorf(i18n.T(ctx, "attendance.err.duplicate_leave", map[string]any{"Dates": strings.Join(overlap, ", ")}))
		}
	}

	// Resolve approval channel before creating any posts
	channelInfo, err := s.mm.GetChannel(channelID)
	if err != nil {
		return fmt.Errorf("get channel info: %w", err)
	}

	// Extract suffix from channel name (e.g. "attendance-dev" → suffix "-dev")
	suffix := strings.TrimPrefix(channelInfo.Name, model.AttendanceChannel)
	approvalChannelName := model.AttendanceApprovalChannel + suffix
	approvalChannelID, err := s.mm.GetChannelByName(channelInfo.TeamID, approvalChannelName)
	if err != nil {
		return fmt.Errorf("get approval channel '%s': %w", approvalChannelName, err)
	}

	// Create DB record first to get the ID
	req := &model.LeaveRequest{
		UserID:            userID,
		Username:          username,
		TeamID:            channelInfo.TeamID,
		ChannelID:         channelID,
		ApprovalChannelID: approvalChannelID,
		Type:              leaveType,
		Dates:             dates,
		Reason:            reason,
		ExpectedTime:      timeStr,
		Status:            model.LeaveStatusPending,
	}
	if err := s.store.CreateLeaveRequest(ctx, req); err != nil {
		return fmt.Errorf("create leave request: %w", err)
	}

	idHex := req.ID.Hex()

	msgKey := leaveMessageKey(leaveType)
	msgData := leaveMessageData(username, leaveType, dates, reason, timeStr, string(model.LeaveStatusPending))

	// Post info message to main channel (no buttons)
	infoPost, err := s.mm.CreatePost(&mattermost.Post{
		ChannelID: channelID,
		Message:   "@" + username,
		Props: mattermost.Props{
			MessageKey:  msgKey,
			MessageData: msgData,
		},
	})
	if err != nil {
		return fmt.Errorf("post info message: %w", err)
	}

	// Post approval message to approval channel (with buttons)
	approvalPost, err := s.mm.CreatePost(&mattermost.Post{
		ChannelID: approvalChannelID,
		Message:   "@all",
		Props: mattermost.Props{
			MessageKey:  msgKey,
			MessageData: msgData,
			Attachments: []mattermost.Attachment{{
				Actions: []mattermost.Action{
					{
						Name: i18n.T(ctx, "attendance.btn.approve"),
						Type: "button",
						Integration: mattermost.Integration{
							URL: s.botURL + "/api/attendance/approve",
							Context: map[string]any{
								"request_id": idHex,
							},
						},
					},
					{
						Name: i18n.T(ctx, "attendance.btn.reject"),
						Type: "button",
						Integration: mattermost.Integration{
							URL: s.botURL + "/api/attendance/reject",
							Context: map[string]any{
								"request_id": idHex,
							},
						},
					},
				},
			}},
		},
	})
	if err != nil {
		return fmt.Errorf("post approval message: %w", err)
	}

	// Update record with post IDs
	req.PostID = infoPost.ID
	req.ApprovalPostID = approvalPost.ID
	return s.store.UpdateLeaveRequest(ctx, req)
}

func (s *AttendanceService) ApproveLeave(ctx context.Context, requestID, approverID, approverUsername string) (*LeaveUpdateResult, error) {
	id, err := bson.ObjectIDFromHex(requestID)
	if err != nil {
		return nil, fmt.Errorf("invalid request ID: %w", err)
	}

	req, err := s.store.GetLeaveRequestByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get leave request: %w", err)
	}
	if req == nil {
		return nil, fmt.Errorf(i18n.T(ctx, "attendance.err.not_found"))
	}
	if req.Status != model.LeaveStatusPending {
		return nil, fmt.Errorf(i18n.T(ctx, "attendance.err.already_processed", map[string]any{"Status": string(req.Status)}))
	}
	now := time.Now()
	req.Status = model.LeaveStatusApproved
	req.ApproverID = approverID
	req.ApproverUsername = approverUsername
	req.ApprovedAt = &now

	if err := s.store.UpdateLeaveRequest(ctx, req); err != nil {
		return nil, fmt.Errorf("update leave request: %w", err)
	}

	msgKey := leaveMessageKey(req.Type)
	msgData := leaveMessageData(req.Username, req.Type, req.Dates, req.Reason, req.ExpectedTime, string(req.Status))

	// Update info post in main channel (status only)
	s.mm.UpdatePost(req.PostID, &mattermost.Post{
		ChannelID: req.ChannelID,
		Message:   "@" + req.Username,
		Props: mattermost.Props{
			MessageKey:  msgKey,
			MessageData: msgData,
		},
	})

	// Reply in thread to notify requester
	s.mm.CreatePost(&mattermost.Post{
		ChannelID: req.ChannelID,
		RootID:    req.PostID,
		Message:   "@" + req.Username,
		Props: mattermost.Props{
			MessageKey: "attendance.msg.approved",
			MessageData: map[string]any{
				"Username": req.Username,
				"Approver": approverUsername,
			},
		},
	})

	return &LeaveUpdateResult{MessageKey: msgKey, MessageData: msgData}, nil
}

func (s *AttendanceService) RejectLeave(ctx context.Context, requestID, rejecterID, rejecterUsername, reason string) error {
	id, err := bson.ObjectIDFromHex(requestID)
	if err != nil {
		return fmt.Errorf("invalid request ID: %w", err)
	}

	req, err := s.store.GetLeaveRequestByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get leave request: %w", err)
	}
	if req == nil {
		return fmt.Errorf(i18n.T(ctx, "attendance.err.not_found"))
	}
	if req.Status != model.LeaveStatusPending {
		return fmt.Errorf(i18n.T(ctx, "attendance.err.already_processed", map[string]any{"Status": string(req.Status)}))
	}
	now := time.Now()
	req.Status = model.LeaveStatusRejected
	req.ApproverID = rejecterID
	req.ApproverUsername = rejecterUsername
	req.ApprovedAt = &now
	req.RejectReason = reason

	if err := s.store.UpdateLeaveRequest(ctx, req); err != nil {
		return fmt.Errorf("update leave request: %w", err)
	}

	msgKey := leaveMessageKey(req.Type)
	msgData := leaveMessageData(req.Username, req.Type, req.Dates, req.Reason, req.ExpectedTime, string(req.Status))

	// Update info post in main channel (status only)
	s.mm.UpdatePost(req.PostID, &mattermost.Post{
		ChannelID: req.ChannelID,
		Message:   "@" + req.Username,
		Props: mattermost.Props{
			MessageKey:  msgKey,
			MessageData: msgData,
		},
	})

	// Update approval post (remove buttons, show updated status)
	s.mm.UpdatePost(req.ApprovalPostID, &mattermost.Post{
		ChannelID: req.ApprovalChannelID,
		Message:   "@" + req.Username,
		Props: mattermost.Props{
			MessageKey:  msgKey,
			MessageData: msgData,
			Attachments: []mattermost.Attachment{},
		},
	})

	// Reply in thread to notify requester
	rejectData := map[string]any{
		"Username": req.Username,
		"Approver": rejecterUsername,
		"Reason":   reason,
	}
	s.mm.CreatePost(&mattermost.Post{
		ChannelID: req.ChannelID,
		RootID:    req.PostID,
		Message:   "@" + req.Username,
		Props: mattermost.Props{
			MessageKey:  "attendance.msg.rejected",
			MessageData: rejectData,
		},
	})

	return nil
}

// AttendanceReport is the top-level response for the report API.
type AttendanceReport struct {
	From  string       `json:"from"`
	To    string       `json:"to"`
	Users []UserReport `json:"users"`
}

// UserReport contains per-user attendance statistics.
type UserReport struct {
	UserID          string            `json:"user_id"`
	Username        string            `json:"username"`
	DaysWorked      int               `json:"days_worked"`
	DaysLeave       int               `json:"days_leave"`
	LateArrivals    int               `json:"late_arrivals"`
	EarlyDepartures int               `json:"early_departures"`
	BreakRest       int               `json:"break_rest"`
	BreakEat        int               `json:"break_eat"`
	BreakRestroomS  int               `json:"break_restroom_s"`
	BreakRestroomL  int               `json:"break_restroom_l"`
	BreakSmoke      int               `json:"break_smoke"`
	Attendance      []AttendanceEntry `json:"attendance"`
	LeaveRequests   []LeaveEntry      `json:"leave_requests"`
}

// BreakLog is a single break record with start/end times.
type BreakLog struct {
	Reason string `json:"reason"`
	Start int64  `json:"start"`
	End   int64  `json:"end,omitempty"`
}

type AttendanceEntry struct {
	Date             string     `json:"date"`
	CheckIn          int64      `json:"check_in,omitempty"`
	CheckInImageID   string     `json:"checkin_image_id,omitempty"`
	CheckOut         int64      `json:"check_out,omitempty"`
	CheckOutImageID  string     `json:"checkout_image_id,omitempty"`
	Status           string     `json:"status"`
	TotalBreaks    int        `json:"total_breaks"`
	BreakRest      int        `json:"break_rest"`
	BreakEat       int        `json:"break_eat"`
	BreakRestroomS int        `json:"break_restroom_s"`
	BreakRestroomL int        `json:"break_restroom_l"`
	BreakSmoke     int        `json:"break_smoke"`
	Breaks         []BreakLog `json:"breaks,omitempty"`
}

type LeaveEntry struct {
	Type         string   `json:"type"`
	Dates        []string `json:"dates"`
	Reason       string   `json:"reason"`
	ExpectedTime string   `json:"expected_time,omitempty"`
	Status       string   `json:"status"`
}

// GetReport returns attendance statistics for a date range, optionally filtered by user and/or team.
func (s *AttendanceService) GetReport(ctx context.Context, from, to, userID, teamID string) (*AttendanceReport, error) {
	if _, err := time.Parse(time.DateOnly, from); err != nil {
		return nil, fmt.Errorf("invalid 'from' date, use YYYY-MM-DD: %w", err)
	}
	if _, err := time.Parse(time.DateOnly, to); err != nil {
		return nil, fmt.Errorf("invalid 'to' date, use YYYY-MM-DD: %w", err)
	}
	if from > to {
		return nil, fmt.Errorf("'from' must be before or equal to 'to'")
	}

	attendanceRecs, err := s.store.GetAttendanceByDateRange(ctx, from, to, userID, teamID)
	if err != nil {
		return nil, fmt.Errorf("get attendance: %w", err)
	}

	leaveReqs, err := s.store.GetLeaveRequestsByDateRange(ctx, from, to, userID, teamID)
	if err != nil {
		return nil, fmt.Errorf("get leave requests: %w", err)
	}

	// Group by user
	userMap := make(map[string]*UserReport)
	getUser := func(uid, uname string) *UserReport {
		u, ok := userMap[uid]
		if !ok {
			u = &UserReport{UserID: uid, Username: uname}
			userMap[uid] = u
		}
		return u
	}

	for _, rec := range attendanceRecs {
		u := getUser(rec.UserID, rec.Username)
		entry := AttendanceEntry{
			Date:   rec.Date,
			Status: string(rec.Status),
		}
		if rec.CheckIn != nil {
			entry.CheckIn = rec.CheckIn.Unix()
			entry.CheckInImageID = rec.CheckInImageID
		}
		if rec.CheckOut != nil {
			entry.CheckOut = rec.CheckOut.Unix()
			entry.CheckOutImageID = rec.CheckOutImageID
		}

		for _, b := range rec.Breaks {
			entry.TotalBreaks++
			log := BreakLog{
				Reason: b.Reason,
				Start:  b.Start.Unix(),
			}
			if b.End != nil {
				log.End = b.End.Unix()
			}
			entry.Breaks = append(entry.Breaks, log)
			switch b.Reason {
			case "nghi_ngoi":
				u.BreakRest++
				entry.BreakRest++
			case "di_an":
				u.BreakEat++
				entry.BreakEat++
			case "tieu_tien":
				u.BreakRestroomS++
				entry.BreakRestroomS++
			case "dai_tien":
				u.BreakRestroomL++
				entry.BreakRestroomL++
			case "hut_thuoc":
				u.BreakSmoke++
				entry.BreakSmoke++
			}
		}
		u.Attendance = append(u.Attendance, entry)
		u.DaysWorked++
	}

	for _, req := range leaveReqs {
		u := getUser(req.UserID, req.Username)
		entry := LeaveEntry{
			Type:         string(req.Type),
			Dates:        req.Dates,
			Reason:       req.Reason,
			ExpectedTime: req.ExpectedTime,
			Status:       string(req.Status),
		}
		u.LeaveRequests = append(u.LeaveRequests, entry)

		// Count only approved or pending
		if req.Status == model.LeaveStatusRejected {
			continue
		}
		switch req.Type {
		case model.LeaveTypeLateArrival:
			u.LateArrivals++
		case model.LeaveTypeEarlyDeparture:
			u.EarlyDepartures++
		default:
			// Count leave days that fall within the range
			for _, d := range req.Dates {
				if d >= from && d <= to {
					u.DaysLeave++
				}
			}
		}
	}

	// Collect into sorted slice
	users := make([]UserReport, 0, len(userMap))
	for _, u := range userMap {
		users = append(users, *u)
	}

	return &AttendanceReport{From: from, To: to, Users: users}, nil
}

// AttendanceStats contains aggregate counts for a date range.
type AttendanceStats struct {
	From                  string `json:"from"`
	To                    string `json:"to"`
	TotalCheckedIn        int    `json:"total_checked_in"`
	TotalWorking          int    `json:"total_working"`
	TotalOnBreak          int    `json:"total_on_break"`
	TotalCheckedOut       int    `json:"total_checked_out"`
	TotalOnLeave          int    `json:"total_on_leave"`
	TotalLateArrival      int    `json:"total_late_arrivals"`
	TotalEarlyDepart      int    `json:"total_early_departures"`
	PendingRequests       int    `json:"pending_requests"`
}

// GetAttendanceStats returns aggregate attendance counts for a date range.
func (s *AttendanceService) GetStats(ctx context.Context, from, to string) (*AttendanceStats, error) {
	if _, err := time.Parse(time.DateOnly, from); err != nil {
		return nil, fmt.Errorf("invalid 'from' date, use YYYY-MM-DD: %w", err)
	}
	if _, err := time.Parse(time.DateOnly, to); err != nil {
		return nil, fmt.Errorf("invalid 'to' date, use YYYY-MM-DD: %w", err)
	}
	if from > to {
		return nil, fmt.Errorf("'from' must be before or equal to 'to'")
	}

	records, err := s.store.GetAttendanceByDateRange(ctx, from, to, "", "")
	if err != nil {
		return nil, fmt.Errorf("get attendance: %w", err)
	}

	leaves, err := s.store.GetLeaveRequestsByDateRange(ctx, from, to, "", "")
	if err != nil {
		return nil, fmt.Errorf("get leave requests: %w", err)
	}

	stats := &AttendanceStats{From: from, To: to}

	for _, rec := range records {
		stats.TotalCheckedIn++
		switch rec.Status {
		case model.AttendanceStatusWorking:
			stats.TotalWorking++
		case model.AttendanceStatusBreak:
			stats.TotalOnBreak++
		case model.AttendanceStatusCompleted:
			stats.TotalCheckedOut++
		}

	}

	for _, req := range leaves {
		if req.Status == model.LeaveStatusRejected {
			continue
		}
		if req.Status == model.LeaveStatusPending {
			stats.PendingRequests++
		}
		switch req.Type {
		case model.LeaveTypeLateArrival:
			stats.TotalLateArrival++
		case model.LeaveTypeEarlyDeparture:
			stats.TotalEarlyDepart++
		default:
			// Count only leave days within the range
			for _, d := range req.Dates {
				if d >= from && d <= to {
					stats.TotalOnLeave++
				}
			}
		}
	}

	return stats, nil
}

func validateDateList(ctx context.Context, dates []string) error {
	if len(dates) == 0 {
		return fmt.Errorf(i18n.T(ctx, "attendance.err.date_required"))
	}
	today := time.Now().Format(time.DateOnly)
	for _, d := range dates {
		if _, err := time.Parse(time.DateOnly, d); err != nil {
			return fmt.Errorf(i18n.T(ctx, "attendance.err.invalid_date", map[string]any{"Date": d}))
		}
		if d < today {
			return fmt.Errorf(i18n.T(ctx, "attendance.err.past_date", map[string]any{"Date": d}))
		}
	}
	return nil
}

func findOverlap(a, b []string) []string {
	set := make(map[string]struct{}, len(b))
	for _, v := range b {
		set[v] = struct{}{}
	}
	var out []string
	for _, v := range a {
		if _, ok := set[v]; ok {
			out = append(out, v)
		}
	}
	return out
}

// LeaveUpdateResult holds the MessageKey and MessageData for updating leave posts.
type LeaveUpdateResult struct {
	MessageKey  string
	MessageData map[string]any
}

func leaveMessageKey(leaveType model.LeaveType) string {
	switch leaveType {
	case model.LeaveTypeLateArrival:
		return "leave.msg.late"
	case model.LeaveTypeEarlyDeparture:
		return "leave.msg.early"
	default:
		return "leave.msg.leave"
	}
}

func leaveMessageData(username string, leaveType model.LeaveType, dates []string, reason, timeStr, status string) map[string]any {
	return map[string]any{
		"Username":     username,
		"LeaveType":    string(leaveType),
		"Dates":        strings.Join(dates, ", "),
		"Reason":       reason,
		"ExpectedTime": timeStr,
		"Status":       status,
	}
}

func formatDuration(ctx context.Context, d time.Duration) string {
	d = d.Round(time.Second)
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	s := int(d.Seconds()) % 60

	var parts []string
	if h > 0 {
		parts = append(parts, fmt.Sprintf("%d %s", h, i18n.T(ctx, "duration.h")))
	}
	if m > 0 {
		parts = append(parts, fmt.Sprintf("%d %s", m, i18n.T(ctx, "duration.m")))
	}
	if s > 0 || len(parts) == 0 {
		parts = append(parts, fmt.Sprintf("%d %s", s, i18n.T(ctx, "duration.s")))
	}
	return strings.Join(parts, " ")
}

