# Customization

The `<Scrollbars>` component consists of the following elements:

* `view` The element your content is rendered in
* `trackHorizontal` The horizontal scrollbars track
* `trackVertical` The vertical scrollbars track
* `thumbHorizontal` The horizontal thumb
* `thumbVertical` The vertical thumb

Each element can be **rendered individually** with a function that you pass to the component. Say, you want use your own `className` for each element:

```javascript
import { Scrollbars } from 'react-custom-scrollbars';

class CustomScrollbars extends Component {
  render() {
    return (
      <Scrollbars
        renderTrackHorizontal={props => <div {...props} className="track-horizontal"/>}
        renderTrackVertical={props => <div {...props} className="track-vertical"/>}
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

**Important**: **You will always need to pass through the given props** for the respective element like in the example above: `<div {...props} className="track-horizontal"/>`.
This is because we need to pass some default `styles` down to the element in order to make the component work.

If you are working with **inline styles**, you could do something like this:

```javascript
import { Scrollbars } from 'react-custom-scrollbars';

class CustomScrollbars extends Component {
  render() {
    return (
      <Scrollbars
        renderTrackHorizontal={({ style, ...props }) =>
            <div {...props} style={{ ...style, backgroundColor: 'blue' }}>
        }>
        {this.props.children}
      </Scrollbars>
    );
  }
}
```

## Respond to scroll events

If you want to change the appearance in respond to the scrolling position, you could do that like:

```javascript
import { Scrollbars } from 'react-custom-scrollbars';
class CustomScrollbars extends Component {
    constructor(props, context) {
        super(props, context)
        this.state = { top: 0 };
        this.handleScrollFrame = this.handleScrollFrame.bind(this);
        this.renderView = this.renderView.bind(this);
    }

    handleScrollFrame(values) {
        const { top } = values;
        this.setState({ top });
    }

    renderView({ style, ...props }) {
        const { top } = this.state;
        const color = top * 255;
        const customStyle = {
            backgroundColor: `rgb(${color}, ${color}, ${color})`
        };
        return (
            <div {...props} style={{ ...style, ...customStyle }}/>
        );
    }

    render() {
        return (
            <Scrollbars
                renderView={this.renderView}
                onScrollFrame={this.handleScrollFrame}
                {...this.props}/>
        );
    }
}
```

Check out these examples for some inspiration:
* [ColoredScrollbars](https://github.com/malte-wessel/react-custom-scrollbars/tree/master/examples/simple/components/ColoredScrollbars)
* [ShadowScrollbars](https://github.com/malte-wessel/react-custom-scrollbars/tree/master/examples/simple/components/ShadowScrollbars)
