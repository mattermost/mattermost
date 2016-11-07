/* jslint esnext: true */

import IntlMessageFormat from './core';
import defaultLocale from './en';

IntlMessageFormat.__addLocaleData(defaultLocale);
IntlMessageFormat.defaultLocale = 'en';

export default IntlMessageFormat;
