// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"strings"
	"time"
)

type DeletionStepStatus int

const (
	StepSuccess DeletionStepStatus = iota
	StepFailed
	StepPartial
)

func (s DeletionStepStatus) Icon() string {
	switch s {
	case StepSuccess:
		return "✅"
	case StepFailed:
		return "❌"
	case StepPartial:
		return "⚠️"
	default:
		return "❓"
	}
}

func (s DeletionStepStatus) Label() string {
	switch s {
	case StepSuccess:
		return "Deleted"
	case StepFailed:
		return "Failed"
	case StepPartial:
		return "Partial"
	default:
		return "Unknown"
	}
}

type DeletionSubStep struct {
	Name   string
	Status DeletionStepStatus
	Detail string
	Errors []string
}

type DeletionStepResult struct {
	Name     string
	Status   DeletionStepStatus
	Detail   string
	Errors   []string
	SubSteps []DeletionSubStep
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

func (r *PostDeletionReport) Render() string {
	var b strings.Builder

	successCount, failedCount, partialCount := r.CountStatuses()
	totalSteps := len(r.Steps)

	b.WriteString("### Post Deletion Report\n\n")
	b.WriteString(fmt.Sprintf("**Generated:** %s\n", r.Timestamp.Format("2006-01-02 at 15:04:05 UTC")))
	b.WriteString(fmt.Sprintf("**Post ID:** `%s`\n", r.PostID))
	b.WriteString(fmt.Sprintf("**Total Steps:** %d &nbsp;|&nbsp; ✅ Deleted: %d &nbsp;|&nbsp; ❌ Failed: %d &nbsp;|&nbsp; ⚠️ Partial: %d\n",
		totalSteps, successCount, failedCount, partialCount))
	b.WriteString("\n---\n\n")

	for i, step := range r.Steps {
		stepNum := i + 1
		r.renderStep(&b, stepNum, step)
	}

	b.WriteString("---\n\n")
	r.renderSummaryTable(&b)

	if failedCount > 0 || partialCount > 0 {
		b.WriteString("\n> ⚠️ **Post deletion incomplete.** Resolve failures and retry.\n")
	}

	return b.String()
}

func (r *PostDeletionReport) RenderSummary() string {
	var b strings.Builder

	_, failedCount, partialCount := r.CountStatuses()

	r.renderSummaryTable(&b)

	if failedCount > 0 || partialCount > 0 {
		b.WriteString("\n> ⚠️ **Post deletion incomplete.** Resolve failures and retry.\n")
	}

	return b.String()
}

func (r *PostDeletionReport) renderStep(b *strings.Builder, num int, step DeletionStepResult) {
	if len(step.SubSteps) > 0 {
		b.WriteString(fmt.Sprintf("##### %d. %s\n\n", num, step.Name))
		successCount := 0
		failedCount := 0
		for _, sub := range step.SubSteps {
			if sub.Status == StepSuccess {
				successCount++
			} else {
				failedCount++
			}
		}
		b.WriteString(fmt.Sprintf("**Revisions found:** %d &nbsp;|&nbsp; ✅ Cleared: %d &nbsp;|&nbsp; ❌ Failed: %d\n\n",
			len(step.SubSteps), successCount, failedCount))

		for j, sub := range step.SubSteps {
			b.WriteString(fmt.Sprintf("###### %s Revision %d — `%s`\n", sub.Status.Icon(), j+1, sub.Name))
			if sub.Detail != "" {
				b.WriteString(fmt.Sprintf("- %s\n", sub.Detail))
			}
			r.renderErrors(b, sub.Errors)
			b.WriteString("\n")
		}
	} else {
		b.WriteString(fmt.Sprintf("##### %d. %s %s\n", num, step.Status.Icon(), step.Name))
		if step.Detail != "" {
			b.WriteString(fmt.Sprintf("%s\n", step.Detail))
		}
		r.renderErrors(b, step.Errors)
	}
	b.WriteString("\n")
}

func (r *PostDeletionReport) renderErrors(b *strings.Builder, errs []string) {
	if len(errs) == 0 {
		return
	}
	b.WriteString("\n> **Error Log**\n> ```\n")
	for _, e := range errs {
		for _, line := range strings.Split(e, "\n") {
			b.WriteString(fmt.Sprintf("> %s\n", line))
		}
	}
	b.WriteString("> ```\n")
}

func (r *PostDeletionReport) renderSummaryTable(b *strings.Builder) {
	b.WriteString("##### 📊 Summary\n\n")
	b.WriteString("| # | Step | Status | Detail |\n")
	b.WriteString("|---|---|---|---|\n")
	for i, step := range r.Steps {
		b.WriteString(fmt.Sprintf("| %d | %s | %s %s | %s |\n",
			i+1, step.Name, step.Status.Icon(), step.Status.Label(), step.Detail))
	}
}

func (r *PostDeletionReport) CountStatuses() (success, failed, partial int) {
	for _, step := range r.Steps {
		switch step.Status {
		case StepSuccess:
			success++
		case StepFailed:
			failed++
		case StepPartial:
			partial++
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
