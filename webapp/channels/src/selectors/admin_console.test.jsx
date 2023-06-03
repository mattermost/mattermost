// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AdminDefinition from "components/admin_console/admin_definition";

import { getAdminDefinition } from "selectors/admin_console.jsx";

describe("Selectors.AdminConsole", () => {
    describe("get admin definitions", () => {
        it("should return the default admin definition if there is not plugins", () => {
            const state = { plugins: { adminConsoleReducers: {} } };
            expect(getAdminDefinition(state)).toEqual(AdminDefinition);
        });

        it("should allow to remove everything with a plugin", () => {
            const result = getAdminDefinition({
                plugins: {
                    adminConsoleReducers: { clean: () => ({}) },
                },
            });
            expect(result).toEqual({});
        });

        it("should allow to add a value to the existing definition", () => {
            const result = getAdminDefinition({
                plugins: {
                    adminConsoleReducers: {
                        "add-something": (data) => {
                            data.something = "test";
                            return data;
                        },
                    },
                },
            });
            expect(result.something).toEqual("test");
        });

        it("should allow to use multiple plugins", () => {
            const result = getAdminDefinition({
                plugins: {
                    adminConsoleReducers: {
                        "add-something": (data) => {
                            data.something = "test";
                            return data;
                        },
                        "add-other-thing": (data) => {
                            data.otherThing = "other-thing";
                            return data;
                        },
                    },
                },
            });
            expect(result.something).toEqual("test");
            expect(result.otherThing).toEqual("other-thing");
        });
    });
});
