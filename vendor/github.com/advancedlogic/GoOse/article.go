package goose

import (
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/fatih/set"
)

// Article is a collection of properties extracted from the HTML body
type Article struct {
	Title           string             `json:"title,omitempty"`
	TitleUnmodified string             `json:"titleunmodified,omitempty"`
	CleanedText     string             `json:"content,omitempty"`
	MetaDescription string             `json:"description,omitempty"`
	MetaLang        string             `json:"lang,omitempty"`
	MetaFavicon     string             `json:"favicon,omitempty"`
	MetaKeywords    string             `json:"keywords,omitempty"`
	CanonicalLink   string             `json:"canonicalurl,omitempty"`
	Domain          string             `json:"domain,omitempty"`
	TopNode         *goquery.Selection `json:"-"`
	TopImage        string             `json:"image,omitempty"`
	Tags            *set.Set           `json:"tags,omitempty"`
	Movies          *set.Set           `json:"movies,omitempty"`
	FinalURL        string             `json:"url,omitempty"`
	LinkHash        string             `json:"linkhash,omitempty"`
	RawHTML         string             `json:"rawhtml,omitempty"`
	Doc             *goquery.Document  `json:"-"`
	Links           []string           `json:"links,omitempty"`
	PublishDate     *time.Time         `json:"publishdate,omitempty"`
	AdditionalData  map[string]string  `json:"additionaldata,omitempty"`
	Delta           int64              `json:"delta,omitempty"`
}

// ToString is a simple method to just show the title
// TODO: add more fields and pretty print
func (article *Article) ToString() string {
	out := article.Title
	return out
}
