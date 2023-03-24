// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGraphQLPayload(t *testing.T) {
	os.Setenv("MM_FEATUREFLAGS_GRAPHQL", "true")
	defer os.Unsetenv("MM_FEATUREFLAGS_GRAPHQL")

	th := Setup(t).InitBasic()
	defer th.TearDown()

	largeString := strings.Repeat("hello", 204800)

	input := graphQLInput{
		OperationName: "config",
		Query:         largeString,
	}

	resp, err := th.MakeGraphQLRequest(&input)
	require.NoError(t, err)
	require.Len(t, resp.Errors, 1)
	// The actual error isn't exposed. We compare the string
	// to not confuse with other errors.
	require.Contains(t, resp.Errors[0].Message, "request body too large")
}
