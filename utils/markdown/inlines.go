// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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

	Text string
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
	p.inlines = append(p.inlines, &Text{
		Text: opening,
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
		p.inlines = append(p.inlines, &Text{
			Text: string(p.raw[p.position+1]),
		})
		p.position += 2
	} else {
		p.inlines = append(p.inlines, &Text{
			Text: `\`,
		})
		p.position++
	}
}

func (p *inlineParser) parseText() {
	if next := strings.IndexAny(p.raw[p.position:], "\r\n\\`&![]"); next == -1 {
		p.inlines = append(p.inlines, &Text{
			Text: strings.TrimRightFunc(p.raw[p.position:], isWhitespace),
		})
		p.position = len(p.raw)
	} else {
		if p.raw[p.position+next] == '\r' || p.raw[p.position+next] == '\n' {
			p.inlines = append(p.inlines, &Text{
				Text: strings.TrimRightFunc(p.raw[p.position:p.position+next], isWhitespace),
			})
		} else {
			p.inlines = append(p.inlines, &Text{
				Text: p.raw[p.position : p.position+next],
			})
		}
		p.position += next
	}
}

func (p *inlineParser) parseLinkOrImageDelimiter() {
	if p.raw[p.position] == '[' {
		p.inlines = append(p.inlines, &Text{
			Text: "[",
		})
		p.delimiterStack.PushBack(&delimiter{
			Type:     linkOpeningDelimiter,
			TextNode: len(p.inlines) - 1,
			Range:    Range{p.position, p.position + 1},
		})
		p.position++
	} else if p.raw[p.position] == '!' && p.position+1 < len(p.raw) && p.raw[p.position+1] == '[' {
		p.inlines = append(p.inlines, &Text{
			Text: "![",
		})
		p.delimiterStack.PushBack(&delimiter{
			Type:     imageOpeningDelimiter,
			TextNode: len(p.inlines) - 1,
			Range:    Range{p.position, p.position + 2},
		})
		p.position += 2
	} else {
		p.inlines = append(p.inlines, &Text{
			Text: "!",
		})
		p.position++
	}
}

func (p *inlineParser) peekAtInlineLinkDestinationAndTitle(position int) (destination, title Range, end int, ok bool) {
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

	if position < len(p.raw) && isWhitespaceByte(p.raw[position]) {
		titleStart := nextNonWhitespace(p.raw, position)
		if titleStart >= len(p.raw) {
			return
		} else if p.raw[titleStart] == ')' {
			return destination, Range{titleStart, titleStart}, titleStart + 1, true
		}

		title, end, ok = parseLinkTitle(p.raw, titleStart)
		if !ok {
			return
		}
		position = end
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

		var inline Inline

		if destination, title, next, ok := p.peekAtInlineLinkDestinationAndTitle(p.position + 1); ok {
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
				for element := element.Prev(); element != nil; element = element.Prev() {
					if d := element.Value.(*delimiter); d.Type == linkOpeningDelimiter {
						d.IsInactive = true
					}
				}
			}
			p.delimiterStack.Remove(element)
			return
		} else {
			p.delimiterStack.Remove(element)
			break
		}
	}
	p.inlines = append(p.inlines, &Text{
		Text: "]",
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
	p.position++
	if semicolon := strings.IndexByte(p.raw[p.position:], ';'); semicolon == -1 {
		p.inlines = append(p.inlines, &Text{
			Text: "&",
		})
	} else if s := CharacterReference(p.raw[p.position : p.position+semicolon]); s != "" {
		p.position += semicolon + 1
		p.inlines = append(p.inlines, &Text{
			Text: s,
		})
	} else {
		p.inlines = append(p.inlines, &Text{
			Text: "&",
		})
	}
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
		default:
			p.parseText()
		}
	}

	return p.inlines
}

func ParseInlines(markdown string, ranges []Range, referenceDefinitions []*ReferenceDefinition) (inlines []Inline) {
	return newInlineParser(markdown, ranges, referenceDefinitions).Parse()
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
