# v2.x Documentation
## Table of Contents

- [Customization](#customization)
- [API](#api)

## Customization
```javascript
import { Scrollbars } from 'react-custom-scrollbars';

class CustomScrollbars extends Component {
  render() {
    return (
      <Scrollbars
        className="container"
        renderScrollbarHorizontal={props => <div {...props} className="scrollbar-horizontal" />}
        renderScrollbarVertical={props => <div {...props} className="scrollbar-vertical"/>}
        renderThumbHorizontal={props => <div {...props} className="thumb-horizontal"/>}
        renderThumbVertical={props => <div {...props} className="thumb-vertical"/>}
        renderView={props => <div {...props} className="view"/>}>
        {this.props.children}
      </Scrollbars>
    );
  }
}

class App extends Component {
  render() {
    return (
      <CustomScrollbars style={{ width: 500, height: 300 }}>
        <p>Some great content...</p>
      </CustomScrollbars>
    );
  }
}
```

**NOTE**: If you use `renderScrollbarHorizontal`, **make sure that you define a height value** with css or inline styles. If you use `renderScrollbarVertical`, **make sure that you define a width value with** css or inline styles.

## API

### `<Scrollbars>`

#### Props

* `renderScrollbarHorizontal`: (Function) Horizontal scrollbar element
* `renderScrollbarVertical`: (Function) Vertical scrollbar element
* `renderThumbHorizontal`: (Function) Horizontal thumb element
* `renderThumbVertical`: (Function) Vertical thumb element
* `renderView`: (Function) The element your content will be rendered in
* `onScroll`: (Function) Event handler. Will be called with the native scroll event and some handy values about the current position.
  * **Signature**: `onScroll(event, values)`
  * `event`: (Event) Native onScroll event
  * `values`: (Object) Values about the current position
    * `values.top`: (Number) scrollTop progess, from 0 to 1
    * `values.left`: (Number) scrollLeft progess, from 0 to 1
    * `values.clientWidth`: (Number) width of the view
    * `values.clientHeight`: (Number) height of the view
    * `values.scrollWidth`: (Number) native scrollWidth
    * `values.scrollHeight`: (Number) native scrollHeight
    * `values.scrollLeft`: (Number) native scrollLeft
    * `values.scrollTop`: (Number) native scrollTop

**Don't forget to pass the received props to your custom element. Example:**

**NOTE**: If you use `renderScrollbarHorizontal`, **make sure that you define a height value** with css or inline styles. If you use `renderScrollbarVertical`, **make sure that you define a width value with** css or inline styles.

```javascript
import { Scrollbars } from 'react-custom-scrollbars';

class CustomScrollbars extends Component {
  render() {
    return (
      <Scrollbars
        // Set a custom className
        renderScrollbarHorizontal={props => <div {...props} className="scrollbar-vertical"/>}
        // Customize inline styles
        renderScrollbarVertical={({ style, ...props}) => {
          return <div style={{...style, padding: 20}} {...props}/>;
        }}>
        {this.props.children}
      </Scrollbars>
    );
  }
}
```

#### Methods

* `scrollTop(top)`: scroll to the top value
* `scrollLeft(left)`: scroll to the left value
* `scrollToTop()`: scroll to top
* `scrollToBottom()`: scroll to bottom
* `scrollToLeft()`: scroll to left
* `scrollToRight()`: scroll to right
* `getScrollLeft`: get scrollLeft value
* `getScrollTop`: get scrollTop value
* `getScrollWidth`: get scrollWidth value
* `getScrollHeight`: get scrollHeight value
* `getWidth`: get view client width
* `getHeight`: get view client height
* `getValues`: get an object with values about the current position.
    * `left`, `top`, `scrollLeft`, `scrollTop`, `scrollWidth`, `scrollHeight`, `clientWidth`, `clientHeight`

```javascript
import { Scrollbars } from 'react-custom-scrollbars';

class App extends Component {
  handleClick() {
    this.refs.scrollbars.scrollToTop()
  },
  render() {
    return (
      <div>
        <Scrollbars
          ref="scrollbars"
          style={{ width: 500, height: 300 }}>
          {/* your content */}
        </Scrollbars>
        <button onClick={this.handleClick.bind(this)}>
            Scroll to top
        </button>
      </div>
    );
  }
}
```

### Receive values about the current position

```javascript
class CustomScrollbars extends Component {
  handleScroll(event, values) {
    console.log(values);
    /*
    {
        left: 0,
        top: 0.21513353115727002
        clientWidth: 952
        clientHeight: 300
        scrollWidth: 952
        scrollHeight: 1648
        scrollLeft: 0
        scrollTop: 290
    }
    */
  }
  render() {
    return (
      <Scrollbars onScroll={this.handleScroll}>
        {this.props.children}
      </Scrollbars>
    );
  }
}
```
