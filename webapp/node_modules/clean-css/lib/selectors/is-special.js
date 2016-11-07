function isSpecial(options, selector) {
  return options.compatibility.selectors.special.test(selector);
}

module.exports = isSpecial;
