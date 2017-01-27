package elb

import (
	"github.com/goamz/goamz/aws"
)

func Sign(auth aws.Auth, method, path string, params map[string]string, host string) {
	sign(auth, method, path, params, host)
}
