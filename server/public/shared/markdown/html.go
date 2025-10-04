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

func renderBlockHTML(block Block, referenceDefinitions []*ReferenceDefinition, isTightList bool) (result string) {
	switch v := block.(type) {
	case *Document:
		var resultSb33 strings.Builder
		for _, block := range v.Children {
			resultSb33.WriteString(RenderBlockHTML(block, referenceDefinitions))
		}
		result += resultSb33.String()
	case *Paragraph:
		if len(v.Text) == 0 {
			return
		}
		if !isTightList {
			result += "<p>"
		}
		var resultSb43 strings.Builder
		for _, inline := range v.ParseInlines(referenceDefinitions) {
			resultSb43.WriteString(RenderInlineHTML(inline))
		}
		result += resultSb43.String()
		if !isTightList {
			result += "</p>"
		}
	case *List:
		if v.IsOrdered {
			if v.OrderedStart != 1 {
				result += fmt.Sprintf(`<ol start="%v">`, v.OrderedStart)
			} else {
				result += "<ol>"
			}
		} else {
			result += "<ul>"
		}
		var resultSb59 strings.Builder
		for _, block := range v.Children {
			resultSb59.WriteString(renderBlockHTML(block, referenceDefinitions, !v.IsLoose))
		}
		result += resultSb59.String()
		if v.IsOrdered {
			result += "</ol>"
		} else {
			result += "</ul>"
		}
	case *ListItem:
		result += "<li>"
		var resultSb69 strings.Builder
		for _, block := range v.Children {
			resultSb69.WriteString(renderBlockHTML(block, referenceDefinitions, isTightList))
		}
		result += resultSb69.String()
		result += "</li>"
	case *BlockQuote:
		result += "<blockquote>"
		var resultSb75 strings.Builder
		for _, block := range v.Children {
			resultSb75.WriteString(RenderBlockHTML(block, referenceDefinitions))
		}
		result += resultSb75.String()
		result += "</blockquote>"
	case *FencedCode:
		if info := v.Info(); info != "" {
			language := strings.Fields(info)[0]
			result += `<pre><code class="language-` + htmlEscaper.Replace(language) + `">`
		} else {
			result += "<pre><code>"
		}
		result += htmlEscaper.Replace(v.Code()) + "</code></pre>"
	case *IndentedCode:
		result += "<pre><code>" + htmlEscaper.Replace(v.Code()) + "</code></pre>"
	default:
		panic(fmt.Sprintf("missing case for type %T", v))
	}
	return
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
		result += `<a href="` + htmlEscaper.Replace(escapeURL(v.Destination())) + `"`
		if title := v.Title(); title != "" {
			result += ` title="` + htmlEscaper.Replace(title) + `"`
		}
		result += `>`
		var resultSb145 strings.Builder
		for _, inline := range v.Children {
			resultSb145.WriteString(RenderInlineHTML(inline))
		}
		result += resultSb145.String()
		result += "</a>"
	case *ReferenceLink:
		result += `<a href="` + htmlEscaper.Replace(escapeURL(v.Destination())) + `"`
		if title := v.Title(); title != "" {
			result += ` title="` + htmlEscaper.Replace(title) + `"`
		}
		result += `>`
		var resultSb155 strings.Builder
		for _, inline := range v.Children {
			resultSb155.WriteString(RenderInlineHTML(inline))
		}
		result += resultSb155.String()
		result += "</a>"
	case *Autolink:
		result += `<a href="` + htmlEscaper.Replace(escapeURL(v.Destination())) + `">`
		var resultSb161 strings.Builder
		for _, inline := range v.Children {
			resultSb161.WriteString(RenderInlineHTML(inline))
		}
		result += resultSb161.String()
		result += "</a>"
	case *Emoji:
		escapedName := htmlEscaper.Replace(v.Name)
		result += fmt.Sprintf(`<span data-emoji-name="%s" data-literal=":%s:" />`, escapedName, escapedName)

	default:
		panic(fmt.Sprintf("missing case for type %T", v))
	}
	return
}

func renderImageAltText(children []Inline) (result string) {
	var resultSb176 strings.Builder
	for _, inline := range children {
		resultSb176.WriteString(renderImageChildAltText(inline))
	}
	result += resultSb176.String()
	return
}

func renderImageChildAltText(inline Inline) (result string) {
	switch v := inline.(type) {
	case *Text:
		return v.Text
	case *InlineImage:
		var resultSb187 strings.Builder
		for _, inline := range v.Children {
			resultSb187.WriteString(renderImageChildAltText(inline))
		}
		result += resultSb187.String()
	case *InlineLink:
		var resultSb191 strings.Builder
		for _, inline := range v.Children {
			resultSb191.WriteString(renderImageChildAltText(inline))
		}
		result += resultSb191.String()
	}
	return
}
