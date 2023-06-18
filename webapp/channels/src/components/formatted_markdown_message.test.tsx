// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from "react";
import { mount } from "enzyme";
import { IntlProvider } from "react-intl";

import FormattedMarkdownMessage from "./formatted_markdown_message";

jest.unmock("react-intl");

describe("components/FormattedMarkdownMessage", () => {
    test("should render message", () => {
        const props = {
            id: "test.foo",
            defaultMessage:
                "**bold** *italic* [link](https://mattermost.com/) <br/> [link target blank](!https://mattermost.com/)",
        };
        const wrapper = mount(
            wrapProvider(<FormattedMarkdownMessage {...props} />)
        );
        expect(wrapper).toMatchSnapshot();
    });

    test("should backup to default", () => {
        const props = {
            id: "xxx",
            defaultMessage: "testing default message",
        };
        const wrapper = mount(
            wrapProvider(<FormattedMarkdownMessage {...props} />)
        );
        expect(wrapper).toMatchSnapshot();
    });

    test("should escape non-BR", () => {
        const props = {
            id: "test.bar",
            defaultMessage: "",
            values: {
                b: (...content: string[]) => `<b>${content}</b>`,
                script: (...content: string[]) => `<script>${content}</script>`,
            },
        };
        const wrapper = mount(
            wrapProvider(<FormattedMarkdownMessage {...props} />)
        );
        expect(wrapper).toMatchSnapshot();
    });

    test("values should work", () => {
        const props = {
            id: "test.vals",
            defaultMessage: "*Hi* {petName}!",
            values: {
                petName: "sweetie",
            },
        };
        const wrapper = mount(
            wrapProvider(<FormattedMarkdownMessage {...props} />)
        );
        expect(wrapper).toMatchSnapshot();
    });

    test("should allow to disable links", () => {
        const props = {
            id: "test.vals",
            defaultMessage: "*Hi* {petName}!",
            values: {
                petName: "http://www.mattermost.com",
            },
            disableLinks: true,
        };
        const wrapper = mount(
            wrapProvider(<FormattedMarkdownMessage {...props} />)
        );
        expect(wrapper).toMatchSnapshot();
    });
});

export function wrapProvider(el: JSX.Element) {
    const enTranslationData = {
        "test.foo":
            "**bold** *italic* [link](https://mattermost.com/) <br/> [link target blank](!https://mattermost.com/)",
        "test.bar":
            "<b>hello</b> <script>var malicious = true;</script> world!",
        "test.vals": "*Hi* {petName}!",
    };
    return (
        <IntlProvider locale={"en"} messages={enTranslationData}>
            {el}
        </IntlProvider>
    );
}
