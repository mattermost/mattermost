package route53

import (
	"regexp"

	"github.com/awslabs/aws-sdk-go/aws"
)

func init() {
	initService = func(s *aws.Service) {
		s.Handlers.Build.PushBack(sanitizeURL)
	}
}

var reSanitizeURL = regexp.MustCompile(`\/%2F\w+%2F`)

func sanitizeURL(r *aws.Request) {
	r.HTTPRequest.URL.Opaque =
		reSanitizeURL.ReplaceAllString(r.HTTPRequest.URL.Opaque, "/")
}
