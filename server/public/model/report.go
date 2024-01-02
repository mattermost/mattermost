// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"strconv"
	"time"

	pUtils "github.com/mattermost/mattermost/server/public/utils"
)

const (
	ReportDurationLast30Days    = "last_30_days"
	ReportDurationPreviousMonth = "previous_month"
	ReportDurationLast6Months   = "last_6_months"

	ReportingMaxPageSize = 100
)

var (
	UserReportSortColumns = []string{"CreateAt", "Username", "FirstName", "LastName", "Nickname", "Email", "Roles"}
)

type ReportableObject interface {
	ToReport() []string
}

type ReportingBaseOptions struct {
	SortDesc        bool
	Direction       string // Accepts only "up" or "down"
	PageSize        int
	SortColumn      string
	FromColumnValue string
	FromId          string
	DateRange       string
	StartAt         int64
	EndAt           int64
}

func (options *ReportingBaseOptions) PopulateDateRange(now time.Time) {
	startAt := int64(0)
	endAt := int64(0)

	if options.DateRange == ReportDurationLast30Days {
		startAt = now.AddDate(0, 0, -30).UnixMilli()
	} else if options.DateRange == ReportDurationPreviousMonth {
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
		startAt = startOfMonth.AddDate(0, -1, 0).UnixMilli()
		endAt = startOfMonth.UnixMilli()
	} else if options.DateRange == ReportDurationLast6Months {
		startAt = now.AddDate(0, -6, -0).UnixMilli()
	}

	options.StartAt = startAt
	options.EndAt = endAt
}

func (options *ReportingBaseOptions) IsValid() *AppError {
	if options.EndAt > 0 && options.StartAt > options.EndAt {
		return NewAppError("ReportingBaseOptions.IsValid", "model.reporting_base_options.is_valid.bad_date_range", nil, "", http.StatusBadRequest)
	}

	return nil
}

type UserReportQuery struct {
	User
	UserPostStats
}

type UserReport struct {
	Id          string `json:"id"`
	Username    string `json:"username"`
	Email       string `json:"email"`
	CreateAt    int64  `json:"create_at,omitempty"`
	DisplayName string `json:"display_name"`
	Roles       string `json:"roles"`
	UserPostStats
}

func (u *UserReport) ToReport() []string {
	lastStatusAt := ""
	if u.LastStatusAt != nil {
		lastStatusAt = time.UnixMilli(*u.LastStatusAt).String()
	}
	lastPostDate := ""
	if u.LastPostDate != nil {
		lastStatusAt = time.UnixMilli(*u.LastPostDate).String()
	}
	daysActive := ""
	if u.DaysActive != nil {
		daysActive = strconv.Itoa(*u.DaysActive)
	}
	totalPosts := ""
	if u.TotalPosts != nil {
		totalPosts = strconv.Itoa(*u.TotalPosts)
	}
	lastLogin := ""
	if u.LastLogin > 0 {
		lastLogin = time.UnixMilli(u.LastLogin).String()
	}

	return []string{
		u.Id,
		u.Username,
		u.Email,
		time.UnixMilli(u.CreateAt).String(),
		u.DisplayName,
		u.Roles,
		lastLogin,
		lastStatusAt,
		lastPostDate,
		daysActive,
		totalPosts,
	}
}

type UserReportOptions struct {
	ReportingBaseOptions
	Role         string
	Team         string
	HasNoTeam    bool
	HideActive   bool
	HideInactive bool
}

func (u *UserReportOptions) IsValid() *AppError {
	if appErr := u.ReportingBaseOptions.IsValid(); appErr != nil {
		return appErr
	}

	// Validate against the columns we allow sorting for
	if !pUtils.Contains(UserReportSortColumns, u.SortColumn) {
		return NewAppError("UserReportOptions.IsValid", "model.user_report_options.is_valid.invalid_sort_column", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (u *UserReportQuery) ToReport() *UserReport {
	return &UserReport{
		Id:            u.Id,
		Username:      u.Username,
		Email:         u.Email,
		CreateAt:      u.CreateAt,
		DisplayName:   u.GetDisplayName(ShowNicknameFullName),
		Roles:         u.Roles,
		UserPostStats: u.UserPostStats,
	}
}
