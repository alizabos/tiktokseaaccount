import { useRef, useState, useEffect, useCallback } from 'react';

export default function PromptInput({
  prompt,
  onPromptChange,
  size,
  onSizeChange,
  count,
  onCountChange,
  onGenerate,
  loading,
  sizes,
  imageCount,
  images,
  apiKey,
}) {
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);
  const [showMention, setShowMention] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionFilter, setMentionFilter] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState('');

  const extractRefs = useCallback(() => {
    if (imageCount === 0) return [];
    const matches = [];
    const re = /@(\d{2})/g;
    let m;
    while ((m = re.exec(prompt)) !== null) {
      const num = parseInt(m[1], 10);
      if (num >= 1 && num <= imageCount) {
        const img = images[num - 1];
        if (img && !matches.find((x) => x.num === num)) {
          matches.push({ num, label: m[0], img });
        }
      }
    }
    return matches;
  }, [prompt, imageCount, images]);

  const refs = extractRefs();

  const buildHighlightHtml = useCallback(() => {
    if (refs.length === 0) return prompt;
    const re = /(@\d{2})/g;
    const parts = prompt.split(re);
    return parts
      .map((part) => {
        const m = part.match(/^@(\d{2})$/);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num >= 1 && num <= imageCount) {
            return `<span class="hl-ref">${part}</span>`;
          }
        }
        return part.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      })
      .join('');
  }, [prompt, refs, imageCount]);

  const highlightHtml = buildHighlightHtml();

  const filterImages = () => {
    if (mentionFilter === '') return images;
    const f = mentionFilter.toLowerCase();
    return images.filter(
      (img) => img.label.toLowerCase().includes(f)
    );
  };

  const filtered = filterImages();

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionFilter]);

  useEffect(() => {
    if (showMention && dropdownRef.current) {
      const active = dropdownRef.current.querySelector('.mention-item.active');
      if (active) {
        active.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [mentionIndex, showMention]);

  const closeMention = () => {
    setShowMention(false);
    setMentionFilter('');
    setMentionStart(-1);
  };

  const handleOptimize = async () => {
    if (!prompt.trim()) return;
    if (!apiKey?.trim()) return;

    setOptimizing(true);
    setOptimizeError('');

    try {
      const res = await fetch('/api/optimize-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original: prompt.trim(),
          apiKey: apiKey.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setOptimizeError(data.error || '优化失败');
        return;
      }
      const optimized = data.optimized;
      onPromptChange(optimized);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } catch (err) {
      setOptimizeError('网络错误: ' + err.message);
    } finally {
      setOptimizing(false);
    }
  };

  const insertMention = (img) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const before = prompt.substring(0, mentionStart);
    const after = prompt.substring(ta.selectionStart);
    const newPrompt = before + img.label + ' ' + after;
    onPromptChange(newPrompt);

    closeMention();

    setTimeout(() => {
      ta.focus();
      const pos = mentionStart + img.label.length + 1;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    onPromptChange(val);

    const ta = textareaRef.current;
    if (!ta) return;

    const cursorPos = ta.selectionStart;

    let atPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (val[i] === '@') {
        atPos = i;
        break;
      }
      if (val[i] === ' ' || val[i] === '\n') break;
    }

    if (atPos >= 0 && imageCount > 0) {
      const filter = val.substring(atPos + 1, cursorPos);
      if (cursorPos === atPos + 1 || /^\d*$/.test(filter)) {
        setMentionStart(atPos);
        setMentionFilter(filter);
        setShowMention(true);
        return;
      }
    }

    closeMention();
  };

  const handleKeyDown = (e) => {
    if (showMention) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev < filtered.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev > 0 ? prev - 1 : filtered.length - 1
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filtered[mentionIndex]) {
          insertMention(filtered[mentionIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMention();
        return;
      }
    }

    if (e.key === 'Enter' && !showMention && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onGenerate();
    }
  };

  const handleBlur = () => {
    setTimeout(closeMention, 150);
  };

  return (
    <div className="prompt-input">
      <div className="prompt-input-label">
        💬 Prompt
        <span className="hint-text">输入 @ 选择图片 · Cmd+Enter 发送</span>
      </div>

      {refs.length > 0 && (
        <div className="ref-preview-row">
          {refs.map((ref) => (
            <span key={ref.num} className="ref-preview-tag">
              <img
                src={ref.img.dataUrl || ref.img.url}
                alt={ref.label}
                className="ref-preview-img"
              />
              <span className="ref-preview-label">{ref.label}</span>
            </span>
          ))}
        </div>
      )}

      {imageCount > 0 && refs.length === 0 && (
        <div className="ref-preview-row">
          {images.map((img) => (
            <span
              key={img.id}
              className="ref-preview-tag dim"
              onClick={() => {
                const ta = textareaRef.current;
                if (ta) {
                  ta.focus();
                  const pos = ta.selectionStart;
                  const newP =
                    prompt.substring(0, pos) +
                    img.label +
                    ' ' +
                    prompt.substring(pos);
                  onPromptChange(newP);
                  setTimeout(() => {
                    ta.focus();
                    ta.setSelectionRange(
                      pos + img.label.length + 1,
                      pos + img.label.length + 1
                    );
                  }, 0);
                }
              }}
            >
              <img
                src={img.dataUrl || img.url}
                alt={img.label}
                className="ref-preview-img"
              />
              <span className="ref-preview-label">{img.label}</span>
            </span>
          ))}
          <span className="ref-preview-hint">点击快速引用</span>
        </div>
      )}

      <div className="prompt-textarea-wrap">
        {refs.length > 0 && (
          <div
            className="prompt-highlight-backdrop"
            aria-hidden="true"
          >
            <div
              className="prompt-highlight-content"
              dangerouslySetInnerHTML={{
                __html: highlightHtml + '<br/>',
              }}
            />
          </div>
        )}
        <textarea
          ref={textareaRef}
          className={`prompt-textarea ${refs.length > 0 ? 'has-refs' : ''}`}
          value={prompt}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={
            imageCount > 0
              ? '输入 @ 引用图片，例如：请用 @01 为主体，参考 @02 的风格...'
              : '描述你想要生成的图片...'
          }
          rows={4}
        />

        {showMention && filtered.length > 0 && (
          <div className="mention-dropdown" ref={dropdownRef}>
            {filtered.map((img, i) => (
              <div
                key={img.label}
                className={`mention-item ${i === mentionIndex ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(img);
                }}
                onMouseEnter={() => setMentionIndex(i)}
              >
                <img
                  src={img.dataUrl || img.url}
                  alt={img.label}
                  className="mention-thumb"
                />
                <span className="mention-label">{img.label}</span>
              </div>
            ))}
          </div>
        )}

        <button
          className="optimize-btn"
          onClick={handleOptimize}
          disabled={optimizing || !prompt.trim() || !apiKey?.trim()}
          title="用 GPT-5.5 优化提示词"
        >
          {optimizing ? (
            <span className="optimize-spinner" />
          ) : (
            '✨ 优化提示词'
          )}
        </button>

        {optimizeError && (
          <div className="optimize-error">{optimizeError}</div>
        )}
      </div>

      <div className="params-row">
        <div className="param-group">
          <label className="param-label">尺寸</label>
          <div className="param-options">
            {sizes.map((s) => (
              <button
                key={s.value}
                className={`param-btn ${size === s.value ? 'active' : ''}`}
                onClick={() => onSizeChange(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="param-group">
          <label className="param-label">数量</label>
          <div className="param-options">
            {[1, 2, 4].map((n) => (
              <button
                key={n}
                className={`param-btn ${count === n ? 'active' : ''}`}
                onClick={() => onCountChange(n)}
              >
                {n} 张
              </button>
            ))}
          </div>
        </div>

        <button
          className="generate-btn"
          onClick={onGenerate}
          disabled={loading || !prompt.trim()}
        >
          {loading ? (
            <>
              <span className="spinner" />
              生成中...
            </>
          ) : (
            '🚀 生成图片'
          )}
        </button>
      </div>
    </div>
  );
}
