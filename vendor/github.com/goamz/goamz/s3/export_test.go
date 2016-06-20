package s3

import (
	"github.com/goamz/goamz/aws"
)

func Sign(auth aws.Auth, method, path string, params, headers map[string][]string) {
	sign(auth, method, path, params, headers)
}

func SetListPartsMax(n int) {
	listPartsMax = n
}

func SetListMultiMax(n int) {
	listMultiMax = n
}
