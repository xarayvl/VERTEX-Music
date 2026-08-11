import { Track } from '../types';

const MAX_CACHED_TRACKS = 5;
type AudioPreloadMode = 'auto' | 'metadata';

interface NetworkConnectionLike {
  type?: string;
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
}

interface CachedAudioEntry {
  key: string;
  url: string;
  audio: HTMLAudioElement;
  mediaSource: MediaElementAudioSourceNode | null;
  preloadMode: AudioPreloadMode;
  hasPlayed: boolean;
}

class AudioEngine {
  private audio: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private currentEQ = { bass: 0, mid: 0, treble: 0 };
  private isRealAudioPlaying = false;
  private currentAudioUrl = '';
  private currentTrackKey = '';
  private readonly audioCache = new Map<string, CachedAudioEntry>();
  private onTimeUpdateCallback: ((currentTime: number, duration: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onPlaybackStateChangeCallback: ((isPlaying: boolean) => void) | null = null;
  private currentVolume = 0.8;

  constructor() {
    // This idle element keeps the rest of the engine simple before the first
    // track is selected. Real playback elements live in the five-track cache.
    this.audio = this.createAudioElement('auto');
    this.getNetworkConnection()?.addEventListener?.('change', () => {
      this.refreshPendingPreloadsForConnection();
    });
  }

  private getNetworkConnection(): NetworkConnectionLike | null {
    if (typeof navigator === 'undefined') return null;
    const networkNavigator = navigator as Navigator & {
      connection?: NetworkConnectionLike;
      mozConnection?: NetworkConnectionLike;
      webkitConnection?: NetworkConnectionLike;
    };
    return networkNavigator.connection || networkNavigator.mozConnection || networkNavigator.webkitConnection || null;
  }

  private getStandbyPreloadMode(): AudioPreloadMode {
    const connection = this.getNetworkConnection();
    if (!connection) return 'auto';

    const connectionType = String(connection.type || '').toLowerCase();
    const effectiveType = String(connection.effectiveType || '').toLowerCase();

    // Explicit physical connection type wins. saveData is honored on every
    // connection, while low effective speeds use the conservative one-range
    // policy even when the browser hides whether the radio is Wi-Fi/cellular.
    if (connection.saveData) return 'metadata';
    if (connectionType === 'wifi' || connectionType === 'ethernet') return 'auto';
    if (['cellular', '2g', '3g', '4g', '5g'].includes(connectionType)) return 'metadata';
    if (['slow-2g', '2g', '3g'].includes(effectiveType)) return 'metadata';
    return 'auto';
  }

  private refreshPendingPreloadsForConnection() {
    const nextMode = this.getStandbyPreloadMode();
    for (const entry of this.audioCache.values()) {
      // Never reset the playing song or a historical cache entry. Only an
      // upcoming, not-yet-played preload needs its download policy changed.
      if (entry.key === this.currentTrackKey || entry.hasPlayed || entry.preloadMode === nextMode) continue;
      entry.preloadMode = nextMode;
      entry.audio.preload = nextMode;
      // Reloading an inactive entry aborts an aggressive Wi-Fi preload when
      // the device moves to cellular, or expands it after returning to Wi-Fi.
      entry.audio.load();
    }
  }

  private createAudioElement(preloadMode: AudioPreloadMode): HTMLAudioElement {
    const audio = new Audio();
    // Browsers fetch media in byte ranges. Keeping a dedicated element alive
    // preserves those first buffered ranges so the prepared track can start
    // without assigning and loading its source again.
    audio.preload = preloadMode;
    audio.volume = this.currentVolume;

    audio.ontimeupdate = () => {
      if (audio !== this.audio) return;
      if (this.isRealAudioPlaying && this.onTimeUpdateCallback) {
        const cur = audio.currentTime || 0;
        const dur = audio.duration || 0;
        this.onTimeUpdateCallback(cur, dur);
      }
    };

    // Native media keys can control the active audio element without going
    // through React. Events from standby cache entries are intentionally
    // ignored so a background preload cannot change the visible player state.
    audio.onplay = () => {
      if (audio !== this.audio) return;
      this.isRealAudioPlaying = true;
      this.onPlaybackStateChangeCallback?.(true);
    };

    audio.onpause = () => {
      if (audio !== this.audio || audio.ended) return;
      this.isRealAudioPlaying = false;
      this.onPlaybackStateChangeCallback?.(false);
    };

    audio.onended = () => {
      if (audio !== this.audio) return;
      const shouldAdvance = this.isRealAudioPlaying;
      this.isRealAudioPlaying = false;
      this.onPlaybackStateChangeCallback?.(false);
      if (shouldAdvance) this.onEndedCallback?.();
    };

    audio.onerror = () => this.handleAudioError(audio);
    return audio;
  }

  private handleAudioError(audio: HTMLAudioElement) {
    const err = audio.error;
    let codeName = 'MEDIA_ERR_UNKNOWN';
    let errorMeaning = 'An unknown audio element error occurred.';

    if (err) {
      switch (err.code) {
        case 1:
          codeName = 'MEDIA_ERR_ABORTED (1)';
          errorMeaning = 'The fetching process for the media resource was aborted by the user agent.';
          break;
        case 2:
          codeName = 'MEDIA_ERR_NETWORK (2)';
          errorMeaning = 'A network error occurred while fetching the audio stream from R2 or server.';
          break;
        case 3:
          codeName = 'MEDIA_ERR_DECODE (3)';
          errorMeaning = 'An error occurred while decoding the audio resource.';
          break;
        case 4:
          codeName = 'MEDIA_ERR_SRC_NOT_SUPPORTED (4)';
          errorMeaning = 'The audio format is unsupported, access to R2 bucket was denied (403), or CORS policy blocked loading.';
          break;
      }
    }

    console.error('[AudioEngine] HTMLAudioElement Playback Error:', {
      code: err?.code,
      codeName,
      message: err?.message || errorMeaning,
      src: audio.src,
      networkState: audio.networkState,
      readyState: audio.readyState,
    });

    // Direct R2 URLs are normally normalized before loading. Keep this
    // fallback for previously cached/external records that still expose one.
    if (err?.code === 4 && audio.src.includes('.r2.dev/')) {
      const match = audio.src.match(/\.r2\.dev\/(.+)$/);
      if (match?.[1]) {
        const proxiedUrl = `/api/r2-file/${match[1]}`;
        const entry = [...this.audioCache.values()].find((candidate) => candidate.audio === audio);
        const shouldResume = audio === this.audio && this.isRealAudioPlaying;

        console.warn(`[AudioEngine] Direct R2 URL failed. Retrying via proxy endpoint: ${proxiedUrl}`);
        audio.removeAttribute('crossorigin');
        audio.src = proxiedUrl;
        if (entry) entry.url = proxiedUrl;
        if (audio === this.audio) this.currentAudioUrl = proxiedUrl;
        audio.load();

        if (shouldResume) {
          audio.play().catch((playErr) => {
            console.warn('[AudioEngine] Proxy fallback play attempt failed:', playErr);
            if (audio === this.audio) {
              this.isRealAudioPlaying = false;
              this.onPlaybackStateChangeCallback?.(false);
            }
          });
        }
        return;
      }
    }

    // A failed active element never emits a reliable `pause` event in every
    // browser. Explicitly leave the playing state so React cannot keep its
    // listening-stat synchronization alive after a media/network failure.
    if (audio === this.audio) {
      this.isRealAudioPlaying = false;
      this.onPlaybackStateChangeCallback?.(false);
    }
  }

  private normalizeAudioUrl(rawUrl: string): string {
    const trimmedUrl = rawUrl.trim();
    if (trimmedUrl.includes('.r2.dev/')) {
      const match = trimmedUrl.match(/\.r2\.dev\/(.+)$/);
      if (match?.[1]) return `/api/r2-file/${match[1]}`;
    }
    return trimmedUrl;
  }

  private configureCrossOrigin(audio: HTMLAudioElement, url: string) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const urlObj = new URL(url);
        if (urlObj.origin !== window.location.origin) {
          audio.crossOrigin = 'anonymous';
          return;
        }
      } catch {
        // Fall through and use same-origin media behavior.
      }
    }
    audio.removeAttribute('crossorigin');
  }

  private touchCacheEntry(entry: CachedAudioEntry) {
    // Map insertion order is the LRU order: oldest first, newest last.
    this.audioCache.delete(entry.key);
    this.audioCache.set(entry.key, entry);
  }

  private releaseCacheEntry(entry: CachedAudioEntry) {
    entry.audio.pause();
    entry.mediaSource?.disconnect();
    entry.mediaSource = null;

    // Detaching the resource is what releases the browser's decoded/native
    // media buffer. Only this one LRU entry is touched during eviction.
    entry.audio.ontimeupdate = null;
    entry.audio.onplay = null;
    entry.audio.onpause = null;
    entry.audio.onended = null;
    entry.audio.onerror = null;
    entry.audio.removeAttribute('src');
    entry.audio.load();
  }

  private trimCache() {
    while (this.audioCache.size > MAX_CACHED_TRACKS) {
      const oldestInactive = [...this.audioCache.values()].find((entry) => entry.key !== this.currentTrackKey);
      if (!oldestInactive) return;
      this.audioCache.delete(oldestInactive.key);
      this.releaseCacheEntry(oldestInactive);
    }
  }

  private getOrCreateCacheEntry(track: Track, purpose: 'playback' | 'preload'): CachedAudioEntry | null {
    if (!track.audioUrl?.trim()) return null;

    const key = track.id || track.audioUrl.trim();
    const url = this.normalizeAudioUrl(track.audioUrl);
    const requestedPreloadMode = purpose === 'playback' ? 'auto' : this.getStandbyPreloadMode();
    const existing = this.audioCache.get(key);

    if (existing?.url === url) {
      if (purpose === 'playback' && existing.preloadMode !== 'auto') {
        // play() continues from the minimal cellular buffer and expands it as
        // needed; no load() here, because that would discard the warm segment.
        existing.preloadMode = 'auto';
        existing.audio.preload = 'auto';
      } else if (purpose === 'preload' && !existing.hasPlayed && existing.preloadMode !== requestedPreloadMode) {
        existing.preloadMode = requestedPreloadMode;
        existing.audio.preload = requestedPreloadMode;
        existing.audio.load();
      }
      this.touchCacheEntry(existing);
      return existing;
    }

    if (existing) {
      this.audioCache.delete(key);
      this.releaseCacheEntry(existing);
    }

    const audio = this.createAudioElement(requestedPreloadMode);
    this.configureCrossOrigin(audio, url);
    audio.src = url;

    const entry: CachedAudioEntry = {
      key,
      url,
      audio,
      mediaSource: null,
      preloadMode: requestedPreloadMode,
      hasPlayed: false,
    };

    this.audioCache.set(key, entry);
    // load() starts the browser's native range prebuffer while the current
    // track keeps playing. The element itself owns the first media segments.
    audio.load();
    this.trimCache();
    return entry;
  }

  private connectEntryToWebAudio(entry: CachedAudioEntry) {
    if (!this.ctx || !this.gainNode || entry.mediaSource) return;
    try {
      entry.mediaSource = this.ctx.createMediaElementSource(entry.audio);
      entry.mediaSource.connect(this.gainNode);
    } catch (err) {
      console.warn('Could not connect cached media element source:', err);
    }
  }

  private initWebAudio() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;

      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.setValueAtTime(250, this.ctx.currentTime);
      this.bassFilter.gain.setValueAtTime(this.currentEQ.bass, this.ctx.currentTime);

      this.midFilter = this.ctx.createBiquadFilter();
      this.midFilter.type = 'peaking';
      this.midFilter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      this.midFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);
      this.midFilter.gain.setValueAtTime(this.currentEQ.mid, this.ctx.currentTime);

      this.trebleFilter = this.ctx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.setValueAtTime(4000, this.ctx.currentTime);
      this.trebleFilter.gain.setValueAtTime(this.currentEQ.treble, this.ctx.currentTime);

      this.gainNode.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);
      this.gainNode.connect(this.bassFilter);
      this.bassFilter.connect(this.midFilter);
      this.midFilter.connect(this.trebleFilter);
      this.trebleFilter.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    } catch (err) {
      console.warn('AudioContext init error:', err);
    }
  }

  public setEQ(eq: { bass: number; mid: number; treble: number }) {
    this.currentEQ = { ...eq };
    if (this.ctx) {
      if (this.bassFilter) this.bassFilter.gain.setTargetAtTime(eq.bass, this.ctx.currentTime, 0.05);
      if (this.midFilter) this.midFilter.gain.setTargetAtTime(eq.mid, this.ctx.currentTime, 0.05);
      if (this.trebleFilter) this.trebleFilter.gain.setTargetAtTime(eq.treble, this.ctx.currentTime, 0.05);
    }
  }

  public setOnTimeUpdate(cb: (currentTime: number, duration: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  public setOnEnded(cb: () => void) {
    this.onEndedCallback = cb;
  }

  public setOnPlaybackStateChange(cb: (isPlaying: boolean) => void) {
    this.onPlaybackStateChangeCallback = cb;
  }

  public preloadTrack(track: Track) {
    // Wi-Fi/Ethernet uses normal native range buffering. Cellular/save-data
    // uses metadata preload, which limits the standby element to its minimal
    // initial media range (one segment) until actual playback begins.
    this.getOrCreateCacheEntry(track, 'preload');
  }

  public playTrack(track: Track, seekTimeSeconds = 0) {
    this.initWebAudio();

    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const entry = this.getOrCreateCacheEntry(track, 'playback');
    if (!entry) {
      this.audio.pause();
      this.isRealAudioPlaying = false;
      return;
    }

    this.isRealAudioPlaying = true;
    entry.hasPlayed = true;
    const isNewTrack = this.currentTrackKey !== entry.key || this.audio !== entry.audio;

    if (isNewTrack) {
      const previousAudio = this.audio;
      this.audio = entry.audio;
      this.currentTrackKey = entry.key;
      this.currentAudioUrl = entry.url;
      this.touchCacheEntry(entry);
      this.connectEntryToWebAudio(entry);

      // Switch the active reference first, so the old element's pause event
      // cannot momentarily flip the new track's React state to paused.
      if (previousAudio !== this.audio) previousAudio.pause();
      try {
        this.audio.currentTime = Math.max(0, seekTimeSeconds);
      } catch {
        // Metadata may still be arriving; play() will begin at zero.
      }
    } else if (
      Number.isFinite(seekTimeSeconds)
      && (this.audio.ended || Math.abs((this.audio.currentTime || 0) - seekTimeSeconds) > 1)
    ) {
      try {
        this.audio.currentTime = Math.max(0, seekTimeSeconds);
      } catch {
        // Ignore until media metadata is ready.
      }
    }

    this.audio.volume = this.currentVolume;
    const attemptedAudio = this.audio;
    const playPromise = attemptedAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Audio playback failed or interrupted:', err);
        // Ignore an old element whose promise was rejected because the user
        // skipped tracks. A rejection for the still-active element must stop
        // the app's playing state; otherwise background work can run forever.
        if (attemptedAudio === this.audio) {
          this.isRealAudioPlaying = false;
          this.onPlaybackStateChangeCallback?.(false);
        }
      });
    }
  }

  public pause() {
    this.audio.pause();
    this.isRealAudioPlaying = false;
  }

  public releaseNetworkResources() {
    this.pause();

    // `pause()` alone does not require a browser to stop buffering an
    // HTMLAudioElement. Detach every active/standby source so paused tabs do
    // not continue issuing byte-range requests to the Render service.
    for (const entry of this.audioCache.values()) {
      this.releaseCacheEntry(entry);
    }
    this.audioCache.clear();
    this.currentTrackKey = '';
    this.currentAudioUrl = '';
    this.audio = this.createAudioElement('auto');

    if (this.ctx?.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public seek(seconds: number, track?: Track) {
    if (track?.audioUrl && this.isRealAudioPlaying && Number.isFinite(seconds)) {
      this.audio.currentTime = seconds;
    }
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.currentVolume = clamped;
    this.audio.volume = clamped;
    for (const entry of this.audioCache.values()) entry.audio.volume = clamped;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
    }
  }

  public getFrequencyData(): Uint8Array {
    if (this.isRealAudioPlaying && this.analyser) {
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      if (sum > 0) return dataArray;
    }

    const count = 32;
    const arr = new Uint8Array(count);
    const now = Date.now() / 150;
    for (let i = 0; i < count; i++) {
      const val = Math.floor(100 + Math.sin(now + i * 0.4) * 80 + Math.cos(now * 0.7 + i) * 50);
      arr[i] = Math.max(20, Math.min(255, val));
    }
    return arr;
  }
}

export const audioEngine = new AudioEngine();
