# Usage

## Default Scrollbars

The `<Scrollbars>` component works out of the box with some default styles. The only thing you need to care about is that the component has a `width` and `height`:

```javascript
import { Scrollbars } from 'react-custom-scrollbars';

class App extends Component {
  render() {
    return (
      <Scrollbars style={{ width: 500, height: 300 }}>
        <p>Some great content...</p>
      </Scrollbars>
    );
  }
}
```

Also don't forget to set the `viewport` meta tag, if you want to **support mobile devices**

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0"/>
```

## Events

There are several events you can listen to:

```javascript
import { Scrollbars } from 'react-custom-scrollbars';

class App extends Component {
  render() {
    return (
      <Scrollbars
        // Will be called with the native scroll event
        onScroll={this.handleScroll}
        // Runs inside the animation frame. Passes some handy values about the current scroll position
        onScrollFrame={this.handleScrollFrame}
        // Called when scrolling starts
        onScrollStart={this.handleScrollStart}
        // Called when scrolling stops
        onScrollStop={this.handlenScrollStop}>
        // Called when ever the component is updated. Runs inside the animation frame
        onUpdate={this.handleUpdate}
        <p>Some great content...</p>
      </Scrollbars>
    );
  }
}
```


## Auto-hide

You can activate auto-hide by setting the `autoHide` property.

```javascript
import { Scrollbars } from 'react-custom-scrollbars';

class App extends Component {
  render() {
    return (
      <Scrollbars
        // This will activate auto hide
        autoHide
        // Hide delay in ms
        autoHideTimeout={1000}
        // Duration for hide animation in ms.
        autoHideDuration={200}>
        <p>Some great content...</p>
      </Scrollbars>
    );
  }
}
```

## Auto-height

You can active auto-height by setting the `autoHeight` property.
```javascript
import { Scrollbars } from 'react-custom-scrollbars';

class App extends Component {
  render() {
    return (
      <Scrollbars
        // This will activate auto-height
        autoHeight
        autoHeightMin={100}
        autoHeightMax={200}>
        <p>Some great content...</p>
      </Scrollbars>
    );
  }
}
```

## Universal rendering

If your app runs on both client and server, activate the `universal` mode. This will ensure that the initial markup on client and server are the same:

```javascript
import { Scrollbars } from 'react-custom-scrollbars';

class App extends Component {
  render() {
    return (
      // This will activate universal mode
      <Scrollbars universal>
        <p>Some great content...</p>
      </Scrollbars>
    );
  }
}
```
