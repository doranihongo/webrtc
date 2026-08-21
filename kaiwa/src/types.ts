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

/** 1 mẫu ngữ pháp trong "Danh sách ngữ pháp" của 1 buổi học (LessonView). */
export interface GrammarPoint {
  id: string;
  /** Cấu trúc ngữ pháp, vd "〜てもいいです". */
  pattern: string;
  /** Ý nghĩa/cách dùng, vd "Xin phép làm gì đó". */
  meaning: string;
  exampleJapanese?: string;
  exampleVietnamese?: string;
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
  /** Danh sách từ vựng hiển thị trong trang chi tiết buổi học (LessonView). */
  vocabulary?: VocabWord[];
  /** Danh sách ngữ pháp hiển thị trong trang chi tiết buổi học (LessonView). */
  grammar?: GrammarPoint[];
  /**
   * File trình chiếu/bài giảng cho bài học này - PDF hoặc PPT/PPTX.
   * Có thể là:
   *   - URL đầy đủ (https://...): nhúng trực tiếp (cần URL truy cập được
   *     từ trình duyệt của người xem, KHÔNG bị chặn đăng nhập).
   *   - Đường dẫn tương đối (vd "kaiwa-files/lesson-1.pdf"): file đặt trong
   *     public/kaiwa-files/, phục vụ từ cùng nguồn với web.
   * Trống = bài chưa có tài liệu, giao diện sẽ hiện trạng thái "chưa có".
   */
  lessonFileUrl?: string;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  lessons: Lesson[];
}
