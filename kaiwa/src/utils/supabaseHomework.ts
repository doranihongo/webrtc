import type { Homework, HomeworkSubmission } from '../types';

// ---------------------------------------------------------
// Bài tập về nhà - 2 nguồn dữ liệu khác nhau, CỐ Ý không gộp chung 1 cách
// gọi:
//   - Đề bài (kaiwa_homeworks) và bài nộp CỦA CHÍNH MÌNH (học viên) đọc
//     THẲNG qua Supabase (RLS tự giới hạn đúng phạm vi) - giống hệt
//     supabaseCourses.ts, dùng chung 1 client window.supabaseClient.
//   - Nộp/xoá bài, và giáo viên tra bài của học viên khác (qua mã) - PHẢI
//     qua server (app/src/server.js, route /kaiwa/homework/*): nộp/xoá cần
//     ghi lên Google Drive (credential chỉ server giữ), còn giáo viên đọc
//     bài KHÔNG PHẢI của mình bị RLS chặn thẳng nếu gọi Supabase trực tiếp
//     (xem SQL bàn giao - chỉ 2 hàm RPC phạm vi hẹp mới vượt qua được, và
//     2 hàm đó chỉ được gọi từ server, không gọi thẳng từ đây).
// ---------------------------------------------------------

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

function toHomework(row: any): Homework {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    title: row.title,
    description: row.description || undefined,
    deadline: row.deadline || null,
  };
}

function toSubmission(row: any): HomeworkSubmission {
  return {
    id: row.id,
    homeworkId: row.homework_id,
    studentId: row.student_id,
    driveFileName: row.drive_file_name,
    mimeType: row.mime_type,
    durationMs: row.duration_ms ?? null,
    createdAt: row.created_at,
  };
}

/** Danh sách đề bài của 1 buổi học, sắp theo ngày tạo. */
export async function fetchHomeworksForLesson(lessonId: string): Promise<Homework[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('kaiwa_homeworks')
    .select('id, lesson_id, title, description, deadline, created_at')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[kaiwa] Lỗi tải đề bài tập về nhà:', error.message);
    return null;
  }
  return (data || []).map(toHomework);
}

/**
 * Bài nộp CỦA CHÍNH học viên đang đăng nhập, cho 1 danh sách homeworkId -
 * RLS chỉ cho đọc dòng student_id = auth.uid() nên đọc thẳng qua Supabase
 * an toàn, không cần qua server.
 */
export async function fetchMySubmissions(homeworkIds: string[]): Promise<HomeworkSubmission[] | null> {
  if (homeworkIds.length === 0) return [];
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('kaiwa_homework_submissions')
    .select('id, homework_id, student_id, drive_file_name, mime_type, duration_ms, created_at')
    .in('homework_id', homeworkIds);

  if (error) {
    console.error('[kaiwa] Lỗi tải bài đã nộp:', error.message);
    return null;
  }
  return (data || []).map(toSubmission);
}

// Đếm để đặt tên kênh Realtime DUY NHẤT cho mỗi lần gọi subscribeToMySubmissionChanges
// - khác subscribeToCourseChanges (chỉ 1 nơi gọi, ở CoursesContext), hàm
// này được gọi ĐỘC LẬP từ nhiều nơi cùng lúc (LessonView.tsx theo dõi
// trạng thái nút "Bài tập", HomeworkModal.tsx theo dõi danh sách bài nộp
// khi popup mở) - dùng chung 1 tên kênh cố định khiến Supabase realtime-js
// ném "cannot add postgres_changes callbacks... after subscribe()" ngay
// khi có 2 subscriber cùng lúc (đã gặp thực tế, làm treo trang).
let mySubmissionChannelSeq = 0;

/**
 * Realtime: bài nộp/xoá của CHÍNH học viên này (bảng
 * kaiwa_homework_submissions) tự phản ánh ngay không cần F5 - mirror của
 * subscribeToCourseChanges (supabaseCourses.ts). Yêu cầu bảng đã bật
 * Realtime replication trên Supabase (xem SQL bàn giao). An toàn khi gọi
 * nhiều lần đồng thời (mỗi lần gọi tự có kênh riêng, xem comment trên).
 */
