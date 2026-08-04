import React, { useState, useEffect, useRef } from 'react';
import { Settings, X, User, Mic, Video, Volume2, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  setUserName: (name: string) => void;
  selectedAudioDeviceId: string | null;
  setSelectedAudioDeviceId: (id: string | null) => void;
  selectedVideoDeviceId: string | null;
  setSelectedVideoDeviceId: (id: string | null) => void;
  noiseLevel: 'off' | 'medium' | 'high';
  setNoiseLevel: (level: 'off' | 'medium' | 'high') => void;
}

const DeviceSelector = ({ 
  value, 
  onChange, 
  options, 
  placeholder 
}: { 
  value: string | null; 
  onChange: (val: string | null) => void; 
  options: { value: string; label: string }[]; 
  placeholder: string 
}) => {
  const currentIndex = options.findIndex(o => o.value === value);
  const selectedIndex = currentIndex === -1 && options.length > 0 ? 0 : currentIndex;
  
  // Set initial value to the first option if none is selected but options exist
  useEffect(() => {
    if (!value && options.length > 0) {
      onChange(options[0].value);
    }
  }, [value, options, onChange]);

  const handlePrev = () => {
    if (selectedIndex > 0) {
      onChange(options[selectedIndex - 1].value);
    }
  };

  const handleNext = () => {
    if (selectedIndex < options.length - 1) {
      onChange(options[selectedIndex + 1].value);
    }
  };

  const displayLabel = selectedIndex >= 0 && selectedIndex < options.length ? options[selectedIndex].label : placeholder;

  return (
    <div className="flex items-center justify-between bg-slate-800/80 border border-slate-700 rounded-xl p-1">
      <button
        onClick={handlePrev}
        disabled={selectedIndex <= 0}
        className={`p-2 rounded-lg transition-colors ${selectedIndex <= 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer'}`}
      >
        <ChevronLeft className="w-5 h-5 shrink-0" />
      </button>
      <div className="flex-1 text-center px-2 text-sm text-white truncate font-medium">
        {displayLabel}
      </div>
      <button
        onClick={handleNext}
        disabled={selectedIndex === -1 || selectedIndex >= options.length - 1}
        className={`p-2 rounded-lg transition-colors ${selectedIndex === -1 || selectedIndex >= options.length - 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer'}`}
      >
        <ChevronRight className="w-5 h-5 shrink-0" />
      </button>
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  userName,
  setUserName,
  selectedAudioDeviceId,
  setSelectedAudioDeviceId,
  selectedVideoDeviceId,
  setSelectedVideoDeviceId,
  noiseLevel,
  setNoiseLevel,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'audio' | 'video'>('profile');
  const [tempName, setTempName] = useState(userName);
  const [tempAudioDeviceId, setTempAudioDeviceId] = useState(selectedAudioDeviceId);
  const [tempVideoDeviceId, setTempVideoDeviceId] = useState(selectedVideoDeviceId);
  const [tempNoiseLevel, setTempNoiseLevel] = useState(noiseLevel);
  
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTempName(userName);
      setTempAudioDeviceId(selectedAudioDeviceId);
      setTempVideoDeviceId(selectedVideoDeviceId);
      setTempNoiseLevel(noiseLevel);
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
        setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      });
    }
  }, [isOpen, userName, selectedAudioDeviceId, selectedVideoDeviceId, noiseLevel]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (tempName.trim()) {
      setUserName(tempName.trim());
      localStorage.setItem('webrtc_user_name', tempName.trim());
    }
    setSelectedAudioDeviceId(tempAudioDeviceId);
    setSelectedVideoDeviceId(tempVideoDeviceId);
    setNoiseLevel(tempNoiseLevel);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Cài đặt</h2>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-6 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('profile')}
            className={`cursor-pointer pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'profile' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Hồ sơ
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`cursor-pointer pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'audio' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Âm thanh
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`cursor-pointer pb-3 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === 'video' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Camera
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tên hiển thị</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                    }}
                    className="flex-1 px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Thiết bị Microphone</label>
                <DeviceSelector
                  value={tempAudioDeviceId}
                  onChange={setTempAudioDeviceId}
                  placeholder="Mặc định"
                  options={audioDevices.map(d => ({
                    value: d.deviceId,
                    label: d.label || `Microphone ${d.deviceId.slice(0, 5)}...`
                  }))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Lọc tiếng ồn</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTempNoiseLevel('off')}
                    className={`cursor-pointer py-2 rounded-xl text-xs font-semibold border transition-all ${
                      tempNoiseLevel === 'off' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    TẮT
                  </button>
                  <button
                    onClick={() => setTempNoiseLevel('medium')}
                    className={`cursor-pointer py-2 rounded-xl text-xs font-semibold border transition-all ${
                      tempNoiseLevel === 'medium' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    TRUNG BÌNH
                  </button>
                  <button
                    onClick={() => setTempNoiseLevel('high')}
                    className={`cursor-pointer py-2 rounded-xl text-xs font-semibold border transition-all ${
                      tempNoiseLevel === 'high' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    CAO (AI)
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  {tempNoiseLevel === 'off' && 'Micro thu âm tự nhiên, không loại bỏ tiếng ồn nền.'}
                  {tempNoiseLevel === 'medium' && 'Sử dụng bộ lọc tiếng ồn tiêu chuẩn của trình duyệt.'}
                  {tempNoiseLevel === 'high' && 'Sử dụng AI tiên tiến để loại bỏ tạp âm xuất sắc.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Thiết bị Camera</label>
                <DeviceSelector
                  value={tempVideoDeviceId}
                  onChange={setTempVideoDeviceId}
                  placeholder="Mặc định"
                  options={videoDevices.map(d => ({
                    value: d.deviceId,
                    label: d.label || `Camera ${d.deviceId.slice(0, 5)}...`
                  }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="cursor-pointer px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};
