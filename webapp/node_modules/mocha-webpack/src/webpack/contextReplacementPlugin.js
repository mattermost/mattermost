import { ContextReplacementPlugin } from 'webpack';

export default function contextReplacementPlugin(context, matcher, recursive = false) {
  // use ContextReplacementPlugin to replace the initial context with a
  // new regExp to match the desired files
  return new ContextReplacementPlugin(new RegExp(context), (result) => {
    if (result.request === context) {
      // provide a new test function for resolving
      result.regExp = { test: matcher }; // eslint-disable-line no-param-reassign
      result.recursive = recursive; // eslint-disable-line no-param-reassign
    }
  });
}
