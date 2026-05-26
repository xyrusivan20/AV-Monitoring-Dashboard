import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Camera, Video, Clock, Zap } from 'lucide-react';
import { Task } from '../types';

// Ginawa nating optional yung lumang props para hindi mag-error ang system,
// tapos nagdagdag tayo ng `tasks` para mabilang ang coverages ninyo.
interface MetricCardsProps {
  tasks?: Task[];
  efficiencyScore?: number;
  completionRate?: number;
  focusMinutes?: number;
  pendingAlertsCount?: number;
  onRefreshMetrics?: () => void;
}

export default function MetricCards({
  tasks = [],
  onRefreshMetrics,
}: MetricCardsProps) {
  
  // ==========================================
  // REAL-TIME CLOCK LOGIC
  // ==========================================
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Mag-uupdate ang oras kada 1 segundo (1000ms)
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // ==========================================
  // DOSTv COUNTERS
  // ==========================================
  const supervisorChecked = tasks.filter(t => t.status === 'completed').length;
  const xyCoverages = tasks.filter(t => t.description?.includes('Assigned: Xy')).length;
  const patCoverages = tasks.filter(t => t.description?.includes('Assigned: Pat')).length;
  const totalCoverages = tasks.length;

  const cards = [
    {
      id: 'checked',
      title: 'SUPERVISOR CHECKED',
      value: `${supervisorChecked} / ${totalCoverages}`,
      badge: 'DMC Transferred',
      badgeType: 'success',
      icon: CheckCircle2,
      borderColor: 'border-slate-200/80 hover:border-emerald-300',
      iconBg: 'bg-emerald-50 text-emerald-600',
      sparkColor: 'bg-emerald-500',
      description: 'Mga approved at transferred na coverages',
    },
    {
      id: 'xy',
      title: "XY'S COVERAGES",
      value: xyCoverages.toString(),
      badge: 'Audio Visual Aids Technician IV',
      badgeType: 'info',
      icon: Camera,
      borderColor: 'border-slate-200/80 hover:border-blue-300',
      iconBg: 'bg-blue-50 text-blue-600',
      sparkColor: 'bg-blue-500',
      description: 'Total uploaded by Xy',
    },
    {
      id: 'pat',
      title: "PAT'S COVERAGES",
      value: patCoverages.toString(),
      badge: 'Photographer II',
      badgeType: 'info',
      icon: Video,
      borderColor: 'border-slate-200/80 hover:border-indigo-300',
      iconBg: 'bg-indigo-50 text-indigo-600',
      sparkColor: 'bg-indigo-500',
      description: 'Total uploaded by Pat',
    },
    {
      id: 'time',
      title: 'SYSTEM CLOCK',
      value: timeString,
      badge: dateString,
      badgeType: 'neutral',
      icon: Clock,
      borderColor: 'border-slate-200/80 hover:border-slate-400',
      iconBg: 'bg-slate-100 text-slate-600',
      sparkColor: 'bg-slate-400',
      description: 'Philippine Standard Time',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.4 }}
            className={`relative overflow-hidden bg-white border rounded-[24px] p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group ${card.borderColor}`}
          >
            {/* Top row */}
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] tracking-wider text-slate-400 font-bold font-mono">
                {card.title}
              </span>
              <div className={`p-2 rounded-xl ${card.iconBg} font-medium`}>
                <Icon size={16} />
              </div>
            </div>

            {/* Value and Badge */}
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">
                {card.value}
              </h3>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold font-mono uppercase ${
                  card.badgeType === 'success'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/80'
                    : card.badgeType === 'info'
                    ? 'bg-blue-50 text-blue-600 border border-blue-100/80'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {card.badge}
              </span>
            </div>

            {/* Minimalist Progress Bar */}
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
              <div 
                className={`h-full ${card.sparkColor} opacity-80`} 
                style={{ width: card.id === 'time' ? '100%' : '60%' }} 
              />
            </div>

            {/* Bottom comment */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-3 font-sans">
              <span className="truncate pr-1">{card.description}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}