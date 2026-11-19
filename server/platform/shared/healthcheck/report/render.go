// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	_ "embed"
	"fmt"
	"html/template"
	"io"
	"net/url"
	"regexp"
	"slices"
	"strings"
)

//go:embed report.html.tmpl
var htmlSource string

var htmlTemplate = template.Must(template.New("report").Parse(htmlSource))

// Header lists the generation and evaluation times, then the site facts.
func (r *Report) Header() []Field {
	return slices.Concat([]Field{r.GeneratedAt, r.EvaluatedAt}, r.Site)
}

// WriteHTML writes the report as one self-contained HTML file: inline CSS, no scripts and no
// external assets. Its print stylesheet makes "Print, then Save as PDF" in a browser the PDF export.
func (r *Report) WriteHTML(w io.Writer) error {
	return htmlTemplate.Execute(w, r)
}

// WriteMarkdown writes the report as Markdown for pasting into Mattermost. Finding
// details are left out to keep it short.
func (r *Report) WriteMarkdown(w io.Writer) error {
	var b strings.Builder

	fmt.Fprintf(&b, "# %s\n\n", escapeMarkdown(r.Title))
	for _, note := range r.Notes {
		fmt.Fprintf(&b, "> %s\n\n", escapeMarkdown(note))
	}
	for _, field := range r.Header() {
		fmt.Fprintf(&b, "- **%s:** %s\n", escapeMarkdown(field.Label), escapeMarkdown(field.Value))
	}
	if r.Stale != "" {
		fmt.Fprintf(&b, "\n**%s**\n", escapeMarkdown(r.Stale))
	}

	fmt.Fprintf(&b, "\n## %s\n\n%s\n", escapeMarkdown(r.Labels.Summary), escapeMarkdown(r.Summary))

	for _, section := range r.Sections {
		fmt.Fprintf(&b, "\n## %s\n", escapeMarkdown(section.Title))
		switch section.Kind {
		case SectionUnknown, SectionMuted:
			b.WriteString("\n")
			for _, f := range section.Findings {
				tags := f.Severity
				if section.Kind == SectionMuted && f.Unknown {
					tags += ", " + r.Labels.Unknown
				}
				fmt.Fprintf(&b, "- **%s**%s (%s)", escapeMarkdown(f.Title), codeSuffix(f.Code), escapeMarkdown(tags))
				if f.Message != "" {
					fmt.Fprintf(&b, ": %s", escapeMarkdown(f.Message))
				}
				b.WriteString("\n")
				if f.Remediation != "" {
					fmt.Fprintf(&b, "  - **%s:** %s\n", escapeMarkdown(r.Labels.Remediation), escapeMarkdown(f.Remediation))
				}
			}
		case SectionResolved:
			b.WriteString("\n")
			for _, f := range section.Findings {
				fmt.Fprintf(&b, "- %s%s\n", escapeMarkdown(f.Title), codeSuffix(f.Code))
			}
		default:
			for _, f := range section.Findings {
				fmt.Fprintf(&b, "\n### \\[%s\\] %s%s\n", escapeMarkdown(f.Area), escapeMarkdown(f.Title), codeSuffix(f.Code))
				if f.Message != "" {
					fmt.Fprintf(&b, "\n%s\n", escapeMarkdown(f.Message))
				}
				if f.Remediation != "" {
					fmt.Fprintf(&b, "\n**%s:** %s\n", escapeMarkdown(r.Labels.Remediation), escapeMarkdown(f.Remediation))
				}
				if f.ConsoleURL != "" {
					fmt.Fprintf(&b, "\n%s\n", markdownLink(r.Labels.Console, f.ConsoleURL))
				}
				if f.DocsURL != "" {
					fmt.Fprintf(&b, "\n%s\n", markdownLink(r.Labels.Documentation, f.DocsURL))
				}
			}
		}
	}

	_, err := io.WriteString(w, b.String())
	return err
}

var (
	newlineReplacer = strings.NewReplacer("\r\n", " ", "\n", " ", "\r", " ")
	markdownEscaper = strings.NewReplacer(
		`\`, `\\`, "`", "\\`", "*", `\*`, "_", `\_`, "[", `\[`, "]", `\]`, "<", `\<`, ">", `\>`,
		"#", `\#`, "|", `\|`, "~", `\~`, "!", `\!`, "&", `\&`,
	)

	// markdownVerbatim matches bare URLs, which a backslash escape would break, and @mentions,
	// which a backslash escape would not stop from notifying when pasted into Mattermost. A mention
	// includes any underscores right before it, which Mattermost strips before looking for one,
	// and any mention run into it, such as @here in @all@here.
	// Neither can contain a character that starts a link, HTML or a code span.
	markdownVerbatim = regexp.MustCompile(`https?://[A-Za-z0-9\-._~:/?#!$&'+,;=%@]+|(?:\B|\b_+)@[A-Za-z0-9_](?:[A-Za-z0-9_.\-@]*[A-Za-z0-9_])?`)
)

// escapeMarkdown makes s render as the literal text it is, on one line, wherever it is placed,
// leaving bare URLs linkable and @mentions inert in a code span. Mattermost finds mentions inside
// a linked URL too, so a URL with an @ goes in a code span as well.
func escapeMarkdown(s string) string {
	s = strings.TrimSpace(newlineReplacer.Replace(s))

	var b strings.Builder
	last := 0
	for _, match := range markdownVerbatim.FindAllStringIndex(s, -1) {
		b.WriteString(markdownEscaper.Replace(s[last:match[0]]))
		if token := s[match[0]:match[1]]; strings.Contains(token, "@") {
			b.WriteString("`" + token + "`")
		} else {
			b.WriteString(token)
		}
		last = match[1]
	}
	b.WriteString(markdownEscaper.Replace(s[last:]))

	s = b.String()
	if s == "" {
		return s
	}

	// A leading "-" or "+" would start a list or a thematic break, and "1. " or "1) " an ordered list.
	if s[0] == '-' || s[0] == '+' {
		return `\` + s
	}
	digits := strings.IndexFunc(s, func(r rune) bool { return r < '0' || r > '9' })
	if digits > 0 && (s[digits] == '.' || s[digits] == ')') && (len(s) == digits+1 || s[digits+1] == ' ') {
		return s[:digits] + `\` + s[digits:]
	}
	return s
}

// codeSuffix shows a rule code after a title as inline code, or as escaped text if a backtick
// or line break would end the code span early.
func codeSuffix(code string) string {
	switch {
	case code == "":
		return ""
	case strings.ContainsAny(code, "`\r\n"):
		return " " + escapeMarkdown(code)
	default:
		return " `" + code + "`"
	}
}

// markdownLink links only to plain http(s) URLs; anything else is shown as text.
func markdownLink(label, link string) string {
	u, err := url.Parse(link)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || strings.ContainsAny(link, " \t\r\n()<>") {
		return escapeMarkdown(label + ": " + link)
	}
	return fmt.Sprintf("[%s](%s)", escapeMarkdown(label), link)
}
