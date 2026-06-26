// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDeliveryTrackingSettingsSetDefaults(t *testing.T) {
	t.Run("zero value gets safe defaults", func(t *testing.T) {
		s := DeliveryTrackingSettings{}
		s.SetDefaults()

		require.False(t, *s.Enable)
		require.Equal(t, DatabaseDriverPostgres, *s.DriverName)
		require.Empty(t, *s.DataSource) // defaults to empty → primary-DB fallback
		require.NotNil(t, s.DataSourceReplicas)
		require.NotNil(t, s.DataSourceSearchReplicas)
		require.Positive(t, *s.MaxIdleConns)
		require.Positive(t, *s.MaxOpenConns)
		require.Positive(t, *s.QueryTimeout)
	})

	t.Run("does not overwrite provided values", func(t *testing.T) {
		s := DeliveryTrackingSettings{
			Enable:     NewPointer(true),
			DataSource: NewPointer("postgres://custom"),
		}
		s.SetDefaults()
		require.True(t, *s.Enable)
		require.Equal(t, "postgres://custom", *s.DataSource)
	})
}

func TestDeliveryTrackingSettingsIsValid(t *testing.T) {
	valid := func() *DeliveryTrackingSettings {
		s := &DeliveryTrackingSettings{Enable: NewPointer(true)}
		s.SetDefaults()
		return s
	}

	t.Run("disabled is always valid", func(t *testing.T) {
		s := &DeliveryTrackingSettings{}
		s.SetDefaults() // Enable=false
		require.Nil(t, s.isValid())
	})

	t.Run("enabled with defaults is valid", func(t *testing.T) {
		require.Nil(t, valid().isValid())
	})

	t.Run("empty data source is valid (primary-DB fallback)", func(t *testing.T) {
		s := valid()
		s.DataSource = NewPointer("")
		require.Nil(t, s.isValid())
	})

	t.Run("non-postgres driver is invalid", func(t *testing.T) {
		s := valid()
		s.DriverName = NewPointer("mysql")
		require.NotNil(t, s.isValid())
	})

	t.Run("non-positive pool sizes are invalid", func(t *testing.T) {
		s := valid()
		s.MaxIdleConns = NewPointer(0)
		require.NotNil(t, s.isValid())

		s = valid()
		s.MaxOpenConns = NewPointer(0)
		require.NotNil(t, s.isValid())

		s = valid()
		s.QueryTimeout = NewPointer(0)
		require.NotNil(t, s.isValid())
	})

	t.Run("negative connection lifetimes are invalid", func(t *testing.T) {
		s := valid()
		s.ConnMaxLifetimeMilliseconds = NewPointer(-1)
		require.NotNil(t, s.isValid())

		s = valid()
		s.ConnMaxIdleTimeMilliseconds = NewPointer(-1)
		require.NotNil(t, s.isValid())
	})
}
