/**
 * "Audio bus" gộp âm thanh của các tính năng trong kaiwa (audio bài học tự
 * host trên hạ tầng của mình, xem điều kiện CORS bên dưới) - để trang cha
 * (client.html/client.js, cùng origin) lấy ra và gộp vào luồng gửi đi khi
 * giáo viên share màn hình.
 *
 * KHÔNG BAO GIỜ chứa âm thanh cuộc gọi (mic/loa của giáo viên hay học
 * viên) - cuộc gọi (WebRTC) nằm hẳn ở trang cha, tách biệt hoàn toàn,
 * không đi qua bus này. Đây chính là lý do dùng bus này thay vì cách share
 * âm thanh tab/toàn màn hình cũ của trình duyệt (getDisplayMedia audio) -
 * cách cũ vô tình thu luôn cả tiếng cuộc gọi (vì cùng 1 tab đang phát ra),
 * gây tiếng vọng dội ngược lại cho người đang nói, và trình duyệt không hề
 * có cách nào loại trừ riêng 1 nguồn ra khỏi việc thu "cả tab". Xem thêm
 * ghi chú ở startScreenSharing() trong public/js/client.js.
 *
 * Không có "tích chọn share âm thanh" nào ở đây cả - bus này TỰ ĐỘNG được
 * gộp vào mỗi khi share màn hình đang diễn ra; đăng ký 1 nguồn vào bus
 * (registerShareableAudio) chính là hành động "cho phép chia sẻ" duy nhất
 * cần làm.
 *
 * ============================================================
 * YÊU CẦU BẮT BUỘC khi thêm 1 nguồn audio/video mới vào bus này:
 * ============================================================
 * 1. File audio phải tải từ nơi CÓ bật header CORS
 *    (Access-Control-Allow-Origin) - vd Cloudflare R2/CDN tự cấu hình
 *    được, KHÔNG áp dụng được cho các nguồn ngoài không kiểm soát được
 *    CORS (như audio từ vựng hiện tại - assets.languagepod101.com - xem
 *    vocabAudioCache.ts).
 * 2. Phần tử <audio>/<video> phải set `element.crossOrigin = "anonymous"`
 *    TRƯỚC KHI gán `src`.
 *
 * Thiếu 1 trong 2 điều kiện trên: Web Audio API coi nguồn đó là "tainted"
 * (bảo vệ bản quyền của trình duyệt) - registerShareableAudio() vẫn chạy
 * không báo lỗi, nhưng nhánh đó câm hoàn toàn trong bus (dù bản thân vẫn
 * nghe bình thường qua phát trực tiếp <audio>/<video> như chưa đăng ký gì).
 */

let audioContext: AudioContext | null = null;
let destinationNode: MediaStreamAudioDestinationNode | null = null;
const connectedElements = new WeakSet<HTMLMediaElement>();

function ensureBus() {
  if (!audioContext) {
    audioContext = new AudioContext();
    destinationNode = audioContext.createMediaStreamDestination();
  }
  return { audioContext, destinationNode: destinationNode! };
}

/**
 * Đăng ký 1 phần tử audio/video để tiếng của nó được gộp thêm vào bus chia
 * sẻ. An toàn khi gọi lại nhiều lần cho cùng 1 phần tử (tự bỏ qua nếu đã
 * đăng ký rồi) - gọi ngay khi tạo/mount phần tử là được, không cần đợi tới
 * lúc phát.
 *
 * Lưu ý: sau khi đăng ký, đường phát ra loa của phần tử đi qua Web Audio
 * graph (source.connect(audioContext.destination) bên dưới) thay vì đường
 * phát mặc định của trình duyệt - vẫn nghe bình thường như trước, chỉ là
 * cơ chế bên dưới đổi khác.
 */
export function registerShareableAudio(element: HTMLMediaElement): void {
  if (connectedElements.has(element)) return;
  const { audioContext, destinationNode } = ensureBus();
  try {
    const source = audioContext.createMediaElementSource(element);
    source.connect(destinationNode);
    // Vẫn cho phát ra loa bình thường - thiếu dòng này phần tử sẽ câm sau
    // khi đăng ký (createMediaElementSource "chiếm" luôn đường phát gốc).
    source.connect(audioContext.destination);
    connectedElements.add(element);
  } catch (err) {
    console.warn('[shareableAudioBus] Không đăng ký được audio element:', err);
  }
}

/**
 * Track audio hiện tại của bus - null nếu chưa có gì đăng ký. Dùng nội bộ
 * bởi setupShareableAudioBridge() để lộ ra cho trang cha qua
 * window.__getShareableAudioTrack.
 */
function getShareableAudioTrack(): MediaStreamTrack | null {
  return destinationNode?.stream.getAudioTracks()[0] || null;
}

/**
 * Lộ getShareableAudioTrack() ra window để trang cha (client.js, cùng
 * origin nên truy cập contentWindow trực tiếp được) gọi lấy track khi cần
 * - không dùng postMessage vì MediaStreamTrack không gửi qua postMessage
 * được (không phải kiểu dữ liệu structured-cloneable/transferable).
 * Gọi 1 lần lúc app khởi động (xem main.tsx).
 */
export function setupShareableAudioBridge(): void {
  (
    window as unknown as {
      __getShareableAudioTrack: () => MediaStreamTrack | null;
    }
  ).__getShareableAudioTrack = getShareableAudioTrack;
}
