// Turns transcript files into timestamped segments. Supports WebVTT and SRT
// (what most transcription services export) and plain text.

export interface Segment {
  /** Seconds from the start of the recording, or null if not known. */
  start: number | null;
  end: number | null;
  speaker: string | null;
  text: string;
}

const TIMING = /^((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s+-->\s+((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})/;
// "Name: words" where the name is short and is not a clock time.
const SPEAKER = /^([A-Za-z][\w .'-]{0,39}):\s+(.+)$/s;

function seconds(stamp: string): number {
  const parts = stamp.replace(",", ".").split(":").map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitSpeaker(text: string): { speaker: string | null; text: string } {
  const voice = text.match(/^<v(?:\.[^ >]*)?\s+([^>]+)>(.*)$/s);
  if (voice) return { speaker: clean(voice[1]), text: clean(voice[2].replace(/<\/v>/g, "")) };
  const named = text.match(SPEAKER);
  if (named) return { speaker: clean(named[1]), text: clean(named[2]) };
  return { speaker: null, text: clean(text) };
}

function stripTags(text: string): string {
  // Keep <v ...> for speaker detection; drop styling tags like <b>, <i>, <c>.
  return text.replace(/<(?!\/?v[\s.>])[^>]+>/g, "");
}

function parseCues(body: string): Segment[] {
  const segments: Segment[] = [];
  for (const block of body.split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const timingAt = lines.findIndex((l) => TIMING.test(l.trim()));
    if (timingAt === -1) continue;
    const [, from, to] = lines[timingAt].trim().match(TIMING)!;
    const raw = stripTags(lines.slice(timingAt + 1).join("\n"));
    const { speaker, text } = splitSpeaker(raw);
    if (text) segments.push({ start: seconds(from), end: seconds(to), speaker, text });
  }
  return segments;
}

function parsePlain(body: string): Segment[] {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const { speaker, text } = splitSpeaker(block);
      return { start: null, end: null, speaker, text };
    });
}

/** Parses a transcript file by its name and content. Never throws. */
export function parseTranscript(fileName: string, content: string): Segment[] {
  const body = content.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".vtt") && body.trimStart().startsWith("WEBVTT")) return parseCues(body);
  if (lower.endsWith(".srt") || lower.endsWith(".vtt")) {
    const cues = parseCues(body);
    if (cues.length) return cues;
  }
  return parsePlain(body);
}

export function segmentsToText(segments: Segment[]): string {
  return segments.map((s) => (s.speaker ? `${s.speaker}: ${s.text}` : s.text)).join("\n");
}

export function formatTimecode(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
