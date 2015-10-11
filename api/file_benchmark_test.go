// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/url"
	"testing"
	"time"
)

func BenchmarkUploadFile(b *testing.B) {
	_, _, channel := SetupBenchmark()

	testPoster := NewAutoPostCreator(Client, channel.Id)

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		testPoster.UploadTestFile()
	}
}

func BenchmarkGetFile(b *testing.B) {
	team, _, channel := SetupBenchmark()

	testPoster := NewAutoPostCreator(Client, channel.Id)
	filenames, err := testPoster.UploadTestFile()
	if err == false {
		b.Fatal("Unable to upload file for benchmark")
	}

	newProps := make(map[string]string)
	newProps["filename"] = filenames[0]
	newProps["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(newProps)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.FileSettings.PublicLinkSalt))

	// wait a bit for files to ready
	time.Sleep(5 * time.Second)

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&h="+url.QueryEscape(hash)+"&t="+team.Id, true); downErr != nil {
			b.Fatal(downErr)
		}
	}
}

func BenchmarkGetPublicLink(b *testing.B) {
	_, _, channel := SetupBenchmark()

	testPoster := NewAutoPostCreator(Client, channel.Id)
	filenames, err := testPoster.UploadTestFile()
	if err == false {
		b.Fatal("Unable to upload file for benchmark")
	}

	data := make(map[string]string)
	data["filename"] = filenames[0]

	// wait a bit for files to ready
	time.Sleep(5 * time.Second)

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, downErr := Client.GetPublicLink(data); downErr != nil {
			b.Fatal(downErr)
		}
	}
}
