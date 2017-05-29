// code examples for godoc

package toml

import (
	"fmt"
)

func Example_comprehensiveExample() {
	config, err := LoadFile("config.toml")

	if err != nil {
		fmt.Println("Error ", err.Error())
	} else {
		// retrieve data directly
		user := config.Get("postgres.user").(string)
		password := config.Get("postgres.password").(string)

		// or using an intermediate object
		configTree := config.Get("postgres").(*Tree)
		user = configTree.Get("user").(string)
		password = configTree.Get("password").(string)
		fmt.Println("User is ", user, ". Password is ", password)

		// show where elements are in the file
		fmt.Printf("User position: %v\n", configTree.GetPosition("user"))
		fmt.Printf("Password position: %v\n", configTree.GetPosition("password"))
	}
}
