import { useState, useEffect } from 'react';
import Home from './components/Home';
import LessonView from './components/LessonView';
import CourseDetail from './components/CourseDetail';

export default function App() {
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  useEffect(() => {
    // Nút tài khoản tĩnh (#kaiwaAccountWidget, xem kaiwa/index.html) phải ẩn
    // suốt lúc còn ở trong khóa học HAY buổi học - đặt ở đây (theo đúng điều
    // kiện activeCourseId || activeLessonId) thay vì tách riêng trong
    // CourseDetail.tsx/LessonView.tsx, vì 2 component đó lồng nhau chứ
    // không thay thế nhau (vào buổi học không unmount CourseDetail, chỉ
    // LessonView đè lên trên - xem JSX bên dưới). Nếu mỗi component tự ẩn
    // lúc mount/tự hiện lại lúc unmount, thoát buổi học để quay về danh
    // sách buổi học sẽ khiến effect cleanup của LessonView hiện nhầm nút
    // lên dù CourseDetail bên dưới vẫn đang active (đè lên nút "Trang chủ").
    const widget = document.getElementById('kaiwaAccountWidget');

    if (activeCourseId || activeLessonId) {
      if (widget) widget.style.display = 'none';

      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('global-lock');
    } else {
      // Nhúng trong cuộc gọi (embed=call) - Home.tsx tự ẩn/quản lý nút này
      // riêng, không đụng vào ở đây.
      const embedded = new URLSearchParams(window.location.search).get('embed') === 'call';
      if (widget && !embedded) widget.style.display = '';

      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.classList.remove('global-lock');
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
  }, [activeCourseId, activeLessonId]);

  const navToHome = () => { 
    setActiveCourseId(null);
    setActiveLessonId(null);
  };

  return (
    <>
      <Home 
        onSelectCourse={(cId) => setActiveCourseId(cId)} 
        onLogout={() => {}}
        isHiddenByOverlay={!!activeCourseId || !!activeLessonId}
      />

      {activeCourseId && (
        <div key={activeCourseId} id="course-detail-container" className="fixed inset-0 z-[100] bg-[linear-gradient(315deg,#16324f_0%,#24406b_45%,#345da7_100%)] overflow-y-auto custom-scrollbar w-full h-[100dvh] flex flex-col">
          <CourseDetail 
            courseId={activeCourseId} 
            onBack={() => setActiveCourseId(null)}
            onHome={navToHome}
            onSelectLesson={(lId) => setActiveLessonId(lId)}
          />
        </div>
      )}

      {activeCourseId && activeLessonId && (
        <div key={activeLessonId} id="lesson-view-container" className="fixed inset-0 z-[200] bg-[linear-gradient(315deg,#16324f_0%,#24406b_45%,#345da7_100%)] overflow-y-auto custom-scrollbar w-full h-[100dvh] flex flex-col">
          <LessonView 
            courseId={activeCourseId} 
            lessonId={activeLessonId}
            onBack={() => setActiveLessonId(null)}
            onHome={navToHome}
            onSelectLesson={(cId, lId) => { setActiveCourseId(cId); setActiveLessonId(lId); }}
          />
        </div>
      )}
    </>
  );
}
