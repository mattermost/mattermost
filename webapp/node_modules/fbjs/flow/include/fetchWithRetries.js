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
 * @flow
 */

'use strict';

var ExecutionEnvironment = require('ExecutionEnvironment');
var Promise = require('Promise');

var sprintf = require('sprintf');
var fetch = require('fetch');
var warning = require('warning');

type InitWitRetries = {
  body?: mixed;
  cache?: ?string;
  credentials?: ?string;
  fetchTimeout?: number;
  headers?: mixed;
  method?: ?string;
  mode?: ?string;
  retryDelays?: Array<number>;
};

var DEFAULT_FETCH_TIMEOUT = 15000;
var DEFAULT_RETRY_DELAYS = [1000, 3000];

/**
 * Posts a request to the server with the given data as the payload.
 * Automatic retries are done based on the values in `retryDelays`.
 */
function fetchWithRetries(
  uri: string,
  initWithRetries: InitWitRetries
): Promise {
  var {fetchTimeout, retryDelays, ...init} = initWithRetries;
  var nonNullFetchTimeout = fetchTimeout || DEFAULT_FETCH_TIMEOUT;
  var nonNullRetryDelays = retryDelays || DEFAULT_RETRY_DELAYS;

  var requestsAttempted = 0;
  var requestStartTime = 0;
  return new Promise((resolve, reject) => {
    /**
     * Sends a request to the server that will timeout after `fetchTimeout`.
     * If the request fails or times out a new request might be scheduled.
     */
    function sendTimedRequest(): void {
      requestsAttempted++;
      requestStartTime = Date.now();
      var isRequestAlive = true;
      var request = fetch(uri, init);
      var requestTimeout = setTimeout(() => {
        isRequestAlive = false;
        if (shouldRetry(requestsAttempted)) {
          warning(false, 'fetchWithRetries: HTTP timeout, retrying.');
          retryRequest();
        } else {
          reject(new Error(sprintf(
            'fetchWithRetries(): Failed to get response from server, ' +
            'tried %s times.',
            requestsAttempted
          )));
        }
      }, nonNullFetchTimeout);

      request.then(response => {
        clearTimeout(requestTimeout);
        if (isRequestAlive) {
          // We got a response, we can clear the timeout.
          if (response.status >= 200 && response.status < 300) {
            // Got a response code that indicates success, resolve the promise.
            resolve(response);
          } else if (shouldRetry(requestsAttempted)) {
            // Fetch was not successful, retrying.
            // TODO(#7595849): Only retry on transient HTTP errors.
            warning(false, 'fetchWithRetries: HTTP error, retrying.'),
            retryRequest();
          } else {
            // Request was not successful, giving up.
            reject(response);
          }
        }
      }).catch(error => {
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
    function retryRequest(): void {
      var retryDelay = nonNullRetryDelays[requestsAttempted - 1];
      var retryStartTime = requestStartTime + retryDelay;
      // Schedule retry for a configured duration after last request started.
      setTimeout(sendTimedRequest, retryStartTime - Date.now());
    }

    /**
     * Checks if another attempt should be done to send a request to the server.
     */
    function shouldRetry(attempt: number): boolean {
      return (
        ExecutionEnvironment.canUseDOM &&
        attempt <= nonNullRetryDelays.length
      );
    }

    sendTimedRequest();
  });
}

module.exports = fetchWithRetries;
