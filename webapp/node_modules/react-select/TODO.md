# TODO

* options creation (was part of buildMenu and selectFocusedOption)
* handle comma keypress for tags mode (handleKeyDown keyCode 188)
* use componentDidUpdate for binding the closeMenuIfClicked... handlers (are these still needed?)
* the behaviour of searchable=false isn't very good yet, needs docus handling & close on body click
* pagination support in Async component

## Component Methods

* handle _ closeMenuIfClickedOutside
* handle _ bindCloseMenuIfClickedOutside
* handle _ unbindCloseMenuIfClickedOutside

* componentWillUnmount
* clickedOutsideElement
* handleMouseDownOnMenu

## Performance concerns

* checking the focused option after every render
* filtering the options on every render

## Questions

* Why is the reference check in filterOptions for excluded values not matching options?

## Later

* asyncDelay - wait x ms before calling getOptions in Async

## Notes

* You need to provide complex values when using Select.Async or values may not be found in the result set. isLoading can be used to indicate that values are being loaded asynchronously while the component is initialised.
