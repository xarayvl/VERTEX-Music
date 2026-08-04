import { Track } from '../types';

class AudioEngine {
  private audio: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private currentEQ = { bass: 0, mid: 0, treble: 0 };
  private isRealAudioPlaying = false;
  private currentAudioUrl = '';
  private onTimeUpdateCallback: ((currentTime: number, duration: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onPlaybackStateChangeCallback: ((isPlaying: boolean) => void) | null = null;
  private currentVolume = 0.8;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.ontimeupdate = () => {
      if (this.isRealAudioPlaying && this.onTimeUpdateCallback) {
        const cur = this.audio.currentTime || 0;
        const dur = this.audio.duration || 0;
        this.onTimeUpdateCallback(cur, dur);
      }
    };

    // Native media keys can control the underlying audio element without
    // going through React. Mirror those real browser events back to the UI so
    // every play/pause source (mouse, Space, headset or keyboard media key)
    // shares one authoritative playback state.
    this.audio.onplay = () => {
      this.isRealAudioPlaying = true;
      this.onPlaybackStateChangeCallback?.(true);
    };

    this.audio.onpause = () => {
      // The ended handler owns the state transition and queue advance when a
      // track naturally finishes, avoiding a late pause event overriding the
      // next track's playing state.
      if (this.audio.ended) return;
      this.isRealAudioPlaying = false;
      this.onPlaybackStateChangeCallback?.(false);
    };

    this.audio.onended = () => {
      const shouldAdvance = this.isRealAudioPlaying;
      this.isRealAudioPlaying = false;
      this.onPlaybackStateChangeCallback?.(false);
      if (shouldAdvance && this.onEndedCallback) {
        this.onEndedCallback();
      }
    };

    this.audio.onerror = () => {
      const err = this.audio.error;
      let codeName = 'MEDIA_ERR_UNKNOWN';
      let errorMeaning = 'An unknown audio element error occurred.';

      if (err) {
        switch (err.code) {
          case 1: // MEDIA_ERR_ABORTED
            codeName = 'MEDIA_ERR_ABORTED (1)';
            errorMeaning = 'The fetching process for the media resource was aborted by the user agent.';
            break;
          case 2: // MEDIA_ERR_NETWORK
            codeName = 'MEDIA_ERR_NETWORK (2)';
            errorMeaning = 'A network error occurred while fetching the audio stream from R2 or server.';
            break;
          case 3: // MEDIA_ERR_DECODE
            codeName = 'MEDIA_ERR_DECODE (3)';
            errorMeaning = 'An error occurred while decoding the audio resource.';
            break;
          case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
            codeName = 'MEDIA_ERR_SRC_NOT_SUPPORTED (4)';
            errorMeaning = 'The audio format is unsupported, access to R2 bucket was denied (403), or CORS policy blocked loading.';
            break;
        }
      }

      console.error(`[AudioEngine] HTMLAudioElement Playback Error:`, {
        code: err?.code,
        codeName,
        message: err?.message || errorMeaning,
        src: this.audio.src,
        networkState: this.audio.networkState,
        readyState: this.audio.readyState,
      });

      // If an external R2 URL failed with CORS or 403, attempt proxy fallback
      if (err?.code === 4 && this.audio.src.includes('.r2.dev/')) {
        const match = this.audio.src.match(/\.r2\.dev\/(.+)$/);
        if (match && match[1]) {
          const proxiedUrl = `/api/r2-file/${match[1]}`;
          console.warn(`[AudioEngine] Direct R2 URL failed. Retrying playback via proxy endpoint: ${proxiedUrl}`);
          this.audio.removeAttribute('crossorigin');
          this.audio.src = proxiedUrl;
          this.currentAudioUrl = proxiedUrl;
          this.audio.load();
          this.audio.play().catch((playErr) => {
            console.warn('[AudioEngine] Proxy fallback play attempt failed:', playErr);
          });
        }
      }
    };
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

      try {
        this.mediaSource = this.ctx.createMediaElementSource(this.audio);
        this.mediaSource.connect(this.gainNode);
        this.gainNode.connect(this.bassFilter);
        this.bassFilter.connect(this.midFilter);
        this.midFilter.connect(this.trebleFilter);
        this.trebleFilter.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      } catch (err) {
        console.warn('Could not connect media element source:', err);
      }
    } catch (err) {
      console.warn('AudioContext init error:', err);
    }
  }

  public setEQ(eq: { bass: number; mid: number; treble: number }) {
    this.currentEQ = { ...eq };
    if (this.ctx) {
      if (this.bassFilter) {
        this.bassFilter.gain.setTargetAtTime(eq.bass, this.ctx.currentTime, 0.05);
      }
      if (this.midFilter) {
        this.midFilter.gain.setTargetAtTime(eq.mid, this.ctx.currentTime, 0.05);
      }
      if (this.trebleFilter) {
        this.trebleFilter.gain.setTargetAtTime(eq.treble, this.ctx.currentTime, 0.05);
      }
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

  public playTrack(track: Track, seekTimeSeconds = 0) {
    this.initWebAudio();

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (track.audioUrl && track.audioUrl.trim().length > 0) {
      this.isRealAudioPlaying = true;

      let trimmedUrl = track.audioUrl.trim();
      if (trimmedUrl.includes('.r2.dev/')) {
        const match = trimmedUrl.match(/\.r2\.dev\/(.+)$/);
        if (match && match[1]) {
          trimmedUrl = `/api/r2-file/${match[1]}`;
        }
      }

      const isNewTrack = this.currentAudioUrl !== trimmedUrl;

      if (isNewTrack) {
        if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
          try {
            const urlObj = new URL(trimmedUrl);
            if (urlObj.origin !== window.location.origin) {
              this.audio.crossOrigin = 'anonymous';
            } else {
              this.audio.removeAttribute('crossorigin');
            }
          } catch {
            this.audio.removeAttribute('crossorigin');
          }
        } else {
          this.audio.removeAttribute('crossorigin');
        }

        this.audio.src = trimmedUrl;
        this.currentAudioUrl = trimmedUrl;
        this.audio.load();
        try {
          this.audio.currentTime = 0;
        } catch {
          // ignore if metadata not ready yet
        }
      } else if (seekTimeSeconds > 0 && !isNaN(seekTimeSeconds) && Math.abs((this.audio.currentTime || 0) - seekTimeSeconds) > 1) {
        try {
          this.audio.currentTime = seekTimeSeconds;
        } catch {
          // ignore
        }
      }

      this.audio.volume = this.currentVolume;

      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio playback failed or interrupted:', err);
        });
      }
    } else {
      this.audio.pause();
      this.isRealAudioPlaying = false;
    }
  }

  public pause() {
    this.audio.pause();
    this.isRealAudioPlaying = false;
  }

  public seek(seconds: number, track?: Track) {
    if (track?.audioUrl && this.isRealAudioPlaying) {
      if (!isNaN(seconds) && isFinite(seconds)) {
        this.audio.currentTime = seconds;
      }
    }
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.currentVolume = clamped;
    this.audio.volume = clamped;
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

    // Animated frequency bars for playing audio or visualization
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
