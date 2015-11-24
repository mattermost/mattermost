package aws_test

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/goamz/goamz/aws"
	. "gopkg.in/check.v1"
)

var _ = Suite(&V4SignerSuite{})

type V4SignerSuite struct {
	auth   aws.Auth
	region aws.Region
	cases  []V4SignerSuiteCase
}

type V4SignerSuiteCase struct {
	label            string
	request          V4SignerSuiteCaseRequest
	canonicalRequest string
	stringToSign     string
	signature        string
	authorization    string
}

type V4SignerSuiteCaseRequest struct {
	method  string
	host    string
	url     string
	headers []string
	body    string
}

func (s *V4SignerSuite) SetUpSuite(c *C) {
	s.auth = aws.Auth{AccessKey: "AKIDEXAMPLE", SecretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY"}
	s.region = aws.USEast

	// Test cases from the Signature Version 4 Test Suite (http://goo.gl/nguvs0)
	s.cases = append(s.cases,

		// get-header-key-duplicate
		V4SignerSuiteCase{
			label: "get-header-key-duplicate",
			request: V4SignerSuiteCaseRequest{
				method:  "POST",
				host:    "host.foo.com",
				url:     "/",
				headers: []string{"DATE:Mon, 09 Sep 2011 23:36:00 GMT", "ZOO:zoobar", "zoo:foobar", "zoo:zoobar"},
			},
			canonicalRequest: "POST\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\nzoo:foobar,zoobar,zoobar\n\ndate;host;zoo\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n3c52f0eaae2b61329c0a332e3fa15842a37bc5812cf4d80eb64784308850e313",
			signature:        "54afcaaf45b331f81cd2edb974f7b824ff4dd594cbbaa945ed636b48477368ed",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host;zoo, Signature=54afcaaf45b331f81cd2edb974f7b824ff4dd594cbbaa945ed636b48477368ed",
		},

		// get-header-value-order
		V4SignerSuiteCase{
			label: "get-header-value-order",
			request: V4SignerSuiteCaseRequest{
				method:  "POST",
				host:    "host.foo.com",
				url:     "/",
				headers: []string{"DATE:Mon, 09 Sep 2011 23:36:00 GMT", "p:z", "p:a", "p:p", "p:a"},
			},
			canonicalRequest: "POST\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\np:a,a,p,z\n\ndate;host;p\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n94c0389fefe0988cbbedc8606f0ca0b485b48da010d09fc844b45b697c8924fe",
			signature:        "d2973954263943b11624a11d1c963ca81fb274169c7868b2858c04f083199e3d",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host;p, Signature=d2973954263943b11624a11d1c963ca81fb274169c7868b2858c04f083199e3d",
		},

		// get-header-value-trim
		V4SignerSuiteCase{
			label: "get-header-value-trim",
			request: V4SignerSuiteCaseRequest{
				method:  "POST",
				host:    "host.foo.com",
				url:     "/",
				headers: []string{"DATE:Mon, 09 Sep 2011 23:36:00 GMT", "p: phfft "},
			},
			canonicalRequest: "POST\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\np:phfft\n\ndate;host;p\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\ndddd1902add08da1ac94782b05f9278c08dc7468db178a84f8950d93b30b1f35",
			signature:        "debf546796015d6f6ded8626f5ce98597c33b47b9164cf6b17b4642036fcb592",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host;p, Signature=debf546796015d6f6ded8626f5ce98597c33b47b9164cf6b17b4642036fcb592",
		},

		// get-relative-relative
		V4SignerSuiteCase{
			label: "get-relative-relative",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/foo/bar/../..",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n366b91fb121d72a00f46bbe8d395f53a102b06dfb7e79636515208ed3fa606b1",
			signature:        "b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
		},

		// get-relative
		V4SignerSuiteCase{
			label: "get-relative",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/foo/..",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n366b91fb121d72a00f46bbe8d395f53a102b06dfb7e79636515208ed3fa606b1",
			signature:        "b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
		},

		// get-slash-dot-slash
		V4SignerSuiteCase{
			label: "get-slash-dot-slash",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/./",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n366b91fb121d72a00f46bbe8d395f53a102b06dfb7e79636515208ed3fa606b1",
			signature:        "b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
		},

		// get-slash-pointless-dot
		V4SignerSuiteCase{
			label: "get-slash-pointless-dot",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/./foo",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/foo\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n8021a97572ee460f87ca67f4e8c0db763216d84715f5424a843a5312a3321e2d",
			signature:        "910e4d6c9abafaf87898e1eb4c929135782ea25bb0279703146455745391e63a",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=910e4d6c9abafaf87898e1eb4c929135782ea25bb0279703146455745391e63a",
		},

		// get-slash
		V4SignerSuiteCase{
			label: "get-slash",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "//",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n366b91fb121d72a00f46bbe8d395f53a102b06dfb7e79636515208ed3fa606b1",
			signature:        "b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
		},

		// get-slashes
		V4SignerSuiteCase{
			label: "get-slashes",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "//foo//",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/foo/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n6bb4476ee8745730c9cb79f33a0c70baa6d8af29c0077fa12e4e8f1dd17e7098",
			signature:        "b00392262853cfe3201e47ccf945601079e9b8a7f51ee4c3d9ee4f187aa9bf19",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=b00392262853cfe3201e47ccf945601079e9b8a7f51ee4c3d9ee4f187aa9bf19",
		},

		// get-space
		V4SignerSuiteCase{
			label: "get-space",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/%20/foo",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/%20/foo\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n69c45fb9fe3fd76442b5086e50b2e9fec8298358da957b293ef26e506fdfb54b",
			signature:        "f309cfbd10197a230c42dd17dbf5cca8a0722564cb40a872d25623cfa758e374",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=f309cfbd10197a230c42dd17dbf5cca8a0722564cb40a872d25623cfa758e374",
		},

		// get-unreserved
		V4SignerSuiteCase{
			label: "get-unreserved",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/-._~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/-._~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\ndf63ee3247c0356c696a3b21f8d8490b01fa9cd5bc6550ef5ef5f4636b7b8901",
			signature:        "830cc36d03f0f84e6ee4953fbe701c1c8b71a0372c63af9255aa364dd183281e",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=830cc36d03f0f84e6ee4953fbe701c1c8b71a0372c63af9255aa364dd183281e",
		},

		// get-utf8
		V4SignerSuiteCase{
			label: "get-utf8",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/%E1%88%B4",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/%E1%88%B4\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n27ba31df5dbc6e063d8f87d62eb07143f7f271c5330a917840586ac1c85b6f6b",
			signature:        "8d6634c189aa8c75c2e51e106b6b5121bed103fdb351f7d7d4381c738823af74",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=8d6634c189aa8c75c2e51e106b6b5121bed103fdb351f7d7d4381c738823af74",
		},

		// get-vanilla-empty-query-key
		V4SignerSuiteCase{
			label: "get-vanilla-empty-query-key",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/?foo=bar",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\nfoo=bar\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n0846c2945b0832deb7a463c66af5c4f8bd54ec28c438e67a214445b157c9ddf8",
			signature:        "56c054473fd260c13e4e7393eb203662195f5d4a1fada5314b8b52b23f985e9f",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=56c054473fd260c13e4e7393eb203662195f5d4a1fada5314b8b52b23f985e9f",
		},

		// get-vanilla-query-order-key-case
		V4SignerSuiteCase{
			label: "get-vanilla-query-order-key-case",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/?foo=Zoo&foo=aha",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\nfoo=Zoo&foo=aha\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\ne25f777ba161a0f1baf778a87faf057187cf5987f17953320e3ca399feb5f00d",
			signature:        "be7148d34ebccdc6423b19085378aa0bee970bdc61d144bd1a8c48c33079ab09",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=be7148d34ebccdc6423b19085378aa0bee970bdc61d144bd1a8c48c33079ab09",
		},

		// get-vanilla-query-order-key
		V4SignerSuiteCase{
			label: "get-vanilla-query-order-key",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/?a=foo&b=foo",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\na=foo&b=foo\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n2f23d14fe13caebf6dfda346285c6d9c14f49eaca8f5ec55c627dd7404f7a727",
			signature:        "0dc122f3b28b831ab48ba65cb47300de53fbe91b577fe113edac383730254a3b",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=0dc122f3b28b831ab48ba65cb47300de53fbe91b577fe113edac383730254a3b",
		},

		// get-vanilla-query-order-value
		V4SignerSuiteCase{
			label: "get-vanilla-query-order-value",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/?foo=b&foo=a",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\nfoo=a&foo=b\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n33dffc220e89131f8f6157a35c40903daa658608d9129ff9489e5cf5bbd9b11b",
			signature:        "feb926e49e382bec75c9d7dcb2a1b6dc8aa50ca43c25d2bc51143768c0875acc",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=feb926e49e382bec75c9d7dcb2a1b6dc8aa50ca43c25d2bc51143768c0875acc",
		},

		// get-vanilla-query-unreserved
		V4SignerSuiteCase{
			label: "get-vanilla-query-unreserved",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/?-._~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz=-._~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\n-._~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz=-._~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\nd2578f3156d4c9d180713d1ff20601d8a3eed0dd35447d24603d7d67414bd6b5",
			signature:        "f1498ddb4d6dae767d97c466fb92f1b59a2c71ca29ac954692663f9db03426fb",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=f1498ddb4d6dae767d97c466fb92f1b59a2c71ca29ac954692663f9db03426fb",
		},

		// get-vanilla-query
		V4SignerSuiteCase{
			label: "get-vanilla-query",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n366b91fb121d72a00f46bbe8d395f53a102b06dfb7e79636515208ed3fa606b1",
			signature:        "b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
		},

		// get-vanilla-ut8-query
		V4SignerSuiteCase{
			label: "get-vanilla-ut8-query",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/?ሴ=bar",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\n%E1%88%B4=bar\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\nde5065ff39c131e6c2e2bd19cd9345a794bf3b561eab20b8d97b2093fc2a979e",
			signature:        "6fb359e9a05394cc7074e0feb42573a2601abc0c869a953e8c5c12e4e01f1a8c",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=6fb359e9a05394cc7074e0feb42573a2601abc0c869a953e8c5c12e4e01f1a8c",
		},

		// get-vanilla
		V4SignerSuiteCase{
			label: "get-vanilla",
			request: V4SignerSuiteCaseRequest{
				method:  "GET",
				host:    "host.foo.com",
				url:     "/",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "GET\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n366b91fb121d72a00f46bbe8d395f53a102b06dfb7e79636515208ed3fa606b1",
			signature:        "b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=b27ccfbfa7df52a200ff74193ca6e32d4b48b8856fab7ebf1c595d0670a7e470",
		},

		// post-header-key-case
		V4SignerSuiteCase{
			label: "post-header-key-case",
			request: V4SignerSuiteCaseRequest{
				method:  "POST",
				host:    "host.foo.com",
				url:     "/",
				headers: []string{"DATE:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "POST\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n05da62cee468d24ae84faff3c39f1b85540de60243c1bcaace39c0a2acc7b2c4",
			signature:        "22902d79e148b64e7571c3565769328423fe276eae4b26f83afceda9e767f726",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=22902d79e148b64e7571c3565769328423fe276eae4b26f83afceda9e767f726",
		},

		// post-header-key-sort
		V4SignerSuiteCase{
			label: "post-header-key-sort",
			request: V4SignerSuiteCaseRequest{
				method:  "POST",
				host:    "host.foo.com",
				url:     "/",
				headers: []string{"DATE:Mon, 09 Sep 2011 23:36:00 GMT", "ZOO:zoobar"},
			},
			canonicalRequest: "POST\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\nzoo:zoobar\n\ndate;host;zoo\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n34e1bddeb99e76ee01d63b5e28656111e210529efeec6cdfd46a48e4c734545d",
			signature:        "b7a95a52518abbca0964a999a880429ab734f35ebbf1235bd79a5de87756dc4a",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host;zoo, Signature=b7a95a52518abbca0964a999a880429ab734f35ebbf1235bd79a5de87756dc4a",
		},

		// post-header-value-case
		V4SignerSuiteCase{
			label: "post-header-value-case",
			request: V4SignerSuiteCaseRequest{
				method:  "POST",
				host:    "host.foo.com",
				url:     "/",
				headers: []string{"DATE:Mon, 09 Sep 2011 23:36:00 GMT", "zoo:ZOOBAR"},
			},
			canonicalRequest: "POST\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\nzoo:ZOOBAR\n\ndate;host;zoo\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n3aae6d8274b8c03e2cc96fc7d6bda4b9bd7a0a184309344470b2c96953e124aa",
			signature:        "273313af9d0c265c531e11db70bbd653f3ba074c1009239e8559d3987039cad7",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host;zoo, Signature=273313af9d0c265c531e11db70bbd653f3ba074c1009239e8559d3987039cad7",
		},

		// post-vanilla-empty-query-value
		V4SignerSuiteCase{
			label: "post-vanilla-empty-query-value",
			request: V4SignerSuiteCaseRequest{
				method:  "POST",
				host:    "host.foo.com",
				url:     "/?foo=bar",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "POST\n/\nfoo=bar\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\ncd4f39132d8e60bb388831d734230460872b564871c47f5de62e62d1a68dbe1e",
			signature:        "b6e3b79003ce0743a491606ba1035a804593b0efb1e20a11cba83f8c25a57a92",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=b6e3b79003ce0743a491606ba1035a804593b0efb1e20a11cba83f8c25a57a92",
		},

		// post-vanilla-query
		V4SignerSuiteCase{
			label: "post-vanilla-query",
			request: V4SignerSuiteCaseRequest{
				method:  "POST",
				host:    "host.foo.com",
				url:     "/?foo=bar",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "POST\n/\nfoo=bar\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\ncd4f39132d8e60bb388831d734230460872b564871c47f5de62e62d1a68dbe1e",
			signature:        "b6e3b79003ce0743a491606ba1035a804593b0efb1e20a11cba83f8c25a57a92",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=b6e3b79003ce0743a491606ba1035a804593b0efb1e20a11cba83f8c25a57a92",
		},

		// post-vanilla
		V4SignerSuiteCase{
			label: "post-vanilla",
			request: V4SignerSuiteCaseRequest{
				method:  "POST",
				host:    "host.foo.com",
				url:     "/",
				headers: []string{"Date:Mon, 09 Sep 2011 23:36:00 GMT"},
			},
			canonicalRequest: "POST\n/\n\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ndate;host\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n05da62cee468d24ae84faff3c39f1b85540de60243c1bcaace39c0a2acc7b2c4",
			signature:        "22902d79e148b64e7571c3565769328423fe276eae4b26f83afceda9e767f726",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=date;host, Signature=22902d79e148b64e7571c3565769328423fe276eae4b26f83afceda9e767f726",
		},

		// post-x-www-form-urlencoded-parameters
		V4SignerSuiteCase{
			label: "post-x-www-form-urlencoded-parameters",
			request: V4SignerSuiteCaseRequest{
				method:  "POST",
				host:    "host.foo.com",
				url:     "/",
				headers: []string{"Content-Type:application/x-www-form-urlencoded; charset=utf8", "Date:Mon, 09 Sep 2011 23:36:00 GMT"},
				body:    "foo=bar",
			},
			canonicalRequest: "POST\n/\n\ncontent-type:application/x-www-form-urlencoded; charset=utf8\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ncontent-type;date;host\n3ba8907e7a252327488df390ed517c45b96dead033600219bdca7107d1d3f88a",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\nc4115f9e54b5cecf192b1eaa23b8e88ed8dc5391bd4fde7b3fff3d9c9fe0af1f",
			signature:        "b105eb10c6d318d2294de9d49dd8b031b55e3c3fe139f2e637da70511e9e7b71",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=content-type;date;host, Signature=b105eb10c6d318d2294de9d49dd8b031b55e3c3fe139f2e637da70511e9e7b71",
		},

		// post-x-www-form-urlencoded
		V4SignerSuiteCase{
			label: "post-x-www-form-urlencoded",
			request: V4SignerSuiteCaseRequest{
				method:  "POST",
				host:    "host.foo.com",
				url:     "/",
				headers: []string{"Content-Type:application/x-www-form-urlencoded", "Date:Mon, 09 Sep 2011 23:36:00 GMT"},
				body:    "foo=bar",
			},
			canonicalRequest: "POST\n/\n\ncontent-type:application/x-www-form-urlencoded\ndate:Mon, 09 Sep 2011 23:36:00 GMT\nhost:host.foo.com\n\ncontent-type;date;host\n3ba8907e7a252327488df390ed517c45b96dead033600219bdca7107d1d3f88a",
			stringToSign:     "AWS4-HMAC-SHA256\n20110909T233600Z\n20110909/us-east-1/host/aws4_request\n4c5c6e4b52fb5fb947a8733982a8a5a61b14f04345cbfe6e739236c76dd48f74",
			signature:        "5a15b22cf462f047318703b92e6f4f38884e4a7ab7b1d6426ca46a8bd1c26cbc",
			authorization:    "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20110909/us-east-1/host/aws4_request, SignedHeaders=content-type;date;host, Signature=5a15b22cf462f047318703b92e6f4f38884e4a7ab7b1d6426ca46a8bd1c26cbc",
		},
	)
}

func (s *V4SignerSuite) TestCases(c *C) {
	signer := aws.NewV4Signer(s.auth, "host", s.region)

	for _, testCase := range s.cases {

		req, err := http.NewRequest(testCase.request.method, "http://"+testCase.request.host+testCase.request.url, strings.NewReader(testCase.request.body))
		c.Assert(err, IsNil, Commentf("Testcase: %s", testCase.label))
		for _, v := range testCase.request.headers {
			h := strings.SplitN(v, ":", 2)
			req.Header.Add(h[0], h[1])
		}
		req.Header.Set("host", req.Host)

		t := signer.RequestTime(req)

		canonicalRequest := signer.CanonicalRequest(req)
		c.Check(canonicalRequest, Equals, testCase.canonicalRequest, Commentf("Testcase: %s", testCase.label))

		stringToSign := signer.StringToSign(t, canonicalRequest)
		c.Check(stringToSign, Equals, testCase.stringToSign, Commentf("Testcase: %s", testCase.label))

		signature := signer.Signature(t, stringToSign)
		c.Check(signature, Equals, testCase.signature, Commentf("Testcase: %s", testCase.label))

		authorization := signer.Authorization(req.Header, t, signature)
		c.Check(authorization, Equals, testCase.authorization, Commentf("Testcase: %s", testCase.label))

		signer.Sign(req)
		c.Check(req.Header.Get("Authorization"), Equals, testCase.authorization, Commentf("Testcase: %s", testCase.label))
	}
}

func ExampleV4Signer() {
	// Get auth from env vars
	auth, err := aws.EnvAuth()
	if err != nil {
		fmt.Println(err)
	}

	// Create a signer with the auth, name of the service, and aws region
	signer := aws.NewV4Signer(auth, "dynamodb", aws.USEast)

	// Create a request
	req, err := http.NewRequest("POST", aws.USEast.DynamoDBEndpoint, strings.NewReader("sample_request"))
	if err != nil {
		fmt.Println(err)
	}

	// Date or x-amz-date header is required to sign a request
	req.Header.Add("Date", time.Now().UTC().Format(http.TimeFormat))

	// Sign the request
	signer.Sign(req)

	// Issue signed request
	http.DefaultClient.Do(req)
}
