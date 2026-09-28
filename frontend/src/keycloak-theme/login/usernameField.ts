type Realm = {
  loginWithEmailAllowed: boolean
  registrationEmailAsUsername: boolean
}

/** Label and input type of the username field, after what the realm accepts. */
export function usernameField(realm: Realm) {
  if (!realm.loginWithEmailAllowed) {
    return { label: "Benutzername", type: "text" }
  }

  if (realm.registrationEmailAsUsername) {
    return { label: "E-Mail-Adresse", type: "email" }
  }

  return { label: "E-Mail-Adresse oder Benutzername", type: "text" }
}
