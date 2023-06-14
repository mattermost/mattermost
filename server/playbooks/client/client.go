// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"reflect"
	"strconv"

	"github.com/google/go-querystring/query"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"golang.org/x/oauth2"
)

const (
	apiVersion = "v0"
	manifestID = "playbooks"
	userAgent  = "go-client/" + apiVersion
)

// Client manages communication with the Playbooks API.
type Client struct {
	// client is the underlying HTTP client used to make API requests.
	client *http.Client
	// BaseURL is the base HTTP endpoint for the Playbooks plugin.
	BaseURL *url.URL
	// User agent used when communicating with the Playbooks API.
	UserAgent string

	// PlaybookRuns is a collection of methods used to interact with playbook runs.
	PlaybookRuns *PlaybookRunService
	// Playbooks is a collection of methods used to interact with playbooks.
	Playbooks *PlaybooksService
	// Settings is a collection of methods used to interact with settings.
	Settings *SettingsService
	// Actions is a collection of methods used to interact with actions.
	Actions *ActionsService
	// Stats is a collection of methods used to interact with stats.
	Stats *StatsService
	// Reminders is a collection of methods used to interact with reminders.
	Reminders *RemindersService
	// Telemetry is a collection of methods used to interact with telemetry.
	Telemetry *TelemetryService
}

// New creates a new instance of Client using the configuration from the given Mattermost Client.
func New(client4 *model.Client4) (*Client, error) {
	ctx := context.Background()
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: client4.AuthToken},
	)

	return newClient(client4.URL, oauth2.NewClient(ctx, ts))
}

// newClient creates a new instance of Client from the given URL and http.Client.
func newClient(mattermostSiteURL string, httpClient *http.Client) (*Client, error) {
	siteURL, err := url.Parse(mattermostSiteURL)
	if err != nil {
		return nil, err
	}

	c := &Client{client: httpClient, BaseURL: siteURL, UserAgent: userAgent}
	c.PlaybookRuns = &PlaybookRunService{c}
	c.Playbooks = &PlaybooksService{c}
	c.Settings = &SettingsService{c}
	c.Actions = &ActionsService{c}
	c.Stats = &StatsService{c}
	c.Reminders = &RemindersService{c}
	c.Telemetry = &TelemetryService{c}
	return c, nil
}

// newRequest creates an API request, JSON-encoding any given body parameter.
func (c *Client) newRequest(method, endpoint string, body interface{}) (*http.Request, error) {
	u, err := c.BaseURL.Parse(buildAPIURL(endpoint))
	if err != nil {
		return nil, errors.Wrapf(err, "invalid endpoint %s", endpoint)
	}

	var buf io.ReadWriter
	if body != nil {
		buf = &bytes.Buffer{}
		enc := json.NewEncoder(buf)
		enc.SetEscapeHTML(false)
		err = enc.Encode(body)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to encode body %s", body)
		}
	}

	req, err := http.NewRequest(method, u.String(), buf)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to create http request for url %s", u)
	}

	if buf != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.UserAgent != "" {
		req.Header.Set("User-Agent", c.UserAgent)
	}
	return req, nil
}

// buildAPIURL constructs the path to the given endpoint.
func buildAPIURL(endpoint string) string {
	return fmt.Sprintf("plugins/%s/api/%s/%s", manifestID, apiVersion, endpoint)
}

// do sends an API request and returns the API response.
//
// The API response is JSON decoded and stored in the value pointed to by v, or returned as an
// error if an API error has occurred. If v implements the io.Writer
// interface, the raw response body will be written to v, without attempting to
// first decode it.
func (c *Client) do(ctx context.Context, req *http.Request, v interface{}) (*http.Response, error) {
	if ctx == nil {
		return nil, errors.New("context must be non-nil")
	}
	req = req.WithContext(ctx)

	resp, err := c.client.Do(req)
	if err != nil {
		select {
		case <-ctx.Done():
			return nil, errors.Wrapf(ctx.Err(), "client err=%s", err.Error())
		default:
		}

		return nil, err
	}
	defer resp.Body.Close()

	err = checkResponse(resp)
	if err != nil {
		return resp, err
	}

	if v != nil {
		if w, ok := v.(io.Writer); ok {
			if _, err = io.Copy(w, resp.Body); err != nil {
				return nil, err
			}
		} else {
			body, _ := ioutil.ReadAll(resp.Body)

			decErr := json.NewDecoder(bytes.NewReader(body)).Decode(v)
			if decErr == io.EOF {
				// TODO: Confirm if this happens only on empty bodies. If so, check that first before decoding.
				decErr = nil // ignore EOF errors caused by empty response body
			}
			if decErr != nil {
				err = decErr
			}
		}
	}

	return resp, err
}

type GraphQLInput struct {
	Query         string                 `json:"query"`
	OperationName string                 `json:"operationName"`
	Variables     map[string]interface{} `json:"variables"`
}

func (c *Client) DoGraphql(ctx context.Context, input *GraphQLInput, v interface{}) error {
	url := "query"
	req, err := c.newRequest(http.MethodPost, url, input)
	if err != nil {
		return err
	}

	_, err = c.do(ctx, req, v)
	if err != nil {
		return err
	}

	return nil
}

// checkResponse checks the API response for an error.
//
// Any response with a status code outside 2xx is considered an error, and its body inspected for
// an optional `Error` property in a JSON struct.
func checkResponse(r *http.Response) error {
	if c := r.StatusCode; http.StatusOK <= c && c <= 299 {
		return nil
	}

	errorResponse := &ErrorResponse{
		StatusCode: r.StatusCode,
		Method:     r.Request.Method,
		URL:        r.Request.URL.String(),
	}
	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		errorResponse.Err = fmt.Errorf("failed to read response body: %w", err)
	}
	r.Body = ioutil.NopCloser(bytes.NewBuffer(data))

	if data != nil {
		_ = json.Unmarshal(data, errorResponse)
	}

	return errorResponse
}

// addOption adds the given parameter as an URL query parameters to s.
func addOption(s string, name, value string) (string, error) {
	u, err := url.Parse(s)
	if err != nil {
		return s, errors.Wrapf(err, "failed to parse %s", s)
	}

	qa := u.Query()
	qa.Add(name, value)
	u.RawQuery = qa.Encode()

	return u.String(), nil
}

// addOptions adds the parameters in opts as URL query parameters to s. opts
// must be a struct whose fields may contain "url" tags.
func addOptions(s string, opts interface{}) (string, error) {
	v := reflect.ValueOf(opts)
	if v.Kind() == reflect.Ptr && v.IsNil() {
		return s, nil
	}

	u, err := url.Parse(s)
	if err != nil {
		return s, errors.Wrapf(err, "failed to parse %s", s)
	}

	qs, err := query.Values(opts)
	if err != nil {
		return s, errors.Wrapf(err, "failed to opts %+v", opts)
	}

	// Append to the existing query parameters.
	qa := u.Query()
	for key, values := range qs {
		for _, value := range values {
			qa.Add(key, value)
		}
	}

	u.RawQuery = qa.Encode()
	return u.String(), nil
}

// addPaginationOptions adds the given pagination parameters as URL query parameters to s.
func addPaginationOptions(s string, page, perPage int) (string, error) {
	u, err := url.Parse(s)
	if err != nil {
		return s, errors.Wrapf(err, "failed to parse %s", s)
	}

	qa := u.Query()
	qa.Add("page", strconv.Itoa(page))
	qa.Add("per_page", strconv.Itoa(perPage))
	u.RawQuery = qa.Encode()

	return u.String(), nil
}
