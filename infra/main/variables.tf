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

variable "environment" {
  description = "Umgebung (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR Block der VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "Liste der Availability Zones"
  type        = list(string)
  default     = ["eu-central-1a", "eu-central-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR Blocks für öffentliche Subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR Blocks für private Subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}
