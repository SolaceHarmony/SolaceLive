export interface TextTokenizer {
  encode(text: string): number[];             // map text to token ids
  decode(ids: number[]): string;              // map token ids to text
  readonly vocabSize: number;
}

/**
 * Placeholder SentencePiece tokenizer interface.
 * This does not simulate; it requires a real model to be provided.
 */
export class SentencePieceTokenizer implements TextTokenizer {
  private modelLoaded = false;
  private _vocabSize = 0;
  constructor(private modelPath?: string) {}

  async load(modelPath: string): Promise<void> {
    // TODO: Integrate a real SentencePiece/Tokenizer backend (e.g., HF tokenizers or wasm spm).
    // For now, require a model and throw to avoid simulation.
    if (!modelPath) throw new Error('SentencePieceTokenizer.load: modelPath required');
    this.modelPath = modelPath;
    // Implement loading logic here.
    throw new Error('SentencePieceTokenizer: loading not implemented. Provide a real backend.');
  }

  encode(_text: string): number[] {
    if (!this.modelLoaded) throw new Error('SentencePieceTokenizer.encode: model not loaded');
    return [];
  }
  decode(_ids: number[]): string {
    if (!this.modelLoaded) throw new Error('SentencePieceTokenizer.decode: model not loaded');
    return '';
  }
  get vocabSize(): number { return this._vocabSize; }
}

