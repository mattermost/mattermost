'use strict';
const YAML = require('yaml');
const fs = require('fs');
const fetch = require('sync-fetch');

class Extractor {
    constructor() {}

    /**
     * Write YAML data to the specified file, optionally indenting all lines by a specified amount
     * @param filename {String} The file to write the data to
     * @param data {Record<String, any>} An object that contains the data to be written to the file
     * @param indent {Number} Number of spaces to left-pad each line with
     */
    writeFile(filename, data, indent = 0) {
        let stringified = YAML.stringify(data, { lineWidth: 0 });
        if (indent > 0) {
            stringified = stringified.replace(/^(.*)$/mg, '$1'.padStart(2 + indent)) + "\n";
        }
        fs.writeFileSync(filename, stringified);
        console.log("wrote file " + filename);
    }

    /**
     * Extract various parts of an OpenAPI spec into separate files
     * @param args {Array<String>} Program arguments
     */
    run(args) {
        // Fetch the OpenAPI spec
        const rawSpec = fetch('https://raw.githubusercontent.com/mattermost/mattermost-plugin-playbooks/master/server/api/api.yaml').text();
        console.log("fetched Playbooks OpenAPI spec");
        // Parse the OpenAPI spec
        const parsed = YAML.parse(rawSpec);
        // Extract paths
        if ("paths" in parsed) {
            this.writeFile("paths.yaml", parsed["paths"], 2);
        }
        // Extract components.schemas, components.responses, and components.securitySchemes
        if ("components" in parsed) {
            /** @type {Record<String,any>} */
            const components = parsed["components"];
            if ("schemas" in components) {
                this.writeFile("schemas.yaml", components["schemas"]);
            }
            if ("responses" in components) {
                this.writeFile("responses.yaml", components["responses"]);
            }
            if ("securitySchemes" in components) {
                this.writeFile("securitySchemes.yaml", components["securitySchemes"]);
            }
        }
    }
}

new Extractor().run(process.argv);
