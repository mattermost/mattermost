package model

import (
	"net/url"
)

// clientRoute is a thin wrapper around url.URL, with additional methods
// validating special URL path segments, like IDs, emails or emoji names, and
// which tracks any errors encountered while building it.
//
// It exposes several JoinXYZ functions, which validate the XYZ entity passed
// (if it's a valid ID, channel name, email...) that can be chained to build
// routes. These functions store an internal error if the validation fails.
//
// This error is then returned when calling either URL or String, which both
// return the underlying url.URL (its raw form or converted to string), only
// if there were no errors when building the whole route.
type clientRoute struct {
	url url.URL
}

func newClientRoute(v string) clientRoute {
	var r clientRoute
	r.url = *r.url.JoinPath(url.PathEscape(v))
	return r
}

// Join(Route|Segment|Id|Username|Teamname|Channelname|Email|Emojiname|JobType|CategoryId|AlphaNum)

func (r clientRoute) JoinRoutes(newRoutes ...clientRoute) clientRoute {
	for _, newRoute := range newRoutes {
		r.url = *r.url.JoinPath(newRoute.url.String())
	}
	return r
}

func (r clientRoute) JoinSegments(segments ...string) clientRoute {
	for _, segment := range segments {
		r = r.JoinRoutes(newClientRoute(segment))
	}
	return r
}

func (r clientRoute) URL() (*url.URL, error) {
	// Ensure there is a leading slash
	path, err := url.JoinPath("/", r.url.String())
	if err != nil {
		return nil, err
	}
	return &url.URL{Path: path}, nil
}

func (r clientRoute) String() (string, error) {
	// Make sure that there is a leading slash
	return url.JoinPath("/", r.url.String())
}
