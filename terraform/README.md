# Mattermost - Entregable 2 (Terraform / AWS)

This is an initial implementation scaffold for the agreed academic demo. It does **not** deploy anything until `terraform apply` is explicitly run.

## Architecture and cost choices

- Region defaults to `us-east-1`.
- One EC2 `t3.small` runs Mattermost; a second `t3.small` is in a different AZ and shuts itself down after first boot. It is started by a scheduled Lambda failover controller.
- A single-AZ RDS PostgreSQL instance is shared by the active app instance and standby. This is intentionally **not** full HA for the database.
- One Elastic IP is the stable endpoint and is reassociated to the standby during failover. No ALB or NAT Gateway is provisioned to reduce cost.
- S3 is configured as Mattermost's file store. Validate the exact S3 setting names against the version/image used before deployment.
- The app's Docker logs go to CloudWatch Logs (7-day retention). CloudWatch alarms and SNS notify an email address. The Lambda checks the app via Systems Manager Run Command, so port 8065 does not need to be open to the Lambda.
- AWS Budgets alerts at 50% and 75% actual cost and 90% forecast against a $40 monthly threshold. Because the project crosses October and November, this is a per-calendar-month threshold; it is not a cumulative cap. The planning target is to keep total project spend under $80 across both months and preserve $20 of the $100 credit. **AWS Budgets only notifies; it does not stop spending or terminate resources.**
- No SSH ingress is opened. Mattermost port 8065 is allowed only from `allowed_cidr`; use your current public IP with `/32`.

## Important prerequisites before `terraform apply`

1. Confirm that the GitHub Container Registry package `ghcr.io/sespinosab/mattermost:latest` is public/pullable without interactive login. The repository workflow builds and publishes it on pushes to `master`/`main`, but package visibility is controlled separately. If it is private, change the image publishing/access strategy before deployment.
2. Replace the example values in `terraform.tfvars.example` and copy it to `terraform.tfvars`:
   - `alert_email`: your email address (SNS sends a confirmation link).
   - `allowed_cidr`: your public IP in CIDR notation, e.g. `198.51.100.23/32` (example IP is not real).
3. Check AWS Billing credits and service eligibility. A Terraform budget sends alerts but is not a hard spending cap. Keep the planned resource lifetime short and destroy the environment after the presentation.
4. Make sure your AWS identity has permissions to create VPC/EC2/RDS/S3/IAM/Lambda/CloudWatch/SNS/SSM/Budgets resources.
5. The generated RDS password appears in Terraform state. The state file is sensitive: do not commit `terraform.tfstate`, `.terraform/`, `*.tfvars`, or plan files. This starter uses local state for simplicity; for a shared/team environment, configure an encrypted S3 backend with locking before deployment. The CI snippet formats the Terraform files before validation; run `terraform fmt -recursive` locally and commit the formatted output before the final submission. Checkov is initially non-blocking while the team reviews cost-driven exceptions such as Single-AZ RDS; tighten this gate after the findings are reviewed.
6. This is a demo over HTTP (port 8065), not a production-ready public service. The source IP restriction is required; do not set `allowed_cidr = "0.0.0.0/0"`.

## Initialize and validate locally

From this directory:

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars first
terraform fmt -recursive
terraform init
terraform validate
terraform plan -out=mattermost.tfplan
```

Review the plan and estimated costs before applying. No AWS resources are created by `init`, `validate`, or `plan`.

```bash
terraform apply mattermost.tfplan
```

After the presentation and after saving evidence:

```bash
terraform destroy
```

Then check AWS Billing and confirm no retained snapshots, unattached EBS volumes, S3 objects, Elastic IPs, or other billable resources remain.

## Known limitations / validation items

- RDS is Single-AZ, so the database remains a single point of failure.
- The secondary EC2 self-stops after its initial boot; the failover Lambda starts it and reassigns the Elastic IP. Failback to the primary is deliberately not automatic.
- The secondary needs to be able to pull the configured image on first boot. Confirm the GHCR package is public.
- Mattermost Team Edition does not automatically become a multi-node HA cluster. This design is **application-instance recovery**, not an Enterprise clustered HA deployment.
- Validate Mattermost S3 storage environment variable names and IAM-role credential support against the image version before applying.
- This code has not been run through `terraform validate` in this environment because the Terraform CLI is not installed here. Run the validation commands above before any deployment.

## GitHub Actions CI/CD

The workflow in `.github/workflows/terraform-ci.yml` validates Terraform
formatting and configuration. Pushes to `infra/mattermost-terraform` also
run `terraform plan` through AWS OIDC. No automatic `terraform apply` is configured.
