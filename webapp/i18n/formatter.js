exports.format = function (translations) {
    const translationMap = new Map();
  const formattedTranslations = {}
  for (const [id, translation] of Object.entries(translations)) {
    translationMap.set(id, {
        message: translation.defaultMessage,
        description: translation.description,
    })
  }
  return Object.fromEntries(translationMap)
}
