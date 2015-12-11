// Bootstrap file which is used for initializing test environment.
// You must expose imported modules which you are using in React components to global.window here.
// The problem is in the way how components are implemented.
// All the components are built on global React object that accessible only in window.
// But when you are running tests, there is no global window object with React component inside.
global.window.React = require('react');
global.window.ReactBootstrap = require('react-bootstrap');
global.window.mm_config  = {Version: 1};
