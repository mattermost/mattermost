// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	"code.google.com/p/go-uuid/uuid"
	"encoding/base32"
	"encoding/json"
	"fmt"
	"io"
	"net/mail"
	"regexp"
	"strings"
	"time"
)

type StringMap map[string]string
type StringArray []string
type EncryptStringMap map[string]string

// AppError is returned for any http response that's not in the 200 range.
type AppError struct {
	Message       string `json:"message"`        // Message to be display to the end user without debugging information
	DetailedError string `json:"detailed_error"` // Internal error string to help the developer
	RequestId     string `json:"request_id"`     // The RequestId that's also set in the header
	StatusCode    int    `json:"status_code"`    // The http status code
	Where         string `json:"-"`              // The function where it happened in the form of Struct.Func
	IsOAuth       bool   `json:"is_oauth"`       // Whether the error is OAuth specific
}

func (er *AppError) Error() string {
	return er.Where + ": " + er.Message + ", " + er.DetailedError
}

func (er *AppError) ToJson() string {
	b, err := json.Marshal(er)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

// AppErrorFromJson will decode the input and return an AppError
func AppErrorFromJson(data io.Reader) *AppError {
	decoder := json.NewDecoder(data)
	var er AppError
	err := decoder.Decode(&er)
	if err == nil {
		return &er
	} else {
		return nil
	}
}

func NewAppError(where string, message string, details string) *AppError {
	ap := &AppError{}
	ap.Message = message
	ap.Where = where
	ap.DetailedError = details
	ap.StatusCode = 500
	ap.IsOAuth = false
	return ap
}

var encoding = base32.NewEncoding("ybndrfg8ejkmcpqxot1uwisza345h769")

// NewId is a globally unique identifier.  It is a [A-Z0-9] string 26
// characters long.  It is a UUID version 4 Guid that is zbased32 encoded
// with the padding stripped off.
func NewId() string {
	var b bytes.Buffer
	encoder := base32.NewEncoder(encoding, &b)
	encoder.Write(uuid.NewRandom())
	encoder.Close()
	b.Truncate(26) // removes the '==' padding
	return b.String()
}

// GetMillis is a convience method to get milliseconds since epoch.
func GetMillis() int64 {
	return time.Now().UnixNano() / int64(time.Millisecond)
}

// MapToJson converts a map to a json string
func MapToJson(objmap map[string]string) string {
	if b, err := json.Marshal(objmap); err != nil {
		return ""
	} else {
		return string(b)
	}
}

// MapFromJson will decode the key/value pair map
func MapFromJson(data io.Reader) map[string]string {
	decoder := json.NewDecoder(data)

	var objmap map[string]string
	if err := decoder.Decode(&objmap); err != nil {
		return make(map[string]string)
	} else {
		return objmap
	}
}

func ArrayToJson(objmap []string) string {
	if b, err := json.Marshal(objmap); err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ArrayFromJson(data io.Reader) []string {
	decoder := json.NewDecoder(data)

	var objmap []string
	if err := decoder.Decode(&objmap); err != nil {
		return make([]string, 0)
	} else {
		return objmap
	}
}

func IsLower(s string) bool {
	if strings.ToLower(s) == s {
		return true
	}

	return false
}

func IsValidEmail(email string) bool {

	if !IsLower(email) {
		return false
	}

	if _, err := mail.ParseAddress(email); err == nil {
		return true
	}

	return false
}

var reservedName = []string{
	"www",
	"web",
	"admin",
	"support",
	"notify",
	"test",
	"demo",
	"mail",
	"team",
	"channel",
	"internal",
	"localhost",
	"dockerhost",
	"stag",
	"post",
	"cluster",
	"api",
	"oauth",
}

var wwwStart = regexp.MustCompile(`^www`)
var betaStart = regexp.MustCompile(`^beta`)
var ciStart = regexp.MustCompile(`^ci`)

func GetSubDomain(s string) (string, string) {
	s = strings.Replace(s, "http://", "", 1)
	s = strings.Replace(s, "https://", "", 1)

	match := wwwStart.MatchString(s)
	if match {
		return "", ""
	}

	match = betaStart.MatchString(s)
	if match {
		return "", ""
	}

	match = ciStart.MatchString(s)
	if match {
		return "", ""
	}

	parts := strings.Split(s, ".")

	if len(parts) != 3 {
		return "", ""
	}

	return parts[0], parts[1]
}

func IsValidChannelIdentifier(s string) bool {

	if !IsValidAlphaNum(s, true) {
		return false
	}

	if len(s) < 2 {
		return false
	}

	return true
}

var validAlphaNumUnderscore = regexp.MustCompile(`^[a-z0-9]+([a-z\-\_0-9]+|(__)?)[a-z0-9]+$`)
var validAlphaNum = regexp.MustCompile(`^[a-z0-9]+([a-z\-0-9]+|(__)?)[a-z0-9]+$`)

func IsValidAlphaNum(s string, allowUnderscores bool) bool {
	var match bool
	if allowUnderscores {
		match = validAlphaNumUnderscore.MatchString(s)
	} else {
		match = validAlphaNum.MatchString(s)
	}

	if !match {
		return false
	}

	return true
}

func Etag(parts ...interface{}) string {

	etag := CurrentVersion

	for _, part := range parts {
		etag += fmt.Sprintf(".%v", part)
	}

	return etag
}

var validHashtag = regexp.MustCompile(`^(#[A-Za-z]+[A-Za-z0-9_\-]*[A-Za-z0-9])$`)
var puncStart = regexp.MustCompile(`^[.,()&$!\[\]{}"':;\\]+`)
var puncEnd = regexp.MustCompile(`[.,()&$#!\[\]{}"':;\\]+$`)

func ParseHashtags(text string) (string, string) {
	words := strings.Split(strings.Replace(text, "\n", " ", -1), " ")

	hashtagString := ""
	plainString := ""
	for _, word := range words {
		word = puncStart.ReplaceAllString(word, "")
		word = puncEnd.ReplaceAllString(word, "")
		if validHashtag.MatchString(word) {
			hashtagString += " " + word
		} else {
			plainString += " " + word
		}
	}

	if len(hashtagString) > 1000 {
		hashtagString = hashtagString[:999]
		lastSpace := strings.LastIndex(hashtagString, " ")
		if lastSpace > -1 {
			hashtagString = hashtagString[:lastSpace]
		} else {
			hashtagString = ""
		}
	}

	return strings.TrimSpace(hashtagString), strings.TrimSpace(plainString)
}

func IsFileExtImage(ext string) bool {
	ext = strings.ToLower(ext)
	for _, imgExt := range IMAGE_EXTENSIONS {
		if ext == imgExt {
			return true
		}
	}
	return false
}

func GetImageMimeType(ext string) string {
	ext = strings.ToLower(ext)
	if len(IMAGE_MIME_TYPES[ext]) == 0 {
		return "image"
	} else {
		return IMAGE_MIME_TYPES[ext]
	}
}

func ClearMentionTags(post string) string {
	post = strings.Replace(post, "<mention>", "", -1)
	post = strings.Replace(post, "</mention>", "", -1)
	return post
}

var UrlRegex = regexp.MustCompile(`^((?:[a-z]+:\/\/)?(?:(?:[a-z0-9\-]+\.)+(?:[a-z]{2}|aero|arpa|biz|com|coop|edu|gov|info|int|jobs|mil|museum|name|nato|net|org|pro|travel|local|internal))(:[0-9]{1,5})?(?:\/[a-z0-9_\-\.~]+)*(\/([a-z0-9_\-\.]*)(?:\?[a-z0-9+_~\-\.%=&amp;]*)?)?(?:#[a-zA-Z0-9!$&'()*+.=-_~:@/?]*)?)(?:\s+|$)$`)
var PartialUrlRegex = regexp.MustCompile(`/([A-Za-z0-9]{26})/([A-Za-z0-9]{26})/((?:[A-Za-z0-9]{26})?.+(?:\.[A-Za-z0-9]{3,})?)`)

var SplitRunes = map[rune]bool{',': true, ' ': true, '.': true, '!': true, '?': true, ':': true, ';': true, '\n': true, '<': true, '>': true, '(': true, ')': true, '{': true, '}': true, '[': true, ']': true, '+': true, '/': true, '\\': true}
