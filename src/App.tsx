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
  const [selectedIPCRPersonnel, setSelectedIPCRPersonnel] = useState<string>('Xyrus');

  // SCRIPT_URL MO
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyU3SyLrptMwqwfkVh8UrcocsPUCKPSEIPMJsjzTcxBwXa279xmN8dJR5XOhi_68gRmrg/exec";
  
  // MGA LINKS
  const PRE_ARCHIVAL_LINK = "https://docs.google.com/spreadsheets/d/1Q2H3AelKocMLImvjkXpy9j1z89qWYYok0-BPj68QPCE/edit?gid=0#gid=0";
  const DMC_MONITORING_LINK = "https://docs.google.com/spreadsheets/d/1DmfloCwW90g5Rru4-l1N5DSbqyLGbga6OkklX_w1Skc/edit?gid=32561347#gid=32561347";

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
          status: row['DMC Status'] || 'Upcoming',
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

  const teamMembers = [
    { name: 'Xyrus', image: '/AVNXT-2.jpg' },
    { name: 'Marx', image: '/AVNXT-3.jpg' },
    { name: 'Reiner', image: '/AVNXT-4.jpg' },
    { name: 'Pat', image: '/AVNXT.jpg' },
  ];

  // IPCR Official Details
  const officialDetails: Record<string, { fullName: string, designation: string }> = {
    'Xyrus': { fullName: 'Xyrus Ivan B. De Gracia', designation: 'Audio Visual Aides Technician IV' },
    'Marx': { fullName: 'Marx Lenin G. Halili', designation: 'Science Research Specialist II' },
    'Reiner': { fullName: 'Reiner M. Zagada', designation: 'Audio Visual Aides Technician III' },
    'Pat': { fullName: 'Patrick James Lee C. Alfonso', designation: 'Photographer II' },
    'Lotus': { fullName: 'Ma. Lotuslei P. Dimagiba', designation: 'Supervising SRS' }
  };
  
  const getLatestDeployment = (name: string) => {
    return coverages.find(c => c.personnel.toLowerCase().includes(name.toLowerCase()));
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    
    // 1. PENDING (Gray)
    if (s.includes('not yet') || s.includes('not transferred')) {
      return <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-[10px] font-bold border border-slate-600">⏳ PENDING</span>;
    }
    
    // 2. ARCHIVED (Purple)
    if (s.includes('100% archived')) {
      return <span className="px-3 py-1 bg
