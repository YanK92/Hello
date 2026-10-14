import { describe, expect, it } from "vitest";
import { formatTimecode, parseTranscript, segmentsToText } from "./parse";

describe("parseTranscript: WebVTT", () => {
  it("reads cues with timings and voice tags", () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:04.200
<v Me>Hello, I'm calling about my car.

00:00:04.200 --> 00:00:09.800
<v Dealer>We can book an inspection
for next Tuesday.</v>
`;
    expect(parseTranscript("call.vtt", vtt)).toEqual([
      { start: 0, end: 4.2, speaker: "Me", text: "Hello, I'm calling about my car." },
      { start: 4.2, end: 9.8, speaker: "Dealer", text: "We can book an inspection for next Tuesday." },
    ]);
  });

  it("accepts short mm:ss.mmm timings and skips NOTE blocks", () => {
    const vtt = "WEBVTT\n\nNOTE exported by a tool\n\n01:02.500 --> 01:05.000\nHi there\n";
    expect(parseTranscript("x.vtt", vtt)).toEqual([{ start: 62.5, end: 65, speaker: null, text: "Hi there" }]);
  });
});

describe("parseTranscript: SRT", () => {
  it("reads numbered cues with comma milliseconds and Windows line endings", () => {
    const srt = "1\r\n00:00:01,000 --> 00:00:03,500\r\nSPEAKER 1: First line\r\n\r\n2\r\n01:00:00,000 --> 01:00:02,000\r\nSecond\r\n";
    expect(parseTranscript("call.srt", srt)).toEqual([
      { start: 1, end: 3.5, speaker: "SPEAKER 1", text: "First line" },
      { start: 3600, end: 3602, speaker: null, text: "Second" },
    ]);
  });
});

describe("parseTranscript: plain text", () => {
  it("splits on blank lines and reads 'Name:' speakers, without timings", () => {
    const txt = "Me: Hello.\nStill me.\n\nDealer: Hi.\n\n\n";
    expect(parseTranscript("notes.txt", txt)).toEqual([
      { start: null, end: null, speaker: "Me", text: "Hello. Still me." },
      { start: null, end: null, speaker: "Dealer", text: "Hi." },
    ]);
  });

  it("does not treat a time like 10:30 as a speaker", () => {
    expect(parseTranscript("t.txt", "10:30 is when they called")[0].speaker).toBeNull();
  });

  it("treats a .vtt file without a header as plain text rather than failing", () => {
    expect(parseTranscript("x.vtt", "just words")).toEqual([{ start: null, end: null, speaker: null, text: "just words" }]);
  });
});

describe("helpers", () => {
  it("formats timecodes", () => {
    expect(formatTimecode(0)).toBe("0:00");
    expect(formatTimecode(62.5)).toBe("1:02");
    expect(formatTimecode(3725)).toBe("1:02:05");
  });

  it("joins segments into searchable text", () => {
    expect(
      segmentsToText([
        { start: 0, end: 1, speaker: "Me", text: "Hi." },
        { start: 1, end: 2, speaker: null, text: "Bye." },
      ]),
    ).toBe("Me: Hi.\nBye.");
  });
});
