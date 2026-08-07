"use strict";

// ---------------------------------------------------------
// Supabase project - dùng CHUNG với web "xóa mù kanji" (cùng
// auth.users, cùng bảng public.profiles). Không phải project riêng.
//
// anon key ở đây là public key, được thiết kế để lộ ra phía client -
// không phải secret (được bảo vệ bằng Row Level Security ở Supabase,
// không phải bằng cách giấu key này).
// ---------------------------------------------------------
const SUPABASE_URL = "https://keywwriietabgahtropc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtleXd3cmlpZXRhYmdhaHRyb3BjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDYzNjMsImV4cCI6MjA5ODEyMjM2M30.ZJY9kDoSNdfik40cehCFblXDE4cFb6uUOtj3Q9zv68I";

// Đuôi email giả để cho đăng nhập bằng "tài khoản" ngắn thay vì email
// đầy đủ (Supabase Auth bắt buộc định dạng email). PHẢI khác đuôi
// "@student.com" mà web kanji đang dùng - nếu trùng, 1 username ở web
// này có thể trùng thẳng vào tài khoản học viên có sẵn bên web kia
// (cùng bảng auth.users, email là khoá duy nhất).
const AUTH_EMAIL_DOMAIN = "@dorakaiwa.com";

// Các role được phép vào web này. Bảng `profiles` dùng chung còn có
// 103 dòng role='student' của web kanji - KHÔNG được thêm 'student'
// vào danh sách này, nếu không toàn bộ học viên kanji sẽ tự nhiên
// đăng nhập được vào web họp luôn.
const ALLOWED_ROLES = ["admin", "giaovien", "hocvien"];

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);
