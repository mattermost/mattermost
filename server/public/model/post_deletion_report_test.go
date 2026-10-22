// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// stubTranslateFunc returns translation IDs as-is, or interpolates params if provided.
// This mimics the i18n.TranslateFunc signature for unit tests without loading real locale files.
func stubTranslateFunc(id string, args ...any) string {
	for _, arg := range args {
		if params, ok := arg.(map[string]any); ok {
			result := id
			for k, v := range params {
				result = strings.ReplaceAll(result, fmt.Sprintf("{{.%s}}", k), fmt.Sprintf("%v", v))
			}
			return result
		}
	}
	return id
}

func TestDeletionStepStatusIcon(t *testing.T) {
	tests := []struct {
		status   DeletionStepStatus
		expected string
	}{
		{StepSuccess, "✅"},
		{StepFailed, "❌"},
		{StepPartial, "⚠️"},
		{StepNotApplicable, "➖"},
		{DeletionStepStatus(99), "❓"},
	}

	for _, tc := range tests {
		assert.Equal(t, tc.expected, tc.status.Icon())
	}
}

func TestDeletionStepStatusLabel(t *testing.T) {
	T := stubTranslateFunc

	assert.Equal(t, "app.data_spillage.report.status.removed", StepSuccess.Label(T))
	assert.Equal(t, "app.data_spillage.report.status.failed", StepFailed.Label(T))
	assert.Equal(t, "app.data_spillage.report.status.partial", StepPartial.Label(T))
	assert.Equal(t, "app.data_spillage.report.status.not_applicable", StepNotApplicable.Label(T))
	assert.Equal(t, "app.data_spillage.report.status.unknown", DeletionStepStatus(99).Label(T))
}

func TestPostDeletionReportAddStep(t *testing.T) {
	report := &PostDeletionReport{
		PostID:    "post1",
		Timestamp: time.Now().UTC(),
	}

	report.AddStep("step1", StepSuccess, "detail1", nil)
	report.AddStep("step2", StepFailed, "detail2", []string{"err1"})

	require.Len(t, report.Steps, 2)

	assert.Equal(t, "step1", report.Steps[0].Name)
	assert.Equal(t, StepSuccess, report.Steps[0].Status)
	assert.Equal(t, "detail1", report.Steps[0].Detail)
	assert.Nil(t, report.Steps[0].Errors)

	assert.Equal(t, "step2", report.Steps[1].Name)
	assert.Equal(t, StepFailed, report.Steps[1].Status)
	assert.Equal(t, []string{"err1"}, report.Steps[1].Errors)
}

func TestPostDeletionReportAddStepWithParams(t *testing.T) {
	report := &PostDeletionReport{
		PostID:    "post1",
		Timestamp: time.Now().UTC(),
	}

	params := map[string]any{"Count": 5}
	report.AddStepWithParams("step1", StepSuccess, "detail", params, nil)

	require.Len(t, report.Steps, 1)
	assert.Equal(t, params, report.Steps[0].DetailParams)
}

func TestPostDeletionReportCountStatuses(t *testing.T) {
	report := &PostDeletionReport{
		PostID:    "post1",
		Timestamp: time.Now().UTC(),
	}

	report.AddStep("s1", StepSuccess, "", nil)
	report.AddStep("s2", StepSuccess, "", nil)
	report.AddStep("s3", StepFailed, "", nil)
	report.AddStep("s4", StepPartial, "", nil)
	report.AddStep("s5", StepPartial, "", nil)
	report.AddStep("s6", StepNotApplicable, "", nil)
	report.AddStep("s7", StepNotApplicable, "", nil)
	report.AddStep("s8", StepNotApplicable, "", nil)

	success, failed, partial, notApplicable := report.CountStatuses()
	assert.Equal(t, 2, success)
	assert.Equal(t, 1, failed)
	assert.Equal(t, 2, partial)
	assert.Equal(t, 3, notApplicable)
}

func TestPostDeletionReportCountStatusesEmpty(t *testing.T) {
	report := &PostDeletionReport{}
	success, failed, partial, notApplicable := report.CountStatuses()
	assert.Equal(t, 0, success)
	assert.Equal(t, 0, failed)
	assert.Equal(t, 0, partial)
	assert.Equal(t, 0, notApplicable)
}

func TestCountSubStepSuccesses(t *testing.T) {
	subSteps := []DeletionSubStep{
		{Name: "a", Status: StepSuccess},
		{Name: "b", Status: StepFailed},
		{Name: "c", Status: StepSuccess},
		{Name: "d", Status: StepPartial},
	}
	assert.Equal(t, 2, CountSubStepSuccesses(subSteps))
}

