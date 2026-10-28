type Emitter = { on(event: string, listener: () => void): unknown };

type EngineLike = {
  displaysChanged(): Promise<void>;
  tick(): Promise<void>;
};

/** Forwards macOS display and power events to the rotation engine. */
export function wireSystemEvents(deps: { screen: Emitter; powerMonitor: Emitter; engine: EngineLike }): void {
  const { screen, powerMonitor, engine } = deps;
  screen.on('display-added', () => void engine.displaysChanged());
  screen.on('display-removed', () => void engine.displaysChanged());
  // One deadline means at most one catch-up change after sleep (FR-017).
  powerMonitor.on('resume', () => void engine.tick());
}
