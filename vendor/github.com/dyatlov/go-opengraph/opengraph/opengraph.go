package opengraph

import (
	"encoding/json"
	"io"
	"strconv"
	"time"

	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

// Image defines Open Graph Image type
type Image struct {
	URL       string `json:"url"`
	SecureURL string `json:"secure_url"`
	Type      string `json:"type"`
	Width     uint64 `json:"width"`
	Height    uint64 `json:"height"`
}

// Video defines Open Graph Video type
type Video struct {
	URL       string `json:"url"`
	SecureURL string `json:"secure_url"`
	Type      string `json:"type"`
	Width     uint64 `json:"width"`
	Height    uint64 `json:"height"`
}

// Audio defines Open Graph Audio Type
type Audio struct {
	URL       string `json:"url"`
	SecureURL string `json:"secure_url"`
	Type      string `json:"type"`
}

// Article contain Open Graph Article structure
type Article struct {
	PublishedTime  *time.Time `json:"published_time"`
	ModifiedTime   *time.Time `json:"modified_time"`
	ExpirationTime *time.Time `json:"expiration_time"`
	Section        string     `json:"section"`
	Tags           []string   `json:"tags"`
	Authors        []*Profile `json:"authors"`
}

// Profile contains Open Graph Profile structure
type Profile struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
	Gender    string `json:"gender"`
}

// Book contains Open Graph Book structure
type Book struct {
	ISBN        string     `json:"isbn"`
	ReleaseDate *time.Time `json:"release_date"`
	Tags        []string   `json:"tags"`
	Authors     []*Profile `json:"authors"`
}

// OpenGraph contains facebook og data
type OpenGraph struct {
	isArticle        bool
	isBook           bool
	isProfile        bool
	Type             string   `json:"type"`
	URL              string   `json:"url"`
	Title            string   `json:"title"`
	Description      string   `json:"description"`
	Determiner       string   `json:"determiner"`
	SiteName         string   `json:"site_name"`
	Locale           string   `json:"locale"`
	LocalesAlternate []string `json:"locales_alternate"`
	Images           []*Image `json:"images"`
	Audios           []*Audio `json:"audios"`
	Videos           []*Video `json:"videos"`
	Article          *Article `json:"article,omitempty"`
	Book             *Book    `json:"book,omitempty"`
	Profile          *Profile `json:"profile,omitempty"`
}

// NewOpenGraph returns new instance of Open Graph structure
func NewOpenGraph() *OpenGraph {
	return &OpenGraph{}
}

// ToJSON a simple wrapper around json.Marshal
func (og *OpenGraph) ToJSON() ([]byte, error) {
	return json.Marshal(og)
}

// String return json representation of structure, or error string
func (og *OpenGraph) String() string {
	data, err := og.ToJSON()

	if err != nil {
		return err.Error()
	}

	return string(data[:])
}

// ProcessHTML parses given html from Reader interface and fills up OpenGraph structure
func (og *OpenGraph) ProcessHTML(buffer io.Reader) error {
	z := html.NewTokenizer(buffer)
	for {
		tt := z.Next()
		switch tt {
		case html.ErrorToken:
			if z.Err() == io.EOF {
				return nil
			}
			return z.Err()
		case html.StartTagToken, html.SelfClosingTagToken, html.EndTagToken:
			name, hasAttr := z.TagName()
			if atom.Lookup(name) == atom.Body {
				return nil // OpenGraph is only in head, so we don't need body
			}
			if atom.Lookup(name) != atom.Meta || !hasAttr {
				continue
			}
			m := make(map[string]string)
			var key, val []byte
			for hasAttr {
				key, val, hasAttr = z.TagAttr()
				m[atom.String(key)] = string(val)
			}
			og.ProcessMeta(m)
		}
	}
	return nil
}

// ProcessMeta processes meta attributes and adds them to Open Graph structure if they are suitable for that
func (og *OpenGraph) ProcessMeta(metaAttrs map[string]string) {
	switch metaAttrs["property"] {
	case "og:description":
		og.Description = metaAttrs["content"]
	case "og:type":
		og.Type = metaAttrs["content"]
		switch og.Type {
		case "article":
			og.isArticle = true
		case "book":
			og.isBook = true
		case "profile":
			og.isProfile = true
		}
	case "og:title":
		og.Title = metaAttrs["content"]
	case "og:url":
		og.URL = metaAttrs["content"]
	case "og:determiner":
		og.Determiner = metaAttrs["content"]
	case "og:site_name":
		og.SiteName = metaAttrs["content"]
	case "og:locale":
		og.Locale = metaAttrs["content"]
	case "og:locale:alternate":
		og.LocalesAlternate = append(og.LocalesAlternate, metaAttrs["content"])
	case "og:image":
		og.Images = append(og.Images, &Image{URL: metaAttrs["content"]})
	case "og:image:url":
		if len(og.Images) > 0 {
			og.Images[len(og.Images)-1].URL = metaAttrs["content"]
		}
	case "og:image:secure_url":
		if len(og.Images) > 0 {
			og.Images[len(og.Images)-1].SecureURL = metaAttrs["content"]
		}
	case "og:image:type":
		if len(og.Images) > 0 {
			og.Images[len(og.Images)-1].Type = metaAttrs["content"]
		}
	case "og:image:width":
		if len(og.Images) > 0 {
			w, err := strconv.ParseUint(metaAttrs["content"], 10, 64)
			if err == nil {
				og.Images[len(og.Images)-1].Width = w
			}
		}
	case "og:image:height":
		if len(og.Images) > 0 {
			h, err := strconv.ParseUint(metaAttrs["content"], 10, 64)
			if err == nil {
				og.Images[len(og.Images)-1].Height = h
			}
		}
	case "og:video":
		og.Videos = append(og.Videos, &Video{URL: metaAttrs["content"]})
	case "og:video:url":
		if len(og.Videos) > 0 {
			og.Videos[len(og.Videos)-1].URL = metaAttrs["content"]
		}
	case "og:video:secure_url":
		if len(og.Videos) > 0 {
			og.Videos[len(og.Videos)-1].SecureURL = metaAttrs["content"]
		}
	case "og:video:type":
		if len(og.Videos) > 0 {
			og.Videos[len(og.Videos)-1].Type = metaAttrs["content"]
		}
	case "og:video:width":
		if len(og.Videos) > 0 {
			w, err := strconv.ParseUint(metaAttrs["content"], 10, 64)
			if err == nil {
				og.Videos[len(og.Videos)-1].Width = w
			}
		}
	case "og:video:height":
		if len(og.Videos) > 0 {
			h, err := strconv.ParseUint(metaAttrs["content"], 10, 64)
			if err == nil {
				og.Videos[len(og.Videos)-1].Height = h
			}
		}
	default:
		if og.isArticle {
			og.processArticleMeta(metaAttrs)
		} else if og.isBook {
			og.processBookMeta(metaAttrs)
		} else if og.isProfile {
			og.processProfileMeta(metaAttrs)
		}
	}
}

