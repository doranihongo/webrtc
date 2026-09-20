import { probeSlideImages } from './probeSlideImages';

export interface RawSlideLesson {
  slideFolder?: string;
  slideExt?: string;
  slideCount?: number;
}

/**
 * Sinh danh sách URL slide CHƯA KÝ (chưa gọi signSlideUrls.ts) - tách riêng
 * hàm này để dùng lại được cả ở lần tải đầu buổi học lẫn lần làm mới token
 * nền (LessonView.tsx), không lặp lại logic 2 nhánh slideCount/probe.
 * @see Lesson.slideCount/slideFolder/slideExt (types.ts) - ưu tiên
 *   slideCount (không dò gì cả) nếu có, rơi về probeSlideImages.ts khi
 *   chưa điền.
 */
export async function buildRawSlideUrls(lesson: RawSlideLesson): Promise<string[]> {
  if (!lesson.slideFolder) return [];
  if (lesson.slideCount && lesson.slideCount > 0) {
    const base = lesson.slideFolder.endsWith('/') ? lesson.slideFolder : `${lesson.slideFolder}/`;
    const ext = lesson.slideExt || 'svg';
    return Array.from({ length: lesson.slideCount }, (_, i) => `${base}${i + 1}.${ext}`);
  }
  return probeSlideImages(lesson.slideFolder, { ext: lesson.slideExt });
}
