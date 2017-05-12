package s3

import (
	"github.com/AdRoll/goamz/aws"
)

var originalStrategy = attempts

func SetAttemptStrategy(s *aws.AttemptStrategy) {
	if s == nil {
		attempts = originalStrategy
	} else {
		attempts = *s
	}
}

func Sign(auth aws.Auth, method, path string, params, headers map[string][]string) {
	sign(auth, method, path, params, headers)
}

func SetListPartsMax(n int) {
	listPartsMax = n
}

func SetListMultiMax(n int) {
	listMultiMax = n
}
