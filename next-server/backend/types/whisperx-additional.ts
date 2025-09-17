// Additional types needed for Python transliteration
export interface SingleSegment {
  start: number;
  end: number;
  text: string;
}

export interface SingleWordSegment {
  word: string;
  start: number;
  end: number;
  score: number;
}

export interface SingleAlignedSegment {
  start: number;
  end: number;
  text: string;
  words: SingleWordSegment[];
  chars?: Array<{
    char: string;
    start: number;
    end: number;
    score: number;
  }>;
}