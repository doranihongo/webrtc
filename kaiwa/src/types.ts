export interface VocabWord {
  id: string;
  word: string;
  sinoVietnamese: string;
  reading: string;
  meaning: string;
  exampleJapanese?: string;
  exampleVietnamese?: string;
  customCells?: string[];
  targetKanji?: string;
  isSeparator?: boolean;
  displayStt?: number;
}

export interface KanjiWord {
  id: string;
  kanji: string;
  hanViet: string;
  on: string;
  kun: string;
  meaning: string;
  vocabList: { word: string; reading: string; meaning: string }[];
}

export interface Lesson {
  id: string;
  title: string;
  videoId: string; // YouTube ID
  pdfUrl: string;
  kanjiCount?: number;
  vocabCount?: number;
  kanjiList?: string;
  vocabList?: string;
  exerciseJson?: any;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  lessons: Lesson[];
}
