package aws

import (
	"fmt"
	"math"
	"net/http"
	"net/http/httputil"
	"regexp"
	"time"

	"github.com/awslabs/aws-sdk-go/internal/endpoints"
)

type Service struct {
	Config            *Config
	Handlers          Handlers
	ManualSend        bool
	ServiceName       string
	APIVersion        string
	Endpoint          string
	JSONVersion       string
	TargetPrefix      string
	RetryRules        func(*Request) time.Duration
	ShouldRetry       func(*Request) bool
	DefaultMaxRetries uint
}

var schemeRE = regexp.MustCompile("^([^:]+)://")

func NewService(config *Config) *Service {
	svc := &Service{Config: config}
	svc.Initialize()
	return svc
}

func (s *Service) Initialize() {
	if s.Config == nil {
		s.Config = &Config{}
	}
	if s.Config.HTTPClient == nil {
		s.Config.HTTPClient = http.DefaultClient
	}

	if s.RetryRules == nil {
		s.RetryRules = retryRules
	}

	if s.ShouldRetry == nil {
		s.ShouldRetry = shouldRetry
	}

	s.DefaultMaxRetries = 3
	s.Handlers.Build.PushBack(UserAgentHandler)
	s.Handlers.Sign.PushBack(BuildContentLength)
	s.Handlers.Send.PushBack(SendHandler)
	s.Handlers.AfterRetry.PushBack(AfterRetryHandler)
	s.Handlers.ValidateResponse.PushBack(ValidateResponseHandler)
	s.AddDebugHandlers()
	s.buildEndpoint()

	if !s.Config.DisableParamValidation {
		s.Handlers.Validate.PushBack(ValidateParameters)
	}
}

func (s *Service) buildEndpoint() {
	if s.Config.Endpoint != "" {
		s.Endpoint = s.Config.Endpoint
	} else {
		s.Endpoint = endpoints.EndpointForRegion(s.ServiceName, s.Config.Region)
	}

	if !schemeRE.MatchString(s.Endpoint) {
		scheme := "https"
		if s.Config.DisableSSL {
			scheme = "http"
		}
		s.Endpoint = scheme + "://" + s.Endpoint
	}
}

func (s *Service) AddDebugHandlers() {
	out := s.Config.Logger
	if s.Config.LogLevel == 0 {
		return
	}

	s.Handlers.Sign.PushBack(func(r *Request) {
		dumpedBody, _ := httputil.DumpRequest(r.HTTPRequest, true)

		fmt.Fprintf(out, "=> [%s] %s.%s(%+v)\n", r.Time,
			r.Service.ServiceName, r.Operation.Name, r.Params)
		fmt.Fprintf(out, "---[ REQUEST PRE-SIGN ]------------------------------\n")
		fmt.Fprintf(out, "%s\n", string(dumpedBody))
		fmt.Fprintf(out, "-----------------------------------------------------\n")
	})
	s.Handlers.Send.PushFront(func(r *Request) {
		dumpedBody, _ := httputil.DumpRequest(r.HTTPRequest, true)

		fmt.Fprintf(out, "---[ REQUEST POST-SIGN ]-----------------------------\n")
		fmt.Fprintf(out, "%s\n", string(dumpedBody))
		fmt.Fprintf(out, "-----------------------------------------------------\n")
	})
	s.Handlers.Send.PushBack(func(r *Request) {
		fmt.Fprintf(out, "---[ RESPONSE ]--------------------------------------\n")
		if r.HTTPResponse != nil {
			dumpedBody, _ := httputil.DumpResponse(r.HTTPResponse, true)
			fmt.Fprintf(out, "%s\n", string(dumpedBody))
		} else if r.Error != nil {
			fmt.Fprintf(out, "%s\n", r.Error)
		}
		fmt.Fprintf(out, "-----------------------------------------------------\n")
	})
}

func (s *Service) MaxRetries() uint {
	if s.Config.MaxRetries < 0 {
		return s.DefaultMaxRetries
	} else {
		return uint(s.Config.MaxRetries)
	}
}

func retryRules(r *Request) time.Duration {
	delay := time.Duration(math.Pow(2, float64(r.RetryCount))) * 30
	return delay * time.Millisecond
}

func shouldRetry(r *Request) bool {
	if err := Error(r.Error); err != nil {
		if err.StatusCode >= 500 {
			return true
		}

		switch err.Code {
		case "ExpiredTokenException":
		case "ProvisionedThroughputExceededException", "Throttling":
			return true
		}
	}
	return false
}
