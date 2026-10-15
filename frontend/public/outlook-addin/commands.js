// ribbon button "Melden": new mail to the report mailbox, open mail attached
const REPORT_ADDRESS = "report@phishing.neumanns.nrw"

function showError(item, message) {
  item.notificationMessages.addAsync("reportFailed", {
    type: Office.MailboxEnums.ItemNotificationMessageType.ErrorMessage,
    message,
  })
}

function report(event) {
  const item = Office.context.mailbox.item

  try {
    Office.context.mailbox.displayNewMessageForm({
      toRecipients: [REPORT_ADDRESS],
      subject: "Phishing-Meldung: " + (item.subject || "ohne Betreff"),
      htmlBody:
        "<p>Ich melde die angehängte Mail als verdächtig. Ich habe keine Links geöffnet.</p>",
      attachments: [
        {
          type: Office.MailboxEnums.AttachmentType.Item,
          name: item.subject || "Gemeldete Mail",
          itemId: item.itemId,
        },
      ],
    })
  } catch (error) {
    showError(item, "Die Meldung konnte nicht vorbereitet werden.")
  }

  event.completed()
}

Office.onReady(() => {
  Office.actions.associate("report", report)
})
