// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const axios = require('axios');

module.exports = async ({sender, message, channelId, rootId, createAt = 0, baseUrl}) => {
    const loginResponse = await axios({
        url: `${baseUrl}/api/v4/users/login`,
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'post',
        data: {login_id: sender.username, password: sender.password},
    });

    const setCookie = loginResponse.headers['set-cookie'];
    let cookieString = '';
    setCookie.forEach((cookie) => {
        const nameAndValue = cookie.split(';')[0];
        cookieString += nameAndValue + ';';
    });

    let response;
    try {
        response = await axios({
            url: `${baseUrl}/api/v4/posts`,
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                Cookie: cookieString,
            },
            method: 'post',
            data: {
                channel_id: channelId,
                message,
                type: '',
                create_at: createAt,
                root_id: rootId,
            },
        });
    } catch (err) {
        expect(Boolean(err)).to.equal(false);
    }

    return {status: response.status, data: response.data};
};
