import { useState } from 'react';
import VideoAnalyzer from './VideoAnalyzer';
import ScriptRecreator from './ScriptRecreator';
import VideoGenerator from './VideoGenerator';

const STEPS = [
  { id: 'analyze', label: '1. 视频识别', icon: '🔍' },
  { id: 'recreate', label: '2. 脚本复刻', icon: '✍️' },
  { id: 'generate', label: '3. 视频生成', icon: '🎬' },
];

export default function VideoModule({ apiKey }) {
  const [activeStep, setActiveStep] = useState('analyze');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [scriptResult, setScriptResult] = useState(null);
  const [storyboardImages, setStoryboardImages] = useState(null);

  return (
    <div className="video-module">
      <div className="video-step-bar">
        {STEPS.map((step) => (
          <button
            key={step.id}
            className={`video-step-btn ${activeStep === step.id ? 'active' : ''} ${
              step.id === 'recreate' && !analysisResult ? 'disabled' : ''
            } ${step.id === 'generate' && !scriptResult ? 'disabled' : ''}`}
            onClick={() => {
              if (step.id === 'recreate' && !analysisResult) return;
              if (step.id === 'generate' && !scriptResult) return;
              setActiveStep(step.id);
            }}
          >
            <span className="step-icon">{step.icon}</span>
            <span className="step-label">{step.label}</span>
          </button>
        ))}
      </div>

      {activeStep === 'analyze' && (
        <VideoAnalyzer
          apiKey={apiKey}
          onComplete={(result) => {
            setAnalysisResult(result);
            setActiveStep('recreate');
          }}
        />
      )}

      {activeStep === 'recreate' && analysisResult && (
        <ScriptRecreator
          apiKey={apiKey}
          analysis={analysisResult}
          onComplete={(script, images) => {
            setScriptResult(script);
            setStoryboardImages(images);
            setActiveStep('generate');
          }}
        />
      )}

      {activeStep === 'generate' && scriptResult && (
        <VideoGenerator
          apiKey={apiKey}
          script={scriptResult}
          storyboardImages={storyboardImages}
        />
      )}
    </div>
  );
}
