// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/dyatlov/go-opengraph/opengraph/types/image"
)

const (
	LinkMetadataTypeImage     LinkMetadataType = "image"
	LinkMetadataTypeNone      LinkMetadataType = "none"
	LinkMetadataTypeOpengraph LinkMetadataType = "opengraph"
	LinkMetadataMaxImages     int              = 5
	LinkMetadataMaxURLLength  int              = 2048 // Maximum URL length in LinkMetadata table
)

type LinkMetadataType string

// LinkMetadata stores arbitrary data about a link posted in a message. This includes dimensions of linked images
// and OpenGraph metadata.
type LinkMetadata struct {
	// Hash is a value computed from the URL and Timestamp for use as a primary key in the database.
	Hash int64

	URL       string
	Timestamp int64
	Type      LinkMetadataType

	// Data is the actual metadata for the link. It should contain data of one of the following types:
	// - *model.PostImage if the linked content is an image
	// - *opengraph.OpenGraph if the linked content is an HTML document
	// - nil if the linked content has no metadata
	Data any
}

// truncateText ensure string is 300 chars, truncate and add ellipsis
// if it was bigger.
func truncateText(original string) string {
	if utf8.RuneCountInString(original) > 300 {
		return fmt.Sprintf("%.300s[...]", original)
	}
	return original
}

func firstNImages(images []*image.Image, maxImages int) []*image.Image {
	if maxImages < 0 { // don't break stuff, if it's weird, go for sane defaults
		maxImages = LinkMetadataMaxImages
	}
	numImages := len(images)
	if numImages > maxImages {
		return images[0:maxImages]
	}
	return images
}

// TruncateOpenGraph ensure OpenGraph metadata doesn't grow too big by
// shortening strings, trimming fields and reducing the number of
// images.
func TruncateOpenGraph(ogdata *opengraph.OpenGraph) *opengraph.OpenGraph {
	if ogdata != nil {
		empty := &opengraph.OpenGraph{}
		ogdata.Title = truncateText(ogdata.Title)
		ogdata.Description = truncateText(ogdata.Description)
		ogdata.SiteName = truncateText(ogdata.SiteName)
		ogdata.Article = empty.Article
		ogdata.Book = empty.Book
		ogdata.Profile = empty.Profile
		ogdata.Determiner = empty.Determiner
		ogdata.Locale = empty.Locale
		ogdata.LocalesAlternate = empty.LocalesAlternate
		ogdata.Images = FilterSVGImages(firstNImages(ogdata.Images, LinkMetadataMaxImages))
		ogdata.Audios = empty.Audios
		ogdata.Videos = empty.Videos
	}
	return ogdata
}

// FilterSVGImages removes SVG images from the provided list. See MM-67372.
func FilterSVGImages(images []*image.Image) []*image.Image {
	if len(images) == 0 {
		return images
	}

	filtered := make([]*image.Image, 0, len(images))
	for _, img := range images {
		if img == nil {
			continue
		}
		// Filter by URL extension
		if IsSVGImageURL(img.URL) || IsSVGImageURL(img.SecureURL) {
			continue
		}
		// Filter by declared MIME type
		if strings.HasPrefix(img.Type, "image/svg+xml") {
			continue
		}
		filtered = append(filtered, img)
	}
	return filtered
}

func IsSVGImageURL(imageURL string) bool {
	if imageURL == "" {
		return false
	}
	parsed, err := url.Parse(imageURL)
	if err != nil {
		return false
	}
	path := strings.ToLower(parsed.Path)
	return strings.HasSuffix(path, ".svg") || strings.HasSuffix(path, ".svgz")
}

func (o *LinkMetadata) PreSave() {
	o.Hash = GenerateLinkMetadataHash(o.URL, o.Timestamp)
}

