package model

import (
	"net/url"
	"strings"
)

type clientRoute struct {
	segments []string
}

func clean(segment string) string {
	s := url.PathEscape(segment)
	return strings.ReplaceAll(s, "..", "")
}

func newClientRoute(segment string) clientRoute {
	return clientRoute{
		[]string{clean(segment)},
	}
}

func (r clientRoute) JoinRoutes(newRoutes ...clientRoute) clientRoute {
	for _, newRoute := range newRoutes {
		r.segments = append(r.segments, newRoute.segments...)
	}
	return r
}

func (r clientRoute) JoinSegments(segments ...string) clientRoute {
	for _, segment := range segments {
		r.segments = append(r.segments, clean(segment))
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
