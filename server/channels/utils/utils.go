// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

func Contains[T comparable](slice []T, item T) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// RemoveStringFromSlice removes the first occurrence of a from slice.
func RemoveStringFromSlice(a string, slice []string) []string {
	for i, str := range slice {
		if str == a {
			return append(slice[:i], slice[i+1:]...)
		}
	}
	return slice
}

// RemoveStringsFromSlice removes all occurrences of strings from slice.
func RemoveStringsFromSlice(slice []string, strings ...string) []string {
	newSlice := []string{}

	for _, item := range slice {
		if !Contains(strings, item) {
			newSlice = append(newSlice, item)
		}
	}

	return newSlice
}

func StringArrayIntersection(arr1, arr2 []string) []string {
	arrMap := map[string]bool{}
	result := []string{}

	for _, value := range arr1 {
		arrMap[value] = true
	}

	for _, value := range arr2 {
		if arrMap[value] {
			result = append(result, value)
		}
	}

	return result
}

func RemoveDuplicatesFromStringArray(arr []string) []string {
	result := make([]string, 0, len(arr))
	seen := make(map[string]bool)

	for _, item := range arr {
		if !seen[item] {
			result = append(result, item)
			seen[item] = true
		}
	}

	return result
}

func StringSliceDiff(a, b []string) []string {
	m := make(map[string]bool)
	result := []string{}

	for _, item := range b {
		m[item] = true
	}

	for _, item := range a {
		if !m[item] {
			result = append(result, item)
		}
	}
	return result
}

func GetIPAddress(r *http.Request, trustedProxyIPHeader []string) string {
	address := ""

	for _, proxyHeader := range trustedProxyIPHeader {
		header := r.Header.Get(proxyHeader)
		if header != "" {
			addresses := strings.Split(header, ",")
			if len(addresses) > 0 {
				address = strings.TrimSpace(addresses[0])
			}
		}

		if address != "" && net.ParseIP(address) != nil {
			return address
		}

	}

	host, _, _ := net.SplitHostPort(r.RemoteAddr)

	return host
}

func GetHostnameFromSiteURL(siteURL string) string {
	u, err := url.Parse(siteURL)
	if err != nil {
		return ""
	}

	return u.Hostname()
}

type RequestCache struct {
	Data []byte
	Date string
	Key  string
}

// Fetch JSON data from the notices server
// if skip is passed, does a fetch without touching the cache
func GetURLWithCache(url string, cache *RequestCache, skip bool) ([]byte, error) {
	// Build a GET Request, including optional If-None-Match header.
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		cache.Data = nil
		return nil, err
	}
	if !skip && cache.Data != nil {
		req.Header.Add("If-None-Match", cache.Key)
		req.Header.Add("If-Modified-Since", cache.Date)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		cache.Data = nil
		return nil, err
	}
	defer resp.Body.Close()
	// No change from latest known Etag?
	if resp.StatusCode == http.StatusNotModified {
		return cache.Data, nil
	}

	if resp.StatusCode != 200 {
		cache.Data = nil
		return nil, errors.Errorf("Fetching notices failed with status code %d", resp.StatusCode)
	}

	cache.Data, err = io.ReadAll(resp.Body)
	if err != nil {
		cache.Data = nil
		return nil, err
	}

	// If etags headers are missing, ignore.
	cache.Key = resp.Header.Get("ETag")
	cache.Date = resp.Header.Get("Date")
	return cache.Data, err
}

// Append tokens to passed baseURL as query params
func AppendQueryParamsToURL(baseURL string, params map[string]string) string {
	u, err := url.Parse(baseURL)
	if err != nil {
		return ""
	}
	q, err := url.ParseQuery(u.RawQuery)
	if err != nil {
		return ""
	}
	for key, value := range params {
		q.Add(key, value)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// Validates RedirectURL passed during OAuth or SAML
func IsValidWebAuthRedirectURL(config *model.Config, redirectURL string) bool {
	u, err := url.Parse(redirectURL)
	if err == nil && (u.Scheme == "http" || u.Scheme == "https") {
		if config.ServiceSettings.SiteURL != nil {
			siteURL := *config.ServiceSettings.SiteURL
			return strings.Index(strings.ToLower(redirectURL), strings.ToLower(siteURL)) == 0
		}
		return false
	}
	return true
}

// Validates Mobile Custom URL Scheme passed during OAuth or SAML
func IsValidMobileAuthRedirectURL(config *model.Config, redirectURL string) bool {
	for _, URLScheme := range config.NativeAppSettings.AppCustomURLSchemes {
		if strings.Index(strings.ToLower(redirectURL), strings.ToLower(URLScheme)) == 0 {
			return true
		}
	}
	return false
}

// RoundOffToZeroes converts all digits to 0 except the 1st one.
// Special case: If there is only 1 digit, then returns 0.
func RoundOffToZeroes(n float64) int64 {
	if n >= -9 && n <= 9 {
		return 0
	}

	zeroes := int(math.Log10(math.Abs(n)))
	tens := int64(math.Pow10(zeroes))
	firstDigit := int64(n) / tens
	return firstDigit * tens
}

func MinInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
func MaxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// RoundOffToZeroesResolution truncates off at most minResolution zero places.
// It implicitly sets the lowest minResolution to 0.
// e.g. 0 reports 1s, 1 reports 10s, 2 reports 100s, 3 reports 1000s
func RoundOffToZeroesResolution(n float64, minResolution int) int64 {
	resolution := MaxInt(0, minResolution)
	if n >= -9 && n <= 9 {
		if resolution == 0 {
			return int64(n)
		}
		return 0
	}

	zeroes := int(math.Log10(math.Abs(n)))
	resolution = MinInt(zeroes, resolution)
	tens := int64(math.Pow10(resolution))
	significantDigits := int64(n) / tens
	return significantDigits * tens
}
