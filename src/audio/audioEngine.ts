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

    this.audio.onended = () => {
      if (this.isRealAudioPlaying && this.onEndedCallback) {
        this.onEndedCallback();
      }
    };

    this.audio.onerror = (e) => {
      console.warn('Audio element error:', e);
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

  public playTrack(track: Track, seekTimeSeconds = 0) {
    this.initWebAudio();

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (track.audioUrl && track.audioUrl.trim().length > 0) {
      this.isRealAudioPlaying = true;

      const trimmedUrl = track.audioUrl.trim();
      if (this.currentAudioUrl !== trimmedUrl) {
        this.audio.src = trimmedUrl;
        this.currentAudioUrl = trimmedUrl;
        this.audio.load();
      }

      this.audio.volume = this.currentVolume;

      if (seekTimeSeconds > 0 && !isNaN(seekTimeSeconds)) {
        this.audio.currentTime = seekTimeSeconds;
      }

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
