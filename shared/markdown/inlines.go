// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"container/list"
	"strings"
	"unicode"
	"unicode/utf8"
)

type Inline interface {
	IsInline() bool
}

type inlineBase struct{}

func (inlineBase) IsInline() bool { return true }

type Text struct {
	inlineBase

	Text  string
	Range Range
}

type CodeSpan struct {
	inlineBase

	Code string
}

type HardLineBreak struct {
	inlineBase
}

type SoftLineBreak struct {
	inlineBase
}

type InlineLinkOrImage struct {
	inlineBase

	Children []Inline

	RawDestination Range

	markdown string
	rawTitle string
}

func (i *InlineLinkOrImage) Destination() string {
	return Unescape(i.markdown[i.RawDestination.Position:i.RawDestination.End])
}

func (i *InlineLinkOrImage) Title() string {
	return Unescape(i.rawTitle)
}

type InlineLink struct {
	InlineLinkOrImage
}

type InlineImage struct {
	InlineLinkOrImage
}

type ReferenceLinkOrImage struct {
	inlineBase
	*ReferenceDefinition

	Children []Inline
}

type ReferenceLink struct {
	ReferenceLinkOrImage
}

type ReferenceImage struct {
	ReferenceLinkOrImage
}

type Autolink struct {
	inlineBase

	Children []Inline

	RawDestination Range

	markdown string
}

func (i *Autolink) Destination() string {
	destination := Unescape(i.markdown[i.RawDestination.Position:i.RawDestination.End])

	if strings.HasPrefix(destination, "www") {
		destination = "http://" + destination
	}

	return destination
}

type delimiterType int

const (
	linkOpeningDelimiter delimiterType = iota
	imageOpeningDelimiter
)

type delimiter struct {
	Type       delimiterType
	IsInactive bool
	TextNode   int
	Range      Range
}

type inlineParser struct {
	markdown             string
	ranges               []Range
	referenceDefinitions []*ReferenceDefinition

	raw            string
	position       int
	inlines        []Inline
	delimiterStack *list.List
}

func newInlineParser(markdown string, ranges []Range, referenceDefinitions []*ReferenceDefinition) *inlineParser {
	return &inlineParser{
		markdown:             markdown,
		ranges:               ranges,
		referenceDefinitions: referenceDefinitions,
		delimiterStack:       list.New(),
	}
}

func (p *inlineParser) parseBackticks() {
	count := 1
	for i := p.position + 1; i < len(p.raw) && p.raw[i] == '`'; i++ {
		count++
	}
	opening := p.raw[p.position : p.position+count]
	search := p.position + count
	for search < len(p.raw) {
		end := strings.Index(p.raw[search:], opening)
		if end == -1 {
			break
		}
		if search+end+count < len(p.raw) && p.raw[search+end+count] == '`' {
			search += end + count
			for search < len(p.raw) && p.raw[search] == '`' {
				search++
			}
			continue
		}
		code := strings.Join(strings.Fields(p.raw[p.position+count:search+end]), " ")
		p.position = search + end + count
		p.inlines = append(p.inlines, &CodeSpan{
			Code: code,
		})
		return
	}
	p.position += len(opening)
	absPos := relativeToAbsolutePosition(p.ranges, p.position-len(opening))
	p.inlines = append(p.inlines, &Text{
		Text:  opening,
		Range: Range{absPos, absPos + len(opening)},
	})
}

func (p *inlineParser) parseLineEnding() {
	if p.position >= 1 && p.raw[p.position-1] == '\t' {
		p.inlines = append(p.inlines, &HardLineBreak{})
	} else if p.position >= 2 && p.raw[p.position-1] == ' ' && (p.raw[p.position-2] == '\t' || p.raw[p.position-1] == ' ') {
		p.inlines = append(p.inlines, &HardLineBreak{})
	} else {
		p.inlines = append(p.inlines, &SoftLineBreak{})
	}
	p.position++
	if p.position < len(p.raw) && p.raw[p.position] == '\n' {
		p.position++
	}
}

