import { useState } from 'react';
import { IconZoom, IconDownload, IconTrash, IconPersona } from './Icons';

export default function ResultGallery({ results, loading, onPreview, resultRef, onDelete, onSetAsAvatar }) {
  const [downloadingIdx, setDownloadingIdx] = useState(null);

  const handleDownload = async (url, index) => {
    setDownloadingIdx(index);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `generated-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(url, '_blank');
    } finally {
      setDownloadingIdx(null);
    }
  };

  if (!loading && results.length === 0) return null;

  return (
    <div className="result-gallery" ref={resultRef}>
      <div className="result-label">生成结果</div>

      {loading && results.length === 0 && (
        <div className="result-loading">
          <div className="loading-box">
            <span className="spinner large" />
            <p>正在生成中，请稍候...</p>
            <p className="loading-sub">通常需要 10-30 秒</p>
          </div>
        </div>
      )}

      <div className="result-grid">
        {results.map((item, index) => (
          <div key={index} className="result-card">
            <div className="result-hover-actions">
              <button
                className="result-action-btn action-avatar"
                onClick={() => onSetAsAvatar && onSetAsAvatar(item.url)}
                title="设为角色头像"
              >
                <IconPersona size={16} />
              </button>
              <button
                className="result-action-btn action-delete"
                onClick={() => onDelete && onDelete(index)}
                title="删除"
              >
                <IconTrash size={16} />
              </button>
            </div>
            <img
              src={item.url}
              alt={item.revised_prompt || `生成结果 ${index + 1}`}
              className="result-image"
              onClick={() => onPreview(item.url)}
            />
            <div className="result-actions">
              <button
                className="result-btn"
                onClick={() => handleDownload(item.url, index)}
                disabled={downloadingIdx === index}
              >
                {downloadingIdx === index ? '下载中...' : <><IconDownload size={16} /> 下载</>}
              </button>
              <button
                className="result-btn secondary"
                onClick={() => onPreview(item.url)}
              >
                <><IconZoom size={16} /> 放大</>
              </button>
            </div>
            {item.revised_prompt && (
              <div className="result-prompt">{item.revised_prompt}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
