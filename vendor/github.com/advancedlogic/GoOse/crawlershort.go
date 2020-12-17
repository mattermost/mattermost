package goose

import (
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/pkg/errors"
)

// Crawler can fetch the target HTML page
type CrawlerShort struct {
	config  Configuration
	Charset string
}

// NewCrawler returns a crawler object initialised with the URL and the [optional] raw HTML body
func NewCrawlerShort(config Configuration) CrawlerShort {
	return CrawlerShort{
		config:  config,
		Charset: "",
	}
}

// SetCharset can be used to force a charset (e.g. when read from the HTTP headers)
// rather than relying on the detection from the HTML meta tags
func (c *CrawlerShort) SetCharset(cs string) {
	c.Charset = getCharsetFromContentType(cs)
}

// GetContentType returns the Content-Type string extracted from the meta tags
func (c CrawlerShort) GetContentType(document *goquery.Document) string {
	var attr string
	// <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	document.Find("meta[http-equiv#=(?i)^Content\\-type$]").Each(func(i int, s *goquery.Selection) {
		attr, _ = s.Attr("content")
	})
	return attr
}

// GetCharset returns a normalised charset string extracted from the meta tags
func (c CrawlerShort) GetCharset(document *goquery.Document) string {
	// manually-provided charset (from HTTP headers?) takes priority
	if "" != c.Charset {
		return c.Charset
	}

	// <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	ct := c.GetContentType(document)
	if "" != ct && strings.Contains(strings.ToLower(ct), "charset") {
		return getCharsetFromContentType(ct)
	}

	// <meta charset="utf-8">
	selection := document.Find("meta").EachWithBreak(func(i int, s *goquery.Selection) bool {
		_, exists := s.Attr("charset")
		return !exists
	})

	if selection != nil {
		cs, _ := selection.Attr("charset")
		return NormaliseCharset(cs)
	}

	return ""
}

// Preprocess fetches the HTML page if needed, converts it to UTF-8 and applies
// some text normalisation to guarantee better results when extracting the content
func (c *CrawlerShort) Preprocess(RawHTML string) (*goquery.Document, error) {
	var err error

	RawHTML = c.addSpacesBetweenTags(RawHTML)

	reader := strings.NewReader(RawHTML)
	document, err := goquery.NewDocumentFromReader(reader)
	if err != nil {
		return nil, errors.Wrap(err, "could not perform goquery.NewDocumentFromReader(reader)")
	}

	cs := c.GetCharset(document)
	//log.Println("-------------------------------------------CHARSET:", cs)
	if "" != cs && "UTF-8" != cs {
		// the net/html parser and goquery require UTF-8 data
		RawHTML = UTF8encode(RawHTML, cs)
		reader = strings.NewReader(RawHTML)
		if document, err = goquery.NewDocumentFromReader(reader); err != nil {
			return nil, errors.Wrap(err, "could not perform goquery.NewDocumentFromReader(reader)")
		}
	}

	return document, nil
}

// Crawl fetches the HTML body and returns an Article
func (c CrawlerShort) Crawl(RawHTML, url string) (*Article, error) {
	article := new(Article)

	document, err := c.Preprocess(RawHTML)
	if err != nil {
		return nil, errors.Wrap(err, "could not Preprocess RawHTML")
	}
	if document == nil {
		return article, nil
	}

	extractor := NewExtractor(c.config)

	startTime := time.Now().UnixNano()

	article.RawHTML, err = document.Html()
	if err != nil {
		return nil, errors.Wrap(err, "could not get html from document")
	}
	article.FinalURL = url

	article.Title = extractor.GetTitle(document)
	article.MetaDescription = extractor.GetMetaContentWithSelector(document, "meta[name#=(?i)^description$]")

	if c.config.extractPublishDate {
		if timestamp := extractor.GetPublishDate(document); timestamp != nil {
			article.PublishDate = timestamp
		}
	}

	cleaner := NewCleaner(c.config)
	article.Doc = cleaner.Clean(article.Doc)

	article.TopImage = OpenGraphResolver(document)
	if article.TopImage == "" {
		article.TopImage = WebPageResolver(article)
	}

	article.TopNode = extractor.CalculateBestNode(document)
	if article.TopNode != nil {
		article.TopNode = extractor.PostCleanup(article.TopNode)

		article.CleanedText, article.Links = extractor.GetCleanTextAndLinks(article.TopNode, article.MetaLang)

	}
	article.Delta = time.Now().UnixNano() - startTime

	return article, nil
}

// In many cases, like at the end of each <li> element or between </span><span> tags,
// we need to add spaces, otherwise the text on either side will get joined together into one word.
// This method also adds newlines after each </p> tag to preserve paragraphs.
func (c CrawlerShort) addSpacesBetweenTags(text string) string {
	text = strings.Replace(text, "><", "> <", -1)
	text = strings.Replace(text, "</blockquote>", "</blockquote>\n", -1)
	text = strings.Replace(text, "<img ", "\n<img ", -1)
	text = strings.Replace(text, "</li>", "</li>\n", -1)
	return strings.Replace(text, "</p>", "</p>\n", -1)
}
