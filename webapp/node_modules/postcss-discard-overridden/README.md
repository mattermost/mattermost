# PostCSS Discard Overridden [![Build Status][ci-img]][ci]

[PostCSS] plugin to discard overridden `@keyframes` or `@counter-style`.

`@keyframes` or `@counter-style` will be overridden by those who share the same identifiers and appear later in stylesheets. So we can discard all of them except the last one. When defined inside a `@media` or `@supports` rule, `@keyframes` and `@counter-style` rules only override global rules in some of the client browsers so they need handled separately. This plugin has taken care of this and transforms the PostCss AST **safely**.

[PostCSS]: https://github.com/postcss/postcss
[ci-img]:  https://travis-ci.org/Justineo/postcss-discard-overridden.svg
[ci]:      https://travis-ci.org/Justineo/postcss-discard-overridden

```css
@-webkit-keyframes fade-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 0.8;
  }
}
@keyframes fade-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 0.8;
  }
}
@media (max-width: 500px) {
  @-webkit-keyframes fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  @keyframes fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
  @-webkit-keyframes fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 0.8;
    }
  }
  @keyframes fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 0.8;
    }
  }
  @supports (display: flex) {
    @-webkit-keyframes fade-in {
      0% {
        opacity: 0;
      }
      100% {
        opacity: 1;
      }
    }
    @keyframes fade-in {
      0% {
        opacity: 0;
      }
      100% {
        opacity: 1;
      }
    }
  }
}
@-webkit-keyframes fade-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
@keyframes fade-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

```css
@media (max-width: 500px) {
  @-webkit-keyframes fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 0.8;
    }
  }
  @keyframes fade-in {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 0.8;
    }
  }
  @supports (display: flex) {
    @-webkit-keyframes fade-in {
      0% {
        opacity: 0;
      }
      100% {
        opacity: 1;
      }
    }
    @keyframes fade-in {
      0% {
        opacity: 0;
      }
      100% {
        opacity: 1;
      }
    }
  }
}
@-webkit-keyframes fade-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
@keyframes fade-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
```

## Usage

```js
postcss([ require('postcss-discard-overridden') ])
```

See [PostCSS] docs for examples for your environment.
