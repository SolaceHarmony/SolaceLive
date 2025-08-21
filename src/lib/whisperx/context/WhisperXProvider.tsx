/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWhisperX, useWhisperXInstances } from '../hooks/useWhisperX';
import type {
  WhisperXContextValue,
  WhisperXProviderProps,
  UseWhisperXOptions,
  UseWhisperXReturn,
  WhisperXConfig
} from '../../../types/whisperx';

const WhisperXContext = createContext<WhisperXContextValue | null>(null);

export const WhisperXProvider: React.FC<WhisperXProviderProps> = ({
  children,
  defaultConfig = {}
}) => {
  const {
    instances,
    createInstance,
    removeInstance,
    globalPerformance
  } = useWhisperXInstances();

  // Create default instance
  const defaultInstance = useWhisperX(defaultConfig);
  
  // Enhanced instance creation with validation
  const createNamedInstance = useCallback((
    id: string, 
    options?: UseWhisperXOptions
  ): UseWhisperXReturn => {
    if (!id) {
      throw new Error('Instance ID is required');
    }
    
    if (instances.has(id)) {
      console.warn(`WhisperX instance '${id}' already exists`);
      return instances.get(id)!;
    }
    
    return createInstance(id, options);
  }, [instances, createInstance]);

  // Enhanced instance removal with cleanup
  const removeNamedInstance = useCallback((id: string) => {
    if (!instances.has(id)) {
      console.warn(`WhisperX instance '${id}' does not exist`);
      return;
    }
    
    removeInstance(id);
  }, [instances, removeInstance]);

  // Context value
  const contextValue: WhisperXContextValue = {
    // Default instance methods
    ...defaultInstance,
    
    // Instance management
    instances,
    createInstance: createNamedInstance,
    removeInstance: removeNamedInstance,
    
    // Global performance monitoring
    globalPerformance
  };

  return (
    <WhisperXContext.Provider value={contextValue}>
      {children}
    </WhisperXContext.Provider>
  );
};

export const useWhisperXContext = (): WhisperXContextValue => {
  const context = useContext(WhisperXContext);
  if (!context) {
    throw new Error('useWhisperXContext must be used within a WhisperXProvider');
  }
  return context;
};

// Convenience hooks for common patterns
export const useWhisperXInstance = (id: string, options?: UseWhisperXOptions): UseWhisperXReturn => {
  const { instances, createInstance } = useWhisperXContext();
  
  const [instance, setInstance] = useState<UseWhisperXReturn | null>(null);
  
  useEffect(() => {
    const existingInstance = instances.get(id);
    if (existingInstance) {
      setInstance(existingInstance);
    } else {
      const newInstance = createInstance(id, options);
      setInstance(newInstance);
    }
  }, [id, options, instances, createInstance]);
  
  if (!instance) {
    throw new Error(`WhisperX instance '${id}' could not be created`);
  }
  
  return instance;
};

// Hook for creating temporary instances (auto-cleanup)
export const useTemporaryWhisperX = (options?: UseWhisperXOptions): UseWhisperXReturn => {
  const { createInstance, removeInstance } = useWhisperXContext();
  const [instanceId] = useState(() => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [instance, setInstance] = useState<UseWhisperXReturn | null>(null);
  
  useEffect(() => {
    const tempInstance = createInstance(instanceId, options);
    setInstance(tempInstance);
    
    return () => {
      removeInstance(instanceId);
    };
  }, [instanceId, options, createInstance, removeInstance]);
  
  if (!instance) {
    throw new Error('Temporary WhisperX instance could not be created');
  }
  
  return instance;
};

// Hook for shared configuration across instances
export const useWhisperXGlobalConfig = () => {
  const { instances } = useWhisperXContext();
  const [globalConfig, setGlobalConfig] = useState<Partial<WhisperXConfig>>({});
  
  const updateGlobalConfig = useCallback((newConfig: Partial<WhisperXConfig>) => {
    setGlobalConfig(prev => ({ ...prev, ...newConfig }));
    
    // Apply to all instances
    instances.forEach(instance => {
      instance.updateConfig(newConfig);
    });
  }, [instances]);
  
  const resetGlobalConfig = useCallback(() => {
    setGlobalConfig({});
  }, []);
  
  return {
    globalConfig,
    updateGlobalConfig,
    resetGlobalConfig
  };
};

// Hook for performance monitoring across all instances
export const useWhisperXGlobalPerformance = () => {
  const { globalPerformance } = useWhisperXContext();
  const [performanceHistory, setPerformanceHistory] = useState<Array<{
    timestamp: number;
    metrics: typeof globalPerformance;
  }>>([]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPerformanceHistory(prev => [
        ...prev.slice(-59), // Keep last 60 entries (1 minute if updated every second)
        {
          timestamp: Date.now(),
          metrics: globalPerformance
        }
      ]);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [globalPerformance]);
  
  const getAveragePerformance = useCallback(() => {
    if (performanceHistory.length === 0) return globalPerformance;
    
    const avgTotal = performanceHistory.reduce(
      (sum, entry) => sum + entry.metrics.totalProcessingTime, 0
    ) / performanceHistory.length;
    
    const avgRTF = performanceHistory.reduce(
      (sum, entry) => sum + entry.metrics.averageRTF, 0
    ) / performanceHistory.length;
    
    const peakMemory = Math.max(
      ...performanceHistory.map(entry => entry.metrics.peakMemoryUsage)
    );
    
    return {
      totalProcessingTime: avgTotal,
      averageRTF: avgRTF,
      peakMemoryUsage: peakMemory
    };
  }, [performanceHistory, globalPerformance]);
  
  return {
    currentPerformance: globalPerformance,
    performanceHistory,
    averagePerformance: getAveragePerformance(),
    clearHistory: () => setPerformanceHistory([])
  };
};

// Hook for instance health monitoring
export const useWhisperXHealthCheck = () => {
  const { instances } = useWhisperXContext();
  const [healthStatus, setHealthStatus] = useState<Record<string, {
    isHealthy: boolean;
    lastCheck: number;
    errorCount: number;
    uptime: number;
  }>>({});
  
  useEffect(() => {
    const checkHealth = () => {
      const newStatus: typeof healthStatus = {};
      
      instances.forEach((instance, id) => {
        const prevStatus = healthStatus[id];
        const isHealthy = instance.state.isInitialized && !instance.error;
        
        newStatus[id] = {
          isHealthy,
          lastCheck: Date.now(),
          errorCount: isHealthy ? 0 : (prevStatus?.errorCount || 0) + 1,
          uptime: prevStatus?.uptime || 0
        };
        
        if (isHealthy && prevStatus) {
          newStatus[id].uptime = prevStatus.uptime + 5000; // +5 seconds
        }
      });
      
      setHealthStatus(newStatus);
    };
    
    const interval = setInterval(checkHealth, 5000); // Check every 5 seconds
    checkHealth(); // Initial check
    
    return () => clearInterval(interval);
  }, [instances, healthStatus]);
  
  const getOverallHealth = useCallback(() => {
    const statuses = Object.values(healthStatus);
    if (statuses.length === 0) return { isHealthy: true, healthyCount: 0, totalCount: 0 };
    
    const healthyCount = statuses.filter(s => s.isHealthy).length;
    return {
      isHealthy: healthyCount === statuses.length,
      healthyCount,
      totalCount: statuses.length
    };
  }, [healthStatus]);
  
  return {
    instanceHealth: healthStatus,
    overallHealth: getOverallHealth()
  };
};