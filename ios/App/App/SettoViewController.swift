import UIKit
import WebKit
import Capacitor

/**
 Setto's native shell over Capacitor's bridge controller.

 Three narrowly scoped native behaviours:

 1. Real UIScrollView rubber-band bounce (no JS imitation).
 2. The WebView, its scroll view and the hosting view painted in the current
    Setto background, so an overscroll never reveals the default white
    WKWebView surface. The web layer pushes theme changes down through the
    `settoSurface` script message handler.
 3. The native left-edge back/forward navigation gesture.
 */
class SettoViewController: CAPBridgeViewController, WKScriptMessageHandler {

    /// Mirrors --color-background (light) until the web layer reports a theme.
    private var surfaceColor = UIColor(red: 0.969, green: 0.965, blue: 0.949, alpha: 1.0)

    override func viewDidLoad() {
        super.viewDidLoad()
        configureNativeFeel()
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.webView?.configuration.userContentController.add(self, name: "settoSurface")
    }

    private func configureNativeFeel() {
        guard let webView = self.webView else { return }

        // Native iOS rubber-band, vertical, also on short pages.
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceVertical = true
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // Native interactive edge-swipe back; history stays canonical.
        webView.allowsBackForwardNavigationGestures = true

        applySurfaceColor()
    }

    private func applySurfaceColor() {
        view.backgroundColor = surfaceColor
        view.window?.backgroundColor = surfaceColor
        guard let webView = self.webView else { return }
        webView.isOpaque = false
        webView.backgroundColor = surfaceColor
        webView.scrollView.backgroundColor = surfaceColor
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard message.name == "settoSurface",
              let hex = message.body as? String,
              let color = UIColor(settoHex: hex) else { return }
        surfaceColor = color
        DispatchQueue.main.async { [weak self] in
            self?.applySurfaceColor()
        }
    }
}

private extension UIColor {
    /// Accepts `#RRGGBB` / `RRGGBB` only — anything else is rejected.
    convenience init?(settoHex raw: String) {
        var hex = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6, let value = UInt32(hex, radix: 16) else { return nil }
        self.init(
            red: CGFloat((value & 0xFF0000) >> 16) / 255.0,
            green: CGFloat((value & 0x00FF00) >> 8) / 255.0,
            blue: CGFloat(value & 0x0000FF) / 255.0,
            alpha: 1.0
        )
    }
}
