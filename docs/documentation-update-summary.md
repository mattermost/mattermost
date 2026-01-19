# Mattermost v11.3 Documentation Update Summary

## Pages/Sections Requiring Updates

Based on the AdvancedLoggingJSON validation and audit logging changes in v11.3, the following documentation sections need updates:

### 1. Server Logging Configuration Pages

#### Primary Updates Required:
- **Configuration Settings Reference**
  - Update `LogSettings.AdvancedLoggingJSON` documentation
  - Update `ExperimentalAuditSettings.AdvancedLoggingJSON` documentation
  - Add validation rule explanations
  - Include level separation requirements

- **Advanced Logging Guide**
  - Add section on v11.3 validation changes
  - Update configuration examples  
  - Separate standard vs audit logging examples
  - Add troubleshooting section for validation errors

### 2. Audit Logging Documentation

#### Primary Updates Required:
- **Audit Logging Setup Guide**
  - Update admin console navigation paths (remove "Beta" from labels)
  - Update AdvancedLoggingJSON examples
  - Document audit-specific log levels
  - Add configuration validation requirements

- **Audit Log Analysis Guide** 
  - Update log level reference tables
  - Document audit level purposes and use cases
  - Add filtering examples for different audit levels

### 3. Admin Console Documentation

#### Primary Updates Required:
- **Admin Console Navigation Guide**
  - Update "Audit logging (Beta)" → "Audit Logging"
  - Update screenshot references
  - Update navigation paths and breadcrumbs

- **System Console Reference**
  - Update Environment → Logging → Audit Logging section
  - Update help text and tooltips
  - Maintain beta status references in feature descriptions

### 4. Configuration Reference Documentation

#### Primary Updates Required:
- **config.json Reference**
  - Update `LogSettings` section with validation rules
  - Update `ExperimentalAuditSettings` section
  - Add cross-references between sections
  - Document migration requirements from pre-v11.3

- **Configuration Examples**
  - Separate standard and audit logging examples
  - Add "what changed" guidance for existing configurations
  - Include validation error examples and fixes

### 5. Troubleshooting Documentation

#### Primary Updates Required:
- **Configuration Troubleshooting Guide**
  - Add AdvancedLoggingJSON validation errors section
  - Document common migration issues from pre-v11.3
  - Add diagnostic commands and procedures
  - Include error message explanations

- **Server Startup Issues Guide**
  - Add logging configuration validation failures
  - Document recovery procedures
  - Add emergency configuration reset steps

## Proposed Documentation Content

### Insert-Ready Text Snippets

#### For AdvancedLoggingJSON Configuration Sections:

**Before (example existing content):**
> The AdvancedLoggingJSON setting allows for advanced logging configuration using JSON format.

**After (updated content):**
> The AdvancedLoggingJSON setting allows for advanced logging configuration using JSON format. **Starting with v11.3**, validation enforces that:
> - `LogSettings.AdvancedLoggingJSON` accepts only standard log levels (error, info, debug, etc.)  
> - `ExperimentalAuditSettings.AdvancedLoggingJSON` accepts only audit log levels (audit-api, audit-content, audit-permissions, audit-cli)
> - Cross-contamination between logging types results in validation errors

#### For Audit Logging Admin Console Sections:

**Before:**  
> Navigate to **System Console > Environment > Logging > Audit logging (Beta)**

**After:**
> Navigate to **System Console > Environment > Logging > Audit Logging**

#### For Log Level Reference Tables:

**New Section to Add:**
```markdown
### Audit Log Levels (v11.3+)

| Level | ID | Name | Purpose | Production Use |
|-------|----|----- |---------|----------------|
| audit-api | 100 | audit-api | REST API access auditing | Recommended |
| audit-content | 101 | audit-content | Content creation auditing | Optional (high volume) |
| audit-permissions | 102 | audit-permissions | Permission check auditing | Recommended |  
| audit-cli | 103 | audit-cli | CLI operation auditing | Optional (legacy) |
```

## Content Creation Deliverables

I've created the following comprehensive documentation files:

1. **`v11.3-advancedloggingjson-changes.md`** - Complete technical overview
2. **`audit-logging-configuration-updates.md`** - Audit logging specific updates  
3. **`admin-console-updates-v11.3.md`** - UI and admin console changes
4. **`troubleshooting-advancedloggingjson-v11.3.md`** - Complete troubleshooting guide

## Implementation Priority

### High Priority (Launch Blocking)
1. Update admin console label references ("Audit logging (Beta)" → "Audit Logging")
2. Add validation error documentation to prevent support escalations
3. Update core configuration reference pages

### Medium Priority (Post-Launch)  
1. Update existing configuration examples
2. Create migration guides for pre-v11.3 configurations
3. Update related screenshot and UI documentation

### Low Priority (Ongoing)
1. Update community content and tutorials  
2. Review related third-party integration documentation
3. Update video tutorials and training materials

## Validation Checklist

Before publishing documentation updates:
- [ ] All "Audit logging (Beta)" references updated to "Audit Logging"
- [ ] Configuration examples separated by standard vs audit logging
- [ ] Validation error scenarios documented with solutions  
- [ ] Migration guidance provided for existing configurations
- [ ] Screenshots updated to reflect admin console label changes
- [ ] Cross-references between LogSettings and ExperimentalAuditSettings updated