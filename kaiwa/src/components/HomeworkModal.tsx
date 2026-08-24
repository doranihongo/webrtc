import React from 'react';
import { X, Mic, Square, Trash2, UploadCloud, KeyRound, Loader2, Volume2 } from 'lucide-react';
import type { Homework, HomeworkSubmission } from '../types';
import {
  fetchMySubmissions,
  subscribeToMySubmissionChanges,
  submitHomeworkAudio,
  deleteHomeworkSubmission,
  fetchStudentSubmissionsForTeacher,
  homeworkAudioUrl,
  HomeworkApiError,
  type TeacherSubmissionsResult,
} from '../utils/supabaseHomework';
import { registerShareableAudio } from '../utils/shareableAudioBus';
import HomeworkAudioPlayer from './HomeworkAudioPlayer';

/**
 * "Bài tập về nhà" - popup mở từ nút cùng tên trong LessonView.tsx (khung/
 * hành vi mượn từ FlashcardModal.tsx: root full-screen, khoá cuộn nền,
 * Escape để đóng).
 *
 * 2 view HOÀN TOÀN khác nhau theo role (không có view "chung"):
 *   - hocvien: tự ghi âm/chọn file, nộp/xoá/nộp lại bài của CHÍNH MÌNH cho
 *     từng đề bài của buổi học đang xem.
 *   - giaovien/admin: 1 ô nhập MÃ HỌC VIÊN - nhập đúng mã là ra danh sách
 *     bài học viên đó đã nộp cho buổi học đang xem (hoạt động bất kỳ lúc
 *     nào, không cần học viên đang trong phòng gọi). Bấm "Nghe" một bài:
 *     luôn phát cục bộ cho giáo viên nghe trước; NẾU đang nhúng trong buổi
 *     gọi (isEmbeddedInCall), báo cho trang cha (client.js) qua postMessage
 *     để trộn thêm vào track gửi đi - cả 2 bên cùng nghe qua WebRTC. Xem
 *     kaiwa/src/utils/shareableAudioBus.ts + "dora:homeworkAudioPlaybackChanged"
 *     trong public/js/client.js.
 */

const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm',
];

function getSupportedAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return AUDIO_MIME_CANDIDATES.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
}

// Chỉ là tiện ích UX (tự dừng ghi) - chốt chặn THẬT về dung lượng nằm ở
// server (config.homework.maxUploadBytes, xem app/src/homework.js).
const CLIENT_MAX_DURATION_SECONDS = 15 * 60;

function isPastDeadlineClient(hw: Homework): boolean {
  return !!(hw.deadline && new Date(hw.deadline).getTime() < Date.now());
}

function formatDeadline(hw: Homework): string {
  if (!hw.deadline) return 'Không có hạn nộp';
  const d = new Date(hw.deadline);
  const text = d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  return isPastDeadlineClient(hw) ? `Đã hết hạn (${text})` : `Hạn nộp: ${text}`;
}

interface HomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  homeworks: Homework[];
  lessonId: string;
  userRole?: string;
  isEmbeddedInCall: boolean;
}

