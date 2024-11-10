// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeneratePassword(t *testing.T) {
	t.Run("Should be the minimum length or 4, whichever is less", func(t *testing.T) {
		password1, err := generatePassword(5)
		require.NoError(t, err)
		assert.Len(t, password1, 5)
		password2, err := generatePassword(10)
		require.NoError(t, err)
		assert.Len(t, password2, 10)
		password3, err := generatePassword(1)
		require.NoError(t, err)
		assert.Len(t, password3, 4)
	})

	t.Run("Should contain at least one of symbols, upper case, lower case and numbers", func(t *testing.T) {
		password, err := generatePassword(4)
		require.NoError(t, err)
		require.Len(t, password, 4)
		assert.Contains(t, []rune(passwordUpperCaseLetters), []rune(password)[0])
		assert.Contains(t, []rune(passwordNumbers), []rune(password)[1])
		assert.Contains(t, []rune(passwordLowerCaseLetters), []rune(password)[2])
		assert.Contains(t, []rune(passwordSpecialChars), []rune(password)[3])
	})

	t.Run("Should not fail on concurrent calls", func(t *testing.T) {
		for i := 0; i < 10; i++ {
			go func() {
				_, err := generatePassword(10)
				require.NoError(t, err)
			}()
		}
	})
}
