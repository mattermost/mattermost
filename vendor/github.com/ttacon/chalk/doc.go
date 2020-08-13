// Package chalk is a package for styling terminal/console output.
// There are three main components:
//
//
// Colors
//
// There are eight default colors: black, red, green, yellow, blue,
// magenta, cyan and white. You can use them in two main ways
// (note the need for the reset color if you don't use Color()):
//
//   fmt.Println(chalk.Red, "this is red text", chalk.ResetColor)
//   fmt.Println(chalk.Red.Color("this is red text")
//
//
// TextStyles
//
// There are seven default text styles: bold, dim, italic, underline,
// inverse, hidden and strikethrough. Unlike colors, you should only
// really use TextStyles in the following manner:
//
//   fmt.Println(chalk.Bold.TextStyle("this is bold text"))
//
//
// Styles
//
// Styles are where all the business really is. Styles can have a
// foreground color, a background color and a text style (sweet!).
// They're also pretty simply to make, you just need a starting point:
//
//   blue := chalk.Blue.NewStyle()
//   bold := chalk.Bold.NewStyle()
//
// When a color is your starting point for a style, it will be the
// foreground color, when a style is your starting point, well, yeah,
// it's your style's text style. You can also alter a style's foreground,
// background or text style in a builder-esque pattern.
//
//   blueOnWhite := blue.WithBackground(chalk.White)
//   awesomeness := blueOnWhite.WithTextStyle(chalk.Underline).WithForeground(chalk.Green)
//
// Like both Colors and TextStyles you can style specific segments of text
// with:
//
//   fmt.Println(awesomeness.Style("this is so pretty!"))
//
// Like Colors, you can also print styles explicitly, but you'll need to
// reset your console's colors with chalk.Reset if you use them this way:
//
//   fmt.Println(awesomeness, "this is so pretty", chalk.Reset)
//
// Be aware though, that this (second) way of using styles will not add the
// text style (as text styles require more specific end codes). So if you want
// to fully utilize styles, use myStyle.Style() (unless you only care about
// print your text with a specific foreground and background, then printing
// the style is awesome too!).
//
// Have fun!
//
package chalk
