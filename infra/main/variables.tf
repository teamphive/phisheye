variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Name des Projekts / Prefix für Ressourcen"
  type        = string
  default     = "phisheye"
}

variable "budget_alert_emails" {
  description = "E-Mail-Adressen für Budget-Benachrichtigungen"
  type        = list(string)
}
