// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

type DeletionStepStatus int

const (
	StepSuccess DeletionStepStatus = iota
	StepFailed
	StepPartial
	StepNotApplicable
)

func (s DeletionStepStatus) Icon() string {
	switch s {
	case StepSuccess:
		return "✅"
	case StepFailed:
		return "❌"
	case StepPartial:
		return "⚠️"
	case StepNotApplicable:
		return "➖"
	default:
		return "❓"
	}
}

func (s DeletionStepStatus) Label(T i18n.TranslateFunc) string {
	switch s {
	case StepSuccess:
		return T("app.data_spillage.report.status.removed")
	case StepFailed:
		return T("app.data_spillage.report.status.failed")
	case StepPartial:
		return T("app.data_spillage.report.status.partial")
	case StepNotApplicable:
		return T("app.data_spillage.report.status.not_applicable")
	default:
		return T("app.data_spillage.report.status.unknown")
	}
}

type DeletionSubStep struct {
	Name         string
	Status       DeletionStepStatus
	Detail       string
	DetailParams map[string]any
	Errors       []string
}

type DeletionStepResult struct {
	Name         string
	Status       DeletionStepStatus
	Detail       string
	DetailParams map[string]any
	Errors       []string
	SubSteps     []DeletionSubStep
}

type PostDeletionReport struct {
	PostID    string
	Timestamp time.Time
	Steps     []DeletionStepResult
}

func (r *PostDeletionReport) AddStep(name string, status DeletionStepStatus, detail string, errs []string) {
	r.Steps = append(r.Steps, DeletionStepResult{
		Name:   name,
		Status: status,
		Detail: detail,
		Errors: errs,
	})
}

func (r *PostDeletionReport) AddStepWithParams(name string, status DeletionStepStatus, detail string, detailParams map[string]any, errs []string) {
	r.Steps = append(r.Steps, DeletionStepResult{
		Name:         name,
		Status:       status,
		Detail:       detail,
		DetailParams: detailParams,
		Errors:       errs,
	})
}

func (r *PostDeletionReport) translateDetail(T i18n.TranslateFunc, detail string, detailParams map[string]any) string {
	if detail == "" {
		return ""
	}
	if len(detailParams) > 0 {
		if count, ok := detailParams["Count"]; ok {
			return T(detail, count, detailParams)
		}
		return T(detail, detailParams)
	}
	return T(detail)
}

func (r *PostDeletionReport) Render(T i18n.TranslateFunc) string {
	var b strings.Builder

	successCount, failedCount, partialCount, notApplicableCount := r.CountStatuses()
	totalSteps := len(r.Steps)

	b.WriteString(fmt.Sprintf("### %s\n\n", T("app.data_spillage.report.title")))
	b.WriteString(fmt.Sprintf("**%s** %s\n", T("app.data_spillage.report.generated"), r.Timestamp.Format("2006-01-02 at 15:04:05 UTC")))
	b.WriteString(fmt.Sprintf("**%s** `%s`\n", T("app.data_spillage.report.post_id"), r.PostID))
	b.WriteString(fmt.Sprintf("**%s** %d &nbsp;|&nbsp; ✅ %s: %d &nbsp;|&nbsp; ➖ %s: %d &nbsp;|&nbsp; ⚠️ %s: %d &nbsp;|&nbsp; ❌ %s: %d\n",
		T("app.data_spillage.report.total_steps"), totalSteps,
		T("app.data_spillage.report.status.removed"), successCount,
		T("app.data_spillage.report.status.not_applicable"), notApplicableCount,
		T("app.data_spillage.report.status.partial"), partialCount,
		T("app.data_spillage.report.status.failed"), failedCount))
	b.WriteString("\n---\n\n")

	for i, step := range r.Steps {
		stepNum := i + 1
		r.renderStep(T, &b, stepNum, step)
	}

	b.WriteString("---\n\n")
	r.renderSummaryTable(T, &b)

	if failedCount > 0 || partialCount > 0 {
		b.WriteString(fmt.Sprintf("\n> ⚠️ **%s**\n", T("app.data_spillage.report.incomplete_warning")))
	}

	return b.String()
}

