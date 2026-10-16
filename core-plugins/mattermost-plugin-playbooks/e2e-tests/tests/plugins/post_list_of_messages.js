// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const postMessageAs = require('./post_message_as');

module.exports = async ({numberOfMessages, ...rest}) => {
    const results = [];

    for (let i = 0; i < numberOfMessages; i++) {
        // Parallel posting of the messages (Promise.all) is not handled well by the server
        // resulting in random failed posts
        // so we use serial posting
        // eslint-disable-next-line no-await-in-loop
        results.push(await postMessageAs({message: `Message ${i}`, ...rest}));
    }

    return results;
};
