'use strict';
const YAML = require('yaml');
const fs = require('fs');
const fetch = require('sync-fetch');

const defaultSpecURL = 'https://raw.githubusercontent.com/mattermost/mattermost-plugin-agents/master/api/openapi.yaml';

class Extractor {
    constructor() {}

    writeFile(filename, data, indent = 0) {
        let stringified = YAML.stringify(data, { lineWidth: 0 });
        if (indent > 0) {
            stringified = stringified.replace(/^(.*)$/mg, '$1'.padStart(2 + indent)) + '\n';
        }
        fs.writeFileSync(filename, stringified);
        console.log('wrote file ' + filename);
    }

    readSpec(source) {
        if (source.startsWith('http://') || source.startsWith('https://')) {
            console.log('fetching Agents OpenAPI spec from ' + source);
            return fetch(source).text();
        }

        console.log('reading Agents OpenAPI spec from ' + source);
        return fs.readFileSync(source).toString();
    }

    run() {
        const rawSpec = this.readSpec(process.env.AGENTS_OPENAPI_SPEC || defaultSpecURL);
        const parsed = YAML.parse(rawSpec);

        if ('paths' in parsed) {
            this.writeFile('paths.yaml', parsed.paths, 2);
        }

        if ('components' in parsed) {
            const components = parsed.components;
            if ('schemas' in components) {
                this.writeFile('schemas.yaml', components.schemas);
            }
            if ('responses' in components) {
                this.writeFile('responses.yaml', components.responses);
            }
            if ('securitySchemes' in components) {
                this.writeFile('securitySchemes.yaml', components.securitySchemes);
            }
            if ('parameters' in components) {
                this.writeFile('parameters.yaml', components.parameters);
            }
            if ('requestBodies' in components) {
                this.writeFile('requestBodies.yaml', components.requestBodies);
            }
        }
    }
}

new Extractor().run();
