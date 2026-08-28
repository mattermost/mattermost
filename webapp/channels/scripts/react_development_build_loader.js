// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The strict mode build links against React's development runtime while leaving NODE_ENV at
// production for the rest of the bundle (see webpack.config.js). React's own packaging picks its
// implementation from NODE_ENV, so aliasing to the development files isn't enough on its own:
//
//   - react/react-dom/scheduler's development bundles wrap their entire body in
//     `if (process.env.NODE_ENV !== "production")`, which would compile away to nothing.
//   - react-dom/client picks between a thin wrapper that flags the entry point as supported and a
//     bare re-export that doesn't, so the production branch makes react-dom warn on every
//     createRoot call.
//
// This loader flips those two guards, and is only applied to the React packages.

const GUARDS = [
    {from: 'if (process.env.NODE_ENV !== "production") {', to: 'if (true) {'},
    {from: "if (process.env.NODE_ENV === 'production') {", to: 'if (false) {'},
];

module.exports = function reactDevelopmentBuildLoader(source) {
    const guard = GUARDS.find(({from}) => source.includes(from));

    if (!guard) {
        this.emitError(new Error("Expected a NODE_ENV guard in one of React's entry points. Its packaging may have changed."));
        return source;
    }

    return source.replace(guard.from, guard.to);
};
