'use strict';

import deprecate from './deprecate';
import useBeforeUnload from './useBeforeUnload';

export default deprecate(useBeforeUnload, 'enableBeforeUnload is deprecated, use useBeforeUnload instead');