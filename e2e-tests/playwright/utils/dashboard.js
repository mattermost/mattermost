// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const {stringify} = require('querystring');

require('dotenv').config();

const {AUTOMATION_DASHBOARD_TOKEN, AUTOMATION_DASHBOARD_URL} = process.env;

const config = {
    baseURL: AUTOMATION_DASHBOARD_URL,
    headers: {
        Authorization: `Bearer ${AUTOMATION_DASHBOARD_TOKEN}`,
    },
};

/**
 * Create and start a test cycle.
 * @param {Object} data - Contains repo, branch, build and files.
 * @returns {Object} - Contains cycle information.
 */
async function createAndStartCycle(data) {
    try {
        console.log('Creating test cycle with dashboard at:', config.baseURL);

        const response = await axios.post('/api/cycles/start', data, config);
        return response.data;
    } catch (err) {
        console.error('Error creating test cycle:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
        throw err;
    }
}

/**
 * Get a spec to test.
 * @param {Object} data - Contains cycle_id.
 * @returns {Object} - Contains spec information.
 */
async function getSpecToTest(data) {
    try {
        // Use cycle_id to get specs
        const cycleId = data.cycle_id;
        if (!cycleId) {
            return {
                code: 'MISSING_CYCLE_ID',
                message: 'Cycle ID is required',
            };
        }

        console.log(`Getting specs for cycle: ${cycleId}`);
        const response = await axios.get(`/api/specs/to-test?cycle_id=${cycleId}`, config);

        if (!response.data || !Array.isArray(response.data.specs)) {
            return {
                code: 'INVALID_RESPONSE',
                message: 'Invalid response from dashboard API',
                data: response.data,
            };
        }

        // Return the specs array
        return {
            specs: response.data.specs,
            cycle: response.data.cycle,
        };
    } catch (err) {
        return {
            code: err.code || 'ERROR',
            message: err.message,
            data: err.response ? err.response.data : undefined,
        };
    }
}

/**
 * Record a spec result.
 * @param {string} id - Execution ID.
 * @param {Object} spec - Spec information.
 * @param {Array} testCases - Test cases information.
 * @returns {Object} - Contains updated spec information.
 */
async function recordSpecResult(id, spec, testCases) {
    try {
        const response = await axios.post(`/api/specs/${id}/result`, {spec, testCases}, config);
        return response.data;
    } catch (err) {
        console.error('Error recording spec result:', err.message);
        return {error: err.message};
    }
}

/**
 * Update a cycle.
 * @param {string} id - Cycle ID.
 * @param {Object} data - Data to update.
 * @returns {Object} - Contains updated cycle information.
 */
async function updateCycle(id, data) {
    try {
        const response = await axios.put(`/api/cycles/${id}`, data, config);
        return response.data;
    } catch (err) {
        console.error('Error updating cycle:', err.message);
        return {error: err.message};
    }
}

/**
 * Upload a screenshot.
 * @param {string} filePath - Path of the screenshot.
 * @param {string} repo - Repository name.
 * @param {string} branch - Branch name.
 * @param {string} build - Build identifier.
 * @returns {string} - URL of the uploaded screenshot.
 */
async function uploadScreenshot(filePath, repo, branch, build) {
    try {
        if (!fs.existsSync(filePath)) {
            return {error: `File does not exist: ${filePath}`};
        }

        const form = new FormData();
        form.append('repo', repo);
        form.append('branch', branch);
        form.append('build', build);
        form.append('file', fs.createReadStream(filePath));

        const response = await axios.post('/api/screenshots', form, {
            ...config,
            headers: {
                ...config.headers,
                ...form.getHeaders(),
            },
        });

        return response.data.url;
    } catch (err) {
        console.error('Error uploading screenshot:', err.message);
        return {error: err.message};
    }
}

module.exports = {
    createAndStartCycle,
    getSpecToTest,
    recordSpecResult,
    updateCycle,
    uploadScreenshot,
};
