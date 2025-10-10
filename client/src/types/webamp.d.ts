declare module 'webamp/butterchurn' {
  export default class Webamp {
    constructor(options: any);
    renderWhenReady(container: HTMLElement): Promise<void>;
    onClose(callback: () => void): void;
    dispose(): void;
    play(): void;
    pause(): void;
    stop(): void;
    nextTrack(): void;
    previousTrack(): void;
  }
}

declare module 'butterchurn-presets' {
  const presets: {
    default: {
      getPresets(): any;
    };
  };
  export default presets;
}