func (og *OpenGraph) processArticleMeta(metaAttrs map[string]string) {
	if og.Article == nil {
		og.Article = &Article{}
	}
	switch metaAttrs["property"] {
	case "article:published_time":
		t, err := time.Parse(time.RFC3339, metaAttrs["content"])
		if err == nil {
			og.Article.PublishedTime = &t
		}
	case "article:modified_time":
		t, err := time.Parse(time.RFC3339, metaAttrs["content"])
		if err == nil {
			og.Article.ModifiedTime = &t
		}
	case "article:expiration_time":
		t, err := time.Parse(time.RFC3339, metaAttrs["content"])
		if err == nil {
			og.Article.ExpirationTime = &t
		}
	case "article:secttion":
		og.Article.Section = metaAttrs["content"]
	case "article:tag":
		og.Article.Tags = append(og.Article.Tags, metaAttrs["content"])
	case "article:author:first_name":
		if len(og.Article.Authors) == 0 {
			og.Article.Authors = append(og.Article.Authors, &Profile{})
		}
		og.Article.Authors[len(og.Article.Authors)-1].FirstName = metaAttrs["content"]
	case "article:author:last_name":
		if len(og.Article.Authors) == 0 {
			og.Article.Authors = append(og.Article.Authors, &Profile{})
		}
		og.Article.Authors[len(og.Article.Authors)-1].LastName = metaAttrs["content"]
	case "article:author:username":
		if len(og.Article.Authors) == 0 {
			og.Article.Authors = append(og.Article.Authors, &Profile{})
		}
		og.Article.Authors[len(og.Article.Authors)-1].Username = metaAttrs["content"]
	case "article:author:gender":
		if len(og.Article.Authors) == 0 {
			og.Article.Authors = append(og.Article.Authors, &Profile{})
		}
		og.Article.Authors[len(og.Article.Authors)-1].Gender = metaAttrs["content"]
	}
}

func (og *OpenGraph) processBookMeta(metaAttrs map[string]string) {
	if og.Book == nil {
		og.Book = &Book{}
	}
	switch metaAttrs["property"] {
	case "book:release_date":
		t, err := time.Parse(time.RFC3339, metaAttrs["content"])
		if err == nil {
			og.Book.ReleaseDate = &t
		}
	case "book:isbn":
		og.Book.ISBN = metaAttrs["content"]
	case "book:tag":
		og.Book.Tags = append(og.Book.Tags, metaAttrs["content"])
	case "book:author:first_name":
		if len(og.Book.Authors) == 0 {
			og.Book.Authors = append(og.Book.Authors, &Profile{})
		}
		og.Book.Authors[len(og.Book.Authors)-1].FirstName = metaAttrs["content"]
	case "book:author:last_name":
		if len(og.Book.Authors) == 0 {
			og.Book.Authors = append(og.Book.Authors, &Profile{})
		}
		og.Book.Authors[len(og.Book.Authors)-1].LastName = metaAttrs["content"]
	case "book:author:username":
		if len(og.Book.Authors) == 0 {
			og.Book.Authors = append(og.Book.Authors, &Profile{})
		}
		og.Book.Authors[len(og.Book.Authors)-1].Username = metaAttrs["content"]
	case "book:author:gender":
		if len(og.Book.Authors) == 0 {
			og.Book.Authors = append(og.Book.Authors, &Profile{})
		}
		og.Book.Authors[len(og.Book.Authors)-1].Gender = metaAttrs["content"]
	}
}

func (og *OpenGraph) processProfileMeta(metaAttrs map[string]string) {
	if og.Profile == nil {
		og.Profile = &Profile{}
	}
	switch metaAttrs["property"] {
	case "profile:first_name":
		og.Profile.FirstName = metaAttrs["content"]
	case "profile:last_name":
		og.Profile.LastName = metaAttrs["content"]
	case "profile:username":
		og.Profile.Username = metaAttrs["content"]
	case "profile:gender":
		og.Profile.Gender = metaAttrs["content"]
	}
}
