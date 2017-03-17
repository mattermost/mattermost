# API

## `<Scrollbars>`

### Props

* `onScroll`: (Function) Event handler
  * Signature: `onScroll(event)`
* `onScrollFrame`: (Function) Runs inside the animation frame.
  * Signature: `onScroll(values)`
  * `values`: (Object) Values about the current position
    * `values.top`: (Number) scrollTop progess, from 0 to 1
    * `values.left`: (Number) scrollLeft progess, from 0 to 1
    * `values.clientWidth`: (Number) Width of the view
    * `values.clientHeight`: (Number) Height of the view
    * `values.scrollWidth`: (Number) Native scrollWidth
    * `values.scrollHeight`: (Number) Native scrollHeight
    * `values.scrollLeft`: (Number) Native scrollLeft
    * `values.scrollTop`: (Number) Native scrollTop
* `onScrollStart` (Function) Called when scrolling starts
* `onScrollStop` (Function) Called when scrolling stops
* `onUpdate` (Function) Called when ever the component is updated. Runs inside the animation frame
  * Signature: `onUpdate(values)`
* `renderView`: (Function) The element your content will be rendered in
* `renderTrackHorizontal`: (Function) Horizontal track element
* `renderTrackVertical`: (Function) Vertical track element
* `renderThumbHorizontal`: (Function) Horizontal thumb element
* `renderThumbVertical`: (Function) Vertical thumb element
* `hideTracksWhenNotNeeded`: (Boolean) Hide tracks (`visibility: hidden`) when content does not overflow container. (default: false)
* `thumbSize`: (Number) Set a fixed size for thumbs in px.
* `thumbMinSize`: (Number) Minimal thumb size in px. (default: 30)
* `autoHide`: (Boolean) Enable auto-hide mode (default: `false`)
  * When `true` tracks will hide automatically and are only visible while scrolling.
* `autoHideTimeout`: (Number) Hide delay in ms. (default: 1000)
* `autoHideDuration`: (Number) Duration for hide animation in ms. (default: 200)
* `autoHeight`: (Boolean) Enable auto-height mode. (default: false)
  * When `true` container grows with content
* `autoHeightMin`: (Number) Set a minimum height for auto-height mode (default: 0)
* `autoHeightMax`: (Number) Set a maximum height for auto-height mode (default: 200)
* `universal`: (Boolean) Enable universal rendering (default: `false`)
    * [Learn how to use universal rendering](#link)

### Methods

* `scrollTop(top)`: scroll to the top value
* `scrollLeft(left)`: scroll to the left value
* `scrollToTop()`: scroll to top
* `scrollToBottom()`: scroll to bottom
* `scrollToLeft()`: scroll to left
* `scrollToRight()`: scroll to right
* `getScrollLeft()`: get scrollLeft value
* `getScrollTop()`: get scrollTop value
* `getScrollWidth()`: get scrollWidth value
* `getScrollHeight()`: get scrollHeight value
* `getClientWidth()`: get view client width
* `getClientHeight()`: get view client height
* `getValues()`: get an object with values about the current position.