func (r *PostDeletionReport) RenderSummary(T i18n.TranslateFunc) string {
	var b strings.Builder

	_, failedCount, partialCount, _ := r.CountStatuses()

	r.renderSummaryTable(T, &b)

	if failedCount > 0 || partialCount > 0 {
		b.WriteString(fmt.Sprintf("\n> ⚠️ **%s**\n", T("app.data_spillage.report.incomplete_warning")))
	}

	return b.String()
}

func (r *PostDeletionReport) renderStep(T i18n.TranslateFunc, b *strings.Builder, num int, step DeletionStepResult) {
	translatedName := T(step.Name)
	translatedDetail := r.translateDetail(T, step.Detail, step.DetailParams)

	if len(step.SubSteps) > 0 {
		b.WriteString(fmt.Sprintf("##### %d. %s\n\n", num, translatedName))
		successCount := 0
		failedCount := 0
		for _, sub := range step.SubSteps {
			if sub.Status == StepSuccess {
				successCount++
			} else {
				failedCount++
			}
		}
		b.WriteString(fmt.Sprintf("**%s** %d &nbsp;|&nbsp; ✅ %s: %d &nbsp;|&nbsp; ❌ %s: %d\n\n",
			T("app.data_spillage.report.revisions_found"), len(step.SubSteps),
			T("app.data_spillage.report.cleared"), successCount,
			T("app.data_spillage.report.status.failed"), failedCount))

		for j, sub := range step.SubSteps {
			subDetail := r.translateDetail(T, sub.Detail, sub.DetailParams)
			b.WriteString(fmt.Sprintf("###### %s %s %d — `%s`\n", sub.Status.Icon(), T("app.data_spillage.report.revision"), j+1, sub.Name))
			if subDetail != "" {
				b.WriteString(fmt.Sprintf("- %s\n", subDetail))
			}
			r.renderErrors(T, b, sub.Errors)
			b.WriteString("\n")
		}
	} else {
		b.WriteString(fmt.Sprintf("##### %d. %s %s\n", num, step.Status.Icon(), translatedName))
		if translatedDetail != "" {
			b.WriteString(fmt.Sprintf("%s\n", translatedDetail))
		}
		r.renderErrors(T, b, step.Errors)
	}
	b.WriteString("\n")
}

func (r *PostDeletionReport) renderErrors(T i18n.TranslateFunc, b *strings.Builder, errs []string) {
	if len(errs) == 0 {
		return
	}
	b.WriteString(fmt.Sprintf("\n> **%s**\n> ```\n", T("app.data_spillage.report.error_log")))
	for _, e := range errs {
		for line := range strings.SplitSeq(e, "\n") {
			b.WriteString(fmt.Sprintf("> %s\n", line))
		}
	}
	b.WriteString("> ```\n")
}

func (r *PostDeletionReport) renderSummaryTable(T i18n.TranslateFunc, b *strings.Builder) {
	b.WriteString(fmt.Sprintf("##### 📊 %s\n\n", T("app.data_spillage.report.summary")))
	b.WriteString(fmt.Sprintf("| # | %s | %s | %s |\n",
		T("app.data_spillage.report.column.step"),
		T("app.data_spillage.report.column.status"),
		T("app.data_spillage.report.column.detail")))
	b.WriteString("|---|---|---|---|\n")
	for i, step := range r.Steps {
		translatedName := T(step.Name)
		translatedDetail := r.translateDetail(T, step.Detail, step.DetailParams)
		b.WriteString(fmt.Sprintf("| %d | %s | %s | %s |\n",
			i+1, translatedName, step.Status.Icon(), translatedDetail))
	}
}

func (r *PostDeletionReport) CountStatuses() (success, failed, partial, notApplicable int) {
	for _, step := range r.Steps {
		switch step.Status {
		case StepSuccess:
			success++
		case StepFailed:
			failed++
		case StepPartial:
			partial++
		case StepNotApplicable:
			notApplicable++
		}
	}
	return
}

func CountSubStepSuccesses(subSteps []DeletionSubStep) int {
	count := 0
	for _, s := range subSteps {
		if s.Status == StepSuccess {
			count++
		}
	}
	return count
}
