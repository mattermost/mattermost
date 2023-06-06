// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"crypto/x509"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestCheckVersionMatch(t *testing.T) {
	testCases := []struct {
		Name          string
		Version       string
		ServerVersion string
		Expected      bool
		ErrExpected   bool
	}{
		{
			Name:          "Both versions are equal",
			Version:       "1.2.3",
			ServerVersion: "1.2.3.dev.993e5a2cb546b0116ecaae1862b6a1c6.true",
			Expected:      true,
		},
		{
			Name:          "Only patch version is different",
			Version:       "1.2.3",
			ServerVersion: "1.2.7.dev.993e5a2cb546b0116ecaae1862b6a1c6.false",
			Expected:      true,
		},
		{
			Name:          "Major version is greater",
			Version:       "1.2.3",
			ServerVersion: "7.0.0.7.0.0.8215d92df0b8458789408eb07ccfdaae.false",
			Expected:      false,
		},
		{
			Name:          "Major version is less",
			Version:       "8.2.3",
			ServerVersion: "7.0.0.7.0.0.8215d92df0b8458789408eb07ccfdaae.false",
			Expected:      false,
		},
		{
			Name:          "Minor version is greater",
			Version:       "1.2.3",
			ServerVersion: "1.3.3.1.3.3.8215d92df0b8458789408eb07ccfdaae.true",
			Expected:      true,
		},
		{
			Name:          "Minor version is less",
			Version:       "1.2.3",
			ServerVersion: "1.1.3.1.1.3.8215d92df0b8458789408eb07ccfdaae.false",
			Expected:      false,
		},
		{
			Name:          "Both versions are equal but one has v in front of it",
			Version:       "v1.2.3",
			ServerVersion: "1.2.3.dev.8215d92df0b8458789408eb07ccfdaae.false",
			Expected:      true,
		},
		{
			Name:          "unspecified version",
			Version:       "",
			ServerVersion: "1.2.3",
			Expected:      false,
			ErrExpected:   true,
		},
		{
			Name:          "bad version",
			Version:       "1.2.3",
			ServerVersion: "1.2",
			Expected:      false,
			ErrExpected:   true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			res, err := CheckVersionMatch(tc.Version, tc.ServerVersion)
			require.True(t, (err != nil) == tc.ErrExpected)
			require.Equal(t, tc.Expected, res)
		})
	}
}

func TestVerifyCertificates(t *testing.T) {
	testCases := []struct {
		Name          string
		Chains        [][]*x509.Certificate
		ExpectedError bool
	}{
		{
			Name: "One chain with a root SHA1 cert",
			Chains: [][]*x509.Certificate{
				{
					{SignatureAlgorithm: x509.SHA256WithRSA},
					{SignatureAlgorithm: x509.SHA1WithRSA},
				},
			},
			ExpectedError: false,
		},
		{
			Name: "One chain with an intermediate SHA1 cert",
			Chains: [][]*x509.Certificate{
				{
					{SignatureAlgorithm: x509.SHA256WithRSA},
					{SignatureAlgorithm: x509.SHA1WithRSA},
					{SignatureAlgorithm: x509.SHA1WithRSA},
				},
			},
			ExpectedError: true,
		},
		{
			Name: "One valid chain and other invalid",
			Chains: [][]*x509.Certificate{
				{
					{SignatureAlgorithm: x509.SHA256WithRSA},
					{SignatureAlgorithm: x509.SHA1WithRSA},
					{SignatureAlgorithm: x509.SHA1WithRSA},
				},
				{
					{SignatureAlgorithm: x509.SHA256WithRSA},
					{SignatureAlgorithm: x509.SHA256WithRSA},
					{SignatureAlgorithm: x509.SHA1WithRSA},
				},
			},
			ExpectedError: false,
		},
		{
			Name: "Two invalid chains",
			Chains: [][]*x509.Certificate{
				{
					{SignatureAlgorithm: x509.SHA256WithRSA},
					{SignatureAlgorithm: x509.SHA1WithRSA},
					{SignatureAlgorithm: x509.SHA1WithRSA},
				},
				{
					{SignatureAlgorithm: x509.SHA256WithRSA},
					{SignatureAlgorithm: x509.DSAWithSHA1},
					{SignatureAlgorithm: x509.DSAWithSHA1},
				},
			},
			ExpectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			err := VerifyCertificates([][]byte{}, tc.Chains)
			if tc.ExpectedError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestNewAPIv4Client(t *testing.T) {
	t.Run("should take http proxy into account", func(t *testing.T) {
		router := mux.NewRouter()
		router.Handle("/api/v4/users/me", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := &model.User{
				Id: model.NewId(),
			}
			err := json.NewEncoder(w).Encode(user)
			require.NoError(t, err)

			w.WriteHeader(http.StatusOK)
		}))
		s := httptest.NewServer(router)
		defer s.Close()

		proxyAddr := s.Listener.Addr().String()
		_, port, err := net.SplitHostPort(proxyAddr)
		require.NoError(t, err)

		err = os.Setenv("HTTP_PROXY", proxyAddr)
		require.NoError(t, err)
		defer os.Unsetenv("HTTP_PROXY")

		client := NewAPIv4Client("http://somethingelse:"+port, false, false)
		_, _, err = client.GetMe("")
		require.NoError(t, err)
	})
}
