// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	"crypto/rand"
	"encoding/base32"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/mail"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	goi18n "github.com/nicksnyder/go-i18n/i18n"
	"github.com/pborman/uuid"
)

const (
	LOWERCASE_LETTERS = "abcdefghijklmnopqrstuvwxyz"
	UPPERCASE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	NUMBERS           = "0123456789"
	SYMBOLS           = " !\"\\#$%&'()*+,-./:;<=>?@[]^_`|~"
)

type StringInterface map[string]interface{}
type StringMap map[string]string
type StringArray []string

var translateFunc goi18n.TranslateFunc = nil

func AppErrorInit(t goi18n.TranslateFunc) {
	translateFunc = t
}

type AppError struct {
	Id            string `json:"id"`
	Message       string `json:"message"`               // Message to be display to the end user without debugging information
	DetailedError string `json:"detailed_error"`        // Internal error string to help the developer
	RequestId     string `json:"request_id,omitempty"`  // The RequestId that's also set in the header
	StatusCode    int    `json:"status_code,omitempty"` // The http status code
	Where         string `json:"-"`                     // The function where it happened in the form of Struct.Func
	IsOAuth       bool   `json:"is_oauth,omitempty"`    // Whether the error is OAuth specific
	params        map[string]interface{}
}

func (er *AppError) Error() string {
	return er.Where + ": " + er.Message + ", " + er.DetailedError
}

func (er *AppError) Translate(T goi18n.TranslateFunc) {
	if T == nil {
		er.Message = er.Id
		return
	}

	if er.params == nil {
		er.Message = T(er.Id)
	} else {
		er.Message = T(er.Id, er.params)
	}
}

func (er *AppError) SystemMessage(T goi18n.TranslateFunc) string {
	if er.params == nil {
		return T(er.Id)
	} else {
		return T(er.Id, er.params)
	}
}

func (er *AppError) ToJson() string {
	b, _ := json.Marshal(er)
	return string(b)
}

// AppErrorFromJson will decode the input and return an AppError
func AppErrorFromJson(data io.Reader) *AppError {
	str := ""
	bytes, rerr := ioutil.ReadAll(data)
	if rerr != nil {
		str = rerr.Error()
	} else {
		str = string(bytes)
	}

	decoder := json.NewDecoder(strings.NewReader(str))
	var er AppError
	err := decoder.Decode(&er)
	if err == nil {
		return &er
	} else {
		return NewAppError("AppErrorFromJson", "model.utils.decode_json.app_error", nil, "body: "+str, http.StatusInternalServerError)
	}
}