export function subscribeToMySubmissionChanges(onChange: () => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};

  const channel = client
    .channel(`kaiwa-homework-submissions-${++mySubmissionChannelSeq}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'kaiwa_homework_submissions' },
      onChange
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export class HomeworkApiError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'HomeworkApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseErrorResponse(res: Response, fallback: string): Promise<HomeworkApiError> {
  let code: string | undefined;
  let message: string | undefined;
  try {
    const body = await res.json();
    code = body?.error;
    message = body?.message;
  } catch {
    // body không phải JSON - dùng thẳng status code
  }
  return new HomeworkApiError(message || `${fallback} (HTTP ${res.status}).`, res.status, code);
}

/** Nộp bài - upload blob ghi âm/file đã chọn lên server (server tự đẩy lên Drive). */
export async function submitHomeworkAudio(
  homeworkId: string,
  blob: Blob,
  durationMs: number
): Promise<HomeworkSubmission> {
  let res: Response;
  try {
    res = await fetch(`/kaiwa/homework/submissions?homeworkId=${encodeURIComponent(homeworkId)}`, {
      method: 'POST',
      credentials: 'include', // cookie sb_page_token
      headers: {
        'Content-Type': blob.type || 'application/octet-stream',
        'X-Homework-Duration-Ms': String(Math.round(durationMs) || 0),
      },
      body: blob,
    });
  } catch (err) {
    throw new HomeworkApiError('Không kết nối được máy chủ để nộp bài.', undefined, 'network_error');
  }
  if (!res.ok) throw await parseErrorResponse(res, 'Nộp bài thất bại');
  const data = await res.json();
  return toSubmission(data.submission);
}

/** Xoá bài đã nộp (để nộp lại) - chỉ hoạt động với bài của chính mình, còn hạn. */
export async function deleteHomeworkSubmission(submissionId: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/kaiwa/homework/submissions/${encodeURIComponent(submissionId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (err) {
    throw new HomeworkApiError('Không kết nối được máy chủ để xoá bài.', undefined, 'network_error');
  }
  if (!res.ok) throw await parseErrorResponse(res, 'Xoá bài thất bại');
}

export interface TeacherSubmissionsResult {
  studentName: string | null;
  submissions: HomeworkSubmission[];
}

/**
 * Giáo viên: tra bài nộp của 1 học viên (qua mã) cho 1 buổi học - hoạt động
 * bất kỳ lúc nào, không cần học viên đang trong phòng gọi. Ném lỗi
 * `student_not_found`/`forbidden` (đọc `.code`) để nơi gọi hiện đúng thông
 * báo cạnh ô nhập mã.
 */
export async function fetchStudentSubmissionsForTeacher(
  lessonId: string,
  studentCode: string
): Promise<TeacherSubmissionsResult> {
  let res: Response;
  try {
    const params = new URLSearchParams({ lessonId, studentCode });
    res = await fetch(`/kaiwa/homework/teacher-submissions?${params.toString()}`, {
      credentials: 'include',
    });
  } catch (err) {
    throw new HomeworkApiError('Không kết nối được máy chủ để tra bài học viên.', undefined, 'network_error');
  }
  if (!res.ok) throw await parseErrorResponse(res, 'Tra bài học viên thất bại');
  const data = await res.json();
  return {
    studentName: data.studentName ?? null,
    submissions: (data.submissions || []).map(toSubmission),
  };
}

/** URL để phát 1 bài nộp - dùng thẳng làm `src` cho thẻ `<audio>` (cookie tự đính kèm, cùng origin). */
export function homeworkAudioUrl(submissionId: string): string {
  return `/kaiwa/homework/submissions/${encodeURIComponent(submissionId)}/audio`;
}