export default function HomeworkModal({
  isOpen,
  onClose,
  homeworks,
  lessonId,
  userRole,
  isEmbeddedInCall,
}: HomeworkModalProps) {
  const isStudent = userRole === 'hocvien';
  const isTeacherOrAdmin = userRole === 'giaovien' || userRole === 'admin';

  // Khoá cuộn nền - y hệt FlashcardModal.tsx.
  React.useEffect(() => {
    const container =
      document.getElementById('lesson-view-container') ||
      document.getElementById('course-detail-container') ||
      document.body;
    if (isOpen) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.overflow = 'hidden';
      (container as HTMLElement).style.overflow = 'hidden';
      (container as HTMLElement).style.paddingRight = `${scrollBarWidth}px`;
    } else {
      document.documentElement.style.overflow = '';
      (container as HTMLElement).style.overflow = '';
      (container as HTMLElement).style.paddingRight = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      (container as HTMLElement).style.overflow = '';
      (container as HTMLElement).style.paddingRight = '';
    };
  }, [isOpen]);

  // ---- Học viên: bài đã nộp của chính mình ----
  const homeworkIdsKey = homeworks.map((h) => h.id).join(',');
  const [mySubmissions, setMySubmissions] = React.useState<Record<string, HomeworkSubmission>>({});
  const allHomeworkSubmitted = homeworks.length > 0 && homeworks.every((hw) => !!mySubmissions[hw.id]);

  const reloadMySubmissions = React.useCallback(() => {
    if (!isStudent || homeworks.length === 0) return;
    fetchMySubmissions(homeworks.map((h) => h.id)).then((subs) => {
      if (!subs) return;
      const map: Record<string, HomeworkSubmission> = {};
      for (const s of subs) map[s.homeworkId] = s;
      setMySubmissions(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent, homeworkIdsKey]);

  React.useEffect(() => {
    if (!isOpen || !isStudent) return;
    reloadMySubmissions();
    const unsubscribe = subscribeToMySubmissionChanges(reloadMySubmissions);
    return unsubscribe;
  }, [isOpen, isStudent, reloadMySubmissions]);

  // ---- Học viên: ghi âm/chọn file (1 phiên "đang soạn" tại 1 thời điểm) ----
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const recordStartRef = React.useRef(0);
  const elapsedTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeHomeworkId, setActiveHomeworkId] = React.useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = React.useState<'idle' | 'recording' | 'ready' | 'uploading'>('idle');
  const [draftBlob, setDraftBlob] = React.useState<Blob | null>(null);
  const [draftDurationMs, setDraftDurationMs] = React.useState(0);
  const [draftPreviewUrl, setDraftPreviewUrl] = React.useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [errorByHomework, setErrorByHomework] = React.useState<Record<string, string>>({});
  // Popup xác nhận trước khi xoá bài đã nộp (khác submissionId đang thực sự
  // bị xoá - deletingSubmissionId chỉ set trong lúc chờ server phản hồi, để
  // hiện "Đang xoá...").
  const [confirmDeleteSubmission, setConfirmDeleteSubmission] = React.useState<{ homeworkId: string; submissionId: string } | null>(null);
  const [deletingSubmissionId, setDeletingSubmissionId] = React.useState<string | null>(null);

  const clearDraft = React.useCallback(() => {
    if (draftPreviewUrl) URL.revokeObjectURL(draftPreviewUrl);
    setDraftBlob(null);
    setDraftPreviewUrl(null);
    setDraftDurationMs(0);
    setActiveHomeworkId(null);
    setRecordingStatus('idle');
    setElapsedSec(0);
  }, [draftPreviewUrl]);

  const stopMicStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stopRecording = React.useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  async function startRecording(homeworkId: string) {
    setErrorByHomework((p) => ({ ...p, [homeworkId]: '' }));
    const mimeType = getSupportedAudioMimeType();
    if (!mimeType) {
      setErrorByHomework((p) => ({ ...p, [homeworkId]: 'Trình duyệt này không hỗ trợ ghi âm trực tiếp - hãy dùng "Chọn file".' }));
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setErrorByHomework((p) => ({ ...p, [homeworkId]: 'Không xin được quyền micro.' }));
      return;
    }
    streamRef.current = stream;
    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      const durationMs = Date.now() - recordStartRef.current;
      setDraftBlob(blob);
      setDraftDurationMs(durationMs);
      setDraftPreviewUrl(URL.createObjectURL(blob));
      setRecordingStatus('ready');
      stopMicStream();
    };
    mediaRecorderRef.current = recorder;
    recordStartRef.current = Date.now();
    recorder.start();
    setActiveHomeworkId(homeworkId);
    setRecordingStatus('recording');
    setElapsedSec(0);
    elapsedTimerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    autoStopTimerRef.current = setTimeout(stopRecording, CLIENT_MAX_DURATION_SECONDS * 1000);
  }

  function handleFileChosen(homeworkId: string, file: File) {
    setErrorByHomework((p) => ({ ...p, [homeworkId]: '' }));
    if (draftPreviewUrl) URL.revokeObjectURL(draftPreviewUrl);
    setDraftBlob(file);
    setDraftDurationMs(0); // không rõ trước - server vẫn nhận, chỉ không hiện thời lượng lúc xem trước
    setDraftPreviewUrl(URL.createObjectURL(file));
    setActiveHomeworkId(homeworkId);
    setRecordingStatus('ready');
  }

  async function submitDraft() {
    if (!activeHomeworkId || !draftBlob) return;
    setRecordingStatus('uploading');
    try {
      const submission = await submitHomeworkAudio(activeHomeworkId, draftBlob, draftDurationMs);
      setMySubmissions((p) => ({ ...p, [activeHomeworkId]: submission }));
      clearDraft();
    } catch (err) {
      const message = err instanceof HomeworkApiError ? err.message : 'Nộp bài thất bại.';
      setErrorByHomework((p) => ({ ...p, [activeHomeworkId]: message }));
      setRecordingStatus('ready');
    }
  }

  async function performDeleteMySubmission(homeworkId: string, submissionId: string) {
    setErrorByHomework((p) => ({ ...p, [homeworkId]: '' }));
    setDeletingSubmissionId(submissionId);
    try {
      await deleteHomeworkSubmission(submissionId);
      setMySubmissions((p) => {
        const next = { ...p };
        delete next[homeworkId];
        return next;
      });
      setConfirmDeleteSubmission(null);
    } catch (err) {
      const message = err instanceof HomeworkApiError ? err.message : 'Xoá bài thất bại.';
      setErrorByHomework((p) => ({ ...p, [homeworkId]: message }));
      setConfirmDeleteSubmission(null);
    } finally {
      setDeletingSubmissionId(null);
    }
  }

  // Đóng modal giữa lúc đang ghi -> dừng hẳn, không rò rỉ mic; và dọn bản
  // nháp chưa nộp (không tự nộp thay người dùng).
  React.useEffect(() => {
    if (isOpen) return;
    if (recordingStatus === 'recording') stopRecording();
    stopMicStream();
    clearDraft();
    setConfirmDeleteSubmission(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  React.useEffect(() => {
    return () => {
      stopRecording();
      stopMicStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Giáo viên/admin: tra bài theo mã học viên ----
  // CỐ Ý không lưu mã vào localStorage/đâu cả - gõ lại mỗi lần mở, không
  // giữ lịch sử mã đã tra.
  const [studentCode, setStudentCode] = React.useState('');
  const studentCodeInputRef = React.useRef<HTMLInputElement | null>(null);
  const [teacherLoading, setTeacherLoading] = React.useState(false);
  const [teacherError, setTeacherError] = React.useState<string | null>(null);
  const [teacherResult, setTeacherResult] = React.useState<TeacherSubmissionsResult | null>(null);
  // Mã đã dùng cho lần tra THÀNH CÔNG gần nhất - tách riêng khỏi studentCode
  // (ô nhập vẫn gõ được tiếp sau khi tra) để hiện "Học viên: (mã)" đúng mã
  // thật sự đang xem, không lệch nếu giáo viên gõ tiếp mà chưa bấm Xem lại.
  const [lookedUpCode, setLookedUpCode] = React.useState('');

  // Mỗi bài nộp trong danh sách giáo viên tự có 1 <HomeworkAudioPlayer>
  // riêng (giống hệt view học viên - play/thanh tua/thời lượng, chỉ tải
  // khi bấm play) - Set này chỉ để biết "có đang phát bài nào không" hòng
  // báo trang cha (cả lớp cùng nghe), không điều khiển audio trực tiếp.
  const [playingSubmissionIds, setPlayingSubmissionIds] = React.useState<Set<string>>(new Set());
  const anyPlaying = playingSubmissionIds.size > 0;
  const prevAnyPlayingRef = React.useRef(false);

  const notifyPlaybackChanged = React.useCallback(
    (playing: boolean) => {
      if (!isEmbeddedInCall) return;
      try {
        window.parent.postMessage({ type: 'dora:homeworkAudioPlaybackChanged', isPlaying: playing }, window.location.origin);
      } catch {
        /* bỏ qua - không có gì để làm nếu không gửi được */
      }
    },
    [isEmbeddedInCall],
  );

  // Chỉ báo trang cha đúng lúc THỰC SỰ đổi trạng thái "có/không bài đang
  // phát" (không báo lặp mỗi lần Set đổi nhưng vẫn cùng trạng thái rỗng/có).
  React.useEffect(() => {
    if (anyPlaying !== prevAnyPlayingRef.current) {
      prevAnyPlayingRef.current = anyPlaying;
      notifyPlaybackChanged(anyPlaying);
    }
  }, [anyPlaying, notifyPlaybackChanged]);

  function handleSubmissionPlayingChange(id: string, isPlaying: boolean) {
    setPlayingSubmissionIds((prev) => {
      const next = new Set(prev);
      if (isPlaying) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function lookupStudent() {
    const code = studentCode.trim();
    if (!code) return;
    // Rời con trỏ khỏi ô nhập mã ngay khi tra (Enter hoặc bấm "Xem") - tránh
    // bàn phím ảo (mobile) hoặc viền focus che mất kết quả bên dưới.
    studentCodeInputRef.current?.blur();
    setTeacherLoading(true);
    setTeacherError(null);
    try {
      const result = await fetchStudentSubmissionsForTeacher(lessonId, code);
      setTeacherResult(result);
      setLookedUpCode(code);
    } catch (err) {
      setTeacherResult(null);
      const apiErr = err instanceof HomeworkApiError ? err : null;
      setTeacherError(
        apiErr?.code === 'student_not_found'
          ? 'Không tìm thấy học viên với mã này.'
          : apiErr?.code === 'forbidden'
            ? 'Bạn không có quyền xem buổi học này.'
            : apiErr?.message || 'Tra bài thất bại.',
      );
    } finally {
      setTeacherLoading(false);
    }
  }

  // Đổi buổi học -> reset ô mã + kết quả (không giữ dữ liệu buổi trước, và
  // không tự điền lại mã cũ - xem comment ở khai báo studentCode).
  React.useEffect(() => {
    if (!isTeacherOrAdmin) return;
    setStudentCode('');
    setLookedUpCode('');
    setTeacherResult(null);
    setTeacherError(null);
  }, [lessonId, isTeacherOrAdmin]);

  // Đóng modal giữa lúc đang phát - các <HomeworkAudioPlayer> tự unmount
  // (tự dừng audio), nhưng KHÔNG tự báo trang cha - báo rõ ở đây để
  // client.js không kẹt tưởng vẫn đang phát.
  React.useEffect(() => {
    if (!isOpen && playingSubmissionIds.size > 0) {
      setPlayingSubmissionIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Escape để đóng - y hệt FlashcardModal.tsx, chỉ chặn thêm lúc đang ghi
  // âm dở (tránh mất bản ghi vì bấm nhầm phím).
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (e.key !== 'Escape') return;
      // Đang mở popup xác nhận xoá -> Escape chỉ đóng popup đó (trừ lúc đang
      // thực sự xoá dở), không đóng luôn cả modal bài tập bên dưới.
      if (confirmDeleteSubmission) {
        if (deletingSubmissionId !== confirmDeleteSubmission.submissionId) setConfirmDeleteSubmission(null);
        return;
      }
      if (recordingStatus !== 'recording') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, recordingStatus, onClose, confirmDeleteSubmission, deletingSubmissionId]);

  if (!isOpen) return null;

  return (
    // Khoá nền - CỐ Ý không đóng khi bấm ra ngoài (không có onClick ở đây,
    // khác các modal khác trong kaiwa) - chỉ đóng qua nút X hoặc Escape,
    // tránh mất bản ghi âm/nộp dở vì lỡ tay bấm ra ngoài.
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-surface-border-strong rounded-3xl border border-white/10 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <h3 className="text-lg font-bold text-white">
            {isStudent ? (allHomeworkSubmitted ? 'ĐÃ NỘP' : 'BÀI TẬP') : 'Bài tập về nhà'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {homeworks.length === 0 && (
            <p className="text-sm text-[#8fb0ce] text-center py-6">Buổi học này chưa có bài tập về nhà.</p>
          )}

          {isStudent &&
            homeworks.map((hw) => {
              const submission = mySubmissions[hw.id];
              const pastDeadline = isPastDeadlineClient(hw);
              const isActive = activeHomeworkId === hw.id;
              const error = errorByHomework[hw.id];
              return (
                <div key={hw.id} className="rounded-2xl border border-white/10 bg-black/10 p-4 flex flex-col gap-3">
                  <div>
                    <p className="font-bold text-white">{hw.title}</p>
                    {hw.description && <p className="text-sm text-[#8fb0ce] mt-1 whitespace-pre-wrap">{hw.description}</p>}
                    <p className={`text-xs mt-1.5 font-semibold ${pastDeadline ? 'text-red-400' : 'text-blue-300'}`}>{formatDeadline(hw)}</p>
                  </div>

                  {error && <p className="text-xs text-red-400">{error}</p>}

                  {submission && !isActive && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <HomeworkAudioPlayer
                          src={homeworkAudioUrl(submission.id)}
                          knownDurationSec={submission.durationMs ? submission.durationMs / 1000 : undefined}
                          className="flex-1 min-w-0"
                        />
                        {!pastDeadline && (
                          <div className="relative group shrink-0">
                            <button
                              onClick={() => setConfirmDeleteSubmission({ homeworkId: hw.id, submissionId: submission.id })}
                              className="w-9 h-9 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="absolute top-full right-0 mt-1.5 px-2 py-1 bg-zinc-800 text-white text-[10px] font-bold rounded-md shadow-md whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                              Xoá bài đã nộp
                            </div>
                          </div>
                        )}
                      </div>
                      {!pastDeadline && <p className="text-[11px] text-[#8fb0ce]">Ghi âm/chọn file mới bên dưới để nộp lại (thay thế bài này).</p>}
                    </div>
                  )}

                  {!pastDeadline && !isActive && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startRecording(hw.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors"
                      >
                        <Mic className="w-4 h-4" /> {submission ? 'Ghi âm lại' : 'Ghi âm'}
                      </button>
                      <label className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors cursor-pointer">
                        <UploadCloud className="w-4 h-4" /> Chọn file
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileChosen(hw.id, file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  )}

                  {isActive && recordingStatus === 'recording' && (
                    <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-2.5">
                      <span className="flex items-center gap-2 text-red-300 text-sm font-bold">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Đang ghi âm... {String(Math.floor(elapsedSec / 60)).padStart(1, '0')}:{String(elapsedSec % 60).padStart(2, '0')}
                      </span>
                      <button onClick={stopRecording} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold">
                        <Square className="w-3.5 h-3.5" /> Dừng
                      </button>
                    </div>
                  )}

                  {isActive && (recordingStatus === 'ready' || recordingStatus === 'uploading') && draftPreviewUrl && (
                    <div className="flex flex-col gap-2">
                      <HomeworkAudioPlayer
                        src={draftPreviewUrl}
                        knownDurationSec={draftDurationMs ? draftDurationMs / 1000 : undefined}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={submitDraft}
                          disabled={recordingStatus === 'uploading'}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                        >
                          {recordingStatus === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {recordingStatus === 'uploading' ? 'Đang nộp...' : 'Nộp bài'}
                        </button>
                        {recordingStatus !== 'uploading' && (
                          <button
                            onClick={clearDraft}
                            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
                          >
                            Huỷ
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {isTeacherOrAdmin && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <KeyRound className="w-4 h-4 text-[#8fb0ce] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={studentCodeInputRef}
                    type="text"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') lookupStudent();
                    }}
                    placeholder="Nhập mã học viên"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-[#8fb0ce]/60 text-sm focus:outline-none focus:border-blue-400/60"
                  />
                </div>
                <button
                  onClick={lookupStudent}
                  disabled={teacherLoading || !studentCode.trim()}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold transition-colors flex items-center gap-2"
                >
                  {teacherLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xem
                </button>
              </div>

              {teacherError && <p className="text-sm text-red-400">{teacherError}</p>}

              {teacherResult && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-bold text-white">
                    Học viên: <span className="text-blue-300">{lookedUpCode}</span>
                  </p>
                  {teacherResult.submissions.length === 0 ? (
                    <p className="text-sm text-[#8fb0ce]">Học viên chưa nộp bài nào cho buổi học này.</p>
                  ) : (
                    teacherResult.submissions.map((s) => {
                      const hw = homeworks.find((h) => h.id === s.homeworkId);
                      return (
                        <div key={s.id} className="rounded-2xl border border-white/10 bg-black/10 p-3.5 flex flex-col gap-2">
                          <p className="font-bold text-white text-sm truncate">{hw?.title || 'Bài tập'}</p>
                          <HomeworkAudioPlayer
                            src={homeworkAudioUrl(s.id)}
                            knownDurationSec={s.durationMs ? s.durationMs / 1000 : undefined}
                            onAudioElementReady={registerShareableAudio}
                            onPlayingChange={(isPlaying) => handleSubmissionPlayingChange(s.id, isPlaying)}
                          />
                        </div>
                      );
                    })
                  )}
                  {isEmbeddedInCall && anyPlaying && (
                    <p className="text-[11px] text-blue-300 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5" /> Đang phát cho cả 2 bên cùng nghe qua cuộc gọi.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Popup xác nhận xoá bài đã nộp - bấm ra ngoài CHO PHÉP huỷ (khác
          modal cha) vì đây chỉ là 1 lựa chọn, không có gì để mất. */}
      {confirmDeleteSubmission && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => {
            if (deletingSubmissionId !== confirmDeleteSubmission.submissionId) setConfirmDeleteSubmission(null);
          }}
        >
          <div
            className="w-full max-w-xs bg-surface-border-strong rounded-2xl border border-white/10 shadow-xl p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h4 className="text-white font-bold text-base">Xoá bài đã nộp?</h4>
              <p className="text-sm text-[#8fb0ce] mt-1">Bạn sẽ cần ghi âm/chọn file lại để nộp mới.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteSubmission(null)}
                disabled={deletingSubmissionId === confirmDeleteSubmission.submissionId}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm font-bold transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={() => performDeleteMySubmission(confirmDeleteSubmission.homeworkId, confirmDeleteSubmission.submissionId)}
                disabled={deletingSubmissionId === confirmDeleteSubmission.submissionId}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-60 text-white text-sm font-bold transition-colors"
              >
                {deletingSubmissionId === confirmDeleteSubmission.submissionId && <Loader2 className="w-4 h-4 animate-spin" />}
                {deletingSubmissionId === confirmDeleteSubmission.submissionId ? 'Đang xoá...' : 'Xoá'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
