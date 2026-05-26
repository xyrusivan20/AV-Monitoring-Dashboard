export interface Task {
  id: string;
  title: string;
  description: string;
  category: 'Engineering' | 'Design' | 'Operations' | 'Marketing';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: string;
  estimatedMinutes: number;
  actualMinutes: number;
}

export interface MetricSnapshot {
  timestamp: string;
  efficiencyScore: number;
  systemLoad: number;
  taskCompletionCount: number;
  focusMinutes: number;
}

export interface LogEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'activity';
  message: string;
}
