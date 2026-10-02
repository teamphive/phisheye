DEFAULT_TEAM_NAME = "Standard-Team"
SYSTEM_USER_EMAIL = "system@phisheye.internal"
SYSTEM_USER_NAME = "PhishEye System"

# From docs/detection-criteria.md: 0-39 clean, 40-74 suspicious, 75-100 phishing
VERDICT_THRESHOLDS = {"suspicious": 40, "phishing": 75}

# Jobs one worker runs at the same time, GET /queue reports it as worker count
WORKER_MAX_JOBS = 10
# Tries per analysis before it counts as failed
MAX_ANALYSIS_TRIES = 3
