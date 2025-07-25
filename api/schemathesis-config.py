"""
Schemathesis configuration for Mattermost API contract testing
"""
import schemathesis
import os

# Skip endpoints that require special setup or are not suitable for automated testing
SKIP_ENDPOINTS = [
    # File upload endpoints (require multipart data)
    "/api/v4/files",
    "/api/v4/files/upload",
    
    # SAML endpoints (require SAML setup)
    "/api/v4/saml/certificate/idp",
    "/api/v4/saml/certificate/public",
    "/api/v4/saml/certificate/private",
    
    # LDAP endpoints (require LDAP server configuration)
    "/api/v4/ldap/sync",
    "/api/v4/ldap/test",
    
    # Plugin endpoints (require plugin installation)
    "/api/v4/plugins/install_from_url",
    "/api/v4/plugins/statuses",
    
    # System endpoints that might affect server state
    "/api/v4/system/notices",
    "/api/v4/database/recycle",
    
    # Clustering endpoints (require cluster setup)
    "/api/v4/cluster/status",
    
    # Compliance endpoints (require compliance features)
    "/api/v4/compliance/reports",
    
    # Elasticsearch endpoints (require elasticsearch setup)
    "/api/v4/elasticsearch/test",
    
    # OAuth endpoints (require OAuth apps)
    "/api/v4/oauth/apps",
    
    # Bot endpoints (require bot setup)
    "/api/v4/bots",
]

def should_skip_endpoint(operation):
    """Check if an endpoint should be skipped"""
    path = operation.path_name
    
    for skip_pattern in SKIP_ENDPOINTS:
        if skip_pattern in path:
            return True
    
    # Skip DELETE operations on system resources
    if operation.method.upper() == "DELETE" and "/system/" in path:
        return True
        
    # Skip POST/PUT operations that might create system state changes
    if operation.method.upper() in ["POST", "PUT"] and any(x in path for x in ["/system/", "/cluster/", "/compliance/"]):
        return True
    
    return False

# Custom auth strategy
@schemathesis.auth()
def auth_strategy(case, headers):
    """Add Bearer token authentication"""
    token = os.environ.get('API_TOKEN')
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def configure_schemathesis(schema):
    """Configure schemathesis for Mattermost API testing"""
    # Apply filters
    for operation in schema.get_all_operations():
        if should_skip_endpoint(operation):
            schemathesis.skip(operation)
    
    # Set up authentication
    schema.add_auth(auth_strategy)
    
    return schema