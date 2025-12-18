package model

import (
	"net/url"
	"strings"
)

type clientRoute struct {
	segments []string
}

func cleanSegment(segment string) string {
	s := strings.ReplaceAll(segment, "..", "")
	return url.PathEscape(s)
}

func newClientRoute(segment string) clientRoute {
	return clientRoute{}.Join(segment)
}

func (r clientRoute) Join(segments ...any) clientRoute {
	for _, segment := range segments {
		if s, ok := segment.(string); ok {
			r.segments = append(r.segments, cleanSegment(s))
		}

		if s, ok := segment.(clientRoute); ok {
			r.segments = append(r.segments, s.segments...)
		}
	}

	return r
}

func (r clientRoute) URL() (*url.URL, error) {
	path, err := r.String()
	if err != nil {
		return nil, err
	}
	return &url.URL{Path: path}, nil
}

func (r clientRoute) String() (string, error) {
	// Make sure that there is a leading slash
	return url.JoinPath("/", strings.Join(r.segments, "/"))
}
