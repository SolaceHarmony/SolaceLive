import React, { useMemo, useState } from 'react';
import type { SpeakerVisualizerProps, SpeakerSegment } from '../../../types/whisperx';

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

export const SpeakerVisualizer: React.FC<SpeakerVisualizerProps> = ({
  speakers,
  currentTime = 0,
  height = 120,
  className = '',
  onSpeakerClick
}) => {
  const [hoveredSegment, setHoveredSegment] = useState<SpeakerSegment | null>(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);

  const { processedData, totalDuration, speakerList } = useMemo(() => {
    if (!speakers || speakers.length === 0) {
      return { processedData: [], totalDuration: 0, speakerList: [] };
    }

    const sortedSpeakers = [...speakers].sort((a, b) => a.start - b.start);
    const duration = Math.max(...sortedSpeakers.map(s => s.end));
    const uniqueSpeakers = Array.from(new Set(sortedSpeakers.map(s => s.speaker)));

    // Assign colors to speakers
    const speakerColorMap = new Map<string, string>();
    uniqueSpeakers.forEach((speaker, index) => {
      speakerColorMap.set(speaker, SPEAKER_COLORS[index % SPEAKER_COLORS.length]);
    });

    const processed = sortedSpeakers.map(segment => ({
      ...segment,
      color: speakerColorMap.get(segment.speaker) || SPEAKER_COLORS[0],
      width: ((segment.end - segment.start) / duration) * 100,
      left: (segment.start / duration) * 100
    }));

    return {
      processedData: processed,
      totalDuration: duration,
      speakerList: uniqueSpeakers.map(speaker => ({
        speaker,
        color: speakerColorMap.get(speaker) || SPEAKER_COLORS[0],
        segments: sortedSpeakers.filter(s => s.speaker === speaker),
        totalDuration: sortedSpeakers
          .filter(s => s.speaker === speaker)
          .reduce((sum, s) => sum + (s.end - s.start), 0)
      }))
    };
  }, [speakers]);

  const currentTimePosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    return formatTime(seconds);
  };

  const handleSegmentClick = (segment: SpeakerSegment) => {
    onSpeakerClick?.(segment.speaker);
  };

  const handleSpeakerLabelClick = (speaker: string) => {
    setSelectedSpeaker(selectedSpeaker === speaker ? null : speaker);
    onSpeakerClick?.(speaker);
  };

  const filteredSegments = selectedSpeaker
    ? processedData.filter(s => s.speaker === selectedSpeaker)
    : processedData;

  if (speakers.length === 0) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          No speaker data available
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg bg-white ${className}`}>
      {/* Header with speaker legend */}
      <div className="p-3 border-b bg-gray-50">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Speakers:</span>
          {speakerList.map((speakerInfo) => (
            <button
              key={speakerInfo.speaker}
              className={`
                flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium
                transition-all duration-150 border
                ${selectedSpeaker === speakerInfo.speaker
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }
              `}
              onClick={() => handleSpeakerLabelClick(speakerInfo.speaker)}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: speakerInfo.color }}
              />
              <span>{speakerInfo.speaker}</span>
              <span className="text-gray-500">
                ({formatDuration(speakerInfo.totalDuration)})
              </span>
            </button>
          ))}
        </div>
        
        {totalDuration > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            Total Duration: {formatTime(totalDuration)} | 
            Current Time: {formatTime(currentTime)}
          </div>
        )}
      </div>

      {/* Timeline visualization */}
      <div className="p-3">
        <div
          className="relative bg-gray-100 rounded overflow-hidden"
          style={{ height: height - 80 }}
        >
          {/* Time markers */}
          <div className="absolute top-0 left-0 right-0 h-4 flex justify-between text-xs text-gray-400 px-1">
            <span>0:00</span>
            {totalDuration > 30 && (
              <span>{formatTime(totalDuration / 2)}</span>
            )}
            <span>{formatTime(totalDuration)}</span>
          </div>

          {/* Speaker segments */}
          <div className="absolute top-6 left-0 right-0 bottom-0">
            {filteredSegments.map((segment, index) => (
              <div
                key={index}
                className={`
                  absolute rounded cursor-pointer transition-all duration-150
                  ${hoveredSegment === segment ? 'ring-2 ring-offset-1 ring-blue-400' : ''}
                  ${selectedSpeaker === segment.speaker ? 'opacity-100' : selectedSpeaker ? 'opacity-30' : 'opacity-90'}
                `}
                style={{
                  left: `${segment.left}%`,
                  width: `${Math.max(segment.width, 0.5)}%`,
                  backgroundColor: segment.color,
                  height: '40px',
                  top: '10px'
                }}
                onClick={() => handleSegmentClick(segment)}
                onMouseEnter={() => setHoveredSegment(segment)}
                onMouseLeave={() => setHoveredSegment(null)}
                title={`
                  ${segment.speaker}
                  ${formatTime(segment.start)} - ${formatTime(segment.end)}
                  Duration: ${formatDuration(segment.end - segment.start)}
                  Confidence: ${(segment.confidence * 100).toFixed(1)}%
                `.trim()}
              >
                {/* Segment label for wider segments */}
                {segment.width > 8 && (
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium">
                    {segment.speaker.split('_')[1] || segment.speaker}
                  </div>
                )}
              </div>
            ))}

            {/* Current time indicator */}
            {currentTime > 0 && currentTime <= totalDuration && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                style={{ left: `${currentTimePosition}%` }}
              >
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full" />
                <div className="absolute -top-6 -left-8 text-xs text-red-600 font-medium whitespace-nowrap">
                  {formatTime(currentTime)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Segment details on hover */}
        {hoveredSegment && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="font-medium text-gray-600">Speaker:</span>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: hoveredSegment.color }}
                  />
                  <span className="font-medium">{hoveredSegment.speaker}</span>
                </div>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">Start Time:</span>
                <div className="font-mono text-blue-600">{formatTime(hoveredSegment.start)}</div>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">End Time:</span>
                <div className="font-mono text-blue-600">{formatTime(hoveredSegment.end)}</div>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">Duration:</span>
                <div className="font-mono text-green-600">
                  {formatDuration(hoveredSegment.end - hoveredSegment.start)}
                </div>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">Confidence:</span>
                <div className={`font-medium ${
                  hoveredSegment.confidence >= 0.8 ? 'text-green-600' :
                  hoveredSegment.confidence >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {(hoveredSegment.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="px-3 pb-3 border-t bg-gray-50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600 pt-2">
          <div>
            <span className="font-medium">Total Speakers:</span> {speakerList.length}
          </div>
          <div>
            <span className="font-medium">Total Segments:</span> {speakers.length}
          </div>
          <div>
            <span className="font-medium">Avg Confidence:</span>{' '}
            {(speakers.reduce((sum, s) => sum + s.confidence, 0) / speakers.length * 100).toFixed(1)}%
          </div>
          <div>
            <span className="font-medium">Speech Coverage:</span>{' '}
            {((speakers.reduce((sum, s) => sum + (s.end - s.start), 0) / totalDuration) * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};

// Compact version for smaller spaces
export const CompactSpeakerVisualizer: React.FC<SpeakerVisualizerProps> = ({
  speakers,
  currentTime = 0,
  height = 60,
  className = '',
  onSpeakerClick
}) => {
  const { processedData, totalDuration } = useMemo(() => {
    if (!speakers || speakers.length === 0) {
      return { processedData: [], totalDuration: 0 };
    }

    const sortedSpeakers = [...speakers].sort((a, b) => a.start - b.start);
    const duration = Math.max(...sortedSpeakers.map(s => s.end));
    const uniqueSpeakers = Array.from(new Set(sortedSpeakers.map(s => s.speaker)));

    const speakerColorMap = new Map<string, string>();
    uniqueSpeakers.forEach((speaker, index) => {
      speakerColorMap.set(speaker, SPEAKER_COLORS[index % SPEAKER_COLORS.length]);
    });

    const processed = sortedSpeakers.map(segment => ({
      ...segment,
      color: speakerColorMap.get(segment.speaker) || SPEAKER_COLORS[0],
      width: ((segment.end - segment.start) / duration) * 100,
      left: (segment.start / duration) * 100
    }));

    return { processedData: processed, totalDuration: duration };
  }, [speakers]);

  const currentTimePosition = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  if (speakers.length === 0) {
    return (
      <div className={`bg-gray-100 rounded flex items-center justify-center text-gray-500 text-sm ${className}`} style={{ height }}>
        No speaker data
      </div>
    );
  }

  return (
    <div className={`relative bg-gray-100 rounded overflow-hidden ${className}`} style={{ height }}>
      {processedData.map((segment, index) => (
        <div
          key={index}
          className="absolute top-1 bottom-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
          style={{
            left: `${segment.left}%`,
            width: `${Math.max(segment.width, 0.5)}%`,
            backgroundColor: segment.color
          }}
          onClick={() => onSpeakerClick?.(segment.speaker)}
          title={`${segment.speaker}: ${segment.start.toFixed(1)}s - ${segment.end.toFixed(1)}s`}
        />
      ))}
      
      {currentTime > 0 && currentTime <= totalDuration && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
          style={{ left: `${currentTimePosition}%` }}
        />
      )}
    </div>
  );
};

export default SpeakerVisualizer;