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
   * Ảnh slide trình chiếu dành cho giáo viên (nút "Slide") - KHÁC với
   * `lessonFileUrl` (tài liệu học viên tự xem, luôn mở tab mới). 1 thư mục
   * ảnh đặt tên TUẦN TỰ liên tục "1.svg, 2.svg, 3.svg, ..." (không nhảy
   * số). Vd đặt ảnh buổi 1 lên Cloudflare tại ".../slides/buoi-1/1.svg" ..
   * "10.svg" thì set `slideFolder: "https://.../slides/buoi-1/"` (có hay
   * không dấu "/" cuối đều được). Đuôi file mặc định là "svg", đổi bằng
   * `slideExt` nếu dùng jpg/png.
   *
   * Số lượng ảnh lấy từ `slideCount` (gõ tay, xem field đó) nếu có - không
   * thì mới rơi về dò lần lượt (LessonView.tsx, utils/probeSlideImages.ts,
   * thử tải ảnh 1, 2, 3... tới khi gặp 404 thì dừng) như cách cũ, chỉ để
   * tương thích buổi học nào chưa kịp điền `slideCount`.
   * Trống (hoặc slideCount = 0 và dò ra 0 ảnh) = buổi học chưa có slide,
   * nút "Slide" sẽ bị vô hiệu hóa.
   */
  slideFolder?: string;
  /** Đuôi file ảnh khi dùng `slideFolder`, mặc định "svg" (vd "png", "jpg"). */
  slideExt?: string;
  /**
   * Số lượng ảnh trong `slideFolder`, gõ TAY vào cột `slide_count` của
   * bảng kaiwa_lessons trên Supabase mỗi khi thêm/bớt slide - có giá trị
   * này thì bỏ qua hẳn bước dò 404 (probeSlideImages.ts), nút "Slide" bật
   * ngay lập tức, không còn "Đang tải...". Không điền (0/null) = tự dò như
   * cách cũ (chậm hơn, chỉ nên dùng tạm trong lúc chưa kịp điền).
   */
  slideCount?: number;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  lessons: Lesson[];
}
