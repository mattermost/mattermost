package main

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

func main() {
	config := model.NewPointer(true)

	fmt.Printf("%+v", config)
}
