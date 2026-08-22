/**
 * Chặn hiện tượng "nút bị dính": bấm 1 nút bằng CHUỘT xong, nút đó vẫn
 * giữ focus - nếu sau đó gõ phím (Space/Enter...) để làm việc khác thì
 * trình duyệt hiểu nhầm là đang bấm lại chính nút đó, khiến hành động của
 * nút chạy lại ngoài ý muốn (vd: bấm chuột nút "chuyển slide" xong gõ
 * Space để gõ ghi chú thì slide tự nhảy tiếp).
 *
 * Đây là hành vi MẶC ĐỊNH của trình duyệt với <button> đang giữ focus, CSS
 * không có cách nào chặn được (chỉ ẩn được viền/màu, không chặn được việc
 * bàn phím kích hoạt lại nút) - phải dùng JS.
 *
 * Cách chặn: đã có vài nút tự làm riêng lẻ (NotePad.tsx, DictationModal.tsx:
 * `onMouseDown={(e) => e.preventDefault()}`), ở đây áp dụng 1 LẦN cho TOÀN
 * BỘ app - preventDefault ngay lúc mousedown trên mọi <button>/[role="button"]
 * để trình duyệt không gán focus cho nó khi bấm bằng CHUỘT. Bấm chuột vẫn
 * kích hoạt onClick bình thường (preventDefault trên mousedown không hủy
 * sự kiện click phát sinh sau đó) - chỉ có phần "giữ focus" bị chặn. Bấm
 * Tab bằng bàn phím vẫn focus + Enter/Space vẫn kích hoạt nút như thường
 * (chỉ chặn focus phát sinh từ CHUỘT, không đụng tới bàn phím).
 */
export function preventStickyButtonFocus() {
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest('button, [role="button"]') as
      | HTMLButtonElement
      | HTMLElement
      | null;
    if (!btn || (btn as HTMLButtonElement).disabled) return;
    e.preventDefault();
  });
}
