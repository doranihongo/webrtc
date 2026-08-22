import { useState, useEffect } from 'react';
import { ArrowLeft, PlayCircle, ChevronRight, Check, Lock } from 'lucide-react';
import { useCourses } from '../context/CoursesContext';
import { useCallEmbed } from '../hooks/useCallEmbed';
import { isCourseAllowed } from '../utils/courseAccess';
import { waitForAuthUser } from '../utils/authState';
import CallControls from './CallControls';


export default function CourseDetail({ courseId, onBack, onHome, onSelectLesson }: {
  courseId: string,
  onBack: () => void,
  onHome: () => void,
  onSelectLesson: (lId: string) => void
}) {
  const { courses, loadedCourseDetails, loadCourseDetails, detailsLoading } = useCourses();
  const profile: any = null;
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const { showCallControls, isPipActive } = useCallEmbed();

  // Lớp phòng thủ thứ 2 - Home.tsx đã chặn không cho bấm vào khóa chưa
  // được cấp quyền rồi (onSelectCourse chỉ gọi khi isAllowed), nhưng vẫn
  // tự kiểm tra lại ở đây cho chắc (không tin tưởng hoàn toàn component
  // cha). undefined lúc mới mount (đợi __authReady) -> coi như CHƯA xác
  // định, không phải "bị khóa" - tránh nháy nhầm màn khóa trước khi kịp
  // đọc xong window.__authUser.
  const [authUser, setAuthUser] = useState<any>(undefined);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    // waitForAuthUser() tự đợi window.__authReady xuất hiện rồi mới đọc,
    // thay vì coi ngay là "chưa đăng nhập" nếu authGuard (common.js) chưa
    // kịp chạy tới - xem giải thích đầy đủ trong utils/authState.ts.
    waitForAuthUser().then((authUser) => {
      setAuthUser(authUser);
      setAuthChecked(true);
    });
  }, []);
  const isAllowed = isCourseAllowed(authUser, courseId);

  useEffect(() => {
    const container = document.getElementById('course-detail-container');
    if (!container) return;

    if (showExitConfirm) {
      container.style.overflow = 'hidden';
    } else {
      container.style.overflow = '';
    }
    return () => {
      container.style.overflow = '';
    };
  }, [showExitConfirm]);

  useEffect(() => {
    loadCourseDetails(courseId);
  }, [courseId]);

  const course = courses.find(
    c => String(c.id).trim().normalize('NFC') === String(courseId).trim().normalize('NFC')
  );
  
  let learnedLessons: Record<string, boolean> = {};
  try {
    const saved = localStorage.getItem('phadao_learned_lessons');
    if (saved) learnedLessons = JSON.parse(saved);
  } catch {}

  if (!course) return <div className="p-8 text-center text-white min-h-screen">Không tìm thấy khóa học</div>;

  if (!authChecked) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="p-8 text-center text-white min-h-screen flex flex-col items-center justify-center gap-4">
        <Lock className="w-12 h-12 text-[#8fb0ce]" />
        <p className="text-white font-bold text-lg">Tài khoản của bạn chưa được cấp quyền truy cập khóa học này.</p>
        <button onClick={onBack} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  const lessons = loadedCourseDetails?.courseId === courseId ? loadedCourseDetails.lessons : [];

  return (
    <div className="h-full flex flex-col font-sans">
      <nav className="h-16 flex-shrink-0 px-6 flex items-center justify-between border-b border-white/10 bg-white/5 backdrop-blur-md z-50 sticky top-0">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="hover:bg-white/10 text-white p-2 rounded-lg transition-colors border border-transparent mr-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <img src="https://i.ibb.co/GvC0pFmy/Logo-tr-ng.png" alt="DORA" className="h-8 object-contain -mt-[5px]" />
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            {showCallControls ? (
              <CallControls isPipActive={isPipActive} />
            ) : (
              <button onClick={() => setShowExitConfirm(true)} className="h-10 px-3 sm:px-4 hover:text-blue-200 transition-colors uppercase border border-white/20 rounded-lg hover:border-white/40 text-xs sm:text-sm font-semibold text-white flex items-center justify-center whitespace-nowrap">Trang chủ</button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full p-4 md:p-8 pb-16">
        <div className="max-w-5xl w-full mx-auto flex flex-col gap-8">
        {/* Hero Section */}
        <div className="bg-surface-border-strong rounded-3xl overflow-hidden shadow-sm border border-white/10">
          <div className="h-64 md:h-80 w-full relative">
              {course.imageUrl && <img src={course.imageUrl} alt={course.title} className="w-full h-full object-cover" />}
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2 items-end pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-xs font-bold text-blue-700 shadow-md shadow-black/10 flex items-center gap-1.5">
                    <PlayCircle className="w-4 h-4 text-blue-600" />
                    <span>{lessons.length} Buổi học</span>
                  </div>
              </div>
          </div>
          <div className="p-5 md:p-8 flex flex-col gap-3">
              <h1 className="text-2xl md:text-4xl font-bold text-white">{course.title}</h1>
              <p className="text-sm md:text-lg text-[#8fb0ce] font-medium leading-relaxed">{course.description}</p>
          </div>
        </div>

        {/* Lesson List */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <PlayCircle className="w-7 h-7 text-blue-200" />
            Danh sách các buổi học
          </h2>
          {detailsLoading ? (
            <div className="flex justify-center p-12">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {lessons.map((lesson: any, index: number) => {
                return (
                  <button
                    key={lesson.id}
                    onClick={() => onSelectLesson(lesson.id)}
                    className="w-full bg-surface-border-strong p-4 md:p-6 rounded-2xl border border-white/10 shadow-sm hover:shadow-md hover:border-blue-400 transition-all flex items-center gap-4 md:gap-6 group text-left cursor-pointer"
                  >
                    <div className={`w-14 h-14 md:w-16 md:h-16 flex-shrink-0 ${learnedLessons[`${courseId}_${lesson.id}`] ? 'bg-green-500/10 text-green-400 border-green-400/30' : 'bg-surface text-[#8fb0ce] border-white/10'} border rounded-2xl flex items-center justify-center text-lg md:text-xl font-semibold group-hover:bg-white/10 group-hover:text-white group-hover:border-white/20 transition-colors shadow-sm`}>
                      {learnedLessons[`${courseId}_${lesson.id}`] ? <Check className="w-8 h-8 md:w-8 md:h-8 stroke-[3]" /> : String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg md:text-xl font-bold text-white group-hover:text-blue-200 transition-colors">{lesson.title}</h3>
                    </div>
                    <div className="hidden md:flex text-blue-200 font-bold items-center gap-2 px-5 py-2.5 rounded-xl border border-transparent group-hover:bg-white/10 group-hover:border-white/10 transition-colors">
                      Vào học <ChevronRight className="w-5 h-5" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </main>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 touch-none overscroll-none" onTouchMove={(e) => e.preventDefault()}>
          <div className="bg-surface border border-surface-border rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-xl flex flex-col text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-2">Thoát khóa học</h3>
            <p className="text-[#8fb0ce] font-medium mb-8">Bạn có chắc chắn muốn quay về trang chủ?</p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-[#8fb0ce] bg-white/10 hover:bg-white/20 transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={onHome} 
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
