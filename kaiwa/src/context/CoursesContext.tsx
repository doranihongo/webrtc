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
const FALLBACK_COURSES: Course[] = [
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
  },
  // Khóa mẫu - thêm cho đủ 3 khóa/hàng ở trang chủ, chưa có buổi học thật.
  {
    id: 'kaiwa-caocap',
    title: 'KAIWA CAO CẤP',
    description: 'Khóa học hội thoại Tiếng Nhật giao tiếp Cao cấp N1. Phản xạ tự nhiên như người bản xứ.',
    imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
    lessons: []
  }
];

const FALLBACK_LESSONS: Record<string, any[]> = {
  'kaiwa-socap': [
    {
      id: 'lesson-s1',
      title: 'Bài 1: Giới thiệu bản thân & Chào hỏi tự nhiên (自己紹介)',
      description: 'Học cách chào hỏi đúng ngữ cảnh, tự giới thiệu tên, tuổi, quê quán và sở thích bằng Tiếng Nhật tự nhiên.',
      vocabulary: [
        { id: 'v1', word: '自己紹介', sinoVietnamese: 'tự kỷ thiệu giới', reading: 'じこしょうかい', meaning: 'tự giới thiệu bản thân', exampleJapanese: '自己紹介をお願いします。', exampleVietnamese: 'Hãy tự giới thiệu bản thân.' },
        { id: 'v2', word: '出身', sinoVietnamese: 'xuất thân', reading: 'しゅっしん', meaning: 'quê quán, xuất thân', exampleJapanese: '出身はどこですか。', exampleVietnamese: 'Bạn quê ở đâu?' },
        { id: 'v3', word: '趣味', sinoVietnamese: 'thú vị', reading: 'しゅみ', meaning: 'sở thích', exampleJapanese: '趣味は読書です。', exampleVietnamese: 'Sở thích của tôi là đọc sách.' },
        { id: 'v4', word: '初めまして', sinoVietnamese: '', reading: 'はじめまして', meaning: 'rất vui được gặp bạn (câu chào lần đầu)', exampleJapanese: '初めまして、田中です。', exampleVietnamese: 'Rất vui được gặp bạn, tôi là Tanaka.' },
        { id: 'v5', word: 'よろしく', sinoVietnamese: '', reading: 'よろしく', meaning: 'mong được giúp đỡ / làm quen', exampleJapanese: 'どうぞよろしくお願いします。', exampleVietnamese: 'Rất mong được giúp đỡ.' },
      ],
      grammar: [
        { id: 'g1', pattern: '〜は〜です', meaning: 'Cấu trúc câu khẳng định cơ bản "A là B".', exampleJapanese: '私はベトナム人です。', exampleVietnamese: 'Tôi là người Việt Nam.' },
        { id: 'g2', pattern: '〜出身です', meaning: 'Nói về quê quán/nơi xuất thân của bản thân.', exampleJapanese: 'ハノイ出身です。', exampleVietnamese: 'Tôi quê ở Hà Nội.' },
      ]
    },
    {
      id: 'lesson-s2',
      title: 'Bài 2: Mua sắm & Hỏi giá tiền ( me đi shopping )',
      description: 'Hội thoại khi đi siêu thị, cửa hàng tiện lợi, hỏi giá và thanh toán.',
      // Đặt file test vào public/kaiwa-files/ để server phục vụ tại
      // /kaiwa-files/lesson-2.pdf - test nút mở tài liệu.
      lessonFileUrl: '/kaiwa-files/lesson-2.pdf',
      vocabulary: [
        { id: 'v1', word: '値段', sinoVietnamese: 'trị đoạn', reading: 'ねだん', meaning: 'giá cả', exampleJapanese: 'この 値段 は 高い です。', exampleVietnamese: 'Giá này đắt đấy.' },
        { id: 'v2', word: '安い', sinoVietnamese: 'an', reading: 'やすい', meaning: 'rẻ', exampleJapanese: 'このお店は安いです。', exampleVietnamese: 'Cửa hàng này rẻ.' },
        { id: 'v3', word: '高い', sinoVietnamese: 'cao', reading: 'たかい', meaning: 'đắt / cao', exampleJapanese: '高いですが、質がいいです。', exampleVietnamese: 'Tuy đắt nhưng chất lượng tốt.' },
        { id: 'v4', word: 'レジ', sinoVietnamese: '', reading: 'レジ', meaning: 'quầy thu ngân', exampleJapanese: 'レジはあちらです。', exampleVietnamese: 'Quầy thu ngân ở đằng kia.' },
        { id: 'v5', word: '割引', sinoVietnamese: 'cát dẫn', reading: 'わりびき', meaning: 'giảm giá', exampleJapanese: '今日は割引があります。', exampleVietnamese: 'Hôm nay có giảm giá.' },
        { id: 'v6', word: '試着', sinoVietnamese: 'thí trước', reading: 'しちゃく', meaning: 'thử đồ', exampleJapanese: '試着してもいいですか。', exampleVietnamese: 'Tôi thử đồ được không?' },
      ],
      grammar: [
        { id: 'g1', pattern: '〜てもいいですか', meaning: 'Xin phép làm gì đó — "Tôi ... có được không?"', exampleJapanese: 'これを試着してもいいですか。', exampleVietnamese: 'Tôi thử cái này có được không?' },
        { id: 'g2', pattern: '〜はいくらですか', meaning: 'Hỏi giá của một món đồ.', exampleJapanese: 'このかばんはいくらですか。', exampleVietnamese: 'Cái túi này giá bao nhiêu?' },
        { id: 'g3', pattern: '〜をください', meaning: '"Cho tôi ..." — dùng khi yêu cầu/mua đồ.', exampleJapanese: 'これを二つください。', exampleVietnamese: 'Cho tôi hai cái này.' },
      ]
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
