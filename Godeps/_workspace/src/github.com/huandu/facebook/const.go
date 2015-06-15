// A facebook graph api client in go.
// https://github.com/huandu/facebook/
//
// Copyright 2012 - 2015, Huan Du
// Licensed under the MIT license
// https://github.com/huandu/facebook/blob/master/LICENSE

package facebook

import (
	"encoding/json"
	"reflect"
	"regexp"
	"time"
)

// Facebook graph api methods.
const (
	GET    Method = "GET"
	POST   Method = "POST"
	DELETE Method = "DELETE"
	PUT    Method = "PUT"
)

const (
	ERROR_CODE_UNKNOWN = -1 // unknown facebook graph api error code.

	_MIME_FORM_URLENCODED = "application/x-www-form-urlencoded"
)

// Graph API debug mode values.
const (
	DEBUG_OFF DebugMode = "" // turn off debug.

	DEBUG_ALL     DebugMode = "all"
	DEBUG_INFO    DebugMode = "info"
	DEBUG_WARNING DebugMode = "warning"
)

const (
	debugInfoKey   = "__debug__"
	debugProtoKey  = "__proto__"
	debugHeaderKey = "__header__"

	facebookApiVersionHeader = "facebook-api-version"
	facebookDebugHeader      = "x-fb-debug"
	facebookRevHeader        = "x-fb-rev"
)

var (
	// Maps aliases to Facebook domains.
	// Copied from Facebook PHP SDK.
	domainMap = map[string]string{
		"api":         "https://api.facebook.com/",
		"api_video":   "https://api-video.facebook.com/",
		"api_read":    "https://api-read.facebook.com/",
		"graph":       "https://graph.facebook.com/",
		"graph_video": "https://graph-video.facebook.com/",
		"www":         "https://www.facebook.com/",
	}

	// checks whether it's a video post.
	regexpIsVideoPost = regexp.MustCompile(`/^(\/)(.+)(\/)(videos)$/`)

	// default facebook session.
	defaultSession = &Session{}

	typeOfPointerToBinaryData = reflect.TypeOf(&binaryData{})
	typeOfPointerToBinaryFile = reflect.TypeOf(&binaryFile{})
	typeOfJSONNumber          = reflect.TypeOf(json.Number(""))
	typeOfTime                = reflect.TypeOf(time.Time{})

	facebookSuccessJsonBytes = []byte("true")
)
