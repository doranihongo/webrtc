import type { VocabWord } from '../types';

/**
 * Cache audio phát âm từ vựng theo TỪNG BUỔI HỌC:
 *  - Vào 1 buổi học -> tải ngầm audio của TOÀN BỘ từ vựng buổi đó ngay lập
 *    tức (không cần bấm mới tải).
 *  - Thoát ra ngoài (về trang chủ/danh sách buổi) rồi quay LẠI ĐÚNG buổi cũ
 *    -> vẫn giữ nguyên, không tải lại.
 *  - Chỉ khi mở SANG BUỔI KHÁC mới xóa cache buổi cũ và tải ngầm buổi mới -
 *    cache chỉ giữ đúng 1 buổi tại 1 thời điểm.
 *
 * Cố tình đặt ở module-level (biến ngoài, không phải useState/useRef trong
 * component) để sống sót qua việc LessonView unmount/mount lại - thoát ra
 * trang chủ rồi bấm vào lại đúng buổi đó không bị mất cache/tải lại từ đầu.
 *
 * Cách "cache": tạo sẵn 1 thẻ <audio preload="auto"> cho mỗi từ và gọi
 * .load() ngay (không phát) để trình duyệt tải ngầm rồi giữ nguyên element
 * đó; khi người dùng bấm vào thẻ từ vựng thì dùng LẠI ĐÚNG audio element
 * này để phát (tức thì, dữ liệu đã có sẵn). KHÔNG dùng fetch()/blob() để tự
 * cache byte audio vì server audio bên thứ 3 này không bật CORS
 * (không có header Access-Control-Allow-Origin - đã tự kiểm tra) nên
 * fetch() sẽ bị chặn; chỉ phần tử media (<audio>) mới tải/phát được media
 * chéo nguồn mà không cần CORS.
 */

let currentLessonKey: string | null = null;
const audioPool = new Map<string, HTMLAudioElement>();

/**
 * URL phát âm từ vựng - https://assets.languagepod101.com/...
 * @param targetKanji nếu có (xem VocabWord.targetKanji trong types.ts) -
 *   dùng cách viết này để TRA âm thanh thay cho `word`, không đụng tới
 *   `word` hiển thị trên web.
 */
export function getVocabAudioUrl(word: string, reading?: string, targetKanji?: string): string {
  const kanji = encodeURIComponent(targetKanji || word);
  const kana = encodeURIComponent(reading || targetKanji || word);
  return `https://assets.languagepod101.com/dictionary/japanese/audiomp3.php?kanji=${kanji}&kana=${kana}`;
}

/** Dừng phát + gỡ src để hủy hẳn 1 lượt tải ngầm đang dang dở, giải phóng. */
function disposeAudio(audio: HTMLAudioElement) {
  try {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  } catch {
    /* bỏ qua */
  }
}

/**
 * Tải ngầm audio cho toàn bộ từ vựng của 1 buổi học. Gọi lại với cùng
 * lessonKey (vd quay lại buổi vừa xem) sẽ KHÔNG tải lại; chỉ khi lessonKey
 * đổi (sang buổi khác) mới dọn cache buổi cũ rồi tải buổi mới.
 */
export function preloadLessonVocabAudio(lessonKey: string, vocabulary: VocabWord[]) {
  if (currentLessonKey === lessonKey) return;

  audioPool.forEach(disposeAudio);
  audioPool.clear();
  currentLessonKey = lessonKey;

  vocabulary.forEach((v) => {
    if (!v.word || v.noAudio) return; // noAudio - từ không có audio, xem types.ts
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = getVocabAudioUrl(v.word, v.reading, v.targetKanji);
    audio.load();
    audioPool.set(v.id, audio);
  });
}

/**
 * Audio element đã tải ngầm sẵn cho 1 từ (để phát tức thì) - null nếu
 * lessonKey không khớp (chưa/không còn được tải ngầm), nơi gọi tự dùng
 * getVocabAudioUrl() làm phương án dự phòng.
 */
export function getPooledVocabAudio(lessonKey: string, vocabId: string): HTMLAudioElement | null {
  if (currentLessonKey !== lessonKey) return null;
  return audioPool.get(vocabId) || null;
}
