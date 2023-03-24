// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const axios = require('axios');

module.exports = async ({sender, postId, reaction, baseUrl}) => {
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
            url: `${baseUrl}/api/v4/reactions`,
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                Cookie: cookieString,
            },
            method: 'post',
            data: {
                user_id: sender.id,
                post_id: postId,
                emoji_name: reaction,
            },
        });
    } catch (err) {
        if (err.response) {
            response = err.response;
        }
    }

    return {status: response.status, data: response.data};
};
