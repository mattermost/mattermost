// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Smugup uploads a collection of photos to SmugMug.
//
// Run 'smugup -help' for details.
package main

import (
	"crypto/md5"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"

	"github.com/mattermost/rsc/keychain"
	"github.com/mattermost/rsc/smugmug"
)

const apiKey = "8qH4UgiunBKpsYpvcBXftbCYNEreAZ0m"

var usageMessage = `usage: smugup [options] 'album title' [photo.jpg ...]

Smugup creates a new album with the given title if one does not already exist.
Then uploads the list of images to the album.  If a particular image 
already exists in the album, the JPG replaces the album image if the
contents differ.

Smugup fetches the SmugMug user name and password from the
user's keychain.

By default, new albums are created as private as possible: not public,
not world searchable, and not SmugMug-searchable.

Smugup prints the URL for the album when finished.

The options are:

    -u user
        SmugMug user account name (email address).
        This is not typically needed, as the user name found in the keychain will be used.
`

var smugUser = flag.String("u", "", "SmugMug user name")

func usage() {
	fmt.Fprint(os.Stderr, usageMessage)
	os.Exit(2)
}

func main() {
	flag.Usage = usage
	flag.Parse()
	log.SetFlags(0)

	args := flag.Args()
	if len(args) < 1 {
		usage()
	}
	title, files := args[0], args[1:]

	user, passwd, err := keychain.UserPasswd("smugmug.com", *smugUser)
	if err != nil {
		log.Fatal(err)
	}

	smug, err := smugmug.Login(user, passwd, apiKey)
	if err != nil {
		log.Fatal(err)
	}

	albums, err := smug.Albums(smug.NickName)
	if err != nil {
		log.Fatal(err)
	}

	var a *smugmug.Album
	for _, a = range albums {
		if a.Title == title {
			goto HaveAlbum
		}
	}

	a, err = smug.CreateAlbum(title)
	if err != nil {
		log.Fatal(err)
	}

HaveAlbum:
	imageFiles := map[string]*smugmug.ImageInfo{}
	if len(files) > 0 {
		images, err := smug.Images(a)
		if err != nil {
			log.Fatal(err)
		}

		n := 0
		c := make(chan *smugmug.ImageInfo)
		rate := make(chan bool, 4)
		for _, image := range images {
			go func(image *smugmug.Image) {
				rate <- true
				info, err := smug.ImageInfo(image)
				<-rate
				if err != nil {
					log.Print(err)
					c <- nil
					return
				}
				c <- info
			}(image)
			n++
		}

		for i := 0; i < n; i++ {
			info := <-c
			if info == nil {
				continue
			}
			imageFiles[info.FileName] = info
		}
	}

	for _, file := range files {
		data, err := ioutil.ReadFile(file)
		if err != nil {
			log.Print(err)
			continue
		}
		_, elem := filepath.Split(file)
		info := imageFiles[elem]
		if info != nil {
			h := md5.New()
			h.Write(data)
			digest := fmt.Sprintf("%x", h.Sum(nil))
			if digest == info.MD5Sum {
				// Already have that image.
				continue
			}
			_, err = smug.ReplaceImage(file, data, &smugmug.Image{ID: info.ID})
		} else {
			_, err = smug.AddImage(file, data, a)
		}
		if err != nil {
			log.Print(err)
		}
	}

	info, err := smug.AlbumInfo(a)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("%s\n", info.URL)
}
