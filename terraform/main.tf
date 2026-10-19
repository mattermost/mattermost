data "aws_availability_zones" "available" {
  state = "available"
  filter {
    name   = "zone-id"
    values = ["use1-az1", "use1-az2"]
  }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

resource "random_password" "database" {
  length  = 32
  special = false
}

module "network" {
  source      = "./modules/network"
  name_prefix = var.name_prefix
  az_a        = data.aws_availability_zones.available.names[0]
  az_b        = data.aws_availability_zones.available.names[1]
}

module "security" {
  source       = "./modules/security"
  name_prefix  = var.name_prefix
  vpc_id       = module.network.vpc_id
  allowed_cidr = var.allowed_cidr
}

module "database" {
  source                     = "./modules/database"
  name_prefix                = var.name_prefix
  private_subnet_ids         = module.network.private_subnet_ids
  database_security_group_id = module.security.database_security_group_id
  database_password          = random_password.database.result
  db_instance_class          = var.db_instance_class
}

module "storage" {
  source      = "./modules/storage"
  name_prefix = var.name_prefix
}

module "observability" {
  source           = "./modules/observability"
  name_prefix      = var.name_prefix
  alert_email      = var.alert_email
  budget_limit_usd = var.budget_limit_usd
}

resource "aws_ssm_parameter" "database_password" {
  #checkov:skip=CKV_AWS_337:SecureString is encrypted with the AWS-managed SSM KMS key; a customer-managed key adds fixed cost to this academic demo.
  name        = "/${var.name_prefix}/database/password"
  description = "Mattermost RDS password. Read only by the EC2 instance role."
  type        = "SecureString"
  value       = random_password.database.result
  overwrite   = true
  tags        = { Name = "${var.name_prefix}-database-password" }
}

module "compute" {
  source                           = "./modules/compute"
  name_prefix                      = var.name_prefix
  aws_region                       = var.aws_region
  ami_id                           = data.aws_ami.amazon_linux.id
  instance_type                    = var.instance_type
  public_subnet_a_id               = module.network.public_subnet_a_id
  public_subnet_b_id               = module.network.public_subnet_b_id
  application_security_group_id    = module.security.application_security_group_id
  database_endpoint                = module.database.endpoint
  database_name                    = module.database.database_name
  database_username                = module.database.database_username
  database_password_parameter_name = aws_ssm_parameter.database_password.name
  s3_bucket_name                   = module.storage.bucket_name
  mattermost_image                 = var.mattermost_image
  log_group_name                   = module.observability.application_log_group_name
}

module "failover" {
  source                   = "./modules/failover"
  name_prefix              = var.name_prefix
  aws_region               = var.aws_region
  primary_instance_id      = module.compute.primary_instance_id
  standby_instance_id      = module.compute.standby_instance_id
  elastic_ip_allocation_id = module.compute.elastic_ip_allocation_id
  notification_topic_arn   = module.observability.notification_topic_arn
  depends_on               = [module.compute, module.observability]
}

resource "aws_cloudwatch_metric_alarm" "primary_status_check" {
  alarm_name          = "${var.name_prefix}-primary-status-check-failed"
  alarm_description   = "Primary EC2 status checks failed; scheduled failover monitor also checks Mattermost HTTP health."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_Instance"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions          = { InstanceId = module.compute.primary_instance_id }
  alarm_actions       = [module.observability.notification_topic_arn]
  ok_actions          = [module.observability.notification_topic_arn]
}

resource "aws_cloudwatch_log_metric_filter" "application_errors" {
  name           = "${var.name_prefix}-application-errors"
  log_group_name = module.observability.application_log_group_name
  pattern        = "ERROR"
  metric_transformation {
    name      = "ApplicationErrorCount"
    namespace = "Mattermost/Application"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "application_errors" {
  alarm_name          = "${var.name_prefix}-application-errors"
  alarm_description   = "Mattermost application logs contain repeated ERROR entries."
  namespace           = "Mattermost/Application"
  metric_name         = "ApplicationErrorCount"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [module.observability.notification_topic_arn]
}
