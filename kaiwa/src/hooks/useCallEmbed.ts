import { useEffect, useState } from 'react';

/**
 * Phát hiện trang hiện tại đang được nhúng (iframe) trong 1 cuộc gọi đang
 * diễn ra (client.js mở overlay này khi giáo viên/admin bấm nút "Trang chủ"
 * góc dưới-trái trong phòng gọi - xem setGoHomeCornerBtn trong
 * public/js/client.js, gắn ?embed=call&room=... vào src iframe).
 *
 * Dùng chung cho Home.tsx và các trang con (CourseDetail/LessonView) để
 * quyết định có hiện cụm nút "PiP" + "Quay lại phòng học" (component
 * CallControls) thay cho nút điều hướng thường hay không, và đồng bộ
 * trạng thái PiP thật bên trang gọi qua postMessage
 * ("dora:requestPipState" / "dora:pipState", xem sendPipStateToKaiwa
 * trong public/js/client.js).
 */
export function useCallEmbed() {
  const [isEmbeddedInCall, setIsEmbeddedInCall] = useState(false);
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [isPipActive, setIsPipActive] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsEmbeddedInCall(params.get('embed') === 'call');

    const w = window as any;
    const applyRole = () => setUserRole(w.__authUser?.role);
    if (w.__authReady) {
      w.__authReady.then(applyRole);
    } else {
      applyRole();
    }
  }, []);

  // Chỉ giaovien/admin mới thấy cụm nút PiP/quay-lại-phòng-học - khớp với
  // điều kiện phía client.js chỉ wire nút "Trang chủ" trong phòng gọi cho
  // 2 role này, nên embed=call trên thực tế luôn đi kèm 1 trong 2 role đó,
  // nhưng vẫn check role ở đây cho chắc (đúng như Home.tsx đang làm).
  const showCallControls = isEmbeddedInCall && (userRole === 'giaovien' || userRole === 'admin');

  useEffect(() => {
    if (!showCallControls) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'dora:pipState') {
        setIsPipActive(!!event.data.active);
      }
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'dora:requestPipState' }, window.location.origin);

    return () => window.removeEventListener('message', onMessage);
  }, [showCallControls]);

  return { isEmbeddedInCall, userRole, showCallControls, isPipActive };
}