func (p *inlineParser) parseEscapeCharacter() {
	if p.position+1 < len(p.raw) && isEscapableByte(p.raw[p.position+1]) {
		absPos := relativeToAbsolutePosition(p.ranges, p.position+1)
		p.inlines = append(p.inlines, &Text{
			Text:  string(p.raw[p.position+1]),
			Range: Range{absPos, absPos + len(string(p.raw[p.position+1]))},
		})
		p.position += 2
	} else {
		absPos := relativeToAbsolutePosition(p.ranges, p.position)
		p.inlines = append(p.inlines, &Text{
			Text:  `\`,
			Range: Range{absPos, absPos + 1},
		})
		p.position++
	}
}

func (p *inlineParser) parseText() {
	if next := strings.IndexAny(p.raw[p.position:], "\r\n\\`&![]wW:"); next == -1 {
		absPos := relativeToAbsolutePosition(p.ranges, p.position)
		p.inlines = append(p.inlines, &Text{
			Text:  strings.TrimRightFunc(p.raw[p.position:], isWhitespace),
			Range: Range{absPos, absPos + len(p.raw[p.position:])},
		})
		p.position = len(p.raw)
	} else {
		absPos := relativeToAbsolutePosition(p.ranges, p.position)
		if p.raw[p.position+next] == '\r' || p.raw[p.position+next] == '\n' {
			s := strings.TrimRightFunc(p.raw[p.position:p.position+next], isWhitespace)
			p.inlines = append(p.inlines, &Text{
				Text:  s,
				Range: Range{absPos, absPos + len(s)},
			})
		} else {
			if next == 0 {
				// Always read at least one character since 'w', 'W', and ':' may not actually match another
				// type of node
				next = 1
			}

			p.inlines = append(p.inlines, &Text{
				Text:  p.raw[p.position : p.position+next],
				Range: Range{absPos, absPos + next},
			})
		}
		p.position += next
	}
}

func (p *inlineParser) parseLinkOrImageDelimiter() {
	absPos := relativeToAbsolutePosition(p.ranges, p.position)
	if p.raw[p.position] == '[' {
		p.inlines = append(p.inlines, &Text{
			Text:  "[",
			Range: Range{absPos, absPos + 1},
		})
		p.delimiterStack.PushBack(&delimiter{
			Type:     linkOpeningDelimiter,
			TextNode: len(p.inlines) - 1,
			Range:    Range{p.position, p.position + 1},
		})
		p.position++
	} else if p.raw[p.position] == '!' && p.position+1 < len(p.raw) && p.raw[p.position+1] == '[' {
		p.inlines = append(p.inlines, &Text{
			Text:  "![",
			Range: Range{absPos, absPos + 2},
		})
		p.delimiterStack.PushBack(&delimiter{
			Type:     imageOpeningDelimiter,
			TextNode: len(p.inlines) - 1,
			Range:    Range{p.position, p.position + 2},
		})
		p.position += 2
	} else {
		p.inlines = append(p.inlines, &Text{
			Text:  "!",
			Range: Range{absPos, absPos + 1},
		})
		p.position++
	}
}

func (p *inlineParser) peekAtInlineLinkDestinationAndTitle(position int, isImage bool) (destination, title Range, end int, ok bool) {
	if position >= len(p.raw) || p.raw[position] != '(' {
		return
	}
	position++

	destinationStart := nextNonWhitespace(p.raw, position)
	if destinationStart >= len(p.raw) {
		return
	} else if p.raw[destinationStart] == ')' {
		return Range{destinationStart, destinationStart}, Range{destinationStart, destinationStart}, destinationStart + 1, true
	}

	destination, end, ok = parseLinkDestination(p.raw, destinationStart)
	if !ok {
		return
	}
	position = end

	if isImage && position < len(p.raw) && isWhitespaceByte(p.raw[position]) {
		dimensionsStart := nextNonWhitespace(p.raw, position)
		if dimensionsStart >= len(p.raw) {
			return
		}

		if p.raw[dimensionsStart] == '=' {
			// Read optional image dimensions even if we don't use them
			_, end, ok = parseImageDimensions(p.raw, dimensionsStart)
			if !ok {
				return
			}

			position = end
		}
	}

	if position < len(p.raw) && isWhitespaceByte(p.raw[position]) {
		titleStart := nextNonWhitespace(p.raw, position)
		if titleStart >= len(p.raw) {
			return
		} else if p.raw[titleStart] == ')' {
			return destination, Range{titleStart, titleStart}, titleStart + 1, true
		}

		if p.raw[titleStart] == '"' || p.raw[titleStart] == '\'' || p.raw[titleStart] == '(' {
			title, end, ok = parseLinkTitle(p.raw, titleStart)
			if !ok {
				return
			}
			position = end
		}
	}

	closingPosition := nextNonWhitespace(p.raw, position)
	if closingPosition >= len(p.raw) || p.raw[closingPosition] != ')' {
		return Range{}, Range{}, 0, false
	}

	return destination, title, closingPosition + 1, true
}

func (p *inlineParser) referenceDefinition(label string) *ReferenceDefinition {
	clean := strings.Join(strings.Fields(label), " ")
	for _, d := range p.referenceDefinitions {
		if strings.EqualFold(clean, strings.Join(strings.Fields(d.Label()), " ")) {
			return d
		}
	}
	return nil
}

func (p *inlineParser) lookForLinkOrImage() {
	for element := p.delimiterStack.Back(); element != nil; element = element.Prev() {
		d := element.Value.(*delimiter)
		if d.Type != imageOpeningDelimiter && d.Type != linkOpeningDelimiter {
			continue
		}
		if d.IsInactive {
			p.delimiterStack.Remove(element)
			break
		}

		isImage := d.Type == imageOpeningDelimiter

		var inline Inline

		if destination, title, next, ok := p.peekAtInlineLinkDestinationAndTitle(p.position+1, isImage); ok {
			destinationMarkdownPosition := relativeToAbsolutePosition(p.ranges, destination.Position)
			linkOrImage := InlineLinkOrImage{
				Children:       append([]Inline(nil), p.inlines[d.TextNode+1:]...),
				RawDestination: Range{destinationMarkdownPosition, destinationMarkdownPosition + destination.End - destination.Position},
				markdown:       p.markdown,
				rawTitle:       p.raw[title.Position:title.End],
			}
			if d.Type == imageOpeningDelimiter {
				inline = &InlineImage{linkOrImage}
			} else {
				inline = &InlineLink{linkOrImage}
			}
			p.position = next
		} else {
			referenceLabel := ""
			label, next, hasLinkLabel := parseLinkLabel(p.raw, p.position+1)
			if hasLinkLabel && label.End > label.Position {
				referenceLabel = p.raw[label.Position:label.End]
			} else {
				referenceLabel = p.raw[d.Range.End:p.position]
				if !hasLinkLabel {
					next = p.position + 1
				}
			}
			if referenceLabel != "" {
				if reference := p.referenceDefinition(referenceLabel); reference != nil {
					linkOrImage := ReferenceLinkOrImage{
						ReferenceDefinition: reference,
						Children:            append([]Inline(nil), p.inlines[d.TextNode+1:]...),
					}
					if d.Type == imageOpeningDelimiter {
						inline = &ReferenceImage{linkOrImage}
					} else {
						inline = &ReferenceLink{linkOrImage}
					}
					p.position = next
				}
			}
		}

		if inline != nil {
			if d.Type == imageOpeningDelimiter {
				p.inlines = append(p.inlines[:d.TextNode], inline)
			} else {
				p.inlines = append(p.inlines[:d.TextNode], inline)
				for inlineElement := element.Prev(); inlineElement != nil; inlineElement = inlineElement.Prev() {
					if d := inlineElement.Value.(*delimiter); d.Type == linkOpeningDelimiter {
						d.IsInactive = true
					}
				}
			}
			p.delimiterStack.Remove(element)
			return
		}
		p.delimiterStack.Remove(element)
		break
	}
	absPos := relativeToAbsolutePosition(p.ranges, p.position)
	p.inlines = append(p.inlines, &Text{
		Text:  "]",
		Range: Range{absPos, absPos + 1},
	})
	p.position++
}

func CharacterReference(ref string) string {
	if ref == "" {
		return ""
	}
	if ref[0] == '#' {
		if len(ref) < 2 {
			return ""
		}
		n := 0
		if ref[1] == 'X' || ref[1] == 'x' {
			if len(ref) < 3 {
				return ""
			}
			for i := 2; i < len(ref); i++ {
				if i > 9 {
					return ""
				}
				d := ref[i]
				switch {
				case d >= '0' && d <= '9':
					n = n*16 + int(d-'0')
				case d >= 'a' && d <= 'f':
					n = n*16 + 10 + int(d-'a')
				case d >= 'A' && d <= 'F':
					n = n*16 + 10 + int(d-'A')
				default:
					return ""
				}
			}
		} else {
			for i := 1; i < len(ref); i++ {
				if i > 8 || ref[i] < '0' || ref[i] > '9' {
					return ""
				}
				n = n*10 + int(ref[i]-'0')
			}
		}
		c := rune(n)
		if c == '\u0000' || !utf8.ValidRune(c) {
			return string(unicode.ReplacementChar)
		}
		return string(c)
	}
	if entity, ok := htmlEntities[ref]; ok {
		return entity
	}
	return ""
}

func (p *inlineParser) parseCharacterReference() {
	absPos := relativeToAbsolutePosition(p.ranges, p.position)
	p.position++
	if semicolon := strings.IndexByte(p.raw[p.position:], ';'); semicolon == -1 {
		p.inlines = append(p.inlines, &Text{
			Text:  "&",
			Range: Range{absPos, absPos + 1},
		})
	} else if s := CharacterReference(p.raw[p.position : p.position+semicolon]); s != "" {
		p.position += semicolon + 1
		p.inlines = append(p.inlines, &Text{
			Text:  s,
			Range: Range{absPos, absPos + len(s)},
		})
	} else {
		p.inlines = append(p.inlines, &Text{
			Text:  "&",
			Range: Range{absPos, absPos + 1},
		})
	}
}

func (p *inlineParser) parseAutolink(c rune) bool {
	for element := p.delimiterStack.Back(); element != nil; element = element.Prev() {
		d := element.Value.(*delimiter)
		if !d.IsInactive {
			return false
		}
	}

	var link Range
	if c == ':' {
		var ok bool
		link, ok = parseURLAutolink(p.raw, p.position)

		if !ok {
			return false
		}

		// Since the current position is at the colon, we have to rewind the parsing slightly so that
		// we don't duplicate the URL scheme
		rewind := strings.Index(p.raw[link.Position:link.End], ":")
		if rewind != -1 {
			lastInline := p.inlines[len(p.inlines)-1]
			lastText, ok := lastInline.(*Text)

			if !ok {
				// This should never occur since parseURLAutolink will only return a non-empty value
				// when the previous text ends in a valid URL protocol which would mean that the previous
				// node is a Text node
				return false
			}

			p.inlines = p.inlines[0 : len(p.inlines)-1]
			p.inlines = append(p.inlines, &Text{
				Text:  lastText.Text[:len(lastText.Text)-rewind],
				Range: Range{lastText.Range.Position, lastText.Range.End - rewind},
			})
			p.position -= rewind
		}
	} else if c == 'w' || c == 'W' {
		var ok bool
		link, ok = parseWWWAutolink(p.raw, p.position)

		if !ok {
			return false
		}
	}

	linkMarkdownPosition := relativeToAbsolutePosition(p.ranges, link.Position)
	linkRange := Range{linkMarkdownPosition, linkMarkdownPosition + link.End - link.Position}

	p.inlines = append(p.inlines, &Autolink{
		Children: []Inline{
			&Text{
				Text:  p.raw[link.Position:link.End],
				Range: linkRange,
			},
		},
		RawDestination: linkRange,
		markdown:       p.markdown,
	})
	p.position += (link.End - link.Position)

	return true
}

func (p *inlineParser) Parse() []Inline {
	for _, r := range p.ranges {
		p.raw += p.markdown[r.Position:r.End]
	}

	for p.position < len(p.raw) {
		c, _ := utf8.DecodeRuneInString(p.raw[p.position:])

		switch c {
		case '\r', '\n':
			p.parseLineEnding()
		case '\\':
			p.parseEscapeCharacter()
		case '`':
			p.parseBackticks()
		case '&':
			p.parseCharacterReference()
		case '!', '[':
			p.parseLinkOrImageDelimiter()
		case ']':
			p.lookForLinkOrImage()
		case 'w', 'W', ':':
			matched := p.parseAutolink(c)

			if !matched {
				p.parseText()
			}
		default:
			p.parseText()
		}
	}

	return p.inlines
}

func ParseInlines(markdown string, ranges []Range, referenceDefinitions []*ReferenceDefinition) (inlines []Inline) {
	return newInlineParser(markdown, ranges, referenceDefinitions).Parse()
}

func MergeInlineText(inlines []Inline) []Inline {
	ret := inlines[:0]
	for i, v := range inlines {
		// always add first node
		if i == 0 {
			ret = append(ret, v)
			continue
		}
		// not a text node? nothing to merge
		text, ok := v.(*Text)
		if !ok {
			ret = append(ret, v)
			continue
		}
		// previous node is not a text node? nothing to merge
		prevText, ok := ret[len(ret)-1].(*Text)
		if !ok {
			ret = append(ret, v)
			continue
		}
		// previous node is not right before this one
		if prevText.Range.End != text.Range.Position {
			ret = append(ret, v)
			continue
		}
		// we have two consecutive text nodes
		ret[len(ret)-1] = &Text{
			Text:  prevText.Text + text.Text,
			Range: Range{prevText.Range.Position, text.Range.End},
		}
	}
	return ret
}

func Unescape(markdown string) string {
	ret := ""

	position := 0
	for position < len(markdown) {
		c, cSize := utf8.DecodeRuneInString(markdown[position:])

		switch c {
		case '\\':
			if position+1 < len(markdown) && isEscapableByte(markdown[position+1]) {
				ret += string(markdown[position+1])
				position += 2
			} else {
				ret += `\`
				position++
			}
		case '&':
			position++
			if semicolon := strings.IndexByte(markdown[position:], ';'); semicolon == -1 {
				ret += "&"
			} else if s := CharacterReference(markdown[position : position+semicolon]); s != "" {
				position += semicolon + 1
				ret += s
			} else {
				ret += "&"
			}
		default:
			ret += string(c)
			position += cSize
		}
	}

	return ret
}
