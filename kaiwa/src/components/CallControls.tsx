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
 */
export default function CallControls({ isPipActive }: { isPipActive: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => window.parent.postMessage({ type: 'dora:togglePip' }, window.location.origin)}
        title={isPipActive ? 'Tắt cửa sổ nổi (PiP)' : 'Bật cửa sổ nổi (PiP)'}
        className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
          isPipActive
            ? 'bg-blue-600 text-white'
            : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
      >
        <PictureInPicture className="w-5 h-5" />
      </button>
      <button
        onClick={() => window.parent.postMessage({ type: 'dora:returnToCall' }, window.location.origin)}
        title="Quay lại phòng học"
        className="flex items-center justify-center w-9 h-9 rounded-xl text-white bg-[linear-gradient(135deg,#3b82f6_0%,#a855f7_35%,#ec4899_65%,#f97316_100%)] shadow-md hover:brightness-110 transition-all animate-pulse"
      >
        <Video className="w-4 h-4" />
      </button>
    </div>
  );
}