func (o *LinkMetadata) IsValid() *AppError {
	if o.URL == "" {
		return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.url.app_error", nil, "", http.StatusBadRequest)
	}

	if len(o.URL) > LinkMetadataMaxURLLength {
		return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.url_length.app_error", map[string]any{"MaxLength": LinkMetadataMaxURLLength, "Length": len(o.URL)}, "", http.StatusBadRequest)
	}

	if o.Timestamp == 0 || !isRoundedToNearestHour(o.Timestamp) {
		return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.timestamp.app_error", nil, "", http.StatusBadRequest)
	}

	switch o.Type {
	case LinkMetadataTypeImage:
		if o.Data == nil {
			return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.data.app_error", nil, "", http.StatusBadRequest)
		}

		if _, ok := o.Data.(*PostImage); !ok {
			return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.data_type.app_error", nil, "", http.StatusBadRequest)
		}
	case LinkMetadataTypeNone:
		if o.Data != nil {
			return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.data_type.app_error", nil, "", http.StatusBadRequest)
		}
	case LinkMetadataTypeOpengraph:
		if o.Data == nil {
			return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.data.app_error", nil, "", http.StatusBadRequest)
		}

		if _, ok := o.Data.(*opengraph.OpenGraph); !ok {
			return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.data_type.app_error", nil, "", http.StatusBadRequest)
		}
	default:
		return NewAppError("LinkMetadata.IsValid", "model.link_metadata.is_valid.type.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// DeserializeDataToConcreteType converts o.Data from JSON into properly structured data. This is intended to be used
// after getting a LinkMetadata object that has been stored in the database.
func (o *LinkMetadata) DeserializeDataToConcreteType() error {
	var b []byte
	switch t := o.Data.(type) {
	case []byte:
		b = t
	case string:
		b = []byte(t)
	}

	if b == nil {
		// Data doesn't need to be fixed
		return nil
	}

	var data any
	var err error

	switch o.Type {
	case LinkMetadataTypeImage:
		image := &PostImage{}

		err = json.Unmarshal(b, &image)

		data = image
	case LinkMetadataTypeOpengraph:
		og := &opengraph.OpenGraph{}

		json.Unmarshal(b, &og)

		data = og
	}

	if err != nil {
		return err
	}

	o.Data = data

	return nil
}

// FloorToNearestHour takes a timestamp (in milliseconds) and returns it rounded to the previous hour in UTC.
func FloorToNearestHour(ms int64) int64 {
	t := time.Unix(0, ms*int64(1000*1000)).UTC()

	return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), 0, 0, 0, time.UTC).UnixNano() / int64(time.Millisecond)
}

// isRoundedToNearestHour returns true if the given timestamp (in milliseconds) has been rounded to the nearest hour in UTC.
func isRoundedToNearestHour(ms int64) bool {
	return FloorToNearestHour(ms) == ms
}

// GenerateLinkMetadataHash generates a unique hash for a given URL and timestamp for use as a database key.
func GenerateLinkMetadataHash(url string, timestamp int64) int64 {
	hash := fnv.New32()

	// Note that we ignore write errors here because the Hash interface says that its Write will never return an error
	binary.Write(hash, binary.LittleEndian, timestamp)
	hash.Write([]byte(url))

	return int64(hash.Sum32())
}

func hasControlOrBackslash(s string) bool {
	for i := range len(s) {
		if s[i] == '\\' || s[i] < 0x20 || s[i] == 0x7f {
			return true
		}
	}
	return false
}

// NormalizedPort returns u's explicit port, or the default port for http ("80") and https ("443").
func NormalizedPort(u *url.URL) string {
	if p := u.Port(); p != "" {
		return p
	}
	switch strings.ToLower(u.Scheme) {
	case "https":
		return "443"
	case "http":
		return "80"
	default:
		return ""
	}
}

func hasSubpathPrefix(cleanPath, sitePath string) bool {
	if sitePath == "" {
		return true
	}
	return cleanPath == sitePath || strings.HasPrefix(cleanPath, sitePath+"/")
}

func isImageProxyPath(cleanPath, sitePath string) bool {
	proxyPath := sitePath + "/api/v4/image"
	return cleanPath == proxyPath || strings.HasPrefix(cleanPath, proxyPath+"/")
}

func resolveInternalImagePath(rawURL, siteURL string) (string, string, bool) {
	if rawURL != strings.TrimSpace(rawURL) || hasControlOrBackslash(rawURL) || strings.HasPrefix(rawURL, "//") {
		return "", "", false
	}
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Opaque != "" || parsed.User != nil {
		return "", "", false
	}
	if siteURL == "" {
		if parsed.Scheme != "" || parsed.Host != "" {
			return "", "", false
		}
		return path.Clean("/" + parsed.Path), "", true
	}
	siteParsed, err := url.Parse(siteURL)
	if err != nil || siteParsed.Scheme == "" || siteParsed.Host == "" {
		return "", "", false
	}
	sitePath := strings.TrimRight(siteParsed.Path, "/")
	baseSiteParsed := *siteParsed
	baseSiteParsed.Path = sitePath + "/"
	resolved := baseSiteParsed.ResolveReference(parsed)
	if !strings.EqualFold(resolved.Scheme, siteParsed.Scheme) ||
		!strings.EqualFold(resolved.Hostname(), siteParsed.Hostname()) ||
		NormalizedPort(resolved) != NormalizedPort(siteParsed) {
		return "", "", false
	}
	return path.Clean("/" + resolved.Path), sitePath, true
}

// IsImageProxyURL reports whether rawURL targets Mattermost's /api/v4/image proxy endpoint.
func IsImageProxyURL(rawURL, siteURL string) bool {
	if rawURL == "" {
		return false
	}
	cleanPath, sitePath, ok := resolveInternalImagePath(rawURL, siteURL)
	if !ok {
		return false
	}
	return isImageProxyPath(cleanPath, sitePath)
}

// IsExternalImageURL reports whether fetching rawURL could contact a host outside siteURL or hit /api/v4/image.
func IsExternalImageURL(rawURL, siteURL string) bool {
	if rawURL == "" {
		return false
	}
	if rawURL != strings.TrimSpace(rawURL) {
		return true
	}
	if strings.HasPrefix(strings.ToLower(rawURL), "data:image/") {
		return false
	}
	cleanPath, sitePath, ok := resolveInternalImagePath(rawURL, siteURL)
	if !ok || !hasSubpathPrefix(cleanPath, sitePath) {
		return true
	}
	return isImageProxyPath(cleanPath, sitePath)
}

// IsSafeHTTPURL reports whether rawURL parses cleanly with an http or https scheme and non-empty host.
func IsSafeHTTPURL(rawURL string) bool {
	if rawURL == "" || rawURL != strings.TrimSpace(rawURL) || hasControlOrBackslash(rawURL) {
		return false
	}
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Opaque != "" || parsed.Host == "" {
		return false
	}
	return strings.EqualFold(parsed.Scheme, "http") || strings.EqualFold(parsed.Scheme, "https")
}

// UnwrapImageProxyURL extracts the safe destination URL from an /api/v4/image proxy URL, or returns rawURL unchanged.
func UnwrapImageProxyURL(rawURL, siteURL string) string {
	if !IsImageProxyURL(rawURL, siteURL) {
		return rawURL
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	target := parsed.Query().Get("url")
	if target != "" && IsSafeHTTPURL(target) {
		return target
	}
	return rawURL
}

// BlockedImageLinkTarget unwraps an /api/v4/image proxy URL and reports whether the result is safe to
// render as a clickable link in place of a blocked image: an http(s) URL that is not itself a proxy URL.
func BlockedImageLinkTarget(rawURL, siteURL string) (string, bool) {
	target := UnwrapImageProxyURL(rawURL, siteURL)
	return target, IsSafeHTTPURL(target) && !IsImageProxyURL(target, siteURL)
}
