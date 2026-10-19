variable "aws_region" {
  description = "AWS region for the demonstration environment."
  type        = string
  default     = "us-east-1"
}

variable "alert_email" {
  description = "Email address for SNS alerts and AWS Budget notifications. Leave empty to skip subscriptions until configured."
  type        = string
  default     = ""
}

variable "allowed_cidr" {
  description = "Public IPv4 CIDR allowed to access Mattermost, preferably your current IP with /32 (example: 203.0.113.10/32)."
  type        = string
}

variable "budget_limit_usd" {
  description = "Monthly AWS budget notification threshold in USD. A budget alerts; it does not stop resources."
  type        = number
  default     = 40
}

variable "instance_type" {
  description = "EC2 type for the Mattermost application."
  type        = string
  default     = "t3.small"
}

variable "db_instance_class" {
  description = "Single-AZ RDS instance class for the academic demo."
  type        = string
  default     = "db.t3.micro"
}

variable "mattermost_image" {
  description = "Container image published by the repository's active CI workflow. Must be pullable by EC2 without interactive authentication."
  type        = string
  default     = "ghcr.io/sespinosab/mattermost:latest"
}

variable "name_prefix" {
  description = "Prefix used to name resources."
  type        = string
  default     = "mattermost"
}
