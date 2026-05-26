import React from 'react';
import { motion } from 'motion/react';
import { Task, MetricSnapshot, LogEvent } from '../types';
import { Camera, Video, HardDrive, Activity } from 'lucide-react';

interface AnalyticsSectionProps {
  metricsHistory: MetricSnapshot[];
  logEvents: LogEvent[];
  tasks: Task[];
  onClearLogs: () => void;
  onSimulateError: () => void;
}

export default function AnalyticsSection({ tasks }: AnalyticsSectionProps) {
  const xyCoverages = tasks.filter(t => t.description.includes('Assigned: Xy')).length;
  const patCoverages = tasks.filter(t => t.description.includes('Assigned: Pat')).length;
  const transferredToDMC = tasks.filter(t => t.status === 'completed').length;
  const totalCoverages = tasks.length;
  const recentTasks = [...tasks].reverse().slice(0, 5);

  return (
    <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm mb-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Activity size={18} className="text-blue-500" />
          Coverage & DMC NAS Tracker
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Live monitoring para sa assigned coverages at file transfers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div whileHover={{ y: -2 }} className="bg-blue-50 rounded-xl p-5 border border-blue-100 shadow-sm">
          <div className="flex items-center gap-2 text-blue-600 mb-3">
            <Camera size={18} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Xy's Coverages</span>
          </div>
          <div className="text-4xl font-black text-blue-700">{xyCoverages}</div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 mb-3">
            <Video size={18} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Pat's Coverages</span>
          </div>
          <div className="text-4xl font-black text-indigo-700">{patCoverages}</div>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-emerald-50 rounded-xl p-5 border border-emerald-100 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 mb-3">
            <HardDrive size={18} />
            <span className="text-[11px] font-bold uppercase tracking-wider">DMC Transferred</span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-4xl font-black text-emerald-700">{transferredToDMC}</div>
            <div className="text-sm font-bold text-emerald-600/60">/ {totalCoverages}</div>
          </div>
        </motion.div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Activity size={14} className="text-slate-400"/> Recent Activity
        </h3>
        <div className="space-y-3">
          {recentTasks.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No coverages recorded yet.</p>
          ) : (
            recentTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-blue-100 transition-colors">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-slate-700">{task.title}</span>
                  <span className="text-[10px] font-mono text-slate-500">{task.description}</span>
                </div>
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                  task.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                  task.status === 'in-progress' ? 'bg-amber-100 text-amber-700' : 
                  'bg-slate-100 text-slate-600'
                }`}>
                  {task.status === 'completed' ? 'Transferred' : task.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}