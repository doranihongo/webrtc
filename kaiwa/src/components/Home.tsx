import { useState, useEffect } from 'react';
import { BookOpen, ChevronRight, MessageCircle, MessagesSquare, Lock, Unlock, Library, Users, Wrench, Repeat, Headphones, Mic, X, Film, PlayCircle, Video, PictureInPicture } from 'lucide-react';
import { useCourses } from '../context/CoursesContext';
import KaiwaModal from './KaiwaModal';
import DictationModal from './DictationModal';
import YoutubeShadowingModal from './YoutubeShadowingModal';

const LEARNING_TOOLS = [
  {
    id: 'SHADOWING',
    title: 'SHADOWING',
    subtitle: 'SHADOWING & PHẢN XẠ',
    icon: Mic,
  },
  {
    id: 'NGHE CHÍNH TẢ',
    title: 'NGHE CHÍNH TẢ',
    subtitle: 'CHÉP CHÍNH TẢ & ĐỤC LỖ',
    icon: Headphones,
  },
  {
    id: 'SHADOWING_YT',
    title: 'NGHE PODCAST',
    subtitle: 'NGHE & SHADOWING',
    icon: Film,
  },
];

const OTHER_ITEMS = [
  { name: 'Tài liệu tham khảo', description: 'Thư viện tổng hợp', icon: Library },
  { name: 'Nhóm học tập', description: 'Trao đổi, thảo luận', icon: Users },
];

