package justext

import (
	"fmt"
	"github.com/levigross/exp-html"
	"io"
	"regexp"
	"strings"
)

var (
	paragraphTags = map[string]bool{
		"blockquote": true,
		"caption":    true,
		"center":     true,
		"col":        true,
		"colgroup":   true,
		"dd":         true,
		"div":        true,
		"dl":         true,
		"dt":         true,
		"fieldset":   true,
		"form":       true,
		"legend":     true,
		"optgroup":   true,
		"option":     true,
		"p":          true,
		"pre":        true,
		"table":      true,
		"td":         true,
		"textarea":   true,
		"tfoot":      true,
		"th":         true,
		"thead":      true,
		"tr":         true,
		"ul":         true,
		"li":         true,
		"h1":         true,
		"h2":         true,
		"h3":         true,
		"h4":         true,
		"h5":         true,
		"h6":         true,
	}
	matchWhiteSpace *regexp.Regexp = regexp.MustCompile("[\n\r\t]+")
)

type Paragraph struct {
	DomPath         string
	TextNodes       []string
	WordCount       int
	LinkedCharCount int
	TagCount        int
	Text            string
	StopwordCount   int
	StopwordDensity float64
	LinkDensity     float64
	Heading         bool
	CfClass         string
	Class           string
}

func paragraphObjectModel(htmlStr string) ([]*Paragraph, error) {

	var dom []string
	var paragraphs []*Paragraph
	var paragraph *Paragraph = &Paragraph{WordCount: 0, LinkedCharCount: 0, TagCount: 0}
	var link bool = false
	var br bool = false
	var matchToDoErrors *regexp.Regexp = regexp.MustCompile("^html: TODO: ")

	var startNewParagraph func()
	startNewParagraph = func() {
		if len(paragraph.TextNodes) != 0 {
			paragraph.Text = strings.TrimSpace(matchWhiteSpace.ReplaceAllString(strings.Join(paragraph.TextNodes, " "), " "))
			paragraphs = append(paragraphs, paragraph)
		}
		paragraph = &Paragraph{
			DomPath:         strings.Join(dom, "."),
			WordCount:       0,
			LinkedCharCount: 0,
			TagCount:        0,
		}
	}

	z := html.NewTokenizer(strings.NewReader(htmlStr))

	for {
		tt := z.Next()
		switch tt {

		case html.ErrorToken:
			if z.Err() == io.EOF {
				return paragraphs, nil
			}
			if matchToDoErrors.MatchString(fmt.Sprintf("%s", z.Err())) {
				return nil, z.Err()
			}
			continue

		case html.StartTagToken:
			tmpName, _ := z.TagName()
			name := string(tmpName)
			//log.Println("Matched start tag: ", name)
			dom = append(dom, name)
			_, ok := paragraphTags[name]
			if ok || (name == "br" && br) {
				if name == "br" {
					paragraph.TagCount--
				}
				startNewParagraph()
			} else {
				if name == "br" {
					br = true
				} else {
					br = false
				}
				if name == "a" {
					link = true
				}
				paragraph.TagCount++
			}

		case html.EndTagToken:
			tmpName, _ := z.TagName()
			name := string(tmpName)
			//log.Println("Matched end tag: ", name)
			dom = dom[0 : len(dom)-1]
			if _, ok := paragraphTags[name]; ok {
				startNewParagraph()
			}
			if name == "a" {
				link = false
			}

		case html.TextToken:
			text := strings.TrimSpace(string(z.Text()))
			e := 15
			if len(text) < e {
				e = len(text)
			}
			//log.Println("Matched text: ", text[:e], "...")
			if text == "" {
				continue
			}
			text = strings.TrimSpace(matchWhiteSpace.ReplaceAllString(text, " "))
			paragraph.TextNodes = append(paragraph.TextNodes, text)
			words := strings.Split(text, " ")
			paragraph.WordCount += len(words)
			if link {
				paragraph.LinkedCharCount += len(text)
			}
			br = false

		}
	}
	startNewParagraph()

	return paragraphs, nil
}
