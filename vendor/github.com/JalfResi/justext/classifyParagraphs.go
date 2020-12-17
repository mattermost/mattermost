package justext

import (
	"regexp"
	"strings"
)

var findHeadings *regexp.Regexp = regexp.MustCompile("(^h[123456]|.h[123456])")
var copyrightChar *regexp.Regexp = regexp.MustCompile("(\u0161|&copy)")
var findSelect *regexp.Regexp = regexp.MustCompile("(^select|.select)")

func classifyParagraphs(paragraphs []*Paragraph, stoplist map[string]bool, lengthLow int, lengthHigh int, stopwordsLow float64, stopwordsHigh float64, maxLinkDensity float64, noHeadings bool) {
	for _, paragraph := range paragraphs {
		var length int = len(paragraph.Text)
		var stopwordCount int = 0
		for _, word := range strings.Split(paragraph.Text, " ") {
			if _, ok := stoplist[word]; ok {
				stopwordCount += 1
			}
		}

		var stopwordDensity float64 = 0.0
		var linkDensity float64 = 0.0
		var wordCount int = paragraph.WordCount

		if wordCount > 0 {
			stopwordDensity = 1.0 * float64(stopwordCount) / float64(wordCount)
			linkDensity = float64(paragraph.LinkedCharCount) / float64(length)
		}

		paragraph.StopwordCount = stopwordCount
		paragraph.StopwordDensity = stopwordDensity
		paragraph.LinkDensity = linkDensity
		paragraph.Heading = bool(!noHeadings && findHeadings.MatchString(paragraph.DomPath))

		if linkDensity > maxLinkDensity {
			paragraph.CfClass = "bad"
		} else if copyrightChar.MatchString(paragraph.Text) {
			paragraph.CfClass = "bad"
		} else if findSelect.MatchString(paragraph.DomPath) {
			paragraph.CfClass = "bad"
		} else {
			if length < lengthLow {
				if paragraph.LinkedCharCount > 0 {
					paragraph.CfClass = "bad"
				} else {
					paragraph.CfClass = "short"
				}
			} else {
				if stopwordDensity >= stopwordsHigh {
					if length > lengthHigh {
						paragraph.CfClass = "good"
					} else {
						paragraph.CfClass = "neargood"
					}
				} else {
					if stopwordDensity >= stopwordsLow {
						paragraph.CfClass = "neargood"
					} else {
						paragraph.CfClass = "bad"
					}
				}
			}
		}
	}
}
