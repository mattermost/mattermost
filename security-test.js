// Test file for PR Security Scan
// Contains intentionally vulnerable code and dummy credentials.
// Do not use real secrets.

const AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
const AWS_SECRET_ACCESS_KEY = "fake_secret_key_for_testing_only";

// Vulnerability 1: Hardcoded credentials
function connectToAWS() {
    console.log("AWS Access Key:", AWS_ACCESS_KEY_ID);
    console.log("AWS Secret Key:", AWS_SECRET_ACCESS_KEY);
}

// Vulnerability 2: SQL Injection
function getUser(username) {
    const query = "SELECT * FROM users WHERE username = '" + username + "'";
    return query;
}

// Vulnerability 3: Command Injection
const { exec } = require("child_process");

function pingHost(host) {
    exec("ping -c 1 " + host, (error, stdout) => {
        console.log(stdout);
    });
}

module.exports = {
    connectToAWS,
    getUser,
    pingHost
};