func NewAppError(where string, id string, params map[string]interface{}, details string, status int) *AppError {
	ap := &AppError{}
	ap.Id = id
	ap.params = params
	ap.Message = id
	ap.Where = where
	ap.DetailedError = details
	ap.StatusCode = status
	ap.IsOAuth = false
	ap.Translate(translateFunc)
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

func NewRandomString(length int) string {
	var b bytes.Buffer
	str := make([]byte, length+8)
	rand.Read(str)
	encoder := base32.NewEncoder(encoding, &b)
	encoder.Write(str)
	encoder.Close()
	b.Truncate(length) // removes the '==' padding
	return b.String()
}

// GetMillis is a convience method to get milliseconds since epoch.
func GetMillis() int64 {
	return time.Now().UnixNano() / int64(time.Millisecond)
}

// GetMillisForTime is a convience method to get milliseconds since epoch for provided Time.
func GetMillisForTime(thisTime time.Time) int64 {
	return thisTime.UnixNano() / int64(time.Millisecond)
}

// ParseDateFilterToTime is a convience method to get Time from string
func ParseDateFilterToTime(filterString string) time.Time {
	resultTime, err := time.Parse("2006-01-02", PadDateStringZeros(filterString))
	if err != nil {
		return time.Now()
	}
	return resultTime
}

// PadDateStringZeros is a convience method to pad 2 digit date parts with zeros to meet ISO 8601 format
func PadDateStringZeros(dateString string) string {
	parts := strings.Split(dateString, "-")
	for index, part := range parts {
		if len(part) == 1 {
			parts[index] = "0" + part
		}
	}
	dateString = strings.Join(parts[:], "-")
	return dateString
}

// GetStartOfDayMillis is a convience method to get milliseconds since epoch for provided date's start of day
func GetStartOfDayMillis(thisTime time.Time, timeZoneOffset int) int64 {
	localSearchTimeZone := time.FixedZone("Local Search Time Zone", timeZoneOffset)
	resultTime := time.Date(thisTime.Year(), thisTime.Month(), thisTime.Day(), 0, 0, 0, 0, localSearchTimeZone)
	return GetMillisForTime(resultTime)
}

// GetEndOfDayMillis is a convience method to get milliseconds since epoch for provided date's end of day
func GetEndOfDayMillis(thisTime time.Time, timeZoneOffset int) int64 {
	localSearchTimeZone := time.FixedZone("Local Search Time Zone", timeZoneOffset)
	resultTime := time.Date(thisTime.Year(), thisTime.Month(), thisTime.Day(), 23, 59, 59, 999999999, localSearchTimeZone)
	return GetMillisForTime(resultTime)
}

func CopyStringMap(originalMap map[string]string) map[string]string {
	copyMap := make(map[string]string)
	for k, v := range originalMap {
		copyMap[k] = v
	}
	return copyMap
}

// MapToJson converts a map to a json string
func MapToJson(objmap map[string]string) string {
	b, _ := json.Marshal(objmap)
	return string(b)
}

// MapToJson converts a map to a json string
func MapBoolToJson(objmap map[string]bool) string {
	b, _ := json.Marshal(objmap)
	return string(b)
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

// MapFromJson will decode the key/value pair map
func MapBoolFromJson(data io.Reader) map[string]bool {
	decoder := json.NewDecoder(data)

	var objmap map[string]bool
	if err := decoder.Decode(&objmap); err != nil {
		return make(map[string]bool)
	} else {
		return objmap
	}
}

func ArrayToJson(objmap []string) string {
	b, _ := json.Marshal(objmap)
	return string(b)
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

func ArrayFromInterface(data interface{}) []string {
	stringArray := []string{}

	dataArray, ok := data.([]interface{})
	if !ok {
		return stringArray
	}

	for _, v := range dataArray {
		if str, ok := v.(string); ok {
			stringArray = append(stringArray, str)
		}
	}

	return stringArray
}

func StringInterfaceToJson(objmap map[string]interface{}) string {
	b, _ := json.Marshal(objmap)
	return string(b)
}

func StringInterfaceFromJson(data io.Reader) map[string]interface{} {
	decoder := json.NewDecoder(data)

	var objmap map[string]interface{}
	if err := decoder.Decode(&objmap); err != nil {
		return make(map[string]interface{})
	} else {
		return objmap
	}
}

func StringToJson(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

func StringFromJson(data io.Reader) string {
	decoder := json.NewDecoder(data)

	var s string
	if err := decoder.Decode(&s); err != nil {
		return ""
	} else {
		return s
	}
}

func GetServerIpAddress() string {
	if addrs, err := net.InterfaceAddrs(); err != nil {
		return ""
	} else {
		for _, addr := range addrs {

			if ip, ok := addr.(*net.IPNet); ok && !ip.IP.IsLoopback() && !ip.IP.IsLinkLocalUnicast() && !ip.IP.IsLinkLocalMulticast() {
				if ip.IP.To4() != nil {
					return ip.IP.String()
				}
			}
		}
	}

	return ""
}

func IsLower(s string) bool {
	return strings.ToLower(s) == s
}

func IsValidEmail(email string) bool {
	if !IsLower(email) {
		return false
	}

	if addr, err := mail.ParseAddress(email); err != nil {
		return false
	} else if addr.Name != "" {
		// mail.ParseAddress accepts input of the form "Billy Bob <billy@example.com>" which we don't allow
		return false
	}

	return true
}

var reservedName = []string{
	"signup",
	"login",
	"admin",
	"channel",
	"post",
	"api",
	"oauth",
}

func IsValidChannelIdentifier(s string) bool {

	if !IsValidAlphaNumHyphenUnderscore(s, true) {
		return false
	}

	if len(s) < CHANNEL_NAME_MIN_LENGTH {
		return false
	}

	return true
}

func IsValidAlphaNum(s string) bool {
	validAlphaNum := regexp.MustCompile(`^[a-z0-9]+([a-z\-0-9]+|(__)?)[a-z0-9]+$`)

	return validAlphaNum.MatchString(s)
}

func IsValidAlphaNumHyphenUnderscore(s string, withFormat bool) bool {
	if withFormat {
		validAlphaNumHyphenUnderscore := regexp.MustCompile(`^[a-z0-9]+([a-z\-\_0-9]+|(__)?)[a-z0-9]+$`)
		return validAlphaNumHyphenUnderscore.MatchString(s)
	}

	validSimpleAlphaNumHyphenUnderscore := regexp.MustCompile(`^[a-zA-Z0-9\-_]+$`)
	return validSimpleAlphaNumHyphenUnderscore.MatchString(s)
}

func Etag(parts ...interface{}) string {

	etag := CurrentVersion

	for _, part := range parts {
		etag += fmt.Sprintf(".%v", part)
	}

	return etag
}

var validHashtag = regexp.MustCompile(`^(#\pL[\pL\d\-_.]*[\pL\d])$`)
var puncStart = regexp.MustCompile(`^[^\pL\d\s#]+`)
var hashtagStart = regexp.MustCompile(`^#{2,}`)
var puncEnd = regexp.MustCompile(`[^\pL\d\s]+$`)

func ParseHashtags(text string) (string, string) {
	words := strings.Fields(text)

	hashtagString := ""
	plainString := ""
	for _, word := range words {
		// trim off surrounding punctuation
		word = puncStart.ReplaceAllString(word, "")
		word = puncEnd.ReplaceAllString(word, "")

		// and remove extra pound #s
		word = hashtagStart.ReplaceAllString(word, "#")

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

func IsValidHttpUrl(rawUrl string) bool {
	if strings.Index(rawUrl, "http://") != 0 && strings.Index(rawUrl, "https://") != 0 {
		return false
	}

	if _, err := url.ParseRequestURI(rawUrl); err != nil {
		return false
	}

	return true
}

func IsValidTurnOrStunServer(rawUri string) bool {
	if strings.Index(rawUri, "turn:") != 0 && strings.Index(rawUri, "stun:") != 0 {
		return false
	}

	if _, err := url.ParseRequestURI(rawUri); err != nil {
		return false
	}

	return true
}

func IsSafeLink(link *string) bool {
	if link != nil {
		if IsValidHttpUrl(*link) {
			return true
		} else if strings.HasPrefix(*link, "/") {
			return true
		} else {
			return false
		}
	}

	return true
}

func IsValidWebsocketUrl(rawUrl string) bool {
	if strings.Index(rawUrl, "ws://") != 0 && strings.Index(rawUrl, "wss://") != 0 {
		return false
	}

	if _, err := url.ParseRequestURI(rawUrl); err != nil {
		return false
	}

	return true
}

func IsValidTrueOrFalseString(value string) bool {
	return value == "true" || value == "false"
}

func IsValidNumberString(value string) bool {
	if _, err := strconv.Atoi(value); err != nil {
		return false
	}

	return true
}

func IsValidId(value string) bool {
	if len(value) != 26 {
		return false
	}

	for _, r := range value {
		if !unicode.IsLetter(r) && !unicode.IsNumber(r) {
			return false
		}
	}

	return true
}

// Copied from https://golang.org/src/net/dnsclient.go#L119
func IsDomainName(s string) bool {
	// See RFC 1035, RFC 3696.
	// Presentation format has dots before every label except the first, and the
	// terminal empty label is optional here because we assume fully-qualified
	// (absolute) input. We must therefore reserve space for the first and last
	// labels' length octets in wire format, where they are necessary and the
	// maximum total length is 255.
	// So our _effective_ maximum is 253, but 254 is not rejected if the last
	// character is a dot.
	l := len(s)
	if l == 0 || l > 254 || l == 254 && s[l-1] != '.' {
		return false
	}

	last := byte('.')
	ok := false // Ok once we've seen a letter.
	partlen := 0
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		default:
			return false
		case 'a' <= c && c <= 'z' || 'A' <= c && c <= 'Z' || c == '_':
			ok = true
			partlen++
		case '0' <= c && c <= '9':
			// fine
			partlen++
		case c == '-':
			// Byte before dash cannot be dot.
			if last == '.' {
				return false
			}
			partlen++
		case c == '.':
			// Byte before dot cannot be dot, dash.
			if last == '.' || last == '-' {
				return false
			}
			if partlen > 63 || partlen == 0 {
				return false
			}
			partlen = 0
		}
		last = c
	}
	if last == '-' || partlen > 63 {
		return false
	}

	return ok
}
