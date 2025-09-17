import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { AudioWaveformProps, VADSegment, SpeakerSegment } from '../../../types/whisperx';

const SPEAKER_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // yellow
  '#8B5CF6', // purple
  '#F97316', // orange
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#EC4899', // pink
  '#6B7280'  // gray
];

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  audioData,
  vadSegments = [],
  speakerSegments = [],
  currentTime = 0,
  height = 100,
  className = '',
  onTimeSeek
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height });
  const [isHovering, setIsHovering] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);

  const { processedAudio, duration, speakerColorMap } = useMemo(() => {
    if (!audioData || audioData.length === 0) {
      return { processedAudio: new Float32Array(0), duration: 0, speakerColorMap: new Map() };
    }

    // Downsample audio for visualization (keep every Nth sample)
    const targetSamples = Math.min(canvasSize.width * 2, audioData.length);
    const sampleStep = Math.max(1, Math.floor(audioData.length / targetSamples));
    
    const downsampled = new Float32Array(targetSamples);
    for (let i = 0; i < targetSamples; i++) {
      const sourceIndex = i * sampleStep;
      if (sourceIndex < audioData.length) {
        downsampled[i] = audioData[sourceIndex];
      }
    }

    // Create speaker color mapping
    const uniqueSpeakers = Array.from(new Set(speakerSegments.map(s => s.speaker)));
    const colorMap = new Map<string, string>();
    uniqueSpeakers.forEach((speaker, index) => {
      colorMap.set(speaker, SPEAKER_COLORS[index % SPEAKER_COLORS.length]);
    });

    // Assume 16kHz sample rate for duration calculation
    const sampleRate = 16000;
    const audioDuration = audioData.length / sampleRate;

    return {
      processedAudio: downsampled,
      duration: audioDuration,
      speakerColorMap: colorMap
    };
  }, [audioData, canvasSize.width, speakerSegments]);

  // Update canvas size when container resizes
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [height]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || processedAudio.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasSize;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = '#F3F4F6';
    ctx.fillRect(0, 0, width, height);

    // Draw VAD segments (background)
    if (vadSegments.length > 0) {
      vadSegments.forEach(segment => {
        const startX = (segment.start / duration) * width;
        const endX = (segment.end / duration) * width;
        const segmentWidth = Math.max(endX - startX, 1);
        
        ctx.fillStyle = `rgba(34, 197, 94, ${0.1 + segment.confidence * 0.2})`;
        ctx.fillRect(startX, 0, segmentWidth, height);
      });
    }

    // Draw speaker segments (colored background)
    if (speakerSegments.length > 0) {
      speakerSegments.forEach(segment => {
        const startX = (segment.start / duration) * width;
        const endX = (segment.end / duration) * width;
        const segmentWidth = Math.max(endX - startX, 1);
        
        const color = speakerColorMap.get(segment.speaker) || SPEAKER_COLORS[0];
        const rgb = hexToRgb(color);
        if (rgb) {
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.15 + segment.confidence * 0.15})`;
          ctx.fillRect(startX, height * 0.2, segmentWidth, height * 0.6);
        }
      });
    }

    // Draw waveform
    const centerY = height / 2;
    const amplitude = height * 0.35;
    
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let i = 0; i < processedAudio.length - 1; i++) {
      const x = (i / processedAudio.length) * width;
      const y = centerY - (processedAudio[i] * amplitude);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();

    // Draw current time indicator
    if (currentTime > 0 && currentTime <= duration) {
      const currentX = (currentTime / duration) * width;
      
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentX, 0);
      ctx.lineTo(currentX, height);
      ctx.stroke();

      // Current time marker
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(currentX, height / 2, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw hover time indicator
    if (isHovering && hoverTime >= 0 && hoverTime <= duration) {
      const hoverX = (hoverTime / duration) * width;
      
      ctx.strokeStyle = '#6B7280';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

  }, [processedAudio, canvasSize, vadSegments, speakerSegments, currentTime, duration, speakerColorMap, isHovering, hoverTime]);

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const timeAtX = (x / rect.width) * duration;
    
    setHoverTime(timeAtX);
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const handleClick = (event: React.MouseEvent) => {
    if (!containerRef.current || !onTimeSeek) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const timeAtX = (x / rect.width) * duration;
    
    onTimeSeek(Math.max(0, Math.min(timeAtX, duration)));
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getSegmentAtTime = (time: number): { vad?: VADSegment; speaker?: SpeakerSegment } => {
    const vadSegment = vadSegments.find(s => time >= s.start && time <= s.end);
    const speakerSegment = speakerSegments.find(s => time >= s.start && time <= s.end);
    
    return { vad: vadSegment, speaker: speakerSegment };
  };

  // Convert hex color to RGB
  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  if (!audioData || audioData.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded text-gray-500 ${className}`} style={{ height }}>
        No audio data available
      </div>
    );
  }

  return (
    <div className={`relative border rounded-lg bg-white overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b text-sm">
        <div className="flex items-center gap-4">
          <span className="font-medium text-gray-700">Audio Waveform</span>
          <span className="text-gray-500">Duration: {formatTime(duration)}</span>
          {currentTime > 0 && (
            <span className="text-blue-600">Current: {formatTime(currentTime)}</span>
          )}
        </div>
        
        <div className="flex items-center gap-3 text-xs">
          {vadSegments.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 bg-green-200 rounded"></div>
              <span>Voice Activity</span>
            </div>
          )}
          {speakerSegments.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 bg-blue-200 rounded"></div>
              <span>Speaker Segments</span>
            </div>
          )}
        </div>
      </div>

      {/* Waveform */}
      <div
        ref={containerRef}
        className="relative cursor-pointer"
        style={{ height }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: canvasSize.width, height }}
        />
        
        {/* Hover tooltip */}
        {isHovering && (
          <div
            className="absolute z-10 bg-black text-white text-xs px-2 py-1 rounded pointer-events-none"
            style={{
              left: `${(hoverTime / duration) * 100}%`,
              top: '10px',
              transform: 'translateX(-50%)'
            }}
          >
            <div>{formatTime(hoverTime)}</div>
            {(() => {
              const segments = getSegmentAtTime(hoverTime);
              return (
                <>
                  {segments.vad && (
                    <div className="text-green-300">
                      VAD: {(segments.vad.confidence * 100).toFixed(1)}%
                    </div>
                  )}
                  {segments.speaker && (
                    <div className="text-blue-300">
                      {segments.speaker.speaker}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Time scale */}
      <div className="px-3 py-2 bg-gray-50 border-t">
        <div className="flex justify-between text-xs text-gray-500">
          <span>0:00</span>
          {duration > 30 && (
            <>
              <span>{formatTime(duration / 4)}</span>
              <span>{formatTime(duration / 2)}</span>
              <span>{formatTime(duration * 3 / 4)}</span>
            </>
          )}
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

// Miniature waveform for compact display
export const MiniWaveform: React.FC<Omit<AudioWaveformProps, 'height'> & { height?: number }> = ({
  audioData,
  vadSegments = [],
  currentTime = 0,
  height = 40,
  className = '',
  onTimeSeek
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(200);

  const duration = useMemo(() => {
    return audioData ? audioData.length / 16000 : 0; // Assume 16kHz
  }, [audioData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioData || audioData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvasWidth;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear
    ctx.fillStyle = '#F3F4F6';
    ctx.fillRect(0, 0, width, height);

    // Draw VAD segments
    vadSegments.forEach(segment => {
      const startX = (segment.start / duration) * width;
      const endX = (segment.end / duration) * width;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.fillRect(startX, 0, Math.max(endX - startX, 1), height);
    });

    // Draw simplified waveform
    const sampleStep = Math.max(1, Math.floor(audioData.length / width));
    ctx.strokeStyle = '#6B7280';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const sampleIndex = x * sampleStep;
      if (sampleIndex < audioData.length) {
        const amplitude = Math.abs(audioData[sampleIndex]);
        const y = height / 2 - (amplitude * height * 0.4);
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    
    ctx.stroke();

    // Current time indicator
    if (currentTime > 0 && currentTime <= duration) {
      const currentX = (currentTime / duration) * width;
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentX, 0);
      ctx.lineTo(currentX, height);
      ctx.stroke();
    }

  }, [audioData, canvasWidth, height, vadSegments, currentTime, duration]);

  const handleClick = (event: React.MouseEvent) => {
    if (!onTimeSeek) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = event.clientX - rect.left;
    const timeAtX = (x / rect.width) * duration;
    onTimeSeek(Math.max(0, Math.min(timeAtX, duration)));
  };

  if (!audioData || audioData.length === 0) {
    return (
      <div className={`bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs ${className}`} style={{ height }}>
        No audio
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`w-full cursor-pointer rounded ${className}`}
      style={{ height }}
      onClick={handleClick}
      onLoad={() => {
        if (canvasRef.current) {
          setCanvasWidth(canvasRef.current.offsetWidth);
        }
      }}
    />
  );
};

export default AudioWaveform;