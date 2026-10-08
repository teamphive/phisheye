/**
 * This file has been claimed for ownership from @keycloakify/login-ui version 250004.8.0.
 * To relinquish ownership and restore this file to its original content, run the following command:
 *
 * $ npx keycloakify own --path "login/components/Template/Template.tsx" --revert
 *
 * Owned only to fix an import: the package ships tools/useSetClassname, the
 * upstream file asks for useSetClassName. macOS forgives the casing, the Linux
 * runner in CI does not. The rest is upstream code, linted as little as the
 * synced files.
 */

/* eslint-disable */

import type { ReactNode } from "react"
import { useEffect } from "react"
import { clsx } from "@keycloakify/login-ui/tools/clsx"
import { kcSanitize } from "@keycloakify/login-ui/kcSanitize"
import { useSetClassName } from "@keycloakify/login-ui/tools/useSetClassname"
import { useInitializeTemplate } from "./useInitializeTemplate"
import { useKcClsx } from "@keycloakify/login-ui/useKcClsx"
import { useI18n } from "../../i18n"
import { useKcContext } from "../../KcContext"

export function Template(props: {
  displayInfo?: boolean
  displayMessage?: boolean
  displayRequiredFields?: boolean
  headerNode: ReactNode
  socialProvidersNode?: ReactNode
  infoNode?: ReactNode
  documentTitle?: string
  bodyClassName?: string
  children: ReactNode
}) {
  const {
    displayInfo = false,
    displayMessage = true,
    displayRequiredFields = false,
    headerNode,
    socialProvidersNode = null,
    infoNode = null,
    documentTitle,
    bodyClassName,
    children,
  } = props

  const { kcContext } = useKcContext()

  const { msg, msgStr, currentLanguage, enabledLanguages } = useI18n()

  const { kcClsx } = useKcClsx()

  useEffect(() => {
    document.title =
      documentTitle ??
      msgStr("loginTitle", kcContext.realm.displayName || kcContext.realm.name)
  }, [])

  // Replace the Keycloak default icon with the phisheye favicon.
  useEffect(() => {
    document
      .querySelectorAll('link[rel~="icon"]')
      .forEach((link) => link.remove())
    const link = document.createElement("link")
    link.rel = "icon"
    link.type = "image/svg+xml"
    link.href =
      "data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20256%20256%22%3E%3Ctitle%3Ephisheye%3C/title%3E%3Crect%20width=%22256%22%20height=%22256%22%20rx=%2258%22%20fill=%22%2316203A%22/%3E%3Cg%20transform=%22translate(128%20128)%20scale(0.86)%20translate(-126%20-128)%22%3E%3Cpath%20fill=%22%237da3f5%22%20fill-rule=%22evenodd%22%20d=%22M158%2021A55%2055%200%201%201%20158%20131A55%2055%200%201%201%20158%2021ZM158%2048A28%2028%200%201%200%20158%20104A28%2028%200%201%200%20158%2048Z%22/%3E%3Ccircle%20cx=%22158%22%20cy=%2276%22%20r=%2213%22%20fill=%22%237da3f5%22/%3E%3Cpath%20fill=%22%237da3f5%22%20d=%22M143%20104V168A37%2037%200%200%201%2069%20168V138L46%20108L39%20168A67%2067%200%200%200%20173%20168V104Z%22/%3E%3C/g%3E%3C/svg%3E"
    document.head.appendChild(link)
  }, [])

  useSetClassName({
    qualifiedName: "html",
    className: kcClsx("kcHtmlClass"),
  })

  useSetClassName({
    qualifiedName: "body",
    className: bodyClassName ?? kcClsx("kcBodyClass"),
  })

  const { isReadyToRender } = useInitializeTemplate()

  if (!isReadyToRender) {
    return null
  }

  return (
    <div className={kcClsx("kcLoginClass")}>
      <div id="kc-header" className={kcClsx("kcHeaderClass")}>
        <div id="kc-header-wrapper" className={kcClsx("kcHeaderWrapperClass")}>
          {msg(
            "loginTitleHtml",
            kcContext.realm.displayNameHtml || kcContext.realm.name
          )}
        </div>
      </div>
      <div className={kcClsx("kcFormCardClass")}>
        <header className={kcClsx("kcFormHeaderClass")}>
          {enabledLanguages.length > 1 && (
            <div className={kcClsx("kcLocaleMainClass")} id="kc-locale">
              <div
                id="kc-locale-wrapper"
                className={kcClsx("kcLocaleWrapperClass")}
              >
                <div
                  id="kc-locale-dropdown"
                  className={clsx(
                    "menu-button-links",
                    kcClsx("kcLocaleDropDownClass")
                  )}
                >
                  <button
                    tabIndex={1}
                    id="kc-current-locale-link"
                    aria-label={msgStr("languages")}
                    aria-haspopup="true"
                    aria-expanded="false"
                    aria-controls="language-switch1"
                  >
                    {currentLanguage.label}
                  </button>
                  <ul
                    role="menu"
                    tabIndex={-1}
                    aria-labelledby="kc-current-locale-link"
                    aria-activedescendant=""
                    id="language-switch1"
                    className={kcClsx("kcLocaleListClass")}
                  >
                    {enabledLanguages.map(({ languageTag, label, href }, i) => (
                      <li
                        key={languageTag}
                        className={kcClsx("kcLocaleListItemClass")}
                        role="none"
                      >
                        <a
                          role="menuitem"
                          id={`language-${i + 1}`}
                          className={kcClsx("kcLocaleItemClass")}
                          href={href}
                        >
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          {(() => {
            const node = !(
              kcContext.auth !== undefined &&
              kcContext.auth.showUsername &&
              !kcContext.auth.showResetCredentials
            ) ? (
              <h1 id="kc-page-title">{headerNode}</h1>
            ) : (
              <div id="kc-username" className={kcClsx("kcFormGroupClass")}>
                <label id="kc-attempted-username">
                  {kcContext.auth.attemptedUsername}
                </label>
                <a
                  id="reset-login"
                  href={kcContext.url.loginRestartFlowUrl}
                  aria-label={msgStr("restartLoginTooltip")}
                >
                  <div className="kc-login-tooltip">
                    <i className={kcClsx("kcResetFlowIcon")}></i>
                    <span className="kc-tooltip-text">
                      {msg("restartLoginTooltip")}
                    </span>
                  </div>
                </a>
              </div>
            )

            if (displayRequiredFields) {
              return (
                <div className={kcClsx("kcContentWrapperClass")}>
                  <div
                    className={clsx(kcClsx("kcLabelWrapperClass"), "subtitle")}
                  >
                    <span className="subtitle">
                      <span className="required">*</span>
                      {msg("requiredFields")}
                    </span>
                  </div>
                  <div className="col-md-10">{node}</div>
                </div>
              )
            }

            return node
          })()}
        </header>
        <div id="kc-content">
          <div id="kc-content-wrapper">
            {/* App-initiated actions should not see warning messages about the need to complete the action during login. */}
            {displayMessage &&
              kcContext.message !== undefined &&
              (kcContext.message.type !== "warning" ||
                !kcContext.isAppInitiatedAction) && (
                <div
                  className={clsx(
                    `alert-${kcContext.message.type}`,
                    kcClsx("kcAlertClass"),
                    `pf-m-${kcContext.message?.type === "error" ? "danger" : kcContext.message.type}`
                  )}
                >
                  <div className="pf-c-alert__icon">
                    {kcContext.message.type === "success" && (
                      <span className={kcClsx("kcFeedbackSuccessIcon")}></span>
                    )}
                    {kcContext.message.type === "warning" && (
                      <span className={kcClsx("kcFeedbackWarningIcon")}></span>
                    )}
                    {kcContext.message.type === "error" && (
                      <span className={kcClsx("kcFeedbackErrorIcon")}></span>
                    )}
                    {kcContext.message.type === "info" && (
                      <span className={kcClsx("kcFeedbackInfoIcon")}></span>
                    )}
                  </div>
                  <span
                    className={kcClsx("kcAlertTitleClass")}
                    dangerouslySetInnerHTML={{
                      __html: kcSanitize(kcContext.message.summary),
                    }}
                  />
                </div>
              )}
            {children}
            {kcContext.auth !== undefined &&
              kcContext.auth.showTryAnotherWayLink && (
                <form
                  id="kc-select-try-another-way-form"
                  action={kcContext.url.loginAction}
                  method="post"
                >
                  <div className={kcClsx("kcFormGroupClass")}>
                    <input type="hidden" name="tryAnotherWay" value="on" />
                    <a
                      href="#"
                      id="try-another-way"
                      onClick={(event) => {
                        event.preventDefault()
                        document.forms[
                          "kc-select-try-another-way-form" as never
                        ].requestSubmit()

                        return false
                      }}
                    >
                      {msg("doTryAnotherWay")}
                    </a>
                  </div>
                </form>
              )}
            {socialProvidersNode}
            {displayInfo && (
              <div id="kc-info" className={kcClsx("kcSignUpClass")}>
                <div
                  id="kc-info-wrapper"
                  className={kcClsx("kcInfoAreaWrapperClass")}
                >
                  {infoNode}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
