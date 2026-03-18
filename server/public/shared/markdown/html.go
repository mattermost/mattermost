// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"fmt"
	"strings"
)

var htmlEscaper = strings.NewReplacer(
	`&`, "&amp;",
	`<`, "&lt;",
	`>`, "&gt;",
	`"`, "&quot;",
)

// RenderHTML produces HTML with the same behavior as the example renderer used in the CommonMark
// reference materials except for one slight difference: for brevity, no unnecessary whitespace is
// inserted between elements. The output is not defined by the CommonMark spec, and it exists
// primarily as an aid in testing.
func RenderHTML(markdown string) string {
	return RenderBlockHTML(Parse(markdown))
}

func RenderBlockHTML(block Block, referenceDefinitions []*ReferenceDefinition) (result string) {
	return renderBlockHTML(block, referenceDefinitions, false)
}

func renderBlockHTML(block Block, referenceDefinitions []*ReferenceDefinition, isTightList bool) string {
	var resultSb strings.Builder

	switch v := block.(type) {
	case *Document:
		for _, block := range v.Children {
			resultSb.WriteString(RenderBlockHTML(block, referenceDefinitions))
		}
	case *Paragraph:
		if len(v.Text) == 0 {
			return ""
		}
		if !isTightList {
			resultSb.WriteString("<p>")
		}
		for _, inline := range v.ParseInlines(referenceDefinitions) {
			resultSb.WriteString(RenderInlineHTML(inline))
		}
		if !isTightList {
			resultSb.WriteString("</p>")
		}
	case *List:
		if v.IsOrdered {
			if v.OrderedStart != 1 {
				resultSb.WriteString(fmt.Sprintf(`<ol start="%v">`, v.OrderedStart))
			} else {
				resultSb.WriteString("<ol>")
			}
		} else {
			resultSb.WriteString("<ul>")
		}
		for _, block := range v.Children {
			resultSb.WriteString(renderBlockHTML(block, referenceDefinitions, !v.IsLoose))
		}
		if v.IsOrdered {
			resultSb.WriteString("</ol>")
		} else {
			resultSb.WriteString("</ul>")
		}
	case *ListItem:
		resultSb.WriteString("<li>")
		for _, block := range v.Children {
			resultSb.WriteString(renderBlockHTML(block, referenceDefinitions, isTightList))
		}
		resultSb.WriteString("</li>")
	case *BlockQuote:
		resultSb.WriteString("<blockquote>")
		for _, block := range v.Children {
			resultSb.WriteString(RenderBlockHTML(block, referenceDefinitions))
		}
		resultSb.WriteString("</blockquote>")
	case *FencedCode:
		if info := v.Info(); info != "" {
			language := strings.Fields(info)[0]
			resultSb.WriteString(`<pre><code class="language-` + htmlEscaper.Replace(language) + `">`)
		} else {
			resultSb.WriteString("<pre><code>")
		}
		resultSb.WriteString(htmlEscaper.Replace(v.Code()))
		resultSb.WriteString("</code></pre>")
	case *IndentedCode:
		resultSb.WriteString("<pre><code>")
		resultSb.WriteString(htmlEscaper.Replace(v.Code()))
		resultSb.WriteString("</code></pre>")
	default:
		panic(fmt.Sprintf("missing case for type %T", v))
	}

	return resultSb.String()
}

func escapeURL(url string) (result string) {
	for i := 0; i < len(url); {
		switch b := url[i]; b {
		case ';', '/', '?', ':', '@', '&', '=', '+', '$', ',', '-', '_', '.', '!', '~', '*', '\'', '(', ')', '#':
			result += string(b)
			i++
		default:
			if b == '%' && i+2 < len(url) && isHexByte(url[i+1]) && isHexByte(url[i+2]) {
				result += url[i : i+3]
				i += 3
			} else if (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') {
				result += string(b)
				i++
			} else {
				result += fmt.Sprintf("%%%0X", b)
				i++
			}
		}
	}
	return
}

func RenderInlineHTML(inline Inline) (result string) {
	switch v := inline.(type) {
	case *Text:
		return htmlEscaper.Replace(v.Text)
	case *HardLineBreak:
		return "<br />"
	case *SoftLineBreak:
		return "\n"
	case *CodeSpan:
		return "<code>" + htmlEscaper.Replace(v.Code) + "</code>"
	case *InlineImage:
		result += `<img src="` + htmlEscaper.Replace(escapeURL(v.Destination())) + `" alt="` + htmlEscaper.Replace(renderImageAltText(v.Children)) + `"`
		if title := v.Title(); title != "" {
			result += ` title="` + htmlEscaper.Replace(title) + `"`
		}
		result += ` />`
	case *ReferenceImage:
		result += `<img src="` + htmlEscaper.Replace(escapeURL(v.Destination())) + `" alt="` + htmlEscaper.Replace(renderImageAltText(v.Children)) + `"`
		if title := v.Title(); title != "" {
			result += ` title="` + htmlEscaper.Replace(title) + `"`
		}
		result += ` />`
	case *InlineLink:
		var resultSb strings.Builder
		resultSb.WriteString(`<a href="` + htmlEscaper.Replace(escapeURL(v.Destination())) + `"`)
		if title := v.Title(); title != "" {
			resultSb.WriteString(` title="` + htmlEscaper.Replace(title) + `"`)
		}
		resultSb.WriteString(`>`)
		for _, inline := range v.Children {
			resultSb.WriteString(RenderInlineHTML(inline))
		}
		resultSb.WriteString("</a>")
		return resultSb.String()
	case *ReferenceLink:
		var resultSb strings.Builder
		resultSb.WriteString(`<a href="` + htmlEscaper.Replace(escapeURL(v.Destination())) + `"`)
		if title := v.Title(); title != "" {
			resultSb.WriteString(` title="` + htmlEscaper.Replace(title) + `"`)
		}
		resultSb.WriteString(`>`)
		for _, inline := range v.Children {
			resultSb.WriteString(RenderInlineHTML(inline))
		}
		resultSb.WriteString("</a>")
		return resultSb.String()
	case *Autolink:
		var resultSb strings.Builder
		resultSb.WriteString(`<a href="` + htmlEscaper.Replace(escapeURL(v.Destination())) + `">`)
		for _, inline := range v.Children {
			resultSb.WriteString(RenderInlineHTML(inline))
		}
		resultSb.WriteString("</a>")
		return resultSb.String()
	case *Emoji:
		escapedName := htmlEscaper.Replace(v.Name)
		result += fmt.Sprintf(`<span data-emoji-name="%s" data-literal=":%s:" />`, escapedName, escapedName)

	default:
		panic(fmt.Sprintf("missing case for type %T", v))
	}
	return
}

func renderImageAltText(children []Inline) string {
	var resultSb strings.Builder
	for _, inline := range children {
		resultSb.WriteString(renderImageChildAltText(inline))
	}
	return resultSb.String()
}

func renderImageChildAltText(inline Inline) string {
	switch v := inline.(type) {
	case *Text:
		return v.Text
	case *InlineImage:
		var resultSb strings.Builder
		for _, inline := range v.Children {
			resultSb.WriteString(renderImageChildAltText(inline))
		}
		return resultSb.String()
	case *InlineLink:
		var resultSb strings.Builder
		for _, inline := range v.Children {
			resultSb.WriteString(renderImageChildAltText(inline))
		}
		return resultSb.String()
	}
	return ""
}
