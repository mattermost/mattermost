package auth

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPasswordHash(t *testing.T) {
	hash := HashPassword("Test")

	assert.True(t, ComparePassword(hash, "Test"), "Passwords don't match")
	assert.False(t, ComparePassword(hash, "Test2"), "Passwords should not have matched")
}

func TestIsPasswordValidWithSettings(t *testing.T) {
	for name, tc := range map[string]struct {
		Password                 string
		Settings                 PasswordSettings
		ExpectedFailingCriterias []string
	}{
		"Short": {
			Password: strings.Repeat("x", 3),
			Settings: PasswordSettings{
				MinimumLength: 3,
				Lowercase:     false,
				Uppercase:     false,
				Number:        false,
				Symbol:        false,
			},
		},
		"Long": {
			Password: strings.Repeat("x", PasswordMaximumLength),
			Settings: PasswordSettings{
				MinimumLength: 3,
				Lowercase:     false,
				Uppercase:     false,
				Number:        false,
				Symbol:        false,
			},
		},
		"TooShort": {
			Password: strings.Repeat("x", 2),
			Settings: PasswordSettings{
				MinimumLength: 3,
				Lowercase:     false,
				Uppercase:     false,
				Number:        false,
				Symbol:        false,
			},
			ExpectedFailingCriterias: []string{"min-length"},
		},
		"TooLong": {
			Password: strings.Repeat("x", PasswordMaximumLength+1),
			Settings: PasswordSettings{
				MinimumLength: 3,
				Lowercase:     false,
				Uppercase:     false,
				Number:        false,
				Symbol:        false,
			},
			ExpectedFailingCriterias: []string{"max-length"},
		},
		"MissingLower": {
			Password: "AAAAAAAAAAASD123!@#",
			Settings: PasswordSettings{
				MinimumLength: 3,
				Lowercase:     true,
				Uppercase:     false,
				Number:        false,
				Symbol:        false,
			},
			ExpectedFailingCriterias: []string{"lowercase"},
		},
		"MissingUpper": {
			Password: "aaaaaaaaaaaaasd123!@#",
			Settings: PasswordSettings{
				MinimumLength: 3,
				Uppercase:     true,
				Lowercase:     false,
				Number:        false,
				Symbol:        false,
			},
			ExpectedFailingCriterias: []string{"uppercase"},
		},
		"MissingNumber": {
			Password: "asasdasdsadASD!@#",
			Settings: PasswordSettings{
				MinimumLength: 3,
				Number:        true,
				Lowercase:     false,
				Uppercase:     false,
				Symbol:        false,
			},
			ExpectedFailingCriterias: []string{"number"},
		},
		"MissingSymbol": {
			Password: "asdasdasdasdasdASD123",
			Settings: PasswordSettings{
				MinimumLength: 3,
				Symbol:        true,
				Lowercase:     false,
				Uppercase:     false,
				Number:        false,
			},
			ExpectedFailingCriterias: []string{"symbol"},
		},
		"MissingMultiple": {
			Password: "asdasdasdasdasdasd",
			Settings: PasswordSettings{
				MinimumLength: 3,
				Lowercase:     true,
				Uppercase:     true,
				Number:        true,
				Symbol:        true,
			},
			ExpectedFailingCriterias: []string{"uppercase", "number", "symbol"},
		},
		"Everything": {
			Password: "asdASD!@#123",
			Settings: PasswordSettings{
				MinimumLength: 3,
				Lowercase:     true,
				Uppercase:     true,
				Number:        true,
				Symbol:        true,
			},
		},
	} {
		t.Run(name, func(t *testing.T) {
			err := IsPasswordValid(tc.Password, tc.Settings)
			if len(tc.ExpectedFailingCriterias) == 0 {
				assert.NoError(t, err)
			} else {
				require.Error(t, err)
				var errFC *InvalidPasswordError
				if assert.ErrorAs(t, err, &errFC) {
					assert.Equal(t, tc.ExpectedFailingCriterias, errFC.FailingCriterias)
				}
			}
		})
	}
}
