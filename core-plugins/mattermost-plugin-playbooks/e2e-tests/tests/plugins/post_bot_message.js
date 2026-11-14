// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const axios = require('axios');
module.exports = async ({token, message, props = {}, channelId, rootId, createAt = 0, baseUrl}) => {
    let response;
    try {
        response = await axios({
            url: `${baseUrl}/api/v4/posts`,
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                Authorization: `Bearer ${token}`,
            },
            method: 'post',
            data: {
                channel_id: channelId,
                message,
                props,
                type: '',
                create_at: createAt,
                root_id: rootId,
            },
        });
    } catch (err) {
        if (err.response) {
            response = err.response;
        }
    }

    return {status: response.status, data: response.data};
};
