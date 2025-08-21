import React, { useMemo, useState } from 'react';
import type { TranscriptionDisplayProps, WordSegment } from '../../../types/whisperx';

interface SpeakerSegment {
  speaker: string;
  words: WordSegment[];
  start: number;
  end: number;
  text: string;
}

export const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  result,
  showSpeakers = true,
  showTimestamps = false,
  showConfidence = false,
  highlightCurrentWord = false,
  className = '',
  onWordClick
}) => {
  const [hoveredWord, setHoveredWord] = useState<WordSegment | null>(null);
  const [currentTime] = useState(0);

  const processedResult = useMemo(() => {
    if (!result) return null;

    const segments: SpeakerSegment[] = [];
    let currentSegment: SpeakerSegment | null = null;

    for (const word of result.words) {
      const speaker = word.speaker || 'UNKNOWN';
      
      if (!currentSegment || currentSegment.speaker !== speaker) {
        if (currentSegment) segments.push(currentSegment);
        
        currentSegment = {
          speaker,
          words: [word],
          start: word.start,
          end: word.end,
          text: word.word
        };
      } else {
        currentSegment.words.push(word);
        currentSegment.end = word.end;
        currentSegment.text += ' ' + word.word;
      }
    }
    
    if (currentSegment) segments.push(currentSegment);
    
    return { ...result, segments } as (typeof result & { segments: SpeakerSegment[] });
  }, [result]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getWordClassName = (word: WordSegment): string => {
    let classes = 'inline-block mx-1 px-1 rounded cursor-pointer transition-colors duration-150';
    
    if (highlightCurrentWord && currentTime >= word.start && currentTime <= word.end) {
      classes += ' bg-blue-200 text-blue-900';
    } else if (hoveredWord === word) {
      classes += ' bg-gray-100';
    } else {
      classes += ' hover:bg-gray-50';
    }
    
    if (showConfidence) {
      classes += ' ' + getConfidenceColor(word.confidence);
    }
    
    return classes;
  };

  const handleWordClick = (word: WordSegment) => {
    onWordClick?.(word);
  };

  const handleWordHover = (word: WordSegment | null) => {
    setHoveredWord(word);
  };

  if (!processedResult) {
    return (
      <div className={`p-4 text-gray-500 text-center ${className}`}>
        No transcription available
      </div>
    );
  }

  return (
    <div className={`whitespace-pre-wrap ${className}`}>
      {/* Header */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>Language: {processedResult.language.toUpperCase()}</span>
          <span>Duration: {formatTime(processedResult.duration)}</span>
          {showSpeakers && processedResult.speakers.length > 0 && (
            <span>Speakers: {processedResult.speakers.length}</span>
          )}
        </div>
        
        {/* Legend */}
        {(showConfidence || showTimestamps || showSpeakers) && (
          <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
            {showConfidence && (
              <span className="mr-4">
                Confidence: 
                <span className="ml-1 text-green-600">High</span> |
                <span className="ml-1 text-yellow-600">Medium</span> |
                <span className="ml-1 text-red-600">Low</span>
              </span>
            )}
            {showTimestamps && <span className="mr-4">Click words for timestamps</span>}
            {showSpeakers && <span>Different colors for different speakers</span>}
          </div>
        )}
      </div>

      {/* Transcription Content */}
      <div className="space-y-4">
        {showSpeakers && processedResult.segments ? (
          // Speaker-segmented view
          processedResult.segments.map((segment: SpeakerSegment, segmentIndex: number) => (
            <div key={segmentIndex} className="border-l-4 border-blue-500 pl-4 py-2">
              <div className="flex items-center mb-2">
                <span className="font-semibold text-blue-700 mr-2">
                  {segment.speaker}
                </span>
                {showTimestamps && (
                  <span className="text-xs text-gray-500">
                    {formatTime(segment.start)} - {formatTime(segment.end)}
                  </span>
                )}
              </div>
              
              <div className="leading-relaxed">
                {segment.words.map((word: WordSegment, wordIndex: number) => (
                  <span
                    key={`${segmentIndex}-${wordIndex}`}
                    className={getWordClassName(word)}
                    onClick={() => handleWordClick(word)}
                    onMouseEnter={() => handleWordHover(word)}
                    onMouseLeave={() => handleWordHover(null)}
                    title={showTimestamps ? 
                      `${word.word}\n${formatTime(word.start)} - ${formatTime(word.end)}${showConfidence ? `\nConfidence: ${(word.confidence * 100).toFixed(1)}%` : ''}` 
                      : undefined
                    }
                  >
                    {word.word}
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : (
          // Continuous text view
          <div className="leading-relaxed text-lg">
            {processedResult.words.map((word: WordSegment, index: number) => (
              <span
                key={index}
                className={getWordClassName(word)}
                onClick={() => handleWordClick(word)}
                onMouseEnter={() => handleWordHover(word)}
                onMouseLeave={() => handleWordHover(null)}
                title={showTimestamps ? 
                  `${word.word}\n${formatTime(word.start)} - ${formatTime(word.end)}${showConfidence ? `\nConfidence: ${(word.confidence * 100).toFixed(1)}%` : ''}` 
                  : undefined
                }
              >
                {word.word}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hovered Word Info */}
      {hoveredWord && (showTimestamps || showConfidence) && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
          <div className="font-medium">"{hoveredWord.word}"</div>
          <div className="text-gray-600 mt-1">
            {showTimestamps && (
              <div>Time: {formatTime(hoveredWord.start)} - {formatTime(hoveredWord.end)}</div>
            )}
            {showConfidence && (
              <div className={getConfidenceColor(hoveredWord.confidence)}>
                Confidence: {(hoveredWord.confidence * 100).toFixed(1)}%
              </div>
            )}
            {hoveredWord.speaker && showSpeakers && (
              <div>Speaker: {hoveredWord.speaker}</div>
            )}
          </div>
        </div>
      )}

      {/* Stats Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
        <span>Words: {processedResult.words.length}</span>
        {showConfidence && (
          <span>
            Avg Confidence: {
              (processedResult.words.reduce((sum, w) => sum + w.confidence, 0) / processedResult.words.length * 100).toFixed(1)
            }%
          </span>
        )}
        {processedResult.speakers.length > 0 && (
          <span>Speakers: {processedResult.speakers.map(s => s.speaker).join(', ')}</span>
        )}
      </div>
    </div>
  );
};

// Helper component for individual word rendering
export const WordDisplay: React.FC<{
  word: WordSegment;
  isHighlighted?: boolean;
  showConfidence?: boolean;
  showTimestamp?: boolean;
  onClick?: (word: WordSegment) => void;
}> = ({ word, isHighlighted, showConfidence, showTimestamp, onClick }) => {
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'border-green-500';
    if (confidence >= 0.6) return 'border-yellow-500';
    return 'border-red-500';
  };

  return (
    <span
      className={`
        inline-block mx-1 px-2 py-1 rounded cursor-pointer transition-all duration-150
        ${isHighlighted ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'}
        ${showConfidence ? `border-b-2 ${getConfidenceColor(word.confidence)}` : ''}
      `}
      onClick={() => onClick?.(word)}
      title={`
        ${word.word}
        ${showTimestamp ? `\n${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s` : ''}
        ${showConfidence ? `\nConfidence: ${(word.confidence * 100).toFixed(1)}%` : ''}
        ${word.speaker ? `\nSpeaker: ${word.speaker}` : ''}
      `.trim()}
    >
      {word.word}
    </span>
  );
};

export default TranscriptionDisplay;