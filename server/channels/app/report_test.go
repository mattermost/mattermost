// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

type MockReportable struct {
	TestField1 string
	TestField2 int
	TestField3 time.Time
}

func (mr *MockReportable) ToReport() []string {
	return []string{
		mr.TestField1,
		strconv.Itoa(mr.TestField2),
		mr.TestField3.Format("2006-01-02"),
	}
}

var testData []model.ReportableObject = []model.ReportableObject{
	&MockReportable{
		TestField1: "some-name",
		TestField2: 400,
		TestField3: time.Date(2024, 1, 1, 0, 0, 0, 0, time.Local),
	},
	&MockReportable{
		TestField1: "some-other-name",
		TestField2: 500,
		TestField3: time.Date(2023, 1, 1, 0, 0, 0, 0, time.Local),
	},
	&MockReportable{
		TestField1: "some-other-other-name",
		TestField2: 600,
		TestField3: time.Date(2022, 1, 1, 0, 0, 0, 0, time.Local),
	},
}

func TestSaveReportChunk(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("should write CSV chunk to file", func(t *testing.T) {
		prefix := model.NewId()
		err := th.App.SaveReportChunk("csv", prefix, 999, []model.ReportableObject{testData[0]})
		require.Nil(t, err)

		filePath := fmt.Sprintf("admin_reports/batch_report_%s__999.csv", prefix)
		bytes, err := th.App.ReadFile(filePath)
		require.Nil(t, err)
		require.NotNil(t, bytes)
		require.Equal(t, "some-name,400,2024-01-01\n", string(bytes))
	})

	t.Run("should fail if the report format is not supported", func(t *testing.T) {
		err := th.App.SaveReportChunk("zzz", model.NewId(), 999, []model.ReportableObject{testData[0]})
		require.NotNil(t, err)
	})
}

func TestCompileReportChunks(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	prefix := model.NewId()
	err := th.App.SaveReportChunk("csv", prefix, 0, []model.ReportableObject{testData[0]})
	require.Nil(t, err)
	err = th.App.SaveReportChunk("csv", prefix, 1, []model.ReportableObject{testData[1]})
	require.Nil(t, err)
	err = th.App.SaveReportChunk("csv", prefix, 2, []model.ReportableObject{testData[2]})
	require.Nil(t, err)

	t.Run("should compile a bunch of report chunks", func(t *testing.T) {
		compileErr := th.App.CompileReportChunks("csv", prefix, 3, []string{"Name", "NumPosts", "StartDate"})
		require.Nil(t, compileErr)

		filePath := fmt.Sprintf("admin_reports/batch_report_%s.csv", prefix)
		bytes, readErr := th.App.ReadFile(filePath)
		require.Nil(t, readErr)
		require.NotNil(t, bytes)

		expected :=
			`Name,NumPosts,StartDate
some-name,400,2024-01-01
some-other-name,500,2023-01-01
some-other-other-name,600,2022-01-01
`
		require.Equal(t, expected, string(bytes))
	})

	t.Run("should fail if the report format is not supported", func(t *testing.T) {
		err = th.App.CompileReportChunks("zzz", prefix, 3, []string{"Name", "NumPosts", "StartDate"})
		require.NotNil(t, err)
	})

	t.Run("should fail if a chunk is missing", func(t *testing.T) {
		err = th.App.CompileReportChunks("csv", prefix, 4, []string{"Name", "NumPosts", "StartDate"})
		require.NotNil(t, err)
	})
}
