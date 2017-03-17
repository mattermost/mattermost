/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

import allLocaleData from '../locale-data/index';
import {addLocaleData} from './react-intl';

export * from './react-intl';

addLocaleData(allLocaleData);
