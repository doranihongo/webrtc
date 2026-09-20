// ---------------------------------------------------------
// Gọi server ký (HMAC + hạn dùng) toàn bộ URL slide của 1 buổi học - BẮT
// BUỘC qua bước này trước khi hiển thị/preload bất kỳ ảnh slide nào (domain
// ảnh đứng sau 1 Cloudflare Worker chỉ phục vụ URL có chữ ký hợp lệ, xem
// app/src/server.js route POST /kaiwa/sign-slide-urls).
//
// KHÔNG BAO GIỜ fallback về `urls` gốc khi lỗi - im lặng làm vậy sẽ vô hiệu
// hoá toàn bộ cơ chế bảo mật này (ảnh lại xem được không cần token). Mọi lỗi
// NÉM ra ngoài, nơi gọi (LessonView.tsx) tự hiển thị cho người dùng.
// ---------------------------------------------------------

export interface SignSlideUrlsResult {
  urls: string[];
  /** epoch giây - dùng để tự lên lịch ký lại trước khi hết hạn. */
  exp: number;
}

export class SignSlideUrlsError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'SignSlideUrlsError';
    this.status = status;
    this.code = code;
  }
}

export async function signSlideUrls(lessonId: string, urls: string[]): Promise<SignSlideUrlsResult> {
  if (urls.length === 0) return { urls: [], exp: 0 };

  let res: Response;
  try {
    res = await fetch('/kaiwa/sign-slide-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // gửi kèm cookie sb_page_token để server xác thực
      body: JSON.stringify({ lessonId, urls }),
    });
  } catch (err) {
    throw new SignSlideUrlsError('Không kết nối được máy chủ để ký URL slide.', undefined, 'network_error');
  }

  if (!res.ok) {
    let code: string | undefined;
    let message: string | undefined;
    try {
      const body = await res.json();
      code = body?.error;
      message = body?.message;
    } catch {
      // body không phải JSON - dùng thẳng status code
    }
    throw new SignSlideUrlsError(message || `Ký URL slide thất bại (HTTP ${res.status}).`, res.status, code);
  }

  const data = await res.json();
  if (!Array.isArray(data?.urls) || data.urls.length !== urls.length || typeof data?.exp !== 'number') {
    throw new SignSlideUrlsError('Phản hồi ký URL slide không hợp lệ.', res.status, 'malformed_response');
  }

  return { urls: data.urls, exp: data.exp };
}