func TestCountSubStepSuccessesEmpty(t *testing.T) {
	assert.Equal(t, 0, CountSubStepSuccesses(nil))
	assert.Equal(t, 0, CountSubStepSuccesses([]DeletionSubStep{}))
}

func TestTranslateDetail(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{}

	t.Run("empty detail returns empty string", func(t *testing.T) {
		assert.Equal(t, "", report.translateDetail(T, "", nil))
	})

	t.Run("detail without params returns translation ID", func(t *testing.T) {
		assert.Equal(t, "some.key", report.translateDetail(T, "some.key", nil))
	})

	t.Run("detail with params interpolates", func(t *testing.T) {
		result := report.translateDetail(T, "{{.Count}} rows deleted.", map[string]any{"Count": 3})
		assert.Equal(t, "3 rows deleted.", result)
	})
}

func TestRenderAllSuccess(t *testing.T) {
	T := stubTranslateFunc
	ts := time.Date(2025, 1, 15, 10, 30, 0, 0, time.UTC)
	report := &PostDeletionReport{
		PostID:    "test-post-id",
		Timestamp: ts,
	}

	report.AddStep("app.data_spillage.report.step.priority_data", StepSuccess, "app.data_spillage.report.detail.deleted", nil)
	report.AddStep("app.data_spillage.report.step.reminders", StepSuccess, "app.data_spillage.report.detail.deleted", nil)

	result := report.Render(T)

	// Header
	assert.Contains(t, result, "### app.data_spillage.report.title")
	assert.Contains(t, result, "`test-post-id`")
	assert.Contains(t, result, "2025-01-15 at 10:30:00 UTC")

	// Steps rendered with success icon
	assert.Contains(t, result, "✅ app.data_spillage.report.step.priority_data")
	assert.Contains(t, result, "✅ app.data_spillage.report.step.reminders")
	assert.Contains(t, result, "app.data_spillage.report.detail.deleted")

	// Summary table
	assert.Contains(t, result, "📊 app.data_spillage.report.summary")
	assert.Contains(t, result, "|---|---|---|---|")

	// No incomplete warning when all succeed
	assert.NotContains(t, result, "app.data_spillage.report.incomplete_warning")
}

func TestRenderWithFailures(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{
		PostID:    "post123",
		Timestamp: time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC),
	}

	report.AddStep("step.success", StepSuccess, "ok", nil)
	report.AddStep("step.failed", StepFailed, "", []string{"db connection lost"})

	result := report.Render(T)

	// Should contain the incomplete warning
	assert.Contains(t, result, "app.data_spillage.report.incomplete_warning")

	// Error log for the failed step
	assert.Contains(t, result, "app.data_spillage.report.error_log")
	assert.Contains(t, result, "db connection lost")
}

func TestRenderWithPartialStatus(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{
		PostID:    "post456",
		Timestamp: time.Now().UTC(),
	}

	report.AddStep("step.partial", StepPartial, "some detail", nil)

	result := report.Render(T)
	assert.Contains(t, result, "⚠️")
	assert.Contains(t, result, "app.data_spillage.report.incomplete_warning")
}

func TestRenderWithSubSteps(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{
		PostID:    "post789",
		Timestamp: time.Now().UTC(),
	}

	report.Steps = append(report.Steps, DeletionStepResult{
		Name:   "app.data_spillage.report.step.edit_histories",
		Status: StepPartial,
		Detail: "{{.Count}} of {{.Total}} revisions cleared",
		DetailParams: map[string]any{
			"Count": 2,
			"Total": 3,
		},
		SubSteps: []DeletionSubStep{
			{Name: "edit1", Status: StepSuccess},
			{Name: "edit2", Status: StepSuccess},
			{Name: "edit3", Status: StepFailed, Errors: []string{"timeout"}},
		},
	})

	result := report.Render(T)

	// Sub-step heading
	assert.Contains(t, result, "app.data_spillage.report.step.edit_histories")

	// Revision counts
	assert.Contains(t, result, "app.data_spillage.report.revisions_found")

	// Individual sub-steps
	assert.Contains(t, result, "`edit1`")
	assert.Contains(t, result, "`edit2`")
	assert.Contains(t, result, "`edit3`")

	// Error from failed sub-step
	assert.Contains(t, result, "timeout")
}

