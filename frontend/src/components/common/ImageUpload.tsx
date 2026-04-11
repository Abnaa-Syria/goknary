import React, { useState, useRef } from 'react';
import { Upload, X, Link as LinkIcon, Loader2, Globe, FileUp } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { getImageUrl } from '../../utils/image';

interface ImageUploadProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  label?: string;
  helperText?: string;
  className?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  multiple = false,
  label,
  helperText,
  className = ""
}) => {
  const [mode, setMode] = useState<'UPLOAD' | 'URL'>('UPLOAD');
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = Array.isArray(value) ? value : (value ? [value] : []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image file`);
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} is too large (max 5MB)`);
        }

        const formData = new FormData();
        formData.append('image', file);

        const response = await api.post('/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        return response.data.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      if (multiple) {
        onChange([...images, ...uploadedUrls]);
      } else {
        onChange(uploadedUrls[0]);
      }

      toast.success('Images uploaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addUrlImage = () => {
    if (!urlInput.trim()) return;
    if (!urlInput.startsWith('http')) {
      toast.error('Please enter a valid URL starting with http:// or https://');
      return;
    }

    if (multiple) {
      onChange([...images, urlInput.trim()]);
    } else {
      onChange(urlInput.trim());
    }
    setUrlInput('');
    toast.success('External image added');
  };

  const removeImage = (urlToRemove: string) => {
    const newImages = images.filter(url => url !== urlToRemove);
    if (multiple) {
      onChange(newImages);
    } else {
      onChange('');
    }

    // Only attempt server deletion if it's our own /uploads/ file
    if (urlToRemove.startsWith('/uploads/')) {
      const filename = urlToRemove.split('/').pop();
      if (filename) {
        api.delete(`/upload/image/${filename}`).catch(console.error);
      }
    }
  };
  console.log(images)
  return (
    <div className={`space-y-4 ${className}`}>
      {label && <label className="block text-sm font-bold text-gray-700">{label}</label>}

      {/* Tab Switcher */}
      <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setMode('UPLOAD')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'UPLOAD' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <FileUp size={14} />
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setMode('URL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'URL' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Globe size={14} />
          Image URL
        </button>
      </div>

      {/* Input Area */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 border-dashed">
        {mode === 'UPLOAD' ? (
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center py-6 cursor-pointer group"
          >
            {uploading ? (
              <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            ) : (
              <>
                <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-primary-600" />
                </div>
                <p className="text-sm font-bold text-gray-900">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP up to 5MB</p>
              </>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple={multiple}
              accept="image/*"
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrlImage())}
              />
            </div>
            <button
              type="button"
              onClick={addUrlImage}
              className="px-6 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all text-sm"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Gallery/Preview Area */}
      <img
        src={`http://localhost:5000${images[0]}`}
        alt={`Preview `}
        className="w-full h-full object-cover"
      />
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((url, index) => (
            <div key={index} className="relative aspect-square rounded-2xl overflow-hidden group border-4 border-white shadow-md ring-1 ring-gray-100">
              <img
                src={getImageUrl(url)}
                alt={` ${index}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="p-2 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              {/* Type Badge */}
              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-[8px] font-black text-white px-2 py-0.5 rounded uppercase">
                {url.startsWith('http') ? 'External' : 'Local'}
              </div>
            </div>
          ))}
        </div>
      )}

      {helperText && <p className="text-xs text-gray-500 italic">{helperText}</p>}
    </div>
  );
};

export default ImageUpload;
