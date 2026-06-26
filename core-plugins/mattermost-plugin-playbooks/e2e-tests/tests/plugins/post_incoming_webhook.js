// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const axios = require('axios');

module.exports = async ({url, data}) => {
    let response;

    try {
        response = await axios({method: 'post', url, data});
    } catch (err) {
        if (err.response) {
            response = err.response;
        }
    }

    return {status: response.status, data: response.data};
};
