// sign
package ses

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"github.com/goamz/goamz/aws"
	"time"
)

const (
	AMZ_DATE_STYLE = "Mon, 02 Jan 2006 15:04:05 -0700"
)

// Sign SES request as dictated by Amazon's Version 3 signature method.
func sign(auth aws.Auth, method string, headers map[string][]string) {
	date := time.Now().UTC().Format(AMZ_DATE_STYLE)
	h := hmac.New(sha256.New, []byte(auth.SecretKey))
	h.Write([]byte(date))
	signature := base64.StdEncoding.EncodeToString(h.Sum(nil))
	authHeader := fmt.Sprintf("AWS3-HTTPS AWSAccessKeyId=%s, Algorithm=HmacSHA256, Signature=%s", auth.AccessKey, signature)
	headers["Date"] = []string{date}
	headers["X-Amzn-Authorization"] = []string{authHeader}
}
