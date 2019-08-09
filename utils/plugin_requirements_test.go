// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestCheckRequiredConfig(t *testing.T) {
	config := &model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL:                    model.NewString("http://localhost"),
			EnablePostUsernameOverride: model.NewBool(true),
			EnablePostIconOverride:     model.NewBool(true),
		},
		SqlSettings: model.SqlSettings{
			DriverName: model.NewString("postgres"),
		},
	}

	t.Run("checks should pass when there are no requirements", func(t *testing.T) {
		res, err := CheckRequiredConfig(nil, config)
		assert.Nil(t, err)
		assert.True(t, res)
	})

	t.Run("checks should pass when requirements are met", func(t *testing.T) {
		requirements := &model.Config{
			ServiceSettings: model.ServiceSettings{
				EnablePostUsernameOverride: model.NewBool(true),
				EnablePostIconOverride:     model.NewBool(true),
			},
		}

		res, err := CheckRequiredConfig(requirements, config)
		assert.Nil(t, err)
		assert.True(t, res)
	})

	t.Run("checks should pass - testing a string match", func(t *testing.T) {
		requirements := &model.Config{
			SqlSettings: model.SqlSettings{
				DriverName: model.NewString("postgres"),
			},
		}

		res, err := CheckRequiredConfig(requirements, config)
		assert.Nil(t, err)
		assert.True(t, res)
	})

	t.Run("checks should fail when partial requirements are met", func(t *testing.T) {
		requirements := &model.Config{
			ServiceSettings: model.ServiceSettings{
				EnablePostUsernameOverride: model.NewBool(true),
				EnablePostIconOverride:     model.NewBool(false),
			},
		}

		res, err := CheckRequiredConfig(requirements, config)
		assert.Nil(t, err)
		assert.False(t, res)
	})

	t.Run("checks should fail - testing a string mismatch", func(t *testing.T) {
		requirements := &model.Config{
			SqlSettings: model.SqlSettings{
				DriverName: model.NewString("mysql"),
			},
		}

		res, err := CheckRequiredConfig(requirements, config)
		assert.Nil(t, err)
		assert.False(t, res)
	})
}
