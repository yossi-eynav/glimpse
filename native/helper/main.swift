// pw-helper: sets the macOS wallpaper for Google Photos Wallpaper.
// Protocol: specs/001-photos-wallpaper-rotation/contracts/wallpaper-helper.md
// (one JSON object per line on stdin/stdout; stderr is free-form diagnostics).

import AppKit

private let protocolVersion = 1
private let selfChangeWindow: TimeInterval = 3

private func log(_ message: String) {
    FileHandle.standardError.write(Data("pw-helper: \(message)\n".utf8))
}

@main
enum PWHelper {
    @MainActor static func main() {
        let args = CommandLine.arguments
        guard let i = args.firstIndex(of: "--photos-dir"), i + 1 < args.count else {
            log("usage: pw-helper --photos-dir <path>")
            exit(2)
        }
        Helper(photosDir: URL(fileURLWithPath: args[i + 1]).standardizedFileURL.path).run()
    }
}

/// All state lives on the main actor; stdin is read on a background thread and handed over.
@MainActor
final class Helper {
    private let photosDir: String
    private let storeURL = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/com.apple.wallpaper/Store/Index.plist")

    /// The photo to keep on every screen and Space, or nil after `clear`.
    private var current: URL?
    /// Set after the user changed the wallpaper outside the app; cleared by the next `show`.
    private var latched = false
    /// After `restore`: each display's original, re-applied to Spaces still showing our photos.
    private var restoreTargets: [String?]?
    private var lastSelfSet = Date.distantPast
    private var storeSource: DispatchSourceFileSystemObject?

    private let options: [NSWorkspace.DesktopImageOptionKey: Any] = [
        .imageScaling: NSImageScaling.scaleProportionallyUpOrDown.rawValue, // fill, keep proportions (FR-015)
        .allowClipping: true,
    ]

    init(photosDir: String) {
        self.photosDir = photosDir
    }

