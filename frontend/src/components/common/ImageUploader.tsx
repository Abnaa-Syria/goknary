import React, { useState, useRef, useCallback } from 'react';
import { 
  UploadCloud, 
  Link as LinkIcon, 
  X, 
  Image as ImageIcon, 
  Plus, 
  Monitor,
  FileText
} from 'lucide-react';
import { getImageUrl } from '../../utils/image';
import toast from 'react-hot-toast';

interface ImageUploaderProps {
  value: (File | string)[];
  onChange: (value: (File | string)[]) => void;
  multiple?: boolean;
  label?: string;
  helperText?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  value = [],
  onChange,
  multiple = true,
  label,
  helperText
}) => {
  const [activeTab, setActiveTab] = useState<'LOCAL' | 'URL'>('LOCAL');
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to generate preview URLs
  const getPreviewUrl = (item: File | string) => {
    if (typeof item === 'string') return getImageUrl(item);
    return URL.createObjectURL(item);
  };

  const handleFiles = useCallback((incomingFiles: FileList | File[]) => {
    const validFiles = Array.from(incomingFiles).filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not a valid image format`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 10MB limit`);
        return false;
      }
      return true;
    });

    if (multiple) {
      onChange([...value, ...validFiles]);
    } else {
      onChange([validFiles[0]]);
    }
  }, [value, onChange, multiple]);

  const handleUrlAdd = () => {
    if (!urlInput.trim()) return;
    if (!urlInput.startsWith('http')) {
      toast.error('Invalid URL protocol. Use http:// or https://');
      return;
    }

    if (multiple) {
      onChange([...value, urlInput.trim()]);
    } else {
      onChange([urlInput.trim()]);
    }
    setUrlInput('');
  };

  const removeItem = (index: number) => {
    const newVal = [...value];
    newVal.splice(index, 1);
    onChange(newVal);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {label && (
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ms-1">
            {label}
          </label>
        )}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('LOCAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'LOCAL' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Monitor size={12} />
            Local File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('URL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === 'URL' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <LinkIcon size={12} />
            External Link
          </button>
        </div>
      </div>

      <div className="relative group">
        {activeTab === 'LOCAL' ? (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-[2rem] p-8 text-center cursor-pointer transition-all duration-300
              ${isDragging ? 'border-primary-500 bg-primary-50 scale-[0.99]' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300'}
            `}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden"
              multiple={multiple}
              accept="image/*"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform">
                <UploadCloud size={24} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-gray-900 uppercase">Drop Visual Assets Here</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">or click to browse your workstation</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50/50 border border-gray-100 rounded-[2rem] p-6 flex gap-3">
            <div className="relative flex-1">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">
                <LinkIcon size={18} />
              </div>
              <input 
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleUrlAdd())}
                placeholder="https://cdn.example.com/assets/product_main.webp"
                className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleUrlAdd}
              className="px-6 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-600 transition-all active:scale-95"
            >
              Link Asset
            </button>
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 mt-6">
          {value.map((item, index) => (
            <div key={index} className="relative group aspect-square rounded-2xl overflow-hidden border-4 border-white shadow-md ring-1 ring-gray-100 animate-in fade-in zoom-in duration-300">
              <img 
                src={getPreviewUrl(item)} 
                alt="Upload Preview" 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0"
              >
                <X size={14} />
              </button>
              <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-tighter">
                {typeof item === 'string' ? <span className="flex items-center gap-1"><LinkIcon size={8}/> URL</span> : <span className="flex items-center gap-1"><FileText size={8}/> Local</span>}
              </div>
            </div>
          ))}
          {multiple && (
            <button
              type="button"
              onClick={() => activeTab === 'LOCAL' ? fileInputRef.current?.click() : null}
              className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/20 flex flex-col items-center justify-center gap-2 hover:border-primary-300 hover:bg-primary-50/30 transition-all text-gray-400 hover:text-primary-500"
            >
              <Plus size={20} />
              <span className="text-[8px] font-black uppercase">Add More</span>
            </button>
          )}
        </div>
      )}

      {helperText && (
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ms-1">
          {helperText}
        </p>
      )}
    </div>
  );
};

export default ImageUploader;
