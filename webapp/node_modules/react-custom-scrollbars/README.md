react-custom-scrollbars
=========================

[![npm](https://img.shields.io/badge/npm-react--custom--scrollbars-brightgreen.svg?style=flat-square)]()
[![npm version](https://img.shields.io/npm/v/react-custom-scrollbars.svg?style=flat-square)](https://www.npmjs.com/package/react-custom-scrollbars)
[![npm downloads](https://img.shields.io/npm/dm/react-custom-scrollbars.svg?style=flat-square)](https://www.npmjs.com/package/react-custom-scrollbars)

* frictionless native browser scrolling
* native scrollbars for mobile devices
* [fully customizable](https://github.com/malte-wessel/react-custom-scrollbars/blob/master/docs/customization.md)
* [auto hide](https://github.com/malte-wessel/react-custom-scrollbars/blob/master/docs/usage.md#auto-hide)
* [auto height](https://github.com/malte-wessel/react-custom-scrollbars/blob/master/docs/usage.md#auto-height)
* [universal](https://github.com/malte-wessel/react-custom-scrollbars/blob/master/docs/usage.md#universal-rendering) (runs on client & server)
* `requestAnimationFrame` for 60fps
* no extra stylesheets
* well tested, 100% code coverage

**[Demos](http://malte-wessel.github.io/react-custom-scrollbars/) · [Documentation](https://github.com/malte-wessel/react-custom-scrollbars/tree/master/docs)**

## Installation
```bash
npm install react-custom-scrollbars --save
```

This assumes that you’re using [npm](http://npmjs.com/) package manager with a module bundler like [Webpack](http://webpack.github.io) or [Browserify](http://browserify.org/) to consume [CommonJS modules](http://webpack.github.io/docs/commonjs.html).

If you don’t yet use [npm](http://npmjs.com/) or a modern module bundler, and would rather prefer a single-file [UMD](https://github.com/umdjs/umd) build that makes `ReactCustomScrollbars` available as a global object, you can grab a pre-built version from [npmcdn](https://npmcdn.com/react-custom-scrollbars@3.0.1/dist/react-custom-scrollbars.js). We *don’t* recommend this approach for any serious application, as most of the libraries complementary to `react-custom-scrollbars` are only available on [npm](http://npmjs.com/).

## Usage

This is the minimal configuration. [Check out the Documentation for advanced usage](https://github.com/malte-wessel/react-custom-scrollbars/tree/master/docs).

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

The `<Scrollbars>` component is completely customizable. Check out the following code:

```javascript
import { Scrollbars } from 'react-custom-scrollbars';

class CustomScrollbars extends Component {
  render() {
    return (
      <Scrollbars
        onScroll={this.handleScroll}
        onScrollFrame={this.handleScrollFrame}
        onScrollStart={this.handleScrollStart}
        onScrollStop={this.handleScrollStop}
        onUpdate={this.handleUpdate}
        renderView={this.renderView}
        renderTrackHorizontal={this.renderTrackHorizontal}
        renderTrackVertical={this.renderTrackVertical}
        renderThumbHorizontal={this.renderThumbHorizontal}
        renderThumbVertical={this.renderThumbVertical}
        autoHide={true}
        autoHideTimeout={1000}
        autoHideDuration={200}
        thumbMinSize={30}
        universal={true}
        {...this.props}>
    );
  }
}
```

All properties are documented in the [API docs](https://github.com/malte-wessel/react-custom-scrollbars/blob/master/docs/API.md)

## Examples

Run the simple example:
```bash
# Make sure that you've installed the dependencies
npm install
# Move to example directory
cd react-custom-scrollbars/examples/simple
npm install
npm start
```

## Tests
```bash
# Make sure that you've installed the dependencies
npm install
# Run tests
npm test
```

### Code Coverage
```bash
# Run code coverage. Results can be found in `./coverage`
npm run test:cov
```


## License

MIT
