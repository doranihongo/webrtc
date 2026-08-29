import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Course } from '../types';
import { fetchCourses as fetchCoursesFromDb, fetchCourseLessons, subscribeToCourseChanges } from '../utils/supabaseCourses';

type CoursesContextType = {
  courses: Course[];
  loading: boolean;
  globalCustomVocab: any;
  refreshCourses: () => Promise<void>;
  loadedCourseDetails: { courseId: string; lessons: any[] } | null;
  loadCourseDetails: (courseId: string) => Promise<void>;
  detailsLoading: boolean;
  courseAccessError: string | null;
};

// Dữ liệu DỰ PHÒNG - chỉ dùng khi không đọc được Supabase (window.supabaseClient
// chưa sẵn sàng, mất mạng, hoặc lỗi truy vấn). Nguồn dữ liệu THẬT là bảng
// kaiwa_courses/kaiwa_lessons trên Supabase (xem utils/supabaseCourses.ts).
// Để RỖNG (không còn khóa/bài mẫu cứng trong code nữa) - khi Supabase lỗi
// thì hiện danh sách rỗng thay vì dữ liệu giả, vì dữ liệu thật giờ đã có
// sẵn trên Supabase.
const FALLBACK_COURSES: Course[] = [];

const FALLBACK_LESSONS: Record<string, any[]> = {};

const CoursesContext = createContext<CoursesContextType>({
  courses: [],
  loading: false,
  globalCustomVocab: {},
  refreshCourses: async () => {},
  loadedCourseDetails: null,
  loadCourseDetails: async () => {},
  detailsLoading: false,
  courseAccessError: null,
});

export const CoursesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalCustomVocab, setGlobalCustomVocab] = useState<any>({});
  const [courseAccessError, setCourseAccessError] = useState<string | null>(null);
  const [loadedCourseDetails, setLoadedCourseDetails] = useState<{ courseId: string; lessons: any[] } | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  // Khóa đang được xem chi tiết (nếu có) - để tự tải lại đúng buổi học
  // đang mở khi có sự kiện realtime, không phụ thuộc closure cũ của effect.
  const openCourseIdRef = useRef<string | null>(null);

  const fetchCourses = async () => {
    setLoading(true);
    const dbCourses = await fetchCoursesFromDb();
    // null = không đọc được Supabase -> dùng dữ liệu dự phòng. Mảng rỗng
    // [] là kết quả THẬT (bảng chưa có dòng nào) - không thay bằng dự phòng.
    setCourses(dbCourses !== null ? dbCourses : FALLBACK_COURSES);
    setLoading(false);
  };

  const loadCourseDetails = async (courseId: string) => {
    setCourseAccessError(null);
    setDetailsLoading(true);
    openCourseIdRef.current = courseId;

    const dbLessons = await fetchCourseLessons(courseId);
    const lessons = dbLessons !== null ? dbLessons : (FALLBACK_LESSONS[courseId] || []);

    setGlobalCustomVocab({});
    setLoadedCourseDetails({ courseId, lessons });
    setDetailsLoading(false);
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // "dora:refreshCourses" - client.js gửi mỗi lần thật sự mở overlay trang
  // chủ trong lúc gọi (bấm nút "Trang chủ" góc dưới-trái, xem
  // openKaiwaOverlay trong public/js/client.js). Trang này (kaiwaOverlayIframe)
  // chỉ tải NGẦM đúng 1 lần lúc vào phòng rồi không bao giờ tải lại trong
  // suốt cuộc gọi, nên danh sách khóa học đọc lúc đó có thể đã cũ hoặc lỡ
  // dính lỗi mạng thoáng qua - chủ động tải lại 1 lần mỗi khi người dùng
  // thật sự mở ra xem, thay vì chỉ trông chờ vào retry lúc tải trang.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'dora:refreshCourses') {
        fetchCourses();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: ai đó sửa/thêm/xóa dòng trong kaiwa_courses hoặc
  // kaiwa_lessons trên Supabase -> mọi người đang mở app tự thấy ngay,
  // không cần F5. Tải lại danh sách khóa học, và nếu đang xem chi tiết 1
  // khóa thì tải lại luôn buổi học của khóa đó.
  useEffect(() => {
    const unsubscribe = subscribeToCourseChanges(() => {
      fetchCourses();
      if (openCourseIdRef.current) {
        loadCourseDetails(openCourseIdRef.current);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CoursesContext.Provider
      value={{
        courses,
        loading,
        globalCustomVocab,
        refreshCourses: fetchCourses,
        loadedCourseDetails,
        loadCourseDetails,
        detailsLoading,
        courseAccessError,
      }}
    >
      {children}
    </CoursesContext.Provider>
  );
};

export const useCourses = () => useContext(CoursesContext);
