import React, { createContext, useContext, useState, useEffect } from 'react';
import { Course } from '../types';

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

const STATIC_COURSES: Course[] = [
  {
    id: 'kaiwa-socap',
    title: 'KAIWA SƠ CẤP',
    description: 'Khóa học hội thoại Tiếng Nhật giao tiếp Sơ cấp N5 - N4. Luyện phản xạ và phát âm chuẩn Nhật.',
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
    lessons: []
  },
  {
    id: 'kaiwa-trungcap',
    title: 'KAIWA TRUNG CẤP',
    description: 'Khóa học hội thoại Tiếng Nhật giao tiếp Trung cấp N3 - N2. Nâng cao tư duy giao tiếp thực tế.',
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
    lessons: []
  }
];

const STATIC_LESSONS: Record<string, any[]> = {
  'kaiwa-socap': [
    {
      id: 'lesson-s1',
      title: 'Bài 1: Giới thiệu bản thân & Chào hỏi tự nhiên (自己紹介)',
      description: 'Học cách chào hỏi đúng ngữ cảnh, tự giới thiệu tên, tuổi, quê quán và sở thích bằng Tiếng Nhật tự nhiên.'
    },
    {
      id: 'lesson-s2',
      title: 'Bài 2: Mua sắm & Hỏi giá tiền ( me đi shopping )',
      description: 'Hội thoại khi đi siêu thị, cửa hàng tiện lợi, hỏi giá và thanh toán.',
      // Đặt file test vào public/kaiwa-files/ để server phục vụ tại
      // /kaiwa-files/lesson-2.pdf - test nút mở tài liệu.
      lessonFileUrl: '/kaiwa-files/lesson-2.pdf'
    },
    {
      id: 'lesson-s3',
      title: 'Bài 3: Gọi món tại nhà hàng (レストランで注文)',
      description: 'Các mẫu câu giao tiếp khi đặt bàn, gọi món và yêu cầu thanh toán tại quán ăn.'
    },
    {
      id: 'lesson-s4',
      title: 'Bài 4: Hỏi đường & Đi lại bằng tàu điện (道 hỏi & 電車)',
      description: 'Hội thoại hỏi đường, bắt xe buýt, xe taxi và đi tàu điện tại Nhật Bản.'
    }
  ],
  'kaiwa-trungcap': [
    {
      id: 'lesson-t1',
      title: 'Bài 1: Thảo luận công việc & Báo cáo với cấp trên (報連相)',
      description: 'Quy tắc Báo cáo - Liên lạc - Thảo luận (Hourenso) chuẩn văn hóa công sở Nhật.',
      // Ví dụ URL - thay bằng link thật của bạn (file phải truy cập được
      // từ trình duyệt người xem, không bị chặn đăng nhập).
      lessonFileUrl: '/kaiwa-files/lesson-1.pdf'
    },
    {
      id: 'lesson-t2',
      title: 'Bài 2: Đưa ra ý kiến & Phản biện lịch sự ( ý kiến )',
      description: 'Mẫu câu diễn đạt quan điểm, đồng ý hoặc từ chối một cách tinh tế và lịch sự.'
    },
    {
      id: 'lesson-t3',
      title: 'Bài 3: Phỏng vấn xin việc & Thương lượng công việc (面接)',
      description: 'Kỹ năng trả lời phỏng vấn tác phong chuyên nghiệp, trả lời lý do chuyển việc và nguyện vọng.'
    }
  ]
};

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

  const fetchCourses = async () => {
    setCourses(STATIC_COURSES);
    setLoading(false);
  };

  const loadCourseDetails = async (courseId: string) => {
    setCourseAccessError(null);
    setDetailsLoading(true);

    const lessons = STATIC_LESSONS[courseId] || [];
    setGlobalCustomVocab({});
    setLoadedCourseDetails({ courseId, lessons });
    setDetailsLoading(false);
  };

  useEffect(() => {
    fetchCourses();
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
