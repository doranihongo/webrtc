import type { Course, VocabWord, GrammarPoint } from '../types';

/**
 * Đọc/ghi khóa học + buổi học qua bảng kaiwa_courses/kaiwa_lessons trên
 * Supabase - kèm realtime (Supabase Realtime "Postgres Changes") để mọi
 * người đang mở app tự thấy thay đổi ngay khi sửa dữ liệu trong Supabase,
 * không cần F5.
 *
 * Dùng CHUNG 1 client Supabase với cả trang (không tự tạo client riêng ở
 * đây): public/js/supabaseClient.js (classic script, load TRƯỚC bundle
 * React này trong kaiwa/index.html) đã khởi tạo sẵn và gắn vào
 * window.supabaseClient - dùng lại đúng client đó để chia sẻ chung 1
 * phiên đăng nhập, không mở 2 kết nối realtime song song tốn tài nguyên.
 */
function getSupabaseClient(): any | null {
  const client = (window as any).supabaseClient;
  if (!client) {
    console.warn(
      '[kaiwa] window.supabaseClient chưa sẵn sàng (chạy ngoài server chính, hoặc script chưa tải xong).'
    );
    return null;
  }
  return client;
}

export interface DbLesson {
  id: string;
  title: string;
  vocabulary: VocabWord[];
  grammar: GrammarPoint[];
  lessonFileUrl?: string;
  /** Xem Lesson.slideFolder/slideExt (types.ts). */
  slideFolder?: string;
  slideExt?: string;
}

/**
 * Danh sách khóa học, sắp theo sort_order - đọc từ kaiwa_courses.
 * Trả về null nếu không đọc được (mất kết nối/chưa có client) để nơi gọi
 * tự quyết định fallback; mảng rỗng [] nghĩa là bảng thật sự chưa có dòng
 * nào, khác với "không đọc được".
 */
export async function fetchCourses(): Promise<Course[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('kaiwa_courses')
    .select('id, title, description, cover_image_url, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[kaiwa] Lỗi tải danh sách khóa học:', error.message);
    return null;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description || '',
    imageUrl: row.cover_image_url || '',
    lessons: [],
  }));
}

/** Danh sách buổi học của 1 khóa, sắp theo sort_order - đọc từ kaiwa_lessons. */
export async function fetchCourseLessons(courseId: string): Promise<DbLesson[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('kaiwa_lessons')
    .select('id, title, vocabulary, grammar, lesson_file_url, slide_folder, slide_ext, sort_order')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[kaiwa] Lỗi tải buổi học:', error.message);
    return null;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    vocabulary: row.vocabulary || [],
    grammar: row.grammar || [],
    lessonFileUrl: row.lesson_file_url || undefined,
    slideFolder: row.slide_folder || undefined,
    slideExt: row.slide_ext || undefined,
  }));
}

/**
 * Lắng nghe realtime mọi thay đổi (thêm/sửa/xóa dòng) trên kaiwa_courses
 * và kaiwa_lessons - gọi onChange() mỗi khi có thay đổi, nơi gọi tự tải
 * lại đúng phần cần thiết (không truyền payload chi tiết, đơn giản hóa:
 * cứ có thay đổi là tải lại). Trả về hàm hủy đăng ký (gọi lúc unmount).
 *
 * Yêu cầu: 2 bảng phải được bật Realtime replication trong Supabase
 * (Database -> Replication, hoặc chạy
 * `alter publication supabase_realtime add table kaiwa_courses, kaiwa_lessons;`)
 * - không bật thì subscribe() vẫn "thành công" nhưng không bao giờ nhận
 * được sự kiện nào, trông như realtime không hoạt động.
 */
export function subscribeToCourseChanges(onChange: () => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};

  const channel = client
    .channel('kaiwa-content-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kaiwa_courses' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kaiwa_lessons' }, onChange)
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