    func run() {
        let app = NSApplication.shared
        app.setActivationPolicy(.prohibited) // no Dock icon, no menu bar

        NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.activeSpaceDidChangeNotification, object: nil, queue: .main
        ) { [self] _ in MainActor.assumeIsolated { reapply(reason: "space") } }
        NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [self] _ in MainActor.assumeIsolated { reapply(reason: "screens") } }

        watchStore(attempt: 0)
        send(["event": "ready", "version": protocolVersion])

        // End of input means the app quit.
        Thread.detachNewThread { [self] in
            while let line = readLine() {
                if line.isEmpty { continue }
                DispatchQueue.main.async { MainActor.assumeIsolated { self.handle(line) } }
            }
            DispatchQueue.main.async { exit(0) }
        }

        app.run()
    }

    // MARK: - Output

    private func send(_ object: [String: Any]) {
        guard var data = try? JSONSerialization.data(withJSONObject: object, options: [.withoutEscapingSlashes]) else { return }
        data.append(0x0A)
        FileHandle.standardOutput.write(data)
    }

    // MARK: - Requests

    private func handle(_ line: String) {
        guard let data = line.data(using: .utf8),
              let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = request["id"] as? Int,
              let cmd = request["cmd"] as? String
        else {
            send(["id": NSNull(), "ok": false, "error": "invalid request"])
            return
        }

        switch cmd {
        case "show":
            guard let path = request["path"] as? String else {
                send(["id": id, "ok": false, "error": "missing path"])
                return
            }
            let url = URL(fileURLWithPath: path).standardizedFileURL
            var isDirectory: ObjCBool = false
            guard isOurPhoto(url.path),
                  FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory),
                  !isDirectory.boolValue
            else {
                send(["id": id, "ok": false, "error": "path is not a photo in the photos folder"])
                return
            }
            do {
                try apply(url, onlyIfDifferent: false)
                current = url
                latched = false
                restoreTargets = nil
                send(["id": id, "ok": true])
            } catch {
                send(["id": id, "ok": false, "error": error.localizedDescription])
            }
        case "get":
            send(["id": id, "ok": true, "paths": currentPaths()])
        case "restore":
            guard let raw = request["paths"] as? [Any] else {
                send(["id": id, "ok": false, "error": "missing paths"])
                return
            }
            let targets = raw.map { $0 as? String }
            current = nil
            latched = false
            restoreTargets = targets
            send(["id": id, "ok": true, "restored": restoreOurScreens(to: targets)])
        case "clear":
            current = nil
            send(["id": id, "ok": true])
        default:
            send(["id": id, "ok": false, "error": "unknown command"])
        }
    }

    // MARK: - Wallpaper

    private func currentPaths() -> [String] {
        NSScreen.screens.map { NSWorkspace.shared.desktopImageURL(for: $0)?.path ?? "" }
    }

    private func isOurPhoto(_ path: String) -> Bool {
        path.hasPrefix(photosDir + "/")
    }

    /// Sets `url` on every screen (or only those not showing it). Returns how many changed.
    @discardableResult
    private func apply(_ url: URL, onlyIfDifferent: Bool) throws -> Int {
        var changed = 0
        for screen in NSScreen.screens {
            if onlyIfDifferent, NSWorkspace.shared.desktopImageURL(for: screen)?.standardizedFileURL == url { continue }
            lastSelfSet = Date()
            try NSWorkspace.shared.setDesktopImageURL(url, for: screen, options: options)
            changed += 1
        }
        return changed
    }

    /// Re-applies the current photo after a Space switch or a display change (contract rule 2).
    private let defaultWallpaper = URL(fileURLWithPath: "/System/Library/CoreServices/DefaultDesktop.heic")

    /// Puts originals back on displays showing one of our photos; others were chosen by the user.
    /// Returns how many displays changed (contracts/wallpaper-helper-restore.md).
    @discardableResult
    private func restoreOurScreens(to targets: [String?]) -> Int {
        var restored = 0
        for (i, screen) in NSScreen.screens.enumerated() {
            guard let shown = NSWorkspace.shared.desktopImageURL(for: screen)?.path, isOurPhoto(shown) else { continue }
            var target = defaultWallpaper
            if i < targets.count, let path = targets[i] {
                var isDirectory: ObjCBool = false
                if FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory), !isDirectory.boolValue {
                    target = URL(fileURLWithPath: path)
                }
            }
            do {
                lastSelfSet = Date()
                try NSWorkspace.shared.setDesktopImageURL(target, for: screen, options: [:])
                restored += 1
            } catch {
                log("restore failed: \(error.localizedDescription)")
            }
        }
        return restored
    }

    private func reapply(reason: String) {
        if current == nil, let targets = restoreTargets {
            restoreOurScreens(to: targets)
            return
        }
        guard let url = current, !latched else { return }
        do {
            if try apply(url, onlyIfDifferent: true) > 0 {
                send(["event": "applied", "reason": reason, "path": url.path])
            }
        } catch {
            log("re-apply failed: \(error.localizedDescription)")
        }
    }

    // MARK: - External change detection (contract rules 3–4)

    /// Watches the macOS 14+ wallpaper store as a "something changed" signal. Its format is
    /// undocumented, so it is never parsed.
    private func watchStore(attempt: Int) {
        let fd = open(storeURL.path, O_EVTONLY)
        guard fd >= 0 else {
            if attempt == 0 { log("wallpaper store not found; manual changes are checked only before scheduled changes") }
            if attempt < 10 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { MainActor.assumeIsolated { self.watchStore(attempt: attempt + 1) } }
            }
            return
        }
        let source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: [.write, .rename, .delete], queue: .main)
        source.setEventHandler { [self] in
            MainActor.assumeIsolated {
                let replaced = !source.data.isDisjoint(with: [.rename, .delete])
                storeChanged()
                if replaced {
                    // macOS replaces the file atomically; watch the new one.
                    source.cancel()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { MainActor.assumeIsolated { self.watchStore(attempt: 1) } }
                }
            }
        }
        source.setCancelHandler { close(fd) }
        source.resume()
        storeSource = source
    }

    private func storeChanged() {
        guard current != nil, !latched, Date().timeIntervalSince(lastSelfSet) >= selfChangeWindow else { return }
        let paths = currentPaths()
        guard paths.contains(where: { !isOurPhoto($0) }) else { return }
        latched = true
        send(["event": "externalChange", "paths": paths])
    }
}
