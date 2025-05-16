// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package validation

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateBrandImageGet(t *testing.T) {
	tests := []struct {
		name          string
		clientVersion string
		clientHash    string
		wantErr       bool
	}{
		{
			name:          "Valid request",
			clientVersion: "5.0.0",
			clientHash:    "abc123",
			wantErr:       false,
		},
		{
			name:          "Missing client version",
			clientVersion: "",
			clientHash:    "abc123",
			wantErr:       true,
		},
		{
			name:          "Missing client hash",
			clientVersion: "5.0.0",
			clientHash:    "",
			wantErr:       true,
		},
		{
			name:          "Missing both parameters",
			clientVersion: "",
			clientHash:    "",
			wantErr:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u, _ := url.Parse("http://localhost")
			q := u.Query()
			q.Set("client_version", tt.clientVersion)
			q.Set("client_hash", tt.clientHash)
			u.RawQuery = q.Encode()

			r := &http.Request{
				URL: u,
			}

			err := ValidateBrandImageGet(r)
			if tt.wantErr {
				assert.NotNil(t, err)
				assert.Equal(t, http.StatusBadRequest, err.StatusCode)
			} else {
				assert.Nil(t, err)
			}
		})
	}
}

func TestValidateBrandImageUpload(t *testing.T) {
	tests := []struct {
		name          string
		clientVersion string
		clientHash    string
		maxFileSize   int64
		contentLength int64
		hasImage      bool
		wantErr       bool
	}{
		{
			name:          "Valid request",
			clientVersion: "5.0.0",
			clientHash:    "abc123",
			maxFileSize:   1024 * 1024, // 1MB
			contentLength: 512 * 1024,  // 512KB
			hasImage:      true,
			wantErr:       false,
		},
		{
			name:          "Missing client version",
			clientVersion: "",
			clientHash:    "abc123",
			maxFileSize:   1024 * 1024,
			contentLength: 512 * 1024,
			hasImage:      true,
			wantErr:       true,
		},
		{
			name:          "Missing client hash",
			clientVersion: "5.0.0",
			clientHash:    "",
			maxFileSize:   1024 * 1024,
			contentLength: 512 * 1024,
			hasImage:      true,
			wantErr:       true,
		},
		{
			name:          "File too large",
			clientVersion: "5.0.0",
			clientHash:    "abc123",
			maxFileSize:   1024 * 1024,
			contentLength: 2 * 1024 * 1024, // 2MB
			hasImage:      true,
			wantErr:       true,
		},
		{
			name:          "No image file",
			clientVersion: "5.0.0",
			clientHash:    "abc123",
			maxFileSize:   1024 * 1024,
			contentLength: 512 * 1024,
			hasImage:      false,
			wantErr:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a multipart form
			body := &bytes.Buffer{}
			writer := multipart.NewWriter(body)

			// Add query parameters
			u, _ := url.Parse("http://localhost")
			q := u.Query()
			q.Set("client_version", tt.clientVersion)
			q.Set("client_hash", tt.clientHash)
			u.RawQuery = q.Encode()

			// Add image file if needed
			if tt.hasImage {
				part, err := writer.CreateFormFile("image", "test.png")
				assert.NoError(t, err)
				_, err = io.WriteString(part, "test image content")
				assert.NoError(t, err)
			}

			writer.Close()

			r := &http.Request{
				URL:           u,
				Body:          io.NopCloser(body),
				ContentLength: tt.contentLength,
				Header:        make(http.Header),
			}
			r.Header.Set("Content-Type", writer.FormDataContentType())

			err := ValidateBrandImageUpload(r, tt.maxFileSize)
			if tt.wantErr {
				assert.NotNil(t, err)
				if tt.contentLength > tt.maxFileSize {
					assert.Equal(t, http.StatusRequestEntityTooLarge, err.StatusCode)
				} else {
					assert.Equal(t, http.StatusBadRequest, err.StatusCode)
				}
			} else {
				assert.Nil(t, err)
			}
		})
	}
}
