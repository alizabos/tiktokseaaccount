import { useRef, useState } from 'react';

const API_BASE = '/api';
const MAX_IMAGES = 10;

export default function ImageUploader({ images, onChange }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const isValidImage = (file) => {
    return file.type.startsWith('image/');
  };

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;

    setUploadError('');

    const imageFiles = Array.from(files).filter(isValidImage);
    if (imageFiles.length === 0) {
      setUploadError('请选择图片文件（不支持其他格式）');
      return;
    }
    if (imageFiles.length < files.length) {
      setUploadError(`已过滤 ${files.length - imageFiles.length} 个非图片文件`);
    }

    const remaining = MAX_IMAGES - images.length;
    const selectedFiles = imageFiles.slice(0, remaining);

    if (selectedFiles.length === 0) {
      setUploadError(`最多上传 ${MAX_IMAGES} 张图片`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('images', file));

      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        const reindexed = data.images.map((img, i) => ({
          ...img,
          id: images.length + i,
          label: `@${String(images.length + i + 1).padStart(2, '0')}`,
        }));
        onChange([...images, ...reindexed]);
      } else {
        setUploadError(data.error || '上传失败');
      }
    } catch (err) {
      setUploadError('上传失败，请检查网络连接');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeImage = (index) => {
    const updated = images.filter((_, i) => i !== index);
    const reindexed = updated.map((img, i) => ({
      ...img,
      id: i,
      label: `@${String(i + 1).padStart(2, '0')}`,
    }));
    onChange(reindexed);
  };

  return (
    <div className="image-uploader">
      <div className="uploader-label">
        📷 参考图片
        <span className="uploader-hint">
          拖拽上传，最多 {MAX_IMAGES} 张（已上传 {images.length} 张）
        </span>
      </div>

      {uploadError && <div className="uploader-error">{uploadError}</div>}

      <div className="uploader-grid">
        {images.map((img, index) => (
          <div key={index} className="uploader-card">
            <span className="card-badge">{img.label}</span>
            <button className="card-remove" onClick={() => removeImage(index)}>
              ✕
            </button>
            <img src={img.dataUrl || img.url} alt={img.label} className="card-image" />
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <div
            className={`uploader-card uploader-add ${dragging ? 'dragging' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div className="uploading-spinner" />
            ) : (
              <>
                <span className="add-icon">+</span>
                <span className="add-text">上传图片</span>
              </>
            )}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          handleFileSelect(e.target.files);
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />
    </div>
  );
}
