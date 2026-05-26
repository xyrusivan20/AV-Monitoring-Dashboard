import React, { useState, useEffect, useCallback } from 'react';

interface Coverage {
  id: string;
  details: string;
  personnel: string;
  gdrive: string;
  socialMediaLink: string;
  status: string;
  date: string;
}

export default function App() {
  const [coverages, setCoverages] = useState<Coverage[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // SCRIPT_URL MO
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyU3SyLrptMwqwfkVh8UrcocsPUCKPSEIPMJsjzTcxBwXa279xmN8dJR5XOhi_68gRmrg/exec";

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(SCRIPT_URL);
      const data = await response.json();

      const formatted = data
        .filter((row: any) => row['Coverage Details'] || row['Coverage ID'])
        .map((row: any) => ({
          id: row['Coverage ID'],
          details: row['Coverage Details'],
          personnel: row['Assigned Personnel'] || 'Unassigned',
          gdrive: row['GDrive Link'] || '',
          socialMediaLink: row['Social Media Link'] || '',
          status: row['DMC Status'] || 'Pending',
          date: row['Date Uploaded'] || new Date().toISOString().split('T')[0],
        }))
        .reverse(); 

      setCoverages(formatted);
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' }));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, [SCRIPT_URL]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  // DITO MO ILALAGAY ANG MGA LINKS NG PICTURES NINYO
  // Pwede mong i-upload sa imgur.com o gamitin ang direct link galing Google Drive
  const teamMembers = [
    { name: 'Xyrus', image: 'https://ui-avatars.com/api/?name=XY&background=Fb82f6&color=fff&size=128'},
    { name: 'Marx', image: 'https://ui-avatars.com/api/?name=MX&background=3b82f6&color=fff&size=128' },
    { name: 'Reiner', image: 'https://ui-avatars.com/api/?name=RZ&background=f59e0b&color=fff&size=128' },
    { name: 'Pat', image: 'https://ui-avatars.com/api/?name=PJ&background=8b5cf6&color=fff&size=128' }
  ];
  
  const getLatestDeployment = (name: string) => {
    return coverages.find(c => c.personnel.toLowerCase().includes(name.toLowerCase()));
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('100%') || s.includes('dmc nas')) {
      return <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold border border-emerald-500/30">✔ 100% DMC NAS</span>;
    }
    if (s.includes('supervisor') || s.includes('check')) {
      return <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-bold border border-blue-500/30">👀 CHECKED</span>;
    }
    if (s.includes('file')) {
      return <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-bold border border-amber-500/30">📁 FILED</span>;
    }
    return <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-[10px] font-bold border border-slate-600">⏳ PENDING</span>;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      
      {/* Header Section */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase">
            AV Coverage <span className="text-emerald-500">Monitoring</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest font-semibold">
            AV Coverage and DMC Monitoring Tool
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 shadow-inner">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs text-slate-400 font-mono">LIVE UPDATE: {lastUpdated}</span>
        </div>
      </