func TestRenderSummaryAllSuccess(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{
		PostID:    "post-ok",
		Timestamp: time.Now().UTC(),
	}

	report.AddStep("step1", StepSuccess, "detail1", nil)
	report.AddStep("step2", StepSuccess, "detail2", nil)

	result := report.RenderSummary(T)

	// Summary table present
	assert.Contains(t, result, "📊 app.data_spillage.report.summary")
	assert.Contains(t, result, "step1")
	assert.Contains(t, result, "step2")

	// No warning
	assert.NotContains(t, result, "app.data_spillage.report.incomplete_warning")
}

func TestRenderSummaryWithFailure(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{
		PostID:    "post-fail",
		Timestamp: time.Now().UTC(),
	}

	report.AddStep("step1", StepSuccess, "", nil)
	report.AddStep("step2", StepFailed, "", []string{"err"})

	result := report.RenderSummary(T)

	assert.Contains(t, result, "app.data_spillage.report.incomplete_warning")
}

func TestRenderSummaryTableRowCount(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{
		PostID:    "post-rows",
		Timestamp: time.Now().UTC(),
	}

	for i := range 5 {
		report.AddStep(fmt.Sprintf("step%d", i+1), StepSuccess, "", nil)
	}

	result := report.RenderSummary(T)

	// Table header + separator + 5 data rows
	lines := strings.Split(strings.TrimSpace(result), "\n")
	tableLines := 0
	for _, line := range lines {
		if strings.HasPrefix(line, "|") {
			tableLines++
		}
	}
	// header + separator + 5 rows = 7
	assert.Equal(t, 7, tableLines)
}

func TestRenderErrorsMultiline(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{
		PostID:    "post-err",
		Timestamp: time.Now().UTC(),
	}

	report.AddStep("step1", StepFailed, "", []string{"line1\nline2\nline3"})

	result := report.Render(T)

	assert.Contains(t, result, "> line1")
	assert.Contains(t, result, "> line2")
	assert.Contains(t, result, "> line3")
}

func TestRenderEmptyReport(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{
		PostID:    "empty-post",
		Timestamp: time.Date(2025, 3, 1, 12, 0, 0, 0, time.UTC),
	}

	result := report.Render(T)

	// Should still render header and empty summary table
	assert.Contains(t, result, "### app.data_spillage.report.title")
	assert.Contains(t, result, "`empty-post`")
	assert.Contains(t, result, "📊 app.data_spillage.report.summary")

	// No warning since there are no failures
	assert.NotContains(t, result, "app.data_spillage.report.incomplete_warning")
}

func TestRenderStepWithParamsDetail(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{
		PostID:    "post-params",
		Timestamp: time.Now().UTC(),
	}

	report.AddStepWithParams(
		"app.data_spillage.report.step.fileinfo_rows",
		StepSuccess,
		"{{.Count}} rows deleted.",
		map[string]any{"Count": 7},
		nil,
	)

	result := report.Render(T)
	assert.Contains(t, result, "7 rows deleted.")
}

func TestRenderSubStepWithDetail(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{
		PostID:    "post-sub-detail",
		Timestamp: time.Now().UTC(),
	}

	report.Steps = append(report.Steps, DeletionStepResult{
		Name:   "edit_step",
		Status: StepSuccess,
		SubSteps: []DeletionSubStep{
			{
				Name:         "rev1",
				Status:       StepSuccess,
				Detail:       "**File Attachments:** {{.FileNames}} — **FileInfo Rows:** {{.Count}} deleted",
				DetailParams: map[string]any{"FileNames": "`doc.pdf`", "Count": 1},
			},
		},
	})

	result := report.Render(T)
	assert.Contains(t, result, "`doc.pdf`")
	assert.Contains(t, result, "1 deleted")
}

func TestRenderSummaryTableStatusIcons(t *testing.T) {
	T := stubTranslateFunc
	report := &PostDeletionReport{
		PostID:    "icons",
		Timestamp: time.Now().UTC(),
	}

	report.AddStep("s1", StepSuccess, "", nil)
	report.AddStep("s2", StepFailed, "", nil)
	report.AddStep("s3", StepPartial, "", nil)

	result := report.RenderSummary(T)

	// Each row should have the correct icon
	lines := strings.Split(result, "\n")
	var dataRows []string
	for _, line := range lines {
		if strings.HasPrefix(line, "|") && !strings.HasPrefix(line, "|---") && !strings.Contains(line, "app.data_spillage.report.column") {
			dataRows = append(dataRows, line)
		}
	}
	require.Len(t, dataRows, 3)
	assert.Contains(t, dataRows[0], "✅")
	assert.Contains(t, dataRows[1], "❌")
	assert.Contains(t, dataRows[2], "⚠️")
}
