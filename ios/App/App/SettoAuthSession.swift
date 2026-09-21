import AuthenticationServices
import Capacitor
import Foundation
import UIKit

/**
 Narrow native transport for Setto's OAuth journeys.

 Swift owns ONLY the authentication UI/session. No OAuth or business logic
 lives here: the JavaScript layer builds the authorization URL, verifies
 `state`, and establishes the Supabase session.

 `ASWebAuthenticationSession` with an HTTPS callback
 (`https://open.setto.dk/auth/callback`) intercepts the provider redirect
 before it renders, hands the callback URL straight back to the app and
 dismisses the sheet automatically — no "Open in Setto" interstitial.

 Requires iOS 17.4 (`ASWebAuthenticationSession.Callback.https`).
 */
@objc(SettoAuthSession)
public class SettoAuthSession: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "SettoAuthSession"
    public let jsName = "SettoAuthSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startAuthentication", returnType: CAPPluginReturnPromise)
    ]

    private static let callbackHost = "open.setto.dk"
    private static let callbackPath = "/auth/callback"

    /// Strong reference for the lifetime of the session; cleared on completion.
    private var session: ASWebAuthenticationSession?
    private let contextProvider = SettoAuthPresentationContext()

    @objc func startAuthentication(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"),
              let url = URL(string: raw),
              url.scheme == "https" else {
            call.resolve(["status": "error"])
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else {
                call.resolve(["status": "error"])
                return
            }
            // Exactly one authentication session at a time.
            guard self.session == nil else {
                call.resolve(["status": "error"])
                return
            }

            if #available(iOS 17.4, *) {
                let session = ASWebAuthenticationSession(
                    url: url,
                    callback: .https(
                        host: SettoAuthSession.callbackHost,
                        path: SettoAuthSession.callbackPath
                    )
                ) { [weak self] callbackURL, error in
                    self?.session = nil
                    if let error = error as? ASWebAuthenticationSessionError,
                       error.code == .canceledLogin {
                        call.resolve(["status": "cancelled"])
                        return
                    }
                    if error != nil {
                        // Never surface provider/session error detail — it can
                        // carry the callback URL.
                        call.resolve(["status": "error"])
                        return
                    }
                    guard let callbackURL else {
                        call.resolve(["status": "error"])
                        return
                    }
                    call.resolve([
                        "status": "success",
                        "callbackUrl": callbackURL.absoluteString
                    ])
                }
                session.presentationContextProvider = self.contextProvider
                session.prefersEphemeralWebBrowserSession = false
                self.session = session
                if !session.start() {
                    self.session = nil
                    call.resolve(["status": "error"])
                }
            } else {
                call.resolve(["status": "error"])
            }
        }
    }
}

/// Anchors the authentication sheet on the current Setto window.
final class SettoAuthPresentationContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? scenes.first?.windows.first
        return window ?? ASPresentationAnchor()
    }
}
