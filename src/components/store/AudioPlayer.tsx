"use client";
import { useEffect, useRef, useState } from "react";

const SPEEDS = [0.75, 1, 1.25, 1.5];
const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

/**
 * Accessible audio player (PRD v1.1 §9): play/pause, seek, progress, volume and speed, all native controls so they work with a
 * keyboard and screen reader. Only rendered for recordings whose rights are valid; the audio is not downloaded until played.
 */
export default function AudioPlayer({ src, title, credit, durationSeconds }: { src: string; title: string; credit?: string; durationSeconds?: number | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => { if (ref.current) { ref.current.volume = volume; ref.current.playbackRate = rate; } }, [volume, rate]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setFailed(true)); else a.pause();
  };

  if (failed) return <p role="alert" className="rounded-xl border border-sandal-200 bg-surface p-4 text-sm text-muted">The recording could not be played right now.</p>;
  return (
    <section aria-label={`Audio: ${title}`} className="rounded-2xl border border-sandal-200 bg-surface p-4 shadow-elev-1">
      <audio ref={ref} src={src} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onError={() => setFailed(true)} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggle} aria-pressed={playing} className="btn-primary h-11 w-24 shrink-0">{playing ? "Pause" : "Play"}<span className="sr-only"> {title}</span></button>
        <div className="min-w-0 flex-1">
          <label htmlFor="audio-seek" className="sr-only">Seek</label>
          <input id="audio-seek" type="range" min={0} max={duration || 0} step={1} value={Math.min(time, duration || 0)} disabled={!duration}
            aria-valuetext={`${fmt(time)} of ${fmt(duration)}`} className="w-full accent-saffron-600"
            onChange={(e) => { const t = Number(e.target.value); if (ref.current) ref.current.currentTime = t; setTime(t); }} />
        </div>
        <p className="w-24 shrink-0 text-right text-sm tabular-nums text-muted" aria-hidden="true">{fmt(time)} / {fmt(duration)}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">Volume
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-valuetext={`${Math.round(volume * 100)}%`} className="w-28 accent-saffron-600" /></label>
        <label className="flex items-center gap-2">Speed
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className="input h-9 w-auto py-0">{SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}</select></label>
      </div>
      {credit && <p className="mt-3 text-xs text-muted">Recording: {credit}</p>}
    </section>
  );
}
