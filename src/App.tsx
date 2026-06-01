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

  // TRUE BLACK THEME + CYAN ACCENT STATUS BADGES
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    
    // 1. PENDING (Muted Gray/Black)
    if (s.includes('not yet') || s.includes('not transferred')) {
      return <span className="px-3 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-[10px] font-bold border border-zinc-700">⏳ PENDING</span>;
    }
    
    // 2. ARCHIVED (Muted Dark Gray)
    if (s.includes('100% archived')) {
      return <span className="px-3 py-1 bg-zinc-900/80 text-zinc-400 rounded-full text-[10px] font-bold border border-zinc-800">🌟 ARCHIVED</span>;
    }
    // 3. UPCOMING (Red Alert)
    if (s.includes('upcoming')) {
      return <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-[10px] font-bold border border-red-500/30">📅 UPCOMING</span>;
    }
    // 4. TRANSFERRED/COMPLETED (CYAN GLOW ACCENT)
    if (s.includes('100%') || s.includes('dmc nas') || s.includes('transfer completed') || s.includes('completed')) {
      return <span className="px-3 py-1 bg-[#00aeef]/10 text-[#00aeef] rounded-full text-[10px] font-bold border border-[#00aeef]/30 shadow-[0_0_10px_rgba(0,174,239,0.1)]">✔ DMC TRANSFERRED</span>;
    }
    // 5. CHECKED (CYAN ACCENT)
    if (s.includes('supervisor') || s.includes('check')) {
      return <span className="px-3 py-1 bg-[#00aeef]/10 text-[#00aeef] rounded-full text-[10px] font-bold border border-[#00aeef]/30">👀 CHECKED</span>;
    }
    
    // Default -> PENDING
    return <span className="px-3 py-1 bg-zinc-800/80 text-zinc-300 rounded-full text-[10px] font-bold border border-zinc-700">⏳ PENDING</span>;
  };

  const getIPCRRecords = () => {
    if (selectedIPCRPersonnel === 'Lotus') {
      return coverages.filter(c => {
        const s = (c.status || '').toLowerCase();
        if (s.includes('not yet') || s.includes('not transferred')) return false;
        return s.includes('check') || 
               s.includes('transfer') || 
               s.includes('completed') || 
               s.includes('dmc') || 
               s.includes('archive') || 
               s.includes('100%');
      });
    }
    return coverages.filter(c => (c.personnel || '').toLowerCase().includes(selectedIPCRPersonnel.toLowerCase()));
  };

  const ipcrRecords = getIPCRRecords();

  return (
    // Pinalitan ang slate ng zinc para sa true black/gray feel
    <div className="min-h-screen text-zinc-200 p-4 md:p-8 font-sans selection:bg-[#00aeef]/30">
      
      {/* --- DASHBOARD VIEW (NO-PRINT AREA) --- */}
      <div className="no-print space-y-8">
        <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end border-b border-zinc-800 pb-6 gap-4">
          <div>
            <div className="mb-8 flex items-center gap-2">
              <img 
                src="/stii.png" 
                alt="Official Logo" 
                className="h-25 w-auto drop-shadow-md" 
              /> 
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight uppercase drop-shadow-sm mb-1">
              AV <span className="text-[#00aeef] drop-shadow-[0_0_8px_rgba(0,174,239,0.4)]"> Nexus</span>
            </h1>
            <p className="text-zinc-400 text-xs mt-1 uppercase tracking-widest font-semibold">
              Coverage & DMC Monitoring Dashboard
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            {/* Darker pure black background for small modules */}
            <div className="flex items-center gap-3 bg-zinc-950/80 px-4 py-2 rounded-lg border border-zinc-800 shadow-inner">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-xs text-zinc-400 font-mono">LIVE UPDATE: {lastUpdated}</span>
            </div>
            <div className="flex items-center gap-2">
              <a href={PRE_ARCHIVAL_LINK} target="_blank" rel="noreferrer" className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors border border-zinc-700 shadow-md">
                📁 Pre-Archival
              </a>
              {/* Using the exact Cyan for the DMC Button */}
              <a href={DMC_MONITORING_LINK} target="_blank" rel="noreferrer" className="bg-[#00aeef]/90 hover:bg-[#00aeef] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-[0_0_15px_rgba(0,174,239,0.2)]">
                📊 DMC Monitoring IRAD
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto space-y-8">
          <section>
            <h2 className="text-sm font-bold text-zinc-400 mb-4 tracking-widest border-l-4 border-red-500 pl-3">AV TEAM STATUS</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {teamMembers.map(member => {
                const latest = getLatestDeployment(member.name);
                return (
                  // Pure dark gray/black background (zinc-950) with subtle cyan border on hover
                  <div key={member.name} className="group bg-[#09090b]/80 border border-zinc-800 rounded-xl p-5 hover:border-[#00aeef]/50 hover:bg-[#09090b] transition-all duration-300 overflow-hidden cursor-default relative backdrop-blur-sm">
                    <div className="flex items-center gap-4 mb-4">
                      {/* Avatar border changes to cyan glow on hover */}
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-zinc-800 group-hover:border-[#00aeef] transition-colors duration-300 shadow-lg shrink-0">
                        <img src={member.image} alt={member.name} className="w-full h-full object-cover transform group-hover:scale-125 transition-transform duration-500" />
                      </div>
                      <div className="flex-1 flex justify-between items-center">
                        <h3 className="font-black text-xl text-white uppercase tracking-wider">{member.name}</h3>
                        {latest ? (
                          <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                          </span>
                        ) : (
                          <span className="h-3 w-3 rounded-full bg-zinc-800"></span>
                        )}
                      </div>
                    </div>
                    {latest ? (
                      <div className="relative z-10">
                        <p className="text-sm text-zinc-300 line-clamp-2 mb-3 leading-relaxed" title={latest.details}>{latest.details}</p>
                        <div className="flex justify-between items-center">
                           {getStatusBadge(latest.status)}
                           <span className="text-[10px] text-zinc-500 font-mono">{latest.date.split(' ')[0]}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600 italic mt-6">Standby / No active deployment.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-2">
              <h2 className="text-sm font-bold text-zinc-400 mb-4 tracking-widest border-l-4 border-red-500 pl-3">RECENT RECORDS</h2>
              <div className="space-y-4">
                {coverages.slice(0, 8).map((cov, idx) => (
                  <div key={idx} className="bg-[#09090b]/80 border border-zinc-800 rounded-lg p-5 flex flex-col md:flex-row justify-between gap-4 hover:bg-[#09090b] transition-colors backdrop-blur-sm">
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-zinc-100 mb-2 leading-snug">{cov.details || "Untitled Coverage"}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono mb-3">
                        <span className="bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded uppercase font-bold tracking-wider">{cov.personnel}</span>
                        <span className="text-zinc-600">•</span>
                        <span>{cov.date.split(' ')[0]}</span>
                      </div>

                      <div className="flex items-center gap-4 mt-2">
                        {cov.gdrive && (
                          <a href={cov.gdrive} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-[#00aeef] hover:text-white transition-colors drop-shadow-[0_0_2px_rgba(0,174,239,0.5)]">
                            📂 GDrive
                          </a>
                        )}
                        {cov.socialMediaLink && (
                          <a href={cov.socialMediaLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-[#00aeef] hover:text-white transition-colors drop-shadow-[0_0_2px_rgba(0,174,239,0.5)]">
                            🌐 Social Media
                          </a>
                        )}
                      </div>

                    </div>
                    <div className="flex flex-col items-start md:items-end justify-center gap-3">
                      {getStatusBadge(cov.status)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="lg:col-span-1 space-y-8">
              <div>
                <h2 className="text-sm font-bold text-zinc-400 mb-4 tracking-widest border-l-4 border-red-500 pl-3">AV CALENDAR</h2>
                <div className="bg-[#09090b]/80 border border-zinc-800 rounded-xl overflow-hidden h-[450px] relative flex items-center justify-center group backdrop-blur-sm">
                  <iframe src="https://calendar.google.com/calendar/embed?src=av%40stii.dost.gov.ph&ctz=Asia%2FSingapore" style={{ border: 0 }} width="100%" height="100%" frameBorder="0" scrolling="no" className="absolute inset-0 opacity-80 hover:opacity-100 transition-opacity" title="AV Calendar"></iframe>
                </div>
              </div>
            </section>
          </div>

          {/* IPCR GENERATOR PANEL */}
          <section className="border-t border-zinc-800 pt-8 mt-12">
            <div className="bg-[#09090b]/80 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-wide uppercase">IPCR / MOV Report Generator</h2>
                  <p className="text-zinc-400 text-xs">Pumili ng pangalan para i-collate ang mga records para sa IPCR/SPMS attachment.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select 
                    value={selectedIPCRPersonnel} 
                    onChange={(e) => setSelectedIPCRPersonnel(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:border-[#00aeef]"
                  >
                    <option value="Xyrus">Xyrus (AVAT IV)</option>
                    <option value="Marx">Marx (SRS II)</option>
                    <option value="Reiner">Reiner (AVAT III)</option>
                    <option value="Pat">Pat (Photographer II)</option>
                    <option value="Lotus">Ma'am Lotus (Supervisor Tally)</option>
                  </select>
                  <button 
                    onClick={() => window.print()}
                    className="bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors shadow-[0_0_10px_rgba(220,38,38,0.3)] flex items-center gap-2"
                  >
                    🖨 Print / Save as PDF
                  </button>
                </div>
              </div>

              {/* Box Preview on Web */}
              <div className="bg-black border border-zinc-800 rounded-lg p-5 font-mono text-sm max-h-[400px] overflow-y-auto custom-scrollbar">
                <p className="text-red-500 font-bold border-b border-zinc-800 pb-2 mb-3">📄 WEB PREVIEW (Ito ang itsura kapag na-print):</p>
                <div className="text-zinc-300 space-y-1">
                  <p className="text-base font-bold text-white uppercase">
                    {officialDetails[selectedIPCRPersonnel]?.fullName || selectedIPCRPersonnel} - TOTAL: {ipcrRecords.length} {selectedIPCRPersonnel === 'Lotus' ? 'VERIFIED/CHECKED' : 'COVERAGES CATERED'}
                  </p>
                  <p className="text-zinc-700">--------------------------------------------------</p>
                  {ipcrRecords.map((cov, idx) => (
                    <p key={idx} className="whitespace-pre-wrap leading-relaxed">
                      <span className="text-red-500 font-bold">{idx + 1}.</span> [{cov.date.split(' ')[0]}] - {cov.details} | <span className="text-zinc-600">[{cov.status.toUpperCase()}]</span>
                    </p>
                  ))}
                  {ipcrRecords.length === 0 && <p className="text-zinc-600 italic">Walang nakitang records sa taong ito.</p>}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* --- OFFICIAL PRINT-ONLY SHEET --- */}
      <div className="print-only hidden font-serif p-8 text-black bg-white text-base">
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wide">
            {selectedIPCRPersonnel === 'Lotus' ? 'SUPERVISORY VERIFICATION REPORT' : 'AV PRODUCTION SERVICES COVERAGE REPORT'}
          </h1>
          <p className="text-sm tracking-widest uppercase mt-1">AV COVERAGE AND DMC VERIFICATION</p>
          <p className="text-xs italic mt-1">Official Reference Document for IPCR </p>
        </div>

        <div className="mb-6">
          <p className="text-lg font-bold uppercase">NAME: <span className="underline">{officialDetails[selectedIPCRPersonnel]?.fullName || selectedIPCRPersonnel}</span></p>
          <p className="text-md font-bold uppercase">POSITION: {officialDetails[selectedIPCRPersonnel]?.designation}</p>
          <p className="text-lg font-bold uppercase mt-3">
            {selectedIPCRPersonnel === 'Lotus' ? 'TOTAL VERIFIED / CHECKED:' : 'TOTAL CATERED OPERATIONS:'} <span className="underline">{ipcrRecords.length} RECORDS</span>
          </p>
        </div>

        <div className="border border-black rounded">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-black text-sm font-bold">
                <th className="p-3 border-r border-black w-12 text-center">#</th>
                <th className="p-3 border-r border-black w-32">DATE</th>
                <th className="p-3 border-r border-black w-40">STATUS</th>
                <th className="p-3">COVERAGE PARTICULARS & DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {ipcrRecords.map((cov, idx) => (
                <tr key={idx} className="border-b border-gray-300 last:border-b-0 text-sm">
                  <td className="p-3 border-r border-black text-center font-bold">{idx + 1}</td>
                  <td className="p-3 border-r border-black font-mono">{cov.date.split(' ')[0]}</td>
                  <td className="p-3 border-r border-black font-mono uppercase text-xs">{cov.status}</td>
                  <td className="p-3 leading-relaxed">{cov.details}</td>
                </tr>
              ))}
              {ipcrRecords.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center italic text-gray-500">No official coverage records found for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-12 flex justify-between text-sm">
          <div>
            <p>Prepared / Submitted By:</p>
            <div className="mt-8 font-bold uppercase border-b border-black w-64 text-center">{officialDetails[selectedIPCRPersonnel]?.fullName || selectedIPCRPersonnel}</div>
            <p className="text-xs text-gray-600 mt-1">{officialDetails[selectedIPCRPersonnel]?.designation}</p>
          </div>
          {selectedIPCRPersonnel !== 'Lotus' && (
            <div>
              <p>Verified By:</p>
              <div className="mt-8 font-bold uppercase border-b border-black w-64 text-center">{officialDetails['Lotus'].fullName}</div>
              <p className="text-xs text-gray-600 mt-1">{officialDetails['Lotus'].designation}</p>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          html, body { background: white !important; color: black !important; font-family: 'Times New Roman', Times, serif !important; }
          @page { size: A4; margin: 20mm 15mm; }
        }
      `}} />
    </div>
  );
}
