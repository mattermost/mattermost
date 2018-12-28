// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"image"
	"image/gif"
	"image/jpeg"
	"io"
	"io/ioutil"
	"math/rand"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

var randomJPEG []byte
var randomGIF []byte
var rgba *image.RGBA

type zeroReader struct {
	limit int
}

func (z *zeroReader) Read(b []byte) (int, error) {
	if z.limit <= 0 {
		return 0, io.EOF
	}

	n := len(b)
	if n > z.limit {
		n = z.limit
	}
	z.limit -= n
	return n, nil
}

func prepareTestImages(tb testing.TB) {
	if rgba != nil {
		return
	}

	// Create a random image (pre-seeded for predictability)
	rgba = image.NewRGBA(image.Rectangle{
		image.Point{0, 0},
		image.Point{2048, 2048},
	})
	_, err := rand.New(rand.NewSource(1)).Read(rgba.Pix)
	if err != nil {
		tb.Fatal(err)
	}

	// Encode it as JPEG and GIF
	buf := &bytes.Buffer{}
	err = jpeg.Encode(buf, rgba, &jpeg.Options{Quality: 50})
	if err != nil {
		tb.Fatal(err)
	}
	randomJPEG = buf.Bytes()

	buf = &bytes.Buffer{}
	err = gif.Encode(buf, rgba, nil)
	if err != nil {
		tb.Fatal(err)
	}
	randomGIF = buf.Bytes()
}

func BenchmarkUploadFile(b *testing.B) {
	prepareTestImages(b)
	th := Setup().InitBasic()
	defer th.TearDown()
	// disable logging in the benchmark, as best we can
	th.App.Log.SetConsoleLevel(mlog.LevelError)
	teamId := model.NewId()
	channelId := model.NewId()
	userId := model.NewId()

	mb := func(i int) int {
		return (i + 512*1024) / (1024 * 1024)
	}

	// Set 1Gb upload size limit, test up to that
	const maxsize = 1 * 1024 * 1024 * 1024
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.MaxFileSize = maxsize })

	files := []struct {
		title  string
		ext    string
		length int64
		in     func() io.Reader
	}{
		{
			title:  fmt.Sprintf("random-%dMb-gif", mb(len(randomGIF))),
			ext:    ".gif",
			length: int64(len(randomGIF)),
			in: func() io.Reader {
				return bytes.NewReader(randomGIF)
			},
		},
		{
			title:  fmt.Sprintf("random-%dMb-jpg", mb(len(randomJPEG))),
			ext:    ".jpg",
			length: int64(len(randomJPEG)),
			in: func() io.Reader {
				return bytes.NewReader(randomJPEG)
			},
		},
		{
			title:  fmt.Sprintf("zero-%dMb", mb(maxsize-1)),
			ext:    ".zero",
			length: maxsize - 1,
			in: func() io.Reader {
				return &zeroReader{limit: maxsize - 1}
			},
		},
	}

	file_benchmarks := []struct {
		title string
		f     func(b *testing.B, n int, in io.Reader, length int64, ext string)
	}{
		{
			title: "DoUploadFile raw",
			f: func(b *testing.B, n int, in io.Reader, length int64, ext string) {
				data, _ := ioutil.ReadAll(in)
				info1, err := th.App.DoUploadFile(time.Now(), teamId, channelId,
					userId, fmt.Sprintf("BenchmarkDoUploadFile-%d%s", n, ext), data)
				if err != nil {
					b.Fatal(err)
				}
				<-th.App.Srv.Store.FileInfo().PermanentDelete(info1.Id)
				th.App.RemoveFile(info1.Path)

			},
		},
		{
			title: "UploadFileX raw chunked",
			f: func(b *testing.B, n int, in io.Reader, length int64, ext string) {
				info, aerr := th.App.UploadFileX(channelId,
					fmt.Sprintf("BenchmarkUploadFileTask-%d%s", n, ext),
					in,
					UploadFileSetTeamId(teamId),
					UploadFileSetUserId(userId),
					UploadFileSetTimestamp(time.Now()),
					UploadFileSetContentLength(-1),
					UploadFileSetRaw())
				if aerr != nil {
					b.Fatal(aerr)
				}
				<-th.App.Srv.Store.FileInfo().PermanentDelete(info.Id)
				th.App.RemoveFile(info.Path)
			},
		},
		{
			title: "UploadFiles",
			f: func(b *testing.B, n int, in io.Reader, length int64, ext string) {
				resp, err := th.App.UploadFiles(teamId, channelId, userId,
					[]io.ReadCloser{ioutil.NopCloser(in)},
					[]string{fmt.Sprintf("BenchmarkDoUploadFiles-%d%s", n, ext)},
					[]string{},
					time.Now())
				if err != nil {
					b.Fatal(err)
				}
				<-th.App.Srv.Store.FileInfo().PermanentDelete(resp.FileInfos[0].Id)
				th.App.RemoveFile(resp.FileInfos[0].Path)
			},
		},
		{
			title: "UploadFileX chunked",
			f: func(b *testing.B, n int, in io.Reader, length int64, ext string) {
				info, aerr := th.App.UploadFileX(channelId,
					fmt.Sprintf("BenchmarkUploadFileTask-%d%s", n, ext),
					in,
					UploadFileSetTeamId(teamId),
					UploadFileSetUserId(userId),
					UploadFileSetTimestamp(time.Now()),
					UploadFileSetContentLength(-1))
				if aerr != nil {
					b.Fatal(aerr)
				}
				<-th.App.Srv.Store.FileInfo().PermanentDelete(info.Id)
				th.App.RemoveFile(info.Path)
			},
		},
	}

	for _, file := range files {
		for _, fb := range file_benchmarks {
			b.Run(file.title+"-"+fb.title, func(b *testing.B) {
				for i := 0; i < b.N; i++ {
					fb.f(b, i, file.in(), file.length, file.ext)
				}
			})
		}
	}
}
