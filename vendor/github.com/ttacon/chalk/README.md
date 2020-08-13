chalk
=============

Chalk is a go package for styling console/terminal output.

Check out godoc for some example usage:
http://godoc.org/github.com/ttacon/chalk

The api is pretty clean, there are default Colors and TextStyles
which can be mixed to create more intense Styles. Styles and Colors
can be printed in normal strings (i.e. ```fmt.Sprintf(chalk.Red)```), but
Styles, Colors and TextStyles are more meant to be used to style specific
text segments (i.e. ```fmt.Println(chalk.Red.Color("this is red")```) or
```fmt.Println(myStyle.Style("this is blue text that is underlined"))```).

Examples
=============

There are a few examples in the examples directory if you want to see a very
simplified version of what you can do with chalk.

The following code:
```go
package main

import (
	"fmt"

	"github.com/ttacon/chalk"
)

func main() {
	// You can just use colors
	fmt.Println(chalk.Red, "Writing in colors", chalk.Cyan, "is so much fun", chalk.Reset)
	fmt.Println(chalk.Magenta.Color("You can use colors to color specific phrases"))

	// You can just use text styles
	fmt.Println(chalk.Bold.TextStyle("We can have bold text"))
	fmt.Println(chalk.Underline.TextStyle("We can have underlined text"))
	fmt.Println(chalk.Bold, "But text styles don't work quite like colors :(")

	// Or you can use styles
	blueOnWhite := chalk.Blue.NewStyle().WithBackground(chalk.White)
	fmt.Printf("%s%s%s\n", blueOnWhite, "And they also have backgrounds!", chalk.Reset)
	fmt.Println(
		blueOnWhite.Style("You can style strings the same way you can color them!"))
	fmt.Println(
		blueOnWhite.WithTextStyle(chalk.Bold).
			Style("You can mix text styles with colors, too!"))

	// You can also easily make styling functions thanks to go's functional side
	lime := chalk.Green.NewStyle().
		WithBackground(chalk.Black).
		WithTextStyle(chalk.Bold).
		Style
	fmt.Println(lime("look at this cool lime text!"))
}

```
Outputs
![screenshot](https://raw.githubusercontent.com/ttacon/chalk/master/img/chalk_example.png)


WARNING
=============

This package should be pretty stable (I don't forsee backwards incompatible changes), but I'm not making any promises :)
