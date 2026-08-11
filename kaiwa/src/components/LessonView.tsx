import { useState } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useCourses } from '../context/CoursesContext';

export default function LessonView({ courseId, lessonId, onBack, onHome }: { 
  courseId: string, 
  lessonId: string, 
  onBack: () => void,
  onHome: () => void,
  onSelectLesson?: (cId: string, lId: string) => void
}) {
  const { courses, loadedCourseDetails, detailsLoading } = useCourses();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const course = courses.find(
    c => String(c.id).trim().normalize('NFC') === String(courseId).trim().normalize('NFC')
  );

  const lessons = loadedCourseDetails?.courseId === courseId ? loadedCourseDetails.lessons : [];
  
  const lesson = lessons.find(
    (l: any) => String(l.id).trim().normalize('NFC') === String(lessonId).trim().normalize('NFC')
  );

  if (detailsLoading) {
    return (
      <div className="flex justify-center items-center p-12 min-h-screen bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-50 flex flex-col font-sans h-full overflow-hidden">
      {/* Header Navigation */}
      <nav className="h-16 flex-shrink-0 px-6 flex items-center justify-between bg-white border-b border-gray-200 z-50 shadow-sm">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="hover:bg-gray-100 text-gray-600 p-2 rounded-lg transition-colors border border-transparent mr-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <img src="https://i.ibb.co/cKfxwyjx/Logo-DORA.png" alt="DORA" className="h-8 object-contain -mt-[5px]" />
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <button onClick={() => setShowExitConfirm(true)} className="h-10 px-3 sm:px-4 hover:text-blue-600 transition-colors uppercase border border-gray-300 rounded-lg hover:border-blue-600 text-xs sm:text-sm font-semibold text-gray-600 flex items-center justify-center whitespace-nowrap">Trang chủ</button>
          </div>
        </div>
      </nav>

      {/* Main Content: Lesson View (Empty / Blank state as requested) */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
        <div className="bg-white p-6 md:p-10 rounded-3xl border border-gray-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3 text-blue-600">
            <BookOpen className="w-6 h-6" />
            <span className="text-sm font-bold uppercase tracking-wider">{course?.title || 'Khóa học'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900">{lesson?.title || 'Buổi học'}</h1>
        </div>

        {/* Blank content container */}
        <div className="bg-white p-12 md:p-20 rounded-3xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center flex-1 min-h-[300px]">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 opacity-60" />
          </div>
          <p className="text-gray-400 font-medium text-base md:text-lg">Nội dung buổi học hiện tại đang được cập nhật...</p>
        </div>
      </main>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 touch-none overscroll-none" onTouchMove={(e) => e.preventDefault()}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-xl flex flex-col text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Thoát buổi học</h3>
            <p className="text-gray-500 font-medium mb-8">Bạn có chắc chắn muốn quay về trang chủ?</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowExitConfirm(false)} 
                className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
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
