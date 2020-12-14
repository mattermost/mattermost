// Package genderize provides a Go library for using the Genderize.io API.
package genderize

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
)

// Config is a simple struct containing the Genderize api localization settings (https://genderize.io/#localization)
type Config struct {
	Country string
	Lang    string
}

const (
	apiURL = "https://api.genderize.io/?"
)

var (
	// APIKey holds an optional API key to increase rate limits
	APIKey = ""
)

// Single takes one name as input and returns a result struct
func Single(name string) (Result, error) {
	var result Result
	url := fmt.Sprintf("%sname=%s", apiURL, name)

	if APIKey != "" {
		url += "&apikey=" + APIKey
	}

	resp, err := request(url)
	if err != nil {
		return result, err
	}
	defer resp.Body.Close()
	var single responseSingle
	if err := json.NewDecoder(resp.Body).Decode(&single); err != nil {
		return result, err
	}
	result.Name = single.Name
	result.Gender = genderToEnum(single.Gender)
	result.Probability = single.Probability
	result.Count = single.Count
	result.RateLimit = getRateLimit(resp)

	return result, nil
}

// SingleLocalize takes one name as input and a config struct and returns a Result
func SingleLocalize(name string, config Config) (Result, error) {
	var result Result
	url := fmt.Sprintf("%sname=%s", apiURL, name)

	url, err := insertConfig(url, config)
	if err != nil {
		return result, err
	}
	if APIKey != "" {
		url += "&apikey=" + APIKey
	}

	resp, err := request(url)
	if err != nil {
		return result, err
	}
	defer resp.Body.Close()
	var single responseSingle
	if err := json.NewDecoder(resp.Body).Decode(&single); err != nil {
		return result, err
	}
	result.Name = single.Name
	result.Gender = genderToEnum(single.Gender)
	result.Probability = single.Probability
	result.Count = single.Count
	result.RateLimit = getRateLimit(resp)

	return result, nil
}

// Multiple takes an array of names (the API will only return a max of 10) as input and returns an array of Results
func Multiple(names []string) ([]Result, error) {
	results := make([]Result, len(names), 10)
	url := apiURL

	for _, name := range names {
		url += "&name=" + name
	}
	if APIKey != "" {
		url += "&apikey=" + APIKey
	}

	resp, err := request(url)
	if err != nil {
		return results, err
	}
	defer resp.Body.Close()
	var multi responseMulti
	if err := json.NewDecoder(resp.Body).Decode(&multi); err != nil {
		return results, err
	}
	ratelimit := getRateLimit(resp)
	for i, v := range multi {
		results[i].Name = v.Name
		results[i].Gender = genderToEnum(v.Gender)
		results[i].Probability = v.Probability
		results[i].Count = v.Count
		results[i].RateLimit = ratelimit
	}

	return results, nil
}

// MultipleLocalize takes an array of names (the API will only return a max of 10) and config struct as input and returns an array of Results
func MultipleLocalize(names []string, config Config) ([]Result, error) {
	results := make([]Result, len(names), 10)
	url := apiURL

	for _, name := range names {
		url += "&name=" + name
	}
	url, err := insertConfig(url, config)
	if err != nil {
		return results, err
	}

	if APIKey != "" {
		url += "&apikey=" + APIKey
	}
	resp, err := request(url)
	if err != nil {
		return results, err
	}
	defer resp.Body.Close()
	var multi responseMulti
	if err := json.NewDecoder(resp.Body).Decode(&multi); err != nil {
		return results, err
	}
	ratelimit := getRateLimit(resp)
	for i, v := range multi {
		results[i].Name = v.Name
		results[i].Gender = genderToEnum(v.Gender)
		results[i].Probability = v.Probability
		results[i].Count = v.Count
		results[i].RateLimit = ratelimit
	}
	return results, nil
}

// getRateLimit parses http headers into a XRateHeaders struct and returns it
func getRateLimit(resp *http.Response) XRateHeaders {
	limit, err := strconv.Atoi(resp.Header.Get("X-Rate-Limit-Limit"))
	if err != nil {
		limit = -1
	}
	remain, err := strconv.Atoi(resp.Header.Get("X-Rate-Limit-Remaining"))
	if err != nil {
		remain = -1
	}
	reset, err := strconv.Atoi(resp.Header.Get("X-Rate-Reset"))
	if err != nil {
		reset = -1
	}
	return XRateHeaders{
		Limit:     limit,
		Remaining: remain,
		Reset:     reset,
	}
}

// insertConfig checks if our config struct is valid and inserts it's options to the url string
func insertConfig(url string, config Config) (string, error) {
	if config.Country == "" && config.Lang == "" {
		err := errors.New("At least country or language must be set, if you don't need these, use just Single()")
		return url, err
	}
	if config.Country != "" {
		url += fmt.Sprintf("&country_id=%s", config.Country)
	}
	if config.Lang != "" {
		url += fmt.Sprintf("&language_id=%s", config.Lang)
	}
	return url, nil
}

// Helper for a simple http get request
func request(url string) (*http.Response, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	switch resp.StatusCode {
	case 400:
		return nil, errors.New("'Bad request' received from server")
	case 429:
		return nil, errors.New("'Too Many Requests' received from server")
	case 500:
		return nil, errors.New("'Internal Server Error' received from server")
	}
	return resp, nil
}

// Converts male or female to the GenderType
func genderToEnum(gender string) GenderType {
	switch gender {
	case "male":
		return 1
	case "female":
		return 2
	default:
		return 0
	}
}
