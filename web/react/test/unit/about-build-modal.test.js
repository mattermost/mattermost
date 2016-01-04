jest.dontMock('../../components/about_build_modal.jsx');

const sinon = require('sinon');
const TestUtils = require('react-addons-test-utils');
const AboutBuildModal = require('../../components/about_build_modal.jsx').default;

describe('Component::AboutBuildModal', () => {
    it('Should properly instantiate with default properties', () => {
        let Component = TestUtils.renderIntoDocument(<AboutBuildModal onModalDismissed={()=> {}}></AboutBuildModal>);
        expect(Component.props.show).toBe(false);
    });

    it('Should properly call doHide() method', () => {
        let onModalDismissedSpy = sinon.spy();
        let Component = TestUtils.renderIntoDocument(<AboutBuildModal show={true} onModalDismissed={onModalDismissedSpy}></AboutBuildModal>);

        Component.doHide();
        expect(onModalDismissedSpy.calledOnce).toBe(true);
    });
});