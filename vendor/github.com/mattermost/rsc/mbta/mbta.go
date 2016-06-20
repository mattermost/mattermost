package main

import (
	"io/ioutil"
	"log"
	"os"

	"code.google.com/p/goprotobuf/proto"
	"github.com/mattermost/rsc/gtfs"
)

func main() {
	log.SetFlags(0)
	if len(os.Args) != 2 {
		log.Fatal("usage: mbta file.pb")
	}
	pb, err := ioutil.ReadFile(os.Args[1])
	if err != nil {
		log.Fatal(err)
	}

	var feed gtfs.FeedMessage
	if err := proto.Unmarshal(pb, &feed); err != nil {
		log.Fatal(err)
	}

	proto.MarshalText(os.Stdout, &feed)
}
