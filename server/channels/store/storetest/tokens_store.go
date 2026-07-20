// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestTokensStore(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("TokensCleanup", func(t *testing.T) { testTokensCleanup(t, rctx, ss) })
	t.Run("ConsumeOnce", func(t *testing.T) { testConsumeOnce(t, rctx, ss) })
}

func testTokensCleanup(t *testing.T, rctx request.CTX, ss store.Store) {
	now := model.GetMillis()

	for i := range 10 {
		err := ss.Token().Save(&model.Token{
			Token:    model.NewRandomString(model.TokenSize),
			CreateAt: now - int64(i),
			Type:     model.TokenTypeOAuth,
			Extra:    "",
		})
		require.NoError(t, err)
	}

	tokens, err := ss.Token().GetAllTokensByType(model.TokenTypeOAuth)
	require.NoError(t, err)
	assert.Len(t, tokens, 10)

	ss.Token().Cleanup(now + int64(1))

	tokens, err = ss.Token().GetAllTokensByType(model.TokenTypeOAuth)
	require.NoError(t, err)
	assert.Len(t, tokens, 0)
}

func testConsumeOnce(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("successfully consume token once", func(t *testing.T) {
		token := &model.Token{
			Token:    model.NewRandomString(model.TokenSize),
			CreateAt: model.GetMillis(),
			Type:     model.TokenTypeOAuth,
			Extra:    "test-extra",
		}
		err := ss.Token().Save(token)
		require.NoError(t, err)

		consumedToken, err := ss.Token().ConsumeOnce(model.TokenTypeOAuth, token.Token)
		require.NoError(t, err)
		assert.Equal(t, token.Token, consumedToken.Token)
		assert.Equal(t, token.Type, consumedToken.Type)
		assert.Equal(t, token.Extra, consumedToken.Extra)

		tokens, err := ss.Token().GetAllTokensByType(model.TokenTypeOAuth)
		require.NoError(t, err)
		assert.Len(t, tokens, 0)
	})

	t.Run("second consumption of same token fails", func(t *testing.T) {
		token := &model.Token{
			Token:    model.NewRandomString(model.TokenSize),
			CreateAt: model.GetMillis(),
			Type:     model.TokenTypeOAuth,
			Extra:    "test-extra",
		}
		err := ss.Token().Save(token)
		require.NoError(t, err)

		_, err = ss.Token().ConsumeOnce(model.TokenTypeOAuth, token.Token)
		require.NoError(t, err)

		_, err = ss.Token().ConsumeOnce(model.TokenTypeOAuth, token.Token)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})

	t.Run("consume with wrong type fails", func(t *testing.T) {
		token := &model.Token{
			Token:    model.NewRandomString(model.TokenSize),
			CreateAt: model.GetMillis(),
			Type:     model.TokenTypeOAuth,
			Extra:    "test-extra",
		}
		err := ss.Token().Save(token)
		require.NoError(t, err)

		_, err = ss.Token().ConsumeOnce(model.TokenTypeSSOCodeExchange, token.Token)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)

		tokens, err := ss.Token().GetAllTokensByType(model.TokenTypeOAuth)
		require.NoError(t, err)
		assert.Len(t, tokens, 1)

		err = ss.Token().Delete(token.Token)
		require.NoError(t, err)
	})

	t.Run("consume non-existent token fails", func(t *testing.T) {
		nonExistentToken := model.NewRandomString(model.TokenSize)
		_, err := ss.Token().ConsumeOnce(model.TokenTypeOAuth, nonExistentToken)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		assert.ErrorAs(t, err, &nfErr)
	})

	t.Run("multiple tokens with same type can each be consumed once", func(t *testing.T) {
		tokens := make([]*model.Token, 3)
		for i := range tokens {
			tokens[i] = &model.Token{
				Token:    model.NewRandomString(model.TokenSize),
				CreateAt: model.GetMillis(),
				Type:     model.TokenTypeOAuth,
				Extra:    "test-extra",
			}
			err := ss.Token().Save(tokens[i])
			require.NoError(t, err)
		}

		for _, token := range tokens {
			consumedToken, err := ss.Token().ConsumeOnce(model.TokenTypeOAuth, token.Token)
			require.NoError(t, err)
			assert.Equal(t, token.Token, consumedToken.Token)
		}

		allTokens, err := ss.Token().GetAllTokensByType(model.TokenTypeOAuth)
		require.NoError(t, err)
		assert.Len(t, allTokens, 0)
	})

	t.Run("consuming token of different type leaves others intact", func(t *testing.T) {
		oauthToken := &model.Token{
			Token:    model.NewRandomString(model.TokenSize),
			CreateAt: model.GetMillis(),
			Type:     model.TokenTypeOAuth,
			Extra:    "oauth-extra",
		}
		codeExchangeToken := &model.Token{
			Token:    model.NewRandomString(model.TokenSize),
			CreateAt: model.GetMillis(),
			Type:     model.TokenTypeSSOCodeExchange,
			Extra:    "password-extra",
		}
		err := ss.Token().Save(oauthToken)
		require.NoError(t, err)
		err = ss.Token().Save(codeExchangeToken)
		require.NoError(t, err)

		consumedToken, err := ss.Token().ConsumeOnce(model.TokenTypeOAuth, oauthToken.Token)
		require.NoError(t, err)
		assert.Equal(t, oauthToken.Token, consumedToken.Token)

		codeExchangeTokens, err := ss.Token().GetAllTokensByType(model.TokenTypeSSOCodeExchange)
		require.NoError(t, err)
		assert.Len(t, codeExchangeTokens, 1)

		err = ss.Token().Delete(codeExchangeToken.Token)
		require.NoError(t, err)
	})
}
