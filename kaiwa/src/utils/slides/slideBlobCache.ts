/**
 * Cache Blob ảnh slide đã tải+decode SẴN trong bộ nhớ JS (KHÔNG phải ổ đĩa)
 * theo TỪNG BUỔI HỌC - y hệt tinh thần vocabAudioCache.ts:
 *  - Vào 1 buổi học -> preload ảnh (LessonView.tsx) lưu Blob vào đây.
 *  - Thoát ra ngoài (về trang chủ/danh sách buổi) rồi quay LẠI ĐÚNG buổi cũ
 *    -> vẫn dùng lại Blob đã có, KHÔNG tải lại qua mạng.
 *  - Chỉ khi mở SANG BUỔI KHÁC mới revoke + xóa Blob buổi cũ - cache chỉ
 *    giữ đúng 1 buổi tại 1 thời điểm (tránh giữ mãi ảnh nhiều buổi đã xem
 *    qua, tốn bộ nhớ vô ích qua cả 1 phiên học dài).
 *
 * Cố tình đặt ở module-level (biến ngoài, không phải useRef trong
 * component LessonView) để sống sót qua việc LessonView unmount/mount lại
 * (bấm "Trang chủ" rồi quay lại đúng buổi cũ KHÔNG bị tải lại từ đầu, dù
 * component đã unmount hoàn toàn - useRef trong component sẽ MẤT lúc này,
 * đã gặp thực tế). Chỉ thật sự mất khi: đóng tab/tải lại trang (F5) - bộ
 * nhớ JS luôn bị xoá sạch lúc đó, không có cách nào giữ được (và KHÔNG cần
 * giữ - đây là cache RAM, không phải cache ổ đĩa).
 *
 * Khoá theo PATHNAME của URL đã ký (không phải URL đầy đủ, xem
 * getSlidePathKey ở LessonView.tsx) - làm mới token nền (đổi exp/sig, ảnh
 * không đổi) vẫn nhận diện đúng Blob đã có, không tải lại.
 */

let currentLessonKey: string | null = null;
const blobPool = new Map<string, string>();
// pathKey -> Promise đang tải dở - chống việc CÙNG 1 ẢNH bị fetch() 2 lần
// song song (đã gặp thực tế: effect preload ở LessonView.tsx có thể chạy
// gần như đồng thời 2 lần cho cùng 1 lần vào buổi học - React StrictMode
// tự double-invoke effect lúc phát triển/kiểm tra side effect - nếu không
// khử trùng ở đây, mỗi ảnh sẽ bị tải qua mạng 2 lần dù kết quả cuối cùng
// vẫn đúng, chỉ tốn băng thông/Class B request oan).
const inFlight = new Map<string, Promise<string>>();

/**
 * Gọi khi vào 1 buổi học - nếu khác buổi đang giữ cache, dọn sạch Blob của
 * buổi CŨ (revokeObjectURL, tránh rò rỉ bộ nhớ) trước khi buổi mới bắt đầu
 * tải. Cùng buổi (vd rời về Trang chủ rồi quay lại NGAY buổi đó) thì giữ
 * nguyên, không dọn gì - gọi lại vô hại (no-op).
 */
export function activateSlideBlobCache(lessonKey: string): void {
  if (currentLessonKey === lessonKey) return;
  blobPool.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
  blobPool.clear();
  currentLessonKey = lessonKey;
}

/** Blob URL đã có sẵn cho đúng buổi học này, hoặc undefined nếu chưa tải/đã bị dọn (sang buổi khác). */
export function getCachedSlideBlob(lessonKey: string, pathKey: string): string | undefined {
  if (currentLessonKey !== lessonKey) return undefined;
  return blobPool.get(pathKey);
}

/**
 * Lấy Blob URL cho 1 ảnh - dùng lại NGAY nếu đã có sẵn (đúng buổi học),
 * dùng CHUNG kết quả nếu đang có 1 lượt tải khác dở dang cho ĐÚNG ảnh này
 * (xem inFlight ở trên), chỉ thật sự gọi `fetchBlob()` khi chưa ai tải.
 * `fetchBlob` chỉ nên gọi fetch()+`.blob()`, KHÔNG tự bắt lỗi (để lỗi tự
 * ném ra ngoài cho nơi gọi xử lý, giống 1 fetch() bình thường).
 */
export async function loadSlideBlob(
  lessonKey: string,
  pathKey: string,
  fetchBlob: () => Promise<Blob>,
): Promise<string> {
  const cached = getCachedSlideBlob(lessonKey, pathKey);
  if (cached) return cached;

  let promise = inFlight.get(pathKey);
  if (!promise) {
    promise = fetchBlob()
      .then((blob) => URL.createObjectURL(blob))
      .finally(() => {
        inFlight.delete(pathKey);
      });
    inFlight.set(pathKey, promise);
  }

  const blobUrl = await promise;
  // Chỉ lưu vào pool nếu buổi học VẪN còn là buổi lúc bắt đầu gọi hàm này
  // (chưa bị activateSlideBlobCache() sang buổi khác giữa chừng) - tránh
  // lưu nhầm Blob của buổi cũ vào cache buổi mới. Không cần tự
  // revokeObjectURL ở nhánh else: 1 lượt loadSlideBlob KHÁC đang chờ CHUNG
  // promise này (cùng pathKey) có thể vẫn cần dùng blobUrl để hiển thị
  // ngay - revoke sớm sẽ làm hỏng ảnh đang hiển thị dở; trình duyệt tự dọn
  // khi Blob URL không còn tham chiếu tới.
  if (currentLessonKey === lessonKey) {
    blobPool.set(pathKey, blobUrl);
  }
  return blobUrl;
}
