/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule fetchWithRetries
 * @typechecks
 * 
 */

'use strict';

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

var ExecutionEnvironment = require('./ExecutionEnvironment');
var Promise = require('./Promise');

var sprintf = require('./sprintf');
var fetch = require('./fetch');
var warning = require('./warning');

var DEFAULT_FETCH_TIMEOUT = 15000;
var DEFAULT_RETRY_DELAYS = [1000, 3000];

/**
 * Posts a request to the server with the given data as the payload.
 * Automatic retries are done based on the values in `retryDelays`.
 */
function fetchWithRetries(uri, initWithRetries) {
  var fetchTimeout = initWithRetries.fetchTimeout;
  var retryDelays = initWithRetries.retryDelays;

  var init = _objectWithoutProperties(initWithRetries, ['fetchTimeout', 'retryDelays']);

  var nonNullFetchTimeout = fetchTimeout || DEFAULT_FETCH_TIMEOUT;
  var nonNullRetryDelays = retryDelays || DEFAULT_RETRY_DELAYS;

  var requestsAttempted = 0;
  var requestStartTime = 0;
  return new Promise(function (resolve, reject) {
    /**
     * Sends a request to the server that will timeout after `fetchTimeout`.
     * If the request fails or times out a new request might be scheduled.
     */
    function sendTimedRequest() {
      requestsAttempted++;
      requestStartTime = Date.now();
      var isRequestAlive = true;
      var request = fetch(uri, init);
      var requestTimeout = setTimeout(function () {
        isRequestAlive = false;
        if (shouldRetry(requestsAttempted)) {
          process.env.NODE_ENV !== 'production' ? warning(false, 'fetchWithRetries: HTTP timeout, retrying.') : undefined;
          retryRequest();
        } else {
          reject(new Error(sprintf('fetchWithRetries(): Failed to get response from server, ' + 'tried %s times.', requestsAttempted)));
        }
      }, nonNullFetchTimeout);

      request.then(function (response) {
        clearTimeout(requestTimeout);
        if (isRequestAlive) {
          // We got a response, we can clear the timeout.
          if (response.status >= 200 && response.status < 300) {
            // Got a response code that indicates success, resolve the promise.
            resolve(response);
          } else if (shouldRetry(requestsAttempted)) {
            // Fetch was not successful, retrying.
            // TODO(#7595849): Only retry on transient HTTP errors.
            process.env.NODE_ENV !== 'production' ? process.env.NODE_ENV !== 'production' ? warning(false, 'fetchWithRetries: HTTP error, retrying.') : undefined : undefined, retryRequest();
          } else {
            // Request was not successful, giving up.
            reject(response);
          }
        }
      })['catch'](function (error) {
        clearTimeout(requestTimeout);
        if (shouldRetry(requestsAttempted)) {
          retryRequest();
        } else {
          reject(error);
        }
      });
    }

    /**
     * Schedules another run of sendTimedRequest based on how much time has
     * passed between the time the last request was sent and now.
     */
    function retryRequest() {
      var retryDelay = nonNullRetryDelays[requestsAttempted - 1];
      var retryStartTime = requestStartTime + retryDelay;
      // Schedule retry for a configured duration after last request started.
      setTimeout(sendTimedRequest, retryStartTime - Date.now());
    }

    /**
     * Checks if another attempt should be done to send a request to the server.
     */
    function shouldRetry(attempt) {
      return ExecutionEnvironment.canUseDOM && attempt <= nonNullRetryDelays.length;
    }

    sendTimedRequest();
  });
}

module.exports = fetchWithRetries;