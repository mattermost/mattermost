/* jslint esnext: true */

import IntlRelativeFormat from './core';
import defaultLocale from './en';

IntlRelativeFormat.__addLocaleData(defaultLocale);
IntlRelativeFormat.defaultLocale = 'en';

export default IntlRelativeFormat;
