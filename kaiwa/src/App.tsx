import { useState, useEffect } from 'react';
import Home from './components/Home';
import LessonView from './components/LessonView';
import CourseDetail from './components/CourseDetail';

export default function App() {
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  useEffect(() => {
    if (activeCourseId || activeLessonId) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('global-lock');
    } else {
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
        <div key={activeCourseId} id="course-detail-container" className="fixed inset-0 z-[100] bg-white overflow-hidden w-full h-[100dvh] flex flex-col">
          <CourseDetail 
            courseId={activeCourseId} 
            onBack={() => setActiveCourseId(null)}
            onHome={navToHome}
            onSelectLesson={(lId) => setActiveLessonId(lId)}
          />
        </div>
      )}

      {activeCourseId && activeLessonId && (
        <div key={activeLessonId} id="lesson-view-container" className="fixed inset-0 z-[200] bg-white overflow-hidden w-full h-[100dvh] flex flex-col"> 
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
