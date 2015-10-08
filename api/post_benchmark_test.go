// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/utils"
	"testing"
)

const (
	NUM_POSTS = 100
)

func BenchmarkCreatePost(b *testing.B) {
	var (
		NUM_POSTS_RANGE = utils.Range{NUM_POSTS, NUM_POSTS}
	)
	_, _, channel := SetupBenchmark()

	testPoster := NewAutoPostCreator(Client, channel.Id)

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		testPoster.CreateTestPosts(NUM_POSTS_RANGE)
	}
}

func BenchmarkUpdatePost(b *testing.B) {
	var (
		NUM_POSTS_RANGE = utils.Range{NUM_POSTS, NUM_POSTS}
		UPDATE_POST_LEN = 100
	)
	_, _, channel := SetupBenchmark()

	testPoster := NewAutoPostCreator(Client, channel.Id)
	posts, valid := testPoster.CreateTestPosts(NUM_POSTS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test posts")
	}

	for i := range posts {
		posts[i].Message = utils.RandString(UPDATE_POST_LEN, utils.ALPHANUMERIC)
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for i := range posts {
			if _, err := Client.UpdatePost(posts[i]); err != nil {
				b.Fatal(err)
			}
		}
	}
}

func BenchmarkGetPosts(b *testing.B) {
	var (
		NUM_POSTS_RANGE = utils.Range{NUM_POSTS, NUM_POSTS}
	)
	_, _, channel := SetupBenchmark()

	testPoster := NewAutoPostCreator(Client, channel.Id)
	testPoster.CreateTestPosts(NUM_POSTS_RANGE)

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Client.Must(Client.GetPosts(channel.Id, 0, NUM_POSTS, ""))
	}
}

func BenchmarkSearchPosts(b *testing.B) {
	var (
		NUM_POSTS_RANGE = utils.Range{NUM_POSTS, NUM_POSTS}
	)
	_, _, channel := SetupBenchmark()

	testPoster := NewAutoPostCreator(Client, channel.Id)
	testPoster.CreateTestPosts(NUM_POSTS_RANGE)

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Client.Must(Client.SearchPosts("nothere"))
		Client.Must(Client.SearchPosts("n"))
		Client.Must(Client.SearchPosts("#tag"))
	}
}

func BenchmarkEtagCache(b *testing.B) {
	var (
		NUM_POSTS_RANGE = utils.Range{NUM_POSTS, NUM_POSTS}
	)
	_, _, channel := SetupBenchmark()

	testPoster := NewAutoPostCreator(Client, channel.Id)
	testPoster.CreateTestPosts(NUM_POSTS_RANGE)

	etag := Client.Must(Client.GetPosts(channel.Id, 0, NUM_POSTS/2, "")).Etag

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Client.Must(Client.GetPosts(channel.Id, 0, NUM_POSTS/2, etag))
	}
}

func BenchmarkDeletePosts(b *testing.B) {
	var (
		NUM_POSTS_RANGE = utils.Range{NUM_POSTS, NUM_POSTS}
	)
	_, _, channel := SetupBenchmark()

	testPoster := NewAutoPostCreator(Client, channel.Id)
	posts, valid := testPoster.CreateTestPosts(NUM_POSTS_RANGE)
	if valid == false {
		b.Fatal("Unable to create test posts")
	}

	// Benchmark Start
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for i := range posts {
			Client.Must(Client.DeletePost(channel.Id, posts[i].Id))
		}
	}

}
