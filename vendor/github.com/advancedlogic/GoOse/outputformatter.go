package goose

import (
	"bytes"
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html"
)

var normalizeWhitespaceRegexp = regexp.MustCompile(`[ \r\f\v\t]+`)
var normalizeNl = regexp.MustCompile(`[\n]+`)
var validURLRegex = regexp.MustCompile("^http[s]?://")

type outputFormatter struct {
	topNode  *goquery.Selection
	config   Configuration
	language string
}

func (formatter *outputFormatter) getLanguage(lang string) string {
	if formatter.config.useMetaLanguage && "" != lang {
		return lang
	}
	return formatter.config.targetLanguage
}

func (formatter *outputFormatter) getTopNode() *goquery.Selection {
	return formatter.topNode
}

func (formatter *outputFormatter) getFormattedText(topNode *goquery.Selection, lang string) (output string, links []string) {
	formatter.topNode = topNode
	formatter.language = formatter.getLanguage(lang)
	if formatter.language == "" {
		formatter.language = formatter.config.targetLanguage
	}
	formatter.removeNegativescoresNodes()
	links = formatter.linksToText()
	formatter.replaceTagsWithText()
	formatter.removeParagraphsWithFewWords()

	output = formatter.getOutputText()
	return output, links
}

func (formatter *outputFormatter) convertToText() string {
	var txts []string
	selections := formatter.topNode
	selections.Each(func(i int, s *goquery.Selection) {
		txt := s.Text()
		if txt != "" {
			// txt = txt //unescape
			txtLis := strings.Trim(txt, "\n")
			txts = append(txts, txtLis)
		}
	})
	return strings.Join(txts, "\n\n")
}

// check if this is a valid URL
func isValidURL(u string) bool {
	return validURLRegex.MatchString(u)
}

func (formatter *outputFormatter) linksToText() []string {
	var urlList []string
	links := formatter.topNode.Find("a")
	links.Each(func(i int, a *goquery.Selection) {
		imgs := a.Find("img")
		// ignore linked images
		if imgs.Length() == 0 {
			// save a list of URLs
			url, _ := a.Attr("href")
			if isValidURL(url) {
				urlList = append(urlList, url)
			}
			// replace <a> tag with its text contents
			replaceTagWithContents(a, whitelistedExtAtomTypes)

			// see whether we can collapse the parent node now
			replaceTagWithContents(a.Parent(), whitelistedTextAtomTypes)
		}
	})

	return urlList
}

// Text gets the combined text contents of each element in the set of matched
// elements, including their descendants.
//
// @see https://github.com/PuerkitoBio/goquery/blob/master/property.go
func (formatter *outputFormatter) Text(s *goquery.Selection) string {
	var buf bytes.Buffer

	// Slightly optimized vs calling Each: no single selection object created
	var f func(*html.Node)
	f = func(n *html.Node) {
		if n.Type == html.TextNode && 0 == n.DataAtom { // NB: had to add the DataAtom check to avoid printing text twice when a textual node embeds another textual node
			// Keep newlines and spaces, like jQuery
			buf.WriteString(n.Data)
		}
		if n.FirstChild != nil {
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				f(c)
			}
		}
	}
	for _, n := range s.Nodes {
		f(n)
	}

	return buf.String()
}

func (formatter *outputFormatter) getOutputText() string {
	//out := formatter.topNode.Text()
	out := formatter.Text(formatter.topNode)
	out = normalizeWhitespaceRegexp.ReplaceAllString(out, " ")

	strArr := strings.Split(out, "\n")
	resArr := []string{}

	for i, v := range strArr {
		v = strings.TrimSpace(v)
		if v != "" {
			resArr = append(resArr, v)
		} else if i > 2 && strArr[i-2] != "" {
			resArr = append(resArr, "")
		}
	}

	out = strings.Join(resArr, "\n")
	out = normalizeNl.ReplaceAllString(out, "\n\n")

	out = strings.TrimSpace(out)
	return out
}

func (formatter *outputFormatter) removeNegativescoresNodes() {
	gravityItems := formatter.topNode.Find("*[gravityScore]")
	gravityItems.Each(func(i int, s *goquery.Selection) {
		var score int
		sscore, exists := s.Attr("gravityScore")
		if exists {
			score, _ = strconv.Atoi(sscore)
			if score < 1 {
				sNode := s.Get(0)
				sNode.Parent.RemoveChild(sNode)
			}
		}

	})
}

func (formatter *outputFormatter) replaceTagsWithText() {
	for _, tag := range []string{"em", "strong", "b", "i", "span", "h1", "h2", "h3", "h4"} {
		nodes := formatter.topNode.Find(tag)
		nodes.Each(func(i int, node *goquery.Selection) {
			replaceTagWithContents(node, whitelistedTextAtomTypes)
		})
	}
}

func (formatter *outputFormatter) removeParagraphsWithFewWords() {
	language := formatter.language
	if language == "" {
		language = "en"
	}
	allNodes := formatter.topNode.Children()
	allNodes.Each(func(i int, s *goquery.Selection) {
		sw := formatter.config.stopWords.stopWordsCount(language, s.Text())
		if sw.wordCount < 5 && s.Find("object").Length() == 0 && s.Find("em").Length() == 0 {
			node := s.Get(0)
			node.Parent.RemoveChild(node)
		}
	})
}