export default function Home({ onSelectCourse, onLogout, isHiddenByOverlay }: { onSelectCourse: (cId: string) => void, onLogout: () => void, isHiddenByOverlay?: boolean }) {
  const { courses } = useCourses();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showContactPopup, setShowContactPopup] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [activeToolModal, setActiveToolModal] = useState<string | null>(null);

  // Đang được nhúng (iframe) trong 1 cuộc gọi đang diễn ra (client.js
  // mở overlay này khi giáo viên/admin bấm nút "Trang chủ" góc dưới-trái
  // trong phòng gọi - xem setGoHomeCornerBtn trong public/js/client.js).
  // Chỉ giaovien/admin mới thấy nút "Quay lại phòng học" - học viên vào
  // link này (nếu có) vẫn thấy nút "Phòng học" bình thường.
  const [isEmbeddedInCall, setIsEmbeddedInCall] = useState(false);
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  // Trạng thái PiP thật bên trang gọi (client.js) - chỉ có ý nghĩa khi
  // isEmbeddedInCall, đồng bộ qua postMessage "dora:pipState" (xem
  // useEffect bên dưới + sendPipStateToKaiwa trong public/js/client.js).
  const [isPipActive, setIsPipActive] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const embedded = params.get('embed') === 'call';
    setIsEmbeddedInCall(embedded);

    // Nhúng trong cuộc gọi - ẩn nút tài khoản tĩnh (#kaiwaAccountWidget,
    // xem kaiwa/index.html), nó đè đúng chỗ 2 nút PiP/quay-lại-phòng-học
    // mới thêm trong nav và không cần thiết khi chỉ ghé trang chủ tạm
    // giữa lúc gọi.
    if (embedded) {
      const widget = document.getElementById('kaiwaAccountWidget');
      if (widget) widget.style.display = 'none';
    }

    const w = window as any;
    const applyRole = () => setUserRole(w.__authUser?.role);
    if (w.__authReady) {
      w.__authReady.then(applyRole);
    } else {
      applyRole();
    }
  }, []);

  const showReturnToCall =
    isEmbeddedInCall && (userRole === 'giaovien' || userRole === 'admin');

  // Đồng bộ trạng thái nút "PiP": xin trạng thái hiện tại ngay khi nút
  // này bắt đầu hiện (overlay có thể đã tải ngầm từ trước, nên PiP có
  // thể đã bật sẵn), rồi lắng nghe mọi lần đổi trạng thái tiếp theo (bật
  // qua nút thật trong phòng gọi, hoặc tắt qua nút X cửa sổ PiP thật...).
  useEffect(() => {
    if (!showReturnToCall) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'dora:pipState') {
        setIsPipActive(!!event.data.active);
      }
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'dora:requestPipState' }, window.location.origin);

    return () => window.removeEventListener('message', onMessage);
  }, [showReturnToCall]);

  useEffect(() => {
    if (isHiddenByOverlay) return;
    const isAnyModalOpen = showLogoutConfirm || showContactPopup || showProfileMenu || isDocsModalOpen || !!activeToolModal;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showLogoutConfirm, showContactPopup, showProfileMenu, isDocsModalOpen, activeToolModal, isHiddenByOverlay]);

  // #kaiwaAccountWidget nổi cố định z-index 10000 (xem kaiwa/index.html) -
  // cao hơn mọi popup full-screen của Home (Shadowing/Nghe chính tả/Luyện
  // phát âm dùng z-[500]/z-[200], Tài liệu tham khảo z-[200]), nên đè lên
  // đúng góc trên-phải của các popup này (chỗ nút đóng). Ẩn nút đi trong
  // lúc 1 trong các popup đó đang mở, hiện lại khi đóng - trừ khi vẫn
  // đang nhúng trong cuộc gọi (embed=call, widget đã bị ẩn hẳn ở effect
  // phía trên rồi, không được hiện nhầm lại).
  useEffect(() => {
    if (isEmbeddedInCall) return;
    const widget = document.getElementById('kaiwaAccountWidget');
    if (!widget) return;
    widget.style.display = (isDocsModalOpen || activeToolModal) ? 'none' : '';
  }, [isDocsModalOpen, activeToolModal, isEmbeddedInCall]);

  return (
    <div className={`min-h-screen flex flex-col font-sans ${showLogoutConfirm ? 'h-screen overflow-hidden' : ''}`}>
       <nav className="h-16 px-6 flex flex-shrink-0 items-center justify-between border-b border-white/10 bg-white/5 backdrop-blur-md z-50 sticky top-0">
          <div className="w-full flex items-center justify-between">
             <div className="flex items-center gap-3 text-blue-700">
               <img src="https://i.ibb.co/GvC0pFmy/Logo-tr-ng.png" alt="DORA" className="h-8 object-contain -mt-[5px]" />
             </div>

             {/* Nhúng trong cuộc gọi (embed=call) - thay vì nút tài khoản
                 (bị ẩn ở useEffect trên), hiện 2 nút nhanh: "PiP" (bật/tắt
                 cửa sổ nổi qua postMessage "dora:togglePip", không rời
                 trang chủ) và icon máy quay (quay lại phòng học ngay,
                 cùng "dora:returnToCall" với nút thẻ gradient bên dưới -
                 nháy animate-pulse giống thẻ đó để luôn nổi bật). Nút PiP
                 cố tình giữ NGUYÊN màu sắc/hình dáng của newPipBtn thật
                 trong thanh điều khiển phòng gọi (client.html) - icon
                 vuông, nền slate khi tắt, xanh dương khi bật - để người
                 dùng nhận ra ngay đây là cùng 1 nút, không phải nút mới lạ. */}
             {showReturnToCall && (
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
             )}
          </div>
       </nav>

       <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 flex flex-col gap-8 mb-12">

          {/* Phòng học - vào phòng học trực tuyến (trước đây là nút
              "Vào phòng học" ở nav, giờ là 1 mục riêng phía trên khu vực
              khóa học) */}
          <button
             onClick={() => {
               if (showReturnToCall) {
                 // Đang nhúng trong cuộc gọi - báo cho client.js đóng
                 // overlay lại (không điều hướng gì cả, cuộc gọi phía
                 // dưới chưa từng dừng nên quay lại tức thì).
                 window.parent.postMessage({ type: 'dora:returnToCall' }, window.location.origin);
               } else {
                 window.location.href = '/join';
               }
             }}
             className={`w-full flex items-center gap-4 p-5 md:p-6 rounded-3xl text-white transition-all group text-left mt-2 ${
               showReturnToCall
                 ? 'bg-[linear-gradient(135deg,#3b82f6_0%,#a855f7_35%,#ec4899_65%,#f97316_100%)] shadow-[0_20px_48px_rgba(236,72,153,0.4)] animate-pulse'
                 : 'bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 shadow-[0_20px_48px_rgba(75,180,222,0.25)] hover:shadow-[0_20px_48px_rgba(75,180,222,0.4)] hover:brightness-110'
             }`}
          >
             <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Video className="w-7 h-7" />
             </div>
             <div className="flex-1 min-w-0">
                <h3 className="text-lg md:text-xl font-bold uppercase">
                  {showReturnToCall ? 'Quay lại phòng học' : 'Phòng học'}
                </h3>
                <p className={`text-sm font-medium ${showReturnToCall ? 'text-white/85' : 'text-blue-100'}`}>
                  {showReturnToCall ? 'Đang trong cuộc gọi - bấm để quay lại' : 'Vào lớp học trực tuyến cùng giáo viên'}
                </p>
             </div>
             <ChevronRight className="w-6 h-6 text-white/80 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>

          {/* Courses Section */}
          <section className="flex flex-col gap-8">
             <div className="border-b border-white/10 pb-4">
                 <h2 className="text-2xl md:text-3xl font-bold font-sans text-white flex items-center gap-3 uppercase">
                   <MessagesSquare className="w-8 h-8 text-blue-200" />
                   KAIWA TIẾNG NHẬT
                 </h2>
                 <p className="text-[#8fb0ce] mt-2 font-medium">Thành thạo trong 3 tháng</p>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-3 w-full gap-6 md:gap-8">
               {courses.map(course => {
                 const isAllowed = true;
                 return (
                   <div 
                     role="button"
                     tabIndex={0}
                     key={course.id}
                     onClick={() => {
                       if (isAllowed) {
                         onSelectCourse(course.id);
                       } else {
                         setShowContactPopup(true); // Hiển thị popup liên hệ mở khóa
                       }
                     }}
                     className={`w-full bg-surface border border-surface-border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col text-left h-full cursor-pointer outline-none ${isAllowed ? 'hover:border-blue-400' : 'hover:border-red-400'}`}
                   >
                     {/* Ảnh khóa học */}
                     <div className="h-40 md:h-48 w-full relative overflow-hidden">
                       {course.imageUrl && (
                         <img 
                           src={course.imageUrl} 
                           alt={course.title} 
                           className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" 
                         />
                       )}
                       {!isAllowed && (
                         <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-md flex items-center gap-1.5 z-10">
                           <Lock className="w-3.5 h-3.5 text-red-400" />
                           Chưa mở khóa
                         </div>
                       )}
                       <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 items-end pointer-events-none">
                         {isAllowed && course.lessons && course.lessons.filter((l: any) => l.youtubeLink || l.videoId).length > 0 && (
                           <div className="bg-white/90 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-xs font-bold text-blue-700 shadow-md shadow-black/10 flex items-center gap-1.5">
                             <PlayCircle className="w-4 h-4" />
                             {course.lessons.filter((l: any) => l.youtubeLink || l.videoId).length} Video
                           </div>
                         )}
                       </div>
                     </div>
                     
                     {/* Thông tin khóa học & Nút bấm */}
                     <div className="w-full p-5 flex flex-col flex-1">
                       <h3 className={`text-xl md:text-2xl font-bold mb-2 transition-colors flex items-center justify-between ${isAllowed ? 'text-white group-hover:text-blue-200' : 'text-white/80 group-hover:text-red-400'}`}>
                         <span>{course.title}</span>
                       </h3>
                       <p className="text-[#8fb0ce] text-sm md:text-base leading-relaxed mb-4 flex-1 font-medium">{course.description}</p>

                       {isAllowed ? (
                         <div className="w-full bg-blue-50 text-blue-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all border border-blue-100 hover:border-blue-600 shadow-sm">
                           Học ngay <ChevronRight className="w-5 h-5" />
                         </div>
                       ) : (
                         <div className="w-full bg-surface-panel text-[#8fb0ce] font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all border border-surface-border shadow-sm group-hover:bg-red-500/10 group-hover:text-red-400 group-hover:border-red-400/30">
                           MỞ KHÓA
                           <Lock className="w-5 h-5 text-[#8fb0ce] group-hover:hidden" />
                           <Unlock className="w-5 h-5 text-red-400 hidden group-hover:block" />
                         </div>
                       )}
                     </div>
                   </div>
                 );
               })}
             </div>
          </section>

          {/* Tools + Resources Section - ẩn khi đang nhúng trong cuộc gọi
              (embed=call): chỉ ghé trang chủ tạm để xem khóa học/buổi học,
              không cần các mục này, đỡ phải cuộn nhiều. */}
          {!isEmbeddedInCall && (
            <>
          <section className="bg-surface p-6 md:p-8 rounded-3xl border border-surface-border shadow-sm relative overflow-hidden">
             <div className="border-b border-surface-border pb-4 mb-6">
                <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2.5">
                   <Wrench className="w-5 h-5 text-blue-200" />
                   CÔNG CỤ HỌC TẬP
                </h3>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                 {LEARNING_TOOLS.map((tool) => {
                    const IconComponent = tool.icon;
                    return (
                       <div
                          key={tool.id}
                          onClick={() => setActiveToolModal(tool.id)}
                          className="flex flex-col items-start p-6 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-600 shadow-sm hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                       >
                          <div className="w-12 h-12 rounded-2xl bg-white/15 text-white flex items-center justify-center mb-4 group-hover:bg-white group-hover:text-blue-600 transition-all duration-300">
                             <IconComponent className="w-6 h-6" />
                          </div>
                          <div>
                             <h4 className="font-extrabold text-white text-base sm:text-lg uppercase tracking-wide">
                                {tool.title}
                             </h4>
                             <p className="text-xs font-bold text-blue-100 uppercase tracking-wider mt-1.5">
                                {tool.subtitle}
                             </p>
                          </div>
                       </div>
                    );
                 })}
             </div>
          </section>

          <section className="bg-surface p-6 md:p-8 rounded-3xl border border-surface-border shadow-sm relative overflow-hidden">
             <div className="border-b border-surface-border pb-4 mb-6">
                <h3 className="text-lg font-bold text-white uppercase">Tài nguyên & Cộng đồng</h3>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
               {OTHER_ITEMS.map((tool, idx) => {
                 const Icon = tool.icon;
                 return (
                         <div
                            key={idx}
                            onClick={() => {
                              if ((tool as any).isLibrary) {
                                window.dispatchEvent(new CustomEvent('open_recording_library'));
                              } else if (tool.name === 'Tài liệu tham khảo') {
                                setIsDocsModalOpen(true);
                              } else if (tool.name === 'Nhóm học tập') {
                                window.open('https://www.facebook.com/groups/thithujlptmienphi', '_blank');
                              }
                            }}
                            className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-600 shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer group relative"
                         >
                         <div className="bg-white/15 text-white p-3 rounded-xl shrink-0 group-hover:bg-white group-hover:text-blue-600 transition-all duration-300">
                            <Icon className="w-6 h-6" />
                         </div>
                         <div>
                            <h4 className="font-bold text-white text-sm">{tool.name}</h4>
                            <p className="text-xs text-blue-100 mt-0.5 font-medium">{tool.description}</p>
                         </div>
                       </div>
                     );
                   })}
                 </div>
          </section>
            </>
          )}
       </main>
       
       <footer className="py-6 sm:h-14 sm:py-0 flex-shrink-0 px-6 border-t border-white/10 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 text-[#8fb0ce] text-xs font-semibold tracking-widest mt-auto">
         <div className="text-center sm:text-left">© 2026 DORA VIETNAM</div>
         <div className="flex items-center gap-2">
           <a href="https://www.facebook.com/HocvienDora" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-9 h-9 flex items-center justify-center text-[#8fb0ce] hover:text-white transition-colors">
             <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
           </a>
           <a href="https://www.tiktok.com/@phadaotiengnhat" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-9 h-9 flex items-center justify-center text-[#8fb0ce] hover:text-white transition-colors">
             <svg className="w-4 h-4 fill-current" viewBox="0 0 448 512"><path d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"/></svg>
           </a>
           <a href="https://zalo.me/0332660529" target="_blank" rel="noopener noreferrer" aria-label="Zalo" className="w-9 h-9 flex items-center justify-center text-[#8fb0ce] hover:text-white transition-colors">
             <MessageCircle className="w-4 h-4" />
           </a>
           <a href="https://github.com/doranihongo/webrtc" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="w-9 h-9 flex items-center justify-center text-[#8fb0ce] hover:text-white transition-colors">
             <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16">
               <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
             </svg>
           </a>
         </div>
       </footer>

       {/* Kaiwa Shadowing Modal */}
       <KaiwaModal 
          isOpen={activeToolModal === 'SHADOWING'} 
          onClose={() => setActiveToolModal(null)} 
       />

       {/* Dictation Modal */}
       <DictationModal
          isOpen={activeToolModal === 'NGHE CHÍNH TẢ'}
          onClose={() => setActiveToolModal(null)}
       />

       {/* Shadowing Youtube Modal */}
       <YoutubeShadowingModal
          isOpen={activeToolModal === 'SHADOWING_YT'}
          onClose={() => setActiveToolModal(null)}
       />

       {/* Tool Modal (Placeholder for other tools) */}
       {activeToolModal && activeToolModal !== 'SHADOWING' && activeToolModal !== 'NGHE CHÍNH TẢ' && activeToolModal !== 'SHADOWING_YT' && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setActiveToolModal(null)}>
             <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-surface-border flex flex-col min-h-[380px]" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-surface-border flex justify-between items-center bg-surface-panel">
                    <h3 className="text-base font-bold text-white uppercase flex items-center gap-2.5">
                       {activeToolModal === 'SHADOWING' && <Repeat className="w-5 h-5 text-indigo-400" />}
                       {activeToolModal === 'NGHE CHÍNH TẢ' && <Headphones className="w-5 h-5 text-emerald-400" />}
                       {activeToolModal}
                    </h3>
                    <button onClick={() => setActiveToolModal(null)} className="text-[#8fb0ce] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 md:p-12 flex-1 flex flex-col items-center justify-center text-center">
                   <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                      {activeToolModal === 'SHADOWING' && <Repeat className="w-8 h-8" />}
                      {activeToolModal === 'NGHE CHÍNH TẢ' && <Headphones className="w-8 h-8" />}
                   </div>
                   <h4 className="text-lg font-bold text-white mb-2">Công cụ {activeToolModal}</h4>
                   <p className="text-sm text-[#8fb0ce] font-medium max-w-md">
                     Nội dung giao diện tính năng đang được cập nhật...
                   </p>
                </div>

                <div className="p-4 border-t border-surface-border bg-surface flex justify-end">
                    <button 
                       onClick={() => setActiveToolModal(null)}
                       className="px-6 py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95"
                    >
                       ĐÓNG
                    </button>
                </div>
             </div>
          </div>
       )}

       {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-surface border border-surface-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <h3 className="text-xl font-bold text-white mb-2">Xác nhận đăng xuất</h3>
                <p className="text-[#8fb0ce] mb-6 font-medium">Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?</p>
                <div className="flex justify-end gap-3">
                   <button onClick={() => setShowLogoutConfirm(false)} className="px-5 py-2.5 rounded-xl font-semibold text-[#8fb0ce] hover:bg-white/10 transition-colors">Hủy</button>
                   <button onClick={onLogout} className="px-5 py-2.5 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">Đăng xuất</button>
                </div>
             </div>
          </div>
        )}

        {isDocsModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-surface-border flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-surface-border flex justify-between items-center bg-surface-panel">
                        <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        TÀI LIỆU HỌC TẬP
                        </h3>
                        <button onClick={() => setIsDocsModalOpen(false)} className="text-[#8fb0ce] hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar">
                        <a href="https://drive.google.com/drive/folders/19JT79eX8-xn6jweibSj8vzxnugJwjI4C" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-surface-border hover:border-purple-400/40 hover:bg-purple-500/10 transition-all group">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate group-hover:text-purple-300 pb-1">Sách luyện đề JLPT (N5-N1)</p>
                                <p className="text-[10px] text-[#8fb0ce]">15 quyển</p>
                            </div>
                            <svg className="w-4 h-4 text-[#6f94b8] group-hover:text-purple-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>

                        <a href="https://www.facebook.com/groups/thithujlptmienphi" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-surface-border hover:border-purple-400/40 hover:bg-purple-500/10 transition-all group">
                            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate group-hover:text-purple-300 pb-1">Hàng trăm tài liệu khác...</p>
                                <p className="text-[10px] text-[#8fb0ce]">Tham gia nhóm tự học</p>
                            </div>
                            <svg className="w-4 h-4 text-[#6f94b8] group-hover:text-purple-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                    </div>

                    <div className="p-4 pt-2 bg-surface">
                        <button 
                            onClick={() => setIsDocsModalOpen(false)}
                            className="w-full py-3 bg-blue-700 hover:bg-blue-600 text-white text-sm font-bold rounded-xl shadow-lg transition-transform active:scale-95"
                        >
                            ĐÓNG
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showContactPopup && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setShowContactPopup(false)}>
            <div className="bg-surface border border-surface-border rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

               <div className="relative z-10 flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2 shadow-inner">
                    <BookOpen className="w-8 h-8" />
                  </div>

                  <h3 className="text-xl font-bold text-white">Mở Khóa Khóa Học</h3>
                  <p className="text-[#8fb0ce] text-sm mb-4 leading-relaxed">
                    Khóa học này hiện đang bị khóa. Hãy liên hệ với chúng tôi qua Facebook hoặc Zalo để mua khóa học và được cấp quyền truy cập.
                  </p>
                  
                  <div className="flex w-full gap-3">
                     <a href="https://m.me/874210086055767" target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#1877F2] text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-[#166fe5] transition-colors flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        Facebook
                     </a>
                     <a href="https://zalo.me/0332660529" target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#0068FF] text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-[#005AE0] transition-colors flex items-center justify-center gap-2">
                        <MessageCircle className="w-5 h-5 fill-white" />
                        Zalo
                     </a>
                  </div>
                  
                  <button
                    onClick={() => setShowContactPopup(false)}
                    className="mt-2 w-full py-2.5 text-[#8fb0ce] font-medium hover:bg-white/10 rounded-xl transition-colors"
                  >
                    Đóng
                  </button>
               </div>
            </div>
          </div>
        )}
    </div>
  );
}
