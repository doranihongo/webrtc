import { PictureInPicture, Video } from 'lucide-react';

/**
 * Cụm nút "PiP" (bật/tắt cửa sổ nổi qua postMessage "dora:togglePip",
 * không rời trang hiện tại) + icon máy quay (quay lại phòng học ngay,
 * "dora:returnToCall") - hiện thay cho nút điều hướng thường khi trang
 * đang nhúng trong 1 cuộc gọi (xem hook useCallEmbed). Nút PiP cố tình giữ
 * NGUYÊN màu sắc/hình dáng của newPipBtn thật trong thanh điều khiển
 * phòng gọi (client.html) - icon vuông, nền slate khi tắt, xanh dương khi
 * bật - để người dùng nhận ra ngay đây là cùng 1 nút, không phải nút mới
 * lạ. Tách thành component riêng để Home.tsx/CourseDetail.tsx/LessonView.tsx
 * dùng chung, không lặp lại logic.
 *
 * Chú thích khi di chuột (2 nút) dùng tooltip TỰ VẼ bằng CSS (không dùng
 * `title` - tránh chú thích mặc định/chậm của trình duyệt). Component này
 * luôn nằm ở góc PHẢI mọi nơi dùng nó (Home.tsx/LessonView.tsx nav,
 * SlideShow.tsx header) nên tooltip neo theo MÉP PHẢI nút (`right-0`, kéo
 * dài sang trái) thay vì canh giữa - tránh tràn ra ngoài màn hình bên phải,
 * chỗ rủi ro tràn thật sự duy nhất khi cụm nút luôn ở sát cạnh phải.
 */
export default function CallControls({ isPipActive }: { isPipActive: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative group">
        <button
          onClick={() => window.parent.postMessage({ type: 'dora:togglePip' }, window.location.origin)}
          className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
            isPipActive
              ? 'bg-blue-600 text-white'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          aria-label="Hình thu nhỏ"
        >
          <PictureInPicture className="w-5 h-5" />
        </button>
        <div className="absolute top-full right-0 mt-1.5 px-2 py-1 bg-zinc-800 text-white text-[10px] font-bold rounded-md shadow-md whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
          Hình thu nhỏ
        </div>
      </div>
      <div className="relative group">
        <button
          onClick={() => {
            // Thoát fullscreen (nếu đang bật, vd đang trong Slide - xem
            // SlideShow.tsx) TRƯỚC khi báo trang cha ẩn iframe kaiwa đi.
            // Thiếu bước này: iframe bị ẩn (display:none) trong khi trình
            // duyệt vẫn coi nó là phần tử đang fullscreen (chưa ai gọi thoát)
            // -> kẹt trạng thái, click ở trang cha (vd mở lại iframe) không
            // ăn cho tới khi tự bấm Esc thoát fullscreen - lỗi thực tế đã gặp.
            // An toàn ở mọi nơi dùng component này (Home.tsx/CourseDetail.tsx
            // không bao giờ bật fullscreen nên chỉ no-op). KHÔNG tự fullscreen
            // lại khi quay về Slide sau đó nữa (thử rồi, không đáng công sức/
            // không ổn định - chấp nhận mất fullscreen, bấm lại tay nếu cần).
            const doc = document as any;
            if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement) {
              if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
              else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
              else if (doc.msExitFullscreen) doc.msExitFullscreen();
            }
            window.parent.postMessage({ type: 'dora:returnToCall' }, window.location.origin);
          }}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-white bg-[linear-gradient(135deg,#3b82f6_0%,#a855f7_35%,#ec4899_65%,#f97316_100%)] shadow-md hover:brightness-110 transition-all animate-pulse"
          aria-label="Về cuộc gọi"
        >
          <Video className="w-4 h-4" />
        </button>
        <div className="absolute top-full right-0 mt-1.5 px-2 py-1 bg-zinc-800 text-white text-[10px] font-bold rounded-md shadow-md whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
          Về cuộc gọi
        </div>
      </div>
    </div>
  );
}
