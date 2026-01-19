# Audit Logging Configuration Updates for Mattermost v11.3+

## Admin Console Changes

### Label Update
- **Previous**: "Audit logging (Beta)"
- **Updated**: "Audit Logging" 
- **Note**: Feature remains in beta status (`isBeta` flag still active), only the display label changed

## Configuration Structure

### ExperimentalAuditSettings.AdvancedLoggingJSON

Starting with v11.3, audit logging configurations must use **only** audit-specific log levels:

#### Supported Audit Levels

| Level Name | Level ID | Purpose | Recommended Use |
|------------|----------|---------|-----------------|
| `audit-api` | 100 | REST API endpoint access | **Default** - Most commonly used for API access tracking |
| `audit-content` | 101 | Content creation operations | Optional - High volume (posts, reactions, etc.) |  
| `audit-permissions` | 102 | Permission checks and failures | **Recommended** - Security and access control |
| `audit-cli` | 103 | CLI operations | Optional - Legacy, mostly unused |

### Configuration Examples

#### Basic Audit Configuration
```json
{
  "ExperimentalAuditSettings": {
    "FileEnabled": true,
    "FileName": "audit.log",
    "AdvancedLoggingJSON": {
      "audit_file": {
        "Type": "file",
        "Format": "json",
        "Levels": [
          {"ID": 100, "Name": "audit-api"},
          {"ID": 102, "Name": "audit-permissions"}
        ],
        "Options": {
          "Filename": "audit.log"
        }
      }
    }
  }
}
```

#### Comprehensive Audit Configuration
```json
{
  "ExperimentalAuditSettings": {
    "FileEnabled": true,
    "FileName": "audit.log", 
    "AdvancedLoggingJSON": {
      "audit_file": {
        "Type": "file",
        "Format": "json",
        "Levels": [
          {"ID": 100, "Name": "audit-api"},
          {"ID": 101, "Name": "audit-content"},
          {"ID": 102, "Name": "audit-permissions"},
          {"ID": 103, "Name": "audit-cli"}
        ],
        "Options": {
          "Filename": "audit.log",
          "MaxSizeMB": 100,
          "MaxAge": 30,
          "MaxBackups": 5,
          "Compress": true
        }
      },
      "audit_console": {
        "Type": "console", 
        "Format": "json",
        "Levels": [
          {"ID": 100, "Name": "audit-api"},
          {"ID": 102, "Name": "audit-permissions"}
        ]
      }
    }
  }
}
```

#### Multiple Targets Configuration
```json
{
  "ExperimentalAuditSettings": {
    "AdvancedLoggingJSON": {
      "audit_api_only": {
        "Type": "file",
        "Format": "json", 
        "Levels": [{"ID": 100, "Name": "audit-api"}],
        "Options": {"Filename": "api-audit.log"}
      },
      "audit_permissions_only": {
        "Type": "file",
        "Format": "json",
        "Levels": [{"ID": 102, "Name": "audit-permissions"}], 
        "Options": {"Filename": "permissions-audit.log"}
      },
      "audit_syslog": {
        "Type": "syslog",
        "Format": "json",
        "Levels": [
          {"ID": 100, "Name": "audit-api"},
          {"ID": 102, "Name": "audit-permissions"}
        ],
        "Options": {
          "IP": "logs.company.com:514",
          "Tag": "mattermost-audit"
        }
      }
    }
  }
}
```

## Level Usage Recommendations

### Production Environments
**Recommended minimum**: `audit-api` + `audit-permissions`
- Provides essential API access tracking
- Captures authorization failures
- Manageable log volume

### High-Security Environments  
**Recommended**: All levels except `audit-cli`
- Comprehensive audit trail
- May require log rotation planning due to volume

### Development/Testing
**Recommended**: `audit-api` only
- Minimal overhead
- Sufficient for development workflows

## Important Notes

### ❌ Validation Errors
These configurations will **fail validation** in v11.3+:

```json
// ❌ Standard levels in audit logging
{
  "ExperimentalAuditSettings": {
    "AdvancedLoggingJSON": {
      "audit": {
        "Levels": [{"ID": 4, "Name": "info"}]  // INVALID
      }
    }
  }
}
```

```json
// ❌ Audit levels in standard logging  
{
  "LogSettings": {
    "AdvancedLoggingJSON": {
      "console": {
        "Levels": [{"ID": 100, "Name": "audit-api"}]  // INVALID
      }
    }
  }
}
```

### Performance Considerations
- `audit-content` generates high log volumes - use with caution in production
- Consider separate log files for different audit levels
- Implement appropriate log rotation and retention policies

### Compliance Requirements
- `audit-api`: Required for API access compliance (SOC2, HIPAA, etc.)
- `audit-permissions`: Critical for security auditing
- `audit-content`: May be required for content governance policies