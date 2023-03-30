// eslint-disable-next-line func-names
exports.compile = function(msgs) {
  const results = {};
  for (const [id, msg] of Object.entries(msgs)) {
    const intermediate = {
        message: msg.defaultMessage,
        description: msg.description || '',
    };

    if (intermediate.description.length === 0) {
        Reflect.deleteProperty(intermediate, 'description');
    }
    results[id] = intermediate;
  }

  return results;
};
