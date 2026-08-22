export interface VocabWord {
  id: string;
  word: string;
  sinoVietnamese: string;
  reading: string;
  meaning: string;
  exampleJapanese?: string;
  exampleVietnamese?: string;
  customCells?: string[];
  /**
   * Ghi trong JSON khi muốn tra âm thanh phát âm bằng 1 cách viết kanji
   * KHÁC với `word` hiển thị trên web (vd `word` là dạng rút gọn/viết tắt
   * không tra được đúng audio, nhưng đổi `word` thì lại sai hiển thị) -
   * `word`/`reading` hiển thị trên thẻ từ vựng vẫn giữ NGUYÊN, chỉ URL âm
   * thanh (xem utils/vocabAudioCache.ts) đổi sang tra bằng `targetKanji`
   * (+ vẫn dùng `reading` hiện có để ghép cách đọc, trừ khi cũng muốn đổi
   * luôn cách đọc dùng để tra thì set thêm cả `reading` cho khớp).
   */
  targetKanji?: string;
  /**
   * true = từ này KHÔNG có audio phát âm (server audio bên thứ 3 không có
   * hoặc phát âm sai/không mong muốn) - thẻ từ vựng vẫn hiển thị bình
   * thường nhưng ẩn icon loa, bấm vào không làm gì (xem LessonView.tsx).
   */
  noAudio?: boolean;
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
  /**
   * Danh sách ảnh slide trình chiếu dành cho giáo viên (nút "Slide") - KHÁC
   * với `lessonFileUrl` (tài liệu học viên tự xem, luôn mở tab mới). Mỗi
   * phần tử là URL 1 ảnh (jpg/png), ĐÚNG THỨ TỰ trang cần chiếu. Cách tạo:
   * xuất slide (PowerPoint/Google Slides/Keynote) ra ảnh - PowerPoint có sẵn
   * File > Export > Change File Type > PNG (xuất mỗi trang 1 ảnh), Google
   * Slides/Keynote thì xuất PDF rồi convert PDF -> ảnh bằng công cụ online.
   * Đặt các ảnh vào public/kaiwa-files/ (vd thư mục riêng theo buổi học)
   * rồi liệt kê URL tương đối theo đúng thứ tự vào mảng này.
   * Trống/rỗng = buổi học chưa có slide, nút "Slide" sẽ bị vô hiệu hóa.
   */
  slideImages?: string[];
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  lessons: Lesson[];
}
