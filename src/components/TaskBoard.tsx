import React, { useState } from 'react';
import { Task } from '../types';
import { Plus, Trash2, Grid, Check, Circle, Link as LinkIcon } from 'lucide-react';

interface TaskBoardProps {
  tasks: Task[];
  onAddTask: (data: any) => void;
  onUpdateTaskStatus: (id: string, status: Task['status']) => void;
  onDeleteTask: (id: string) => void;
  onSeedTasks: () => void;
}

export default function TaskBoard({ tasks, onAddTask, onUpdateTaskStatus, onDeleteTask }: TaskBoardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [coverageDetails, setCoverageDetails] = useState('');
  const [assignedPersonnel, setAssignedPersonnel] = useState('Xy');
  const [gdriveLink, setGdriveLink] = useState('');
  const [socialMediaLink, setSocialMediaLink] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTask({
      coverageDetails,
      assignedPersonnel,
      gdriveLink,
      socialMediaLink,
    });
    setCoverageDetails(''); setGdriveLink(''); setSocialMediaLink(''); setShowAddForm(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Grid size={18} className="text-blue-500" /> Workspace
        </h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)} 
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
        >
          <Plus size={14} /> {showAddForm ? "Cancel" : "New Coverage"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-5 bg-slate-50 rounded-[20px] space-y-3 border border-slate-200">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Details</label>
            <input required placeholder="Project Name / Event Details" value={coverageDetails} onChange={e => setCoverageDetails(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Assigned</label>
              <select value={assignedPersonnel} onChange={e => setAssignedPersonnel(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm outline-none">
                <option value="Xy">Xy</option>
                <option value="Pat">Pat</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">GDrive Link</label>
              <input placeholder="https://..." value={gdriveLink} onChange={e => setGdriveLink(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Social Media Link</label>
            <input placeholder="FB Post Link" value={socialMediaLink} onChange={e => setSocialMediaLink(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm outline-none" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-200">Upload to System</button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {tasks.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm italic">No records found.</div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="p-4 border border-slate-100 rounded-[20px] flex justify-between items-center bg-white hover:border-blue-200 transition-all shadow-sm">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => onUpdateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                  className={`p-2 rounded-full transition-colors ${task.status === 'completed' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-300'}`}
                >
                  {task.status === 'completed' ? <Check size={20} /> : <Circle size={20} />}
                </button>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{task.title}</h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{task.description}</p>
                  <div className="flex gap-2 mt-2">
                    <a href={task.description.split('GDrive: ')[1]?.split('|')[0].trim()} target="_blank" rel="noreferrer" className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-bold hover:bg-blue-100 transition-colors uppercase">Drive</a>
                    <a href={task.description.split('SocMed: ')[1]?.trim()} target="_blank" rel="noreferrer" className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-bold hover:bg-indigo-100 transition-colors uppercase">SocMed</a>
                    {task.status !== 'completed' && (
                      <button onClick={() => onUpdateTaskStatus(task.id, 'completed')} className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-[9px] font-bold hover:bg-emerald-600 transition-colors">MARK AS NAS</button>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => onDeleteTask(task.id)} 
                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
              >
                <Trash2 size={18}/>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}