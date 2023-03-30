exports.format = function (translations) {
  const formattedTranslations = {}
  for (const [id, translation] of Object.entries(translations)) {
    formattedTranslations[id] = translation.description
  }
  return formattedTranslations
}
