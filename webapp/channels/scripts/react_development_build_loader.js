// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Keep React's development runtime active while the rest of the bundle uses production mode.
module.exports = function reactDevelopmentBuildLoader(source) {
    const guard = '"production" !== process.env.NODE_ENV &&';

    if (!source.includes(guard)) {
        this.emitError(new Error("Expected a NODE_ENV guard in React's development runtime. Its packaging may have changed."));
        return source;
    }

    return source.replace(guard, 'true &&');
};
