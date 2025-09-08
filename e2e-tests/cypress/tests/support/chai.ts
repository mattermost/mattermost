// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

chai.use((chai: Chai.ChaiStatic) => {
    function assertIsFoo({exactStyles = true} = {}) {

        const obj = this._obj as JQuery<HTMLElement>;

        this.assert(
            obj.hasClass('a11y--active'),
            'expected #{this} to have a11y--active class',
            'expected #{this} to not have a11y--active class',
            obj,
        );

        // These should match the styles set on :focus-visible in sass/utils/_modifiers.scss
        this.assert(
            exactStyles ? obj.css('box-shadow').includes('0px 0px 1px 3px') : Boolean(obj.css('box-shadow')),
            'expected #{this} to have focused element style (box-shadow)',
            'expected #{this} to not have focused element style (box-shadow)',
            obj.css('box-shadow'),
        );

        this.assert(
            exactStyles ? obj.css('border-radius') === '4px' : Boolean(obj.css('border-radius')),
            'expected #{this} to have focused element style (border-radius)',
            'expected #{this} to not have focused element style (border-radius)',
            obj.css('border-radius'),
        );

        return this;
    }


    chai.Assertion.addMethod('a11yVisible', assertIsFoo);
});
