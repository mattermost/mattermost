const matchConstName = /[$#]?[\w-\.]+/g

export function replaceAll(replacements, text) {
  let matches
  while ((matches = matchConstName.exec(text))) {
    let replacement = replacements[matches[0]]
    if (replacement) {
      text = text.slice(0, matches.index) + replacement + text.slice(matchConstName.lastIndex)
      matchConstName.lastIndex -= matches[0].length - replacement.length
    }
  }
  return text
}

export default (css, translations) => {
  css.walkDecls(decl => decl.value = replaceAll(translations, decl.value))
  css.walkAtRules('media', atRule => atRule.params = replaceAll(translations, atRule.params))
}
