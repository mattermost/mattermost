package goose

import (
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/fatih/set"
)

// VideoExtractor can extract the main video from an HTML page
type VideoExtractor struct {
	article    *Article
	config     Configuration
	candidates *set.Set
	movies     *set.Set
}

type video struct {
	embedType string
	provider  string
	width     int
	height    int
	embedCode string
	src       string
}

// NewVideoExtractor returns a new instance of a HTML video extractor
func NewVideoExtractor() VideoExtractor {
	return VideoExtractor{
		candidates: set.New(set.ThreadSafe).(*set.Set),
		movies:     set.New(set.ThreadSafe).(*set.Set),
	}
}

var videoTags = [4]string{"iframe", "embed", "object", "video"}
var videoProviders = [4]string{"youtube", "vimeo", "dailymotion", "kewego"}

func (ve *VideoExtractor) getEmbedCode(node *goquery.Selection) string {
	return node.Text()
}

func (ve *VideoExtractor) getWidth(node *goquery.Selection) int {
	value, exists := node.Attr("width")
	if exists {
		nvalue, _ := strconv.Atoi(value)
		return nvalue
	}
	return 0
}

func (ve *VideoExtractor) getHeight(node *goquery.Selection) int {
	value, exists := node.Attr("height")
	if exists {
		nvalue, _ := strconv.Atoi(value)
		return nvalue
	}
	return 0
}

func (ve *VideoExtractor) getSrc(node *goquery.Selection) string {
	value, exists := node.Attr("src")
	if exists {
		return value
	}
	return ""
}

func (ve *VideoExtractor) getProvider(src string) string {
	if src != "" {
		for _, provider := range videoProviders {
			if strings.Contains(src, provider) {
				return provider
			}
		}
	}
	return ""
}

func (ve *VideoExtractor) getVideo(node *goquery.Selection) video {
	src := ve.getSrc(node)
	video := video{
		embedCode: ve.getEmbedCode(node),
		embedType: node.Get(0).DataAtom.String(),
		width:     ve.getWidth(node),
		height:    ve.getHeight(node),
		src:       src,
		provider:  ve.getProvider(src),
	}
	return video
}

func (ve *VideoExtractor) getIFrame(node *goquery.Selection) video {
	return ve.getVideo(node)
}

func (ve *VideoExtractor) getVideoTag(node *goquery.Selection) video {
	return video{}
}

func (ve *VideoExtractor) getEmbedTag(node *goquery.Selection) video {
	parent := node.Parent()
	if parent != nil {
		parentTag := parent.Get(0).DataAtom.String()
		if parentTag == "object" {
			return ve.getObjectTag(node)
		}
	}
	return ve.getVideo(node)
}

func (ve *VideoExtractor) getObjectTag(node *goquery.Selection) video {
	childEmbedTag := node.Find("embed")
	if ve.candidates.Has(childEmbedTag) {
		ve.candidates.Remove(childEmbedTag)
	}
	srcNode := node.Find(`param[name="movie"]`)
	if srcNode == nil || srcNode.Length() == 0 {
		return video{}
	}

	src, _ := srcNode.Attr("value")
	provider := ve.getProvider(src)
	if provider == "" {
		return video{}
	}
	video := ve.getVideo(node)
	video.provider = provider
	video.src = src
	return video
}

// GetVideos returns the video tags embedded in the article
func (ve *VideoExtractor) GetVideos(doc *goquery.Document) *set.Set {
	var nodes *goquery.Selection
	for _, videoTag := range videoTags {
		tmpNodes := doc.Find(videoTag)
		if nodes == nil {
			nodes = tmpNodes
		} else {
			nodes.Union(tmpNodes)
		}
	}

	nodes.Each(func(i int, node *goquery.Selection) {
		tag := node.Get(0).DataAtom.String()
		var movie video
		switch tag {
		case "video":
			movie = ve.getVideoTag(node)
		case "embed":
			movie = ve.getEmbedTag(node)
		case "object":
			movie = ve.getObjectTag(node)
		case "iframe":
			movie = ve.getIFrame(node)
		}

		if movie.src != "" {
			ve.movies.Add(movie)
		}
	})

	return ve.movies
}
