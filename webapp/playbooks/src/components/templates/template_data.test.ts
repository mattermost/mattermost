import TemplateData from './template_data';

describe('TemplateData', () => {
    // if a template is missing, this might break the work templates feature.
    // reminder: because playbook templates don't have an ID, we rely on their name to identify them.
    // if this breaks, contact the @channel team to figure out what should be done.
    const knownTemplatesInWorkTemplate = [
        'Product Release',
        'Incident Resolution',
        'Customer Onboarding',
        'Employee Onboarding',
        'Feature Lifecycle',
        'Bug Bash',
    ];

    knownTemplatesInWorkTemplate.forEach((templateName) => {
        it(`should contains ${templateName} for work template`, () => {
            expect(
                TemplateData.find((template) => template.title.trim() === templateName),
            ).not.toBeUndefined();
        });
    });
});
