// Shows the photo the Google Photos Wallpaper app is currently using as the wallpaper.
// Reads the handoff folder described in specs/001-photos-wallpaper-rotation/contracts/screensaver-handoff.md.

import AppKit
import QuartzCore
import ScreenSaver

private struct Manifest: Decodable {
    let version: Int
    let photoId: String?
    let enabled: Bool
}

@objc(PhotoWallpaperSaverView)
final class PhotoWallpaperSaverView: ScreenSaverView {
    private let imageLayer = CALayer()
    private let messageLayer = CATextLayer()
    private var shownPhotoId: String?
    private var shownDisabled = false

    /// Inside the legacyScreenSaver sandbox, NSHomeDirectory() is the host's container,
    /// so this resolves to …/Containers/com.apple.ScreenSaver.Engine.legacyScreenSaver/Data/Library/Application Support/PhotoWallpaper.
    private let handoffDir = URL(fileURLWithPath: NSHomeDirectory())
        .appendingPathComponent("Library/Application Support/PhotoWallpaper", isDirectory: true)

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        setUp()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setUp()
    }

    private func setUp() {
        animationTimeInterval = 1.0
        wantsLayer = true
        layer?.backgroundColor = NSColor.black.cgColor

        imageLayer.frame = bounds
        imageLayer.contentsGravity = .resizeAspectFill // fill, keep proportions, center crop (FR-015)
        imageLayer.masksToBounds = true
        imageLayer.autoresizingMask = [.layerWidthSizable, .layerHeightSizable]
        layer?.addSublayer(imageLayer)

        messageLayer.frame = bounds.insetBy(dx: 40, dy: bounds.height / 2 - 20)
        messageLayer.alignmentMode = .center
        messageLayer.fontSize = isPreview ? 10 : 18
        messageLayer.foregroundColor = NSColor(white: 0.8, alpha: 1).cgColor
        messageLayer.contentsScale = NSScreen.main?.backingScaleFactor ?? 2
        messageLayer.isHidden = true
        layer?.addSublayer(messageLayer)

        refresh()
    }

    override func animateOneFrame() {
        refresh()
    }

    /// Reloads the image only when the manifest names a different photo. Never throws.
    private func refresh() {
        guard
            let data = try? Data(contentsOf: handoffDir.appendingPathComponent("manifest.json")),
            let manifest = try? JSONDecoder().decode(Manifest.self, from: data),
            manifest.version == 1
        else {
            showBlack()
            return
        }

        if !manifest.enabled {
            guard !shownDisabled else { return }
            showBlack()
            shownDisabled = true
            messageLayer.string = "Google Photos Wallpaper is turned off in the menu"
            messageLayer.isHidden = false
            return
        }

        guard let photoId = manifest.photoId, photoId != shownPhotoId else { return }
        guard let image = NSImage(contentsOf: handoffDir.appendingPathComponent("current.jpg")) else {
            showBlack()
            return
        }

        let fade = CATransition()
        fade.duration = shownPhotoId == nil ? 0 : 0.5
        fade.type = .fade
        imageLayer.add(fade, forKey: "contents")
        imageLayer.contents = image
        messageLayer.isHidden = true
        shownDisabled = false
        shownPhotoId = photoId
    }

    private func showBlack() {
        imageLayer.contents = nil
        messageLayer.isHidden = true
        shownPhotoId = nil
        shownDisabled = false
    }
}
