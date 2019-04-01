package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/mattermost/mattermost-server/model"
)

func usage() {
	fmt.Fprintf(os.Stderr, "usage: config_generator [output_file]\n")
	flag.PrintDefaults()
	os.Exit(2)
}

func main() {
	flag.Usage = usage
	flag.Parse()

	args := flag.Args()
	if len(args) < 1 {
		fmt.Println("Input file is missing.")
		os.Exit(1)
	}
	config := &model.Config{}
	config.SetDefaults()
	if data, err := json.MarshalIndent(config, "", "  "); err != nil {
		panic(err)
	} else {
		ioutil.WriteFile(args[0], data, 0644)
	}

}
