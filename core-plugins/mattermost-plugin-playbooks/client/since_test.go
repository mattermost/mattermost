// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Test file for the ActivitySince parameter in PlaybookRunListOptions.
// This test validates that the client properly encodes and sends the 'since'
// parameter, and correctly handles different response scenarios.

package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSinceParameter tests the ActivitySince parameter in PlaybookRunListOptions.
// It covers four test cases:
// 1. With a past timestamp - should return runs active after that time
// 2. With a future timestamp - should return no runs
// 3. Without a since parameter - should return default results
// 4. URL encoding - verifies the parameter is properly encoded in the URL
func TestSinceParameter(t *testing.T) {
	// Common response values
	const defaultTotalCount = 2
	const defaultPageCount = 1

	// Setup server to simulate API responses
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Parse query parameters
		query := r.URL.Query()
		sinceStr := query.Get("since")

		// Create response based on since parameter
		resp := GetPlaybookRunsResults{
			TotalCount: defaultTotalCount,
			PageCount:  defaultPageCount,
			HasMore:    false,
			Items:      []PlaybookRun{},
		}

		// Parse since parameter if present
		if sinceStr != "" {
			since, err := strconv.ParseInt(sinceStr, 10, 64)
			if err != nil {
				http.Error(w, "Invalid since parameter", http.StatusBadRequest)
				return
			}

			// Create timestamps for testing
			now := time.Now().UnixMilli()

			// Add playbook runs only if the since parameter is in the past
			if since < now {
				// First run - created before since, updated after since
				run1 := PlaybookRun{
					ID:       "run1",
					Name:     "Run 1",
					CreateAt: since - 10000, // Created before since
					UpdateAt: since + 5000,  // Updated after since
				}

				// Second run - both created and updated after since
				run2 := PlaybookRun{
					ID:       "run2",
					Name:     "Run 2",
					CreateAt: since + 1000, // Created after since
					UpdateAt: since + 2000, // Updated after since
				}

				resp.Items = append(resp.Items, run1, run2)
			}
		}

		// Return JSON response
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(resp)
	}))
	defer ts.Close()

	// Create test client
	parsed, _ := url.Parse(ts.URL)
	mockClient4 := model.NewAPIv4Client(parsed.String())
	mockClient4.HTTPClient = &http.Client{}

	c, err := New(mockClient4)
	require.NoError(t, err)

	// Test 1: Get runs with since parameter in the past
	t.Run("WithSinceParameter", func(t *testing.T) {
		// Set since time to 1 hour ago
		since := time.Now().Add(-1 * time.Hour).UnixMilli()

		// Call API with since parameter
		ctx := context.Background()
		result, err := c.PlaybookRuns.List(ctx, 0, 100, PlaybookRunListOptions{
			ActivitySince: since,
		})

		// Verify results
		require.NoError(t, err)
		assert.Equal(t, defaultTotalCount, result.TotalCount, "Should return expected total count")
		assert.Len(t, result.Items, 2, "Should return 2 runs")

		// Verify first run fields - created before since but updated after
		assert.Equal(t, "run1", result.Items[0].ID)
		assert.Less(t, result.Items[0].CreateAt, since, "First run should be created before since")
		assert.Greater(t, result.Items[0].UpdateAt, since, "First run should be updated after since")

		// Verify second run fields - both created and updated after since
		assert.Equal(t, "run2", result.Items[1].ID)
		assert.Greater(t, result.Items[1].CreateAt, since, "Second run should be created after since")
		assert.Greater(t, result.Items[1].UpdateAt, since, "Second run should be updated after since")
	})

	// Test 2: Get runs with future since parameter (should return empty results)
	t.Run("WithFutureSinceParameter", func(t *testing.T) {
		// Set since time to 1 hour in the future
		since := time.Now().Add(1 * time.Hour).UnixMilli()

		// Call API with since parameter
		ctx := context.Background()
		result, err := c.PlaybookRuns.List(ctx, 0, 100, PlaybookRunListOptions{
			ActivitySince: since,
		})

		// Verify results
		require.NoError(t, err)
		assert.Equal(t, defaultTotalCount, result.TotalCount)
		assert.Len(t, result.Items, 0, "Should have no runs when using future timestamp")
	})

	// Test 3: Get runs without since parameter
	t.Run("WithoutSinceParameter", func(t *testing.T) {
		// Call API without since parameter
		ctx := context.Background()
		result, err := c.PlaybookRuns.List(ctx, 0, 100, PlaybookRunListOptions{})

		// Verify results
		require.NoError(t, err)
		assert.Equal(t, defaultTotalCount, result.TotalCount)
		assert.Len(t, result.Items, 0, "Should have no runs when since parameter is omitted")
	})

	// Test 4: Verify URL encoding of since parameter
	t.Run("URLEncoding", func(t *testing.T) {
		// Create a specific server just for URL validation
		urlCheckServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")

			// Check that the since parameter is properly included in the URL
			query := r.URL.Query()
			sinceStr := query.Get("since")

			// Validate parameter exists with expected value
			require.NotEmpty(t, sinceStr, "Since parameter should be present in URL")

			since, err := strconv.ParseInt(sinceStr, 10, 64)
			require.NoError(t, err, "Since parameter should be a valid int64")
			assert.Equal(t, int64(12345), since, "Since parameter should match the value we sent")

			// Return empty success response
			w.WriteHeader(http.StatusOK)
			empty := GetPlaybookRunsResults{
				TotalCount: 0,
				PageCount:  0,
				HasMore:    false,
				Items:      []PlaybookRun{},
			}
			json.NewEncoder(w).Encode(empty)
		}))
		defer urlCheckServer.Close()

		// Create a client pointing to our URL check server
		parsedURL, _ := url.Parse(urlCheckServer.URL)
		urlCheckClient4 := model.NewAPIv4Client(parsedURL.String())
		urlCheckClient4.HTTPClient = &http.Client{}

		urlCheckC, err := New(urlCheckClient4)
		require.NoError(t, err)

		// Make request with specific test value
		ctx := context.Background()
		_, err = urlCheckC.PlaybookRuns.List(ctx, 0, 100, PlaybookRunListOptions{
			ActivitySince: 12345,
		})
		require.NoError(t, err, "Request with since parameter should succeed")
	})
}
