// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const axios = require('axios');

module.exports = async ({baseUrl, headers = [], method = 'get', path = '', data = {}}) => {
    let response;
    try {
        response = await axios({
            method,
            url: `${baseUrl}/${path}`,
            headers,
            data,
        });

        return {
            status: response.status,
            statusText: response.statusText,
            data: response.data,
        };
    } catch (error) {
        // If we have a response for the error, pull out the relevant parts
        if (error.response) {
            response = {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
            };
        } else {
            // If we get here something else went wrong, so throw
            throw error;
        }
    }

    return response;
};
