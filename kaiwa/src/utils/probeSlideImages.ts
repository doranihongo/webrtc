/**
 * Tự "dò" ra danh sách ảnh slide của 1 buổi học từ 1 THƯ MỤC đặt tên tuần
 * tự (1.svg, 2.svg, 3.svg, ...) thay vì phải liệt kê tay từng URL vào
 * Supabase - xem `Lesson.slideFolder` (types.ts) và nơi gọi ở LessonView.tsx.
 *
 * Cách dò: thử TẢI ảnh theo từng ĐỢT song song (batchSize ảnh/đợt, không dò
 * từng ảnh một để đỡ tốn round-trip), ảnh nào tải được (onload) coi là còn
 * trang, ảnh đầu tiên lỗi (onerror, thường do 404 - hết trang) trong 1 đợt
 * thì dừng NGAY, không dò tiếp đợt sau. maxCount là trần an toàn (lỡ trỏ
 * nhầm thư mục rỗng thì cũng không dò vô hạn).
 *
 * Kết quả cache theo (folder, ext) trong bộ nhớ (Map, sống hết phiên tab) -
 * mở lại Slide buổi học cũ trong cùng phiên không dò lại từ đầu.
 */

export interface ProbeSlideImagesOptions {
  /** Đuôi file, mặc định 'svg' - đổi nếu buổi học dùng jpg/png (xem Lesson.slideExt). */
  ext?: string;
  /** Trần an toàn số ảnh tối đa dò thử - mặc định 200. */
  maxCount?: number;
  /** Số ảnh dò song song mỗi đợt - mặc định 5. */
  batchSize?: number;
}

const cache = new Map<string, Promise<string[]>>();

function probeOneImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function doProbe(folder: string, ext: string, maxCount: number, batchSize: number): Promise<string[]> {
  const base = folder.endsWith('/') ? folder : `${folder}/`;
  const urls: string[] = [];
  let n = 1;
  while (n <= maxCount) {
    const count = Math.min(batchSize, maxCount - n + 1);
    const batchUrls = Array.from({ length: count }, (_, i) => `${base}${n + i}.${ext}`);
    const results = await Promise.all(batchUrls.map(probeOneImage));
    const firstMiss = results.indexOf(false);
    if (firstMiss === -1) {
      urls.push(...batchUrls);
      n += count;
    } else {
      urls.push(...batchUrls.slice(0, firstMiss));
      break;
    }
  }
  return urls;
}

/** Dò `folder` (xem comment đầu file), trả về mảng URL đúng thứ tự trang. */
export function probeSlideImages(folder: string, options: ProbeSlideImagesOptions = {}): Promise<string[]> {
  const { ext = 'svg', maxCount = 200, batchSize = 5 } = options;
  const key = `${folder}::${ext}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = doProbe(folder, ext, maxCount, batchSize);
    cache.set(key, pending);
  }
  return pending;
}
