// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package report builds a shareable health report from rendered findings, and renders it as a
// self-contained HTML file or as Markdown. The server and mmctl, including mmctl offline with a
// Support Packet, build their reports here so they group, sort and label findings the same way.
package report

import (
	"cmp"
	"maps"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/utils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

// staleAfter is how old an evaluation can be before it appears to have stopped. The server
// evaluates hourly, so results older than two intervals mean evaluation stopped.
const staleAfter = 2 * time.Hour

const timeLayout = "2006-01-02 15:04 MST"

type Options struct {
	// T translates the report's labels. The findings must already be rendered.
	T i18n.TranslateFunc
	// Location is the time zone every time is shown in; nil means UTC.
	Location    *time.Location
	GeneratedAt time.Time
	// PointInTime marks findings from a one-off evaluation, such as of a Support Packet, whose age
	// says nothing about whether evaluation stopped. The list's EvaluatedAt is then when the data
	// was collected, or 0 if that is unknown.
	PointInTime bool

	// SiteURL also turns each finding's System Console path into a link; without it there is none.
	SiteURL       string
	ServerVersion string
	License       string
	// Company is who the license is issued to. It also names the report's file.
	Company string

	// Notes open the report, such as the Support Packet disclaimer.
	Notes []string
}

type Report struct {
	Title string
	// FileName is the name, without an extension, to save the report under, like the Support
	// Packet's: mm_site_health_<company>_<YYYY-MM-DDTHH-MM>, generated in Location. It also titles
	// the HTML report, so a browser suggests it when printing to PDF.
	FileName    string
	Notes       []string
	GeneratedAt Field
	EvaluatedAt Field
	// Site lists the site facts the caller set.
	Site []Field
	// Age is how old the evaluation was when the report was generated. It is zero for a
	// point-in-time evaluation, when nothing has been evaluated yet and when the server's clock
	// is ahead of the generating host's.
	Age time.Duration
	// Stale warns that evaluation appears to have stopped; it is empty otherwise.
	Stale string

	// Summary counts the open findings, those in the severity and unknown sections, or says
	// when the first evaluation runs.
	Summary string

	// Sections holds only the non-empty sections, in display order.
	Sections []Section
	Labels   Labels
}

type Field struct {
	Label string
	Value string
}

// Labels are the translated words the renderers put around findings.
type Labels struct {
	Summary       string
	Remediation   string
	Documentation string
	Console       string
	Details       string
	// Unknown tags a muted finding whose check could not run.
	Unknown string
}

type SectionKind string

const (
	SectionCritical SectionKind = "critical"
	SectionWarning  SectionKind = "warning"
	SectionInfo     SectionKind = "info"
	SectionUnknown  SectionKind = "unknown"
	SectionMuted    SectionKind = "muted"
	SectionResolved SectionKind = "resolved"
)

var sectionOrder = []SectionKind{SectionCritical, SectionWarning, SectionInfo, SectionUnknown, SectionMuted, SectionResolved}

type Section struct {
	Kind     SectionKind
	Title    string
	Findings []Finding
}

type Finding struct {
	// Code is the rule's stable identifier, for referring to the finding in a ticket.
	Code     string
	Area     string
	Severity string
	// Title names the node too for a node-scoped finding.
	Title   string
	Message string
	// Unknown is set when the check could not run.
	Unknown bool
	// Remediation is empty when the check could not run, as the problem is not currently detected.
	Remediation string
	DocsURL     string
	// ConsoleURL opens the finding's setting in the System Console; it is empty unless the
	// report has a site URL.
	ConsoleURL string
	// Details is sorted by label.
	Details []Field
}

// Build places each finding in exactly one section: resolved findings go to Resolved even if
// muted, muted findings to Muted, and the rest by state and severity. MutedBy is never included.
func Build(list *model.HealthFindingList, opts Options) *Report {
	T := opts.T
	location := cmp.Or(opts.Location, time.UTC)
	formatTime := func(t time.Time) string { return t.In(location).Format(timeLayout) }

	r := &Report{
		Title:    T("health.report.title"),
		FileName: fileName(opts.Company, opts.GeneratedAt.In(location)),
		Notes:    opts.Notes,
		Labels: Labels{
			Summary:       T("health.report.label.summary"),
			Remediation:   T("health.report.label.remediation"),
			Documentation: T("health.report.label.documentation"),
			Console:       T("health.report.label.console"),
			Details:       T("health.report.label.details"),
			Unknown:       sectionTitle(SectionUnknown, T),
		},
	}

	r.GeneratedAt = Field{T("health.report.header.generated_at"), formatTime(opts.GeneratedAt)}
	r.EvaluatedAt = Field{T("health.report.header.evaluated_at"), T("health.report.header.not_evaluated")}
	if opts.PointInTime {
		// The checks run when the report is built; the time that matters is when the data was collected.
		r.EvaluatedAt = Field{T("health.report.header.collected_at"), T("health.report.header.collected_unknown")}
	}
	if list.EvaluatedAt != 0 {
		evaluatedAt := time.UnixMilli(list.EvaluatedAt)
		r.EvaluatedAt.Value = formatTime(evaluatedAt)
		if !opts.PointInTime {
			r.Age = max(opts.GeneratedAt.Sub(evaluatedAt), 0)
		}
		if r.Age > staleAfter {
			r.Stale = T("health.report.header.stale")
		}
	}
	for _, field := range []Field{
		{T("health.report.header.site_url"), opts.SiteURL},
		{T("health.report.header.server_version"), opts.ServerVersion},
		{T("health.report.header.license"), opts.License},
		{T("health.report.header.company"), opts.Company},
	} {
		if field.Value != "" {
			r.Site = append(r.Site, field)
		}
	}

	findings := slices.Clone(list.Findings)
	slices.SortStableFunc(findings, compareFindings)

	bySection := map[SectionKind][]Finding{}
	for _, finding := range findings {
		kind := sectionOf(finding)
		bySection[kind] = append(bySection[kind], newFinding(finding, T, opts.SiteURL))
	}
	for _, kind := range sectionOrder {
		if len(bySection[kind]) > 0 {
			r.Sections = append(r.Sections, Section{Kind: kind, Title: sectionTitle(kind, T), Findings: bySection[kind]})
		}
	}

	var counts []string
	for _, c := range []struct {
		kind SectionKind
		id   string
	}{
		{SectionCritical, healthcheck.TranslationId("health.report.summary.critical")},
		{SectionWarning, healthcheck.TranslationId("health.report.summary.warning")},
		{SectionInfo, healthcheck.TranslationId("health.report.summary.info")},
		{SectionUnknown, healthcheck.TranslationId("health.report.summary.unknown")},
	} {
		if n := len(bySection[c.kind]); n > 0 {
			counts = append(counts, T(c.id, n, map[string]any{"Count": n}))
		}
	}
	r.Summary = cmp.Or(strings.Join(counts, ", "), T("health.report.summary.none"))
	if list.EvaluatedAt == 0 && len(list.Findings) == 0 && !opts.PointInTime {
		r.Summary = T("health.report.summary.not_evaluated")
	}

	return r
}

func fileName(company string, generatedAt time.Time) string {
	name := cmp.Or(utils.SanitizeFileName(company), "mattermost")
	return "mm_site_health_" + name + "_" + generatedAt.Format("2006-01-02T15-04")
}

func sectionOf(finding *model.HealthFinding) SectionKind {
	switch {
	case finding.State == string(healthcheck.StateResolved):
		return SectionResolved
	case finding.IsMuted():
		return SectionMuted
	case finding.State == string(healthcheck.StateUnknown):
		return SectionUnknown
	}

	switch healthcheck.Severity(finding.Severity) {
	case healthcheck.SeverityCritical:
		return SectionCritical
	case healthcheck.SeverityWarning:
		return SectionWarning
	default:
		return SectionInfo
	}
}

func newFinding(finding *model.HealthFinding, T i18n.TranslateFunc, siteURL string) Finding {
	title := finding.Title
	if finding.Scope != "" {
		title = T("health.report.finding.title_on_node", map[string]any{"Title": finding.Title, "Node": finding.Scope})
	}

	details := make([]Field, 0, len(finding.Details))
	for _, key := range slices.Sorted(maps.Keys(finding.Details)) {
		details = append(details, Field{Label: key, Value: finding.Details[key]})
	}

	unknown := finding.State == string(healthcheck.StateUnknown)
	remediation := finding.Remediation
	if unknown {
		remediation = ""
	}

	return Finding{
		Code:        finding.Code,
		Area:        areaLabel(finding.Area, T),
		Severity:    severityLabel(finding.Severity, T),
		Title:       title,
		Message:     finding.Message,
		Unknown:     unknown,
		Remediation: remediation,
		DocsURL:     finding.DocsURL,
		ConsoleURL:  consoleURL(siteURL, finding.ConsolePath),
		Details:     details,
	}
}

// consoleURL resolves a System Console path against the site URL, keeping any subpath the
// site is served under. A report is a file, so a bare path would not lead anywhere.
func consoleURL(siteURL, consolePath string) string {
	if siteURL == "" || consolePath == "" {
		return ""
	}
	link, err := url.JoinPath(siteURL, consolePath)
	if err != nil {
		return ""
	}
	return link
}

func compareFindings(a, b *model.HealthFinding) int {
	return cmp.Or(
		cmp.Compare(severityRank(a.Severity), severityRank(b.Severity)),
		cmp.Compare(areaRank(a.Area), areaRank(b.Area)),
		strings.Compare(string(a.Area), string(b.Area)),
		strings.Compare(a.Title, b.Title),
		strings.Compare(a.Scope, b.Scope),
		strings.Compare(a.Fingerprint, b.Fingerprint),
	)
}

func areaRank(area model.HealthArea) int {
	if i := slices.Index(model.AllHealthAreas(), area); i >= 0 {
		return i
	}
	return len(model.AllHealthAreas())
}

func severityRank(severity string) int {
	switch healthcheck.Severity(severity) {
	case healthcheck.SeverityCritical:
		return 0
	case healthcheck.SeverityWarning:
		return 1
	case healthcheck.SeverityInfo:
		return 2
	default:
		return 3
	}
}

func sectionTitle(kind SectionKind, T i18n.TranslateFunc) string {
	switch kind {
	case SectionCritical:
		return severityLabel(string(healthcheck.SeverityCritical), T)
	case SectionWarning:
		return severityLabel(string(healthcheck.SeverityWarning), T)
	case SectionInfo:
		return severityLabel(string(healthcheck.SeverityInfo), T)
	case SectionUnknown:
		return T("health.report.section.unknown")
	case SectionMuted:
		return T("health.report.section.muted")
	default:
		return T("health.report.section.resolved")
	}
}

func severityLabel(severity string, T i18n.TranslateFunc) string {
	switch healthcheck.Severity(severity) {
	case healthcheck.SeverityCritical:
		return T("health.report.severity.critical")
	case healthcheck.SeverityWarning:
		return T("health.report.severity.warning")
	case healthcheck.SeverityInfo:
		return T("health.report.severity.info")
	default:
		return severity
	}
}

func areaLabel(area model.HealthArea, T i18n.TranslateFunc) string {
	switch area {
	case model.AreaAuth:
		return T("health.report.area.auth")
	case model.AreaDatabase:
		return T("health.report.area.database")
	case model.AreaSearch:
		return T("health.report.area.search")
	case model.AreaJobs:
		return T("health.report.area.jobs")
	case model.AreaCluster:
		return T("health.report.area.cluster")
	case model.AreaNotifications:
		return T("health.report.area.notifications")
	case model.AreaCompliance:
		return T("health.report.area.compliance")
	case model.AreaPlatform:
		return T("health.report.area.platform")
	case model.AreaLicense:
		return T("health.report.area.license")
	case model.AreaVersion:
		return T("health.report.area.version")
	default:
		return string(area)
	}
}
