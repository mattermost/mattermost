export default function checkReporter(reporter) {
  try {
    require(`mocha/lib/reporters/${reporter}`); // eslint-disable-line global-require
  } catch (errModule) {
    try {
      require(reporter); // eslint-disable-line global-require
    } catch (errLocal) {
      throw new Error(`reporter "${reporter}" does not exist`);
    }
  }
}
