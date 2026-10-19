output "application_url" {
  description = "Mattermost endpoint. HTTP only for this low-cost academic lab; do not use for production."
  value       = "http://${module.compute.elastic_ip_address}:8065"
}

output "primary_instance_id" { value = module.compute.primary_instance_id }
output "standby_instance_id" { value = module.compute.standby_instance_id }
output "rds_endpoint" { value = module.database.endpoint }
output "s3_bucket_name" { value = module.storage.bucket_name }
output "application_log_group" { value = module.observability.application_log_group_name }
output "monthly_budget_usd" { value = var.budget_limit_usd }
