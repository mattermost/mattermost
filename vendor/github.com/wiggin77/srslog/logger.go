package srslog

import (
	"io/ioutil"
	"log"
)

var Logger log.Logger

func init() {
	Logger = log.Logger{}
	Logger.SetOutput(ioutil.Discard)
}
