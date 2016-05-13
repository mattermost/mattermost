// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package smugmug uses the SmugMug API to manipulate photo albums
// stored on smugmug.com.
package smugmug

import (
	"bytes"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const smugUploadHost = "upload.smugmug.com"
const smugAPI = "1.2.2"
const smugURL = "https://secure.smugmug.com/services/api/json/" + smugAPI + "/"
const smugURLUnencrypted = "http://api.smugmug.com/services/api/json/" + smugAPI + "/"

// A Conn represents an authenticated connection to the SmugMug server.
type Conn struct {
	sessid string
	apiKey string

	NickName string
}

// A Category represents a single album category.
type Category struct {
	ID   int `json:"id"`
	Name string
}

type smugResult struct {
	Stat    string `json:"stat"`
	Message string `json:"message"`
}

type loginResult struct {
	Login struct {
		Session struct {
			ID string `json:"id"`
		}
		User struct {
			ID          int `json:"id"`
			NickName    string
			DisplayName string
		}
	}
}

// Login logs into the SmugMug server with the given email address and password.
// The apikey argument is the API Key for your application.
// To obtain an API Key, see http://www.smugmug.com/hack/apikeys.
func Login(email, passwd, apikey string) (*Conn, error) {
	c := &Conn{}
	var out loginResult
	if err := c.do("smugmug.login.withPassword", &out, "APIKey", apikey, "EmailAddress", email, "Password", passwd); err != nil {
		return nil, err
	}

	c.sessid = out.Login.Session.ID
	if c.sessid == "" {
		return nil, fmt.Errorf("SmugMug login appeared to succeed but did not return session ID")
	}

	c.NickName = out.Login.User.NickName
	if c.NickName == "" {
		return nil, fmt.Errorf("SmugMug login appeared to succeed but did not return User NickName")
	}

	return c, nil
}

// Categories returns the album categories for the user identified by the nick name.
func (c *Conn) Categories(nick string) ([]*Category, error) {
	var out struct {
		Categories []*Category
	}
	if err := c.do("smugmug.categories.get", &out, "NickName", nick); err != nil {
		return nil, err
	}
	return out.Categories, nil
}

// CreateCategory creates a category with the given name.
func (c *Conn) CreateCategory(name string) (*Category, error) {
	var out struct {
		Category *Category
	}
	if err := c.do("smugmug.categories.create", &out, "Name", name); err != nil {
		return nil, err
	}
	return out.Category, nil
}

// DeleteCategory deletes the category.
func (c *Conn) DeleteCategory(cat *Category) error {
	return c.do("smugmug.categories.delete", nil, "CategoryID", strconv.Itoa(cat.ID))
}

// An Album represents a single photo album.
type Album struct {
	ID    int `json:"id"`
	Key   string
	Title string
	URL   string
}

// Albums returns the albums for the user identified by the nick name.
// Use c.NickName for the logged-in user.
func (c *Conn) Albums(nick string) ([]*Album, error) {
	var out struct {
		Albums []*Album
	}
	if err := c.do("smugmug.albums.get", &out, "NickName", nick); err != nil {
		return nil, err
	}
	return out.Albums, nil
}

// CreateAlbum creates a new album.
func (c *Conn) CreateAlbum(title string) (*Album, error) {
	var out struct {
		Album *Album
	}
	if err := c.do("smugmug.albums.create", &out,
		"Title", title,
		"Public", "0",
		"WorldSearchable", "0",
		"SmugSearchable", "0",
	); err != nil {
		return nil, err
	}

	if out.Album == nil || out.Album.Key == "" {
		return nil, fmt.Errorf("unable to parse SmugMug result")
	}
	return out.Album, nil
}

// AlbumInfo returns detailed metadata about an album.
func (c *Conn) AlbumInfo(album *Album) (*AlbumInfo, error) {
	var out struct {
		Album *AlbumInfo
	}
	if err := c.do("smugmug.albums.getInfo", &out,
		"AlbumID", strconv.Itoa(album.ID),
		"AlbumKey", album.Key,
	); err != nil {
		return nil, err
	}

	if out.Album == nil || out.Album.ID == 0 {
		return nil, fmt.Errorf("unable to parse SmugMug result")
	}
	return out.Album, nil
}

// An AlbumInfo lists the metadata for an album.	
type AlbumInfo struct {
	ID    int `json:"id"`
	Key   string
	Title string

	Backprinting      string
	BoutiquePackaging int
	CanRank           bool
	Category          *Category
	Clean             bool
	ColorCorrection   int
	Comments          bool
	Community         struct {
		ID   int `json:"id"`
		Name string
	}
	Description string
	EXIF        bool
	External    bool
	FamilyEdit  bool
	Filenames   bool
	FriendEdit  bool
	Geography   bool
	Header      bool
	HideOwner   bool
	Highlight   struct {
		ID   int `json:"id"`
		Key  string
		Type string
	}
	ImageCount        int
	InterceptShipping int
	Keywords          string
	Larges            bool
	LastUpdated       string
	NiceName          string
	Originals         bool
	PackagingBranding bool
	Password          string
	PasswordHint      string
	Passworded        bool
	Position          int
	Printable         bool
	Printmark         struct {
		ID   int `json:"id"`
		Name string
	}
	ProofDays      int
	Protected      bool
	Public         bool
	Share          bool
	SmugSearchable bool
	SortDirection  bool
	SortMethod     string
	SquareThumbs   bool
	SubCategory    *Category
	Template       struct {
		ID int `json:"id"`
	}
	Theme struct {
		ID   int `json:"id"`
		Key  string
		Type string
	}
	URL           string
	UnsharpAmount float64
	UnsharpRadius float64
	UnsharpSigma  float64
	Watermark     struct {
		ID   int `json:"id"`
		Name string
	}
	Watermarking    bool
	WorldSearchable bool
	X2Larges        bool
	X3Larges        bool
	XLarges         bool
}

// ChangeAlbum changes an album's settings.
// The argument list is a sequence of key, value pairs.
// The keys are the names of AlbumInfo struct fields,
// and the values are string values.  For a boolean field,
// use "0" for false and "1" for true.
//
// Example:
//	c.ChangeAlbum(a, "Larges", "1", "Title", "My Album")
//
func (c *Conn) ChangeAlbum(album *Album, args ...string) error {
	callArgs := append([]string{"AlbumID", strconv.Itoa(album.ID)}, args...)
	return c.do("smugmug.albums.changeSettings", nil, callArgs...)
}

// DeleteAlbum deletes an album.
func (c *Conn) DeleteAlbum(album *Album) error {
	return c.do("smugmug.albums.delete", nil, "AlbumID", strconv.Itoa(album.ID))
}

// An Image represents a single SmugMug image.
type Image struct {
	ID  int `json:"id"`
	Key string
	URL string
}

// Images returns a list of images for an album.
func (c *Conn) Images(album *Album) ([]*Image, error) {
	var out struct {
		Album struct {
			Images []*Image
		}
	}

	if err := c.do("smugmug.images.get", &out,
		"AlbumID", strconv.Itoa(album.ID),
		"AlbumKey", album.Key,
		"Heavy", "1",
	); err != nil {
		return nil, err
	}

	return out.Album.Images, nil
}

// An ImageInfo lists the metadata for an image.
type ImageInfo struct {
	ID           int `json:"id"`
	Key          string
	Album        *Album
	Altitude     int
	Caption      string
	Date         string
	FileName     string
	Duration     int
	Format       string
	Height       int
	Hidden       bool
	Keywords     string
	LargeURL     string
	LastUpdated  string
	Latitude     float64
	LightboxURL  string
	Longitude    float64
	MD5Sum       string
	MediumURL    string
	OriginalURL  string
	Position     int
	Serial       int
	Size         int
	SmallURL     string
	ThumbURL     string
	TinyURL      string
	Video320URL  string
	Video640URL  string
	Video960URL  string
	Video1280URL string
	Video1920URL string
	Width        int
	X2LargeURL   string
	X3LargeURL   string
	XLargeURL    string
}

// ImageInfo returns detailed metadata about an image.
func (c *Conn) ImageInfo(image *Image) (*ImageInfo, error) {
	var out struct {
		Image *ImageInfo
	}
	if err := c.do("smugmug.images.getInfo", &out,
		"ImageID", strconv.Itoa(image.ID),
		"ImageKey", image.Key,
	); err != nil {
		return nil, err
	}

	if out.Image == nil || out.Image.ID == 0 {
		return nil, fmt.Errorf("unable to parse SmugMug result")
	}
	return out.Image, nil
}

// ChangeImage changes an image's settings.
// The argument list is a sequence of key, value pairs.
// The keys are the names of ImageInfo struct fields,
// and the values are string values.  For a boolean field,
// use "0" for false and "1" for true.
//
// Example:
//	c.ChangeImage(a, "Caption", "me!", "Hidden", "0")
//
func (c *Conn) ChangeImage(image *Image, args ...string) error {
	callArgs := append([]string{"ImageID", strconv.Itoa(image.ID)}, args...)
	return c.do("smugmug.images.changeSettings", nil, callArgs...)
}

// An ImageEXIF lists the EXIF data associated with an image.
type ImageEXIF struct {
	ID                     int `json:"id"`
	Key                    string
	Aperture               string
	Brightness             string
	CCDWidth               string
	ColorSpace             int
	CompressedBitsPerPixel string
	Contrast               int
	DateTime               string
	DateTimeDigitized      string
	DateTimeOriginal       string
	DigitalZoomRatio       string
	ExposureBiasValue      string
	ExposureMode           int
	ExposureProgram        int
	ExposureTime           string
	Flash                  int
	FocalLength            string
	FocalLengthIn35mmFilm  string
	ISO                    int
	LightSource            int
	Make                   string
	Metering               int
	Model                  string
	Saturation             int
	SensingMethod          int
	Sharpness              int
	SubjectDistance        string
	SubjectDistanceRange   int
	WhiteBalance           int
}

// ImageInfo returns the EXIF data for an image.
func (c *Conn) ImageEXIF(image *Image) (*ImageEXIF, error) {
	var out struct {
		Image *ImageEXIF
	}
	if err := c.do("smugmug.images.getEXIF", &out,
		"ImageID", strconv.Itoa(image.ID),
		"ImageKey", image.Key,
	); err != nil {
		return nil, err
	}

	if out.Image == nil || out.Image.ID == 0 {
		return nil, fmt.Errorf("unable to parse SmugMug result")
	}
	return out.Image, nil
}

// DeleteImage deletes an image.
func (c *Conn) DeleteImage(image *Image) error {
	return c.do("smugmug.images.delete", nil, "ImageID", strconv.Itoa(image.ID))
}

// AddImage uploads a new image to an album.
// The name is the file name that will be displayed on SmugMug.
// The data is the raw image data.
func (c *Conn) AddImage(name string, data []byte, a *Album) (*Image, error) {
	return c.upload(name, data, "AlbumID", a.ID)
}

// ReplaceImage replaces an image.
// The name is the file name that will be displayed on SmugMug.
// The data is the raw image data.
func (c *Conn) ReplaceImage(name string, data []byte, image *Image) (*Image, error) {
	return c.upload(name, data, "ImageID", image.ID)
}

func (c *Conn) upload(name string, data []byte, idkind string, id int) (*Image, error) {
	h := md5.New()
	h.Write(data)
	digest := fmt.Sprintf("%x", h.Sum(nil))

	req := &http.Request{
		Method: "PUT",
		URL: &url.URL{
			Scheme: "http",
			Host:   smugUploadHost,
			Path:   "/" + name,
		},
		ContentLength: int64(len(data)),
		Header: http.Header{
			"Content-MD5":         {digest},
			"X-Smug-SessionID":    {c.sessid},
			"X-Smug-Version":      {smugAPI},
			"X-Smug-ResponseType": {"JSON"},
			"X-Smug-" + idkind:    {strconv.Itoa(id)},
			"X-Smug-FileName":     {name},
		},
		Body: ioutil.NopCloser(bytes.NewBuffer(data)),
	}

	r, err := http.DefaultTransport.RoundTrip(req)
	if err != nil {
		return nil, fmt.Errorf("upload %s: %s", name, err)
	}

	var out struct {
		Image *Image
	}
	if err := c.parseResult("upload", r, &out); err != nil {
		return nil, fmt.Errorf("upload %s: %s", name, err)
	}
	return out.Image, nil
}

func (c *Conn) do(method string, dst interface{}, args ...string) (err error) {
	defer func() {
		if err != nil {
			err = fmt.Errorf("%s: %s", method, err)
		}
	}()

	form := url.Values{
		"method": {method},
		"APIKey": {c.apiKey},
		"Pretty": {"1"}, // nice-looking JSON
	}
	if c.sessid != "" {
		form["SessionID"] = []string{c.sessid}
	}
	for i := 0; i < len(args); i += 2 {
		key, val := args[i], args[i+1]
		form[key] = []string{val}
	}

	url := smugURL
	if !strings.Contains(method, "login") {
		// I'd really prefer to use HTTPS for everything,
		// but I get "invalid API key" if I do.
		url = smugURLUnencrypted
	}
	r, err := http.Post(url, "application/x-www-form-urlencoded", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}

	return c.parseResult(method, r, dst)
}

func (c *Conn) parseResult(method string, r *http.Response, dst interface{}) error {
	defer r.Body.Close()
	if r.StatusCode != 200 {
		return fmt.Errorf("HTTP %s", r.Status)
	}
	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		return fmt.Errorf("reading body: %s", err)
	}

	var res smugResult
	if err := json.Unmarshal(data, &res); err != nil {
		return fmt.Errorf("parsing JSON result: %s", err)
	}

	// If there are no images, that's not an error.
	// But SmugMug says it is.
	if res.Stat == "fail" && method == "smugmug.images.get" && res.Message == "empty set - no images found" {
		res.Stat = "ok"
		data = []byte(`{"Images": []}`)
	}

	if res.Stat != "ok" {
		msg := res.Stat
		if res.Message != "" {
			msg = res.Message
		}
		return fmt.Errorf("%s", msg)
	}

	if dst != nil {
		if err := json.Unmarshal(data, dst); err != nil {
			return fmt.Errorf("parsing JSON result: %s", err)
		}
	}

	return nil
}
