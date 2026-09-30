"""Creates the Keycloak account of the first instance admin and mails the link
to set the password. Run once on a new server:
docker compose --profile app exec backend python -m scripts.bootstrap_admin"""

import asyncio
import os
import sys

from app.services import keycloak_admin


async def main() -> None:
    email = os.getenv("PHISHEYE_ADMIN_EMAIL", "").strip().lower()

    if not email:
        sys.exit("Set PHISHEYE_ADMIN_EMAIL in .env first")

    if not keycloak_admin.is_configured():
        sys.exit("KEYCLOAK_SERVICE_CLIENT_SECRET is missing")

    user = await keycloak_admin.find_user(email)

    if user and await keycloak_admin.has_password(user["id"]):
        sys.exit(f"{email} has a password already")

    user_id = user["id"] if user else await keycloak_admin.create_user(email)
    await keycloak_admin.send_setup_email(user_id)

    print(f"Mail with the setup link sent to {email}")


if __name__ == "__main__":
    asyncio.run(main())
