import "server-only";
import type { Segment } from "./parse";

/**
 * A speech-to-text service. None is configured yet: the plan requires a
 * provider that processes data in the UK/EU and signs a DPA, and that choice
 * belongs to the owner. To add one, implement this interface in a new file
 * and return it from transcriptionProvider() when TRANSCRIPTION_PROVIDER
 * names it. Until then users import transcripts (VTT, SRT or text).
 */
export interface TranscriptionProvider {
  /** Short name stored with each transcript, e.g. "acme-speech-v2". */
  readonly model: string;
  transcribe(audio: Blob, mime: string): Promise<{ segments: Segment[] }>;
}

const providers: Record<string, () => TranscriptionProvider> = {
  // "example": () => new ExampleProvider(process.env.EXAMPLE_API_KEY!),
};

export function transcriptionProvider(): TranscriptionProvider | null {
  const name = process.env.TRANSCRIPTION_PROVIDER;
  return name && providers[name] ? providers[name]() : null;
}

export function transcriptionAvailable(): boolean {
  return transcriptionProvider() !== null;
}
